import type { PlatformType } from "@workspace/db";

export interface ConnectionTestResult {
  connected: boolean;
  storeName: string | null;
  planName: string | null;
  productCount: number | null;
  tokenValid: boolean;
  tokenExpiresAt: string | null;
  error: string | null;
  platformType: PlatformType;
}

export interface PagedResult<T> {
  data: T;
  nextPageInfo: string | null;
}

export interface PlatformProduct {
  id: string;
  title: string;
  bodyHtml: string | null;
  vendor: string | null;
  productType: string | null;
  handle: string;
  status: string;
  publishedAt: string | null;
  tags: string;
  variants: PlatformVariant[];
  options: PlatformOption[];
  images: PlatformImage[];
}

export interface PlatformVariant {
  id: string | number;
  title: string;
  price: string;
  compareAtPrice: string | null;
  sku: string | null;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  inventoryQuantity: number | null;
  weight: number | null;
  weightUnit: string | null;
}

export interface PlatformOption {
  id: string | number;
  name: string;
  position: number;
  values: string[];
}

export interface PlatformImage {
  id: string | number;
  src: string;
  alt: string | null;
  position: number;
}

export interface SeoData {
  metaTitle: string | null;
  metaDescription: string | null;
  handle: string;
}

export interface InventoryData {
  variantId: string;
  inventoryItemId: string | null;
  quantity: number | null;
  tracked: boolean;
}

export interface ImageResult {
  id: string | number;
  src: string;
  alt: string | null;
}

export type PlatformFeature =
  | "products"
  | "orders"
  | "seo"
  | "inventory"
  | "images"
  | "graphql"
  | "themes"
  | "collections"
  | "pages"
  | "metafields"
  | "webhooks";

export interface IPlatformConnector {
  readonly platformType: PlatformType;
  readonly projectId: number;

  testConnection(): Promise<ConnectionTestResult>;

  refreshAuth(): Promise<string>;

  request<T>(method: string, path: string, body?: unknown): Promise<T>;

  requestPaged<T>(path: string): Promise<PagedResult<T>>;

  getProducts(params?: Record<string, string>): Promise<PlatformProduct[]>;

  getProduct(id: string): Promise<PlatformProduct>;

  createProduct(data: Record<string, unknown>): Promise<PlatformProduct>;

  updateProduct(id: string, data: Record<string, unknown>): Promise<PlatformProduct>;

  deleteProduct(id: string): Promise<void>;

  uploadImage(productId: string, imageUrl: string): Promise<ImageResult>;

  getOrders(params?: Record<string, string>): Promise<unknown[]>;

  getSeoData(productId: string): Promise<SeoData>;

  updateSeo(productId: string, data: Partial<SeoData>): Promise<SeoData>;

  getInventory(productId: string): Promise<InventoryData[]>;

  updateInventory(variantId: string, data: { quantity: number }): Promise<void>;

  supportsFeature(feature: PlatformFeature): boolean;
}

export class PlatformNotSupportedError extends Error {
  constructor(platformType: string) {
    super(
      `Platform "${platformType}" is not yet supported. Supported platforms: shopify. Coming soon: woocommerce, prestashop, wordpress, universal.`
    );
    this.name = "PlatformNotSupportedError";
  }
}
