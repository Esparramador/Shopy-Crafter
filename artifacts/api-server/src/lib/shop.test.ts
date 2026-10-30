import { describe, expect, it } from "vitest";
import { SHOP_SEED, priceLine, shippingFor, unitPriceFor, ShopValidationError, variantSchema, addonSchema, fieldSchema, mediaSchema, type ShopProduct } from "./shop";

const products: ShopProduct[] = SHOP_SEED.map((p, i) => ({ ...p, id: i + 1 }));
const bySlug = (s: string) => products.find(p => p.slug === s)!;
const UP = "a".repeat(32);

describe("catálogo de la tienda", () => {
  it("cada producto del catálogo inicial es válido con los mismos esquemas que usa el admin", () => {
    const slugs = new Set<string>();
    for (const p of products) {
      expect(slugs.has(p.slug)).toBe(false); slugs.add(p.slug);
      for (const v of p.variants) expect(variantSchema.safeParse(v).success).toBe(true);
      for (const a of p.addons) expect(addonSchema.safeParse(a).success).toBe(true);
      for (const f of p.fields) expect(fieldSchema.safeParse(f).success).toBe(true);
      for (const m of p.media) expect(mediaSchema.safeParse(m).success).toBe(true);
      expect(p.minQty).toBeLessThanOrEqual(p.maxQty);
    }
  });

  it("tarjetas: precio por tramo y solo en packs", () => {
    const p = bySlug("tarjetas-metalicas");
    const fields = { nombre: "Joan" };
    expect(priceLine(p, { slug: p.slug, variant: "aluminio-negro", qty: 25, fields }).totalCents).toBe(8000);
    expect(priceLine(p, { slug: p.slug, variant: "aluminio-negro", qty: 100, fields }).totalCents).toBe(17000);
    expect(priceLine(p, { slug: p.slug, variant: "aluminio-negro", qty: 250, fields }).totalCents).toBe(31250);
    expect(() => priceLine(p, { slug: p.slug, variant: "aluminio-negro", qty: 30, fields })).toThrow(ShopValidationError);
    const conExtras = priceLine(p, { slug: p.slug, variant: "aluminio-negro", qty: 50, addons: ["diseno-a-medida", "tarjeta-digital"], fields });
    expect(conExtras.totalCents).toBe(12000 + 3900 + 1500);
  });

  it("placas: descuento desde 3 y NFC por unidad", () => {
    const p = bySlug("placa-qr-madera");
    const fields = { uso: "Reseñas de Google", enlace: "https://g.page/r/abc/review" };
    expect(priceLine(p, { slug: p.slug, variant: "115x115", qty: 1, fields }).totalCents).toBe(2990);
    const tres = priceLine(p, { slug: p.slug, variant: "115x115", qty: 3, addons: ["nfc"], fields });
    expect(tres.unitCents).toBe(2542);
    expect(tres.totalCents).toBe(2542 * 3 + 500 * 3);
  });

  it("valida la personalización", () => {
    const p = bySlug("placa-qr-madera");
    expect(() => priceLine(p, { slug: p.slug, variant: "90x110", qty: 1, fields: { uso: "Reseñas de Google" } })).toThrow(/Enlace/);
    expect(() => priceLine(p, { slug: p.slug, variant: "90x110", qty: 1, fields: { uso: "Inventado", enlace: "https://x.es/a" } })).toThrow(/opción/);
    expect(() => priceLine(p, { slug: p.slug, variant: "90x110", qty: 1, fields: { uso: "Wifi", enlace: "javascript:alert(1)" } })).toThrow(/https/);
    const foto = bySlug("tarjeta-foto-aluminio");
    expect(() => priceLine(foto, { slug: foto.slug, variant: "tarjeta", qty: 1, fields: {} })).toThrow(/foto/);
    expect(priceLine(foto, { slug: foto.slug, variant: "tarjeta", qty: 3, fields: { foto: [UP] } }).totalCents).toBe(3489);
  });

  it("no vende lo que es por presupuesto ni lo oculto", () => {
    const app = bySlug("app-nativa");
    expect(() => priceLine(app, { slug: app.slug, variant: "app", qty: 1 })).toThrow(/presupuesto/);
    const oculto = { ...bySlug("expositor-tarjetas"), visible: false };
    expect(() => priceLine(oculto, { slug: oculto.slug, variant: "vertical", qty: 1 })).toThrow(/no está a la venta/);
  });

  it("envío: solo con producto físico y gratis desde 60 €", () => {
    const placa = priceLine(bySlug("placa-qr-madera"), { slug: "placa-qr-madera", variant: "90x110", qty: 1, fields: { uso: "Wifi", enlace: "https://x.es/w" } });
    const web = priceLine(bySlug("regalo-web-3d"), { slug: "regalo-web-3d", variant: "fotos-mensaje", qty: 1, fields: { para: "Ana", mensaje: "Feliz día", fotos: [UP] } });
    expect(shippingFor([placa])).toBe(490);
    expect(shippingFor([web])).toBe(0);
    const tarjetas = priceLine(bySlug("tarjetas-metalicas"), { slug: "tarjetas-metalicas", variant: "aluminio-negro", qty: 25, fields: { nombre: "A" } });
    expect(shippingFor([tarjetas])).toBe(0);
  });

  it("tramo mayor que no supera la cantidad", () => {
    expect(unitPriceFor({ key: "x", name: "x", tiers: [{ min: 10, unitCents: 5 }, { min: 1, unitCents: 9 }] }, 9)).toBe(9);
    expect(unitPriceFor({ key: "x", name: "x", tiers: [{ min: 10, unitCents: 5 }, { min: 1, unitCents: 9 }] }, 10)).toBe(5);
  });
});
