import PublicLayout from "@/components/PublicLayout";
import { useState } from "react";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export default function Contacto() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", storeUrl: "", niche: "", customNiche: "", revenue: "", socialMedia: "", message: "" });
  const [services, setServices] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

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

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", background: "var(--ink, #0a0a0c)",
    border: "1px solid var(--ink3, #1e1e22)", borderRadius: 10,
    color: "var(--t, #eee)", fontSize: 14, outline: "none", boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.7px",
    color: "var(--t3, #999)", textTransform: "uppercase", marginBottom: 8,
  };

  const nicheOptions = ["Moda y ropa", "Electrónica y gadgets", "Hogar y decoración", "Belleza y cosmética", "Deporte y fitness", "Alimentación y gourmet", "Arte y coleccionismo", "Mascotas", "Joyería y accesorios", "Otro"];
  const revenueOptions = ["Menos de €1.000", "€1.000 – €5.000", "€5.000 – €15.000", "€15.000 – €50.000", "Más de €50.000"];
  const serviceOptions = ["Auditoría completa", "Generación de imágenes IA", "SEO y schemas", "A/B Testing", "Pricing y COGS", "Rediseño web", "Programa de afiliados", "Plan personalizado"];

  return (
    <PublicLayout>
      <div style={{ padding: "80px 24px", maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 999, background: "rgba(200,168,75,0.12)", color: "#e6c668", border: "1px solid rgba(200,168,75,0.2)", fontSize: 12, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 16 }}>Contacto</div>
        <h1 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, color: "var(--t, #eee)", marginBottom: 12, lineHeight: 1.15 }}>
          Cuéntanos sobre tu negocio.
        </h1>
        <p style={{ fontSize: 16, color: "var(--t3, #999)", lineHeight: 1.7, marginBottom: 40 }}>
          Te contactamos en menos de 24h. Necesitamos conocer tu tienda para personalizar cada motor de IA a tu nicho, ticket medio y modelo de negocio.
        </p>

        {status === "sent" ? (
          <div style={{
            background: "rgba(45,212,159,0.08)", border: "1px solid rgba(45,212,159,0.3)",
            borderRadius: 16, padding: "48px 32px", textAlign: "center",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h3 style={{ fontSize: 22, fontWeight: 700, color: "var(--jade, #2dd49f)", marginBottom: 8 }}>¡Solicitud recibida!</h3>
            <p style={{ color: "var(--t3, #999)", fontSize: 15, marginBottom: 12 }}>Nuestra IA ya está analizando tu negocio, mercado, competencia y SEO.</p>
            <p style={{ color: "var(--t4, #666)", fontSize: 13 }}>Te contactaremos con un informe detallado en menos de 24h. Revisa también tu carpeta de spam.</p>
          </div>
        ) : (
          <form onSubmit={submit} style={{
            background: "var(--ink2, #111113)", border: "1px solid var(--ink3, #1e1e22)",
            borderRadius: 20, padding: "36px 32px", display: "grid", gap: 22,
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 16 }}>
              <div>
                <label style={labelStyle}>Nombre completo *</label>
                <input type="text" required value={form.name} onChange={CF("name")} placeholder="Tu nombre y apellidos" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Email de contacto *</label>
                <input type="email" required value={form.email} onChange={CF("email")} placeholder="tu@email.com" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 16 }}>
              <div>
                <label style={labelStyle}>Teléfono</label>
                <input type="tel" value={form.phone} onChange={CF("phone")} placeholder="+34 600 000 000" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>URL de tu tienda online</label>
                <input type="text" value={form.storeUrl} onChange={CF("storeUrl")} placeholder="mitienda.com" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 16 }}>
              <div>
                <label style={labelStyle}>Nicho / tipo de productos</label>
                <select value={form.niche} onChange={CF("niche")} style={{ ...inputStyle, cursor: "pointer", color: form.niche ? "var(--t, #eee)" : "var(--t4, #666)" }}>
                  <option value="">Selecciona tu nicho</option>
                  {nicheOptions.map(o => <option key={o}>{o}</option>)}
                </select>
                {form.niche === "Otro" && (
                  <input type="text" value={form.customNiche} onChange={CF("customNiche")} placeholder="Describe tu nicho..." style={{ ...inputStyle, marginTop: 8 }} />
                )}
              </div>
              <div>
                <label style={labelStyle}>Facturación mensual aprox.</label>
                <select value={form.revenue} onChange={CF("revenue")} style={{ ...inputStyle, cursor: "pointer", color: form.revenue ? "var(--t, #eee)" : "var(--t4, #666)" }}>
                  <option value="">Selecciona rango</option>
                  {revenueOptions.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Redes sociales / Instagram</label>
              <input type="text" value={form.socialMedia} onChange={CF("socialMedia")} placeholder="@tu_cuenta o URL" style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>¿Qué servicios te interesan?</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {serviceOptions.map(s => (
                  <button key={s} type="button" onClick={() => toggleService(s)} style={{
                    padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    border: `1px solid ${services.includes(s) ? "rgba(200,168,75,0.5)" : "var(--ink3, #1e1e22)"}`,
                    background: services.includes(s) ? "rgba(200,168,75,0.12)" : "var(--ink, #0a0a0c)",
                    color: services.includes(s) ? "#e6c668" : "var(--t3, #999)",
                  }}>{s}</button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Mensaje</label>
              <textarea value={form.message} onChange={CF("message")} rows={4}
                placeholder="Cuéntanos más sobre tu tienda, tus retos actuales o lo que quieres conseguir…"
                style={{ ...inputStyle, resize: "vertical", minHeight: 100 }} />
            </div>

            {status === "error" && (
              <div style={{ padding: "10px 14px", background: "rgba(232,69,88,0.1)", border: "1px solid rgba(232,69,88,0.3)", borderRadius: 8, color: "#e84558", fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ padding: "12px 16px", background: "rgba(200,168,75,0.06)", border: "1px solid rgba(200,168,75,0.15)", borderRadius: 10, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>ℹ️</span>
              <p style={{ margin: 0, fontSize: 12, color: "var(--t3, #999)", lineHeight: 1.5 }}>
                Tus datos se usan exclusivamente para contactarte sobre tu proyecto. No compartimos información con terceros.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <p style={{ fontSize: 12, color: "var(--t4, #666)", flex: 1 }}>Sin spam. Solo te contactamos para hablar de tu proyecto.</p>
              <button type="submit" disabled={status === "sending"} style={{
                opacity: status === "sending" ? 0.7 : 1, minWidth: 200, padding: "13px 28px", fontSize: 14,
                borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700,
                background: "linear-gradient(135deg, #d4a843, #b8860b)", color: "#000",
              }}>
                {status === "sending" ? "Enviando…" : "CONTACTANOS"}
              </button>
            </div>
          </form>
        )}

        <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <div style={{ padding: 20, background: "var(--ink2, #111113)", border: "1px solid var(--ink3, #1e1e22)", borderRadius: 12, textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📧</div>
            <div style={{ fontSize: 13, color: "var(--t3, #999)" }}>Email</div>
            <a href="mailto:craftershopy@gmail.com" style={{ fontSize: 14, color: "#e6c668", textDecoration: "none" }}>craftershopy@gmail.com</a>
          </div>
          <div style={{ padding: 20, background: "var(--ink2, #111113)", border: "1px solid var(--ink3, #1e1e22)", borderRadius: 12, textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>⏱</div>
            <div style={{ fontSize: 13, color: "var(--t3, #999)" }}>Tiempo de respuesta</div>
            <div style={{ fontSize: 14, color: "var(--t, #eee)", fontWeight: 600 }}>Menos de 24h</div>
          </div>
          <div style={{ padding: 20, background: "var(--ink2, #111113)", border: "1px solid var(--ink3, #1e1e22)", borderRadius: 12, textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🌍</div>
            <div style={{ fontSize: 13, color: "var(--t3, #999)" }}>Ubicación</div>
            <div style={{ fontSize: 14, color: "var(--t, #eee)", fontWeight: 600 }}>España (remoto)</div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
