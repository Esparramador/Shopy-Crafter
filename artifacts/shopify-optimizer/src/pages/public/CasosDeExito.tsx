import PublicLayout from "@/components/PublicLayout";

const CASES = [
  {
    name: "Comic Crafter",
    niche: "Cómics e ilustración personalizada",
    before: "12 ventas/mes, fichas sin SEO",
    after: "+340% ventas en 90 días, 47 fichas optimizadas, 6 imágenes IA por producto",
    time: "3 meses",
    engines: ["Audit", "SEO", "Images"],
    highlight: "+340%",
  },
  {
    name: "Sakura Studio",
    niche: "Camisetas estampadas Japón-inspired",
    before: "Web sin tráfico orgánico",
    after: "Top 3 Google para 18 keywords del nicho, +210% sesiones, 4× conversión",
    time: "5 meses",
    engines: ["SEO", "A/B Testing", "WebLab"],
    highlight: "4× conv.",
  },
  {
    name: "Audit Multipart",
    niche: "Repuestos automoción B2B",
    before: "Catálogo manual, sin descripciones",
    after: "1.200 productos auto-descritos en 2 semanas, +180% leads cualificados",
    time: "2 meses",
    engines: ["Audit", "Generator", "Export"],
    highlight: "+180%",
  },
];

export default function CasosDeExito() {
  return (
    <PublicLayout>
      <div style={{ padding: "80px 24px", maxWidth: 980, margin: "0 auto" }}>
        <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 999, background: "rgba(45,212,159,0.12)", color: "var(--jade, #2dd49f)", border: "1px solid rgba(45,212,159,0.25)", fontSize: 12, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 16 }}>Casos de éxito</div>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 800, color: "var(--t, #eee)", marginBottom: 16, lineHeight: 1.1 }}>
          Resultados reales de tiendas que ya usan <em style={{ color: "var(--jade, #2dd49f)", fontStyle: "normal" }}>Shopy Crafter</em>.
        </h1>
        <p style={{ fontSize: 16, color: "var(--t3, #999)", lineHeight: 1.7, marginBottom: 48, maxWidth: 720 }}>
          Cifras verificadas con permiso de los clientes. Cada caso usa nuestros motores estándar — sin trucos, sin tráfico pagado adicional.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 24, marginBottom: 60 }}>
          {CASES.map(c => (
            <div key={c.name} style={{
              padding: 32, background: "var(--ink2, #111113)", border: "1px solid var(--ink3, #1e1e22)", borderRadius: 20,
              display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "start",
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                  <h3 style={{ fontSize: 22, fontWeight: 700, color: "var(--t, #eee)", margin: 0 }}>{c.name}</h3>
                  <span style={{ fontSize: 12, color: "#e6c668", background: "rgba(200,168,75,0.12)", padding: "3px 10px", borderRadius: 6 }}>{c.niche}</span>
                  <span style={{ fontSize: 11, color: "var(--t4, #666)" }}>⏱ {c.time}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div style={{ padding: 16, background: "rgba(232,69,88,0.06)", border: "1px solid rgba(232,69,88,0.15)", borderRadius: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t4, #666)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Antes</div>
                    <p style={{ fontSize: 14, color: "var(--t3, #999)", lineHeight: 1.5, margin: 0 }}>{c.before}</p>
                  </div>
                  <div style={{ padding: 16, background: "rgba(45,212,159,0.06)", border: "1px solid rgba(45,212,159,0.15)", borderRadius: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--jade, #2dd49f)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Después</div>
                    <p style={{ fontSize: 14, color: "var(--t, #eee)", lineHeight: 1.5, margin: 0 }}>{c.after}</p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {c.engines.map(e => (
                    <span key={e} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: "var(--ink, #0a0a0c)", border: "1px solid var(--ink3, #1e1e22)", color: "var(--t3, #999)" }}>{e}</span>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: "center", padding: "16px 20px", background: "rgba(45,212,159,0.08)", borderRadius: 14, minWidth: 90 }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "var(--jade, #2dd49f)" }}>{c.highlight}</div>
                <div style={{ fontSize: 10, color: "var(--t4, #666)", textTransform: "uppercase" }}>resultado</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: 32, background: "rgba(45,212,159,0.06)", border: "1px solid rgba(45,212,159,0.15)", borderRadius: 16, textAlign: "center" }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: "var(--t, #eee)", marginBottom: 8 }}>¿Tu tienda puede ser el próximo caso de éxito?</h3>
          <p style={{ fontSize: 14, color: "var(--t3, #999)", marginBottom: 16 }}>Cuéntanos sobre tu negocio y te decimos qué podemos hacer por ti.</p>
          <a href="/contacto" style={{
            display: "inline-block", padding: "12px 28px", borderRadius: 10,
            background: "linear-gradient(135deg, #d4a843, #b8860b)", color: "#000",
            fontWeight: 700, fontSize: 14, textDecoration: "none",
          }}>Solicitar análisis gratuito →</a>
        </div>
      </div>
    </PublicLayout>
  );
}
