import { Link } from "wouter";
import PageMeta, { metaFor } from "@/components/PageMeta";
import PublicLayout from "@/components/PublicLayout";
import "./afiliados.css";

const SITE = "https://shopycrafter.com";

const WHO = [
  { t: "Agencias y estudios", d: "Tienes un cliente que pide algo que no haces: un asistente de WhatsApp, un TPV, una app." },
  { t: "Freelancers y consultores", d: "Trabajas con tiendas online y ves a diario lo que les falta: SEO, velocidad, rediseño, automatización." },
  { t: "Gestorías, imprentas y proveedores", d: "Tus clientes te preguntan quién les puede hacer la web, la carta con QR o las tarjetas." },
];

const STEPS = [
  { t: "Cuéntanos quién eres", d: "Escríbenos desde el formulario de contacto indicando que te interesa el programa y qué tipo de clientes tienes." },
  { t: "Acordamos las condiciones por escrito", d: "No publicamos porcentajes ni plazos cerrados: fijamos contigo, antes de empezar, cómo se registra cada recomendación y cuánto y cuándo se cobra." },
  { t: "Nos presentas al cliente", d: "Del diagnóstico al presupuesto y al proyecto nos encargamos nosotros. Tú no tienes que vender ni dar soporte técnico." },
];

const OFFER = [
  { t: "Tiendas online y webs", d: "Diseño y rediseño de tiendas, landings con 3D, SEO y velocidad.", href: "/diseno-web-profesional" },
  { t: "Automatización con IA", d: "Asistentes de WhatsApp y teléfono, agentes y flujos de trabajo.", href: "/ecommerce-ia-automatizacion" },
  { t: "Software y apps a medida", d: "TPV, cartas con QR, paneles de gestión y apps Android.", href: "/desarrollo-apps-nativas" },
  { t: "Taller láser", d: "Tarjetas de aluminio, placas QR de madera y QR artísticos, en la tienda.", href: "/tienda" },
];

const FAQ = [
  { q: "¿Cuánto se cobra por recomendar?", a: "Depende de lo que se recomiende y de cómo trabajemos juntos. Por eso no ponemos una cifra única en esta página: la acordamos por escrito antes de que hagas la primera recomendación." },
  { q: "¿Qué puedo recomendar?", a: "Cualquiera de nuestros servicios: tiendas y webs, automatización con IA, software y apps a medida, y los productos del taller láser. En los proyectos puedes ver ejemplos reales de cada uno." },
  { q: "¿Qué hacéis vosotros con el cliente que recomiendo?", a: "Lo atendemos como a cualquier otro: entender su problema, presupuesto por escrito con la puesta en marcha y la mensualidad separadas, construcción, pruebas y entrega." },
  { q: "¿Cómo pido acceso?", a: "Con el formulario de contacto. Indica que te interesa el programa de afiliados, quién eres y qué clientes tienes, y te contestamos con las condiciones." },
];

export default function ProgramaAfiliados() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Programa de afiliados", item: `${SITE}/programa-de-afiliados` },
        ],
      },
    ],
  };

  return (
    <>
      <PageMeta {...metaFor("/programa-de-afiliados")} />
      <PublicLayout>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
        <section className="pp-hero">
          <div className="pp-wrap">
            <nav className="pp-crumbs" aria-label="Migas de pan" style={{ padding: 0, marginBottom: 28 }}>
              <Link href="/">Inicio</Link><span aria-hidden="true">/</span><span aria-current="page">Programa de afiliados</span>
            </nav>
            <div className="af-rise">
              <span className="pp-eyebrow">Programa de afiliados</span>
              <h1 className="pp-h1">Recomienda Shopy Crafter y <em>cobra por ello</em></h1>
              <p className="pp-lead">
                Para agencias, freelancers y consultores que ya trabajan con tiendas y negocios. Tú nos presentas a quien necesita una web, una
                automatización con IA, un software a medida o piezas del taller láser; nosotros hacemos el proyecto. Las condiciones se acuerdan
                por escrito, contigo, antes de empezar.
              </p>
              <div className="pp-actions">
                <Link href="/contacto" className="pp-btn pp-btn-gold">Solicitar acceso al programa</Link>
                <Link href="/casos-de-exito" className="pp-btn">Ver qué construimos</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="pp-section" aria-labelledby="af-quien">
          <div className="pp-wrap">
            <h2 className="pp-h2" id="af-quien">Para quién es</h2>
            <p className="pp-sub">Para quien ya tiene la confianza de otros negocios y quiere poder decirles «conozco a quien lo hace».</p>
            <ul className="af-who">
              {WHO.map(w => <li key={w.t} className="af-scroll"><b>{w.t}</b><span>{w.d}</span></li>)}
            </ul>
          </div>
        </section>

        <section className="pp-section" aria-labelledby="af-como">
          <div className="pp-wrap">
            <h2 className="pp-h2" id="af-como">Cómo funciona</h2>
            <p className="pp-sub">Tres pasos, sin enlaces de seguimiento ni letra pequeña.</p>
            <ol className="af-steps">
              {STEPS.map(s => <li key={s.t} className="af-step af-scroll"><h3>{s.t}</h3><p>{s.d}</p></li>)}
            </ol>
          </div>
        </section>

        <section className="pp-section" aria-labelledby="af-oferta">
          <div className="pp-wrap">
            <h2 className="pp-h2" id="af-oferta">Qué puedes recomendar</h2>
            <p className="pp-sub">Servicios reales, con proyectos que lo demuestran. Los precios de la tienda son siempre «a partir de».</p>
            <div className="af-offer">
              {OFFER.map(o => (
                <Link key={o.t} href={o.href} className="af-scroll"><b>{o.t}</b><span>{o.d}</span></Link>
              ))}
            </div>
          </div>
        </section>

        <section className="pp-section" aria-labelledby="af-cond">
          <div className="pp-wrap">
            <div className="af-terms">
              <h2 id="af-cond">Las condiciones, siempre por escrito</h2>
              <p>No anunciamos un porcentaje ni un plazo en esta página porque no queremos prometer algo que luego no encaje con el servicio que recomiendas. Cada acuerdo recoge, antes de la primera recomendación, cómo se registra de dónde viene cada cliente, qué se cobra y cuándo.</p>
              <p>Si prefieres ver primero lo que hacemos, repasa los <Link href="/casos-de-exito" style={{ color: "var(--pp-gold2)" }}>proyectos</Link> o la <Link href="/tienda" style={{ color: "var(--pp-gold2)" }}>tienda</Link>.</p>
            </div>
          </div>
        </section>

        <section className="pp-section" aria-labelledby="af-faq">
          <div className="pp-narrow">
            <h2 className="pp-h2" id="af-faq">Preguntas frecuentes del programa</h2>
            <div className="af-faq" style={{ marginTop: 24 }}>
              {FAQ.map(f => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
            <p className="pp-sub" style={{ marginTop: 22, marginBottom: 0 }}>¿Otra duda? Mira las <Link href="/faq" style={{ color: "var(--pp-gold2)" }}>preguntas frecuentes</Link> generales.</p>
          </div>
        </section>

        <div className="pp-wrap">
          <section className="pp-cta" aria-labelledby="af-cta">
            <h2 id="af-cta">¿Hablamos?</h2>
            <p>Escríbenos desde el formulario de contacto indicando que te interesa el programa de afiliados y te contestamos con las condiciones.</p>
            <div className="pp-actions" style={{ justifyContent: "center" }}>
              <Link href="/contacto" className="pp-btn pp-btn-gold">Solicitar acceso</Link>
            </div>
          </section>
        </div>
      </PublicLayout>
    </>
  );
}
