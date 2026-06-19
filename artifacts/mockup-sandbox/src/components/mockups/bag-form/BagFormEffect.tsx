/**
 * ② BagFormEffect v2 — Genio de la bolsa
 *
 * Cambios:
 * - Formulario aparece YA CONSTRUIDO (sin fases step-by-step)
 * - Animación: muelle comprimido desde la bolsa → se expande en vuelo
 * - Totalmente responsivo: desktop/tablet → panel derecho
 *   móvil portrait → panel inferior · móvil landscape → panel derecho compacto
 * - Replay vía onEnded (ya no hay timer fijo desde mount)
 * - Último frame del vídeo queda congelado
 */
import { useState, useEffect, useRef } from "react";

const VID_SRC    = "/assets/videos/alec_landing.mp4";
const POSTER_SRC = "/assets/videos/alec_poster.jpg";
const TRIGGER    = 8.0;

// Posición de la bolsa en viewport 1280×800 (solo usada en pantallas anchas ≥700px)
const BAG_X = 550;
const BAG_Y = 560;

const PUFFS = [
  { id:1,  dx:  30, dy:-180, sx:1.8, delay:  0, size:48, op:.55 },
  { id:2,  dx: -50, dy:-220, sx:2.2, delay: 80, size:38, op:.45 },
  { id:3,  dx:  80, dy:-160, sx:1.5, delay:130, size:55, op:.40 },
  { id:4,  dx: -20, dy:-260, sx:2.6, delay: 50, size:30, op:.50 },
  { id:5,  dx:  60, dy:-300, sx:3.0, delay:170, size:22, op:.35 },
  { id:6,  dx: -70, dy:-140, sx:1.4, delay:220, size:42, op:.38 },
];
const BILLS = [
  { id:1, dx: 200, dy: -80, rot:  25, delay:  0 },
  { id:2, dx: 130, dy:  90, rot: -18, delay: 70 },
  { id:3, dx: -70, dy:-120, rot:  40, delay:140 },
  { id:4, dx: 260, dy: -40, rot: -30, delay: 55 },
  { id:5, dx: 100, dy: 140, rot:  16, delay:220 },
];

