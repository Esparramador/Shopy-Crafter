/**
 * Tienda pública (/tienda): productos del taller láser (xTool F2) y servicios digitales.
 *
 * Precios con IVA incluido, en céntimos. El precio de cada línea se calcula SIEMPRE aquí, en el
 * servidor, a partir de la base de datos: el carrito del navegador solo propone producto,
 * variante, cantidad, extras y personalización.
 *
 * Tramos: el precio por unidad es el del tramo con el mayor «min» que no supere la cantidad.
 * Extras: «perUnit» se cobra por unidad; si no, una vez por línea.
 */
import { z } from "zod";

export type ShopKind = "physical" | "digital" | "quote";

export const SHOP_CATEGORIES: Record<string, string> = {
  tarjetas: "Tarjetas de aluminio",
  "placas-qr": "Placas QR",
  expositores: "Expositores",
  kits: "Kits para negocios",
  "fotos-grabadas": "Fotos grabadas",
  "regalos-3d": "Regalos 3D",
  "servicios-web": "Webs y diseño",
  "servicios-video": "Vídeo y animación 3D",
  "google-local": "Google y reseñas",
  "tarjetas-regalo": "Tarjetas para regalar",
};

const tierSchema = z.object({ min: z.number().int().min(1).max(10000), unitCents: z.number().int().min(0).max(10_000_000) });
export const variantSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: z.string().min(1).max(80),
  tiers: z.array(tierSchema).min(1).max(12),
});
export const addonSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: z.string().min(1).max(80),
  cents: z.number().int().min(0).max(10_000_000),
  perUnit: z.boolean().default(false),
  description: z.string().max(200).optional(),
});
export const fieldSchema = z.object({
  key: z.string().regex(/^[a-zA-Z0-9_]{1,40}$/),
  label: z.string().min(1).max(80),
  type: z.enum(["text", "textarea", "url", "email", "tel", "select", "upload"]),
  required: z.boolean().default(false),
  max: z.number().int().min(1).max(4000).optional(),
  options: z.array(z.string().min(1).max(80)).max(20).optional(),
  maxFiles: z.number().int().min(1).max(20).optional(),
  help: z.string().max(200).optional(),
});
export const mediaSchema = z.object({
  type: z.enum(["image", "video"]),
  url: z.string().min(1).max(500).refine(u => u.startsWith("/") && !u.startsWith("//"), "Solo rutas del propio sitio"),
  alt: z.string().max(200).default(""),
  poster: z.string().max(500).optional(),
});

export type ShopVariant = z.infer<typeof variantSchema>;
export type ShopAddon = z.infer<typeof addonSchema>;
export type ShopField = z.infer<typeof fieldSchema>;
export type ShopMedia = z.infer<typeof mediaSchema>;

export interface ShopProduct {
  id: number;
  slug: string;
  kind: ShopKind;
  category: string;
  name: string;
  tagline: string;
  description: string;
  features: string[];
  media: ShopMedia[];
  variants: ShopVariant[];
  addons: ShopAddon[];
  fields: ShopField[];
  qtyOptions: number[];
  minQty: number;
  maxQty: number;
  leadDays: number;
  demoUrl: string | null;
  featured: boolean;
  visible: boolean;
  sortOrder: number;
}

export interface CartItemInput {
  slug: string;
  variant: string;
  qty: number;
  addons?: string[];
  fields?: Record<string, unknown>;
}

export interface PricedLine {
  slug: string; productName: string; kind: ShopKind;
  variantKey: string; variantName: string; qty: number;
  unitCents: number; baseCents: number;
  addons: Array<{ key: string; name: string; cents: number }>;
  totalCents: number;
  fields: Record<string, string | string[]>;
}

export class ShopValidationError extends Error {}

/** Precio por unidad para una cantidad (tramo de mayor «min» que no la supere). */
export function unitPriceFor(variant: ShopVariant, qty: number): number {
  const tiers = [...variant.tiers].sort((a, b) => a.min - b.min);
  let unit = tiers[0].unitCents;
  for (const t of tiers) if (qty >= t.min) unit = t.unitCents;
  return unit;
}

/** El primer tramo exige una cantidad mínima: menos no se vende. */
export function minQtyFor(p: ShopProduct, variant: ShopVariant): number {
  const tierMin = Math.min(...variant.tiers.map(t => t.min));
  return Math.max(p.minQty, p.qtyOptions.length ? Math.min(...p.qtyOptions) : 1, tierMin);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Valida y limpia la personalización de una línea. Los ficheros se comprueban aparte (existen y son de la tienda). */
export function cleanFields(p: ShopProduct, raw: Record<string, unknown> | undefined): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  const src = raw ?? {};
  for (const f of p.fields) {
    const v = src[f.key];
    if (f.type === "upload") {
      const ids = (Array.isArray(v) ? v : v ? [v] : []).map(String).filter(id => /^[a-f0-9]{32}$/.test(id));
      const max = f.maxFiles ?? 1;
      if (ids.length > max) throw new ShopValidationError(`«${f.label}»: máximo ${max} ${max === 1 ? "archivo" : "archivos"}`);
      if (f.required && ids.length === 0) throw new ShopValidationError(`Falta «${f.label}»`);
      if (ids.length) out[f.key] = ids;
      continue;
    }
    const s = typeof v === "string" ? v.trim() : v === undefined || v === null ? "" : String(v).trim();
    if (!s) {
      if (f.required) throw new ShopValidationError(`Falta «${f.label}»`);
      continue;
    }
    const max = f.max ?? (f.type === "textarea" ? 2000 : 300);
    if (s.length > max) throw new ShopValidationError(`«${f.label}»: máximo ${max} caracteres`);
    if (f.type === "url" && !/^https?:\/\/[^\s]+\.[^\s]+/i.test(s)) throw new ShopValidationError(`«${f.label}» debe ser un enlace que empiece por https://`);
    if (f.type === "email" && !EMAIL_RE.test(s)) throw new ShopValidationError(`«${f.label}» no es un email válido`);
    if (f.type === "select" && !(f.options ?? []).includes(s)) throw new ShopValidationError(`«${f.label}»: opción no válida`);
    out[f.key] = s;
  }
  return out;
}

/** Calcula una línea del carrito contra el producto real. Lanza ShopValidationError si algo no cuadra. */
export function priceLine(p: ShopProduct, item: CartItemInput): PricedLine {
  if (!p.visible) throw new ShopValidationError(`«${p.name}» no está a la venta`);
  if (p.kind === "quote") throw new ShopValidationError(`«${p.name}» se contrata con presupuesto`);
  const variant = p.variants.find(v => v.key === item.variant);
  if (!variant) throw new ShopValidationError(`«${p.name}»: elige una opción válida`);
  const qty = Math.floor(Number(item.qty));
  if (!Number.isFinite(qty) || qty < 1) throw new ShopValidationError(`«${p.name}»: cantidad no válida`);
  if (p.qtyOptions.length > 0 && !p.qtyOptions.includes(qty)) {
    throw new ShopValidationError(`«${p.name}» se vende en packs de ${p.qtyOptions.join(", ")}`);
  }
  const min = minQtyFor(p, variant);
  if (qty < min || qty > p.maxQty) throw new ShopValidationError(`«${p.name}»: la cantidad va de ${min} a ${p.maxQty}`);
  const unitCents = unitPriceFor(variant, qty);
  const baseCents = unitCents * qty;
  const wanted = [...new Set(item.addons ?? [])];
  const addons = wanted.map(key => {
    const a = p.addons.find(x => x.key === key);
    if (!a) throw new ShopValidationError(`«${p.name}»: extra no válido`);
    return { key: a.key, name: a.name, cents: a.perUnit ? a.cents * qty : a.cents };
  });
  const totalCents = baseCents + addons.reduce((s, a) => s + a.cents, 0);
  return {
    slug: p.slug, productName: p.name, kind: p.kind,
    variantKey: variant.key, variantName: variant.name, qty,
    unitCents, baseCents, addons, totalCents,
    fields: cleanFields(p, item.fields),
  };
}

export interface ShippingSettings { shippingCents: number; freeFromCents: number }
export const DEFAULT_SHIPPING: ShippingSettings = { shippingCents: 490, freeFromCents: 6000 };

