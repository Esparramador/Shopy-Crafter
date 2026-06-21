import { useState, useRef, useCallback, useEffect } from "react";

interface DraggableOptions {
  storageKey: string;
  defaultBottom: number;
  defaultRight: number;
  dragFromAnywhere?: boolean;
}

interface DraggableResult {
  position: { bottom: number; right: number };
  dragHandlers: {
    onPointerDown: (e: React.PointerEvent) => void;
  };
  wasDragged: boolean;
}

export function useDraggable({ storageKey, defaultBottom, defaultRight, dragFromAnywhere = false }: DraggableOptions): DraggableResult {
  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem(`drag_${storageKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.bottom === "number" && typeof parsed.right === "number") {
          return { bottom: parsed.bottom, right: parsed.right };
        }
      }
    } catch {}
    return { bottom: defaultBottom, right: defaultRight };
  });

  const [wasDragged, setWasDragged] = useState(false);
  const dragState = useRef<{
    startX: number;
    startY: number;
    startRight: number;
    startBottom: number;
    moved: boolean;
  } | null>(null);
  const posRef = useRef(position);
  posRef.current = position;
  const wasDraggedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clamp = useCallback((pos: { bottom: number; right: number }) => {
    const maxRight = Math.max(0, window.innerWidth - 60);
    const maxBottom = Math.max(0, window.innerHeight - 60);
    return {
      bottom: Math.max(4, Math.min(pos.bottom, maxBottom)),
      right: Math.max(4, Math.min(pos.right, maxRight)),
    };
  }, []);

  // Re-clamp on mount and on viewport resize so a position saved on a large
  // screen never leaves the widget stranded off-screen on a smaller one.
  useEffect(() => {
    const reclamp = () => setPosition(p => {
      const next = clamp(p);
      return next.bottom === p.bottom && next.right === p.right ? p : next;
    });
    reclamp();
    window.addEventListener("resize", reclamp);
    window.addEventListener("orientationchange", reclamp);
    return () => {
      window.removeEventListener("resize", reclamp);
      window.removeEventListener("orientationchange", reclamp);
    };
  }, [clamp]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!dragFromAnywhere) {
      const target = e.target as HTMLElement;
      if (target.closest("input") || target.closest("textarea") || target.closest("a") || target.closest("[data-no-drag]")) return;
    }

    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      startRight: posRef.current.right,
      startBottom: posRef.current.bottom,
      moved: false,
    };
  }, [dragFromAnywhere]);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (!dragState.current) return;
      const dx = e.clientX - dragState.current.startX;
      const dy = e.clientY - dragState.current.startY;
      if (!dragState.current.moved && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      dragState.current.moved = true;
      setWasDragged(true);
      if (wasDraggedTimerRef.current) clearTimeout(wasDraggedTimerRef.current);
      const newPos = clamp({
        right: dragState.current.startRight - dx,
        bottom: dragState.current.startBottom - dy,
      });
      setPosition(newPos);
    };

    const onPointerUp = () => {
      if (!dragState.current) return;
      const didMove = dragState.current.moved;
      if (didMove) {
        try { localStorage.setItem(`drag_${storageKey}`, JSON.stringify(posRef.current)); } catch {}
        wasDraggedTimerRef.current = setTimeout(() => setWasDragged(false), 200);
      }
      dragState.current = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      if (wasDraggedTimerRef.current) clearTimeout(wasDraggedTimerRef.current);
    };
  }, [clamp, storageKey]);

  return { position, dragHandlers: { onPointerDown }, wasDragged };
}
