import { useEffect, type ReactNode } from "react";
import { Link } from "wouter";
import SiteLinks from "@/components/SiteLinks";
import { assetUrl, useCart } from "./shop-api";
import "./shop.css";

/** Cabecera, pie y fondo comunes de /tienda. */
export default function ShopLayout({ children }: { children: ReactNode }) {
  const items = useCart();
  const count = items.length;
  useEffect(() => { window.scrollTo(0, 0); }, []);
  return (
    <div className="shop-root">
      <a href="#shop-main" className="shop-skip">Saltar al contenido</a>
      <header className="shop-nav">
        <Link href="/" className="shop-brand" aria-label="Shopy Crafter, inicio">
          <img src={assetUrl("/images/logo-sc-default.png")} alt="" width={30} height={30} />
          <span>Shopy Crafter</span>
        </Link>
        <nav className="shop-nav-links" aria-label="Tienda">
          <Link href="/tienda">Tienda</Link>
          <a href="/#fp-pricing">Packs</a>
          <a href="https://www.instagram.com/shopycrafter/" target="_blank" rel="noopener noreferrer">Instagram</a>
        </nav>
        <Link href="/tienda/carrito" className="shop-cart-btn" aria-label={`Carrito, ${count} ${count === 1 ? "producto" : "productos"}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L21 8H6.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="10" cy="20" r="1.4" fill="currentColor" /><circle cx="17" cy="20" r="1.4" fill="currentColor" />
          </svg>
          <span>Carrito</span>
          {count > 0 && <b>{count}</b>}
        </Link>
      </header>
      <main id="shop-main">{children}</main>
      <footer className="shop-footer">
        <div className="shop-wrap">
          <div className="shop-footer-top">
            <div>
              <strong>Shopy Crafter · Taller y estudio</strong>
              <p>Grabamos y cortamos con láser en Barcelona y hacemos webs, tiendas y vídeo 3D. Precios con IVA incluido. Pago seguro con Stripe.</p>
            </div>
            <ul className="shop-footer-facts">
              <li>Envío a España en 3 a 7 días laborables</li>
              <li>Prueba de diseño antes de producir</li>
              <li>Factura con cada pedido</li>
            </ul>
          </div>
          <SiteLinks />
          <p className="shop-footer-legal">
            <Link href="/terminos">Términos</Link> · <Link href="/privacidad">Privacidad</Link> · <Link href="/cookies">Cookies</Link> · <Link href="/contacto">Contacto</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
