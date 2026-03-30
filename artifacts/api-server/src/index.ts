import { validateEncryptionKey } from "./lib/crypto.js";
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
import { db, usersTable, projectsTable, productsTable, omnicoreMemoriesTable } from "@workspace/db";
import { eq, sql, isNull, or } from "drizzle-orm";
import { shopifyRequestPaged } from "./lib/shopify.js";
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

    for (const project of projects) {
      const domain = project.shopDomain ?? "";
      let niche = "";
      let tone = "";

      if (domain.includes("comic")) {
        niche = "comics y arte digital";
        tone = "Creativo, apasionado y cercano";
      }

      if (niche) {
        await db.update(projectsTable)
          .set({
            storeNiche: niche,
            brandTone: tone,
            targetAudience: "Fans de cómics, manga y juegos de cartas coleccionables",
            storeMarkets: "España",
          })
          .where(eq(projectsTable.id, project.id));
        logger.info({ projectId: project.id, niche, tone }, "✅ Project config synced (niche + tone + audience + markets)");
      }
    }
  } catch (err) {
    logger.error({ err }, "⚠️  ensureProjectConfig failed — continuing startup");
  }
}

async function ensureAdminUser() {
  try {
    const ADMIN_EMAIL = "sadiagiljoan@gmail.com";
    const ADMIN_NAME  = "Joan Sadia Gil";
    const ADMIN_PASS  = process.env.ADMIN_PASSWORD ?? "ShopyAdmin2026!";

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
      if (!project.accessToken || !project.shopDomain) continue;

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
              const path = isFirst
                ? `/products.json?limit=250&status=${st}&published_status=any`
                : `/products.json?limit=250&page_info=${nextPageInfo}`;

              const pageResult = await shopifyRequestPaged<{ products: ShopifyProductRaw[] }>(
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

          let totalScore = 0;
          for (const sp of allProducts) {
            const audit = auditProduct({
              title: sp.title, body_html: sp.body_html,
              price: sp.variants?.[0]?.price, compare_at_price: sp.variants?.[0]?.compare_at_price,
              images: sp.images, tags: sp.tags,
            });
            await db.insert(productsTable).values({
              projectId: project.id, shopifyProductId: String(sp.id),
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
              set: { title: sp.title, status: sp.status, price: sp.variants?.[0]?.price ?? null },
            });
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

  deduplicateProducts()
    .then(() => ensureAdminUser())
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
    .catch((err) => logger.error({ err }, "⚠️  Startup seeding failed — continuing startup"))
    .finally(() => {
      registerCronJobs();
      setTimeout(() => warmupProdKnowledge(), 5000);
    });
});

// ── Extended timeouts for long-running AI research tasks ─────────────────────
// Entity research can take up to 4-5 minutes (8+ parallel Gemini searches + Claude)
// These prevent 504 Gateway Timeout errors from the Replit proxy
server.timeout          = 600_000;   // 10 min — max time for a single request socket
server.headersTimeout   = 660_000;   // 11 min — must be > timeout
server.keepAliveTimeout = 65_000;    // 65s   — keep-alive between requests
server.requestTimeout   = 600_000;   // 10 min — full request completion budget

logger.info({
  timeout: "10min",
  headersTimeout: "11min",
  keepAliveTimeout: "65s",
}, "⏱ Server timeout config applied");
