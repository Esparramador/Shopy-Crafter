/**
 * VismeFormHero — Video full-section background + animated right-side form
 *
 * Layout:
 *  • Video fills the entire fp-section (position: absolute; inset: 0)
 *  • Dark gradient darkens the right ~45% for form readability
 *  • Character (left-aligned in video) is always fully visible
 *  • Right panel: section title (always) + form (builds from t=4.5s)
 *
 * Form construction (t=4.5s → t=7.5s):
 *  Phase 1 (+0ms)     — panel slides in + heading TypewriterText
 *  Phase 2 (+1450ms)  — Name/Email fields appear (slide + border glow)
 *  Phase 3 (+2150ms)  — Phone field
 *  Phase 4 (+2800ms)  — "Siguiente →" button (spring bounce)
 *  Phase 5 (+3300ms)  — Progress dots
 *
 * Video:
 *  • IntersectionObserver: plays when section ≥15% visible, pauses otherwise
 *  • "ended" handler: seeks to duration−0.05s → last frame stays frozen
 */

import React, { useState, useRef, useEffect } from "react";

const BASE_URL   = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const VIDEO_SRC  = `${BASE_URL}/assets/videos/alec_landing.mp4`;
const POSTER_SRC = `${BASE_URL}/assets/videos/alec_poster.jpg`;
const TRIGGER_TIME = 4.5;  // seconds — umbrella fully closed

// ── TypewriterText ────────────────────────────────────────────────────────────
function TypewriterText({ text, delay = 0, speed = 62 }: {
  text: string; delay?: number; speed?: number;
}) {
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

  return (
    <>
      {text.slice(0, count)}
      {count < text.length && <span className="vfh-cursor" />}
    </>
  );
}

// ── Types + data ──────────────────────────────────────────────────────────────
type ContactForm = {
  name: string; email: string; phone: string;
  storeUrl: string; niche: string; customNiche: string; revenue: string; socialMedia: string;
  extraInfo: string; message: string; suppliers: string; productImageUrl: string;
};
const EMPTY: ContactForm = {
  name: "", email: "", phone: "", storeUrl: "", niche: "", customNiche: "",
  revenue: "", socialMedia: "", extraInfo: "", message: "", suppliers: "", productImageUrl: "",
};
const NICHES   = ["Moda y ropa","Electrónica y gadgets","Hogar y decoración","Belleza y cosmética","Deporte y fitness","Alimentación y gourmet","Arte y coleccionismo","Mascotas","Joyería y accesorios","Otro"];
const REVENUES = ["Menos de €1.000","€1.000 – €5.000","€5.000 – €15.000","€15.000 – €50.000","Más de €50.000"];
const SERVICES = ["SEO y contenido","Rediseño de producto","Imágenes IA","Pricing y márgenes","Email marketing","A/B Testing","Auditoría completa"];

// ── Shared styles ─────────────────────────────────────────────────────────────
const labelSt: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700,
  color: "rgba(200,168,75,0.72)", textTransform: "uppercase",
  letterSpacing: "0.08em", marginBottom: 7,
};
const btnGold: React.CSSProperties = {
  width: "100%", padding: "13px 20px", borderRadius: 11,
  fontSize: 14, fontWeight: 800,
  background: "linear-gradient(135deg,#d4a843,#e6c668)", color: "#0a0800",
  border: "none", cursor: "pointer", letterSpacing: "0.03em",
  transition: "opacity 0.2s",
};
const btnBack: React.CSSProperties = {
  padding: "13px 18px", borderRadius: 11, fontSize: 13, fontWeight: 600,
  background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.58)",
  border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer",
};

