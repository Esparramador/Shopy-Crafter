import PageMeta from "@/components/PageMeta";
import PublicLayout from "@/components/PublicLayout";

export default function SobreNosotros() {
  return (
    <>
      <PageMeta
        title="Sobre Nosotros — Shopy Crafter"
        description="Conoce al equipo detrás de Shopy Crafter: ingenieros de IA y operadores de eCommerce que automatizamos el trabajo pesado para que tú crezcas."
        canonical="https://shopycrafter.com/sobre-nosotros"
      />
      <PublicLayout>
      <div style={{ padding: "80px 24px", maxWidth: 980, margin: "0 auto" }}>
        <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 999, background: "rgba(200,168,75,0.12)", color: "#e6c668", border: "1px solid rgba(200,168,75,0.2)", fontSize: 12, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 16 }}>Sobre nosotros</div>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 800, color: "var(--t, #eee)", marginBottom: 20, lineHeight: 1.1 }}>
          Una agencia donde la IA<br />hace el <em style={{ color: "#e6c668", fontStyle: "normal" }}>trabajo pesado</em>.
        </h1>
        <p style={{ fontSize: 17, color: "var(--t3, #999)", lineHeight: 1.8, marginBottom: 40, maxWidth: 760 }}>
          Shopy Crafter nació en 2024 cuando vimos que los e-commerce pequeños perdían horas al mes en tareas que la IA podía hacer en minutos: generar imágenes de producto, escribir SEO, diseñar landings, comparar competidores, encontrar proveedores. Construimos los motores propios y los pusimos en una plataforma que cualquier agencia o tienda puede usar sin ser técnico.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, marginBottom: 60 }}>
          {[
            { icon: "🎯", title: "Misión", text: "Hacer que cualquier eCommerce pueda competir como una marca grande sin contratar 8 personas." },
            { icon: "⚙️", title: "Cómo trabajamos", text: "Motores reales con Claude, Gemini y modelos de imagen propios. Sin plantillas. Cada salida es única para tu marca." },
            { icon: "🤝", title: "Quiénes somos", text: "Equipo pequeño y técnico: ingenieros de IA, diseñadores y operadores de tiendas reales con cicatrices propias." },
          ].map(c => (
            <div key={c.title} style={{ padding: 28, background: "var(--ink2, #111113)", border: "1px solid var(--ink3, #1e1e22)", borderRadius: 16 }}>
              <div style={{ fontSize: 32, marginBottom: 14 }}>{c.icon}</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--t, #eee)", marginBottom: 10 }}>{c.title}</h3>
              <p style={{ fontSize: 15, color: "var(--t3, #999)", lineHeight: 1.7, margin: 0 }}>{c.text}</p>
            </div>
          ))}
        </div>

        <div style={{ padding: 32, background: "var(--ink2, #111113)", border: "1px solid var(--ink3, #1e1e22)", borderRadius: 16, marginBottom: 40 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, color: "var(--t, #eee)" }}>Nuestra historia</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 24 }}>
            {[
              { year: "2024", title: "El inicio", text: "Empezamos optimizando fichas de producto para tiendas Shopify de amigos. Los resultados fueron tan buenos que decidimos escalar." },
              { year: "2025", title: "La plataforma", text: "Lanzamos Shopy Crafter con 17 motores de IA: auditoría, imágenes, SEO, A/B testing, pricing, diseño web y más." },
              { year: "2026", title: "OmniCore Brain", text: "Integramos ShopyBrain — un cerebro de IA que aprende de cada tienda y mejora sus recomendaciones continuamente." },
            ].map(item => (
              <div key={item.year}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#e6c668", marginBottom: 6 }}>{item.year}</div>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: "var(--t, #eee)", marginBottom: 6 }}>{item.title}</h4>
                <p style={{ fontSize: 14, color: "var(--t3, #999)", lineHeight: 1.6, margin: 0 }}>{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: 32, background: "rgba(200,168,75,0.06)", border: "1px solid rgba(200,168,75,0.15)", borderRadius: 16, textAlign: "center" }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: "var(--t, #eee)", marginBottom: 8 }}>¿Quieres trabajar con nosotros?</h3>
          <p style={{ fontSize: 14, color: "var(--t3, #999)", marginBottom: 16 }}>Escríbenos y te respondemos en menos de 24h.</p>
          <a href="/contacto" style={{
            display: "inline-block", padding: "12px 28px", borderRadius: 10,
            background: "linear-gradient(135deg, #d4a843, #b8860b)", color: "#000",
            fontWeight: 700, fontSize: 14, textDecoration: "none",
          }}>Contactar →</a>
        </div>
      </div>
    </PublicLayout>
    </>
  );
}
