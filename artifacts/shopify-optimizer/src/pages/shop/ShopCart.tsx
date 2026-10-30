import { useEffect, useState } from "react";
import { Link } from "wouter";
import PageMeta from "@/components/PageMeta";
import { SITE_URL } from "@/seo/meta";
import ShopLayout from "./ShopLayout";
import { apiJson, cart, cartPayload, euros, useCart } from "./shop-api";

interface Quote { lines: Array<{ totalCents: number }>; subtotalCents: number; shippingCents: number; totalCents: number }

/** Carrito: el total que se muestra es el que calcula el servidor. */
export default function ShopCart() {
  const items = useCart();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const cancelled = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("cancelado");

  useEffect(() => {
    setQuote(null); setError(null);
    if (items.length === 0) return;
    let alive = true;
    apiJson<Quote>("/shop/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cartPayload(items)) })
      .then(q => { if (alive) setQuote(q); })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : "Error"); });
    return () => { alive = false; };
  }, [items]);

  const pay = async () => {
    setPaying(true); setError(null);
    try {
      const d = await apiJson<{ url: string }>("/shop/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cartPayload(items)) });
      window.location.assign(d.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar el pago");
      setPaying(false);
    }
  };

  return (
    <ShopLayout>
      <PageMeta title="Carrito — Tienda Shopy Crafter" description="Tu carrito de la tienda de Shopy Crafter." canonical={`${SITE_URL}/tienda/carrito`} noindex />
      <div className="shop-wrap shop-cart">
        <h1>Tu carrito</h1>
        {cancelled && <p className="shop-note">Has vuelto sin pagar: no se ha hecho ningún cargo. Tu carrito sigue aquí.</p>}
        {items.length === 0 ? (
          <div className="shop-empty">
            <p>Todavía no has añadido nada.</p>
            <Link href="/tienda" className="shop-btn shop-btn-gold">Ir a la tienda</Link>
          </div>
        ) : (
          <div className="shop-cart-grid">
            <ul className="shop-cart-list">
              {items.map((it, k) => (
                <li key={it.id} className="shop-cart-item">
                  {it.image ? <img src={it.image} alt="" /> : <div className="shop-cart-noimg" aria-hidden="true" />}
                  <div className="shop-cart-info">
                    <Link href={`/tienda/${it.slug}`}><strong>{it.name}</strong></Link>
                    <span>{it.variantName}{it.qty > 1 ? ` · ${it.qty} uds.` : ""}</span>
                    {it.addons.length > 0 && <span className="shop-muted">Con extras</span>}
                    {Object.keys(it.files).length > 0 && <span className="shop-muted">{Object.keys(it.files).length} {Object.keys(it.files).length === 1 ? "archivo" : "archivos"} adjunto{Object.keys(it.files).length === 1 ? "" : "s"}</span>}
                  </div>
                  <div className="shop-cart-price">
                    <strong>{euros(quote?.lines[k]?.totalCents ?? it.estimateCents)}</strong>
                    <button type="button" onClick={() => cart.remove(it.id)} aria-label={`Quitar ${it.name}`}>Quitar</button>
                  </div>
                </li>
              ))}
            </ul>
            <aside className="shop-cart-summary">
              <h2>Resumen</h2>
              <dl>
                <div><dt>Productos</dt><dd>{quote ? euros(quote.subtotalCents) : "…"}</dd></div>
                <div><dt>Envío</dt><dd>{quote ? (quote.shippingCents ? euros(quote.shippingCents) : items.some(i => i.kind === "physical") ? "Gratis" : "No aplica") : "…"}</dd></div>
                <div className="shop-total"><dt>Total</dt><dd>{quote ? euros(quote.totalCents) : "…"}</dd></div>
              </dl>
              <p className="shop-muted">IVA incluido. Pagas con tarjeta en Stripe y recibes la factura por email.</p>
              {error && <p className="shop-error" role="alert">{error}</p>}
              <button type="button" className="shop-btn shop-btn-gold shop-btn-block" disabled={!quote || paying} onClick={() => void pay()}>
                {paying ? "Abriendo el pago…" : "Pagar con tarjeta"}
              </button>
              <Link href="/tienda" className="shop-btn shop-btn-ghost shop-btn-block">Seguir comprando</Link>
            </aside>
          </div>
        )}
      </div>
    </ShopLayout>
  );
}
