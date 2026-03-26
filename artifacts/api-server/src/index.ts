import app from "./app";
import { logger } from "./lib/logger";
import { registerCronJobs } from "./lib/scheduler.js";
import { ensureAllKnowledgeDomains } from "./routes/shopybrain.js";
import { db, usersTable, projectsTable } from "@workspace/db";
import { eq, sql, isNull, or } from "drizzle-orm";
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
      if (!existing[0].name) {
        await db.update(usersTable).set({ name: ADMIN_NAME }).where(eq(usersTable.email, ADMIN_EMAIL));
        logger.info({ email: ADMIN_EMAIL }, "✅ Admin name patched");
      }
      logger.info({ email: ADMIN_EMAIL, role: existing[0].role }, "✅ Admin user present");
    }
  } catch (err) {
    logger.error({ err }, "⚠️  ensureAdminUser failed — continuing startup");
  }
}

const server = app.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  deduplicateProducts()
    .then(() => ensureAdminUser())
    .then(() => ensureProjectConfig())
    .then(() => ensureAllKnowledgeDomains())
    .then((created) => {
      if (created > 0) logger.info({ created }, "🧠 Knowledge domains seeded on startup");
      else logger.info("🧠 All knowledge domains already present");
    })
    .catch((err) => logger.error({ err }, "⚠️  Knowledge domain seeding failed — continuing startup"))
    .finally(() => registerCronJobs());
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
