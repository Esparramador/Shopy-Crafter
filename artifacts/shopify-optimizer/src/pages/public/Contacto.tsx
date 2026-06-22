import { useState, useEffect, useRef } from "react";
import PageMeta from "@/components/PageMeta";
import PublicLayout from "@/components/PublicLayout";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const VIDEO_SRC = `${API_BASE}/assets/videos/alec_landing.mp4`;

const GOLD = "rgba(200,168,75,1)";
const GOLD_BG = "rgba(200,168,75,0.10)";
const GOLD_BORDER = "rgba(200,168,75,0.22)";

const INFO_CARDS = [
  {
    icon: "✉️",
    label: "Email directo",
    value: "craftershopy@gmail.com",
    href: "mailto:craftershopy@gmail.com",
    accent: GOLD,
    bg: "linear-gradient(135deg, rgba(200,168,75,0.12) 0%, rgba(200,168,75,0.04) 100%)",
    border: GOLD_BORDER,
  },
  {
    icon: "⚡",
    label: "Tiempo de respuesta",
    value: "Menos de 24 horas",
    href: null,
    accent: "#2dd49f",
    bg: "linear-gradient(135deg, rgba(45,212,159,0.12) 0%, rgba(45,212,159,0.04) 100%)",
    border: "rgba(45,212,159,0.22)",
  },
  {
    icon: "🌍",
    label: "Ubicación",
    value: "España · Remoto",
    href: null,
    accent: "#60a5fa",
    bg: "linear-gradient(135deg, rgba(96,165,250,0.12) 0%, rgba(96,165,250,0.04) 100%)",
    border: "rgba(96,165,250,0.22)",
  },
];

const nicheOptions = ["Moda y ropa", "Electrónica y gadgets", "Hogar y decoración", "Belleza y cosmética", "Deporte y fitness", "Alimentación y gourmet", "Arte y coleccionismo", "Mascotas", "Joyería y accesorios", "Otro"];
const revenueOptions = ["Menos de €1.000", "€1.000 – €5.000", "€5.000 – €15.000", "€15.000 – €50.000", "Más de €50.000"];
const serviceOptions = ["Auditoría completa", "Generación de imágenes IA", "SEO y schemas", "A/B Testing", "Pricing y COGS", "Rediseño web", "Programa de afiliados", "Plan personalizado"];

