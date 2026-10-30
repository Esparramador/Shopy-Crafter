import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import gsap from "gsap";
import { euros, loadCatalog, loadSettings, suggestions, useCart, coverOf, fromPrice, type CartItem, type Product, type ShopSettings } from "./shop-api";
import { CART_OPEN, prefersReduced } from "./shop-motion";

/** Barra «te faltan X € para el envío gratis» (solo cuenta lo físico). */
export function FreeShipping({ physicalCents, settings }: { physicalCents: number; settings: ShopSettings | null }) {
  const bar = useRef<HTMLSpanElement>(null);
  const free = settings?.freeFromCents ?? 0;
  const pct = free > 0 ? Math.min(1, physicalCents / free) : 0;
  useEffect(() => {
    if (!bar.current) return;
    if (prefersReduced()) { bar.current.style.transform = `scaleX(${pct})`; return; }
    gsap.to(bar.current, { scaleX: pct, duration: 0.9, ease: "power3.out" });
  }, [pct]);
  if (!settings || free <= 0 || physicalCents <= 0) return null;
  const left = free - physicalCents;
  return (
    <div className={`shop-ship${left <= 0 ? " done" : ""}`} aria-live="polite">
      <p>{left > 0 ? <>Te faltan <b>{euros(left)}</b> para el <b>envío gratis</b></> : <>🎉 Tienes el <b>envío gratis</b></>}</p>
      <span className="shop-ship-track"><span ref={bar} className="shop-ship-bar" /></span>
    </div>
  );
}

function physicalOf(items: CartItem[]): number {
  return items.filter(i => i.kind === "physical").reduce((t, i) => t + i.estimateCents, 0);
}

/** Cajón lateral que se abre al añadir algo: lo añadido, el total, el envío gratis y sugerencias. */
export default function CartDrawer() {
  const items = useCart();
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState<CartItem | null>(null);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const shade = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      setLast((e as CustomEvent<CartItem | null>).detail ?? null);
      setOpen(true);
      loadCatalog().then(c => setCatalog(c.products)).catch(() => {});
      loadSettings().then(setSettings).catch(() => {});
    };
    window.addEventListener(CART_OPEN, onOpen);
    return () => window.removeEventListener(CART_OPEN, onOpen);
  }, []);

  useEffect(() => {
    if (!open || !panel.current || !shade.current) return;
    const prev = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    if (!prefersReduced()) {
      const tl = gsap.timeline();
      tl.fromTo(shade.current, { opacity: 0 }, { opacity: 1, duration: 0.3 })
        .fromTo(panel.current, { xPercent: 100 }, { xPercent: 0, duration: 0.6, ease: "expo.out" }, 0)
        .fromTo(panel.current.querySelectorAll(".shop-drawer-in"), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: "power3.out" }, 0.15);
    }
    return () => { window.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [open]);

  const close = () => {
    if (prefersReduced() || !panel.current || !shade.current) { setOpen(false); return; }
    gsap.timeline({ onComplete: () => setOpen(false) })
      .to(panel.current, { xPercent: 100, duration: 0.4, ease: "power3.in" })
      .to(shade.current, { opacity: 0, duration: 0.25 }, "<0.1");
  };

  if (!open) return null;
  const total = items.reduce((t, i) => t + i.estimateCents, 0);
  const more = suggestions(catalog, [...items.map(i => i.slug), last?.slug ?? ""], 3);

  return (
    <div className="shop-drawer-root">
      <div ref={shade} className="shop-drawer-shade" onClick={close} aria-hidden="true" />
      <div ref={panel} className="shop-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-h">
        <div className="shop-drawer-head shop-drawer-in">
          <h2 id="drawer-h">{last ? "¡Añadido al carrito!" : "Tu carrito"}</h2>
          <button ref={closeBtn} type="button" className="shop-drawer-x" onClick={close} aria-label="Cerrar">×</button>
        </div>

        {last && (
          <div className="shop-drawer-added shop-drawer-in">
            {last.image ? <img src={last.image} alt="" /> : <span className="shop-cart-noimg" />}
            <div>
              <strong>{last.name}</strong>
              <span>{last.variantName}{last.qty > 1 ? ` · ${last.qty} uds.` : ""}</span>
              <b>{euros(last.estimateCents)}</b>
            </div>
            <span className="shop-drawer-check" aria-hidden="true">✓</span>
          </div>
        )}

        <div className="shop-drawer-in">
          <FreeShipping physicalCents={physicalOf(items)} settings={settings} />
        </div>

        <div className="shop-drawer-sum shop-drawer-in">
          <span>{items.length} {items.length === 1 ? "producto" : "productos"} en el carrito</span>
          <strong>{euros(total)}</strong>
        </div>

        <div className="shop-drawer-ctas shop-drawer-in">
          <Link href="/tienda/carrito" className="shop-btn shop-btn-gold shop-btn-block shop-btn-shine" onClick={() => setOpen(false)}>Finalizar compra →</Link>
          <button type="button" className="shop-btn shop-btn-ghost shop-btn-block" onClick={close}>Seguir comprando</button>
        </div>

        {more.length > 0 && (
          <div className="shop-drawer-more shop-drawer-in">
            <h3>Combina con</h3>
            {more.map(p => {
              const cover = coverOf(p);
              const price = fromPrice(p);
              return (
                <Link key={p.slug} href={`/tienda/${p.slug}`} className="shop-drawer-sug" onClick={() => setOpen(false)}>
                  {cover ? <img src={cover} alt="" loading="lazy" /> : <span className="shop-cart-noimg" />}
                  <span><b>{p.name}</b><small>{price.perUnit ? "Desde " : ""}{euros(price.cents)}{price.perUnit ? " / ud." : ""}</small></span>
                  <em aria-hidden="true">→</em>
                </Link>
              );
            })}
          </div>
        )}
        <p className="shop-drawer-trust shop-drawer-in">🔒 Pago seguro con Stripe · ✓ Prueba de diseño antes de producir</p>
      </div>
    </div>
  );
}
