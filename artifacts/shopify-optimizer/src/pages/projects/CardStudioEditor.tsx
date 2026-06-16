/**
 * CardStudioEditor — Dual-Canvas Editor con Fabric.js
 *
 * Arquitectura:
 *   Dos lienzos Fabric independientes (Frente + Reverso) visibles
 *   simultáneamente. Las posiciones de los objetos están en el
 *   sistema de coordenadas del backend (1080 × 720 px).
 *
 *   Capas por canvas:
 *     background  → imagen generada por IA (vault, cargada con auth)
 *     objects     → textos, logos, líneas, QR (draggables, editables)
 *     bleed guide → rect de guía de sangrado (no seleccionable)
 *
 *   Exportación:
 *     ZIP con 01_Cara_Frontal.png + 02_Cara_Posterior.png a resolución
 *     completa (1080 × 720, multiplicador 1/zoom).
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { fabric } from "fabric";
import JSZip from "jszip";
import {
  Type, RefreshCw, Save, Trash2, Loader2, Minus,
  AlignLeft, AlignCenter, AlignRight, Bold, Italic,
  ZoomIn, ZoomOut, Download, RotateCcw, Eye, EyeOff,
} from "lucide-react";

// ── Constantes (deben coincidir con card-elements.ts del backend) ─────────────
const CANVAS_W = 1080;
const CANVAS_H = 720;
const SAFE_MARGIN = 40; // mismo valor que la constante SAFE del backend

// ── Tipos exportados (mismo contrato que antes) ───────────────────────────────
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

// ── Tipo de elemento resuelto (backend response) ──────────────────────────────
type ResolvedElement = {
  id: string;
  type: "text" | "qr" | "logo" | "line";
  x: number; y: number; width: number; height: number;
  text?: string; fontFamily?: string; fontSize?: number; fontWeight?: number;
  color?: string; align?: "left" | "center" | "right";
  letterSpacing?: number; lineHeight?: number;
  textTransform?: "none" | "uppercase";
  rotate?: number; hidden?: boolean; italic?: boolean;
  qrUrl?: string;
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  apiBase: string;
  cardId: number;
  frontUrl?: string | null;
  backUrl?: string | null;
  logoUrl?: string | null;
  initialOverrides: LayoutOverrides;
  generating: boolean;
  onSaveOverrides: (overrides: LayoutOverrides) => Promise<void>;
  onRegenerate: () => Promise<void>;
}

// ── Etiquetas ─────────────────────────────────────────────────────────────────
const ELEMENT_LABELS: Record<string, string> = {
  logo: "Logo", company: "Empresa", name: "Nombre", title: "Cargo",
  line: "Línea", tagline: "Tagline", qr: "QR", qrLabel: "Etiq. QR",
  brand: "Marca", email: "Email", phone: "Teléfono", web: "Web",
  social: "Social", address: "Dirección",
};
function elLabel(id: string) {
  if (id.startsWith("extra-")) return "Extra";
  return ELEMENT_LABELS[id] || id;
}

const POPULAR_FONTS = [
  "Inter", "Cinzel", "Playfair Display", "Montserrat", "Lato",
  "Source Serif Pro", "Space Grotesk", "JetBrains Mono",
  "Poppins", "Raleway", "Crimson Pro", "DM Sans", "DM Serif Display",
  "Georgia", "Times New Roman", "Arial", "Helvetica",
];

// ── Paso 2 (propuesta): configuración global de controles Fabric ──────────────
// Se llama una vez al montar el primer canvas. Bloquea escala no uniforme.
function configureFabricGlobals() {
  (fabric.Object.prototype as any).set({
    cornerStyle: "circle",
    cornerSize: 9,
    cornerColor: "#d4a843",
    borderColor: "#d4a843",
    cornerStrokeColor: "#0a0a0a",
    transparentCorners: false,
    padding: 5,
  });
  // Oculta handles del centro (escala solo desde esquinas → proporcional)
  fabric.Object.prototype.setControlsVisibility({
    ml: false, mr: false, mt: false, mb: false,
  });
}

// ── Paso 3 (propuesta): carga imagen con autenticación → blob URL ─────────────
async function fetchBlob(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  } catch { return null; }
}

// ── Paso 3: setBackgroundImage con cover scaling (bloqueado, bajo todo) ───────
async function applyBackground(url: string, canvas: fabric.Canvas): Promise<void> {
  const blobUrl = await fetchBlob(url);
  if (!blobUrl) return;
  return new Promise<void>((resolve) => {
    // Usamos HTMLImageElement directamente: más fiable que fabric.Image.fromURL con blob URLs
    const imgEl = new Image();
    imgEl.onload = () => {
      const w = imgEl.naturalWidth || imgEl.width;
      const h = imgEl.naturalHeight || imgEl.height;
      if (!w || !h) { URL.revokeObjectURL(blobUrl); resolve(); return; }
      const fabricImg = new fabric.Image(imgEl as HTMLImageElement);
      URL.revokeObjectURL(blobUrl);
      const scale = Math.max(CANVAS_W / w, CANVAS_H / h);
      fabricImg.set({
        scaleX: scale, scaleY: scale,
        originX: "center", originY: "center",
        left: CANVAS_W / 2, top: CANVAS_H / 2,
        selectable: false, evented: false,
        hasBorders: false, hasControls: false,
      });
      canvas.setBackgroundImage(fabricImg, () => { canvas.renderAll(); resolve(); });
    };
    imgEl.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(); };
    imgEl.src = blobUrl;
  });
}

// ── Paso 3: dibuja la guía de sangrado (no seleccionable) ────────────────────
function addBleedGuide(canvas: fabric.Canvas): fabric.Rect {
  const guide = new fabric.Rect({
    left: SAFE_MARGIN,
    top: SAFE_MARGIN,
    width: CANVAS_W - SAFE_MARGIN * 2,
    height: CANVAS_H - SAFE_MARGIN * 2,
    fill: "transparent",
    stroke: "rgba(255, 65, 65, 0.55)",
    strokeWidth: 1.5,
    strokeDashArray: [7, 5],
    selectable: false,
    evented: false,
    hasBorders: false,
    hasControls: false,
  } as any);
  canvas.add(guide);
  canvas.bringToFront(guide);
  return guide;
}

// ── Paso 2: addTextbox — centrado, editable inline, al frente ────────────────
function addFabricTextbox(
  canvas: fabric.Canvas,
  text: string,
  side: "front" | "back",
  extraId: string,
  options: Partial<fabric.ITextboxOptions> = {}
): fabric.Textbox {
  const tb = new fabric.Textbox(text, {
    left: CANVAS_W * 0.1,
    top: CANVAS_H * 0.4,
    width: CANVAS_W * 0.6,
    fontSize: 32,
    fontFamily: "Inter",
    fill: side === "front" ? "#ffffff" : "#1a1a1a",
    textAlign: "left",
    editable: true,
    splitByGrapheme: false,
    ...options,
    data: { id: `extra-${extraId}`, side, type: "text" },
    name: `extra-${extraId}`,
  } as any);
  canvas.add(tb);
  canvas.bringToFront(tb);
  canvas.setActiveObject(tb);
  canvas.renderAll();
  return tb;
}

// ── Puebla un canvas con los elementos recibidos del backend ──────────────────
async function populateCanvas(
  canvas: fabric.Canvas,
  elements: ResolvedElement[],
  side: "front" | "back",
  logoUrl: string | null | undefined,
  guide: fabric.Rect | null
) {
  // Quitar todos los objetos salvo la guía de sangrado
  const toRemove = canvas.getObjects().filter(o => o !== guide);
  canvas.remove(...toRemove);

  const fontFamilies = new Set<string>();

  for (const el of elements) {
    if (el.hidden) continue;

    if (el.type === "text") {
      fontFamilies.add(el.fontFamily || "Inter");
      const displayText = el.textTransform === "uppercase"
        ? (el.text || "").toUpperCase()
        : (el.text || "Texto");

      const tb = new fabric.Textbox(displayText, {
        left: el.x, top: el.y,
        width: el.width,
        fontSize: el.fontSize || 24,
        fontFamily: el.fontFamily ? `'${el.fontFamily}'` : "Inter",
        fontWeight: String(el.fontWeight || 400),
        fontStyle: el.italic ? "italic" : "normal",
        fill: el.color || "#ffffff",
        textAlign: el.align || "left",
        lineHeight: el.lineHeight || 1.3,
        editable: true,
        splitByGrapheme: false,
        data: { id: el.id, side, type: "text" },
        name: el.id,
      } as any);
      canvas.add(tb);

    } else if (el.type === "logo" && logoUrl) {
      const blobUrl = await fetchBlob(logoUrl);
      if (blobUrl) {
        await new Promise<void>((res) => {
          fabric.Image.fromURL(blobUrl, (img) => {
            URL.revokeObjectURL(blobUrl);
            if (!img) { res(); return; }
            const sw = img.width || 1;
            const sh = img.height || 1;
            img.set({
              left: el.x, top: el.y,
              scaleX: el.width / sw,
              scaleY: el.height / sh,
              data: { id: el.id, side, type: "logo" },
              name: el.id,
            } as any);
            canvas.add(img);
            res();
          });
        });
      } else {
        // Logo placeholder si no carga
        const rect = new fabric.Rect({
          left: el.x, top: el.y, width: el.width, height: el.height,
          fill: "rgba(212,175,55,0.12)",
          stroke: "rgba(212,175,55,0.35)", strokeWidth: 1,
          strokeDashArray: [4, 4],
          data: { id: el.id, side, type: "logo" }, name: el.id,
        } as any);
        canvas.add(rect);
      }

    } else if (el.type === "line") {
      const rect = new fabric.Rect({
        left: el.x, top: el.y,
        width: el.width, height: Math.max(2, el.height || 3),
        fill: el.color || "rgba(212,175,55,0.6)",
        data: { id: el.id, side, type: "line" }, name: el.id,
      } as any);
      canvas.add(rect);

    } else if (el.type === "qr") {
      // Placeholder visual del QR (el real lo genera el backend)
      const grp = new fabric.Group([
        new fabric.Rect({
          width: el.width, height: el.height || el.width,
          fill: "#ffffff", rx: 4, ry: 4,
          stroke: "rgba(212,175,55,0.3)", strokeWidth: 1,
        }),
        new fabric.Text("QR", {
          fontSize: 20, fill: "#888",
          originX: "center", originY: "center",
          left: (el.width || 160) / 2, top: (el.height || el.width || 160) / 2,
        }),
      ], {
        left: el.x, top: el.y, subTargetCheck: false,
        data: { id: el.id, side, type: "qr" }, name: el.id,
      } as any);
      canvas.add(grp);
    }
  }

  // Precargar fuentes antes del renderAll
  if (fontFamilies.size > 0) {
    await Promise.all([...fontFamilies].map(f =>
      document.fonts.load(`16px '${f}'`).catch(() => {})
    ));
  }

  // La guía de sangrado siempre queda encima
  if (guide) canvas.bringToFront(guide);
  canvas.renderAll();
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
export default function CardStudioEditor({
  apiBase, cardId, frontUrl, backUrl, logoUrl,
  initialOverrides, generating,
  onSaveOverrides, onRegenerate,
}: Props) {

  // ── Refs de los elementos <canvas> ─────────────────────────────────────────
  const frontCanvasEl = useRef<HTMLCanvasElement | null>(null);
  const backCanvasEl = useRef<HTMLCanvasElement | null>(null);

  // ── Instancias Fabric (sin causar re-renders) ───────────────────────────────
  const frontFabric = useRef<fabric.Canvas | null>(null);
  const backFabric = useRef<fabric.Canvas | null>(null);

  // ── Refs para guías de sangrado ────────────────────────────────────────────
  const frontGuide = useRef<fabric.Rect | null>(null);
  const backGuide = useRef<fabric.Rect | null>(null);

  // ── Estado React ───────────────────────────────────────────────────────────
  const [canvasesReady, setCanvasesReady] = useState(false);
  const [overrides, setOverrides] = useState<LayoutOverrides>(initialOverrides || {});
  const [frontElements, setFrontElements] = useState<ResolvedElement[]>([]);
  const [backElements, setBackElements] = useState<ResolvedElement[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.43);
  const zoomRef = useRef(0.43);

  // ── Paso 4: estado del objeto activo (selección → React) ───────────────────
  const [activeCanvas, setActiveCanvas] = useState<"front" | "back" | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [selSide, setSelSide] = useState<"front" | "back" | null>(null);
  const [selProps, setSelProps] = useState<{
    type: string; text?: string; fill?: string;
    fontSize?: number; fontFamily?: string; fontWeight?: string;
    fontStyle?: string; textAlign?: string;
    left?: number; top?: number; width?: number; height?: number;
  } | null>(null);

  // ── Sync overrides cuando el padre los resetea ──────────────────────────────
  useEffect(() => { setOverrides(initialOverrides || {}); }, [initialOverrides]);

  // ── Paso 1: inicialización segura de los dos lienzos Fabric ───────────────
  useEffect(() => {
    if (!frontCanvasEl.current || !backCanvasEl.current) return;

    configureFabricGlobals();

    const z = zoomRef.current;
    const opts: fabric.ICanvasOptions = {
      width: CANVAS_W * z,
      height: CANVAS_H * z,
      preserveObjectStacking: true,
      selection: true,
    };

    const fc = new fabric.Canvas(frontCanvasEl.current, {
      ...opts, backgroundColor: "#111111",
    });
    fc.setZoom(z);

    const bc = new fabric.Canvas(backCanvasEl.current, {
      ...opts, backgroundColor: "#f4f4f4",
    });
    bc.setZoom(z);

    frontFabric.current = fc;
    backFabric.current = bc;

    // Añadir guías de sangrado a ambos lienzos
    frontGuide.current = addBleedGuide(fc);
    backGuide.current = addBleedGuide(bc);

    // ── Paso 4: event listeners de selección ─────────────────────────────
    const bindSelection = (canvas: fabric.Canvas, side: "front" | "back") => {
      const extract = (obj: fabric.Object | null) => {
        if (!obj) { setSelId(null); setSelSide(null); setSelProps(null); return; }
        const data = (obj as any).data;
        setActiveCanvas(side);
        setSelId(data?.id ?? null);
        setSelSide(side);
        setSelProps({
          type: data?.type ?? obj.type ?? "unknown",
          text: obj.type === "textbox" ? (obj as fabric.Textbox).text : undefined,
          fill: String(obj.fill ?? ""),
          fontSize: obj.type === "textbox" ? (obj as fabric.Textbox).fontSize : undefined,
          fontFamily: obj.type === "textbox"
            ? String((obj as fabric.Textbox).fontFamily ?? "").replace(/'/g, "")
            : undefined,
          fontWeight: obj.type === "textbox"
            ? String((obj as fabric.Textbox).fontWeight ?? "400")
            : undefined,
          fontStyle: obj.type === "textbox" ? (obj as fabric.Textbox).fontStyle : undefined,
          textAlign: obj.type === "textbox" ? (obj as fabric.Textbox).textAlign : undefined,
          left: Math.round(obj.left ?? 0),
          top: Math.round(obj.top ?? 0),
          width: Math.round((obj.width ?? 0) * (obj.scaleX ?? 1)),
          height: Math.round((obj.height ?? 0) * (obj.scaleY ?? 1)),
        });
      };
      canvas.on("selection:created", (e: any) => extract(e.selected?.[0] ?? null));
      canvas.on("selection:updated", (e: any) => extract(e.selected?.[0] ?? null));
      canvas.on("selection:cleared", () => {
        setSelId(null); setSelSide(null); setSelProps(null);
      });

      // Sincroniza posición/tamaño al mover o transformar
      canvas.on("object:modified", (e: any) => {
        const obj = e.target;
        if (!obj) return;
        const data = (obj as any).data;
        if (!data?.id) return;

        // Normalizar escala → colapsar a width/height reales
        const sx = obj.scaleX ?? 1;
        const sy = obj.scaleY ?? 1;
        const nw = Math.round((obj.width ?? 40) * sx);
        const nh = Math.round((obj.height ?? 20) * sy);
        const nx = Math.round(obj.left ?? 0);
        const ny = Math.round(obj.top ?? 0);
        if (sx !== 1 || sy !== 1) {
          obj.set({ scaleX: 1, scaleY: 1, width: nw, height: nh });
        }

        const patch: ElementOverride = { x: nx, y: ny, width: nw, height: nh };
        if (obj.type === "textbox") {
          patch.text = (obj as fabric.Textbox).text;
          patch.fontSize = (obj as fabric.Textbox).fontSize;
          patch.color = String((obj as fabric.Textbox).fill ?? "");
          patch.fontFamily = String((obj as fabric.Textbox).fontFamily ?? "").replace(/'/g, "");
          patch.align = (obj as fabric.Textbox).textAlign as any;
        }

        setOverrides(prev => {
          const id = data.id as string;
          const s = data.side as "front" | "back";
          if (id.startsWith("extra-")) {
            const exId = id.replace("extra-", "");
            return { ...prev, extras: (prev.extras || []).map(ex => ex.id === exId ? { ...ex, ...patch } : ex) };
          }
          const sideOv = { ...(prev[s] ?? {}) };
          sideOv[id] = { ...(sideOv[id] ?? {}), ...patch };
          return { ...prev, [s]: sideOv };
        });

        // Actualiza panel de propiedades
        extract(obj);
        canvas.renderAll();
      });

      // Texto editado inline (doble click)
      canvas.on("text:changed" as any, (e: any) => {
        const obj = e.target;
        if (!obj || obj.type !== "textbox") return;
        const data = (obj as any).data;
        if (!data?.id) return;
        setOverrides(prev => {
          const id = data.id as string;
          const s = data.side as "front" | "back";
          if (id.startsWith("extra-")) {
            const exId = id.replace("extra-", "");
            return { ...prev, extras: (prev.extras || []).map(ex => ex.id === exId ? { ...ex, text: (obj as fabric.Textbox).text } : ex) };
          }
          const sideOv = { ...(prev[s] ?? {}) };
          sideOv[id] = { ...(sideOv[id] ?? {}), text: (obj as fabric.Textbox).text };
          return { ...prev, [s]: sideOv };
        });
      });
    };

    bindSelection(fc, "front");
    bindSelection(bc, "back");

    setCanvasesReady(true);

    return () => {
      fc.dispose();
      bc.dispose();
      frontFabric.current = null;
      backFabric.current = null;
      frontGuide.current = null;
      backGuide.current = null;
      setCanvasesReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Carga elementos de ambas caras en paralelo (una sola vez por cardId) ───
  useEffect(() => {
    if (!cardId) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const [fr, br] = await Promise.all([
          fetch(`${apiBase}/api/cards/${cardId}/elements?side=front`, { credentials: "include" }),
          fetch(`${apiBase}/api/cards/${cardId}/elements?side=back`, { credentials: "include" }),
        ]);
        if (!fr.ok || !br.ok) throw new Error("Error cargando elementos");
        const [fd, bd] = await Promise.all([fr.json(), br.json()]);
        if (cancelled) return;
        setFrontElements(fd.elements || []);
        setBackElements(bd.elements || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Error cargando elementos");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [cardId, apiBase]);

  // ── Popula canvas Frente cuando canvas listo + elementos disponibles ────────
  useEffect(() => {
    const fc = frontFabric.current;
    if (!canvasesReady || !fc || frontElements.length === 0) return;
    populateCanvas(fc, frontElements, "front", logoUrl, frontGuide.current);
  }, [canvasesReady, frontElements, logoUrl]);

  // ── Popula canvas Reverso ──────────────────────────────────────────────────
  useEffect(() => {
    const bc = backFabric.current;
    if (!canvasesReady || !bc || backElements.length === 0) return;
    populateCanvas(bc, backElements, "back", logoUrl, backGuide.current);
  }, [canvasesReady, backElements, logoUrl]);

  // ── Paso 3: cargar fondo Frente cuando cambia frontUrl ────────────────────
  useEffect(() => {
    const fc = frontFabric.current;
    if (!canvasesReady || !fc || !frontUrl) return;
    applyBackground(frontUrl, fc);
  }, [canvasesReady, frontUrl]);

  // ── Paso 3: cargar fondo Reverso cuando cambia backUrl ────────────────────
  useEffect(() => {
    const bc = backFabric.current;
    if (!canvasesReady || !bc || !backUrl) return;
    applyBackground(backUrl, bc);
  }, [canvasesReady, backUrl]);

  // ── Manejo de zoom en ambos lienzos ───────────────────────────────────────
  const applyZoom = useCallback((newZoom: number) => {
    zoomRef.current = newZoom;
    setZoom(newZoom);
    [frontFabric.current, backFabric.current].forEach(c => {
      if (!c) return;
      c.setZoom(newZoom);
      c.setDimensions({ width: CANVAS_W * newZoom, height: CANVAS_H * newZoom });
      c.renderAll();
    });
  }, []);

  // ── Paso 2: añadir textbox centrado en el canvas activo ───────────────────
  const addTextbox = useCallback((targetSide?: "front" | "back") => {
    const side = targetSide ?? activeCanvas ?? "front";
    const canvas = side === "front" ? frontFabric.current : backFabric.current;
    const guide = side === "front" ? frontGuide.current : backGuide.current;
    if (!canvas) return;
    const id = String(Date.now()).slice(-6);
    const ex: ExtraElement = {
      id, side, type: "text",
      x: CANVAS_W * 0.1, y: CANVAS_H * 0.4,
      width: CANVAS_W * 0.6, height: 60,
      text: "Texto nuevo", fontFamily: "Inter",
      fontSize: 32, fontWeight: 400,
      color: side === "front" ? "#ffffff" : "#1a1a1a",
      align: "left",
    };
    setOverrides(prev => ({ ...prev, extras: [...(prev.extras || []), ex] }));
    const tb = addFabricTextbox(canvas, "Texto nuevo", side, id);
    if (guide) canvas.bringToFront(guide);
    canvas.renderAll();
    return tb;
  }, [activeCanvas]);

  // ── Añadir línea decorativa ───────────────────────────────────────────────
  const addLine = useCallback((targetSide?: "front" | "back") => {
    const side = targetSide ?? activeCanvas ?? "front";
    const canvas = side === "front" ? frontFabric.current : backFabric.current;
    const guide = side === "front" ? frontGuide.current : backGuide.current;
    if (!canvas) return;
    const id = String(Date.now()).slice(-6);
    const ex: ExtraElement = {
      id, side, type: "line",
      x: SAFE_MARGIN, y: CANVAS_H / 2,
      width: CANVAS_W - SAFE_MARGIN * 2, height: 3,
      color: "rgba(212,175,55,0.6)",
    };
    setOverrides(prev => ({ ...prev, extras: [...(prev.extras || []), ex] }));
    const rect = new fabric.Rect({
      left: ex.x, top: ex.y, width: ex.width, height: ex.height,
      fill: ex.color,
      data: { id: `extra-${id}`, side, type: "line" }, name: `extra-${id}`,
    } as any);
    canvas.add(rect);
    if (guide) canvas.bringToFront(guide);
    canvas.renderAll();
  }, [activeCanvas]);

  // ── Eliminar elemento seleccionado ────────────────────────────────────────
  const deleteSelected = useCallback(() => {
    const canvas = selSide === "front" ? frontFabric.current : backFabric.current;
    if (!canvas || !selId) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    canvas.remove(obj);
    canvas.discardActiveObject();
    canvas.renderAll();
    if (selId.startsWith("extra-")) {
      const exId = selId.replace("extra-", "");
      setOverrides(prev => ({ ...prev, extras: (prev.extras || []).filter(e => e.id !== exId) }));
    } else {
      setOverrides(prev => {
        const s = selSide as "front" | "back";
        const sideOv = { ...(prev[s] ?? {}) };
        sideOv[selId] = { ...(sideOv[selId] ?? {}), hidden: true };
        return { ...prev, [s]: sideOv };
      });
    }
    setSelId(null); setSelSide(null); setSelProps(null);
  }, [selId, selSide]);

  // ── Reset posiciones de un lado ───────────────────────────────────────────
  const resetSide = useCallback((side: "front" | "back") => {
    if (!confirm(`¿Restablecer posiciones del ${side === "front" ? "frente" : "reverso"}?`)) return;
    setOverrides(prev => ({ ...prev, [side]: {} }));
    const elements = side === "front" ? frontElements : backElements;
    const canvas = side === "front" ? frontFabric.current : backFabric.current;
    const guide = side === "front" ? frontGuide.current : backGuide.current;
    if (canvas) populateCanvas(canvas, elements, side, logoUrl, guide);
  }, [frontElements, backElements, logoUrl]);

  // ── Guardar overrides en backend ──────────────────────────────────────────
  const saveAll = async () => {
    setSaving(true); setError(null);
    try { await onSaveOverrides(overrides); }
    catch (e: any) { setError(e?.message || "Error guardando"); }
    finally { setSaving(false); }
  };

  // ── Re-generar tarjeta ────────────────────────────────────────────────────
  const regenerate = async () => {
    setSaving(true); setError(null);
    try { await onSaveOverrides(overrides); await onRegenerate(); }
    catch (e: any) { setError(e?.message || "Error"); }
    finally { setSaving(false); }
  };

  // ── Exportar ZIP para imprenta ────────────────────────────────────────────
  const exportToZip = useCallback(async () => {
    const fc = frontFabric.current;
    const bc = backFabric.current;
    if (!fc || !bc) return;
    setExporting(true);
    try {
      // Ocultar guías para la exportación
      const fg = frontGuide.current;
      const bg2 = backGuide.current;
      if (fg) fg.set({ visible: false });
      if (bg2) bg2.set({ visible: false });
      fc.renderAll(); bc.renderAll();

      const mult = 1 / zoomRef.current; // exportar a resolución completa (1080×720)
      const frontData = fc.toDataURL({ format: "png", multiplier: mult });
      const backData  = bc.toDataURL({ format: "png", multiplier: mult });

      // Restaurar guías
      if (fg) fg.set({ visible: true });
      if (bg2) bg2.set({ visible: true });
      fc.renderAll(); bc.renderAll();

      // Crear ZIP con nomenclatura de imprenta
      const zip = new JSZip();
      zip.file("01_Cara_Frontal_Datos.png",     frontData.split(",")[1], { base64: true });
      zip.file("02_Cara_Posterior_Diseño.png",  backData.split(",")[1],  { base64: true });

      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "tarjeta-imprenta.zip";
      a.click();
      URL.revokeObjectURL(a.href);
    } finally { setExporting(false); }
  }, []);

  // ── Actualizar propiedad del objeto seleccionado desde el panel ───────────
  const updateSelProp = useCallback((fabricProp: string, value: any, overrideProp?: string) => {
    const canvas = selSide === "front" ? frontFabric.current : backFabric.current;
    if (!canvas || !selId) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    obj.set(fabricProp as any, value);
    canvas.renderAll();
    setSelProps(prev => prev ? { ...prev, [fabricProp === "fill" ? "fill" : fabricProp]: value } : prev);
    // Guardar en overrides inmediatamente
    const key = overrideProp ?? fabricProp;
    const patch: ElementOverride = { [key]: value };
    setOverrides(prev => {
      if (selId.startsWith("extra-")) {
        const exId = selId.replace("extra-", "");
        return { ...prev, extras: (prev.extras || []).map(ex => ex.id === exId ? { ...ex, ...patch } : ex) };
      }
      const s = selSide as "front" | "back";
      const sideOv = { ...(prev[s] ?? {}) };
      sideOv[selId] = { ...(sideOv[selId] ?? {}), ...patch };
      return { ...prev, [s]: sideOv };
    });
  }, [selId, selSide]);

  // ── Todos los elementos visibles (para el panel de lista) ─────────────────
  const allFrontVisible = frontElements.filter(e => !e.hidden);
  const allBackVisible  = backElements.filter(e => !e.hidden);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* ── TOOLBAR ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>

        {/* Añadir elementos */}
        <div style={{ display: "flex", gap: 5 }}>
          <button onClick={() => addTextbox("front")} style={btnTool} title="Texto en Frente">
            <Type size={12}/> Texto·F
          </button>
          <button onClick={() => addTextbox("back")} style={btnTool} title="Texto en Reverso">
            <Type size={12}/> Texto·R
          </button>
          <button onClick={() => addLine("front")} style={btnTool} title="Línea en Frente">
            <Minus size={12}/> Línea·F
          </button>
          <button onClick={() => addLine("back")} style={btnTool} title="Línea en Reverso">
            <Minus size={12}/> Línea·R
          </button>
        </div>

        {/* Zoom */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <button onClick={() => applyZoom(Math.max(0.25, zoom - 0.05))} style={iconBtn}><ZoomOut size={13}/></button>
          <span style={{ fontSize: 11, color: "var(--t3)", minWidth: 36, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => applyZoom(Math.min(1.0, zoom + 0.05))} style={iconBtn}><ZoomIn size={13}/></button>
        </div>

        {/* Acciones principales */}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <button onClick={() => resetSide("front")} style={btnSecondary} title="Reset Frente">
            <RotateCcw size={12}/> Reset·F
          </button>
          <button onClick={() => resetSide("back")} style={btnSecondary} title="Reset Reverso">
            <RotateCcw size={12}/> Reset·R
          </button>
          <button onClick={saveAll} disabled={saving} style={btnSecondary}>
            {saving ? <Loader2 size={12} className="animate-spin"/> : <Save size={12}/>} Guardar
          </button>
          <button onClick={exportToZip} disabled={exporting} style={btnSecondary} title="Exportar ZIP para imprenta (300 DPI)">
            {exporting ? <Loader2 size={12} className="animate-spin"/> : <Download size={12}/>} ZIP
          </button>
          <button onClick={regenerate} disabled={saving || generating} style={btnPrimary}>
            {(saving || generating) ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12}/>}
            Re-generar
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 8, background: "rgba(232,69,88,0.12)", color: "#e84558", border: "1px solid #e84558", borderRadius: 6, fontSize: 12 }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, fontSize: 12, color: "var(--t3)" }}>
          <Loader2 size={14} className="animate-spin" style={{ color: "var(--gold)" }}/> Cargando elementos…
        </div>
      )}

      {/* ── DUAL CANVAS ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 4 }}>

        {/* Frente */}
        <div style={{ flex: "0 0 auto" }}>
          <div style={{
            fontSize: 10, color: selSide === "front" ? "var(--gold)" : "var(--t3)",
            letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700,
            marginBottom: 6, paddingLeft: 2,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: selSide === "front" ? "var(--gold)" : "rgba(255,255,255,0.2)", display: "inline-block" }}/>
            Cara Frontal
            <span style={{ fontSize: 9, color: "var(--t3)", fontWeight: 400 }}>doble clic para editar texto</span>
          </div>
          <div data-testid="canvas-front-area" style={{ background: "#0a0a0a", borderRadius: 8, boxShadow: "0 8px 32px rgba(0,0,0,0.7)", overflow: "hidden", border: selSide === "front" ? "2px solid var(--gold)" : "2px solid transparent" }}>
            <canvas ref={frontCanvasEl} data-testid="canvas-front" />
          </div>
          <div style={{ fontSize: 9, color: "var(--t3)", marginTop: 4, textAlign: "center" }}>
            {CANVAS_W}×{CANVAS_H}px · zona segura {CANVAS_W - SAFE_MARGIN*2}×{CANVAS_H - SAFE_MARGIN*2}px (línea roja)
          </div>
        </div>

        {/* Reverso */}
        <div style={{ flex: "0 0 auto" }}>
          <div style={{
            fontSize: 10, color: selSide === "back" ? "var(--gold)" : "var(--t3)",
            letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700,
            marginBottom: 6, paddingLeft: 2,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: selSide === "back" ? "var(--gold)" : "rgba(255,255,255,0.2)", display: "inline-block" }}/>
            Cara Posterior
          </div>
          <div data-testid="canvas-back-area" style={{ background: "#0a0a0a", borderRadius: 8, boxShadow: "0 8px 32px rgba(0,0,0,0.7)", overflow: "hidden", border: selSide === "back" ? "2px solid var(--gold)" : "2px solid transparent" }}>
            <canvas ref={backCanvasEl} data-testid="canvas-back" />
          </div>
          <div style={{ fontSize: 9, color: "var(--t3)", marginTop: 4, textAlign: "center" }}>
            {CANVAS_W}×{CANVAS_H}px · texto a sangrado: no cruzar la línea roja
          </div>
        </div>
      </div>

      {/* ── ELEMENTOS + PROPIEDADES (debajo del canvas) ─────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: selId ? "1fr 300px" : "1fr", gap: 10, alignItems: "start" }}>

        {/* Lista de elementos — agrupados por cara */}
        <div style={panelStyle}>
          <h4 style={panelTitle}>
            Elementos del lienzo
            {selId && <span style={{ marginLeft: 8, color: "var(--t3)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>— seleccionado: {elLabel(selId)} ({selSide === "front" ? "Frente" : "Reverso"})</span>}
          </h4>

          {(allFrontVisible.length > 0 || allBackVisible.length > 0) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 4 }}>
              {[...allFrontVisible.map(e => ({ ...e, _side: "front" as const })), ...allBackVisible.map(e => ({ ...e, _side: "back" as const }))].map(el => (
                <div
                  key={`${el._side}-${el.id}`}
                  onClick={() => {
                    const canvas = el._side === "front" ? frontFabric.current : backFabric.current;
                    if (!canvas) return;
                    const obj = canvas.getObjects().find((o: any) => o.name === el.id);
                    if (obj) { canvas.setActiveObject(obj); canvas.renderAll(); }
                  }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4,
                    padding: "5px 8px", borderRadius: 4, cursor: "pointer",
                    background: selId === el.id && selSide === el._side ? "rgba(212,175,55,0.15)" : "rgba(255,255,255,0.02)",
                    border: selId === el.id && selSide === el._side ? "1px solid var(--gold)" : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {elLabel(el.id)}{el.type === "text" && el.text ? ` · ${el.text.slice(0, 12)}` : ""}
                    </div>
                    <div style={{ fontSize: 9, color: el._side === "front" ? "rgba(212,175,55,0.7)" : "rgba(100,200,255,0.7)" }}>
                      {el._side === "front" ? "Frente" : "Reverso"} · {el.type}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (el.id.startsWith("extra-")) {
                        const canvas = el._side === "front" ? frontFabric.current : backFabric.current;
                        if (!canvas) return;
                        const obj = canvas.getObjects().find((o: any) => o.name === el.id);
                        if (obj) { canvas.remove(obj); canvas.renderAll(); }
                        const exId = el.id.replace("extra-", "");
                        setOverrides(prev => ({ ...prev, extras: (prev.extras || []).filter(ex => ex.id !== exId) }));
                      } else {
                        setOverrides(prev => {
                          const sideOv = { ...(prev[el._side] ?? {}) };
                          sideOv[el.id] = { ...(sideOv[el.id] ?? {}), hidden: true };
                          return { ...prev, [el._side]: sideOv };
                        });
                        const canvas = el._side === "front" ? frontFabric.current : backFabric.current;
                        if (canvas) {
                          const obj = canvas.getObjects().find((o: any) => o.name === el.id);
                          if (obj) { canvas.remove(obj); canvas.renderAll(); }
                        }
                      }
                    }}
                    style={iconBtn}
                    title={el.id.startsWith("extra-") ? "Eliminar" : "Ocultar"}
                  >
                    {el.id.startsWith("extra-") ? <Trash2 size={11}/> : <EyeOff size={11}/>}
                  </button>
                </div>
              ))}
            </div>
          )}
          {!loading && allFrontVisible.length === 0 && allBackVisible.length === 0 && (
            <p style={{ fontSize: 11, color: "var(--t3)", textAlign: "center", margin: 0, padding: 8 }}>
              Genera la tarjeta primero para ver los elementos.
            </p>
          )}
        </div>

        {/* ── PANEL DE PROPIEDADES (Paso 4: actualiza desde selección) ────── */}
        {selId && selProps && (
          <div style={panelStyle}>
            <h4 style={{ ...panelTitle, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span><Type size={11} style={{ marginRight: 4, verticalAlign: -2 }}/>{elLabel(selId)}</span>
              {selId.startsWith("extra-") && (
                <button onClick={deleteSelected} style={{ background: "none", border: "none", color: "#e84558", cursor: "pointer", padding: 0 }}>
                  <Trash2 size={12}/>
                </button>
              )}
            </h4>

            {/* Propiedades de texto */}
            {selProps.type === "text" && (
              <>
                <label style={labelStyle}>Texto</label>
                <textarea
                  value={selProps.text || ""}
                  onChange={(e) => {
                    const canvas = selSide === "front" ? frontFabric.current : backFabric.current;
                    const obj = canvas?.getActiveObject() as fabric.Textbox;
                    if (obj && obj.type === "textbox") {
                      obj.set("text", e.target.value);
                      canvas?.renderAll();
                    }
                    setSelProps(p => p ? { ...p, text: e.target.value } : p);
                    setOverrides(prev => {
                      if (!selId || !selSide) return prev;
                      if (selId.startsWith("extra-")) {
                        const exId = selId.replace("extra-", "");
                        return { ...prev, extras: (prev.extras || []).map(ex => ex.id === exId ? { ...ex, text: e.target.value } : ex) };
                      }
                      const sideOv = { ...(prev[selSide] ?? {}) };
                      sideOv[selId] = { ...(sideOv[selId] ?? {}), text: e.target.value };
                      return { ...prev, [selSide]: sideOv };
                    });
                  }}
                  style={{ ...inputStyle, minHeight: 50, resize: "vertical", marginBottom: 8 }}
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 5 }}>
                  <div>
                    <label style={labelStyle}>Tamaño</label>
                    <input type="number" min={6} max={300} value={selProps.fontSize ?? 24}
                      onChange={(e) => updateSelProp("fontSize", +e.target.value || 24, "fontSize")}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Color</label>
                    <input type="color" value={selProps.fill || "#ffffff"}
                      onChange={(e) => updateSelProp("fill", e.target.value, "color")}
                      style={{ width: "100%", height: 30, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, background: "transparent", padding: 0, cursor: "pointer" }}
                    />
                  </div>
                </div>
                <label style={labelStyle}>Fuente</label>
                <select value={(selProps.fontFamily || "Inter").replace(/'/g, "")}
                  onChange={(e) => updateSelProp("fontFamily", `'${e.target.value}'`, "fontFamily")}
                  style={{ ...inputStyle, marginBottom: 5 }}
                >
                  {POPULAR_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <div style={{ display: "flex", gap: 4, marginBottom: 5 }}>
                  <button
                    onClick={() => {
                      const isBold = (selProps.fontWeight ?? "400") === "700" || selProps.fontWeight === "bold";
                      updateSelProp("fontWeight", isBold ? "400" : "bold", "fontWeight");
                    }}
                    style={{ ...iconBtn, background: (selProps.fontWeight === "700" || selProps.fontWeight === "bold") ? "rgba(212,175,55,0.2)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "4px 8px" }}
                    title="Negrita"
                  ><Bold size={12}/></button>
                  <button
                    onClick={() => updateSelProp("fontStyle", selProps.fontStyle === "italic" ? "normal" : "italic", "italic")}
                    style={{ ...iconBtn, background: selProps.fontStyle === "italic" ? "rgba(212,175,55,0.2)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "4px 8px" }}
                    title="Cursiva"
                  ><Italic size={12}/></button>
                  {(["left", "center", "right"] as const).map((a, i) => (
                    <button key={a}
                      onClick={() => updateSelProp("textAlign", a, "align")}
                      style={{ ...iconBtn, background: selProps.textAlign === a ? "rgba(212,175,55,0.2)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "4px 8px" }}
                    >
                      {i === 0 ? <AlignLeft size={12}/> : i === 1 ? <AlignCenter size={12}/> : <AlignRight size={12}/>}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Propiedades de línea (color) */}
            {selProps.type === "line" && (
              <>
                <label style={labelStyle}>Color de línea</label>
                <input type="color" value={selProps.fill || "#d4af37"}
                  onChange={(e) => updateSelProp("fill", e.target.value, "color")}
                  style={{ width: "100%", height: 30, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, background: "transparent", padding: 0, cursor: "pointer", marginBottom: 8 }}
                />
              </>
            )}

            {/* Posición */}
            <label style={labelStyle}>Posición (X, Y)</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 5 }}>
              <input type="number" value={selProps.left ?? 0}
                onChange={(e) => updateSelProp("left", +e.target.value || 0, "x")}
                style={inputStyle} placeholder="X"/>
              <input type="number" value={selProps.top ?? 0}
                onChange={(e) => updateSelProp("top", +e.target.value || 0, "y")}
                style={inputStyle} placeholder="Y"/>
            </div>
            <label style={labelStyle}>Tamaño (W, H)</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 5 }}>
              <input type="number" value={selProps.width ?? 100}
                onChange={(e) => updateSelProp("width", +e.target.value || 40, "width")}
                style={inputStyle} placeholder="W"/>
              <input type="number" value={selProps.height ?? 40}
                onChange={(e) => updateSelProp("height", +e.target.value || 20, "height")}
                style={inputStyle} placeholder="H"/>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
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
  padding: "5px 7px", fontSize: 10,
  background: "rgba(255,255,255,0.04)", color: "var(--t2)",
  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 3,
};
const iconBtn: React.CSSProperties = {
  background: "none", border: "none", color: "var(--t3)", cursor: "pointer",
  padding: 3, display: "inline-flex", alignItems: "center",
};
