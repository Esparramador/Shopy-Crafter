import { Router } from "express";
import { db } from "@workspace/db";
import { inventoryTrackingTable, restockOrdersTable, projectsTable, salesAnalyticsTable } from "@workspace/db";
import { eq, desc, lte, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { askClaudeWithBrain, learnFromOperation, SHOPIFY_EXPERT_SYSTEM } from "../lib/claude.js";
import { shopifyRequest } from "../lib/shopify.js";

const router = Router();

router.get("/inventory/tracking", async (req, res): Promise<void> => {
  const { projectId } = req.query as Record<string, string>;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }
  const items = await db.select().from(inventoryTrackingTable)
    .where(eq(inventoryTrackingTable.projectId, projectId))
    .orderBy(inventoryTrackingTable.daysRemaining);
  res.json(items);
});

router.post("/inventory/tracking", async (req, res): Promise<void> => {
  const { projectId, productId, variantId, productTitle, currentStock, avgDailySales, supplierEmail, supplierLeadDays } = req.body;
  if (!projectId || !productId) { res.status(400).json({ error: "projectId and productId required" }); return; }

  const daysRemaining = avgDailySales > 0 ? Math.floor(currentStock / avgDailySales) : 999;
  let status = "healthy";
  if (daysRemaining <= 7) status = "critical";
  else if (daysRemaining <= 14) status = "warning";

  const existing = await db.select().from(inventoryTrackingTable)
    .where(eq(inventoryTrackingTable.productId, productId)).limit(1);

  if (existing.length > 0) {
    const [updated] = await db.update(inventoryTrackingTable)
      .set({ currentStock, avgDailySales, daysRemaining, status, updatedAt: new Date() })
      .where(eq(inventoryTrackingTable.productId, productId))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(inventoryTrackingTable).values({
      id: randomUUID(), projectId, productId, variantId, productTitle,
      currentStock, avgDailySales, daysRemaining, status,
      supplierEmail, supplierLeadDays: supplierLeadDays ?? 14,
    }).returning();
    res.json(created);
  }
});

router.get("/inventory/alerts", async (req, res): Promise<void> => {
  const { projectId } = req.query as Record<string, string>;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }
  const critical = await db.select().from(inventoryTrackingTable)
    .where(eq(inventoryTrackingTable.projectId, projectId))
    .orderBy(inventoryTrackingTable.daysRemaining);
  const alerts = critical.filter(i => i.daysRemaining !== null && i.daysRemaining <= 14);
  res.json(alerts);
});

