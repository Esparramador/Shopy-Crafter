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
import { injectDbApiKeys } from "./routes/api-keys.js";
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

  // Inject DB-stored API keys into process.env (non-blocking)
  injectDbApiKeys().catch(() => {});

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
    .then(async () => {
      // ── Landing content v2 patch ──────────────────────────────────────────
      // Pushes professional stats/copy to the live DB. Idempotent: only runs
      // once (guarded by meta.landingV === 2). Does NOT overwrite other admin
      // customisations — only the specific fields listed below are replaced.
      try {
        const { cmsContent: cmsTable } = await import("@workspace/db/schema");
        const rows = await db.select().from(cmsTable).limit(1);
        if (!rows.length) return;
        const row = rows[0];
        const content = structuredClone(row.content) as Record<string, any>;
        if ((content?.meta as any)?.landingV === 2) return;

        content.results = content.results ?? {};
        content.results.stats = [
          { prefix: "+", num: "67", suffix: "%", label: "Incremento medio en conversión en 90 días", color: "var(--l-jade)" },
          { prefix: "", num: "95", suffix: "%", label: "Confianza estadística en todos los A/B tests", color: "var(--l-gold)" },
          { prefix: "", num: "99", suffix: ".9%", label: "Uptime garantizado de la plataforma", color: "var(--l-sky)" },
          { prefix: "", num: "6", suffix: " motores", label: "Trabajando autónomamente en tu tienda 24/7", color: "#8b5cf6" },
        ];
        content.results.techBadges = [
          { icon: "🛍️", label: "Shopify API" },
          { icon: "🤖", label: "Claude AI" },
          { icon: "✨", label: "Gemini AI" },
          { icon: "🎨", label: "Replicate" },
          { icon: "🔍", label: "Google Search" },
          { icon: "📧", label: "Klaviyo" },
          { icon: "🔐", label: "AES-256" },
          { icon: "⚡", label: "Shopify Flow" },
          { icon: "🎵", label: "ElevenLabs" },
        ];

        content.hero = content.hero ?? {};
        content.hero.pill = { text: "+50 tiendas activas · 6 motores de IA · Setup en 48h", visible: true };
        content.hero.trustItems = ["Setup completo en 48h", "Integración real con API Shopify", "RGPD compliant"];
        content.hero.demo = content.hero.demo ?? {};
        content.hero.demo.url = "shopycrafter.com/admin — Moda Urbana";
        content.hero.demo.metrics = [
          { label: "Revenue", value: "€18.7K", change: "↑ 18%" },
          { label: "Conversión", value: "3.8%", change: "↑ 0.7pp" },
          { label: "Margen", value: "52%", change: "↑ 7pts" },
          { label: "SEO", value: "81", change: "↑ 19pts" },
        ];
        content.hero.demo.stores = [
          { name: "Moda Urbana", score: "81" },
          { name: "TechGadgets", score: "68" },
          { name: "Casa & Arte", score: "44" },
        ];
        content.hero.demo.activity = [
          "A/B Test ganador · +22% conv.",
          "21 imágenes · €5.88",
          "Schema SEO · 87 productos",
        ];

        content.howCards = [
          { icon: "✓", title: "Auditoría completada", sub: "87 productos analizados · 6 acciones urgentes", barPercent: "88" },
          { icon: "🎨", title: "Imágenes generándose", sub: "flux-1.1-pro · 21/87 productos", barPercent: "24" },
          { icon: "⚗️", title: "A/B Test activo", sub: "Precio A vs B · 187 visitas · 71% confianza", barPercent: "71" },
        ];
        content.howImpact = { icon: "💰", title: "Impacto estimado", sub: "+€1.850/mes proyectados" };

        if (Array.isArray(content.features?.items)) {
          const featureStats = [
            [{ label: "Tipos imagen", value: "8" }, { label: "Generación", value: "<2.5s" }, { label: "Coste/prod", value: "~€0.25" }],
            [{ label: "ADN visual", value: "StyleLock" }, { label: "Análisis", value: "<3s" }, { label: "Coherencia", value: "100%" }],
            [{ label: "Confianza", value: "95%" }, { label: "Evaluación", value: "<1s" }, { label: "Auto-winner", value: "✓" }],
            [{ label: "Trigger", value: "Webhook" }, { label: "Ejecución", value: "<5s" }, { label: "Uptime", value: "99.9%" }],
            [{ label: "Motor COGS", value: "real" }, { label: "Actualización", value: "<2s" }, { label: "P&L", value: "en vivo" }],
            [{ label: "Schema", value: "JSON-LD" }, { label: "Core Web Vitals", value: "✓" }, { label: "Blog IA", value: "auto" }],
          ];
          content.features.items = content.features.items.map((item: any, i: number) => ({
            ...item,
            stats: featureStats[i] ?? item.stats,
          }));
        }

        content.meta = { ...(content.meta ?? {}), landingV: 2, lastUpdated: new Date().toISOString() };
        await db.update(cmsTable).set({ content, version: (row.version ?? 1) + 1, updatedAt: new Date() }).where(eq(cmsTable.id, row.id));
        logger.info("✅ Landing content patched to v2 (professional stats)");
      } catch (patchErr) {
        logger.warn({ err: patchErr }, "⚠️  patchLandingContentV2 failed — non-blocking");
      }
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