/** Envío: solo si hay algo físico; gratis desde el umbral de producto físico. */
export function shippingFor(lines: PricedLine[], s: ShippingSettings = DEFAULT_SHIPPING): number {
  const physical = lines.filter(l => l.kind === "physical").reduce((t, l) => t + l.totalCents, 0);
  if (physical === 0) return 0;
  return physical >= s.freeFromCents ? 0 : s.shippingCents;
}

// ── Catálogo inicial ─────────────────────────────────────────────────────────
// Se aplica una vez por versión (app_settings.shop_catalog_version): crea los productos que
// falten por slug y actualiza los que nadie ha editado desde el admin; lo editado se respeta.

type SeedProduct = Omit<ShopProduct, "id">;

const CARD_FIELDS: ShopField[] = [
  { key: "logo", label: "Tu logo o diseño", type: "upload", required: false, maxFiles: 2, help: "PNG, JPG o PDF. Si no tienes, lo diseñamos a partir de tu nombre." },
  { key: "nombre", label: "Nombre en la tarjeta", type: "text", required: true, max: 60 },
  { key: "cargo", label: "Cargo", type: "text", required: false, max: 60 },
  { key: "empresa", label: "Empresa", type: "text", required: false, max: 60 },
  { key: "telefono", label: "Teléfono", type: "tel", required: false, max: 30 },
  { key: "email", label: "Email", type: "email", required: false, max: 120 },
  { key: "web", label: "Web", type: "text", required: false, max: 120 },
  { key: "qr", label: "Enlace del QR", type: "url", required: false, max: 400, help: "A dónde lleva el QR: tu web, Instagram, WhatsApp, reseñas…" },
  { key: "notas", label: "Indicaciones", type: "textarea", required: false, max: 1000 },
];

const PHOTO_FIELDS: ShopField[] = [
  { key: "foto", label: "Tu foto", type: "upload", required: true, maxFiles: 1, help: "JPG o PNG, cuanta más resolución mejor. Revisamos el encuadre antes de grabar." },
  { key: "texto", label: "Texto grabado (opcional)", type: "text", required: false, max: 80 },
  { key: "notas", label: "Indicaciones", type: "textarea", required: false, max: 1000 },
];

const QR_USES = ["Reseñas de Google", "Instagram", "Wifi", "Carta o menú", "Pago", "Reservas", "Galería de fotos de un evento", "Otro"];

const tiers = (...pairs: Array<[number, number]>) => pairs.map(([min, unitCents]) => ({ min, unitCents }));
const img = (file: string, alt: string): ShopMedia => ({ type: "image", url: `/tienda-media/${file}.webp`, alt });
const vid = (file: string, alt: string): ShopMedia => ({ type: "video", url: `/tienda-media/${file}.mp4`, alt, poster: `/tienda-media/${file}-poster.webp` });
const pimg = (file: string, alt: string): ShopMedia => ({ type: "image", url: `/portfolio/${file}.webp`, alt });

const OCASION: ShopField = { key: "ocasion", label: "Ocasión", type: "select", required: true, options: ["Cumpleaños", "Navidad", "Boda", "Aniversario", "Nacimiento", "San Valentín", "Otra"] };

/** Stand de madera por uso: misma pieza, otro destino y otro texto. */
function stand(slug: string, sortOrder: number, featured: boolean, name: string, tagline: string, description: string, linkKey: string, linkLabel: string,
  sizes: Array<[string, string, number, number]> = [["90x110", "90 × 110 mm", 2490, 2190], ["ilustrado", "90 × 110 mm con ilustración", 3490, 2967]], extra: ShopField[] = []): SeedProduct {
  return {
    slug, kind: "physical", category: "placas-qr", featured, visible: true, sortOrder, name, tagline, description,
    features: ["Contrachapado de 3 mm grabado y cortado con láser", "Base de pie incluida", "Tu logo, un titular y el QR", "Lectura comprobada con varios móviles antes del envío"],
    media: [img(`demo-${slug}-1`, `${name} (imagen de demostración)`)],
    variants: sizes.map(([key, vname, one, three]) => ({ key, name: vname, tiers: one === three ? tiers([1, one]) : tiers([1, one], [3, three]) })),
    addons: [],
    fields: [
      { key: linkKey, label: linkLabel, type: "url", required: true, max: 400 }, ...extra,
      { key: "titular", label: "Titular", type: "text", required: false, max: 60 },
      { key: "logo", label: "Tu logo", type: "upload", required: false, maxFiles: 1 },
      { key: "notas", label: "Indicaciones", type: "textarea", required: false, max: 1000 },
    ],
    qtyOptions: [], minQty: 1, maxQty: 20, leadDays: 5, demoUrl: null,
  };
}

export const SHOP_SEED_VERSION = "v6-2026-11";

