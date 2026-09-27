import type { PlatformType } from "@workspace/db";

export interface ConnectionTestResult {
  connected: boolean;
  storeName: string | null;
  platformInfo: string | null;
  productCount: number | null;
  tokenValid: boolean;
  error: string | null;
  errorCode?: string;
  /** Recursos de la API accesibles con las credenciales (PrestaShop Webservice). */
  resources?: string[];
}

export interface PlatformProduct {
  platformId: string;
  title: string;
  handle: string;
  bodyHtml: string;
  vendor: string;
  productType: string;
  status: string;
  tags: string;
  price: string | null;
  compareAtPrice: string | null;
  images: Array<{ src: string; alt?: string; position?: number }>;
  variants: Array<{
    platformId: string;
    title: string;
    price: string;
    compareAtPrice?: string | null;
    sku?: string;
    inventoryQuantity?: number;
    option1?: string;
    option2?: string;
    option3?: string;
  }>;
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    focusKeyword?: string;
  };
}

export interface PlatformOrder {
  platformId: string;
  orderNumber: string;
  status: string;
  total: string;
  currency: string;
  createdAt: string;
  customerEmail?: string;
  lineItems: Array<{
    title: string;
    quantity: number;
    price: string;
    productId?: string;
  }>;
}

export interface SeoData {
  metaTitle: string;
  metaDescription: string;
  focusKeyword?: string;
  handle?: string;
}

export interface InventoryData {
  productId: string;
  tracked: boolean;
  quantity: number | null;
  variants?: Array<{
    variantId: string;
    quantity: number | null;
    sku?: string;
  }>;
}

export interface PagedResult<T> {
  data: T[];
  total: number | null;
  hasMore: boolean;
  nextCursor?: string;
}

export type PlatformFeature =
  | "products"
  | "product_create"
  | "product_update"
  | "product_delete"
  | "variants"
  | "images"
  | "image_upload_url"
  | "image_upload_file"
  | "seo_read"
  | "seo_write"
  | "orders"
  | "inventory"
  | "customers"
  | "themes"
  | "graphql"
  | "audit";

export interface IPlatformConnector {
  readonly platformType: PlatformType;
  readonly projectId: number;
  readonly storeDomain: string;

  supportsFeature(feature: PlatformFeature): boolean;

  testConnection(): Promise<ConnectionTestResult>;

  refreshAuth(): Promise<string | null>;

  request<T = unknown>(method: string, path: string, body?: unknown, options?: RequestInit): Promise<T>;

  requestPaged<T = unknown>(path: string, params?: Record<string, string>): Promise<PagedResult<T>>;

  getProducts(params?: { status?: string; page?: number; limit?: number }): Promise<PlatformProduct[]>;

  getProduct(platformProductId: string): Promise<PlatformProduct>;

  createProduct(data: Partial<PlatformProduct>): Promise<PlatformProduct>;

  updateProduct(platformProductId: string, data: Partial<PlatformProduct>): Promise<PlatformProduct>;

  deleteProduct(platformProductId: string): Promise<void>;

  uploadImage(platformProductId: string, imageSource: string, alt?: string): Promise<{ src: string; id?: string }>;

  getOrders(params?: { page?: number; limit?: number; after?: string; before?: string }): Promise<PlatformOrder[]>;

  getProductCount(params?: { status?: string }): Promise<number>;

  getSeoData(platformProductId: string): Promise<SeoData | null>;

  updateSeo(platformProductId: string, data: Partial<SeoData>): Promise<SeoData>;

  getInventory(platformProductId: string): Promise<InventoryData | null>;

  updateInventory(platformProductId: string, quantity: number, variantId?: string): Promise<void>;
}

export class PlatformNotSupportedError extends Error {
  constructor(platformType: string) {
    super(`La plataforma "${platformType}" aún no está soportada. Plataformas disponibles: shopify, woocommerce, prestashop, universal`);
    this.name = "PlatformNotSupportedError";
  }
}

export class FeatureNotSupportedError extends Error {
  constructor(platformType: string, feature: string) {
    super(`La plataforma "${platformType}" no soporta la función "${feature}"`);
    this.name = "FeatureNotSupportedError";
  }
}
