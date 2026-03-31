import type { Project } from "@workspace/db";
import {
  shopifyRequest,
  shopifyRequestPaged,
  shopifyGraphQL,
  refreshToken,
  getShopifyHeaders,
  rotateToken,
  validateToken,
  normalizeShopDomain,
} from "../lib/shopify.js";
import { safeDecrypt } from "../lib/crypto.js";
import { learnFromOperation } from "../lib/claude.js";
import type {
  IPlatformConnector,
  ConnectionTestResult,
  PagedResult,
  PlatformProduct,
  PlatformVariant,
  PlatformImage,
  PlatformOption,
  SeoData,
  InventoryData,
  ImageResult,
  PlatformFeature,
} from "./types.js";

interface ShopifyProductRaw {
  id: number;
  title: string;
  body_html: string | null;
  vendor: string | null;
  product_type: string | null;
  handle: string;
  status: string;
  published_at: string | null;
  tags: string;
  variants: Array<{
    id: number;
    title: string;
    price: string;
    compare_at_price: string | null;
    sku: string | null;
    option1: string | null;
    option2: string | null;
    option3: string | null;
    inventory_quantity: number | null;
    weight: number | null;
    weight_unit: string | null;
    inventory_item_id?: number;
  }>;
  options: Array<{ id: number; name: string; position: number; values: string[] }>;
  images: Array<{ id: number; src: string; alt: string | null; position: number }>;
}

function mapShopifyProduct(raw: ShopifyProductRaw): PlatformProduct {
  return {
    id: String(raw.id),
    title: raw.title,
    bodyHtml: raw.body_html,
    vendor: raw.vendor,
    productType: raw.product_type,
    handle: raw.handle,
    status: raw.status,
    publishedAt: raw.published_at,
    tags: raw.tags,
    variants: (raw.variants ?? []).map((v): PlatformVariant => ({
      id: v.id,
      title: v.title,
      price: v.price,
      compareAtPrice: v.compare_at_price,
      sku: v.sku,
      option1: v.option1,
      option2: v.option2,
      option3: v.option3,
      inventoryQuantity: v.inventory_quantity,
      weight: v.weight,
      weightUnit: v.weight_unit,
    })),
    options: (raw.options ?? []).map((o): PlatformOption => ({
      id: o.id,
      name: o.name,
      position: o.position,
      values: o.values,
    })),
    images: (raw.images ?? []).map((img): PlatformImage => ({
      id: img.id,
      src: img.src,
      alt: img.alt,
      position: img.position,
    })),
  };
}

export class ShopifyConnector implements IPlatformConnector {
  readonly platformType = "shopify" as const;
  readonly projectId: number;
  private readonly shopDomain: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(project: Project) {
    this.projectId = project.id;
    this.shopDomain = project.shopDomain;
    this.clientId = project.clientId;
    this.clientSecret = project.clientSecret;
  }

  private recordLearning(operationType: string, title: string, content: string, confidence = 0.7, tags: string[] = []): void {
    learnFromOperation({
      operationType,
      title,
      content,
      confidence,
      tags: ["shopify", "connector", ...tags],
    });
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const data = await shopifyRequest<{ shop: { name: string; plan_name: string } }>(
        this.projectId,
        this.shopDomain,
        "/shop.json"
      );

      const countData = await shopifyRequest<{ count: number }>(
        this.projectId,
        this.shopDomain,
        "/products/count.json"
      );

      this.recordLearning(
        "general",
        `Shopify connection test: ${data.shop.name} (${data.shop.plan_name})`,
        `Store "${data.shop.name}" connected successfully. Plan: ${data.shop.plan_name}. Products: ${countData.count}. Domain: ${this.shopDomain}.`,
        0.8,
        ["connection_test", "store_info"]
      );

      return {
        connected: true,
        storeName: data.shop.name,
        planName: data.shop.plan_name,
        productCount: countData.count,
        tokenValid: true,
        tokenExpiresAt: null,
        error: null,
        platformType: "shopify",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      return {
        connected: false,
        storeName: null,
        planName: null,
        productCount: null,
        tokenValid: false,
        tokenExpiresAt: null,
        error: message,
        platformType: "shopify",
      };
    }
  }

