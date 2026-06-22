import { useState, useEffect, useRef } from "react";
import PageMeta from "@/components/PageMeta";
import PublicLayout from "@/components/PublicLayout";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const VIDEO_SRC = `${API_BASE}/assets/videos/alec_landing.mp4`;
const POSTER_SRC = `${API_BASE}/assets/videos/alec_poster.jpg`;

const GOLD = "rgba(200,168,75,1)";
const GOLD_BG = "rgba(200,168,75,0.10)";
const GOLD_BORDER = "rgba(200,168,75,0.22)";

const INFO_CARDS = [
  {
    icon: "✉️", label: "Email directo", value: "craftershopy@gmail.com",
    href: "mailto:craftershopy@gmail.com",
    accent: GOLD, bg: "linear-gradient(135deg,rgba(200,168,75,.14),rgba(200,168,75,.04))", border: GOLD_BORDER,
  },
  {
    icon: "⚡", label: "Tiempo de respuesta", value: "Menos de 24 horas", href: null,
    accent: "#2dd49f", bg: "linear-gradient(135deg,rgba(45,212,159,.14),rgba(45,212,159,.04))", border: "rgba(45,212,159,.22)",
  },
  {
    icon: "🌍", label: "Ubicación", value: "España · Remoto", href: null,
    accent: "#60a5fa", bg: "linear-gradient(135deg,rgba(96,165,250,.14),rgba(96,165,250,.04))", border: "rgba(96,165,250,.22)",
  },
];

const BUILD_STEPS = [
  { icon: "🔍", text: "Escaneando tu perfil…" },
  { icon: "🧠", text: "Activando motores IA…" },
  { icon: "✨", text: "Preparando formulario…" },
];

const nicheOptions = ["Moda y ropa","Electrónica y gadgets","Hogar y decoración","Belleza y cosmética","Deporte y fitness","Alimentación y gourmet","Arte y coleccionismo","Mascotas","Joyería y accesorios","Otro"];
const revenueOptions = ["Menos de €1.000","€1.000 – €5.000","€5.000 – €15.000","€15.000 – €50.000","Más de €50.000"];
const serviceOptions = ["Auditoría completa","Generación de imágenes IA","SEO y schemas","A/B Testing","Pricing y COGS","Rediseño web","Programa de afiliados","Plan personalizado"];

