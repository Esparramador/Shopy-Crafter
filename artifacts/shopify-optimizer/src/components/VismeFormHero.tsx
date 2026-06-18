/**
 * VismeFormHero — Video hero + animated multi-step contact form
 *
 * Architecture:
 *  • 10-second video on the LEFT: Alec Monopoly breaks out of a painting,
 *    lands with umbrella open, then closes the umbrella at ~4.5s
 *  • At t=4.5s (umbrella fully closed) the form BUILDS ITSELF on the RIGHT:
 *    panel slides in, each field appears with a 130ms stagger
 *  • IntersectionObserver triggers video autoplay on scroll
 *  • loop=false so the last frame (character + euros) stays visible
 *  • Fully mobile-responsive: video top / form below on small screens
 */

import { useState, useRef, useEffect } from "react";

const BASE_URL   = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const VIDEO_SRC  = `${BASE_URL}/assets/videos/alec_landing.mp4`;
const POSTER_SRC = `${BASE_URL}/assets/videos/alec_poster.jpg`;

/** Timestamp (seconds) at which the umbrella is fully closed → form appears */
const TRIGGER_TIME = 4.5;

// ── Form shape ────────────────────────────────────────────────────────────────
interface FormData {
  name: string; email: string; phone: string;
  storeUrl: string; niche: string; customNiche: string; revenue: string; socialMedia: string;
  extraInfo: string; message: string; suppliers: string; productImageUrl: string;
}

const EMPTY: FormData = {
  name: "", email: "", phone: "",
  storeUrl: "", niche: "", customNiche: "", revenue: "", socialMedia: "",
  extraInfo: "", message: "", suppliers: "", productImageUrl: "",
};

const NICHES   = ["Moda y ropa", "Electrónica y gadgets", "Hogar y decoración", "Belleza y cosmética", "Deporte y fitness", "Alimentación y gourmet", "Arte y coleccionismo", "Mascotas", "Joyería y accesorios", "Otro"];
const REVENUES = ["Menos de €1.000", "€1.000 – €5.000", "€5.000 – €15.000", "€15.000 – €50.000", "Más de €50.000"];
const SERVICES = ["SEO y contenido", "Rediseño de producto", "Imágenes IA", "Pricing y márgenes", "Email marketing", "A/B Testing", "Auditoría completa"];

// ── Shared micro-styles ───────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700,
  color: "rgba(200,168,75,0.75)", textTransform: "uppercase",
  letterSpacing: "0.08em", marginBottom: 7,
};

const btnGold: React.CSSProperties = {
  width: "100%", padding: "13px 20px", borderRadius: 11, fontSize: 14, fontWeight: 800,
  background: "linear-gradient(135deg,#d4a843,#e6c668)", color: "#0a0800",
  border: "none", cursor: "pointer", letterSpacing: "0.03em",
  transition: "opacity 0.2s, transform 0.15s",
};

const btnSecondary: React.CSSProperties = {
  padding: "13px 18px", borderRadius: 11, fontSize: 13, fontWeight: 600,
  background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)",
  border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer",
  transition: "background 0.15s",
};

