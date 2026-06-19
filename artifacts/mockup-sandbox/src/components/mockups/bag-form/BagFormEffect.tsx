/**
 * ② BagFormEffect — Layout idéntico a VismeFormHero (video fondo completo)
 * Efecto: "genio de la lámpara" — el form materializa desde la bolsa en t=8.0s
 * URL del video: producción /assets/videos/alec_landing.mp4
 *
 * Bag position en 1280×800: x≈550, y≈560
 * Form final center: x≈1033 (right 77+170), y≈400 (50%)
 * Delta genie origin: dx=-483, dy=+160
 */
import { useState, useEffect, useRef } from "react";

// ── URL del video de producción ────────────────────────────────────────────────
const VID_SRC    = "/assets/videos/alec_landing.mp4";
const POSTER_SRC = "/assets/videos/alec_poster.jpg";
const TRIGGER    = 8.0;   // segundos — bolsa empieza a verterse

// Bag screen coords en viewport 1280×800
const BAG_X = 550;
const BAG_Y = 560;

// Smoke puffs que salen de la bolsa
const PUFFS = [
  { id:1,  dx:  30, dy:-180, sx:1.8, delay:  0, size:48, op:.55 },
  { id:2,  dx: -50, dy:-220, sx:2.2, delay: 80, size:38, op:.45 },
  { id:3,  dx:  80, dy:-160, sx:1.5, delay:130, size:55, op:.40 },
  { id:4,  dx: -20, dy:-260, sx:2.6, delay: 50, size:30, op:.50 },
  { id:5,  dx:  60, dy:-300, sx:3.0, delay:170, size:22, op:.35 },
  { id:6,  dx: -70, dy:-140, sx:1.4, delay:220, size:42, op:.38 },
  { id:7,  dx:  10, dy:-350, sx:3.5, delay: 90, size:18, op:.30 },
  { id:8,  dx: -40, dy:-200, sx:2.0, delay:155, size:34, op:.42 },
  { id:9,  dx:  45, dy:-240, sx:2.4, delay: 35, size:28, op:.48 },
  { id:10, dx: -15, dy:-320, sx:2.8, delay:200, size:15, op:.28 },
];

// Billetes €100 saliendo de la bolsa
const BILLS = [
  { id:1,  dx: 200, dy:-80,  rot: 25, delay:  0 },
  { id:2,  dx: 130, dy: 90,  rot:-18, delay: 70 },
  { id:3,  dx: -70, dy:-120, rot: 40, delay:140 },
  { id:4,  dx: 260, dy:-40,  rot:-30, delay: 55 },
  { id:5,  dx: 100, dy: 140, rot: 16, delay:220 },
  { id:6,  dx: -50, dy: 100, rot:-52, delay:110 },
  { id:7,  dx: 170, dy:-160, rot: 58, delay:180 },
  { id:8,  dx:  55, dy:-190, rot:-14, delay: 90 },
];

