/**
 * ③ FlipCard3D — Formulario entra con flip 3D desde la bolsa
 * Trigger: t=8.0s · perspective rotateY(-90°→0°) · billetes + glow
 *
 * v3 fixes:
 * - Container: position:fixed; inset:0 (video full-screen fiable en móvil)
 * - onAnimationEnd limpia el CSS animation → sin perspectiva 3D residual
 *   que bloquea el foco/interacción de los inputs
 * - translateY(-50%) compuesto en los keyframes wide/landscape para que
 *   el panel quede centrado durante Y después de la animación
 * - Móvil portrait: sustituye rotateX (caída visual) por slide-up suave
 * - Inputs sin readOnly → formulario rellenable como demo real
 * - Billetes/glow: solo en pantallas anchas (bolsa visible)
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
  const [animDone,     setAnimDone]     = useState(false);
  const [replay,       setReplay]       = useState(0);

  const [vw, setVw] = useState(() => window.innerWidth);
  const [vh, setVh] = useState(() => window.innerHeight);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const h = () => { setVw(window.innerWidth); setVh(window.innerHeight); };
    window.addEventListener("resize", h);
    window.addEventListener("orientationchange", h);
    return () => { window.removeEventListener("resize", h); window.removeEventListener("orientationchange", h); };
  }, []);

  const isWide     = vw >= 700;
  const isPortrait = vh > vw;
  const narrowPortrait  = !isWide && isPortrait;
  const narrowLandscape = !isWide && !isPortrait;

  // Mount / replay
  useEffect(() => {
    setVideoStarted(false); setFormReady(false); setBuildPhase(0); setAnimDone(false);
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().then(() => setVideoStarted(true)).catch(() => {});
  }, [replay]);

  // Reset animDone when form becomes ready (new animation cycle)
  useEffect(() => { if (formReady) setAnimDone(false); }, [formReady]);

  const startPlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.play().then(() => setVideoStarted(true)).catch(() => {});
  };

  // Trigger form
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const fn = () => { if (v.currentTime >= TRIGGER && !formReady) setFormReady(true); };
    v.addEventListener("timeupdate", fn);
    return () => v.removeEventListener("timeupdate", fn);
  }, [formReady, replay]);

  // Congelar último frame + replay tras 3.5s
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let t: ReturnType<typeof setTimeout>;
    const onEnded = () => {
      try { v.currentTime = Math.max(0, v.duration - 0.05); } catch {}
      t = setTimeout(() => setReplay(r => r + 1), 3500);
    };
    v.addEventListener("ended", onEnded);
    return () => { v.removeEventListener("ended", onEnded); clearTimeout(t); };
  }, [replay]);

  // Build phases
  useEffect(() => {
    if (!formReady) return;
    setBuildPhase(1);
    const t2 = setTimeout(() => setBuildPhase(2),  950);
    const t3 = setTimeout(() => setBuildPhase(3), 1750);
    const t4 = setTimeout(() => setBuildPhase(4), 2500);
    return () => { clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [formReady]);

  const sm = narrowPortrait || narrowLandscape;

  // Gradient overlay
  const overlayGrad = narrowPortrait
    ? `linear-gradient(180deg,rgba(5,3,12,0) 0%,rgba(5,3,12,0) 30%,rgba(5,3,12,.6) 54%,rgba(5,3,12,.93) 70%,rgba(5,3,12,.97) 100%),
       linear-gradient(180deg,rgba(5,3,12,.25) 0%,transparent 12%)`
    : `linear-gradient(90deg,rgba(5,3,12,.08) 0%,rgba(5,3,12,.08) 38%,rgba(5,3,12,.68) 56%,rgba(5,3,12,.97) 73%,rgba(5,3,12,.99) 100%),
       linear-gradient(180deg,rgba(5,3,12,.4) 0%,transparent 18%,transparent 75%,rgba(5,3,12,.5) 100%)`;

  // Panel common styles
  const panelCommon: React.CSSProperties = {
    background:"rgba(10,8,4,.92)", border:"1px solid rgba(212,168,67,.28)", borderRadius:16,
    backdropFilter:"blur(18px)",
    boxShadow:"0 0 50px 10px rgba(212,168,67,.18),0 0 0 1px rgba(212,168,67,.2)",
    zIndex: 20,
  };

  // Panel positioning — translateY(-50%) included here, composed in keyframes
  const panelStyle: React.CSSProperties = narrowPortrait ? {
    position:"absolute", left:12, right:12, bottom:12,
    padding:"13px 14px 12px",
    ...panelCommon,
  } : narrowLandscape ? {
    position:"absolute", right:12, top:"50%", transform:"translateY(-50%)",
    width:`min(250px, ${Math.round(vw*0.46)}px)`,
    padding:"16px 16px 14px",
    ...panelCommon,
  } : {
    position:"absolute", right: vw < 900 ? 20 : 77, top:"50%", transform:"translateY(-50%)",
    width: vw < 900 ? `min(300px,${Math.round(vw*0.4)}px)` : 340,
    padding:"26px 22px 22px",
    ...panelCommon,
  };

  // Clase de animación — se elimina tras onAnimationEnd para liberar perspectiva 3D residual
  const panelAnimClass = animDone ? "" : (
    narrowPortrait  ? "f3d-slide-up" :
    narrowLandscape ? "f3d-flip-left" :
                      "f3d-flip-side"
  );

  const labelSt: React.CSSProperties = {
    display:"block", fontSize:10, fontWeight:700,
    color:"rgba(200,168,75,.7)", textTransform:"uppercase",
    letterSpacing:"0.08em", marginBottom:5,
  };
  const inputSt: React.CSSProperties = {
    display:"block", width:"100%", boxSizing:"border-box",
    padding: sm ? "8px 11px" : "10px 13px",
    background:"rgba(255,255,255,.05)", border:"1px solid rgba(212,168,67,.28)",
    borderRadius:9, color:"rgba(255,255,255,.9)", fontSize:13,
    outline:"none", fontFamily:"inherit",
    transition:"border-color .2s",
  };

  return (
    <div style={{ position:"fixed", inset:0, overflow:"hidden", background:"#05030c", fontFamily:"'Inter',system-ui,sans-serif" }}>
      <style>{`
        ${BILLS.map(b => `
          @keyframes f3dBill${b.id}{
            0%{transform:translate(-26px,-12px) rotate(0deg) scale(1);opacity:.92}
            100%{transform:translate(${b.dx-26}px,${b.dy-12}px) rotate(${b.rot}deg) scale(.5);opacity:0}
          }
        `).join("")}
        @keyframes f3dGlow{0%{transform:scale(.1);opacity:0}25%{transform:scale(1.5);opacity:1}100%{transform:scale(3.5);opacity:0}}
        @keyframes playPulse{0%,100%{box-shadow:0 0 30px rgba(212,168,67,.5),0 0 60px rgba(212,168,67,.25)}50%{box-shadow:0 0 50px rgba(212,168,67,.8),0 0 100px rgba(212,168,67,.45)}}
        @keyframes f3dBlink{0%,49%{opacity:1}50%,100%{opacity:0}}
        @keyframes f3dField{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
        @keyframes f3dBob{0%,100%{transform:translateY(0);opacity:.35}50%{transform:translateY(-6px);opacity:.8}}

        /* ── Wide: flip lateral. translateY(-50%) compuesto en keyframes ── */
        @keyframes f3dFlipSide{
          0%  {transform:translateY(-50%) perspective(1200px) translateX(-180px) rotateY(-90deg);opacity:0}
          35% {transform:translateY(-50%) perspective(1200px) translateX(-24px) rotateY(-20deg);opacity:1}
          65% {transform:translateY(-50%) perspective(1200px) translateX(8px) rotateY(5deg);opacity:1}
          80% {transform:translateY(-50%) perspective(1200px) translateX(-2px) rotateY(-2deg);opacity:1}
          100%{transform:translateY(-50%) perspective(1200px) translateX(0) rotateY(0deg);opacity:1}
        }
        .f3d-flip-side{animation:f3dFlipSide 1.05s cubic-bezier(.34,1.56,.64,1) forwards}

        /* ── Móvil portrait: slide-up suave (sin rotateX que cae visualmente) ── */
        @keyframes f3dSlideUp{
          0%  {transform:translateY(52px) scale(0.96);opacity:0}
          55% {transform:translateY(-5px) scale(1.015);opacity:1}
          78% {transform:translateY(3px) scale(0.998)}
          100%{transform:translateY(0) scale(1);opacity:1}
        }
        .f3d-slide-up{animation:f3dSlideUp 0.9s cubic-bezier(.34,1.56,.64,1) forwards}

        /* ── Landscape: flip desde izquierda. translateY(-50%) compuesto ── */
        @keyframes f3dFlipLeft{
          0%  {transform:translateY(-50%) perspective(800px) translateX(-60px) rotateY(-65deg);opacity:0}
          45% {transform:translateY(-50%) perspective(800px) translateX(5px) rotateY(6deg);opacity:1}
          70% {transform:translateY(-50%) perspective(800px) translateX(-2px) rotateY(-2deg)}
          100%{transform:translateY(-50%) perspective(800px) translateX(0) rotateY(0deg);opacity:1}
        }
        .f3d-flip-left{animation:f3dFlipLeft .9s cubic-bezier(.34,1.56,.64,1) forwards}

        .f3d-field{animation:f3dField .5s cubic-bezier(.22,1,.36,1) forwards;opacity:0}
        .play-btn:hover{transform:scale(1.08)!important}
        .f3d-input:focus{border-color:rgba(212,168,67,.7)!important;box-shadow:0 0 0 3px rgba(212,168,67,.12)!important}
      `}</style>

      {/* VIDEO — objectPosition adaptativo: portrait → 22% center, wide → left center */}
      <video key={replay} ref={videoRef} muted playsInline src={VID_SRC} poster={POSTER_SRC}
        style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover",
          objectPosition: narrowPortrait ? "22% center" : "left center", zIndex:1 }} />

      {/* Gradient */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:2, background:overlayGrad }} />

      {/* PLAY OVERLAY */}
      {!videoStarted && (
        <div onClick={startPlay} style={{ position:"absolute", inset:0, zIndex:40, cursor:"pointer",
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <img src={POSTER_SRC} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%",
            objectFit:"cover", objectPosition: narrowPortrait ? "22% center" : "left center" }} />
          <div style={{ position:"absolute", inset:0, background:"rgba(5,3,12,.68)" }} />
          <div style={{ position:"relative", textAlign:"center", padding:"0 20px" }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.2em", color:"rgba(212,168,67,.7)", textTransform:"uppercase", marginBottom:20 }}>
              VARIACIÓN ③ · FLIP 3D DESDE BOLSA
            </div>
            <div className="play-btn" style={{ width:84, height:84, borderRadius:"50%",
              background:"linear-gradient(135deg,#d4a843,#e6c668)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:32, margin:"0 auto 22px",
              animation:"playPulse 2s ease-in-out infinite",
              transition:"transform .15s", color:"#0a0800", paddingLeft:6 }}>▶</div>
            <div style={{ fontSize:18, fontWeight:800, color:"#fff", marginBottom:8 }}>Pulsa para ver la animación</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,.45)", lineHeight:1.5 }}>
              Card flip perspective 3D desde la dirección de la bolsa · t=8.0s
            </div>
          </div>
        </div>
      )}

      {/* Efectos bolsa — SOLO en pantallas anchas */}
      {formReady && isWide && (
        <>
          <div style={{ position:"absolute", left:BAG_X, top:BAG_Y, width:90, height:90,
            marginLeft:-45, marginTop:-45, borderRadius:"50%",
            background:"radial-gradient(circle,rgba(212,168,67,.9) 0%,rgba(212,168,67,.4) 38%,transparent 72%)",
            animation:"f3dGlow .75s ease-out forwards", zIndex:13, pointerEvents:"none" }} />
          {BILLS.map(b => (
            <div key={b.id} style={{ position:"absolute", left:BAG_X, top:BAG_Y,
              width:52, height:24, zIndex:14, pointerEvents:"none",
              background:"linear-gradient(135deg,#2a6a2a,#4fa84f)",
              border:"1.5px solid rgba(255,255,255,.22)", borderRadius:3,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:9, fontWeight:800, color:"rgba(0,70,0,.85)",
              boxShadow:"0 2px 8px rgba(0,0,0,.5)",
              animation:`f3dBill${b.id} 1.25s cubic-bezier(.25,.46,.45,.94) ${b.delay}ms both` }}>€ 100</div>
          ))}
        </>
      )}

      {/* Hint */}
      {videoStarted && !formReady && (
        <div style={{
          position:"absolute",
          ...(narrowPortrait
            ? { bottom:24, left:0, right:0, textAlign:"center" }
            : { bottom:80, right: isWide ? 110 : 16, textAlign:"right" }),
          color:"rgba(255,255,255,.3)", fontSize:12, fontStyle:"italic",
          zIndex:10, pointerEvents:"none",
          display:"flex", flexDirection:"column",
          alignItems: narrowPortrait ? "center" : "flex-end", gap:6 }}>
          <span style={{ fontSize:22, animation:"f3dBob 2.2s ease-in-out infinite" }}>💼</span>
          <span>Espera a que Alec vuelque la bolsa...</span>
        </div>
      )}

      {/* ── FORMULARIO ── */}
      {formReady && (
        <div
          key={`${narrowPortrait}-${narrowLandscape}`}
          className={panelAnimClass}
          style={panelStyle}
          onAnimationEnd={() => setAnimDone(true)}
        >
          <div style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:10, fontWeight:700,
            letterSpacing:"0.18em", color:"#d4a843", textTransform:"uppercase",
            background:"rgba(212,168,67,.08)", border:"1px solid rgba(212,168,67,.2)",
            padding:"4px 10px", borderRadius:20, marginBottom: sm ? 10 : 13 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#d4a843", display:"block" }}/>
            Trabaja con nosotros
          </div>

          <h2 style={{ fontSize: sm ? 15 : 18, fontWeight:800, color:"#fff", margin:"0 0 2px", lineHeight:1.3 }}>
            Cuéntanos sobre
          </h2>
          <h2 style={{ fontSize: sm ? 15 : 18, fontWeight:800, margin:`0 0 ${sm?10:16}px`,
            background:"linear-gradient(135deg,#d4a843,#e6c668)",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            tu negocio.
            <span style={{ display:"inline-block", width:2, height:"0.85em", background:"#d4a843",
              verticalAlign:"text-bottom", marginLeft:3, animation:"f3dBlink .7s step-end infinite" }} />
          </h2>

          {buildPhase >= 2 && (
            <>
              <div className="f3d-field" style={{ marginBottom:9 }}>
                <label style={labelSt}>Nombre</label>
                <input className="f3d-input" style={inputSt} type="text" placeholder="Tu nombre..." />
              </div>
              <div className="f3d-field" style={{ marginBottom:9, animationDelay:"110ms" }}>
                <label style={labelSt}>Email</label>
                <input className="f3d-input" style={inputSt} type="email" placeholder="tu@tienda.com" />
              </div>
            </>
          )}
          {buildPhase >= 3 && !narrowPortrait && (
            <div className="f3d-field" style={{ marginBottom:9 }}>
              <label style={labelSt}>Teléfono</label>
              <input className="f3d-input" style={inputSt} type="tel" placeholder="+34 600 000 000" />
            </div>
          )}
          {buildPhase >= 4 && (
            <div className="f3d-field">
              <button style={{ width:"100%", padding: sm ? "10px 16px" : "13px 20px",
                borderRadius:11, fontSize: sm ? 13 : 14, fontWeight:800,
                background:"linear-gradient(135deg,#d4a843,#e6c668)", color:"#0a0800",
                border:"none", cursor:"pointer" }}>Analiza mi tienda gratis →</button>
              <div style={{ display:"flex", justifyContent:"center", gap:7, marginTop: sm ? 10 : 12 }}>
                {[0,1,2].map(i => <div key={i} style={{ height:7, borderRadius:4, width:i===0?22:7, background:i===0?"#d4a843":"rgba(255,255,255,.12)" }}/>)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Label */}
      <div style={{ position:"absolute", top:14, left:0, right:0, textAlign:"center", zIndex:50 }}>
        <div style={{ display:"inline-block", background:"rgba(0,0,0,.6)", backdropFilter:"blur(10px)",
          border:"1px solid rgba(212,168,67,.2)", borderRadius:24, padding:"6px 16px",
          fontSize:11, color:"rgba(255,255,255,.5)", maxWidth:"calc(100% - 28px)" }}>
          <span style={{ color:"#d4a843", fontWeight:700 }}>③ Flip 3D desde bolsa</span>
          {" · "}rotateY(-90°→0°) · t=8.0s
          <button onClick={() => setReplay(r => r + 1)} style={{ marginLeft:10, padding:"3px 10px", borderRadius:10,
            fontSize:11, background:"rgba(212,168,67,.15)", color:"#d4a843",
            border:"1px solid rgba(212,168,67,.3)", cursor:"pointer" }}>⟳</button>
        </div>
      </div>
    </div>
  );
}
