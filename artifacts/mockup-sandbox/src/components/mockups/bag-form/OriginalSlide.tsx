/**
 * OriginalSlide — Réplica exacta del efecto producción (VismeFormHero)
 *
 * Trigger: t=4.5s (paraguas cerrado)
 * Animación: panel slide desde derecha, campos rise-in, botón spring-in
 * Idéntico al comportamiento actual de la landing, sin modificar el original.
 */
import { useState, useEffect, useRef } from "react";

const BASE    = import.meta.env.BASE_URL ?? "/__mockup/";
const VID_SRC = `${BASE}alec_landing.mp4`;
const TRIGGER = 4.5;

function TypewriterText({ text, delay = 0, speed = 62 }: { text: string; delay?: number; speed?: number }) {
  const [count,   setCount]   = useState(0);
  const [started, setStarted] = useState(delay === 0);
  useEffect(() => {
    if (delay === 0) { setStarted(true); return; }
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  useEffect(() => {
    if (!started || count >= text.length) return;
    const t = setTimeout(() => setCount(c => c + 1), speed);
    return () => clearTimeout(t);
  }, [started, count, text.length, speed]);
  return <>{text.slice(0, count)}{count < text.length && <span className="orig-cursor" />}</>;
}

export function OriginalSlide() {
  const [formReady,  setFormReady]  = useState(false);
  const [buildPhase, setBuildPhase] = useState(0);
  const [replay,     setReplay]     = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setFormReady(false); setBuildPhase(0);
    const v = videoRef.current;
    if (v) { v.currentTime = 0; v.play().catch(() => {}); }
  }, [replay]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => { if (v.currentTime >= TRIGGER && !formReady) setFormReady(true); };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [formReady, replay]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onEnded = () => { try { v.currentTime = Math.max(0, v.duration - 0.05); } catch {} };
    v.addEventListener("ended", onEnded);
    return () => v.removeEventListener("ended", onEnded);
  }, []);

  useEffect(() => {
    if (!formReady) return;
    setBuildPhase(1);
    const t2 = setTimeout(() => setBuildPhase(2), 1450);
    const t3 = setTimeout(() => setBuildPhase(3), 2150);
    const t4 = setTimeout(() => setBuildPhase(4), 2800);
    const t5 = setTimeout(() => setBuildPhase(5), 3300);
    return () => { clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
  }, [formReady]);

  useEffect(() => {
    const t = setTimeout(() => setReplay(r => r + 1), 14000);
    return () => clearTimeout(t);
  }, [replay]);

  const labelSt: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 700,
    color: "rgba(200,168,75,0.72)", textTransform: "uppercase",
    letterSpacing: "0.08em", marginBottom: 7,
  };

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative", background: "#05030c", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        .orig-cursor { display:inline-block; width:2px; height:.85em; background:#d4a843; vertical-align:text-bottom; margin-left:3px; animation:origBlink .7s step-end infinite; }
        @keyframes origBlink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        @keyframes origPulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.7)} }
        @keyframes origSlideIn { from{opacity:0;transform:translateX(38px)} to{opacity:1;transform:translateX(0)} }
        @keyframes origRiseIn  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes origSpring  { 0%{opacity:0;transform:translateY(12px) scale(.96)} 60%{opacity:1;transform:translateY(-2px) scale(1.02)} 100%{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes origInputGlow {
          0%  { box-shadow:0 0 0 0 rgba(212,168,67,.0); border-color:rgba(255,255,255,.12); }
          30% { box-shadow:0 0 0 5px rgba(212,168,67,.18); border-color:rgba(212,168,67,.75); }
          100%{ box-shadow:0 0 0 2px rgba(212,168,67,.06); border-color:rgba(212,168,67,.35); }
        }
        @keyframes origBob { 0%,100%{transform:translateY(0);opacity:.4} 50%{transform:translateY(-6px);opacity:.8} }
        .orig-slide  { animation:origSlideIn .65s cubic-bezier(.22,1,.36,1) forwards; }
        .orig-rise   { animation:origRiseIn  .52s cubic-bezier(.22,1,.36,1) forwards; }
        .orig-spring { animation:origSpring  .65s cubic-bezier(.34,1.56,.64,1) forwards; }
        .orig-glow   { animation:origInputGlow .9s cubic-bezier(.22,1,.36,1) forwards; }
        .orig-input  {
          display:block; width:100%; box-sizing:border-box; padding:11px 14px;
          background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.12);
          border-radius:10px; color:rgba(255,255,255,.93); font-size:14px;
          outline:none; font-family:inherit;
        }
      `}</style>

      <video key={replay} ref={videoRef} autoPlay muted playsInline src={VID_SRC}
        style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", objectPosition:"left center", zIndex:1 }} />

      {/* Gradient — exact production */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none", zIndex:2,
        background: `
          linear-gradient(90deg, rgba(5,3,12,.08) 0%, rgba(5,3,12,.08) 38%, rgba(5,3,12,.68) 56%, rgba(5,3,12,.97) 73%, rgba(5,3,12,.99) 100%),
          linear-gradient(180deg, rgba(5,3,12,.4) 0%, transparent 18%, transparent 75%, rgba(5,3,12,.5) 100%)
        `,
      }} />

      {/* Right panel — exact production layout */}
      <div style={{
        position:"absolute", right:0, top:0, bottom:0, width:"44%",
        padding:"40px 40px 40px 28px",
        display:"flex", flexDirection:"column", justifyContent:"center",
        overflowY:"auto", zIndex:3,
      }}>
        {/* Section title — always visible */}
        <div style={{ marginBottom:22 }}>
          <div style={{
            display:"inline-flex", alignItems:"center", gap:7,
            padding:"5px 13px", borderRadius:20,
            background:"rgba(200,168,75,.12)", border:"1px solid rgba(200,168,75,.2)",
            color:"#e6c668", fontSize:11, fontWeight:700,
            letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:14,
          }}>
            <span style={{ width:5, height:5, borderRadius:"50%", background:"#2dd49f", animation:"origPulse 1.8s ease-in-out infinite" }} />
            Trabaja con nosotros
          </div>
          <h2 style={{ margin:"0 0 9px", fontFamily:"'Instrument Serif', serif", fontSize:"clamp(19px,2.1vw,26px)", fontWeight:700, lineHeight:1.22, color:"rgba(255,255,255,.95)" }}>
            Cuéntanos sobre<br />
            <em style={{ color:"#d4a843" }}>tu negocio.</em>
          </h2>
          <p style={{ margin:0, fontSize:12.5, color:"rgba(255,255,255,.42)", lineHeight:1.55 }}>
            Análisis de tu tienda, mercado y competencia — 100% gratis.
          </p>
        </div>

        {/* Waiting hint */}
        {!formReady && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10, padding:"20px 0", textAlign:"center", color:"rgba(200,168,75,.4)" }}>
            <span style={{ fontSize:28, animation:"origBob 2.2s ease-in-out infinite" }}>🎩</span>
            <p style={{ margin:0, fontSize:12.5, fontStyle:"italic", lineHeight:1.55 }}>
              Observa cómo Alec<br />cierra el paraguas…
            </p>
          </div>
        )}

        {/* Form build */}
        {formReady && (
          <div className="orig-slide" style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div>
              <h3 style={{ margin:"0 0 3px", fontSize:17, fontWeight:800, color:"rgba(255,255,255,.95)" }}>
                <TypewriterText text="Datos de contacto" speed={65} />
              </h3>
              <p style={{ margin:0, fontSize:11.5, color:"rgba(200,168,75,.52)", fontStyle:"italic" }}>
                <TypewriterText text="Solo 2 min · análisis gratis" speed={42} delay={900} />
              </p>
            </div>

            {buildPhase >= 2 && (
              <div className="orig-rise" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
                <div>
                  <label style={labelSt}>Nombre *</label>
                  <input className="orig-input orig-glow" type="text" placeholder="Tu nombre" />
                </div>
                <div>
                  <label style={labelSt}>Email *</label>
                  <input className="orig-input orig-glow" style={{ animationDelay:"180ms" }} type="email" placeholder="tu@email.com" />
                </div>
              </div>
            )}

            {buildPhase >= 3 && (
              <div className="orig-rise">
                <label style={labelSt}>Teléfono</label>
                <input className="orig-input orig-glow" type="tel" placeholder="+34 600 000 000" />
              </div>
            )}

            {buildPhase >= 4 && (
              <div className="orig-spring">
                <button style={{ width:"100%", padding:"13px 20px", borderRadius:11, fontSize:14, fontWeight:800, background:"linear-gradient(135deg,#d4a843,#e6c668)", color:"#0a0800", border:"none", cursor:"pointer" }}>
                  Siguiente →
                </button>
              </div>
            )}

            {buildPhase >= 5 && (
              <div className="orig-rise" style={{ display:"flex", justifyContent:"center", gap:7, marginTop:4 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ height:7, borderRadius:4, width: i===0 ? 22 : 7, background: i===0 ? "#d4a843" : "rgba(255,255,255,.12)", transition:"all .35s" }} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Label bar */}
      <div style={{ position:"absolute", top:18, left:0, right:0, textAlign:"center", zIndex:30 }}>
        <div style={{ display:"inline-block", background:"rgba(0,0,0,.55)", backdropFilter:"blur(10px)", border:"1px solid rgba(212,168,67,.2)", borderRadius:24, padding:"7px 18px", fontSize:12, color:"rgba(255,255,255,.5)" }}>
          <span style={{ color:"#d4a843", fontWeight:700 }}>① Original producción</span>
          {" · "}panel slide desde derecha · t=4.5s
          <button onClick={() => setReplay(r => r + 1)} style={{ marginLeft:12, padding:"3px 10px", borderRadius:10, fontSize:11, background:"rgba(212,168,67,.15)", color:"#d4a843", border:"1px solid rgba(212,168,67,.3)", cursor:"pointer" }}>⟳</button>
        </div>
      </div>
    </div>
  );
}
