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
  sizeMB?: number;
  technique?: string;
  error?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Storyboard — 2 vídeos × 15s con TIMELINE PROMPTING (0-Xs / Xs-Ys / ...)
// ─────────────────────────────────────────────────────────────────────────────
const VIDEO_1_TIMELINE = [
  { time: "0 – 3s",  icon: "🏺", desc: "Intro cinematográfico: 2 botes Warriors ISO en altar de piedra, cámara orbita lentamente con split forest/tropical" },
  { time: "3 – 7s",  icon: "🌑", desc: "Etiqueta Forest Fruits brilla en rojo. Gladiador 1 materializa desde el bote — partículas de frutos del bosque flotan a su alrededor" },
  { time: "7 – 11s", icon: "🥤", desc: "Gladiador bebe el batido rojo a cámara lenta, ojos cerrados, expresión de placer absoluto. Fresas flotando" },
  { time: "11 – 15s",icon: "👁️", desc: "Gladiador abre ojos, mira DIRECTO a cámara. Close-up UGC style. Sin distorsión. Expresión confiada y satisfecha" },
];

const VIDEO_2_TIMELINE = [
  { time: "0 – 4s",  icon: "🍍", desc: "Etiqueta Pineapple Coconut brilla dorada. Gladiador 2 emerge con energía tropical — trozos de piña y coco flotando" },
  { time: "4 – 8s",  icon: "⚔️", desc: "Gladiador 2 mira a cámara, alza el batido dorado con expresión retadora. Los 2 botes visibles al fondo" },
  { time: "8 – 12s", icon: "🏆", desc: "Ambos gladiadores de pie juntos, frente a cámara. Alzan sus batidos (rojo + dorado) hacia el espectador. CTA visual" },
  { time: "12 – 15s",icon: "✨", desc: "Zoom dramático lento. Gladiadores con batidos en alto. Fondo épico con lens flare. Tableau final cinematográfico" },
];

const TITLE_CARD = { time: "15 – 17s", icon: "🏷️", desc: "Title card ffmpeg: imagen real de los botes + MUSCLE FACTORY + musclefactorybcn.com" };

