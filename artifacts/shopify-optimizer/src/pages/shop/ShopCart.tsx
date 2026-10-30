import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import gsap from "gsap";
import PageMeta from "@/components/PageMeta";
import { SITE_URL } from "@/seo/meta";
import ShopLayout from "./ShopLayout";
import { FreeShipping } from "./CartDrawer";
import { apiJson, cart, cartPayload, coverOf, euros, fromPrice, loadCatalog, loadSettings, suggestions, useCart, type Product, type ShopSettings } from "./shop-api";
import { bindMagnetic, prefersReduced, useTweened } from "./shop-motion";

interface Quote { lines: Array<{ totalCents: number }>; subtotalCents: number; shippingCents: number; totalCents: number }

function Money({ cents }: { cents: number }) {
  return <>{euros(useTweened(cents))}</>;
}

/** Carrito: el total que se muestra es el que calcula el servidor. */
export default function ShopCart() {
  const items = useCart();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [more, setMore] = useState<Product[]>([]);
  const root = useRef<HTMLDivElement>(null);
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

  useEffect(() => { loadSettings().then(setSettings).catch(() => {}); }, []);
  useEffect(() => {
    loadCatalog().then(c => setMore(suggestions(c.products, items.map(i => i.slug), items.length ? 3 : 6))).catch(() => {});
  }, [items]);

  // Entrada escalonada de líneas, resumen y sugerencias.
  useEffect(() => {
    if (!root.current) return;
    const unMag = bindMagnetic(root.current);
    if (prefersReduced()) return unMag;
    const ctx = gsap.context(() => {
      gsap.from(".shop-cart-item", { x: -40, opacity: 0, duration: 0.6, stagger: 0.08, ease: "power3.out" });
      gsap.from(".shop-cart-summary", { y: 40, opacity: 0, scale: 0.96, duration: 0.8, ease: "expo.out", delay: 0.1 });
    }, root);
    return () => { ctx.revert(); unMag(); };
  }, [items.length === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!root.current || prefersReduced() || more.length === 0) return;
    const ctx = gsap.context(() => {
      gsap.from(".shop-related-card", { y: 30, opacity: 0, duration: 0.6, stagger: 0.07, ease: "power3.out" });
    }, root);
    return () => ctx.revert();
  }, [more]);

  const remove = (id: string, el: HTMLElement | null) => {
    if (!el || prefersReduced()) { cart.remove(id); return; }
    gsap.timeline({ onComplete: () => cart.remove(id) })
      .to(el, { x: 60, opacity: 0, duration: 0.3, ease: "power2.in" })
      .to(el, { height: 0, paddingTop: 0, paddingBottom: 0, marginTop: -10, borderWidth: 0, duration: 0.3, ease: "power2.inOut" });
  };

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

  const physical = quote
    ? items.reduce((t, it, k) => t + (it.kind === "physical" ? quote.lines[k]?.totalCents ?? it.estimateCents : 0), 0)
    : items.filter(i => i.kind === "physical").reduce((t, i) => t + i.estimateCents, 0);

  return (
    <ShopLayout>
      <PageMeta title="Carrito — Tienda Shopy Crafter" description="Tu carrito de la tienda de Shopy Crafter." canonical={`${SITE_URL}/tienda/carrito`} noindex />
      <div ref={root} className="shop-wrap shop-cart">
        <h1>Tu carrito</h1>
        {cancelled && <p className="shop-note">Has vuelto sin pagar: no se ha hecho ningún cargo. Tu carrito sigue aquí.</p>}
        {items.length === 0 ? (
          <div className="shop-empty">
            <p>Todavía no has añadido nada. Empieza por lo más pedido:</p>
            <div className="shop-hero-ctas" style={{ justifyContent: "center" }}>
              <Link href="/tienda/tarjetas-metalicas" className="shop-btn shop-btn-gold shop-btn-lg shop-btn-shine">Tarjetas desde 0,35 € →</Link>
              <Link href="/tienda" className="shop-btn shop-btn-ghost shop-btn-lg">Ver la tienda</Link>
            </div>
          </div>
        ) : (
          <div className="shop-cart-grid">
            <div>
              <FreeShipping physicalCents={physical} settings={settings} />
              <ul className="shop-cart-list">
                {items.map((it, k) => (
                  <li key={it.id} className="shop-cart-item" id={`ci-${it.id}`}>
                    {it.image ? <img src={it.image} alt="" /> : <div className="shop-cart-noimg" aria-hidden="true" />}
                    <div className="shop-cart-info">
                      <Link href={`/tienda/${it.slug}`}><strong>{it.name}</strong></Link>
                      <span>{it.variantName}{it.qty > 1 ? ` · ${it.qty} uds.` : ""}</span>
                      {it.addons.length > 0 && <span className="shop-muted">Con extras</span>}
                      {Object.keys(it.files).length > 0 && <span className="shop-muted">{Object.keys(it.files).length} {Object.keys(it.files).length === 1 ? "archivo adjunto" : "archivos adjuntos"}</span>}
                    </div>
                    <div className="shop-cart-price">
                      <strong><Money cents={quote?.lines[k]?.totalCents ?? it.estimateCents} /></strong>
                      <button type="button" onClick={() => remove(it.id, document.getElementById(`ci-${it.id}`))} aria-label={`Quitar ${it.name}`}>Quitar</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <aside className="shop-cart-summary">
              <h2>Resumen</h2>
              <dl>
                <div><dt>Productos</dt><dd>{quote ? <Money cents={quote.subtotalCents} /> : "…"}</dd></div>
                <div><dt>Envío</dt><dd>{quote ? (quote.shippingCents ? <Money cents={quote.shippingCents} /> : items.some(i => i.kind === "physical") ? "Gratis" : "No aplica") : "…"}</dd></div>
                <div className="shop-total"><dt>Total</dt><dd>{quote ? <Money cents={quote.totalCents} /> : "…"}</dd></div>
              </dl>
              <p className="shop-muted">IVA incluido. Pagas con tarjeta en Stripe y recibes la factura por email.</p>
              {error && <p className="shop-error" role="alert">{error}</p>}
              <button type="button" className="shop-btn shop-btn-gold shop-btn-block shop-btn-lg shop-btn-shine" disabled={!quote || paying} onClick={() => void pay()}>
                {paying ? "Abriendo el pago…" : `Pagar ${quote ? euros(quote.totalCents) : ""} con tarjeta →`}
              </button>
              <Link href="/tienda" className="shop-btn shop-btn-ghost shop-btn-block">Seguir comprando</Link>
              <ul className="shop-trust shop-trust-col">
                <li>🔒 Pago cifrado con Stripe</li>
                <li>✓ No producimos sin tu visto bueno</li>
                <li>🧾 Factura por email</li>
              </ul>
            </aside>
          </div>
        )}

        {more.length > 0 && (
          <section className="shop-related" aria-labelledby="more-h">
            <h2 id="more-h">{items.length ? "Completa tu pedido" : "Lo más pedido"}</h2>
            <div className="shop-related-grid">
              {more.map(r => {
                const cover = coverOf(r);
                const fp = fromPrice(r);
                return (
                  <Link key={r.slug} href={`/tienda/${r.slug}`} className="shop-related-card">
                    {cover ? <img src={cover} alt="" loading="lazy" /> : <span className="shop-card-noimg" />}
                    <span><b>{r.name}</b><small>{`${fp.perUnit ? "Desde " : ""}${euros(fp.cents)}${fp.perUnit ? " / ud." : ""}`}</small></span>
                    <em>Personalizar →</em>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </ShopLayout>
  );
}
