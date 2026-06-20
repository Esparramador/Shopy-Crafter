/**
 * ContactoHero — /contacto page hero
 *
 * Same video background + overlay as VismeFormHero, but shows:
 *  • t < 3.5s  — waiting hint (Alec bobbing)
 *  • t = 3.5s  — 3 info cards build in (staggered slide-in)
 *  • t = 5.0s  — full manual form fields build in (staggered rise)
 */

import React, { useState, useRef, useEffect, useCallback } from "react";

const BASE_URL   = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const VIDEO_SRC  = `${BASE_URL}/assets/videos/alec_landing.mp4`;
const POSTER_SRC = `${BASE_URL}/assets/videos/alec_poster.jpg`;

const CARDS_TRIGGER = 3.5;
const FORM_TRIGGER  = 5.0;

const NICHES   = ["Moda y ropa","Electrónica y gadgets","Hogar y decoración","Belleza y cosmética","Deporte y fitness","Alimentación y gourmet","Arte y coleccionismo","Mascotas","Joyería y accesorios","Otro"];
const REVENUES = ["Menos de €1.000","€1.000 – €5.000","€5.000 – €15.000","€15.000 – €50.000","Más de €50.000"];
const SERVICES = ["SEO y contenido","Rediseño de producto","Imágenes IA","Pricing y márgenes","Email marketing","A/B Testing","Auditoría completa"];

const INFO_CARDS = [
  { icon: "✉️", label: "Email",            value: "craftershopy@gmail.com", href: "mailto:craftershopy@gmail.com", accent: "#d4a843" },
  { icon: "⚡", label: "Respuesta",         value: "En menos de 24 horas",  href: null,                            accent: "#2dd49f" },
  { icon: "🌍", label: "Ubicación",         value: "España · Remoto",       href: null,                            accent: "#60a5fa" },
];

const EMPTY_FORM = {
  name: "", email: "", phone: "", storeUrl: "",
  niche: "", customNiche: "", revenue: "",
  socialMedia: "", extraInfo: "", message: "",
  suppliers: "", productImageUrl: "",
};