// ── Component ─────────────────────────────────────────────────────────────────
export function VismeFormHero({ isActive: _isActive = false }: { isActive?: boolean }) {

  // ── Form state ──────────────────────────────────────────────────────────────
  const [step,     setStep]    = useState(0);
  const [form,     setForm]    = useState<FormData>(EMPTY);
  const [services, setServices] = useState<string[]>([]);
  const [status,   setStatus]  = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errMsg,   setErrMsg]  = useState("");
  const [refFile,  setRefFile] = useState<File | null>(null);
  const [refPrev,  setRefPrev] = useState<string | null>(null);

  // ── Video / animation state ─────────────────────────────────────────────────
  const [formReady,    setFormReady]    = useState(false);
  const [videoStarted, setVideoStarted] = useState(false);
  const videoRef   = useRef<HTMLVideoElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver — autoplay when section enters viewport
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !videoStarted) {
          videoRef.current?.play().catch(() => {});
          setVideoStarted(true);
        }
      },
      { threshold: 0.22 }
    );
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, [videoStarted]);

  // timeupdate — trigger form panel at TRIGGER_TIME
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => {
      if (video.currentTime >= TRIGGER_TIME && !formReady) {
        setFormReady(true);
      }
    };
    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
  }, [formReady]);

  // ── Form helpers ────────────────────────────────────────────────────────────
  const set = (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }));

  const toggleSvc = (s: string) =>
    setServices(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

  const canGoNext0 = form.name.trim() !== "" && form.email.trim() !== "";
  const isSuccess  = status === "sent";

  // ── Animation helper: stagger by element index ──────────────────────────────
  // Panel slides in from right; each element fades + rises with 130ms offset
  const panelAnim: React.CSSProperties = {
    opacity:   formReady ? 1 : 0,
    transform: formReady ? "translateX(0)" : "translateX(52px)",
    transition: "opacity 0.65s cubic-bezier(0.22,1,0.36,1), transform 0.65s cubic-bezier(0.22,1,0.36,1)",
  };

  const reveal = (idx: number): React.CSSProperties => ({
    opacity:   formReady ? 1 : 0,
    transform: formReady ? "translateY(0)" : "translateY(22px)",
    transition: `opacity 0.52s ease ${idx * 130}ms, transform 0.52s cubic-bezier(0.22,1,0.36,1) ${idx * 130}ms`,
  });

  // ── Submit to /api/contact ───────────────────────────────────────────────────
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

  // ── Progress dots ────────────────────────────────────────────────────────────
  const Dots = () => (
    <div style={{ display: "flex", justifyContent: "center", gap: 7, marginTop: 18 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          height: 7, borderRadius: 4,
          width: i === step ? 22 : 7,
          background: i === step
            ? "#d4a843"
            : i < step
            ? "rgba(212,168,67,0.45)"
            : "rgba(255,255,255,0.1)",
          transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
        }} />
      ))}
    </div>
  );

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        /* ── Root grid ── */
        .vfh-root {
          display: grid;
          grid-template-columns: 58% 42%;
          min-height: 540px;
          border-radius: 22px;
          overflow: hidden;
          background: #07060a;
          position: relative;
        }
        @media (max-width: 780px) {
          .vfh-root {
            grid-template-columns: 1fr;
            min-height: unset;
            border-radius: 14px;
          }
        }

        /* ── Video column ── */
        .vfh-video-col {
          position: relative;
          overflow: hidden;
          background: #0a0900;
        }
        .vfh-video {
          width: 100%; height: 100%;
          object-fit: cover;
          object-position: left center;
          display: block;
        }
        @media (max-width: 780px) {
          .vfh-video { height: auto; aspect-ratio: 16 / 9; object-position: center; }
        }
        /* Gradient: fades the right edge of the video into the dark form panel */
        .vfh-video-col::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            90deg,
            transparent 52%,
            rgba(7,6,10,0.55) 78%,
            #07060a 100%
          );
          pointer-events: none;
          z-index: 1;
        }
        @media (max-width: 780px) {
          .vfh-video-col::after {
            background: linear-gradient(180deg, transparent 65%, #07060a 100%);
          }
        }

        /* ── Form column ── */
        .vfh-form-col {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 44px 36px 44px 20px;
          z-index: 2;
        }
        @media (max-width: 780px) {
          .vfh-form-col { padding: 28px 22px 36px; }
        }

        /* ── Scrollable step-2 inner ── */
        .vfh-step2-scroll {
          max-height: 460px;
          overflow-y: auto;
          padding-right: 6px;
          scrollbar-width: thin;
          scrollbar-color: rgba(212,168,67,0.25) transparent;
        }
        .vfh-step2-scroll::-webkit-scrollbar { width: 4px; }
        .vfh-step2-scroll::-webkit-scrollbar-thumb { background: rgba(212,168,67,0.3); border-radius: 4px; }

        /* ── Input base ── */
        .vfh-input {
          display: block; width: 100%; box-sizing: border-box;
          padding: 11px 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          color: rgba(255,255,255,0.92);
          font-size: 14px; outline: none; font-family: inherit;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .vfh-input:focus {
          border-color: rgba(212,168,67,0.5);
          box-shadow: 0 0 0 3px rgba(212,168,67,0.07);
        }
        .vfh-input option { background: #111; color: #eee; }

        /* ── "Waiting" hint shown before t=4.5s ── */
        .vfh-wait {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 12px; height: 100%; text-align: center;
          color: rgba(200,168,75,0.42);
        }
        .vfh-wait-icon {
          font-size: 34px;
          animation: vfhBob 2.4s ease-in-out infinite;
        }
        @keyframes vfhBob {
          0%, 100% { opacity: 0.35; transform: translateY(0); }
          50%       { opacity: 0.75; transform: translateY(-5px); }
        }
        .vfh-wait p {
          margin: 0; font-size: 12.5px; line-height: 1.55;
          font-style: italic;
        }
      `}</style>

      <div ref={sectionRef} className="vfh-root">

        {/* ── LEFT: VIDEO ─────────────────────────────────────────────────────── */}
        <div className="vfh-video-col">
          <video
            ref={videoRef}
            className="vfh-video"
            src={VIDEO_SRC}
            poster={POSTER_SRC}
            muted
            playsInline
            preload="auto"
          />
        </div>

        {/* ── RIGHT: FORM ─────────────────────────────────────────────────────── */}
        <div className="vfh-form-col">

          {/* Waiting hint — shown before umbrella closes */}
          {!formReady && (
            <div className="vfh-wait">
              <span className="vfh-wait-icon">🎩</span>
              <p>Observa cómo Alec<br />sale del cuadro…</p>
            </div>
          )}

          {/* Form panel — revealed at TRIGGER_TIME */}
          {formReady && (
            <div style={panelAnim}>

              {/* ── SUCCESS STATE ── */}
              {isSuccess && (
                <div style={{
                  ...reveal(0),
                  background: "rgba(45,212,159,0.06)",
                  border: "1px solid rgba(45,212,159,0.22)",
                  borderRadius: 18, padding: "44px 28px",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 58, marginBottom: 16 }}>🎉</div>
                  <h3 style={{ fontSize: 23, fontWeight: 800, color: "#2dd49f", marginBottom: 12 }}>
                    ¡Solicitud recibida!
                  </h3>
                  <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 14.5, lineHeight: 1.6, margin: "0 0 10px" }}>
                    Nuestra IA ya está analizando tu tienda, mercado, competencia y SEO.
                  </p>
                  <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 12.5 }}>
                    Te contactamos en menos de 24 horas. Revisa también tu carpeta de spam.
                  </p>
                </div>
              )}

              {/* ─── STEP 0: Datos de contacto ─── */}
              {!isSuccess && step === 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>

                  <div style={reveal(0)}>
                    <h3 style={{ margin: "0 0 3px", fontSize: 21, fontWeight: 800, color: "rgba(255,255,255,0.95)" }}>
                      Datos de contacto
                    </h3>
                    <p style={{ margin: 0, fontSize: 12, color: "rgba(200,168,75,0.55)", fontStyle: "italic" }}>
                      Solo 2 minutos — análisis de tu tienda 100% gratis
                    </p>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, ...reveal(1) }}>
                    <div>
                      <label style={labelStyle}>Nombre *</label>
                      <input className="vfh-input" type="text" value={form.name} onChange={set("name")} placeholder="Tu nombre" autoComplete="name" />
                    </div>
                    <div>
                      <label style={labelStyle}>Email *</label>
                      <input className="vfh-input" type="email" value={form.email} onChange={set("email")} placeholder="tu@email.com" autoComplete="email" />
                    </div>
                  </div>

                  <div style={reveal(2)}>
                    <label style={labelStyle}>Teléfono</label>
                    <input className="vfh-input" type="tel" value={form.phone} onChange={set("phone")} placeholder="+34 600 000 000" autoComplete="tel" />
                  </div>

                  <div style={reveal(3)}>
                    <button
                      onClick={() => { if (canGoNext0) setStep(1); }}
                      disabled={!canGoNext0}
                      style={{ ...btnGold, opacity: canGoNext0 ? 1 : 0.38 }}
                    >
                      Siguiente →
                    </button>
                  </div>

                  <div style={reveal(4)}>
                    <Dots />
                  </div>
                </div>
              )}

              {/* ─── STEP 1: Tu negocio ─── */}
              {!isSuccess && step === 1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>

                  <h3 style={{ margin: "0 0 2px", fontSize: 21, fontWeight: 800, color: "rgba(255,255,255,0.95)" }}>
                    Tu negocio
                  </h3>

                  <div>
                    <label style={labelStyle}>URL de tu tienda</label>
                    <input className="vfh-input" type="text" value={form.storeUrl} onChange={set("storeUrl")} placeholder="mitienda.com" />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Nicho</label>
                      <select className="vfh-input" value={form.niche} onChange={set("niche")}>
                        <option value="">Selecciona…</option>
                        {NICHES.map(o => <option key={o}>{o}</option>)}
                      </select>
                      {form.niche === "Otro" && (
                        <input
                          className="vfh-input" type="text"
                          value={form.customNiche} onChange={set("customNiche")}
                          placeholder="Describe tu nicho…"
                          style={{ marginTop: 8 }} autoFocus
                        />
                      )}
                    </div>
                    <div>
                      <label style={labelStyle}>Facturación</label>
                      <select className="vfh-input" value={form.revenue} onChange={set("revenue")}>
                        <option value="">Selecciona…</option>
                        {REVENUES.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Redes sociales</label>
                    <input className="vfh-input" type="text" value={form.socialMedia} onChange={set("socialMedia")} placeholder="@tutienda o https://instagram.com/…" />
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setStep(0)} style={btnSecondary}>← Volver</button>
                    <button onClick={() => setStep(2)} style={{ ...btnGold, flex: 1 }}>Siguiente →</button>
                  </div>

                  <Dots />
                </div>
              )}

              {/* ─── STEP 2: Objetivos y detalles ─── */}
              {!isSuccess && step === 2 && (
                <div>
                  <h3 style={{ margin: "0 0 14px", fontSize: 21, fontWeight: 800, color: "rgba(255,255,255,0.95)" }}>
                    Objetivos y detalles
                  </h3>

                  <div className="vfh-step2-scroll">
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                      {/* Services */}
                      <div>
                        <label style={labelStyle}>Servicios que necesitas</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                          {SERVICES.map(s => {
                            const on = services.includes(s);
                            return (
                              <button key={s} type="button" onClick={() => toggleSvc(s)} style={{
                                padding: "7px 13px", borderRadius: 20, fontSize: 12.5, cursor: "pointer",
                                border: `1px solid ${on ? "rgba(200,168,75,0.5)" : "rgba(255,255,255,0.1)"}`,
                                background: on ? "rgba(200,168,75,0.12)" : "transparent",
                                color: on ? "#e6c668" : "rgba(200,168,75,0.65)",
                                transition: "all 0.15s",
                              }}>{s}</button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Extra info */}
                      <div>
                        <label style={labelStyle}>Información extra</label>
                        <textarea className="vfh-input" rows={3} value={form.extraInfo} onChange={set("extraInfo")} placeholder="Número de productos, plataformas, retos actuales…" />
                      </div>

                      {/* Suppliers */}
                      <div>
                        <label style={labelStyle}>
                          Proveedores
                          <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.3)", marginLeft: 5, textTransform: "none" }}>(opcional)</span>
                        </label>
                        <textarea className="vfh-input" rows={2} value={form.suppliers} onChange={set("suppliers")} placeholder="Alibaba, BigBuy, Printful, proveedor local…" />
                      </div>

                      {/* Message */}
                      <div>
                        <label style={labelStyle}>Mensaje adicional</label>
                        <textarea className="vfh-input" rows={2} value={form.message} onChange={set("message")} placeholder="Cuéntanos más sobre tus retos o lo que quieres conseguir…" />
                      </div>

                      {/* Reference image */}
                      <div>
                        <label style={labelStyle}>
                          Imagen de producto
                          <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.3)", marginLeft: 5, textTransform: "none" }}>(optimización IA gratis)</span>
                        </label>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
                          <input className="vfh-input" type="url" value={form.productImageUrl} onChange={set("productImageUrl")} placeholder="https://tu-tienda.com/producto.jpg" />
                          <label style={{
                            display: "flex", alignItems: "center", gap: 6, padding: "11px 14px",
                            background: "rgba(255,255,255,0.04)",
                            border: `1px solid ${refFile ? "rgba(200,168,75,0.5)" : "rgba(255,255,255,0.1)"}`,
                            borderRadius: 10, color: refFile ? "#e6c668" : "rgba(200,168,75,0.65)",
                            fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
                          }}>
                            {refFile ? `📎 ${refFile.name.slice(0, 12)}…` : "📷 Subir"}
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
                            <img src={refPrev} alt="Ref" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }} />
                            <button type="button" onClick={() => { setRefFile(null); setRefPrev(null); }} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", fontSize: 11, textDecoration: "underline" }}>Quitar imagen</button>
                          </div>
                        )}
                      </div>

                      {/* Error */}
                      {status === "error" && (
                        <div style={{ padding: "10px 14px", background: "rgba(232,69,88,0.08)", border: "1px solid rgba(232,69,88,0.3)", borderRadius: 8, color: "#e84558", fontSize: 13 }}>
                          {errMsg}
                        </div>
                      )}

                      {/* GDPR */}
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>
                        Al enviar aceptas nuestra política de privacidad. Tus datos son 100% seguros y nunca se comparten con terceros.
                      </p>

                      <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={() => setStep(1)} style={btnSecondary}>← Volver</button>
                        <button
                          onClick={submit}
                          disabled={status === "sending"}
                          style={{ ...btnGold, flex: 1, opacity: status === "sending" ? 0.7 : 1 }}
                        >
                          {status === "sending" ? "⏳ Enviando…" : "🚀 Enviar y analizar gratis"}
                        </button>
                      </div>

                      <Dots />

                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

      </div>
    </>
  );
}
