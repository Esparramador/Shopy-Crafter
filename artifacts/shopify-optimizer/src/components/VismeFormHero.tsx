/**
 * VismeFormHero — Visme-style 3D avatar + multi-step contact form
 *
 * Architecture (mirrors Visme.co):
 *  • 3D character on the left with head/eye tracking (Math.atan2 via R3F pointer)
 *  • Each form step triggers a specific animation + camera position
 *  • Smooth crossfade between animations (Three.js fadeIn 0.35s)
 *  • Camera lerps per step: wide (greeting) → close (thinking) → medium (pointing) → wide (celebration)
 *  • Speech bubble above the character gives contextual guidance per step
 *  • Progress indicator (dots) synchronized with form step
 */

import { useState } from "react";
import { FloatingAlecMonopoly } from "@/components/FloatingAlecMonopoly3D";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// ── Per-step 3D configuration ─────────────────────────────────────────────────
const STEPS = [
  {
    title:      "¡Hola! Cuéntame sobre ti 👋",
    hint:       "Solo 2 minutos — y el análisis de tu tienda es 100% gratis",
    animName:   "big_wave_hello",
    animLoop:   false,
    camPos:     [0, 1.4, 3.2] as [number, number, number],
    camLook:    [0, 1.3, 0]   as [number, number, number],
  },
  {
    title:      "Cuéntame de tu negocio 🏪",
    hint:       "Analizaré tu nicho, competencia y posicionamiento en tiempo real",
    animName:   "think",
    animLoop:   true,
    camPos:     [0, 1.5, 2.8] as [number, number, number],
    camLook:    [0, 1.3, 0]   as [number, number, number],
  },
  {
    title:      "¿Qué quieres conseguir? 🎯",
    hint:       "Así personalizo cada motor de IA exactamente a tus objetivos",
    animName:   "casual_walk",
    animLoop:   true,
    camPos:     [0, 1.3, 3.1] as [number, number, number],
    camLook:    [0, 1.1, 0]   as [number, number, number],
  },
];

const SUCCESS_ANIM = "celebrate";
const SUCCESS_CAM:  [number, number, number] = [0, 0.8, 4.2];
const SUCCESS_LOOK: [number, number, number] = [0, 0.8, 0];

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

const NICHES   = ["Moda y ropa","Electrónica y gadgets","Hogar y decoración","Belleza y cosmética","Deporte y fitness","Alimentación y gourmet","Arte y coleccionismo","Mascotas","Joyería y accesorios","Otro"];
const REVENUES = ["Menos de €1.000","€1.000 – €5.000","€5.000 – €15.000","€15.000 – €50.000","Más de €50.000"];
const SERVICES = ["SEO y contenido","Rediseño de producto","Imágenes IA","Pricing y márgenes","Email marketing","A/B Testing","Auditoría completa"];

// ── Shared styles ─────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  display: "block", width: "100%", boxSizing: "border-box",
  padding: "11px 14px", background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
  color: "rgba(255,255,255,0.92)", fontSize: 14, outline: "none", fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 600, letterSpacing: 0.5,
  color: "rgba(200,168,75,0.8)", marginBottom: 6, textTransform: "uppercase",
};

const btnGold: React.CSSProperties = {
  width: "100%", padding: "13px 20px", borderRadius: 10, fontSize: 15, fontWeight: 700,
  background: "linear-gradient(135deg,#d4a843,#e6c668)", color: "#0a0800",
  border: "none", cursor: "pointer", letterSpacing: 0.3, transition: "opacity 0.2s",
};

const btnSecondary: React.CSSProperties = {
  padding: "13px 20px", borderRadius: 10, fontSize: 14, fontWeight: 600,
  background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.65)",
  border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", transition: "opacity 0.2s",
};