export default function MuscleFactoryAd() {
  const { id }     = useParams<{ id: string }>();
  const projectId  = parseInt(id || "0");

  const [running, setRunning]   = useState(false);
  const [log, setLog]           = useState<string[]>([]);
  const [result, setResult]     = useState<PipelineEvent | null>(null);
  const [progress, setProgress] = useState(0);
  const abortRef                = useRef<AbortController | null>(null);
  const logEndRef               = useRef<HTMLDivElement>(null);

  function addLog(msg: string) {
    setLog(prev => [...prev, msg]);
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: "smooth" }), 40);
  }

  async function startPipeline() {
    if (running) return;
    setRunning(true);
    setLog([]);
    setResult(null);
    setProgress(5);

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

      if (!res.ok || !res.body) { addLog(`❌ Error HTTP ${res.status}`); setRunning(false); return; }

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
            if (evt.message) addLog(evt.message);
            if (evt.step !== undefined && evt.total) {
              setProgress(Math.round(5 + (evt.step / evt.total) * 90));
            }
            if (evLine === "done" && evt.success) { setResult(evt); setProgress(100); }
            if (evLine === "error") addLog(`❌ ${evt.message}`);
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") addLog(`❌ ${e.message}`);
    } finally {
      setRunning(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
    addLog("🛑 Pipeline cancelado por el usuario");
    setRunning(false);
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white pb-12">

      {/* ── Header ── */}
      <div className="bg-gradient-to-b from-zinc-900 to-transparent border-b border-zinc-800 px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-500 to-red-700 flex items-center justify-center text-2xl shadow-xl shadow-yellow-900/40 flex-shrink-0">
            ⚔️
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Muscle Factory — Warriors ISO</h1>
            <p className="text-zinc-400 text-sm mt-0.5">
              Anuncio ~32s · <span className="text-yellow-400 font-medium">2 × 15s Timeline I2V</span> · Grok xAI · TTS narración · ffmpeg
            </p>
          </div>
          <div className="ml-auto hidden sm:flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-3 py-1.5">
            <span className="text-yellow-400 text-xs font-bold">9:16 · 720p · ~32s</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pt-6 space-y-6">

        {/* ── Técnica Timeline Prompting ── */}
        <div className="bg-gradient-to-r from-blue-950/40 to-indigo-950/30 border border-blue-700/30 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">⏱️</span>
            <div>
              <h2 className="font-bold text-blue-300 text-sm uppercase tracking-wider mb-1">
                Técnica: Timeline Prompting (0-3s / 3-7s / 7-11s / 11-15s)
              </h2>
              <p className="text-sm text-zinc-300 leading-relaxed">
                En lugar de 6 clips cortos de 5s, generamos <strong className="text-white">2 vídeos de 15s</strong> con{" "}
                <strong className="text-yellow-400">timestamps por segmento</strong> — exactamente como hace Seedance 2.0, Kling y Runway.
                El modelo sabe qué ocurre en cada momento exacto → <strong className="text-green-400">0 alucinaciones, 0 deformaciones de caras</strong>,
                transiciones fluidas y narrativa coherente. Ambos clips usan{" "}
                <strong className="text-white">I2V desde la imagen real de los botes</strong> para anclar el diseño 100%.
              </p>
            </div>
          </div>
        </div>

        {/* ── Storyboard 2×15s ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Video 1 */}
          <div className="bg-zinc-900 rounded-2xl border border-red-900/40 overflow-hidden">
            <div className="px-4 py-3 bg-red-950/40 border-b border-red-900/30 flex items-center gap-2">
              <span className="text-red-400 text-xs font-bold uppercase tracking-wider">Vídeo 1 · 15s</span>
              <span className="text-xs text-zinc-500">· Forest Fruits · I2V</span>
            </div>
            <div className="divide-y divide-zinc-800">
              {VIDEO_1_TIMELINE.map((s, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <span className="text-lg mt-0.5 flex-shrink-0">{s.icon}</span>
                  <div>
                    <span className="text-xs font-mono text-red-400 bg-red-500/10 rounded px-1.5 py-0.5 mr-2">{s.time}</span>
                    <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Video 2 */}
          <div className="bg-zinc-900 rounded-2xl border border-yellow-900/40 overflow-hidden">
            <div className="px-4 py-3 bg-yellow-950/40 border-b border-yellow-900/30 flex items-center gap-2">
              <span className="text-yellow-400 text-xs font-bold uppercase tracking-wider">Vídeo 2 · 15s</span>
              <span className="text-xs text-zinc-500">· Pineapple Coconut · I2V</span>
            </div>
            <div className="divide-y divide-zinc-800">
              {VIDEO_2_TIMELINE.map((s, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <span className="text-lg mt-0.5 flex-shrink-0">{s.icon}</span>
                  <div>
                    <span className="text-xs font-mono text-yellow-500 bg-yellow-500/10 rounded px-1.5 py-0.5 mr-2">{s.time}</span>
                    <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Title card */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-700 px-5 py-3 flex items-center gap-4">
          <span className="text-xl">{TITLE_CARD.icon}</span>
          <div>
            <span className="text-xs font-mono text-zinc-400 bg-zinc-800 rounded px-1.5 py-0.5 mr-2">{TITLE_CARD.time}</span>
            <span className="text-xs text-zinc-400">{TITLE_CARD.desc}</span>
          </div>
        </div>

        {/* ── Pipeline specs ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Vídeos xAI", value: "2 × 15s", sub: "en paralelo" },
            { label: "Técnica", value: "Timeline I2V", sub: "0-Xs stamping" },
            { label: "Duración total", value: "~32 seg", sub: "30s + title card" },
            { label: "Tiempo gen.", value: "~6-8 min", sub: "paralelo Grok" },
          ].map((s, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
              <div className="text-lg font-bold text-yellow-400">{s.value}</div>
              <div className="text-xs text-zinc-300 font-medium mt-0.5">{s.label}</div>
              <div className="text-xs text-zinc-600 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Controles ── */}
        <div className="flex gap-3">
          <button
            onClick={startPipeline}
            disabled={running}
            className="flex-1 py-4 rounded-2xl font-bold text-lg bg-gradient-to-r from-yellow-500 to-red-600 hover:from-yellow-400 hover:to-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-yellow-900/30"
          >
            {running ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Generando... (6-8 min)
              </span>
            ) : "🎬 Generar Anuncio Warriors ISO"}
          </button>
          {running && (
            <button onClick={stop} className="px-5 py-4 rounded-2xl font-semibold bg-zinc-800 hover:bg-zinc-700 transition-all border border-zinc-600 text-sm">
              Cancelar
            </button>
          )}
        </div>

        {/* ── Barra de progreso ── */}
        {(running || progress > 0) && (
          <div>
            <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
              <span>Pipeline progress</span><span>{progress}%</span>
            </div>
            <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 to-red-500 transition-all duration-700 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-zinc-600 mt-1">
              <span>Lanzado</span><span>I2V Grok ×2</span><span>TTS</span><span>concat</span><span>Vault</span>
            </div>
          </div>
        )}

        {/* ── Log ── */}
        {log.length > 0 && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 font-mono text-xs max-h-72 overflow-y-auto space-y-0.5">
            {log.map((l, i) => (
              <div key={i} className={
                l.startsWith("❌") ? "text-red-400" :
                l.startsWith("✅") ? "text-green-400" :
                l.startsWith("⚠️") ? "text-yellow-400" :
                "text-zinc-300"
              }>{l}</div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}

        {/* ── Resultado ── */}
        {result && (
          <div className="bg-gradient-to-br from-yellow-900/25 to-red-900/15 border border-yellow-600/40 rounded-2xl p-6">
            <div className="flex items-start gap-4 mb-5">
              <span className="text-5xl">🏆</span>
              <div>
                <h3 className="text-xl font-bold text-yellow-300">¡Anuncio Warriors ISO listo!</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  {result.technique} · {result.clips} segmentos · {result.sizeMB} MB
                  {result.vaultId ? ` · Vault #${result.vaultId}` : ""}
                </p>
              </div>
            </div>
            {result.vaultUrl && (
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={result.vaultUrl}
                  download="muscle-factory-warriors-iso-32s.mp4"
                  className="flex-1 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-center transition-all text-sm"
                >
                  ⬇️ Descargar vídeo MP4 (~32s)
                </a>
                <a
                  href={`/projects/${projectId}/vault`}
                  className="px-5 py-3 rounded-xl bg-zinc-700 hover:bg-zinc-600 font-medium text-center transition-all text-sm"
                >
                  💾 Ver en Vault
                </a>
              </div>
            )}
          </div>
        )}

        {/* ── Info nota ── */}
        <div className="text-xs text-zinc-600 bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
          <strong className="text-zinc-400">¿Por qué Timeline Prompting?</strong>{" "}
          Seedance 2.0, Kling 3.0 y Runway Gen4.5 usan esta técnica internamente. Al especificar
          "0-3s: acción", "3-7s: acción"... el modelo planifica la secuencia temporal completa
          en lugar de generar frame-a-frame — resultado: movimientos coherentes, sin saltos,
          sin alucinaciones de rostros y un arco narrativo real de 15 segundos.
          Combinado con I2V (imagen de referencia de los botes), el diseño de los botes se
          preserva exactamente sin distorsión.
        </div>

      </div>
    </div>
  );
}
