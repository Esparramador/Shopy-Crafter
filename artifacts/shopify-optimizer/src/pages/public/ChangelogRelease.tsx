import { useParams, Link } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import PageMeta from "@/components/PageMeta";
import { RELEASES } from "@/lib/changelog-data";
import { fechaLarga } from "./blog-utils";
import "./blog.css";

export default function ChangelogRelease() {
  const { version } = useParams<{ version: string }>();
  const idx = RELEASES.findIndex(r => r.version === version);
  const release = idx >= 0 ? RELEASES[idx] : null;
  const newer = idx > 0 ? RELEASES[idx - 1] : null;
  const older = idx >= 0 && idx < RELEASES.length - 1 ? RELEASES[idx + 1] : null;

  if (!release) {
    return (
      <PublicLayout>
        <PageMeta title="Versión no encontrada — Novedades de Shopy Crafter" description="La versión que buscas no existe en el historial de novedades." canonical="https://shopycrafter.com/changelog" noindex />
        <div className="pp-wrap bl-nf">
          <h1 className="pp-h1">Versión no encontrada</h1>
          <p>La versión que buscas no aparece en el historial de novedades.</p>
          <Link href="/changelog" className="pp-btn pp-btn-gold">Ver todas las novedades</Link>
        </div>
      </PublicLayout>
    );
  }

  const releaseSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: `Shopy Crafter v${release.version} — ${release.title}`,
    description: release.description ?? release.changes.join(". "),
    datePublished: release.date,
    author: { "@type": "Organization", name: "Shopy Crafter" },
    publisher: { "@type": "Organization", name: "Shopy Crafter", url: "https://shopycrafter.com" },
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://shopycrafter.com/changelog/${release.version}` },
  };

  return (
    <PublicLayout>
      <PageMeta
        title={`Shopy Crafter v${release.version} — ${release.title}`}
        description={release.description ?? release.changes.slice(0, 3).join(". ")}
        canonical={`https://shopycrafter.com/changelog/${release.version}`}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(releaseSchema) }} />

      <header className="bl-article-head">
        <div className="pp-wrap" style={{ maxWidth: 860 }}>
          <nav className="bl-crumbs" aria-label="Migas de pan">
            <Link href="/">Inicio</Link><span className="sep" aria-hidden="true">/</span>
            <Link href="/changelog">Novedades</Link><span className="sep" aria-hidden="true">/</span>
            <span aria-current="page">v{release.version}</span>
          </nav>
          <div className="bl-meta">
            <span className="cl-ver">v{release.version}</span>
            <span className={`bl-tag ${release.tag === "Major" ? "gold" : "jade"}`}>{release.tag}</span>
            <time dateTime={release.date}>{fechaLarga(release.date)}</time>
          </div>
          <h1>{release.title}</h1>
          {release.description && <p className="bl-standfirst">{release.description}</p>}
        </div>
      </header>

      <div className="pp-wrap" style={{ maxWidth: 860 }}>
        <section className="pp-section" style={{ paddingTop: 12 }} aria-labelledby="cambios-h">
          <h2 id="cambios-h" className="pp-h2">Cambios incluidos</h2>
          <ul className="cl-detail-list">
            {release.changes.map((c, i) => (
              <li key={i}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                <span>{c}</span>
              </li>
            ))}
          </ul>
          <p className="bl-note">El alcance de cada función depende de tu pack y de tu plataforma (por ejemplo, los tests A/B de imagen y precio solo están en tiendas Shopify). Consulta <Link href="/faq">las preguntas frecuentes</Link> o <Link href="/contacto">escríbenos</Link>.</p>

          <nav className="cl-pn" aria-label="Otras versiones">
            {older ? <Link href={`/changelog/${older.version}`}><small>Versión anterior</small>v{older.version}: {older.title}</Link> : <span />}
            {newer ? <Link href={`/changelog/${newer.version}`} className="next"><small>Versión siguiente</small>v{newer.version}: {newer.title}</Link> : <span />}
          </nav>
        </section>

        <aside className="pp-cta" aria-labelledby="rel-cta">
          <h2 id="rel-cta">¿Quieres esto funcionando en tu tienda?</h2>
          <p>Te proponemos qué motores activar y en qué orden, por escrito y con precios «desde». También puedes mirar la Tienda.</p>
          <div className="pp-actions" style={{ justifyContent: "center" }}>
            <Link href="/contacto" className="pp-btn pp-btn-gold">Pedir propuesta</Link>
            <Link href="/tienda" className="pp-btn">Ver la Tienda</Link>
          </div>
        </aside>
      </div>
    </PublicLayout>
  );
}
