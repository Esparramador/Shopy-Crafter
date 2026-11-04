import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import SiteLinks from "./SiteLinks";
import "@/pages/public/public-pages.css";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type FooterData = {
  site: { name: string; logo: { value: string; imageUrl: string | null } };
  footer: { tagline: string; columns: { title: string; links: { label: string; href: string }[] }[]; copyright: string; badges: string[] };
};

const NAV = [
  { href: "/tienda", label: "Tienda", highlight: true },
  { href: "/automatizacion-shopify-ia", label: "Servicios" },
  { href: "/blog", label: "Blog" },
  { href: "/casos-de-exito", label: "Casos" },
  { href: "/faq", label: "Preguntas" },
  { href: "/contacto", label: "Contacto" },
];

/** Marco común de las páginas públicas: cabecera con menú móvil, contenido y pie con enlazado interno. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const [footer, setFooter] = useState<FooterData | null>(null);
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    fetch(`${API_BASE}/api/cms/content`, { credentials: "include" })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.site && d?.footer) setFooter({ site: d.site, footer: d.footer }); })
      .catch(() => {});
  }, []);

  useEffect(() => { window.scrollTo(0, 0); setOpen(false); }, [location]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const name = footer?.site.name ?? "Shopy Crafter";
  const logo = footer?.site.logo.imageUrl
    ? <img src={`${API_BASE}${footer.site.logo.imageUrl}`} alt="" width={30} height={30} className="pp-logo" />
    : <img src={`${API_BASE}/images/logo-sc-default.png`} alt="" width={30} height={30} className="pp-logo" />;

  return (
    <div className="pp-shell">
      <a href="#pp-main" className="pp-skip">Saltar al contenido</a>
      <header className="pp-nav">
        <div className="pp-nav-in">
          <Link href="/" className="pp-brand" aria-label={`${name}, inicio`}>{logo}<span>{name}</span></Link>
          <nav className="pp-links" aria-label="Principal">
            {NAV.map(n => (
              <Link key={n.href} href={n.href} className={`${n.highlight ? "hl " : ""}${location === n.href || (n.href !== "/" && location.startsWith(n.href + "/")) ? "on" : ""}`}>{n.label}</Link>
            ))}
          </nav>
          <div className="pp-nav-end">
            <Link href="/login" className="pp-login">Iniciar sesión</Link>
            <button type="button" className="pp-burger" aria-label={open ? "Cerrar el menú" : "Abrir el menú"} aria-expanded={open} aria-controls="pp-menu" onClick={() => setOpen(o => !o)}><span aria-hidden="true" /></button>
          </div>
        </div>
        {open && (
          <nav id="pp-menu" className="pp-menu" aria-label="Menú">
            {NAV.map(n => <Link key={n.href} href={n.href} className={n.highlight ? "hl" : ""}>{n.label}</Link>)}
            <Link href="/login">Iniciar sesión</Link>
          </nav>
        )}
      </header>

      <main id="pp-main" className="pp-main">{children}</main>

      <footer className="pp-footer">
        <div className="pp-footer-in">
          <div className="pp-footer-brand">
            <Link href="/" className="pp-brand">{logo}<span>{name}</span></Link>
            <p>IA para tiendas Shopify, WooCommerce y PrestaShop, gestión de Stripe, diseño web y apps nativas.</p>
          </div>
          <SiteLinks />
        </div>
        <div className="pp-footer-bar">
          <span>{footer?.footer.copyright ?? `© ${new Date().getFullYear()} Shopy Crafter`}</span>
          <a href="mailto:craftershopy@gmail.com">craftershopy@gmail.com</a>
        </div>
      </footer>
    </div>
  );
}
