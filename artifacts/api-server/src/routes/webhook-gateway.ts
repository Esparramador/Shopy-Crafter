import { Router, type Request, type Response } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { db, projectsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { safeDecrypt } from "../lib/crypto.js";

const router = Router();

// ─── HELPER: raw body must be preserved for all webhook routes ────────────────
// Express must be configured with express.raw() or rawBody middleware upstream.

function verifyShopifyHmac(secret: string, rawBody: Buffer, hmacHeader: string): boolean {
  // SECURITY: fail-closed — reject ALL requests if secret is not configured
  if (!secret) return false;
  const digest = createHmac("sha256", secret).update(rawBody).digest("base64");
  try {
    const a = Buffer.from(digest), b = Buffer.from(hmacHeader);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

function verifyWooCommerceHmac(secret: string, rawBody: Buffer, sigHeader: string): boolean {
  // SECURITY: fail-closed — reject ALL requests if secret is not configured
  if (!secret) return false;
  const digest = createHmac("sha256", secret).update(rawBody).digest("base64");
  try {
    const a = Buffer.from(digest), b = Buffer.from(sigHeader);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

function verifyStripeSignature(secret: string, rawBody: Buffer, sigHeader: string): boolean {
  // SECURITY: fail-closed — reject ALL requests if secret is not configured
  if (!secret) return false;
  try {
    const parts = sigHeader.split(",");
    const ts = parts.find(p => p.startsWith("t="))?.split("=")[1];
    const v1 = parts.find(p => p.startsWith("v1="))?.split("=")[1];
    if (!ts || !v1) return false;
    const payload = `${ts}.${rawBody.toString("utf8")}`;
    const digest = createHmac("sha256", secret).update(payload).digest("hex");
    const a = Buffer.from(digest), b = Buffer.from(v1);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

// Las consultas de ingresos usan ON CONFLICT (project_id, date) y updated_at,
// que el esquema original no tenía: fallaban en silencio y ningún webhook
// registraba ventas. Migración idempotente, una vez por proceso.
let schemaReady: Promise<void> | null = null;
function ensureWebhookSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await db.execute(sql`ALTER TABLE revenue_snapshots ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP`);
    // Duplicados (project_id, date) impedirían el índice único: se deja la fila más reciente.
    await db.execute(sql`
      DELETE FROM revenue_snapshots a USING revenue_snapshots b
      WHERE a.project_id = b.project_id AND a.date = b.date
        AND (COALESCE(a.created_at, 'epoch'), a.ctid) < (COALESCE(b.created_at, 'epoch'), b.ctid)
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS revenue_snapshots_project_date_uq ON revenue_snapshots (project_id, date)`);
  })().catch(err => {
    schemaReady = null;
    logger.error({ err }, "webhook-gateway: schema migration failed");
  });
  return schemaReady;
}

router.use("/webhooks", (_req, _res, next) => { void ensureWebhookSchema().then(() => next()); });

/** clientSecret se guarda cifrado; proyectos antiguos pueden tenerlo en claro. */
function projectWebhookSecret(stored: string | null | undefined): string {
  if (!stored) return "";
  return safeDecrypt(stored) || stored;
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function getProjectByCriteria(where: "shopDomain" | "id", value: string) {
  if (where === "id") {
    const [p] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(value))).limit(1);
    return p;
  }
  const [p] = await db.select().from(projectsTable)
    .where(eq(projectsTable.shopDomain, value)).limit(1);
  return p;
}

async function deactivateProject(projectId: number, reason: string) {
  // projects no tiene user_id (la consulta anterior fallaba en silencio y nunca
  // cancelaba nada): el cliente del proyecto es users.client_id = id del proyecto.
  await db.execute(sql`
    UPDATE subscriptions SET status = 'cancelled', updated_at = NOW()
    WHERE user_id IN (SELECT id FROM users WHERE client_id = ${String(projectId)} AND role = 'client')
  `).catch(err => logger.error({ err, projectId }, "deactivateProject: subscription cancel failed"));
  logger.info({ projectId, reason }, "🔴 Project deactivated via webhook");
}

// ─── SHOPIFY: app/uninstalled ─────────────────────────────────────────────────
router.post("/webhooks/shopify/app-uninstalled", async (req: Request, res: Response) => {
  try {
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET ?? "";
    const rawBody: Buffer = (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body));
    const hmac = (req.headers["x-shopify-hmac-sha256"] as string) ?? "";
    if (!verifyShopifyHmac(secret, rawBody, hmac)) {
      return void res.status(401).json({ error: "HMAC inválido" });
    }
    const shopDomain = (req.headers["x-shopify-shop-domain"] as string) ?? req.body?.domain ?? "";
    if (shopDomain) {
      const project = await getProjectByCriteria("shopDomain", shopDomain);
      if (project) {
        await deactivateProject(project.id, "app_uninstalled");
        await db.execute(sql`
          UPDATE projects SET access_token = NULL, updated_at = NOW() WHERE id = ${project.id}
        `).catch(err => logger.error({ err }, "webhook-gateway: SQL failed"));
      }
    }
    logger.info({ shopDomain }, "Shopify app/uninstalled procesado");
    res.sendStatus(200);
  } catch (err: any) {
    logger.error({ err }, "POST /webhooks/shopify/app-uninstalled error");
    res.sendStatus(200);
  }
});

// ─── SHOPIFY: orders/cancelled ────────────────────────────────────────────────
router.post("/webhooks/shopify/orders-cancelled", async (req: Request, res: Response) => {
  try {
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET ?? "";
    const rawBody: Buffer = (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body));
    const hmac = (req.headers["x-shopify-hmac-sha256"] as string) ?? "";
    if (!verifyShopifyHmac(secret, rawBody, hmac)) return void res.status(401).json({ error: "HMAC inválido" });

    const order = req.body as Record<string, any>;
    const shopDomain = (req.headers["x-shopify-shop-domain"] as string) ?? "";

    // Log cancelled order for revenue correction
    if (shopDomain) {
      const project = await getProjectByCriteria("shopDomain", shopDomain);
      if (project) {
        const cancelAmount = parseFloat(order.total_price ?? "0");
        await db.execute(sql`
          INSERT INTO events (id, project_id, event_type, payload, created_at)
          VALUES (gen_random_uuid(), ${String(project.id)}, 'order_cancelled',
            ${"Pedido cancelado #" + (order.order_number ?? order.id) + " — €" + cancelAmount.toFixed(2)}, NOW())
          ON CONFLICT DO NOTHING
        `).catch(err => logger.error({ err }, "webhook-gateway: SQL failed"));
        logger.info({ projectId: project.id, orderId: order.id, amount: cancelAmount }, "Pedido cancelado registrado");
      }
    }
    res.sendStatus(200);
  } catch (err: any) {
    logger.error({ err }, "POST /webhooks/shopify/orders-cancelled error");
    res.sendStatus(200);
  }
});

// ─── SHOPIFY: refunds/create ──────────────────────────────────────────────────
router.post("/webhooks/shopify/refunds", async (req: Request, res: Response) => {
  try {
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET ?? "";
    const rawBody: Buffer = (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body));
    const hmac = (req.headers["x-shopify-hmac-sha256"] as string) ?? "";
    if (!verifyShopifyHmac(secret, rawBody, hmac)) return void res.status(401).json({ error: "HMAC inválido" });

    const refund = req.body as Record<string, any>;
    const shopDomain = (req.headers["x-shopify-shop-domain"] as string) ?? "";
    const refundAmount = (refund.transactions ?? [])
      .reduce((s: number, t: any) => s + parseFloat(t.amount ?? "0"), 0);

    if (shopDomain) {
      const project = await getProjectByCriteria("shopDomain", shopDomain);
      if (project) {
        await db.execute(sql`
          INSERT INTO events (id, project_id, event_type, payload, created_at)
          VALUES (gen_random_uuid(), ${String(project.id)}, 'refund_created',
            ${"Reembolso registrado: €" + refundAmount.toFixed(2) + " (pedido #" + (refund.order_id ?? "") + ")"}, NOW())
          ON CONFLICT DO NOTHING
        `).catch(err => logger.error({ err }, "webhook-gateway: SQL failed"));
        // Adjust today's revenue snapshot
        const today = new Date().toISOString().split("T")[0];
        await db.execute(sql`
          UPDATE revenue_snapshots
          SET revenue = GREATEST(0, revenue - ${refundAmount}), updated_at = NOW()
          WHERE project_id = ${String(project.id)} AND date = ${today}
        `).catch(err => logger.error({ err }, "webhook-gateway: SQL failed"));
        logger.info({ projectId: project.id, refundAmount }, "Reembolso Shopify procesado");
      }
    }
    res.sendStatus(200);
  } catch (err: any) {
    logger.error({ err }, "POST /webhooks/shopify/refunds error");
    res.sendStatus(200);
  }
});

