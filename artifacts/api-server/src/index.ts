import app from "./app";
import { logger } from "./lib/logger";
import { registerCronJobs } from "./lib/scheduler.js";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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

async function ensureAdminUser() {
  try {
    const ADMIN_EMAIL = "sadiagiljoan@gmail.com";
    const ADMIN_PASS  = process.env.ADMIN_PASSWORD ?? "ShopyAdmin2026!";

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, ADMIN_EMAIL));
    if (existing.length === 0) {
      const hashed = await bcrypt.hash(ADMIN_PASS, 12);
      await db.insert(usersTable).values({
        id: randomBytes(16).toString("hex"),
        email: ADMIN_EMAIL,
        password: hashed,
        role: "admin",
      });
      logger.info({ email: ADMIN_EMAIL }, "✅ Admin user created on startup");
    } else {
      logger.info({ email: ADMIN_EMAIL, role: existing[0].role }, "✅ Admin user present");
    }
  } catch (err) {
    logger.error({ err }, "⚠️  ensureAdminUser failed — continuing startup");
  }
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  ensureAdminUser();
  registerCronJobs();
});
