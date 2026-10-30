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
  tarjetas: "Tarjetas metálicas",
  "placas-qr": "Placas QR",
  expositores: "Expositores",
  kits: "Kits para negocios",
  "fotos-grabadas": "Fotos grabadas",
  "regalos-3d": "Regalos 3D",
  "servicios-web": "Webs y diseño",
  "servicios-video": "Vídeo y animación 3D",
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
// Se siembra una vez por versión (app_settings.shop_catalog_version): crea los productos que
// falten por slug y nunca pisa uno que ya exista (lo editado desde el admin se respeta).

type SeedProduct = Omit<ShopProduct, "id">;

const CARD_FIELDS: ShopField[] = [
  { key: "logo", label: "Tu logo o diseño", type: "upload", required: false, maxFiles: 2, help: "PNG, JPG o PDF. Si no tienes, lo diseñamos a partir de tu nombre." },
  { key: "nombre", label: "Nombre en la tarjeta", type: "text", required: true, max: 60 },
  { key: "cargo", label: "Cargo", type: "text", required: false, max: 60 },
  { key: "empresa", label: "Empresa", type: "text", required: false, max: 60 },
  { key: "telefono", label: "Teléfono", type: "tel", required: false, max: 30 },
  { key: "email", label: "Email", type: "email", required: false, max: 120 },
  { key: "web", label: "Web", type: "text", required: false, max: 120 },
  { key: "qr", label: "Enlace del QR", type: "url", required: false, max: 400, help: "A dónde lleva el QR del reverso: tu web, Instagram, WhatsApp, reseñas…" },
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

export const SHOP_SEED_VERSION = "v1-2026-10";

export const SHOP_SEED: SeedProduct[] = [
  {
    slug: "tarjetas-metalicas", kind: "physical", category: "tarjetas", featured: true, visible: true, sortOrder: 0,
    name: "Tarjetas de visita metálicas",
    tagline: "Aluminio anodizado grabado con láser. Tu logo o una ilustración delante, tus datos y un QR detrás.",
    description: "Tarjetas de 85 × 55 mm en aluminio anodizado de 0,2 mm, grabadas una a una con el láser infrarrojo de nuestra xTool F2. El grabado no es tinta: es el propio metal, así que no se borra ni se despega.\n\nDelante va tu logo, una ilustración o una foto; detrás, tus datos y un QR que lleva a donde tú quieras. Con el pedido incluimos el diseño básico a partir de tu logo y te enviamos la prueba antes de grabar. Cuantas más tarjetas, menos cuesta cada una.",
    features: ["Aluminio anodizado negro, 85 × 55 × 0,2 mm", "Grabado láser por las dos caras", "QR a tu web, Instagram, WhatsApp o reseñas", "Diseño básico y prueba antes de grabar incluidos", "Envío en 3 a 5 días laborables"],
    media: [
      vid("taller-grabado-tarjeta", "Tarjeta grabándose en la xTool F2"),
      img("tarjeta-warriors-ultra-pump", "Tarjeta metálica de Warriors Hardcore: Ultra Pump"),
      img("tarjeta-shopycrafter-delante", "Tarjeta de Shopy Crafter, cara delantera"),
      img("tarjeta-shopycrafter-detras", "Tarjeta de Shopy Crafter, reverso con QR"),
      img("tarjeta-lazy-lizard", "Tarjetas de Lazy Lizard, delante y detrás"),
      img("tarjeta-warriors-anabolic", "Tarjeta metálica de Warriors Hardcore: Anabolic"),
      img("tarjeta-warriors-isolate", "Tarjeta metálica de Warriors Hardcore: Isolate"),
      vid("taller-tarjeta-hardcore", "Grabado de una tarjeta de Warriors Hardcore"),
    ],
    variants: [{ key: "aluminio-negro", name: "Aluminio anodizado negro", tiers: tiers([25, 320], [50, 240], [100, 170], [250, 125]) }],
    addons: [
      { key: "diseno-a-medida", name: "Diseño a medida desde cero", cents: 3900, perUnit: false, description: "Diseñamos la tarjeta completa aunque no tengas logo." },
      { key: "tarjeta-digital", name: "QR a tarjeta digital con estadísticas", cents: 1500, perUnit: false, description: "Tu tarjeta de contacto online, editable sin reimprimir, con conteo de escaneos." },
    ],
    fields: CARD_FIELDS,
    qtyOptions: [25, 50, 100, 250], minQty: 25, maxQty: 250, leadDays: 5, demoUrl: null,
  },
  {
    slug: "placa-qr-madera", kind: "physical", category: "placas-qr", featured: true, visible: true, sortOrder: 1,
    name: "Placa QR de madera con soporte",
    tagline: "Para reseñas de Google, Instagram, la wifi, la carta o el pago. Grabada y cortada en contrachapado.",
    description: "Placa de contrachapado de 3 mm grabada y cortada con láser, con su soporte de pie. Lleva tu logo, un titular y el QR al enlace que elijas. Es el modo más fácil de conseguir reseñas en Google: el cliente la ve en el mostrador, escanea y deja sus estrellas.\n\nComprobamos que el QR se lee con varios móviles antes de enviarla. Con el chip NFC opcional, basta con acercar el móvil.",
    features: ["Contrachapado de 3 mm grabado y cortado con láser", "Soporte de pie incluido", "Tu logo, un titular y el QR a tu enlace", "QR comprobado con varios móviles antes del envío", "Chip NFC opcional: se abre al acercar el móvil"],
    media: [
      img("placa-qr-hanakaze", "Placas QR de madera con soporte para Hanakaze Serigraphy"),
      img("placa-resenas-madera", "Placa de reseñas de Google en madera para RastaLo Barcelona"),
      img("placa-resenas-madera-grabada", "Vista del grabado de la placa de reseñas"),
      img("soportes-placa-qr", "Modelos de soporte para la placa"),
      vid("taller-coleccion", "Placas y tarjetas grabadas en el taller"),
    ],
    variants: [
      { key: "90x110", name: "Pequeña · 90 × 110 mm", tiers: tiers([1, 2490], [3, 2117]) },
      { key: "115x115", name: "Cuadrada · 115 × 115 mm", tiers: tiers([1, 2990], [3, 2542]) },
      { key: "400x115", name: "Cartel · 400 × 115 mm", tiers: tiers([1, 4990], [3, 4242]) },
    ],
    addons: [{ key: "nfc", name: "Chip NFC (NTAG213)", cents: 500, perUnit: true, description: "Se abre el enlace al acercar el móvil." }],
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
    description: "Expositor de contrachapado de 3 mm, cortado a medida para tarjetas de 85 × 55 mm y montado sin cola, a presión. Elige si las tarjetas van apaisadas o de pie. Grabamos tu logo o tu nombre en el frontal.",
    features: ["Contrachapado de 3 mm cortado con láser", "Hueco para unas 40 tarjetas de 85 × 55 mm", "Horizontal o vertical", "Logo o nombre grabado en el frontal"],
    media: [
      img("expositor-tarjetas-vertical", "Expositor vertical de tarjetas montado"),
      img("placa-qr-hanakaze", "Piezas de contrachapado con soporte montado a presión"),
      img("soportes-placa-qr", "Piezas y modelos de soportes"),
      vid("taller-coleccion", "Piezas del taller"),
    ],
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
    slug: "kit-resenas", kind: "physical", category: "kits", featured: true, visible: true, sortOrder: 3,
    name: "Kit Reseñas para tu negocio",
    tagline: "Placa QR de reseñas, expositor y 100 tarjetas metálicas con el mismo diseño.",
    description: "Todo lo que necesita un mostrador para pedir reseñas y repartir tarjetas, con una sola imagen de marca: la placa cuadrada de reseñas de Google con soporte, el expositor con tu logo y 100 tarjetas metálicas con QR, más tu tarjeta digital con estadísticas de escaneos.\n\nPor separado serían 234,80 €.",
    features: ["Placa QR de reseñas 115 × 115 mm con soporte", "Expositor de tarjetas con tu logo", "100 tarjetas metálicas grabadas por las dos caras", "Tarjeta digital con estadísticas de escaneos", "Mismo diseño en las tres piezas"],
    media: [
      img("placa-qr-hanakaze", "Placas QR de madera con soporte"),
      vid("taller-coleccion", "Placas y tarjetas del taller"),
      img("placa-resenas-madera", "Placa de reseñas de Google"),
      img("tarjeta-shopycrafter-detras", "Reverso de tarjeta con QR"),
      img("expositor-tarjetas-vertical", "Expositor de tarjetas"),
    ],
    variants: [{ key: "kit", name: "Kit completo", tiers: tiers([1, 19900]) }],
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
    name: "Expositor + 100 tarjetas metálicas",
    tagline: "El expositor con tu logo y 100 tarjetas a juego.",
    description: "El expositor de mostrador con tu logo grabado y 100 tarjetas metálicas con tus datos y QR. Por separado serían 189,90 €.",
    features: ["Expositor de contrachapado con tu logo", "100 tarjetas metálicas grabadas por las dos caras", "Diseño básico y prueba antes de grabar incluidos"],
    media: [img("expositor-tarjetas-vertical", "Expositor de tarjetas"), img("tarjeta-shopycrafter-delante", "Tarjeta metálica")],
    variants: [
      { key: "horizontal", name: "Expositor horizontal", tiers: tiers([1, 17900]) },
      { key: "vertical", name: "Expositor vertical", tiers: tiers([1, 17900]) },
    ],
    addons: [],
    fields: CARD_FIELDS,
    qtyOptions: [], minQty: 1, maxQty: 5, leadDays: 6, demoUrl: null,
  },
  {
    slug: "tarjeta-foto-aluminio", kind: "physical", category: "fotos-grabadas", featured: true, visible: true, sortOrder: 5,
    name: "Foto grabada en tarjeta de aluminio",
    tagline: "Una foto que cabe en la cartera y no se borra.",
    description: "Tu foto grabada con láser en una tarjeta de aluminio anodizado de 85 × 55 mm. Preparamos la imagen para el metal (contraste, encuadre y trama) y te enseñamos cómo quedará antes de grabarla. Detrás, si quieres, una fecha o una frase.",
    features: ["Aluminio anodizado de 85 × 55 mm", "Foto preparada para el metal y revisada antes de grabar", "Texto opcional en el reverso", "Tres por 34,89 €"],
    media: [img("tarjeta-foto-aluminio-paisaje", "Tarjeta de aluminio con una ilustración grabada")],
    variants: [{ key: "tarjeta", name: "Tarjeta 85 × 55 mm", tiers: tiers([1, 1490], [3, 1163]) }],
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
    media: [],
    variants: [{ key: "109x141", name: "109 × 141 mm con peana", tiers: tiers([1, 2990]) }],
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
    media: [],
    variants: [{ key: "marco", name: "Marco 115 × 115 mm", tiers: tiers([1, 3490]) }],
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
    media: [],
    variants: [{ key: "400x115", name: "400 × 115 mm", tiers: tiers([1, 4990]) }],
    addons: [],
    fields: PHOTO_FIELDS,
    qtyOptions: [], minQty: 1, maxQty: 5, leadDays: 6, demoUrl: null,
  },
  {
    slug: "regalo-web-3d", kind: "digital", category: "regalos-3d", featured: true, visible: true, sortOrder: 9,
    name: "Regalo web 3D",
    tagline: "Una pequeña web que se abre como un regalo: escena 3D, vuestras fotos y tu mensaje.",
    description: "Le mandas un enlace y, al abrirlo, encuentra una escena en 3D con un regalo esperándole. Lo abre, pasan vuestras fotos y aparece tu mensaje letra a letra, con música. Funciona en el móvil y en el ordenador, sin instalar nada.\n\nPrueba la demo: así es la experiencia, con fotos de ejemplo. En el tuyo van tus fotos y tu texto, y con la opción de personaje, la persona que lo recibe aparece en 3D.",
    features: ["Escena 3D interactiva en el navegador", "Hasta 12 fotos y tu mensaje", "Se abre con un enlace, en móvil u ordenador", "Opción con personaje 3D de la persona", "Entrega en 3 días laborables"],
    media: [img("regalo-demo-1", "Demo del regalo web: la escena 3D"), img("regalo-demo-2", "Demo del regalo web: el mensaje final")],
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
    media: [img("regalo-demo-1", "Demo del regalo web"), img("tarjeta-foto-aluminio-paisaje", "Tarjeta de aluminio grabada")],
    variants: [{ key: "completo", name: "Tarjeta + regalo web", tiers: tiers([1, 9900]) }],
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
    slug: "landing-3d", kind: "digital", category: "servicios-web", featured: true, visible: true, sortOrder: 12,
    name: "Landing con 3D y animación",
    tagline: "Una página de venta de una sola URL, con 3D en tiempo real y animación con el scroll.",
    description: "Diseñamos y programamos una landing de hasta 6 secciones a partir de tu marca: 3D en tiempo real, animación al hacer scroll y formulario o botón de compra. Adaptada a móvil, rápida y publicada en tu dominio.\n\nIncluye dos rondas de cambios. Mira nuestras demos para ver el tipo de trabajo.",
    features: ["Hasta 6 secciones a partir de tu marca", "3D en tiempo real y animación con el scroll", "Adaptada a móvil y optimizada para PageSpeed", "Publicada en tu dominio", "Dos rondas de cambios"],
    media: [pimg("warriors-hardcore-1", "Landing de Warriors Hardcore"), pimg("warriors-hardcore-2", "Landing de Warriors Hardcore"), pimg("warriors-hardcore-3", "Landing de Warriors Hardcore")],
    variants: [{ key: "landing", name: "Landing de hasta 6 secciones", tiers: tiers([1, 69000]) }],
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
    slug: "web-corporativa", kind: "digital", category: "servicios-web", featured: false, visible: true, sortOrder: 13,
    name: "Web corporativa",
    tagline: "Hasta 5 páginas con tu marca, animación y formulario de contacto.",
    description: "Una web de hasta 5 páginas (inicio, servicios, quiénes somos, contacto y la que necesites) diseñada a partir de tu marca, con animación, formulario de contacto y SEO técnico de base. Adaptada a móvil y publicada en tu dominio. Incluye dos rondas de cambios.",
    features: ["Hasta 5 páginas", "Diseño a partir de tu marca", "Formulario de contacto", "SEO técnico de base y optimización de velocidad", "Dos rondas de cambios"],
    media: [pimg("brasas-y-paellas-1", "Web de Brasa y Paellas"), pimg("crafter-eventos-1", "Web de Crafter Eventos")],
    variants: [{ key: "web", name: "Web de hasta 5 páginas", tiers: tiers([1, 149000]) }],
    addons: [{ key: "idiomas", name: "Segundo idioma", cents: 25000, perUnit: false }],
    fields: [
      { key: "web", label: "Tu web actual (si tienes)", type: "url", required: false, max: 300 },
      { key: "negocio", label: "Cuéntanos tu negocio y qué páginas necesitas", type: "textarea", required: true, max: 1500 },
      { key: "logo", label: "Logo y material de marca", type: "upload", required: false, maxFiles: 6 },
    ],
    qtyOptions: [], minQty: 1, maxQty: 1, leadDays: 25, demoUrl: "/portfolio",
  },
  {
    slug: "rediseno-tienda", kind: "digital", category: "servicios-web", featured: true, visible: true, sortOrder: 14,
    name: "Rediseño de tienda online",
    tagline: "Shopify, WooCommerce o PrestaShop: portada, colección y ficha de producto rediseñadas.",
    description: "Rediseñamos las tres páginas que más venden de tu tienda: la portada, la página de colección y la ficha de producto, a partir de tu marca y de una auditoría de lo que hoy frena la compra. Trabajamos sobre tu propia tienda, sin migrarla. Incluye dos rondas de cambios.",
    features: ["Portada, colección y ficha de producto", "Auditoría previa de lo que frena la compra", "Sobre tu tienda actual, sin migraciones", "Adaptado a móvil y optimizado para PageSpeed", "Dos rondas de cambios"],
    media: [vid("servicio-rediseno-tienda", "Rediseño de la tienda de Muscle Factory")],
    variants: [{ key: "rediseno", name: "Portada + colección + ficha", tiers: tiers([1, 129000]) }],
    addons: [],
    fields: [
      { key: "tienda", label: "URL de tu tienda", type: "url", required: true, max: 300 },
      { key: "plataforma", label: "Plataforma", type: "select", required: true, options: ["Shopify", "WooCommerce", "PrestaShop", "Otra"] },
      { key: "objetivo", label: "¿Qué quieres mejorar?", type: "textarea", required: false, max: 1200 },
    ],
    qtyOptions: [], minQty: 1, maxQty: 1, leadDays: 20, demoUrl: null,
  },
  {
    slug: "video-3d-marca", kind: "digital", category: "servicios-video", featured: true, visible: true, sortOrder: 15,
    name: "Vídeo animado 3D de marca",
    tagline: "De 30 a 60 segundos, con personaje o producto en 3D, para web y redes.",
    description: "Un vídeo de presentación animado en 3D: tu producto, tu local o un personaje de marca, con textos, música y voz si la quieres. Lo entregamos en vertical para redes y en horizontal para la web. Incluye guion, una ronda de cambios sobre el guion y otra sobre el vídeo.",
    features: ["De 30 a 60 segundos", "Producto, local o personaje de marca en 3D", "Vertical 9:16 y horizontal 16:9", "Guion incluido", "Una ronda de cambios en guion y otra en vídeo"],
    media: [vid("servicio-video-3d", "Vídeo 3D de presentación para Lazy Lizard")],
    variants: [
      { key: "30s", name: "Hasta 30 segundos", tiers: tiers([1, 49000]) },
      { key: "60s", name: "Hasta 60 segundos", tiers: tiers([1, 79000]) },
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
    media: [pimg("pequenos-genios-1", "App Pequeños Genios"), pimg("crafter-eventos-2", "App Crafter Eventos"), pimg("redes-del-grupo-2", "App Redes del Grupo")],
    variants: [{ key: "app", name: "Presupuesto", tiers: tiers([1, 0]) }],
    addons: [],
    fields: [],
    qtyOptions: [], minQty: 1, maxQty: 1, leadDays: 0, demoUrl: null,
  },
];