  async refreshAuth(): Promise<string> {
    const plainSecret = safeDecrypt(this.clientSecret) || this.clientSecret;
    return refreshToken(this.projectId, this.shopDomain, this.clientId, plainSecret);
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const options: RequestInit = { method };
    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }
    return shopifyRequest<T>(this.projectId, this.shopDomain, path, options);
  }

  async requestPaged<T>(path: string): Promise<PagedResult<T>> {
    return shopifyRequestPaged<T>(this.projectId, this.shopDomain, path);
  }

  async graphQL<T = Record<string, unknown>>(query: string, variables?: Record<string, unknown>): Promise<T> {
    return shopifyGraphQL<T>(this.projectId, this.shopDomain, query, variables);
  }

  async getProducts(params?: Record<string, string>): Promise<PlatformProduct[]> {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    const data = await shopifyRequest<{ products: ShopifyProductRaw[] }>(
      this.projectId,
      this.shopDomain,
      `/products.json${qs}`
    );
    const products = (data.products ?? []).map(mapShopifyProduct);
    this.recordLearning(
      "general",
      `Shopify products fetched: ${products.length} products`,
      `Fetched ${products.length} products from ${this.shopDomain}. ${params ? `Params: ${JSON.stringify(params)}` : "No filters."}`,
      0.6,
      ["products", "sync"]
    );
    return products;
  }

  async getProduct(id: string): Promise<PlatformProduct> {
    const data = await shopifyRequest<{ product: ShopifyProductRaw }>(
      this.projectId,
      this.shopDomain,
      `/products/${id}.json`
    );
    return mapShopifyProduct(data.product);
  }

  async createProduct(data: Record<string, unknown>): Promise<PlatformProduct> {
    const result = await shopifyRequest<{ product: ShopifyProductRaw }>(
      this.projectId,
      this.shopDomain,
      "/products.json",
      { method: "POST", body: JSON.stringify({ product: data }) }
    );
    const product = mapShopifyProduct(result.product);
    this.recordLearning(
      "general",
      `Shopify product created: ${product.title}`,
      `Created product "${product.title}" (ID: ${product.id}) on ${this.shopDomain}. Status: ${product.status}. Variants: ${product.variants.length}. Images: ${product.images.length}.`,
      0.75,
      ["products", "create"]
    );
    return product;
  }

  async updateProduct(id: string, data: Record<string, unknown>): Promise<PlatformProduct> {
    const result = await shopifyRequest<{ product: ShopifyProductRaw }>(
      this.projectId,
      this.shopDomain,
      `/products/${id}.json`,
      { method: "PUT", body: JSON.stringify({ product: data }) }
    );
    const product = mapShopifyProduct(result.product);
    this.recordLearning(
      "general",
      `Shopify product updated: ${product.title}`,
      `Updated product "${product.title}" (ID: ${id}) on ${this.shopDomain}. Fields changed: ${Object.keys(data).join(", ")}.`,
      0.7,
      ["products", "update"]
    );
    return product;
  }

  async deleteProduct(id: string): Promise<void> {
    await shopifyRequest(
      this.projectId,
      this.shopDomain,
      `/products/${id}.json`,
      { method: "DELETE" }
    );
    this.recordLearning(
      "general",
      `Shopify product deleted: ${id}`,
      `Deleted product ID ${id} from ${this.shopDomain}.`,
      0.65,
      ["products", "delete"]
    );
  }

  async uploadImage(productId: string, imageUrl: string): Promise<ImageResult> {
    const result = await shopifyRequest<{ image: { id: number; src: string; alt: string | null } }>(
      this.projectId,
      this.shopDomain,
      `/products/${productId}/images.json`,
      { method: "POST", body: JSON.stringify({ image: { src: imageUrl } }) }
    );
    this.recordLearning(
      "images",
      `Image uploaded to product ${productId}`,
      `Uploaded image to product ${productId} on ${this.shopDomain}. Image ID: ${result.image.id}.`,
      0.65,
      ["images", "upload"]
    );
    return {
      id: result.image.id,
      src: result.image.src,
      alt: result.image.alt,
    };
  }

  async getOrders(params?: Record<string, string>): Promise<unknown[]> {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    const data = await shopifyRequest<{ orders: unknown[] }>(
      this.projectId,
      this.shopDomain,
      `/orders.json${qs}`
    );
    const orders = data.orders ?? [];
    if (orders.length > 0) {
      this.recordLearning(
        "general",
        `Shopify orders fetched: ${orders.length} orders`,
        `Fetched ${orders.length} orders from ${this.shopDomain}.`,
        0.6,
        ["orders", "sync"]
      );
    }
    return orders;
  }

  async getSeoData(productId: string): Promise<SeoData> {
    const product = await this.getProduct(productId);
    const metafields = await shopifyRequest<{ metafields: Array<{ namespace: string; key: string; value: string }> }>(
      this.projectId,
      this.shopDomain,
      `/products/${productId}/metafields.json`
    ).catch((): { metafields: Array<{ namespace: string; key: string; value: string }> } => ({ metafields: [] }));

    const seoTitle = metafields.metafields.find(m => m.namespace === "seo" && m.key === "title");
    const seoDesc = metafields.metafields.find(m => m.namespace === "seo" && m.key === "description");

    return {
      metaTitle: seoTitle?.value ?? null,
      metaDescription: seoDesc?.value ?? null,
      handle: product.handle,
    };
  }

  async updateSeo(productId: string, data: Partial<SeoData>): Promise<SeoData> {
    if (data.metaTitle) {
      await shopifyRequest(
        this.projectId,
        this.shopDomain,
        `/products/${productId}/metafields.json`,
        {
          method: "POST",
          body: JSON.stringify({
            metafield: { namespace: "seo", key: "title", value: data.metaTitle, type: "single_line_text_field" },
          }),
        }
      );
    }
    if (data.metaDescription) {
      await shopifyRequest(
        this.projectId,
        this.shopDomain,
        `/products/${productId}/metafields.json`,
        {
          method: "POST",
          body: JSON.stringify({
            metafield: { namespace: "seo", key: "description", value: data.metaDescription, type: "single_line_text_field" },
          }),
        }
      );
    }
    this.recordLearning(
      "seo",
      `SEO updated for product ${productId}`,
      `Updated SEO for product ${productId} on ${this.shopDomain}. Title: ${data.metaTitle ?? "(unchanged)"}. Description: ${data.metaDescription ? data.metaDescription.slice(0, 100) : "(unchanged)"}.`,
      0.7,
      ["seo", "metafields"]
    );
    return this.getSeoData(productId);
  }

  async getInventory(productId: string): Promise<InventoryData[]> {
    const product = await shopifyRequest<{ product: ShopifyProductRaw }>(
      this.projectId,
      this.shopDomain,
      `/products/${productId}.json`
    );
    return (product.product.variants ?? []).map((v) => ({
      variantId: String(v.id),
      inventoryItemId: v.inventory_item_id ? String(v.inventory_item_id) : null,
      quantity: v.inventory_quantity,
      tracked: true,
    }));
  }

  async updateInventory(variantId: string, data: { quantity: number }): Promise<void> {
    const variant = await shopifyRequest<{ variant: { inventory_item_id: number } }>(
      this.projectId,
      this.shopDomain,
      `/variants/${variantId}.json`
    );

    await shopifyRequest(
      this.projectId,
      this.shopDomain,
      `/inventory_levels/set.json`,
      {
        method: "POST",
        body: JSON.stringify({
          inventory_item_id: variant.variant.inventory_item_id,
          available: data.quantity,
        }),
      }
    );
  }

  supportsFeature(feature: PlatformFeature): boolean {
    const supported: PlatformFeature[] = [
      "products",
      "orders",
      "seo",
      "inventory",
      "images",
      "graphql",
      "themes",
      "collections",
      "pages",
      "metafields",
      "webhooks",
    ];
    return supported.includes(feature);
  }

  async rotateToken(currentAccessToken: string): Promise<string> {
    const plainSecret = safeDecrypt(this.clientSecret) || this.clientSecret;
    return rotateToken(this.projectId, this.shopDomain, this.clientId, plainSecret, currentAccessToken);
  }

  async validateToken(accessToken: string): Promise<boolean> {
    return validateToken(this.shopDomain, accessToken);
  }

  async getHeaders(): Promise<Record<string, string>> {
    return getShopifyHeaders(this.projectId);
  }

  getNormalizedDomain(): string {
    return normalizeShopDomain(this.shopDomain);
  }
}
