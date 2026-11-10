import { Fragment, lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Flip } from "gsap/Flip";
import { Bot, Megaphone, MessageCircle, Smartphone } from "lucide-react";
import PageMeta, { metaFor } from "@/components/PageMeta";
import ShopLayout from "./ShopLayout";
import { assetUrl, coverOf, euros, fromPrice, loadCatalog, priceLabel, serviceMark, variantFromPrice, type Catalog, type Product } from "./shop-api";
import { AI_SERVICES_CATEGORY, SHOP_SERVICE_OFFERS, shopServiceContactHref, type ShopServiceOffer } from "./shop-services";
import { bindMagnetic, bindTilt, prefersReduced } from "./shop-motion";

gsap.registerPlugin(ScrollTrigger, Flip);
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
const ShopHero3D = lazy(() => import("@/components/shop/Shop3D").then(m => ({ default: m.ShopHero3D })));

/** Envuelve cada palabra para la entrada por líneas del titular. */
function Words({ text }: { text: string }) {
  const words = text.split(" ");
  return <>{words.map((w, i) => <Fragment key={i}><span className="shop-w"><span>{w}</span></span>{i < words.length - 1 ? " " : null}</Fragment>)}</>;
}

const MARQUEE = ["Stands con QR para reseñas, wifi o carta", "Tarjetas con foto y mensaje", "Grabado láser en Barcelona", "Prueba de diseño antes de producir", "Envío gratis desde 60 €", "Pago seguro con Stripe", "Webs, Google y reseñas · precios a partir de"];

function ProductCard({ p }: { p: Product }) {
  const cover = coverOf(p);
  const video = p.media.find(m => m.type === "video");
  const vref = useRef<HTMLVideoElement>(null);
  const label = priceLabel(p);
  return (
    <Link
      href={`/tienda/${p.slug}`} className="shop-card" data-flip-id={p.slug}
      onMouseEnter={() => { if (!prefersReduced()) vref.current?.play().catch(() => {}); }}
      onMouseLeave={() => { const v = vref.current; if (v) { v.pause(); v.currentTime = 0; } }}
    >
      <div className="shop-card-media">
        {cover ? <img src={cover} alt={p.media[0]?.alt || p.name} loading="lazy" decoding="async" /> : p.kind === "quote"
          ? <div className="shop-card-noimg shop-card-service-art" aria-hidden="true">
              <strong>{serviceMark(p.slug)}</strong>
              <span>{p.categoryLabel}</span>
            </div>
          : <div className="shop-card-noimg" aria-hidden="true"><span>{p.name}</span></div>}
        {video && cover && <video ref={vref} src={assetUrl(video.url)} muted loop playsInline preload="none" aria-hidden="true" />}
        {p.demoUrl && <span className="shop-card-demo">▶ Demo en vivo</span>}
        {p.featured && <span className="shop-badge">Destacado</span>}
        {p.kind === "digital" && <span className="shop-badge shop-badge-digital">Digital</span>}
        <span className="shop-card-cta" aria-hidden="true">{p.kind === "quote" ? "Pedir presupuesto" : "Personalizar y pedir"} →</span>
        <span className="shop-card-glare" aria-hidden="true" />
      </div>
      <div className="shop-card-body">
        <span className="shop-card-cat">{p.categoryLabel}</span>
        <h3>{p.name}</h3>
        <p>{p.tagline}</p>
        <div className="shop-card-foot">
          {label
            ? <strong>{label.prefix}{euros(label.cents)}{label.suffix ? <small>{label.suffix}</small> : null}</strong>
            : <strong>Presupuesto</strong>}
          <span className="shop-card-go" aria-hidden="true">→</span>
        </div>
      </div>
    </Link>
  );
}

const OFFER_ICONS = {
  assistant: MessageCircle,
  chatbot: Bot,
  custom: Smartphone,
  ads: Megaphone,
} as const;

