import { useState, useRef } from "react";
import { useParams } from "wouter";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface PipelineEvent {
  step?: number;
  total?: number;
  message?: string;
  success?: boolean;
  vaultId?: number;
  vaultUrl?: string;
  clips?: number;
  sizeKB?: number;
  error?: boolean;
}

const STORYBOARD = [
  { scene: "S1", dur: "5s", icon: "🏺", label: "Intro botes épicos", desc: "Dos botes Warriors ISO en altar de piedra, cámara orbita con split forest/tropical" },
  { scene: "S2", dur: "5s", icon: "⚔️", label: "Gladiador Forest Fruits emerge", desc: "El guerrero materializa desde la etiqueta del bote rojo con partículas de frutos del bosque" },
  { scene: "S3", dur: "5s", icon: "🍍", label: "Gladiador Pineapple Coconut emerge", desc: "Segundo guerrero emerge del bote tropical con trozos de piña y coco flotando" },
  { scene: "S4", dur: "5s", icon: "🥤", label: "Gladiador 1 — UGC testimonial", desc: "Bebe el batido rojo, mira a cámara, habla del sabor frutal y refrescante" },
  { scene: "S5", dur: "5s", icon: "🌊", label: "Gladiador 2 — confrontación", desc: "El segundo gladiador desafía con su batido dorado, exótico y veraniego" },
  { scene: "S6", dur: "3s", icon: "🏆", label: "CTA juntos — ¿Con cuál te quedas?", desc: "Ambos gladiadores frente a cámara alzando sus batidos" },
  { scene: "S7", dur: "2s", icon: "🏷️", label: "Title card", desc: "Botes + MUSCLE FACTORY + musclefactorybcn.com (ffmpeg drawtext)" },
];

