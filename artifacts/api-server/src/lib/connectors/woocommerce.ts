/**
 * Conector WooCommerce (API REST wc/v3) para la capa multi-plataforma.
 *
 * Referencia: https://woocommerce.github.io/woocommerce-rest-api-docs/
 *  - Listados paginados con `per_page` (máx. 100) y cabeceras X-WP-Total / X-WP-TotalPages.
 *  - Precios como TEXTO: `price` (activo), `regular_price`, `sale_price`; pueden venir vacíos.
 *  - Stock: `manage_stock` (en variaciones también "parent"), `stock_quantity` (null si no se
 *    gestiona) y `stock_status` (instock | outofstock | onbackorder).
 *  - Los productos variables guardan precio y stock en `/products/{id}/variations`.
 *  - WooCommerce no tiene campos SEO propios: los guardan Yoast o Rank Math como metadatos del
 *    producto, que la propia API wc/v3 lee y escribe en `meta_data`.
 *
 * Todo el tráfico autenticado pasa por WooClient (un único origen HTTPS, sin redirecciones y
 * sin volcar cuerpos de la tienda en los errores).
 */
import type { Project } from "@workspace/db";
import { logger } from "../logger";
import { WooClient, WooError } from "../woo-client.js";
import type {
  IPlatformConnector,
  ConnectionTestResult,
  PlatformProduct,
  PlatformOrder,
  SeoData,
  InventoryData,
  PagedResult,
  PlatformFeature,
} from "./types";

const WC_MIN_REQUEST_INTERVAL = 200;
const PUBLIC_TIMEOUT = 15_000;
const VARIATION_CONCURRENCY = 4;
let wcLastRequestTime = 0;

type SeoPlugin = "yoast" | "rankmath";
const SEO_META_KEYS: Record<SeoPlugin, { title: string; description: string; keyword: string }> = {
  yoast: { title: "_yoast_wpseo_title", description: "_yoast_wpseo_metadesc", keyword: "_yoast_wpseo_focuskw" },
  rankmath: { title: "rank_math_title", description: "rank_math_description", keyword: "rank_math_focus_keyword" },
};

const STATUS_TO_WOO: Record<string, string> = { active: "publish", draft: "draft", archived: "private" };

/** Fecha para los filtros `after`/`before` de WooCommerce, interpretados en UTC con `dates_are_gmt=true`. */
function wooGmtDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new WooError(`Fecha no válida: ${value}`, 400);
  return d.toISOString().slice(0, 19);
}

function retryable(err: unknown): boolean {
  if (!(err instanceof WooError)) return false;
  const s = err.upstreamStatus;
  if (s === undefined) return err.status === 504 || err.status === 502; // la tienda no respondió
  return s === 429 || (s >= 500 && s !== 501);
}

export class WooCommerceConnector implements IPlatformConnector {
  /** Esperas entre reintentos de lectura (429/5xx/sin respuesta). Los tests las ponen a 0. */
  static retryDelays = [1000, 2000, 4000];

  readonly platformType = "woocommerce" as const;
  readonly projectId: number;
  readonly storeDomain: string;
  private readonly wc: WooClient;
  private readonly transport: typeof fetch;
  private seoPlugin: SeoPlugin | null | undefined;

  constructor(project: Project, transport: typeof fetch = fetch) {
    this.projectId = project.id;
    this.storeDomain = project.shopDomain;
    this.transport = transport;
    // Valida HTTPS, origen y credenciales al construir: un fallo aquí debe llegar al usuario tal cual.
    this.wc = new WooClient(project, transport);
  }

  supportsFeature(feature: PlatformFeature): boolean {
    const supported: PlatformFeature[] = [
      "products", "product_create", "product_update", "product_delete",
      "variants", "images", "image_upload_url",
      "seo_read", "seo_write",
      "orders", "inventory", "customers",
      "audit",
    ];
    return supported.includes(feature);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      // Lo mínimo que necesita la plataforma: leer productos. Total = X-WP-Total (todos los estados salvo papelera).
      const productCount = await this.getProductCount();

      let wcVersion = "";
      try {
        const status = await this.wcRequest<WCSystemStatus>("GET", "/system_status");
        wcVersion = status.environment?.version ?? "";
      } catch { /* /system_status exige permisos de administrador: es opcional */ }

      const site = await this.publicJson<{ name?: string }>("/wp-json/?_fields=name");

      return {
        connected: true,
        storeName: site?.name ? String(site.name) : this.storeDomain,
        platformInfo: wcVersion ? `WooCommerce ${wcVersion}` : "WooCommerce (API REST v3)",
        productCount,
        tokenValid: true,
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      const upstream = err instanceof WooError ? err.upstreamStatus : undefined;
      let errorCode = "UNKNOWN";
      if (upstream === 401) errorCode = "AUTH_FAILED";
      else if (upstream === 403) errorCode = "PERMISSIONS_INSUFFICIENT";
      else if (upstream === 404) errorCode = "STORE_NOT_FOUND";
      else if (err instanceof WooError && upstream === undefined && (err.status === 502 || err.status === 504)) errorCode = "URL_UNREACHABLE";

      return {
        connected: false,
        storeName: null,
        platformInfo: null,
        productCount: null,
        tokenValid: false,
        error: message,
        errorCode,
      };
    }
  }