const CSS = `
.ctc-root {
  position: relative;
  width: 100%;
  min-height: calc(100vh - 64px);
  overflow: hidden;
  background: #05030c;
}
.ctc-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: left center;
}
.ctc-overlay {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg,
      rgba(5,3,12,.06) 0%,
      rgba(5,3,12,.06) 36%,
      rgba(5,3,12,.62) 54%,
      rgba(5,3,12,.96) 70%,
      rgba(5,3,12,.99) 100%
    ),
    linear-gradient(180deg,
      rgba(5,3,12,.50) 0%,
      transparent 15%,
      transparent 76%,
      rgba(5,3,12,.55) 100%
    );
  pointer-events: none;
}
/* ─── INFO CARDS ROW ─── */
.ctc-cards-row {
  position: absolute;
  left: 0;
  right: 44%;
  bottom: 44px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 14px;
  padding: 0 16px;
  z-index: 10;
  flex-wrap: wrap;
}
.ctc-card {
  flex: 1 1 140px;
  max-width: 200px;
  padding: 20px 16px 18px;
  border-radius: 18px;
  border: 1px solid;
  text-align: center;
  backdrop-filter: blur(14px);
  opacity: 0;
  transform: translateY(28px);
  transition: opacity 0.65s cubic-bezier(.22,1,.36,1), transform 0.65s cubic-bezier(.22,1,.36,1);
}
.ctc-card-in { opacity: 1; transform: translateY(0); }
.ctc-card:nth-child(1) { transition-delay: 0ms; }
.ctc-card:nth-child(2) { transition-delay: 70ms; }
.ctc-card:nth-child(3) { transition-delay: 140ms; }
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

/* ─── RIGHT PANEL ─── */
.ctc-panel {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 44%;
  overflow-y: auto;
  overscroll-behavior-y: auto;
  padding: 56px 36px 56px 24px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  z-index: 5;
  scrollbar-width: thin;
  scrollbar-color: rgba(200,168,75,.18) transparent;
}
.ctc-panel::-webkit-scrollbar { width: 4px; }
.ctc-panel::-webkit-scrollbar-track { background: transparent; }
.ctc-panel::-webkit-scrollbar-thumb { background: rgba(200,168,75,.18); border-radius: 99px; }

/* ─── WAITING STATE ─── */
.ctc-waiting {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 18px; height: 100%; text-align: center; color: rgba(255,255,255,.28);
  padding: 60px 20px;
}
.ctc-waiting-icon { font-size: 46px; animation: ctcBob 2.4s ease-in-out infinite; }
.ctc-waiting p { font-size: 14px; line-height: 1.6; }
@keyframes ctcBob {
  0%,100% { transform: translateY(0) rotate(-3deg); opacity: .35; }
  50% { transform: translateY(-10px) rotate(3deg); opacity: .75; }
}

/* ─── FORM FIELDS ─── */
.ctc-form-wrap { display: flex; flex-direction: column; gap: 18px; }
.ctc-field { opacity: 0; transform: translateY(18px); }
.ctc-form-ready .ctc-field { animation: ctcFieldIn 0.52s cubic-bezier(.22,1,.36,1) forwards; }
.ctc-form-ready .ctc-field:nth-child(1) { animation-delay: 0ms; }
.ctc-form-ready .ctc-field:nth-child(2) { animation-delay: 75ms; }
.ctc-form-ready .ctc-field:nth-child(3) { animation-delay: 150ms; }
.ctc-form-ready .ctc-field:nth-child(4) { animation-delay: 225ms; }
.ctc-form-ready .ctc-field:nth-child(5) { animation-delay: 300ms; }
.ctc-form-ready .ctc-field:nth-child(6) { animation-delay: 375ms; }
.ctc-form-ready .ctc-field:nth-child(7) { animation-delay: 450ms; }
.ctc-form-ready .ctc-field:nth-child(8) { animation-delay: 525ms; }
.ctc-form-ready .ctc-field:nth-child(n+9) { animation-delay: 600ms; }
@keyframes ctcFieldIn {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ─── INPUT STYLES ─── */
.ctc-input {
  width: 100%; padding: 12px 15px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(200,168,75,0.17);
  border-radius: 10px;
  color: #eeeeee; font-size: 13.5px; outline: none;
  box-sizing: border-box; transition: border-color 0.2s, box-shadow 0.2s;
  font-family: inherit;
}
.ctc-input:focus {
  border-color: rgba(200,168,75,0.45);
  box-shadow: 0 0 0 3px rgba(200,168,75,0.07);
}
.ctc-label {
  display: block; font-size: 10.5px; font-weight: 700; letter-spacing: 0.7px;
  color: rgba(200,168,75,0.82); text-transform: uppercase; margin-bottom: 7px;
}
.ctc-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(200px,100%),1fr)); gap: 14px; }
.ctc-service-btn {
  padding: 8px 14px; border-radius: 99px; font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all 0.15s; font-family: inherit;
}

/* ─── MOBILE ─── */
@media (max-width: 780px) {
  .ctc-cards-row {
    position: absolute;
    right: 0;
    bottom: auto;
    top: 42%;
    flex-direction: row;
    justify-content: center;
    padding: 0 12px;
    gap: 10px;
  }
  .ctc-card { max-width: 130px; padding: 14px 10px 12px; }
  .ctc-card-icon { font-size: 20px; margin-bottom: 6px; }
  .ctc-card-label { font-size: 8px; }
  .ctc-card-value { font-size: 11px; }
  .ctc-panel {
    position: absolute;
    right: 0; left: 0;
    top: 58%;
    bottom: 0;
    width: 100%;
    background: rgba(5,3,12,0.94);
    padding: 24px 20px 40px;
    justify-content: flex-start;
    overflow-y: auto;
  }
  .ctc-overlay {
    background:
      linear-gradient(180deg,
        rgba(5,3,12,.12) 0%,
        rgba(5,3,12,.12) 35%,
        rgba(5,3,12,.92) 55%,
        rgba(5,3,12,.99) 70%,
        rgba(5,3,12,.99) 100%
      );
  }
}
`;