export function BagFormEffect() {
  const [videoStarted, setVideoStarted] = useState(false);
  const [formReady,    setFormReady]    = useState(false);
  const [replay,       setReplay]       = useState(0);

  // Viewport reactivo (también escucha orientationchange)
  const [vw, setVw] = useState(() => window.innerWidth);
  const [vh, setVh] = useState(() => window.innerHeight);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const h = () => { setVw(window.innerWidth); setVh(window.innerHeight); };
    window.addEventListener("resize", h);
    window.addEventListener("orientationchange", h);
    return () => { window.removeEventListener("resize", h); window.removeEventListener("orientationchange", h); };
  }, []);

  // Layout derivado
  const isWide     = vw >= 700;            // bolsa visible en pantalla
  const isPortrait = vh > vw;              // orientación retrato
  const narrowPortrait  = !isWide && isPortrait;
  const narrowLandscape = !isWide && !isPortrait;

  // ── Mount / replay ────────────────────────────────────────────────────────
  useEffect(() => {
    setVideoStarted(false);
    setFormReady(false);
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

  // ── Trigger formulario ─────────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const fn = () => { if (v.currentTime >= TRIGGER && !formReady) setFormReady(true); };
    v.addEventListener("timeupdate", fn);
    return () => v.removeEventListener("timeupdate", fn);
  }, [formReady, replay]);

  // ── Congelar último frame + replay tras 3.5s ─────────────────────────────
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

  // ── Gradiente overlay ─────────────────────────────────────────────────────
  const overlayGrad = narrowPortrait
    ? `linear-gradient(180deg,
        rgba(5,3,12,0) 0%,rgba(5,3,12,0) 32%,
        rgba(5,3,12,.62) 55%,rgba(5,3,12,.93) 72%,rgba(5,3,12,.97) 100%),
       linear-gradient(180deg,rgba(5,3,12,.3) 0%,transparent 14%)`
    : `linear-gradient(90deg,
        rgba(5,3,12,.08) 0%,rgba(5,3,12,.08) 38%,
        rgba(5,3,12,.68) 56%,rgba(5,3,12,.97) 73%,rgba(5,3,12,.99) 100%),
       linear-gradient(180deg,rgba(5,3,12,.4) 0%,transparent 18%,transparent 75%,rgba(5,3,12,.5) 100%)`;

  // ── Posición y dimensiones del panel ──────────────────────────────────────
  const panelCommon: React.CSSProperties = {
    background:    "rgba(8,6,2,.93)",
    border:        "1px solid rgba(212,168,67,.3)",
    borderRadius:  16,
    backdropFilter:"blur(22px)",
    boxShadow:     "0 0 0 1px rgba(212,168,67,.18),0 0 60px 12px rgba(212,168,67,.22),0 28px 64px rgba(0,0,0,.65)",
    zIndex: 20,
  };
  const panelStyle: React.CSSProperties = narrowPortrait ? {
    position: "absolute", left: 12, right: 12, bottom: 12,
    padding: "14px 14px 12px",
    ...panelCommon,
  } : narrowLandscape ? {
    position: "absolute", right: 10, top: "50%",
    width: `min(250px, ${Math.round(vw * 0.46)}px)`,
    padding: "16px 16px 14px",
    ...panelCommon,
  } : {
    position: "absolute", right: isWide && vw < 900 ? 20 : 77, top: "50%",
    width: isWide && vw < 900 ? `min(300px, ${Math.round(vw * 0.4)}px)` : 340,
    padding: "26px 22px 22px",
    ...panelCommon,
  };

  // ── Clase de animación ────────────────────────────────────────────────────
  const animClass = narrowPortrait
    ? "bf-dc-mobile"
    : narrowLandscape
      ? "bf-dc-land"
      : "bf-dc-wide";

  const sm = narrowPortrait || narrowLandscape;

  const labelSt: React.CSSProperties = {
    display:"block", fontSize:10, fontWeight:700,
    color:"rgba(200,168,75,.72)", textTransform:"uppercase",
    letterSpacing:"0.08em", marginBottom:5,
  };
  const inputSt: React.CSSProperties = {
    display:"block", width:"100%", boxSizing:"border-box",
    padding: sm ? "8px 11px" : "11px 14px",
    background:"rgba(255,255,255,.04)",
    border:"1px solid rgba(255,255,255,.12)", borderRadius:9,
    color:"rgba(255,255,255,.93)", fontSize: sm ? 13 : 14,
    outline:"none", fontFamily:"inherit",
  };

  return (
    <div style={{ width:"100vw", height:"100vh", overflow:"hidden", position:"relative", background:"#05030c", fontFamily:"'Inter',system-ui,sans-serif" }}>
      <style>{`
        @keyframes bfPlayPulse{0%,100%{box-shadow:0 0 30px rgba(212,168,67,.5),0 0 60px rgba(212,168,67,.25)}50%{box-shadow:0 0 55px rgba(212,168,67,.85),0 0 110px rgba(212,168,67,.5)}}
        @keyframes bfBurst{0%{transform:scale(.08);opacity:0}18%{transform:scale(1.2);opacity:1}55%{transform:scale(2.2);opacity:.6}100%{transform:scale(3.8);opacity:0}}
        ${PUFFS.map(p=>`@keyframes bfPuff${p.id}{0%{transform:translate(0,0) scale(.15);opacity:0}15%{opacity:${p.op}}70%{opacity:${p.op*.4}}100%{transform:translate(${p.dx}px,${p.dy}px) scale(${p.sx});opacity:0}}`).join("")}
        ${BILLS.map(b=>`@keyframes bfBill${b.id}{0%{transform:translate(0,0) rotate(0deg) scale(1);opacity:.9}100%{transform:translate(${b.dx}px,${b.dy}px) rotate(${b.rot}deg) scale(.5);opacity:0}}`).join("")}

        /* ── Desktop/tablet wide (≥700px):
           El form sale de la bolsa COMPRIMIDO como un muelle, se
           DESCOMPRIME mientras vuela a su posición final ──────────── */
        @keyframes bfDcWide{
          0%  { transform:translateY(calc(-50% + 160px)) translateX(-483px)
                           scaleX(.04) scaleY(2.1);
                opacity:0; filter:blur(15px) brightness(6); border-radius:50% }
          10% { opacity:1; filter:blur(8px) brightness(3.2); border-radius:45% }
          28% { transform:translateY(calc(-50% + 85px)) translateX(-308px)
                           scaleX(.20) scaleY(1.58);
                filter:blur(3.5px) brightness(1.8); border-radius:28% }
          50% { transform:translateY(calc(-50% + 18px)) translateX(-115px)
                           scaleX(.62) scaleY(1.09);
                filter:blur(.8px) brightness(1.12); border-radius:20px }
          67% { transform:translateY(calc(-50% - 11px)) translateX(-3px)
                           scaleX(1.11) scaleY(.93);
                filter:blur(0) brightness(1.04); border-radius:16px }
          80% { transform:translateY(calc(-50% + 6px)) translateX(2px)
                           scaleX(.965) scaleY(1.028) }
          91% { transform:translateY(calc(-50% - 2.5px)) translateX(-1px)
                           scaleX(1.012) scaleY(.993) }
          100%{ transform:translateY(-50%) translateX(0) scaleX(1) scaleY(1);
                opacity:1; filter:blur(0) brightness(1); border-radius:16px }
        }
        .bf-dc-wide { animation:bfDcWide 1.78s cubic-bezier(.22,1,.36,1) forwards }

        /* ── Móvil portrait: sube desde abajo comprimido, se expande ── */
        @keyframes bfDcMobile{
          0%  { transform:translateY(130px) scaleX(.04) scaleY(2.0);
                opacity:0; filter:blur(12px) brightness(5) }
          12% { opacity:1; filter:blur(6px) brightness(2.8) }
          33% { transform:translateY(32px) scaleX(.26) scaleY(1.52);
                filter:blur(2px) brightness(1.55) }
          56% { transform:translateY(-7px) scaleX(.84) scaleY(1.04);
                filter:blur(0) brightness(1.1) }
          72% { transform:translateY(4px) scaleX(1.07) scaleY(.955) }
          85% { transform:translateY(-2px) scaleX(.978) scaleY(1.013) }
          100%{ transform:translateY(0) scaleX(1) scaleY(1);
                opacity:1; filter:blur(0) }
        }
        .bf-dc-mobile { animation:bfDcMobile 1.52s cubic-bezier(.22,1,.36,1) forwards }

        /* ── Móvil landscape: aparece comprimido desde la izquierda ── */
        @keyframes bfDcLand{
          0%  { transform:translateY(-50%) translateX(-80px)
                           scaleX(.04) scaleY(1.9);
                opacity:0; filter:blur(11px) brightness(4.5) }
          12% { opacity:1; filter:blur(5px) brightness(2.5) }
          38% { transform:translateY(-50%) translateX(-18px)
                           scaleX(.42) scaleY(1.16);
                filter:blur(1px) brightness(1.2) }
          60% { transform:translateY(-50%) translateX(5px)
                           scaleX(1.07) scaleY(.955);
                filter:blur(0) }
          76% { transform:translateY(-50%) translateX(-2px) scaleX(.97) scaleY(1.02) }
          90% { transform:translateY(-50%) translateX(1px) scaleX(1.01) scaleY(.99) }
          100%{ transform:translateY(-50%) translateX(0) scaleX(1) scaleY(1);
                opacity:1; filter:blur(0) }
        }
        .bf-dc-land { animation:bfDcLand 1.5s cubic-bezier(.22,1,.36,1) forwards }

        @keyframes bfPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.7)}}
        @keyframes bfBob{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(-6px);opacity:.8}}
        .bf-play-btn:hover{transform:scale(1.09)!important}
      `}</style>

      {/* VIDEO */}
      <video key={replay} ref={videoRef} muted playsInline preload="auto"
        src={VID_SRC} poster={POSTER_SRC}
        style={{ position:"absolute", inset:0, width:"100%", height:"100%",
          objectFit:"cover", objectPosition:"left center", zIndex:1 }}
      />

      {/* Gradient overlay */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:2, background:overlayGrad }} />

      {/* PLAY OVERLAY */}
      {!videoStarted && (
        <div onClick={startPlay} style={{ position:"absolute", inset:0, zIndex:40, cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          <img src={POSTER_SRC} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%",
            objectFit:"cover", objectPosition:"left center" }} />
          <div style={{ position:"absolute", inset:0, background:"rgba(5,3,12,.72)" }} />
          <div style={{ position:"relative", textAlign:"center", padding:"0 24px" }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.22em", color:"rgba(212,168,67,.72)",
              textTransform:"uppercase", marginBottom:20 }}>VARIACIÓN ② · EL GENIO DE LA BOLSA</div>
            <div className="bf-play-btn" style={{ width:84, height:84, borderRadius:"50%",
              background:"linear-gradient(135deg,#d4a843,#e6c668)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:32, margin:"0 auto 22px",
              animation:"bfPlayPulse 2.2s ease-in-out infinite",
              transition:"transform .15s", color:"#0a0800", paddingLeft:6,
              boxShadow:"0 4px 32px rgba(212,168,67,.4)" }}>▶</div>
            <div style={{ fontSize:18, fontWeight:800, color:"#fff", marginBottom:9 }}>
              Pulsa para ver la animación
            </div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,.46)", lineHeight:1.6 }}>
              El form sale de la bolsa comprimido como un muelle<br />y se expande en vuelo · t=8.0s
            </div>
          </div>
        </div>
      )}

      {/* Efectos de la bolsa — SOLO en pantallas anchas donde la bolsa es visible */}
      {formReady && isWide && (
        <>
          <div style={{ position:"absolute", left:BAG_X, top:BAG_Y, width:100, height:100,
            marginLeft:-50, marginTop:-50, borderRadius:"50%", pointerEvents:"none", zIndex:12,
            background:"radial-gradient(circle,rgba(255,230,120,1) 0%,rgba(212,168,67,.7) 30%,transparent 72%)",
            animation:"bfBurst .9s cubic-bezier(.25,.46,.45,.94) forwards" }} />
          {PUFFS.map(p => (
            <div key={p.id} style={{ position:"absolute", left:BAG_X-p.size/2, top:BAG_Y-p.size/2,
              width:p.size, height:p.size, borderRadius:"50%", pointerEvents:"none", zIndex:13,
              background:"radial-gradient(circle,rgba(255,230,150,.7) 0%,rgba(212,168,67,.3) 55%,transparent 80%)",
              animation:`bfPuff${p.id} 1.4s cubic-bezier(.25,.46,.45,.94) ${p.delay}ms both` }} />
          ))}
          {BILLS.map(b => (
            <div key={b.id} style={{ position:"absolute", left:BAG_X-26, top:BAG_Y-12,
              width:52, height:24, zIndex:14, pointerEvents:"none",
              background:"linear-gradient(135deg,#1e5c1e,#3a9a3a)",
              border:"1.5px solid rgba(255,255,255,.25)", borderRadius:3,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:9, fontWeight:800, color:"rgba(0,60,0,.9)",
              boxShadow:"0 2px 10px rgba(0,0,0,.55)",
              animation:`bfBill${b.id} 1.35s cubic-bezier(.25,.46,.45,.94) ${b.delay}ms both` }}>€ 100</div>
          ))}
        </>
      )}

      {/* Hint mientras espera */}
      {videoStarted && !formReady && (
        <div style={{
          position:"absolute",
          ...(narrowPortrait
            ? { bottom:24, left:0, right:0, textAlign:"center", alignItems:"center" }
            : { bottom:70, right: isWide ? 130 : 16, textAlign:"right", alignItems:"flex-end" }),
          color:"rgba(200,168,75,.4)", zIndex:10, pointerEvents:"none",
          display:"flex", flexDirection:"column", gap:7,
        }}>
          <span style={{ fontSize:24, animation:"bfBob 2.2s ease-in-out infinite" }}>👜</span>
          <p style={{ margin:0, fontSize:11.5, fontStyle:"italic", lineHeight:1.55 }}>
            Observa cómo Alec<br />vuelca la bolsa…
          </p>
        </div>
      )}

      {/* ── FORMULARIO — aparece COMPLETO con animación de descompresión ── */}
      {formReady && (
        <div
          key={`${narrowPortrait}-${narrowLandscape}`}
          className={animClass}
          style={panelStyle}
        >
          {/* Badge */}
          <div style={{ display:"inline-flex", alignItems:"center", gap:6,
            fontSize:10, fontWeight:700, letterSpacing:"0.18em",
            color:"#d4a843", textTransform:"uppercase",
            background:"rgba(212,168,67,.08)", border:"1px solid rgba(212,168,67,.22)",
            padding:"4px 11px", borderRadius:20, marginBottom: sm ? 10 : 14 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#d4a843", display:"block",
              animation:"bfPulse 1.8s ease-in-out infinite" }} />
            Trabaja con nosotros
          </div>

          {/* Cabecera */}
          <div style={{ marginBottom: sm ? 10 : 14 }}>
            <h3 style={{ margin:"0 0 3px", fontSize: sm ? 15 : 17, fontWeight:800, color:"rgba(255,255,255,.95)" }}>
              Datos de contacto
            </h3>
            <p style={{ margin:0, fontSize:11, color:"rgba(200,168,75,.55)", fontStyle:"italic" }}>
              Solo 2 min · análisis gratis
            </p>
          </div>

          {/* Nombre + Email */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9, marginBottom:9 }}>
            <div>
              <label style={labelSt}>Nombre *</label>
              <input style={inputSt} type="text" placeholder="Tu nombre" readOnly />
            </div>
            <div>
              <label style={labelSt}>Email *</label>
              <input style={inputSt} type="email" placeholder="tu@email.com" readOnly />
            </div>
          </div>

          {/* Teléfono */}
          {!narrowPortrait && (
            <div style={{ marginBottom:9 }}>
              <label style={labelSt}>Teléfono</label>
              <input style={inputSt} type="tel" placeholder="+34 600 000 000" readOnly />
            </div>
          )}

          {/* CTA */}
          <button style={{ width:"100%", padding: sm ? "10px 16px" : "13px 20px",
            borderRadius:11, fontSize: sm ? 13 : 14, fontWeight:800,
            background:"linear-gradient(135deg,#d4a843,#e6c668)",
            color:"#0a0800", border:"none", cursor:"pointer", letterSpacing:".03em" }}>
            Analiza mi tienda gratis →
          </button>

          {/* Dots */}
          <div style={{ display:"flex", justifyContent:"center", gap:7, marginTop: sm ? 10 : 14 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ height:7, borderRadius:4, width:i===0?22:7,
                background:i===0?"#d4a843":"rgba(255,255,255,.12)" }} />
            ))}
          </div>
        </div>
      )}

      {/* Label */}
      <div style={{ position:"absolute", top:14, left:0, right:0, textAlign:"center", zIndex:50 }}>
        <div style={{ display:"inline-block", background:"rgba(0,0,0,.65)", backdropFilter:"blur(10px)",
          border:"1px solid rgba(212,168,67,.25)", borderRadius:24, padding:"6px 15px",
          fontSize:11, color:"rgba(255,255,255,.5)", maxWidth:"calc(100% - 28px)" }}>
          <span style={{ color:"#d4a843", fontWeight:700 }}>② Genio de la bolsa</span>
          {" · "}{isWide ? "form comprimido desde bolsa" : "form desde abajo"}{" · t=8.0s"}
          <button onClick={() => setReplay(r => r+1)} style={{ marginLeft:10, padding:"3px 10px", borderRadius:10,
            fontSize:11, background:"rgba(212,168,67,.15)", color:"#d4a843",
            border:"1px solid rgba(212,168,67,.3)", cursor:"pointer" }}>⟳</button>
        </div>
      </div>
    </div>
  );
}
