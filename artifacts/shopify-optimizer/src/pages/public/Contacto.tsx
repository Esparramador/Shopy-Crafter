import { useState, useEffect, useRef, useCallback } from "react";
import PageMeta from "@/components/PageMeta";
import PublicLayout from "@/components/PublicLayout";
import { VismeFormHero } from "@/components/VismeFormHero";
import "../landing.css";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const NICHES   = ["Moda y ropa","Electrónica y gadgets","Hogar y decoración","Belleza y cosmética","Deporte y fitness","Alimentación y gourmet","Arte y coleccionismo","Mascotas","Joyería y accesorios","Otro"];
const REVENUES = ["Menos de €1.000","€1.000 – €5.000","€5.000 – €15.000","€15.000 – €50.000","Más de €50.000"];
const SERVICES = ["SEO y contenido","Rediseño de producto","Imágenes IA","Pricing y márgenes","Email marketing","A/B Testing","Auditoría completa"];

const INFO_CARDS = [
  {
    icon: "✉️",
    label: "Email directo",
    value: "craftershopy@gmail.com",
    href: "mailto:craftershopy@gmail.com",
    accent: "rgba(200,168,75,1)",
    bg: "linear-gradient(135deg, rgba(200,168,75,0.12) 0%, rgba(200,168,75,0.03) 100%)",
    border: "rgba(200,168,75,0.22)",
  },
  {
    icon: "⚡",
    label: "Tiempo de respuesta",
    value: "Menos de 24 horas",
    accent: "#2dd49f",
    bg: "linear-gradient(135deg, rgba(45,212,159,0.12) 0%, rgba(45,212,159,0.03) 100%)",
    border: "rgba(45,212,159,0.22)",
  },
  {
    icon: "🌍",
    label: "Ubicación",
    value: "España · Remoto",
    accent: "#60a5fa",
    bg: "linear-gradient(135deg, rgba(96,165,250,0.12) 0%, rgba(96,165,250,0.03) 100%)",
    border: "rgba(96,165,250,0.22)",
  },
];

