import { Router } from "express";
import { randomBytes } from "crypto";
import { db, usersTable, approvalsTable, messagesTable, productsTable, auditLogTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, requireClientAccess } from "../lib/auth.js";

const router = Router();
router.use(requireAuth);

function getClientProjectId(req: import("express").Request): string {
  return req.session.clientId ?? req.params["projectId"] ?? "";
}

router.get("/dashboard", async (req, res): Promise<void> => {
  const projectId = getClientProjectId(req);
  if (!projectId) { res.status(400).json({ error: "No project linked" }); return; }

  const products = await db.select({
    id: productsTable.id,
    title: productsTable.title,
    auditScore: productsTable.auditScore,
    price: productsTable.price,
  }).from(productsTable).where(eq(productsTable.projectId, parseInt(projectId)));

  const scored = products.filter((p) => p.auditScore !== null);
  const avgScore = scored.length > 0
    ? Math.round(scored.reduce((s, p) => s + (p.auditScore ?? 0), 0) / scored.length)
    : null;

  const pendingApprovals = await db.select({ id: approvalsTable.id })
    .from(approvalsTable)
    .where(and(eq(approvalsTable.projectId, projectId), eq(approvalsTable.status, "pending")));

  const recentActivity = await db.select().from(auditLogTable)
    .where(eq(auditLogTable.projectId, projectId))
    .orderBy(desc(auditLogTable.createdAt)).limit(20);

  res.json({
    totalProducts: products.length,
    avgScore,
    pendingApprovals: pendingApprovals.length,
    recentActivity,
    enginesActive: 6,
    lastOptimized: recentActivity[0]?.createdAt ?? null,
  });
});

router.get("/approvals", async (req, res): Promise<void> => {
  const projectId = getClientProjectId(req);
  const items = await db.select().from(approvalsTable)
    .where(eq(approvalsTable.projectId, projectId))
    .orderBy(desc(approvalsTable.createdAt));
  res.json(items);
});

router.post("/approvals/:id/approve", async (req, res): Promise<void> => {
  const projectId = getClientProjectId(req);
  const [item] = await db.select().from(approvalsTable).where(eq(approvalsTable.id, req.params["id"]!));
  if (!item || item.projectId !== projectId) { res.status(403).json({ error: "Access denied" }); return; }

  await db.update(approvalsTable).set({ status: "approved", reviewedAt: new Date() })
    .where(eq(approvalsTable.id, req.params["id"]!));

  await db.insert(auditLogTable).values({
    id: randomBytes(8).toString("hex"),
    userId: req.session.userId!,
    projectId,
    action: "approve_item",
    details: `Approved: ${item.title}`,
  });

  res.json({ success: true });
});

router.post("/approvals/:id/reject", async (req, res): Promise<void> => {
  const projectId = getClientProjectId(req);
  const [item] = await db.select().from(approvalsTable).where(eq(approvalsTable.id, req.params["id"]!));
  if (!item || item.projectId !== projectId) { res.status(403).json({ error: "Access denied" }); return; }

  const { comment } = req.body as { comment?: string };
  await db.update(approvalsTable).set({
    status: "rejected", reviewedAt: new Date(), clientComment: comment,
  }).where(eq(approvalsTable.id, req.params["id"]!));

  await db.insert(auditLogTable).values({
    id: randomBytes(8).toString("hex"),
    userId: req.session.userId!,
    projectId,
    action: "reject_item",
    details: `Rejected: ${item.title}. Comment: ${comment ?? ""}`,
  });

  res.json({ success: true });
});

router.get("/messages", async (req, res): Promise<void> => {
  const projectId = getClientProjectId(req);
  const msgs = await db.select().from(messagesTable)
    .where(eq(messagesTable.projectId, projectId))
    .orderBy(messagesTable.createdAt);

  await db.update(messagesTable).set({ isRead: 1 })
    .where(and(eq(messagesTable.projectId, projectId), eq(messagesTable.fromRole, "admin")));

  res.json(msgs);
});

router.post("/messages", async (req, res): Promise<void> => {
  const projectId = getClientProjectId(req);
  const { content } = req.body as { content: string };
  const id = randomBytes(16).toString("hex");
  await db.insert(messagesTable).values({
    id, projectId, fromRole: "client", fromName: req.session.name ?? "Cliente", content,
  });
  res.json({ id });
});

router.get("/products", async (req, res): Promise<void> => {
  const projectId = getClientProjectId(req);
  const products = await db.select({
    id: productsTable.id,
    title: productsTable.title,
    price: productsTable.price,
    auditScore: productsTable.auditScore,
    auditGrade: productsTable.auditGrade,
    images: productsTable.images,
  }).from(productsTable)
    .where(eq(productsTable.projectId, parseInt(projectId)))
    .orderBy(desc(productsTable.auditScore))
    .limit(50);
  res.json(products);
});

export default router;
