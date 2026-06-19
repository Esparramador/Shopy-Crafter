/**
 * ② BagFormEffect — Formulario sale comprimido de la bolsa
 * Trigger: t=8.0s (bolsa volcada) · spring burst desde coordenadas de la bolsa
 * Billetes €100 vuelan desde la bolsa · glow dorado
 */
import { useState, useEffect, useRef } from "react";

const BASE       = import.meta.env.BASE_URL ?? "/__mockup/";
const VID_SRC    = `${BASE}alec_landing.mp4`;
const POSTER_SRC = `${BASE}alec_poster.jpg`;

const TRIGGER = 8.0;
const BAG_X   = 550;
const BAG_Y   = 560;
const DX      = -483;
const DY      = 160;

const BILLS = [
  { id:1, dx: 175, dy: -70,  rot:  22, delay:   0 },
  { id:2, dx: 110, dy:  80,  rot: -18, delay:  70 },
  { id:3, dx: -60, dy: -110, rot:  38, delay: 140 },
  { id:4, dx: 230, dy: -30,  rot: -28, delay:  50 },
  { id:5, dx:  90, dy: 120,  rot:  15, delay: 210 },
  { id:6, dx: -45, dy:  90,  rot: -50, delay: 110 },
  { id:7, dx: 155, dy: -145, rot:  55, delay: 180 },
  { id:8, dx:  50, dy: -170, rot: -12, delay:  90 },
];

