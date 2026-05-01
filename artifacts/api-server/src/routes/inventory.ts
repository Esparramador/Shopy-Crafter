import { Router } from "express";
import { db } from "@workspace/db";
import { inventoryTrackingTable, restockOrdersTable, projectsTable, salesAnalyticsTable, refundsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { askClaudeWithBrain, learnFromOperation, SHOPIFY_EXPERT_SYSTEM } from "../lib/claude.js";
import { shopifyRequest, shopifyRequestPaged } from "../lib/shopify.js";
import { getConnector } from "../lib/connectors/index";
import { buildCoverPage, type CoverTemplate } from "../lib/report-cover.js";
import { enableLongRunning } from "../lib/long-running.js";
import { generatePdfFromHtml } from "../lib/pdf-generator.js";

const router = Router();

router.get("/inventory/tracking", async (req, res): Promise<void> => {
  try {
    const { projectId } = req.query as Record<string, string>;
    if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }
    const items = await db.select().from(inventoryTrackingTable)
      .where(eq(inventoryTrackingTable.projectId, projectId))
      .orderBy(inventoryTrackingTable.daysRemaining);
    res.json(items);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/inventory/tracking", async (req, res): Promise<void> => {
  try {
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/inventory/alerts", async (req, res): Promise<void> => {
  try {
    const { projectId } = req.query as Record<string, string>;
    if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }
    const critical = await db.select().from(inventoryTrackingTable)
      .where(eq(inventoryTrackingTable.projectId, projectId))
      .orderBy(inventoryTrackingTable.daysRemaining);
    const alerts = critical.filter(i => i.daysRemaining !== null && i.daysRemaining <= 14);
    res.json(alerts);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/inventory/restock-email", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
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
      const defaultEmail = { subject: "Restock Request", body: text, urgency: "high", suggestedQuantity: 90 };
      let email: any;
      if (match) { try { email = JSON.parse(match[0]); } catch { email = defaultEmail; } }
      else { email = defaultEmail; }
  
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/inventory/restock-orders", async (req, res): Promise<void> => {
  try {
    const { projectId } = req.query as Record<string, string>;
    if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }
    const orders = await db.select().from(restockOrdersTable)
      .where(eq(restockOrdersTable.projectId, projectId))
      .orderBy(desc(restockOrdersTable.createdAt)).limit(20);
    res.json(orders);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/inventory/sync", async (req, res): Promise<void> => {
  try {
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/inventory/deep-report", async (req, res): Promise<void> => {
  try {
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/inventory/sync-orders", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
    const { projectId } = req.body;
    if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }
  
    try {
      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
      if (!project) { res.status(400).json({ error: "Project not found" }); return; }
  
      const isWoo = project.platformType === "woocommerce";
      if (!isWoo && !project.accessToken) { res.status(400).json({ error: "Project not found or no access" }); return; }
  
      const existingOrders = await db.select({ orderId: salesAnalyticsTable.orderId })
        .from(salesAnalyticsTable)
        .where(eq(salesAnalyticsTable.projectId, projectId));
      const existingOrderIds = new Set(existingOrders.map(o => o.orderId));
  
      type RefundLineItem = {
        id: number;
        line_item_id: number;
        quantity: number;
        subtotal?: string | number;
        total_tax?: string | number;
        line_item?: { product_id?: number; variant_id?: number; title?: string };
      };
      type OrderRefund = {
        id: number;
        created_at: string;
        note?: string | null;
        refund_line_items?: RefundLineItem[];
      };
      type OrderShape = {
        id: number; name: string; created_at: string;
        customer?: { id: number; email: string; first_name: string; last_name: string };
        line_items: Array<{
          id?: number;
          product_id: number; variant_id: number; title: string; variant_title: string;
          sku: string; quantity: number; price: string; total_discount: string;
          fulfillment_status: string | null;
        }>;
        financial_status: string; fulfillment_status: string | null;
        shipping_address?: { country: string; city: string };
        currency: string;
        refunds?: OrderRefund[];
      };
  
      let orders: OrderShape[] = [];
      let pagesFetched = 0;
      if (isWoo) {
        const connector = getConnector(project);
        const wcOrders = await connector.getOrders();
        orders = wcOrders.map((o) => ({
          id: parseInt(o.platformId) || 0,
          name: o.orderNumber,
          created_at: o.createdAt,
          customer: o.customerEmail ? {
            id: 0,
            email: o.customerEmail,
            first_name: "",
            last_name: "",
          } : undefined,
          line_items: o.lineItems.map((li) => ({
            product_id: parseInt(li.productId ?? "0") || 0,
            variant_id: 0,
            title: li.title,
            variant_title: "Default",
            sku: "",
            quantity: li.quantity,
            price: li.price,
            total_discount: "0",
            fulfillment_status: null as string | null,
          })),
          financial_status: o.status,
          fulfillment_status: null,
          shipping_address: undefined,
          currency: o.currency,
        }));
      } else {
        // Shopify: cursor-based pagination over ALL orders (status=any) with refunds embedded
        const FIELDS = "id,name,created_at,customer,line_items,financial_status,fulfillment_status,shipping_address,currency,refunds";
        const MAX_PAGES = 200; // 200 * 250 = 50.000 orders cap (safety)
        let nextPage: string | null = null;
        do {
          const path: string = nextPage
            ? `/orders.json?limit=250&page_info=${encodeURIComponent(nextPage)}`
            : `/orders.json?status=any&limit=250&fields=${FIELDS}`;
          const { data, nextPageInfo }: { data: { orders: OrderShape[] }; nextPageInfo: string | null } = await shopifyRequestPaged<{ orders: OrderShape[] }>(
            parseInt(projectId), project.shopDomain, path
          );
          orders.push(...(data.orders || []));
          nextPage = nextPageInfo;
          pagesFetched++;
          if (pagesFetched >= MAX_PAGES) break;
        } while (nextPage);
      }
  
      let inserted = 0;
      let failed = 0;
      let refundsInserted = 0;
      for (const order of orders) {
        // Build per-line-item refund index from order.refunds[]
        const refundsByLineItem = new Map<string, { qty: number; amount: number; reason: string | null; at: Date | null }>();
        const flatRefundRows: Array<{
          refundId: string; lineItemId: string | null; productId: string | null; variantId: string | null;
          productTitle: string | null; quantity: number; amount: number; reason: string | null;
          note: string | null; refundedAt: Date | null;
        }> = [];
        for (const r of (order.refunds || [])) {
          const refundedAt = r.created_at ? new Date(r.created_at) : null;
          for (const rli of (r.refund_line_items || [])) {
            const lineKey = String(rli.line_item_id);
            const sub = parseFloat(String(rli.subtotal ?? 0)) || 0;
            const tax = parseFloat(String(rli.total_tax ?? 0)) || 0;
            const amount = sub + tax;
            const cur = refundsByLineItem.get(lineKey) || { qty: 0, amount: 0, reason: null as string | null, at: null as Date | null };
            cur.qty += rli.quantity || 0;
            cur.amount += amount;
            cur.reason = cur.reason || (r.note || null);
            cur.at = cur.at || refundedAt;
            refundsByLineItem.set(lineKey, cur);
            flatRefundRows.push({
              refundId: String(r.id),
              lineItemId: lineKey,
              productId: rli.line_item?.product_id ? String(rli.line_item.product_id) : null,
              variantId: rli.line_item?.variant_id ? String(rli.line_item.variant_id) : null,
              productTitle: rli.line_item?.title || null,
              quantity: rli.quantity || 0,
              amount,
              reason: r.note || null,
              note: r.note || null,
              refundedAt,
            });
          }
        }

        // Persist individual refund rows (idempotent: skip duplicates per (orderId,refundId,lineItemId))
        for (const rr of flatRefundRows) {
          try {
            await db.insert(refundsTable).values({
              id: randomUUID(),
              projectId,
              orderId: String(order.id),
              refundId: rr.refundId,
              lineItemId: rr.lineItemId,
              productId: rr.productId,
              variantId: rr.variantId,
              productTitle: rr.productTitle,
              quantity: rr.quantity,
              amount: rr.amount,
              reason: rr.reason,
              note: rr.note,
              currency: order.currency || "EUR",
              refundedAt: rr.refundedAt,
            }).onConflictDoNothing();
            refundsInserted++;
          } catch { /* swallow */ }
        }

        if (existingOrderIds.has(String(order.id))) {
          // Order already imported — only update refund fields on existing line items
          if (refundsByLineItem.size > 0) {
            for (const [lineKey, agg] of refundsByLineItem) {
              const productIdMatch = (() => {
                const li = order.line_items.find(x => String(x.id) === lineKey);
                return li ? String(li.product_id) : null;
              })();
              if (!productIdMatch) continue;
              await db.update(salesAnalyticsTable)
                .set({
                  refundedQuantity: agg.qty,
                  refundedAmount: agg.amount,
                  refundReason: agg.reason,
                  refundedAt: agg.at,
                })
                .where(and(
                  eq(salesAnalyticsTable.projectId, projectId),
                  eq(salesAnalyticsTable.orderId, String(order.id)),
                  eq(salesAnalyticsTable.productId, productIdMatch),
                ));
            }
          }
          continue;
        }
  
        for (const item of order.line_items) {
          const variantTracking = await db.select().from(inventoryTrackingTable)
            .where(eq(inventoryTrackingTable.variantId, String(item.variant_id))).limit(1);
          const vt = variantTracking[0];
          const refAgg = item.id ? refundsByLineItem.get(String(item.id)) : undefined;
  
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
              refundedQuantity: refAgg?.qty || 0,
              refundedAmount: refAgg?.amount || 0,
              refundReason: refAgg?.reason || null,
              refundedAt: refAgg?.at || null,
            });
            inserted++;
          } catch {
            failed++;
          }
        }
      }
  
      learnFromOperation({
        operationType: "inventory_sync",
        title: `Sync de pedidos: ${inserted} lineas de ${orders.length} pedidos (${pagesFetched} páginas) + ${refundsInserted} refunds`,
        content: `Synced ${orders.length} orders with ${inserted} line items and ${refundsInserted} refunds across ${pagesFetched} pages for project ${projectId}. Platform: ${isWoo ? "WooCommerce" : "Shopify"}.`,
        confidence: 0.8,
      });
  
      res.json({
        synced: true,
        ordersProcessed: orders.length,
        pagesFetched,
        lineItemsInserted: inserted,
        lineItemsFailed: failed,
        refundsInserted,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// POST /inventory/sync-refunds — re-sincroniza refunds para órdenes ya importadas
// Útil cuando se quieren actualizar refunds sin re-importar todas las órdenes (rápido)
router.post("/inventory/sync-refunds", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    const { projectId } = req.body;
    if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    if (project.platformType === "woocommerce") {
      res.status(400).json({ error: "WooCommerce no soportado todavía para sync-refunds" }); return;
    }
    if (!project.accessToken) { res.status(400).json({ error: "No access token" }); return; }

    type RefundLineItem = { id: number; line_item_id: number; quantity: number; subtotal?: string|number; total_tax?: string|number; line_item?: { product_id?: number; variant_id?: number; title?: string } };
    type ShopRefund = { id: number; order_id: number; created_at: string; note?: string|null; refund_line_items?: RefundLineItem[] };

    // Tráenos solo orders + sus refunds embebidos (campos mínimos)
    const FIELDS = "id,refunds,currency";
    const MAX_PAGES = 200;
    let nextPage: string | null = null;
    let pagesFetched = 0;
    let ordersScanned = 0;
    let refundsInserted = 0;
    let linesUpdated = 0;

    do {
      const path: string = nextPage
        ? `/orders.json?limit=250&page_info=${encodeURIComponent(nextPage)}`
        : `/orders.json?status=any&limit=250&fields=${FIELDS}`;
      const { data, nextPageInfo }: { data: { orders: Array<{ id: number; refunds?: ShopRefund[]; currency?: string }> }; nextPageInfo: string | null } = await shopifyRequestPaged<{ orders: Array<{ id: number; refunds?: ShopRefund[]; currency?: string }> }>(
        parseInt(projectId), project.shopDomain, path
      );
      for (const order of (data.orders || [])) {
        ordersScanned++;
        if (!order.refunds?.length) continue;

        const byLine = new Map<string, { qty: number; amount: number; reason: string|null; at: Date|null; productId: string|null }>();
        for (const r of order.refunds) {
          const refundedAt = r.created_at ? new Date(r.created_at) : null;
          for (const rli of (r.refund_line_items || [])) {
            const lineKey = String(rli.line_item_id);
            const sub = parseFloat(String(rli.subtotal ?? 0)) || 0;
            const tax = parseFloat(String(rli.total_tax ?? 0)) || 0;
            const amount = sub + tax;
            const cur = byLine.get(lineKey) || { qty: 0, amount: 0, reason: null as string|null, at: null as Date|null, productId: null as string|null };
            cur.qty += rli.quantity || 0;
            cur.amount += amount;
            cur.reason = cur.reason || (r.note || null);
            cur.at = cur.at || refundedAt;
            cur.productId = cur.productId || (rli.line_item?.product_id ? String(rli.line_item.product_id) : null);
            byLine.set(lineKey, cur);

            try {
              await db.insert(refundsTable).values({
                id: randomUUID(),
                projectId,
                orderId: String(order.id),
                refundId: String(r.id),
                lineItemId: lineKey,
                productId: rli.line_item?.product_id ? String(rli.line_item.product_id) : null,
                variantId: rli.line_item?.variant_id ? String(rli.line_item.variant_id) : null,
                productTitle: rli.line_item?.title || null,
                quantity: rli.quantity || 0,
                amount,
                reason: r.note || null,
                note: r.note || null,
                currency: order.currency || "EUR",
                refundedAt,
              }).onConflictDoNothing();
              refundsInserted++;
            } catch { /* swallow */ }
          }
        }

        // Actualizar las líneas de salesAnalytics matching por (orderId, productId)
        for (const [, agg] of byLine) {
          if (!agg.productId) continue;
          const result = await db.update(salesAnalyticsTable)
            .set({ refundedQuantity: agg.qty, refundedAmount: agg.amount, refundReason: agg.reason, refundedAt: agg.at })
            .where(and(
              eq(salesAnalyticsTable.projectId, projectId),
              eq(salesAnalyticsTable.orderId, String(order.id)),
              eq(salesAnalyticsTable.productId, agg.productId),
            ));
          linesUpdated += (result?.rowCount ?? 0);
        }
      }
      nextPage = nextPageInfo;
      pagesFetched++;
      if (pagesFetched >= MAX_PAGES) break;
    } while (nextPage);

    res.json({ synced: true, ordersScanned, pagesFetched, refundsInserted, linesUpdated });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// GET /inventory/refunds — lista refunds del proyecto + summary
router.get("/inventory/refunds", async (req, res): Promise<void> => {
  try {
    const { projectId } = req.query as Record<string, string>;
    if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

    const items = await db.select().from(refundsTable)
      .where(eq(refundsTable.projectId, projectId))
      .orderBy(desc(refundsTable.refundedAt));

    const summary = items.reduce((acc, r) => {
      acc.totalRefunds++;
      acc.totalQuantity += r.quantity || 0;
      acc.totalAmount += r.amount || 0;
      const key = r.productTitle || r.productId || "unknown";
      acc.byProduct[key] = (acc.byProduct[key] || { quantity: 0, amount: 0, count: 0, title: key });
      acc.byProduct[key].quantity += r.quantity || 0;
      acc.byProduct[key].amount += r.amount || 0;
      acc.byProduct[key].count++;
      return acc;
    }, { totalRefunds: 0, totalQuantity: 0, totalAmount: 0, byProduct: {} as Record<string, { title: string; quantity: number; amount: number; count: number }> });

    res.json({
      items,
      summary: {
        ...summary,
        topRefundedProducts: Object.values(summary.byProduct).sort((a, b) => b.amount - a.amount).slice(0, 10),
      },
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/inventory/sales-analytics", async (req, res): Promise<void> => {
  try {
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/inventory/customer-history", async (req, res): Promise<void> => {
  try {
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/inventory/sales-report", async (req, res): Promise<void> => {
  try {
    const { projectId, format, template } = req.query as Record<string, string>;
    if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }
    const tpl = (template as CoverTemplate) || "prestige";
  
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
    const sales = await db.select().from(salesAnalyticsTable)
      .where(eq(salesAnalyticsTable.projectId, projectId))
      .orderBy(desc(salesAnalyticsTable.orderDate));
  
    const inventory = await db.select().from(inventoryTrackingTable)
      .where(eq(inventoryTrackingTable.projectId, projectId));
  
    const inventoryByVariant: Record<string, { stock: number; price: number; sku: string; option1Name: string | null; option1Value: string | null; option2Name: string | null; option2Value: string | null; option3Name: string | null; option3Value: string | null }> = {};
    for (const item of inventory) {
      inventoryByVariant[item.variantId || ""] = {
        stock: item.currentStock ?? 0,
        price: item.price ?? 0,
        sku: item.sku || "",
        option1Name: item.option1Name, option1Value: item.option1Value,
        option2Name: item.option2Name, option2Value: item.option2Value,
        option3Name: item.option3Name, option3Value: item.option3Value,
      };
    }
  
    interface VariantAgg {
      variantId: string;
      variantTitle: string;
      sku: string;
      options: string[];
      qtySold: number;
      revenue: number;
      currentStock: number;
      orders: number;
      firstSale: Date | null;
      lastSale: Date | null;
    }
  
    interface ProductAgg {
      productId: string;
      title: string;
      totalQtySold: number;
      totalRevenue: number;
      totalCurrentStock: number;
      variants: Record<string, VariantAgg>;
      orderIds: Set<string>;
    }
  
    const products: Record<string, ProductAgg> = {};
  
    for (const s of sales) {
      const pid = s.productId || "unknown";
      if (!products[pid]) {
        products[pid] = { productId: pid, title: s.productTitle || "Sin título", totalQtySold: 0, totalRevenue: 0, totalCurrentStock: 0, variants: {}, orderIds: new Set() };
      }
      const p = products[pid];
      p.totalQtySold += s.quantity ?? 0;
      p.totalRevenue += s.totalPrice ?? 0;
      p.orderIds.add(s.orderId || "");
  
      const vid = s.variantId || "unknown";
      if (!p.variants[vid]) {
        const inv = inventoryByVariant[vid];
        const opts: string[] = [];
        const o1n = s.option1Name || inv?.option1Name;
        const o1v = s.option1Value || inv?.option1Value;
        const o2n = s.option2Name || inv?.option2Name;
        const o2v = s.option2Value || inv?.option2Value;
        const o3n = s.option3Name || inv?.option3Name;
        const o3v = s.option3Value || inv?.option3Value;
        if (o1n && o1v) opts.push(`${o1n}: ${o1v}`);
        if (o2n && o2v) opts.push(`${o2n}: ${o2v}`);
        if (o3n && o3v) opts.push(`${o3n}: ${o3v}`);
  
        p.variants[vid] = {
          variantId: vid, variantTitle: s.variantTitle || "Default",
          sku: s.sku || inv?.sku || "", options: opts,
          qtySold: 0, revenue: 0, currentStock: inv?.stock ?? 0,
          orders: 0, firstSale: null, lastSale: null,
        };
      }
      const v = p.variants[vid];
      v.qtySold += s.quantity ?? 0;
      v.revenue += s.totalPrice ?? 0;
      v.orders++;
      const d = s.orderDate ? new Date(s.orderDate) : null;
      if (d) {
        if (!v.firstSale || d < v.firstSale) v.firstSale = d;
        if (!v.lastSale || d > v.lastSale) v.lastSale = d;
      }
    }
  
    for (const inv of inventory) {
      const pid = inv.productId;
      if (!products[pid]) {
        products[pid] = { productId: pid, title: inv.productTitle || "Sin título", totalQtySold: 0, totalRevenue: 0, totalCurrentStock: 0, variants: {}, orderIds: new Set() };
      }
      const p = products[pid];
      const vid = inv.variantId || "";
      if (!p.variants[vid]) {
        const opts: string[] = [];
        if (inv.option1Name && inv.option1Value) opts.push(`${inv.option1Name}: ${inv.option1Value}`);
        if (inv.option2Name && inv.option2Value) opts.push(`${inv.option2Name}: ${inv.option2Value}`);
        if (inv.option3Name && inv.option3Value) opts.push(`${inv.option3Name}: ${inv.option3Value}`);
        p.variants[vid] = {
          variantId: vid, variantTitle: inv.variantTitle || "Default",
          sku: inv.sku || "", options: opts,
          qtySold: 0, revenue: 0, currentStock: inv.currentStock ?? 0,
          orders: 0, firstSale: null, lastSale: null,
        };
      } else {
        p.variants[vid].currentStock = inv.currentStock ?? 0;
      }
    }
  
    for (const p of Object.values(products)) {
      p.totalCurrentStock = Object.values(p.variants).reduce((s, v) => s + v.currentStock, 0);
    }
  
    const sortedProducts = Object.values(products).sort((a, b) => b.totalQtySold - a.totalQtySold);
    const uniqueOrders = new Set(sales.map(s => s.orderId));
    const totalItems = sales.reduce((s, i) => s + (i.quantity ?? 0), 0);
    const totalRevenue = Math.round(sales.reduce((s, i) => s + (i.totalPrice ?? 0), 0) * 100) / 100;
    const totalStock = Object.values(products).reduce((s, p) => s + p.totalCurrentStock, 0);
    const avgTicket = uniqueOrders.size > 0 ? Math.round(totalRevenue / uniqueOrders.size * 100) / 100 : 0;
  
    const byOption: Record<string, Record<string, { qty: number; revenue: number }>> = {};
    for (const s of sales) {
      const addOpt = (n: string | null, v: string | null) => {
        if (!n || !v) return;
        if (!byOption[n]) byOption[n] = {};
        if (!byOption[n][v]) byOption[n][v] = { qty: 0, revenue: 0 };
        byOption[n][v].qty += s.quantity ?? 0;
        byOption[n][v].revenue += s.totalPrice ?? 0;
      };
      addOpt(s.option1Name, s.option1Value);
      addOpt(s.option2Name, s.option2Value);
      addOpt(s.option3Name, s.option3Value);
    }
  
    if (format === "json") {
      res.json({
        storeName: project.name || project.shopDomain,
        generatedAt: new Date().toISOString(),
        summary: { totalOrders: uniqueOrders.size, totalItems, totalRevenue, totalStock, avgTicket, totalProducts: sortedProducts.length },
        products: sortedProducts.map(p => ({
          ...p, orderIds: undefined, totalOrders: p.orderIds.size,
          variants: Object.values(p.variants).sort((a, b) => b.qtySold - a.qtySold).map(v => ({
            ...v, revenue: Math.round(v.revenue * 100) / 100,
            firstSale: v.firstSale?.toISOString() || null, lastSale: v.lastSale?.toISOString() || null,
          })),
          totalRevenue: Math.round(p.totalRevenue * 100) / 100,
        })),
        salesByOption: byOption,
      });
      return;
    }
  
    const storeName = project.name || project.shopDomain || "Tienda";
    const now = new Date();
    const dateStr = now.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  
    let productCardsHtml = "";
    let rank = 0;
    for (const p of sortedProducts) {
      rank++;
      const variantRows = Object.values(p.variants).sort((a, b) => b.qtySold - a.qtySold);
      const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
  
      let variantTableRows = "";
      for (const v of variantRows) {
        const optStr = v.options.length > 0 ? v.options.join(" · ") : v.variantTitle;
        const stockColor = v.currentStock === 0 ? "#e74c3c" : v.currentStock <= 5 ? "#f39c12" : "#2ecc71";
        const stockLabel = v.currentStock === 0 ? "AGOTADO" : String(v.currentStock);
        variantTableRows += `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #2a2a3e;color:#e0e0e8;font-size:13px;">${esc(optStr)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #2a2a3e;color:#e0e0e8;font-size:13px;text-align:center;">${v.sku ? esc(v.sku) : "—"}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #2a2a3e;text-align:center;font-weight:700;color:#c8a84e;font-size:14px;">${v.qtySold}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #2a2a3e;text-align:center;color:#e0e0e8;font-size:13px;">${Math.round(v.revenue * 100) / 100}€</td>
          <td style="padding:8px 12px;border-bottom:1px solid #2a2a3e;text-align:center;"><span style="background:${stockColor};color:#fff;padding:2px 10px;border-radius:10px;font-size:12px;font-weight:600;">${stockLabel}</span></td>
          <td style="padding:8px 12px;border-bottom:1px solid #2a2a3e;color:#a0a0b8;font-size:12px;text-align:center;">${v.lastSale ? new Date(v.lastSale).toLocaleDateString("es-ES") : "—"}</td>
        </tr>`;
      }
  
      productCardsHtml += `
      <div style="background:linear-gradient(145deg,#1a1a2e,#16162a);border-radius:16px;margin:20px 0;padding:24px;border:1px solid #2a2a4e;page-break-inside:avoid;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-size:24px;">${medal}</span>
            <h3 style="margin:0;font-size:17px;font-weight:800;color:#f0f0f5;letter-spacing:-0.3px;">${esc(p.title)}</h3>
          </div>
          <div style="text-align:right;">
            <div style="font-size:22px;font-weight:800;color:#c8a84e;">${p.totalQtySold} uds</div>
            <div style="font-size:13px;color:#a0a0b8;">${Math.round(p.totalRevenue * 100) / 100}€ revenue</div>
          </div>
        </div>
        <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;">
          <div style="background:#12122a;border-radius:10px;padding:10px 16px;flex:1;min-width:120px;text-align:center;">
            <div style="font-size:11px;color:#8888aa;text-transform:uppercase;letter-spacing:1px;">Pedidos</div>
            <div style="font-size:18px;font-weight:700;color:#c8a84e;">${p.orderIds.size}</div>
          </div>
          <div style="background:#12122a;border-radius:10px;padding:10px 16px;flex:1;min-width:120px;text-align:center;">
            <div style="font-size:11px;color:#8888aa;text-transform:uppercase;letter-spacing:1px;">Variantes</div>
            <div style="font-size:18px;font-weight:700;color:#c8a84e;">${variantRows.length}</div>
          </div>
          <div style="background:#12122a;border-radius:10px;padding:10px 16px;flex:1;min-width:120px;text-align:center;">
            <div style="font-size:11px;color:#8888aa;text-transform:uppercase;letter-spacing:1px;">Stock Actual</div>
            <div style="font-size:18px;font-weight:700;color:${p.totalCurrentStock === 0 ? "#e74c3c" : "#2ecc71"};">${p.totalCurrentStock}</div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;background:#12122a;border-radius:10px;overflow:hidden;">
          <thead>
            <tr style="background:#0e0e22;">
              <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8888aa;border-bottom:2px solid #c8a84e;">Variante / Opción</th>
              <th style="padding:10px 12px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8888aa;border-bottom:2px solid #c8a84e;">SKU</th>
              <th style="padding:10px 12px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8888aa;border-bottom:2px solid #c8a84e;">Vendidos</th>
              <th style="padding:10px 12px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8888aa;border-bottom:2px solid #c8a84e;">Revenue</th>
              <th style="padding:10px 12px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8888aa;border-bottom:2px solid #c8a84e;">Stock</th>
              <th style="padding:10px 12px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8888aa;border-bottom:2px solid #c8a84e;">Última Venta</th>
            </tr>
          </thead>
          <tbody>${variantTableRows}</tbody>
          <tfoot>
            <tr style="background:#0e0e22;">
              <td style="padding:10px 12px;font-weight:800;color:#c8a84e;font-size:13px;" colspan="2">TOTAL PRODUCTO</td>
              <td style="padding:10px 12px;text-align:center;font-weight:800;color:#c8a84e;font-size:15px;">${p.totalQtySold}</td>
              <td style="padding:10px 12px;text-align:center;font-weight:700;color:#c8a84e;font-size:13px;">${Math.round(p.totalRevenue * 100) / 100}€</td>
              <td style="padding:10px 12px;text-align:center;font-weight:700;color:${p.totalCurrentStock === 0 ? "#e74c3c" : "#2ecc71"};font-size:13px;">${p.totalCurrentStock}</td>
              <td style="padding:10px 12px;"></td>
            </tr>
          </tfoot>
        </table>
      </div>`;
    }
  
    let optionSummaryHtml = "";
    for (const [optName, values] of Object.entries(byOption)) {
      const sorted = Object.entries(values).sort(([, a], [, b]) => b.qty - a.qty);
      let rows = "";
      const totalQty = sorted.reduce((s, [, v]) => s + v.qty, 0);
      for (const [val, data] of sorted) {
        const pct = totalQty > 0 ? Math.round(data.qty / totalQty * 100) : 0;
        rows += `<tr>
          <td style="padding:6px 12px;border-bottom:1px solid #2a2a3e;color:#e0e0e8;font-size:13px;">${esc(val)}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #2a2a3e;text-align:center;font-weight:700;color:#c8a84e;">${data.qty}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #2a2a3e;text-align:center;color:#e0e0e8;">${Math.round(data.revenue * 100) / 100}€</td>
          <td style="padding:6px 12px;border-bottom:1px solid #2a2a3e;text-align:center;">
            <div style="background:#2a2a4e;border-radius:6px;overflow:hidden;height:16px;position:relative;">
              <div style="background:linear-gradient(90deg,#c8a84e,#e8c84e);height:100%;width:${pct}%;border-radius:6px;"></div>
              <span style="position:absolute;top:0;left:50%;transform:translateX(-50%);font-size:10px;color:#fff;line-height:16px;font-weight:600;">${pct}%</span>
            </div>
          </td>
        </tr>`;
      }
      optionSummaryHtml += `
      <div style="background:linear-gradient(145deg,#1a1a2e,#16162a);border-radius:16px;margin:20px 0;padding:20px;border:1px solid #2a2a4e;">
        <h3 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#c8a84e;">📊 Ventas por ${esc(optName)}</h3>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#0e0e22;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#8888aa;border-bottom:2px solid #c8a84e;">${esc(optName)}</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#8888aa;border-bottom:2px solid #c8a84e;">Cantidad</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#8888aa;border-bottom:2px solid #c8a84e;">Revenue</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#8888aa;border-bottom:2px solid #c8a84e;">% del Total</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    }
  
    const htmlContent = `<!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Informe de Ventas y Stock — ${esc(storeName)}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d0d1a; color: #e0e0e8; line-height: 1.6; }
      @media print { body { background: #0d0d1a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style>
  </head>
  <body>
  ${buildCoverPage({ reportTitle: "Informe de Ventas y Stock", reportSubtitle: esc(storeName), companyName: esc(storeName), date: dateStr, template: tpl })}
  <div style="padding:30px;max-width:1200px;margin:0 auto;">
  
    <div style="text-align:center;margin-bottom:40px;padding:40px 20px;background:linear-gradient(145deg,#1a1a2e,#0d0d1a);border-radius:20px;border:2px solid #c8a84e;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:3px;color:#c8a84e;margin-bottom:8px;">Shopy Crafter eCommerce</div>
      <h1 style="font-size:32px;font-weight:900;color:#ffffff;letter-spacing:-1px;margin-bottom:8px;">📊 Informe de Ventas y Stock</h1>
      <div style="font-size:18px;color:#c8a84e;font-weight:600;">${esc(storeName)}</div>
      <div style="font-size:13px;color:#8888aa;margin-top:8px;">Generado el ${dateStr} · Datos completos de todos los pedidos sincronizados</div>
    </div>
  
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:30px;">
      <div style="background:linear-gradient(145deg,#1a1a2e,#16162a);border-radius:14px;padding:20px;text-align:center;border:1px solid #2a2a4e;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8888aa;">Pedidos Totales</div>
        <div style="font-size:28px;font-weight:900;color:#c8a84e;margin:6px 0;">${uniqueOrders.size}</div>
      </div>
      <div style="background:linear-gradient(145deg,#1a1a2e,#16162a);border-radius:14px;padding:20px;text-align:center;border:1px solid #2a2a4e;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8888aa;">Artículos Vendidos</div>
        <div style="font-size:28px;font-weight:900;color:#c8a84e;margin:6px 0;">${totalItems}</div>
      </div>
      <div style="background:linear-gradient(145deg,#1a1a2e,#16162a);border-radius:14px;padding:20px;text-align:center;border:1px solid #2a2a4e;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8888aa;">Revenue Total</div>
        <div style="font-size:28px;font-weight:900;color:#2ecc71;margin:6px 0;">${totalRevenue}€</div>
      </div>
      <div style="background:linear-gradient(145deg,#1a1a2e,#16162a);border-radius:14px;padding:20px;text-align:center;border:1px solid #2a2a4e;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8888aa;">Ticket Medio</div>
        <div style="font-size:28px;font-weight:900;color:#c8a84e;margin:6px 0;">${avgTicket}€</div>
      </div>
      <div style="background:linear-gradient(145deg,#1a1a2e,#16162a);border-radius:14px;padding:20px;text-align:center;border:1px solid #2a2a4e;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8888aa;">Stock Total Actual</div>
        <div style="font-size:28px;font-weight:900;color:${totalStock === 0 ? "#e74c3c" : "#2ecc71"};margin:6px 0;">${totalStock}</div>
      </div>
      <div style="background:linear-gradient(145deg,#1a1a2e,#16162a);border-radius:14px;padding:20px;text-align:center;border:1px solid #2a2a4e;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8888aa;">Productos Únicos</div>
        <div style="font-size:28px;font-weight:900;color:#c8a84e;margin:6px 0;">${sortedProducts.length}</div>
      </div>
    </div>
  
    ${optionSummaryHtml}
  
    <h2 style="font-size:22px;font-weight:800;color:#ffffff;margin:30px 0 10px;padding-bottom:10px;border-bottom:2px solid #c8a84e;">
      🏷️ Desglose por Producto y Variante (${sortedProducts.length} productos)
    </h2>
  
    ${productCardsHtml}
  
    <div style="text-align:center;margin-top:40px;padding:20px;color:#666;font-size:12px;border-top:1px solid #2a2a3e;">
      <div style="color:#c8a84e;font-weight:700;">SHOPY CRAFTER</div>
      <div>IA para tu eCommerce · ${dateStr}</div>
    </div>
  
  </div>
  </body>
  </html>`;
  
    const safeTitle = `Informe_Ventas_Stock_${(storeName).replace(/[^a-zA-Z0-9]/g, "_")}`;
  
    if (format === "pdf") {
      // FIX D-08: usar helper centralizado (timeout 60s, bloqueo recursos externos, no chromium hardcoded)
      try {
        await generatePdfFromHtml(htmlContent, safeTitle, res);
      } catch (e: any) {
        if (!res.headersSent) {
          res.status(500).json({ error: `Error generando PDF: ${e.message}` });
        }
      }
      return;
    }
  
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.html"`);
    res.send(htmlContent);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

export default router;
