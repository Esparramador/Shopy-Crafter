/**
 * Card Studio · Editor visual inline (NO modal).
 *
 * Renders directly inside the page as a canvas-based editor where:
 * - Elements appear as REAL styled text/logo/QR (not boxes)
 * - Drag to move any element
 * - Resize via corner handles
 * - Select to edit text, color, font, size
 * - Background = actual generated image (frontUrl/backUrl)
 */
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Eye, EyeOff, Plus, RefreshCw, Save, Trash2, Type, X,
  RotateCcw, Loader2, Minus, AlignLeft, AlignCenter, AlignRight,
  Bold, Italic, ZoomIn, ZoomOut, QrCode, Image as ImageIcon,
} from "lucide-react";

const CARD_W = 1050;
const CARD_H = 680;

export type ElementOverride = {
  hidden?: boolean;
  x?: number; y?: number; width?: number; height?: number;
  fontSize?: number; color?: string;
  fontFamily?: string; fontWeight?: number;
  letterSpacing?: number; lineHeight?: number;
  align?: "left" | "center" | "right";
  textTransform?: "none" | "uppercase";
  text?: string; rotate?: number;
  italic?: boolean;
};
export type ExtraElement = {
  id: string; side: "front" | "back"; type: "text" | "line" | "qr";
  x: number; y: number; width: number; height?: number;
  text?: string; fontFamily?: string; fontSize?: number; fontWeight?: number;
  color?: string; align?: "left" | "center" | "right";
  letterSpacing?: number; textTransform?: "none" | "uppercase";
  rotate?: number; italic?: boolean;
  qrUrl?: string;
};
export type LayoutOverrides = {
  front?: Record<string, ElementOverride>;
  back?: Record<string, ElementOverride>;
  extras?: ExtraElement[];
};
type ResolvedElement = {
  id: string;
  type: "text" | "qr" | "logo" | "line";
  x: number; y: number; width: number; height: number;
  text?: string; fontFamily?: string; fontSize?: number; fontWeight?: number;
  color?: string; align?: "left" | "center" | "right";
  letterSpacing?: number; lineHeight?: number;
  textTransform?: "none" | "uppercase";
  rotate?: number; hidden?: boolean; italic?: boolean;
  qrUrl?: string; logoUrl?: string;
};

interface Props {
  apiBase: string;
  cardId: number;
  frontUrl?: string | null;
  backUrl?: string | null;
  logoUrl?: string | null;
  initialOverrides: LayoutOverrides;
  generating: boolean;
  side: "front" | "back";
  onSideChange: (s: "front" | "back") => void;
  onSaveOverrides: (overrides: LayoutOverrides) => Promise<void>;
  onRegenerate: () => Promise<void>;
  onAddExtraQr?: () => void;
}

const ELEMENT_LABELS: Record<string, string> = {
  logo: "Logo", company: "Empresa", name: "Nombre", title: "Cargo",
  line: "Línea", tagline: "Tagline",
  qr: "QR", qrLabel: "Etiqueta QR", brand: "Marca", email: "Email",
  phone: "Teléfono", web: "Web", social: "Social", address: "Dirección",
};

function elementLabel(id: string): string {
  if (id.startsWith("extra-")) return `Extra`;
  return ELEMENT_LABELS[id] || id;
}

const POPULAR_FONTS = [
  "Inter", "Cinzel", "Playfair Display", "Montserrat", "Lato",
  "Source Serif Pro", "Space Grotesk", "JetBrains Mono",
  "Poppins", "Raleway", "Crimson Pro", "DM Sans", "DM Serif Display",
  "Georgia", "Times New Roman", "Arial", "Helvetica",
];

