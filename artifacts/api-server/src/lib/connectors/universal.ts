import type { Project } from "@workspace/db";
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
import { FeatureNotSupportedError } from "./types";
import type { PlatformType } from "@workspace/db";
import { safeFetch, scrapeWebsite, validateAuditUrl, validateUrlWithDnsCheck, type WebScrapingResult } from "../web-scraper.js";
import { runDualPageSpeed, type PageSpeedResult } from "../pagespeed.js";

const NOT_SUPPORTED_MSG = "Los proyectos de auditoría universal no gestionan productos";

export interface FullAuditResult {
  url: string;
  scraping: WebScrapingResult | null;
  pageSpeedMobile: PageSpeedResult | null;
  pageSpeedDesktop: PageSpeedResult | null;
  pageSpeedSummary: string;
}

export class UniversalAuditConnector implements IPlatformConnector {
  readonly platformType: PlatformType = "universal";
  readonly projectId: number;
  readonly storeDomain: string;

  constructor(project: Project) {
    this.projectId = project.id;
    this.storeDomain = project.shopDomain;
  }

  private getUrl(): string {
    return this.storeDomain.startsWith("http") ? this.storeDomain : `https://${this.storeDomain}`;
  }

  supportsFeature(feature: PlatformFeature): boolean {
    return feature === "audit" || feature === "seo_read";
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const url = this.getUrl();
    const urlError = validateAuditUrl(url);
    if (urlError) {
      return {
        connected: false,
        storeName: this.storeDomain,
        platformInfo: "Universal Web Audit",
        productCount: null,
        tokenValid: false,
        error: urlError,
      };
    }

    try {
      await validateUrlWithDnsCheck(url);
    } catch (err) {
      return {
        connected: false,
        storeName: this.storeDomain,
        platformInfo: "Universal Web Audit",
        productCount: null,
        tokenValid: false,
        error: err instanceof Error ? err.message : "URL no permitida",
      };
    }

    try {
      const resp = await safeFetch(url, {
        method: "HEAD",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ShopyCrafter/1.0)" },
        signal: AbortSignal.timeout(15_000),
      });
      const isReachable = resp.ok || resp.status === 301 || resp.status === 302;
      return {
        connected: isReachable,
        storeName: this.storeDomain,
        platformInfo: `Universal Web Audit (HTTP ${resp.status})`,
        productCount: null,
        tokenValid: isReachable,
        error: isReachable ? null : `HTTP ${resp.status}`,
      };
    } catch (err) {
      return {
        connected: false,
        storeName: this.storeDomain,
        platformInfo: "Universal Web Audit",
        productCount: null,
        tokenValid: false,
        error: err instanceof Error ? err.message : "No se pudo acceder a la URL",
      };
    }
  }

  async refreshAuth(): Promise<string | null> {
    return null;
  }

  async request<T = unknown>(_method: string, _path: string, _body?: unknown): Promise<T> {
    throw new FeatureNotSupportedError("universal", "request");
  }

  async requestPaged<T = unknown>(_path: string): Promise<PagedResult<T>> {
    throw new FeatureNotSupportedError("universal", "requestPaged");
  }

  async getProducts(): Promise<PlatformProduct[]> {
    throw new FeatureNotSupportedError("universal", NOT_SUPPORTED_MSG);
  }

  async getProduct(_id: string): Promise<PlatformProduct> {
    throw new FeatureNotSupportedError("universal", NOT_SUPPORTED_MSG);
  }

  async createProduct(_data: Partial<PlatformProduct>): Promise<PlatformProduct> {
    throw new FeatureNotSupportedError("universal", NOT_SUPPORTED_MSG);
  }

  async updateProduct(_id: string, _data: Partial<PlatformProduct>): Promise<PlatformProduct> {
    throw new FeatureNotSupportedError("universal", NOT_SUPPORTED_MSG);
  }

  async deleteProduct(_id: string): Promise<void> {
    throw new FeatureNotSupportedError("universal", NOT_SUPPORTED_MSG);
  }

  async uploadImage(_id: string, _src: string): Promise<{ src: string; id?: string }> {
    throw new FeatureNotSupportedError("universal", NOT_SUPPORTED_MSG);
  }

  async getOrders(): Promise<PlatformOrder[]> {
    throw new FeatureNotSupportedError("universal", NOT_SUPPORTED_MSG);
  }

  async getProductCount(): Promise<number> {
    return 0;
  }

  async getSeoData(_id: string): Promise<SeoData | null> {
    const url = this.getUrl();
    try {
      const scraping = await scrapeWebsite(url);
      return {
        metaTitle: scraping.title ?? "",
        metaDescription: scraping.metaDescription ?? "",
        focusKeyword: scraping.metaKeywords?.split(",")[0]?.trim() ?? undefined,
        handle: new URL(url).hostname,
      };
    } catch {
      return null;
    }
  }

  async updateSeo(_id: string, _data: Partial<SeoData>): Promise<SeoData> {
    throw new FeatureNotSupportedError("universal", NOT_SUPPORTED_MSG);
  }

  async getInventory(_id: string): Promise<InventoryData | null> {
    throw new FeatureNotSupportedError("universal", NOT_SUPPORTED_MSG);
  }

  async updateInventory(_id: string, _qty: number): Promise<void> {
    throw new FeatureNotSupportedError("universal", NOT_SUPPORTED_MSG);
  }

  async runFullAudit(): Promise<FullAuditResult> {
    const url = this.getUrl();
    const urlError = validateAuditUrl(url);
    if (urlError) {
      throw new Error(urlError);
    }

    const [scrapingSettled, pageSpeedSettled] = await Promise.allSettled([
      scrapeWebsite(url),
      runDualPageSpeed(url),
    ]);

    const scraping = scrapingSettled.status === "fulfilled" ? scrapingSettled.value : null;
    const pageSpeed = pageSpeedSettled.status === "fulfilled" ? pageSpeedSettled.value : null;

    return {
      url,
      scraping,
      pageSpeedMobile: pageSpeed?.mobile ?? null,
      pageSpeedDesktop: pageSpeed?.desktop ?? null,
      pageSpeedSummary: pageSpeed?.summary ?? "No se pudieron obtener datos de PageSpeed.",
    };
  }
}
