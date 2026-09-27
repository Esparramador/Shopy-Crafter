// ConvAI voice call modal ("Arturo", ElevenLabs). Shared by the admin
// OmniChatbot (mode="admin" → GET /api/voice/convai/call-url) and the client
// panel chatbot (mode="client" → GET /api/voice/client-call-url). It lives in
// its own module so the client bundle does not pull in the whole admin chatbot.
import { useState, useRef, useEffect } from "react";
import { Phone, PhoneOff, Loader2 } from "lucide-react";
import { createConvAIPlaybackQueue, describeConvAIClose, float32ToPcm16Base64, parsePcmSampleRate } from "@/lib/convai-audio";
import { createCallAttemptRegistry } from "@/lib/convai-call-attempt";

// ── ConvAI Voice Call Modal ────────────────────────────────────────────────────
export default function VoiceCallModal({ onClose, API, mode = "admin" }: { onClose: () => void; API: string; mode?: "admin" | "client" }) {
  const [status, setStatus] = useState<"idle" | "connecting" | "provisioning" | "connected" | "speaking" | "error">("idle");
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<Array<{ role: "user" | "agent"; text: string }>>([]);
  const [errorMsg, setErrorMsg] = useState("");
  // Every AudioContext / MediaStream / WebSocket / mic node belongs to exactly
  // one call attempt (see @/lib/convai-call-attempt, unit-tested). Starting a
  // new attempt or hanging up disposes the previous one, and a resource that
  // arrives late (mic granted after "Colgar", socket after "Reintentar") is
  // released on the spot instead of leaking or tearing down the new call.
  const attemptsRef = useRef(createCallAttemptRegistry());
  const isLive = () => attemptsRef.current.current()?.isActive() === true;
  // Ordered decode + playback. Lives in @/lib/convai-audio so it is unit-tested;
  // failures are reported through the handlers instead of being swallowed.
  const playbackRef = useRef(createConvAIPlaybackQueue({
    onSpeakingChange: (speaking) => {
      if (!isLive()) return;
      setAgentSpeaking(speaking);
      setStatus(speaking ? "speaking" : "connected");
    },
    onDecodeError: (error, format) => {
      console.error("ConvAI audio decode failed", { format, error });
      if (!isLive()) return;
      setStatus("error");
      setErrorMsg(`No se pudo reproducir el audio recibido (${format}): ${(error as Error)?.message ?? "error desconocido"}`);
    },
    onPlaybackError: (error) => {
      console.error("ConvAI audio playback failed", error);
      if (!isLive()) return;
      setStatus("error");
      setErrorMsg(`No se pudo iniciar la reproducción del audio: ${(error as Error)?.message ?? "error desconocido"}`);
    },
  }));

  // The agent always opens with a first_message, so a connected call that
  // receives zero audio chunks in this window is a silent call, not a pause.
  const NO_AUDIO_TIMEOUT_MS = 12_000;

  const endCall = (opts?: { unmounting?: boolean }) => {
    attemptsRef.current.end();
    playbackRef.current.reset();
    if (opts?.unmounting) return;
    setAgentSpeaking(false);
    setStatus("idle");
  };

  const startCall = async () => {
    // begin() disposes any previous attempt ("Reintentar" after a mid-call
    // error) with its socket handlers detached, so its late close event can
    // never be mistaken for this call ending.
    const attempt = attemptsRef.current.begin();
    playbackRef.current.reset();
    let micSampleRate = 16000;
    let audioChunks = 0;
    let noAudioTimer: ReturnType<typeof setTimeout> | null = null;
    const clearNoAudioWatchdog = () => {
      if (noAudioTimer) { clearTimeout(noAudioTimer); noAudioTimer = null; }
    };
    attempt.onDispose(clearNoAudioWatchdog);
    const armNoAudioWatchdog = (format: string) => {
      clearNoAudioWatchdog();
      noAudioTimer = setTimeout(() => {
        noAudioTimer = null;
        if (!attempt.isActive() || audioChunks > 0) return;
        console.error("ConvAI call connected but no audio received", { format });
        setStatus("error");
        setErrorMsg(`Llamada conectada pero sin audio del agente en ${NO_AUDIO_TIMEOUT_MS / 1000}s (formato anunciado: ${format}). Revisa la voz del agente en ElevenLabs.`);
      }, NO_AUDIO_TIMEOUT_MS);
    };
    // Ends this attempt's resources but leaves the status for the caller to set.
    const failAttempt = (message: string) => {
      if (!attempt.isActive()) return;
      attemptsRef.current.end();
      playbackRef.current.reset();
      setAgentSpeaking(false);
      setStatus("error");
      setErrorMsg(message);
    };

    setStatus("provisioning"); setErrorMsg("");
    // Create + resume the AudioContext synchronously inside the click gesture.
    // Doing it after the fetch/getUserMedia awaits loses the user activation on
    // Safari/mobile and the context stays suspended → silent call.
    const ctx = attempt.ownContext(new AudioContext());
    const resumePromise = ctx.state === "suspended" ? ctx.resume().catch(() => {}) : Promise.resolve();
    try {
      const endpoint = mode === "client"
        ? `${API}/api/voice/client-call-url`
        : `${API}/api/voice/convai/call-url`;
      const resp = await fetch(endpoint, { credentials: "include" });
      if (!attempt.isActive()) return; // cancelled while provisioning
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({})) as any;
        throw new Error(e.error ?? "No se pudo obtener URL de llamada");
      }
      const { signed_url, dynamic_variables } = await resp.json() as { signed_url: string; dynamic_variables?: Record<string, string> };
      if (!attempt.isActive()) return;
      setStatus("connecting");

      // ownStream() stops the tracks at once if the call was cancelled while
      // the permission prompt was open — no microphone left capturing.
      const stream = attempt.ownStream(await navigator.mediaDevices.getUserMedia({ audio: true }));
      if (!attempt.isActive()) return;
      await resumePromise;
      if (ctx.state !== "running") {
        // One more attempt now that the mic permission dialog (a user gesture) closed.
        await ctx.resume().catch(() => {});
      }
      if (!attempt.isActive()) return;
      if (ctx.state !== "running") {
        throw new Error("El navegador bloqueó el audio. Pulsa de nuevo «Iniciar llamada».");
      }

      const ws = attempt.ownSocket(new WebSocket(signed_url));

      ws.onopen = () => {
        if (!attempt.isActive()) return;
        setStatus("connected");
        ws.send(JSON.stringify({
          type: "conversation_initiation_client_data",
          conversation_config_override: { tts: { output_format: "pcm_16000" } },
          // Datos reales de la tienda del cliente para el agente ({{store_context}}).
          ...(dynamic_variables ? { dynamic_variables } : {}),
        }));

        // ConvAI's handshake declares pcm_16000 for microphone input. Sending
        // MediaRecorder's WebM/Opus container here makes the agent hear nothing.
        // Capture float samples and downsample them to signed 16-bit PCM.
        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        const mute = ctx.createGain();
        mute.gain.value = 0;
        source.connect(processor);
        processor.connect(mute);
        mute.connect(ctx.destination);
        attempt.ownNodes(processor, source, mute);
        processor.onaudioprocess = (event) => {
          if (ws.readyState !== WebSocket.OPEN || !attempt.isActive()) return;
          const input = event.inputBuffer.getChannelData(0);
          const base64 = float32ToPcm16Base64(input, ctx.sampleRate, micSampleRate);
          ws.send(JSON.stringify({ user_audio_chunk: base64 }));
        };
      };

      ws.onmessage = async (evt) => {
        if (!attempt.isActive()) return;
        try {
          const msg = JSON.parse(evt.data) as Record<string, any>;
          if (msg.type === "ping") {
            ws.send(JSON.stringify({ type: "pong", event_id: msg.ping_event?.event_id }));
            return;
          }
          if (msg.type === "conversation_initiation_metadata") {
            const meta = msg.conversation_initiation_metadata_event ?? {};
            const outFormat = typeof meta.agent_output_audio_format === "string" ? meta.agent_output_audio_format.trim() : "";
            const inFormat = typeof meta.user_input_audio_format === "string" ? meta.user_input_audio_format.trim() : "";
            console.info("ConvAI formats announced", { agent_output_audio_format: outFormat, user_input_audio_format: inFormat });
            if (outFormat) playbackRef.current.setFormat(outFormat);
            // Encode the microphone at the rate ElevenLabs expects. If it announces
            // a non-PCM input format we cannot honour it, so say so up front.
            if (inFormat) {
              const micRate = parsePcmSampleRate(inFormat);
              if (micRate === null) {
                setStatus("error");
                setErrorMsg(`ElevenLabs pide micrófono en formato ${inFormat}, pero esta llamada solo envía PCM16. El agente no te oirá.`);
              } else {
                micSampleRate = micRate;
              }
            }
            armNoAudioWatchdog(outFormat || playbackRef.current.getFormat());
            return;
          }
          if (msg.type === "error" || msg.type === "internal_error") {
            const detail = msg.error_event?.message ?? msg.message ?? msg.error ?? JSON.stringify(msg).slice(0, 200);
            console.error("ConvAI error event", msg);
            setStatus("error");
            setErrorMsg(`ElevenLabs informó de un error: ${detail}`);
            return;
          }
          if (msg.type === "interruption") {
            // User barged in: drop everything already scheduled for the agent.
            playbackRef.current.interrupt();
            return;
          }
          if (msg.type === "audio" && msg.audio_event?.audio_base_64) {
            if (ctx.state === "closed") return;
            audioChunks += 1;
            clearNoAudioWatchdog();
            void playbackRef.current.enqueue(ctx, msg.audio_event.audio_base_64 as string);
          } else if (msg.type === "transcript" || msg.type === "user_transcript") {
            // ElevenLabs envía { type: "user_transcript", user_transcription_event: { user_transcript } }.
            // Se mantienen las formas antiguas por compatibilidad.
            const text = typeof msg.user_transcription_event?.user_transcript === "string"
              ? msg.user_transcription_event.user_transcript
              : typeof msg.transcript === "string"
                ? msg.transcript
                : typeof msg.user_transcript === "string"
                  ? msg.user_transcript
                  : msg.user_transcript?.user_transcript ?? "";
            if (text) setTranscript(p => [...p, { role: "user", text }]);
          } else if (msg.type === "agent_response") {
            // ElevenLabs envía { type: "agent_response", agent_response_event: { agent_response } }.
            const text = typeof msg.agent_response_event?.agent_response === "string"
              ? msg.agent_response_event.agent_response
              : typeof msg.agent_response === "string"
                ? msg.agent_response
                : msg.agent_response?.agent_response ?? "";
            if (text) setTranscript(p => [...p, { role: "agent", text }]);
          }
        } catch (error) {
          console.warn("ConvAI message could not be processed", error);
        }
      };

      ws.onerror = () => {
        if (!attempt.isActive()) return;
        setStatus("error");
        setErrorMsg("Error de conexión WebSocket con ElevenLabs");
      };
      ws.onclose = (evt) => {
        // Handlers are detached before we close a socket ourselves, so reaching
        // here means the remote side (or the network) ended the live call.
        if (!attempt.isActive()) return;
        // ElevenLabs closes the socket with a reason when it rejects the voice,
        // the plan or the audio format. Never hide that behind a silent "idle".
        const problem = describeConvAIClose(evt.code, evt.reason);
        const receivedAudio = audioChunks > 0;
        if (problem) {
          console.error("ConvAI socket closed with a problem", { code: evt.code, reason: evt.reason, receivedAudio });
          failAttempt(problem);
        } else if (!receivedAudio) {
          console.error("ConvAI socket closed before any audio was received", { code: evt.code });
          failAttempt("ElevenLabs cerró la llamada sin haber enviado audio. Revisa la voz y el formato del agente.");
        } else {
          endCall();
        }
      };
    } catch (err: any) {
      // Any failure after resources were acquired releases them here.
      failAttempt(err?.message ?? "Error iniciando llamada");
    }
  };

  useEffect(() => { return () => endCall({ unmounting: true }); }, []);

  const isClientMode = mode === "client";
  const statusColor: Record<string, string> = { idle: "var(--jade)", provisioning: "var(--gold)", connecting: "rgba(200,168,75,0.8)", connected: "var(--jade)", speaking: "#7c3aed", error: "var(--crim)" };
  const statusLabel: Record<string, string> = {
    idle: isClientMode ? "Consultar por voz" : "Listo para llamar",
    provisioning: "Preparando asistente IA...",
    connecting: "Conectando...",
    connected: "En llamada",
    speaking: "IA respondiendo",
    error: errorMsg,
  };

  return (
    // data-blocks-tour: el tour de bienvenida (CoachMarks) se mantiene oculto
    // mientras este modal esté montado; sin ello se abría encima de la llamada.
    <div data-blocks-tour="voice-call" style={{
      position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
    }} onClick={e => { if (e.target === e.currentTarget) { endCall(); onClose(); } }}>
      <div style={{
        background: "var(--ink)", border: "1px solid var(--ink3)", borderRadius: 20, padding: "32px clamp(16px, 6vw, 32px)", width: "min(420px, 92vw)",
        // En móvil (375px) la tarjeta nunca supera la altura del viewport: si el
        // transcript + error crecen, se hace scroll dentro en vez de recortar los botones.
        boxSizing: "border-box", maxHeight: "calc(100dvh - 24px)", overflowY: "auto",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
      }}>
        {/* Avatar */}
        <div style={{
          width: 96, height: 96, borderRadius: "50%",
          background: isClientMode ? "linear-gradient(135deg,#38bdf8,#7c3aed)" : "linear-gradient(135deg, var(--gold), #c878ff)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40,
          animation: (status === "connected" || status === "speaking" || status === "provisioning") ? "voicePulse 1.5s ease-in-out infinite" : "none",
          boxShadow: `0 0 0 0 ${statusColor[status] ?? "var(--jade)"}`,
        }}>{isClientMode ? "📊" : "🤖"}</div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--t)", marginBottom: 4 }}>
            {isClientMode ? "Consultar Informes — Voz" : "Asistente IA — Voz"}
          </div>
          <div style={{ fontSize: 13, color: statusColor[status] ?? "var(--jade)", fontWeight: 600 }}>
            {statusLabel[status]}
          </div>
          {status === "provisioning" && (
            <div style={{ fontSize: 11, color: "var(--t4)", marginTop: 4 }}>
              Configurando agente IA por primera vez...
            </div>
          )}
          {isClientMode && status === "idle" && (
            <div style={{ fontSize: 11, color: "var(--t4)", marginTop: 4, maxWidth: 260 }}>
              Consulta ventas, stock e inventario por voz. No disponible para crear contenido.
            </div>
          )}
        </div>

        {/* Transcript */}
        {transcript.length > 0 && (
          <div style={{
            width: "100%", maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6,
            background: "var(--ink2)", borderRadius: 10, padding: "10px 12px",
          }}>
            {transcript.slice(-6).map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 6, justifyContent: t.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  background: t.role === "user" ? "rgba(200,168,75,0.15)" : "rgba(124,58,237,0.15)",
                  border: `1px solid ${t.role === "user" ? "rgba(200,168,75,0.3)" : "rgba(124,58,237,0.3)"}`,
                  borderRadius: 8, padding: "5px 10px", fontSize: 12, color: "var(--t)", maxWidth: "85%",
                }}>
                  <span style={{ fontSize: 10, color: "var(--t4)", display: "block", marginBottom: 2 }}>
                    {t.role === "user" ? "Tú" : "IA"}
                  </span>
                  {t.text}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Controls: en 375px la fila puede saltar de línea; los botones no parten su texto. */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          {status === "idle" ? (
            <button onClick={startCall} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "12px 28px", whiteSpace: "nowrap",
              background: isClientMode ? "linear-gradient(135deg,#38bdf8,#7c3aed)" : "var(--jade)",
              color: "#fff", borderRadius: 40, border: "none",
              fontSize: 15, fontWeight: 700, cursor: "pointer",
            }}>
              <Phone size={18} /> {isClientMode ? "Consultar por voz" : "Iniciar llamada"}
            </button>
          ) : status === "provisioning" || status === "connecting" ? (
            <button disabled style={{
              display: "flex", alignItems: "center", gap: 8, padding: "12px 28px", whiteSpace: "nowrap",
              background: "var(--ink3)", color: "var(--t3)", borderRadius: 40, border: "none",
              fontSize: 15, fontWeight: 700, cursor: "not-allowed", opacity: 0.7,
            }}>
              <Loader2 size={18} className="animate-spin" /> {status === "provisioning" ? "Preparando..." : "Conectando..."}
            </button>
          ) : status === "connected" || status === "speaking" ? (
            <button onClick={() => endCall()} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "12px 28px",
              background: "var(--crim)", color: "#fff", borderRadius: 40, border: "none",
              fontSize: 15, fontWeight: 700, cursor: "pointer",
              animation: "voicePulse 1.5s ease-in-out infinite",
            }}>
              <PhoneOff size={18} /> Colgar
            </button>
          ) : (
            <button onClick={startCall} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "12px 24px",
              background: "var(--gold)", color: "#000", borderRadius: 40, border: "none",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>
              Reintentar
            </button>
          )}
          <button onClick={() => { endCall(); onClose(); }} style={{
            padding: "12px 20px", background: "var(--ink2)", color: "var(--t3)",
            borderRadius: 40, border: "1px solid var(--ink3)", fontSize: 14, cursor: "pointer",
          }}>
            Cerrar
          </button>
        </div>

        <p style={{ fontSize: 11, color: "var(--t4)", textAlign: "center", maxWidth: 300 }}>
          {isClientMode
            ? "Asistente de voz para consultas de informes. Powered by ElevenLabs AI."
            : "Asistente IA de voz con acceso completo a ShopyBrain. Powered by ElevenLabs ConvAI."}
        </p>
      </div>
      <style>{`
        @keyframes voicePulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.15); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
