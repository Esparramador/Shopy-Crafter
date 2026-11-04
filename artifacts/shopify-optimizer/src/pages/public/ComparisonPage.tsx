import { Fragment, useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import PageMeta from "@/components/PageMeta";
import {
  getComparisonPage, STORE_PACKS, STRIPE_PACKS,
  type ComparisonPage as Page, type Section,
} from "@/lib/comparison-data";
import "./comparison.css";

/** Texto en línea: **negrita**, `código` y [texto](/ruta). */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p.startsWith("`")) return <code key={i}>{p.slice(1, -1)}</code>;
        const m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(p);
        if (m) return m[2].startsWith("/#") ? <a key={i} href={m[2]}>{m[1]}</a> : <Link key={i} href={m[2]}>{m[1]}</Link>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

const eur = (n: number) => n.toLocaleString("es-ES");

function Packs({ set }: { set: "store" | "stripe" }) {
  const store = set === "store";
  const packs = store ? STORE_PACKS : STRIPE_PACKS;
  return (
    <section className="pp-section cmp-sec" id="packs" aria-labelledby="h-packs">
      <h2 className="pp-h2" id="h-packs">{store ? "Packs mensuales" : "Packs de Stripe"}</h2>
      <p className="cmp-intro">
        Una mensualidad por el trabajo continuo y una puesta en marcha de pago único, siempre por separado. Precios de partida, sin IVA.
      </p>
      <div className="cmp-packs">
        {packs.map(p => (
          <article key={p.name} className={`cmp-pack${"featured" in p && p.featured ? " is-feat" : ""}`}>
            <h3>{p.name}</h3>
            <div className="cmp-price"><small>desde</small><b>{eur(p.monthly)} €</b><span>/ mes</span></div>
            <ul>
              <li>Puesta en marcha desde {eur(p.setup)} € (pago único)</li>
              <li>{p.line}</li>
              <li className="m">{p.extra}</li>
              {store && (p as typeof STORE_PACKS[number]).surcharge && <li className="m">WooCommerce y PrestaShop: +{(p as typeof STORE_PACKS[number]).surcharge} €/mes</li>}
            </ul>
          </article>
        ))}
      </div>
      <p className="cmp-packs-note">
        {store
          ? "El recargo de WooCommerce y PrestaShop cubre los plugins o módulos que actualizamos y probamos cada mes y las copias que restauramos si algo se rompe. La puesta en marcha se presupuesta según lo que haya que montar. "
          : "La puesta en marcha se presupuesta según lo que haya que montar. "}
        <a href="/#fp-pricing">Ver todos los packs</a>.
      </p>
    </section>
  );
}

function SectionView({ s }: { s: Section }) {
  return (
    <section className="pp-section cmp-sec" id={s.id} aria-labelledby={`h-${s.id}`}>
      <h2 className="pp-h2" id={`h-${s.id}`}>{s.h}</h2>
      {s.intro && <p className="cmp-intro"><Rich text={s.intro} /></p>}
      {s.paras && <div className="cmp-text">{s.paras.map((p, i) => <p key={i}><Rich text={p} /></p>)}</div>}
      {s.cards && (
        <div className="cmp-cards">
          {s.cards.map(c => <div className="cmp-card" key={c.t}><h3>{c.t}</h3><p><Rich text={c.d} /></p></div>)}
        </div>
      )}
      {s.steps && (
        <ol className="cmp-steps">
          {s.steps.map(c => <li className="cmp-step" key={c.t}><h3>{c.t.replace(/^\d+\.\s*/, "")}</h3><p><Rich text={c.d} /></p></li>)}
        </ol>
      )}
      {s.bullets && <ul className="cmp-bul">{s.bullets.map((b, i) => <li key={i}><Rich text={b} /></li>)}</ul>}
      {s.note && <p className="cmp-note"><Rich text={s.note} /></p>}
    </section>
  );
}