// ── Component ─────────────────────────────────────────────────────────────────
export function VismeFormHero({ isActive: _ia = false }: { isActive?: boolean }) {

  // Form
  const [step,     setStep]    = useState(0);
  const [form,     setForm]    = useState<ContactForm>(EMPTY);
  const [services, setServices] = useState<string[]>([]);
  const [status,   setStatus]  = useState<"idle"|"sending"|"sent"|"error">("idle");
  const [errMsg,   setErrMsg]  = useState("");
  const [refFile,  setRefFile] = useState<File | null>(null);
  const [refPrev,  setRefPrev] = useState<string | null>(null);

  // Video / build state
  const [formReady,  setFormReady]  = useState(false);
  const [buildPhase, setBuildPhase] = useState(0);   // 0..5
  const videoRef = useRef<HTMLVideoElement>(null);
  const rootRef  = useRef<HTMLDivElement>(null);

  // IntersectionObserver — play when visible, pause when hidden
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        const v = videoRef.current;
        if (!v) return;
        entry.isIntersecting ? v.play().catch(() => {}) : v.pause();
      },
      { threshold: 0.15 }
    );
    if (rootRef.current) obs.observe(rootRef.current);
    return () => obs.disconnect();
  }, []);

  // timeupdate — trigger form at t=4.5s
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => { if (v.currentTime >= TRIGGER_TIME && !formReady) setFormReady(true); };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [formReady]);

  // ended — freeze on last frame (seek back 0.05s before end)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onEnded = () => { try { v.currentTime = Math.max(0, v.duration - 0.05); } catch {} };
    v.addEventListener("ended", onEnded);
    return () => v.removeEventListener("ended", onEnded);
  }, []);

  // Build phases cascade (starts when formReady becomes true)
  useEffect(() => {
    if (!formReady) return;
    setBuildPhase(1);
    const t2 = setTimeout(() => setBuildPhase(2), 1450);  // Name+Email
    const t3 = setTimeout(() => setBuildPhase(3), 2150);  // Phone
    const t4 = setTimeout(() => setBuildPhase(4), 2800);  // Button
    const t5 = setTimeout(() => setBuildPhase(5), 3300);  // Dots
    return () => { clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
  }, [formReady]);

  // Form helpers
  const set = (f: keyof ContactForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [f]: e.target.value }));
  const toggleSvc = (s: string) =>
    setServices(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);
  const canNext0  = form.name.trim() !== "" && form.email.trim() !== "";
  const isSuccess = status === "sent";

  // Submit
  const submit = async () => {
    if (status === "sending") return;
    setStatus("sending"); setErrMsg("");
    try {
      let res: Response;
      if (refFile) {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => fd.append(k, v));
        fd.append("services", JSON.stringify(services));
        fd.append("referenceImage", refFile);
        res = await fetch(`${BASE_URL}/api/contact`, { method: "POST", credentials: "include", body: fd });
      } else {
        res = await fetch(`${BASE_URL}/api/contact`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, services }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al enviar");
      setStatus("sent");
    } catch (err: unknown) {
      setStatus("error");
      setErrMsg(err instanceof Error ? err.message : "Error inesperado. Inténtalo de nuevo.");
    }
  };

  // Progress dots
  const Dots = ({ s }: { s: number }) => (
    <div style={{ display: "flex", justifyContent: "center", gap: 7, marginTop: 16 }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          height: 7, borderRadius: 4,
          width: i === s ? 22 : 7,
          background: i === s ? "#d4a843" : i < s ? "rgba(212,168,67,0.45)" : "rgba(255,255,255,0.12)",
          transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
        }} />
      ))}
    </div>
  );

  return (
    <>
      <style>{`
        /* ────── Typewriter cursor ────── */
        .vfh-cursor {
          display: inline-block;
          width: 2px; height: 0.85em;
          background: #d4a843;
          vertical-align: text-bottom;
          margin-left: 3px;
          animation: vfhBlink 0.7s step-end infinite;
        }
        @keyframes vfhBlink {
          0%,49%  { opacity: 1; }
          50%,100%{ opacity: 0; }
        }
        @keyframes vfhPulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%     { opacity:.5; transform:scale(.7); }
        }

        /* ────── Construction keyframes ────── */
        @keyframes vfhSlideIn {
          from { opacity: 0; transform: translateX(38px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes vfhRiseIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes vfhSpringIn {
          0%  { opacity: 0; transform: translateY(12px) scale(.96); }
          60% { opacity: 1; transform: translateY(-2px) scale(1.02); }
          100%{ opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes vfhInputGlow {
          0%  { box-shadow: 0 0 0 0 rgba(212,168,67,.0); border-color:rgba(255,255,255,.12); }
          30% { box-shadow: 0 0 0 5px rgba(212,168,67,.18); border-color:rgba(212,168,67,.75); }
          100%{ box-shadow: 0 0 0 2px rgba(212,168,67,.06); border-color:rgba(212,168,67,.35); }
        }
        @keyframes vfhBob {
          0%,100%{ transform:translateY(0); opacity:.4; }
          50%    { transform:translateY(-6px); opacity:.8; }
        }

        /* ────── CSS classes ────── */
        .vfh-slide-in { animation: vfhSlideIn .65s cubic-bezier(.22,1,.36,1) forwards; }
        .vfh-rise-in  { animation: vfhRiseIn  .52s cubic-bezier(.22,1,.36,1) forwards; }
        .vfh-spring-in{ animation: vfhSpringIn .65s cubic-bezier(.34,1.56,.64,1) forwards; }
        .vfh-input-glow { animation: vfhInputGlow .9s cubic-bezier(.22,1,.36,1) forwards; }

        /* ────── Force fp-contact-visme full-section width ────── */
        /* fp-content has margin:auto + max-width from CSS — override for contact */
        #fp-contact .fp-contact-visme {
          position: absolute !important;
          inset: 0 !important;
          max-width: none !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: clip !important;
        }

        /* ────── Root: fills fp-section on desktop ────── */
        .vfh-root {
          position: absolute;
          inset: 0;
          overflow: clip;
          z-index: 1;
        }

        /* Mobile: fp-section height fills viewport below nav */
        @media (max-width: 780px) {
          #fp-contact {
            min-height: calc(100dvh - 56px) !important;
            height: auto !important;
            padding: 0 !important;
            overflow: visible !important;
          }
        }

        /* ────── Video: full-section background ────── */
        .vfh-video {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: cover;
          object-position: left center;
        }
        @media (max-width: 780px) {
          .vfh-video {
            object-position: 15% center;
          }
        }

        /* ────── Gradient overlay ────── */
        /* Keeps character visible on left, creates dark readable area on right */
        .vfh-gradient {
          position: absolute; inset: 0;
          pointer-events: none;
          background:
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
            );
        }
        /* Mobile: vertical gradient — character visible at top, panel fades in below */
        @media (max-width: 780px) {
          .vfh-gradient {
            background:
              linear-gradient(180deg,
                rgba(5,3,12,.15) 0%,
                rgba(5,3,12,.1) 20%,
                rgba(5,3,12,.55) 40%,
                rgba(5,3,12,.92) 56%,
                rgba(5,3,12,.99) 70%
              );
          }
        }

        /* ────── Right panel ────── */
        .vfh-panel {
          position: absolute;
          right: 0; top: 0; bottom: 0;
          width: 44%;
          padding: 40px 40px 40px 28px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          overflow-y: auto;
          overscroll-behavior-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(212,168,67,.2) transparent;
          z-index: 2;
        }
        .vfh-panel::-webkit-scrollbar { width: 3px; }
        .vfh-panel::-webkit-scrollbar-thumb { background: rgba(212,168,67,.22); border-radius: 3px; }

        @media (max-width: 780px) {
          .vfh-panel {
            position: absolute;
            width: 100%;
            top: 36%;
            bottom: 0;
            padding: 22px 20px 28px;
            background: none;
            justify-content: flex-start;
          }
          .vfh-panel h2 {
            font-size: clamp(15px, 4vw, 18px) !important;
            margin-bottom: 6px !important;
          }
          .vfh-panel p {
            font-size: 11.5px !important;
          }
          .vfh-2col {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 430px) {
          .vfh-panel {
            top: 32%;
            padding: 18px 16px 24px;
          }
          .vfh-2col {
            grid-template-columns: 1fr !important;
          }
          .vfh-input {
            padding: 9px 12px !important;
            font-size: 13px !important;
          }
        }

        /* ────── Inputs ────── */
        .vfh-input {
          display: block; width: 100%; box-sizing: border-box;
          padding: 11px 14px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 10px;
          color: rgba(255,255,255,.93);
          font-size: 14px; outline: none; font-family: inherit;
          transition: border-color .2s, box-shadow .2s;
        }
        .vfh-input:focus {
          border-color: rgba(212,168,67,.5);
          box-shadow: 0 0 0 3px rgba(212,168,67,.08);
        }
        .vfh-input option { background: #111; color: #eee; }

        /* ────── Step-2 inner scroll ────── */
        .vfh-s2 {
          max-height: 380px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(212,168,67,.2) transparent;
          padding-right: 4px;
        }
        .vfh-s2::-webkit-scrollbar { width: 3px; }
        .vfh-s2::-webkit-scrollbar-thumb { background: rgba(212,168,67,.22); border-radius: 3px; }
      `}</style>

      <div ref={rootRef} className="vfh-root">

        {/* ── VIDEO (full-section background) ──────────────────────────────── */}
        <video
          ref={videoRef}
          className="vfh-video"
          src={VIDEO_SRC}
          poster={POSTER_SRC}
          muted
          playsInline
          preload="none"
        />

        {/* ── Gradient overlay ──────────────────────────────────────────────── */}
        <div className="vfh-gradient" />

        {/* ── RIGHT PANEL ───────────────────────────────────────────────────── */}
        <div className="vfh-panel">

          {/* Section title — always visible from the start */}
          <div style={{ marginBottom: 22 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "5px 13px", borderRadius: 20,
              background: "rgba(200,168,75,.12)",
              border: "1px solid rgba(200,168,75,.2)",
              color: "#e6c668", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.08em", textTransform: "uppercase",
              marginBottom: 14,
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: "50%",
                background: "#2dd49f",
                animation: "vfhPulse 1.8s ease-in-out infinite",
              }} />
              Trabaja con nosotros
            </div>
            <h2 style={{
              margin: "0 0 9px",
              fontFamily: "'Instrument Serif', serif",
              fontSize: "clamp(19px, 2.1vw, 26px)",
              fontWeight: 700,
              lineHeight: 1.22,
              color: "rgba(255,255,255,.95)",
            }}>
              Cuéntanos sobre<br />
              <em style={{ color: "#d4a843" }}>tu negocio.</em>
            </h2>
            <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,.42)", lineHeight: 1.55 }}>
              Análisis de tu tienda, mercado y competencia — 100% gratis.
            </p>
          </div>

          {/* ── WAITING HINT (before t=4.5s) ─────────────────────────────── */}
          {!formReady && !isSuccess && (
            <div style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 10, padding: "20px 0", textAlign: "center",
              color: "rgba(200,168,75,.4)",
            }}>
              <span style={{ fontSize: 28, animation: "vfhBob 2.2s ease-in-out infinite" }}>🎩</span>
              <p style={{ margin: 0, fontSize: 12.5, fontStyle: "italic", lineHeight: 1.55 }}>
                Observa cómo Alec<br />sale del cuadro…
              </p>
            </div>
          )}

          {/* ── SUCCESS ──────────────────────────────────────────────────── */}
          {isSuccess && (
            <div className="vfh-slide-in" style={{
              background: "rgba(45,212,159,.07)",
              border: "1px solid rgba(45,212,159,.22)",
              borderRadius: 16, padding: "38px 22px", textAlign: "center",
            }}>
              <div style={{ fontSize: 50, marginBottom: 14 }}>🎉</div>
              <h3 style={{ fontSize: 21, fontWeight: 800, color: "#2dd49f", marginBottom: 10 }}>¡Solicitud recibida!</h3>
              <p style={{ color: "rgba(255,255,255,.62)", fontSize: 14, lineHeight: 1.6, margin: "0 0 8px" }}>
                Nuestra IA ya está analizando tu tienda, mercado, competencia y SEO.
              </p>
              <p style={{ color: "rgba(255,255,255,.35)", fontSize: 12 }}>
                Te contactamos en &lt;24h. Revisa también tu carpeta de spam.
              </p>
            </div>
          )}

          {/* ── STEP 0: construcción animada ─────────────────────────────── */}
          {formReady && !isSuccess && step === 0 && (
            <div
              className="vfh-slide-in"
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              {/* Heading — TypewriterText */}
              <div>
                <h3 style={{ margin: "0 0 3px", fontSize: 17, fontWeight: 800, color: "rgba(255,255,255,.95)" }}>
                  <TypewriterText text="Datos de contacto" speed={65} />
                </h3>
                <p style={{ margin: 0, fontSize: 11.5, color: "rgba(200,168,75,.52)", fontStyle: "italic" }}>
                  <TypewriterText text="Solo 2 min · análisis gratis" speed={42} delay={900} />
                </p>
              </div>

              {/* Name + Email — Phase 2 */}
              {buildPhase >= 2 && (
                <div
                  className="vfh-rise-in vfh-2col"
                  style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}
                >
                  <div>
                    <label style={labelSt}>Nombre *</label>
                    <input
                      className="vfh-input vfh-input-glow"
                      type="text" value={form.name} onChange={set("name")}
                      placeholder="Tu nombre" autoComplete="name"
                    />
                  </div>
                  <div>
                    <label style={labelSt}>Email *</label>
                    <input
                      className="vfh-input vfh-input-glow"
                      style={{ animationDelay: "180ms" }}
                      type="email" value={form.email} onChange={set("email")}
                      placeholder="tu@email.com" autoComplete="email"
                    />
                  </div>
                </div>
              )}

              {/* Phone — Phase 3 */}
              {buildPhase >= 3 && (
                <div className="vfh-rise-in">
                  <label style={labelSt}>Teléfono</label>
                  <input
                    className="vfh-input vfh-input-glow"
                    type="tel" value={form.phone} onChange={set("phone")}
                    placeholder="+34 600 000 000" autoComplete="tel"
                  />
                </div>
              )}

              {/* Button — Phase 4 */}
              {buildPhase >= 4 && (
                <div className="vfh-spring-in">
                  <button
                    onClick={() => { if (canNext0) setStep(1); }}
                    disabled={!canNext0}
                    style={{ ...btnGold, opacity: canNext0 ? 1 : 0.38 }}
                  >
                    Siguiente →
                  </button>
                </div>
              )}

              {/* Dots — Phase 5 */}
              {buildPhase >= 5 && (
                <div className="vfh-rise-in">
                  <Dots s={step} />
                </div>
              )}
            </div>
          )}

          {/* ── STEP 1: Tu negocio ───────────────────────────────────────── */}
          {formReady && !isSuccess && step === 1 && (
            <div className="vfh-slide-in" style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <h3 style={{ margin: "0 0 2px", fontSize: 17, fontWeight: 800, color: "rgba(255,255,255,.95)" }}>Tu negocio</h3>

              <div>
                <label style={labelSt}>URL de tu tienda</label>
                <input className="vfh-input" type="text" value={form.storeUrl} onChange={set("storeUrl")} placeholder="mitienda.com" />
              </div>

              <div className="vfh-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
                <div>
                  <label style={labelSt}>Nicho</label>
                  <select className="vfh-input" value={form.niche} onChange={set("niche")}>
                    <option value="">Selecciona…</option>
                    {NICHES.map(o => <option key={o}>{o}</option>)}
                  </select>
                  {form.niche === "Otro" && (
                    <input className="vfh-input" type="text" value={form.customNiche}
                      onChange={set("customNiche")} placeholder="Describe tu nicho…"
                      style={{ marginTop: 8 }} autoFocus />
                  )}
                </div>
                <div>
                  <label style={labelSt}>Facturación</label>
                  <select className="vfh-input" value={form.revenue} onChange={set("revenue")}>
                    <option value="">Selecciona…</option>
                    {REVENUES.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={labelSt}>Redes sociales</label>
                <input className="vfh-input" type="text" value={form.socialMedia} onChange={set("socialMedia")} placeholder="@tutienda" />
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setStep(0)} style={btnBack}>← Volver</button>
                <button onClick={() => setStep(2)} style={{ ...btnGold, flex: 1 }}>Siguiente →</button>
              </div>

              <Dots s={step} />
            </div>
          )}

          {/* ── STEP 2: Objetivos y detalles ─────────────────────────────── */}
          {formReady && !isSuccess && step === 2 && (
            <div className="vfh-slide-in">
              <h3 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 800, color: "rgba(255,255,255,.95)" }}>Objetivos y detalles</h3>
              <div className="vfh-s2">
                <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>

                  <div>
                    <label style={labelSt}>Servicios que necesitas</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 6 }}>
                      {SERVICES.map(s => {
                        const on = services.includes(s);
                        return (
                          <button key={s} type="button" onClick={() => toggleSvc(s)} style={{
                            padding: "6px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                            border: `1px solid ${on ? "rgba(200,168,75,.5)" : "rgba(255,255,255,.1)"}`,
                            background: on ? "rgba(200,168,75,.12)" : "transparent",
                            color: on ? "#e6c668" : "rgba(200,168,75,.62)", transition: "all .15s",
                          }}>{s}</button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label style={labelSt}>Información extra</label>
                    <textarea className="vfh-input" rows={3} value={form.extraInfo} onChange={set("extraInfo")} placeholder="Número de productos, plataformas, retos actuales…" />
                  </div>

                  <div>
                    <label style={labelSt}>
                      Proveedores
                      <span style={{ fontWeight: 400, color: "rgba(255,255,255,.28)", marginLeft: 5, textTransform: "none" }}>(opcional)</span>
                    </label>
                    <textarea className="vfh-input" rows={2} value={form.suppliers} onChange={set("suppliers")} placeholder="Alibaba, BigBuy, Printful…" />
                  </div>

                  <div>
                    <label style={labelSt}>Mensaje adicional</label>
                    <textarea className="vfh-input" rows={2} value={form.message} onChange={set("message")} placeholder="Cuéntanos más sobre tus retos…" />
                  </div>

                  <div>
                    <label style={labelSt}>
                      Imagen de producto
                      <span style={{ fontWeight: 400, color: "rgba(255,255,255,.28)", marginLeft: 5, textTransform: "none" }}>(optimización IA gratis)</span>
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
                      <input className="vfh-input" type="url" value={form.productImageUrl} onChange={set("productImageUrl")} placeholder="https://tu-tienda.com/producto.jpg" />
                      <label style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "11px 13px",
                        background: "rgba(255,255,255,.04)",
                        border: `1px solid ${refFile ? "rgba(200,168,75,.5)" : "rgba(255,255,255,.1)"}`,
                        borderRadius: 10,
                        color: refFile ? "#e6c668" : "rgba(200,168,75,.62)",
                        fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
                      }}>
                        {refFile ? `📎 ${refFile.name.slice(0,12)}…` : "📷 Subir"}
                        <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setRefFile(f);
                          const r = new FileReader();
                          r.onload = () => setRefPrev(r.result as string);
                          r.readAsDataURL(f);
                        }} />
                      </label>
                    </div>
                    {refPrev && (
                      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
                        <img src={refPrev} alt="Ref" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8, border: "1px solid rgba(255,255,255,.1)" }} />
                        <button type="button" onClick={() => { setRefFile(null); setRefPrev(null); }}
                          style={{ background: "transparent", border: "none", color: "rgba(255,255,255,.3)", cursor: "pointer", fontSize: 11, textDecoration: "underline" }}>Quitar</button>
                      </div>
                    )}
                  </div>

                  {status === "error" && (
                    <div style={{ padding: "10px 14px", background: "rgba(232,69,88,.08)", border: "1px solid rgba(232,69,88,.3)", borderRadius: 8, color: "#e84558", fontSize: 13 }}>{errMsg}</div>
                  )}

                  <p style={{ fontSize: 11, color: "rgba(255,255,255,.28)", margin: 0 }}>
                    Al enviar aceptas nuestra política de privacidad. Tus datos son 100% seguros.
                  </p>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setStep(1)} style={btnBack}>← Volver</button>
                    <button onClick={submit} disabled={status === "sending"} style={{ ...btnGold, flex: 1, opacity: status === "sending" ? 0.7 : 1 }}>
                      {status === "sending" ? "⏳ Enviando…" : "🚀 Enviar y analizar gratis"}
                    </button>
                  </div>

                  <Dots s={step} />
                </div>
              </div>
            </div>
          )}

        </div>{/* /vfh-panel */}
      </div>{/* /vfh-root */}
    </>
  );
}
