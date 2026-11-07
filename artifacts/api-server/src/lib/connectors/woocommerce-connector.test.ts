import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../crypto.js", () => ({ safeDecrypt: (s: string) => s }));
vi.mock("../logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const { WooCommerceConnector, wooOrderToSalesShape, mapToWooPayload, mapWooProduct } = await import("./woocommerce");
const { WooError } = await import("../woo-client.js");

const project = { id: 7, shopDomain: "https://shop.example", clientId: "ck_x", clientSecret: "cs_y" } as any;

/** Respuesta de la API: datos + cabeceras de paginación opcionales. */
const json = (data: unknown, init: { status?: number; total?: number; pages?: number } = {}) =>
  new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...(init.total !== undefined ? { "x-wp-total": String(init.total) } : {}),
      ...(init.pages !== undefined ? { "x-wp-totalpages": String(init.pages) } : {}),
    },
  });

/** Transporte simulado por ruta (sin tocar ninguna tienda real). */
function router(routes: Array<[RegExp, (url: string, init?: RequestInit) => Response]>) {
  return vi.fn(async (input: any, init?: RequestInit) => {
    const url = String(input);
    for (const [re, fn] of routes) if (re.test(url)) return fn(url, init);
    throw new Error(`ruta no simulada: ${url}`);
  });
}

beforeEach(() => { WooCommerceConnector.retryDelays = [0, 0, 0]; });

describe("lectura de productos", () => {
  it("lee las variaciones de los variables: precio y stock reales, no el Default del padre", async () => {
    const t = router([
      [/\/wc\/v3\/products\?per_page=20/, () => json([
        { id: 1, name: "Prework", slug: "prework", type: "variable", status: "publish", description: "", price: "36.99", regular_price: "", sale_price: "", manage_stock: false, stock_quantity: null },
        { id: 2, name: "Gainer", slug: "gainer", type: "simple", status: "publish", description: "", price: "", regular_price: "", sale_price: "", manage_stock: false, stock_quantity: null, stock_status: "outofstock" },
      ])],
      [/\/products\/1\/variations/, () => json([
        { id: 11, price: "36.99", regular_price: "36.99", sale_price: "", manage_stock: true, stock_quantity: 4, attributes: [{ id: 0, name: "Sabor", option: "Acid Cherry" }] },
        { id: 12, price: "30", regular_price: "36.99", sale_price: "30", manage_stock: "parent", stock_quantity: null, attributes: [{ id: 0, name: "Sabor", option: "Orange Mango" }] },
      ], { total: 2, pages: 1 })],
    ]);
    const products = await new WooCommerceConnector(project, t as any).getProducts({ limit: 20 });
    expect(products[0]!.variants).toHaveLength(2);
    expect(products[0]!.variants[0]).toMatchObject({ platformId: "11", title: "Acid Cherry", price: "36.99", inventoryQuantity: 4 });
    expect(products[0]!.variants[1]).toMatchObject({ price: "30", compareAtPrice: "36.99", inventoryQuantity: undefined });
    // Sin precio y sin gestión de stock: ni "0 €" ni "0 unidades".
    expect(products[1]!.price).toBeNull();
    expect(products[1]!.variants[0]).toMatchObject({ price: "", inventoryQuantity: undefined });
  });

  it("una rebaja programada (sale_price con price = regular) no tacha el precio", () => {
    const p = mapWooProduct({ id: 3, name: "x", slug: "x", type: "simple", status: "publish", description: "", price: "50", regular_price: "50", sale_price: "40" });
    expect(p).toMatchObject({ price: "50", compareAtPrice: null });
  });

  it("conserva el ID de Medios de las imágenes para reenviarlas sin duplicar", () => {
    const p = mapWooProduct({ id: 3, name: "x", slug: "x", type: "simple", status: "publish", description: "", images: [{ id: 99, src: "https://shop.example/a.jpg" }] });
    expect(mapToWooPayload({ images: p.images })).toEqual({ images: [{ id: 99, alt: "" }] });
    expect(mapToWooPayload({ images: [{ src: "https://cdn.example/new.jpg" }] })).toEqual({ images: [{ src: "https://cdn.example/new.jpg", alt: "" }] });
  });
});