function Toc({ items }: { items: { id: string; h: string }[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      entries => { const v = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (v) setActive(v.target.id); },
      { rootMargin: "-90px 0px -60% 0px" },
    );
    items.forEach(i => { const el = document.getElementById(i.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [items]);
  return (
    <nav className="cmp-toc" aria-label="En esta página">
      <p>En esta página</p>
      {items.map(i => <a key={i.id} href={`#${i.id}`} className={active === i.id ? "on" : ""}>{i.h}</a>)}
    </nav>
  );
}

export default function ComparisonPage() {
  const [location] = useLocation();
  const page: Page | undefined = getComparisonPage(location);

  if (!page) {
    return (
      <PublicLayout>
        <div className="pp-narrow cmp-notfound">
          <h1 className="pp-h1">Página no encontrada</h1>
          <p className="pp-lead" style={{ margin: "0 auto" }}>El contenido que buscas no existe o ha cambiado de sitio.</p>
          <div className="pp-actions" style={{ justifyContent: "center" }}>
            <Link href="/" className="pp-btn pp-btn-gold">Ir al inicio</Link>
            <Link href="/tienda" className="pp-btn">Ver la Tienda</Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const toc = [
    ...(page.table ? [{ id: "tabla", h: "Comparativa" }] : []),
    ...page.sections.map(s => ({ id: s.id, h: s.h })),
    ...(page.packs !== "none" ? [{ id: "packs", h: page.packs === "store" ? "Packs mensuales" : "Packs de Stripe" }] : []),
    ...(page.faqs.length ? [{ id: "faq", h: "Preguntas frecuentes" }] : []),
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org", "@type": "Article",
      headline: page.h1, description: page.subtitle,
      author: { "@type": "Organization", name: "Shopy Crafter" },
      publisher: { "@type": "Organization", name: "Shopy Crafter", url: "https://shopycrafter.com" },
      mainEntityOfPage: { "@type": "WebPage", "@id": page.canonical },
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Inicio", item: "https://shopycrafter.com/" },
        { "@type": "ListItem", position: 2, name: page.group },
        { "@type": "ListItem", position: 3, name: page.tag, item: page.canonical },
      ],
    },
    ...(page.faqs.length ? [{
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: page.faqs.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    }] : []),
  ];

  const asunto = encodeURIComponent(page.cta.asunto);

  return (
    <PublicLayout>
      <PageMeta title={page.metaTitle} description={page.metaDescription} canonical={page.canonical} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="pp-hero cmp-hero">
        <div className="pp-wrap">
          <nav className="pp-crumbs" aria-label="Migas de pan">
            <Link href="/">Inicio</Link><span aria-hidden="true">/</span><span>{page.group}</span><span aria-hidden="true">/</span><span aria-current="page">{page.tag}</span>
          </nav>
          <div style={{ height: 22 }} />
          <span className="pp-eyebrow cmp-fam">{page.badge}</span>
          <h1 className="pp-h1">{page.h1}</h1>
          <p className="pp-lead">{page.subtitle}</p>
          <div className="pp-actions">
            <Link href={`/contacto?asunto=${asunto}`} className="pp-btn pp-btn-gold">Hablar con nosotros →</Link>
            <a href="/#fp-pricing" className="pp-btn">Ver los packs</a>
          </div>
        </div>
      </header>

      <div className="pp-wrap">
        <div className="cmp-points">
          {page.points.map(p => <div className="cmp-point" key={p.t}><h2>{p.t}</h2><p><Rich text={p.d} /></p></div>)}
        </div>

        <div className="cmp-layout">
          <Toc items={toc} />
          <div className="cmp-body">
            {page.table && (
              <section className="pp-section cmp-sec" id="tabla" aria-label="Tabla comparativa">
                <div className="cmp-table-wrap">
                  <table className="cmp-table">
                    <caption>{page.table.caption}</caption>
                    <thead><tr>{page.table.head.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
                    <tbody>
                      {page.table.rows.map(([a, b, c]) => (
                        <tr key={a}>
                          <th scope="row">{a}</th>
                          <td data-label={page.table!.head[1]}>{b}</td>
                          <td data-label={page.table!.head[2]}>{c}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {page.table.note && <p className="cmp-note">{page.table.note}</p>}
                </div>
              </section>
            )}

            {page.sections.map(s => <SectionView key={s.id} s={s} />)}

            {page.packs !== "none" && <Packs set={page.packs} />}

            {page.faqs.length > 0 && (
              <section className="pp-section cmp-sec" id="faq" aria-labelledby="h-faq">
                <h2 className="pp-h2" id="h-faq">Preguntas frecuentes</h2>
                <div className="cmp-faq">
                  {page.faqs.map(f => (
                    <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        <aside className="pp-section" aria-labelledby="h-rel">
          <h2 className="pp-h2" id="h-rel">Sigue leyendo</h2>
          <div className="pp-grid">
            {page.related.map(r => (
              <Link key={r.href} href={r.href} className="pp-card">
                <span className="pp-tag">{r.href.startsWith("/tienda") ? "Tienda" : "Relacionado"}</span>
                <h3>{r.label}</h3>
                <p>{r.desc}</p>
              </Link>
            ))}
          </div>
        </aside>

        <section className="pp-cta" aria-labelledby="h-cta">
          <h2 id="h-cta">{page.cta.title}</h2>
          <p>{page.cta.text}</p>
          <div className="cmp-cta-actions">
            <Link href={`/contacto?asunto=${asunto}`} className="pp-btn pp-btn-gold">Contactar →</Link>
            <a href="/#fp-pricing" className="pp-btn">Ver los packs</a>
            <Link href="/tienda" className="pp-btn">Ir a la Tienda</Link>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
