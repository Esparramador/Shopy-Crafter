import { Router } from "express";
import { randomBytes } from "crypto";
import { db, usersTable, approvalsTable, messagesTable, productsTable, auditLogTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, requireClientAccess } from "../lib/auth.js";

const router = Router();
router.use(requireAuth);

function getClientProjectId(req: import("express").Request): string {
  return String(req.session.clientId ?? req.params["projectId"] ?? "");
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
  if (!projectId) { res.status(400).json({ error: "No project linked" }); return; }
  const items = await db.select().from(approvalsTable)
    .where(eq(approvalsTable.projectId, projectId))
    .orderBy(desc(approvalsTable.createdAt));
  res.json(items);
});

router.post("/approvals/:id/approve", async (req, res): Promise<void> => {
  const projectId = getClientProjectId(req);
  if (!projectId) { res.status(400).json({ error: "No project linked" }); return; }
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
  if (!projectId) { res.status(400).json({ error: "No project linked" }); return; }
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
  if (!projectId) { res.status(400).json({ error: "No project linked" }); return; }
  const msgs = await db.select().from(messagesTable)
    .where(eq(messagesTable.projectId, projectId))
    .orderBy(messagesTable.createdAt);

  await db.update(messagesTable).set({ isRead: 1 })
    .where(and(eq(messagesTable.projectId, projectId), eq(messagesTable.fromRole, "admin")));

  res.json(msgs);
});

router.post("/messages", async (req, res): Promise<void> => {
  const projectId = getClientProjectId(req);
  if (!projectId) { res.status(400).json({ error: "No project linked" }); return; }
  const { content } = req.body as { content: string };
  const id = randomBytes(16).toString("hex");
  await db.insert(messagesTable).values({
    id, projectId, fromRole: "client", fromName: req.session.name ?? "Cliente", content,
  });
  res.json({ id });
});

router.get("/reports", async (req, res): Promise<void> => {
  const projectId = getClientProjectId(req);
  if (!projectId) { res.status(400).json({ error: "No project linked" }); return; }

  const products = await db.select({
    id: productsTable.id,
    title: productsTable.title,
    auditScore: productsTable.auditScore,
    imagesJson: productsTable.imagesJson,
  }).from(productsTable).where(eq(productsTable.projectId, parseInt(projectId)));

  const scored = products.filter((p) => p.auditScore !== null);
  const avgSeoScore = scored.length > 0
    ? Math.round(scored.reduce((s, p) => s + (p.auditScore ?? 0), 0) / scored.length)
    : null;

  let imagesGenerated = 0;
  for (const p of products) {
    try {
      const imgs = p.imagesJson ? JSON.parse(p.imagesJson) : [];
      imagesGenerated += Array.isArray(imgs) ? imgs.length : 0;
    } catch {}
  }

  const recentActivity = await db.select().from(auditLogTable)
    .where(eq(auditLogTable.projectId, projectId))
    .orderBy(desc(auditLogTable.createdAt)).limit(20);

  const productsOptimized = scored.length;
  const revenueImpact = avgSeoScore != null && avgSeoScore > 60 ? `+${Math.round((avgSeoScore - 50) * 0.3)}%` : "—";

  res.json({
    productsOptimized,
    imagesGenerated,
    avgSeoScore,
    revenueImpact,
    timeline: recentActivity,
  });
});

router.get("/reports/export", async (req, res): Promise<void> => {
  const projectId = getClientProjectId(req);
  if (!projectId) { res.status(400).json({ error: "No project linked" }); return; }
  const rawFormat = (req.query.format as string) ?? "csv";
  const format = rawFormat === "csv" ? "csv" : "txt";

  const products = await db.select({
    id: productsTable.id,
    title: productsTable.title,
    auditScore: productsTable.auditScore,
    price: productsTable.price,
  }).from(productsTable).where(eq(productsTable.projectId, parseInt(projectId)));

  if (format === "csv") {
    const header = "ID,Título,Score,Precio\n";
    const rows = products.map(p => `${p.id},"${(p.title ?? "").replace(/"/g, '""')}",${p.auditScore ?? ""},${p.price ?? ""}`).join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=reporte-tienda.csv");
    res.send(header + rows);
  } else {
    const scored = products.filter(p => p.auditScore !== null);
    const avgScore = scored.length > 0
      ? Math.round(scored.reduce((s, p) => s + (p.auditScore ?? 0), 0) / scored.length)
      : null;

    const text = [
      "=== REPORTE DE TIENDA ===",
      `Fecha: ${new Date().toLocaleDateString("es-ES")}`,
      `Total productos: ${products.length}`,
      `Productos auditados: ${scored.length}`,
      `Score promedio: ${avgScore ?? "N/A"}`,
      "",
      "--- DETALLE POR PRODUCTO ---",
      ...products.map(p => `• ${p.title} — Score: ${p.auditScore ?? "N/A"} — Precio: ${p.price ?? "N/A"}`),
    ].join("\n");

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=reporte-tienda.txt");
    res.send(text);
  }
});

router.get("/products", async (req, res): Promise<void> => {
  const projectId = getClientProjectId(req);
  if (!projectId) { res.status(400).json({ error: "No project linked" }); return; }
  const rows = await db.select({
    id: productsTable.id,
    title: productsTable.title,
    price: productsTable.price,
    auditScore: productsTable.auditScore,
    auditGrade: productsTable.auditGrade,
    imagesJson: productsTable.imagesJson,
  }).from(productsTable)
    .where(eq(productsTable.projectId, parseInt(projectId)))
    .orderBy(desc(productsTable.auditScore))
    .limit(50);
  const products = rows.map((r) => {
    let images: string[] | null = null;
    try { images = r.imagesJson ? JSON.parse(r.imagesJson) : null; } catch {}
    return { id: r.id, title: r.title, price: r.price, auditScore: r.auditScore, auditGrade: r.auditGrade, images };
  });
  res.json(products);
});

export default router;
