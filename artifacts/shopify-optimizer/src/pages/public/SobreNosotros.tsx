import { Link } from "wouter";
import PageMeta, { metaFor } from "@/components/PageMeta";
import PublicLayout from "@/components/PublicLayout";
import { CASES } from "@/lib/casos-data";
import "./sobre-nosotros.css";

const SITE = "https://shopycrafter.com";

const PILLARS = [
  {
    title: "Tiendas y webs",
    text: "Webs que se entienden a la primera y tiendas online preparadas para vender y posicionar en Google.",
    items: [
      "Diseño y rediseño de tiendas online (Shopify, WooCommerce, PrestaShop)",
      "Landings y webs con 3D y animación al hacer scroll",
      "Auditoría SEO y optimización de velocidad (PageSpeed)",
    ],
    href: "/diseno-web-profesional",
    more: "Ver diseño web",
  },
  {
    title: "IA y automatización",
    text: "Software a medida y agentes de IA que hacen el trabajo repetitivo para que el negocio no dependa de horas de nadie.",
    items: [
      "Asistentes de WhatsApp y atención telefónica con IA",
      "TPV, cartas con QR y paneles de gestión a medida",
      "Apps Android para llevar las redes y el día a día",
    ],
    href: "/ecommerce-ia-automatizacion",
    more: "Ver automatización con IA",
  },
  {
    title: "Taller láser",
    text: "La parte física: piezas grabadas en el estudio que conectan con lo digital a través de un QR.",
    items: [
      "Tarjetas de visita en aluminio grabadas por las dos caras",
      "Placas QR de madera para reseñas, wifi, carta o pago",
      "QR artísticos con la identidad de la marca",
    ],
    href: "/tienda",
    more: "Ver la tienda",
  },
];

const STEPS = [
  { t: "Entender el problema", d: "Antes de proponer nada, miramos cómo trabaja el negocio hoy y qué le quita tiempo o ventas. La solución sale de ahí, no de una plantilla." },
  { t: "Presupuesto antes de empezar", d: "Los servicios a medida se presupuestan por escrito antes de arrancar, con la puesta en marcha y la mensualidad separadas y siempre «a partir de»." },
  { t: "Construir y probar", d: "Se construye con datos reales y se prueba antes de entregar: los QR se leen con varios móviles, los flujos se recorren de principio a fin." },
  { t: "Entregar y acompañar", d: "Entregamos el sistema funcionando y explicado, con copias de seguridad y soporte mientras siga en marcha." },
];

const VALUES = [
  { t: "Sin cifras de humo", d: "No prometemos «+300 % de ventas». Te enseñamos qué hace cada sistema, con capturas reales y su estado actual." },
  { t: "Tus datos, bajo tu control", d: "En varios de nuestros proyectos los datos viven en el ordenador del propio negocio y no en la nube de un tercero." },
  { t: "Nada se publica sin tu visto bueno", d: "La IA propone y tú decides. En las apps de redes, el contenido no sale hasta que lo aprueba quien manda." },
  { t: "Precio claro", d: "Puesta en marcha y mensualidad por separado, sin letra pequeña. Los precios de la tienda son «a partir de» y el presupuesto final se cierra por escrito." },
];

