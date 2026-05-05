/**
 * Card Studio · Editor visual de posiciones.
 *
 * Permite al usuario, después de generar la tarjeta:
 *  - Arrastrar cualquier elemento (texto, QR, logo, línea) sobre el preview
 *  - Editar texto/color/tamaño de fuente
 *  - Ocultar/mostrar elementos
 *  - Añadir textos extra como "componentes" libres
 *  - Persistir overrides y re-renderizar la imagen final
 */
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Eye, EyeOff, Move, Plus, RefreshCw, Save, Trash2, Type, X,
  RotateCcw, Loader2,
} from "lucide-react";

const STAGE_W = 1080;
const STAGE_H = 720;

type ElementOverride = {
  hidden?: boolean;
  x?: number; y?: number; width?: number; height?: number;
  fontSize?: number; color?: string;
  fontFamily?: string; fontWeight?: number;
  letterSpacing?: number; lineHeight?: number;
  align?: "left" | "center" | "right";
  textTransform?: "none" | "uppercase";
  text?: string; rotate?: number;
};
type ExtraElement = {
  id: string; side: "front" | "back"; type: "text" | "line";
  x: number; y: number; width: number; height?: number;
  text?: string; fontFamily?: string; fontSize?: number; fontWeight?: number;
  color?: string; align?: "left" | "center" | "right";
  letterSpacing?: number; textTransform?: "none" | "uppercase"; rotate?: number;
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
  letterSpacing?: number; lineHeight?: number; textTransform?: "none" | "uppercase";
  rotate?: number; hidden?: boolean;
};

interface Props {
  apiBase: string;
  cardId: number;
  frontUrl?: string | null;
  backUrl?: string | null;
  initialOverrides: LayoutOverrides;
  generating: boolean;
  onSaveOverrides: (overrides: LayoutOverrides) => Promise<void>;
  onRegenerate: () => Promise<void>;
  onClose: () => void;
}

const ELEMENT_LABELS: Record<string, string> = {
  logo: "Logo", company: "Empresa", name: "Nombre", title: "Cargo",
  line: "Línea", tagline: "Tagline",
  qr: "QR", qrLabel: "Etiqueta QR", brand: "Marca", email: "Email",
  phone: "Teléfono", web: "Web", social: "Social", address: "Dirección",
};

function elementLabel(id: string): string {
  if (id.startsWith("extra-")) return `Extra ${id.replace("extra-", "")}`;
  return ELEMENT_LABELS[id] || id;
}

