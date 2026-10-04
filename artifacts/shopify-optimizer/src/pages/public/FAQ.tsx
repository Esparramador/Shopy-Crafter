import PageMeta, { metaFor } from "@/components/PageMeta";
import PublicLayout from "@/components/PublicLayout";
import { useState } from "react";

const FAQS = [
  {
    category: "General",
    items: [
      { q: "¿Qué es Shopy Crafter?", a: "Shopy Crafter es una plataforma de IA y un equipo que la opera para tu tienda: auditoría de productos, SEO, imágenes, precios con COGS real, A/B testing, inventario y pedidos en Shopify, WooCommerce y PrestaShop, gestión de pagos con Stripe, diseño web y apps nativas." },
      { q: "¿Necesito conocimientos técnicos?", a: "No. La plataforma está diseñada para que cualquier persona pueda usarla sin ser técnico. Todo funciona con un clic o a través de nuestro chatbot de IA." },
      { q: "¿Con qué plataformas de eCommerce funciona?", a: "Conexión nativa por API con Shopify, WooCommerce (REST API v3) y PrestaShop (Webservice), y con Stripe para pagos. Cualquier otra web se puede auditar a partir de su URL pública." },
      { q: "¿Cuánto tarda en verse resultados?", a: "Depende del punto de partida de tu tienda. Por eso empezamos con una auditoría que puntúa cada producto y registramos a diario tus ingresos y pedidos reales: así mides el antes y el después con tus propios datos." },
    ],
  },
  {
    category: "Precios y planes",
    items: [
      { q: "¿Puedo probar gratis?", a: "Sí. Al activar tu cuenta tienes 14 días de prueba con 1 tienda conectada, 3 productos optimizados y 6 imágenes IA." },
      { q: "¿Puedo cancelar en cualquier momento?", a: "Sí. No hay permanencia ni penalización: cancelas desde tu portal y el plan sigue activo hasta el final del periodo ya pagado." },
      { q: "¿Qué incluye cada plan?", a: "Todos los planes incluyen las mismas funciones para 1 tienda (auditoría, SEO, pricing, A/B testing en Shopify, portal de cliente y asistente IA). Se diferencian en los productos optimizados y las imágenes IA al mes. Tienes el detalle en la sección de precios de la página principal." },
      { q: "¿Los precios incluyen IVA?", a: "Los precios mostrados no incluyen IVA. El IVA aplicable se añade en la factura de cada cobro." },
    ],
  },
  {
    category: "Motores de IA",
    items: [
      { q: "¿Qué modelos de IA utilizáis?", a: "Usamos una combinación de Claude (Anthropic), Gemini (Google) y modelos de imagen propios (Replicate). Cada motor selecciona el modelo óptimo automáticamente." },
      { q: "¿Las imágenes generadas son únicas?", a: "Sí. Cada imagen se genera específicamente para tu producto y marca. No usamos bancos de imágenes ni plantillas predefinidas." },
      { q: "¿Puedo usar el contenido generado comercialmente?", a: "Sí. Todo el contenido que generas con Shopy Crafter (textos, imágenes, informes) es tuyo para uso comercial sin restricciones." },
      { q: "¿Los audits son automáticos?", a: "Sí. Puedes configurar auditorías automáticas periódicas o lanzarlas manualmente cuando quieras. El sistema analiza tu tienda completa y genera recomendaciones accionables." },
    ],
  },
  {
    category: "Seguridad y privacidad",
    items: [
      { q: "¿Mis datos están seguros?", a: "Sí. Las conexiones van cifradas (TLS), las credenciales de tu tienda y de Stripe se guardan cifradas, y cada cliente solo accede a su propio proyecto: archivos, mensajes e informes no se comparten entre clientes. Cumplimos con el RGPD." },
      { q: "¿Compartís mis datos con terceros?", a: "No. Tus datos nunca se venden ni se ceden. Los proveedores tecnológicos que usamos (hosting, IA) actúan como encargados del tratamiento bajo contratos RGPD." },
      { q: "¿Dónde se almacenan mis datos?", a: "Los datos se tratan conforme al RGPD. Los proveedores de infraestructura e IA actúan como encargados del tratamiento; puedes pedirnos la lista en craftershopy@gmail.com." },
    ],
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.flatMap(section =>
    section.items.map(item => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    }))
  ),
};

export default function FAQ() {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setOpenItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <>
      <PageMeta {...metaFor("/faq")} />
      <PublicLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div style={{ padding: "80px 24px", maxWidth: 820, margin: "0 auto" }}>
        <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 999, background: "rgba(200,168,75,0.12)", color: "#e6c668", border: "1px solid rgba(200,168,75,0.2)", fontSize: 12, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 16 }}>FAQ</div>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 800, color: "var(--t, #eee)", marginBottom: 16, lineHeight: 1.1 }}>
          Preguntas frecuentes
        </h1>
        <p style={{ fontSize: 16, color: "var(--t3, #999)", lineHeight: 1.7, marginBottom: 48 }}>
          Todo lo que necesitas saber sobre Shopy Crafter. Si no encuentras tu respuesta, escríbenos.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          {FAQS.map(section => (
            <div key={section.category}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e6c668", marginBottom: 16, paddingBottom: 8, borderBottom: "1px solid var(--ink3, #1e1e22)" }}>{section.category}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {section.items.map(faq => {
                  const key = `${section.category}-${faq.q}`;
                  const isOpen = openItems.has(key);
                  return (
                    <div key={key} style={{
                      background: "var(--ink2, #111113)", border: "1px solid var(--ink3, #1e1e22)",
                      borderRadius: 12, overflow: "hidden", cursor: "pointer",
                    }} onClick={() => toggle(key)}>
                      <div style={{
                        padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--t, #eee)", flex: 1 }}>{faq.q}</span>
                        <span style={{ fontSize: 18, color: "var(--t4, #666)", transition: "transform 0.2s", transform: isOpen ? "rotate(45deg)" : "rotate(0)" }}>+</span>
                      </div>
                      {/* Answer is always in the DOM for SEO crawlers; visually hidden when closed */}
                      <div
                        aria-hidden={!isOpen}
                        style={{
                          padding: isOpen ? "0 20px 16px" : "0 20px",
                          maxHeight: isOpen ? "600px" : "0",
                          overflow: "hidden",
                          transition: "max-height 0.25s ease, padding 0.25s ease",
                          fontSize: 14,
                          color: "var(--t3, #999)",
                          lineHeight: 1.7,
                        }}
                      >
                        {faq.a}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 48, padding: 32, background: "rgba(200,168,75,0.06)", border: "1px solid rgba(200,168,75,0.15)", borderRadius: 16, textAlign: "center" }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--t, #eee)", marginBottom: 8 }}>¿No encuentras lo que buscas?</h3>
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