function ShopServiceCard({ offer }: { offer: ShopServiceOffer }) {
  const Icon = OFFER_ICONS[offer.icon];
  return (
    <article className="shop-ai-card">
      <div className="shop-ai-card-icon" aria-hidden="true"><Icon size={21} strokeWidth={1.8} /></div>
      <span className="shop-card-cat">{offer.group === "ads" ? "Google Ads" : "Agentes de IA"}</span>
      <h4>{offer.name}</h4>
      <p>{offer.description}</p>
      <ul className="shop-ai-variants">
        {offer.variants.map(variant => (
          <li key={variant.label}>
            <div><strong>{variant.label}</strong><span>{variant.detail}</span></div>
            <Link className="shop-ai-quote" href={shopServiceContactHref(variant.subject)}>
              Pedir presupuesto <span aria-hidden="true">→</span>
            </Link>
          </li>
        ))}
      </ul>
      <small className="shop-ai-note">
        {offer.group === "ads"
          ? "Presupuesto por escrito antes de empezar. La inversión publicitaria va aparte."
          : "Presupuesto por escrito antes de empezar; la puesta en marcha se acuerda aparte."}
      </small>
    </article>
  );
}

export default function Shop() {
  const [data, setData] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cat, setCat] = useState<string>("todo");
  const [hero3DReady, setHero3DReady] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const root = useRef<HTMLDivElement>(null);
  const flipState = useRef<Flip.FlipState | null>(null);
  const promoPrice = useRef<HTMLElement>(null);

  useEffect(() => {
    loadCatalog().then(setData).catch(e => setError(e instanceof Error ? e.message : "Error"));
  }, []);

  // Retrasa el módulo 3D hasta que la página ya haya pintado el contenido principal.
  useEffect(() => {
    const idleWindow = window as unknown as {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(() => setHero3DReady(true), { timeout: 1800 });
      return () => idleWindow.cancelIdleCallback?.(handle);
    }
    const handle = window.setTimeout(() => setHero3DReady(true), 700);
    return () => window.clearTimeout(handle);
  }, []);

  const kit = data?.products.find(p => p.slug === "kit-resenas");
  const kitPrice = kit?.variants[0]?.tiers[0]?.unitCents;
  const cards = data?.products.find(p => p.slug === "tarjetas-metalicas");
  const cardFrom = cards ? fromPrice(cards).cents : null;
  const oneFace = cards?.variants.find(v => v.key === "una-cara");
  const doubleFace = cards?.variants.find(v => v.key === "doble-cara");
  const oneFaceCents = oneFace ? variantFromPrice(oneFace) : null;
  const doubleFaceCents = doubleFace ? variantFromPrice(doubleFace) : null;

  // Portada: titular palabra a palabra, CTA y giro 3D con el scroll.
  useEffect(() => {
    if (!heroRef.current) return;
    const ctx = gsap.context(() => {
      if (!prefersReduced()) {
        const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
        tl.from(".shop-hero .shop-eyebrow", { y: 20, opacity: 0, duration: 0.6 })
          .from(".shop-hero h1 .shop-w > span", { yPercent: 115, rotate: 6, duration: 1, stagger: 0.06 }, "-=0.3")
          .from(".shop-hero-copy > p, .shop-hero-ctas > *, .shop-hero-facts li", { y: 26, opacity: 0, duration: 0.7, stagger: 0.07 }, "-=0.6")
          .from(".shop-hero-stage", { scale: 0.85, opacity: 0, duration: 1.2 }, 0.2);
        gsap.to(".shop-hero-glow", { yPercent: 25, ease: "none", scrollTrigger: { trigger: heroRef.current, start: "top top", end: "bottom top", scrub: true } });
      }
      ScrollTrigger.create({
        trigger: heroRef.current, start: "top top", end: "bottom top", scrub: true,
        onUpdate: self => { progress.current = self.progress; },
      });
    }, heroRef);
    return () => ctx.revert();
  }, []);

  // Cinta infinita que acelera con la velocidad del scroll.
  useEffect(() => {
    if (!root.current || prefersReduced()) return;
    const ctx = gsap.context(() => {
      const loop = gsap.to(".shop-marquee-track", { xPercent: -50, duration: 28, ease: "none", repeat: -1 });
      ScrollTrigger.create({
        start: 0, end: "max",
        onUpdate: self => {
          const v = Math.min(4, 1 + Math.abs(self.getVelocity()) / 600);
          gsap.to(loop, { timeScale: self.direction < 0 ? -v : v, duration: 0.2, overwrite: true });
          gsap.to(loop, { timeScale: self.direction < 0 ? -1 : 1, duration: 1.2, delay: 0.2, overwrite: false });
        },
      });
    }, root);
    return () => ctx.revert();
  }, []);

  // Secciones, bloques de oferta y tarjetas al entrar en pantalla.
  useEffect(() => {
    if (!data || !root.current || prefersReduced()) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".shop-reveal").forEach(el => {
        gsap.from(el, { y: 50, opacity: 0, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%", once: true } });
      });
      ScrollTrigger.batch(".shop-card", {
        start: "top 92%", once: true,
        onEnter: els => gsap.fromTo(els, { y: 60, opacity: 0, rotateX: -14, scale: 0.94 }, { y: 0, opacity: 1, rotateX: 0, scale: 1, duration: 0.85, stagger: 0.08, ease: "power3.out", overwrite: "auto" }),
      });
      // Bloque de tarjetas: imagen con parallax y precio que cuenta hasta el precio de catálogo.
      gsap.fromTo(".shop-offer-media img", { yPercent: -12, scale: 1.15 }, { yPercent: 12, scale: 1.05, ease: "none", scrollTrigger: { trigger: ".shop-offer", start: "top bottom", end: "bottom top", scrub: true } });
      gsap.fromTo(promoPrice.current, { scale: 0.4, opacity: 0, rotate: -8 }, { scale: 1, opacity: 1, rotate: 0, duration: 1.1, ease: "elastic.out(1, 0.45)", scrollTrigger: { trigger: ".shop-offer", start: "top 75%", once: true } });
      gsap.from(".shop-offer-list li", { x: -30, opacity: 0, stagger: 0.08, duration: 0.6, ease: "power3.out", scrollTrigger: { trigger: ".shop-offer", start: "top 70%", once: true } });
      gsap.from(".shop-band", { scale: 0.92, opacity: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: ".shop-band", start: "top 85%", once: true } });
    }, root);
    return () => ctx.revert();
  }, [data, cardFrom]);

  // Inclinación de tarjetas y botones magnéticos (se vuelven a enlazar al cambiar de categoría).
  useEffect(() => {
    if (!data || !root.current) return;
    const unTilt = bindTilt(root.current);
    const unMag = bindMagnetic(root.current);
    return () => { unTilt(); unMag(); };
  }, [data, cat]);

  // Cambio de categoría: las tarjetas se recolocan con Flip.
  const pickCat = (k: string) => {
    if (k === cat) return;
    if (!prefersReduced()) flipState.current = Flip.getState(".shop-card[data-flip-id]");
    setCat(k);
  };
  useIsoLayoutEffect(() => {
    const state = flipState.current;
    if (!state) return;
    flipState.current = null;
    Flip.from(state, {
      duration: 0.7, ease: "power3.inOut", prune: true,
      onEnter: els => gsap.fromTo(els, { opacity: 0, scale: 0.85, y: 30 }, { opacity: 1, scale: 1, y: 0, duration: 0.6, stagger: 0.05, ease: "back.out(1.4)" }),
    });
    ScrollTrigger.refresh();
  }, [cat]);

  const categories = useMemo((): Array<[string, string]> => {
    const used = new Set((data?.products ?? []).map(p => p.category));
    const catalogCategories = Object.entries(data?.categories ?? {}).filter(([k]) => used.has(k));
    return [...catalogCategories, [AI_SERVICES_CATEGORY, "Agentes y Ads"]];
  }, [data]);
  const products = useMemo(() => (data?.products ?? []).filter(p => cat === "todo" || (cat !== AI_SERVICES_CATEGORY && p.category === cat)), [data, cat]);
  const showAiServices = cat === "todo" || cat === AI_SERVICES_CATEGORY;
  const agentOffers = SHOP_SERVICE_OFFERS.filter(offer => offer.group === "agents");
  const adOffers = SHOP_SERVICE_OFFERS.filter(offer => offer.group === "ads");
  const isGift = (p: Product) => ["tarjetas-regalo", "fotos-grabadas", "regalos-3d"].includes(p.category);
  const gifts = products.filter(isGift);
  const physical = products.filter(p => p.kind === "physical" && !isGift(p));
  const digital = products.filter(p => p.kind !== "physical" && !isGift(p));
  const webServices = digital.filter(p => p.category === "servicios-web");
  const videoServices = digital.filter(p => p.category === "servicios-video");
  const googleServices = digital.filter(p => p.category === "google-local");
  const otherDigital = digital.filter(p => p.category !== "servicios-web" && p.category !== "servicios-video" && p.category !== "google-local");

  return (
    <ShopLayout>
      <PageMeta {...metaFor("/tienda")} />
      <div ref={root}>
        <section ref={heroRef} className="shop-hero">
          <div className="shop-hero-glow" aria-hidden="true" />
          <div className="shop-wrap shop-hero-grid">
            <div className="shop-hero-copy">
              <span className="shop-eyebrow">Taller láser · Estudio digital</span>
              <h1><Words text="Lo que hacemos," /> <em><Words text="listo para pedir." /></em></h1>
              <p>Stands de madera con QR, tarjetas de aluminio con tu mensaje, expositores y fotos grabadas con nuestra xTool F2. También hacemos webs, rediseño de tiendas, ficha de Google Maps y reseñas, auditorías SEO, optimización PageSpeed, informes mensuales y vídeo animado en 3D.</p>
              <div className="shop-hero-ctas">
                <Link href="/tienda/tarjetas-metalicas" className="shop-btn shop-btn-gold shop-btn-lg shop-btn-shine">Tarjetas{cardFrom !== null ? ` desde ${euros(cardFrom)}` : ""} →</Link>
                <a href="#catalogo" className="shop-btn shop-btn-ghost shop-btn-lg">Ver todo el catálogo</a>
              </div>
              <ul className="shop-hero-facts">
                {cardFrom !== null && <li><strong>{euros(cardFrom)}</strong><span>por tarjeta de aluminio</span></li>}
                <li><strong>3–7 días</strong><span>envío a España</span></li>
                <li><strong>Stripe</strong><span>pago seguro</span></li>
              </ul>
            </div>
            <div className="shop-hero-stage">
              <Suspense fallback={<div className="shop-hero-canvas" aria-hidden="true" />}>
                {hero3DReady ? <ShopHero3D progress={progress} /> : <div className="shop-hero-canvas" aria-hidden="true" />}
              </Suspense>
            </div>
          </div>
        </section>

        <div className="shop-marquee" aria-hidden="true">
          <div className="shop-marquee-track">
            {[...MARQUEE, ...(cardFrom !== null ? [`Tarjetas de aluminio desde ${euros(cardFrom)}`] : []), ...MARQUEE, ...(cardFrom !== null ? [`Tarjetas de aluminio desde ${euros(cardFrom)}`] : [])].map((t, i) => <span key={i}>{t}<i>✦</i></span>)}
          </div>
        </div>

        <section className="shop-wrap shop-offer shop-reveal" aria-labelledby="oferta-h">
          <div className="shop-offer-media">
            <img src={assetUrl("/tienda-media/tarjeta-shopycrafter-delante.webp")} alt="Tarjeta de aluminio grabada de Shopy Crafter" loading="lazy" />
          </div>
          <div className="shop-offer-copy">
            <span className="shop-eyebrow">Tarjetas de visita de aluminio</span>
            <h2 id="oferta-h">Desde <strong ref={promoPrice} className="shop-offer-price">{cardFrom !== null ? euros(cardFrom) : "…"}</strong> la tarjeta.</h2>
            <ul className="shop-offer-list">
              <li><b>Una cara{oneFaceCents !== null ? ` · ${euros(oneFaceCents)}` : ""}</b> logo, datos y QR en el mismo lado</li>
              <li><b>Doble cara{doubleFaceCents !== null ? ` · ${euros(doubleFaceCents)}` : ""}</b> tu diseño delante, datos y QR detrás</li>
              <li><b>Desde 100 tarjetas</b> con diseño básico y prueba incluidos</li>
            </ul>
            <div className="shop-hero-ctas">
              <Link href="/tienda/tarjetas-metalicas" className="shop-btn shop-btn-gold shop-btn-lg shop-btn-shine">Diseñar mis tarjetas →</Link>
              <Link href="/tienda/kit-resenas" className="shop-btn shop-btn-ghost shop-btn-lg">Kit Reseñas{kitPrice ? ` · ${euros(kitPrice)}` : ""}</Link>
            </div>
          </div>
        </section>

        <section className="shop-wrap shop-workshop shop-reveal" aria-labelledby="taller-h">
          <div className="shop-workshop-video">
            <video src={assetUrl("/tienda-media/taller-grabado-tarjeta.mp4")} poster={assetUrl("/tienda-media/taller-grabado-tarjeta-poster.webp")} ref={el => { if (!el || prefersReduced()) return; new IntersectionObserver(([en]) => { if (en.isIntersecting) el.play().catch(() => {}); else el.pause(); }, { threshold: 0.4 }).observe(el); }} muted loop playsInline preload="none" aria-label="Una tarjeta grabándose en la xTool F2" />
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
            <div className="shop-hero-ctas">
              <a href="#catalogo" className="shop-btn shop-btn-gold">Empezar mi pedido →</a>
            </div>
          </div>
        </section>

        <section id="catalogo" className="shop-wrap shop-catalog" aria-labelledby="catalogo-h">
          <div className="shop-catalog-head shop-reveal">
            <h2 id="catalogo-h">Catálogo</h2>
            <div className="shop-chips" role="group" aria-label="Filtrar por categoría">
              <button type="button" className={cat === "todo" ? "on" : ""} aria-pressed={cat === "todo"} onClick={() => pickCat("todo")}>Todo</button>
              {categories.map(([k, label]) => (
                <button key={k} type="button" className={cat === k ? "on" : ""} aria-pressed={cat === k} onClick={() => pickCat(k)}>{label}</button>
              ))}
            </div>
          </div>
          {error && <p className="shop-error" role="alert">{error}</p>}
          {!data && !error && <div className="shop-grid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="shop-card shop-skel" />)}</div>}
          {cat === "todo" && (
            <div className="shop-doors">
              <a className="shop-door" href="#para-regalar"><strong>Para regalar</strong><span>Tarjetas con foto y mensaje, series de recuerdos, fotos grabadas y regalos web en 3D.</span></a>
              <a className="shop-door" href="#para-negocio"><strong>Para tu negocio</strong><span>Stands con QR para reseñas, Instagram, wifi, pago o carta, y tarjetas de visita de aluminio.</span></a>
            </div>
          )}
          {gifts.length > 0 && (
            <>
              <h3 id="para-regalar" className="shop-group-title">Para regalar</h3>
              <div className="shop-grid">{gifts.map(p => <ProductCard key={p.slug} p={p} />)}</div>
            </>
          )}
          {physical.length > 0 && (
            <>
              <h3 id="para-negocio" className="shop-group-title">Para tu negocio: hecho en el taller</h3>
              <div className="shop-grid">{physical.map(p => <ProductCard key={p.slug} p={p} />)}</div>
            </>
          )}
          {physical.length > 0 && digital.length > 0 && (
            <div className="shop-strip">
              <p><b>¿Tienes un negocio?</b> Placa de reseñas, expositor y 100 tarjetas con el mismo diseño{kitPrice ? ` por ${euros(kitPrice)}` : ""}.</p>
              <Link href="/tienda/kit-resenas" className="shop-btn shop-btn-gold">Quiero el Kit Reseñas →</Link>
            </div>
          )}
          {webServices.length > 0 && (
            <>
              <h3 className="shop-group-title">Web, SEO y rendimiento</h3>
              <p className="shop-group-intro">Landing pages, tiendas online, auditorías SEO, optimización de PageSpeed e informes mensuales. Los precios son «a partir de»: dependen de las páginas, los productos y los rediseños, y los cerramos por escrito antes de empezar.</p>
              <div className="shop-grid">{webServices.map(p => <ProductCard key={p.slug} p={p} />)}</div>
            </>
          )}
          {videoServices.length > 0 && (
            <>
              <h3 className="shop-group-title">Vídeo y animación 3D</h3>
              <p className="shop-group-intro">Piezas animadas para presentar tu marca, producto o local en web y redes.</p>
              <div className="shop-grid">{videoServices.map(p => <ProductCard key={p.slug} p={p} />)}</div>
            </>
          )}
          {googleServices.length > 0 && (
            <>
              <h3 className="shop-group-title">Google, reseñas y reservas</h3>
              <p className="shop-group-intro">Tu ficha de Google Maps, tus reseñas y tus reservas con Google Calendar, gestionadas con nuestro panel Crafter Mando. Precios «a partir de»: el importe final se cierra por escrito según el trabajo.</p>
              <div className="shop-grid">{googleServices.map(p => <ProductCard key={p.slug} p={p} />)}</div>
            </>
          )}
          {showAiServices && (
            <>
              <h3 className="shop-group-title">Agentes conversacionales y a medida</h3>
              <p className="shop-group-intro">Elige si necesitas solo el diseño o también la integración y configuración. Cada puesta en marcha requiere trabajo y se presupuesta según tu caso. El Perfil de Empresa de Google y la gestión de reseñas están en «Google, reseñas y reservas».</p>
              <div className="shop-ai-grid">{agentOffers.map(offer => <ShopServiceCard key={offer.name} offer={offer} />)}</div>
              <h3 className="shop-group-title">Publicidad y captación</h3>
              <p className="shop-group-intro">Configuración inicial o gestión continua de campañas. El presupuesto publicitario se define aparte del servicio.</p>
              <div className="shop-ai-grid shop-ai-grid-ads">{adOffers.map(offer => <ShopServiceCard key={offer.name} offer={offer} />)}</div>
            </>
          )}
          {otherDigital.length > 0 && (
            <>
              <h3 className="shop-group-title">Otros servicios digitales</h3>
              <div className="shop-grid">{otherDigital.map(p => <ProductCard key={p.slug} p={p} />)}</div>
            </>
          )}
        </section>

        <section className="shop-wrap" aria-labelledby="medida-h">
          <div className="shop-band">
            <div>
              <span className="shop-eyebrow">¿Algo que no está aquí?</span>
              <h2 id="medida-h">Lo diseñamos y lo grabamos a medida.</h2>
              <p>Cuéntanos qué necesitas y te preparamos un presupuesto por escrito en 24 horas laborables, antes de empezar.</p>
            </div>
            <div className="shop-hero-ctas">
              <Link href="/contacto" className="shop-btn shop-btn-gold shop-btn-lg shop-btn-shine">Pedir presupuesto →</Link>
              <a href="https://www.instagram.com/shopycrafter/" target="_blank" rel="noopener noreferrer" className="shop-btn shop-btn-ghost shop-btn-lg">Ver trabajos en Instagram</a>
            </div>
          </div>
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
