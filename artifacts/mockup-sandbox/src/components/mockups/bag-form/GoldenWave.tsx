/**
 * GoldenWave — Ola dorada barre desde la bolsa, revelando el formulario
 *
 * Trigger: t=7.5s (billetes empezando a salir)
 * Animación:
 *   1. Ola dorada (pseudo-elemento/div) barre de izquierda a derecha desde x=550px
 *   2. El formulario se revela usando clip-path detrás de la ola
 *   3. Brillos y partículas de oro al paso de la ola
 *   4. El panel queda estático una vez revelado
 */
import { useState, useEffect, useRef } from "react";

const BASE    = import.meta.env.BASE_URL ?? "/__mockup/";
const VID_SRC = `${BASE}alec_landing.mp4`;
const TRIGGER = 7.5;
const BAG_X   = 550;
const BAG_Y   = 560;

// Partículas de oro que brotan de la bolsa durante la ola
const SPARKS = [
  { id:1, dx:  90, dy: -80,  delay:  0, size:6  },
  { id:2, dx: 160, dy: -50,  delay: 80, size:4  },
  { id:3, dx: 120, dy: -130, delay: 40, size:5  },
  { id:4, dx:  60, dy: -100, delay:120, size:7  },
  { id:5, dx: 200, dy: -70,  delay: 60, size:4  },
  { id:6, dx: 140, dy: -160, delay:150, size:5  },
  { id:7, dx:  80, dy: -190, delay: 30, size:6  },
  { id:8, dx: 220, dy: -110, delay: 90, size:4  },
  { id:9, dx:  50, dy: -50,  delay:170, size:8  },
  { id:10,dx: 180, dy: -140, delay: 20, size:5  },
];

