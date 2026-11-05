import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function SCCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const mx = useRef(0), my = useRef(0), rx = useRef(0), ry = useRef(0);

  useEffect(() => {
    const finePointer = window.matchMedia("(any-hover: hover) and (any-pointer: fine)");
    const root = document.documentElement;
    let enabled = false;
    let raf = 0;

    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      mx.current = e.clientX;
      my.current = e.clientY;
      root.classList.add("sc-cursor-on");
      dotRef.current?.classList.add("sc-cursor-visible");
      ringRef.current?.classList.add("sc-cursor-visible");
    };

    const isInteractive = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest("a, button, [role='button'], input, select, textarea, label"));

    const onOver = (e: PointerEvent) => {
      if (isInteractive(e.target)) {
        dotRef.current?.classList.add("sc-cursor-hover");
        ringRef.current?.classList.add("sc-ring-hover");
      }
    };
    const onOut = (e: PointerEvent) => {
      if (isInteractive(e.relatedTarget)) return;
      dotRef.current?.classList.remove("sc-cursor-hover");
      ringRef.current?.classList.remove("sc-ring-hover");
    };
    const anim = () => {
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mx.current - 14}px, ${my.current - 14}px, 0)`;
      }
      if (ringRef.current) {
        rx.current += (mx.current - rx.current) * 0.12;
        ry.current += (my.current - ry.current) * 0.12;
        ringRef.current.style.transform = `translate3d(${rx.current - 22}px, ${ry.current - 22}px, 0)`;
      }
      raf = requestAnimationFrame(anim);
    };

    const onWindowBlur = () => {
      root.classList.remove("sc-cursor-on");
      dotRef.current?.classList.remove("sc-cursor-visible");
      ringRef.current?.classList.remove("sc-cursor-visible");
    };

    const enable = () => {
      if (enabled) return;
      enabled = true;
      document.addEventListener("pointermove", move, { passive: true });
      document.addEventListener("pointerover", onOver);
      document.addEventListener("pointerout", onOut);
      window.addEventListener("blur", onWindowBlur);
      raf = requestAnimationFrame(anim);
    };
    const disable = () => {
      if (enabled) {
        enabled = false;
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerover", onOver);
        document.removeEventListener("pointerout", onOut);
        window.removeEventListener("blur", onWindowBlur);
        cancelAnimationFrame(raf);
      }
      root.classList.remove("sc-cursor-on");
      dotRef.current?.classList.remove("sc-cursor-visible", "sc-cursor-hover");
      ringRef.current?.classList.remove("sc-cursor-visible", "sc-ring-hover");
    };

    const syncPointer = () => finePointer.matches ? enable() : disable();
    syncPointer();
    finePointer.addEventListener("change", syncPointer);

    return () => {
      finePointer.removeEventListener("change", syncPointer);
      disable();
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
