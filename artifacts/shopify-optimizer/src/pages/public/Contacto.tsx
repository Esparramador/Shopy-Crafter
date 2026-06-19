import { useState, useEffect, useRef } from "react";
import PageMeta from "@/components/PageMeta";
import PublicLayout from "@/components/PublicLayout";
import { VismeFormHero } from "@/components/VismeFormHero";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const GOLD = "rgba(200,168,75,1)";
const GOLD_BG = "rgba(200,168,75,0.10)";
const GOLD_BORDER = "rgba(200,168,75,0.22)";

export default function Contacto() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", storeUrl: "", niche: "", customNiche: "", revenue: "", socialMedia: "", message: "" });
  const [services, setServices] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const [isActive, setIsActive] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsActive(true), 400);
    return () => clearTimeout(timer);
  }, []);

  const CF = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const toggleService = (s: string) => setServices(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

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

  const nicheOptions = ["Moda y ropa", "Electrónica y gadgets", "Hogar y decoración", "Belleza y cosmética", "Deporte y fitness", "Alimentación y gourmet", "Arte y coleccionismo", "Mascotas", "Joyería y accesorios", "Otro"];
  const revenueOptions = ["Menos de €1.000", "€1.000 – €5.000", "€5.000 – €15.000", "€15.000 – €50.000", "Más de €50.000"];
  const serviceOptions = ["Auditoría completa", "Generación de imágenes IA", "SEO y schemas", "A/B Testing", "Pricing y COGS", "Rediseño web", "Programa de afiliados", "Plan personalizado"];

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "13px 16px",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(200,168,75,0.18)",
    borderRadius: 10,
    color: "#eee", fontSize: 14, outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s, box-shadow 0.2s",
    fontFamily: "inherit",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.7px",
    color: "rgba(200,168,75,0.85)", textTransform: "uppercase", marginBottom: 8,
  };

  return (
    <>
      <PageMeta
        title="Contacto — Shopy Crafter"
        description="Contacta con el equipo de Shopy Crafter. Respondemos en menos de 24 horas para resolver tus dudas sobre eCommerce e IA."
        canonical="https://shopycrafter.com/contacto"
      />
      <PublicLayout>

        {/* VismeFormHero — misma animación que la sección de contacto de la landing */}
        <div
          ref={heroRef}
          style={{
            position: "relative",
            width: "100%",
            minHeight: "calc(100vh - 64px)",
            overflow: "hidden",
            background: "#0e0e11",
          }}
        >
          <VismeFormHero isActive={isActive} />
        </div>

        {/* Formulario detallado + tarjetas de info */}
        <section style={{
          background: "#0a0a0c",
          padding: "80px 24px 100px",
        }}>
          <div style={{ maxWidth: 860, margin: "0 auto" }}>

            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 52 }}>
              <span style={{
                display: "inline-block", padding: "6px 18px", borderRadius: 999,
                background: GOLD_BG, color: GOLD, border: `1px solid ${GOLD_BORDER}`,
                fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase",
                marginBottom: 18,
              }}>Formulario completo</span>
              <h2 style={{
                fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 800,
                color: "#eee", marginBottom: 14, lineHeight: 1.15,
              }}>
                Cuéntanos sobre tu negocio.
              </h2>
              <p style={{
                fontSize: 16, color: "#888", lineHeight: 1.7,
                maxWidth: 540, margin: "0 auto",
              }}>
                Analizamos tu tienda con IA antes de contactarte. Respuesta personalizada en menos de 24h.
              </p>
            </div>

            {/* INFO CARDS */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16, marginBottom: 48,
            }}>
              {[
                {
                  icon: "✉️",
                  label: "Email directo",
                  value: "craftershopy@gmail.com",
                  href: "mailto:craftershopy@gmail.com",
                  accent: GOLD,
                  bg: "linear-gradient(135deg, rgba(200,168,75,0.12) 0%, rgba(200,168,75,0.03) 100%)",
                  border: GOLD_BORDER,
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
              ].map((card) => (
                <div key={card.label} style={{
                  padding: "28px 24px",
                  background: card.bg,
                  border: `1px solid ${card.border}`,
                  borderRadius: 18,
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 30, marginBottom: 12 }}>{card.icon}</div>
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
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#ccc" }}>{card.value}</div>
                  )}
                </div>
              ))}
            </div>

            {/* FORM */}
            {status === "sent" ? (
              <div style={{
                background: "rgba(45,212,159,0.06)",
                border: "1px solid rgba(45,212,159,0.25)",
                borderRadius: 20, padding: "64px 32px", textAlign: "center",
              }}>
                <div style={{ fontSize: 56, marginBottom: 20 }}>✅</div>
                <h3 style={{ fontSize: 26, fontWeight: 800, color: "#2dd49f", marginBottom: 12 }}>¡Solicitud recibida!</h3>
                <p style={{ color: "#888", fontSize: 15, marginBottom: 8, lineHeight: 1.6 }}>
                  Nuestra IA ya está analizando tu negocio, mercado, competencia y SEO.
                </p>
                <p style={{ color: "#555", fontSize: 13 }}>Te contactaremos con un informe detallado en menos de 24h.</p>
              </div>
            ) : (
              <form onSubmit={submit} style={{
                background: "linear-gradient(145deg, rgba(200,168,75,0.05) 0%, rgba(10,10,12,0) 100%)",
                border: `1px solid ${GOLD_BORDER}`,
                borderRadius: 20, padding: "44px 40px",
                display: "grid", gap: 24,
              }}>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px,100%),1fr))", gap: 18 }}>
                  <div>
                    <label style={labelStyle}>Nombre completo *</label>
                    <input type="text" required value={form.name} onChange={CF("name")}
                      placeholder="Tu nombre y apellidos" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Email de contacto *</label>
                    <input type="email" required value={form.email} onChange={CF("email")}
                      placeholder="tu@email.com" style={inputStyle} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px,100%),1fr))", gap: 18 }}>
                  <div>
                    <label style={labelStyle}>Teléfono</label>
                    <input type="tel" value={form.phone} onChange={CF("phone")}
                      placeholder="+34 600 000 000" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>URL de tu tienda</label>
                    <input type="text" value={form.storeUrl} onChange={CF("storeUrl")}
                      placeholder="mitienda.com" style={inputStyle} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px,100%),1fr))", gap: 18 }}>
                  <div>
                    <label style={labelStyle}>Nicho / tipo de productos</label>
                    <select value={form.niche} onChange={CF("niche")}
                      style={{ ...inputStyle, cursor: "pointer" }}>
                      <option value="">Selecciona tu nicho</option>
                      {nicheOptions.map(o => <option key={o}>{o}</option>)}
                    </select>
                    {form.niche === "Otro" && (
                      <input type="text" value={form.customNiche} onChange={CF("customNiche")}
                        placeholder="Describe tu nicho..." style={{ ...inputStyle, marginTop: 8 }} />
                    )}
                  </div>
                  <div>
                    <label style={labelStyle}>Facturación mensual aprox.</label>
                    <select value={form.revenue} onChange={CF("revenue")}
                      style={{ ...inputStyle, cursor: "pointer" }}>
                      <option value="">Selecciona rango</option>
                      {revenueOptions.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Redes sociales / Instagram</label>
                  <input type="text" value={form.socialMedia} onChange={CF("socialMedia")}
                    placeholder="@tu_cuenta o URL" style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>¿Qué servicios te interesan?</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
                    {serviceOptions.map(s => (
                      <button key={s} type="button" onClick={() => toggleService(s)} style={{
                        padding: "8px 16px", borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        border: `1px solid ${services.includes(s) ? GOLD_BORDER : "rgba(255,255,255,0.08)"}`,
                        background: services.includes(s) ? GOLD_BG : "transparent",
                        color: services.includes(s) ? GOLD : "#888",
                        transition: "all 0.15s",
                      }}>{s}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Mensaje</label>
                  <textarea value={form.message} onChange={CF("message")} rows={4}
                    placeholder="Cuéntanos más sobre tu tienda, tus retos actuales o lo que quieres conseguir…"
                    style={{ ...inputStyle, resize: "vertical", minHeight: 110 }} />
                </div>

                {status === "error" && (
                  <div style={{
                    padding: "12px 16px",
                    background: "rgba(232,69,88,0.08)", border: "1px solid rgba(232,69,88,0.25)",
                    borderRadius: 10, color: "#e84558", fontSize: 13,
                  }}>
                    {error}
                  </div>
                )}

                <div style={{
                  padding: "12px 18px",
                  background: "rgba(200,168,75,0.05)", border: `1px solid ${GOLD_BORDER}`,
                  borderRadius: 10, display: "flex", gap: 10, alignItems: "flex-start",
                }}>
                  <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>🔒</span>
                  <p style={{ margin: 0, fontSize: 12, color: "#666", lineHeight: 1.6 }}>
                    Tus datos se usan exclusivamente para contactarte sobre tu proyecto. Sin spam, nunca.
                  </p>
                </div>

                <div style={{
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between", gap: 16, flexWrap: "wrap",
                }}>
                  <p style={{ fontSize: 12, color: "#555", flex: 1, margin: 0 }}>
                    Respuesta personalizada en &lt;24h con análisis previo de tu tienda.
                  </p>
                  <button type="submit" disabled={status === "sending"} style={{
                    opacity: status === "sending" ? 0.7 : 1,
                    minWidth: 210, padding: "14px 32px", fontSize: 14,
                    borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 800,
                    background: "linear-gradient(135deg, #d4a843, #b8860b)",
                    color: "#000", letterSpacing: "0.5px",
                    boxShadow: "0 4px 20px rgba(200,168,75,0.25)",
                  }}>
                    {status === "sending" ? "Enviando…" : "ENVIAR SOLICITUD →"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>

      </PublicLayout>
    </>
  );
}
