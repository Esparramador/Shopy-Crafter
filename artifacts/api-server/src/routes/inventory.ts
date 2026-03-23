import { Router } from "express";
import { db } from "@workspace/db";
import { inventoryTrackingTable, restockOrdersTable, projectsTable } from "@workspace/db";
import { eq, desc, lte } from "drizzle-orm";
import { randomUUID } from "crypto";
import { claude } from "../lib/claude.js";

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
    const text = await claude(prompt);
    const match = text.match(/\{[\s\S]*\}/);
    const email = match ? JSON.parse(match[0]) : { subject: "Restock Request", body: text, urgency: "high", suggestedQuantity: 90 };

    const [order] = await db.insert(restockOrdersTable).values({
      id: randomUUID(), projectId, productId, productTitle,
      quantitySuggested: email.suggestedQuantity ?? 90,
      urgency: email.urgency ?? "high",
      emailDraft: email.body,
    }).returning();

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
  };

  res.json({ synced: true, stats, timestamp: new Date().toISOString() });
});

export default router;