router.post("/inventory/restock-email", async (req, res): Promise<void> => {
  const { projectId, productId, productTitle, currentStock, daysRemaining, supplierEmail } = req.body;
  if (!projectId || !productId) { res.status(400).json({ error: "Required fields missing" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));

  const prompt = `Draft a professional supplier restock email for an e-commerce store.
Store: ${project?.name || "Store"}
Product: ${productTitle}
Current stock: ${currentStock} units
Days remaining: ${daysRemaining} days
Supplier email: ${supplierEmail || "supplier@example.com"}

Write a concise, professional email requesting restock. Include:
- Urgency level based on days remaining
- Estimated order quantity (suggest 3x average monthly sales or 90 units if unknown)
- Request for delivery timeline

Return JSON: { "subject": "...", "body": "...", "urgency": "critical|high|medium", "suggestedQuantity": 90 }`;

  try {
    const niche = project?.storeNiche ?? undefined;
    const text = await askClaudeWithBrain(
      parseInt(projectId),
      [{ role: "user", content: prompt }],
      `${SHOPIFY_EXPERT_SYSTEM} You are also an expert in supply chain and inventory management for e-commerce. Generate professional supplier communications that reflect the store's brand voice.`,
      "general",
      niche
    );
    const match = text.match(/\{[\s\S]*\}/);
    const email = match ? JSON.parse(match[0]) : { subject: "Restock Request", body: text, urgency: "high", suggestedQuantity: 90 };

    const [order] = await db.insert(restockOrdersTable).values({
      id: randomUUID(), projectId, productId, productTitle,
      quantitySuggested: email.suggestedQuantity ?? 90,
      urgency: email.urgency ?? "high",
      emailDraft: email.body,
    }).returning();

    learnFromOperation({
      operationType: "inventory_restock",
      title: `Restock: ${productTitle} — ${email.suggestedQuantity ?? 90} uds, urgencia: ${email.urgency ?? "high"}`,
      content: `Restock order created for "${productTitle}": qty ${email.suggestedQuantity ?? 90}, urgency ${email.urgency ?? "high"}.`,
      confidence: 0.8,
    });

    res.json({ ...email, orderId: order.id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/inventory/restock-orders", async (req, res): Promise<void> => {
  const { projectId } = req.query as Record<string, string>;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }
  const orders = await db.select().from(restockOrdersTable)
    .where(eq(restockOrdersTable.projectId, projectId))
    .orderBy(desc(restockOrdersTable.createdAt)).limit(20);
  res.json(orders);
});

router.post("/inventory/sync", async (req, res): Promise<void> => {
  const { projectId } = req.body;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  const items = await db.select().from(inventoryTrackingTable)
    .where(eq(inventoryTrackingTable.projectId, projectId));

  const stats = {
    total: items.length,
    critical: items.filter(i => i.status === "critical").length,
    warning: items.filter(i => i.status === "warning").length,
    healthy: items.filter(i => i.status === "healthy").length,
    totalStock: items.reduce((sum, i) => sum + (i.currentStock ?? 0), 0),
    totalSold: items.reduce((sum, i) => sum + (i.totalUnitsSold ?? 0), 0),
    uniqueProducts: new Set(items.map(i => i.productId)).size,
    outOfStock: items.filter(i => (i.currentStock ?? 0) === 0).length,
  };

  res.json({ synced: true, stats, timestamp: new Date().toISOString() });
});

router.get("/inventory/deep-report", async (req, res): Promise<void> => {
  const { projectId } = req.query as Record<string, string>;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  const items = await db.select().from(inventoryTrackingTable)
    .where(eq(inventoryTrackingTable.projectId, projectId));

  const byProduct: Record<string, { title: string; type: string; vendor: string; variants: typeof items; totalStock: number; totalSold: number }> = {};
  for (const item of items) {
    const pid = item.productId;
    if (!byProduct[pid]) {
      byProduct[pid] = { title: item.productTitle || "Unknown", type: item.productType || "", vendor: item.vendor || "", variants: [], totalStock: 0, totalSold: 0 };
    }
    byProduct[pid].variants.push(item);
    byProduct[pid].totalStock += item.currentStock ?? 0;
    byProduct[pid].totalSold += item.totalUnitsSold ?? 0;
  }

  const byOption: Record<string, Record<string, { stock: number; sold: number; count: number }>> = {};
  for (const item of items) {
    const addOption = (name: string | null, value: string | null) => {
      if (!name || !value) return;
      if (!byOption[name]) byOption[name] = {};
      if (!byOption[name][value]) byOption[name][value] = { stock: 0, sold: 0, count: 0 };
      byOption[name][value].stock += item.currentStock ?? 0;
      byOption[name][value].sold += item.totalUnitsSold ?? 0;
      byOption[name][value].count++;
    };
    addOption(item.option1Name, item.option1Value);
    addOption(item.option2Name, item.option2Value);
    addOption(item.option3Name, item.option3Value);
  }

  const byType: Record<string, { stock: number; sold: number; count: number; revenue: number }> = {};
  for (const item of items) {
    const t = item.productType || "Sin tipo";
    if (!byType[t]) byType[t] = { stock: 0, sold: 0, count: 0, revenue: 0 };
    byType[t].stock += item.currentStock ?? 0;
    byType[t].sold += item.totalUnitsSold ?? 0;
    byType[t].count++;
    byType[t].revenue += (item.totalUnitsSold ?? 0) * (item.price ?? 0);
  }

  const totalStock = items.reduce((s, i) => s + (i.currentStock ?? 0), 0);
  const totalSold = items.reduce((s, i) => s + (i.totalUnitsSold ?? 0), 0);
  const totalValue = items.reduce((s, i) => s + ((i.currentStock ?? 0) * (i.price ?? 0)), 0);
  const totalCost = items.reduce((s, i) => s + ((i.currentStock ?? 0) * (i.costPerItem ?? 0)), 0);
  const outOfStock = items.filter(i => (i.currentStock ?? 0) === 0);

  res.json({
    summary: {
      totalVariants: items.length,
      uniqueProducts: Object.keys(byProduct).length,
      totalStock,
      totalSold,
      totalStockValue: Math.round(totalValue * 100) / 100,
      totalCostValue: Math.round(totalCost * 100) / 100,
      estimatedMargin: totalValue > 0 ? Math.round((1 - totalCost / totalValue) * 10000) / 100 : 0,
      outOfStockCount: outOfStock.length,
      criticalCount: items.filter(i => i.status === "critical").length,
      warningCount: items.filter(i => i.status === "warning").length,
      healthyCount: items.filter(i => i.status === "healthy").length,
    },
    byProduct: Object.entries(byProduct).map(([id, p]) => ({
      productId: id,
      title: p.title,
      type: p.type,
      vendor: p.vendor,
      variantsCount: p.variants.length,
      totalStock: p.totalStock,
      totalSold: p.totalSold,
      variants: p.variants.map(v => ({
        variantId: v.variantId,
        title: v.variantTitle,
        sku: v.sku,
        option1: v.option1Name ? `${v.option1Name}: ${v.option1Value}` : null,
        option2: v.option2Name ? `${v.option2Name}: ${v.option2Value}` : null,
        option3: v.option3Name ? `${v.option3Name}: ${v.option3Value}` : null,
        stock: v.currentStock,
        sold: v.totalUnitsSold,
        price: v.price,
        cost: v.costPerItem,
        status: v.status,
        daysRemaining: v.daysRemaining,
      })),
    })).sort((a, b) => b.totalSold - a.totalSold),
    byOption,
    byType,
    outOfStock: outOfStock.map(i => ({
      productTitle: i.productTitle,
      variantTitle: i.variantTitle,
      sku: i.sku,
      option1: i.option1Value,
      option2: i.option2Value,
      option3: i.option3Value,
    })),
  });
});

router.post("/inventory/sync-orders", async (req, res): Promise<void> => {
  const { projectId } = req.body;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
    if (!project || !project.accessToken) { res.status(400).json({ error: "Project not found or no access" }); return; }

    const existingOrders = await db.select({ orderId: salesAnalyticsTable.orderId })
      .from(salesAnalyticsTable)
      .where(eq(salesAnalyticsTable.projectId, projectId));
    const existingOrderIds = new Set(existingOrders.map(o => o.orderId));

    const ordersData = await shopifyRequest<{ orders: Array<{
      id: number; name: string; created_at: string;
      customer?: { id: number; email: string; first_name: string; last_name: string };
      line_items: Array<{
        product_id: number; variant_id: number; title: string; variant_title: string;
        sku: string; quantity: number; price: string; total_discount: string;
        fulfillment_status: string | null;
      }>;
      financial_status: string; fulfillment_status: string | null;
      shipping_address?: { country: string; city: string };
      currency: string;
    }> }>(
      parseInt(projectId), project.shopDomain,
      "/orders.json?status=any&limit=250&fields=id,name,created_at,customer,line_items,financial_status,fulfillment_status,shipping_address,currency"
    );

    let inserted = 0;
    let failed = 0;
    for (const order of ordersData.orders) {
      if (existingOrderIds.has(String(order.id))) continue;

      for (const item of order.line_items) {
        const variantTracking = await db.select().from(inventoryTrackingTable)
          .where(eq(inventoryTrackingTable.variantId, String(item.variant_id))).limit(1);
        const vt = variantTracking[0];

        try {
          await db.insert(salesAnalyticsTable).values({
            id: randomUUID(),
            projectId,
            orderId: String(order.id),
            orderNumber: order.name,
            orderDate: new Date(order.created_at),
            customerId: order.customer?.id ? String(order.customer.id) : null,
            customerEmail: order.customer?.email || null,
            customerName: order.customer ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim() : null,
            productId: String(item.product_id),
            variantId: String(item.variant_id),
            productTitle: item.title,
            variantTitle: item.variant_title || "Default",
            sku: item.sku || null,
            option1Name: vt?.option1Name || null,
            option1Value: vt?.option1Value || null,
            option2Name: vt?.option2Name || null,
            option2Value: vt?.option2Value || null,
            option3Name: vt?.option3Name || null,
            option3Value: vt?.option3Value || null,
            quantity: item.quantity,
            unitPrice: parseFloat(item.price),
            totalPrice: parseFloat(item.price) * item.quantity,
            discount: parseFloat(item.total_discount || "0"),
            currency: order.currency || "EUR",
            fulfillmentStatus: order.fulfillment_status || null,
            financialStatus: order.financial_status || null,
            country: order.shipping_address?.country || null,
            city: order.shipping_address?.city || null,
          });
          inserted++;
        } catch {
          failed++;
        }
      }
    }

    learnFromOperation({
      operationType: "inventory_sync",
      title: `Sync de pedidos: ${inserted} lineas de ${ordersData.orders.length} pedidos importados`,
      content: `Synced ${ordersData.orders.length} orders with ${inserted} line items for project ${projectId}.`,
      confidence: 0.8,
    });

    res.json({ synced: true, ordersProcessed: ordersData.orders.length, lineItemsInserted: inserted, lineItemsFailed: failed });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/inventory/sales-analytics", async (req, res): Promise<void> => {
  const { projectId } = req.query as Record<string, string>;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  const sales = await db.select().from(salesAnalyticsTable)
    .where(eq(salesAnalyticsTable.projectId, projectId))
    .orderBy(desc(salesAnalyticsTable.orderDate));

  const topProducts: Record<string, { title: string; qty: number; revenue: number }> = {};
  const topVariants: Record<string, { title: string; variant: string; option1: string; option2: string; option3: string; qty: number; revenue: number }> = {};
  const byCustomer: Record<string, { name: string; email: string; orders: number; items: number; revenue: number }> = {};
  const byOption: Record<string, Record<string, { qty: number; revenue: number }>> = {};
  const byCountry: Record<string, { orders: number; revenue: number }> = {};

  for (const s of sales) {
    const pid = s.productId || "unknown";
    if (!topProducts[pid]) topProducts[pid] = { title: s.productTitle || "", qty: 0, revenue: 0 };
    topProducts[pid].qty += s.quantity ?? 0;
    topProducts[pid].revenue += s.totalPrice ?? 0;

    const vid = s.variantId || "unknown";
    if (!topVariants[vid]) topVariants[vid] = {
      title: s.productTitle || "", variant: s.variantTitle || "",
      option1: s.option1Value || "", option2: s.option2Value || "", option3: s.option3Value || "",
      qty: 0, revenue: 0,
    };
    topVariants[vid].qty += s.quantity ?? 0;
    topVariants[vid].revenue += s.totalPrice ?? 0;

    if (s.customerId) {
      if (!byCustomer[s.customerId]) byCustomer[s.customerId] = { name: s.customerName || "", email: s.customerEmail || "", orders: 0, items: 0, revenue: 0 };
      byCustomer[s.customerId].items += s.quantity ?? 0;
      byCustomer[s.customerId].revenue += s.totalPrice ?? 0;
    }

    const addOpt = (name: string | null, val: string | null) => {
      if (!name || !val) return;
      if (!byOption[name]) byOption[name] = {};
      if (!byOption[name][val]) byOption[name][val] = { qty: 0, revenue: 0 };
      byOption[name][val].qty += s.quantity ?? 0;
      byOption[name][val].revenue += s.totalPrice ?? 0;
    };
    addOpt(s.option1Name, s.option1Value);
    addOpt(s.option2Name, s.option2Value);
    addOpt(s.option3Name, s.option3Value);

    const country = s.country || "Desconocido";
    if (!byCountry[country]) byCountry[country] = { orders: 0, revenue: 0 };
    byCountry[country].orders++;
    byCountry[country].revenue += s.totalPrice ?? 0;
  }

  const uniqueOrders = new Set(sales.map(s => s.orderId));
  for (const s of sales) {
    if (s.customerId && byCustomer[s.customerId]) {
      byCustomer[s.customerId].orders = new Set(sales.filter(x => x.customerId === s.customerId).map(x => x.orderId)).size;
    }
  }

  res.json({
    totalOrders: uniqueOrders.size,
    totalItems: sales.reduce((s, i) => s + (i.quantity ?? 0), 0),
    totalRevenue: Math.round(sales.reduce((s, i) => s + (i.totalPrice ?? 0), 0) * 100) / 100,
    avgOrderValue: uniqueOrders.size > 0
      ? Math.round((sales.reduce((s, i) => s + (i.totalPrice ?? 0), 0) / uniqueOrders.size) * 100) / 100
      : 0,
    topProducts: Object.entries(topProducts)
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .slice(0, 20)
      .map(([id, p]) => ({ productId: id, ...p, revenue: Math.round(p.revenue * 100) / 100 })),
    topVariants: Object.entries(topVariants)
      .sort(([, a], [, b]) => b.qty - a.qty)
      .slice(0, 30)
      .map(([id, v]) => ({ variantId: id, ...v, revenue: Math.round(v.revenue * 100) / 100 })),
    topCustomers: Object.entries(byCustomer)
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .slice(0, 20)
      .map(([id, c]) => ({ customerId: id, ...c, revenue: Math.round(c.revenue * 100) / 100 })),
    salesByOption: byOption,
    salesByCountry: Object.entries(byCountry)
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .map(([country, data]) => ({ country, ...data, revenue: Math.round(data.revenue * 100) / 100 })),
  });
});

router.get("/inventory/customer-history", async (req, res): Promise<void> => {
  const { projectId, customerId, customerEmail } = req.query as Record<string, string>;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }
  if (!customerId && !customerEmail) { res.status(400).json({ error: "customerId or customerEmail required" }); return; }

  let purchases;
  if (customerId) {
    purchases = await db.select().from(salesAnalyticsTable)
      .where(and(eq(salesAnalyticsTable.projectId, projectId), eq(salesAnalyticsTable.customerId, customerId)))
      .orderBy(desc(salesAnalyticsTable.orderDate));
  } else {
    purchases = await db.select().from(salesAnalyticsTable)
      .where(and(eq(salesAnalyticsTable.projectId, projectId), eq(salesAnalyticsTable.customerEmail, customerEmail)))
      .orderBy(desc(salesAnalyticsTable.orderDate));
  }

  const uniqueOrders = new Set(purchases.map(p => p.orderId));
  const preferredOptions: Record<string, Record<string, number>> = {};
  for (const p of purchases) {
    const addPref = (name: string | null, val: string | null, qty: number) => {
      if (!name || !val) return;
      if (!preferredOptions[name]) preferredOptions[name] = {};
      preferredOptions[name][val] = (preferredOptions[name][val] || 0) + qty;
    };
    addPref(p.option1Name, p.option1Value, p.quantity ?? 1);
    addPref(p.option2Name, p.option2Value, p.quantity ?? 1);
    addPref(p.option3Name, p.option3Value, p.quantity ?? 1);
  }

  const preferences: Record<string, string> = {};
  for (const [optName, vals] of Object.entries(preferredOptions)) {
    const sorted = Object.entries(vals).sort(([, a], [, b]) => b - a);
    preferences[optName] = sorted[0]?.[0] || "";
  }

  res.json({
    customer: {
      id: customerId || purchases[0]?.customerId,
      name: purchases[0]?.customerName || "",
      email: purchases[0]?.customerEmail || customerEmail,
    },
    totalOrders: uniqueOrders.size,
    totalItems: purchases.reduce((s, p) => s + (p.quantity ?? 0), 0),
    totalSpent: Math.round(purchases.reduce((s, p) => s + (p.totalPrice ?? 0), 0) * 100) / 100,
    avgOrderValue: uniqueOrders.size > 0
      ? Math.round((purchases.reduce((s, p) => s + (p.totalPrice ?? 0), 0) / uniqueOrders.size) * 100) / 100
      : 0,
    preferences,
    purchases: purchases.map(p => ({
      orderId: p.orderId,
      orderNumber: p.orderNumber,
      date: p.orderDate,
      productTitle: p.productTitle,
      variantTitle: p.variantTitle,
      sku: p.sku,
      option1: p.option1Name ? `${p.option1Name}: ${p.option1Value}` : null,
      option2: p.option2Name ? `${p.option2Name}: ${p.option2Value}` : null,
      option3: p.option3Name ? `${p.option3Name}: ${p.option3Value}` : null,
      quantity: p.quantity,
      unitPrice: p.unitPrice,
      totalPrice: p.totalPrice,
      country: p.country,
    })),
  });
});

export default router;