export const SHOP_SEED: SeedProduct[] = [
  {
    slug: "tarjetas-metalicas", kind: "physical", category: "tarjetas", featured: true, visible: true, sortOrder: 0,
    name: "Tarjetas de visita de aluminio",
    tagline: "Aluminio lacado grabado con láser, desde 0,35 € la tarjeta. A una cara o a doble cara con tu QR.",
    description: "Tarjetas de 85,5 × 54 mm en aluminio lacado negro de 0,2 mm, grabadas una a una con el láser infrarrojo de nuestra xTool F2. El grabado no es tinta: es el propio metal, así que no se borra ni se despega.\n\nA una cara llevan tu logo, tus datos y el QR en el mismo lado. A doble cara, delante va tu logo, una ilustración o una foto y detrás tus datos y un QR que lleva a donde tú quieras. Se piden a partir de 100 tarjetas: 0,35 € cada una a una cara y 0,45 € a doble cara. Incluimos el diseño básico a partir de tu logo y te enviamos la prueba antes de grabar.",
    features: ["Aluminio lacado negro, 85,5 × 54 × 0,2 mm", "A una cara (0,35 €/ud.) o a doble cara (0,45 €/ud.)", "Pedido mínimo: 100 tarjetas", "QR a tu web, Instagram, WhatsApp o reseñas", "Diseño básico y prueba antes de grabar incluidos", "Envío en 3 a 5 días laborables"],
    media: [vid("3d-tarjetas-metalicas", "Giro 3D de la tarjeta de aluminio grabada"), img("tarjeta-ceo-v5", "Tarjeta de aluminio de Shopy Crafter (simulación del grabado)"), vid("taller-grabado-tarjeta", "Tarjeta grabándose en la xTool F2"), img("tarjeta-shopycrafter-delante", "Tarjeta de Shopy Crafter, cara delantera"), img("tarjeta-shopycrafter-detras", "Tarjeta de Shopy Crafter, reverso con QR"), img("tarjeta-lazy-lizard", "Tarjetas de Lazy Lizard, delante y detrás")],
    // 0,35 € y 0,45 € por tarjeta son el precio mínimo: no hay tramos por debajo.
    variants: [
      { key: "doble-cara", name: "Doble cara", tiers: tiers([100, 45]) },
      { key: "una-cara", name: "Una cara", tiers: tiers([100, 35]) },
    ],
    addons: [
      { key: "diseno-a-medida", name: "Diseño a medida desde cero", cents: 1900, perUnit: false, description: "Diseñamos la tarjeta completa aunque no tengas logo." },
      { key: "tarjeta-digital", name: "QR a tarjeta digital con estadísticas", cents: 1500, perUnit: false, description: "Tu tarjeta de contacto online, editable sin reimprimir, con conteo de escaneos." },
    ],
    fields: CARD_FIELDS,
    qtyOptions: [100, 250, 500, 1000], minQty: 100, maxQty: 1000, leadDays: 5, demoUrl: null,
  },
  {
    slug: "placa-qr-madera", kind: "physical", category: "placas-qr", featured: false, visible: true, sortOrder: 1,
    name: "Placa QR de madera con soporte",
    tagline: "Para reseñas de Google, Instagram, la wifi, la carta o el pago. Grabada y cortada en contrachapado.",
    description: "Placa de contrachapado de 3 mm grabada y cortada con láser, con su soporte de pie. Lleva tu logo, un titular y el QR al enlace que elijas. Es el modo más fácil de conseguir reseñas en Google: el cliente la ve en el mostrador, escanea y deja sus estrellas.\n\nComprobamos que el QR se lee con varios móviles antes de enviarla.",
    features: ["Contrachapado de 3 mm grabado y cortado con láser", "Soporte de pie incluido", "Tu logo, un titular y el QR a tu enlace", "QR comprobado con varios móviles antes del envío"],
    media: [vid("3d-placa-qr-madera", "Giro 3D de la placa QR de madera con soporte"), img("placa-qr-hanakaze", "Placas QR de madera con soporte para Hanakaze Serigraphy"), img("placa-resenas-madera", "Placa de reseñas de Google en madera para RastaLo Barcelona"), img("pies-cartel-render", "Pies de contrachapado para el cartel (simulación del corte)")],
    variants: [
      { key: "90x110", name: "Pequeña · 90 × 110 mm", tiers: tiers([1, 2490], [3, 2117]) },
      { key: "110x110", name: "Cuadrada · 110 × 110 mm", tiers: tiers([1, 2990], [3, 2542]) },
      { key: "400x115", name: "Cartel · 400 × 115 mm", tiers: tiers([1, 4990], [3, 4242]) },
    ],
    addons: [],
    fields: [
      { key: "uso", label: "¿Para qué es?", type: "select", required: true, options: QR_USES },
      { key: "enlace", label: "Enlace del QR", type: "url", required: true, max: 400, help: "Por ejemplo, el enlace para dejar reseña en tu ficha de Google." },
      { key: "titular", label: "Titular", type: "text", required: false, max: 60, help: "Por ejemplo: ¿Te ha gustado? Déjanos tu reseña." },
      { key: "logo", label: "Tu logo", type: "upload", required: false, maxFiles: 1 },
      { key: "notas", label: "Indicaciones", type: "textarea", required: false, max: 1000 },
    ],
    qtyOptions: [], minQty: 1, maxQty: 20, leadDays: 5, demoUrl: null,
  },
  {
    slug: "expositor-tarjetas", kind: "physical", category: "expositores", featured: false, visible: true, sortOrder: 2,
    name: "Expositor de tarjetas con tu logo",
    tagline: "Para el mostrador: guarda unas 40 tarjetas y lleva tu logo grabado.",
    description: "Expositor de contrachapado de 3 mm, cortado a medida para tarjetas de 85,5 × 54 mm y montado sin cola, a presión. Elige si las tarjetas van apaisadas o de pie. Grabamos tu logo o tu nombre en el frontal.",
    features: ["Contrachapado de 3 mm cortado con láser", "Hueco para unas 40 tarjetas de 85,5 × 54 mm", "Horizontal o vertical", "Logo o nombre grabado en el frontal"],
    media: [img("placa-qr-hanakaze", "Piezas de contrachapado con soporte montado a presión"), img("pies-cartel-render", "Piezas cortadas en contrachapado (simulación del corte)"), img("expositor-tarjetas-vertical", "Dibujo del expositor vertical")],
    variants: [
      { key: "horizontal", name: "Horizontal (tarjeta apaisada)", tiers: tiers([1, 1990], [3, 1690]) },
      { key: "vertical", name: "Vertical (tarjeta de pie)", tiers: tiers([1, 1990], [3, 1690]) },
    ],
    addons: [],
    fields: [
      { key: "logo", label: "Logo para el frontal", type: "upload", required: false, maxFiles: 1 },
      { key: "texto", label: "O texto para el frontal", type: "text", required: false, max: 40 },
      { key: "notas", label: "Indicaciones", type: "textarea", required: false, max: 1000 },
    ],
    qtyOptions: [], minQty: 1, maxQty: 20, leadDays: 5, demoUrl: null,
  },
  {
    slug: "kit-resenas", kind: "physical", category: "kits", featured: false, visible: true, sortOrder: 3,
    name: "Kit Reseñas para tu negocio",
    tagline: "Placa QR de reseñas, expositor y 100 tarjetas de aluminio con el mismo diseño.",
    description: "Todo lo que necesita un mostrador para pedir reseñas y repartir tarjetas, con una sola imagen de marca: la placa cuadrada de reseñas de Google con soporte, el expositor con tu logo y 100 tarjetas de aluminio a doble cara con QR, más tu tarjeta digital con estadísticas de escaneos.\n\nPor separado serían 109,80 €.",
    features: ["Placa QR de reseñas 110 × 110 mm con soporte", "Expositor de tarjetas con tu logo", "100 tarjetas de aluminio grabadas a doble cara", "Tarjeta digital con estadísticas de escaneos", "Mismo diseño en las tres piezas"],
    media: [img("placa-qr-hanakaze", "Placas QR de madera con soporte"), img("placa-resenas-madera", "Placa de reseñas de Google"), img("tarjeta-shopycrafter-detras", "Reverso de tarjeta con QR"), img("expositor-tarjetas-vertical", "Dibujo del expositor")],
    variants: [{ key: "kit", name: "Kit completo", tiers: tiers([1, 9490]) }],
    addons: [],
    fields: [
      { key: "enlace", label: "Enlace para dejar reseña en Google", type: "url", required: true, max: 400 },
      ...CARD_FIELDS.filter(f => f.key !== "notas"),
      { key: "notas", label: "Indicaciones", type: "textarea", required: false, max: 1000 },
    ],
    qtyOptions: [], minQty: 1, maxQty: 5, leadDays: 7, demoUrl: null,
  },
  {
    slug: "kit-expositor-tarjetas", kind: "physical", category: "kits", featured: false, visible: true, sortOrder: 4,
    name: "Expositor + 100 tarjetas de aluminio",
    tagline: "El expositor con tu logo y 100 tarjetas a juego.",
    description: "El expositor de mostrador con tu logo grabado y 100 tarjetas de aluminio a doble cara con tus datos y QR. Por separado serían 64,90 €.",
    features: ["Expositor de contrachapado con tu logo", "100 tarjetas de aluminio grabadas a doble cara", "Diseño básico y prueba antes de grabar incluidos"],
    media: [img("tarjeta-shopycrafter-delante", "Tarjeta de aluminio"), img("expositor-tarjetas-vertical", "Dibujo del expositor")],
    variants: [
      { key: "horizontal", name: "Expositor horizontal", tiers: tiers([1, 5690]) },
      { key: "vertical", name: "Expositor vertical", tiers: tiers([1, 5690]) },
    ],
    addons: [],
    fields: CARD_FIELDS,
    qtyOptions: [], minQty: 1, maxQty: 5, leadDays: 6, demoUrl: null,
  },
  {
    slug: "tarjeta-foto-aluminio", kind: "physical", category: "fotos-grabadas", featured: false, visible: true, sortOrder: 5,
    name: "Foto grabada en tarjeta de aluminio",
    tagline: "Una foto que cabe en la cartera y no se borra.",
    description: "Tu foto grabada con láser en una tarjeta de aluminio lacado negro de 85,5 × 54 mm. Preparamos la imagen para el metal (contraste, encuadre y trama) y te enseñamos cómo quedará antes de grabarla. Detrás, si quieres, una fecha o una frase.",
    features: ["Aluminio lacado negro de 85,5 × 54 mm", "Foto preparada para el metal y revisada antes de grabar", "Texto opcional en el reverso", "Tres por 34,89 €"],
    media: [vid("3d-tarjeta-foto-aluminio", "Giro 3D de la foto grabada en tarjeta de aluminio")],
    variants: [{ key: "tarjeta", name: "Tarjeta 85,5 × 54 mm", tiers: tiers([1, 1490], [3, 1163]) }],
    addons: [],
    fields: PHOTO_FIELDS,
    qtyOptions: [], minQty: 1, maxQty: 20, leadDays: 4, demoUrl: null,
  },
  {
    slug: "foto-madera-peana", kind: "physical", category: "fotos-grabadas", featured: false, visible: true, sortOrder: 6,
    name: "Foto grabada en madera con peana",
    tagline: "109 × 141 mm, lista para la mesa o la estantería.",
    description: "Tu foto grabada en madera de 109 × 141 mm con una peana para que se sostenga de pie. Ajustamos la foto para la madera y te mandamos la prueba antes de grabarla.",
    features: ["Madera de 109 × 141 mm", "Peana incluida", "Prueba antes de grabar", "Texto opcional"],
    media: [vid("3d-foto-madera-peana", "Giro 3D de la foto grabada en madera con peana")],
    variants: [{ key: "109x141", name: "109 × 141 mm con peana", tiers: tiers([1, 2490]) }],
    addons: [],
    fields: PHOTO_FIELDS,
    qtyOptions: [], minQty: 1, maxQty: 10, leadDays: 5, demoUrl: null,
  },
  {
    slug: "marco-madera-foto", kind: "physical", category: "fotos-grabadas", featured: false, visible: true, sortOrder: 7,
    name: "Marco de madera con foto grabada",
    tagline: "La foto grabada en la madera y su marco, cortado a juego.",
    description: "La foto grabada en una lámina de madera y un marco cortado con láser a juego, con un texto o una fecha si quieres. Un regalo para bodas, aniversarios o nacimientos.",
    features: ["Foto grabada en madera", "Marco cortado a juego", "Texto o fecha opcional", "Prueba antes de grabar"],
    media: [vid("3d-marco-madera-foto", "Giro 3D del marco de madera con foto grabada")],
    variants: [{ key: "marco", name: "Marco 110 × 110 mm", tiers: tiers([1, 2790]) }],
    addons: [],
    fields: PHOTO_FIELDS,
    qtyOptions: [], minQty: 1, maxQty: 10, leadDays: 6, demoUrl: null,
  },
  {
    slug: "panoramica-madera", kind: "physical", category: "fotos-grabadas", featured: false, visible: true, sortOrder: 8,
    name: "Panorámica grabada en madera",
    tagline: "400 × 115 mm: paisajes, grupos y fotos alargadas.",
    description: "Una foto panorámica grabada en una tabla de madera de 400 × 115 mm con la extensión de la F2. Para paisajes, fotos de grupo o un skyline. Te enviamos la prueba antes de grabar.",
    features: ["Madera de 400 × 115 mm", "Ideal para fotos de grupo y paisajes", "Prueba antes de grabar", "Texto opcional"],
    media: [vid("3d-panoramica-madera", "Giro 3D de la panorámica grabada en madera")],
    variants: [{ key: "400x115", name: "400 × 115 mm", tiers: tiers([1, 4990]) }],
    addons: [],
    fields: PHOTO_FIELDS,
    qtyOptions: [], minQty: 1, maxQty: 5, leadDays: 6, demoUrl: null,
  },
  {
    slug: "regalo-web-3d", kind: "digital", category: "regalos-3d", featured: false, visible: true, sortOrder: 9,
    name: "Regalo web 3D",
    tagline: "Una pequeña web que se abre como un regalo: escena 3D, vuestras fotos y tu mensaje.",
    description: "Le mandas un enlace y, al abrirlo, encuentra una escena en 3D con un regalo esperándole. Lo abre, pasan vuestras fotos y aparece tu mensaje letra a letra, con música. Funciona en el móvil y en el ordenador, sin instalar nada.\n\nPrueba la demo: así es la experiencia, con fotos de ejemplo. En el tuyo van tus fotos y tu texto, y con la opción de personaje, la persona que lo recibe aparece en 3D.",
    features: ["Escena 3D interactiva en el navegador", "Hasta 12 fotos y tu mensaje", "Se abre con un enlace, en móvil u ordenador", "Opción con personaje 3D de la persona", "Entrega en 3 días laborables", "El tiempo que sigue en línea se confirma con tu pedido"],
    media: [vid("regalo-robot", "El regalo web en marcha: el robot abre la caja, pasan las fotos y aparece el mensaje"), img("regalo-demo-1", "Demo del regalo web: la escena 3D")],
    variants: [
      { key: "fotos-mensaje", name: "Con fotos y mensaje", tiers: tiers([1, 7900]) },
      { key: "personaje-3d", name: "Con personaje 3D de la persona", tiers: tiers([1, 14900]) },
    ],
    addons: [{ key: "video-vertical", name: "Vídeo vertical 9:16 del regalo", cents: 2900, perUnit: false, description: "Para compartirlo en redes o por WhatsApp." }],
    fields: [
      { key: "para", label: "¿Para quién es?", type: "text", required: true, max: 40 },
      { key: "mensaje", label: "Tu mensaje", type: "textarea", required: true, max: 600 },
      { key: "firma", label: "Firma", type: "text", required: false, max: 60 },
      { key: "fotos", label: "Fotos", type: "upload", required: true, maxFiles: 12, help: "Entre 5 y 12 fotos. Para el personaje 3D, incluye 2 o 3 fotos de cuerpo entero." },
      { key: "notas", label: "Indicaciones", type: "textarea", required: false, max: 1000 },
    ],
    qtyOptions: [], minQty: 1, maxQty: 1, leadDays: 3, demoUrl: "/regalo-demo/index.html",
  },
  {
    slug: "regalo-completo", kind: "physical", category: "regalos-3d", featured: false, visible: true, sortOrder: 10,
    name: "Regalo completo: tarjeta + web 3D",
    tagline: "Una tarjeta de aluminio con su foto y un QR que abre su regalo web.",
    description: "El regalo web 3D con vuestras fotos y tu mensaje, y una tarjeta de aluminio con una de las fotos grabada y, detrás, el QR que lo abre. Se entrega en mano y se descubre escaneando.",
    features: ["Regalo web 3D con fotos y mensaje", "Tarjeta de aluminio con su foto grabada", "QR detrás que abre el regalo", "Envío de la tarjeta en 3 a 5 días laborables"],
    media: [vid("regalo-robot", "El regalo web en marcha: el robot abre la caja, pasan las fotos y aparece el mensaje"), img("regalo-demo-1", "Demo del regalo web")],
    variants: [{ key: "completo", name: "Tarjeta + regalo web", tiers: tiers([1, 8990]) }],
    addons: [{ key: "video-vertical", name: "Vídeo vertical 9:16 del regalo", cents: 2900, perUnit: false }],
    fields: [
      { key: "para", label: "¿Para quién es?", type: "text", required: true, max: 40 },
      { key: "mensaje", label: "Tu mensaje", type: "textarea", required: true, max: 600 },
      { key: "firma", label: "Firma", type: "text", required: false, max: 60 },
      { key: "fotos", label: "Fotos (la primera va en la tarjeta)", type: "upload", required: true, maxFiles: 12 },
      { key: "notas", label: "Indicaciones", type: "textarea", required: false, max: 1000 },
    ],
    qtyOptions: [], minQty: 1, maxQty: 1, leadDays: 5, demoUrl: "/regalo-demo/index.html",
  },
  {
    slug: "qr-artistico", kind: "digital", category: "servicios-web", featured: false, visible: true, sortOrder: 11,
    name: "QR artístico de marca",
    tagline: "Un QR que es una pieza de marca y que se lee. Listo para imprimir o grabar.",
    description: "Diseñamos un QR con la estética de tu marca: arte generado alrededor del código, dentro de tu dibujo o como una escena. Cada pieza se prueba con lectores reales y a varios tamaños antes de entregarla. Te lo enviamos en alta resolución para imprenta y para web.",
    features: ["Diseño a partir de tu marca o tu idea", "Comprobado con lectores reales a varios tamaños", "Archivos para imprenta y para web", "Se puede grabar en nuestras placas y tarjetas"],
    media: [img("qr-artistico-shopycrafter", "QR artístico de Shopy Crafter"), pimg("qr-artisticos-3d-1", "QR artístico"), pimg("qr-artisticos-3d-2", "QR artístico"), pimg("qr-artisticos-3d-3", "QR artístico")],
    variants: [{ key: "qr", name: "1 QR artístico", tiers: tiers([1, 5900]) }],
    addons: [],
    fields: [
      { key: "enlace", label: "Enlace del QR", type: "url", required: true, max: 400 },
      { key: "idea", label: "Idea o estilo", type: "textarea", required: true, max: 800 },
      { key: "logo", label: "Logo o referencias", type: "upload", required: false, maxFiles: 4 },
    ],
    qtyOptions: [], minQty: 1, maxQty: 10, leadDays: 3, demoUrl: null,
  },
  {
    slug: "landing-3d", kind: "quote", category: "servicios-web", featured: false, visible: true, sortOrder: 12,
    name: "Landing con 3D y animación",
    tagline: "Una página de venta de una sola URL, con 3D en tiempo real y animación con el scroll.",
    description: "Diseñamos y programamos una landing de hasta 6 secciones a partir de tu marca: 3D en tiempo real, animación al hacer scroll y formulario o botón de compra. Adaptada a móvil, rápida y publicada en tu dominio.\n\nEl precio de partida cubre una landing de hasta 6 secciones con dos rondas de cambios; el importe final depende de las secciones, las escenas 3D, los idiomas y los rediseños que pidas, y lo cerramos por escrito antes de empezar. Mira nuestras demos para ver el tipo de trabajo.",
    features: ["Hasta 6 secciones a partir de tu marca", "3D en tiempo real y animación con el scroll", "Adaptada a móvil y optimizada para PageSpeed", "Publicada en tu dominio", "Dos rondas de cambios"],
    media: [vid("servicio-landing-3d", "Recorrido por la landing 3D de Warriors Hardcore"), pimg("warriors-hardcore-1", "Landing de Warriors Hardcore"), pimg("warriors-hardcore-2", "Landing de Warriors Hardcore"), pimg("warriors-hardcore-3", "Landing de Warriors Hardcore")],
    variants: [{ key: "landing", name: "Landing de hasta 6 secciones", tiers: tiers([1, 99000]) }],
    addons: [{ key: "idiomas", name: "Segundo idioma", cents: 15000, perUnit: false }],
    fields: [
      { key: "web", label: "Tu web actual (si tienes)", type: "url", required: false, max: 300 },
      { key: "objetivo", label: "¿Qué quieres que haga la página?", type: "textarea", required: true, max: 1200 },
      { key: "referencias", label: "Referencias que te gusten", type: "textarea", required: false, max: 800 },
      { key: "logo", label: "Logo y material de marca", type: "upload", required: false, maxFiles: 6 },
    ],
    qtyOptions: [], minQty: 1, maxQty: 1, leadDays: 15, demoUrl: "/portfolio",
  },
  {
    slug: "web-corporativa", kind: "quote", category: "servicios-web", featured: false, visible: true, sortOrder: 13,
    name: "Web corporativa",
    tagline: "Hasta 5 páginas con tu marca, animación y formulario de contacto.",
    description: "Una web de hasta 5 páginas (inicio, servicios, quiénes somos, contacto y la que necesites) diseñada a partir de tu marca, con animación, formulario de contacto y SEO técnico de base. Adaptada a móvil y publicada en tu dominio. El precio de partida incluye dos rondas de cambios; páginas extra, tienda, idiomas o rediseños se presupuestan aparte, siempre por escrito y antes de empezar.",
    features: ["Hasta 5 páginas", "Diseño a partir de tu marca", "Formulario de contacto", "SEO técnico de base y optimización de velocidad", "Dos rondas de cambios"],
    media: [vid("servicio-web-corporativa", "Recorrido por la web de Shopy Crafter"), pimg("brasas-y-paellas-1", "Web de Brasa y Paellas")],
    variants: [{ key: "web", name: "Web de hasta 5 páginas", tiers: tiers([1, 169000]) }],
    addons: [{ key: "idiomas", name: "Segundo idioma", cents: 25000, perUnit: false }],
    fields: [
      { key: "web", label: "Tu web actual (si tienes)", type: "url", required: false, max: 300 },
      { key: "negocio", label: "Cuéntanos tu negocio y qué páginas necesitas", type: "textarea", required: true, max: 1500 },
      { key: "logo", label: "Logo y material de marca", type: "upload", required: false, maxFiles: 6 },
    ],
    qtyOptions: [], minQty: 1, maxQty: 1, leadDays: 25, demoUrl: "/portfolio",
  },
  {
    slug: "rediseno-tienda", kind: "quote", category: "servicios-web", featured: false, visible: true, sortOrder: 14,
    name: "Rediseño de tienda online",
    tagline: "Shopify, WooCommerce o PrestaShop: portada, colección y ficha de producto rediseñadas.",
    description: "Rediseñamos las tres páginas que más venden de tu tienda: la portada, la página de colección y la ficha de producto, a partir de tu marca y de una auditoría de lo que hoy frena la compra. Trabajamos sobre tu propia tienda, sin migrarla. El precio de partida cubre esas tres páginas con dos rondas de cambios; más plantillas, colecciones o productos a rediseñar se presupuestan según el trabajo real, por escrito y antes de empezar.",
    features: ["Portada, colección y ficha de producto", "Auditoría previa de lo que frena la compra", "Sobre tu tienda actual, sin migraciones", "Adaptado a móvil y optimizado para PageSpeed", "Dos rondas de cambios"],
    media: [vid("servicio-rediseno-tienda-v2", "Maqueta de rediseño de la tienda de Muscle Factory")],
    variants: [{ key: "rediseno", name: "Portada + colección + ficha", tiers: tiers([1, 149000]) }],
    addons: [],
    fields: [
      { key: "tienda", label: "URL de tu tienda", type: "url", required: true, max: 300 },
      { key: "plataforma", label: "Plataforma", type: "select", required: true, options: ["Shopify", "WooCommerce", "PrestaShop", "Otra"] },
      { key: "objetivo", label: "¿Qué quieres mejorar?", type: "textarea", required: false, max: 1200 },
    ],
    qtyOptions: [], minQty: 1, maxQty: 1, leadDays: 20, demoUrl: null,
  },
  {
    slug: "video-3d-marca", kind: "quote", category: "servicios-video", featured: false, visible: true, sortOrder: 15,
    name: "Vídeo animado 3D de marca",
    tagline: "De 30 a 60 segundos, con personaje o producto en 3D, para web y redes.",
    description: "Un vídeo de presentación animado en 3D: tu producto, tu local o un personaje de marca, con textos, música y voz si la quieres. Lo entregamos en vertical para redes y en horizontal para la web. Incluye guion, una ronda de cambios sobre el guion y otra sobre el vídeo. El precio de partida es para el vídeo más corto con un personaje o producto; más escenas, personajes o versiones se presupuestan según el trabajo.",
    features: ["De 30 a 60 segundos", "Producto, local o personaje de marca en 3D", "Vertical 9:16 y horizontal 16:9", "Guion incluido", "Una ronda de cambios en guion y otra en vídeo"],
    media: [{ ...vid("servicio-video-3d", "Vídeo 3D de presentación para Lazy Lizard"), poster: "/tienda-media/servicio-video-3d-poster-16x9.webp" }],
    variants: [
      { key: "30s", name: "Hasta 30 segundos", tiers: tiers([1, 89000]) },
      { key: "60s", name: "Hasta 60 segundos", tiers: tiers([1, 149000]) },
    ],
    addons: [{ key: "voz", name: "Voz en off", cents: 9000, perUnit: false }],
    fields: [
      { key: "marca", label: "Marca o negocio", type: "text", required: true, max: 80 },
      { key: "idea", label: "¿Qué quieres contar?", type: "textarea", required: true, max: 1500 },
      { key: "logo", label: "Logo, fotos o referencias", type: "upload", required: false, maxFiles: 8 },
    ],
    qtyOptions: [], minQty: 1, maxQty: 1, leadDays: 12, demoUrl: null,
  },
  {
    slug: "app-nativa", kind: "quote", category: "servicios-web", featured: false, visible: true, sortOrder: 16,
    name: "App nativa Android e iOS",
    tagline: "Tu web, tu tienda o tu idea como app, con una sola base de código.",
    description: "Convertimos tu web o tu tienda en app para Android e iOS, o desarrollamos la app desde cero, con notificaciones push y publicación en las tiendas. Presupuesto cerrado antes de empezar.",
    features: ["Android e iOS con una sola base de código", "Notificaciones push", "Publicación en Google Play y App Store", "Presupuesto cerrado"],
    media: [img("servicio-app-nativa", "Apps reales de Shopy Crafter en el móvil")],
    variants: [{ key: "app", name: "Presupuesto", tiers: tiers([1, 0]) }],
    addons: [],
    fields: [],
    qtyOptions: [], minQty: 1, maxQty: 1, leadDays: 0, demoUrl: null,
  },
  {
    slug: "auditoria-seo", kind: "quote", category: "servicios-web", featured: false, visible: true, sortOrder: 17,
    name: "Auditoría SEO y plan de acción",
    tagline: "Detectamos problemas de rastreo, contenido y estructura, con prioridades claras para mejorar.",
    description: "Revisamos la indexación, los metadatos, la estructura de páginas, los enlaces internos y los problemas técnicos que afectan a tu visibilidad. Recibes un informe priorizado con acciones concretas y una propuesta de alcance antes de empezar. La auditoría no garantiza posiciones concretas en Google.",
    features: ["Revisión técnica y de contenido", "Problemas ordenados por impacto", "Informe con acciones recomendadas", "Presupuesto cerrado antes de empezar"],
    media: [img("servicio-auditoria-seo", "Ejemplo de auditoría SEO")],
    variants: [{ key: "audit", name: "Auditoría SEO", tiers: tiers([1, 0]) }],
    addons: [],
    fields: [
      { key: "web", label: "URL de tu web", type: "url", required: true, max: 300 },
      { key: "objetivo", label: "¿Qué te gustaría mejorar?", type: "textarea", required: false, max: 1000 },
    ],
    qtyOptions: [], minQty: 1, maxQty: 1, leadDays: 0, demoUrl: null,
  },
  {
    slug: "optimizacion-pagespeed", kind: "quote", category: "servicios-web", featured: false, visible: true, sortOrder: 18,
    name: "Optimización PageSpeed y Core Web Vitals",
    tagline: "Analizamos la velocidad móvil y de escritorio y proponemos mejoras para tu web.",
    description: "Medimos carga, interacción y estabilidad visual; revisamos imágenes, recursos y código para definir un plan de optimización que encaje con tu plataforma. El alcance y el precio se confirman antes de tocar la web. La puntuación final depende del dispositivo, la red y los servicios externos, por lo que no se garantiza un 100/100.",
    features: ["Diagnóstico móvil y escritorio", "Revisión de LCP, INP y CLS", "Plan priorizado de mejoras", "Presupuesto y alcance acordados antes de empezar"],
    media: [img("servicio-pagespeed", "Ejemplo de optimización de velocidad")],
    variants: [{ key: "speed", name: "Optimización PageSpeed", tiers: tiers([1, 0]) }],
    addons: [],
    fields: [
      { key: "web", label: "URL de tu web", type: "url", required: true, max: 300 },
      { key: "objetivo", label: "¿Qué página o problema priorizamos?", type: "textarea", required: false, max: 1000 },
    ],
    qtyOptions: [], minQty: 1, maxQty: 1, leadDays: 0, demoUrl: null,
  },
  {
    slug: "informes-mensuales", kind: "quote", category: "servicios-web", featured: false, visible: true, sortOrder: 19,
    name: "Informes mensuales de web y tienda",
    tagline: "Un resumen de resultados, incidencias y próximos pasos, basado en los datos disponibles.",
    description: "Preparamos un informe mensual sobre las métricas de tienda y web que nos facilites o a las que nos autorices a acceder: ventas, conversión, visibilidad orgánica, velocidad y acciones realizadas. Acordamos primero las fuentes, la frecuencia y el alcance; no solicitamos contraseñas ni garantizamos resultados comerciales.",
    features: ["Métricas acordadas según tus fuentes de datos", "Resumen de avances e incidencias", "Recomendaciones priorizadas para el siguiente mes", "Presupuesto mensual a medida"],
    media: [img("servicio-informes", "Ejemplo de informe mensual")],
    variants: [{ key: "monthly", name: "Informe mensual", tiers: tiers([1, 0]) }],
    addons: [],
    fields: [
      { key: "web", label: "URL de tu web o tienda", type: "url", required: true, max: 300 },
      { key: "objetivo", label: "¿Qué métricas o informes necesitas?", type: "textarea", required: false, max: 1200 },
    ],
    qtyOptions: [], minQty: 1, maxQty: 1, leadDays: 0, demoUrl: null,
  },
  {
    slug: "ficha-google-maps", kind: "quote", category: "google-local", featured: true, visible: true, sortOrder: 20,
    name: "Ficha de Google Maps optimizada",
    tagline: "Tu negocio bien presentado donde te buscan: Google Maps y el buscador.",
    description: "Ponemos a punto tu Perfil de empresa de Google (la ficha que sale en Google Maps y en el buscador): alta o recuperación de la ficha, categorías y servicios, horarios con festivos, fotos y portada, descripción pensada para cómo te busca la gente, enlace de reseñas con su QR y las primeras publicaciones. Trabajamos desde nuestro panel Crafter Mando, sin pedirte tu contraseña de Google: tú nos das acceso de gestor a la ficha.\n\nLa verificación de la ficha y la posición en Google las decide Google: no prometemos un puesto concreto. Prometemos una ficha completa, coherente y bien cuidada. El precio de partida es para una ficha de un solo local; varios locales, sesión de fotos o idiomas se presupuestan según el trabajo.",
    features: ["Alta o recuperación de la ficha y ayuda con la verificación", "Categorías, servicios, atributos y horarios con festivos", "Fotos, portada y descripción optimizada", "Enlace y QR para pedir reseñas", "Primeras publicaciones y preguntas frecuentes", "Presupuesto por escrito antes de empezar"],
    media: [img("google-ficha-mando", "Panel Crafter Mando con la ficha de Google: métricas, reseñas y publicaciones (datos de ejemplo)"), vid("servicio-google-mando", "Respuestas a reseñas propuestas desde Crafter Mando (datos de ejemplo)")],
    variants: [{ key: "ficha", name: "Una ficha (un local)", tiers: tiers([1, 25000]) }],
    addons: [], fields: [], qtyOptions: [], minQty: 1, maxQty: 1, leadDays: 7, demoUrl: null,
  },
  {
    slug: "resenas-google", kind: "quote", category: "google-local", featured: false, visible: true, sortOrder: 21,
    name: "Gestión de reseñas de Google",
    tagline: "Más reseñas y todas respondidas, con tu visto bueno. Puesta en marcha + cuota mensual desde 39 €/mes.",
    description: "Montamos el sistema para que tus clientes dejen reseña con un gesto (enlace corto, QR y, si quieres, la placa de madera grabada de la Tienda) y nos ocupamos de que ninguna se quede sin respuesta: te avisamos de cada reseña nueva y te dejamos la respuesta redactada en tu tono para que la apruebes. Nada se publica sin tu visto bueno.\n\nSe paga en dos partes: una puesta en marcha inicial, de pago único, y una cuota mensual por la gestión que parte de 39 €/mes y depende de las reseñas que haya que atender y de los idiomas. El precio de partida es para una ficha; varios locales o varios idiomas se presupuestan según el trabajo. Cumplimos las normas de Google: no compramos reseñas, no las filtramos ni ofrecemos regalos a cambio de ellas.",
    features: ["Enlace corto y QR para pedir la reseña", "Aviso de cada reseña nueva", "Respuesta redactada en tu tono, tú la apruebas", "Informe mensual de reseñas y nota media", "Combina con la Placa QR de reseñas de la Tienda", "Puesta en marcha (pago único) + cuota mensual desde 39 €, siempre por escrito"],
    media: [vid("servicio-google-mando", "Respuestas a reseñas propuestas desde Crafter Mando (datos de ejemplo)"), img("google-resenas-mando", "Reseñas con la respuesta lista para aprobar en Crafter Mando (datos de ejemplo)"), img("placa-resenas-madera", "Placa de reseñas de Google en madera para RastaLo Barcelona")],
    variants: [{ key: "resenas", name: "Puesta en marcha (una ficha)", tiers: tiers([1, 12000]) }],
    addons: [], fields: [], qtyOptions: [], minQty: 1, maxQty: 1, leadDays: 5, demoUrl: null,
  },
  {
    slug: "google-calendar-reservas", kind: "quote", category: "google-local", featured: false, visible: true, sortOrder: 22,
    name: "Reservas y agenda con Google Calendar",
    tagline: "Tus clientes reservan en tu web y la cita cae en tu Google Calendar.",
    description: "Una página de reservas con la imagen de tu negocio, conectada a tu Google Calendar: el cliente elige servicio y hueco, el sistema comprueba que esté libre, la cita aparece en tu calendario y el cliente recibe su confirmación por email. Duraciones, horarios, festivos y descansos a tu medida.\n\nLo construimos a medida de cómo trabajas tú. El precio de partida es para un calendario y un tipo de servicio; varios profesionales, pagos con señal, recordatorios por WhatsApp o idiomas se presupuestan según el trabajo, por escrito y antes de empezar.",
    features: ["Página de reservas con tu marca, en tu dominio", "Sincronizada con tu Google Calendar", "Comprueba huecos libres antes de confirmar", "Confirmación por email al cliente", "Horarios, festivos y descansos a tu medida", "Presupuesto por escrito antes de empezar"],
    media: [img("servicio-calendar", "Ejemplo de citas en Google Calendar")],
    variants: [{ key: "agenda", name: "Un calendario, un servicio", tiers: tiers([1, 39000]) }],
    addons: [], fields: [], qtyOptions: [], minQty: 1, maxQty: 1, leadDays: 12, demoUrl: null,
  },
  {
    slug: "pack-google-local", kind: "quote", category: "google-local", featured: false, visible: true, sortOrder: 23,
    name: "Pack Presencia en Google",
    tagline: "Ficha, reseñas y reservas juntas, con un solo diseño y un solo responsable.",
    description: "Reunimos los tres servicios en un solo encargo: ficha de Google Maps optimizada, sistema de reseñas con su QR y reservas conectadas a tu Google Calendar, con la misma imagen en todo. Pagas una puesta en marcha inicial y, si quieres que gestionemos tus reseñas cada mes, una cuota mensual aparte desde 39 €/mes.\n\nEl precio de partida es para un solo local; el importe final lo cerramos por escrito antes de empezar, según lo que haya que montar.",
    features: ["Ficha de Google Maps optimizada", "Sistema de reseñas con enlace y QR", "Reservas conectadas a Google Calendar", "Misma imagen en las tres piezas", "Puesta en marcha (pago único) + cuota mensual opcional", "Presupuesto por escrito antes de empezar"],
    media: [img("google-ficha-mando", "Panel Crafter Mando con la ficha de Google (datos de ejemplo)"), img("google-resenas-mando", "Reseñas con respuesta lista para aprobar (datos de ejemplo)"), img("placa-resenas-madera", "Placa de reseñas de Google en madera")],
    variants: [{ key: "pack", name: "Pack completo (un local)", tiers: tiers([1, 59000]) }],
    addons: [], fields: [], qtyOptions: [], minQty: 1, maxQty: 1, leadDays: 15, demoUrl: null,
  },
  // ── Stands de madera por uso ──────────────────────────────────────────────
  stand("stand-qr-resenas-google", 30, true, "Stand de reseñas de Google", "Tus clientes escanean y dejan su reseña desde el mostrador.",
    "El stand de contrachapado que le pone fácil la reseña a tus clientes: lo ven al pagar, escanean y llegan directos a tu ficha de Google. Lleva tu logo, un titular y el QR, en uno o dos idiomas. No hace falta ofrecer nada a cambio de la reseña: Google no lo permite.",
    "enlace", "Enlace para dejar reseña en tu ficha de Google"),
  stand("stand-qr-instagram", 31, false, "Stand de Instagram", "De tu mostrador a tu perfil, en un gesto.",
    "Un stand para que quien pasa por tu local te siga sin buscarte: logo, titular y QR a tu perfil. Queda a juego con el resto de piezas de tu mostrador.",
    "enlace", "Enlace de tu perfil"),
  stand("stand-qr-pago", 32, false, "Stand de pago con QR", "Te pagan escaneando tu enlace de pago.",
    "Para tiendas, artesanos y puestos: el cliente escanea y paga en tu enlace. Comprobamos contigo el enlace antes de grabarlo, porque en la madera no se puede cambiar salvo con QR reapuntable.",
    "enlace", "Tu enlace de pago"),
  stand("stand-qr-fidelizacion", 33, false, "Stand de tarjeta de fidelización", "Clientes apuntados a tu programa desde la barra.",
    "Lleva a tus clientes a tu tarjeta de fidelización o a tu lista de socios con un escaneo. Diseño más trabajado para que se vea en la barra.",
    "enlace", "Enlace de tu programa", [["unico", "90 × 110 mm", 2990, 2542]]),
  {
    slug: "stand-qr-wifi", kind: "physical", category: "placas-qr", featured: false, visible: true, sortOrder: 34,
    name: "Stand de wifi con QR",
    tagline: "Tus clientes se conectan sin preguntar la contraseña.",
    description: "Escanean y el móvil se conecta a tu wifi, sin dictar contraseñas. El QR guarda los datos de la red: si un día cambias la contraseña, hay que grabar uno nuevo. Probamos la lectura con varios móviles antes de enviarlo.",
    features: ["Contrachapado de 3 mm grabado y cortado con láser", "90 × 110 mm con base de pie", "Se conecta al escanear", "Si cambias la contraseña, hace falta un stand nuevo"],
    media: [img("demo-stand-qr-wifi-1", "Stand de wifi con QR (imagen de demostración)")],
    variants: [{ key: "90x110", name: "90 × 110 mm", tiers: tiers([1, 2290], [3, 1990]) }],
    addons: [],
    fields: [
      { key: "red", label: "Nombre de la red wifi", type: "text", required: true, max: 60 },
      { key: "clave", label: "Contraseña de la wifi", type: "text", required: true, max: 63 },
      { key: "seguridad", label: "Tipo de seguridad", type: "select", required: true, options: ["WPA/WPA2", "WEP", "Sin contraseña"] },
      { key: "logo", label: "Tu logo", type: "upload", required: false, maxFiles: 1 },
      { key: "notas", label: "Indicaciones", type: "textarea", required: false, max: 1000 },
    ],
    qtyOptions: [], minQty: 1, maxQty: 20, leadDays: 5, demoUrl: null,
  },
  stand("stand-doble-qr", 35, false, "Stand con dos QR", "Dos destinos en un solo panel: reseñas e Instagram, carta y wifi…",
    "Para mostradores con poco espacio: dos QR rotulados en el mismo panel. Los grabamos a un tamaño que se lea bien con cualquier móvil.",
    "enlace", "Primer enlace", [["unico", "90 × 110 mm", 3790, 3790]], [{ key: "enlace2", label: "Segundo enlace", type: "url", required: true, max: 400 }, { key: "rotulos", label: "Rótulo de cada QR", type: "text", required: false, max: 80 }]),
  {
    slug: "stands-qr-mesa", kind: "physical", category: "placas-qr", featured: false, visible: true, sortOrder: 36,
    name: "Stands de carta o reservas por mesa",
    tagline: "Numerados, cada uno con su enlace.",
    description: "Un stand por mesa con su número y su QR a la carta o a las reservas. Nos pasas la lista de mesas y grabamos cada uno a juego con tu marca. Encaja con nuestra carta digital si aún no tienes una.",
    features: ["Contrachapado de 3 mm con base de pie", "Numerados uno a uno", "Cada stand con su enlace", "Mismo diseño en todas las mesas"],
    media: [img("demo-stands-qr-mesa-1", "Stands numerados por mesa (imagen de demostración)")],
    variants: [{ key: "90x110", name: "90 × 110 mm, por unidad", tiers: tiers([5, 1990], [10, 1690], [20, 1490]) }],
    addons: [],
    fields: [
      { key: "enlace", label: "Enlace de la carta o reservas", type: "url", required: true, max: 400 },
      { key: "mesas", label: "Lista de mesas", type: "textarea", required: true, max: 1000, help: "Por ejemplo: 1 a 12, Terraza 1 a 6." },
      { key: "logo", label: "Tu logo", type: "upload", required: false, maxFiles: 1 },
      { key: "notas", label: "Indicaciones", type: "textarea", required: false, max: 1000 },
    ],
    qtyOptions: [5, 10, 20], minQty: 5, maxQty: 20, leadDays: 7, demoUrl: null,
  },
  {
    slug: "mini-qr-madera-50", kind: "physical", category: "placas-qr", featured: false, visible: true, sortOrder: 37,
    name: "QR mini de madera",
    tagline: "50 × 50 mm para mesa, caja o escaparate.",
    description: "Una pieza pequeña de contrachapado con tu QR, para donde no cabe un stand: junto a la caja, en un escaparate o pegada a la mesa. No lleva base. Probamos la lectura antes de enviarla.",
    features: ["Contrachapado de 3 mm, 50 × 50 mm", "Sin base", "QR a tu enlace", "Lectura comprobada antes del envío"],
    media: [img("demo-mini-qr-madera-50-1", "QR mini de madera (imagen de demostración)")],
    variants: [{ key: "50x50", name: "50 × 50 mm", tiers: tiers([1, 990], [5, 690], [20, 490]) }],
    addons: [],
    fields: [
      { key: "enlace", label: "Enlace del QR", type: "url", required: true, max: 400 },
      { key: "logo", label: "Tu logo", type: "upload", required: false, maxFiles: 1 },
    ],
    qtyOptions: [], minQty: 1, maxQty: 100, leadDays: 3, demoUrl: null,
  },
  {
    slug: "set-mostrador-qr", kind: "physical", category: "kits", featured: true, visible: true, sortOrder: 38,
    name: "Set de mostrador a juego",
    tagline: "Dos o tres stands con un solo diseño, y tarjetas si las quieres.",
    description: "Tu mostrador con una sola imagen: reseñas, Instagram y lo que necesites, en stands a juego. Puedes añadir 100 tarjetas de aluminio con el mismo diseño. Sale más barato que por separado y te enviamos la prueba antes de grabar.",
    features: ["Stands de 90 × 110 mm con base de pie", "Un QR distinto en cada stand", "Mismo diseño en todas las piezas", "Prueba antes de grabar"],
    media: [img("demo-set-mostrador-qr-1", "Set de stands a juego (imagen de demostración)")],
    variants: [
      { key: "dos", name: "2 stands", tiers: tiers([1, 4490]) },
      { key: "tres", name: "3 stands", tiers: tiers([1, 6490]) },
      { key: "dos-tarjetas", name: "2 stands + 100 tarjetas", tiers: tiers([1, 8490]) },
    ],
    addons: [],
    fields: [
      { key: "enlaces", label: "Enlaces y uso de cada stand", type: "textarea", required: true, max: 1200, help: "Por ejemplo: reseñas → enlace; Instagram → enlace." },
      { key: "logo", label: "Tu logo", type: "upload", required: false, maxFiles: 1 },
      { key: "datos", label: "Datos de las tarjetas, si las pides", type: "textarea", required: false, max: 600 },
      { key: "notas", label: "Indicaciones", type: "textarea", required: false, max: 1000 },
    ],
    qtyOptions: [], minQty: 1, maxQty: 5, leadDays: 7, demoUrl: null,
  },
  // ── Tarjetas para regalar ─────────────────────────────────────────────────
  {
    slug: "tarjeta-mensaje-aluminio", kind: "physical", category: "tarjetas-regalo", featured: false, visible: true, sortOrder: 40,
    name: "Tarjeta con foto y mensaje",
    tagline: "Vuestra foto delante, tus palabras detrás. Cabe en la cartera y no se borra.",
    description: "Una tarjeta de aluminio grabada con láser: delante la foto que elijas, preparada para el metal, y detrás tu mensaje y tu firma. Para cumpleaños, bodas, aniversarios, nacimientos, San Valentín o Navidad. Te enseñamos cómo quedará antes de grabarla.",
    features: ["Aluminio lacado negro, 85,5 × 54 mm", "Foto preparada para el metal", "Mensaje de hasta 150 caracteres y firma", "Prueba antes de grabar"],
    media: [img("demo-tarjeta-mensaje-aluminio-1", "Tarjeta de aluminio con foto y mensaje (imagen de demostración)")],
    variants: [
      { key: "horizontal", name: "Horizontal", tiers: tiers([1, 1690], [3, 1390]) },
      { key: "vertical", name: "Vertical", tiers: tiers([1, 1690], [3, 1390]) },
    ],
    addons: [],
    fields: [OCASION, { key: "foto", label: "Tu foto", type: "upload", required: true, maxFiles: 1 }, { key: "mensaje", label: "Tu mensaje", type: "textarea", required: true, max: 150 }, { key: "firma", label: "Firma", type: "text", required: false, max: 60 }, { key: "notas", label: "Indicaciones", type: "textarea", required: false, max: 1000 }],
    qtyOptions: [], minQty: 1, maxQty: 20, leadDays: 4, demoUrl: null,
  },
  {
    slug: "serie-tarjetas-recuerdos", kind: "physical", category: "tarjetas-regalo", featured: true, visible: true, sortOrder: 41,
    name: "Serie de recuerdos en aluminio",
    tagline: "Una tarjeta por recuerdo o por persona que la quiere.",
    description: "Una colección de tarjetas de aluminio, cada una con su foto y su frase. Es el regalo perfecto de grupo: cada persona escribe la suya. Nació de un regalo de cumpleaños hecho en nuestro taller.",
    features: ["Aluminio lacado negro, 85,5 × 54 mm", "Una foto y una frase por tarjeta", "Packs de 4, 8 o 12", "Prueba antes de grabar"],
    media: [img("demo-serie-tarjetas-recuerdos-1", "Serie de tarjetas de aluminio (imagen de demostración)")],
    variants: [
      { key: "cuatro", name: "4 tarjetas", tiers: tiers([1, 5400]) },
      { key: "ocho", name: "8 tarjetas", tiers: tiers([1, 10000]) },
      { key: "doce", name: "12 tarjetas", tiers: tiers([1, 13800]) },
    ],
    addons: [],
    fields: [OCASION, { key: "fotos", label: "Fotos", type: "upload", required: true, maxFiles: 12 }, { key: "frases", label: "Frases, una por tarjeta", type: "textarea", required: true, max: 2000 }, { key: "notas", label: "Indicaciones", type: "textarea", required: false, max: 1000 }],
    qtyOptions: [], minQty: 1, maxQty: 3, leadDays: 6, demoUrl: null,
  },
  {
    slug: "regalo-serie-web", kind: "physical", category: "tarjetas-regalo", featured: true, visible: true, sortOrder: 42,
    name: "Regalo completo con serie y web 3D",
    tagline: "La serie de tarjetas y una tarjeta con QR que abre su regalo web.",
    description: "El regalo entero: la serie de tarjetas con vuestras fotos y frases, y una tarjeta más con el QR que abre un regalo web en 3D, con la escena, las fotos y tu mensaje. Lo físico abre lo digital. El tiempo que sigue en línea se confirma con tu pedido.",
    features: ["Serie de 4 u 8 tarjetas de aluminio", "Tarjeta con QR que abre el regalo", "Regalo web 3D con fotos y mensaje", "Prueba antes de grabar"],
    media: [img("demo-regalo-serie-web-1", "Serie de tarjetas con QR y regalo web en el móvil (imagen de demostración)"), vid("regalo-robot", "El regalo web en marcha")],
    variants: [
      { key: "cuatro", name: "4 tarjetas + QR + web", tiers: tiers([1, 13490]) },
      { key: "ocho", name: "8 tarjetas + QR + web", tiers: tiers([1, 17490]) },
    ],
    addons: [],
    fields: [OCASION, { key: "para", label: "¿Para quién es?", type: "text", required: true, max: 40 }, { key: "mensaje", label: "Mensaje del regalo web", type: "textarea", required: true, max: 600 }, { key: "fotos", label: "Fotos", type: "upload", required: true, maxFiles: 12 }, { key: "frases", label: "Frases de las tarjetas", type: "textarea", required: false, max: 2000 }],
    qtyOptions: [], minQty: 1, maxQty: 1, leadDays: 7, demoUrl: "/regalo-demo/index.html",
  },
  {
    slug: "tarjetas-invitados", kind: "physical", category: "tarjetas-regalo", featured: false, visible: true, sortOrder: 43,
    name: "Tarjetas de invitado para bodas y eventos",
    tagline: "Su nombre en metal y un QR a la galería del evento.",
    description: "Un recuerdo que los invitados se llevan: su nombre grabado en una tarjeta de aluminio, la fecha y un QR a la galería de fotos del evento. Nos pasas la lista y grabamos cada una.",
    features: ["Aluminio lacado negro, 85,5 × 54 mm", "Nombre de cada invitado", "Fecha y QR a tu enlace", "Desde 20 unidades"],
    media: [img("demo-tarjetas-invitados-1", "Tarjetas de invitado de aluminio (imagen de demostración)")],
    variants: [{ key: "invitado", name: "Por unidad", tiers: tiers([20, 390], [50, 290], [100, 190]) }],
    addons: [],
    fields: [{ key: "evento", label: "Evento y fecha", type: "text", required: true, max: 80 }, { key: "nombres", label: "Lista de nombres", type: "textarea", required: true, max: 4000 }, { key: "enlace", label: "Enlace del QR", type: "url", required: false, max: 400 }],
    qtyOptions: [20, 50, 100], minQty: 20, maxQty: 500, leadDays: 10, demoUrl: null,
  },
];