export default function Contacto() {
  const [isActive, setIsActive]   = useState(false);
  const [cardsIn, setCardsIn]     = useState(false);
  const [formIn, setFormIn]       = useState(false);
  const cardsRef = useRef<HTMLDivElement>(null);
  const formRef  = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    name: "", email: "", phone: "", storeUrl: "",
    niche: "", customNiche: "", revenue: "",
    socialMedia: "", extraInfo: "", message: "",
    suppliers: "", productImageUrl: "",
  });
  const [services, setServices]         = useState<string[]>([]);
  const [refImageFile, setRefImageFile] = useState<File | null>(null);
  const [refImagePreview, setRefImagePreview] = useState<string | null>(null);
  const [status, setStatus]   = useState<"idle"|"sending"|"sent"|"error">("idle");
  const [error, setError]     = useState("");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setIsActive(true), 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const vals = Object.values(form);
    const filled = vals.filter(v => String(v).trim() !== "").length;
    setProgress(Math.round((filled / vals.length) * 100));
  }, [form]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (e.target === cardsRef.current && e.isIntersecting) setCardsIn(true);
          if (e.target === formRef.current  && e.isIntersecting) setFormIn(true);
        });
      },
      { threshold: 0.12 },
    );
    if (cardsRef.current) io.observe(cardsRef.current);
    if (formRef.current)  io.observe(formRef.current);
    return () => io.disconnect();
  }, []);

  const CF = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }));

  const toggleService = useCallback((s: string) =>
    setServices(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError("");
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append("services", JSON.stringify(services));
      if (refImageFile) fd.append("productImage", refImageFile);

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
        description="Contacta con el equipo de Shopy Crafter. Respondemos en menos de 24 horas con análisis personalizado de tu tienda."
        canonical="https://shopycrafter.com/contacto"
      />
      <PublicLayout>

        {/* ── HERO: idéntico a #fp-contact en la landing ── */}
        <div style={{
          position: "relative",
          width: "100%",
          minHeight: "calc(100vh - 64px)",
          background: "#0e0b1a",
          overflow: "hidden",
        }}>
          {/* Gold radial — mismo que la landing */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(200,168,75,0.06) 0%, transparent 70%)",
          }} />
          <VismeFormHero isActive={isActive} />
        </div>

        {/* ── SECCIÓN INFERIOR: tarjetas + formulario completo ── */}
        <section style={{
          background: "linear-gradient(180deg, #0e0b1a 0%, #09090c 100%)",
          padding: "80px 24px 120px",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Gold ambient glow */}
          <div style={{
            position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
            width: 800, height: 400, borderRadius: "50%", pointerEvents: "none",
            background: "radial-gradient(ellipse at 50% 0%, rgba(200,168,75,0.08) 0%, transparent 70%)",
          }} />

          <div style={{ maxWidth: 900, margin: "0 auto", position: "relative" }}>

            {/* ── Cabecera de sección ── */}
            <div style={{ textAlign: "center", marginBottom: 56 }}>
              <span style={{
                display: "inline-block", padding: "6px 20px", borderRadius: 999,
                background: "rgba(200,168,75,0.10)", color: "rgba(200,168,75,1)",
                border: "1px solid rgba(200,168,75,0.22)",
                fontSize: 11, fontWeight: 700, letterSpacing: "1px",
                textTransform: "uppercase", marginBottom: 20,
              }}>Formulario detallado</span>
              <h2 style={{
                fontSize: "clamp(26px, 4vw, 44px)", fontWeight: 800,
                color: "#f0e8d0", marginBottom: 14, lineHeight: 1.15,
                margin: "0 0 14px",
              }}>
                Cuéntanos sobre tu negocio.
              </h2>
              <p style={{
                fontSize: 16, color: "rgba(255,255,255,0.45)", lineHeight: 1.7,
                maxWidth: 520, margin: "0 auto",
              }}>
                Analizamos tu tienda con IA antes de contactarte.<br />
                Respuesta personalizada en menos de 24h.
              </p>
            </div>

            {/* ── Tarjetas de info — animadas con IntersectionObserver ── */}
            <div
              ref={cardsRef}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                gap: 16, marginBottom: 52,
              }}
            >
              {INFO_CARDS.map((card, i) => (
                <div key={card.label} style={{
                  padding: "28px 24px",
                  background: card.bg,
                  border: `1px solid ${card.border}`,
                  borderRadius: 18,
                  textAlign: "center",
                  opacity: cardsIn ? 1 : 0,
                  transform: cardsIn ? "translateY(0)" : "translateY(32px)",
                  transition: `opacity 0.55s cubic-bezier(0.34,1.12,0.64,1) ${i * 0.1}s, transform 0.55s cubic-bezier(0.34,1.12,0.64,1) ${i * 0.1}s`,
                }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>{card.icon}</div>
                  <div style={{
                    fontSize: 10, fontWeight: 800, color: card.accent,
                    textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8,
                  }}>{card.label}</div>
                  {card.href ? (
                    <a href={card.href} style={{
                      fontSize: 14, fontWeight: 700, color: card.accent,
                      textDecoration: "none",
                    }}>{card.value}</a>
                  ) : (
                    <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{card.value}</div>
                  )}
                </div>
              ))}
            </div>

            {/* ── Formulario principal ── */}
            <div
              ref={formRef}
              style={{
                opacity: formIn ? 1 : 0,
                transform: formIn ? "translateY(0)" : "translateY(40px)",
                transition: "opacity 0.6s cubic-bezier(0.34,1.12,0.64,1) 0.15s, transform 0.6s cubic-bezier(0.34,1.12,0.64,1) 0.15s",
              }}
            >
              {status === "sent" ? (
                <div style={{
                  background: "rgba(45,212,159,0.06)",
                  border: "1px solid rgba(45,212,159,0.25)",
                  borderRadius: 24, padding: "72px 32px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 56, marginBottom: 20 }}>✅</div>
                  <h3 style={{ fontSize: 26, fontWeight: 800, color: "#2dd49f", marginBottom: 12 }}>¡Solicitud recibida!</h3>
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, marginBottom: 8, lineHeight: 1.6 }}>
                    Nuestra IA ya está analizando tu negocio, mercado, competencia y SEO.
                  </p>
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
                    Te contactaremos con un informe detallado en menos de 24h. Revisa también tu carpeta de spam.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={submit}
                  className={`fp-contact-form-v2${formIn ? " fields-in" : ""}`}
                >
                  {/* Nombre + Email */}
                  <div className="fp-contact-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px,100%),1fr))", gap: 16 }}>
                    <div>
                      <label className="fp-field-label">Nombre completo *</label>
                      <input type="text" required value={form.name} onChange={CF("name")}
                        placeholder="Tu nombre y apellidos" className="fp-input-v2" />
                    </div>
                    <div>
                      <label className="fp-field-label">Email de contacto *</label>
                      <input type="email" required value={form.email} onChange={CF("email")}
                        placeholder="tu@email.com" className="fp-input-v2" />
                    </div>
                  </div>

                  {/* Teléfono + URL tienda */}
                  <div className="fp-contact-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px,100%),1fr))", gap: 16 }}>
                    <div>
                      <label className="fp-field-label">Teléfono</label>
                      <input type="tel" value={form.phone} onChange={CF("phone")}
                        placeholder="+34 600 000 000" className="fp-input-v2" />
                    </div>
                    <div>
                      <label className="fp-field-label">URL de tu tienda online</label>
                      <input type="text" value={form.storeUrl} onChange={CF("storeUrl")}
                        placeholder="mitienda.com" className="fp-input-v2" />
                    </div>
                  </div>

                  {/* Nicho + Facturación */}
                  <div className="fp-contact-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px,100%),1fr))", gap: 16 }}>
                    <div>
                      <label className="fp-field-label">Nicho / tipo de productos</label>
                      <select value={form.niche} onChange={CF("niche")} className="fp-input-v2">
                        <option value="">Selecciona tu nicho</option>
                        {NICHES.map(o => <option key={o}>{o}</option>)}
                      </select>
                      {form.niche === "Otro" && (
                        <input type="text" value={form.customNiche} onChange={CF("customNiche")}
                          placeholder="Describe tu nicho de negocio..."
                          className="fp-input-v2" style={{ marginTop: 8 }} autoFocus />
                      )}
                    </div>
                    <div>
                      <label className="fp-field-label">Facturación mensual aprox.</label>
                      <select value={form.revenue} onChange={CF("revenue")} className="fp-input-v2">
                        <option value="">Selecciona rango</option>
                        {REVENUES.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Redes sociales */}
                  <div>
                    <label className="fp-field-label">Redes sociales / Instagram</label>
                    <input type="text" value={form.socialMedia} onChange={CF("socialMedia")}
                      placeholder="@tutienda o https://instagram.com/tutienda"
                      className="fp-input-v2" />
                  </div>

                  {/* Info extra */}
                  <div>
                    <label className="fp-field-label">Información extra sobre tu negocio</label>
                    <textarea rows={3} value={form.extraInfo} onChange={CF("extraInfo")}
                      placeholder="Número de productos, tipos (tallas, colores, materiales...), plataformas que usas, retos actuales, objetivos a corto plazo..."
                      className="fp-input-v2" />
                  </div>

                  {/* Proveedores */}
                  <div>
                    <label className="fp-field-label">
                      Proveedores actuales
                      <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.3)", marginLeft: 6, textTransform: "none", letterSpacing: 0 }}>(opcional)</span>
                    </label>
                    <textarea rows={2} value={form.suppliers} onChange={CF("suppliers")}
                      placeholder="Ej: Alibaba, BigBuy, Printful, proveedor local... Separa con comas si son varios"
                      className="fp-input-v2" />
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 4 }}>
                      Si nos indicas tus proveedores, compararemos sus precios con alternativas y estimaremos el revenue potencial
                    </p>
                  </div>

                  {/* Imagen de producto */}
                  <div>
                    <label className="fp-field-label">Imagen de referencia de tu producto (para muestra gratuita)</label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px,100%),1fr))", gap: 12 }}>
                      <div>
                        <input type="url" value={form.productImageUrl} onChange={CF("productImageUrl")}
                          placeholder="https://tu-tienda.com/imagen-producto.jpg"
                          className="fp-input-v2" />
                        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 4 }}>Pega la URL de una imagen</p>
                      </div>
                      <div>
                        <label style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                          width: "100%", padding: "11px 14px",
                          background: "rgba(255,255,255,0.04)",
                          border: `1px solid ${refImageFile ? "rgba(200,168,75,0.5)" : "rgba(200,168,75,0.1)"}`,
                          borderRadius: 11, color: refImageFile ? "#e6c668" : "rgba(255,255,255,0.3)",
                          fontSize: 14, cursor: "pointer", boxSizing: "border-box", transition: "all 0.15s",
                        }}>
                          {refImageFile ? `📎 ${refImageFile.name.slice(0, 25)}${refImageFile.name.length > 25 ? "..." : ""}` : "📷 O sube una imagen"}
                          <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setRefImageFile(file);
                              const reader = new FileReader();
                              reader.onload = () => setRefImagePreview(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }} />
                        </label>
                        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 4 }}>JPG, PNG, WebP (máx. 5MB)</p>
                      </div>
                    </div>
                    {refImagePreview && (
                      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
                        <img src={refImagePreview} alt="Referencia" style={{
                          width: 60, height: 60, objectFit: "cover",
                          borderRadius: 8, border: "1px solid rgba(200,168,75,0.2)",
                        }} />
                        <button type="button" onClick={() => { setRefImageFile(null); setRefImagePreview(null); }}
                          style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 11, textDecoration: "underline" }}>
                          Quitar imagen
                        </button>
                      </div>
                    )}
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>
                      Sube o pega la URL de 1 imagen y te mostramos cómo quedaría tu producto optimizado por nuestra IA
                    </p>
                  </div>

                  {/* Servicios */}
                  <div>
                    <label className="fp-field-label">Servicios que necesitas</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {SERVICES.map(s => {
                        const active = services.includes(s);
                        return (
                          <button key={s} type="button" onClick={() => toggleService(s)} style={{
                            padding: "7px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer",
                            border: `1px solid ${active ? "rgba(200,168,75,0.5)" : "rgba(255,255,255,0.1)"}`,
                            background: active ? "rgba(200,168,75,0.1)" : "transparent",
                            color: active ? "#e6c668" : "rgba(255,255,255,0.4)",
                            transition: "all 0.15s",
                          }}>{s}</button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mensaje */}
                  <div>
                    <label className="fp-field-label">Mensaje adicional</label>
                    <textarea rows={3} value={form.message} onChange={CF("message")}
                      placeholder="Cuéntanos más sobre tu tienda, tus retos actuales o lo que quieres conseguir…"
                      className="fp-input-v2" />
                  </div>

                  {/* Error */}
                  {status === "error" && (
                    <div style={{
                      padding: "10px 14px",
                      background: "rgba(232,69,88,0.1)", border: "1px solid rgba(232,69,88,0.3)",
                      borderRadius: 8, color: "#e84558", fontSize: 13,
                    }}>
                      {error}
                    </div>
                  )}

                  {/* Aviso privacidad */}
                  <div style={{
                    padding: "12px 16px",
                    background: "rgba(200,168,75,0.06)", border: "1px solid rgba(200,168,75,0.15)",
                    borderRadius: 10, display: "flex", gap: 10, alignItems: "flex-start",
                  }}>
                    <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>ℹ️</span>
                    <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
                      Tus datos se usan exclusivamente para contactarte sobre tu proyecto. No compartimos información con terceros. Si subes una imagen de producto, nuestro equipo la analizará manualmente para preparar tu muestra gratuita personalizada.
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="fp-progress-wrap">
                    <div className="fp-progress-header">
                      <span className="fp-progress-label">Formulario completado</span>
                      <span className="fp-progress-pct">{progress}%</span>
                    </div>
                    <div className="fp-progress-track">
                      <div className="fp-progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  {/* Submit */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.25)", flex: 1, margin: 0 }}>
                      Sin spam. Solo te contactamos para hablar de tu proyecto.
                    </p>
                    <button
                      type="submit"
                      disabled={status === "sending"}
                      className="btn-submit-3d btn-jelly"
                    >
                      {status === "sending" ? "⏳ Enviando…" : "🚀 CONTACTANOS AHORA"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>

      </PublicLayout>
    </>
  );
}