export function BagFormEffect() {
  const [videoStarted, setVideoStarted] = useState(false);
  const [formReady,    setFormReady]    = useState(false);
  const [buildPhase,   setBuildPhase]   = useState(0);
  const [replay,       setReplay]       = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setVideoStarted(false); setFormReady(false); setBuildPhase(0);
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().then(() => setVideoStarted(true)).catch(() => {});
  }, [replay]);

  const startPlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.play().then(() => setVideoStarted(true)).catch(() => {});
  };

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
    const t2 = setTimeout(() => setBuildPhase(2),  900);
    const t3 = setTimeout(() => setBuildPhase(3), 1700);
    const t4 = setTimeout(() => setBuildPhase(4), 2450);
    return () => { clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [formReady]);

  useEffect(() => {
    const t = setTimeout(() => setReplay(r => r + 1), 14000);
    return () => clearTimeout(t);
  }, [replay]);

  return (
    <div style={{ width:"100vw", height:"100vh", overflow:"hidden", position:"relative", background:"#070604", fontFamily:"'Inter',system-ui,sans-serif" }}>
      <style>{`
        ${BILLS.map(b => `
          @keyframes bill${b.id}{
            0%{transform:translate(-26px,-12px) rotate(0deg) scale(1);opacity:.92}
            100%{transform:translate(${b.dx-26}px,${b.dy-12}px) rotate(${b.rot}deg) scale(.55);opacity:0}
          }
        `).join("")}
        @keyframes formBurst{
          0%{transform:translateY(-50%) translate(${DX}px,${DY}px) scale(0.04) skewX(18deg) skewY(22deg);opacity:0;border-radius:50%;filter:blur(8px) brightness(2.6)}
          14%{transform:translateY(-50%) translate(${Math.round(DX*.75)}px,${Math.round(DY*.72)}px) scale(.12) skewX(12deg) skewY(14deg);opacity:.78;border-radius:34%;filter:blur(3px) brightness(1.9)}
          32%{transform:translateY(-50%) translate(${Math.round(DX*.42)}px,${Math.round(DY*.38)}px) scale(.44) skewX(5deg) skewY(6deg);opacity:1;border-radius:22px;filter:blur(.8px) brightness(1.25)}
          52%{transform:translateY(-50%) translate(${Math.round(DX*.13)}px,${Math.round(DY*.1)}px) scale(.84) skewX(2deg) skewY(2deg);opacity:1;border-radius:18px;filter:blur(0) brightness(1.08)}
          68%{transform:translateY(-50%) translate(7px,-4px) scale(1.065) skewX(.4deg) skewY(.2deg);opacity:1;border-radius:16px}
          82%{transform:translateY(-50%) translate(-3px,2px) scale(.972);opacity:1;border-radius:16px}
          100%{transform:translateY(-50%) translate(0,0) scale(1) skewX(0) skewY(0);opacity:1;border-radius:16px;filter:blur(0) brightness(1)}
        }
        @keyframes bagGlow{0%{transform:scale(.1);opacity:0}25%{transform:scale(1.4);opacity:1}100%{transform:scale(3.2);opacity:0}}
        @keyframes fieldIn{from{opacity:0;transform:translateX(22px)}to{opacity:1;transform:translateX(0)}}
        @keyframes vfhBlink{0%,49%{opacity:1}50%,100%{opacity:0}}
        @keyframes playPulse{0%,100%{box-shadow:0 0 30px rgba(212,168,67,.5),0 0 60px rgba(212,168,67,.25)}50%{box-shadow:0 0 50px rgba(212,168,67,.8),0 0 100px rgba(212,168,67,.45)}}
        .bag-glow{animation:bagGlow .75s cubic-bezier(.25,.46,.45,.94) forwards}
        .form-burst{animation:formBurst 1.2s cubic-bezier(.34,1.56,.64,1) forwards}
        .field-in{animation:fieldIn .52s cubic-bezier(.22,1,.36,1) forwards;opacity:0}
        .vfh-cursor{display:inline-block;width:2px;height:.85em;background:#d4a843;vertical-align:text-bottom;margin-left:3px;animation:vfhBlink .7s step-end infinite}
        .play-btn:hover{transform:scale(1.08)!important}
      `}</style>

      <video key={replay} ref={videoRef} muted playsInline src={VID_SRC} poster={POSTER_SRC}
        style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", objectPosition:"left center", zIndex:1 }} />

      <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:2,
        background:"linear-gradient(90deg,transparent 25%,rgba(4,3,2,.55) 55%,rgba(4,3,2,.92) 100%)" }} />

      {/* PLAY OVERLAY */}
      {!videoStarted && (
        <div onClick={startPlay} style={{ position:"absolute", inset:0, zIndex:40, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <img src={POSTER_SRC} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", objectPosition:"left center" }} />
          <div style={{ position:"absolute", inset:0, background:"rgba(5,3,12,.68)" }} />
          <div style={{ position:"relative", textAlign:"center", padding:"0 20px" }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.2em", color:"rgba(212,168,67,.7)", textTransform:"uppercase", marginBottom:20 }}>VARIACIÓN ② · SALE DE LA BOLSA</div>
            <div className="play-btn" style={{ width:88, height:88, borderRadius:"50%", background:"linear-gradient(135deg,#d4a843,#e6c668)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:34, margin:"0 auto 22px", animation:"playPulse 2s ease-in-out infinite", transition:"transform .15s", color:"#0a0800", paddingLeft:6 }}>▶</div>
            <div style={{ fontSize:18, fontWeight:800, color:"#fff", marginBottom:8 }}>Pulsa para ver la animación</div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,.45)", lineHeight:1.5 }}>Formulario sale comprimido de la bolsa · billetes €100 vuelan · t=8.0s</div>
          </div>
        </div>
      )}

      {formReady && (
        <div className="bag-glow" style={{ position:"absolute", left:BAG_X, top:BAG_Y, width:90, height:90, marginLeft:-45, marginTop:-45, borderRadius:"50%", background:"radial-gradient(circle,rgba(212,168,67,.95) 0%,rgba(212,168,67,.45) 38%,transparent 72%)", zIndex:13, pointerEvents:"none" }} />
      )}

      {formReady && BILLS.map(b => (
        <div key={b.id} style={{ position:"absolute", left:BAG_X, top:BAG_Y, width:52, height:24, zIndex:14, pointerEvents:"none", background:"linear-gradient(135deg,#2a6a2a,#4fa84f)", border:"1.5px solid rgba(255,255,255,.22)", borderRadius:3, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:800, color:"rgba(0,70,0,.85)", boxShadow:"0 2px 8px rgba(0,0,0,.5)", animation:`bill${b.id} 1.25s cubic-bezier(.25,.46,.45,.94) ${b.delay}ms both` }}>€ 100</div>
      ))}

      {formReady && (
        <div className="form-burst" style={{ position:"absolute", right:77, top:"50%", width:340, background:"rgba(10,8,4,.88)", border:"1px solid rgba(212,168,67,.28)", borderRadius:16, padding:"26px 22px 22px", backdropFilter:"blur(18px)", zIndex:20, boxShadow:"0 0 50px 10px rgba(212,168,67,.18),0 0 0 1px rgba(212,168,67,.2)" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:10, fontWeight:700, letterSpacing:"0.18em", color:"#d4a843", textTransform:"uppercase", background:"rgba(212,168,67,.08)", border:"1px solid rgba(212,168,67,.2)", padding:"4px 10px", borderRadius:20, marginBottom:13 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#d4a843", display:"block" }}/>Trabaja con nosotros
          </div>
          <h2 style={{ fontSize:19, fontWeight:800, color:"#fff", margin:"0 0 2px", lineHeight:1.3 }}>Cuéntanos sobre</h2>
          <h2 style={{ fontSize:19, fontWeight:800, margin:"0 0 16px", background:"linear-gradient(135deg,#d4a843,#e6c668)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            tu negocio.<span className="vfh-cursor" />
          </h2>
          {buildPhase >= 2 && (
            <>
              <div className="field-in" style={{ marginBottom:10 }}>
                <label style={{ display:"block", fontSize:10, fontWeight:700, color:"rgba(200,168,75,.7)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 }}>Nombre</label>
                <div style={{ width:"100%", padding:"10px 13px", borderRadius:9, boxSizing:"border-box" as const, background:"rgba(255,255,255,.04)", border:"1px solid rgba(212,168,67,.28)", color:"rgba(255,255,255,.35)", fontSize:13 }}>Tu nombre aquí</div>
              </div>
              <div className="field-in" style={{ marginBottom:10, animationDelay:"110ms" }}>
                <label style={{ display:"block", fontSize:10, fontWeight:700, color:"rgba(200,168,75,.7)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 }}>Email</label>
                <div style={{ width:"100%", padding:"10px 13px", borderRadius:9, boxSizing:"border-box" as const, background:"rgba(255,255,255,.04)", border:"1px solid rgba(212,168,67,.28)", color:"rgba(255,255,255,.35)", fontSize:13 }}>tu@tienda.com</div>
              </div>
            </>
          )}
          {buildPhase >= 3 && (
            <div className="field-in" style={{ marginBottom:10 }}>
              <label style={{ display:"block", fontSize:10, fontWeight:700, color:"rgba(200,168,75,.7)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 }}>Teléfono</label>
              <div style={{ width:"100%", padding:"10px 13px", borderRadius:9, boxSizing:"border-box" as const, background:"rgba(255,255,255,.04)", border:"1px solid rgba(212,168,67,.28)", color:"rgba(255,255,255,.35)", fontSize:13 }}>+34 600 000 000</div>
            </div>
          )}
          {buildPhase >= 4 && (
            <div className="field-in">
              <button style={{ width:"100%", padding:"13px 20px", borderRadius:11, fontSize:14, fontWeight:800, background:"linear-gradient(135deg,#d4a843,#e6c668)", color:"#0a0800", border:"none", cursor:"pointer", letterSpacing:".03em" }}>Analiza mi tienda gratis →</button>
              <div style={{ display:"flex", justifyContent:"center", gap:7, marginTop:12 }}>
                {[0,1,2].map(i => <div key={i} style={{ height:7, borderRadius:4, width:i===0?22:7, background:i===0?"#d4a843":"rgba(255,255,255,.12)" }}/>)}
              </div>
            </div>
          )}
        </div>
      )}

      {videoStarted && !formReady && (
        <div style={{ position:"absolute", bottom:90, right:100, color:"rgba(255,255,255,.32)", fontSize:12, fontStyle:"italic", zIndex:10, pointerEvents:"none", textAlign:"right" }}>
          Espera a que Alec vuelque la bolsa...
        </div>
      )}

      <div style={{ position:"absolute", top:18, left:0, right:0, textAlign:"center", zIndex:50 }}>
        <div style={{ display:"inline-block", background:"rgba(0,0,0,.6)", backdropFilter:"blur(10px)", border:"1px solid rgba(212,168,67,.2)", borderRadius:24, padding:"7px 18px", fontSize:12, color:"rgba(255,255,255,.5)" }}>
          <span style={{ color:"#d4a843", fontWeight:700 }}>② Sale de la bolsa</span> · spring burst desde bolsa · t=8.0s
          <button onClick={() => setReplay(r => r + 1)} style={{ marginLeft:12, padding:"3px 10px", borderRadius:10, fontSize:11, background:"rgba(212,168,67,.15)", color:"#d4a843", border:"1px solid rgba(212,168,67,.3)", cursor:"pointer" }}>⟳</button>
        </div>
      </div>
    </div>
  );
}