const CSS = `
/* ─── ROOT ─── */
.ctc-root {
  position: relative;
  width: 100%;
  min-height: calc(100vh - 64px);
  overflow: hidden;
  background: #05030c;
}

/* ─── VIDEO / OVERLAY ─── */
.ctc-video {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover; object-position: left center;
  z-index: 0;
}
.ctc-overlay {
  position: absolute; inset: 0; z-index: 1;
  pointer-events: none;
  background:
    linear-gradient(90deg,
      rgba(5,3,12,.06) 0%,
      rgba(5,3,12,.06) 36%,
      rgba(5,3,12,.65) 54%,
      rgba(5,3,12,.97) 70%,
      rgba(5,3,12,.99) 100%
    ),
    linear-gradient(180deg,
      rgba(5,3,12,.52) 0%,
      transparent 14%,
      transparent 76%,
      rgba(5,3,12,.6) 100%
    );
}

/* ─── RIGHT FORM PANEL ─── */
.ctc-panel {
  position: absolute;
  right: 0; top: 0; bottom: 0;
  width: 44%;
  overflow-y: auto; overscroll-behavior-y: auto;
  padding: 56px 36px 56px 24px;
  display: flex; flex-direction: column; justify-content: center;
  z-index: 5;
  scrollbar-width: thin;
  scrollbar-color: rgba(200,168,75,.18) transparent;
}
.ctc-panel::-webkit-scrollbar { width: 4px; }
.ctc-panel::-webkit-scrollbar-track { background: transparent; }
.ctc-panel::-webkit-scrollbar-thumb { background: rgba(200,168,75,.18); border-radius: 99px; }

/* ─── INFO CARDS ROW (desktop: bottom-left of video area) ─── */
.ctc-cards-row {
  position: absolute;
  left: 0; right: 44%; bottom: 44px;
  display: flex; justify-content: center; align-items: flex-end;
  gap: 14px; padding: 0 16px; z-index: 10; flex-wrap: wrap;
}
.ctc-card {
  flex: 1 1 130px; max-width: 190px;
  padding: 20px 14px 18px;
  border-radius: 18px; border: 1px solid;
  text-align: center; backdrop-filter: blur(16px);
  opacity: 0; transform: translateY(32px) scale(.95);
  transition: opacity 0.6s cubic-bezier(.22,1,.36,1), transform 0.6s cubic-bezier(.22,1,.36,1);
}
.ctc-card-in { opacity: 1; transform: translateY(0) scale(1); }
.ctc-card:nth-child(1) { transition-delay: 0ms; }
.ctc-card:nth-child(2) { transition-delay: 90ms; }
.ctc-card:nth-child(3) { transition-delay: 180ms; }
.ctc-card-icon { display: block; font-size: 24px; margin-bottom: 10px; }
.ctc-card-label {
  display: block; font-size: 9px; font-weight: 800;
  text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 7px;
}
.ctc-card-value {
  display: block; font-size: 12px; font-weight: 700; color: #ccc;
  text-decoration: none; word-break: break-word;
}
.ctc-card-value:hover { text-decoration: underline; }

/* ─── BUILDING ANIMATION ─── */
.ctc-building {
  display: flex; flex-direction: column; align-items: center;
  padding: 52px 24px; gap: 4px;
}
.ctc-build-orb {
  width: 72px; height: 72px; border-radius: 50%;
  background: radial-gradient(circle, rgba(200,168,75,.28) 0%, transparent 70%);
  border: 2px solid rgba(200,168,75,.45);
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; margin-bottom: 28px;
  animation: ctcOrb 2.2s ease-in-out infinite;
}
@keyframes ctcOrb {
  0%,100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(200,168,75,0); }
  50% { transform: scale(1.07); box-shadow: 0 0 0 12px rgba(200,168,75,.06), 0 0 40px rgba(200,168,75,.18); }
}
.ctc-build-rail {
  width: 100%; height: 3px; background: rgba(200,168,75,.08);
  border-radius: 99px; overflow: hidden; position: relative; margin-bottom: 28px;
}
.ctc-build-beam {
  position: absolute; top: 0; left: -55%; width: 55%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(200,168,75,.9), rgba(45,212,159,.5), transparent);
  animation: ctcBeam 1.3s ease-in-out infinite;
}
@keyframes ctcBeam { to { left: 105%; } }
.ctc-build-step {
  width: 100%; display: flex; align-items: center; gap: 14px;
  padding: 13px 6px;
  border-bottom: 1px solid rgba(255,255,255,.04);
  opacity: 0; transform: translateX(-18px);
  transition: opacity .55s cubic-bezier(.22,1,.36,1), transform .55s cubic-bezier(.22,1,.36,1);
}
.ctc-build-step.ctc-step-on { opacity: 1; transform: translateX(0); }
.ctc-step-dot {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
  background: rgba(200,168,75,.08); border: 1.5px solid rgba(200,168,75,.22);
  display: flex; align-items: center; justify-content: center; font-size: 14px;
  transition: all .4s cubic-bezier(.34,1.56,.64,1) .25s;
}
.ctc-build-step.ctc-step-on .ctc-step-dot {
  background: rgba(45,212,159,.12); border-color: rgba(45,212,159,.4);
}
.ctc-step-text {
  flex: 1; font-size: 13.5px; color: rgba(255,255,255,.55); font-weight: 500;
  transition: color .4s .15s;
}
.ctc-build-step.ctc-step-on .ctc-step-text { color: rgba(255,255,255,.82); }
.ctc-step-check {
  font-size: 16px; opacity: 0; transform: scale(0);
  transition: all .4s cubic-bezier(.34,1.56,.64,1) .35s;
}
.ctc-build-step.ctc-step-on .ctc-step-check { opacity: 1; transform: scale(1); }
.ctc-build-ready {
  margin-top: 20px; font-size: 11px; font-weight: 800; letter-spacing: 2px;
  color: rgba(200,168,75,.5); text-transform: uppercase;
  opacity: 0; transform: scale(.9);
  transition: all .5s cubic-bezier(.22,1,.36,1);
}
.ctc-build-ready.ctc-ready-on { opacity: 1; transform: scale(1); color: rgba(200,168,75,.9); }

/* ─── FORM FIELDS ─── */
.ctc-form-wrap { display: flex; flex-direction: column; gap: 18px; }
.ctc-field { opacity: 0; transform: translateY(16px); }
.ctc-form-ready .ctc-field { animation: ctcFieldIn 0.52s cubic-bezier(.22,1,.36,1) forwards; }
.ctc-form-ready .ctc-field:nth-child(1) { animation-delay: 0ms; }
.ctc-form-ready .ctc-field:nth-child(2) { animation-delay: 60ms; }
.ctc-form-ready .ctc-field:nth-child(3) { animation-delay: 120ms; }
.ctc-form-ready .ctc-field:nth-child(4) { animation-delay: 180ms; }
.ctc-form-ready .ctc-field:nth-child(5) { animation-delay: 240ms; }
.ctc-form-ready .ctc-field:nth-child(6) { animation-delay: 300ms; }
.ctc-form-ready .ctc-field:nth-child(7) { animation-delay: 360ms; }
.ctc-form-ready .ctc-field:nth-child(8) { animation-delay: 420ms; }
.ctc-form-ready .ctc-field:nth-child(n+9) { animation-delay: 480ms; }
@keyframes ctcFieldIn {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
.ctc-input {
  width: 100%; padding: 12px 15px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(200,168,75,0.17);
  border-radius: 10px; color: #eee; font-size: 13.5px;
  outline: none; box-sizing: border-box;
  transition: border-color .2s, box-shadow .2s;
  font-family: inherit;
}
.ctc-input:focus {
  border-color: rgba(200,168,75,.45);
  box-shadow: 0 0 0 3px rgba(200,168,75,.07);
}
.ctc-label {
  display: block; font-size: 10.5px; font-weight: 700; letter-spacing: .7px;
  color: rgba(200,168,75,.82); text-transform: uppercase; margin-bottom: 7px;
}
.ctc-row { display: grid; grid-template-columns: repeat(auto-fit,minmax(min(190px,100%),1fr)); gap: 14px; }
.ctc-service-btn {
  padding: 8px 14px; border-radius: 99px; font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all .15s; font-family: inherit;
}

/* ─── MOBILE ─── */
@media (max-width: 780px) {
  .ctc-root {
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 100dvh;
    /* let children flow normally */
    display: flex;
    flex-direction: column;
  }
  .ctc-video {
    position: fixed;
    height: 100dvh;
    z-index: 0;
  }
  .ctc-overlay {
    position: fixed;
    z-index: 1;
    background:
      linear-gradient(180deg,
        rgba(5,3,12,.65) 0%,
        rgba(5,3,12,.82) 35%,
        rgba(5,3,12,.97) 55%,
        rgba(5,3,12,.99) 100%
      );
  }

  /* FORM PANEL — comes FIRST in DOM, stays first on mobile */
  .ctc-panel {
    position: relative;
    top: auto; right: auto; bottom: auto; left: auto;
    width: 100%;
    min-height: auto;
    padding: 72px 20px 32px;
    justify-content: flex-start;
    background: transparent;
    overflow-y: visible;
    z-index: 5;
    order: 1;
  }

  /* CARDS — come AFTER in DOM, show after form on mobile */
  .ctc-cards-row {
    position: relative;
    top: auto; right: auto; bottom: auto; left: auto;
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    align-items: stretch;
    gap: 10px;
    padding: 8px 16px 52px;
    z-index: 5;
    order: 2;
  }
  .ctc-card {
    flex: 1 1 120px;
    max-width: 160px;
    padding: 16px 10px 14px;
  }
  .ctc-card-icon { font-size: 20px; margin-bottom: 6px; }
  .ctc-card-label { font-size: 8px; }
  .ctc-card-value { font-size: 11px; }
  .ctc-build-orb { width: 60px; height: 60px; font-size: 22px; margin-bottom: 22px; }
}
`;

