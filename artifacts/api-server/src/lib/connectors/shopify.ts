import type { Project } from "@workspace/db";
import { shopifyRequest, shopifyRequestPaged, shopifyGraphQL, refreshToken, validateToken, getShopifyHeaders } from "../shopify";
import { safeDecrypt } from "../crypto.js";
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

export class ShopifyConnector implements IPlatformConnector {
  readonly platformType = "shopify" as const;
  readonly projectId: number;
  readonly storeDomain: string;
  private readonly project: Project;

  constructor(project: Project) {
    this.project = project;
    this.projectId = project.id;
    this.storeDomain = project.shopDomain;
  }

  supportsFeature(feature: PlatformFeature): boolean {
    const supported: PlatformFeature[] = [
      "products", "product_create", "product_update", "product_delete",
      "variants", "images", "image_upload_url",
      "seo_read", "seo_write",
      "orders", "inventory", "customers",
      "themes", "graphql",
    ];
    return supported.includes(feature);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const shopData = await shopifyRequest<{ shop: { name: string; plan_name: string } }>(
        this.projectId,
        this.storeDomain,
        "/shop.json"
      );

      const countData = await shopifyRequest<{ count: number }>(
        this.projectId,
        this.storeDomain,
        "/products/count.json"
      );

      return {
        connected: true,
        storeName: shopData.shop.name,
        platformInfo: `Shopify ${shopData.shop.plan_name}`,
        productCount: countData.count,
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

  async refreshAuth(): Promise<string> {
    const plainSecret = safeDecrypt(this.project.clientSecret) || this.project.clientSecret;
    return refreshToken(
      this.projectId,
      this.storeDomain,
      this.project.clientId,
      plainSecret
    );
  }

  async request<T = unknown>(method: string, path: string, body?: unknown, options?: RequestInit): Promise<T> {
    const reqOptions: RequestInit = {
      ...options,
      method,
    };
    if (body) {
      reqOptions.body = JSON.stringify(body);
    }
    return shopifyRequest<T>(this.projectId, this.storeDomain, path, reqOptions);
  }

  async requestPaged<T = unknown>(path: string, params?: Record<string, string>): Promise<PagedResult<T>> {
    let fullPath = path;
    if (params && Object.keys(params).length > 0) {
      const sep = path.includes("?") ? "&" : "?";
      const qs = new URLSearchParams(params).toString();
      fullPath = `${path}${sep}${qs}`;
    }
    const result = await shopifyRequestPaged<T>(this.projectId, this.storeDomain, fullPath);
    const dataKey = Object.keys(result.data as Record<string, unknown>)[0];
    const items = (result.data as Record<string, unknown>)[dataKey] as T[];
    return {
      data: items || [],
      total: null,
      hasMore: !!result.nextPageInfo,
      nextCursor: result.nextPageInfo ?? undefined,
    };
  }

  async getProducts(params?: { status?: string; page?: number; limit?: number }): Promise<PlatformProduct[]> {
    const limit = params?.limit ?? 250;
    const status = params?.status ?? "active";
    const path = `/products.json?limit=${limit}&status=${status}&published_status=any`;

    const data = await shopifyRequest<{ products: ShopifyRawProduct[] }>(
      this.projectId, this.storeDomain, path
    );

    return data.products.map(mapShopifyProduct);
  }

  async getProduct(platformProductId: string): Promise<PlatformProduct> {
    const data = await shopifyRequest<{ product: ShopifyRawProduct }>(
      this.projectId, this.storeDomain, `/products/${platformProductId}.json`
    );
    return mapShopifyProduct(data.product);
  }

  async createProduct(productData: Partial<PlatformProduct>): Promise<PlatformProduct> {
    const shopifyPayload = mapToShopifyPayload(productData);
    const data = await shopifyRequest<{ product: ShopifyRawProduct }>(
      this.projectId, this.storeDomain, "/products.json",
      { method: "POST", body: JSON.stringify({ product: shopifyPayload }) }
    );
    return mapShopifyProduct(data.product);
  }

  async updateProduct(platformProductId: string, productData: Partial<PlatformProduct>): Promise<PlatformProduct> {
    const shopifyPayload = mapToShopifyPayload(productData);
    const data = await shopifyRequest<{ product: ShopifyRawProduct }>(
      this.projectId, this.storeDomain, `/products/${platformProductId}.json`,
      { method: "PUT", body: JSON.stringify({ product: shopifyPayload }) }
    );
    return mapShopifyProduct(data.product);
  }

  async deleteProduct(platformProductId: string): Promise<void> {
    await shopifyRequest(
      this.projectId, this.storeDomain, `/products/${platformProductId}.json`,
      { method: "DELETE" }
    );
  }

  async uploadImage(platformProductId: string, imageSource: string, alt?: string): Promise<{ src: string; id?: string }> {
    const data = await shopifyRequest<{ image: { id: number; src: string } }>(
      this.projectId, this.storeDomain, `/products/${platformProductId}/images.json`,
      // Shopify REST acepta URL pública en `src`, pero una imagen en base64 debe ir
      // en `attachment` (un data: URL en `src` se rechaza y la foto no se subía).
      { method: "POST", body: JSON.stringify({ image: imageSource.startsWith("data:")
        ? { attachment: imageSource.slice(imageSource.indexOf(",") + 1), alt: alt ?? "" }
        : { src: imageSource, alt: alt ?? "" } }) }
    );
    return { src: data.image.src, id: String(data.image.id) };
  }

  async getOrders(params?: { page?: number; limit?: number; after?: string; before?: string }): Promise<PlatformOrder[]> {
    const limit = params?.limit ?? 50;
    let path = `/orders.json?limit=${limit}&status=any`;
    if (params?.after) path += `&created_at_min=${params.after}`;
    if (params?.before) path += `&created_at_max=${params.before}`;

    const data = await shopifyRequest<{ orders: ShopifyRawOrder[] }>(
      this.projectId, this.storeDomain, path
    );

    return data.orders.map(o => ({
      platformId: String(o.id),
      orderNumber: String(o.order_number ?? o.name ?? o.id),
      status: o.financial_status ?? o.fulfillment_status ?? "unknown",
      total: o.total_price ?? "0",
      currency: o.currency ?? "EUR",
      createdAt: o.created_at ?? new Date().toISOString(),
      customerEmail: o.email ?? undefined,
      lineItems: (o.line_items ?? []).map((li: ShopifyLineItem) => ({
        title: li.title ?? "",
        quantity: li.quantity ?? 1,
        price: li.price ?? "0",
        productId: li.product_id ? String(li.product_id) : undefined,
      })),
    }));
  }

  async getProductCount(params?: { status?: string }): Promise<number> {
    const status = params?.status ?? "any";
    const path = `/products/count.json?published_status=${status}`;
    const data = await shopifyRequest<{ count: number }>(
      this.projectId, this.storeDomain, path
    );
    return data.count;
  }

  async getSeoData(platformProductId: string): Promise<SeoData | null> {
    const product = await this.getProduct(platformProductId);
    if (!product.seo) return null;
    return {
      metaTitle: product.seo.metaTitle ?? "",
      metaDescription: product.seo.metaDescription ?? "",
      focusKeyword: product.seo.focusKeyword,
      handle: (product.seo as any).handle,
    };
  }

  async updateSeo(platformProductId: string, data: Partial<SeoData>): Promise<SeoData> {
    const payload: Record<string, unknown> = {};
    if (data.metaTitle) payload.metafields_global_title_tag = data.metaTitle;
    if (data.metaDescription) payload.metafields_global_description_tag = data.metaDescription;
    if (data.handle) payload.handle = data.handle;

    await shopifyRequest(
      this.projectId, this.storeDomain, `/products/${platformProductId}.json`,
      { method: "PUT", body: JSON.stringify({ product: payload }) }
    );

    return {
      metaTitle: data.metaTitle ?? "",
      metaDescription: data.metaDescription ?? "",
      handle: data.handle,
    };
  }

  async getInventory(platformProductId: string): Promise<InventoryData | null> {
    const product = await this.getProduct(platformProductId);
    const firstVariant = product.variants[0];
    return {
      productId: platformProductId,
      tracked: true,
      quantity: firstVariant?.inventoryQuantity ?? null,
      variants: product.variants.map(v => ({
        variantId: v.platformId,
        quantity: v.inventoryQuantity ?? null,
        sku: v.sku,
      })),
    };
  }

  async updateInventory(_platformProductId: string, _quantity: number, _variantId?: string): Promise<void> {
    throw new Error("Use Shopify Inventory API directly for inventory updates — requires inventory_item_id resolution");
  }

  async graphql<T = Record<string, unknown>>(query: string, variables?: Record<string, unknown>): Promise<T> {
    return shopifyGraphQL<T>(this.projectId, this.storeDomain, query, variables);
  }

  async getHeaders(): Promise<Record<string, string>> {
    return getShopifyHeaders(this.projectId);
  }

  async isTokenValid(): Promise<boolean> {
    const plainToken = this.project.accessToken
      ? (safeDecrypt(this.project.accessToken) || this.project.accessToken)
      : "";
    if (!plainToken) return false;
    return validateToken(this.storeDomain, plainToken);
  }
}

interface ShopifyRawProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  vendor: string;
  product_type: string;
  status: string;
  tags: string;
  variants: Array<{
    id: number;
    title: string;
    price: string;
    compare_at_price: string | null;
    sku: string;
    inventory_quantity: number;
    option1?: string;
    option2?: string;
    option3?: string;
  }>;
  images: Array<{ id: number; src: string; alt?: string; position: number }>;
}

interface ShopifyRawOrder {
  id: number;
  order_number?: number;
  name?: string;
  financial_status?: string;
  fulfillment_status?: string;
  total_price?: string;
  currency?: string;
  created_at?: string;
  email?: string;
  line_items?: ShopifyLineItem[];
}

interface ShopifyLineItem {
  title?: string;
  quantity?: number;
  price?: string;
  product_id?: number;
}

function mapShopifyProduct(sp: ShopifyRawProduct): PlatformProduct {
  const firstVariant = sp.variants?.[0];
  return {
    platformId: String(sp.id),
    title: sp.title ?? "",
    handle: sp.handle ?? "",
    bodyHtml: sp.body_html ?? "",
    vendor: sp.vendor ?? "",
    productType: sp.product_type ?? "",
    status: sp.status ?? "draft",
    tags: sp.tags ?? "",
    price: firstVariant?.price ?? null,
    compareAtPrice: firstVariant?.compare_at_price ?? null,
    images: (sp.images ?? []).map(img => ({
      src: img.src,
      alt: img.alt,
      position: img.position,
    })),
    variants: (sp.variants ?? []).map(v => ({
      platformId: String(v.id),
      title: v.title ?? "",
      price: v.price ?? "0",
      compareAtPrice: v.compare_at_price ?? null,
      sku: v.sku ?? "",
      inventoryQuantity: v.inventory_quantity ?? 0,
      option1: v.option1,
      option2: v.option2,
      option3: v.option3,
    })),
  };
}

function mapToShopifyPayload(data: Partial<PlatformProduct>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (data.title !== undefined) payload.title = data.title;
  if (data.bodyHtml !== undefined) payload.body_html = data.bodyHtml;
  if (data.vendor !== undefined) payload.vendor = data.vendor;
  if (data.productType !== undefined) payload.product_type = data.productType;
  if (data.tags !== undefined) payload.tags = data.tags;
  if (data.status !== undefined) payload.status = data.status;
  if (data.handle !== undefined) payload.handle = data.handle;
  if (data.images) {
    payload.images = data.images.map(img => ({ src: img.src, alt: img.alt ?? "" }));
  }
  if (data.variants) {
    payload.variants = data.variants.map(v => ({
      price: v.price,
      compare_at_price: v.compareAtPrice ?? null,
      sku: v.sku ?? "",
      option1: v.option1,
      option2: v.option2,
      option3: v.option3,
    }));
  }
  if (data.seo) {
    if (data.seo.metaTitle) payload.metafields_global_title_tag = data.seo.metaTitle;
    if (data.seo.metaDescription) payload.metafields_global_description_tag = data.seo.metaDescription;
  }
  return payload;
}