// ─── WOOCOMMERCE: orders webhook ──────────────────────────────────────────────
// WooCommerce sends: X-WC-Webhook-Topic, X-WC-Webhook-Signature, X-WC-Webhook-Source
// Register in WC Admin → Settings → Advanced → Webhooks
// URL: /api/webhooks/woocommerce/:projectId
router.post("/webhooks/woocommerce/:projectId", async (req: Request, res: Response) => {
  try {
    const projectId = String(req.params.projectId);
    const project = await getProjectByCriteria("id", projectId);
    if (!project) return void res.status(404).json({ error: "Proyecto no encontrado" });

    // Verify WooCommerce HMAC-SHA256 signature. Fail-closed: sin secret no se
    // acepta nada (antes cualquiera podía inyectar pedidos en proyectos sin
    // secret). El secret se guarda cifrado: se compara con el valor en claro.
    const secret = projectWebhookSecret(project.clientSecret);
    const rawBody: Buffer | undefined = (req as any).rawBody;
    const sigHeader = (req.headers["x-wc-webhook-signature"] as string) ?? "";
    if (!rawBody || !verifyWooCommerceHmac(secret, rawBody, sigHeader)) {
      logger.warn({ projectId }, "WooCommerce webhook firma inválida");
      return void res.status(401).json({ error: "Firma inválida" });
    }

    const topic = (req.headers["x-wc-webhook-topic"] as string) ?? "";
    const payload = req.body as Record<string, any>;

    if (topic === "order.created" || topic === "order.updated") {
      if (payload.status === "completed" || payload.status === "processing") {
        const total = parseFloat(payload.total ?? "0");
        const today = new Date().toISOString().split("T")[0];
        await db.execute(sql`
          INSERT INTO revenue_snapshots (id, project_id, date, revenue, orders, aov, created_at)
          VALUES (gen_random_uuid(), ${String(project.id)}, ${today}, ${total}, 1, ${total}, NOW())
          ON CONFLICT (project_id, date)
          DO UPDATE SET revenue = revenue_snapshots.revenue + ${total},
                        orders = revenue_snapshots.orders + 1,
                        aov = (revenue_snapshots.revenue + ${total}) / (revenue_snapshots.orders + 1),
                        updated_at = NOW()
        `).catch(err => logger.error({ err }, "webhook-gateway: SQL failed"));
        await db.execute(sql`
          INSERT INTO events (id, project_id, event_type, payload, created_at)
          VALUES (gen_random_uuid(), ${String(project.id)}, 'woo_order',
            ${"WooCommerce: Pedido #" + (payload.number ?? payload.id) + " €" + total.toFixed(2) + " — " + (payload.status ?? "")}, NOW())
          ON CONFLICT DO NOTHING
        `).catch(err => logger.error({ err }, "webhook-gateway: SQL failed"));
        logger.info({ projectId: project.id, orderId: payload.id, total, topic }, "WooCommerce order procesado");
      }
    } else if (topic === "order.deleted") {
      const total = parseFloat(payload.total ?? "0");
      const today = new Date().toISOString().split("T")[0];
      await db.execute(sql`
        UPDATE revenue_snapshots
        SET revenue = GREATEST(0, revenue - ${total}), orders = GREATEST(0, orders - 1), updated_at = NOW()
        WHERE project_id = ${String(project.id)} AND date = ${today}
      `).catch(err => logger.error({ err }, "webhook-gateway: SQL failed"));
    }

    res.sendStatus(200);
  } catch (err: any) {
    logger.error({ err }, "POST /webhooks/woocommerce/:projectId error");
    res.sendStatus(200);
  }
});

