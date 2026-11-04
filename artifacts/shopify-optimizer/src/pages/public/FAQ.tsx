import { useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import PageMeta, { metaFor } from "@/components/PageMeta";
import PublicLayout from "@/components/PublicLayout";
import { FAQ_GROUPS } from "@/lib/faq-data";
import { slugify } from "./blog-utils";
import "./blog.css";
import "./faq.css";

/** Convierte «(/ruta)» del texto en enlaces internos; el texto de la respuesta queda tal cual en el HTML. */
function conEnlaces(text: string): ReactNode[] {
  return text.split(/(\(\/[a-z0-9#/-]+\))/g).map((part, i) => {
    const m = /^\((\/[a-z0-9#/-]+)\)$/.exec(part);
    if (!m) return part;
    const href = m[1];
    return <span key={i}>(<Link href={href}>{href}</Link>)</span>;
  });
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function FAQ() {
  const [q, setQ] = useState("");
  const needle = norm(q.trim());
  const match = (item: { q: string; a: string }) => !needle || norm(`${item.q} ${item.a}`).includes(needle);
  const total = useMemo(() => FAQ_GROUPS.reduce((n, g) => n + g.items.length, 0), []);
  const found = FAQ_GROUPS.reduce((n, g) => n + g.items.filter(match).length, 0);

  return (
    <>
      <PageMeta {...metaFor("/faq")} />
      <PublicLayout>
        <header className="pp-hero">
          <div className="pp-wrap">
            <nav className="bl-crumbs" aria-label="Migas de pan">
              <Link href="/">Inicio</Link><span className="sep" aria-hidden="true">/</span><span aria-current="page">Preguntas frecuentes</span>
            </nav>
            <span className="pp-eyebrow">Preguntas frecuentes</span>
            <h1 className="pp-h1">Todo lo que suelen <em>preguntarnos</em> antes de empezar</h1>
            <p className="pp-lead">
              Integraciones, precios, packs, Tienda, IA y privacidad, con las cifras que podemos comprobar. Si no encuentras tu duda, escríbenos.
            </p>

            <div className="fq-tools">
              <div>
                <div className="fq-search">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                  <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Busca: precios, Stripe, cancelar…" aria-label="Buscar en las preguntas frecuentes" autoComplete="off" />
                </div>
                <p className="fq-count" role="status" aria-live="polite">
                  {needle ? (found ? `${found} de ${total} preguntas` : "Sin resultados") : `${total} preguntas en ${FAQ_GROUPS.length} temas`}
                </p>
              </div>
              <nav className="fq-nav" aria-label="Temas">
                {FAQ_GROUPS.map(g => <a key={g.title} href={`#${slugify(g.title)}`}>{g.title}</a>)}
              </nav>
            </div>
          </div>
        </header>

        <section className="pp-section" style={{ paddingTop: 8 }} aria-label="Preguntas y respuestas">
          <div className="pp-wrap">
            <div className="fq-body">
              {FAQ_GROUPS.map(g => {
                const anyShown = g.items.some(match);
                return (
                  <section key={g.title} id={slugify(g.title)} className="fq-group" aria-labelledby={`h-${slugify(g.title)}`} hidden={!anyShown}>
                    <h2 id={`h-${slugify(g.title)}`}>{g.title} <small>{g.items.length}</small></h2>
                    <div className="fq-list">
                      {g.items.map(item => (
                        <details key={item.q} className="fq-item" hidden={!match(item)} open={needle && match(item) ? true : undefined}>
                          <summary>{item.q}</summary>
                          <div className="fq-a"><p>{conEnlaces(item.a)}</p></div>
                        </details>
                      ))}
                    </div>
                  </section>
                );
              })}
              {needle && found === 0 && <p className="fq-none">No hay preguntas con «{q}». Prueba con otra palabra o escríbenos y te respondemos.</p>}
            </div>

            <aside className="pp-cta" aria-labelledby="faq-cta">
              <h2 id="faq-cta">¿Sigues con dudas?</h2>
              <p>Cuéntanos tu caso y te respondemos con una propuesta por escrito. Si lo que buscas son productos del taller o servicios cerrados, entra en la Tienda.</p>
              <div className="pp-actions" style={{ justifyContent: "center" }}>
                <Link href="/contacto" className="pp-btn pp-btn-gold">Escribirnos</Link>
                <Link href="/tienda" className="pp-btn">Ver la Tienda</Link>
              </div>
            </aside>
          </div>
        </section>
      </PublicLayout>
    </>
  );
}
