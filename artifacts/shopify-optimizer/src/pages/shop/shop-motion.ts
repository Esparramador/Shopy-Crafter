/**
 * Movimiento de la tienda (GSAP): vuelo del producto al carrito, chispas, contadores,
 * botones magnéticos y tarjetas con inclinación. Todo respeta prefers-reduced-motion
 * y no toca window al cargar el módulo (las páginas se prerenderizan).
 */
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import type { CartItem } from "./shop-api";

export const prefersReduced = (): boolean =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const finePointer = (): boolean =>
  typeof window !== "undefined" && !!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

// ── Eventos entre la ficha y la cabecera / el cajón del carrito ──────────────
export const CART_BUMP = "shop:cart-bump";
export const CART_OPEN = "shop:cart-open";
export function openCartDrawer(item?: CartItem): void {
  window.dispatchEvent(new CustomEvent(CART_OPEN, { detail: item ?? null }));
}

/** Chispas doradas que salen de un punto. */
export function burst(x: number, y: number, count = 14): void {
  if (prefersReduced()) return;
  for (let i = 0; i < count; i++) {
    const dot = document.createElement("span");
    dot.className = "shop-spark";
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    document.body.appendChild(dot);
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const d = 26 + Math.random() * 38;
    gsap.fromTo(dot, { x: 0, y: 0, scale: 1, opacity: 1 }, {
      x: Math.cos(a) * d, y: Math.sin(a) * d, scale: 0, opacity: 0,
      duration: 0.6 + Math.random() * 0.35, ease: "power3.out", onComplete: () => dot.remove(),
    });
  }
}

/**
 * La imagen del producto vuela en arco hasta el botón del carrito, deja una estela y,
 * al llegar, el carrito rebota. Resuelve cuando termina (al instante sin animaciones).
 */
export function flyToCart(from: Element | null, image: string | null): Promise<void> {
  const target = document.querySelector<HTMLElement>("[data-cart-target]");
  if (!target || prefersReduced()) {
    window.dispatchEvent(new Event(CART_BUMP));
    return Promise.resolve();
  }
  const src = (from ?? target).getBoundingClientRect();
  const dst = target.getBoundingClientRect();
  const size = Math.max(90, Math.min(200, src.width * 0.5));
  const startX = src.left + src.width / 2 - size / 2;
  const startY = src.top + src.height / 2 - size / 2;

  const ghost = document.createElement("div");
  ghost.className = "shop-fly";
  ghost.style.width = ghost.style.height = `${size}px`;
  ghost.style.left = `${startX}px`;
  ghost.style.top = `${startY}px`;
  if (image) ghost.style.backgroundImage = `url("${image.replace(/"/g, "%22")}")`;
  document.body.appendChild(ghost);

  const dx = dst.left + dst.width / 2 - (startX + size / 2);
  const dy = dst.top + dst.height / 2 - (startY + size / 2);

  return new Promise(resolve => {
    let frame = 0;
    const tl = gsap.timeline({
      onComplete: () => {
        ghost.remove();
        burst(dst.left + dst.width / 2, dst.top + dst.height / 2);
        window.dispatchEvent(new Event(CART_BUMP));
        resolve();
      },
    });
    tl.fromTo(ghost, { scale: 0.6, opacity: 0, rotate: -8 }, { scale: 1.08, opacity: 1, rotate: 4, duration: 0.22, ease: "back.out(2)" })
      .to(ghost, { x: dx, duration: 0.85, ease: "power2.inOut" }, ">-0.02")
      // back.in sube un poco antes de ir al carrito: la trayectoria es un arco
      .to(ghost, { y: dy, duration: 0.85, ease: "back.in(1.6)" }, "<")
      .to(ghost, { scale: 0.16, rotate: 380, borderRadius: "50%", duration: 0.85, ease: "power2.in" }, "<")
      .eventCallback("onUpdate", () => {
        if (++frame % 3 !== 0) return;
        const r = ghost.getBoundingClientRect();
        const t = document.createElement("span");
        t.className = "shop-trail";
        t.style.left = `${r.left + r.width / 2}px`;
        t.style.top = `${r.top + r.height / 2}px`;
        document.body.appendChild(t);
        gsap.to(t, { scale: 0, opacity: 0, duration: 0.5, ease: "power2.out", onComplete: () => t.remove() });
      });
  });
}

