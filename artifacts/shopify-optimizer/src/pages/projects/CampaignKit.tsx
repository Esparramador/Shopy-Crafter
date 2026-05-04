import { useState, useEffect, useCallback } from "react";
import { useRoute } from "wouter";
import {
  Film, Copy, Check, ChevronDown, ChevronRight, Play, Clock, Mic2,
  Palette, Clapperboard, ListChecks, Lightbulb, Monitor, Wand2, Loader2,
  Download, Users, Sparkles, LayoutGrid, Timer, FileText, Layers,
} from "lucide-react";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface VoiceOverCue { startSec: number; endSec: number; speaker: string; text: string; }
interface VideoCampaign {
  id: string; index: number; title: string; slug: string; concept: string;
  durationSec: number; headline: string; musicCue: string;
  prompt916: string; prompt169: string; voiceOver: VoiceOverCue[];
}
interface UgcClip {
  id: string; videoRef: string; videoIndex: number; clipIndex: number;
  clipLabel: string; timecode: string; purpose: string; dialogue: string; prompt: string;
}
interface MasterSegment {
  index: number; videoRef: string; videoTitle: string;
  startTime: string; endTime: string; durationSec: number;
  transition: string; clipFiles: string[];
}
interface CharacterLock { id: string; name: string; variant: string; description: string; promptFragment: string; usageTip: string; }
interface ProductionTip { id: string; category: string; title: string; description: string; }
interface TechSpec { id: string; format: string; resolution: string; fps: number; codec: string; bitrateMbps: string; notes: string; }
interface Deliverable { id: string; category: string; description: string; quantity: number; format: string; dimensions: string; }
interface AiTool { rank: number; name: string; bestFor: string; notes: string; }
interface StoryboardSlide { slideNumber: number; title: string; content: string; }

interface AdaptedVideo { index: number; title: string; headline?: string; prompt916?: string; voiceOverScript?: string; }
interface AdaptedCampaign { brandName: string; characterDescription?: string; videos?: AdaptedVideo[]; }

type Tab = "videos" | "ugc" | "timeline" | "storyboard" | "tools" | "adapt";

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

