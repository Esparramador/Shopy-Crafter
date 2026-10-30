import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import PageMeta, { metaFor } from "@/components/PageMeta";
import ShopLayout from "./ShopLayout";
import { apiJson, assetUrl, coverOf, euros, fromPrice, type Catalog, type Product } from "./shop-api";

gsap.registerPlugin(ScrollTrigger);
const ShopHero3D = lazy(() => import("@/components/shop/Shop3D").then(m => ({ default: m.ShopHero3D })));

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function ProductCard({ p }: { p: Product }) {
  const cover = coverOf(p);
  const video = p.media.find(m => m.type === "video");
  const vref = useRef<HTMLVideoElement>(null);
  const price = fromPrice(p);
  return (
    <Link
      href={`/tienda/${p.slug}`} className="shop-card"
      onMouseEnter={() => { if (!reduced()) vref.current?.play().catch(() => {}); }}
      onMouseLeave={() => { const v = vref.current; if (v) { v.pause(); v.currentTime = 0; } }}
    >
      <div className="shop-card-media">
        {cover ? <img src={cover} alt={p.media[0]?.alt || p.name} loading="lazy" decoding="async" /> : <div className="shop-card-noimg" aria-hidden="true"><span>Vista previa 3D con tu foto</span></div>}
        {video && cover && (
          <video ref={vref} src={assetUrl(video.url)} muted loop playsInline preload="none" aria-hidden="true" />
        )}
        {p.featured && <span className="shop-badge">Destacado</span>}
        {p.kind === "digital" && <span className="shop-badge shop-badge-digital">Digital</span>}
      </div>
      <div className="shop-card-body">
        <span className="shop-card-cat">{p.categoryLabel}</span>
        <h3>{p.name}</h3>
        <p>{p.tagline}</p>
        <div className="shop-card-foot">
          {p.kind === "quote"
            ? <strong>Presupuesto</strong>
            : <strong>{price.perUnit ? "Desde " : ""}{euros(price.cents)}{price.perUnit ? <small> / ud.</small> : null}</strong>}
          <span className="shop-card-go" aria-hidden="true">→</span>
        </div>
      </div>
    </Link>
  );
}