export function GoldenWave() {
  const [formReady,  setFormReady]  = useState(false);
  const [wavePhase,  setWavePhase]  = useState(0);   // 0=hidden 1=sweeping 2=done
  const [buildPhase, setBuildPhase] = useState(0);
  const [replay,     setReplay]     = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setFormReady(false); setWavePhase(0); setBuildPhase(0);
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
    setWavePhase(1);
    const tDone  = setTimeout(() => setWavePhase(2),  900);
    const t2     = setTimeout(() => setBuildPhase(1), 200);
    const t3     = setTimeout(() => setBuildPhase(2), 750);
    const t4     = setTimeout(() => setBuildPhase(3), 1200);
    const t5     = setTimeout(() => setBuildPhase(4), 1650);
    return () => { clearTimeout(tDone); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
  }, [formReady]);

  useEffect(() => {
    const t = setTimeout(() => setReplay(r => r + 1), 13500);
    return () => clearTimeout(t);
  }, [replay]);

  // The wave animates from BAG_X=550 → right edge 1280
  // Panel is at right=77, width=340 → left=863
  // Wave should cover and reveal the panel (from left to right, 1.1s)

  return (
    <div style={{ width:"100vw", height:"100vh", overflow:"hidden", position:"relative", background:"#05030c", fontFamily:"'Inter', system-ui, sans-serif" }}>
      <style>{`
        /* Sparks */
        ${SPARKS.map(s => `
          @keyframes gwSpark${s.id} {
            0%   { transform: translate(0,0) scale(1);   opacity:1; }
            100% { transform: translate(${s.dx}px,${s.dy}px) scale(0); opacity:0; }
          }
        `).join("")}

        /* Wave bar sweeps from x=550 to x=1280 */
        @keyframes gwSweep {
          0%   { left: ${BAG_X}px; width: 0;    opacity:1; }
          20%  { left: ${BAG_X}px; width: 60px; opacity:1; }
          80%  { left: ${BAG_X + 580}px; width: 60px; opacity:1; }
          100% { left: 1280px; width: 0;    opacity:0; }
        }
        /* Shine edge on wave */
        @keyframes gwShineEdge {
          0%   { left: ${BAG_X}px; }
          100% { left: 1360px; }
        }
        /* Form reveal — clip-path expands from left as wave passes */
        @keyframes gwReveal {
          0%   { clip-path: inset(0 100% 0 0 round 16px); opacity:1; }
          100% { clip-path: inset(0 0% 0 0 round 16px);   opacity:1; }
        }
        /* Glow burst */
        @keyframes gwGlow { 0%{transform:scale(.1);opacity:0} 25%{transform:scale(1.6);opacity:1} 100%{transform:scale(3.8);opacity:0} }

        /* Individual field reveal */
        @keyframes gwField {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0); }
        }
        /* Cursor */
        @keyframes gwBlink { 0%,49%{opacity:1} 50%,100%{opacity:0} }

        .gw-cursor { display:inline-block;width:2px;height:.85em;background:#d4a843;vertical-align:text-bottom;margin-left:3px;animation:gwBlink .7s step-end infinite; }
        .gw-reveal { animation:gwReveal .85s cubic-bezier(.4,0,.2,1) forwards; opacity:1; }
        .gw-field  { animation:gwField  .45s cubic-bezier(.22,1,.36,1) forwards; opacity:0; }
        .gw-input  { display:block;width:100%;box-sizing:border-box;padding:10px 13px;background:rgba(255,255,255,.04);border:1px solid rgba(212,168,67,.28);border-radius:9px;color:rgba(255,255,255,.9);font-size:13px;outline:none;font-family:inherit; }
      `}</style>

      <video key={replay} ref={videoRef} autoPlay muted playsInline src={VID_SRC}
        style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", objectPosition:"left center", zIndex:1 }} />

      {/* Gradient — production style */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none", zIndex:2,
        background:`linear-gradient(90deg, rgba(5,3,12,.08) 0%, rgba(5,3,12,.08) 38%, rgba(5,3,12,.68) 56%, rgba(5,3,12,.97) 73%, rgba(5,3,12,.99) 100%),
                   linear-gradient(180deg, rgba(5,3,12,.4) 0%, transparent 18%, transparent 75%, rgba(5,3,12,.5) 100%)`,
      }} />

      {/* Glow burst at bag */}
      {formReady && (
        <div style={{
          position:"absolute", left:BAG_X, top:BAG_Y,
          width:100, height:100, marginLeft:-50, marginTop:-50, borderRadius:"50%",
          background:"radial-gradient(circle, rgba(212,168,67,.95) 0%, rgba(212,168,67,.4) 35%, transparent 70%)",
          animation:"gwGlow .85s ease-out forwards", zIndex:13, pointerEvents:"none",
        }} />
      )}

      {/* Gold sparks from bag */}
      {formReady && SPARKS.map(s => (
        <div key={s.id} style={{
          position:"absolute", left:BAG_X, top:BAG_Y,
          width:s.size, height:s.size, borderRadius:"50%",
          background:"#d4a843",
          boxShadow:`0 0 ${s.size * 2}px rgba(212,168,67,.8)`,
          animation:`gwSpark${s.id} 1.0s cubic-bezier(.25,.46,.45,.94) ${s.delay}ms both`,
          zIndex:14, pointerEvents:"none",
        }} />
      ))}

      {/* THE GOLDEN WAVE BAR */}
      {wavePhase === 1 && (
        <div style={{
          position:"absolute", top:0, bottom:0, zIndex:18, pointerEvents:"none",
          background:"linear-gradient(90deg, transparent 0%, rgba(212,168,67,.12) 20%, rgba(212,168,67,.55) 50%, rgba(255,220,100,.85) 72%, rgba(212,168,67,.45) 85%, transparent 100%)",
          animation:"gwSweep .9s cubic-bezier(.4,0,.6,1) forwards",
        }} />
      )}

      {/* Form panel — revealed by wave clip-path */}
      {formReady && (
        <div
          className={wavePhase >= 1 ? "gw-reveal" : ""}
          style={{
            position:"absolute", right:77, top:"50%",
            transform:"translateY(-50%)",
            width:340,
            background:"rgba(10,8,4,.88)",
            border:"1px solid rgba(212,168,67,.28)", borderRadius:16,
            padding:"26px 22px 22px",
            backdropFilter:"blur(18px)", zIndex:16,
            boxShadow:"0 0 50px 10px rgba(212,168,67,.18), 0 0 0 1px rgba(212,168,67,.2)",
            clipPath: wavePhase === 0 ? "inset(0 100% 0 0 round 16px)" : undefined,
          }}
        >
          <div style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:10, fontWeight:700, letterSpacing:"0.18em", color:"#d4a843", textTransform:"uppercase", background:"rgba(212,168,67,.08)", border:"1px solid rgba(212,168,67,.2)", padding:"4px 10px", borderRadius:20, marginBottom:13 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#d4a843", display:"block" }}/>
            Trabaja con nosotros
          </div>

          <h2 style={{ fontSize:19, fontWeight:800, color:"#fff", margin:"0 0 2px", lineHeight:1.3 }}>Cuéntanos sobre</h2>
          <h2 style={{ fontSize:19, fontWeight:800, margin:"0 0 16px", background:"linear-gradient(135deg,#d4a843,#e6c668)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            tu negocio.<span className="gw-cursor" />
          </h2>

          {buildPhase >= 2 && (
            <>
              <div className="gw-field" style={{ marginBottom:10 }}>
                <label style={{ display:"block", fontSize:10, fontWeight:700, color:"rgba(200,168,75,.7)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 }}>Nombre</label>
                <input className="gw-input" readOnly placeholder="Tu nombre..." />
              </div>
              <div className="gw-field" style={{ marginBottom:10, animationDelay:"100ms" }}>
                <label style={{ display:"block", fontSize:10, fontWeight:700, color:"rgba(200,168,75,.7)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 }}>Email</label>
                <input className="gw-input" readOnly placeholder="tu@tienda.com" />
              </div>
            </>
          )}

          {buildPhase >= 3 && (
            <div className="gw-field" style={{ marginBottom:10 }}>
              <label style={{ display:"block", fontSize:10, fontWeight:700, color:"rgba(200,168,75,.7)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 }}>Teléfono</label>
              <input className="gw-input" readOnly placeholder="+34 600 000 000" />
            </div>
          )}

          {buildPhase >= 4 && (
            <div className="gw-field">
              <button style={{ width:"100%", padding:"13px 20px", borderRadius:11, fontSize:14, fontWeight:800, background:"linear-gradient(135deg,#d4a843,#e6c668)", color:"#0a0800", border:"none", cursor:"pointer" }}>
                Analiza mi tienda gratis →
              </button>
              <div style={{ display:"flex", justifyContent:"center", gap:7, marginTop:12 }}>
                {[0,1,2].map(i => <div key={i} style={{ height:7, borderRadius:4, width: i===0?22:7, background: i===0?"#d4a843":"rgba(255,255,255,.12)" }}/>)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Waiting hint */}
      {!formReady && (
        <div style={{ position:"absolute", bottom:90, right:100, color:"rgba(255,255,255,.32)", fontSize:12, fontStyle:"italic", zIndex:10, pointerEvents:"none", textAlign:"right" }}>
          Espera a que los billetes empiecen a salir...
        </div>
      )}

      {/* Label bar */}
      <div style={{ position:"absolute", top:18, left:0, right:0, textAlign:"center", zIndex:30 }}>
        <div style={{ display:"inline-block", background:"rgba(0,0,0,.55)", backdropFilter:"blur(10px)", border:"1px solid rgba(212,168,67,.2)", borderRadius:24, padding:"7px 18px", fontSize:12, color:"rgba(255,255,255,.5)" }}>
          <span style={{ color:"#d4a843", fontWeight:700 }}>④ Ola dorada</span>
          {" · "}clip-path sweep desde bolsa → revela formulario · t=7.5s
          <button onClick={() => setReplay(r => r + 1)} style={{ marginLeft:12, padding:"3px 10px", borderRadius:10, fontSize:11, background:"rgba(212,168,67,.15)", color:"#d4a843", border:"1px solid rgba(212,168,67,.3)", cursor:"pointer" }}>⟳</button>
        </div>
      </div>
    </div>
  );
}