/**
 * Número que se desliza hasta su nuevo valor (precios). React pinta siempre el texto:
 * aquí solo cambia el valor mostrado durante ~0,6 s.
 */
export function useTweened(value: number): number {
  const [shown, setShown] = useState(value);
  const cur = useRef(value);
  useEffect(() => {
    if (prefersReduced() || cur.current === value) { cur.current = value; setShown(value); return; }
    const o = { v: cur.current };
    const tw = gsap.to(o, { v: value, duration: 0.6, ease: "power2.out", onUpdate: () => { cur.current = o.v; setShown(Math.round(o.v)); } });
    return () => { tw.kill(); };
  }, [value]);
  return shown;
}

/** Pequeño salto de escala (al cambiar un precio o un contador). */
export function pulse(el: Element | null): void {
  if (!el || prefersReduced()) return;
  gsap.fromTo(el, { scale: 1.08 }, { scale: 1, duration: 0.5, ease: "back.out(3)" });
}

/** Botones dorados que siguen un poco al ratón. Devuelve la función de limpieza. */
export function bindMagnetic(root: HTMLElement, selector = ".shop-btn-gold, [data-magnetic]"): () => void {
  if (prefersReduced() || !finePointer()) return () => {};
  const offs: Array<() => void> = [];
  root.querySelectorAll<HTMLElement>(selector).forEach(btn => {
    const xTo = gsap.quickTo(btn, "x", { duration: 0.4, ease: "power3.out" });
    const yTo = gsap.quickTo(btn, "y", { duration: 0.4, ease: "power3.out" });
    const move = (e: PointerEvent) => {
      const r = btn.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.25);
      yTo((e.clientY - r.top - r.height / 2) * 0.35);
    };
    const leave = () => { xTo(0); yTo(0); };
    btn.addEventListener("pointermove", move);
    btn.addEventListener("pointerleave", leave);
    offs.push(() => { btn.removeEventListener("pointermove", move); btn.removeEventListener("pointerleave", leave); gsap.set(btn, { x: 0, y: 0 }); });
  });
  return () => offs.forEach(f => f());
}

/** Tarjetas del catálogo que se inclinan hacia el ratón con un brillo que lo sigue. */
export function bindTilt(root: HTMLElement, selector = ".shop-card"): () => void {
  if (prefersReduced() || !finePointer()) return () => {};
  const offs: Array<() => void> = [];
  root.querySelectorAll<HTMLElement>(selector).forEach(card => {
    const rx = gsap.quickTo(card, "rotationX", { duration: 0.5, ease: "power3.out" });
    const ry = gsap.quickTo(card, "rotationY", { duration: 0.5, ease: "power3.out" });
    gsap.set(card, { transformPerspective: 900 });
    const move = (e: PointerEvent) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      ry((px - 0.5) * 10);
      rx((0.5 - py) * 8);
      card.style.setProperty("--gx", `${px * 100}%`);
      card.style.setProperty("--gy", `${py * 100}%`);
    };
    const leave = () => { rx(0); ry(0); };
    card.addEventListener("pointermove", move);
    card.addEventListener("pointerleave", leave);
    offs.push(() => { card.removeEventListener("pointermove", move); card.removeEventListener("pointerleave", leave); gsap.set(card, { rotationX: 0, rotationY: 0 }); });
  });
  return () => offs.forEach(f => f());
}

/** Lluvia de confeti dorado y jade (página de gracias). */
export function confetti(): void {
  if (prefersReduced()) return;
  const colors = ["#e0c98a", "#c9a961", "#45b37a", "#f2f0ea"];
  const w = window.innerWidth;
  for (let i = 0; i < 90; i++) {
    const c = document.createElement("span");
    c.className = "shop-confetti";
    c.style.background = colors[i % colors.length];
    c.style.left = `${Math.random() * w}px`;
    document.body.appendChild(c);
    gsap.fromTo(c, { y: -30, rotate: Math.random() * 360, opacity: 1 }, {
      y: window.innerHeight + 40, x: `+=${(Math.random() - 0.5) * 220}`, rotate: `+=${360 + Math.random() * 540}`,
      duration: 2.2 + Math.random() * 1.8, delay: Math.random() * 0.6, ease: "power1.in", onComplete: () => c.remove(),
    });
  }
}
