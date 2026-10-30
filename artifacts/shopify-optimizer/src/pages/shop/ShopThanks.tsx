import { useEffect, useState } from "react";
import { Link } from "wouter";
import PageMeta from "@/components/PageMeta";
import { SITE_URL } from "@/seo/meta";
import ShopLayout from "./ShopLayout";
import { apiJson, cart, euros } from "./shop-api";

interface Order {
  token: string; status: string; totalCents: number; shippingCents: number; hasPhysical: boolean; email: string | null;
  lines: Array<{ name: string; variant: string; qty: number; totalCents: number; addons: string[] }>;
}

/** Vuelta de Stripe: comprueba el pago con el servidor y enseña el pedido. */
export default function ShopThanks() {
  const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const token = q.get("pedido") ?? "";
  const session = q.get("session_id") ?? "";
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError("Falta el número de pedido."); return; }
    const path = session ? `/shop/checkout/verify?session_id=${encodeURIComponent(session)}&pedido=${encodeURIComponent(token)}` : `/shop/orders/${encodeURIComponent(token)}`;
    apiJson<Order>(path)
      .then(o => { setOrder(o); if (o.status !== "pending" && o.status !== "expired") cart.clear(); })
      .catch(e => setError(e instanceof Error ? e.message : "Error"));
  }, [token, session]);

  const paid = order && !["pending", "expired", "cancelled"].includes(order.status);
  return (
    <ShopLayout>
      <PageMeta title="Pedido — Tienda Shopy Crafter" description="Estado de tu pedido." canonical={`${SITE_URL}/tienda`} noindex />
      <div className="shop-wrap shop-thanks">
        {error && <div className="shop-empty"><h1>No pudimos cargar tu pedido</h1><p>{error}</p><Link href="/contacto" className="shop-btn shop-btn-gold">Escríbenos</Link></div>}
        {!error && !order && <div className="shop-empty" aria-busy="true"><h1>Comprobando tu pago…</h1></div>}
        {order && (
          <>
            <span className="shop-eyebrow">Pedido {order.token.slice(0, 8).toUpperCase()}</span>
            <h1>{paid ? "¡Gracias! Tu pedido está en marcha." : "Tu pago aún no está confirmado."}</h1>
            <p>{paid
              ? `Te hemos enviado la confirmación${order.email ? ` a ${order.email}` : ""}. En breve te escribimos con la prueba de diseño; no producimos nada hasta que nos des el visto bueno.`
              : "Si acabas de pagar, espera unos segundos y recarga. Si no completaste el pago, tu carrito sigue guardado."}</p>
            <ul className="shop-thanks-lines">
              {order.lines.map((l, i) => (
                <li key={i}><span>{l.name} · {l.variant}{l.qty > 1 ? ` × ${l.qty}` : ""}{l.addons.length ? ` (+ ${l.addons.join(", ")})` : ""}</span><strong>{euros(l.totalCents)}</strong></li>
              ))}
              {order.hasPhysical && <li><span>Envío</span><strong>{order.shippingCents ? euros(order.shippingCents) : "Gratis"}</strong></li>}
              <li className="shop-total"><span>Total con IVA</span><strong>{euros(order.totalCents)}</strong></li>
            </ul>
            <div className="shop-hero-ctas">
              <Link href="/tienda" className="shop-btn shop-btn-gold">Volver a la tienda</Link>
              {!paid && <Link href="/tienda/carrito" className="shop-btn shop-btn-ghost">Ir al carrito</Link>}
            </div>
          </>
        )}
      </div>
    </ShopLayout>
  );
}
