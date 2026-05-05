import { fetchApi } from "@/lib/api";
import type {
  ABTest, ABTestingKPIs, TestHistoryEntry, TestStats,
  ShopifyProduct, ImageAnalysis, ImageVariant, ImageStyle,
  CompetitorAnalysis, SupplierImpactAnalysis, PriceRecommendation, PriceForecast,
  ImageTestConfig, PriceTestConfig,
} from "./types";

export function createABTestingAPI(projectId: number) {
  const base = `/api/projects/${projectId}/ab-tests`;

  return {
    async getKPIs(): Promise<ABTestingKPIs> {
      return fetchApi<ABTestingKPIs>(`${base}/_kpis`);
    },
    async getActiveTests(): Promise<ABTest[]> {
      return fetchApi<ABTest[]>(`${base}/_active`);
    },
    async getHistory(limit = 20): Promise<TestHistoryEntry[]> {
      return fetchApi<TestHistoryEntry[]>(`${base}/_history?limit=${limit}`);
    },
    async getProducts(): Promise<ShopifyProduct[]> {
      return fetchApi<ShopifyProduct[]>(`${base}/_products`);
    },
    async analyzeImage(productId: string, imageUrl: string): Promise<ImageAnalysis> {
      return fetchApi<ImageAnalysis>(`${base}/image/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, imageUrl }),
      });
    },
    async generateImageVariant(productId: string, style: ImageStyle): Promise<ImageVariant> {
      return fetchApi<ImageVariant>(`${base}/image/generate-variant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, style }),
      });
    },
    async generateAllVariants(productId: string): Promise<ImageVariant[]> {
      return fetchApi<ImageVariant[]>(`${base}/image/generate-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
    },
    async analyzeCompetitors(productId: string): Promise<CompetitorAnalysis> {
      return fetchApi<CompetitorAnalysis>(`${base}/price/competitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
    },
    async analyzeSupplierImpact(productId: string): Promise<SupplierImpactAnalysis> {
      return fetchApi<SupplierImpactAnalysis>(`${base}/price/supplier-impact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
    },
    async recommendPrice(productId: string): Promise<PriceRecommendation> {
      return fetchApi<PriceRecommendation>(`${base}/price/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
    },
    async forecastPrice(payload: {
      productId: string;
      controlPrice: number;
      challengerPrice: number;
      hypothesis?: string;
      durationDays?: number;
      minVisitors?: number;
      competitorContext?: CompetitorAnalysis | null;
      supplierContext?: SupplierImpactAnalysis | null;
    }): Promise<PriceForecast> {
      return fetchApi<PriceForecast>(`${base}/price/forecast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    async createImageTest(config: ImageTestConfig): Promise<ABTest> {
      return fetchApi<ABTest>(`${base}/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
    },
    async createPriceTest(config: PriceTestConfig): Promise<ABTest> {
      return fetchApi<ABTest>(`${base}/price`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
    },
    async startTest(testId: string): Promise<ABTest> {
      return fetchApi<ABTest>(`${base}/${testId}/start`, { method: "POST" });
    },
    async pauseTest(testId: string): Promise<ABTest> {
      return fetchApi<ABTest>(`${base}/${testId}/pause`, { method: "POST" });
    },
    async resumeTest(testId: string): Promise<ABTest> {
      return fetchApi<ABTest>(`${base}/${testId}/resume`, { method: "POST" });
    },
    async cancelTest(testId: string): Promise<ABTest> {
      return fetchApi<ABTest>(`${base}/${testId}/cancel`, { method: "POST" });
    },
    async getStats(testId: string): Promise<TestStats> {
      return fetchApi<TestStats>(`${base}/${testId}/stats`);
    },
    async declareWinner(testId: string, winner: "A" | "B"): Promise<ABTest> {
      return fetchApi<ABTest>(`${base}/${testId}/declare-winner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner, applyToShopify: true }),
      });
    },
    async generateReport(testId: string): Promise<{ reportUrl: string }> {
      return fetchApi<{ reportUrl: string }>(`${base}/${testId}/report`, { method: "POST" });
    },
  };
}

export type ABTestingAPI = ReturnType<typeof createABTestingAPI>;
