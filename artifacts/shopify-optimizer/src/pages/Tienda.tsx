import { useState, useEffect } from "react";
import { ShieldCheck, FileText, MessageCircle, Zap, ArrowLeft, Star, Check } from "lucide-react";
import { Link } from "wouter";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ProductVariant {
  id: string;
  title: string;
  price: { amount: string; currencyCode: string };
  compareAtPrice?: { amount: string; currencyCode: string };
  availableForSale: boolean;
  selectedOptions: { name: string; value: string }[];
}

interface Product {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  productType: string;
  tags: string[];
  priceRange: { minVariantPrice: { amount: string; currencyCode: string } };
  compareAtPriceRange?: { minVariantPrice: { amount: string; currencyCode: string } };
  images: { edges: { node: { url: string; altText: string; width: number; height: number } }[] };
  variants: { edges: { node: ProductVariant }[] };
  metafields: ({ key: string; value: string } | null)[];
}

function ProductCard({ product, onBuy }: { product: Product; onBuy: (variantId: string, title: string) => void }) {
  const [loading, setLoading] = useState(false);
  const price = parseFloat(product.priceRange.minVariantPrice.amount);
  const compareAt = parseFloat(product.compareAtPriceRange?.minVariantPrice?.amount || "0");
  const variant = product.variants.edges[0]?.node;
  const image = product.images.edges[0]?.node;
  const discount = compareAt > price ? Math.round((1 - price / compareAt) * 100) : 0;
  const isSubscription = product.productType === "subscription" || product.tags.includes("subscription");
  const isHighlight = product.metafields?.find(m => m?.key === "highlight")?.value === "true";
  const badge = product.metafields?.find(m => m?.key === "badge")?.value;

  let features: string[] = [];
  try {
    const raw = product.metafields?.find(m => m?.key === "features")?.value;
    if (raw) features = JSON.parse(raw);
  } catch { }

  async function handleBuy() {
    if (!variant?.id || !variant.availableForSale) return;
    setLoading(true);
    await onBuy(variant.id, product.title);
    setLoading(false);
  }

  return (
    <div style={{
      background: "var(--ink2, #13131f)", border: `1px solid ${isHighlight ? "rgba(200,168,75,0.35)" : "rgba(255,255,255,0.08)"}`,
      borderRadius: 20, overflow: "hidden", position: "relative",
      transition: "transform 0.25s, box-shadow 0.25s",
      boxShadow: isHighlight ? "0 0 40px rgba(200,168,75,0.12)" : "none",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-6px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 24px 48px rgba(0,0,0,0.5)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = isHighlight ? "0 0 40px rgba(200,168,75,0.12)" : "none"; }}
    >
      {isHighlight && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, #c8a84b, #e8c87b, #c8a84b, transparent)" }} />}

      {badge && (
        <div style={{
          position: "absolute", top: 16, right: 16,
          background: "#c8a84b", color: "#060400", fontSize: 11, fontWeight: 700,
          padding: "4px 10px", borderRadius: 20, letterSpacing: "0.04em",
        }}>{badge}</div>
      )}

      {image ? (
        <div style={{ height: 180, overflow: "hidden", background: "rgba(0,0,0,0.3)" }}>
          <img src={image.url} alt={image.altText || product.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
        </div>
      ) : (
        <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(200,168,75,0.07)" }}>
          <span style={{ fontSize: 40 }}>⚡</span>
        </div>
      )}

      <div style={{ padding: 24 }}>
        <div style={{ fontSize: 11, color: isSubscription ? "#10b981" : "#a78bfa", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {isSubscription ? "Servicio mensual" : "Pago único"}
        </div>

        <h3 style={{ fontSize: 18, fontWeight: 700, color: "#f0eefc", margin: "0 0 12px", lineHeight: 1.3 }}>{product.title}</h3>

        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: "#c8a84b" }}>
            €{price % 1 === 0 ? price : price.toFixed(2)}
            {isSubscription && <span style={{ fontSize: 14, fontWeight: 400, color: "#9d9db8" }}>/mes</span>}
          </span>
          {compareAt > price && (
            <>
              <span style={{ fontSize: 14, color: "#6b7280", textDecoration: "line-through" }}>€{compareAt % 1 === 0 ? compareAt : compareAt.toFixed(2)}</span>
              <span style={{ fontSize: 11, background: "#c8a84b22", color: "#c8a84b", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>-{discount}%</span>
            </>
          )}
        </div>

        {features.length > 0 ? (
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", display: "flex", flexDirection: "column", gap: 6 }}>
            {features.slice(0, 5).map((f, i) => (
              <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#c8c8e0" }}>
                <Check size={13} style={{ color: "#10b981", marginTop: 2, flexShrink: 0 }} />
                {f}
              </li>
            ))}
          </ul>
        ) : product.descriptionHtml ? (
          <div style={{ fontSize: 13, color: "#9d9db8", marginBottom: 20, lineHeight: 1.6 }}
            dangerouslySetInnerHTML={{ __html: product.descriptionHtml.substring(0, 180) + "..." }} />
        ) : null}

        <button onClick={handleBuy} disabled={!variant?.availableForSale || loading}
          style={{
            width: "100%", padding: "13px 24px", borderRadius: 10, border: "none", cursor: variant?.availableForSale ? "pointer" : "not-allowed",
            background: isHighlight ? "linear-gradient(135deg, #c8a84b, #e8c87b)" : "rgba(255,255,255,0.08)",
            color: isHighlight ? "#060400" : "#f0eefc",
            fontWeight: 700, fontSize: 15, transition: "all 0.2s", opacity: loading ? 0.7 : 1,
          }}>
          {loading ? "Procesando..." : !variant?.availableForSale ? "No disponible" : isSubscription ? "Suscribirse →" : "Adquirir →"}
        </button>
      </div>
    </div>
  );
}

export default function Tienda() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/store/products`)
      .then(r => r.json())
      .then(d => { setProducts(d.products || []); setLoading(false); })
      .catch(() => { setError("Tienda temporalmente no disponible"); setLoading(false); });
  }, []);

  async function handleBuy(variantId: string, title: string) {
    setBuying(true);
    try {
      const res = await fetch(`${API}/api/store/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, quantity: 1 }),
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        alert("Error al crear el checkout. Inténtalo de nuevo.");
      }
    } catch {
      alert("Error de conexión. Inténtalo de nuevo.");
    }
    setBuying(false);
  }

  const oneTimeProducts = products.filter(p => p.productType !== "subscription" && !p.tags.includes("subscription"));
  const subscriptionProducts = products.filter(p => p.productType === "subscription" || p.tags.includes("subscription"));

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#f0eefc" }}>
      {/* Nav */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(10,10,15,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "14px 48px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#f0eefc" }}>
          <ArrowLeft size={16} style={{ color: "#c8a84b" }} />
          <span style={{ fontSize: 13, color: "#9d9db8" }}>Volver</span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18, color: "#c8a84b" }}>⚡</span>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.3px" }}>ShopifyAI Pro</span>
        </div>
        <div />
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "120px 48px 80px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(200,168,75,0.12)", border: "1px solid rgba(200,168,75,0.25)", borderRadius: 100, padding: "6px 16px", fontSize: 12, color: "#c8a84b", fontWeight: 600, letterSpacing: "0.06em", marginBottom: 24, textTransform: "uppercase" }}>
            Adquirir ShopifyAI Pro
          </div>
          <h1 style={{ fontSize: "clamp(38px, 5vw, 62px)", fontWeight: 300, letterSpacing: "-2px", lineHeight: 1.1, marginBottom: 16 }}>
            Elige tu <em style={{ fontStyle: "italic", color: "#c8a84b" }}>pack</em>
          </h1>
          <p style={{ fontSize: 17, color: "#9d9db8", fontWeight: 300, maxWidth: 500, margin: "0 auto" }}>
            Pago único. Tuyo para siempre. Sin suscripciones obligatorias.
          </p>
        </div>

        {loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, marginBottom: 40 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 380, background: "rgba(255,255,255,0.04)", borderRadius: 20, animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        )}

        {error && (
          <div style={{ textAlign: "center", padding: 48, color: "#6b7280" }}>
            <p style={{ fontSize: 16, marginBottom: 8 }}>⚠️ {error}</p>
            <p style={{ fontSize: 13 }}>Los productos estarán disponibles en breve.</p>
          </div>
        )}

        {!loading && !error && oneTimeProducts.length > 0 && (
          <>
            <div style={{ marginBottom: 16, textAlign: "center" }}>
              <span style={{ display: "inline-block", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)", borderRadius: 100, padding: "5px 16px", fontSize: 11, color: "#a78bfa", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Capa 1 · Venta directa — pago único, tuyo para siempre
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, marginBottom: 60 }}>
              {oneTimeProducts.map(p => <ProductCard key={p.id} product={p} onBuy={handleBuy} />)}
            </div>
          </>
        )}

        {!loading && !error && subscriptionProducts.length > 0 && (
          <>
            <div style={{ marginBottom: 16, textAlign: "center" }}>
              <span style={{ display: "inline-block", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 100, padding: "5px 16px", fontSize: 11, color: "#10b981", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Capa 2 · Servicio mensual OPCIONAL — cobrado por Shopify cada mes
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 60 }}>
              {subscriptionProducts.map(p => <ProductCard key={p.id} product={p} onBuy={handleBuy} />)}
            </div>
          </>
        )}

        {!loading && !error && products.length === 0 && (
          <div style={{ textAlign: "center", padding: "64px 24px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🛒</div>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: "#f0eefc", marginBottom: 8 }}>Tienda en preparación</h2>
            <p style={{ color: "#9d9db8", fontSize: 14 }}>Los packs estarán disponibles muy pronto.</p>
          </div>
        )}

        {/* Trust */}
        <div style={{ display: "flex", justifyContent: "center", gap: 40, flexWrap: "wrap", paddingTop: 40, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {[
            { icon: <ShieldCheck size={18} />, text: "Pago seguro vía Shopify" },
            { icon: <FileText size={18} />, text: "Factura incluida" },
            { icon: <MessageCircle size={18} />, text: "Soporte por WhatsApp" },
            { icon: <Zap size={18} />, text: "Setup en 24-48h" },
          ].map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9d9db8" }}>
              <span style={{ color: "#c8a84b" }}>{t.icon}</span>
              {t.text}
            </div>
          ))}
        </div>

        {/* How it works */}
        <div style={{ marginTop: 60, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "28px 32px", textAlign: "center" }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "#f0eefc", marginBottom: 12 }}>¿Cómo cobra Shopify el servicio mensual a tus clientes?</h3>
          <p style={{ fontSize: 13, color: "#9d9db8", maxWidth: 600, margin: "0 auto", lineHeight: 1.8 }}>
            Crea un producto "Servicio de gestión mensual" en tu tienda Shopify con precio recurrente.<br />
            El cliente se suscribe una vez → Shopify lo cobra automáticamente cada mes.<br />
            <strong style={{ color: "#c8a84b" }}>Tú recibes el dinero → gestionas su tienda → todos contentos.</strong><br />
            <span style={{ fontSize: 12, color: "#6b7280" }}>Sin Stripe · Sin LemonSqueezy · Sin nada nuevo · Ya lo tienes todo</span>
          </p>
        </div>
      </div>
    </div>
  );
}