export default function Contacto() {
  const [form, setForm] = useState({ name:"", email:"", phone:"", storeUrl:"", niche:"", customNiche:"", revenue:"", socialMedia:"", message:"" });
  const [services, setServices] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle"|"sending"|"sent"|"error">("idle");
  const [error, setError] = useState("");
  const [cardPhase, setCardPhase] = useState(0);
  const [formReady, setFormReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Timer-based fallback (in case video doesn't autoplay)
  useEffect(() => {
    const t1 = setTimeout(() => setCardPhase(p => Math.max(p,1)), 500);
    const t2 = setTimeout(() => setCardPhase(p => Math.max(p,2)), 1500);
    const t3 = setTimeout(() => setCardPhase(p => Math.max(p,3)), 2500);
    const tf = setTimeout(() => setFormReady(true), 4000);
    return () => [t1,t2,t3,tf].forEach(clearTimeout);
  }, []);

  // Also sync with video time
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      const t = v.currentTime;
      if (t >= 0.5)  setCardPhase(p => Math.max(p,1));
      if (t >= 1.5)  setCardPhase(p => Math.max(p,2));
      if (t >= 2.5)  setCardPhase(p => Math.max(p,3));
      if (t >= 4.0)  setFormReady(fr => fr || true);
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, []);

  const CF = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>) =>
      setForm(f => ({...f, [field]: e.target.value}));

  const toggleService = (s: string) =>
    setServices(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending"); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/contact`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({...form, services}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al enviar");
      setStatus("sent");
    } catch (err: unknown) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Error inesperado");
    }
  };

  const cards = INFO_CARDS.map((card, i) => (
    <div
      key={card.label}
      className={`ctc-card${cardPhase > i ? " ctc-card-in" : ""}`}
      style={{ background: card.bg, borderColor: card.border }}
    >
      <span className="ctc-card-icon">{card.icon}</span>
      <span className="ctc-card-label" style={{ color: card.accent }}>{card.label}</span>
      {card.href
        ? <a href={card.href} className="ctc-card-value" style={{ color: card.accent }}>{card.value}</a>
        : <span className="ctc-card-value">{card.value}</span>
      }
    </div>
  ));

  return (
    <>
      <PageMeta
        title="Contacto — Shopy Crafter"
        description="Contacta con el equipo de Shopy Crafter. Respondemos en menos de 24 horas con un análisis personalizado de tu tienda."
        canonical="https://shopycrafter.com/contacto"
      />
      <PublicLayout>
        <div className="ctc-root">
          <style>{CSS}</style>

          <video
            ref={videoRef}
            className="ctc-video"
            src={VIDEO_SRC}
            poster={POSTER_SRC}
            autoPlay muted playsInline loop
            preload="metadata"
          />
          <div className="ctc-overlay" />

          {/* ─── FORM PANEL — first in DOM = first on mobile ─── */}
          <div className="ctc-panel">
            {!formReady ? (
              /* ── DYNAMIC BUILDING ANIMATION ── */
              <div className="ctc-building">
                <div className="ctc-build-orb">🤖</div>
                <div className="ctc-build-rail">
                  <div className="ctc-build-beam" />
                </div>
                {BUILD_STEPS.map((step, i) => (
                  <div key={i} className={`ctc-build-step${cardPhase > i ? " ctc-step-on" : ""}`}>
                    <div className="ctc-step-dot">{step.icon}</div>
                    <span className="ctc-step-text">{step.text}</span>
                    <span className="ctc-step-check">✓</span>
                  </div>
                ))}
                <div className={`ctc-build-ready${cardPhase >= 3 ? " ctc-ready-on" : ""}`}>
                  ✦ Formulario listo ✦
                </div>
              </div>
            ) : status === "sent" ? (
              <div style={{ textAlign:"center", padding:"40px 20px" }}>
                <div style={{ fontSize:52, marginBottom:18 }}>✅</div>
                <h3 style={{ fontSize:24, fontWeight:800, color:"#2dd49f", marginBottom:12 }}>¡Solicitud recibida!</h3>
                <p style={{ color:"#888", fontSize:14, lineHeight:1.7, marginBottom:8 }}>
                  Nuestra IA ya está analizando tu negocio, mercado, competencia y SEO.
                </p>
                <p style={{ color:"#555", fontSize:12 }}>Te contactaremos con un informe detallado en menos de 24h.</p>
              </div>
            ) : (
              <div className={`ctc-form-wrap${formReady ? " ctc-form-ready" : ""}`}>

                {/* Header */}
                <div className="ctc-field" style={{ marginBottom:6 }}>
                  <span style={{
                    display:"inline-block", padding:"5px 14px", borderRadius:999,
                    background:GOLD_BG, color:GOLD, border:`1px solid ${GOLD_BORDER}`,
                    fontSize:10, fontWeight:700, letterSpacing:"1px", textTransform:"uppercase",
                    marginBottom:14,
                  }}>Trabaja con nosotros</span>
                  <h2 style={{ fontSize:"clamp(22px,3.2vw,34px)", fontWeight:800, color:"#eee", lineHeight:1.15, marginBottom:10 }}>
                    Cuéntanos sobre<br />tu negocio.
                  </h2>
                  <p style={{ fontSize:13.5, color:"#777", lineHeight:1.65 }}>
                    Analizamos tu tienda con IA antes de contactarte.<br />Respuesta personalizada en &lt;24h.
                  </p>
                </div>

                <form onSubmit={submit} style={{ display:"flex", flexDirection:"column", gap:16 }}>

                  {/* Nombre + Email */}
                  <div className="ctc-field">
                    <div className="ctc-row">
                      <div>
                        <label className="ctc-label">Nombre completo *</label>
                        <input type="text" required value={form.name} onChange={CF("name")} placeholder="Tu nombre y apellidos" className="ctc-input" />
                      </div>
                      <div>
                        <label className="ctc-label">Email de contacto *</label>
                        <input type="email" required value={form.email} onChange={CF("email")} placeholder="tu@email.com" className="ctc-input" />
                      </div>
                    </div>
                  </div>

                  {/* Teléfono + Store */}
                  <div className="ctc-field">
                    <div className="ctc-row">
                      <div>
                        <label className="ctc-label">Teléfono</label>
                        <input type="tel" value={form.phone} onChange={CF("phone")} placeholder="+34 600 000 000" className="ctc-input" />
                      </div>
                      <div>
                        <label className="ctc-label">URL de tu tienda</label>
                        <input type="text" value={form.storeUrl} onChange={CF("storeUrl")} placeholder="mitienda.com" className="ctc-input" />
                      </div>
                    </div>
                  </div>

                  {/* Nicho + Facturación */}
                  <div className="ctc-field">
                    <div className="ctc-row">
                      <div>
                        <label className="ctc-label">Nicho / tipo de productos</label>
                        <select value={form.niche} onChange={CF("niche")} className="ctc-input" style={{ cursor:"pointer" }}>
                          <option value="">Selecciona tu nicho</option>
                          {nicheOptions.map(o => <option key={o}>{o}</option>)}
                        </select>
                        {form.niche === "Otro" && (
                          <input type="text" value={form.customNiche} onChange={CF("customNiche")} placeholder="Describe tu nicho..." className="ctc-input" style={{ marginTop:8 }} />
                        )}
                      </div>
                      <div>
                        <label className="ctc-label">Facturación mensual aprox.</label>
                        <select value={form.revenue} onChange={CF("revenue")} className="ctc-input" style={{ cursor:"pointer" }}>
                          <option value="">Selecciona rango</option>
                          {revenueOptions.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Redes sociales */}
                  <div className="ctc-field">
                    <label className="ctc-label">Redes sociales / Instagram</label>
                    <input type="text" value={form.socialMedia} onChange={CF("socialMedia")} placeholder="@tu_cuenta o URL" className="ctc-input" />
                  </div>

                  {/* Servicios */}
                  <div className="ctc-field">
                    <label className="ctc-label">¿Qué servicios te interesan?</label>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginTop:4 }}>
                      {serviceOptions.map(s => (
                        <button key={s} type="button" onClick={() => toggleService(s)} className="ctc-service-btn"
                          style={{
                            border:`1px solid ${services.includes(s) ? GOLD_BORDER : "rgba(255,255,255,0.09)"}`,
                            background: services.includes(s) ? GOLD_BG : "transparent",
                            color: services.includes(s) ? GOLD : "#777",
                          }}>{s}</button>
                      ))}
                    </div>
                  </div>

                  {/* Mensaje */}
                  <div className="ctc-field">
                    <label className="ctc-label">Mensaje</label>
                    <textarea value={form.message} onChange={CF("message")} rows={4}
                      placeholder="Cuéntanos sobre tu tienda, tus retos actuales o lo que quieres conseguir…"
                      className="ctc-input" style={{ resize:"vertical", minHeight:100 }} />
                  </div>

                  {/* Error */}
                  {status === "error" && (
                    <div className="ctc-field" style={{
                      padding:"11px 15px", background:"rgba(232,69,88,.08)",
                      border:"1px solid rgba(232,69,88,.25)", borderRadius:10, color:"#e84558", fontSize:13,
                    }}>{error}</div>
                  )}

                  {/* Privacy */}
                  <div className="ctc-field" style={{
                    padding:"11px 15px", background:"rgba(200,168,75,.04)",
                    border:`1px solid ${GOLD_BORDER}`, borderRadius:10,
                    display:"flex", gap:9, alignItems:"flex-start",
                  }}>
                    <span style={{ fontSize:15, flexShrink:0, marginTop:1 }}>🔒</span>
                    <p style={{ margin:0, fontSize:11.5, color:"#585858", lineHeight:1.6 }}>
                      Tus datos se usan exclusivamente para contactarte sobre tu proyecto. Sin spam, nunca.
                    </p>
                  </div>

                  {/* Submit */}
                  <div className="ctc-field" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
                    <p style={{ fontSize:11.5, color:"#4a4a4a", flex:1, margin:0 }}>
                      Respuesta personalizada en &lt;24h con análisis previo de tu tienda.
                    </p>
                    <button type="submit" disabled={status === "sending"} style={{
                      opacity: status === "sending" ? .68 : 1,
                      minWidth:200, padding:"13px 28px", fontSize:13.5,
                      borderRadius:12, border:"none", cursor:"pointer", fontWeight:800,
                      background:"linear-gradient(135deg,#d4a843,#b8860b)",
                      color:"#000", letterSpacing:".5px",
                      boxShadow:"0 4px 20px rgba(200,168,75,.22)",
                      transition:"opacity .2s",
                    }}>
                      {status === "sending" ? "Enviando…" : "ENVIAR SOLICITUD →"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* ─── INFO CARDS — after panel in DOM = below form on mobile ─── */}
          <div className="ctc-cards-row">
            {cards}
          </div>

        </div>
      </PublicLayout>
    </>
  );
}