export default function Shop() {
  const [data, setData] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cat, setCat] = useState<string>("todo");
  const heroRef = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiJson<Catalog>("/shop/products").then(setData).catch(e => setError(e instanceof Error ? e.message : "Error"));
  }, []);

  // Entrada del hero y giro de las piezas 3D con el scroll.
  useEffect(() => {
    if (!heroRef.current) return;
    const ctx = gsap.context(() => {
      if (!reduced()) {
        gsap.from(".shop-hero-copy > *", { y: 28, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.08 });
      }
      ScrollTrigger.create({
        trigger: heroRef.current, start: "top top", end: "bottom top", scrub: true,
        onUpdate: self => { progress.current = self.progress; },
      });
    }, heroRef);
    return () => ctx.revert();
  }, []);

  // Las tarjetas y secciones aparecen al entrar en pantalla.
  useEffect(() => {
    if (!data || !root.current || reduced()) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".shop-reveal").forEach(el => {
        gsap.from(el, { y: 40, opacity: 0, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%", once: true } });
      });
      ScrollTrigger.batch(".shop-card", {
        start: "top 92%", once: true,
        onEnter: els => gsap.fromTo(els, { y: 36, opacity: 0, rotateX: -8 }, { y: 0, opacity: 1, rotateX: 0, duration: 0.7, stagger: 0.07, ease: "power3.out", overwrite: true }),
      });
    }, root);
    return () => ctx.revert();
  }, [data, cat]);

  const categories = useMemo(() => {
    if (!data) return [];
    const used = new Set(data.products.map(p => p.category));
    return Object.entries(data.categories).filter(([k]) => used.has(k));
  }, [data]);
  const products = useMemo(() => (data?.products ?? []).filter(p => cat === "todo" || p.category === cat), [data, cat]);
  const physical = products.filter(p => p.kind === "physical");
  const digital = products.filter(p => p.kind !== "physical");

  return (
    <ShopLayout>
      <PageMeta {...metaFor("/tienda")} />
      <div ref={root}>
        <section ref={heroRef} className="shop-hero">
          <div className="shop-hero-glow" aria-hidden="true" />
          <div className="shop-wrap shop-hero-grid">
            <div className="shop-hero-copy">
              <span className="shop-eyebrow">Taller láser · Estudio digital</span>
              <h1>Lo que hacemos, <em>listo para pedir.</em></h1>
              <p>Tarjetas metálicas, placas QR, expositores y fotos grabadas con nuestra xTool F2. Y también webs, rediseños de tienda y vídeo animado en 3D. Personalizas, pagas y te enviamos la prueba antes de producir.</p>
              <div className="shop-hero-ctas">
                <a href="#catalogo" className="shop-btn shop-btn-gold">Ver catálogo</a>
                <Link href="/tienda/kit-resenas" className="shop-btn shop-btn-ghost">Kit Reseñas · 199 €</Link>
              </div>
              <ul className="shop-hero-facts">
                <li><strong>0,2 mm</strong><span>aluminio anodizado</span></li>
                <li><strong>3–7 días</strong><span>envío a España</span></li>
                <li><strong>Stripe</strong><span>pago seguro</span></li>
              </ul>
            </div>
            <div className="shop-hero-stage">
              <Suspense fallback={<div className="shop-hero-canvas" aria-hidden="true" />}>
                <ShopHero3D progress={progress} />
              </Suspense>
            </div>
          </div>
        </section>

        <section className="shop-wrap shop-workshop shop-reveal" aria-labelledby="taller-h">
          <div className="shop-workshop-video">
            <video src={assetUrl("/tienda-media/taller-grabado-tarjeta.mp4")} poster={assetUrl("/tienda-media/taller-grabado-tarjeta-poster.webp")} autoPlay={!reduced()} muted loop playsInline preload="metadata" aria-label="Una tarjeta grabándose en la xTool F2" />
          </div>
          <div>
            <span className="shop-eyebrow">Del taller a tu mostrador</span>
            <h2 id="taller-h">Cada pieza sale de nuestra mesa.</h2>
            <p>Grabamos con láser infrarrojo sobre metal y con láser de diodo sobre madera, en la misma máquina. Preparamos tu diseño para el material, te enviamos la prueba y solo entonces grabamos. Los QR se comprueban con varios móviles antes del envío.</p>
            <ol className="shop-steps">
              <li><b>1</b>Eliges y personalizas</li>
              <li><b>2</b>Pagas con tarjeta</li>
              <li><b>3</b>Te enviamos la prueba</li>
              <li><b>4</b>Grabamos y te lo mandamos</li>
            </ol>
          </div>
        </section>

        <section id="catalogo" className="shop-wrap shop-catalog" aria-labelledby="catalogo-h">
          <div className="shop-catalog-head shop-reveal">
            <h2 id="catalogo-h">Catálogo</h2>
            <div className="shop-chips" role="group" aria-label="Filtrar por categoría">
              <button type="button" className={cat === "todo" ? "on" : ""} onClick={() => setCat("todo")}>Todo</button>
              {categories.map(([k, label]) => (
                <button key={k} type="button" className={cat === k ? "on" : ""} onClick={() => setCat(k)}>{label}</button>
              ))}
            </div>
          </div>
          {error && <p className="shop-error" role="alert">{error}</p>}
          {!data && !error && <div className="shop-grid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="shop-card shop-skel" />)}</div>}
          {physical.length > 0 && (
            <>
              <h3 className="shop-group-title">Hecho en el taller</h3>
              <div className="shop-grid">{physical.map(p => <ProductCard key={p.slug} p={p} />)}</div>
            </>
          )}
          {digital.length > 0 && (
            <>
              <h3 className="shop-group-title">Servicios digitales</h3>
              <div className="shop-grid">{digital.map(p => <ProductCard key={p.slug} p={p} />)}</div>
            </>
          )}
        </section>

        <section className="shop-wrap shop-faq shop-reveal" aria-labelledby="faq-h">
          <h2 id="faq-h">Antes de pedir</h2>
          <div className="shop-faq-grid">
            <details><summary>¿Veo el diseño antes de que lo grabéis?</summary><p>Sí. Tras el pago te enviamos la prueba por email y no producimos hasta que nos das el visto bueno.</p></details>
            <details><summary>¿Cuánto tarda?</summary><p>Cada producto indica su plazo de producción. El envío a España tarda de 3 a 7 días laborables y es gratis desde 60 € de productos físicos.</p></details>
            <details><summary>¿Los precios llevan IVA?</summary><p>Sí, todos los precios de la tienda incluyen IVA. Recibes la factura por email; si eres empresa, puedes poner tu NIF al pagar.</p></details>
            <details><summary>¿Y si quiero algo que no está aquí?</summary><p>Escríbenos desde <Link href="/contacto">contacto</Link> o por <a href="https://www.instagram.com/shopycrafter/" target="_blank" rel="noopener noreferrer">Instagram</a> y te preparamos un presupuesto.</p></details>
          </div>
        </section>
      </div>
    </ShopLayout>
  );
}
