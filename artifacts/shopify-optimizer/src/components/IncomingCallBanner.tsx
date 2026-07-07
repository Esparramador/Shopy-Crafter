import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Phone, PhoneOff, Video, X, Mic, MicOff } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface IncomingCall {
  id: string;
  roomUrl: string;
  status: string;
  initiatedBy: "admin" | "client";
  createdAt: number;
  projectId?: number;
}

function useRinger(active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (ctxRef.current) { ctxRef.current.close(); ctxRef.current = null; }
      return;
    }

    const ring = () => {
      try {
        const ctx = new AudioContext();
        ctxRef.current = ctx;
        const beep = (freq: number, start: number, dur: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          osc.type = "sine";
          gain.gain.setValueAtTime(0, ctx.currentTime + start);
          gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + start + 0.02);
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur - 0.02);
          osc.start(ctx.currentTime + start);
          osc.stop(ctx.currentTime + start + dur);
        };
        beep(880, 0, 0.18);
        beep(660, 0.22, 0.18);
        beep(880, 0.44, 0.18);
      } catch {}
    };

    ring();
    intervalRef.current = setInterval(ring, 2800);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (ctxRef.current) { ctxRef.current.close(); ctxRef.current = null; }
    };
  }, [active]);
}

export default function IncomingCallBanner() {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dismissedIds = useRef<Set<string>>(new Set());

  useRinger(!!incomingCall && !activeRoom);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    const poll = async () => {
      if (!mounted) return;
      try {
        if (user.role === "client") {
          const res = await fetch(`${API}/client/video-call/incoming`, { credentials: "include" });
          if (!res.ok) return;
          const data = await res.json();
          if (data.call && data.call.status === "ringing" && !dismissedIds.current.has(data.call.id)) {
            setIncomingCall(data.call);
          } else if (!data.call || data.call.status === "ended" || data.call.status === "rejected") {
            setIncomingCall(prev => {
              if (prev && data.call?.id === prev.id && data.call?.status === "ended") return null;
              return prev;
            });
          }
        } else if (user.role === "admin") {
          const res = await fetch(`${API}/admin/video-call/pending`, { credentials: "include" });
          if (!res.ok) return;
          const data = await res.json();
          const pending = (data.calls as IncomingCall[] || []).filter(c => !dismissedIds.current.has(c.id));
          if (pending.length > 0) {
            setIncomingCall(prev => prev?.id === pending[0].id ? prev : pending[0]);
          } else {
            setIncomingCall(prev => {
              if (prev && !pending.find((c: IncomingCall) => c.id === prev.id)) return null;
              return prev;
            });
          }
        }
      } catch {}
    };

    poll();
    const t = setInterval(poll, 3000);
    return () => { mounted = false; clearInterval(t); };
  }, [user]);

  useEffect(() => {
    if (activeRoom) {
      setElapsed(0);
      elapsedRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } else {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    }
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, [activeRoom]);

  const accept = async () => {
    if (!incomingCall) return;
    try {
      const endpoint = user?.role === "admin"
        ? `${API}/admin/video-call/${incomingCall.id}/accept`
        : `${API}/client/video-call/${incomingCall.id}/accept`;
      const res = await fetch(endpoint, { method: "POST", credentials: "include" });
      const data = await res.json();
      const room = data.roomUrl || incomingCall.roomUrl;
      setActiveRoom(room);
      setActiveCallId(incomingCall.id);
      setIncomingCall(null);
    } catch {}
  };

  const reject = async () => {
    if (!incomingCall) return;
    dismissedIds.current.add(incomingCall.id);
    try {
      if (user?.role === "client") {
        await fetch(`${API}/client/video-call/${incomingCall.id}/reject`, { method: "POST", credentials: "include" });
      } else {
        await fetch(`${API}/admin/video-call/${incomingCall.id}`, { method: "DELETE", credentials: "include" });
      }
    } catch {}
    setIncomingCall(null);
  };

  const endCall = async () => {
    if (activeCallId) {
      try {
        const endpoint = user?.role === "admin"
          ? `${API}/admin/video-call/${activeCallId}`
          : `${API}/client/video-call/${activeCallId}`;
        await fetch(endpoint, { method: "DELETE", credentials: "include" });
      } catch {}
    }
    setActiveRoom(null);
    setActiveCallId(null);
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (!user) return null;

  return (
    <>
      {/* ── Incoming call overlay ── */}
      {incomingCall && !activeRoom && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 99999,
          background: "rgba(0,0,0,0.78)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "fadeIn 0.25s ease",
        }}>
          <div style={{
            background: "linear-gradient(160deg, rgba(14,14,28,0.98) 0%, rgba(20,16,40,0.98) 100%)",
            border: "1px solid rgba(201,169,97,0.25)",
            borderRadius: 28, padding: "44px 36px", width: 360, textAlign: "center",
            boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(201,169,97,0.1)",
            position: "relative", overflow: "hidden",
          }}>
            {/* Pulse rings */}
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{
                  position: "absolute", borderRadius: "50%",
                  border: `2px solid rgba(201,169,97,${0.15 - i * 0.04})`,
                  width: 100 + i * 60, height: 100 + i * 60,
                  animation: `callPulse ${1.2 + i * 0.4}s ease-out infinite`,
                  animationDelay: `${i * 0.3}s`,
                }} />
              ))}
            </div>

            {/* Avatar */}
            <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
              <div style={{
                width: 80, height: 80, borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(201,169,97,0.3), rgba(201,169,97,0.1))",
                border: "2px solid rgba(201,169,97,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 34,
              }}>
                {incomingCall.initiatedBy === "admin" ? "🏢" : "👤"}
              </div>
            </div>

            <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>
              Videollamada entrante
            </p>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--t1)", margin: "0 0 6px" }}>
              {incomingCall.initiatedBy === "admin" ? "Equipo Shopy Crafter" : "Tu cliente"}
            </h2>
            <p style={{ fontSize: 13, color: "var(--t3)", margin: "0 0 36px" }}>
              {incomingCall.initiatedBy === "admin"
                ? "Tu asesor quiere iniciar una videollamada contigo"
                : `Un cliente quiere hablar contigo`}
            </p>

            {/* Buttons */}
            <div style={{ display: "flex", gap: 20, justifyContent: "center" }}>
              <button onClick={reject} style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "rgba(220,60,60,0.15)", border: "2px solid rgba(220,60,60,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", transition: "all 0.15s",
              }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(220,60,60,0.3)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(220,60,60,0.15)"; }}>
                <PhoneOff size={24} color="#e84558" />
              </button>
              <button onClick={accept} style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(45,212,159,0.3), rgba(45,212,159,0.15))",
                border: "2px solid rgba(45,212,159,0.6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", transition: "all 0.15s",
                animation: "callAnswerPulse 1s ease-in-out infinite",
              }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(45,212,159,0.4)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(45,212,159,0.3)"; }}>
                <Phone size={24} color="#2dd4a0" />
              </button>
            </div>

            <p style={{ marginTop: 20, fontSize: 11, color: "var(--t3)" }}>
              Rechazar · Aceptar
            </p>
          </div>
        </div>
      )}

      {/* ── Active call: full-screen Jitsi overlay ── */}
      {activeRoom && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 99998,
          background: "#000", display: "flex", flexDirection: "column",
        }}>
          {/* Top bar */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 16px",
            background: "rgba(0,0,0,0.85)", borderBottom: "1px solid rgba(255,255,255,0.08)",
            flexShrink: 0, zIndex: 1,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2dd4a0", animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Videollamada en curso</span>
              <span style={{ fontSize: 11, color: "var(--t3)", fontVariantNumeric: "tabular-nums" }}>{fmt(elapsed)}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "var(--t3)" }}>powered by Jitsi Meet</span>
              <button onClick={endCall} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 14px", borderRadius: 9,
                background: "rgba(220,60,60,0.15)", border: "1px solid rgba(220,60,60,0.45)",
                color: "#e84558", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>
                <PhoneOff size={13} /> Finalizar
              </button>
            </div>
          </div>

          {/* Jitsi iframe */}
          <iframe
            src={activeRoom}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            style={{ flex: 1, border: "none", width: "100%", height: "100%" }}
          />
        </div>
      )}

      {/* ── CSS animations ── */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes callPulse {
          0% { transform: scale(1); opacity: 0.7; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes callAnswerPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(45,212,159,0.4); }
          50% { box-shadow: 0 0 0 14px rgba(45,212,159,0); }
        }
      `}</style>
    </>
  );
}
