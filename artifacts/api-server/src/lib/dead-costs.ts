import { db } from "@workspace/db";
import { productsTable, cogsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "./logger.js";

export interface DeadCostItem {
  productId: string;
  title: string;
  cost: number;
  reason: string;
  category: "slow_moving" | "overstock" | "high_return" | "negative_margin" | "hidden_fee" | "storage" | "obsolescence";
  severity: "critical" | "high" | "medium" | "low";
  recommendation: string;
}

export interface DeadCostAnalysis {
  projectId: number;
  totalDeadCost: number;
  deadCostPctOfCogs: number;
  deadCostPctOfRevenue: number;
  items: DeadCostItem[];
  summary: string;
  analyzedAt: string;
}

interface ProductWithCogs {
  shopifyProductId: string;
  title: string;
  price: number;
  status: string | null;
  inventoryQuantity: number | null;
  avgDailySales: number | null;
  totalCogs: number;
  marginPct: number;
  returnRate: number;
  warehouseCostPerUnit: number;
  shippingDomestic: number;
  shippingInternational: number;
  fulfillmentFee: number;
  platformFee: number;
  marketingCost: number;
}

export async function analyzeDeadCosts(projectId: number): Promise<DeadCostAnalysis> {
  const items: DeadCostItem[] = [];

  let products: ProductWithCogs[] = [];
  try {
    const rawProducts = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
    const rawCogs = await db.select().from(cogsTable).where(eq(cogsTable.projectId, projectId));

    const cogsMap = new Map<string, any>();
    for (const c of rawCogs) {
      cogsMap.set(String(c.shopifyProductId), c);
    }

    let salesData: any[] = [];
    try {
      const result = await db.execute(sql`
        SELECT product_id, SUM(quantity_sold) as total_sold, 
               COUNT(DISTINCT DATE(sale_date)) as days_active
        FROM sales_analytics 
        WHERE project_id = ${projectId} 
        GROUP BY product_id
      `);
      salesData = (result as any).rows || [];
    } catch {}

    const salesMap = new Map<string, { totalSold: number; daysActive: number }>();
    for (const s of salesData) {
      salesMap.set(String(s.product_id), {
        totalSold: Number(s.total_sold) || 0,
        daysActive: Number(s.days_active) || 1,
      });
    }

    products = rawProducts.map(p => {
      const c = cogsMap.get(String(p.shopifyProductId));
      const sale = salesMap.get(String(p.shopifyProductId));
      const price = Number(p.price) || 0;
      let costData: Record<string, any> = {};
      try {
        costData = c?.costData ? (typeof c.costData === "string" ? JSON.parse(c.costData) : c.costData) : {};
      } catch { costData = {}; }
      const n = (k: string) => parseFloat(costData[k]) || 0;

      const production = n("unitCost") + n("materialCost") + n("fabricCost") + n("laborCostPerUnit");
      const packaging = n("packagingCost") + n("labelCost");
      const logistics = n("shippingCostDomestic") + n("shippingCostInternational") + n("fulfillmentFee") + n("warehouseCostPerUnit");
      const platform = (price * n("shopifyPaymentFee")) + n("paymentProcessingFee") + n("platformCommission");
      const marketing = n("cac") + n("digitalMarketingCost");
      const totalCogs = production + packaging + logistics + platform + marketing;
      const marginPct = price > 0 ? ((price - totalCogs) / price) * 100 : 0;

      const rawInv = Number((p as any).inventoryQuantity) || 0;

      return {
        shopifyProductId: String(p.shopifyProductId),
        title: p.title || "Sin título",
        price,
        status: p.status,
        inventoryQuantity: Math.max(0, rawInv),
        avgDailySales: sale ? sale.totalSold / sale.daysActive : null,
        totalCogs,
        marginPct,
        returnRate: n("returnRate"),
        warehouseCostPerUnit: n("warehouseCostPerUnit"),
        shippingDomestic: n("shippingCostDomestic"),
        shippingInternational: n("shippingCostInternational"),
        fulfillmentFee: n("fulfillmentFee"),
        platformFee: platform,
        marketingCost: marketing,
      };
    });
  } catch (err) {
    logger.error("Dead costs: error loading products/cogs");
  }

  for (const p of products) {
    if (p.marginPct < 0) {
      items.push({
        productId: p.shopifyProductId,
        title: p.title,
        cost: Math.abs(p.price - p.totalCogs),
        reason: `Margen negativo: ${Math.round(p.marginPct)}%. Cada venta genera pérdida de €${Math.round(Math.abs(p.price - p.totalCogs) * 100) / 100}`,
        category: "negative_margin",
        severity: "critical",
        recommendation: "Subir precio, renegociar proveedor o eliminar del catálogo",
      });
    } else if (p.marginPct < 10) {
      items.push({
        productId: p.shopifyProductId,
        title: p.title,
        cost: Math.round((p.totalCogs * 0.1) * 100) / 100,
        reason: `Margen ultra-bajo (${Math.round(p.marginPct * 10) / 10}%). Cualquier devolución o descuento genera pérdida`,
        category: "negative_margin",
        severity: "high",
        recommendation: "Aumentar precio mínimo 15% o reducir costes de fulfillment",
      });
    }

    if (p.returnRate > 0.12) {
      const returnCost = p.price * p.returnRate * 0.3;
      items.push({
        productId: p.shopifyProductId,
        title: p.title,
        cost: Math.round(returnCost * 100) / 100,
        reason: `Tasa de devolución ${Math.round(p.returnRate * 100)}% — cada devolución cuesta ~€${Math.round(returnCost * 100) / 100}`,
        category: "high_return",
        severity: p.returnRate > 0.2 ? "critical" : "high",
        recommendation: "Mejorar descripciones, fotos y guía de tallas. Verificar calidad del producto",
      });
    }

    if (p.inventoryQuantity > 10 && (p.avgDailySales === null || p.avgDailySales < 0.05)) {
      const daysToSell = (p.avgDailySales && p.avgDailySales > 0) ? Math.round(p.inventoryQuantity / p.avgDailySales) : 999;
      const storageCost = (p.warehouseCostPerUnit || 0.5) * p.inventoryQuantity * (daysToSell / 30);
      items.push({
        productId: p.shopifyProductId,
        title: p.title,
        cost: Math.round(storageCost * 100) / 100,
        reason: p.avgDailySales === null
          ? `Sin datos de ventas y ${p.inventoryQuantity} uds en stock. Coste almacén estimado: €${Math.round(storageCost * 100) / 100}/mes`
          : `Slow-moving: ${p.inventoryQuantity} uds en stock, ${daysToSell} días para vender. Coste almacén acumulado: €${Math.round(storageCost * 100) / 100}`,
        category: "slow_moving",
        severity: daysToSell > 365 ? "critical" : daysToSell > 180 ? "high" : "medium",
        recommendation: daysToSell > 365
          ? "Liquidar stock con descuento agresivo o donar para deducción fiscal"
          : "Crear campaña de remarketing específica o bundle con producto popular",
      });
    }

    if (p.inventoryQuantity > 0 && p.warehouseCostPerUnit > 0) {
      const monthlyStorageCost = p.warehouseCostPerUnit * p.inventoryQuantity;
      if (monthlyStorageCost > 50) {
        items.push({
          productId: p.shopifyProductId,
          title: p.title,
          cost: Math.round(monthlyStorageCost * 100) / 100,
          reason: `Coste almacén: ${p.inventoryQuantity} uds × €${p.warehouseCostPerUnit}/ud = €${Math.round(monthlyStorageCost * 100) / 100}/mes`,
          category: "storage",
          severity: monthlyStorageCost > 200 ? "high" : "medium",
          recommendation: "Optimizar rotación de inventario o negociar tarifa almacén. Considerar dropshipping para este producto",
        });
      }
    }

    if (p.inventoryQuantity > 0 && p.avgDailySales && p.avgDailySales > 0) {
      const optimalStock = Math.ceil(p.avgDailySales * 45);
      if (p.inventoryQuantity > optimalStock * 3) {
        const excessUnits = p.inventoryQuantity - optimalStock;
        const capitalMuerto = excessUnits * p.totalCogs;
        items.push({
          productId: p.shopifyProductId,
          title: p.title,
          cost: Math.round(capitalMuerto * 100) / 100,
          reason: `Overstock: ${p.inventoryQuantity} uds (óptimo: ${optimalStock}). Capital inmovilizado: €${Math.round(capitalMuerto)}`,
          category: "overstock",
          severity: capitalMuerto > 500 ? "high" : "medium",
          recommendation: `Reducir próximo pedido. Stock óptimo: ${optimalStock} uds (45 días de cobertura)`,
        });
      }
    }

    if (p.marketingCost > 0 && p.avgDailySales !== null && p.avgDailySales < 0.02) {
      items.push({
        productId: p.shopifyProductId,
        title: p.title,
        cost: Math.round(p.marketingCost * 30 * 100) / 100,
        reason: `CAC ineficiente: €${p.marketingCost}/ud en marketing pero casi sin ventas (~${Math.round(p.avgDailySales * 30)} uds/mes)`,
        category: "hidden_fee",
        severity: "high",
        recommendation: "Pausar gasto publicitario en este producto y reasignar budget a productos con tracción",
      });
    }

    if (p.status === "draft" || p.status === "archived") {
      const obsolescenceCost = p.inventoryQuantity ? p.inventoryQuantity * p.totalCogs * 0.02 : 0;
      if (obsolescenceCost > 0) {
        items.push({
          productId: p.shopifyProductId,
          title: p.title,
          cost: Math.round(obsolescenceCost * 100) / 100,
          reason: `Producto ${p.status}: sin venta activa pero con stock. Depreciación mensual estimada: €${Math.round(obsolescenceCost * 100) / 100}`,
          category: "obsolescence",
          severity: "medium",
          recommendation: "Reactivar con nueva fotografía/descripción o liquidar stock restante",
        });
      }
    }
  }

  items.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return b.cost - a.cost;
  });

  const totalDeadCost = items.reduce((sum, i) => sum + i.cost, 0);
  const totalCogsAll = products.reduce((sum, p) => sum + p.totalCogs, 0);
  const totalRevenueAll = products.reduce((sum, p) => sum + p.price, 0);

  const criticalCount = items.filter(i => i.severity === "critical").length;
  const highCount = items.filter(i => i.severity === "high").length;

  const summary = [
    `Análisis de costes muertos completado para ${products.length} productos.`,
    `Se identificaron ${items.length} fuentes de coste muerto por un total de €${Math.round(totalDeadCost * 100) / 100}.`,
    criticalCount > 0 ? `${criticalCount} alertas CRÍTICAS requieren acción inmediata.` : "",
    highCount > 0 ? `${highCount} alertas ALTAS recomiendan revisión en los próximos 30 días.` : "",
    totalDeadCost > 0 && totalRevenueAll > 0
      ? `Los costes muertos representan el ${Math.round((totalDeadCost / totalRevenueAll) * 1000) / 10}% del revenue total.`
      : "",
  ].filter(Boolean).join(" ");

  return {
    projectId,
    totalDeadCost: Math.round(totalDeadCost * 100) / 100,
    deadCostPctOfCogs: totalCogsAll > 0 ? Math.round((totalDeadCost / totalCogsAll) * 1000) / 10 : 0,
    deadCostPctOfRevenue: totalRevenueAll > 0 ? Math.round((totalDeadCost / totalRevenueAll) * 1000) / 10 : 0,
    items,
    summary,
    analyzedAt: new Date().toISOString(),
  };
}
