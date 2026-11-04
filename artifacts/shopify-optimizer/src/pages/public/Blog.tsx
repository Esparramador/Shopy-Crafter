import { useMemo, useState } from "react";
import { Link } from "wouter";
import PageMeta, { metaFor } from "@/components/PageMeta";
import PublicLayout from "@/components/PublicLayout";
import { POSTS } from "@/lib/blog-data";
import { fechaLarga, tonoEtiqueta } from "./blog-utils";
import "./blog.css";

const ALL = "Todos";

export default function Blog() {
  const [tema, setTema] = useState(ALL);
  const sorted = useMemo(() => [...POSTS].sort((a, b) => b.date.localeCompare(a.date)), []);
  const [featured, ...rest] = sorted;
  const temas = useMemo(() => {
    const count = new Map<string, number>();
    sorted.forEach(p => count.set(p.tag, (count.get(p.tag) ?? 0) + 1));
    return [...count.entries()];
  }, [sorted]);
  const visible = (tag: string) => tema === ALL || tema === tag;
  const showFeatured = visible(featured.tag);
  const shown = rest.filter(p => visible(p.tag)).length + (showFeatured ? 1 : 0);

  return (
    <>
      <PageMeta {...metaFor("/blog")} />
      <PublicLayout>
        <header className="pp-hero bl-hero">
          <div className="pp-wrap">
            <nav className="bl-crumbs" aria-label="Migas de pan">
              <Link href="/">Inicio</Link><span className="sep" aria-hidden="true">/</span><span aria-current="page">Blog</span>
            </nav>
            <span className="pp-eyebrow">Blog</span>
            <h1 className="pp-h1">Guías de eCommerce, <em>SEO e IA</em> para tu tienda</h1>
            <p className="pp-lead">
              Comparativas de plataformas, migraciones, pagos, pricing y automatización con IA, escritas por el equipo que monta y opera estas tiendas. Cuando hablamos de cifras, te decimos de dónde salen o te pedimos que mires las tuyas.
            </p>
          </div>
        </header>

        <section className="pp-section" style={{ paddingTop: 8 }} aria-label="Artículos">
          <div className="pp-wrap">
            <div className="bl-filter" role="group" aria-label="Filtrar por tema">
              <button type="button" className="bl-chip" aria-pressed={tema === ALL} onClick={() => setTema(ALL)}>
                Todos<span className="n">{sorted.length}</span>
              </button>
              {temas.map(([tag, n]) => (
                <button key={tag} type="button" className="bl-chip" aria-pressed={tema === tag} onClick={() => setTema(tag)}>
                  {tag}<span className="n">{n}</span>
                </button>
              ))}
            </div>
            <p className="pp-sub" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", margin: -1 }} aria-live="polite">
              {shown} {shown === 1 ? "artículo" : "artículos"}
            </p>

            {showFeatured && (
              <Link href={`/blog/${featured.slug}`} className="bl-featured">
                <span className="kicker">Lo último</span>
                <div className="bl-meta">
                  <span className={`bl-tag ${tonoEtiqueta(featured.tag)}`}>{featured.tag}</span>
                  <time dateTime={featured.date}>{fechaLarga(featured.date)}</time><span className="dot" aria-hidden="true" />
                  <span>{featured.readTime} de lectura</span>
                </div>
                <h2>{featured.title}</h2>
                <p>{featured.excerpt}</p>
                <span className="bl-more">Leer el artículo <i aria-hidden="true">→</i></span>
              </Link>
            )}

            <div className="bl-grid">
              {rest.map(post => (
                <Link key={post.slug} href={`/blog/${post.slug}`} className="bl-card" hidden={!visible(post.tag)}>
                  <div className="bl-meta">
                    <span className={`bl-tag ${tonoEtiqueta(post.tag)}`}>{post.tag}</span>
                    <span>{post.readTime}</span>
                  </div>
                  <h3>{post.title}</h3>
                  <p>{post.excerpt}</p>
                  <div className="foot">
                    <time className="bl-meta" dateTime={post.date}>{fechaLarga(post.date)}</time>
                    <span className="bl-more">Leer <i aria-hidden="true">→</i></span>
                  </div>
                </Link>
              ))}
            </div>
            {shown === 0 && <p className="bl-empty">No hay artículos en este tema todavía.</p>}

            <aside className="pp-cta" aria-labelledby="blog-cta">
              <h2 id="blog-cta">¿Prefieres que lo hagamos nosotros?</h2>
              <p>Cuéntanos tu tienda y te preparamos una propuesta con lo que haríamos, en qué orden y desde cuánto. Y si lo tuyo es el taller, mira la Tienda.</p>
              <div className="pp-actions" style={{ justifyContent: "center" }}>
                <Link href="/contacto" className="pp-btn pp-btn-gold">Pedir propuesta</Link>
                <Link href="/tienda" className="pp-btn">Ver la Tienda</Link>
              </div>
            </aside>
          </div>
        </section>
      </PublicLayout>
    </>
  );
}
