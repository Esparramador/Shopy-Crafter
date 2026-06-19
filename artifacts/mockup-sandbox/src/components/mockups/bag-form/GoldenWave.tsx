/**
 * ④ GoldenWave — Ola dorada barre desde la bolsa, revelando el formulario
 * Trigger: t=7.5s · clip-path inset sweep · chispas doradas
 *
 * Cambios v2:
 * - Totalmente responsivo: pantallas anchas → sweep desde BAG_X
 *   narrow → sweep desde 0 (gwSweepNarrow)
 *   portrait → panel inferior con reveal desde abajo
 * - Chispas: solo en pantallas anchas (bolsa visible)
 * - Replay vía onEnded + 3.5s (no timer fijo desde mount)
 * - Último frame queda congelado
 */
import { useState, useEffect, useRef } from "react";

const _BASE      = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const VID_SRC    = `${_BASE}/assets/videos/alec_landing.mp4`;
const POSTER_SRC = `${_BASE}/assets/videos/alec_poster.jpg`;
const TRIGGER    = 7.5;
const BAG_X      = 550;
const BAG_Y      = 560;

const SPARKS = [
  { id:1,  dx:  90, dy: -80,  delay:  0, size:6 },
  { id:2,  dx: 160, dy: -50,  delay: 80, size:4 },
  { id:3,  dx: 120, dy:-130,  delay: 40, size:5 },
  { id:4,  dx:  60, dy:-100,  delay:120, size:7 },
  { id:5,  dx: 200, dy: -70,  delay: 60, size:4 },
  { id:6,  dx: 140, dy:-160,  delay:150, size:5 },
  { id:7,  dx:  80, dy:-190,  delay: 30, size:6 },
  { id:8,  dx: 220, dy:-110,  delay: 90, size:4 },
  { id:9,  dx:  50, dy: -50,  delay:170, size:8 },
  { id:10, dx: 180, dy:-140,  delay: 20, size:5 },
];