// ─── PRESTASHOP: orders webhook ───────────────────────────────────────────────
// PrestaShop sends via module (e.g., ps_eventbus or custom module)
// Header: X-PrestaShop-Secret (configured in module settings = project.clientSecret)
// URL: /api/webhooks/prestashop/:projectId
router.post("/webhooks/prestashop/:projectId", async (req: Request, res: Response) => {
  try {
    const projectId = String(req.params.projectId);
    const project = await getProjectByCriteria("id", projectId);
    if (!project) return void res.status(404).json({ error: "Proyecto no encontrado" });

    // Verify via shared secret header (fail-closed, comparación en tiempo constante)
    const secret = projectWebhookSecret(project.clientSecret);
    const receivedSecret = (req.headers["x-prestashop-secret"] as string) ?? "";
    if (!secret || !safeEqual(receivedSecret, secret)) {
      logger.warn({ projectId }, "PrestaShop webhook secret inválido");
      return void res.status(401).json({ error: "Secret inválido" });
    }

    const event = (req.headers["x-prestashop-event"] as string) ?? req.body?.event ?? "order.validated";
    const payload = req.body as Record<string, any>;

    if (event === "order.validated" || event === "order.paid" || event === "actionValidateOrder") {
      const total = parseFloat(payload.total_paid ?? payload.total ?? "0");
      const today = new Date().toISOString().split("T")[0];
      await db.execute(sql`
        INSERT INTO revenue_snapshots (id, project_id, date, revenue, orders, aov, created_at)
        VALUES (gen_random_uuid(), ${String(project.id)}, ${today}, ${total}, 1, ${total}, NOW())
        ON CONFLICT (project_id, date)
        DO UPDATE SET revenue = revenue_snapshots.revenue + ${total},
                      orders = revenue_snapshots.orders + 1,
                      aov = (revenue_snapshots.revenue + ${total}) / (revenue_snapshots.orders + 1),
                      updated_at = NOW()
      `).catch(err => logger.error({ err }, "webhook-gateway: SQL failed"));
      await db.execute(sql`
        INSERT INTO events (id, project_id, event_type, payload, created_at)
        VALUES (gen_random_uuid(), ${String(project.id)}, 'presta_order',
          ${"PrestaShop: Pedido #" + (payload.id_order ?? payload.id ?? "") + " €" + total.toFixed(2)}, NOW())
        ON CONFLICT DO NOTHING
      `).catch(err => logger.error({ err }, "webhook-gateway: SQL failed"));
      logger.info({ projectId: project.id, orderId: payload.id_order, total }, "PrestaShop order procesado");
    } else if (event === "order.cancelled" || event === "actionOrderStatusUpdate") {
      const status = payload.current_state ?? payload.status ?? "";
      if (String(status) === "6" || String(status).toLowerCase().includes("cancel")) {
        const total = parseFloat(payload.total_paid ?? "0");
        const today = new Date().toISOString().split("T")[0];
        await db.execute(sql`
          UPDATE revenue_snapshots
          SET revenue = GREATEST(0, revenue - ${total}), orders = GREATEST(0, orders - 1), updated_at = NOW()
          WHERE project_id = ${String(project.id)} AND date = ${today}
        `).catch(err => logger.error({ err }, "webhook-gateway: SQL failed"));
      }
    }

    res.sendStatus(200);
  } catch (err: any) {
    logger.error({ err }, "POST /webhooks/prestashop/:projectId error");
    res.sendStatus(200);
  }
});

