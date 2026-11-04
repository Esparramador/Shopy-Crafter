import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import PageMeta from "@/components/PageMeta";
import { POSTS } from "@/lib/blog-data";
import { fechaLarga, prepararCuerpo, tonoEtiqueta } from "./blog-utils";
import "./blog.css";

const SERVICIOS: Record<string, { href: string; label: string }[]> = {
  default: [
    { href: "/ecommerce-ia-automatizacion", label: "eCommerce con IA" },
    { href: "/diseno-web-profesional", label: "Diseño web profesional" },
    { href: "/tienda", label: "La Tienda" },
  ],
  Migración: [
    { href: "/migrar-woocommerce-shopify", label: "Migrar WooCommerce a Shopify" },
    { href: "/migrar-prestashop-shopify", label: "Migrar PrestaShop a Shopify" },
    { href: "/diseno-web-profesional", label: "Diseño web profesional" },
  ],
  Pagos: [
    { href: "/shopify-stripe-pagos", label: "Stripe + Shopify" },
    { href: "/ecommerce-ia-automatizacion", label: "eCommerce con IA" },
    { href: "/tienda", label: "La Tienda" },
  ],
  Comparativa: [
    { href: "/shopify-vs-woocommerce", label: "Shopify vs WooCommerce" },
    { href: "/shopify-vs-prestashop", label: "Shopify vs PrestaShop" },
    { href: "/tienda", label: "La Tienda" },
  ],
};

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = POSTS.find(p => p.slug === slug);
  const prepared = useMemo(() => (post ? prepararCuerpo(post.body) : null), [post]);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    if (!prepared || prepared.toc.length === 0 || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id); }),
      { rootMargin: "-90px 0px -65% 0px" },
    );
    prepared.toc.forEach(t => { const el = document.getElementById(t.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [prepared]);

  if (!post || !prepared) {
    return (
      <PublicLayout>
        <PageMeta title="Artículo no encontrado — Blog de Shopy Crafter" description="El artículo que buscas no existe o ha cambiado de dirección." canonical="https://shopycrafter.com/blog" noindex />
        <div className="pp-wrap bl-nf">
          <h1 className="pp-h1">Artículo no encontrado</h1>
          <p>El artículo que buscas no existe o ha cambiado de dirección. Mira los demás en el blog.</p>
          <Link href="/blog" className="pp-btn pp-btn-gold">Ver todos los artículos</Link>
        </div>
      </PublicLayout>
    );
  }

  const related = [
    ...POSTS.filter(p => p.slug !== post.slug && p.tag === post.tag),
    ...POSTS.filter(p => p.slug !== post.slug && p.tag !== post.tag),
  ].slice(0, 3);
  const enlaces = SERVICIOS[post.tag] ?? SERVICIOS.default;

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    author: { "@type": "Organization", name: "Shopy Crafter" },
    publisher: { "@type": "Organization", name: "Shopy Crafter", url: "https://shopycrafter.com" },
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://shopycrafter.com/blog/${post.slug}` },
  };

  const toc = prepared.toc;

  return (
    <PublicLayout>
      <PageMeta
        title={`${post.title} — Blog de Shopy Crafter`}
        description={post.excerpt}
        canonical={`https://shopycrafter.com/blog/${post.slug}`}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <div className="bl-progress" aria-hidden="true" />

      <header className="bl-article-head">
        <div className="pp-wrap">
          <nav className="bl-crumbs" aria-label="Migas de pan">
            <Link href="/">Inicio</Link><span className="sep" aria-hidden="true">/</span>
            <Link href="/blog">Blog</Link><span className="sep" aria-hidden="true">/</span>
            <span aria-current="page">{post.tag}</span>
          </nav>
          <div className="bl-meta">
            <span className={`bl-tag ${tonoEtiqueta(post.tag)}`}>{post.tag}</span>
            <span>{post.readTime} de lectura</span>
          </div>
          <h1>{post.title}</h1>
          <p className="bl-standfirst">{post.excerpt}</p>
          <div className="bl-byline">
            <span className="bl-avatar" aria-hidden="true">SC</span>
            <div>
              <strong>Equipo de Shopy Crafter</strong>
              Publicado el <time dateTime={post.date}>{fechaLarga(post.date)}</time>
            </div>
          </div>
        </div>
      </header>

      <div className="pp-wrap">
        <div className="bl-layout">
          {toc.length > 1 && (
            <>
              <nav className="bl-toc-d" aria-label="Contenido del artículo">
                <h2>En este artículo</h2>
                <ol>
                  {toc.map(t => (
                    <li key={t.id}><a href={`#${t.id}`} className={active === t.id ? "on" : ""} aria-current={active === t.id ? "location" : undefined}>{t.text}</a></li>
                  ))}
                </ol>
              </nav>
              <details className="bl-toc-m">
                <summary>En este artículo</summary>
                <ol>{toc.map(t => <li key={t.id}><a href={`#${t.id}`}>{t.text}</a></li>)}</ol>
              </details>
            </>
          )}
          <article className="bl-prose-wrap">
            <div className="pp-prose bl-prose" dangerouslySetInnerHTML={{ __html: prepared.html }} />
            <p className="bl-note">
              Las cifras de terceros (tarifas de plataformas y pasarelas) cambian: confírmalas en la fuente antes de decidir. Si quieres que miremos tu caso concreto, <Link href="/contacto">escríbenos</Link>.
            </p>
            <div className="bl-links" aria-label="Te puede interesar">
              {enlaces.map(l => <Link key={l.href} href={l.href}>{l.label}</Link>)}
            </div>
          </article>
        </div>

        <aside className="pp-cta" aria-labelledby="post-cta">
          <h2 id="post-cta">¿Quieres aplicarlo a tu tienda?</h2>
          <p>Cuéntanos qué vendes y dónde, y te preparamos una propuesta por escrito, con la puesta en marcha aparte de la mensualidad y precios «desde».</p>
          <div className="pp-actions" style={{ justifyContent: "center" }}>
            <Link href="/contacto" className="pp-btn pp-btn-gold">Pedir propuesta</Link>
            <Link href="/tienda" className="pp-btn">Ver la Tienda</Link>
          </div>
        </aside>

        {related.length > 0 && (
          <section className="bl-related pp-section" aria-labelledby="rel-h" style={{ paddingTop: 0 }}>
            <h2 id="rel-h">Sigue leyendo</h2>
            <div className="bl-grid">
              {related.map(r => (
                <Link key={r.slug} href={`/blog/${r.slug}`} className="bl-card">
                  <div className="bl-meta"><span className={`bl-tag ${tonoEtiqueta(r.tag)}`}>{r.tag}</span><span>{r.readTime}</span></div>
                  <h3>{r.title}</h3>
                  <div className="foot"><time className="bl-meta" dateTime={r.date}>{fechaLarga(r.date)}</time><span className="bl-more">Leer <i aria-hidden="true">→</i></span></div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </PublicLayout>
  );
}