export function GoldenWave() {
  const [videoStarted, setVideoStarted] = useState(false);
  const [formReady,    setFormReady]    = useState(false);
  const [wavePhase,    setWavePhase]    = useState(0);
  const [buildPhase,   setBuildPhase]   = useState(0);
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
    setVideoStarted(false); setFormReady(false); setWavePhase(0); setBuildPhase(0);
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

  // Wave phases
  useEffect(() => {
    if (!formReady) return;
    setWavePhase(1);
    const tDone = setTimeout(() => setWavePhase(2),  900);
    const t2    = setTimeout(() => setBuildPhase(1), 200);
    const t3    = setTimeout(() => setBuildPhase(2), 750);
    const t4    = setTimeout(() => setBuildPhase(3), 1200);
    const t5    = setTimeout(() => setBuildPhase(4), 1650);
    return () => { clearTimeout(tDone); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
  }, [formReady]);

  const sm = narrowPortrait || narrowLandscape;

  // Gradient
  const overlayGrad = narrowPortrait
    ? `linear-gradient(180deg,rgba(5,3,12,0) 0%,rgba(5,3,12,0) 30%,rgba(5,3,12,.6) 54%,rgba(5,3,12,.93) 70%,rgba(5,3,12,.97) 100%),
       linear-gradient(180deg,rgba(5,3,12,.25) 0%,transparent 12%)`
    : `linear-gradient(90deg,rgba(5,3,12,.08) 0%,rgba(5,3,12,.08) 38%,rgba(5,3,12,.68) 56%,rgba(5,3,12,.97) 73%,rgba(5,3,12,.99) 100%),
       linear-gradient(180deg,rgba(5,3,12,.4) 0%,transparent 18%,transparent 75%,rgba(5,3,12,.5) 100%)`;

  // Panel position
  const panelCommon: React.CSSProperties = {
    background:"rgba(10,8,4,.9)", border:"1px solid rgba(212,168,67,.28)", borderRadius:16,
    backdropFilter:"blur(18px)",
    boxShadow:"0 0 50px 10px rgba(212,168,67,.18),0 0 0 1px rgba(212,168,67,.2)",
    zIndex: 16,
  };
  const panelStyle: React.CSSProperties = narrowPortrait ? {
    position:"absolute", left:12, right:12, bottom:12,
    padding:"13px 14px 12px",
    clipPath: wavePhase === 0 ? "inset(100% 0 0 0 round 16px)" : undefined,
    ...panelCommon,
  } : narrowLandscape ? {
    position:"absolute", right:12, top:"50%", transform:"translateY(-50%)",
    width:`min(250px, ${Math.round(vw*0.46)}px)`,
    padding:"16px 16px 14px",
    clipPath: wavePhase === 0 ? "inset(0 100% 0 0 round 16px)" : undefined,
    ...panelCommon,
  } : {
    position:"absolute", right: isWide && vw<900 ? 20 : 77, top:"50%", transform:"translateY(-50%)",
    width: isWide && vw<900 ? `min(300px,${Math.round(vw*0.4)}px)` : 340,
    padding:"26px 22px 22px",
    clipPath: wavePhase === 0 ? "inset(0 100% 0 0 round 16px)" : undefined,
    ...panelCommon,
  };

  // Reveal animation class
  const revealClass = narrowPortrait
    ? (wavePhase >= 1 ? "gw-reveal-up" : "")   // reveal desde abajo en móvil portrait
    : (wavePhase >= 1 ? "gw-reveal" : "");      // reveal desde la derecha (left→right)

  // Wave sweep anim name
  const sweepAnim = isWide
    ? `gwSweep .9s cubic-bezier(.4,0,.6,1) forwards`
    : `gwSweepNarrow .9s cubic-bezier(.4,0,.6,1) forwards`;

  const labelSt: React.CSSProperties = {
    display:"block", fontSize:10, fontWeight:700,
    color:"rgba(200,168,75,.7)", textTransform:"uppercase",
    letterSpacing:"0.08em", marginBottom:5,
  };
  const inputSt: React.CSSProperties = {
    display:"block", width:"100%", boxSizing:"border-box",
    padding: sm ? "8px 11px" : "10px 13px",
    background:"rgba(255,255,255,.04)", border:"1px solid rgba(212,168,67,.28)",
    borderRadius:9, color:"rgba(255,255,255,.9)", fontSize:13,
    outline:"none", fontFamily:"inherit",
  };

  return (
    <div style={{ position:"fixed", inset:0, overflow:"hidden", background:"#05030c", fontFamily:"'Inter',system-ui,sans-serif" }}>
      <style>{`
        ${SPARKS.map(s => `
          @keyframes gwSpark${s.id}{
            0%{transform:translate(0,0) scale(1);opacity:1}
            100%{transform:translate(${s.dx}px,${s.dy}px) scale(0);opacity:0}
          }
        `).join("")}

        /* Sweep ancho: parte de BAG_X (bolsa visible en pantalla) */
        @keyframes gwSweep{
          0%  {left:${BAG_X}px;width:0;opacity:1}
          20% {left:${BAG_X}px;width:60px;opacity:1}
          80% {left:${BAG_X + 580}px;width:60px;opacity:1}
          100%{left:100vw;width:0;opacity:0}
        }
        /* Sweep estrecho: parte de 0 (bolsa fuera de pantalla) */
        @keyframes gwSweepNarrow{
          0%  {left:0;width:0;opacity:1}
          20% {left:0;width:40px;opacity:1}
          80% {left:calc(100vw - 40px);width:40px;opacity:1}
          100%{left:100vw;width:0;opacity:0}
        }

        /* Reveal clip-path horizontal (wide/landscape): de derecha a izquierda */
        @keyframes gwReveal{
          0%  {clip-path:inset(0 100% 0 0 round 16px);opacity:1}
          100%{clip-path:inset(0 0% 0 0 round 16px);opacity:1}
        }
        /* Reveal clip-path vertical (portrait): de abajo a arriba */
        @keyframes gwRevealUp{
          0%  {clip-path:inset(100% 0 0 0 round 16px);opacity:1}
          100%{clip-path:inset(0% 0 0 0 round 16px);opacity:1}
        }
        .gw-reveal   {animation:gwReveal   .85s cubic-bezier(.4,0,.2,1) forwards}
        .gw-reveal-up{animation:gwRevealUp .85s cubic-bezier(.4,0,.2,1) forwards}

        @keyframes gwGlow{0%{transform:scale(.1);opacity:0}25%{transform:scale(1.6);opacity:1}100%{transform:scale(3.8);opacity:0}}
        @keyframes gwField{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes gwBlink{0%,49%{opacity:1}50%,100%{opacity:0}}
        @keyframes gwBob{0%,100%{transform:translateY(0);opacity:.35}50%{transform:translateY(-6px);opacity:.8}}
        @keyframes playPulse{0%,100%{box-shadow:0 0 30px rgba(212,168,67,.5),0 0 60px rgba(212,168,67,.25)}50%{box-shadow:0 0 50px rgba(212,168,67,.8),0 0 100px rgba(212,168,67,.45)}}
        .gw-cursor{display:inline-block;width:2px;height:.85em;background:#d4a843;vertical-align:text-bottom;margin-left:3px;animation:gwBlink .7s step-end infinite}
        .gw-field{animation:gwField .45s cubic-bezier(.22,1,.36,1) forwards;opacity:0}
        .play-btn:hover{transform:scale(1.08)!important}
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
          <img src={POSTER_SRC} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", objectPosition:"left center" }} />
          <div style={{ position:"absolute", inset:0, background:"rgba(5,3,12,.68)" }} />
          <div style={{ position:"relative", textAlign:"center", padding:"0 20px" }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.2em", color:"rgba(212,168,67,.7)", textTransform:"uppercase", marginBottom:20 }}>
              VARIACIÓN ④ · OLA DORADA
            </div>
            <div className="play-btn" style={{ width:84, height:84, borderRadius:"50%",
              background:"linear-gradient(135deg,#d4a843,#e6c668)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:32, margin:"0 auto 22px",
              animation:"playPulse 2s ease-in-out infinite",
              transition:"transform .15s", color:"#0a0800", paddingLeft:6 }}>▶</div>
            <div style={{ fontSize:18, fontWeight:800, color:"#fff", marginBottom:8 }}>Pulsa para ver la animación</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,.45)", lineHeight:1.5 }}>
              Ola dorada barre de izquierda a derecha · revela formulario vía clip-path · t=7.5s
            </div>
          </div>
        </div>
      )}

      {/* Glow + chispas — SOLO en pantallas anchas */}
      {formReady && isWide && (
        <>
          <div style={{ position:"absolute", left:BAG_X, top:BAG_Y, width:100, height:100,
            marginLeft:-50, marginTop:-50, borderRadius:"50%",
            background:"radial-gradient(circle,rgba(212,168,67,.95) 0%,rgba(212,168,67,.4) 35%,transparent 70%)",
            animation:"gwGlow .85s ease-out forwards", zIndex:13, pointerEvents:"none" }} />
          {SPARKS.map(s => (
            <div key={s.id} style={{ position:"absolute", left:BAG_X, top:BAG_Y,
              width:s.size, height:s.size, borderRadius:"50%", background:"#d4a843",
              boxShadow:`0 0 ${s.size*2}px rgba(212,168,67,.8)`,
              animation:`gwSpark${s.id} 1.0s cubic-bezier(.25,.46,.45,.94) ${s.delay}ms both`,
              zIndex:14, pointerEvents:"none" }} />
          ))}
        </>
      )}

      {/* Wave sweep bar */}
      {wavePhase === 1 && (
        <div style={{
          position:"absolute", top:0, bottom:0, zIndex:18, pointerEvents:"none",
          background:"linear-gradient(90deg,transparent 0%,rgba(212,168,67,.12) 20%,rgba(212,168,67,.55) 50%,rgba(255,220,100,.85) 72%,rgba(212,168,67,.45) 85%,transparent 100%)",
          animation: sweepAnim,
        }} />
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
          <span style={{ fontSize:22, animation:"gwBob 2.2s ease-in-out infinite" }}>✨</span>
          <span>Espera a que los billetes empiecen a salir...</span>
        </div>
      )}

      {/* ── FORMULARIO ── */}
      {formReady && (
        <div
          key={`${narrowPortrait}-${narrowLandscape}`}
          className={revealClass}
          style={panelStyle}
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
            tu negocio.<span className="gw-cursor" />
          </h2>

          {buildPhase >= 2 && (
            <>
              <div className="gw-field" style={{ marginBottom:9 }}>
                <label style={labelSt}>Nombre</label>
                <input style={inputSt} readOnly placeholder="Tu nombre..." />
              </div>
              <div className="gw-field" style={{ marginBottom:9, animationDelay:"100ms" }}>
                <label style={labelSt}>Email</label>
                <input style={inputSt} readOnly placeholder="tu@tienda.com" />
              </div>
            </>
          )}
          {buildPhase >= 3 && !narrowPortrait && (
            <div className="gw-field" style={{ marginBottom:9 }}>
              <label style={labelSt}>Teléfono</label>
              <input style={inputSt} readOnly placeholder="+34 600 000 000" />
            </div>
          )}
          {buildPhase >= 4 && (
            <div className="gw-field">
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
          <span style={{ color:"#d4a843", fontWeight:700 }}>④ Ola dorada</span>
          {" · "}clip-path sweep · t=7.5s
          <button onClick={() => setReplay(r => r + 1)} style={{ marginLeft:10, padding:"3px 10px", borderRadius:10,
            fontSize:11, background:"rgba(212,168,67,.15)", color:"#d4a843",
            border:"1px solid rgba(212,168,67,.3)", cursor:"pointer" }}>⟳</button>
        </div>
      </div>
    </div>
  );
}