// ─── STRIPE: invoice.paid / subscription events ───────────────────────────────
// For client Stripe accounts — events from their connected accounts
// URL: /api/webhooks/stripe
router.post("/webhooks/stripe", async (req: Request, res: Response) => {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
    const rawBody: Buffer = (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body));
    const sigHeader = (req.headers["stripe-signature"] as string) ?? "";
    if (!verifyStripeSignature(secret, rawBody, sigHeader)) {
      logger.warn("Stripe webhook signature inválida");
      return void res.status(401).json({ error: "Signature inválida" });
    }

    const event = req.body as Record<string, any>;
    const eventType: string = event.type ?? "";
    const obj = event.data?.object ?? {};
    // Connected account (client's Stripe account)
    const connectedAccountId: string = (event.account as string) ?? "";

    logger.info({ eventType, connectedAccountId }, "Stripe webhook recibido");

    if (eventType === "invoice.paid" || eventType === "charge.succeeded") {
      const amount = (obj.amount_paid ?? obj.amount ?? 0) / 100;
      const currency = (obj.currency ?? "eur").toUpperCase();
      if (connectedAccountId) {
        // Find project linked to this Stripe account
        const [proj] = await db.select({ id: projectsTable.id })
          .from(projectsTable)
          .where(eq(projectsTable.shopDomain, connectedAccountId))
          .limit(1);
        const projectId = proj?.id;
        if (projectId) {
          const today = new Date().toISOString().split("T")[0];
          await db.execute(sql`
            INSERT INTO revenue_snapshots (id, project_id, date, revenue, orders, aov, created_at)
            VALUES (gen_random_uuid(), ${String(projectId)}, ${today}, ${amount}, 1, ${amount}, NOW())
            ON CONFLICT (project_id, date)
            DO UPDATE SET revenue = revenue_snapshots.revenue + ${amount},
                          orders = revenue_snapshots.orders + 1,
                          aov = (revenue_snapshots.revenue + ${amount}) / (revenue_snapshots.orders + 1),
                          updated_at = NOW()
          `).catch(err => logger.error({ err }, "webhook-gateway: SQL failed"));
          await db.execute(sql`
            INSERT INTO events (id, project_id, event_type, payload, created_at)
            VALUES (gen_random_uuid(), ${String(projectId)}, 'stripe_payment',
              ${"Stripe: Pago recibido " + amount.toFixed(2) + " " + currency}, NOW())
            ON CONFLICT DO NOTHING
          `).catch(err => logger.error({ err }, "webhook-gateway: SQL failed"));
          logger.info({ projectId, amount, currency }, "✅ Stripe payment registrado via webhook");
        }
      }
    } else if (eventType === "checkout.session.completed") {
      // Platform SaaS billing — activate plan for user after Stripe Checkout
      const { userId, planId } = (obj.metadata ?? {}) as { userId?: string; planId?: string };
      if (userId && planId && !connectedAccountId) {
        try {
          const { subscriptionsTable: subTable } = await import("@workspace/db");
          const periodEnd = new Date();
          periodEnd.setDate(periodEnd.getDate() + 30);
          const existing = await db.select({ id: subTable.userId }).from(subTable).where(eq(subTable.userId, userId)).limit(1);
          const updates = {
            plan: planId,
            status: "active" as const,
            currentPeriodEnd: periodEnd,
            trialEndsAt: null,
            cancelAtPeriodEnd: 0,
            stripeCustomerId: obj.customer ?? null,
            stripeSubscriptionId: obj.subscription ?? null,
          };
          if (existing.length > 0) {
            await db.update(subTable).set(updates).where(eq(subTable.userId, userId));
          } else {
            await db.insert(subTable).values({ userId, ...updates, storesLimit: 1, imagesIncluded: 10 });
          }
          logger.info({ userId, planId, sessionId: obj.id }, "✅ Plan SaaS activado via Stripe Checkout");
        } catch (activateErr) {
          logger.error({ activateErr, userId, planId }, "❌ Error activando plan SaaS tras Stripe Checkout");
        }
      }
    } else if (eventType === "customer.subscription.deleted") {
      const customerId = obj.customer ?? "";
      logger.info({ customerId, connectedAccountId }, "Stripe suscripción cancelada");
    } else if (eventType === "charge.refunded") {
      const amount = (obj.amount_refunded ?? 0) / 100;
      logger.info({ amount, connectedAccountId }, "Stripe reembolso procesado");
    }

    res.json({ received: true });
  } catch (err: any) {
    logger.error({ err }, "POST /webhooks/stripe error");
    res.sendStatus(200);
  }
});

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
router.get("/webhooks/status", (_req, res) => {
  res.json({
    status: "operational",
    endpoints: [
      "POST /api/webhooks/shopify/orders-paid        (billing — tienda.ts)",
      "POST /api/webhooks/shopify/app-uninstalled    (deactivates subscription)",
      "POST /api/webhooks/shopify/orders-cancelled   (logs cancellation event)",
      "POST /api/webhooks/shopify/refunds            (adjusts revenue snapshot)",
      "POST /api/webhooks/woocommerce/:projectId     (X-WC-Webhook-Signature)",
      "POST /api/webhooks/prestashop/:projectId      (X-PrestaShop-Secret)",
      "POST /api/webhooks/stripe                     (Stripe-Signature)",
    ],
    configuredSecrets: {
      SHOPIFY_WEBHOOK_SECRET: !!process.env.SHOPIFY_WEBHOOK_SECRET,
      STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
    },
  });
});

export default router;
