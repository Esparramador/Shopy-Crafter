import type { Project } from "@workspace/db";
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
import { FeatureNotSupportedError } from "./types";

export class StripeConnector implements IPlatformConnector {
  readonly platformType = "stripe" as const;
  readonly projectId: number;
  readonly storeDomain: string;
  private readonly project: Project;

  constructor(project: Project) {
    this.project = project;
    this.projectId = project.id;
    this.storeDomain = project.shopDomain;
  }

  private get secretKey(): string {
    return safeDecrypt(this.project.clientSecret) || this.project.clientSecret;
  }

  private async stripeGet<T>(path: string): Promise<T> {
    const res = await fetch(`https://api.stripe.com/v1${path}`, {
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: { message?: string; code?: string } };
      const msg = body?.error?.message ?? `HTTP ${res.status}`;
      const code = body?.error?.code ?? "";
      if (res.status === 401 || code === "api_key_expired" || code === "invalid_api_key") {
        throw Object.assign(new Error(`Clave API inválida o expirada: ${msg}`), { errorCode: "AUTH_FAILED" });
      }
      throw new Error(msg);
    }
    return res.json() as Promise<T>;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const account = await this.stripeGet<{
        id: string;
        business_profile?: { name?: string };
        display_name?: string;
        email?: string;
        country?: string;
        default_currency?: string;
      }>("/account");

      const storeName =
        account.business_profile?.name ||
        account.display_name ||
        account.email ||
        account.id;

      return {
        connected: true,
        storeName: storeName ?? null,
        platformInfo: `Stripe · ${account.country ?? ""} · ${account.default_currency?.toUpperCase() ?? ""}`,
        productCount: null,
        tokenValid: true,
        error: null,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      const code = (err as { errorCode?: string })?.errorCode ?? "AUTH_FAILED";
      return {
        connected: false,
        storeName: null,
        platformInfo: null,
        productCount: null,
        tokenValid: false,
        error: msg,
        errorCode: code,
      };
    }
  }

  // @ts-ignore
  async getProducts(_page?: number, _limit?: number): Promise<PagedResult<PlatformProduct>> {
    throw new FeatureNotSupportedError("getProducts", "stripe");
  }

  async getProductById(_id: string): Promise<PlatformProduct | null> {
    throw new FeatureNotSupportedError("getProductById", "stripe");
  }

  async updateProduct(_id: string, _data: Partial<PlatformProduct>): Promise<PlatformProduct> {
    throw new FeatureNotSupportedError("updateProduct", "stripe");
  }

  // @ts-ignore
  async getOrders(_page?: number, _limit?: number): Promise<PagedResult<PlatformOrder>> {
    throw new FeatureNotSupportedError("getOrders", "stripe");
  }

  async getSeoData(_productId: string): Promise<SeoData | null> {
    throw new FeatureNotSupportedError("getSeoData", "stripe");
  }

  async updateSeoData(_productId: string, _data: Partial<SeoData>): Promise<void> {
    throw new FeatureNotSupportedError("updateSeoData", "stripe");
  }

  async getInventory(_productId: string): Promise<InventoryData | null> {
    throw new FeatureNotSupportedError("getInventory", "stripe");
  }

  // @ts-ignore
  async updateInventory(_productId: string, _data: Partial<InventoryData>): Promise<void> {
    throw new FeatureNotSupportedError("updateInventory", "stripe");
  }

  getSupportedFeatures(): PlatformFeature[] {
    return [];
  }
}
