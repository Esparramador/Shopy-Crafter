/**
 * ③ FlipCard3D — Formulario entra con flip 3D en eje Y desde la bolsa
 * Trigger: t=8.0s · perspective(1200px) rotateY(-90°→0°) · billetes + glow
 */
import { useState, useEffect, useRef } from "react";


const VID_SRC    = "/assets/videos/alec_landing.mp4";
const POSTER_SRC = "/assets/videos/alec_poster.jpg";
const TRIGGER    = 8.0;
const BAG_X      = 550;
const BAG_Y      = 560;

const BILLS = [
  { id:1, dx: 180, dy: -75,  rot:  24, delay:  0 },
  { id:2, dx: 105, dy:  85,  rot: -16, delay: 75 },
  { id:3, dx: -65, dy: -115, rot:  40, delay:145 },
  { id:4, dx: 240, dy: -35,  rot: -32, delay: 55 },
  { id:5, dx:  85, dy: 125,  rot:  18, delay:215 },
  { id:6, dx: -50, dy:  95,  rot: -48, delay:115 },
];

export function FlipCard3D() {
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
    const t2 = setTimeout(() => setBuildPhase(2),  950);
    const t3 = setTimeout(() => setBuildPhase(3), 1750);
    const t4 = setTimeout(() => setBuildPhase(4), 2500);
    return () => { clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [formReady]);

  useEffect(() => {
    const t = setTimeout(() => setReplay(r => r + 1), 14000);
    return () => clearTimeout(t);
  }, [replay]);

  return (
    <div style={{ width:"100vw", height:"100vh", overflow:"hidden", position:"relative", background:"#05030c", fontFamily:"'Inter',system-ui,sans-serif" }}>
      <style>{`
        ${BILLS.map(b => `
          @keyframes flip3dBill${b.id}{
            0%{transform:translate(-26px,-12px) rotate(0deg) scale(1);opacity:.92}
            100%{transform:translate(${b.dx-26}px,${b.dy-12}px) rotate(${b.rot}deg) scale(.5);opacity:0}
          }
        `).join("")}
        @keyframes flip3dGlow{0%{transform:scale(.1);opacity:0}25%{transform:scale(1.5);opacity:1}100%{transform:scale(3.5);opacity:0}}
        @keyframes flip3dIn{
          0%{transform:perspective(1200px) translateX(-160px) rotateY(-90deg);opacity:0}
          35%{transform:perspective(1200px) translateX(-30px) rotateY(-22deg);opacity:1}
          65%{transform:perspective(1200px) translateX(8px) rotateY(6deg);opacity:1}
          80%{transform:perspective(1200px) translateX(-4px) rotateY(-2deg);opacity:1}
          100%{transform:perspective(1200px) translateX(0) rotateY(0deg);opacity:1}
        }
        @keyframes flip3dField{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:translateX(0)}}
        @keyframes flip3dBlink{0%,49%{opacity:1}50%,100%{opacity:0}}
        @keyframes playPulse{0%,100%{box-shadow:0 0 30px rgba(212,168,67,.5),0 0 60px rgba(212,168,67,.25)}50%{box-shadow:0 0 50px rgba(212,168,67,.8),0 0 100px rgba(212,168,67,.45)}}
        .f3d-cursor{display:inline-block;width:2px;height:.85em;background:#d4a843;vertical-align:text-bottom;margin-left:3px;animation:flip3dBlink .7s step-end infinite}
        .f3d-field{animation:flip3dField .5s cubic-bezier(.22,1,.36,1) forwards;opacity:0}
        .f3d-panel{animation:flip3dIn 1.0s cubic-bezier(.34,1.56,.64,1) forwards}
        .f3d-input{display:block;width:100%;box-sizing:border-box;padding:10px 13px;background:rgba(255,255,255,.04);border:1px solid rgba(212,168,67,.28);border-radius:9px;color:rgba(255,255,255,.9);font-size:13px;outline:none;font-family:inherit}
        .play-btn:hover{transform:scale(1.08)!important}
      `}</style>

      <video key={replay} ref={videoRef} muted playsInline src={VID_SRC} poster={POSTER_SRC}
        style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", objectPosition:"left center", zIndex:1 }} />

      <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:2,
        background:`linear-gradient(90deg,rgba(5,3,12,.08) 0%,rgba(5,3,12,.08) 38%,rgba(5,3,12,.68) 56%,rgba(5,3,12,.97) 73%,rgba(5,3,12,.99) 100%),
                   linear-gradient(180deg,rgba(5,3,12,.4) 0%,transparent 18%,transparent 75%,rgba(5,3,12,.5) 100%)` }} />

      {/* PLAY OVERLAY */}
      {!videoStarted && (
        <div onClick={startPlay} style={{ position:"absolute", inset:0, zIndex:40, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <img src={POSTER_SRC} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", objectPosition:"left center" }} />
          <div style={{ position:"absolute", inset:0, background:"rgba(5,3,12,.68)" }} />
          <div style={{ position:"relative", textAlign:"center", padding:"0 20px" }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.2em", color:"rgba(212,168,67,.7)", textTransform:"uppercase", marginBottom:20 }}>VARIACIÓN ③ · FLIP 3D DESDE BOLSA</div>
            <div className="play-btn" style={{ width:88, height:88, borderRadius:"50%", background:"linear-gradient(135deg,#d4a843,#e6c668)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:34, margin:"0 auto 22px", animation:"playPulse 2s ease-in-out infinite", transition:"transform .15s", color:"#0a0800", paddingLeft:6 }}>▶</div>
            <div style={{ fontSize:18, fontWeight:800, color:"#fff", marginBottom:8 }}>Pulsa para ver la animación</div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,.45)", lineHeight:1.5 }}>Card flip perspective 3D desde la dirección de la bolsa · t=8.0s</div>
          </div>
        </div>
      )}

      {formReady && (
        <div style={{ position:"absolute", left:BAG_X, top:BAG_Y, width:90, height:90, marginLeft:-45, marginTop:-45, borderRadius:"50%", background:"radial-gradient(circle,rgba(212,168,67,.9) 0%,rgba(212,168,67,.4) 38%,transparent 72%)", animation:"flip3dGlow .75s ease-out forwards", zIndex:13, pointerEvents:"none" }} />
      )}

      {formReady && BILLS.map(b => (
        <div key={b.id} style={{ position:"absolute", left:BAG_X, top:BAG_Y, width:52, height:24, zIndex:14, pointerEvents:"none", background:"linear-gradient(135deg,#2a6a2a,#4fa84f)", border:"1.5px solid rgba(255,255,255,.22)", borderRadius:3, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:800, color:"rgba(0,70,0,.85)", boxShadow:"0 2px 8px rgba(0,0,0,.5)", animation:`flip3dBill${b.id} 1.25s cubic-bezier(.25,.46,.45,.94) ${b.delay}ms both` }}>€ 100</div>
      ))}

      {formReady && (
        <div className="f3d-panel" style={{ position:"absolute", right:77, top:"50%", width:340, transformOrigin:"left center", transform:"translateY(-50%)", background:"rgba(10,8,4,.88)", border:"1px solid rgba(212,168,67,.28)", borderRadius:16, padding:"26px 22px 22px", backdropFilter:"blur(18px)", zIndex:20, boxShadow:"0 0 50px 10px rgba(212,168,67,.18),0 0 0 1px rgba(212,168,67,.2)" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:10, fontWeight:700, letterSpacing:"0.18em", color:"#d4a843", textTransform:"uppercase", background:"rgba(212,168,67,.08)", border:"1px solid rgba(212,168,67,.2)", padding:"4px 10px", borderRadius:20, marginBottom:13 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#d4a843", display:"block" }}/>Trabaja con nosotros
          </div>
          <h2 style={{ fontSize:19, fontWeight:800, color:"#fff", margin:"0 0 2px", lineHeight:1.3 }}>Cuéntanos sobre</h2>
          <h2 style={{ fontSize:19, fontWeight:800, margin:"0 0 16px", background:"linear-gradient(135deg,#d4a843,#e6c668)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            tu negocio.<span className="f3d-cursor" />
          </h2>
          {buildPhase >= 2 && (
            <>
              <div className="f3d-field" style={{ marginBottom:10 }}>
                <label style={{ display:"block", fontSize:10, fontWeight:700, color:"rgba(200,168,75,.7)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 }}>Nombre</label>
                <input className="f3d-input" readOnly placeholder="Tu nombre..." />
              </div>
              <div className="f3d-field" style={{ marginBottom:10, animationDelay:"110ms" }}>
                <label style={{ display:"block", fontSize:10, fontWeight:700, color:"rgba(200,168,75,.7)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 }}>Email</label>
                <input className="f3d-input" readOnly placeholder="tu@tienda.com" />
              </div>
            </>
          )}
          {buildPhase >= 3 && (
            <div className="f3d-field" style={{ marginBottom:10 }}>
              <label style={{ display:"block", fontSize:10, fontWeight:700, color:"rgba(200,168,75,.7)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 }}>Teléfono</label>
              <input className="f3d-input" readOnly placeholder="+34 600 000 000" />
            </div>
          )}
          {buildPhase >= 4 && (
            <div className="f3d-field">
              <button style={{ width:"100%", padding:"13px 20px", borderRadius:11, fontSize:14, fontWeight:800, background:"linear-gradient(135deg,#d4a843,#e6c668)", color:"#0a0800", border:"none", cursor:"pointer" }}>Analiza mi tienda gratis →</button>
              <div style={{ display:"flex", justifyContent:"center", gap:7, marginTop:12 }}>
                {[0,1,2].map(i => <div key={i} style={{ height:7, borderRadius:4, width:i===0?22:7, background:i===0?"#d4a843":"rgba(255,255,255,.12)" }}/>)}
              </div>
            </div>
          )}
        </div>
      )}

      {videoStarted && !formReady && (
        <div style={{ position:"absolute", bottom:90, right:100, color:"rgba(255,255,255,.32)", fontSize:12, fontStyle:"italic", zIndex:10, pointerEvents:"none", textAlign:"right" }}>Espera a que Alec vuelque la bolsa...</div>
      )}

      <div style={{ position:"absolute", top:18, left:0, right:0, textAlign:"center", zIndex:50 }}>
        <div style={{ display:"inline-block", background:"rgba(0,0,0,.6)", backdropFilter:"blur(10px)", border:"1px solid rgba(212,168,67,.2)", borderRadius:24, padding:"7px 18px", fontSize:12, color:"rgba(255,255,255,.5)" }}>
          <span style={{ color:"#d4a843", fontWeight:700 }}>③ Flip 3D desde bolsa</span> · rotateY(-90°→0°) · t=8.0s
          <button onClick={() => setReplay(r => r + 1)} style={{ marginLeft:12, padding:"3px 10px", borderRadius:10, fontSize:11, background:"rgba(212,168,67,.15)", color:"#d4a843", border:"1px solid rgba(212,168,67,.3)", cursor:"pointer" }}>⟳</button>
        </div>
      </div>
    </div>
  );
}
