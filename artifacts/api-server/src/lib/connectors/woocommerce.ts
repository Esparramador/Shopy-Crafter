import type { Project } from "@workspace/db";
import { db, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { safeDecrypt } from "../crypto.js";
import { logger } from "../logger";
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

const WC_FETCH_TIMEOUT = 45_000;
const RETRY_DELAYS = [1000, 2000, 4000];

function normalizeWooUrl(domain: string): string {
  let url = domain.trim().replace(/\/+$/, "");
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  if (url.startsWith("http://")) {
    url = url.replace("http://", "https://");
  }
  return url;
}

export class WooCommerceConnector implements IPlatformConnector {
  readonly platformType = "woocommerce" as const;
  readonly projectId: number;
  readonly storeDomain: string;
  private readonly project: Project;
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private seoWriteSupported: boolean | null = null;

  constructor(project: Project) {
    this.project = project;
    this.projectId = project.id;
    this.storeDomain = project.shopDomain;
    this.baseUrl = `${normalizeWooUrl(project.shopDomain)}/wp-json/wc/v3`;

    const consumerKey = safeDecrypt(project.clientId) || project.clientId;
    const consumerSecret = safeDecrypt(project.clientSecret) || project.clientSecret;
    this.authHeader = `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64")}`;
  }

  supportsFeature(feature: PlatformFeature): boolean {
    const supported: PlatformFeature[] = [
      "products", "product_create", "product_update", "product_delete",
      "variants", "images", "image_upload_url",
      "seo_read", "seo_write",
      "orders", "inventory",
      "audit",
    ];
    return supported.includes(feature);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const systemStatus = await this.wcRequest<WCSystemStatus>("GET", "/system_status");

      let productCount: number | null = null;
      try {
        const totals = await this.wcRequest<WCProductTotal[]>("GET", "/reports/products/totals");
        productCount = totals.reduce((sum, t) => sum + (t.total ?? 0), 0);
      } catch {
        try {
          const resp = await this.wcRawRequest("GET", "/products?per_page=1");
          const total = resp.headers.get("X-WP-Total");
          if (total) productCount = parseInt(total, 10);
        } catch { /* ignore */ }
      }

      const env = systemStatus.environment ?? {};
      const storeName = env.site_title ?? env.home_url ?? this.storeDomain;
      const wcVersion = env.version ?? "unknown";

      return {
        connected: true,
        storeName: String(storeName),
        platformInfo: `WooCommerce ${wcVersion}`,
        productCount,
        tokenValid: true,
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      let errorCode = "UNKNOWN";
      if (message.includes("401")) errorCode = "AUTH_FAILED";
      else if (message.includes("403")) errorCode = "PERMISSIONS_INSUFFICIENT";
      else if (message.includes("404")) errorCode = "STORE_NOT_FOUND";
      else if (message.includes("ENOTFOUND") || message.includes("ECONNREFUSED")) errorCode = "URL_UNREACHABLE";

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
      await this.wcRequest<WCSystemStatus>("GET", "/system_status");
      logger.info({ projectId: this.projectId }, "WooCommerce credentials validated via /system_status");
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
      const qs = new URLSearchParams(params).toString();
      fullPath = `${path}${sep}${qs}`;
    }

    const resp = await this.wcRawRequest("GET", fullPath);
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`WooCommerce API error ${resp.status} at ${fullPath}: ${text}`);
    }

    const total = parseInt(resp.headers.get("X-WP-Total") ?? "0", 10);
    const totalPages = parseInt(resp.headers.get("X-WP-TotalPages") ?? "1", 10);
    const currentPage = parseInt(new URLSearchParams(fullPath.split("?")[1] ?? "").get("page") ?? "1", 10);
    const data = await resp.json() as T[];

    return {
      data,
      total,
      hasMore: currentPage < totalPages,
      nextCursor: currentPage < totalPages ? String(currentPage + 1) : undefined,
    };
  }

  async getProducts(params?: { status?: string; page?: number; limit?: number }): Promise<PlatformProduct[]> {
    const perPage = Math.min(params?.limit ?? 100, 100);
    const page = params?.page ?? 1;
    const statusMap: Record<string, string> = {
      active: "publish",
      draft: "draft",
      archived: "private",
    };
    const wcStatus = params?.status ? (statusMap[params.status] ?? params.status) : "any";

    let path = `/products?per_page=${perPage}&page=${page}`;
    if (wcStatus !== "any") {
      path += `&status=${wcStatus}`;
    }

    const products = await this.wcRequest<WCProduct[]>("GET", path);
    return products.map(mapWooProduct);
  }

  async getProduct(platformProductId: string): Promise<PlatformProduct> {
    const product = await this.wcRequest<WCProduct>("GET", `/products/${platformProductId}`);

    if (product.type === "variable") {
      try {
        const variations = await this.wcRequest<WCVariation[]>("GET", `/products/${platformProductId}/variations?per_page=100`);
        product._variations = variations;
      } catch { /* ignore */ }
    }

    return mapWooProduct(product);
  }

  async createProduct(data: Partial<PlatformProduct>): Promise<PlatformProduct> {
    const payload = mapToWooPayload(data);

    if (data.variants && data.variants.length > 1) {
      payload.type = "variable";

      const attrNames = new Map<string, Set<string>>();
      for (const v of data.variants) {
        if (v.option1) {
          if (!attrNames.has("Option 1")) attrNames.set("Option 1", new Set());
          attrNames.get("Option 1")!.add(v.option1);
        }
        if (v.option2) {
          if (!attrNames.has("Option 2")) attrNames.set("Option 2", new Set());
          attrNames.get("Option 2")!.add(v.option2);
        }
        if (v.option3) {
          if (!attrNames.has("Option 3")) attrNames.set("Option 3", new Set());
          attrNames.get("Option 3")!.add(v.option3);
        }
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

    if (data.variants && data.variants.length > 1 && created.type === "variable") {
      const createdAttrs = created.attributes ?? [];

      for (const variant of data.variants) {
        const varPayload: Record<string, unknown> = {
          regular_price: variant.price,
          sku: variant.sku ?? "",
        };

        const varAttrs: Array<{ id: number; name: string; option: string }> = [];
        if (variant.option1 && createdAttrs[0]) {
          varAttrs.push({ id: createdAttrs[0].id, name: createdAttrs[0].name, option: variant.option1 });
        }
        if (variant.option2 && createdAttrs[1]) {
          varAttrs.push({ id: createdAttrs[1].id, name: createdAttrs[1].name, option: variant.option2 });
        }
        if (variant.option3 && createdAttrs[2]) {
          varAttrs.push({ id: createdAttrs[2].id, name: createdAttrs[2].name, option: variant.option3 });
        }
        if (varAttrs.length > 0) {
          varPayload.attributes = varAttrs;
        }

        if (variant.inventoryQuantity !== undefined) {
          varPayload.manage_stock = true;
          varPayload.stock_quantity = variant.inventoryQuantity;
        }

        if (variant.compareAtPrice) {
          varPayload.sale_price = variant.compareAtPrice;
        }

        await this.wcRequest("POST", `/products/${created.id}/variations`, varPayload);
      }

      const updatedProduct = await this.wcRequest<WCProduct>("GET", `/products/${created.id}`);
      try {
        const variations = await this.wcRequest<WCVariation[]>("GET", `/products/${created.id}/variations?per_page=100`);
        updatedProduct._variations = variations;
      } catch { /* ignore */ }
      return mapWooProduct(updatedProduct);
    }

    return mapWooProduct(created);
  }

  async updateProduct(platformProductId: string, data: Partial<PlatformProduct>): Promise<PlatformProduct> {
    const payload = mapToWooPayload(data);
    const updated = await this.wcRequest<WCProduct>("PUT", `/products/${platformProductId}`, payload);
    return mapWooProduct(updated);
  }

  async deleteProduct(platformProductId: string): Promise<void> {
    await this.wcRequest("DELETE", `/products/${platformProductId}?force=true`);
  }

  async uploadImage(platformProductId: string, imageSource: string, alt?: string): Promise<{ src: string; id?: string }> {
    const product = await this.wcRequest<WCProduct>("GET", `/products/${platformProductId}`);
    const existingImages = product.images ?? [];
    const newImages = [...existingImages, { src: imageSource, alt: alt ?? "" }];
    const updated = await this.wcRequest<WCProduct>("PUT", `/products/${platformProductId}`, { images: newImages });
    const lastImage = updated.images?.[updated.images.length - 1];
    return { src: lastImage?.src ?? imageSource, id: lastImage?.id ? String(lastImage.id) : undefined };
  }

  async getOrders(params?: { page?: number; limit?: number; after?: string; before?: string }): Promise<PlatformOrder[]> {
    const perPage = Math.min(params?.limit ?? 100, 100);
    const page = params?.page ?? 1;
    let path = `/orders?per_page=${perPage}&page=${page}`;
    if (params?.after) path += `&after=${params.after}`;
    if (params?.before) path += `&before=${params.before}`;

    const orders = await this.wcRequest<WCOrder[]>("GET", path);
    return orders.map(o => ({
      platformId: String(o.id),
      orderNumber: String(o.number ?? o.id),
      status: o.status ?? "unknown",
      total: o.total ?? "0",
      currency: o.currency ?? "EUR",
      createdAt: o.date_created ?? new Date().toISOString(),
      customerEmail: o.billing?.email ?? undefined,
      lineItems: (o.line_items ?? []).map((li) => ({
        title: li.name ?? "",
        quantity: li.quantity ?? 1,
        price: li.price ?? li.total ?? "0",
        productId: li.product_id ? String(li.product_id) : undefined,
      })),
    }));
  }

  async getProductCount(params?: { status?: string }): Promise<number> {
    const statusMap: Record<string, string> = {
      active: "publish",
      draft: "draft",
      archived: "private",
    };
    const wcStatus = params?.status ? (statusMap[params.status] ?? params.status) : undefined;
    let path = "/products?per_page=1";
    if (wcStatus) path += `&status=${wcStatus}`;

    const resp = await this.wcRawRequest("GET", path);
    const total = resp.headers.get("X-WP-Total");
    return total ? parseInt(total, 10) : 0;
  }

  async getSeoData(platformProductId: string): Promise<SeoData | null> {
    try {
      const wpBaseUrl = normalizeWooUrl(this.storeDomain);
      const resp = await fetch(`${wpBaseUrl}/wp-json/wp/v2/product/${platformProductId}`, {
        headers: { Authorization: this.authHeader },
        signal: AbortSignal.timeout(WC_FETCH_TIMEOUT),
      });

      if (!resp.ok) return null;
      const data = await resp.json() as Record<string, unknown>;
      const yoast = data.yoast_head_json as Record<string, unknown> | undefined;

      if (yoast) {
        return {
          metaTitle: (yoast.title as string) ?? "",
          metaDescription: (yoast.description as string) ?? (yoast.og_description as string) ?? "",
          focusKeyword: (data._yoast_wpseo_focuskw as string) ?? undefined,
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  async updateSeo(platformProductId: string, data: Partial<SeoData>): Promise<SeoData> {
    if (this.seoWriteSupported === false) {
      throw new Error(
        "SEO write is not supported on this WooCommerce store. " +
        "Install Yoast SEO and add the REST API extension snippet to functions.php. " +
        "See the WooCommerce SEO setup guide for details."
      );
    }

    try {
      const wpBaseUrl = normalizeWooUrl(this.storeDomain);
      const payload: Record<string, unknown> = {};
      if (data.metaTitle) payload.yoast_title = data.metaTitle;
      if (data.metaDescription) payload.yoast_description = data.metaDescription;

      const resp = await fetch(`${wpBaseUrl}/wp-json/wp/v2/product/${platformProductId}`, {
        method: "POST",
        headers: {
          Authorization: this.authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(WC_FETCH_TIMEOUT),
      });

      if (!resp.ok) {
        this.seoWriteSupported = false;
        await this.persistSeoWriteFlag(false);
        throw new Error(
          `SEO write failed (${resp.status}). ` +
          "Ensure Yoast SEO is installed and the REST fields are registered. " +
          "Add this PHP snippet to your theme's functions.php:\n\n" +
          getSeoPhpSnippet()
        );
      }

      this.seoWriteSupported = true;
      await this.persistSeoWriteFlag(true);
      return {
        metaTitle: data.metaTitle ?? "",
        metaDescription: data.metaDescription ?? "",
        focusKeyword: data.focusKeyword,
        handle: data.handle,
      };
    } catch (err) {
      if (err instanceof Error && err.message.includes("SEO write")) throw err;
      this.seoWriteSupported = false;
      await this.persistSeoWriteFlag(false);
      throw new Error(
        "SEO write is not available. " +
        "Ensure Yoast SEO plugin is installed and REST fields are registered."
      );
    }
  }

  private async persistSeoWriteFlag(supported: boolean): Promise<void> {
    try {
      const [proj] = await db.select({ aiReportJson: projectsTable.aiReportJson }).from(projectsTable).where(eq(projectsTable.id, this.projectId));
      let meta: Record<string, unknown> = {};
      try {
        if (proj?.aiReportJson) meta = JSON.parse(proj.aiReportJson);
      } catch { /* ignore */ }
      meta.seoWriteSupported = supported;
      if (!supported) meta.seoWriteSnippet = getSeoPhpSnippet();
      await db.update(projectsTable).set({ aiReportJson: JSON.stringify(meta) }).where(eq(projectsTable.id, this.projectId));
    } catch (err) {
      logger.warn({ projectId: this.projectId, err }, "Failed to persist SEO write flag");
    }
  }

  async getInventory(platformProductId: string): Promise<InventoryData | null> {
    const product = await this.wcRequest<WCProduct>("GET", `/products/${platformProductId}`);

    let variants: Array<{ variantId: string; quantity: number | null; sku?: string }> = [];
    if (product.type === "variable") {
      try {
        const variations = await this.wcRequest<WCVariation[]>("GET", `/products/${platformProductId}/variations?per_page=100`);
        variants = variations.map(v => ({
          variantId: String(v.id),
          quantity: v.stock_quantity ?? null,
          sku: v.sku ?? undefined,
        }));
      } catch { /* ignore */ }
    }

    return {
      productId: platformProductId,
      tracked: product.manage_stock ?? false,
      quantity: product.stock_quantity ?? null,
      variants: variants.length > 0 ? variants : undefined,
    };
  }

  async updateInventory(platformProductId: string, quantity: number, variantId?: string): Promise<void> {
    if (variantId) {
      await this.wcRequest("PUT", `/products/${platformProductId}/variations/${variantId}`, {
        manage_stock: true,
        stock_quantity: quantity,
      });
    } else {
      await this.wcRequest("PUT", `/products/${platformProductId}`, {
        manage_stock: true,
        stock_quantity: quantity,
      });
    }
  }

  async getAllProducts(): Promise<WCProduct[]> {
    const allProducts: WCProduct[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const resp = await this.wcRawRequest("GET", `/products?per_page=${perPage}&page=${page}`);
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`WooCommerce API error ${resp.status}: ${text}`);
      }

      const products = await resp.json() as WCProduct[];
      if (!products.length) break;
      allProducts.push(...products);

      const totalPages = parseInt(resp.headers.get("X-WP-TotalPages") ?? "1", 10);
      if (page >= totalPages) break;
      page++;
      await new Promise(r => setTimeout(r, 300));
    }

    return allProducts;
  }

  private async wcRawRequest(method: string, path: string, body?: unknown): Promise<Response> {
    const url = `${this.baseUrl}${path}`;

    const init: RequestInit = {
      method,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(WC_FETCH_TIMEOUT),
    };

    if (body && method !== "GET" && method !== "HEAD") {
      init.body = JSON.stringify(body);
    }

    return fetch(url, init);
  }

  private async wcRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
    let lastResp: Response | null = null;

    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      const resp = await this.wcRawRequest(method, path, body);

      if (resp.status === 429 || (resp.status >= 500 && resp.status !== 501)) {
        lastResp = resp;
        if (attempt < RETRY_DELAYS.length) {
          const delay = RETRY_DELAYS[attempt];
          logger.warn({ projectId: this.projectId, path, status: resp.status, attempt: attempt + 1, delay }, "WooCommerce transient error — retrying");
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`WooCommerce API error ${resp.status} at ${path}: ${text}`);
      }

      if (method === "DELETE" && resp.status === 200) {
        return {} as T;
      }

      return resp.json() as Promise<T>;
    }

    const text = lastResp ? await lastResp.text() : "Max retries exceeded";
    throw new Error(`WooCommerce API error after retries at ${path}: ${text}`);
  }
}

interface WCSystemStatus {
  environment?: {
    site_title?: string;
    home_url?: string;
    version?: string;
    wp_version?: string;
    php_version?: string;
  };
}

interface WCProductTotal {
  slug?: string;
  name?: string;
  total?: number;
}

interface WCProduct {
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
  manage_stock?: boolean;
  stock_quantity?: number | null;
  stock_status?: string;
  backorders?: string;
  categories?: Array<{ id: number; name: string; slug: string }>;
  tags?: Array<{ id: number; name: string; slug: string }>;
  images?: Array<{ id?: number; src: string; alt?: string; name?: string; position?: number }>;
  attributes?: Array<{ id: number; name: string; position: number; visible: boolean; variation: boolean; options: string[] }>;
  variations?: number[];
  _variations?: WCVariation[];
}

interface WCVariation {
  id: number;
  sku?: string;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  stock_quantity?: number | null;
  manage_stock?: boolean;
  stock_status?: string;
  attributes?: Array<{ id: number; name: string; option: string }>;
}

interface WCOrder {
  id: number;
  number?: number;
  status?: string;
  total?: string;
  currency?: string;
  date_created?: string;
  billing?: { email?: string; first_name?: string; last_name?: string };
  line_items?: WCLineItem[];
}

interface WCLineItem {
  name?: string;
  quantity?: number;
  price?: string;
  total?: string;
  product_id?: number;
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

function mapWooProduct(p: WCProduct): PlatformProduct {
  const variations = p._variations ?? [];
  const tags = (p.tags ?? []).map(t => t.name).join(", ");

  let variants = variations.map(v => ({
    platformId: String(v.id),
    title: (v.attributes ?? []).map(a => a.option).join(" / ") || "Default",
    price: v.regular_price ?? v.price ?? "0",
    compareAtPrice: v.sale_price && v.regular_price ? v.regular_price : null,
    sku: v.sku ?? "",
    inventoryQuantity: v.stock_quantity ?? 0,
    option1: v.attributes?.[0]?.option,
    option2: v.attributes?.[1]?.option,
    option3: v.attributes?.[2]?.option,
  }));

  if (variants.length === 0) {
    variants = [{
      platformId: String(p.id),
      title: "Default",
      price: p.regular_price ?? p.price ?? "0",
      compareAtPrice: p.sale_price && p.regular_price ? p.regular_price : null,
      sku: p.sku ?? "",
      inventoryQuantity: p.stock_quantity ?? 0,
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
    price: p.regular_price ?? p.price ?? null,
    compareAtPrice: p.sale_price || null,
    images: (p.images ?? []).map((img, i) => ({
      src: img.src,
      alt: img.alt,
      position: img.position ?? i,
    })),
    variants,
  };
}

function mapToWooPayload(data: Partial<PlatformProduct>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (data.title !== undefined) payload.name = data.title;
  if (data.bodyHtml !== undefined) payload.description = data.bodyHtml;
  if (data.handle !== undefined) payload.slug = data.handle;
  if (data.tags !== undefined) {
    payload.tags = data.tags.split(",").map(t => ({ name: t.trim() })).filter(t => t.name);
  }
  if (data.status !== undefined) {
    const statusMap: Record<string, string> = {
      active: "publish",
      draft: "draft",
      archived: "private",
    };
    payload.status = statusMap[data.status] ?? data.status;
  }
  if (data.price !== undefined) payload.regular_price = data.price;
  if (data.compareAtPrice !== undefined) payload.sale_price = data.compareAtPrice;
  if (data.images) {
    payload.images = data.images.map(img => ({ src: img.src, alt: img.alt ?? "" }));
  }
  if (data.variants && data.variants.length > 1) {
    payload.type = "variable";
  }

  return payload;
}

function getSeoPhpSnippet(): string {
  return `
// Add this to your theme's functions.php to enable SEO write via REST API:
add_action('rest_api_init', function() {
  register_rest_field('product', 'yoast_title', array(
    'get_callback' => function($object) {
      return get_post_meta($object['id'], '_yoast_wpseo_title', true);
    },
    'update_callback' => function($value, $object) {
      update_post_meta($object->ID, '_yoast_wpseo_title', sanitize_text_field($value));
    },
    'schema' => array('type' => 'string'),
  ));
  register_rest_field('product', 'yoast_description', array(
    'get_callback' => function($object) {
      return get_post_meta($object['id'], '_yoast_wpseo_metadesc', true);
    },
    'update_callback' => function($value, $object) {
      update_post_meta($object->ID, '_yoast_wpseo_metadesc', sanitize_text_field($value));
    },
    'schema' => array('type' => 'string'),
  ));
});`.trim();
}
