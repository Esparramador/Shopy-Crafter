import { useState, useEffect } from "react";

const CYCLE = 10500;

const BILLS = [
  { id: 1, dx: -90, dy: -140, rot: -55, delay: 0 },
  { id: 2, dx: 60,  dy: -160, rot:  40, delay: 80 },
  { id: 3, dx: -140,dy: -70,  rot: -30, delay: 160 },
  { id: 4, dx: 110, dy: -90,  rot:  65, delay: 220 },
  { id: 5, dx: -50, dy: -180, rot: -15, delay: 300 },
  { id: 6, dx: 150, dy: -50,  rot:  80, delay: 120 },
];

export function BagFormEffect() {
  const [phase, setPhase] = useState<"idle"|"tipping"|"bills"|"emerge"|"expand"|"fields">("idle");
  const [tick, setTick] = useState(0);
  const [replay, setReplay] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const go = (ph: typeof phase, ms: number) =>
      timers.push(setTimeout(() => setPhase(ph), ms));

    setPhase("idle");
    go("tipping",  800);
    go("bills",   2000);
    go("emerge",  2400);
    go("expand",  3200);
    go("fields",  4200);

    const loop = setInterval(() => setTick(t => t + 1), CYCLE);
    return () => { timers.forEach(clearTimeout); clearInterval(loop); };
  }, [replay, tick]);

  const isActive = (p: typeof phase) => {
    const order = ["idle","tipping","bills","emerge","expand","fields"];
    return order.indexOf(phase) >= order.indexOf(p);
  };

  return (
    <div style={{
      width: "100vw", height: "100vh", overflow: "hidden", position: "relative",
      background: "radial-gradient(ellipse 80% 70% at 30% 60%, #12100a 0%, #070604 100%)",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <style>{`
        /* ── Bag tipping ── */
        @keyframes bagTip {
          0%   { transform: rotate(0deg) translate(0,0); }
          40%  { transform: rotate(20deg) translate(8px, 4px); }
          70%  { transform: rotate(105deg) translate(32px, 28px); }
          100% { transform: rotate(112deg) translate(38px, 32px); }
        }
        @keyframes bagShake {
          0%,100%{ transform: rotate(0deg) translate(0,0); }
          20%    { transform: rotate(-3deg) translate(-3px,0); }
          40%    { transform: rotate(3deg) translate(3px,0); }
          60%    { transform: rotate(-2deg) translate(-2px,0); }
          80%    { transform: rotate(2deg) translate(2px,0); }
        }

        /* ── Bills ── */
        @keyframes billFly1  { 0%{opacity:1;transform:translate(0,0) rotate(0deg)}   100%{opacity:0;transform:translate(-90px,-140px) rotate(-55deg) scale(.7)} }
        @keyframes billFly2  { 0%{opacity:1;transform:translate(0,0) rotate(0deg)}   100%{opacity:0;transform:translate(60px,-160px) rotate(40deg) scale(.6)} }
        @keyframes billFly3  { 0%{opacity:1;transform:translate(0,0) rotate(0deg)}   100%{opacity:0;transform:translate(-140px,-70px) rotate(-30deg) scale(.8)} }
        @keyframes billFly4  { 0%{opacity:1;transform:translate(0,0) rotate(0deg)}   100%{opacity:0;transform:translate(110px,-90px) rotate(65deg) scale(.65)} }
        @keyframes billFly5  { 0%{opacity:1;transform:translate(0,0) rotate(0deg)}   100%{opacity:0;transform:translate(-50px,-180px) rotate(-15deg) scale(.75)} }
        @keyframes billFly6  { 0%{opacity:1;transform:translate(0,0) rotate(0deg)}   100%{opacity:0;transform:translate(150px,-50px) rotate(80deg) scale(.55)} }

        /* ── Form emerge from bag ── */
        @keyframes formBurst {
          0%   { transform: translate(-70px, 60px) scale(0.03) skewX(18deg) skewY(22deg);
                 opacity:0; border-radius:50%; filter:blur(6px) brightness(2.5); }
          18%  { transform: translate(-40px, 20px) scale(0.12) skewX(10deg) skewY(12deg);
                 opacity:0.8; border-radius:35%; filter:blur(2px) brightness(1.8); }
          40%  { transform: translate(-10px, -8px) scale(0.55) skewX(4deg) skewY(5deg);
                 opacity:1; border-radius:22px; filter:blur(.5px) brightness(1.2); }
          65%  { transform: translate(6px, 4px) scale(1.07) skewX(1deg) skewY(1deg);
                 opacity:1; border-radius:16px; filter:blur(0) brightness(1); }
          80%  { transform: translate(-3px,-2px) scale(.97) skewX(0) skewY(0);
                 opacity:1; border-radius:16px; filter:blur(0) brightness(1); }
          100% { transform: translate(0,0) scale(1) skewX(0) skewY(0);
                 opacity:1; border-radius:16px; filter:blur(0) brightness(1); }
        }

        /* ── Form glow pulse on emerge ── */
        @keyframes formGlow {
          0%   { box-shadow: 0 0 0px 0px rgba(212,168,67,0); }
          30%  { box-shadow: 0 0 60px 20px rgba(212,168,67,.45), 0 0 120px 40px rgba(212,168,67,.18); }
          100% { box-shadow: 0 0 30px 6px rgba(212,168,67,.12), 0 0 0 1px rgba(212,168,67,.25); }
        }

        /* ── Field slide in ── */
        @keyframes fieldIn {
          from { opacity:0; transform: translateX(24px); }
          to   { opacity:1; transform: translateX(0); }
        }

        /* ── Character bob ── */
        @keyframes charBob {
          0%,100%{ transform:translateY(0) scale(1); }
          50%    { transform:translateY(-8px) scale(1.01); }
        }

        /* ── Particles ── */
        @keyframes particleFly {
          0%   { transform:translate(0,0) scale(1); opacity:.9; }
          100% { transform:translate(var(--px),var(--py)) scale(.3); opacity:0; }
        }
        @keyframes taglineGlow {
          0%,100%{ opacity:.6; }
          50%    { opacity:1; }
        }

        .bag-shake { animation: bagShake 0.4s ease-in-out 2; }
        .bag-tip   { animation: bagTip 1.1s cubic-bezier(.25,.46,.45,.94) forwards; }
        .form-burst{ animation: formBurst 1.05s cubic-bezier(.34,1.56,.64,1) forwards,
                                formGlow  1.4s cubic-bezier(.22,1,.36,1) forwards; }
        .field-in  { animation: fieldIn .55s cubic-bezier(.22,1,.36,1) forwards; }
      `}</style>

      {/* ── Dark video-style overlay gradients ── */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none",
        background:"linear-gradient(90deg, transparent 35%, rgba(4,3,2,.75) 60%, rgba(4,3,2,.92) 100%)",
        zIndex:2,
      }} />
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none",
        background:"linear-gradient(180deg, rgba(0,0,0,.3) 0%, transparent 20%, transparent 75%, rgba(0,0,0,.5) 100%)",
        zIndex:3,
      }} />

      {/* ── Simulated character silhouette (left) ── */}
      <div style={{
        position:"absolute", left:"6%", bottom:0, width:420, height:"88%",
        background:"linear-gradient(160deg, #1a1508 0%, #0d0b05 60%)",
        clipPath:"polygon(18% 0%,82% 0%,100% 100%,0% 100%)",
        zIndex:1,
        animation: "charBob 4s ease-in-out infinite",
      }}>
        <div style={{
          position:"absolute", inset:0,
          background:"radial-gradient(ellipse 60% 80% at 50% 40%, rgba(212,168,67,.08), transparent 70%)",
        }}/>
        {/* Character hint label */}
        <div style={{
          position:"absolute", top:"12%", left:"50%", transform:"translateX(-50%)",
          color:"rgba(212,168,67,.45)", fontSize:11, fontWeight:700,
          letterSpacing:"0.2em", textTransform:"uppercase",
          animation:"taglineGlow 2.5s ease-in-out infinite",
        }}>Alec · personaje</div>
      </div>

      {/* ── BAG SCENE CENTER ── */}
      <div style={{
        position:"absolute",
        right:"22%", bottom:"32%",
        zIndex:10,
        transformOrigin:"bottom center",
      }}>
        {/* The bag */}
        <div
          className={phase === "idle" ? "bag-shake" : isActive("tipping") ? "bag-tip" : ""}
          style={{
            fontSize:72, lineHeight:1, cursor:"default",
            filter: isActive("bills") ? "drop-shadow(0 0 16px rgba(212,168,67,.7))" : undefined,
            display:"block",
          }}
        >
          💰
        </div>

        {/* Bills flying out */}
        {isActive("bills") && BILLS.map((b) => (
          <div key={b.id} style={{
            position:"absolute", top:0, left:20,
            fontSize:24, lineHeight:1,
            animation:`billFly${b.id} 1.1s cubic-bezier(.25,.46,.45,.94) ${b.delay}ms both`,
            pointerEvents:"none",
            zIndex:11,
          }}>💵</div>
        ))}

        {/* Shimmer particles on burst */}
        {isActive("emerge") && !isActive("expand") && Array.from({length:8}).map((_,i) => {
          const angle = (i / 8) * Math.PI * 2;
          return (
            <div key={i} style={{
              position:"absolute", top:10, left:30,
              width:6, height:6, borderRadius:"50%",
              background:"#d4a843",
              "--px": `${Math.cos(angle)*80}px`,
              "--py": `${Math.sin(angle)*80 - 40}px`,
              animation:"particleFly .9s cubic-bezier(.25,.46,.45,.94) forwards",
              animationDelay:`${i * 30}ms`,
            } as React.CSSProperties} />
          );
        })}
      </div>

      {/* ── FORM PANEL ── */}
      {isActive("emerge") && (
        <div
          className="form-burst"
          style={{
            position:"absolute",
            right:"6%", top:"50%",
            transform:"translateY(-50%)",
            width:340,
            background:"rgba(10,8,4,.88)",
            border:"1px solid rgba(212,168,67,.28)",
            borderRadius:16,
            padding:"28px 24px 24px",
            backdropFilter:"blur(16px)",
            zIndex:20,
            transformOrigin:"right bottom",
          }}
        >
          {/* Header */}
          <div style={{
            display:"inline-flex", alignItems:"center", gap:6,
            fontSize:10, fontWeight:700, letterSpacing:"0.18em",
            color:"#d4a843", textTransform:"uppercase",
            background:"rgba(212,168,67,.08)", border:"1px solid rgba(212,168,67,.2)",
            padding:"4px 10px", borderRadius:20, marginBottom:14,
          }}>
            <span style={{width:6,height:6,borderRadius:"50%",background:"#d4a843",display:"block"}}/>
            Trabaja con nosotros
          </div>

          <h2 style={{
            fontSize:20, fontWeight:800, color:"#fff", margin:"0 0 4px",
            lineHeight:1.25,
          }}>Cuéntanos sobre</h2>
          <h2 style={{
            fontSize:20, fontWeight:800,
            background:"linear-gradient(135deg,#d4a843,#e6c668)",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
            margin:"0 0 20px",
          }}>tu negocio.</h2>

          {/* Fields appear one by one */}
          {isActive("fields") && (
            <>
              <div className="field-in" style={{animationDelay:"0ms", marginBottom:12}}>
                <label style={{display:"block",fontSize:10,fontWeight:700,color:"rgba(200,168,75,.7)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Nombre</label>
                <input readOnly defaultValue="Tu nombre aquí" style={{
                  width:"100%", padding:"11px 14px", borderRadius:9,
                  background:"rgba(255,255,255,.04)", border:"1px solid rgba(212,168,67,.3)",
                  color:"rgba(255,255,255,.7)", fontSize:13, outline:"none",
                  boxSizing:"border-box",
                }} />
              </div>
              <div className="field-in" style={{animationDelay:"120ms", marginBottom:12}}>
                <label style={{display:"block",fontSize:10,fontWeight:700,color:"rgba(200,168,75,.7)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Email</label>
                <input readOnly defaultValue="tu@tienda.com" style={{
                  width:"100%", padding:"11px 14px", borderRadius:9,
                  background:"rgba(255,255,255,.04)", border:"1px solid rgba(212,168,67,.3)",
                  color:"rgba(255,255,255,.7)", fontSize:13, outline:"none",
                  boxSizing:"border-box",
                }} />
              </div>
              <div className="field-in" style={{animationDelay:"240ms", marginBottom:12}}>
                <label style={{display:"block",fontSize:10,fontWeight:700,color:"rgba(200,168,75,.7)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Teléfono</label>
                <input readOnly defaultValue="+34 600 000 000" style={{
                  width:"100%", padding:"11px 14px", borderRadius:9,
                  background:"rgba(255,255,255,.04)", border:"1px solid rgba(212,168,67,.3)",
                  color:"rgba(255,255,255,.7)", fontSize:13, outline:"none",
                  boxSizing:"border-box",
                }} />
              </div>
              <div className="field-in" style={{animationDelay:"360ms"}}>
                <button style={{
                  width:"100%", padding:"13px 20px", borderRadius:11,
                  fontSize:14, fontWeight:800,
                  background:"linear-gradient(135deg,#d4a843,#e6c668)", color:"#0a0800",
                  border:"none", cursor:"pointer",
                }}>
                  Analiza mi tienda gratis →
                </button>
              </div>

              {/* Progress dots */}
              <div className="field-in" style={{animationDelay:"480ms", display:"flex",justifyContent:"center",gap:7,marginTop:14}}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    height:7, borderRadius:4,
                    width: i===0 ? 22 : 7,
                    background: i===0 ? "#d4a843" : "rgba(255,255,255,.12)",
                  }}/>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── PHASE LABELS ── */}
      <div style={{
        position:"absolute", bottom:28, left:"50%", transform:"translateX(-50%)",
        display:"flex", gap:12, alignItems:"center", zIndex:30,
      }}>
        {[
          { p:"idle",    label:"① Bolsa reposa" },
          { p:"tipping", label:"② Bolsa se vuelca" },
          { p:"bills",   label:"③ 💵 Billetes salen" },
          { p:"emerge",  label:"④ Formulario emerge" },
          { p:"expand",  label:"⑤ Se expande" },
          { p:"fields",  label:"⑥ Campos aparecen" },
        ].map(({ p, label }) => {
          const active = isActive(p as typeof phase);
          const current = phase === p;
          return (
            <div key={p} style={{
              padding:"5px 10px", borderRadius:20, fontSize:10.5, fontWeight:current ? 700 : 500,
              background: current ? "rgba(212,168,67,.2)" : active ? "rgba(212,168,67,.07)" : "rgba(255,255,255,.04)",
              color: current ? "#d4a843" : active ? "rgba(212,168,67,.6)" : "rgba(255,255,255,.25)",
              border: current ? "1px solid rgba(212,168,67,.4)" : "1px solid rgba(255,255,255,.06)",
              transition:"all .3s",
              whiteSpace:"nowrap",
            }}>{label}</div>
          );
        })}
      </div>

      {/* ── TOP LABELS ── */}
      <div style={{
        position:"absolute", top:24, left:0, right:0, textAlign:"center", zIndex:30,
      }}>
        <div style={{
          display:"inline-block",
          background:"rgba(0,0,0,.5)", backdropFilter:"blur(8px)",
          border:"1px solid rgba(212,168,67,.2)", borderRadius:24,
          padding:"8px 20px", fontSize:12,
          color:"rgba(255,255,255,.55)",
        }}>
          <span style={{color:"#d4a843", fontWeight:700}}>Efecto "Sale de la bolsa"</span>
          {" · "}preview — la animación se repite automáticamente
          <button
            onClick={() => setReplay(r => r + 1)}
            style={{
              marginLeft:14, padding:"3px 10px", borderRadius:10, fontSize:11,
              background:"rgba(212,168,67,.15)", color:"#d4a843",
              border:"1px solid rgba(212,168,67,.3)", cursor:"pointer",
            }}
          >⟳ Reiniciar</button>
        </div>
      </div>
    </div>
  );
}
