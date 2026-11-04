import { Link } from "wouter";
import PageMeta, { metaFor } from "@/components/PageMeta";
import PublicLayout from "@/components/PublicLayout";
import { RELEASES } from "@/lib/changelog-data";
import { fechaLarga } from "./blog-utils";
import "./blog.css";

const tagTone = (tag: string) => (tag === "Major" ? "gold" : "jade");

export default function Changelog() {
  const last = RELEASES[0];
  return (
    <>
      <PageMeta {...metaFor("/changelog")} />
      <PublicLayout>
        <header className="pp-hero bl-hero">
          <div className="pp-wrap">
            <nav className="bl-crumbs" aria-label="Migas de pan">
              <Link href="/">Inicio</Link><span className="sep" aria-hidden="true">/</span><span aria-current="page">Novedades</span>
            </nav>
            <span className="pp-eyebrow">Novedades</span>
            <h1 className="pp-h1">Lo que hemos <em>añadido</em> a la plataforma</h1>
            <p className="pp-lead">
              Historial de versiones con las funciones nuevas y las mejoras de Shopy Crafter. El alcance de cada motor depende de tu pack y de tu plataforma: consulta cuál te corresponde en la <Link href="/faq" style={{ color: "var(--pp-gold2)" }}>sección de preguntas</Link>.
            </p>
            <div className="pp-meta"><span>Última versión: v{last.version}</span><span>Publicada el <time dateTime={last.date}>{fechaLarga(last.date)}</time></span></div>
          </div>
        </header>

        <section className="pp-section" style={{ paddingTop: 8 }} aria-label="Versiones">
          <div className="pp-wrap" style={{ maxWidth: 860 }}>
            <ol className="cl-list">
              {RELEASES.map(r => (
                <li key={r.version} className={`cl-item${r.tag === "Major" ? " major" : ""}`}>
                  <Link href={`/changelog/${r.version}`} className="cl-card">
                    <div className="cl-top">
                      <span className="cl-ver">v{r.version}</span>
                      <span className={`bl-tag ${tagTone(r.tag)}`}>{r.tag}</span>
                      <time className="bl-meta" dateTime={r.date}>{fechaLarga(r.date)}</time>
                    </div>
                    <h2>{r.title}</h2>
                    {r.description && <p>{r.description.split(". ")[0].replace(/\.$/, "")}.</p>}
                    <ul className="cl-changes">
                      {r.changes.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                    <span className="bl-more">Ver la versión completa <i aria-hidden="true">→</i></span>
                  </Link>
                </li>
              ))}
            </ol>

            <aside className="pp-cta" aria-labelledby="cl-cta">
              <h2 id="cl-cta">¿Quieres esto funcionando en tu tienda?</h2>
              <p>Te decimos qué motores te sirven, en qué orden y desde cuánto, por escrito. Y en la Tienda tienes servicios cerrados y productos del taller láser.</p>
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
