import type { ReactNode } from "react";
import { Link } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import "./legal.css";

export interface LegalSection { h: string; p: string }

const OTHERS = [
  { href: "/privacidad", label: "Privacidad" },
  { href: "/terminos", label: "Términos y condiciones" },
  { href: "/cookies", label: "Cookies" },
];

/** Marco común de las páginas legales: cabecera, índice, texto largo y contacto. Solo presentación. */
export default function LegalDoc({ title, lead, updated, sections, extra, current }: {
  title: string; lead: string; updated: string; sections: LegalSection[]; extra?: ReactNode; current: string;
}) {
  return (
    <PublicLayout>
      <header className="pp-hero lg-hero">
        <div className="pp-narrow">
          <nav className="pp-crumbs" aria-label="Migas de pan" style={{ paddingTop: 0, marginBottom: 20 }}>
            <Link href="/">Inicio</Link><span aria-hidden="true">/</span><span>Legal</span><span aria-hidden="true">/</span><span aria-current="page">{title}</span>
          </nav>
          <span className="pp-eyebrow">Legal</span>
          <h1 className="pp-h1">{title}</h1>
          <p className="pp-lead">{lead}</p>
          <span className="lg-updated">Última actualización: {updated}</span>
        </div>
      </header>

      <div className="pp-narrow lg-doc">
        <nav className="lg-toc" aria-label="Índice">
          <p>Índice</p>
          <ol>
            {sections.map((s, i) => <li key={s.h}><a href={`#s${i + 1}`}>{s.h}</a></li>)}
          </ol>
        </nav>

        <div className="pp-prose">
          {sections.map((s, i) => (
            <section key={s.h} id={`s${i + 1}`} className="lg-sec">
              <h2>{s.h}</h2>
              <p>{s.p}</p>
            </section>
          ))}
          {extra}
        </div>

        <p className="lg-contact">
          Para cualquier consulta sobre este documento, escríbenos a <a href="mailto:craftershopy@gmail.com">craftershopy@gmail.com</a>.
        </p>
        <nav className="lg-others" aria-label="Otros documentos legales">
          {OTHERS.filter(o => o.href !== current).map(o => <Link key={o.href} href={o.href}>{o.label}</Link>)}
        </nav>
      </div>
    </PublicLayout>
  );
}
