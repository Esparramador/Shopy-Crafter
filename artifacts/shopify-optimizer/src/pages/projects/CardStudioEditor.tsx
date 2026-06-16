/**
 * CardStudioEditor — Estudio Gráfico Profesional con Fabric.js
 *
 * Arquitectura CORRECTA (sin ghost mode):
 *   - bgUrl  → fondo puro (textura IA sin texto/QR) como Fabric background
 *   - Todos los elementos son objetos Fabric REALES y editables
 *   - Texto doble-clic para editar directamente en el lienzo
 *   - QR cargado como imagen real desde /api/cards/:id/qr.png
 *   - Tecla Supr/Backspace elimina el objeto seleccionado
 *   - Nuevas herramientas: formas, emojis, bocadillos de texto
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { fabric } from "fabric";
import JSZip from "jszip";
import {
  Type, RefreshCw, Save, Trash2, Loader2, Minus,
  AlignLeft, AlignCenter, AlignRight, Bold, Italic,
  ZoomIn, ZoomOut, Download, RotateCcw, EyeOff,
  Square, Circle, Triangle, Smile, MessageSquare,
} from "lucide-react";

// ── Constantes ────────────────────────────────────────────────────────────────
const CANVAS_W = 1080;
const CANVAS_H = 720;
const SAFE_MARGIN = 40;

// ── Tipos ─────────────────────────────────────────────────────────────────────
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
  plate?: { color: string; opacity: number; padding: number; radius: number } | null;
};
export type ExtraElement = {
  id: string; side: "front" | "back"; type: "text" | "line" | "qr" | "shape" | "emoji" | "bubble";
  x: number; y: number; width: number; height?: number;
  text?: string; fontFamily?: string; fontSize?: number; fontWeight?: number;
  color?: string; align?: "left" | "center" | "right";
  letterSpacing?: number; textTransform?: "none" | "uppercase";
  rotate?: number; italic?: boolean;
  qrUrl?: string;
  shapeType?: "rect" | "circle" | "triangle";
  fill?: string; stroke?: string; strokeWidth?: number;
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
  qrUrl?: string;
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  apiBase: string;
  cardId: number;
  bgUrl?: string | null;        // fondo puro (textura sin texto/QR)
  frontUrl?: string | null;     // compuesto final (para descarga)
  backUrl?: string | null;
  logoUrl?: string | null;
  initialOverrides: LayoutOverrides;
  generating: boolean;
  onSaveOverrides: (overrides: LayoutOverrides) => Promise<void>;
  onRegenerate: () => Promise<void>;
  onThemePrompt?: (prompt: string) => void; // callback para presets de tema
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
  "Georgia", "Times New Roman", "Arial", "Helvetica", "Oswald", "Bebas Neue",
  "Comic Sans MS", "Orbitron", "Press Start 2P",
];

// ── Emojis frecuentes para selector ──────────────────────────────────────────
const EMOJI_LIST = [
  "⭐","🌟","💫","✨","🔥","💥","🎯","🏆","💎","👑",
  "🎨","🖌️","📱","💻","🌐","📧","📞","📍","💼","🚀",
  "❤️","💛","💚","💙","💜","🖤","🤍","🎭","🎬","🎵",
  "😊","😎","🤝","👏","💪","✌️","👍","🙌","🌈","🦋",
];

// ── Temas de fondo con prompts IA ─────────────────────────────────────────────
export const BACKGROUND_THEMES = [
  { id: "pixel",      emoji: "👾", label: "Pixel Art",    prompt: "8-bit pixel art retro video game background pattern, sharp pixels, dark navy blue and gold palette, no text" },
  { id: "lego",       emoji: "🧱", label: "Lego",         prompt: "LEGO bricks pattern background, colorful interlocking blocks texture, plastic sheen, no text" },
  { id: "scifi",      emoji: "🚀", label: "Sci-Fi",       prompt: "futuristic sci-fi dark background, glowing neon circuit board lines, deep space stars, holographic blue purple, no text" },
  { id: "underground",emoji: "🎸", label: "Underground",  prompt: "urban underground graffiti wall texture, dark concrete, spray paint splatters, grungy street art style, no text" },
  { id: "comic",      emoji: "💥", label: "Cómic",        prompt: "classic comic book halftone dot pattern background, bold primary colors, pop art style, no text" },
  { id: "anime",      emoji: "🌸", label: "Anime",        prompt: "anime style background, sakura cherry blossoms, soft watercolor sky gradient, japanese manga aesthetic, no text" },
  { id: "retro",      emoji: "📺", label: "Retro 80s",   prompt: "retro 1980s synthwave sunset background, neon pink purple grid lines, vapor wave aesthetic, dark sky, no text" },
  { id: "nature",     emoji: "🌿", label: "Naturaleza",   prompt: "lush tropical botanical leaves background, dark emerald green, gold veins, luxury nature texture, no text" },
  { id: "marble",     emoji: "🪨", label: "Mármol",       prompt: "white and gold luxury marble texture background, elegant veins, polished surface, no text" },
  { id: "luxury",     emoji: "✨", label: "Luxury Gold",  prompt: "dark black background with golden geometric lines and patterns, luxury premium business card texture, no text" },
  { id: "tech",       emoji: "💻", label: "Tech Dark",    prompt: "dark technology background, matrix code rain green on black, digital circuit patterns, minimal, no text" },
  { id: "watercolor", emoji: "🎨", label: "Acuarela",     prompt: "beautiful watercolor wash background, soft pastel ink blooms, artistic texture, bleed edges, no text" },
];

// ── Configuración global de controles Fabric ──────────────────────────────────
function configureFabricGlobals() {
  (fabric.Object.prototype as any).set({
    cornerStyle: "circle", cornerSize: 10,
    cornerColor: "#d4af37", borderColor: "#d4af37",
    cornerStrokeColor: "#0a0a0a", transparentCorners: false, padding: 6,
  });
  fabric.Object.prototype.setControlsVisibility({ ml: false, mr: false, mt: false, mb: false });
}

// ── Carga imagen con auth → blob URL ─────────────────────────────────────────
async function fetchBlob(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  } catch { return null; }
}

// ── Aplicar fondo como Fabric background image ────────────────────────────────
async function applyBackground(url: string, canvas: fabric.Canvas): Promise<void> {
  const blobUrl = await fetchBlob(url);
  if (!blobUrl) return;
  return new Promise<void>((resolve) => {
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

// ── Guía de sangrado ──────────────────────────────────────────────────────────
function addBleedGuide(canvas: fabric.Canvas): fabric.Rect {
  const guide = new fabric.Rect({
    left: SAFE_MARGIN, top: SAFE_MARGIN,
    width: CANVAS_W - SAFE_MARGIN * 2, height: CANVAS_H - SAFE_MARGIN * 2,
    fill: "transparent",
    stroke: "rgba(255,65,65,0.5)", strokeWidth: 1.5,
    strokeDashArray: [7, 5],
    selectable: false, evented: false,
    hasBorders: false, hasControls: false,
  } as any);
  canvas.add(guide);
  canvas.bringToFront(guide);
  return guide;
}

// ── Puebla canvas con elementos del backend (SIN ghost mode) ─────────────────
async function populateCanvas(
  canvas: fabric.Canvas,
  elements: ResolvedElement[],
  side: "front" | "back",
  logoUrl: string | null | undefined,
  guide: fabric.Rect | null,
  apiBase: string,
  cardId: number,
) {
  const toRemove = canvas.getObjects().filter(o => o !== guide);
  canvas.remove(...toRemove);

  for (const el of elements) {
    if (el.hidden) continue;

    if (el.type === "text") {
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
            img.set({
              left: el.x, top: el.y,
              scaleX: el.width / (img.width || 1),
              scaleY: el.height / (img.height || 1),
              data: { id: el.id, side, type: "logo" },
              name: el.id,
            });
            canvas.add(img);
            res();
          }, { crossOrigin: "anonymous" });
        });
      }
    } else if (el.type === "line") {
      const rect = new fabric.Rect({
        left: el.x, top: el.y, width: el.width, height: el.height || 2,
        fill: el.color || "rgba(212,175,55,0.8)",
        data: { id: el.id, side, type: "line" },
        name: el.id,
      } as any);
      canvas.add(rect);
    } else if (el.type === "qr") {
      // Carga el QR real como imagen desde el backend
      const qrBlobUrl = await fetchBlob(`${apiBase}/api/cards/${cardId}/qr.png`);
      if (qrBlobUrl) {
        await new Promise<void>((res) => {
          fabric.Image.fromURL(qrBlobUrl, (img) => {
            URL.revokeObjectURL(qrBlobUrl);
            if (!img) { res(); return; }
            const sw = img.width || 400;
            const sh = img.height || 400;
            img.set({
              left: el.x, top: el.y,
              scaleX: el.width / sw,
              scaleY: el.height / sh,
              data: { id: el.id, side, type: "qr" },
              name: el.id,
            });
            canvas.add(img);
            res();
          }, { crossOrigin: "anonymous" });
        });
      } else {
        // Placeholder si el QR no se puede cargar
        const ph = new fabric.Rect({
          left: el.x, top: el.y, width: el.width, height: el.height,
          fill: "#ffffff", stroke: "#ccc", strokeWidth: 2, rx: 4, ry: 4,
          data: { id: el.id, side, type: "qr" }, name: el.id,
        } as any);
        canvas.add(ph);
      }
    }
  }

  if (guide) canvas.bringToFront(guide);
  canvas.renderAll();
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
export default function CardStudioEditor({
  apiBase, cardId, bgUrl, frontUrl, backUrl, logoUrl,
  initialOverrides, generating,
  onSaveOverrides, onRegenerate, onThemePrompt,
}: Props) {

  const frontCanvasEl = useRef<HTMLCanvasElement | null>(null);
  const backCanvasEl = useRef<HTMLCanvasElement | null>(null);
  const frontFabric = useRef<fabric.Canvas | null>(null);
  const backFabric = useRef<fabric.Canvas | null>(null);
  const frontGuide = useRef<fabric.Rect | null>(null);
  const backGuide = useRef<fabric.Rect | null>(null);

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
  const [activeCanvas, setActiveCanvas] = useState<"front" | "back" | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [selSide, setSelSide] = useState<"front" | "back" | null>(null);
  const [selProps, setSelProps] = useState<{
    type: string; text?: string; fill?: string; stroke?: string;
    fontSize?: number; fontFamily?: string; fontWeight?: string;
    fontStyle?: string; textAlign?: string;
    left?: number; top?: number; width?: number; height?: number;
    opacity?: number;
  } | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const [activeTab, setActiveTab] = useState<"elementos" | "temas">("elementos");

  useEffect(() => { setOverrides(initialOverrides || {}); }, [initialOverrides]);

  // ── Inicializar canvases ──────────────────────────────────────────────────
  useEffect(() => {
    if (!frontCanvasEl.current || !backCanvasEl.current) return;
    configureFabricGlobals();

    const z = zoomRef.current;
    const opts: fabric.ICanvasOptions = {
      width: CANVAS_W * z, height: CANVAS_H * z,
      preserveObjectStacking: true, selection: true,
    };

    const fc = new fabric.Canvas(frontCanvasEl.current, { ...opts, backgroundColor: "#111111" });
    fc.setZoom(z);
    const bc = new fabric.Canvas(backCanvasEl.current, { ...opts, backgroundColor: "#f4f4f4" });
    bc.setZoom(z);

    frontFabric.current = fc;
    backFabric.current = bc;
    frontGuide.current = addBleedGuide(fc);
    backGuide.current = addBleedGuide(bc);

    // ── Selección y eventos ──────────────────────────────────────────────
    const bindAll = (canvas: fabric.Canvas, side: "front" | "back") => {
      const extract = (obj: fabric.Object | null) => {
        if (!obj) { setSelId(null); setSelSide(null); setSelProps(null); return; }
        const data = (obj as any).data;
        setActiveCanvas(side);
        setSelId(data?.id ?? obj.name ?? null);
        setSelSide(side);
        const isTb = obj.type === "textbox";
        const isRect = obj.type === "rect";
        const isCircle = obj.type === "circle";
        const isTri = obj.type === "triangle";
        setSelProps({
          type: data?.type ?? obj.type ?? "unknown",
          text: isTb ? (obj as fabric.Textbox).text : undefined,
          fill: String(obj.fill ?? ""),
          stroke: isTb ? undefined : String((obj as any).stroke ?? ""),
          fontSize: isTb ? (obj as fabric.Textbox).fontSize : undefined,
          fontFamily: isTb ? String((obj as fabric.Textbox).fontFamily ?? "").replace(/'/g, "") : undefined,
          fontWeight: isTb ? String((obj as fabric.Textbox).fontWeight ?? "400") : undefined,
          fontStyle: isTb ? (obj as fabric.Textbox).fontStyle : undefined,
          textAlign: isTb ? (obj as fabric.Textbox).textAlign : undefined,
          left: Math.round(obj.left ?? 0),
          top: Math.round(obj.top ?? 0),
          width: Math.round((obj.width ?? 0) * (obj.scaleX ?? 1)),
          height: Math.round((obj.height ?? 0) * (obj.scaleY ?? 1)),
          opacity: obj.opacity ?? 1,
        });
      };

      canvas.on("selection:created", (e: any) => extract(e.selected?.[0] ?? null));
      canvas.on("selection:updated", (e: any) => extract(e.selected?.[0] ?? null));
      canvas.on("selection:cleared", () => { setSelId(null); setSelSide(null); setSelProps(null); });

      canvas.on("object:modified", (e: any) => {
        const obj = e.target;
        if (!obj) return;
        const data = (obj as any).data;
        if (!data?.id) return;
        const sx = obj.scaleX ?? 1; const sy = obj.scaleY ?? 1;
        const nw = Math.round((obj.width ?? 40) * sx);
        const nh = Math.round((obj.height ?? 20) * sy);
        const nx = Math.round(obj.left ?? 0);
        const ny = Math.round(obj.top ?? 0);
        if (sx !== 1 || sy !== 1) obj.set({ scaleX: 1, scaleY: 1, width: nw, height: nh });

        const patch: ElementOverride = { x: nx, y: ny, width: nw, height: nh };
        if (obj.type === "textbox") {
          patch.text = (obj as fabric.Textbox).text;
          patch.fontSize = (obj as fabric.Textbox).fontSize;
          const f = String((obj as fabric.Textbox).fill ?? "");
          if (f && f !== "transparent") patch.color = f;
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
        extract(obj);
        canvas.renderAll();
      });

      canvas.on("text:changed" as any, (e: any) => {
        const obj = e.target;
        if (!obj || obj.type !== "textbox") return;
        const data = (obj as any).data;
        if (!data?.id) return;
        const newText = (obj as fabric.Textbox).text;
        setSelProps(p => p ? { ...p, text: newText } : p);
        setOverrides(prev => {
          const id = data.id as string;
          const s = data.side as "front" | "back";
          if (id.startsWith("extra-")) {
            const exId = id.replace("extra-", "");
            return { ...prev, extras: (prev.extras || []).map(ex => ex.id === exId ? { ...ex, text: newText } : ex) };
          }
          const sideOv = { ...(prev[s] ?? {}) };
          sideOv[id] = { ...(sideOv[id] ?? {}), text: newText };
          return { ...prev, [s]: sideOv };
        });
      });
    };

    bindAll(fc, "front");
    bindAll(bc, "back");

    // ── Tecla Delete/Backspace elimina el objeto seleccionado ────────────
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (e.key !== "Delete" && e.key !== "Backspace") return;

      for (const [canvas, side] of [[fc, "front"], [bc, "back"]] as const) {
        const obj = canvas.getActiveObject();
        if (!obj) continue;
        if ((obj as any).isEditing) continue;
        const data = (obj as any).data;
        const id: string = data?.id ?? obj.name ?? "";
        canvas.remove(obj);
        canvas.discardActiveObject();
        canvas.renderAll();
        setSelId(null); setSelSide(null); setSelProps(null);
        if (id.startsWith("extra-")) {
          const exId = id.replace("extra-", "");
          setOverrides(prev => ({ ...prev, extras: (prev.extras || []).filter(ex => ex.id !== exId) }));
        } else if (id) {
          setOverrides(prev => {
            const sideOv = { ...(prev[side] ?? {}) };
            sideOv[id] = { ...(sideOv[id] ?? {}), hidden: true };
            return { ...prev, [side]: sideOv };
          });
        }
        break;
      }
    };
    window.addEventListener("keydown", onKeyDown);

    setCanvasesReady(true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      fc.dispose(); bc.dispose();
      frontFabric.current = null; backFabric.current = null;
      frontGuide.current = null; backGuide.current = null;
      setCanvasesReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cargar elementos de ambas caras ───────────────────────────────────────
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

  // ── Poblar canvas frente ──────────────────────────────────────────────────
  useEffect(() => {
    const fc = frontFabric.current;
    if (!canvasesReady || !fc || frontElements.length === 0) return;
    populateCanvas(fc, frontElements, "front", logoUrl, frontGuide.current, apiBase, cardId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasesReady, frontElements, logoUrl, cardId]);

  // ── Poblar canvas reverso ─────────────────────────────────────────────────
  useEffect(() => {
    const bc = backFabric.current;
    if (!canvasesReady || !bc || backElements.length === 0) return;
    populateCanvas(bc, backElements, "back", logoUrl, backGuide.current, apiBase, cardId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasesReady, backElements, logoUrl, cardId]);

  // ── Fondo: usa bgUrl (textura pura) si existe, si no usa frontUrl/backUrl ─
  useEffect(() => {
    const fc = frontFabric.current;
    if (!canvasesReady || !fc) return;
    const url = bgUrl || frontUrl;
    if (url) applyBackground(url, fc);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasesReady, bgUrl, frontUrl]);

  useEffect(() => {
    const bc = backFabric.current;
    if (!canvasesReady || !bc) return;
    const url = bgUrl || backUrl;
    if (url) applyBackground(url, bc);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasesReady, bgUrl, backUrl]);

  // ── Zoom ──────────────────────────────────────────────────────────────────
  const applyZoom = useCallback((nz: number) => {
    zoomRef.current = nz;
    setZoom(nz);
    [frontFabric.current, backFabric.current].forEach(c => {
      if (!c) return;
      c.setZoom(nz);
      c.setDimensions({ width: CANVAS_W * nz, height: CANVAS_H * nz });
      c.renderAll();
    });
  }, []);

  // ── Añadir textbox ────────────────────────────────────────────────────────
  const addTextbox = useCallback((targetSide?: "front" | "back") => {
    const side = targetSide ?? activeCanvas ?? "front";
    const canvas = side === "front" ? frontFabric.current : backFabric.current;
    const guide = side === "front" ? frontGuide.current : backGuide.current;
    if (!canvas) return;
    const id = `${Date.now()}`.slice(-7);
    const ex: ExtraElement = {
      id, side, type: "text",
      x: CANVAS_W * 0.1, y: CANVAS_H * 0.4,
      width: CANVAS_W * 0.6, height: 60,
      text: "Texto nuevo", fontFamily: "Inter", fontSize: 36, fontWeight: 400,
      color: "#ffffff", align: "left",
    };
    setOverrides(prev => ({ ...prev, extras: [...(prev.extras || []), ex] }));
    const tb = new fabric.Textbox("Texto nuevo", {
      left: ex.x, top: ex.y, width: ex.width,
      fontSize: 36, fontFamily: "Inter", fill: side === "front" ? "#ffffff" : "#1a1a1a",
      textAlign: "left", editable: true, splitByGrapheme: false,
      data: { id: `extra-${id}`, side, type: "text" }, name: `extra-${id}`,
    } as any);
    canvas.add(tb);
    if (guide) canvas.bringToFront(guide);
    canvas.setActiveObject(tb);
    canvas.renderAll();
  }, [activeCanvas]);

  // ── Añadir línea decorativa ───────────────────────────────────────────────
  const addLine = useCallback((targetSide?: "front" | "back") => {
    const side = targetSide ?? activeCanvas ?? "front";
    const canvas = side === "front" ? frontFabric.current : backFabric.current;
    const guide = side === "front" ? frontGuide.current : backGuide.current;
    if (!canvas) return;
    const id = `${Date.now()}`.slice(-7);
    const ex: ExtraElement = {
      id, side, type: "line",
      x: SAFE_MARGIN, y: CANVAS_H / 2,
      width: CANVAS_W - SAFE_MARGIN * 2, height: 3,
      color: "rgba(212,175,55,0.7)",
    };
    setOverrides(prev => ({ ...prev, extras: [...(prev.extras || []), ex] }));
    const rect = new fabric.Rect({
      left: ex.x, top: ex.y, width: ex.width, height: 3,
      fill: ex.color,
      data: { id: `extra-${id}`, side, type: "line" }, name: `extra-${id}`,
    } as any);
    canvas.add(rect);
    if (guide) canvas.bringToFront(guide);
    canvas.renderAll();
  }, [activeCanvas]);

  // ── Añadir forma geométrica ───────────────────────────────────────────────
  const addShape = useCallback((shapeType: "rect" | "circle" | "triangle", targetSide?: "front" | "back") => {
    const side = targetSide ?? activeCanvas ?? "front";
    const canvas = side === "front" ? frontFabric.current : backFabric.current;
    const guide = side === "front" ? frontGuide.current : backGuide.current;
    if (!canvas) return;
    const id = `${Date.now()}`.slice(-7);
    const defaultFill = "rgba(212,175,55,0.18)";
    const defaultStroke = "rgba(212,175,55,0.9)";
    let shape: fabric.Object;
    const commonProps: any = {
      left: CANVAS_W / 2 - 100, top: CANVAS_H / 2 - 60,
      fill: defaultFill, stroke: defaultStroke, strokeWidth: 2,
      data: { id: `extra-${id}`, side, type: "shape", shapeType },
      name: `extra-${id}`,
    };
    if (shapeType === "rect") {
      shape = new fabric.Rect({ ...commonProps, width: 200, height: 120, rx: 8, ry: 8 });
    } else if (shapeType === "circle") {
      shape = new fabric.Circle({ ...commonProps, radius: 80 });
    } else {
      shape = new fabric.Triangle({ ...commonProps, width: 200, height: 160 });
    }
    const ex: ExtraElement = {
      id, side, type: "shape", shapeType,
      x: CANVAS_W / 2 - 100, y: CANVAS_H / 2 - 60,
      width: 200, height: 120,
      fill: defaultFill, stroke: defaultStroke, strokeWidth: 2,
    };
    setOverrides(prev => ({ ...prev, extras: [...(prev.extras || []), ex] }));
    canvas.add(shape);
    if (guide) canvas.bringToFront(guide);
    canvas.setActiveObject(shape);
    canvas.renderAll();
  }, [activeCanvas]);

  // ── Añadir emoji ──────────────────────────────────────────────────────────
  const addEmoji = useCallback((emoji: string, targetSide?: "front" | "back") => {
    const side = targetSide ?? activeCanvas ?? "front";
    const canvas = side === "front" ? frontFabric.current : backFabric.current;
    const guide = side === "front" ? frontGuide.current : backGuide.current;
    if (!canvas) return;
    const id = `${Date.now()}`.slice(-7);
    setOverrides(prev => ({
      ...prev,
      extras: [...(prev.extras || []), {
        id, side, type: "emoji",
        x: CANVAS_W / 2 - 40, y: CANVAS_H / 2 - 40,
        width: 80, height: 80, text: emoji, fontSize: 72,
      }],
    }));
    const tb = new fabric.Textbox(emoji, {
      left: CANVAS_W / 2 - 40, top: CANVAS_H / 2 - 40,
      width: 100, fontSize: 72, fontFamily: "Arial",
      textAlign: "center", editable: false,
      data: { id: `extra-${id}`, side, type: "emoji" }, name: `extra-${id}`,
    } as any);
    canvas.add(tb);
    if (guide) canvas.bringToFront(guide);
    canvas.setActiveObject(tb);
    canvas.renderAll();
    setShowEmoji(false);
  }, [activeCanvas]);

  // ── Añadir bocadillo de texto ─────────────────────────────────────────────
  const addBubble = useCallback((targetSide?: "front" | "back") => {
    const side = targetSide ?? activeCanvas ?? "front";
    const canvas = side === "front" ? frontFabric.current : backFabric.current;
    const guide = side === "front" ? frontGuide.current : backGuide.current;
    if (!canvas) return;
    const id = `${Date.now()}`.slice(-7);

    // Bocadillo usando Path SVG
    const bw = 320; const bh = 130; const tail = 36;
    const path = new fabric.Path(
      `M 20 0 L ${bw - 20} 0 Q ${bw} 0 ${bw} 20 L ${bw} ${bh - 20} Q ${bw} ${bh} ${bw - 20} ${bh} L 80 ${bh} L 54 ${bh + tail} L 44 ${bh} L 20 ${bh} Q 0 ${bh} 0 ${bh - 20} L 0 20 Q 0 0 20 0 Z`,
      {
        left: CANVAS_W / 2 - bw / 2, top: CANVAS_H / 2 - (bh + tail) / 2,
        fill: "rgba(255,255,255,0.92)", stroke: "#222", strokeWidth: 2,
        selectable: true, evented: true,
        data: { id: `extra-${id}-shape`, side, type: "bubble" },
        name: `extra-${id}-shape`,
      } as any,
    );

    const textId = `${Date.now() + 1}`.slice(-7);
    const tb = new fabric.Textbox("¡Escribe aquí!", {
      left: CANVAS_W / 2 - bw / 2 + 18,
      top: CANVAS_H / 2 - (bh + tail) / 2 + 22,
      width: bw - 36, fontSize: 22, fontFamily: "Inter",
      fill: "#222", textAlign: "center", editable: true,
      splitByGrapheme: false,
      data: { id: `extra-${textId}`, side, type: "text" },
      name: `extra-${textId}`,
    } as any);

    canvas.add(path);
    canvas.add(tb);
    setOverrides(prev => ({
      ...prev,
      extras: [
        ...(prev.extras || []),
        { id: `${id}-shape`, side, type: "bubble", x: path.left!, y: path.top!, width: bw, height: bh + tail },
        { id: textId, side, type: "text", x: tb.left!, y: tb.top!, width: bw - 36, text: "¡Escribe aquí!", fontSize: 22 },
      ],
    }));
    if (guide) canvas.bringToFront(guide);
    canvas.setActiveObject(tb);
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

  // ── Reset posiciones ──────────────────────────────────────────────────────
  const resetSide = useCallback((side: "front" | "back") => {
    if (!confirm(`¿Restablecer posiciones del ${side === "front" ? "frente" : "reverso"}?`)) return;
    setOverrides(prev => ({ ...prev, [side]: {} }));
    const elements = side === "front" ? frontElements : backElements;
    const canvas = side === "front" ? frontFabric.current : backFabric.current;
    const guide = side === "front" ? frontGuide.current : backGuide.current;
    if (canvas) populateCanvas(canvas, elements, side, logoUrl, guide, apiBase, cardId);
  }, [frontElements, backElements, logoUrl, apiBase, cardId]);

  // ── Guardar ───────────────────────────────────────────────────────────────
  const saveAll = async () => {
    setSaving(true); setError(null);
    try { await onSaveOverrides(overrides); }
    catch (e: any) { setError(e?.message || "Error guardando"); }
    finally { setSaving(false); }
  };

  // ── Re-generar ────────────────────────────────────────────────────────────
  const regenerate = async () => {
    setSaving(true); setError(null);
    try { await onSaveOverrides(overrides); await onRegenerate(); }
    catch (e: any) { setError(e?.message || "Error"); }
    finally { setSaving(false); }
  };

  // ── Exportar ZIP ──────────────────────────────────────────────────────────
  const exportToZip = useCallback(async () => {
    const fc = frontFabric.current; const bc = backFabric.current;
    if (!fc || !bc) return;
    setExporting(true);
    try {
      const fg = frontGuide.current; const bg2 = backGuide.current;
      if (fg) fg.set({ visible: false });
      if (bg2) bg2.set({ visible: false });
      fc.renderAll(); bc.renderAll();
      const mult = 1 / zoomRef.current;
      const frontData = fc.toDataURL({ format: "png", multiplier: mult });
      const backData = bc.toDataURL({ format: "png", multiplier: mult });
      if (fg) fg.set({ visible: true });
      if (bg2) bg2.set({ visible: true });
      fc.renderAll(); bc.renderAll();
      const zip = new JSZip();
      zip.file("01_Cara_Frontal.png", frontData.split(",")[1], { base64: true });
      zip.file("02_Cara_Posterior.png", backData.split(",")[1], { base64: true });
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "tarjeta-estudio.zip";
      a.click();
      URL.revokeObjectURL(a.href);
    } finally { setExporting(false); }
  }, []);

  // ── Actualizar propiedad del objeto seleccionado ──────────────────────────
  const updateSelProp = useCallback((fabricProp: string, value: any, overrideProp?: string) => {
    const canvas = selSide === "front" ? frontFabric.current : backFabric.current;
    if (!canvas || !selId) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    obj.set(fabricProp as any, value);
    canvas.renderAll();
    setSelProps(prev => prev ? { ...prev, [fabricProp]: value } : prev);
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

  // ── Todos los elementos visibles ──────────────────────────────────────────
  const allFrontVisible = frontElements.filter(e => !e.hidden);
  const allBackVisible = backElements.filter(e => !e.hidden);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* ── TOOLBAR PRINCIPAL ────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>

        {/* Fila 1: añadir elementos */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", padding: "6px 8px", background: "rgba(255,255,255,0.03)", borderRadius: 7, border: "1px solid rgba(255,255,255,0.07)" }}>
          <span style={{ fontSize: 9, color: "var(--t3)", letterSpacing: 1.2, textTransform: "uppercase", marginRight: 4 }}>Añadir</span>

          {/* Texto */}
          <button onClick={() => addTextbox()} style={btnTool} title="Texto editable">
            <Type size={11}/> Texto
          </button>

          {/* Línea */}
          <button onClick={() => addLine()} style={btnTool} title="Línea decorativa">
            <Minus size={11}/> Línea
          </button>

          {/* Formas */}
          <button onClick={() => addShape("rect")} style={btnTool} title="Rectángulo">
            <Square size={11}/> Rect
          </button>
          <button onClick={() => addShape("circle")} style={btnTool} title="Círculo">
            <Circle size={11}/> Círculo
          </button>
          <button onClick={() => addShape("triangle")} style={btnTool} title="Triángulo">
            <Triangle size={11}/> Triáng.
          </button>

          {/* Bocadillo */}
          <button onClick={() => addBubble()} style={btnTool} title="Bocadillo de texto (cómic)">
            <MessageSquare size={11}/> Bocadillo
          </button>

          {/* Emoji */}
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowEmoji(v => !v)} style={btnTool} title="Emoji">
              <Smile size={11}/> Emoji
            </button>
            {showEmoji && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50,
                background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8, padding: 8, width: 220,
                display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 2,
                boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
              }}>
                {EMOJI_LIST.map(em => (
                  <button key={em} onClick={() => addEmoji(em)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, padding: 2, borderRadius: 4, lineHeight: 1 }}
                    title={em}
                  >{em}</button>
                ))}
              </div>
            )}
          </div>

          <div style={{ flex: 1 }} />

          {/* Zoom */}
          <button onClick={() => applyZoom(Math.max(0.25, zoom - 0.05))} style={iconBtn}><ZoomOut size={12}/></button>
          <span style={{ fontSize: 10, color: "var(--t3)", minWidth: 34, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => applyZoom(Math.min(1.0, zoom + 0.05))} style={iconBtn}><ZoomIn size={12}/></button>
        </div>

        {/* Fila 2: acciones principales */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          {selId && (
            <button onClick={deleteSelected} style={{ ...btnTool, color: "#e84558", border: "1px solid rgba(232,69,88,0.4)" }} title="Eliminar seleccionado (Supr)">
              <Trash2 size={11}/> Eliminar
            </button>
          )}
          <button onClick={() => resetSide("front")} style={btnSecondary} title="Reset Frente">
            <RotateCcw size={11}/> Reset·F
          </button>
          <button onClick={() => resetSide("back")} style={btnSecondary} title="Reset Reverso">
            <RotateCcw size={11}/> Reset·R
          </button>
          <button onClick={saveAll} disabled={saving} style={btnSecondary}>
            {saving ? <Loader2 size={11} className="animate-spin"/> : <Save size={11}/>} Guardar
          </button>
          <button onClick={exportToZip} disabled={exporting} style={btnSecondary} title="Exportar ZIP (PNG alta resolución)">
            {exporting ? <Loader2 size={11} className="animate-spin"/> : <Download size={11}/>} ZIP
          </button>
          <button onClick={regenerate} disabled={saving || generating} style={btnPrimary}>
            {(saving || generating) ? <Loader2 size={11} className="animate-spin"/> : <RefreshCw size={11}/>}
            Re-generar
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 8, background: "rgba(232,69,88,0.12)", color: "#e84558", border: "1px solid #e84558", borderRadius: 6, fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* ── DUAL CANVAS ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 4 }}>

        {/* Frente */}
        <div style={{ flex: "0 0 auto" }}>
          <div style={{ fontSize: 10, color: selSide === "front" ? "var(--gold)" : "var(--t3)", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: selSide === "front" ? "var(--gold)" : "rgba(255,255,255,0.2)", display: "inline-block" }}/>
            Cara Frontal
            <span style={{ fontSize: 9, color: "var(--t3)", fontWeight: 400 }}>doble clic = editar texto</span>
          </div>
          <div data-testid="canvas-front-area" style={{ background: "#0a0a0a", borderRadius: 8, boxShadow: "0 8px 32px rgba(0,0,0,0.7)", overflow: "hidden", border: selSide === "front" ? "2px solid var(--gold)" : "2px solid transparent" }}>
            <canvas ref={frontCanvasEl} data-testid="canvas-front" />
          </div>
          <div style={{ fontSize: 9, color: "var(--t3)", marginTop: 4, textAlign: "center" }}>
            {CANVAS_W}×{CANVAS_H}px · zona segura (línea roja)
          </div>
        </div>

        {/* Reverso */}
        <div style={{ flex: "0 0 auto" }}>
          <div style={{ fontSize: 10, color: selSide === "back" ? "var(--gold)" : "var(--t3)", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: selSide === "back" ? "var(--gold)" : "rgba(255,255,255,0.2)", display: "inline-block" }}/>
            Cara Posterior
          </div>
          <div data-testid="canvas-back-area" style={{ background: "#0a0a0a", borderRadius: 8, boxShadow: "0 8px 32px rgba(0,0,0,0.7)", overflow: "hidden", border: selSide === "back" ? "2px solid var(--gold)" : "2px solid transparent" }}>
            <canvas ref={backCanvasEl} data-testid="canvas-back" />
          </div>
          <div style={{ fontSize: 9, color: "var(--t3)", marginTop: 4, textAlign: "center" }}>
            {CANVAS_W}×{CANVAS_H}px · no cruzar la línea roja
          </div>
        </div>
      </div>

      {/* ── PANEL INFERIOR ─────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: selId ? "1fr 300px" : "1fr", gap: 10, alignItems: "start" }}>

        {/* Tabs: Elementos | Temas */}
        <div style={panelStyle}>
          <div style={{ display: "flex", gap: 0, marginBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            {(["elementos", "temas"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ ...tabBtn, borderBottom: activeTab === tab ? "2px solid var(--gold)" : "2px solid transparent", color: activeTab === tab ? "var(--gold)" : "var(--t3)" }}>
                {tab === "elementos" ? "🎭 Elementos" : "🎨 Temas de fondo"}
              </button>
            ))}
          </div>

          {/* Tab Elementos */}
          {activeTab === "elementos" && (
            <>
              {loading && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--t3)", padding: 4 }}>
                  <Loader2 size={13} className="animate-spin" style={{ color: "var(--gold)" }}/> Cargando elementos…
                </div>
              )}
              {(allFrontVisible.length > 0 || allBackVisible.length > 0) ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 4 }}>
                  {[...allFrontVisible.map(e => ({ ...e, _side: "front" as const })), ...allBackVisible.map(e => ({ ...e, _side: "back" as const }))].map(el => (
                    <div key={`${el._side}-${el.id}`}
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
                      }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {elLabel(el.id)}{el.type === "text" && el.text ? ` · ${el.text.slice(0, 10)}` : ""}
                        </div>
                        <div style={{ fontSize: 9, color: el._side === "front" ? "rgba(212,175,55,0.7)" : "rgba(100,200,255,0.7)" }}>
                          {el._side === "front" ? "Frente" : "Reverso"} · {el.type}
                        </div>
                      </div>
                      <button onClick={e2 => {
                        e2.stopPropagation();
                        const canvas = el._side === "front" ? frontFabric.current : backFabric.current;
                        if (!canvas) return;
                        const obj = canvas.getObjects().find((o: any) => o.name === el.id);
                        if (obj) { canvas.remove(obj); canvas.renderAll(); }
                        if (el.id.startsWith("extra-")) {
                          const exId = el.id.replace("extra-", "");
                          setOverrides(prev => ({ ...prev, extras: (prev.extras || []).filter(ex => ex.id !== exId) }));
                        } else {
                          setOverrides(prev => {
                            const sideOv = { ...(prev[el._side] ?? {}) };
                            sideOv[el.id] = { ...(sideOv[el.id] ?? {}), hidden: true };
                            return { ...prev, [el._side]: sideOv };
                          });
                        }
                      }} style={iconBtn} title={el.id.startsWith("extra-") ? "Eliminar" : "Ocultar"}>
                        <EyeOff size={10}/>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                !loading && (
                  <p style={{ fontSize: 11, color: "var(--t3)", textAlign: "center", margin: 0, padding: 8 }}>
                    Genera la tarjeta primero para ver los elementos.
                  </p>
                )
              )}
            </>
          )}

          {/* Tab Temas */}
          {activeTab === "temas" && (
            <div>
              <p style={{ fontSize: 11, color: "var(--t3)", margin: "0 0 10px" }}>
                Haz clic en un tema para usar su prompt de fondo IA. Después pulsa <strong style={{ color: "var(--gold)" }}>Re-generar</strong>.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6 }}>
                {BACKGROUND_THEMES.map(theme => (
                  <button key={theme.id}
                    onClick={() => {
                      if (onThemePrompt) onThemePrompt(theme.prompt);
                    }}
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8, padding: "10px 8px",
                      cursor: "pointer", textAlign: "center",
                      transition: "all 0.2s",
                      color: "var(--t1)",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--gold)")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                  >
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{theme.emoji}</div>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{theme.label}</div>
                    <div style={{ fontSize: 9, color: "var(--t3)", marginTop: 2 }}>
                      {theme.prompt.slice(0, 40)}…
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── PANEL DE PROPIEDADES ──────────────────────────────────────── */}
        {selId && selProps && (
          <div style={panelStyle}>
            <h4 style={{ ...panelTitle, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span><Type size={11} style={{ marginRight: 4, verticalAlign: -2 }}/>{elLabel(selId)}</span>
              <button onClick={deleteSelected} style={{ background: "none", border: "none", color: "#e84558", cursor: "pointer", padding: 0 }} title="Eliminar">
                <Trash2 size={12}/>
              </button>
            </h4>

            {/* Propiedades de texto */}
            {selProps.type === "text" && (
              <>
                <label style={labelStyle}>Texto (doble clic en el lienzo para editar)</label>
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
                  style={{ ...inputStyle, minHeight: 52, resize: "vertical", marginBottom: 8 }}
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 5 }}>
                  <div>
                    <label style={labelStyle}>Tamaño</label>
                    <input type="number" min={6} max={300} value={selProps.fontSize ?? 24}
                      onChange={e => updateSelProp("fontSize", +e.target.value || 24, "fontSize")}
                      style={inputStyle}/>
                  </div>
                  <div>
                    <label style={labelStyle}>Color</label>
                    <input type="color" value={selProps.fill?.startsWith("#") ? selProps.fill : "#ffffff"}
                      onChange={e => updateSelProp("fill", e.target.value, "color")}
                      style={{ width: "100%", height: 30, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, background: "transparent", padding: 0, cursor: "pointer" }}/>
                  </div>
                </div>
                <label style={labelStyle}>Fuente</label>
                <select value={(selProps.fontFamily || "Inter").replace(/'/g, "")}
                  onChange={e => updateSelProp("fontFamily", `'${e.target.value}'`, "fontFamily")}
                  style={{ ...inputStyle, marginBottom: 5 }}>
                  {POPULAR_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <div style={{ display: "flex", gap: 4, marginBottom: 5 }}>
                  <button onClick={() => {
                    const isBold = selProps.fontWeight === "700" || selProps.fontWeight === "bold";
                    updateSelProp("fontWeight", isBold ? "400" : "bold", "fontWeight");
                  }} style={{ ...iconBtn, background: (selProps.fontWeight === "700" || selProps.fontWeight === "bold") ? "rgba(212,175,55,0.2)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "4px 8px" }}><Bold size={12}/></button>
                  <button onClick={() => updateSelProp("fontStyle", selProps.fontStyle === "italic" ? "normal" : "italic", "italic")}
                    style={{ ...iconBtn, background: selProps.fontStyle === "italic" ? "rgba(212,175,55,0.2)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "4px 8px" }}><Italic size={12}/></button>
                  {(["left", "center", "right"] as const).map((a, i) => (
                    <button key={a} onClick={() => updateSelProp("textAlign", a, "align")}
                      style={{ ...iconBtn, background: selProps.textAlign === a ? "rgba(212,175,55,0.2)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "4px 8px" }}>
                      {i === 0 ? <AlignLeft size={12}/> : i === 1 ? <AlignCenter size={12}/> : <AlignRight size={12}/>}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Propiedades de formas */}
            {(selProps.type === "shape" || selProps.type === "line" || selProps.type === "bubble") && (
              <>
                <label style={labelStyle}>Relleno</label>
                <input type="color" value={selProps.fill?.startsWith("#") ? selProps.fill : "#d4af37"}
                  onChange={e => updateSelProp("fill", e.target.value)}
                  style={{ width: "100%", height: 30, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, background: "transparent", padding: 0, cursor: "pointer", marginBottom: 5 }}/>
                {selProps.type !== "line" && (
                  <>
                    <label style={labelStyle}>Borde</label>
                    <input type="color" value={selProps.stroke?.startsWith("#") ? selProps.stroke : "#d4af37"}
                      onChange={e => updateSelProp("stroke", e.target.value)}
                      style={{ width: "100%", height: 30, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, background: "transparent", padding: 0, cursor: "pointer", marginBottom: 5 }}/>
                  </>
                )}
                <label style={labelStyle}>Opacidad</label>
                <input type="range" min={0} max={100} step={5} value={Math.round((selProps.opacity ?? 1) * 100)}
                  onChange={e => updateSelProp("opacity", +e.target.value / 100)}
                  style={{ width: "100%", accentColor: "var(--gold)", marginBottom: 5 }}/>
              </>
            )}

            {/* Propiedades QR */}
            {selProps.type === "qr" && (
              <p style={{ fontSize: 11, color: "var(--t3)", margin: 0 }}>
                QR generado automáticamente. Configura el tipo (vCard, URL, etc.) en el panel de datos.
              </p>
            )}

            {/* Posición y tamaño */}
            <label style={labelStyle}>Posición (X, Y)</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 5 }}>
              <input type="number" value={selProps.left ?? 0}
                onChange={e => updateSelProp("left", +e.target.value || 0, "x")}
                style={inputStyle} placeholder="X"/>
              <input type="number" value={selProps.top ?? 0}
                onChange={e => updateSelProp("top", +e.target.value || 0, "y")}
                style={inputStyle} placeholder="Y"/>
            </div>
            <label style={labelStyle}>Tamaño (W, H)</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              <input type="number" value={selProps.width ?? 100}
                onChange={e => updateSelProp("width", +e.target.value || 40, "width")}
                style={inputStyle} placeholder="W"/>
              <input type="number" value={selProps.height ?? 40}
                onChange={e => updateSelProp("height", +e.target.value || 20, "height")}
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
  padding: "4px 7px", fontSize: 10,
  background: "rgba(255,255,255,0.04)", color: "var(--t2)",
  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 3,
};
const iconBtn: React.CSSProperties = {
  background: "none", border: "none", color: "var(--t3)", cursor: "pointer",
  padding: 3, display: "inline-flex", alignItems: "center",
};
const tabBtn: React.CSSProperties = {
  padding: "6px 12px", fontSize: 11, background: "none",
  border: "none", cursor: "pointer", fontWeight: 600,
  transition: "color 0.2s", borderRadius: 0,
};
