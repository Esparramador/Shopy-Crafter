import { useState } from "react";
import { Link } from "wouter";
import PageMeta, { metaFor } from "@/components/PageMeta";
import PublicLayout from "@/components/PublicLayout";
import { CASES, CASE_CATEGORIES, type Caso } from "@/lib/casos-data";
import "./casos.css";

const SITE = "https://shopycrafter.com";

/** Zona visual de la tarjeta: panorámica, tira de móviles o ficha tipográfica (sin imagen inventada). */
function Media({ c }: { c: Caso }) {
  const tall = c.images.filter(i => i.h > i.w * 1.2).slice(0, 3);
  const wide = c.images.find(i => i.w >= i.h * 0.9);
  if (wide && (c.images[0] === wide || tall.length < 2)) {
    return (
      <div className="cs-media cs-media--wide">
        <img src={wide.src} alt={wide.alt} width={wide.w} height={wide.h} loading="lazy" decoding="async" />
      </div>
    );
  }
  if (tall.length) {
    return (
      <div className="cs-media cs-media--phones">
        {tall.map(i => <img key={i.src} src={i.src} alt={i.alt} width={i.w} height={i.h} loading="lazy" decoding="async" />)}
      </div>
    );
  }
  return <div className="cs-media cs-media--text" aria-hidden="true"><span>{c.name}</span></div>;
}

export default function CasosDeExito() {
  const [cat, setCat] = useState<string>("Todos");
  const visibles = cat === "Todos" ? CASES : CASES.filter(c => c.category === cat);

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${SITE}/casos-de-exito`,
        url: `${SITE}/casos-de-exito`,
        name: "Casos de éxito — Shopy Crafter",
        hasPart: CASES.map(c => ({ "@type": "CreativeWork", name: c.name, description: c.summary })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Casos de éxito", item: `${SITE}/casos-de-exito` },
        ],
      },
    ],
  };

  return (
    <>
      <PageMeta {...metaFor("/casos-de-exito")} />
      <PublicLayout>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
        <section className="pp-hero">
          <div className="pp-wrap">
            <nav className="pp-crumbs" aria-label="Migas de pan" style={{ padding: 0, marginBottom: 28 }}>
              <Link href="/">Inicio</Link><span aria-hidden="true">/</span><span aria-current="page">Casos de éxito</span>
            </nav>
            <div className="cs-rise">
              <span className="pp-eyebrow">Casos de éxito</span>
              <h1 className="pp-h1">Casos de éxito: <em>proyectos reales</em> que hemos construido</h1>
              <p className="pp-lead">
                Restaurantes, marcas, apps y un taller láser. En cada ficha contamos qué problema resolvía, qué hace el sistema, con qué
                está hecho y en qué estado está hoy. Sin cifras que no podamos demostrar: lo que ves son las pantallas reales.
              </p>
              <div className="pp-actions">
                <Link href="/contacto" className="pp-btn pp-btn-gold">Quiero algo parecido</Link>
                <Link href="/tienda" className="pp-btn">Ver la tienda</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="pp-section" aria-labelledby="cs-lista" style={{ paddingTop: 12 }}>
          <div className="pp-wrap">
            <h2 className="pp-h2" id="cs-lista">{CASES.length} proyectos, de la idea al sistema funcionando</h2>
            <p className="pp-sub">Filtra por tipo de trabajo o abre cualquier ficha para ver las capturas y las funciones.</p>

            <ul className="cs-filters" aria-label="Filtrar por tipo de proyecto">
              {["Todos", ...CASE_CATEGORIES].map(c => (
                <li key={c}>
                  <button type="button" className="cs-chip" aria-pressed={cat === c} onClick={() => setCat(c)}>
                    {c}{c === "Todos" ? ` (${CASES.length})` : ` (${CASES.filter(x => x.category === c).length})`}
                  </button>
                </li>
              ))}
            </ul>

            <div className="cs-grid">
              {visibles.map((c, i) => (
                <Link key={c.slug} href={`/casos-de-exito/${c.slug}`} className="cs-card cs-rise" style={{ "--i": Math.min(i, 6) } as React.CSSProperties}>
                  <div style={{ position: "relative" }}>
                    <span className="cs-badge" data-s={c.status}>{c.status}</span>
                    <Media c={c} />
                  </div>
                  <div className="cs-body">
                    <small>{c.niche}</small>
                    <h3>{c.name}</h3>
                    <p>{c.summary}</p>
                    <ul className="cs-tags" aria-label="Tecnología">
                      {c.tech.slice(0, 4).map(t => <li key={t}>{t}</li>)}
                    </ul>
                    <span className="cs-go">Ver el proyecto <span aria-hidden="true">→</span></span>
                  </div>
                </Link>
              ))}
            </div>

            <p className="cs-note">
              <span aria-hidden="true">ℹ</span>
              <span><strong>Cómo leer estas fichas.</strong> Describimos lo que hace cada sistema y su estado actual (en producción, entregado, en pruebas o en desarrollo). No publicamos porcentajes de mejora ni testimonios que no podamos documentar.</span>
            </p>
          </div>
        </section>

        <section className="pp-section" aria-labelledby="cs-mas">
          <div className="pp-wrap">
            <h2 className="pp-h2" id="cs-mas">Sigue explorando</h2>
            <div className="pp-grid">
              <Link href="/tienda" className="pp-card hover"><span className="pp-tag">Tienda</span><h3>Productos y servicios</h3><p>Tarjetas de aluminio, placas QR de madera, webs y rediseño de tiendas, con precios «a partir de».</p></Link>
              <Link href="/blog" className="pp-card hover"><span className="pp-tag">Blog</span><h3>Guías de eCommerce e IA</h3><p>SEO de producto, migraciones, pagos y automatización explicados paso a paso.</p></Link>
              <Link href="/sobre-nosotros" className="pp-card hover"><span className="pp-tag">Estudio</span><h3>Cómo trabajamos</h3><p>El método, las reglas y las tres líneas de trabajo de Shopy Crafter.</p></Link>
            </div>
          </div>
        </section>

        <div className="pp-wrap">
          <section className="pp-cta" aria-labelledby="cs-cta">
            <h2 id="cs-cta">¿Qué problema te gustaría quitarte de encima?</h2>
            <p>Cuéntanos cómo trabajas hoy y te proponemos qué construir, con presupuesto por escrito antes de empezar.</p>
            <div className="pp-actions" style={{ justifyContent: "center" }}>
              <Link href="/contacto" className="pp-btn pp-btn-gold">Pedir una propuesta</Link>
            </div>
          </section>
        </div>
      </PublicLayout>
    </>
  );
}