// ── Component ─────────────────────────────────────────────────────────────────
export function VismeFormHero({ isActive = false }: { isActive?: boolean }) {
  const [step,     setStep]    = useState(0);
  const [form,     setForm]    = useState<FormData>(EMPTY);
  const [services, setServices] = useState<string[]>([]);
  const [status,   setStatus]  = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errMsg,   setErrMsg]  = useState("");
  const [refFile,  setRefFile] = useState<File | null>(null);
  const [refPrev,  setRefPrev] = useState<string | null>(null);

  const set = (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }));

  const toggleSvc = (s: string) =>
    setServices(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

  const isSuccess     = status === "sent";
  const current       = STEPS[step];
  const canGoNext0    = form.name.trim() !== "" && form.email.trim() !== "";

  // ── Submit to backend (/api/contact) ─────────────────────────────────────────
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

  return (
    <>
      <style>{`
        .vfh-grid {
          display: grid;
          grid-template-columns: clamp(180px, 36%, 400px) 1fr;
          gap: 32px;
          align-items: start;
        }
        @media (max-width: 760px) {
          .vfh-grid { grid-template-columns: 1fr; }
        }
        .vfh-input {
          display: block; width: 100%; box-sizing: border-box;
          padding: 11px 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px; color: rgba(255,255,255,0.92); font-size: 14px;
          outline: none; font-family: inherit; transition: border-color 0.15s;
        }
        .vfh-input:focus { border-color: rgba(212,168,67,0.55); }
        .vfh-input option { background: #111; color: #eee; }
      `}</style>

      <div className="vfh-grid">

        {/* ── LEFT: 3D CHARACTER ─────────────────────────────────────────────── */}
        <div style={{ position: "relative" }}>
          {isActive ? (
            <FloatingAlecMonopoly
              height={420}
              phase="ready"
              animName={isSuccess ? SUCCESS_ANIM    : current.animName}
              animLooping={isSuccess ? true         : current.animLoop}
              cameraPos={isSuccess  ? SUCCESS_CAM  : current.camPos}
              cameraLookAt={isSuccess ? SUCCESS_LOOK : current.camLook}
            />
          ) : (
            <div style={{
              height: 420, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 72, opacity: 0.15,
              background: "rgba(200,168,75,0.03)", borderRadius: 16,
            }}>🤵‍♂️</div>
          )}

          {/* Speech bubble */}
          {!isSuccess && (
            <div style={{
              marginTop: 12,
              background: "rgba(20,14,3,0.92)",
              border: "1px solid rgba(200,168,75,0.3)",
              borderRadius: 14,
              padding: "12px 16px",
              position: "relative",
            }}>
              <div style={{
                position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)",
                width: 0, height: 0,
                borderLeft: "8px solid transparent",
                borderRight: "8px solid transparent",
                borderBottom: "8px solid rgba(200,168,75,0.3)",
              }} />
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#e6c668", lineHeight: 1.4 }}>
                {current.title}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(200,168,75,0.55)", lineHeight: 1.4 }}>
                {current.hint}
              </p>
            </div>
          )}

          {/* Progress dots */}
          {!isSuccess && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 14 }}>
              {STEPS.map((_, i) => (
                <div key={i} style={{
                  height: 8,
                  width: i === step ? 24 : 8,
                  borderRadius: 4,
                  background: i === step
                    ? "#d4a843"
                    : i < step
                    ? "rgba(212,168,67,0.4)"
                    : "rgba(255,255,255,0.1)",
                  transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
                }} />
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: FORM ────────────────────────────────────────────────────── */}
        <div style={{ paddingTop: 8 }}>

          {/* ── SUCCESS ── */}
          {isSuccess && (
            <div style={{
              background: "rgba(45,212,159,0.06)",
              border: "1px solid rgba(45,212,159,0.25)",
              borderRadius: 20, padding: "52px 36px", textAlign: "center",
            }}>
              <div style={{ fontSize: 68, marginBottom: 20 }}>🎉</div>
              <h3 style={{ fontSize: 26, fontWeight: 800, color: "#2dd49f", marginBottom: 14 }}>
                ¡Solicitud recibida!
              </h3>
              <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 15, lineHeight: 1.6, margin: "0 0 10px" }}>
                Nuestra IA ya está analizando tu tienda, mercado, competencia y SEO.
              </p>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
                Te contactamos en menos de 24 horas. Revisa también tu carpeta de spam.
              </p>
            </div>
          )}

          {/* ── STEP 0: Contact info ── */}
          {!isSuccess && step === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,0.92)" }}>
                Datos de contacto
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Nombre completo *</label>
                  <input className="vfh-input" type="text" required value={form.name} onChange={set("name")} placeholder="Tu nombre y apellidos" />
                </div>
                <div>
                  <label style={labelStyle}>Email de contacto *</label>
                  <input className="vfh-input" type="email" required value={form.email} onChange={set("email")} placeholder="tu@email.com" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Teléfono</label>
                <input className="vfh-input" type="tel" value={form.phone} onChange={set("phone")} placeholder="+34 600 000 000" />
              </div>
              <button
                onClick={() => { if (canGoNext0) setStep(1); }}
                disabled={!canGoNext0}
                style={{ ...btnGold, marginTop: 4, opacity: canGoNext0 ? 1 : 0.45 }}
              >
                Siguiente →
              </button>
            </div>
          )}

          {/* ── STEP 1: Business info ── */}
          {!isSuccess && step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,0.92)" }}>
                Tu negocio
              </h3>
              <div>
                <label style={labelStyle}>URL de tu tienda online</label>
                <input className="vfh-input" type="text" value={form.storeUrl} onChange={set("storeUrl")} placeholder="mitienda.com" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Nicho / tipo de productos</label>
                  <select className="vfh-input" value={form.niche} onChange={set("niche")}>
                    <option value="">Selecciona tu nicho</option>
                    {NICHES.map(o => <option key={o}>{o}</option>)}
                  </select>
                  {form.niche === "Otro" && (
                    <input className="vfh-input" type="text" value={form.customNiche} onChange={set("customNiche")} placeholder="Describe tu nicho..." style={{ marginTop: 8 }} autoFocus />
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Facturación mensual</label>
                  <select className="vfh-input" value={form.revenue} onChange={set("revenue")}>
                    <option value="">Selecciona rango</option>
                    {REVENUES.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Redes sociales / Instagram</label>
                <input className="vfh-input" type="text" value={form.socialMedia} onChange={set("socialMedia")} placeholder="@tutienda o https://instagram.com/tutienda" />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={() => setStep(0)} style={btnSecondary}>← Volver</button>
                <button onClick={() => setStep(2)} style={{ ...btnGold, flex: 1 }}>Siguiente →</button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Goals + extras ── */}
          {!isSuccess && step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,0.92)" }}>
                Objetivos y detalles
              </h3>

              {/* Services */}
              <div>
                <label style={labelStyle}>Servicios que necesitas</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                  {SERVICES.map(s => {
                    const on = services.includes(s);
                    return (
                      <button
                        key={s} type="button" onClick={() => toggleSvc(s)}
                        style={{
                          padding: "7px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer",
                          border: `1px solid ${on ? "rgba(200,168,75,0.55)" : "rgba(255,255,255,0.1)"}`,
                          background: on ? "rgba(200,168,75,0.12)" : "transparent",
                          color: on ? "#e6c668" : "rgba(200,168,75,0.7)", transition: "all 0.15s",
                        }}
                      >{s}</button>
                    );
                  })}
                </div>
              </div>

              {/* Extra info */}
              <div>
                <label style={labelStyle}>Información extra sobre tu negocio</label>
                <textarea
                  className="vfh-input" rows={3}
                  value={form.extraInfo} onChange={set("extraInfo")}
                  placeholder="Número de productos, plataformas, retos actuales, objetivos a corto plazo..."
                />
              </div>

              {/* Suppliers */}
              <div>
                <label style={labelStyle}>
                  Proveedores actuales
                  <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.35)", marginLeft: 6, textTransform: "none" }}>(opcional)</span>
                </label>
                <textarea className="vfh-input" rows={2} value={form.suppliers} onChange={set("suppliers")} placeholder="Alibaba, BigBuy, Printful, proveedor local..." />
              </div>

              {/* Message */}
              <div>
                <label style={labelStyle}>Mensaje adicional</label>
                <textarea className="vfh-input" rows={2} value={form.message} onChange={set("message")} placeholder="Cuéntanos más sobre tus retos o lo que quieres conseguir…" />
              </div>

              {/* Reference image */}
              <div>
                <label style={labelStyle}>Imagen de producto (muestra gratis de optimización IA)</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
                  <input className="vfh-input" type="url" value={form.productImageUrl} onChange={set("productImageUrl")} placeholder="https://tu-tienda.com/producto.jpg" />
                  <label style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "11px 14px", background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${refFile ? "rgba(200,168,75,0.5)" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 10, color: refFile ? "#e6c668" : "rgba(200,168,75,0.7)", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
                  }}>
                    {refFile ? `📎 ${refFile.name.slice(0, 16)}…` : "📷 Subir"}
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
                    <img src={refPrev} alt="Ref" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }} />
                    <button type="button" onClick={() => { setRefFile(null); setRefPrev(null); }}
                      style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", fontSize: 11, textDecoration: "underline" }}>
                      Quitar imagen
                    </button>
                  </div>
                )}
              </div>

              {/* Error */}
              {status === "error" && (
                <div style={{ padding: "10px 14px", background: "rgba(232,69,88,0.08)", border: "1px solid rgba(232,69,88,0.3)", borderRadius: 8, color: "#e84558", fontSize: 13 }}>
                  {errMsg}
                </div>
              )}

              {/* GDPR note */}
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "0" }}>
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
            </div>
          )}
        </div>
      </div>
    </>
  );
}
