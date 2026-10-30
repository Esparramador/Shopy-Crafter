/**
 * Tienda: tipos, llamadas al API y carrito.
 *
 * El carrito vive en localStorage (por navegador) y solo guarda la elección del cliente:
 * el precio que se cobra lo calcula siempre el servidor (/api/shop/quote y /api/shop/checkout).
 */
import { useSyncExternalStore } from "react";

export const API = `${(import.meta.env.BASE_URL ?? "").replace(/\/$/, "")}/api`;

export type ShopKind = "physical" | "digital" | "quote";
export interface Tier { min: number; unitCents: number }
export interface Variant { key: string; name: string; tiers: Tier[] }
export interface Addon { key: string; name: string; cents: number; perUnit: boolean; description?: string }
export interface Field {
  key: string; label: string; type: "text" | "textarea" | "url" | "email" | "tel" | "select" | "upload";
  required: boolean; max?: number; options?: string[]; maxFiles?: number; help?: string;
}
export interface Media { type: "image" | "video"; url: string; alt: string; poster?: string }
export interface Product {
  slug: string; kind: ShopKind; category: string; categoryLabel: string; name: string; tagline: string; description: string;
  features: string[]; media: Media[]; variants: Variant[]; addons: Addon[]; fields: Field[];
  qtyOptions: number[]; minQty: number; maxQty: number; leadDays: number; demoUrl: string | null;
  featured: boolean; sortOrder: number;
}
export interface Catalog { products: Product[]; categories: Record<string, string> }
export interface ShopSettings { shippingCents: number; freeFromCents: number; payments: boolean }

export const euros = (c: number) => (c / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });

/** Rutas del propio sitio (los medios guardados en el API llevan /api delante). */
export function assetUrl(u: string): string {
  const base = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
  return u.startsWith("/") ? `${base}${u}` : u;
}

/** Primera imagen o póster del producto. */
export function coverOf(p: Product): string | null {
  const img = p.media.find(m => m.type === "image");
  if (img) return assetUrl(img.url);
  const vid = p.media.find(m => m.type === "video" && m.poster);
  return vid?.poster ? assetUrl(vid.poster) : null;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${path}`, { credentials: "include", ...init });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as { error?: string }).error ?? `Error ${r.status}`);
  return d as T;
}

let catalogPromise: Promise<Catalog> | null = null;
/** Catálogo público, una sola petición por visita (la tienda, la ficha y el carrito lo comparten). */
export function loadCatalog(): Promise<Catalog> {
  if (!catalogPromise) catalogPromise = apiJson<Catalog>("/shop/products").catch(e => { catalogPromise = null; throw e; });
  return catalogPromise;
}

let settingsPromise: Promise<ShopSettings> | null = null;
export function loadSettings(): Promise<ShopSettings> {
  if (!settingsPromise) settingsPromise = apiJson<ShopSettings>("/shop/settings").catch(e => { settingsPromise = null; throw e; });
  return settingsPromise;
}

/** Productos para sugerir: destacados primero, sin los que ya están en el carrito ni el actual. */
export function suggestions(products: Product[], exclude: string[], n: number): Product[] {
  const skip = new Set(exclude);
  return products
    .filter(p => !skip.has(p.slug) && p.kind !== "quote")
    .sort((a, b) => Number(b.featured) - Number(a.featured) || a.sortOrder - b.sortOrder)
    .slice(0, n);
}

export function unitPrice(v: Variant, qty: number): number {
  const tiers = [...v.tiers].sort((a, b) => a.min - b.min);
  let unit = tiers[0]?.unitCents ?? 0;
  for (const t of tiers) if (qty >= t.min) unit = t.unitCents;
  return unit;
}

export function minQty(p: Product, v: Variant): number {
  const tierMin = Math.min(...v.tiers.map(t => t.min));
  return Math.max(p.minQty, p.qtyOptions.length ? Math.min(...p.qtyOptions) : 1, tierMin);
}

/** Precio «desde» de un producto: el más bajo por unidad de cualquier opción y cantidad. */
export function fromPrice(p: Product): { cents: number; perUnit: boolean } {
  let best = Infinity, perUnit = false;
  for (const v of p.variants) {
    for (const t of v.tiers) {
      if (t.unitCents < best) { best = t.unitCents; perUnit = p.maxQty > 1 && (p.qtyOptions.length > 0 || v.tiers.length > 1); }
    }
  }
  return { cents: Number.isFinite(best) ? best : 0, perUnit };
}

// ── Carrito ──────────────────────────────────────────────────────────────────

export interface CartItem {
  id: string;
  slug: string; name: string; image: string | null; kind: ShopKind;
  variant: string; variantName: string; qty: number; addons: string[];
  fields: Record<string, string | string[]>;
  /** Nombres de los archivos subidos (solo para mostrarlos). */
  files: Record<string, string>;
  /** Estimación local; el total que vale es el del servidor. */
  estimateCents: number;
}

const KEY = "sc_shop_cart_v1";
let cache: CartItem[] | null = null;
const listeners = new Set<() => void>();

function read(): CartItem[] {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? parsed : [];
  } catch {
    cache = [];
  }
  return cache!;
}

function write(items: CartItem[]) {
  cache = items;
  try { window.localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* sin almacenamiento: el carrito dura lo que la pestaña */ }
  listeners.forEach(l => l());
}

export const cart = {
  items: read,
  add(item: Omit<CartItem, "id">): CartItem {
    const full = { ...item, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}` };
    write([...read(), full]);
    return full;
  },
  remove(id: string) { write(read().filter(i => i.id !== id)); },
  clear() { write([]); },
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
};

if (typeof window !== "undefined") {
  window.addEventListener("storage", e => { if (e.key === KEY) { cache = null; listeners.forEach(l => l()); } });
}

const EMPTY: CartItem[] = [];
export function useCart(): CartItem[] {
  return useSyncExternalStore(cart.subscribe, () => (typeof window === "undefined" ? EMPTY : read()), () => EMPTY);
}

export function cartPayload(items: CartItem[]) {
  return { items: items.map(i => ({ slug: i.slug, variant: i.variant, qty: i.qty, addons: i.addons, fields: i.fields })) };
}