export function BagFormEffect() {
  const [videoStarted, setVideoStarted] = useState(false);
  const [formReady,    setFormReady]    = useState(false);
  const [buildPhase,   setBuildPhase]   = useState(0);
  const [replay,       setReplay]       = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // ── Mount / replay ───────────────────────────────────────────────────────────
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

  // ── Trigger form ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const fn = () => { if (v.currentTime >= TRIGGER && !formReady) setFormReady(true); };
    v.addEventListener("timeupdate", fn);
    return () => v.removeEventListener("timeupdate", fn);
  }, [formReady, replay]);

  // ── Freeze last frame ────────────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const fn = () => { try { v.currentTime = Math.max(0, v.duration - 0.05); } catch {} };
    v.addEventListener("ended", fn);
    return () => v.removeEventListener("ended", fn);
  }, []);

  // ── Build phases ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!formReady) return;
    setBuildPhase(1);
    const t2 = setTimeout(() => setBuildPhase(2), 1200);
    const t3 = setTimeout(() => setBuildPhase(3), 1900);
    const t4 = setTimeout(() => setBuildPhase(4), 2600);
    const t5 = setTimeout(() => setBuildPhase(5), 3100);
    return () => { clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
  }, [formReady]);

  // ── Auto-replay ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setReplay(r => r + 1), 15500);
    return () => clearTimeout(t);
  }, [replay]);

  // ── Shared input style ───────────────────────────────────────────────────────
  const inputSt: React.CSSProperties = {
    display: "block", width: "100%", boxSizing: "border-box" as const,
    padding: "11px 14px", background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.12)", borderRadius: 10,
    color: "rgba(255,255,255,.93)", fontSize: 14, outline: "none",
    fontFamily: "inherit", transition: "border-color .2s, box-shadow .2s",
  };
  const labelSt: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 700,
    color: "rgba(200,168,75,0.72)", textTransform: "uppercase" as const,
    letterSpacing: "0.08em", marginBottom: 7,
  };

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative", background: "#05030c", fontFamily: "'Inter',system-ui,sans-serif" }}>
      <style>{`
        /* ── Play overlay ──────────────────────────────── */
        @keyframes bfPlayPulse {
          0%,100%{box-shadow:0 0 30px rgba(212,168,67,.5),0 0 60px rgba(212,168,67,.25)}
          50%{box-shadow:0 0 55px rgba(212,168,67,.85),0 0 110px rgba(212,168,67,.5)}
        }
        /* ── Bag glow burst ──────────────────────────── */
        @keyframes bfBurst {
          0%  {transform:scale(.08);opacity:0}
          18% {transform:scale(1.2);opacity:1}
          55% {transform:scale(2.2);opacity:.6}
          100%{transform:scale(3.8);opacity:0}
        }
        /* ── Smoke puffs ─────────────────────────────── */
        ${PUFFS.map(p => `
          @keyframes bfPuff${p.id} {
            0%  {transform:translate(0,0) scale(.15);opacity:0}
            15% {opacity:${p.op}}
            70% {opacity:${p.op * .4}}
            100%{transform:translate(${p.dx}px,${p.dy}px) scale(${p.sx});opacity:0}
          }
        `).join("")}
        /* ── Billete float ───────────────────────────── */
        ${BILLS.map(b => `
          @keyframes bfBill${b.id} {
            0%  {transform:translate(0,0) rotate(0deg) scale(1);opacity:.9}
            100%{transform:translate(${b.dx}px,${b.dy}px) rotate(${b.rot}deg) scale(.5);opacity:0}
          }
        `).join("")}
        /* ── Genie rise (form card) ───────────────────
         *  Empieza en la bolsa (dx=-483,dy=+160 relativo al centro del form)
         *  y se asienta en su posición final con spring
         * ────────────────────────────────────────────*/
        @keyframes bfGenieRise {
          0%   {
            transform: translateY(calc(-50% + 160px)) translateX(-483px)
                       scale(0.02) rotate(280deg);
            opacity:0; filter:blur(20px) brightness(5); border-radius:50%;
          }
          8%   {
            opacity:1;
            transform: translateY(calc(-50% + 230px)) translateX(-455px)
                       scale(0.07) rotate(190deg);
            filter:blur(10px) brightness(3); border-radius:50%;
          }
          22%  {
            transform: translateY(calc(-50% + 130px)) translateX(-370px)
                       scale(0.20) rotate(70deg);
            filter:blur(5px) brightness(1.9); border-radius:42%;
          }
          40%  {
            transform: translateY(calc(-50% + 30px)) translateX(-200px)
                       scale(0.52) rotate(8deg);
            filter:blur(2px) brightness(1.35); border-radius:26px;
          }
          58%  {
            transform: translateY(calc(-50% - 28px)) translateX(-38px)
                       scale(0.86) rotate(-4deg);
            filter:blur(0) brightness(1.1); border-radius:20px;
          }
          74%  {
            transform: translateY(calc(-50% + 14px)) translateX(7px)
                       scale(1.075) rotate(1.5deg);
            border-radius:16px; filter:blur(0) brightness(1.02);
          }
          87%  {
            transform: translateY(calc(-50% - 6px)) translateX(-3px)
                       scale(0.978) rotate(-.6deg);
          }
          100% {
            transform: translateY(-50%) translateX(0) scale(1) rotate(0deg);
            opacity:1; filter:blur(0) brightness(1); border-radius:16px;
          }
        }
        /* ── Form phases ─────────────────────────────── */
        @keyframes bfSlideIn {
          from{opacity:0;transform:translateX(28px)} to{opacity:1;transform:translateX(0)}
        }
        @keyframes bfRiseIn {
          from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)}
        }
        @keyframes bfSpringIn {
          0%{opacity:0;transform:translateY(10px) scale(.96)}
          60%{opacity:1;transform:translateY(-2px) scale(1.02)}
          100%{opacity:1;transform:translateY(0) scale(1)}
        }
        @keyframes bfInputGlow {
          0%  {box-shadow:0 0 0 0 rgba(212,168,67,0);border-color:rgba(255,255,255,.12)}
          30% {box-shadow:0 0 0 5px rgba(212,168,67,.2);border-color:rgba(212,168,67,.8)}
          100%{box-shadow:0 0 0 2px rgba(212,168,67,.07);border-color:rgba(212,168,67,.38)}
        }
        @keyframes bfPulse {
          0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.7)}
        }
        @keyframes bfBob {
          0%,100%{transform:translateY(0);opacity:.4} 50%{transform:translateY(-6px);opacity:.8}
        }
        @keyframes bfCursor {
          0%,49%{opacity:1} 50%,100%{opacity:0}
        }
        .bf-genie    { animation: bfGenieRise 1.55s cubic-bezier(.34,1.28,.64,1) forwards; }
        .bf-slide-in { animation: bfSlideIn .6s cubic-bezier(.22,1,.36,1) forwards; }
        .bf-rise-in  { animation: bfRiseIn  .5s cubic-bezier(.22,1,.36,1) forwards; }
        .bf-spring-in{ animation: bfSpringIn .65s cubic-bezier(.34,1.56,.64,1) forwards; }
        .bf-glow     { animation: bfInputGlow .9s cubic-bezier(.22,1,.36,1) forwards; }
        .bf-cursor   {
          display:inline-block;width:2px;height:.85em;
          background:#d4a843;vertical-align:text-bottom;margin-left:3px;
          animation:bfCursor .7s step-end infinite;
        }
        .bf-input:focus {
          border-color:rgba(212,168,67,.5)!important;
          box-shadow:0 0 0 3px rgba(212,168,67,.09)!important;
        }
        .bf-play-btn:hover { transform:scale(1.09)!important; }
      `}</style>

      {/* ── VIDEO — fondo completo idéntico a VismeFormHero ────────────────── */}
      <video
        key={replay}
        ref={videoRef}
        muted
        playsInline
        preload="auto"
        src={VID_SRC}
        poster={POSTER_SRC}
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover", objectPosition: "left center",
          zIndex: 1,
        }}
      />

      {/* ── Gradiente idéntico a VismeFormHero ─────────────────────────────── */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2,
        background: `
          linear-gradient(90deg,
            rgba(5,3,12,.08) 0%,
            rgba(5,3,12,.08) 38%,
            rgba(5,3,12,.68) 56%,
            rgba(5,3,12,.97) 73%,
            rgba(5,3,12,.99) 100%
          ),
          linear-gradient(180deg,
            rgba(5,3,12,.4) 0%,
            transparent 18%,
            transparent 75%,
            rgba(5,3,12,.5) 100%
          )`,
      }} />

      {/* ── PLAY OVERLAY ───────────────────────────────────────────────────── */}
      {!videoStarted && (
        <div
          onClick={startPlay}
          style={{
            position: "absolute", inset: 0, zIndex: 40, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <img
            src={POSTER_SRC}
            alt=""
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover", objectPosition: "left center",
            }}
          />
          <div style={{ position: "absolute", inset: 0, background: "rgba(5,3,12,.72)" }} />
          <div style={{ position: "relative", textAlign: "center", padding: "0 24px" }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.22em",
              color: "rgba(212,168,67,.72)", textTransform: "uppercase", marginBottom: 22,
            }}>
              VARIACIÓN ② · EL GENIO DE LA BOLSA
            </div>
            <div
              className="bf-play-btn"
              style={{
                width: 92, height: 92, borderRadius: "50%",
                background: "linear-gradient(135deg,#d4a843,#e6c668)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 36, margin: "0 auto 24px",
                animation: "bfPlayPulse 2.2s ease-in-out infinite",
                transition: "transform .15s", color: "#0a0800",
                paddingLeft: 7, boxShadow: "0 4px 32px rgba(212,168,67,.4)",
              }}
            >▶</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 10 }}>
              Pulsa para ver la animación
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.48)", lineHeight: 1.6 }}>
              El formulario sale de la bolsa como el genio de Aladín · t=8.0s
            </div>
          </div>
        </div>
      )}

      {/* ── Efectos cuando la bolsa vierte ─────────────────────────────────── */}
      {formReady && (
        <>
          {/* Flash dorado en la bolsa */}
          <div style={{
            position: "absolute", left: BAG_X, top: BAG_Y,
            width: 100, height: 100, marginLeft: -50, marginTop: -50,
            borderRadius: "50%", pointerEvents: "none", zIndex: 12,
            background: "radial-gradient(circle, rgba(255,230,120,1) 0%, rgba(212,168,67,.7) 30%, transparent 72%)",
            animation: "bfBurst .9s cubic-bezier(.25,.46,.45,.94) forwards",
          }} />

          {/* Humo mágico */}
          {PUFFS.map(p => (
            <div key={p.id} style={{
              position: "absolute",
              left: BAG_X - p.size / 2,
              top: BAG_Y - p.size / 2,
              width: p.size, height: p.size,
              borderRadius: "50%", pointerEvents: "none", zIndex: 13,
              background: "radial-gradient(circle, rgba(255,230,150,.7) 0%, rgba(212,168,67,.3) 55%, transparent 80%)",
              animation: `bfPuff${p.id} 1.4s cubic-bezier(.25,.46,.45,.94) ${p.delay}ms both`,
            }} />
          ))}

          {/* Billetes €100 */}
          {BILLS.map(b => (
            <div key={b.id} style={{
              position: "absolute", left: BAG_X - 26, top: BAG_Y - 12,
              width: 52, height: 24, zIndex: 14, pointerEvents: "none",
              background: "linear-gradient(135deg,#1e5c1e,#3a9a3a)",
              border: "1.5px solid rgba(255,255,255,.25)", borderRadius: 3,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 800, color: "rgba(0,60,0,.9)",
              boxShadow: "0 2px 10px rgba(0,0,0,.55)",
              animation: `bfBill${b.id} 1.35s cubic-bezier(.25,.46,.45,.94) ${b.delay}ms both`,
            }}>€ 100</div>
          ))}
        </>
      )}

      {/* ── Panel derecho (idéntico a VismeFormHero) ───────────────────────── */}
      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0,
        width: "44%", padding: "40px 40px 40px 28px",
        display: "flex", flexDirection: "column", justifyContent: "center",
        overflowY: "auto", zIndex: 3,
      }}>
        {/* Título de sección — siempre visible */}
        <div style={{ marginBottom: 22 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "5px 13px", borderRadius: 20,
            background: "rgba(200,168,75,.12)", border: "1px solid rgba(200,168,75,.2)",
            color: "#e6c668", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14,
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: "50%", background: "#2dd49f",
              animation: "bfPulse 1.8s ease-in-out infinite",
            }} />
            Trabaja con nosotros
          </div>
          <h2 style={{
            margin: "0 0 9px", fontFamily: "'Instrument Serif', serif",
            fontSize: "clamp(19px, 2.1vw, 26px)", fontWeight: 700,
            lineHeight: 1.22, color: "rgba(255,255,255,.95)",
          }}>
            Cuéntanos sobre<br />
            <em style={{ color: "#d4a843" }}>tu negocio.</em>
          </h2>
          <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,.42)", lineHeight: 1.55 }}>
            Análisis de tu tienda, mercado y competencia — 100% gratis.
          </p>
        </div>

        {/* Hint mientras espera t=8.0s */}
        {videoStarted && !formReady && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 10, padding: "20px 0", textAlign: "center",
            color: "rgba(200,168,75,.4)",
          }}>
            <span style={{ fontSize: 28, animation: "bfBob 2.2s ease-in-out infinite" }}>👜</span>
            <p style={{ margin: 0, fontSize: 12.5, fontStyle: "italic", lineHeight: 1.55 }}>
              Observa cómo Alec<br />vuelca la bolsa…
            </p>
          </div>
        )}

        {/* ── CARD GENIE — aparece como genio de la lámpara ──────────────── */}
        {formReady && (
          <div
            className="bf-genie"
            style={{
              position: "absolute",
              right: 40, top: "50%",
              width: 340,
              background: "rgba(8,6,2,.92)",
              border: "1px solid rgba(212,168,67,.3)",
              borderRadius: 16,
              padding: "26px 22px 22px",
              backdropFilter: "blur(20px)",
              zIndex: 20,
              boxShadow: "0 0 0 1px rgba(212,168,67,.18), 0 0 60px 12px rgba(212,168,67,.22), 0 24px 64px rgba(0,0,0,.6)",
            }}
          >
            {/* Badge */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 10, fontWeight: 700, letterSpacing: "0.18em",
              color: "#d4a843", textTransform: "uppercase",
              background: "rgba(212,168,67,.08)", border: "1px solid rgba(212,168,67,.22)",
              padding: "4px 11px", borderRadius: 20, marginBottom: 14,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#d4a843", display: "block" }} />
              Trabaja con nosotros
            </div>

            {/* Heading typewriter */}
            {buildPhase >= 1 && (
              <div className="bf-slide-in" style={{ marginBottom: 16 }}>
                <h3 style={{ margin: "0 0 3px", fontSize: 17, fontWeight: 800, color: "rgba(255,255,255,.95)" }}>
                  Datos de contacto<span className="bf-cursor" />
                </h3>
                <p style={{ margin: 0, fontSize: 11.5, color: "rgba(200,168,75,.55)", fontStyle: "italic" }}>
                  Solo 2 min · análisis gratis
                </p>
              </div>
            )}

            {/* Nombre + Email */}
            {buildPhase >= 2 && (
              <div className="bf-rise-in" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11, marginBottom: 11 }}>
                <div>
                  <label style={{ ...labelSt }}>Nombre *</label>
                  <input className="bf-input bf-glow" style={inputSt} type="text" placeholder="Tu nombre" />
                </div>
                <div>
                  <label style={{ ...labelSt }}>Email *</label>
                  <input className="bf-input bf-glow" style={{ ...inputSt, animationDelay: "180ms" }} type="email" placeholder="tu@email.com" />
                </div>
              </div>
            )}

            {/* Teléfono */}
            {buildPhase >= 3 && (
              <div className="bf-rise-in" style={{ marginBottom: 11 }}>
                <label style={{ ...labelSt }}>Teléfono</label>
                <input className="bf-input bf-glow" style={inputSt} type="tel" placeholder="+34 600 000 000" />
              </div>
            )}

            {/* Botón */}
            {buildPhase >= 4 && (
              <div className="bf-spring-in" style={{ marginBottom: 0 }}>
                <button style={{
                  width: "100%", padding: "13px 20px", borderRadius: 11,
                  fontSize: 14, fontWeight: 800,
                  background: "linear-gradient(135deg,#d4a843,#e6c668)",
                  color: "#0a0800", border: "none", cursor: "pointer", letterSpacing: "0.03em",
                }}>
                  Analiza mi tienda gratis →
                </button>
              </div>
            )}

            {/* Dots */}
            {buildPhase >= 5 && (
              <div className="bf-rise-in" style={{ display: "flex", justifyContent: "center", gap: 7, marginTop: 14 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    height: 7, borderRadius: 4, width: i === 0 ? 22 : 7,
                    background: i === 0 ? "#d4a843" : "rgba(255,255,255,.12)",
                  }} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Label bar ──────────────────────────────────────────────────────── */}
      <div style={{ position: "absolute", top: 18, left: 0, right: 0, textAlign: "center", zIndex: 50 }}>
        <div style={{
          display: "inline-block", background: "rgba(0,0,0,.65)",
          backdropFilter: "blur(12px)", border: "1px solid rgba(212,168,67,.22)",
          borderRadius: 24, padding: "7px 18px", fontSize: 12,
          color: "rgba(255,255,255,.5)",
        }}>
          <span style={{ color: "#d4a843", fontWeight: 700 }}>② Genio de la bolsa</span>
          {" · "}form emerge en espiral desde la bolsa · t=8.0s
          <button
            onClick={() => setReplay(r => r + 1)}
            style={{
              marginLeft: 12, padding: "3px 11px", borderRadius: 10, fontSize: 11,
              background: "rgba(212,168,67,.15)", color: "#d4a843",
              border: "1px solid rgba(212,168,67,.3)", cursor: "pointer",
            }}
          >⟳</button>
        </div>
      </div>
    </div>
  );
}
