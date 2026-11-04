import { useParams, Link } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import PageMeta from "@/components/PageMeta";
import { CASES } from "@/lib/casos-data";
import "./casos.css";

const SITE = "https://shopycrafter.com";

export default function CasoDeExitoDetail() {
  const { slug } = useParams<{ slug: string }>();
  const caso = CASES.find(c => c.slug === slug);

  if (!caso) {
    return (
      <PublicLayout>
        <PageMeta title="Caso no encontrado — Shopy Crafter" description="El caso que buscas no existe." canonical={`${SITE}/casos-de-exito`} noindex />
        <section className="pp-hero">
          <div className="pp-narrow" style={{ textAlign: "center" }}>
            <h1 className="pp-h1">Caso no encontrado</h1>
            <p className="pp-lead" style={{ margin: "0 auto" }}>El proyecto que buscas no existe o ha cambiado de dirección.</p>
            <div className="pp-actions" style={{ justifyContent: "center" }}>
              <Link href="/casos-de-exito" className="pp-btn pp-btn-gold">Ver todos los proyectos</Link>
            </div>
          </div>
        </section>
      </PublicLayout>
    );
  }

  const url = `${SITE}/casos-de-exito/${caso.slug}`;
  const wide = caso.images.filter(i => i.w >= i.h * 0.9);
  const gallery = caso.images;
  const galleryIsWide = wide.length >= gallery.length / 2;
  const relacionados = [
    ...CASES.filter(c => c.slug !== caso.slug && c.category === caso.category),
    ...CASES.filter(c => c.slug !== caso.slug && c.category !== caso.category),
  ].slice(0, 3);

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CreativeWork",
        "@id": url,
        url,
        name: caso.headline,
        description: caso.summary,
        keywords: caso.tech.join(", "),
        creator: { "@type": "Organization", name: "Shopy Crafter", url: SITE },
        ...(caso.images[0] ? { image: `${SITE}${caso.images[0].src}` } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Casos de éxito", item: `${SITE}/casos-de-exito` },
          { "@type": "ListItem", position: 3, name: caso.name, item: url },
        ],
      },
    ],
  };

  const [problema, ...resto] = caso.paragraphs;

  return (
    <PublicLayout>
      <PageMeta
        title={`${caso.name} — Caso de éxito · Shopy Crafter`}
        description={caso.summary}
        canonical={url}
        ogImage={caso.images[0] ? `${SITE}${caso.images[0].src}` : undefined}
        noindex
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />

      <section className="pp-hero">
        <div className="pp-wrap">
          <nav className="pp-crumbs" aria-label="Migas de pan" style={{ padding: 0, marginBottom: 28 }}>
            <Link href="/">Inicio</Link><span aria-hidden="true">/</span>
            <Link href="/casos-de-exito">Casos de éxito</Link><span aria-hidden="true">/</span>
            <span aria-current="page">{caso.name}</span>
          </nav>
          <div className="cs-detail-top">
            <div className="cs-rise">
              <span className="pp-eyebrow">{caso.category}</span>
              <h1 className="pp-h1">{caso.name}</h1>
              <p className="pp-lead">{caso.summary}</p>
              <div className="pp-actions">
                <Link href={caso.cta.href} className="pp-btn pp-btn-gold">{caso.cta.label}</Link>
                <Link href="/casos-de-exito" className="pp-btn">Ver todos los proyectos</Link>
              </div>
            </div>
            <dl className="cs-facts cs-rise" style={{ "--i": 2 } as React.CSSProperties}>
              <div><dt>Tipo de trabajo</dt><dd>{caso.niche}</dd></div>
              <div><dt>Estado</dt><dd>{caso.status}</dd></div>
              {caso.client && <div><dt>Para</dt><dd>{caso.client}</dd></div>}
              <div><dt>Hecho con</dt><dd>{caso.tech.join(" · ")}</dd></div>
            </dl>
          </div>
        </div>
      </section>

      {gallery.length > 0 && (
        <section className="pp-section" aria-labelledby="cd-capturas" style={{ paddingTop: 12 }}>
          <div className="pp-wrap">
            <h2 className="pp-h2" id="cd-capturas">Así se ve</h2>
            <p className="pp-sub">Capturas reales del sistema funcionando.</p>
            <div className={`cs-gallery${galleryIsWide ? " cs-gallery--wide" : ""}`}>
              {gallery.map(i => (
                <figure key={i.src} className="cs-shot cs-scroll">
                  <img src={i.src} alt={i.alt} width={i.w} height={i.h} loading="lazy" decoding="async" />
                  <figcaption>{i.alt}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="pp-section" aria-labelledby="cd-que">
        <div className="pp-wrap cs-two">
          <div className="pp-prose">
            <h2 id="cd-que" style={{ marginTop: 0 }}>El problema y la solución</h2>
            {problema && <p><strong>{problema}</strong></p>}
            {resto.map(p => <p key={p}>{p}</p>)}
          </div>
          <div>
            <h2 className="pp-h2" style={{ fontSize: 24 }}>Qué hace</h2>
            <ul className="cs-list">
              {caso.features.map(f => <li key={f}>{f}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="pp-section" aria-labelledby="cd-mas">
        <div className="pp-wrap">
          <h2 className="pp-h2" id="cd-mas">Otros proyectos</h2>
          <div className="cs-related">
            {relacionados.map(c => (
              <Link key={c.slug} href={`/casos-de-exito/${c.slug}`}>
                <small>{c.niche}</small>
                <b>{c.name}</b>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="pp-wrap">
        <section className="pp-cta" aria-labelledby="cd-cta">
          <h2 id="cd-cta">¿Necesitas algo parecido a {caso.name}?</h2>
          <p>Cuéntanos tu caso y te proponemos qué construir. El presupuesto se cierra por escrito antes de empezar.</p>
          <div className="pp-actions" style={{ justifyContent: "center" }}>
            <Link href="/contacto" className="pp-btn pp-btn-gold">Pedir una propuesta</Link>
            <Link href="/tienda" className="pp-btn">Ver la tienda</Link>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
