/**
 * Card Studio · Editor visual con Konva.js (canvas real).
 *
 * Migrado desde position:absolute CSS divs a react-konva Stage/Layer
 * eliminando la desincronización visual entre editor y salida generada.
 *
 * Arquitectura de capas Konva:
 *   Layer "bg"       → imagen de fondo (frontUrl / backUrl)
 *   Layer "elements" → texto, logo, QR, líneas (todos draggables)
 *   Transformer      → handles de resize/rotate sobre el nodo seleccionado
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { Stage, Layer, Image as KImage, Text as KText, Rect, Line, Transformer } from "react-konva";
import Konva from "konva";
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
  if (id.startsWith("extra-")) return "Extra";
  return ELEMENT_LABELS[id] || id;
}
const POPULAR_FONTS = [
  "Inter", "Cinzel", "Playfair Display", "Montserrat", "Lato",
  "Source Serif Pro", "Space Grotesk", "JetBrains Mono",
  "Poppins", "Raleway", "Crimson Pro", "DM Sans", "DM Serif Display",
  "Georgia", "Times New Roman", "Arial", "Helvetica",
];

// ── Hook: carga una URL como blob (evita restricciones CORS del canvas) ───────
function useKonvaImage(src: string | null | undefined): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) { setImg(null); return; }
    let objectUrl: string | null = null;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(src, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        const im = new window.Image();
        im.onload = () => { if (!cancelled) setImg(im); };
        im.onerror = () => { if (!cancelled) setImg(null); };
        im.src = objectUrl;
      } catch {
        if (!cancelled) setImg(null);
      }
    };
    load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);
  return img;
}

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

  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const trRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Map<string, Konva.Node>>(new Map());
  const elemLayerRef = useRef<Konva.Layer | null>(null);

  const bgUrl = side === "front" ? frontUrl : backUrl;
  const bgImage = useKonvaImage(bgUrl);
  const logoImage = useKonvaImage(logoUrl);

  // Auto-zoom to fit container
  useEffect(() => {
    const el = stageContainerRef.current;
    if (!el) return;
    const available = el.clientWidth - 32;
    if (available > 100) setZoom(Math.max(0.3, Math.min(0.9, available / CARD_W)));
  }, []);

  // Sync overrides when parent resets them
  useEffect(() => { setOverrides(initialOverrides || {}); }, [initialOverrides]);

  // Load elements from backend when side changes
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
        const extras = (overrides.extras || []).filter(e => e.side === side);
        for (const ex of extras) {
          if (!merged.find(m => m.id === `extra-${ex.id}`)) {
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

  // Re-apply overrides without refetch
  useEffect(() => {
    setElements((prev) => {
      const sideOv = side === "front" ? overrides.front : overrides.back;
      return prev.map((el) => {
        if (el.id.startsWith("extra-")) {
          const exId = el.id.replace("extra-", "");
          const ex = (overrides.extras || []).find(e => e.id === exId);
          if (ex) return { ...el, x: ex.x, y: ex.y, width: ex.width, height: ex.height ?? el.height,
            text: ex.text, color: ex.color, fontSize: ex.fontSize, fontFamily: ex.fontFamily,
            fontWeight: ex.fontWeight, align: ex.align, italic: ex.italic, qrUrl: ex.qrUrl };
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

  // Attach Transformer to selected node
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    if (selectedId && nodeRefs.current.has(selectedId)) {
      tr.nodes([nodeRefs.current.get(selectedId)!]);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [selectedId, elements]);

  // Preload fonts when elements change
  useEffect(() => {
    const fonts = [...new Set(elements.map(e => e.fontFamily).filter(Boolean))] as string[];
    Promise.all(fonts.map(f => document.fonts.load(`16px "${f}"`))).then(() => {
      elemLayerRef.current?.batchDraw();
    });
  }, [elements]);

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

  // ── Konva node handlers ────────────────────────────────────────────────────
  const onDragEnd = useCallback((id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const nx = Math.round(Math.max(0, Math.min(CARD_W - 10, node.x())));
    const ny = Math.round(Math.max(0, Math.min(CARD_H - 10, node.y())));
    node.x(nx); node.y(ny);
    setOverride(id, { x: nx, y: ny });
  }, [setOverride]);

  const onTransformEnd = useCallback((id: string, el: ResolvedElement, e: Konva.KonvaEventObject<Event>) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    const nw = Math.round(Math.max(40, node.width() * scaleX));
    const nh = Math.round(Math.max(16, node.height() * scaleY));
    const nx = Math.round(node.x());
    const ny = Math.round(node.y());
    setOverride(id, { x: nx, y: ny, width: nw, height: nh,
      ...(el.type === "text" ? { fontSize: Math.round(Math.max(8, (el.fontSize ?? 22) * Math.min(scaleX, scaleY))) } : {}) });
  }, [setOverride]);

  // ── Actions ────────────────────────────────────────────────────────────────
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
    setOverride(id, { hidden: !sideOv[id]?.hidden });
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
    try { await onSaveOverrides(overrides); await onRegenerate(); }
    catch (err: any) { setError(err?.message || "Error re-renderizando"); }
    finally { setSaving(false); }
  };

  const selected = elements.find((e) => e.id === selectedId);
  const visibleElements = elements.filter(e => !e.hidden);

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      {/* TOOLBAR */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", padding: 3, borderRadius: 6 }}>
          <button onClick={() => { onSideChange("front"); setSelectedId(null); }} style={tabBtn(side === "front")}>Frente</button>
          <button onClick={() => { onSideChange("back"); setSelectedId(null); }} style={tabBtn(side === "back")}>Reverso</button>
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          <button onClick={() => addExtra("text")} style={btnTool} title="Añadir texto"><Type size={13} /> Texto</button>
          <button onClick={() => addExtra("line")} style={btnTool} title="Añadir línea"><Minus size={13} /> Línea</button>
          <button onClick={() => addExtra("qr")} style={btnTool} title="Añadir QR extra"><QrCode size={13} /> QR</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => setZoom(z => Math.max(0.25, z - 0.05))} style={iconBtn}><ZoomOut size={14}/></button>
          <span style={{ fontSize: 11, color: "var(--t3)", minWidth: 38, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(1.2, z + 0.05))} style={iconBtn}><ZoomIn size={14}/></button>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={resetSide} style={btnSecondary}><RotateCcw size={13} /> Reset</button>
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

      {/* ── KONVA STAGE (full width) ────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <div
          ref={stageContainerRef}
          style={{ background: "#0a0a0a", borderRadius: 8, overflow: "auto", display: "flex",
            alignItems: "flex-start", justifyContent: "center", padding: 16, minHeight: 420 }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            {loading ? (
              <div style={{ width: CARD_W * zoom, height: CARD_H * zoom, display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(ellipse at 20% 30%, #2a1f04 0%, #0d0d1a 70%)", borderRadius: 4, boxShadow: "0 8px 40px rgba(0,0,0,0.8)" }}>
                <Loader2 className="animate-spin" style={{ color: "var(--gold)" }} />
              </div>
            ) : (
              <Stage
                ref={stageRef}
                width={CARD_W * zoom}
                height={CARD_H * zoom}
                scaleX={zoom}
                scaleY={zoom}
                style={{ borderRadius: 4, boxShadow: "0 8px 40px rgba(0,0,0,0.8)", cursor: "default" }}
                onClick={(e) => { if (e.target === e.target.getStage()) setSelectedId(null); }}
              >
                {/* ── Background Layer ─────────────────────────────────── */}
                <Layer>
                  {bgImage ? (
                    <KImage image={bgImage} x={0} y={0} width={CARD_W} height={CARD_H} listening={false} />
                  ) : (
                    <Rect x={0} y={0} width={CARD_W} height={CARD_H}
                      fillRadialGradientStartPoint={{ x: CARD_W * 0.2, y: CARD_H * 0.3 }}
                      fillRadialGradientEndPoint={{ x: CARD_W * 0.5, y: CARD_H * 0.5 }}
                      fillRadialGradientStartRadius={0}
                      fillRadialGradientEndRadius={CARD_W * 0.8}
                      fillRadialGradientColorStops={[0, "#2a1f04", 1, "#0d0d0d"]}
                      listening={false}
                    />
                  )}
                </Layer>

                {/* ── Elements Layer ───────────────────────────────────── */}
                <Layer ref={elemLayerRef}>
                  {visibleElements.map((el) => {
                    const isSel = el.id === selectedId;
                    const commonProps = {
                      key: el.id,
                      x: el.x,
                      y: el.y,
                      rotation: el.rotate ?? 0,
                      draggable: true,
                      onClick: (e: Konva.KonvaEventObject<MouseEvent>) => { e.cancelBubble = true; setSelectedId(el.id); },
                      onTap: (e: Konva.KonvaEventObject<Event>) => { e.cancelBubble = true; setSelectedId(el.id); },
                      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => onDragEnd(el.id, e),
                      onTransformEnd: (e: Konva.KonvaEventObject<Event>) => onTransformEnd(el.id, el, e),
                      ref: (node: Konva.Node | null) => {
                        if (node) nodeRefs.current.set(el.id, node);
                        else nodeRefs.current.delete(el.id);
                      },
                    };

                    if (el.type === "text") {
                      const displayText = el.textTransform === "uppercase"
                        ? (el.text || "").toUpperCase()
                        : (el.text || "");
                      return (
                        <KText
                          {...commonProps}
                          width={el.width}
                          height={el.height}
                          text={displayText}
                          fontSize={el.fontSize ?? 22}
                          fontFamily={el.fontFamily ? `'${el.fontFamily}', sans-serif` : "Inter, sans-serif"}
                          fontStyle={[el.italic ? "italic" : "", el.fontWeight && el.fontWeight >= 600 ? "bold" : ""].filter(Boolean).join(" ") || "normal"}
                          fill={el.color ?? "#ffffff"}
                          align={el.align ?? "left"}
                          letterSpacing={el.letterSpacing ?? 0}
                          lineHeight={el.lineHeight ?? 1.3}
                          wrap="word"
                          ellipsis={false}
                          strokeWidth={0}
                        />
                      );
                    }

                    if (el.type === "logo") {
                      if (logoImage) {
                        return (
                          <KImage
                            {...commonProps}
                            image={logoImage}
                            width={el.width}
                            height={el.height}
                          />
                        );
                      }
                      return (
                        <Rect
                          {...commonProps}
                          width={el.width}
                          height={el.height}
                          fill="rgba(212,175,55,0.15)"
                          stroke="rgba(212,175,55,0.4)"
                          strokeWidth={1}
                          dash={[4, 4]}
                        />
                      );
                    }

                    if (el.type === "qr") {
                      return (
                        <Rect
                          {...commonProps}
                          width={el.width}
                          height={el.height}
                          fill="#ffffff"
                          cornerRadius={4}
                        />
                      );
                    }

                    if (el.type === "line") {
                      return (
                        <Rect
                          {...commonProps}
                          width={el.width}
                          height={Math.max(2, el.height)}
                          fill={el.color ?? "rgba(212,175,55,0.6)"}
                        />
                      );
                    }

                    return null;
                  })}

                  {/* Transformer (selection handles) */}
                  <Transformer
                    ref={trRef}
                    boundBoxFunc={(oldBox, newBox) => {
                      if (newBox.width < 20 || newBox.height < 10) return oldBox;
                      return newBox;
                    }}
                    borderStroke="var(--gold)"
                    borderStrokeWidth={1.5 / zoom}
                    anchorFill="#d4af37"
                    anchorStroke="#000"
                    anchorSize={8 / zoom}
                    rotateEnabled={true}
                    keepRatio={false}
                  />
                </Layer>
              </Stage>
            )}

            <div style={{ fontSize: 10, color: "var(--t3)" }}>
              {CARD_W}×{CARD_H}px · 85×55mm · arrastra los elementos para moverlos
            </div>
          </div>
        </div>
      </div>

      {/* ── ELEMENTOS + PROPIEDADES (debajo del canvas) ─────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 300px" : "1fr", gap: 10, alignItems: "start" }}>

        {/* Lista de elementos */}
        <div style={panelStyle}>
          <h4 style={panelTitle}>Elementos · {side === "front" ? "Frente" : "Reverso"}</h4>
          {elements.length === 0 && !loading ? (
            <p style={{ fontSize: 11, color: "var(--t3)", textAlign: "center", padding: "8px 0", margin: 0 }}>
              Genera la tarjeta primero para ver elementos.
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 4 }}>
              {elements.map((el) => (
                <div
                  key={el.id}
                  onClick={() => setSelectedId(selectedId === el.id ? null : el.id)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4,
                    padding: "5px 8px", borderRadius: 4, cursor: "pointer",
                    background: selectedId === el.id ? "rgba(212,175,55,0.15)" : "rgba(255,255,255,0.02)",
                    border: selectedId === el.id ? "1px solid var(--gold)" : "1px solid rgba(255,255,255,0.06)",
                    opacity: el.hidden ? 0.45 : 1,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {elementLabel(el.id)} {el.type === "text" && el.text ? `· ${el.text.slice(0, 14)}` : ""}
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
          )}
        </div>

        {/* Panel de propiedades (sólo cuando hay elemento seleccionado) */}
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
      </div>
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────
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