export function ContactoHero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rootRef  = useRef<HTMLDivElement>(null);

  const [cardsReady, setCardsReady] = useState(false);
  const [formReady,  setFormReady]  = useState(false);

  // Form state
  const [form, setForm]     = useState(EMPTY_FORM);
  const [services, setServices] = useState<string[]>([]);
  const [refFile, setRefFile]   = useState<File | null>(null);
  const [refPrev, setRefPrev]   = useState<string | null>(null);
  const [status, setStatus]     = useState<"idle"|"sending"|"sent"|"error">("idle");
  const [errMsg, setErrMsg]     = useState("");
  const [progress, setProgress] = useState(0);

  // Live progress
  useEffect(() => {
    const vals = Object.values(form);
    const filled = vals.filter(v => String(v).trim() !== "").length;
    setProgress(Math.round((filled / vals.length) * 100));
  }, [form]);

  // IntersectionObserver — play when visible
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        const v = videoRef.current;
        if (!v) return;
        e.isIntersecting ? v.play().catch(() => {}) : v.pause();
      },
      { threshold: 0.15 },
    );
    if (rootRef.current) obs.observe(rootRef.current);
    return () => obs.disconnect();
  }, []);

  // timeupdate — dual triggers
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      if (!cardsReady && v.currentTime >= CARDS_TRIGGER) setCardsReady(true);
      if (!formReady  && v.currentTime >= FORM_TRIGGER)  setFormReady(true);
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [cardsReady, formReady]);

  // ended — freeze last frame
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onEnd = () => { try { v.currentTime = Math.max(0, v.duration - 0.05); } catch {} };
    v.addEventListener("ended", onEnd);
    return () => v.removeEventListener("ended", onEnd);
  }, []);

  const setF = (f: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [f]: e.target.value }));

  const toggleSvc = useCallback((s: string) =>
    setServices(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  /* ────────────────────────── inline CSS ────────────────────────── */
  const css = `
    @keyframes chSlideIn {
      from { opacity: 0; transform: translateX(32px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes chRiseIn {
      0%   { opacity: 0; transform: translateY(26px) scale(.97); }
      65%  { opacity: 1; transform: translateY(-3px) scale(1.005); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes chBlink {
      0%,49%  { opacity: 1; }
      50%,100%{ opacity: 0; }
    }
    @keyframes chBob {
      0%,100% { transform: translateY(0);   opacity: .4; }
      50%     { transform: translateY(-7px); opacity: .8; }
    }
    @keyframes chPulse {
      0%,100% { opacity:1; transform:scale(1); }
      50%     { opacity:.45; transform:scale(.65); }
    }
    @keyframes shimmerTop {
      0%   { background-position: -200% 0; }
      100% { background-position:  200% 0; }
    }

    .ch-root {
      position: absolute; inset: 0; overflow: hidden; z-index: 1;
    }
    .ch-video {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      object-fit: cover; object-position: left center;
    }
    @media (max-width: 780px) {
      .ch-video { object-position: 15% center; }
    }
    .ch-grad {
      position: absolute; inset: 0; pointer-events: none;
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
    @media (max-width: 780px) {
      .ch-grad {
        background:
          linear-gradient(180deg,
            rgba(5,3,12,.15) 0%,
            rgba(5,3,12,.1)  20%,
            rgba(5,3,12,.55) 40%,
            rgba(5,3,12,.92) 56%,
            rgba(5,3,12,.99) 70%
          );
      }
    }
    .ch-panel {
      position: absolute;
      right: 0; top: 0; bottom: 0;
      width: 46%;
      padding: 32px 40px 32px 28px;
      display: flex; flex-direction: column; justify-content: center;
      overflow-y: auto; z-index: 2;
      scrollbar-width: thin;
      scrollbar-color: rgba(212,168,67,.2) transparent;
    }
    .ch-panel::-webkit-scrollbar { width: 3px; }
    .ch-panel::-webkit-scrollbar-thumb { background: rgba(212,168,67,.22); border-radius: 3px; }
    @media (max-width: 780px) {
      .ch-panel {
        width: 100%;
        top: 34%; bottom: 0;
        padding: 20px 18px 24px;
        justify-content: flex-start;
      }
    }

    /* ── Info cards ── */
    .ch-card {
      opacity: 0;
      display: flex; align-items: center; gap: 12px;
      padding: 11px 14px; border-radius: 12px;
      background: rgba(255,255,255,.03);
      border: 1px solid rgba(255,255,255,.07);
      margin-bottom: 8px;
    }
    .ch-card.in-0 { animation: chSlideIn .55s cubic-bezier(.22,1,.36,1) 0.00s forwards; }
    .ch-card.in-1 { animation: chSlideIn .55s cubic-bezier(.22,1,.36,1) 0.12s forwards; }
    .ch-card.in-2 { animation: chSlideIn .55s cubic-bezier(.22,1,.36,1) 0.24s forwards; }

    /* ── Form wrapper ── */
    .ch-form {
      background: linear-gradient(160deg, rgba(255,255,255,.025) 0%, rgba(0,0,0,.5) 100%);
      border: 1px solid rgba(200,168,75,.15);
      border-radius: 20px;
      padding: 24px 22px;
      display: grid; gap: 16px;
      position: relative; overflow: hidden;
      backdrop-filter: blur(8px);
      box-shadow:
        0 32px 80px rgba(0,0,0,.6),
        0 0 0 1px rgba(200,168,75,.06),
        inset 0 1px 0 rgba(255,255,255,.04);
    }
    .ch-form::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent, rgba(200,168,75,.5) 40%, rgba(255,220,100,.6) 50%, rgba(200,168,75,.5) 60%, transparent);
      animation: shimmerTop 4s linear infinite;
      background-size: 200% 100%;
    }

    /* Form children start hidden */
    .ch-form > * {
      opacity: 0;
      transform: translateY(26px);
    }
    /* Staggered rise when .fields-in is added */
    .ch-form.fields-in > *:nth-child(1)  { animation: chRiseIn .52s cubic-bezier(.34,1.12,.64,1) 0.00s forwards; }
    .ch-form.fields-in > *:nth-child(2)  { animation: chRiseIn .52s cubic-bezier(.34,1.12,.64,1) 0.07s forwards; }
    .ch-form.fields-in > *:nth-child(3)  { animation: chRiseIn .52s cubic-bezier(.34,1.12,.64,1) 0.14s forwards; }
    .ch-form.fields-in > *:nth-child(4)  { animation: chRiseIn .52s cubic-bezier(.34,1.12,.64,1) 0.21s forwards; }
    .ch-form.fields-in > *:nth-child(5)  { animation: chRiseIn .52s cubic-bezier(.34,1.12,.64,1) 0.28s forwards; }
    .ch-form.fields-in > *:nth-child(6)  { animation: chRiseIn .52s cubic-bezier(.34,1.12,.64,1) 0.35s forwards; }
    .ch-form.fields-in > *:nth-child(7)  { animation: chRiseIn .52s cubic-bezier(.34,1.12,.64,1) 0.42s forwards; }
    .ch-form.fields-in > *:nth-child(8)  { animation: chRiseIn .52s cubic-bezier(.34,1.12,.64,1) 0.49s forwards; }
    .ch-form.fields-in > *:nth-child(9)  { animation: chRiseIn .52s cubic-bezier(.34,1.12,.64,1) 0.56s forwards; }
    .ch-form.fields-in > *:nth-child(10) { animation: chRiseIn .52s cubic-bezier(.34,1.12,.64,1) 0.63s forwards; }
    .ch-form.fields-in > *:nth-child(11) { animation: chRiseIn .52s cubic-bezier(.34,1.12,.64,1) 0.70s forwards; }
    .ch-form.fields-in > *:nth-child(12) { animation: chRiseIn .52s cubic-bezier(.34,1.12,.64,1) 0.77s forwards; }
    .ch-form.fields-in > *:nth-child(n+13) { animation: chRiseIn .52s cubic-bezier(.34,1.12,.64,1) 0.84s forwards; }

    /* ── Inputs ── */
    .ch-input {
      display: block; width: 100%; box-sizing: border-box;
      padding: 10px 13px;
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 10px;
      color: rgba(255,255,255,.93);
      font-size: 13px; outline: none; font-family: inherit;
      transition: border-color .2s, box-shadow .2s;
    }
    .ch-input:focus {
      border-color: rgba(212,168,67,.55);
      box-shadow: 0 0 0 3px rgba(212,168,67,.09);
    }
    .ch-input::placeholder { color: rgba(255,255,255,.2); }
    .ch-input option { background: #111; color: #eee; }
    .ch-label {
      display: block; font-size: 10px; font-weight: 700;
      letter-spacing: .8px; color: rgba(200,168,75,.7);
      text-transform: uppercase; margin-bottom: 6px;
    }
    .ch-2col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    @media (max-width: 560px) {
      .ch-2col { grid-template-columns: 1fr; }
    }

    /* ── Progress bar ── */
    .ch-prog-track {
      width: 100%; height: 5px;
      background: rgba(255,255,255,.07);
      border-radius: 99px; overflow: hidden; margin-top: 4px;
    }
    .ch-prog-fill {
      height: 100%;
      background: linear-gradient(90deg, #6b4a0f 0%, #c8a84b 50%, #f0d27a 100%);
      border-radius: 99px;
      transition: width .5s cubic-bezier(.34,1.1,.64,1);
      box-shadow: 0 0 8px rgba(200,168,75,.5);
    }

    /* ── Submit button ── */
    .ch-submit {
      position: relative;
      padding: 13px 28px; border-radius: 12px; border: none;
      background: linear-gradient(135deg, #d4a843 0%, #b07828 60%, #8a5c1e 100%);
      color: #fff; font-size: 12.5px; font-weight: 900; cursor: pointer;
      letter-spacing: 1.2px; text-transform: uppercase;
      transition: all .2s; transform-style: preserve-3d;
      box-shadow: 0 5px 0 rgba(80,46,10,.8), 0 10px 28px rgba(200,168,75,.35);
      overflow: hidden;
    }
    .ch-submit::before {
      content: '';
      position: absolute; top: 0; left: -100%; width: 60%; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,.15), transparent);
      transition: left .4s ease;
    }
    .ch-submit:hover { transform: translateY(-3px); box-shadow: 0 8px 0 rgba(80,46,10,.8), 0 18px 40px rgba(200,168,75,.45); }
    .ch-submit:hover::before { left: 150%; }
    .ch-submit:active { transform: translateY(2px); box-shadow: 0 2px 0 rgba(80,46,10,.8); }
    .ch-submit:disabled { opacity: .65; cursor: not-allowed; transform: none; }

    /* ── Service pills ── */
    .ch-pill {
      padding: 6px 12px; border-radius: 18px; font-size: 11.5px; cursor: pointer;
      transition: all .15s; border: 1px solid rgba(255,255,255,.08);
      background: transparent; color: rgba(255,255,255,.4);
    }
    .ch-pill.active {
      border-color: rgba(200,168,75,.45);
      background: rgba(200,168,75,.1);
      color: #e6c668;
    }
  `;

  /* ────────────────────────── render ────────────────────────── */
  return (
    <>
      <style>{css}</style>
      <div ref={rootRef} className="ch-root">

        {/* Video background */}
        <video
          ref={videoRef}
          className="ch-video"
          src={VIDEO_SRC}
          poster={POSTER_SRC}
          muted playsInline preload="auto"
        />

        {/* Gradient overlay */}
        <div className="ch-grad" />

        {/* Right panel */}
        <div className="ch-panel">

          {/* Always-visible title */}
          <div style={{ marginBottom: 18 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "5px 12px", borderRadius: 20,
              background: "rgba(200,168,75,.12)", border: "1px solid rgba(200,168,75,.2)",
              color: "#e6c668", fontSize: 10.5, fontWeight: 700,
              letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12,
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: "50%",
                background: "#2dd49f", animation: "chPulse 1.8s ease-in-out infinite",
              }} />
              Trabaja con nosotros
            </div>
            <h1 style={{
              margin: "0 0 8px",
              fontFamily: "'Instrument Serif', serif",
              fontSize: "clamp(18px, 2vw, 25px)",
              fontWeight: 700, lineHeight: 1.2,
              color: "rgba(255,255,255,.95)",
            }}>
              Cuéntanos sobre<br />
              <em style={{ color: "#d4a843" }}>tu negocio.</em>
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,.4)", lineHeight: 1.5 }}>
              Análisis de tu tienda, mercado y competencia — 100% gratis.
            </p>
          </div>

          {/* Waiting hint */}
          {!cardsReady && (
            <div style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", gap: 8,
              padding: "16px 0", textAlign: "center",
              color: "rgba(200,168,75,.4)",
            }}>
              <span style={{ fontSize: 26, animation: "chBob 2.2s ease-in-out infinite" }}>🎩</span>
              <p style={{ margin: 0, fontSize: 12, fontStyle: "italic", lineHeight: 1.5 }}>
                Observa cómo Alec<br />sale del cuadro…
              </p>
            </div>
          )}

          {/* Info cards — appear at t=3.5s */}
          {cardsReady && !status.match(/sent/) && (
            <div style={{ marginBottom: 14 }}>
              {INFO_CARDS.map((c, i) => (
                <div key={c.label} className={`ch-card in-${i}`}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{c.icon}</span>
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: c.accent, textTransform: "uppercase", letterSpacing: ".7px", marginBottom: 2 }}>{c.label}</div>
                    {c.href
                      ? <a href={c.href} style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,.8)", textDecoration: "none" }}>{c.value}</a>
                      : <span style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,.7)" }}>{c.value}</span>
                    }
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SUCCESS */}
          {status === "sent" && (
            <div style={{
              background: "rgba(45,212,159,.07)", border: "1px solid rgba(45,212,159,.25)",
              borderRadius: 16, padding: "36px 24px", textAlign: "center",
            }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>✅</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#2dd49f", marginBottom: 8 }}>¡Solicitud recibida!</h3>
              <p style={{ color: "rgba(255,255,255,.45)", fontSize: 13, lineHeight: 1.6, margin: "0 0 6px" }}>
                Nuestra IA ya está analizando tu tienda, mercado y competencia.
              </p>
              <p style={{ color: "rgba(255,255,255,.28)", fontSize: 11 }}>
                Respuesta en menos de 24h. Revisa también spam.
              </p>
            </div>
          )}

          {/* Form — appears at t=5.0s */}
          {formReady && status !== "sent" && (
            <form onSubmit={submit} className="ch-form fields-in">

              {/* Nombre + Email */}
              <div className="ch-2col">
                <div>
                  <label className="ch-label">Nombre *</label>
                  <input type="text" required value={form.name} onChange={setF("name")}
                    placeholder="Tu nombre" className="ch-input" />
                </div>
                <div>
                  <label className="ch-label">Email *</label>
                  <input type="email" required value={form.email} onChange={setF("email")}
                    placeholder="tu@email.com" className="ch-input" />
                </div>
              </div>

              {/* Teléfono + URL */}
              <div className="ch-2col">
                <div>
                  <label className="ch-label">Teléfono</label>
                  <input type="tel" value={form.phone} onChange={setF("phone")}
                    placeholder="+34 600 000 000" className="ch-input" />
                </div>
                <div>
                  <label className="ch-label">URL tienda</label>
                  <input type="text" value={form.storeUrl} onChange={setF("storeUrl")}
                    placeholder="mitienda.com" className="ch-input" />
                </div>
              </div>

              {/* Nicho + Facturación */}
              <div className="ch-2col">
                <div>
                  <label className="ch-label">Nicho</label>
                  <select value={form.niche} onChange={setF("niche")} className="ch-input">
                    <option value="">Selecciona</option>
                    {NICHES.map(o => <option key={o}>{o}</option>)}
                  </select>
                  {form.niche === "Otro" && (
                    <input type="text" value={form.customNiche} onChange={setF("customNiche")}
                      placeholder="Describe tu nicho..." className="ch-input" style={{ marginTop: 6 }} />
                  )}
                </div>
                <div>
                  <label className="ch-label">Facturación / mes</label>
                  <select value={form.revenue} onChange={setF("revenue")} className="ch-input">
                    <option value="">Selecciona rango</option>
                    {REVENUES.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>

              {/* Redes sociales */}
              <div>
                <label className="ch-label">Redes sociales</label>
                <input type="text" value={form.socialMedia} onChange={setF("socialMedia")}
                  placeholder="@tutienda o URL de Instagram" className="ch-input" />
              </div>

              {/* Info extra */}
              <div>
                <label className="ch-label">Información extra</label>
                <textarea rows={2} value={form.extraInfo} onChange={setF("extraInfo")}
                  placeholder="Nº de productos, plataformas, retos, objetivos…"
                  className="ch-input" style={{ resize: "none" }} />
              </div>

              {/* Proveedores */}
              <div>
                <label className="ch-label">
                  Proveedores
                  <span style={{ fontWeight: 400, color: "rgba(255,255,255,.25)", marginLeft: 5, textTransform: "none", letterSpacing: 0 }}>(opcional)</span>
                </label>
                <input type="text" value={form.suppliers} onChange={setF("suppliers")}
                  placeholder="Alibaba, BigBuy, Printful…" className="ch-input" />
              </div>

              {/* Imagen de producto */}
              <div>
                <label className="ch-label">Imagen de producto</label>
                <div className="ch-2col">
                  <input type="url" value={form.productImageUrl} onChange={setF("productImageUrl")}
                    placeholder="https://…/imagen.jpg" className="ch-input" />
                  <label style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                    background: "rgba(255,255,255,.04)", boxSizing: "border-box",
                    border: `1px solid ${refFile ? "rgba(200,168,75,.45)" : "rgba(255,255,255,.1)"}`,
                    color: refFile ? "#e6c668" : "rgba(255,255,255,.35)", fontSize: 12.5,
                  }}>
                    {refFile ? `📎 ${refFile.name.slice(0,18)}…` : "📷 Subir imagen"}
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setRefFile(f);
                        const r = new FileReader();
                        r.onload = () => setRefPrev(r.result as string);
                        r.readAsDataURL(f);
                      }
                    }} />
                  </label>
                </div>
                {refPrev && (
                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                    <img src={refPrev} alt="" style={{ width: 46, height: 46, objectFit: "cover", borderRadius: 6, border: "1px solid rgba(200,168,75,.2)" }} />
                    <button type="button" onClick={() => { setRefFile(null); setRefPrev(null); }}
                      style={{ background: "none", border: "none", color: "rgba(255,255,255,.3)", cursor: "pointer", fontSize: 11, textDecoration: "underline" }}>
                      Quitar
                    </button>
                  </div>
                )}
              </div>

              {/* Servicios */}
              <div>
                <label className="ch-label">Servicios que necesitas</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                  {SERVICES.map(s => (
                    <button key={s} type="button" onClick={() => toggleSvc(s)}
                      className={`ch-pill${services.includes(s) ? " active" : ""}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mensaje */}
              <div>
                <label className="ch-label">Mensaje adicional</label>
                <textarea rows={2} value={form.message} onChange={setF("message")}
                  placeholder="Cuéntanos tus retos actuales o lo que quieres conseguir…"
                  className="ch-input" style={{ resize: "none" }} />
              </div>

              {/* Error */}
              {status === "error" && (
                <div style={{
                  padding: "9px 13px", borderRadius: 8,
                  background: "rgba(232,69,88,.1)", border: "1px solid rgba(232,69,88,.3)",
                  color: "#e84558", fontSize: 12,
                }}>
                  {errMsg}
                </div>
              )}

              {/* Privacy note */}
              <div style={{
                display: "flex", gap: 8, alignItems: "flex-start",
                padding: "10px 12px", borderRadius: 9,
                background: "rgba(200,168,75,.05)", border: "1px solid rgba(200,168,75,.12)",
              }}>
                <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>🔒</span>
                <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,.32)", lineHeight: 1.5 }}>
                  Datos usados exclusivamente para tu proyecto. Sin spam, nunca.
                </p>
              </div>

              {/* Progress + submit */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: ".06em" }}>Formulario completado</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#c8a84b" }}>{progress}%</span>
                </div>
                <div className="ch-prog-track">
                  <div className="ch-prog-fill" style={{ width: `${progress}%` }} />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,.22)", flex: 1 }}>
                  Sin spam. Solo contactamos para hablar de tu proyecto.
                </p>
                <button type="submit" disabled={status === "sending"} className="ch-submit">
                  {status === "sending" ? "⏳ Enviando…" : "🚀 CONTACTAR AHORA"}
                </button>
              </div>

            </form>
          )}

        </div>{/* /ch-panel */}
      </div>{/* /ch-root */}
    </>
  );
}