  async refreshAuth(): Promise<string | null> {
    try {
      await this.wcRequest("GET", "/products?per_page=1");
      logger.info({ projectId: this.projectId }, "WooCommerce credentials validated via /products");
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ projectId: this.projectId, error: msg }, "WooCommerce credential validation failed");
      throw new Error(`WooCommerce credential validation failed: ${msg}`);
    }
  }

  async request<T = unknown>(method: string, path: string, body?: unknown, _options?: RequestInit): Promise<T> {
    return this.wcRequest<T>(method, path, body);
  }

  async requestPaged<T = unknown>(path: string, params?: Record<string, string>): Promise<PagedResult<T>> {
    let fullPath = path;
    if (params && Object.keys(params).length > 0) {
      const sep = path.includes("?") ? "&" : "?";
      fullPath = `${path}${sep}${new URLSearchParams(params).toString()}`;
    }

    const resp = await this.withRetry("GET", fullPath, () => this.wcRawRequest("GET", fullPath));
    const totalHeader = resp.headers.get("X-WP-Total");
    const pagesHeader = resp.headers.get("X-WP-TotalPages");
    const total = totalHeader === null ? null : Number(totalHeader);
    const totalPages = pagesHeader === null ? null : Number(pagesHeader);
    const currentPage = Number(new URLSearchParams(fullPath.split("?")[1] ?? "").get("page") ?? "1");
    const data = await resp.json() as T[];
    // Sin cabeceras de paginación no se puede afirmar que no hay más páginas.
    const hasMore = totalPages === null || !Number.isSafeInteger(totalPages) ? data.length > 0 : currentPage < totalPages;

    return {
      data,
      total: total !== null && Number.isSafeInteger(total) ? total : null,
      hasMore,
      nextCursor: hasMore ? String(currentPage + 1) : undefined,
    };
  }

  async getProducts(params?: { status?: string; page?: number; limit?: number }): Promise<PlatformProduct[]> {
    const perPage = Math.max(1, Math.min(params?.limit ?? 100, 100));
    const page = params?.page ?? 1;
    const wcStatus = params?.status ? (STATUS_TO_WOO[params.status] ?? params.status) : "any";

    let path = `/products?per_page=${perPage}&page=${page}`;
    if (wcStatus !== "any") path += `&status=${encodeURIComponent(wcStatus)}`;

    const products = await this.wcRequest<WCProduct[]>("GET", path);
    await this.attachVariations(products);
    return products.map(mapWooProduct);
  }

  async getProduct(platformProductId: string): Promise<PlatformProduct> {
    const product = await this.wcRequest<WCProduct>("GET", `/products/${productId(platformProductId)}`);
    await this.attachVariations([product]);
    return mapWooProduct(product);
  }

  async createProduct(data: Partial<PlatformProduct>): Promise<PlatformProduct> {
    const variants = data.variants ?? [];
    // Una sola variante = producto simple: su precio, SKU y stock son los del producto.
    const single = variants.length === 1 ? variants[0]! : null;
    const payload = mapToWooPayload(single && data.price === undefined
      ? { ...data, price: single.price, compareAtPrice: single.compareAtPrice ?? null }
      : data);
    if (single?.sku) payload.sku = single.sku;
    if (single && typeof single.inventoryQuantity === "number") {
      payload.manage_stock = true;
      payload.stock_quantity = single.inventoryQuantity;
    }

    if (variants.length > 1) {
      payload.type = "variable";
      // El padre de un variable no tiene precio propio: WooCommerce lo calcula de sus variaciones.
      delete payload.regular_price;
      delete payload.sale_price;

      const attrNames = new Map<string, Set<string>>();
      for (const v of variants) {
        ([v.option1, v.option2, v.option3] as Array<string | undefined>).forEach((opt, i) => {
          if (!opt) return;
          const name = `Opción ${i + 1}`;
          if (!attrNames.has(name)) attrNames.set(name, new Set());
          attrNames.get(name)!.add(opt);
        });
      }

      if (attrNames.size > 0) {
        payload.attributes = Array.from(attrNames.entries()).map(([name, values], i) => ({
          name,
          position: i,
          visible: true,
          variation: true,
          options: Array.from(values),
        }));
      }
    }

    const created = await this.wcRequest<WCProduct>("POST", "/products", payload);

    if (variants.length > 1 && created.type === "variable") {
      const createdAttrs = created.attributes ?? [];

      for (const variant of variants) {
        const varPayload: Record<string, unknown> = {
          ...internalPricesToWoo(variant.price, variant.compareAtPrice),
        };
        if (variant.sku) varPayload.sku = variant.sku;

        const varAttrs: Array<{ id: number; name: string; option: string }> = [];
        ([variant.option1, variant.option2, variant.option3] as Array<string | undefined>).forEach((opt, i) => {
          const attr = createdAttrs[i];
          if (opt && attr) varAttrs.push({ id: attr.id, name: attr.name, option: opt });
        });
        if (varAttrs.length > 0) varPayload.attributes = varAttrs;

        // Solo se gestiona stock si se indicó una cantidad: un 0 por defecto dejaría la variación agotada.
        if (typeof variant.inventoryQuantity === "number") {
          varPayload.manage_stock = true;
          varPayload.stock_quantity = variant.inventoryQuantity;
        }

        await this.wcRequest("POST", `/products/${created.id}/variations`, varPayload);
      }
    }

    return this.getProduct(String(created.id));
  }

  async updateProduct(platformProductId: string, data: Partial<PlatformProduct>): Promise<PlatformProduct> {
    const id = productId(platformProductId);
    if (data.price !== undefined || data.compareAtPrice !== undefined) {
      const current = await this.wcRequest<WCProduct>("GET", `/products/${id}`);
      if (current.type === "variable") {
        throw new WooError("Es un producto variable: en WooCommerce el precio se cambia en cada variación, no en el producto padre.", 400);
      }
      if (data.price === undefined) {
        // Solo cambia el precio tachado: se conserva el precio que paga hoy el cliente.
        data = { ...data, price: wooPricesToInternal(current).price };
      }
    }
    const payload = mapToWooPayload(data);
    await this.wcRequest<WCProduct>("PUT", `/products/${id}`, payload);
    return this.getProduct(String(id));
  }

  /**
   * Precio, SKU y stock de variaciones concretas de un producto variable (en WooCommerce el
   * precio de un variable vive en cada variación). Solo se envían los campos indicados.
   */
  async updateVariations(platformProductId: string, variants: Array<{ id: string | number; price?: string | null; compareAtPrice?: string | null; sku?: string; inventoryQuantity?: number }>): Promise<number> {
    const id = productId(platformProductId);
    let updated = 0;
    for (const v of variants) {
      const payload: Record<string, unknown> = {};
      if (v.price !== undefined) Object.assign(payload, internalPricesToWoo(v.price, v.compareAtPrice));
      if (v.sku !== undefined) payload.sku = v.sku;
      if (typeof v.inventoryQuantity === "number") { payload.manage_stock = true; payload.stock_quantity = v.inventoryQuantity; }
      if (!Object.keys(payload).length) continue;
      await this.wcRequest("PUT", `/products/${id}/variations/${productId(v.id)}`, payload);
      updated++;
    }
    return updated;
  }

  async deleteProduct(platformProductId: string): Promise<void> {
    const id = productId(platformProductId);
    try {
      await this.wcRequest("DELETE", `/products/${id}?force=true`);
    } catch (err) {
      // Visto en la tienda real: DELETE responde 500 y el producto ya no existe. Se comprueba antes de decidir.
      try {
        await this.wcRequest("GET", `/products/${id}`);
      } catch (check) {
        if (check instanceof WooError && check.upstreamStatus === 404) return;
      }
      throw err;
    }
  }

  async uploadImage(platformProductId: string, imageSource: string, alt?: string): Promise<{ src: string; id?: string }> {
    const id = productId(platformProductId);
    const product = await this.wcRequest<WCProduct>("GET", `/products/${id}`);
    // Las imágenes existentes se mandan por ID: con `src` WooCommerce las volvería a descargar y duplicar.
    const existing = (product.images ?? []).filter(img => img.id).map(img => ({ id: img.id }));
    await this.wcRequest<WCProduct>("PUT", `/products/${id}`, { images: [...existing, { src: imageSource, alt: alt ?? "" }] });
    const updated = await this.wcRequest<WCProduct>("GET", `/products/${id}`);
    const lastImage = updated.images?.[updated.images.length - 1];
    if (!lastImage?.id || !lastImage.src) throw new Error("WooCommerce no confirmó una imagen persistente");
    return { src: lastImage.src, id: String(lastImage.id) };
  }

  async getOrders(params?: { page?: number; limit?: number; after?: string; before?: string }): Promise<PlatformOrder[]> {
    const query = this.orderQuery(params);
    query.per_page = String(Math.max(1, Math.min(params?.limit ?? 100, 100)));
    query.page = String(params?.page ?? 1);
    const orders = await this.wcRequest<WCOrder[]>("GET", `/orders?${new URLSearchParams(query)}`);
    return orders.map(mapWooOrder);
  }

  /** Todos los pedidos de una ventana UTC (lo usa lib/orders.ts para las cifras). */
  async listAllOrders(params: { after?: string; before?: string }): Promise<PlatformOrder[]> {
    return (await this.wc.all<WCOrder>("/orders", this.orderQuery(params), 500)).map(mapWooOrder);
  }

  /**
   * Todos los pedidos en bruto, del más antiguo al más nuevo (orden por ID: un pedido nuevo
   * durante la lectura cae al final y no desplaza páginas). Para la sincronización de ventas.
   */
  async getAllOrders(maxPages = 500): Promise<WCOrder[]> {
    const out: WCOrder[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const path = `/orders?per_page=100&page=${page}&orderby=id&order=asc`;
      const resp = await this.withRetry("GET", path, () => this.wcRawRequest("GET", path));
      const batch = await resp.json() as WCOrder[];
      if (!Array.isArray(batch)) throw new WooError("Respuesta de pedidos no válida");
      out.push(...batch);
      const totalPages = Number(resp.headers.get("X-WP-TotalPages"));
      if (batch.length < 100 || (resp.headers.has("X-WP-TotalPages") && Number.isSafeInteger(totalPages) && page >= totalPages)) return out;
    }
    throw new WooError(`Lectura de pedidos incompleta: más de ${maxPages * 100} pedidos`);
  }

  async getProductCount(params?: { status?: string }): Promise<number> {
    const wcStatus = params?.status ? (STATUS_TO_WOO[params.status] ?? params.status) : undefined;
    let path = "/products?per_page=1";
    if (wcStatus) path += `&status=${encodeURIComponent(wcStatus)}`;

    const resp = await this.withRetry("GET", path, () => this.wcRawRequest("GET", path));
    const total = resp.headers.get("X-WP-Total");
    if (total === null || !Number.isSafeInteger(Number(total))) throw new Error("WooCommerce no confirmó el total de productos");
    return Number(total);
  }

  /**
   * SEO del producto. WooCommerce no tiene campos SEO: se leen los metadatos de Yoast o Rank
   * Math desde wc/v3 (`meta_data`) y, si no hay valores propios, lo que Yoast publica en
   * `yoast_head_json` de la ruta pública wp/v2 (SIN credenciales: las claves ck_/cs_ solo
   * valen para wc/*; mandarlas a wp/v2 da 401).
   */
  async getSeoData(platformProductId: string): Promise<SeoData | null> {
    const id = productId(platformProductId);
    const product = await this.wcRequest<WCProduct>("GET", `/products/${id}`);
    const meta = new Map((product.meta_data ?? []).map(m => [m.key, m.value]));
    const str = (k: string) => (typeof meta.get(k) === "string" ? String(meta.get(k)) : "");

    for (const plugin of ["yoast", "rankmath"] as const) {
      const keys = SEO_META_KEYS[plugin];
      if (str(keys.title) || str(keys.description) || str(keys.keyword)) {
        return {
          metaTitle: str(keys.title),
          metaDescription: str(keys.description),
          focusKeyword: str(keys.keyword) || undefined,
          handle: product.slug,
        };
      }
    }

    const pub = await this.publicJson<{ yoast_head_json?: { title?: string; description?: string; og_description?: string } }>(
      `/wp-json/wp/v2/product/${id}?_fields=yoast_head_json`);
    const yoast = pub?.yoast_head_json;
    if (yoast) {
      return {
        metaTitle: yoast.title ?? "",
        metaDescription: yoast.description ?? yoast.og_description ?? "",
        handle: product.slug,
      };
    }
    return null;
  }

  async updateSeo(platformProductId: string, data: Partial<SeoData>): Promise<SeoData> {
    const id = productId(platformProductId);
    const plugin = await this.detectSeoPlugin();
    if (!plugin) {
      throw new WooError(
        "No se detecta Yoast SEO ni Rank Math en la tienda: WooCommerce no guarda título ni meta descripción SEO por sí mismo. Instala uno de los dos plugins.",
        422,
      );
    }
    const keys = SEO_META_KEYS[plugin];
    const meta: Array<{ key: string; value: string }> = [];
    if (data.metaTitle !== undefined) meta.push({ key: keys.title, value: data.metaTitle });
    if (data.metaDescription !== undefined) meta.push({ key: keys.description, value: data.metaDescription });
    if (data.focusKeyword !== undefined) meta.push({ key: keys.keyword, value: data.focusKeyword });
    const payload: Record<string, unknown> = {};
    if (meta.length) payload.meta_data = meta;
    if (data.handle) payload.slug = data.handle;
    if (!Object.keys(payload).length) throw new WooError("No hay cambios de SEO", 400);

    await this.wcRequest<WCProduct>("PUT", `/products/${id}`, payload);
    // Lectura posterior: solo se da por hecho lo que la tienda devuelve guardado.
    const after = await this.wcRequest<WCProduct>("GET", `/products/${id}`);
    const stored = new Map((after.meta_data ?? []).map(m => [m.key, m.value]));
    for (const m of meta) {
      if (stored.get(m.key) !== m.value) throw new WooError(`WooCommerce no confirmó el campo SEO ${m.key}`);
    }

    return {
      metaTitle: String(stored.get(keys.title) ?? ""),
      metaDescription: String(stored.get(keys.description) ?? ""),
      focusKeyword: typeof stored.get(keys.keyword) === "string" ? String(stored.get(keys.keyword)) : undefined,
      handle: after.slug,
    };
  }

  async getInventory(platformProductId: string): Promise<InventoryData | null> {
    const id = productId(platformProductId);
    const product = await this.wcRequest<WCProduct>("GET", `/products/${id}`);

    let variants: Array<{ variantId: string; quantity: number | null; sku?: string }> = [];
    let variationsTracked = false;
    if (product.type === "variable") {
      const variations = await this.wc.all<WCVariation>(`/products/${id}/variations`);
      variationsTracked = variations.some(v => v.manage_stock === true);
      variants = variations.map(v => ({
        variantId: String(v.id),
        quantity: v.stock_quantity ?? null,
        sku: v.sku || undefined,
      }));
    }

    return {
      productId: String(id),
      tracked: product.manage_stock === true || variationsTracked,
      quantity: product.manage_stock === true ? (product.stock_quantity ?? null) : null,
      variants: variants.length > 0 ? variants : undefined,
    };
  }

  async updateInventory(platformProductId: string, quantity: number, variantId?: string): Promise<void> {
    const id = productId(platformProductId);
    if (!Number.isSafeInteger(quantity)) throw new WooError("La cantidad de stock debe ser un número entero", 400);
    if (variantId) {
      await this.wcRequest("PUT", `/products/${id}/variations/${productId(variantId)}`, {
        manage_stock: true,
        stock_quantity: quantity,
      });
      return;
    }
    const product = await this.wcRequest<WCProduct>("GET", `/products/${id}`);
    if (product.type === "variable" && product.manage_stock !== true) {
      throw new WooError("Es un producto variable con stock por variación: indica la variación (variantId) a actualizar.", 400);
    }
    await this.wcRequest("PUT", `/products/${id}`, { manage_stock: true, stock_quantity: quantity });
  }

  async getAllProducts(): Promise<WCProduct[]> {
    return this.wc.all<WCProduct>("/products");
  }

  // ── internos ────────────────────────────────────────────────────────────

  private orderQuery(params?: { after?: string; before?: string }): Record<string, string> {
    const query: Record<string, string> = {};
    if (params?.after) query.after = wooGmtDate(params.after);
    if (params?.before) query.before = wooGmtDate(params.before);
    if (query.after || query.before) query.dates_are_gmt = "true";
    return query;
  }

  /** Variaciones de los productos variables, con concurrencia limitada. */
  private async attachVariations(products: WCProduct[]): Promise<void> {
    const variable = products.filter(p => p.type === "variable");
    for (let i = 0; i < variable.length; i += VARIATION_CONCURRENCY) {
      await Promise.all(variable.slice(i, i + VARIATION_CONCURRENCY).map(async p => {
        p._variations = await this.wc.all<WCVariation>(`/products/${p.id}/variations`);
      }));
    }
  }

  /** Plugin SEO activo según los espacios de nombres públicos de la API de WordPress. */
  private async detectSeoPlugin(): Promise<SeoPlugin | null> {
    if (this.seoPlugin !== undefined) return this.seoPlugin;
    const index = await this.publicJson<{ namespaces?: string[] }>("/wp-json/?_fields=namespaces");
    if (!Array.isArray(index?.namespaces)) return null; // no se cachea: puede ser un fallo de red puntual
    this.seoPlugin = index.namespaces.includes("yoast/v1") ? "yoast"
      : index.namespaces.includes("rankmath/v1") ? "rankmath" : null;
    return this.seoPlugin;
  }

  /** Lectura pública de WordPress, SIN credenciales. Devuelve null si no responde 2xx. */
  private async publicJson<T>(path: string): Promise<T | null> {
    try {
      const resp = await this.transport(`${this.wc.origin}${path}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(PUBLIC_TIMEOUT),
      });
      if (!resp.ok) return null;
      return await resp.json() as T;
    } catch {
      return null;
    }
  }

  private async wcRawRequest(method: string, path: string, body?: unknown): Promise<Response> {
    const elapsed = Date.now() - wcLastRequestTime;
    if (elapsed < WC_MIN_REQUEST_INTERVAL) {
      await new Promise(r => setTimeout(r, WC_MIN_REQUEST_INTERVAL - elapsed));
    }
    wcLastRequestTime = Date.now();
    return this.wc.raw(method, path, body);
  }

  /** Reintenta SOLO lecturas: una escritura incierta nunca se repite a ciegas. */
  private async withRetry<T>(method: string, path: string, fn: () => Promise<T>): Promise<T> {
    const delays = WooCommerceConnector.retryDelays;
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const canRetry = (method === "GET" || method === "OPTIONS") && attempt < delays.length && retryable(err);
        if (!canRetry) throw err;
        logger.warn({ projectId: this.projectId, path, status: (err as WooError).upstreamStatus, attempt: attempt + 1 }, "WooCommerce transient error — retrying");
        await new Promise(r => setTimeout(r, delays[attempt]));
      }
    }
  }

  private async wcRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
    const resp = await this.withRetry(method, path, () => this.wcRawRequest(method, path, body));
    try {
      return await resp.json() as T;
    } catch {
      if (method === "DELETE") return {} as T;
      throw new WooError("Respuesta WooCommerce no válida");
    }
  }
}

function productId(value: string | number): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) throw new WooError(`Identificador de WooCommerce no válido: ${value}`, 400);
  return n;
}

interface WCSystemStatus {
  environment?: { version?: string; wp_version?: string };
}

interface WCMeta { id?: number; key: string; value: unknown }

export interface WCProduct {
  id: number;
  name: string;
  slug: string;
  type: string;
  status: string;
  description: string;
  short_description?: string;
  sku?: string;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  on_sale?: boolean;
  manage_stock?: boolean;
  stock_quantity?: number | null;
  stock_status?: string;
  backorders?: string;
  categories?: Array<{ id: number; name: string; slug: string }>;
  tags?: Array<{ id: number; name: string; slug: string }>;
  images?: Array<{ id?: number; src: string; alt?: string; name?: string; position?: number }>;
  attributes?: Array<{ id: number; name: string; position: number; visible: boolean; variation: boolean; options: string[] }>;
  variations?: number[];
  meta_data?: WCMeta[];
  _variations?: WCVariation[];
}

interface WCVariation {
  id: number;
  sku?: string;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  stock_quantity?: number | null;
  /** En variaciones WooCommerce devuelve true, false o "parent" (stock del producto padre). */
  manage_stock?: boolean | "parent";
  stock_status?: string;
  attributes?: Array<{ id: number; name: string; option: string }>;
}

export interface WCOrder {
  id: number;
  number?: string;
  status?: string;
  total?: string;
  currency?: string;
  date_created?: string;
  date_created_gmt?: string;
  customer_id?: number;
  billing?: { email?: string; first_name?: string; last_name?: string };
  shipping?: { country?: string; city?: string };
  line_items?: WCLineItem[];
  refunds?: Array<{ id: number; reason?: string; total?: string }>;
}

export interface WCLineItem {
  id?: number;
  name?: string;
  product_id?: number;
  variation_id?: number;
  quantity?: number;
  sku?: string;
  /** Precio unitario (número) tras descuentos y sin impuestos. */
  price?: number | string;
  /** Importe de la línea antes de descuentos, sin impuestos. */
  subtotal?: string;
  /** Importe de la línea tras descuentos, sin impuestos. */
  total?: string;
  meta_data?: Array<{ key: string; value: unknown; display_key?: string; display_value?: unknown }>;
}

/**
 * Pedido de WooCommerce en la forma que usa la sincronización de ventas (inventory.ts),
 * que nació para Shopify: precio unitario ANTES de descuento + descuento de la línea aparte,
 * variación, SKU, cliente y envío reales. Los reembolsos de WooCommerce no traen líneas en el
 * pedido (habría que leer /orders/{id}/refunds), así que aquí no se inventan.
 */
export function wooOrderToSalesShape(o: WCOrder) {
  const cents = (v: unknown) => Math.round(Number(v ?? 0) * 100) || 0;
  return {
    id: o.id,
    name: String(o.number ?? o.id),
    created_at: wooOrderDate(o),
    customer: o.billing?.email || o.customer_id ? {
      id: o.customer_id ?? 0,
      email: o.billing?.email ?? "",
      first_name: o.billing?.first_name ?? "",
      last_name: o.billing?.last_name ?? "",
    } : undefined,
    line_items: (o.line_items ?? []).map((li) => {
      const qty = li.quantity && li.quantity > 0 ? li.quantity : 1;
      const subtotal = li.subtotal !== undefined ? cents(li.subtotal) : cents(li.price) * qty;
      const total = li.total !== undefined ? cents(li.total) : subtotal;
      const variantTitle = li.variation_id
        ? (li.meta_data ?? []).filter(m => !m.key.startsWith("_") && m.display_value !== undefined)
            .map(m => String(m.display_value).replace(/<[^>]*>/g, "").trim()).filter(Boolean).join(" / ")
        : "";
      return {
        id: li.id,
        product_id: li.product_id ?? 0,
        variant_id: li.variation_id ?? 0,
        title: li.name ?? "",
        variant_title: variantTitle || "Default",
        sku: li.sku ?? "",
        quantity: li.quantity ?? 0,
        price: (subtotal / qty / 100).toFixed(2),
        total_discount: (Math.max(0, subtotal - total) / 100).toFixed(2),
        fulfillment_status: null as string | null,
      };
    }),
    financial_status: o.status ?? "unknown",
    fulfillment_status: null as string | null,
    shipping_address: o.shipping?.country || o.shipping?.city
      ? { country: o.shipping?.country ?? "", city: o.shipping?.city ?? "" }
      : undefined,
    currency: o.currency ?? "",
  };
}

function mapWooStatusToInternal(wcStatus: string): string {
  switch (wcStatus) {
    case "publish": return "active";
    case "draft": return "draft";
    case "private": return "archived";
    case "pending": return "draft";
    default: return wcStatus;
  }
}

/** Fecha de WooCommerce en UTC: `date_created_gmt` llega sin zona y hay que marcarla como Z. */
export function wooOrderDate(o: Pick<WCOrder, "date_created" | "date_created_gmt">): string {
  if (o.date_created_gmt) return `${o.date_created_gmt.replace(/Z$/, "")}Z`;
  return o.date_created ?? "";
}

function mapWooOrder(o: WCOrder): PlatformOrder {
  return {
    platformId: String(o.id),
    orderNumber: String(o.number ?? o.id),
    status: o.status ?? "unknown",
    total: o.total ?? "0",
    currency: o.currency ?? "",
    createdAt: wooOrderDate(o),
    customerEmail: o.billing?.email || undefined,
    lineItems: (o.line_items ?? []).map((li) => ({
      title: li.name ?? "",
      quantity: li.quantity ?? 1,
      price: li.price !== undefined && li.price !== null && li.price !== "" ? String(li.price) : (li.total ?? "0"),
      productId: li.product_id ? String(li.product_id) : undefined,
    })),
  };
}

/**
 * Semántica de precios: en WooCommerce `price` es el precio activo, `regular_price`
 * el original y `sale_price` el rebajado (todos texto, pueden venir vacíos). En el modelo
 * interno (tipo Shopify) `price` es lo que paga el cliente y `compareAtPrice` el tachado.
 * Una rebaja programada trae `sale_price` pero aún no está activa: manda `price`.
 */
export function wooPricesToInternal(src: { price?: string; regular_price?: string; sale_price?: string }): { price: string | null; compareAtPrice: string | null } {
  const price = src.price || src.sale_price || src.regular_price || null;
  const regular = src.regular_price || null;
  const onSale = !!regular && !!price && Number(regular) > Number(price);
  return { price, compareAtPrice: onSale ? regular : null };
}

export function internalPricesToWoo(price: string | null | undefined, compareAt: string | null | undefined): Record<string, string> {
  if (price == null || price === "") return {};
  if (compareAt && Number(compareAt) > Number(price)) return { regular_price: String(compareAt), sale_price: String(price) };
  return { regular_price: String(price), sale_price: "" };
}

/** Stock solo cuando WooCommerce lo gestiona; si no, `stock_quantity` es null y NO significa 0. */
function managedQuantity(src: { manage_stock?: boolean | "parent"; stock_quantity?: number | null }): number | undefined {
  return src.manage_stock !== false && typeof src.stock_quantity === "number" ? src.stock_quantity : undefined;
}

export function mapWooProduct(p: WCProduct): PlatformProduct {
  const variations = p._variations ?? [];
  const tags = (p.tags ?? []).map(t => t.name).join(", ");

  let variants: PlatformProduct["variants"] = variations.map(v => {
    const prices = wooPricesToInternal(v);
    return {
      platformId: String(v.id),
      title: (v.attributes ?? []).map(a => a.option).join(" / ") || "Default",
      price: prices.price ?? "",
      compareAtPrice: prices.compareAtPrice,
      sku: v.sku ?? "",
      inventoryQuantity: managedQuantity(v),
      option1: v.attributes?.[0]?.option,
      option2: v.attributes?.[1]?.option,
      option3: v.attributes?.[2]?.option,
    };
  });

  if (variants.length === 0) {
    const prices = wooPricesToInternal(p);
    variants = [{
      platformId: String(p.id),
      title: "Default",
      price: prices.price ?? "",
      compareAtPrice: prices.compareAtPrice,
      sku: p.sku ?? "",
      inventoryQuantity: managedQuantity(p),
      option1: undefined,
      option2: undefined,
      option3: undefined,
    }];
  }

  return {
    platformId: String(p.id),
    title: p.name ?? "",
    handle: p.slug ?? "",
    bodyHtml: p.description ?? "",
    vendor: "",
    productType: p.type ?? "simple",
    status: mapWooStatusToInternal(p.status ?? "draft"),
    tags,
    ...wooPricesToInternal(p),
    // `id` = adjunto de Medios de WordPress: sirve para reenviar la imagen sin duplicarla.
    images: (p.images ?? []).map((img, i) => ({
      ...(img.id ? { id: img.id } : {}),
      src: img.src,
      alt: img.alt,
      position: img.position ?? i,
    })),
    variants,
  };
}

export function mapToWooPayload(data: Partial<PlatformProduct>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (data.title !== undefined) payload.name = data.title;
  if (data.bodyHtml !== undefined) payload.description = data.bodyHtml;
  if (data.handle !== undefined) payload.slug = data.handle;
  if (data.tags !== undefined) {
    payload.tags = data.tags.split(",").map(t => ({ name: t.trim() })).filter(t => t.name);
  }
  if (data.status !== undefined) payload.status = STATUS_TO_WOO[data.status] ?? data.status;
  if (data.price !== undefined) Object.assign(payload, internalPricesToWoo(data.price, data.compareAtPrice));
  if (data.images) {
    // Una imagen que ya está en Medios de WordPress se referencia por ID: con `src`
    // WooCommerce la descargaría otra vez y crearía un duplicado.
    payload.images = data.images.map(img => {
      const mediaId = Number((img as { id?: unknown }).id);
      return Number.isSafeInteger(mediaId) && mediaId > 0
        ? { id: mediaId, alt: img.alt ?? "" }
        : { src: img.src, alt: img.alt ?? "" };
    });
  }
  if (data.variants && data.variants.length > 1) payload.type = "variable";

  return payload;
}