export default function CardStudioEditor({
  apiBase, cardId, frontUrl, backUrl,
  initialOverrides, generating,
  onSaveOverrides, onRegenerate, onClose,
}: Props) {
  const [side, setSide] = useState<"front" | "back">("front");
  const [overrides, setOverrides] = useState<LayoutOverrides>(initialOverrides || {});
  const [elements, setElements] = useState<ResolvedElement[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.5); // 0.4..0.9 — el preview real es 1080×720

  const stageRef = useRef<HTMLDivElement | null>(null);
  const elementsRef = useRef<ResolvedElement[]>([]);
  const dragState = useRef<{
    id: string; startX: number; startY: number; origX: number; origY: number;
    lastX: number; lastY: number;
  } | null>(null);
  // Mantener `elementsRef` sincronizado para evitar closures rancios en mouseup
  useEffect(() => { elementsRef.current = elements; }, [elements]);

  // Cargar elementos resueltos cada vez que cambia side u overrides
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        // Asegurar que el backend tiene los overrides actuales antes de pedir elements
        // (los enviamos junto en query string como compact JSON sería pesado — mejor:
        //  guardamos un snapshot temporal sólo si han cambiado vs initialOverrides? No.
        //  Para simplicidad: dependemos de PATCH antes de cargar; aquí calculamos
        //  defaults+overrides directamente en cliente combinando el endpoint base
        //  con los overrides pendientes en cliente.)
        const res = await fetch(`${apiBase}/api/cards/${cardId}/elements?side=${side}`, { credentials: "include" });
        if (!res.ok) throw new Error((await res.json()).error || "Error cargando elementos");
        const data = await res.json();
        if (cancelled) return;
        // Aplicar overrides locales no persistidos sobre el resultado servidor
        const sideOv = side === "front" ? overrides.front : overrides.back;
        const merged: ResolvedElement[] = (data.elements as ResolvedElement[]).map((el) => {
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
            hidden: !!ov.hidden,
          };
        });
        // Añadir extras locales que no estén ya en data
        const extrasIds = new Set(merged.filter(e => e.id.startsWith("extra-")).map(e => e.id));
        const extras = (overrides.extras || []).filter(e => e.side === side && !extrasIds.has(`extra-${e.id}`));
        for (const ex of extras) {
          merged.push({
            id: `extra-${ex.id}`,
            type: ex.type === "line" ? "line" : "text",
            x: ex.x, y: ex.y, width: ex.width, height: ex.height ?? 40,
            text: ex.text, color: ex.color, fontSize: ex.fontSize,
            fontFamily: ex.fontFamily, fontWeight: ex.fontWeight,
            align: ex.align, letterSpacing: ex.letterSpacing,
            textTransform: ex.textTransform, rotate: ex.rotate,
          });
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

  // Reaplicar overrides al state local de elementos cuando cambian (sin refetch)
  useEffect(() => {
    setElements((prev) => {
      const sideOv = side === "front" ? overrides.front : overrides.back;
      return prev.map((el) => {
        const ov = sideOv?.[el.id];
        if (!ov) return { ...el, hidden: false };
        return {
          ...el,
          ...(ov.x !== undefined ? { x: ov.x } : {}),
          ...(ov.y !== undefined ? { y: ov.y } : {}),
          ...(ov.width !== undefined ? { width: ov.width } : {}),
          ...(ov.fontSize !== undefined ? { fontSize: ov.fontSize } : {}),
          ...(ov.color !== undefined ? { color: ov.color } : {}),
          ...(ov.text !== undefined && el.type === "text" ? { text: ov.text } : {}),
          ...(ov.align !== undefined ? { align: ov.align } : {}),
          hidden: !!ov.hidden,
        };
      });
    });
  }, [overrides, side]);

  const setOverride = useCallback((id: string, patch: ElementOverride) => {
    setOverrides((prev) => {
      // Si es un extra
      if (id.startsWith("extra-")) {
        const exId = id.replace("extra-", "");
        const extras = (prev.extras || []).map((e) => e.id === exId ? {
          ...e,
          ...(patch.x !== undefined ? { x: patch.x } : {}),
          ...(patch.y !== undefined ? { y: patch.y } : {}),
          ...(patch.width !== undefined ? { width: patch.width } : {}),
          ...(patch.fontSize !== undefined ? { fontSize: patch.fontSize } : {}),
          ...(patch.color !== undefined ? { color: patch.color } : {}),
          ...(patch.text !== undefined ? { text: patch.text } : {}),
          ...(patch.align !== undefined ? { align: patch.align } : {}),
        } : e);
        return { ...prev, extras };
      }
      const sideKey = side;
      const sideOv = { ...(prev[sideKey] || {}) };
      sideOv[id] = { ...(sideOv[id] || {}), ...patch };
      return { ...prev, [sideKey]: sideOv };
    });
  }, [side]);

  // ── Drag handlers ──────────────────────────────────────────────────────
  const onMouseDownEl = (e: React.MouseEvent, el: ResolvedElement) => {
    e.stopPropagation();
    setSelectedId(el.id);
    dragState.current = {
      id: el.id, startX: e.clientX, startY: e.clientY,
      origX: el.x, origY: el.y, lastX: el.x, lastY: el.y,
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };
  // Handlers como refs estables: leen zoom/elementos vía closure capturada
  // *en el momento del mousedown* — el zoom no cambia mid-drag y la posición
  // final viene del propio dragState (evita stale-closure de `elements`).
  const zoomRef = useRef(zoom); zoomRef.current = zoom;
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const ds = dragState.current; if (!ds) return;
    const z = zoomRef.current || 0.5;
    const dx = (e.clientX - ds.startX) / z;
    const dy = (e.clientY - ds.startY) / z;
    const nx = Math.max(0, Math.min(STAGE_W - 20, ds.origX + dx));
    const ny = Math.max(0, Math.min(STAGE_H - 20, ds.origY + dy));
    ds.lastX = nx; ds.lastY = ny;
    setElements((prev) => prev.map((el) => el.id === ds.id ? { ...el, x: nx, y: ny } : el));
  }, []);
  const handleMouseUp = useCallback(() => {
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
    const ds = dragState.current; if (!ds) return;
    dragState.current = null;
    // Coords finales tomadas directamente del dragState (no de React state)
    setOverride(ds.id, { x: Math.round(ds.lastX), y: Math.round(ds.lastY) });
  }, [handleMouseMove, setOverride]);

  // Cleanup defensivo: si el modal se cierra (unmount) en mitad de un drag,
  // garantiza que los listeners globales no queden huérfanos.
  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      dragState.current = null;
    };
  }, [handleMouseMove, handleMouseUp]);

  // ── Acciones ───────────────────────────────────────────────────────────
  const addExtra = () => {
    const id = String(Date.now()).slice(-6);
    const ex: ExtraElement = {
      id, side, type: "text",
      x: 200, y: 320, width: 400, height: 60,
      text: "Texto nuevo",
      fontFamily: "Inter", fontSize: 28, fontWeight: 600,
      color: "#ffffff", align: "left",
    };
    setOverrides((prev) => ({ ...prev, extras: [...(prev.extras || []), ex] }));
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

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div style={modalContent} onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <Move size={18} style={{ color: "var(--gold)" }} /> Editor visual
            </h3>
            <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", padding: 3, borderRadius: 6 }}>
              <button onClick={() => setSide("front")} style={tabBtn(side === "front")}>Frente</button>
              <button onClick={() => setSide("back")} style={tabBtn(side === "back")}>Reverso</button>
            </div>
            <label style={{ fontSize: 11, color: "var(--t3)", display: "flex", alignItems: "center", gap: 6 }}>
              Zoom
              <input type="range" min={0.3} max={0.9} step={0.05} value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} style={{ width: 100 }} />
              <span style={{ fontVariantNumeric: "tabular-nums", width: 36 }}>{Math.round(zoom * 100)}%</span>
            </label>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={resetSide} style={btnSecondary} title="Restablecer posiciones del lado actual">
              <RotateCcw size={14} /> Reset
            </button>
            <button onClick={savePositions} disabled={saving} style={btnSecondary}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
            </button>
            <button onClick={regenerateNow} disabled={saving || generating} style={btnPrimary}>
              {(saving || generating) ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Re-renderizar
            </button>
            <button onClick={onClose} style={{ ...btnSecondary, padding: 6 }}><X size={16} /></button>
          </div>
        </div>

        {error && (
          <div style={{ padding: 8, background: "rgba(232,69,88,0.12)", color: "#e84558", border: "1px solid #e84558", borderRadius: 6, fontSize: 12, marginBottom: 10 }}>
            {error}
          </div>
        )}

        {/* BODY: stage + sidebar */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 12, alignItems: "start" }}>
          {/* STAGE */}
          <div style={{ background: "rgba(0,0,0,0.4)", borderRadius: 8, padding: 16, overflow: "auto", maxHeight: "70vh" }}>
            <div
              ref={stageRef}
              onClick={() => setSelectedId(null)}
              style={{
                width: STAGE_W * zoom, height: STAGE_H * zoom,
                position: "relative", margin: "0 auto",
                backgroundImage: bgUrl ? `url(${bgUrl})` : "linear-gradient(45deg, #1a1a1a 25%, transparent 25%), linear-gradient(-45deg, #1a1a1a 25%, transparent 25%)",
                backgroundSize: bgUrl ? "100% 100%" : "20px 20px",
                backgroundColor: "#0a0a0a",
                border: "1px solid rgba(255,255,255,0.1)",
                outline: "1px dashed rgba(212,175,55,0.3)", // safe-zone visual
                outlineOffset: -84 * zoom,
              }}
            >
              {loading && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)" }}>
                  <Loader2 className="animate-spin" />
                </div>
              )}
              {elements.filter((e) => !e.hidden).map((el) => {
                const isSel = el.id === selectedId;
                return (
                  <div
                    key={el.id}
                    onMouseDown={(e) => onMouseDownEl(e, el)}
                    style={{
                      position: "absolute",
                      left: el.x * zoom, top: el.y * zoom,
                      width: el.width * zoom, height: el.height * zoom,
                      border: isSel ? "2px solid var(--gold)" : "1.5px dashed rgba(255,255,255,0.5)",
                      background: isSel ? "rgba(212,175,55,0.12)" : "rgba(255,255,255,0.04)",
                      cursor: "move", userSelect: "none",
                      display: "flex", alignItems: "center",
                      justifyContent: el.align === "center" ? "center" : el.align === "right" ? "flex-end" : "flex-start",
                      padding: 2 * zoom,
                      boxShadow: isSel ? "0 0 0 4px rgba(212,175,55,0.18)" : "none",
                    }}
                  >
                    <span style={{
                      fontSize: Math.max(8, 10 * (zoom > 0.5 ? 1 : 0.85)),
                      color: "var(--gold)",
                      fontWeight: 600,
                      background: "rgba(0,0,0,0.6)",
                      padding: "1px 4px",
                      borderRadius: 3,
                      pointerEvents: "none",
                      whiteSpace: "nowrap",
                      position: "absolute",
                      top: -16,
                      left: 0,
                    }}>
                      {elementLabel(el.id)} {el.type === "text" && el.text ? `· ${el.text.slice(0, 20)}${el.text.length > 20 ? "…" : ""}` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ textAlign: "center", color: "var(--t3)", fontSize: 11, marginTop: 8 }}>
              {STAGE_W}×{STAGE_H} px @ 300 DPI · trim 85×55 mm + 3 mm sangrado · safe-zone 7 mm (línea dorada)
            </div>
          </div>

          {/* SIDEBAR */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "70vh", overflowY: "auto" }}>
            <button onClick={addExtra} style={{ ...btnPrimary, justifyContent: "center" }}>
              <Plus size={14} /> Añadir texto
            </button>

            <div style={panelStyle}>
              <h4 style={panelTitle}>Elementos · {side}</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {elements.length === 0 && (
                  <p style={{ fontSize: 11, color: "var(--t3)", textAlign: "center" }}>Sin elementos. Genera la tarjeta primero.</p>
                )}
                {elements.map((el) => (
                  <div key={el.id}
                    onClick={() => setSelectedId(el.id)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
                      padding: 6, borderRadius: 4, cursor: "pointer",
                      background: selectedId === el.id ? "rgba(212,175,55,0.15)" : "rgba(255,255,255,0.03)",
                      border: selectedId === el.id ? "1px solid var(--gold)" : "1px solid transparent",
                      opacity: el.hidden ? 0.5 : 1,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {elementLabel(el.id)}
                      </div>
                      <div style={{ fontSize: 9, color: "var(--t3)" }}>
                        {Math.round(el.x)}, {Math.round(el.y)} · {el.type}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleHidden(el.id); }}
                      style={iconBtn} title={el.id.startsWith("extra-") ? "Eliminar" : el.hidden ? "Mostrar" : "Ocultar"}
                    >
                      {el.id.startsWith("extra-") ? <Trash2 size={12} /> : el.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {selected && selected.type === "text" && (
              <div style={panelStyle}>
                <h4 style={panelTitle}>
                  <Type size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                  Editar · {elementLabel(selected.id)}
                </h4>
                <Field label="Texto">
                  <textarea
                    value={selected.text || ""}
                    onChange={(e) => setOverride(selected.id, { text: e.target.value })}
                    style={{ ...inputStyle, minHeight: 50, resize: "vertical" }}
                  />
                </Field>
                <Field label="Tamaño fuente">
                  <input type="number" min={8} max={140}
                    value={selected.fontSize ?? 22}
                    onChange={(e) => setOverride(selected.id, { fontSize: parseInt(e.target.value) || 22 })}
                    style={inputStyle}
                  />
                </Field>
                <Field label="Color">
                  <input type="color"
                    value={selected.color || "#ffffff"}
                    onChange={(e) => setOverride(selected.id, { color: e.target.value })}
                    style={{ width: "100%", height: 30, border: "none", background: "transparent", padding: 0, cursor: "pointer" }}
                  />
                </Field>
                <Field label="Alineación">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                    {(["left", "center", "right"] as const).map((a) => (
                      <button key={a}
                        onClick={() => setOverride(selected.id, { align: a })}
                        style={{
                          ...btnSecondary, padding: 4, fontSize: 10, justifyContent: "center",
                          background: selected.align === a ? "rgba(212,175,55,0.2)" : "rgba(255,255,255,0.04)",
                          borderColor: selected.align === a ? "var(--gold)" : "rgba(255,255,255,0.1)",
                        }}
                      >{a}</button>
                    ))}
                  </div>
                </Field>
                <Field label="Posición (X, Y)">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                    <input type="number" value={Math.round(selected.x)} onChange={(e) => setOverride(selected.id, { x: parseInt(e.target.value) || 0 })} style={inputStyle} />
                    <input type="number" value={Math.round(selected.y)} onChange={(e) => setOverride(selected.id, { y: parseInt(e.target.value) || 0 })} style={inputStyle} />
                  </div>
                </Field>
                <Field label="Ancho">
                  <input type="number" value={Math.round(selected.width)} onChange={(e) => setOverride(selected.id, { width: parseInt(e.target.value) || 100 })} style={inputStyle} />
                </Field>
              </div>
            )}

            <p style={{ fontSize: 10, color: "var(--t3)", lineHeight: 1.5 }}>
              Arrastra cualquier elemento sobre la tarjeta para reposicionarlo.
              Después de editar, pulsa <b>Re-renderizar</b> para aplicar los cambios al PNG/PDF imprimibles.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Subcomponentes ─────────────────────────────────────────────────────────
function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 8 }}>
      <label style={{ fontSize: 10, color: "var(--t3)" }}>{label}</label>
      {children}
    </div>
  );
}

const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: "5px 10px", fontSize: 11, borderRadius: 4,
  background: active ? "rgba(212,175,55,0.18)" : "transparent",
  border: active ? "1px solid var(--gold)" : "1px solid transparent",
  color: active ? "var(--gold)" : "var(--t1)", cursor: "pointer", fontWeight: 600,
});

const modalBackdrop: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 1000, padding: 12,
};
const modalContent: React.CSSProperties = {
  background: "var(--ink, #0a0a0a)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10, padding: 16, width: "100%", maxWidth: 1400, maxHeight: "92vh",
  overflow: "hidden", display: "flex", flexDirection: "column",
};
const panelStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 8, padding: 10,
};
const panelTitle: React.CSSProperties = {
  fontSize: 10, color: "var(--gold)", margin: "0 0 8px",
  letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700,
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "5px 7px", fontSize: 11,
  background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 3, color: "var(--t1)", outline: "none", fontFamily: "inherit",
};
const btnPrimary: React.CSSProperties = {
  padding: "6px 10px", fontSize: 11, fontWeight: 600,
  background: "linear-gradient(135deg, var(--gold), #b8941e)",
  color: "#0a0a0a", border: "none", borderRadius: 5, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 5,
};
const btnSecondary: React.CSSProperties = {
  padding: "6px 10px", fontSize: 11,
  background: "rgba(255,255,255,0.05)", color: "var(--t1)",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 5,
};
const iconBtn: React.CSSProperties = {
  background: "none", border: "none", color: "var(--t3)", cursor: "pointer", padding: 3,
  display: "inline-flex", alignItems: "center",
};
