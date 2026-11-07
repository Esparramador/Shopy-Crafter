import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function SCCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const mx = useRef(0), my = useRef(0), rx = useRef(0), ry = useRef(0);

  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;
    let animating = false;
    let cursorVisible = false;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let prefersReducedMotion = reducedMotion?.matches ?? false;

    const isInteractive = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest("a, button, [role='button'], input, select, textarea, label"));

    let hovering = false;
    const clearHover = () => {
      if (!hovering) return;
      hovering = false;
      dotRef.current?.classList.remove("sc-cursor-hover");
      ringRef.current?.classList.remove("sc-ring-hover");
    };

    const onOver = (e: PointerEvent) => {
      if (!hovering && isInteractive(e.target)) {
        hovering = true;
        dotRef.current?.classList.add("sc-cursor-hover");
        ringRef.current?.classList.add("sc-ring-hover");
      }
    };
    const onOut = (e: PointerEvent) => {
      if (!e.relatedTarget) {
        hideCursor();
        return;
      }
      if (isInteractive(e.relatedTarget)) return;
      clearHover();
    };
    // La posición va en la propiedad `translate`, no en `transform`: el aumento al pasar por un enlace usa
    // `scale`, y el navegador aplica `scale` también sobre lo que hay en `transform`, así que con transform
    // el desplazamiento se multiplicaba por 1,15 y el cursor saltaba ~100 px lejos del ratón.
    const anim = () => {
      if (!animating) return;
      if (dotRef.current) {
        dotRef.current.style.translate = `${mx.current - 14}px ${my.current - 14}px`;
      }
      if (ringRef.current) {
        rx.current += (mx.current - rx.current) * 0.12;
        ry.current += (my.current - ry.current) * 0.12;
        ringRef.current.style.translate = `${rx.current - 22}px ${ry.current - 22}px`;
      }
      raf = requestAnimationFrame(anim);
    };

    const stopAnimation = () => {
      if (!animating) return;
      animating = false;
      cancelAnimationFrame(raf);
    };

    const hideCursor = () => {
      cursorVisible = false;
      hovering = false;
      root.classList.remove("sc-cursor-on");
      dotRef.current?.classList.remove("sc-cursor-visible", "sc-cursor-hover");
      ringRef.current?.classList.remove("sc-cursor-visible", "sc-ring-hover");
      stopAnimation();
      mx.current = my.current = rx.current = ry.current = 0;
      if (dotRef.current) dotRef.current.style.translate = "";
      if (ringRef.current) ringRef.current.style.translate = "";
    };

    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch" || prefersReducedMotion) {
        hideCursor();
        return;
      }
      mx.current = e.clientX;
      my.current = e.clientY;
      if (!cursorVisible) {
        // Start the dot and ring at the actual pointer position. In particular,
        // never lerp the ring from its default (0, 0) position on first entry.
        rx.current = e.clientX;
        ry.current = e.clientY;
        if (dotRef.current) {
          dotRef.current.style.translate = `${e.clientX - 14}px ${e.clientY - 14}px`;
        }
        if (ringRef.current) {
          ringRef.current.style.translate = `${e.clientX - 22}px ${e.clientY - 22}px`;
        }
        cursorVisible = true;
        // Solo al aparecer: cambiar la clase de <html> obliga a recalcular el estilo de toda la página,
        // y hacerlo en cada movimiento del ratón era lo que hacía temblar el cursor en el header y el pie.
        root.classList.add("sc-cursor-on");
        dotRef.current?.classList.add("sc-cursor-visible");
        ringRef.current?.classList.add("sc-cursor-visible");
      }
      if (!animating) {
        animating = true;
        raf = requestAnimationFrame(anim);
      }
    };

    const onWindowBlur = () => {
      hideCursor();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") hideCursor();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") {
        clearHover();
        hideCursor();
      }
    };
    const onReducedMotionChange = (e: MediaQueryListEvent) => {
      prefersReducedMotion = e.matches;
      if (prefersReducedMotion) hideCursor();
    };

    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pointerleave", hideCursor);
    window.addEventListener("blur", onWindowBlur);
    reducedMotion?.addEventListener("change", onReducedMotionChange);

    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pointerleave", hideCursor);
      window.removeEventListener("blur", onWindowBlur);
      reducedMotion?.removeEventListener("change", onReducedMotionChange);
      hideCursor();
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal((
    <>
      <div className="sc-cursor" ref={dotRef} aria-hidden="true">SC</div>
      <div className="sc-cursor-ring" ref={ringRef} aria-hidden="true" />
    </>
  ), document.body);
}
