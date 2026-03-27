import { useEffect, useRef } from "react";

export default function SCCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const mx = useRef(0), my = useRef(0), rx = useRef(0), ry = useRef(0);

  useEffect(() => {
    const isTouchDevice = () => "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice()) return;

    const move = (e: MouseEvent) => {
      mx.current = e.clientX;
      my.current = e.clientY;
    };
    document.addEventListener("mousemove", move);

    const onOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("a, button, [role='button'], input, select, textarea, label")) {
        dotRef.current?.classList.add("sc-cursor-hover");
        ringRef.current?.classList.add("sc-ring-hover");
      }
    };
    const onOut = () => {
      dotRef.current?.classList.remove("sc-cursor-hover");
      ringRef.current?.classList.remove("sc-ring-hover");
    };
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);

    let raf: number;
    const anim = () => {
      if (dotRef.current) {
        dotRef.current.style.left = (mx.current - 14) + "px";
        dotRef.current.style.top = (my.current - 14) + "px";
      }
      if (ringRef.current) {
        rx.current += (mx.current - rx.current) * 0.12;
        ry.current += (my.current - ry.current) * 0.12;
        ringRef.current.style.left = (rx.current - 22) + "px";
        ringRef.current.style.top = (ry.current - 22) + "px";
      }
      raf = requestAnimationFrame(anim);
    };
    anim();

    return () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div className="sc-cursor" ref={dotRef}>SC</div>
      <div className="sc-cursor-ring" ref={ringRef}></div>
    </>
  );
}