export default function MuscleFactoryAd() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id || "0");

  const [running, setRunning]       = useState(false);
  const [log, setLog]               = useState<string[]>([]);
  const [result, setResult]         = useState<PipelineEvent | null>(null);
  const [progress, setProgress]     = useState(0);
  const abortRef                    = useRef<AbortController | null>(null);
  const logEndRef                   = useRef<HTMLDivElement>(null);

  function appendLog(msg: string) {
    setLog(prev => [...prev, msg]);
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  async function startPipeline() {
    if (running) return;
    setRunning(true);
    setLog([]);
    setResult(null);
    setProgress(0);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(`${API_BASE}/api/muscle-factory/generate-ad`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
        credentials: "include",
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        appendLog(`❌ Error HTTP ${res.status}`);
        setRunning(false);
        return;
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const chunks = buf.split("\n\n");
        buf = chunks.pop() || "";
        for (const chunk of chunks) {
          const evLine   = chunk.split("\n").find(l => l.startsWith("event:"))?.replace("event:", "").trim();
          const dataLine = chunk.split("\n").find(l => l.startsWith("data:"))?.replace("data:", "").trim();
          if (!dataLine) continue;
          try {
            const evt: PipelineEvent = JSON.parse(dataLine);
            if (evt.message) appendLog(evt.message);
            if (evt.step !== undefined && evt.total) setProgress(Math.round((evt.step / evt.total) * 100));
            if (evLine === "done" && evt.success) { setResult(evt); setProgress(100); }
            if (evLine === "error") appendLog(`❌ ${evt.message}`);
          } catch { /* ignore */ }
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") appendLog(`❌ ${e.message}`);
    } finally {
      setRunning(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
    appendLog("🛑 Pipeline cancelado");
    setRunning(false);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6">
      {/* Header */}
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500 to-red-700 flex items-center justify-center text-3xl shadow-lg shadow-yellow-900/40">
            ⚔️
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Muscle Factory — Warriors ISO</h1>
            <p className="text-zinc-400 mt-0.5">
              Anuncio 30 segundos · 6 clips Grok xAI I2V/T2V · TTS narración · ffmpeg concat
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-2">
            <span className="text-yellow-400 font-bold text-sm">9:16 · 720p · ~30s</span>
          </div>
        </div>

        {/* Reference Image + Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
            <div className="p-3 border-b border-zinc-800 text-xs text-zinc-400 font-medium uppercase tracking-wider">
              Imagen de referencia
            </div>
            <div className="relative">
              <img
                src="/api/muscle-factory/reference-image"
                alt="Warriors ISO — Forest Fruits & Pineapple Coconut"
                className="w-full object-contain max-h-80"
                onError={e => { (e.target as HTMLImageElement).src = ""; }}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-800/80">
                <div className="text-center">
                  <div className="text-5xl mb-3">🏺</div>
                  <div className="text-sm text-zinc-300 font-medium">Warriors ISO · 2 sabores</div>
                  <div className="text-xs text-zinc-500 mt-1">Forest Fruits · Pineapple Coconut</div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5">
              <h3 className="text-sm font-semibold text-zinc-300 mb-3 uppercase tracking-wider">Pipeline</h3>
              <div className="space-y-2 text-sm text-zinc-400">
                <div className="flex items-center gap-2"><span className="text-yellow-400">1</span> Imagen ref → data-URI (I2V)</div>
                <div className="flex items-center gap-2"><span className="text-yellow-400">2</span> 6 clips Grok xAI en paralelo (~4 min)</div>
                <div className="flex items-center gap-2"><span className="text-yellow-400">3</span> ElevenLabs TTS narración épica</div>
                <div className="flex items-center gap-2"><span className="text-yellow-400">4</span> Normalizar → concat → mezclar audio</div>
                <div className="flex items-center gap-2"><span className="text-yellow-400">5</span> Title card ffmpeg drawtext (2s)</div>
                <div className="flex items-center gap-2"><span className="text-yellow-400">6</span> Guardar en Vault</div>
              </div>
            </div>
            <div className="bg-red-950/30 border border-red-800/40 rounded-2xl p-4 text-sm text-red-300">
              ⚠️ Genera 6 clips xAI en paralelo. Tiempo estimado: <strong>5-8 minutos</strong> según disponibilidad de Grok. No cierre esta ventana.
            </div>
          </div>
        </div>

        {/* Storyboard */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 mb-8">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="font-semibold text-white">Storyboard — 7 escenas</h2>
          </div>
          <div className="divide-y divide-zinc-800">
            {STORYBOARD.map((s, i) => (
              <div key={i} className="flex items-start gap-4 p-4">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-lg flex-shrink-0">
                  {s.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-yellow-500 bg-yellow-500/10 rounded px-1.5 py-0.5">{s.scene}</span>
                    <span className="text-xs text-zinc-500">{s.dur}</span>
                    <span className="text-sm font-medium text-white">{s.label}</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={startPipeline}
            disabled={running}
            className="flex-1 py-4 rounded-2xl font-bold text-lg bg-gradient-to-r from-yellow-500 to-red-600 hover:from-yellow-400 hover:to-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-yellow-900/30"
          >
            {running ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Generando anuncio...
              </span>
            ) : "🎬 Generar Anuncio 30s"}
          </button>
          {running && (
            <button onClick={stop} className="px-6 py-4 rounded-2xl font-bold bg-zinc-800 hover:bg-zinc-700 transition-all border border-zinc-600">
              Cancelar
            </button>
          )}
        </div>

        {/* Progress bar */}
        {(running || progress > 0) && (
          <div className="mb-6">
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>Progreso pipeline</span><span>{progress}%</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 to-red-500 transition-all duration-500 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Log */}
        {log.length > 0 && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 mb-6 font-mono text-xs max-h-64 overflow-y-auto">
            {log.map((l, i) => (
              <div key={i} className="py-0.5 text-zinc-300">{l}</div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="bg-gradient-to-br from-yellow-900/30 to-red-900/20 border border-yellow-600/40 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">🏆</span>
              <div>
                <h3 className="text-xl font-bold text-yellow-300">¡Anuncio listo!</h3>
                <p className="text-sm text-zinc-400">{result.clips} escenas · {result.sizeKB ? Math.round(result.sizeKB / 1024) + " MB" : "—"} · Vault #{result.vaultId}</p>
              </div>
            </div>
            {result.vaultUrl && (
              <div className="flex gap-3">
                <a
                  href={result.vaultUrl}
                  download="muscle-factory-warriors-iso-30s.mp4"
                  className="flex-1 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-center transition-all"
                >
                  ⬇️ Descargar vídeo MP4
                </a>
                <a
                  href={`/projects/${projectId}/vault`}
                  className="px-6 py-3 rounded-xl bg-zinc-700 hover:bg-zinc-600 font-medium text-center transition-all"
                >
                  Ver en Vault
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