export default function SobreNosotros() {
  const enProduccion = CASES.filter(c => c.status === "En producción").length;
  const destacados = ["brasas-y-paellas", "rastalo-tpv", "warriors-hardcore"]
    .map(s => CASES.find(c => c.slug === s))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AboutPage",
        "@id": `${SITE}/sobre-nosotros`,
        url: `${SITE}/sobre-nosotros`,
        name: "Sobre Shopy Crafter",
        about: { "@type": "Organization", name: "Shopy Crafter", url: SITE },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Sobre nosotros", item: `${SITE}/sobre-nosotros` },
        ],
      },
    ],
  };

  return (
    <>
      <PageMeta {...metaFor("/sobre-nosotros")} />
      <PublicLayout>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
        <section className="pp-hero">
          <div className="pp-wrap">
            <nav className="pp-crumbs" aria-label="Migas de pan" style={{ padding: 0, marginBottom: 28 }}>
              <Link href="/">Inicio</Link><span aria-hidden="true">/</span><span aria-current="page">Sobre nosotros</span>
            </nav>
            <div className="sn-hero-grid">
              <div className="sn-rise">
                <span className="pp-eyebrow">Sobre Shopy Crafter</span>
                <h1 className="pp-h1">Webs, software con IA y un taller láser, <em>bajo el mismo techo</em>.</h1>
                <p className="pp-lead">
                  Shopy Crafter es una agencia de IA para tiendas y negocios: diseñamos webs, construimos software y agentes de IA a medida, y
                  grabamos en láser las piezas que unen lo físico con lo digital. Los proyectos que enseñamos son nuestros y se pueden
                  comprobar uno a uno.
                </p>
                <div className="pp-actions">
                  <Link href="/contacto" className="pp-btn pp-btn-gold">Cuéntanos tu proyecto</Link>
                  <Link href="/casos-de-exito" className="pp-btn">Ver los proyectos</Link>
                </div>
              </div>
              <ul className="sn-facts sn-rise" style={{ "--i": 2 } as React.CSSProperties} aria-label="Datos comprobables">
                <li><b>{CASES.length}</b><span>proyectos documentados con capturas reales, de restaurantes a marcas deportivas.</span></li>
                <li><b>{enProduccion}</b><span>de ellos ya en producción; el resto, entregados, en pruebas o en desarrollo (lo decimos en cada ficha).</span></li>
                <li><b>F2</b><span>La xTool F2, nuestra máquina láser de doble láser, graba y corta en el propio estudio.</span></li>
              </ul>
            </div>
          </div>
        </section>

        <section className="pp-section" aria-labelledby="sn-que">
          <div className="pp-wrap">
            <h2 className="pp-h2" id="sn-que">Qué hacemos</h2>
            <p className="pp-sub">Tres líneas de trabajo que se combinan: el QR de una tarjeta de aluminio puede abrir una carta digital, una galería de fotos o tu tienda.</p>
            <div className="sn-pillars">
              {PILLARS.map((p, i) => (
                <article key={p.title} className="pp-card hover sn-pillar sn-scroll">
                  <span className="sn-num" aria-hidden="true">0{i + 1}</span>
                  <h3>{p.title}</h3>
                  <p>{p.text}</p>
                  <ul>{p.items.map(it => <li key={it}>{it}</li>)}</ul>
                  <Link href={p.href} className="sn-more">{p.more} →</Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="pp-section" aria-labelledby="sn-como">
          <div className="pp-wrap">
            <h2 className="pp-h2" id="sn-como">Cómo trabajamos</h2>
            <p className="pp-sub">Un método corto y sin sorpresas, de la primera conversación a la entrega.</p>
            <ol className="sn-steps" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {STEPS.map(s => (
                <li key={s.t} className="sn-step sn-scroll"><h3>{s.t}</h3><p>{s.d}</p></li>
              ))}
            </ol>
          </div>
        </section>

        <section className="pp-section" aria-labelledby="sn-principios">
          <div className="pp-wrap">
            <h2 className="pp-h2" id="sn-principios">Lo que prometemos (y lo que no)</h2>
            <p className="pp-sub">Cuatro reglas que se cumplen en cada encargo.</p>
            <div className="sn-values">
              {VALUES.map(v => (
                <div key={v.t} className="sn-value sn-scroll"><h3>{v.t}</h3><p>{v.d}</p></div>
              ))}
            </div>
          </div>
        </section>

        <section className="pp-section" aria-labelledby="sn-proyectos">
          <div className="pp-wrap">
            <h2 className="pp-h2" id="sn-proyectos">Proyectos que lo demuestran</h2>
            <p className="pp-sub">Tres ejemplos de lo que construimos. Cada ficha cuenta qué hace el sistema, con qué está hecho y en qué estado está.</p>
            <div className="sn-work">
              {destacados.map(c => (
                <Link key={c.slug} href={`/casos-de-exito/${c.slug}`} className="sn-scroll">
                  <div className="sn-work-img">
                    {c.images[0] && <img src={c.images[0].src} alt={c.images[0].alt} loading="lazy" decoding="async" width={c.images[0].w} height={c.images[0].h} />}
                  </div>
                  <div className="sn-work-body">
                    <small>{c.niche}</small>
                    <h3>{c.name}</h3>
                    <p>{c.summary}</p>
                  </div>
                </Link>
              ))}
            </div>
            <div className="sn-links">
              <Link href="/casos-de-exito">Ver todos los proyectos →</Link>
              <Link href="/blog">Leer el blog →</Link>
              <Link href="/faq">Preguntas frecuentes →</Link>
            </div>
          </div>
        </section>

        <div className="pp-wrap">
          <section className="pp-cta" aria-labelledby="sn-cta">
            <h2 id="sn-cta">¿Tienes un problema que te quita tiempo?</h2>
            <p>Cuéntanoslo y te decimos qué se puede automatizar o mejorar, con un presupuesto por escrito antes de empezar. O mira primero lo que ya tenemos en la tienda.</p>
            <div className="pp-actions" style={{ justifyContent: "center" }}>
              <Link href="/contacto" className="pp-btn pp-btn-gold">Contactar</Link>
              <Link href="/tienda" className="pp-btn">Ir a la tienda</Link>
            </div>
          </section>
        </div>
      </PublicLayout>
    </>
  );
}
