import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger.js";

interface CogsBenchmark {
  productCategory: string;
  manufacturingMethod: string;
  niche: string;
  avgMaterialCost: number;
  avgShippingDomestic: number;
  avgShippingInternational: number;
  avgPackagingCost: number;
  avgFulfillmentCost: number;
  avgPlatformFeePct: number;
  avgReturnRate: number;
  avgCac: number;
  sampleSize: number;
}

export async function ensureBenchmarkTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cogs_benchmarks (
      id SERIAL PRIMARY KEY,
      product_category TEXT NOT NULL,
      manufacturing_method TEXT NOT NULL DEFAULT 'unknown',
      niche TEXT NOT NULL DEFAULT 'general',
      avg_material_cost DECIMAL(10,4) DEFAULT 0,
      avg_shipping_domestic DECIMAL(10,4) DEFAULT 0,
      avg_shipping_international DECIMAL(10,4) DEFAULT 0,
      avg_packaging_cost DECIMAL(10,4) DEFAULT 0,
      avg_fulfillment_cost DECIMAL(10,4) DEFAULT 0,
      avg_platform_fee_pct DECIMAL(6,4) DEFAULT 0,
      avg_return_rate DECIMAL(6,4) DEFAULT 0,
      avg_cac DECIMAL(10,4) DEFAULT 0,
      sample_size INTEGER DEFAULT 0,
      last_updated TIMESTAMP DEFAULT NOW(),
      UNIQUE(product_category, manufacturing_method, niche)
    )
  `).catch(() => {});
}

export async function updateCogsBenchmark(params: {
  productCategory: string;
  manufacturingMethod: string;
  niche: string;
  materialCost: number;
  shippingDomestic: number;
  shippingInternational: number;
  packagingCost: number;
  fulfillmentCost: number;
  platformFeePct: number;
  returnRate: number;
  cac: number;
}): Promise<void> {
  try {
    await ensureBenchmarkTable();

    await db.execute(sql`
      INSERT INTO cogs_benchmarks 
        (product_category, manufacturing_method, niche, 
         avg_material_cost, avg_shipping_domestic, avg_shipping_international,
         avg_packaging_cost, avg_fulfillment_cost, avg_platform_fee_pct,
         avg_return_rate, avg_cac, sample_size, last_updated)
      VALUES 
        (${params.productCategory}, ${params.manufacturingMethod}, ${params.niche},
         ${params.materialCost}, ${params.shippingDomestic}, ${params.shippingInternational},
         ${params.packagingCost}, ${params.fulfillmentCost}, ${params.platformFeePct},
         ${params.returnRate}, ${params.cac}, 1, NOW())
      ON CONFLICT (product_category, manufacturing_method, niche) DO UPDATE SET
        avg_material_cost = (cogs_benchmarks.avg_material_cost * cogs_benchmarks.sample_size + ${params.materialCost}) / (cogs_benchmarks.sample_size + 1),
        avg_shipping_domestic = (cogs_benchmarks.avg_shipping_domestic * cogs_benchmarks.sample_size + ${params.shippingDomestic}) / (cogs_benchmarks.sample_size + 1),
        avg_shipping_international = (cogs_benchmarks.avg_shipping_international * cogs_benchmarks.sample_size + ${params.shippingInternational}) / (cogs_benchmarks.sample_size + 1),
        avg_packaging_cost = (cogs_benchmarks.avg_packaging_cost * cogs_benchmarks.sample_size + ${params.packagingCost}) / (cogs_benchmarks.sample_size + 1),
        avg_fulfillment_cost = (cogs_benchmarks.avg_fulfillment_cost * cogs_benchmarks.sample_size + ${params.fulfillmentCost}) / (cogs_benchmarks.sample_size + 1),
        avg_platform_fee_pct = (cogs_benchmarks.avg_platform_fee_pct * cogs_benchmarks.sample_size + ${params.platformFeePct}) / (cogs_benchmarks.sample_size + 1),
        avg_return_rate = (cogs_benchmarks.avg_return_rate * cogs_benchmarks.sample_size + ${params.returnRate}) / (cogs_benchmarks.sample_size + 1),
        avg_cac = (cogs_benchmarks.avg_cac * cogs_benchmarks.sample_size + ${params.cac}) / (cogs_benchmarks.sample_size + 1),
        sample_size = cogs_benchmarks.sample_size + 1,
        last_updated = NOW()
    `);

    logger.info({ 
      category: params.productCategory, 
      method: params.manufacturingMethod, 
      niche: params.niche 
    }, "📊 COGS benchmark updated");
  } catch (err) {
    logger.warn({ err }, "Failed to update COGS benchmark — non-critical");
  }
}

export async function getCogsBenchmark(
  productCategory: string,
  manufacturingMethod: string,
  niche: string
): Promise<CogsBenchmark | null> {
  try {
    await ensureBenchmarkTable();

    const result = await db.execute(sql`
      SELECT * FROM cogs_benchmarks 
      WHERE product_category = ${productCategory}
        AND (manufacturing_method = ${manufacturingMethod} OR manufacturing_method = 'unknown')
        AND (niche = ${niche} OR niche = 'general')
      ORDER BY 
        CASE WHEN manufacturing_method = ${manufacturingMethod} AND niche = ${niche} THEN 0
             WHEN manufacturing_method = ${manufacturingMethod} THEN 1
             WHEN niche = ${niche} THEN 2
             ELSE 3 END,
        sample_size DESC
      LIMIT 1
    `);

    const rows = (result as any).rows;
    return rows?.[0] ?? null;
  } catch {
    return null;
  }
}