describe("errores y reintentos", () => {
  it("errores 401/403/404 legibles con el código de WordPress y sin el cuerpo", async () => {
    const t = router([[/\/wc\/v3\//, () => json({ code: "woocommerce_rest_cannot_view", message: "cliente@example.com", data: { status: 401 } }, { status: 401 })]]);
    const r = await new WooCommerceConnector(project, t as any).testConnection();
    expect(r).toMatchObject({ connected: false, errorCode: "AUTH_FAILED" });
    expect(r.error).toContain("woocommerce_rest_cannot_view");
    expect(r.error).not.toContain("cliente@example.com");

    const t404 = router([[/\/wc\/v3\//, () => json({ code: "rest_no_route" }, { status: 404 })]]);
    expect(await new WooCommerceConnector(project, t404 as any).testConnection()).toMatchObject({ errorCode: "STORE_NOT_FOUND" });
  });

  it("tienda inalcanzable → URL_UNREACHABLE (antes se daba como 'no respondió a tiempo')", async () => {
    const t = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const r = await new WooCommerceConnector(project, t as any).testConnection();
    expect(r).toMatchObject({ connected: false, errorCode: "URL_UNREACHABLE" });
  });

  it("reintenta lecturas ante 503/429 y nunca repite una escritura", async () => {
    let n = 0;
    const t = router([[/\/products\/5$/, (_u, init) => {
      if (init?.method === "GET") return ++n < 3 ? json({}, { status: n === 1 ? 503 : 429 }) : json({ id: 5, name: "ok", slug: "ok", type: "simple", status: "publish", description: "" });
      return json({}, { status: 500 });
    }]]);
    const c = new WooCommerceConnector(project, t as any);
    expect((await c.getProduct("5")).title).toBe("ok");
    expect(n).toBe(3);
    const writes = t.mock.calls.length;
    await expect(c.request("PUT", "/products/5", { name: "y" })).rejects.toThrow(WooError);
    expect(t.mock.calls.length).toBe(writes + 1);
  });

  it("conexión correcta: total por X-WP-Total, nombre público y versión opcional", async () => {
    const t = router([
      [/\/wc\/v3\/products\?per_page=1/, () => json([{}], { total: 139, pages: 139 })],
      [/\/system_status/, () => json({ code: "woocommerce_rest_cannot_view" }, { status: 403 })],
      [/\/wp-json\/\?_fields=name/, () => json({ name: "Muscle Factory BCN" })],
    ]);
    expect(await new WooCommerceConnector(project, t as any).testConnection()).toMatchObject({
      connected: true, productCount: 139, storeName: "Muscle Factory BCN", platformInfo: "WooCommerce (API REST v3)",
    });
  });

  it("DELETE con 500 pero el producto ya no existe → se da por borrado tras comprobarlo", async () => {
    const t = router([[/\/products\/9/, (_u, init) => init?.method === "DELETE" ? json({}, { status: 500 }) : json({ code: "woocommerce_rest_product_invalid_id" }, { status: 404 })]]);
    await expect(new WooCommerceConnector(project, t as any).deleteProduct("9")).resolves.toBeUndefined();
    const t2 = router([[/\/products\/9/, (_u, init) => init?.method === "DELETE" ? json({}, { status: 500 }) : json({ id: 9 })]]);
    await expect(new WooCommerceConnector(project, t2 as any).deleteProduct("9")).rejects.toThrow("500");
  });
});

describe("escrituras con la semántica de WooCommerce", () => {
  it("no cambia el precio del padre de un variable (se hace por variación)", async () => {
    const t = router([[/\/products\/1$/, () => json({ id: 1, type: "variable" })]]);
    await expect(new WooCommerceConnector(project, t as any).updateProduct("1", { price: "10" })).rejects.toThrow("variación");
    expect(t.mock.calls.every(c => (c[1] as RequestInit).method === "GET")).toBe(true);
  });

  it("stock de un variable sin variantId → error claro; con variantId va a la variación", async () => {
    const t = router([
      [/\/products\/1$/, () => json({ id: 1, type: "variable", manage_stock: false })],
      [/\/products\/1\/variations\/11$/, () => json({ id: 11 })],
    ]);
    const c = new WooCommerceConnector(project, t as any);
    await expect(c.updateInventory("1", 5)).rejects.toThrow("variantId");
    await c.updateInventory("1", 5, "11");
    const put = t.mock.calls.find(call => (call[1] as RequestInit).method === "PUT")!;
    expect(String(put[0])).toContain("/products/1/variations/11");
    expect(JSON.parse(String((put[1] as RequestInit).body))).toEqual({ manage_stock: true, stock_quantity: 5 });
  });

  it("crear con variantes sin cantidad no crea variaciones agotadas", async () => {
    const bodies: any[] = [];
    const t = router([
      [/\/products\/50\/variations$/, (_u, init) => { if (init?.method === "POST") bodies.push(JSON.parse(String(init.body))); return json({ id: 1 }, { total: 0, pages: 0 }); }],
      [/\/products\/50\/variations\?/, () => json([], { total: 0, pages: 0 })],
      [/\/products\/50$/, () => json({ id: 50, name: "T", slug: "t", type: "variable", status: "draft", description: "" })],
      [/\/products$/, (_u, init) => { bodies.push(JSON.parse(String(init!.body))); return json({ id: 50, type: "variable", attributes: [{ id: 0, name: "Opción 1" }] }); }],
    ]);
    await new WooCommerceConnector(project, t as any).createProduct({
      title: "T", price: "10",
      variants: [{ platformId: "", title: "S", price: "10", option1: "S" }, { platformId: "", title: "M", price: "12", option1: "M" }],
    });
    expect(bodies[0]).not.toHaveProperty("regular_price");
    expect(bodies[1]).toMatchObject({ regular_price: "10", attributes: [{ option: "S" }] });
    expect(bodies[1]).not.toHaveProperty("manage_stock");
  });
});

describe("SEO (Yoast / Rank Math)", () => {
  it("lee los metadatos de Yoast desde wc/v3 y, si no hay, yoast_head_json público SIN credenciales", async () => {
    const withMeta = router([[/\/products\/4$/, () => json({ id: 4, slug: "p", meta_data: [{ key: "_yoast_wpseo_title", value: "T" }, { key: "_yoast_wpseo_metadesc", value: "D" }] })]]);
    expect(await new WooCommerceConnector(project, withMeta as any).getSeoData("4")).toMatchObject({ metaTitle: "T", metaDescription: "D" });

    const t = router([
      [/\/wc\/v3\/products\/4$/, () => json({ id: 4, slug: "p", meta_data: [] })],
      [/\/wp\/v2\/product\/4/, () => json({ yoast_head_json: { title: "Gainer - MF", og_description: "OG" } })],
    ]);
    expect(await new WooCommerceConnector(project, t as any).getSeoData("4")).toMatchObject({ metaTitle: "Gainer - MF", metaDescription: "OG" });
    const pub = t.mock.calls.find(c => String(c[0]).includes("/wp/v2/"))!;
    expect(JSON.stringify((pub[1] as RequestInit).headers)).not.toContain("Authorization");
  });

  it("escribe en meta_data del plugin detectado y verifica la lectura posterior", async () => {
    let stored: any[] = [];
    const t = router([
      [/\/wp-json\/\?_fields=namespaces/, () => json({ namespaces: ["wp/v2", "wc/v3", "rankmath/v1"] })],
      [/\/products\/4$/, (_u, init) => {
        if (init?.method === "PUT") stored = JSON.parse(String(init.body)).meta_data;
        return json({ id: 4, slug: "p", meta_data: stored });
      }],
    ]);
    const r = await new WooCommerceConnector(project, t as any).updateSeo("4", { metaTitle: "Nuevo", metaDescription: "Desc" });
    expect(stored).toEqual([{ key: "rank_math_title", value: "Nuevo" }, { key: "rank_math_description", value: "Desc" }]);
    expect(r).toMatchObject({ metaTitle: "Nuevo", metaDescription: "Desc" });
  });

  it("sin plugin SEO no finge que guardó nada", async () => {
    const t = router([[/\/wp-json\/\?_fields=namespaces/, () => json({ namespaces: ["wp/v2", "wc/v3"] })]]);
    await expect(new WooCommerceConnector(project, t as any).updateSeo("4", { metaTitle: "x" })).rejects.toThrow("Yoast");
  });
});

describe("pedidos", () => {
  it("getOrders filtra fechas en UTC con dates_are_gmt", async () => {
    const t = router([[/\/orders\?/, () => json([{ id: 1, number: "1", status: "completed", total: "10.00", currency: "EUR", date_created_gmt: "2026-11-01T10:00:00", line_items: [] }])]]);
    const [o] = await new WooCommerceConnector(project, t as any).getOrders({ after: "2026-11-01T00:00:00.000Z", before: "2026-11-07T00:00:00.000Z" });
    const url = new URL(String(t.mock.calls[0]![0]));
    expect(url.searchParams.get("after")).toBe("2026-11-01T00:00:00");
    expect(url.searchParams.get("dates_are_gmt")).toBe("true");
    expect(o!.createdAt).toBe("2026-11-01T10:00:00Z");
  });

  it("getAllOrders recorre todas las páginas (antes solo los 100 más recientes)", async () => {
    const page = (n: number, size: number) => Array.from({ length: size }, (_, i) => ({ id: n * 1000 + i }));
    const t = router([[/\/orders\?/, (url) => {
      const p = Number(new URL(url).searchParams.get("page"));
      return json(p === 1 ? page(1, 100) : page(2, 30), { total: 130, pages: 2 });
    }]]);
    const all = await new WooCommerceConnector(project, t as any).getAllOrders();
    expect(all).toHaveLength(130);
    expect(new URL(String(t.mock.calls[0]![0])).searchParams.get("orderby")).toBe("id");
  });

  it("línea de pedido: precio antes de descuento, descuento aparte, variación y SKU", () => {
    const s = wooOrderToSalesShape({
      id: 5, number: "5", status: "completed", currency: "EUR", date_created_gmt: "2026-11-02T08:00:00",
      customer_id: 3, billing: { email: "a@b.c", first_name: "A", last_name: "B" }, shipping: { country: "ES", city: "Barcelona" },
      line_items: [{ id: 70, name: "Prework - Acid Cherry", product_id: 1, variation_id: 11, quantity: 2, sku: "PW-AC", price: 15, subtotal: "36.00", total: "30.00",
        meta_data: [{ key: "pa_sabor", value: "acid-cherry", display_key: "Sabor", display_value: "Acid Cherry" }, { key: "_reduced_stock", value: "2" }] }],
    });
    expect(s.line_items[0]).toMatchObject({ variant_id: 11, sku: "PW-AC", price: "18.00", total_discount: "6.00", variant_title: "Acid Cherry" });
    expect(s).toMatchObject({ created_at: "2026-11-02T08:00:00Z", shipping_address: { country: "ES", city: "Barcelona" }, customer: { id: 3 } });
  });
});