export default function CampaignKit() {
  const [, params] = useRoute("/projects/:id/campaign-kit");
  const projectId = params?.id ?? "0";

  const [tab, setTab] = useState<Tab>("videos");
  const [videos, setVideos] = useState<VideoCampaign[]>([]);
  const [clips, setClips] = useState<UgcClip[]>([]);
  const [timeline, setTimeline] = useState<MasterSegment[]>([]);
  const [characters, setCharacters] = useState<CharacterLock[]>([]);
  const [tips, setTips] = useState<ProductionTip[]>([]);
  const [specs, setSpecs] = useState<TechSpec[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [tools, setTools] = useState<AiTool[]>([]);
  const [slides, setSlides] = useState<StoryboardSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [expandedVideo, setExpandedVideo] = useState<string | null>(null);
  const [expandedClipGroup, setExpandedClipGroup] = useState<number | null>(null);
  const [promptView, setPromptView] = useState<Record<string, "916" | "169">>({});

  const [adaptForm, setAdaptForm] = useState({ brandName: "", industry: "", coreOffering: "", targetAudience: "", toneOfVoice: "", visualIdentity: "", emotionalBenefit: "", primaryColor: "#000000", accentColor: "#FFD700" });
  const [adapting, setAdapting] = useState(false);
  const [adaptResult, setAdaptResult] = useState<AdaptedCampaign | null>(null);
  const [adaptError, setAdaptError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`${API}/api/fs-pro/campaign-production/full`, { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (!d.ok) throw new Error(d.error || "Error al cargar datos");
        setVideos(d.videoCampaigns || []);
        setClips(d.ugcMicroClips || []);
        setTimeline(d.masterCutTimeline || []);
        setCharacters(d.characterLocks || []);
        setTips(d.productionTips || []);
        setSpecs(d.techSpecs || []);
        setDeliverables(d.deliverablesChecklist || []);
        setTools(d.aiVideoTools || []);
        setSlides(d.storyboardSlides || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleAdapt = async () => {
    setAdapting(true);
    setAdaptError("");
    setAdaptResult(null);
    try {
      const r = await fetch(`${API}/api/fs-pro/campaign-production/adapt-for-brand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...adaptForm, projectId }),
      });
      if (!r.ok) { const errBody = await r.json().catch(() => ({})); throw new Error(errBody.error || `Error ${r.status}`); }
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Error en la adaptación");
      setAdaptResult(d.adapted as AdaptedCampaign);
    } catch (e: any) {
      setAdaptError(e.message);
    } finally {
      setAdapting(false);
    }
  };

  const clipsByVideo = clips.reduce<Record<number, UgcClip[]>>((acc, c) => {
    (acc[c.videoIndex] ??= []).push(c);
    return acc;
  }, {});

  const tabItems: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "videos", label: "6 Videos", icon: <Film size={16} /> },
    { key: "ugc", label: "22 UGC Clips", icon: <Users size={16} /> },
    { key: "timeline", label: "Master Cut", icon: <Timer size={16} /> },
    { key: "storyboard", label: "Storyboard", icon: <Layers size={16} /> },
    { key: "tools", label: "Tools & Specs", icon: <Monitor size={16} /> },
    { key: "adapt", label: "Adaptar IA", icon: <Wand2 size={16} /> },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh] gap-3 text-zinc-400">
      <Loader2 className="animate-spin" size={24} />
      <span>Cargando Kit de Producción…</span>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="bg-red-900/30 border border-red-800 rounded-lg p-6 text-center max-w-md">
        <p className="text-red-300 font-medium">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-3 px-4 py-2 bg-red-800 hover:bg-red-700 rounded text-sm text-white">Reintentar</button>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
          <Clapperboard size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Kit de Producción de Campaña</h1>
          <p className="text-sm text-zinc-400">6 videos · 22 UGC clips · Master Cut 2:10 · Prompts listos para IA</p>
        </div>
      </div>

      {characters.length > 0 && (
        <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-800 border border-zinc-700/50 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
            <Palette size={14} /> Character Lock — Crafter
          </h3>
          <div className="grid md:grid-cols-2 gap-3">
            {characters.map(ch => (
              <div key={ch.id} className="bg-zinc-800/60 rounded-lg p-3 border border-zinc-700/40">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${ch.variant === "holographic" ? "bg-cyan-900/50 text-cyan-300" : "bg-emerald-900/50 text-emerald-300"}`}>
                    {ch.variant === "holographic" ? "Holographic" : "UGC Real"}
                  </span>
                  <span className="text-sm font-medium text-white">{ch.name}</span>
                </div>
                <p className="text-xs text-zinc-400 mb-2">{ch.description}</p>
                <div className="bg-zinc-900 rounded p-2 mb-2">
                  <p className="text-xs text-zinc-300 font-mono leading-relaxed">{ch.promptFragment}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-amber-400/80 italic">{ch.usageTip}</p>
                  <CopyBtn text={ch.promptFragment} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-700/50 overflow-x-auto">
        {tabItems.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${tab === t.key ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "videos" && (
        <div className="space-y-3">
          {videos.map(v => {
            const expanded = expandedVideo === v.id;
            const view = promptView[v.id] || "916";
            return (
              <div key={v.id} className="bg-zinc-900 border border-zinc-700/50 rounded-xl overflow-hidden">
                <button onClick={() => setExpandedVideo(expanded ? null : v.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-600/20 rounded-lg flex items-center justify-center text-amber-400 font-bold text-sm">{v.index}</div>
                    <div>
                      <h3 className="text-white font-semibold">{v.title}</h3>
                      <p className="text-xs text-zinc-400">{v.concept} · {v.durationSec}s</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-300">{v.durationSec}s</span>
                    {expanded ? <ChevronDown size={16} className="text-zinc-400" /> : <ChevronRight size={16} className="text-zinc-400" />}
                  </div>
                </button>
                {expanded && (
                  <div className="px-4 pb-4 space-y-4 border-t border-zinc-800">
                    <div className="grid md:grid-cols-2 gap-4 pt-4">
                      <div>
                        <h4 className="text-sm font-medium text-amber-400 mb-2 flex items-center gap-1"><FileText size={14} /> Headline</h4>
                        <div className="bg-zinc-800 rounded-lg p-3 flex items-center justify-between">
                          <p className="text-white font-medium">{v.headline}</p>
                          <CopyBtn text={v.headline} />
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-purple-400 mb-2 flex items-center gap-1"><Mic2 size={14} /> Música</h4>
                        <div className="bg-zinc-800 rounded-lg p-3">
                          <p className="text-xs text-zinc-300">{v.musicCue}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-cyan-400 flex items-center gap-1"><Play size={14} /> Prompt de Video</h4>
                        <div className="flex gap-1 bg-zinc-800 rounded p-0.5">
                          <button onClick={() => setPromptView(p => ({ ...p, [v.id]: "916" }))}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${view === "916" ? "bg-cyan-600 text-white" : "text-zinc-400 hover:text-white"}`}>9:16</button>
                          <button onClick={() => setPromptView(p => ({ ...p, [v.id]: "169" }))}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${view === "169" ? "bg-cyan-600 text-white" : "text-zinc-400 hover:text-white"}`}>16:9</button>
                        </div>
                      </div>
                      <div className="bg-zinc-800 rounded-lg p-3 relative">
                        <p className="text-xs text-zinc-300 font-mono leading-relaxed pr-16">{view === "916" ? v.prompt916 : v.prompt169}</p>
                        <div className="absolute top-2 right-2">
                          <CopyBtn text={view === "916" ? v.prompt916 : v.prompt169} />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-emerald-400 mb-2 flex items-center gap-1"><Mic2 size={14} /> Voice-Over Script</h4>
                      <div className="space-y-1">
                        {v.voiceOver.map((vo, i) => (
                          <div key={i} className="bg-zinc-800 rounded-lg p-2 flex items-center gap-3">
                            <span className="text-xs text-zinc-500 font-mono w-16 shrink-0">{vo.startSec}-{vo.endSec}s</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${vo.speaker === "crafter" ? "bg-cyan-900/50 text-cyan-300" : "bg-zinc-700 text-zinc-300"}`}>{vo.speaker}</span>
                            <p className="text-sm text-white flex-1">{vo.text}</p>
                            <CopyBtn text={vo.text} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "ugc" && (
        <div className="space-y-3">
          <div className="bg-zinc-900/50 border border-zinc-700/50 rounded-lg p-3 flex items-start gap-2">
            <Lightbulb size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-zinc-400">22 micro-clips de 6 segundos para UGC con lip-sync. Cada clip tiene un prompt listo para copiar-pegar en Grok Imagine, Kling o Runway.</p>
          </div>
          {Object.entries(clipsByVideo).sort(([a], [b]) => Number(a) - Number(b)).map(([vidIdx, vClips]) => {
            const vidNum = Number(vidIdx);
            const vidTitle = videos.find(v => v.index === vidNum)?.title || `Video ${vidNum}`;
            const isExpanded = expandedClipGroup === vidNum;
            return (
              <div key={vidNum} className="bg-zinc-900 border border-zinc-700/50 rounded-xl overflow-hidden">
                <button onClick={() => setExpandedClipGroup(isExpanded ? null : vidNum)}
                  className="w-full flex items-center justify-between p-3 hover:bg-zinc-800/50 transition-colors text-left">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-emerald-600/20 rounded-lg flex items-center justify-center text-emerald-400 font-bold text-xs">{vidNum}</div>
                    <span className="text-white font-medium text-sm">{vidTitle}</span>
                    <span className="text-xs text-zinc-500">{vClips.length} clips</span>
                  </div>
                  {isExpanded ? <ChevronDown size={16} className="text-zinc-400" /> : <ChevronRight size={16} className="text-zinc-400" />}
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2 border-t border-zinc-800 pt-2">
                    {vClips.map(c => (
                      <div key={c.id} className="bg-zinc-800/60 rounded-lg p-3 border border-zinc-700/30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono bg-zinc-700 px-1.5 py-0.5 rounded text-zinc-300">{c.clipLabel}</span>
                            <span className="text-xs text-zinc-500">{c.timecode}</span>
                            <span className="text-xs text-zinc-400">{c.purpose}</span>
                          </div>
                          <CopyBtn text={c.prompt} />
                        </div>
                        {c.dialogue && (
                          <div className="mb-2 flex items-start gap-2">
                            <Mic2 size={12} className="text-amber-400 mt-0.5 shrink-0" />
                            <p className="text-xs text-amber-300/80 italic">"{c.dialogue}"</p>
                          </div>
                        )}
                        <div className="bg-zinc-900 rounded p-2">
                          <p className="text-xs text-zinc-400 font-mono leading-relaxed">{c.prompt}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "timeline" && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-amber-900/20 to-zinc-900 border border-amber-700/30 rounded-xl p-4">
            <h3 className="text-lg font-bold text-white mb-1">Master Cut — 2:10 Epic Brand Film</h3>
            <p className="text-sm text-zinc-400">Los 6 vídeos concatenados con flujo emocional perfecto. Usa CapCut, Premiere o DaVinci Resolve.</p>
          </div>
          <div className="relative">
            {timeline.map((seg, i) => (
              <div key={seg.index} className="flex gap-4 mb-1">
                <div className="w-20 shrink-0 text-right">
                  <span className="text-xs font-mono text-zinc-500">{seg.startTime}</span>
                  <div className="text-xs font-mono text-zinc-600">↓ {seg.endTime}</div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 bg-amber-500 rounded-full border-2 border-zinc-900 z-10" />
                  {i < timeline.length - 1 && <div className="w-0.5 bg-zinc-700 flex-1 min-h-[40px]" />}
                </div>
                <div className="flex-1 bg-zinc-900 border border-zinc-700/50 rounded-lg p-3 mb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-400">V{seg.index}</span>
                      <span className="text-sm font-medium text-white">{seg.videoTitle}</span>
                      <span className="text-xs text-zinc-500">{seg.durationSec}s</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <LayoutGrid size={12} /> {seg.clipFiles.length} clips
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-purple-400">Transición:</span>
                    <span className="text-xs text-zinc-300">{seg.transition}</span>
                  </div>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {seg.clipFiles.map(f => (
                      <span key={f} className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 font-mono">{f}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "storyboard" && (
        <div className="grid md:grid-cols-2 gap-3">
          {slides.map(s => (
            <div key={s.slideNumber} className="bg-zinc-900 border border-zinc-700/50 rounded-xl p-4 hover:border-amber-600/30 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-amber-600/20 rounded-lg flex items-center justify-center text-amber-400 font-bold text-xs">{s.slideNumber}</div>
                <h4 className="text-sm font-semibold text-white">{s.title}</h4>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">{s.content}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "tools" && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2"><Sparkles size={14} /> Herramientas IA de Video (Ranking)</h3>
            <div className="grid md:grid-cols-2 gap-3">
              {tools.map(t => (
                <div key={t.rank} className="bg-zinc-900 border border-zinc-700/50 rounded-lg p-3 flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${t.rank === 1 ? "bg-amber-600 text-white" : t.rank === 2 ? "bg-zinc-600 text-zinc-200" : "bg-zinc-800 text-zinc-400"}`}>#{t.rank}</div>
                  <div>
                    <h4 className="text-sm font-medium text-white">{t.name}</h4>
                    <p className="text-xs text-cyan-400">{t.bestFor}</p>
                    <p className="text-xs text-zinc-500 mt-1">{t.notes}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2"><Monitor size={14} /> Especificaciones Técnicas</h3>
            <div className="bg-zinc-900 border border-zinc-700/50 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-zinc-800 text-zinc-400">
                    <th className="px-3 py-2 text-left">Formato</th>
                    <th className="px-3 py-2 text-left">Resolución</th>
                    <th className="px-3 py-2 text-left">FPS</th>
                    <th className="px-3 py-2 text-left">Codec</th>
                    <th className="px-3 py-2 text-left">Bitrate</th>
                    <th className="px-3 py-2 text-left">Uso</th>
                  </tr>
                </thead>
                <tbody>
                  {specs.map(s => (
                    <tr key={s.id} className="border-t border-zinc-800 text-zinc-300 hover:bg-zinc-800/50">
                      <td className="px-3 py-2 font-medium text-white">{s.format}</td>
                      <td className="px-3 py-2 font-mono">{s.resolution}</td>
                      <td className="px-3 py-2">{s.fps || "—"}</td>
                      <td className="px-3 py-2">{s.codec}</td>
                      <td className="px-3 py-2">{s.bitrateMbps} Mbps</td>
                      <td className="px-3 py-2 text-zinc-400">{s.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2"><ListChecks size={14} /> Entregables Finales</h3>
            <div className="grid md:grid-cols-2 gap-2">
              {deliverables.map(d => (
                <div key={d.id} className="bg-zinc-900 border border-zinc-700/50 rounded-lg p-3 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${d.category === "video" ? "bg-purple-500" : d.category === "image" ? "bg-cyan-500" : d.category === "audio" ? "bg-amber-500" : "bg-zinc-500"}`} />
                  <div className="flex-1">
                    <p className="text-sm text-white">{d.quantity}× {d.description}</p>
                    <p className="text-xs text-zinc-500">{d.format} · {d.dimensions}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2"><Lightbulb size={14} /> Tips de Producción</h3>
            <div className="grid md:grid-cols-2 gap-2">
              {tips.map(t => (
                <div key={t.id} className="bg-zinc-900 border border-zinc-700/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      t.category === "lip_sync" ? "bg-purple-900/50 text-purple-300" :
                      t.category === "character_consistency" ? "bg-cyan-900/50 text-cyan-300" :
                      t.category === "editing" ? "bg-amber-900/50 text-amber-300" :
                      t.category === "ugc_style" ? "bg-emerald-900/50 text-emerald-300" :
                      t.category === "color_grading" ? "bg-pink-900/50 text-pink-300" :
                      "bg-zinc-800 text-zinc-300"
                    }`}>{t.category.replace(/_/g, " ")}</span>
                  </div>
                  <h4 className="text-sm font-medium text-white mb-0.5">{t.title}</h4>
                  <p className="text-xs text-zinc-400">{t.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "adapt" && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-purple-900/20 to-zinc-900 border border-purple-700/30 rounded-xl p-4">
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2"><Wand2 size={18} /> Adaptador IA de Campaña</h3>
            <p className="text-sm text-zinc-400">Usa Claude para adaptar los 6 videos de campaña a cualquier marca. Ingresa los datos de la marca y genera prompts personalizados.</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-700/50 rounded-xl p-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Nombre de la marca *</label>
                <input value={adaptForm.brandName} onChange={e => setAdaptForm(f => ({ ...f, brandName: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none" placeholder="Ej: LuxeWatches" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Industria *</label>
                <input value={adaptForm.industry} onChange={e => setAdaptForm(f => ({ ...f, industry: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none" placeholder="Ej: Relojes de lujo" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-zinc-400 mb-1">Oferta principal *</label>
                <input value={adaptForm.coreOffering} onChange={e => setAdaptForm(f => ({ ...f, coreOffering: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none" placeholder="Ej: Relojes suizos artesanales con movimiento automático" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Audiencia objetivo *</label>
                <input value={adaptForm.targetAudience} onChange={e => setAdaptForm(f => ({ ...f, targetAudience: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none" placeholder="Ej: Profesionales 30-55 que valoran el estatus" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Tono de voz *</label>
                <input value={adaptForm.toneOfVoice} onChange={e => setAdaptForm(f => ({ ...f, toneOfVoice: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none" placeholder="Ej: Premium pero accesible" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Identidad visual</label>
                <input value={adaptForm.visualIdentity} onChange={e => setAdaptForm(f => ({ ...f, visualIdentity: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none" placeholder="Ej: Negro + Oro + Verde oscuro premium" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Beneficio emocional</label>
                <input value={adaptForm.emotionalBenefit} onChange={e => setAdaptForm(f => ({ ...f, emotionalBenefit: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none" placeholder="Ej: Pertenecer a un círculo exclusivo" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Color primario</label>
                <div className="flex gap-2">
                  <input type="color" value={adaptForm.primaryColor} onChange={e => setAdaptForm(f => ({ ...f, primaryColor: e.target.value }))}
                    className="w-10 h-10 rounded cursor-pointer bg-transparent border-0" />
                  <input value={adaptForm.primaryColor} onChange={e => setAdaptForm(f => ({ ...f, primaryColor: e.target.value }))}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-amber-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Color acento</label>
                <div className="flex gap-2">
                  <input type="color" value={adaptForm.accentColor} onChange={e => setAdaptForm(f => ({ ...f, accentColor: e.target.value }))}
                    className="w-10 h-10 rounded cursor-pointer bg-transparent border-0" />
                  <input value={adaptForm.accentColor} onChange={e => setAdaptForm(f => ({ ...f, accentColor: e.target.value }))}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-amber-500 focus:outline-none" />
                </div>
              </div>
            </div>

            <button onClick={handleAdapt} disabled={adapting || !adaptForm.brandName.trim() || !adaptForm.industry.trim() || !adaptForm.coreOffering.trim() || !adaptForm.targetAudience.trim() || !adaptForm.toneOfVoice.trim()}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition-all shadow-lg shadow-purple-600/20">
              {adapting ? <><Loader2 size={16} className="animate-spin" /> Adaptando con Claude IA (30-60s)…</> : <><Wand2 size={16} /> Generar Campaña Adaptada</>}
            </button>
          </div>

          {adaptError && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-300">{adaptError}</p>
            </div>
          )}

          {adaptResult && (
            <div className="space-y-3">
              <div className="bg-gradient-to-r from-emerald-900/20 to-zinc-900 border border-emerald-700/30 rounded-xl p-4">
                <h3 className="text-lg font-bold text-white">Campaña para: {adaptResult.brandName}</h3>
                {adaptResult.characterDescription && (
                  <div className="mt-2 bg-zinc-800 rounded-lg p-3">
                    <h4 className="text-xs font-medium text-cyan-400 mb-1">Personaje Adaptado</h4>
                    <p className="text-xs text-zinc-300">{adaptResult.characterDescription}</p>
                    <div className="mt-1"><CopyBtn text={adaptResult.characterDescription} /></div>
                  </div>
                )}
              </div>
              {adaptResult.videos?.map((av: AdaptedVideo) => (
                <div key={av.index} className="bg-zinc-900 border border-zinc-700/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 bg-emerald-600/20 rounded-lg flex items-center justify-center text-emerald-400 font-bold text-xs">{av.index}</div>
                    <h4 className="text-sm font-semibold text-white">{av.title}</h4>
                    {av.headline && <span className="text-xs text-amber-400 ml-auto">{av.headline}</span>}
                  </div>
                  {av.prompt916 && (
                    <div className="mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-cyan-400">Prompt 9:16</span>
                        <CopyBtn text={av.prompt916} />
                      </div>
                      <div className="bg-zinc-800 rounded-lg p-2">
                        <p className="text-xs text-zinc-300 font-mono leading-relaxed">{av.prompt916}</p>
                      </div>
                    </div>
                  )}
                  {av.voiceOverScript && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-emerald-400">Voice-Over</span>
                        <CopyBtn text={av.voiceOverScript} />
                      </div>
                      <div className="bg-zinc-800 rounded-lg p-2">
                        <p className="text-xs text-zinc-300">{av.voiceOverScript}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
