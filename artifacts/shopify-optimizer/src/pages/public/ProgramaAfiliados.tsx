import PageMeta from "@/components/PageMeta";
import PublicLayout from "@/components/PublicLayout";

export default function ProgramaAfiliados() {
  return (
    <>
      <PageMeta
        title="Programa de Afiliados — Shopy Crafter"
        description="Recomienda Shopy Crafter y gana un 30% de comisión recurrente. Ideal para agencias, freelancers y consultores de eCommerce."
        canonical="https://shopycrafter.com/programa-de-afiliados"
      />
      <PublicLayout>
      <div style={{ padding: "80px 24px", maxWidth: 980, margin: "0 auto" }}>
        <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 999, background: "rgba(200,168,75,0.12)", color: "#e6c668", border: "1px solid rgba(200,168,75,0.2)", fontSize: 12, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 16 }}>Programa de afiliados</div>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 800, color: "var(--t, #eee)", marginBottom: 16, lineHeight: 1.1 }}>
          Recomienda Shopy Crafter y gana <em style={{ color: "#e6c668", fontStyle: "normal" }}>30% recurrente</em>.
        </h1>
        <p style={{ fontSize: 16, color: "var(--t3, #999)", lineHeight: 1.7, marginBottom: 40, maxWidth: 720 }}>
          Nuestro programa está pensado para freelancers, agencias y consultores que ya trabajan con eCommerce. Cobra por cada cliente que recomiendes mientras siga activo.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, marginBottom: 48 }}>
          {[
            { v: "30%", l: "Comisión recurrente sobre cada cuota mensual" },
            { v: "90 días", l: "Ventana de cookie de atribución" },
            { v: "60€", l: "Mínimo de retiro (Stripe / transferencia)" },
            { v: "24h", l: "Tiempo medio de aprobación de la solicitud" },
          ].map(s => (
            <div key={s.l} style={{ padding: 24, background: "var(--ink2, #111113)", border: "1px solid var(--ink3, #1e1e22)", borderRadius: 14, textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#e6c668", marginBottom: 8 }}>{s.v}</div>
              <div style={{ fontSize: 13, color: "var(--t3, #999)", lineHeight: 1.5 }}>{s.l}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: 32, background: "var(--ink2, #111113)", border: "1px solid var(--ink3, #1e1e22)", borderRadius: 16, marginBottom: 48 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20, color: "var(--t, #eee)" }}>Cómo funciona</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 24 }}>
            {[
              { num: "01", title: "Solicita acceso", text: "Rellena el formulario de contacto indicando que quieres ser afiliado. Te respondemos en menos de 24h con tu enlace único." },
              { num: "02", title: "Comparte tu enlace", text: "Envía tu enlace de afiliado a tus clientes, lectores o seguidores. Cada visita queda registrada durante 90 días." },
              { num: "03", title: "Cobra cada mes", text: "Cuando alguien se suscribe a través de tu enlace, ganas el 30% de su cuota mensual de forma recurrente mientras siga activo." },
            ].map(step => (
              <div key={step.num} style={{ display: "flex", gap: 14 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: "rgba(200,168,75,0.3)", flexShrink: 0, lineHeight: 1 }}>{step.num}</div>
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: "var(--t, #eee)", marginBottom: 6 }}>{step.title}</h4>
                  <p style={{ fontSize: 14, color: "var(--t3, #999)", lineHeight: 1.6, margin: 0 }}>{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: 32, background: "var(--ink2, #111113)", border: "1px solid var(--ink3, #1e1e22)", borderRadius: 16, marginBottom: 48 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20, color: "var(--t, #eee)" }}>Preguntas frecuentes del programa</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { q: "¿Necesito ser cliente de Shopy Crafter para ser afiliado?", a: "No. Cualquier persona o empresa puede solicitar acceso al programa, aunque recomendamos que conozcas el producto para recomendar con confianza." },
              { q: "¿Cuándo y cómo cobro?", a: "Los pagos se procesan el día 15 de cada mes por Stripe o transferencia bancaria. El mínimo de retiro es 60€." },
              { q: "¿Hay límite de referidos?", a: "No. Puedes referir tantos clientes como quieras. Más referidos = más ingresos recurrentes." },
              { q: "¿La comisión es para siempre?", a: "Mientras tu referido mantenga su suscripción activa, tú cobras el 30% cada mes. Sin límite de tiempo." },
            ].map(faq => (
              <div key={faq.q} style={{ padding: 16, background: "var(--ink, #0a0a0c)", borderRadius: 12, border: "1px solid var(--ink3, #1e1e22)" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t, #eee)", marginBottom: 6 }}>{faq.q}</div>
                <div style={{ fontSize: 13, color: "var(--t3, #999)", lineHeight: 1.6 }}>{faq.a}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: 32, background: "rgba(200,168,75,0.06)", border: "1px solid rgba(200,168,75,0.15)", borderRadius: 16, textAlign: "center" }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: "var(--t, #eee)", marginBottom: 8 }}>¿Listo para empezar a ganar?</h3>
          <p style={{ fontSize: 14, color: "var(--t3, #999)", marginBottom: 16 }}>Solicita tu acceso al programa y empieza a cobrar comisiones recurrentes.</p>
          <a href="/contacto" style={{
            display: "inline-block", padding: "12px 28px", borderRadius: 10,
            background: "linear-gradient(135deg, #d4a843, #b8860b)", color: "#000",
            fontWeight: 700, fontSize: 14, textDecoration: "none",
          }}>Solicitar acceso al programa →</a>
        </div>
      </div>
    </PublicLayout>
    </>
  );
}
