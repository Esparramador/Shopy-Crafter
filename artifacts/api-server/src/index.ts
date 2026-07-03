import { validateEncryptionKey, encrypt, safeDecrypt } from "./lib/crypto.js";
validateEncryptionKey();


import app from "./app";
import { logger } from "./lib/logger";
import {
  registerCronJobs,
  runOmniCoreDailyDeepStudy,
  runOmniCoreCrossConnections,
  runOmniCoreMemoryConsolidation,
  runOmniCoreMegaSynthesis,
  runRevenueSnapshots,
  runInventorySync,
} from "./lib/scheduler.js";
import { ensureAllKnowledgeDomains } from "./routes/shopybrain.js";
import { db, usersTable, projectsTable, productsTable, omnicoreMemoriesTable, seoDataTable } from "@workspace/db";
import { eq, sql, isNull, or, and } from "drizzle-orm";
import { shopifyRequestPaged, shopifyGraphQL } from "./lib/shopify.js";
import { auditProduct } from "./lib/audit.js";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function deduplicateProducts() {
  try {
    // PostgreSQL-specific USING syntax — migrate if changing DB engine
    const result = await db.execute(sql`
      DELETE FROM products a USING products b
      WHERE a.id < b.id
        AND a.project_id = b.project_id
        AND a.shopify_product_id = b.shopify_product_id
    `);
    const count = (result as any).rowCount ?? 0;
    if (count > 0) {
      logger.info({ removed: count }, "🧹 Duplicate products cleaned");
    }

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS products_project_shopify_unique
      ON products (project_id, shopify_product_id)
    `);
  } catch (err) {
    logger.error({ err }, "⚠️  deduplicateProducts failed — continuing startup");
  }
}

async function ensureProjectConfig() {
  try {
    const projects = await db.select().from(projectsTable)
      .where(or(isNull(projectsTable.storeNiche), eq(projectsTable.storeNiche, "")));

    if (projects.length > 0) {
      logger.info({ count: projects.length }, "📋 Projects without niche detected — set niche via project settings or onboarding");
    }
  } catch (err) {
    logger.error({ err }, "⚠️  ensureProjectConfig failed — continuing startup");
  }
}

async function ensureAdminUser() {
  try {
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@shopycrafter.com";
    const ADMIN_NAME  = process.env.ADMIN_NAME || "Admin";
    const envPass = process.env.ADMIN_PASSWORD;

    let ADMIN_PASS: string;
    if (envPass) {
      ADMIN_PASS = envPass;
    } else if (process.env.NODE_ENV === "production") {
      logger.error("❌ ADMIN_PASSWORD env var is required in production — skipping admin user creation");
      return;
    } else {
      ADMIN_PASS = randomBytes(24).toString("base64url");
      logger.info({ password: ADMIN_PASS }, "🔑 Generated dev admin password (ADMIN_PASSWORD env not set)");
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, ADMIN_EMAIL));
    if (existing.length === 0) {
      const hashed = await bcrypt.hash(ADMIN_PASS, 12);
      await db.insert(usersTable).values({
        id: randomBytes(16).toString("hex"),
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        password: hashed,
        role: "admin",
        isActive: 1,
      });
      logger.info({ email: ADMIN_EMAIL }, "✅ Admin user created on startup");
    } else {
      const needsNamePatch = !existing[0].name;
      const updates: Record<string, unknown> = {};
      if (needsNamePatch) updates.name = ADMIN_NAME;
      if (process.env.NODE_ENV !== "production") {
        const pwMatch = existing[0].password ? await bcrypt.compare(ADMIN_PASS, existing[0].password) : false;
        if (!pwMatch) {
          updates.password = await bcrypt.hash(ADMIN_PASS, 12);
          logger.info({ email: ADMIN_EMAIL }, "🔑 Admin password synced (dev only)");
        }
      }
      if (Object.keys(updates).length > 0) {
        await db.update(usersTable).set(updates).where(eq(usersTable.email, ADMIN_EMAIL));
      }
      logger.info({ email: ADMIN_EMAIL, role: existing[0].role }, "✅ Admin user present");
    }
  } catch (err) {
    logger.error({ err }, "⚠️  ensureAdminUser failed — continuing startup");
  }
}

async function migrateTokenEncryption() {
  try {
    const projects = await db.select().from(projectsTable);
    let migrated = 0;
    for (const project of projects) {
      if (!project.accessToken) continue;
      const decrypted = safeDecrypt(project.accessToken);
      if (decrypted) continue;
      await db
        .update(projectsTable)
        .set({ accessToken: encrypt(project.accessToken) })
        .where(eq(projectsTable.id, project.id));
      migrated++;
    }
    if (migrated > 0) {
      logger.info({ migrated }, "🔐 Migrated plaintext access tokens to AES-256-GCM encryption");
    }
  } catch (err) {
    logger.error({ err }, "⚠️  Token encryption migration failed — continuing startup");
  }
}

interface ShopifyProductRaw {
  id: number; title: string; handle: string; body_html: string;
  vendor: string; product_type: string; status: string;
  published_at: string | null; tags: string;
  variants?: { price: string; compare_at_price: string | null }[];
  images?: { id: number; src: string; alt: string | null }[];
}

async function warmupProdKnowledge() {
  try {
    const [memCount] = await db.select({ c: sql<number>`count(*)` }).from(omnicoreMemoriesTable);
    const totalMemories = Number(memCount?.c ?? 0);

    const projects = await db.select().from(projectsTable);
    if (projects.length === 0) { logger.info("⏭ Warmup: no projects, skipping"); return; }

    for (const project of projects) {
      const platformType = (project as any).platformType ?? "shopify";
      if (!project.accessToken && platformType === "shopify") continue;
      if (!project.shopDomain && platformType !== "universal") continue;

      const [prodCount] = await db.select({ c: sql<number>`count(*)` })
        .from(productsTable).where(eq(productsTable.projectId, project.id));
      const productTotal = Number(prodCount?.c ?? 0);

      if (productTotal === 0) {
        logger.info({ projectId: project.id, domain: project.shopDomain }, "🔄 Warmup: syncing products from Shopify...");
        try {
          let allProducts: ShopifyProductRaw[] = [];
          for (const st of ["active", "draft", "archived"]) {
            let nextPageInfo: string | null = null;
            let isFirst = true;
            while (true) {
              const path: string = isFirst
                ? `/products.json?limit=250&status=${st}&published_status=any`
                : `/products.json?limit=250&page_info=${nextPageInfo}`;

              const pageResult: { data: { products: ShopifyProductRaw[] }; nextPageInfo: string | null } = await shopifyRequestPaged<{ products: ShopifyProductRaw[] }>(
                project.id, project.shopDomain, path
              );
              isFirst = false;
              if (!pageResult.data.products?.length) break;
              allProducts = allProducts.concat(pageResult.data.products);
              nextPageInfo = pageResult.nextPageInfo;
              if (!nextPageInfo) break;
              await new Promise(r => setTimeout(r, 300));
            }
          }

          const seoLookupWarmup = new Map<string, { metaTitle: string | null; metaDesc: string | null }>();
          try {
            let seoHasNext = true;
            let seoCursor: string | null = null;
            while (seoHasNext) {
              const afterClause: string = seoCursor ? `, after: "${seoCursor}"` : "";
              const warmupSeoGql: string = `{ products(first: 250${afterClause}) { edges { node { id seo { title description } } } pageInfo { hasNextPage endCursor } } }`;
              const warmupSeoRes: { products: { edges: Array<{ node: { id: string; seo: { title: string | null; description: string | null } } }>; pageInfo: { hasNextPage: boolean; endCursor: string } } } = await shopifyGraphQL<{ products: { edges: Array<{ node: { id: string; seo: { title: string | null; description: string | null } } }>; pageInfo: { hasNextPage: boolean; endCursor: string } } }>(
                project.id, project.shopDomain, warmupSeoGql
              );
              for (const edge of warmupSeoRes.products?.edges ?? []) {
                const gid = edge.node.id.replace("gid://shopify/Product/", "");
                seoLookupWarmup.set(gid, { metaTitle: edge.node.seo?.title || null, metaDesc: edge.node.seo?.description || null });
              }
              seoHasNext = warmupSeoRes.products?.pageInfo?.hasNextPage ?? false;
              seoCursor = warmupSeoRes.products?.pageInfo?.endCursor ?? null;
              if (seoHasNext) await new Promise(r => setTimeout(r, 200));
            }
          } catch {
            logger.warn({ projectId: project.id }, "Warmup: GraphQL SEO fetch failed, auditing without SEO data");
          }

          let totalScore = 0;
          for (const sp of allProducts) {
            const spId = String(sp.id);
            const seoW = seoLookupWarmup.get(spId);
            const warmupMetafields: Array<{ namespace: string; key: string; value: string }> = [];
            if (seoW?.metaTitle) warmupMetafields.push({ namespace: "seo", key: "title", value: seoW.metaTitle });
            if (seoW?.metaDesc) warmupMetafields.push({ namespace: "seo", key: "description", value: seoW.metaDesc });

            const audit = auditProduct({
              title: sp.title, body_html: sp.body_html,
              price: sp.variants?.[0]?.price, compare_at_price: sp.variants?.[0]?.compare_at_price,
              images: sp.images, tags: sp.tags,
              variants: sp.variants?.map(v => ({ price: v.price })),
              metafields: warmupMetafields,
            });
            await db.insert(productsTable).values({
              projectId: project.id, shopifyProductId: spId,
              title: sp.title, handle: sp.handle, bodyHtml: sp.body_html,
              vendor: sp.vendor, productType: sp.product_type, status: sp.status,
              publishedAt: sp.published_at ?? null, tags: sp.tags,
              price: sp.variants?.[0]?.price ?? null,
              compareAtPrice: sp.variants?.[0]?.compare_at_price ?? null,
              imageCount: sp.images?.length ?? 0, variantCount: sp.variants?.length ?? 1,
              imagesJson: sp.images ?? [],
              auditScore: audit.overallScore, auditGrade: audit.grade,
              titleScore: audit.titleScore, descriptionScore: audit.descriptionScore,
              priceScore: audit.priceScore, imageScore: audit.imageScore,
              seoScore: audit.seoScore, auditProblems: audit.problems,
              lastAuditedAt: new Date(),
            }).onConflictDoUpdate({
              target: [productsTable.projectId, productsTable.shopifyProductId],
              set: {
                title: sp.title, status: sp.status, price: sp.variants?.[0]?.price ?? null,
                auditScore: audit.overallScore, auditGrade: audit.grade,
                seoScore: audit.seoScore, auditProblems: audit.problems,
              },
            });

            if (seoW?.metaTitle || seoW?.metaDesc) {
              const warmSeoVals = {
                metaTitle: seoW?.metaTitle || null,
                metaDescription: seoW?.metaDesc || null,
                hasAltTexts: (sp.images?.length ?? 0) > 0 && sp.images!.every(img => !!img.alt?.trim()),
                cleanHandle: !!sp.handle && /^[a-z0-9-]+$/.test(sp.handle),
                lastAuditedAt: new Date(),
              };
              const [existWarm] = await db.select({ id: seoDataTable.id }).from(seoDataTable)
                .where(and(eq(seoDataTable.projectId, project.id), eq(seoDataTable.shopifyProductId, spId)));
              if (existWarm) {
                await db.update(seoDataTable).set(warmSeoVals).where(eq(seoDataTable.id, existWarm.id));
              } else {
                await db.insert(seoDataTable).values({ projectId: project.id, shopifyProductId: spId, ...warmSeoVals });
              }
            }
            totalScore += audit.overallScore;
          }

          const avgScore = allProducts.length > 0 ? totalScore / allProducts.length : null;
          await db.update(projectsTable).set({ productCount: allProducts.length, avgAuditScore: avgScore }).where(eq(projectsTable.id, project.id));
          logger.info({ projectId: project.id, synced: allProducts.length, avgScore }, "✅ Warmup: products synced from Shopify");
        } catch (err) {
          logger.error({ err, projectId: project.id }, "⚠️ Warmup: product sync failed");
        }
      }
    }

    if (totalMemories < 250) {
      logger.info({ currentMemories: totalMemories }, "🧠 Warmup: knowledge below threshold, launching deep learning...");

      const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

      try {
        logger.info("🎓 Warmup: starting Daily Deep Study...");
        await runOmniCoreDailyDeepStudy();
        logger.info("✅ Warmup: Daily Deep Study complete");
      } catch (err) { logger.error({ err }, "⚠️ Warmup: Daily Deep Study failed"); }

      await delay(2000);

      try {
        logger.info("🔗 Warmup: starting Cross-Synthesis...");
        await runOmniCoreCrossConnections();
        logger.info("✅ Warmup: Cross-Synthesis complete");
      } catch (err) { logger.error({ err }, "⚠️ Warmup: Cross-Synthesis failed"); }

      await delay(2000);

      try {
        logger.info("🧠 Warmup: starting Memory Consolidation...");
        await runOmniCoreMemoryConsolidation();
        logger.info("✅ Warmup: Memory Consolidation complete");
      } catch (err) { logger.error({ err }, "⚠️ Warmup: Memory Consolidation failed"); }

      await delay(2000);

      try {
        logger.info("📊 Warmup: starting Revenue Snapshots...");
        await runRevenueSnapshots();
        logger.info("✅ Warmup: Revenue Snapshots complete");
      } catch (err) { logger.error({ err }, "⚠️ Warmup: Revenue Snapshots failed"); }

      try {
        logger.info("📦 Warmup: starting Inventory Sync...");
        await runInventorySync();
        logger.info("✅ Warmup: Inventory Sync complete");
      } catch (err) { logger.error({ err }, "⚠️ Warmup: Inventory Sync failed"); }

      await delay(2000);

      try {
        logger.info("🚀 Warmup: starting Mega-Synthesis...");
        await runOmniCoreMegaSynthesis();
        logger.info("✅ Warmup: Mega-Synthesis complete");
      } catch (err) { logger.error({ err }, "⚠️ Warmup: Mega-Synthesis failed"); }

      const [finalCount] = await db.select({ c: sql<number>`count(*)` }).from(omnicoreMemoriesTable);
      logger.info({ before: totalMemories, after: Number(finalCount?.c ?? 0) }, "🏁 Warmup: knowledge generation complete");
    } else {
      logger.info({ totalMemories }, "✅ Warmup: knowledge already sufficient, skipping learning");
    }
  } catch (err) {
    logger.error({ err }, "⚠️ Warmup failed — continuing startup");
  }
}

const server = app.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  db.execute(sql`
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0,
      blocked_until TIMESTAMP,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `).catch((err) => logger.error({ err }, "Failed to create rate_limits table"));

  import("./lib/client-advisor.js")
    .then((m) => m.ensureClientKnowledgeTable())
    .catch((err) => logger.warn({ err }, "client_knowledge table warning"));

  deduplicateProducts()
    .then(() => ensureAdminUser())
    .then(() => migrateTokenEncryption())
    .then(() => ensureProjectConfig())
    .then(() => ensureAllKnowledgeDomains())
    .then((created) => {
      if (created > 0) logger.info({ created }, "🧠 Knowledge domains seeded on startup");
      else logger.info("🧠 All knowledge domains already present");
    })
    .then(async () => {
      const { loadSeedInsights } = await import("./lib/seed-insights.js");
      return loadSeedInsights();
    })
    .then((seeded) => {
      if (seeded && seeded > 0) logger.info({ seeded }, "🌱 Seed insights loaded on first run");
    })
    .then(async () => {
      const { seedStripeKnowledge } = await import("./lib/stripe-brain-seeder.js");
      return seedStripeKnowledge();
    })
    .catch((err) => logger.error({ err }, "⚠️  Startup seeding failed — continuing startup"))
    .finally(() => {
      registerCronJobs();
      setTimeout(() => warmupProdKnowledge(), 5000);
    });
});

// ── Extended timeouts for long-running AI tasks ──────────────────────────────
// Long-form ad generation (3-20 min trailers / explainers / company speeches)
// concatenates 30-120 video clips. Even with 5x parallelism that can take
// 15-45 min wall-clock. Heartbeat (lib/long-running) keeps proxy alive.
server.timeout          = 3_600_000; // 60 min — max time for a single request socket
server.headersTimeout   = 3_660_000; // 61 min — must be > timeout
server.keepAliveTimeout = 65_000;    // 65s   — keep-alive between requests
server.requestTimeout   = 3_600_000; // 60 min — full request completion budget

logger.info({
  timeout: "60min",
  headersTimeout: "61min",
  keepAliveTimeout: "65s",
}, "⏱ Server timeout config applied (long-form ad ready)");

let isShuttingDown = false;
async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, "🛑 Graceful shutdown iniciado");

  const forceExitTimer = setTimeout(() => {
    logger.warn("⏱ Forzando salida tras 8s de espera");
    process.exit(1);
  }, 8000);
  forceExitTimer.unref();

  server.close((err) => {
    if (err) {
      logger.error({ err }, "Error cerrando server");
      process.exit(1);
    }
    logger.info("✅ Server cerrado limpio");
    process.exit(0);
  });

  setTimeout(() => {
    server.closeIdleConnections?.();
  }, 200).unref();

  setTimeout(() => {
    server.closeAllConnections?.();
  }, 4000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGHUP", () => gracefulShutdown("SIGHUP"));

// ── Heap memory monitor ───────────────────────────────────────────────────────
// Logs heap usage every 60 s and triggers graceful restart if heap exceeds
// 1.4 GB (headroom below --max-old-space-size=1536 MB).
const HEAP_WARN_MB  = 1100; // log WARN above this
const HEAP_LIMIT_MB = 1400; // graceful restart above this
let heapRestartTriggered = false;

const heapMonitor = setInterval(() => {
  const { heapUsed, heapTotal, rss, external } = process.memoryUsage();
  const usedMB  = Math.round(heapUsed  / 1024 / 1024);
  const totalMB = Math.round(heapTotal / 1024 / 1024);
  const rssMB   = Math.round(rss       / 1024 / 1024);
  const extMB   = Math.round(external  / 1024 / 1024);

  if (usedMB >= HEAP_LIMIT_MB && !heapRestartTriggered) {
    heapRestartTriggered = true;
    logger.error(
      { heapUsedMB: usedMB, heapTotalMB: totalMB, rssMB, limitMB: HEAP_LIMIT_MB },
      "🚨 Heap limit reached — iniciando restart preventivo para evitar OOM"
    );
    clearInterval(heapMonitor);
    gracefulShutdown("HEAP_LIMIT");
    return;
  }

  if (usedMB >= HEAP_WARN_MB) {
    logger.warn({ heapUsedMB: usedMB, heapTotalMB: totalMB, rssMB, extMB }, "⚠️  Heap alto — posible leak de memoria");
  } else {
    logger.info({ heapUsedMB: usedMB, heapTotalMB: totalMB, rssMB }, "🧠 Heap OK");
  }
}, 60_000);
heapMonitor.unref();
