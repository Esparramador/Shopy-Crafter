export type TestType = "image" | "price";
export type TestStatus = "draft" | "running" | "paused" | "completed" | "cancelled";
export type ImageStyle = "lifestyle" | "studio" | "context" | "detail" | "minimalist";
export type WinnerStrategy = "auto_winner" | "manual_review" | "extend_if_inconclusive";

export interface ShopifyProduct {
  id: string;
  shopifyId: number;
  title: string;
  imageUrl?: string;
  imageUrls?: string[];
  currentPrice: number;
  currency: string;
  category?: string;
  cogsTotal?: number;
  marginPct?: number;
}

export interface ImageAnalysis {
  imageUrl: string;
  scoreOverall: number;
  scoreComposition: number;
  scoreLighting: number;
  scoreContext: number;
  scoreAppeal: number;
  scoreClarity: number;
  warnings: string[];
  strengths: string[];
  improvementSuggestions: string[];
  detectedElements: string[];
  analyzedAt: string;
}

export interface ImageVariant {
  id: string;
  style: ImageStyle;
  url: string;
  prompt: string;
  generationProvider: "runway" | "replicate" | "dalle" | "gemini" | "stable_diffusion" | "nano-banana";
  generationCost: number;
  analysis: ImageAnalysis;
  generatedAt: string;
}

export interface CompetitorPrice {
  source: string;
  storeName: string;
  productTitle: string;
  url: string;
  price: number;
  currency: string;
  similarity: number;
  scrapedAt: string;
}

export interface CompetitorAnalysis {
  productId: string;
  totalSourcesScraped: number;
  competitors: CompetitorPrice[];
  priceStats: {
    min: number;
    max: number;
    median: number;
    average: number;
    yourPosition: "underpriced" | "fair" | "premium" | "overpriced";
    percentileRank: number;
  };
  source: "scraped" | "ai_estimate";
  reasoning?: string;
  analyzedAt: string;
}

export interface SupplierOption {
  supplierId: string;
  supplierName: string;
  costPerUnit: number;
  totalCOGSImpact: number;
  qualityScore: number;
  leadTimeDays: number;
  isCurrent: boolean;
  isRecommended: boolean;
  savingsPerUnit: number;
}

export interface SupplierImpactAnalysis {
  productId: string;
  currentCOGS: number;
  bestAlternativeCOGS: number;
  potentialSavingsPerUnit: number;
  potentialSavingsAnnual: number;
  options: SupplierOption[];
  analyzedAt: string;
}

export interface PriceRecommendation {
  conservative: number;
  optimal: number;
  aggressive: number;
  justification: string;
  risks: string[];
}

export interface TestConfigBase {
  productId: string;
  hypothesis: string;
  primaryMetric: "conversion_rate" | "aov" | "revenue_per_visitor" | "ctr" | "add_to_cart";
  secondaryMetrics: string[];
  splitTraffic: number;
  durationDays: number;
  minVisitors: number;
  minConfidence: number;
  winnerStrategy: WinnerStrategy;
  autoApplyWinner: boolean;
}

export interface ImageTestConfig extends TestConfigBase {
  type: "image";
  controlImageUrl: string;
  challengerImageUrl: string;
  challengerVariantId: string;
}

export interface PriceTestConfig extends TestConfigBase {
  type: "price";
  controlPrice: number;
  challengerPrice: number;
  competitorContext: CompetitorAnalysis;
  supplierContext?: SupplierImpactAnalysis;
}

export interface VariantStats {
  visitors: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
  aov: number;
  addedToCart: number;
}

export interface TestStats {
  variantA: VariantStats;
  variantB: VariantStats;
  winner?: "A" | "B" | null;
  pValue: number;
  confidence: number;
  isSignificant: boolean;
  visitorsTotal: number;
  daysElapsed: number;
  daysRemaining: number;
}

export interface ABTest {
  id: string;
  shopId: string;
  product: ShopifyProduct;
  config: ImageTestConfig | PriceTestConfig;
  status: TestStatus;
  stats?: TestStats;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  winnerAppliedAt?: string;
  insights?: string[];
}

export interface ABTestingKPIs {
  activeTests: number;
  completedTests: number;
  winRate: number;
  avgConfidence: number;
  revenueImpact30d: number;
  testsThisMonth: number;
  totalLearnings: number;
}

export interface TestHistoryEntry {
  id: string;
  productTitle: string;
  productImageUrl?: string;
  type: TestType;
  hypothesis: string;
  status: TestStatus;
  winnerVariant: "A" | "B" | null;
  conversionLift: number;
  revenueImpact: number;
  durationDays: number;
  completedAt: string;
}