export default function Contacto() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", storeUrl: "", niche: "", customNiche: "", revenue: "", socialMedia: "", message: "" });
  const [services, setServices] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const [cardPhase, setCardPhase] = useState(0);
  const [formReady, setFormReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const t1 = setTimeout(() => setCardPhase(p => Math.max(p, 1)), 500);
    const t2 = setTimeout(() => setCardPhase(p => Math.max(p, 2)), 1500);
    const t3 = setTimeout(() => setCardPhase(p => Math.max(p, 3)), 2500);
    const tf = setTimeout(() => setFormReady(true), 4000);
    return () => { [t1, t2, t3, tf].forEach(clearTimeout); };
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      const t = v.currentTime;
      if (t >= 0.5)  setCardPhase(p => Math.max(p, 1));
      if (t >= 1.5)  setCardPhase(p => Math.max(p, 2));
      if (t >= 2.5)  setCardPhase(p => Math.max(p, 3));
      if (t >= 4.0)  setFormReady(fr => fr || true);
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, []);

  const CF = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }));

  const toggleService = (s: string) =>
    setServices(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/contact`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, services }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al enviar");
      setStatus("sent");
    } catch (err: unknown) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Error inesperado");
    }
  };

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
            autoPlay
            muted
            playsInline
            preload="none"
            onEnded={e => { (e.target as HTMLVideoElement).pause(); }}
          />
          <div className="ctc-overlay" />

          {/* ─── INFO CARDS (bottom of Alec's area) ─── */}
          <div className="ctc-cards-row">
            {INFO_CARDS.map((card, i) => (
              <div
                key={card.label}
                className={`ctc-card${cardPhase > i ? " ctc-card-in" : ""}`}
                style={{ background: card.bg, borderColor: card.border }}
              >
                <span className="ctc-card-icon">{card.icon}</span>
                <span className="ctc-card-label" style={{ color: card.accent }}>{card.label}</span>
                {card.href ? (
                  <a href={card.href} className="ctc-card-value" style={{ color: card.accent }}>{card.value}</a>
                ) : (
                  <span className="ctc-card-value">{card.value}</span>
                )}
              </div>
            ))}
          </div>

          {/* ─── RIGHT PANEL (form or waiting) ─── */}
          <div className="ctc-panel">
            {!formReady ? (
              <div className="ctc-waiting">
                <span className="ctc-waiting-icon">🎩</span>
                <p>Observa cómo Alec sale del cuadro…</p>
              </div>
            ) : status === "sent" ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 52, marginBottom: 18 }}>✅</div>
                <h3 style={{ fontSize: 24, fontWeight: 800, color: "#2dd49f", marginBottom: 12 }}>¡Solicitud recibida!</h3>
                <p style={{ color: "#888", fontSize: 14, lineHeight: 1.7, marginBottom: 8 }}>
                  Nuestra IA ya está analizando tu negocio, mercado, competencia y SEO.
                </p>
                <p style={{ color: "#555", fontSize: 12 }}>Te contactaremos con un informe detallado en menos de 24h.</p>
              </div>
            ) : (
              <div className={`ctc-form-wrap${formReady ? " ctc-form-ready" : ""}`}>

                {/* Header */}
                <div className="ctc-field" style={{ marginBottom: 6 }}>
                  <span style={{
                    display: "inline-block", padding: "5px 14px", borderRadius: 999,
                    background: GOLD_BG, color: GOLD, border: `1px solid ${GOLD_BORDER}`,
                    fontSize: 10, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase",
                    marginBottom: 14,
                  }}>Trabaja con nosotros</span>
                  <h2 style={{ fontSize: "clamp(22px,3.2vw,34px)", fontWeight: 800, color: "#eee", lineHeight: 1.15, marginBottom: 10 }}>
                    Cuéntanos sobre<br />tu negocio.
                  </h2>
                  <p style={{ fontSize: 13.5, color: "#777", lineHeight: 1.65 }}>
                    Analizamos tu tienda con IA antes de contactarte.<br />Respuesta personalizada en &lt;24h.
                  </p>
                </div>

                <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                  {/* Nombre + Email */}
                  <div className="ctc-field">
                    <div className="ctc-row">
                      <div>
                        <label className="ctc-label">Nombre completo *</label>
                        <input type="text" required value={form.name} onChange={CF("name")}
                          placeholder="Tu nombre y apellidos" className="ctc-input" />
                      </div>
                      <div>
                        <label className="ctc-label">Email de contacto *</label>
                        <input type="email" required value={form.email} onChange={CF("email")}
                          placeholder="tu@email.com" className="ctc-input" />
                      </div>
                    </div>
                  </div>

                  {/* Teléfono + Store */}
                  <div className="ctc-field">
                    <div className="ctc-row">
                      <div>
                        <label className="ctc-label">Teléfono</label>
                        <input type="tel" value={form.phone} onChange={CF("phone")}
                          placeholder="+34 600 000 000" className="ctc-input" />
                      </div>
                      <div>
                        <label className="ctc-label">URL de tu tienda</label>
                        <input type="text" value={form.storeUrl} onChange={CF("storeUrl")}
                          placeholder="mitienda.com" className="ctc-input" />
                      </div>
                    </div>
                  </div>

                  {/* Nicho + Facturación */}
                  <div className="ctc-field">
                    <div className="ctc-row">
                      <div>
                        <label className="ctc-label">Nicho / tipo de productos</label>
                        <select value={form.niche} onChange={CF("niche")} className="ctc-input" style={{ cursor: "pointer" }}>
                          <option value="">Selecciona tu nicho</option>
                          {nicheOptions.map(o => <option key={o}>{o}</option>)}
                        </select>
                        {form.niche === "Otro" && (
                          <input type="text" value={form.customNiche} onChange={CF("customNiche")}
                            placeholder="Describe tu nicho..." className="ctc-input" style={{ marginTop: 8 }} />
                        )}
                      </div>
                      <div>
                        <label className="ctc-label">Facturación mensual aprox.</label>
                        <select value={form.revenue} onChange={CF("revenue")} className="ctc-input" style={{ cursor: "pointer" }}>
                          <option value="">Selecciona rango</option>
                          {revenueOptions.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Redes sociales */}
                  <div className="ctc-field">
                    <label className="ctc-label">Redes sociales / Instagram</label>
                    <input type="text" value={form.socialMedia} onChange={CF("socialMedia")}
                      placeholder="@tu_cuenta o URL" className="ctc-input" />
                  </div>

                  {/* Servicios */}
                  <div className="ctc-field">
                    <label className="ctc-label">¿Qué servicios te interesan?</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 4 }}>
                      {serviceOptions.map(s => (
                        <button key={s} type="button" onClick={() => toggleService(s)}
                          className="ctc-service-btn"
                          style={{
                            border: `1px solid ${services.includes(s) ? GOLD_BORDER : "rgba(255,255,255,0.09)"}`,
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
                      className="ctc-input" style={{ resize: "vertical", minHeight: 100 }} />
                  </div>

                  {/* Error */}
                  {status === "error" && (
                    <div className="ctc-field" style={{
                      padding: "11px 15px",
                      background: "rgba(232,69,88,0.08)", border: "1px solid rgba(232,69,88,0.25)",
                      borderRadius: 10, color: "#e84558", fontSize: 13,
                    }}>{error}</div>
                  )}

                  {/* Privacy */}
                  <div className="ctc-field" style={{
                    padding: "11px 15px",
                    background: "rgba(200,168,75,0.04)", border: `1px solid ${GOLD_BORDER}`,
                    borderRadius: 10, display: "flex", gap: 9, alignItems: "flex-start",
                  }}>
                    <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>🔒</span>
                    <p style={{ margin: 0, fontSize: 11.5, color: "#585858", lineHeight: 1.6 }}>
                      Tus datos se usan exclusivamente para contactarte sobre tu proyecto. Sin spam, nunca.
                    </p>
                  </div>

                  {/* Submit */}
                  <div className="ctc-field" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <p style={{ fontSize: 11.5, color: "#4a4a4a", flex: 1, margin: 0 }}>
                      Respuesta personalizada en &lt;24h con análisis previo de tu tienda.
                    </p>
                    <button type="submit" disabled={status === "sending"} style={{
                      opacity: status === "sending" ? 0.68 : 1,
                      minWidth: 200, padding: "13px 28px", fontSize: 13.5,
                      borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 800,
                      background: "linear-gradient(135deg, #d4a843, #b8860b)",
                      color: "#000", letterSpacing: "0.5px",
                      boxShadow: "0 4px 20px rgba(200,168,75,0.22)",
                      transition: "opacity 0.2s",
                    }}>
                      {status === "sending" ? "Enviando…" : "ENVIAR SOLICITUD →"}
                    </button>
                  </div>

                </form>
              </div>
            )}
          </div>
        </div>
      </PublicLayout>
    </>
  );
}