export default function CardStudioEditor({
  apiBase, cardId, frontUrl, backUrl, logoUrl,
  initialOverrides, generating, side, onSideChange,
  onSaveOverrides, onRegenerate,
}: Props) {
  const [overrides, setOverrides] = useState<LayoutOverrides>(initialOverrides || {});
  const [elements, setElements] = useState<ResolvedElement[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.52);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const elementsRef = useRef<ResolvedElement[]>([]);
  const dragState = useRef<{
    id: string; startX: number; startY: number; origX: number; origY: number;
    lastX: number; lastY: number;
  } | null>(null);
  const resizeState = useRef<{
    id: string; handle: string; startX: number; startY: number;
    origX: number; origY: number; origW: number; origH: number;
    lastX: number; lastY: number; lastW: number; lastH: number;
  } | null>(null);

  useEffect(() => { elementsRef.current = elements; }, [elements]);

  // Sync overrides when parent passes new initialOverrides
  useEffect(() => {
    setOverrides(initialOverrides || {});
  }, [initialOverrides]);

  // Load elements from backend each time side changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch(`${apiBase}/api/cards/${cardId}/elements?side=${side}`, { credentials: "include" });
        if (!res.ok) throw new Error((await res.json()).error || "Error cargando elementos");
        const data = await res.json();
        if (cancelled) return;
        const sideOv = side === "front" ? overrides.front : overrides.back;
        const merged: ResolvedElement[] = (data.elements as ResolvedElement[]).map((el: ResolvedElement) => {
          const ov = sideOv?.[el.id];
          if (!ov) return el;
          return {
            ...el,
            ...(ov.x !== undefined ? { x: ov.x } : {}),
            ...(ov.y !== undefined ? { y: ov.y } : {}),
            ...(ov.width !== undefined ? { width: ov.width } : {}),
            ...(ov.height !== undefined ? { height: ov.height } : {}),
            ...(ov.fontSize !== undefined ? { fontSize: ov.fontSize } : {}),
            ...(ov.color !== undefined ? { color: ov.color } : {}),
            ...(ov.text !== undefined && el.type === "text" ? { text: ov.text } : {}),
            ...(ov.align !== undefined ? { align: ov.align } : {}),
            ...(ov.fontFamily !== undefined ? { fontFamily: ov.fontFamily } : {}),
            ...(ov.fontWeight !== undefined ? { fontWeight: ov.fontWeight } : {}),
            ...(ov.italic !== undefined ? { italic: ov.italic } : {}),
            hidden: !!ov.hidden,
          };
        });
        // Add extras for this side
        const extras = (overrides.extras || []).filter(e => e.side === side);
        for (const ex of extras) {
          const alreadyInMerged = merged.find(m => m.id === `extra-${ex.id}`);
          if (!alreadyInMerged) {
            merged.push({
              id: `extra-${ex.id}`,
              type: ex.type === "line" ? "line" : ex.type === "qr" ? "qr" : "text",
              x: ex.x, y: ex.y, width: ex.width, height: ex.height ?? 60,
              text: ex.text, color: ex.color, fontSize: ex.fontSize,
              fontFamily: ex.fontFamily, fontWeight: ex.fontWeight,
              align: ex.align, letterSpacing: ex.letterSpacing,
              textTransform: ex.textTransform, rotate: ex.rotate,
              italic: ex.italic, qrUrl: ex.qrUrl,
            });
          }
        }
        setElements(merged);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Error cargando editor");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, cardId, apiBase]);

  // Re-apply overrides to elements state without refetch
  useEffect(() => {
    setElements((prev) => {
      const sideOv = side === "front" ? overrides.front : overrides.back;
      return prev.map((el) => {
        if (el.id.startsWith("extra-")) {
          const exId = el.id.replace("extra-", "");
          const ex = (overrides.extras || []).find(e => e.id === exId);
          if (ex) {
            return { ...el, x: ex.x, y: ex.y, width: ex.width, height: ex.height ?? el.height,
              text: ex.text, color: ex.color, fontSize: ex.fontSize, fontFamily: ex.fontFamily,
              fontWeight: ex.fontWeight, align: ex.align, italic: ex.italic, qrUrl: ex.qrUrl };
          }
          return el;
        }
        const ov = sideOv?.[el.id];
        if (!ov) return { ...el, hidden: false };
        return {
          ...el,
          ...(ov.x !== undefined ? { x: ov.x } : {}),
          ...(ov.y !== undefined ? { y: ov.y } : {}),
          ...(ov.width !== undefined ? { width: ov.width } : {}),
          ...(ov.height !== undefined ? { height: ov.height } : {}),
          ...(ov.fontSize !== undefined ? { fontSize: ov.fontSize } : {}),
          ...(ov.color !== undefined ? { color: ov.color } : {}),
          ...(ov.text !== undefined && el.type === "text" ? { text: ov.text } : {}),
          ...(ov.align !== undefined ? { align: ov.align } : {}),
          ...(ov.fontFamily !== undefined ? { fontFamily: ov.fontFamily } : {}),
          ...(ov.fontWeight !== undefined ? { fontWeight: ov.fontWeight } : {}),
          ...(ov.italic !== undefined ? { italic: ov.italic } : {}),
          hidden: !!ov.hidden,
        };
      });
    });
  }, [overrides, side]);

  const setOverride = useCallback((id: string, patch: ElementOverride) => {
    setOverrides((prev) => {
      if (id.startsWith("extra-")) {
        const exId = id.replace("extra-", "");
        const extras = (prev.extras || []).map((e) => e.id === exId ? { ...e, ...patch } : e);
        return { ...prev, extras };
      }
      const sideOv = { ...(prev[side] || {}) };
      sideOv[id] = { ...(sideOv[id] || {}), ...patch };
      return { ...prev, [side]: sideOv };
    });
  }, [side]);

  const zoomRef = useRef(zoom); zoomRef.current = zoom;

  // ── DRAG ──────────────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const ds = dragState.current; if (!ds) return;
    const z = zoomRef.current || 0.52;
    const dx = (e.clientX - ds.startX) / z;
    const dy = (e.clientY - ds.startY) / z;
    const nx = Math.max(0, Math.min(CARD_W - 20, ds.origX + dx));
    const ny = Math.max(0, Math.min(CARD_H - 20, ds.origY + dy));
    ds.lastX = nx; ds.lastY = ny;
    setElements((prev) => prev.map((el) => el.id === ds.id ? { ...el, x: nx, y: ny } : el));
  }, []);

  const handleMouseUp = useCallback(() => {
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
    const ds = dragState.current; if (!ds) return;
    dragState.current = null;
    setIsDragging(false);
    setOverride(ds.id, { x: Math.round(ds.lastX), y: Math.round(ds.lastY) });
  }, [handleMouseMove, setOverride]);

  const onMouseDownEl = (e: React.MouseEvent, el: ResolvedElement) => {
    e.stopPropagation();
    setSelectedId(el.id);
    setIsDragging(true);
    dragState.current = {
      id: el.id, startX: e.clientX, startY: e.clientY,
      origX: el.x, origY: el.y, lastX: el.x, lastY: el.y,
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // ── RESIZE ────────────────────────────────────────────────────────────────
  const handleResizeMove = useCallback((e: MouseEvent) => {
    const rs = resizeState.current; if (!rs) return;
    const z = zoomRef.current || 0.52;
    const dx = (e.clientX - rs.startX) / z;
    const dy = (e.clientY - rs.startY) / z;
    let nx = rs.origX, ny = rs.origY, nw = rs.origW, nh = rs.origH;
    if (rs.handle.includes("e")) nw = Math.max(40, rs.origW + dx);
    if (rs.handle.includes("s")) nh = Math.max(20, rs.origH + dy);
    if (rs.handle.includes("w")) { nw = Math.max(40, rs.origW - dx); nx = rs.origX + (rs.origW - nw); }
    if (rs.handle.includes("n")) { nh = Math.max(20, rs.origH - dy); ny = rs.origY + (rs.origH - nh); }
    rs.lastX = nx; rs.lastY = ny; rs.lastW = nw; rs.lastH = nh;
    setElements((prev) => prev.map((el) => el.id === rs.id ? { ...el, x: nx, y: ny, width: nw, height: nh } : el));
  }, []);

  const handleResizeUp = useCallback(() => {
    window.removeEventListener("mousemove", handleResizeMove);
    window.removeEventListener("mouseup", handleResizeUp);
    const rs = resizeState.current; if (!rs) return;
    resizeState.current = null;
    setIsResizing(false);
    setOverride(rs.id, { x: Math.round(rs.lastX), y: Math.round(rs.lastY), width: Math.round(rs.lastW), height: Math.round(rs.lastH) });
  }, [handleResizeMove, setOverride]);

  const onResizeHandleDown = (e: React.MouseEvent, el: ResolvedElement, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    resizeState.current = {
      id: el.id, handle, startX: e.clientX, startY: e.clientY,
      origX: el.x, origY: el.y, origW: el.width, origH: el.height,
      lastX: el.x, lastY: el.y, lastW: el.width, lastH: el.height,
    };
    window.addEventListener("mousemove", handleResizeMove);
    window.addEventListener("mouseup", handleResizeUp);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizeUp);
    };
  }, [handleMouseMove, handleMouseUp, handleResizeMove, handleResizeUp]);

  // ── ACTIONS ───────────────────────────────────────────────────────────────
  const addExtra = (type: "text" | "line" | "qr" = "text") => {
    const id = String(Date.now()).slice(-6);
    const ex: ExtraElement = {
      id, side, type,
      x: 100, y: 200, width: type === "qr" ? 160 : 400, height: type === "qr" ? 160 : 60,
      text: type === "text" ? "Texto nuevo" : undefined,
      fontFamily: "Inter", fontSize: 28, fontWeight: 400,
      color: "#ffffff", align: "left",
      qrUrl: type === "qr" ? "https://shopycrafter.com" : undefined,
    };
    setOverrides((prev) => ({ ...prev, extras: [...(prev.extras || []), ex] }));
    setElements((prev) => [...prev, {
      id: `extra-${id}`,
      type: type === "qr" ? "qr" : type === "line" ? "line" : "text",
      x: ex.x, y: ex.y, width: ex.width, height: ex.height ?? 60,
      text: ex.text, color: ex.color, fontSize: ex.fontSize,
      fontFamily: ex.fontFamily, fontWeight: ex.fontWeight, align: ex.align,
      qrUrl: ex.qrUrl,
    }]);
    setSelectedId(`extra-${id}`);
  };

  const removeExtra = (id: string) => {
    if (!id.startsWith("extra-")) return;
    const exId = id.replace("extra-", "");
    setOverrides((prev) => ({ ...prev, extras: (prev.extras || []).filter((e) => e.id !== exId) }));
    setElements((prev) => prev.filter((e) => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const toggleHidden = (id: string) => {
    if (id.startsWith("extra-")) { removeExtra(id); return; }
    const sideOv = (side === "front" ? overrides.front : overrides.back) || {};
    const cur = sideOv[id] || {};
    setOverride(id, { hidden: !cur.hidden });
  };

  const resetSide = () => {
    if (!confirm(`¿Restablecer todas las posiciones del ${side === "front" ? "frente" : "reverso"}?`)) return;
    setOverrides((prev) => ({ ...prev, [side]: {} }));
  };

  const savePositions = async () => {
    setSaving(true); setError(null);
    try { await onSaveOverrides(overrides); }
    catch (err: any) { setError(err?.message || "Error guardando"); }
    finally { setSaving(false); }
  };

  const regenerateNow = async () => {
    setSaving(true); setError(null);
    try {
      await onSaveOverrides(overrides);
      await onRegenerate();
    } catch (err: any) { setError(err?.message || "Error re-renderizando"); }
    finally { setSaving(false); }
  };

  const selected = elements.find((e) => e.id === selectedId);
  const bgUrl = side === "front" ? frontUrl : backUrl;

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      {/* TOOLBAR */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        {/* Side tabs */}
        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", padding: 3, borderRadius: 6 }}>
          <button onClick={() => onSideChange("front")} style={tabBtn(side === "front")}>Frente</button>
          <button onClick={() => onSideChange("back")} style={tabBtn(side === "back")}>Reverso</button>
        </div>

        {/* Add elements */}
        <div style={{ display: "flex", gap: 5 }}>
          <button onClick={() => addExtra("text")} style={btnTool} title="Añadir texto">
            <Type size={13} /> Texto
          </button>
          <button onClick={() => addExtra("line")} style={btnTool} title="Añadir línea">
            <Minus size={13} /> Línea
          </button>
          <button onClick={() => addExtra("qr")} style={btnTool} title="Añadir QR extra">
            <QrCode size={13} /> QR
          </button>
        </div>

        {/* Zoom */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => setZoom(z => Math.max(0.25, z - 0.05))} style={iconBtn}><ZoomOut size={14}/></button>
          <span style={{ fontSize: 11, color: "var(--t3)", minWidth: 38, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(1.2, z + 0.05))} style={iconBtn}><ZoomIn size={14}/></button>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={resetSide} style={btnSecondary} title="Restablecer lado actual">
            <RotateCcw size={13} /> Reset
          </button>
          <button onClick={savePositions} disabled={saving} style={btnSecondary}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Guardar
          </button>
          <button onClick={regenerateNow} disabled={saving || generating} style={btnPrimary}>
            {(saving || generating) ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Re-generar
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 8, background: "rgba(232,69,88,0.12)", color: "#e84558", border: "1px solid #e84558", borderRadius: 6, fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* CANVAS + SIDEBAR */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 10, flex: 1, minHeight: 0 }}>
        {/* STAGE */}
        <div style={{ background: "#0a0a0a", borderRadius: 8, overflow: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, minHeight: 400 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div
              ref={stageRef}
              onClick={() => setSelectedId(null)}
              style={{
                width: CARD_W * zoom,
                height: CARD_H * zoom,
                position: "relative",
                backgroundImage: bgUrl ? `url(${bgUrl})` : undefined,
                backgroundSize: "100% 100%",
                backgroundRepeat: "no-repeat",
                backgroundColor: bgUrl ? "transparent" : "#1a1208",
                background: bgUrl ? undefined : "radial-gradient(ellipse at 20% 30%, #2a1f04 0%, #0d0d0d 70%)",
                borderRadius: 4,
                boxShadow: "0 8px 40px rgba(0,0,0,0.8)",
                cursor: isDragging ? "grabbing" : isResizing ? "nwse-resize" : "default",
                flexShrink: 0,
              }}
            >
              {loading && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", borderRadius: 4 }}>
                  <Loader2 className="animate-spin" style={{ color: "var(--gold)" }} />
                </div>
              )}

              {elements.filter((e) => !e.hidden).map((el) => {
                const isSel = el.id === selectedId;
                const left = el.x * zoom;
                const top = el.y * zoom;
                const width = el.width * zoom;
                const height = el.height * zoom;

                return (
                  <div
                    key={el.id}
                    onMouseDown={(e) => onMouseDownEl(e, el)}
                    style={{
                      position: "absolute",
                      left, top, width, height,
                      cursor: "move",
                      userSelect: "none",
                      outline: isSel ? "2px solid var(--gold)" : "1px dashed rgba(255,255,255,0.25)",
                      outlineOffset: isSel ? 1 : 0,
                      boxShadow: isSel ? "0 0 0 4px rgba(212,175,55,0.2)" : "none",
                    }}
                  >
                    {/* Actual content rendering */}
                    {el.type === "text" && (
                      <div style={{
                        width: "100%", height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: el.align === "center" ? "center" : el.align === "right" ? "flex-end" : "flex-start",
                        fontSize: (el.fontSize ?? 22) * zoom,
                        fontFamily: el.fontFamily ? `'${el.fontFamily}', sans-serif` : "inherit",
                        fontWeight: el.fontWeight ?? 400,
                        fontStyle: el.italic ? "italic" : "normal",
                        color: el.color ?? "#ffffff",
                        letterSpacing: el.letterSpacing ? el.letterSpacing * zoom : undefined,
                        textTransform: el.textTransform ?? "none",
                        lineHeight: el.lineHeight ?? 1.3,
                        whiteSpace: "pre-wrap",
                        overflow: "visible",
                        pointerEvents: "none",
                        padding: `0 ${2 * zoom}px`,
                        textAlign: el.align ?? "left",
                      }}>
                        {el.text || ""}
                      </div>
                    )}

                    {el.type === "logo" && (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                        {logoUrl ? (
                          <img
                            src={logoUrl}
                            alt="logo"
                            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                          />
                        ) : (
                          <div style={{ width: "100%", height: "100%", background: "rgba(212,175,55,0.15)", border: "1px dashed rgba(212,175,55,0.4)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <ImageIcon size={Math.max(16, 24 * zoom)} style={{ color: "var(--gold)", opacity: 0.5 }} />
                          </div>
                        )}
                      </div>
                    )}

                    {el.type === "qr" && (
                      <div style={{ width: "100%", height: "100%", background: "#fff", borderRadius: 4 * zoom, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                        <QrCode size={Math.max(16, Math.min(el.width, el.height) * zoom * 0.7)} style={{ color: "#000" }} />
                      </div>
                    )}

                    {el.type === "line" && (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", pointerEvents: "none" }}>
                        <div style={{ width: "100%", height: Math.max(1, 2 * zoom), background: el.color ?? "rgba(212,175,55,0.6)" }} />
                      </div>
                    )}

                    {/* Element label (only shown when selected) */}
                    {isSel && (
                      <div style={{
                        position: "absolute", top: -20 * zoom, left: 0,
                        fontSize: Math.max(8, 10 * zoom),
                        color: "var(--gold)", background: "rgba(0,0,0,0.85)",
                        padding: `${1 * zoom}px ${4 * zoom}px`, borderRadius: 3,
                        whiteSpace: "nowrap", pointerEvents: "none",
                        border: "1px solid rgba(212,175,55,0.4)",
                      }}>
                        {elementLabel(el.id)}
                      </div>
                    )}

                    {/* Resize handles (only when selected) */}
                    {isSel && (
                      <>
                        {[
                          { h: "nw", s: { top: -4, left: -4, cursor: "nwse-resize" } },
                          { h: "ne", s: { top: -4, right: -4, cursor: "nesw-resize" } },
                          { h: "sw", s: { bottom: -4, left: -4, cursor: "nesw-resize" } },
                          { h: "se", s: { bottom: -4, right: -4, cursor: "nwse-resize" } },
                          { h: "n",  s: { top: -4, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" } },
                          { h: "s",  s: { bottom: -4, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" } },
                          { h: "w",  s: { top: "50%", left: -4, transform: "translateY(-50%)", cursor: "ew-resize" } },
                          { h: "e",  s: { top: "50%", right: -4, transform: "translateY(-50%)", cursor: "ew-resize" } },
                        ].map(({ h, s }) => (
                          <div
                            key={h}
                            onMouseDown={(e) => { e.stopPropagation(); onResizeHandleDown(e, el, h); }}
                            style={{
                              position: "absolute", width: 8, height: 8,
                              background: "var(--gold)", border: "1px solid #000",
                              borderRadius: 2, zIndex: 10,
                              ...s as React.CSSProperties,
                            }}
                          />
                        ))}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: "var(--t3)" }}>
              {CARD_W}×{CARD_H}px · 85×55mm · arrastra los elementos para moverlos
            </div>
          </div>
        </div>

        {/* SIDEBAR */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", maxHeight: 560 }}>
          {/* Elements list */}
          <div style={panelStyle}>
            <h4 style={panelTitle}>Elementos · {side === "front" ? "Frente" : "Reverso"}</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 180, overflowY: "auto" }}>
              {elements.length === 0 && !loading && (
                <p style={{ fontSize: 11, color: "var(--t3)", textAlign: "center", padding: 8 }}>
                  Genera la tarjeta primero para ver elementos.
                </p>
              )}
              {elements.map((el) => (
                <div
                  key={el.id}
                  onClick={() => setSelectedId(selectedId === el.id ? null : el.id)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4,
                    padding: "5px 7px", borderRadius: 4, cursor: "pointer",
                    background: selectedId === el.id ? "rgba(212,175,55,0.15)" : "rgba(255,255,255,0.02)",
                    border: selectedId === el.id ? "1px solid var(--gold)" : "1px solid transparent",
                    opacity: el.hidden ? 0.45 : 1,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {elementLabel(el.id)} {el.type === "text" && el.text ? `· ${el.text.slice(0, 16)}` : ""}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--t3)" }}>
                      {el.type} · {Math.round(el.x)}, {Math.round(el.y)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleHidden(el.id); }}
                    style={iconBtn}
                    title={el.id.startsWith("extra-") ? "Eliminar" : el.hidden ? "Mostrar" : "Ocultar"}
                  >
                    {el.id.startsWith("extra-") ? <Trash2 size={11} /> : el.hidden ? <EyeOff size={11} /> : <Eye size={11} />}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Properties panel */}
          {selected && (
            <div style={panelStyle}>
              <h4 style={panelTitle}>
                <Type size={11} style={{ verticalAlign: -2, marginRight: 4 }} />
                {elementLabel(selected.id)}
              </h4>

              {selected.type === "text" && (
                <>
                  <label style={labelStyle}>Texto</label>
                  <textarea
                    value={selected.text || ""}
                    onChange={(e) => setOverride(selected.id, { text: e.target.value })}
                    style={{ ...inputStyle, minHeight: 52, resize: "vertical", marginBottom: 8 }}
                  />

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 5 }}>
                    <div>
                      <label style={labelStyle}>Tamaño</label>
                      <input type="number" min={6} max={200}
                        value={selected.fontSize ?? 22}
                        onChange={(e) => setOverride(selected.id, { fontSize: +e.target.value || 22 })}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Color</label>
                      <input type="color"
                        value={selected.color || "#ffffff"}
                        onChange={(e) => setOverride(selected.id, { color: e.target.value })}
                        style={{ width: "100%", height: 30, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, background: "transparent", padding: 0, cursor: "pointer" }}
                      />
                    </div>
                  </div>

                  <label style={labelStyle}>Fuente</label>
                  <select
                    value={selected.fontFamily || "Inter"}
                    onChange={(e) => setOverride(selected.id, { fontFamily: e.target.value })}
                    style={{ ...inputStyle, marginBottom: 5 }}
                  >
                    {POPULAR_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>

                  <div style={{ display: "flex", gap: 4, marginBottom: 5 }}>
                    <button
                      onClick={() => setOverride(selected.id, { fontWeight: (selected.fontWeight ?? 400) >= 600 ? 400 : 700 })}
                      style={{ ...iconBtn, background: (selected.fontWeight ?? 400) >= 600 ? "rgba(212,175,55,0.2)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "4px 8px", fontSize: 11, color: "var(--t1)" }}
                      title="Negrita"
                    ><Bold size={12} /></button>
                    <button
                      onClick={() => setOverride(selected.id, { italic: !selected.italic })}
                      style={{ ...iconBtn, background: selected.italic ? "rgba(212,175,55,0.2)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "4px 8px", fontSize: 11, color: "var(--t1)" }}
                      title="Cursiva"
                    ><Italic size={12} /></button>
                    {(["left", "center", "right"] as const).map((a, i) => (
                      <button key={a}
                        onClick={() => setOverride(selected.id, { align: a })}
                        style={{ ...iconBtn, background: selected.align === a ? "rgba(212,175,55,0.2)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "4px 8px", fontSize: 11, color: "var(--t1)" }}
                      >
                        {i === 0 ? <AlignLeft size={12} /> : i === 1 ? <AlignCenter size={12} /> : <AlignRight size={12} />}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {selected.type === "qr" && (
                <>
                  <label style={labelStyle}>URL del QR</label>
                  <input
                    value={(selected as any).qrUrl || ""}
                    onChange={(e) => setOverride(selected.id, { text: e.target.value })}
                    placeholder="https://…"
                    style={{ ...inputStyle, marginBottom: 8 }}
                  />
                </>
              )}

              {selected.type === "line" && (
                <>
                  <label style={labelStyle}>Color línea</label>
                  <input type="color"
                    value={selected.color || "#d4af37"}
                    onChange={(e) => setOverride(selected.id, { color: e.target.value })}
                    style={{ width: "100%", height: 30, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, background: "transparent", padding: 0, cursor: "pointer", marginBottom: 8 }}
                  />
                </>
              )}

              {/* Position + size */}
              <label style={labelStyle}>Posición (X, Y)</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 5 }}>
                <input type="number" value={Math.round(selected.x)}
                  onChange={(e) => setOverride(selected.id, { x: +e.target.value || 0 })}
                  style={inputStyle} placeholder="X" />
                <input type="number" value={Math.round(selected.y)}
                  onChange={(e) => setOverride(selected.id, { y: +e.target.value || 0 })}
                  style={inputStyle} placeholder="Y" />
              </div>

              <label style={labelStyle}>Tamaño (W, H)</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 5 }}>
                <input type="number" value={Math.round(selected.width)}
                  onChange={(e) => setOverride(selected.id, { width: +e.target.value || 40 })}
                  style={inputStyle} placeholder="W" />
                <input type="number" value={Math.round(selected.height)}
                  onChange={(e) => setOverride(selected.id, { height: +e.target.value || 20 })}
                  style={inputStyle} placeholder="H" />
              </div>

              {selected.id.startsWith("extra-") && (
                <button onClick={() => removeExtra(selected.id)} style={{ ...btnSecondary, width: "100%", justifyContent: "center", color: "#e84558", borderColor: "rgba(232,69,88,0.3)", marginTop: 4 }}>
                  <Trash2 size={12} /> Eliminar elemento
                </button>
              )}
            </div>
          )}

          {!selected && (
            <div style={{ ...panelStyle, textAlign: "center", padding: 16 }}>
              <p style={{ fontSize: 11, color: "var(--t3)", margin: 0, lineHeight: 1.5 }}>
                Haz clic en un elemento del canvas para seleccionarlo y editarlo.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared styles ────────────────────────────────────────────────────────────
const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: "5px 12px", fontSize: 11, borderRadius: 4,
  background: active ? "rgba(212,175,55,0.18)" : "transparent",
  border: active ? "1px solid var(--gold)" : "1px solid transparent",
  color: active ? "var(--gold)" : "var(--t2)", cursor: "pointer", fontWeight: 600,
});
const panelStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 8, padding: 10,
};
const panelTitle: React.CSSProperties = {
  fontSize: 10, color: "var(--gold)", margin: "0 0 8px",
  letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700,
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "5px 7px", fontSize: 11,
  background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 3, color: "var(--t1)", outline: "none", fontFamily: "inherit",
  boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = {
  fontSize: 10, color: "var(--t3)", display: "block", marginBottom: 3,
};
const btnPrimary: React.CSSProperties = {
  padding: "6px 10px", fontSize: 11, fontWeight: 600,
  background: "linear-gradient(135deg, var(--gold), #b8941e)",
  color: "#0a0a0a", border: "none", borderRadius: 5, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 5,
};
const btnSecondary: React.CSSProperties = {
  padding: "5px 8px", fontSize: 11,
  background: "rgba(255,255,255,0.05)", color: "var(--t1)",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 5,
};
const btnTool: React.CSSProperties = {
  padding: "5px 8px", fontSize: 11,
  background: "rgba(255,255,255,0.04)", color: "var(--t2)",
  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 4,
};
const iconBtn: React.CSSProperties = {
  background: "none", border: "none", color: "var(--t3)", cursor: "pointer",
  padding: 3, display: "inline-flex", alignItems: "center",
};
