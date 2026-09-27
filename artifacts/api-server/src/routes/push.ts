import { Router } from "express";
import { db, platformSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { requireAuth } from "../lib/auth.js";
// FIX C6: real push delivery via web-push (was a stub before)
import webpush from "web-push";

const router = Router();
/**
 * Suscripción push de cualquier usuario autenticado (admin y clientes). Se monta
 * ANTES del gate requireAdmin; el resto de /push/* sigue siendo solo admin.
 */
export const pushUserRouter = Router();

// ─── VAPID KEY MANAGEMENT (env or platform_settings table) ──────────────────
async function getVapidKeys(): Promise<{ publicKey: string | null; privateKey: string | null; subject: string }> {
  const subject = process.env.VAPID_SUBJECT || "mailto:craftershopy@gmail.com";
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
      subject,
    };
  }
  try {
    const [pubRow] = await db.select().from(platformSettingsTable)
      .where(eq(platformSettingsTable.key, "vapid_public_key")).limit(1);
    const [privRow] = await db.select().from(platformSettingsTable)
      .where(eq(platformSettingsTable.key, "vapid_private_key")).limit(1);
    if (pubRow?.value && privRow?.value) {
      return { publicKey: pubRow.value, privateKey: privRow.value, subject };
    }
  } catch (err) {
    logger.error({ err }, "push: failed to read VAPID keys from DB");
  }
  return { publicKey: null, privateKey: null, subject };
}

let webpushInitialized = false;
async function ensureWebpushInitialized(): Promise<{ publicKey: string; privateKey: string } | null> {
  const k = await getVapidKeys();
  if (!k.publicKey || !k.privateKey) return null;
  if (webpushInitialized) return { publicKey: k.publicKey, privateKey: k.privateKey };
  try {
    webpush.setVapidDetails(k.subject, k.publicKey, k.privateKey);
    webpushInitialized = true;
    return { publicKey: k.publicKey, privateKey: k.privateKey };
  } catch (err) {
    logger.error({ err }, "push: webpush.setVapidDetails failed");
    return null;
  }
}

function generateVapidKeys(): { publicKey: string; privateKey: string } {
  // web-push.generateVAPIDKeys returns proper VAPID-formatted P-256 keys
  const keys = webpush.generateVAPIDKeys();
  return { publicKey: keys.publicKey, privateKey: keys.privateKey };
}

// ─── PERSISTENT SUBSCRIPTION STORAGE (platform_settings as KV) ──────────────
// FIX C6: was Map<string,any> in RAM → lost on every restart. Now persisted in DB.
const SUB_KEY_PREFIX = "push_sub::";

async function upsert(key: string, value: string): Promise<void> {
  const [existing] = await db.select().from(platformSettingsTable)
    .where(eq(platformSettingsTable.key, key)).limit(1);
  if (existing) {
    await db.update(platformSettingsTable)
      .set({ value, updatedAt: new Date() })
      .where(eq(platformSettingsTable.key, key));
  } else {
    await db.insert(platformSettingsTable).values({ key, value });
  }
}

async function saveSubscription(userId: string, subscription: webpush.PushSubscription): Promise<void> {
  await upsert(SUB_KEY_PREFIX + userId, JSON.stringify(subscription));
}

async function loadSubscription(userId: string): Promise<webpush.PushSubscription | null> {
  try {
    const [row] = await db.select().from(platformSettingsTable)
      .where(eq(platformSettingsTable.key, SUB_KEY_PREFIX + userId)).limit(1);
    if (!row?.value) return null;
    return JSON.parse(row.value) as webpush.PushSubscription;
  } catch (err) {
    logger.error({ err, userId }, "push: failed to load subscription");
    return null;
  }
}

async function deleteSubscription(userId: string): Promise<void> {
  try {
    await db.delete(platformSettingsTable).where(eq(platformSettingsTable.key, SUB_KEY_PREFIX + userId));
  } catch (err) {
    logger.error({ err, userId }, "push: failed to delete subscription");
  }
}

// ─── ENDPOINTS ───────────────────────────────────────────────────────────────

pushUserRouter.post("/push/subscribe", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req.session as any).userId;
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      res.status(400).json({ error: "Invalid subscription payload (missing endpoint or keys)" });
      return;
    }

    await saveSubscription(userId, subscription);
    logger.info({ userId, endpoint: String(subscription.endpoint).slice(0, 50) }, "push: subscription saved");
    res.json({ ok: true, message: "Push notifications activadas" });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    logger.error({ err }, "push: subscribe failed");
    res.status(500).json({ error: msg });
  }
});

pushUserRouter.delete("/push/subscribe", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req.session as any).userId;
    if (userId) await deleteSubscription(userId);
    res.json({ ok: true });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/push/send", async (req, res): Promise<void> => {
  try {
    const { userId, title, body, url } = req.body as { userId?: string; title: string; body: string; url?: string };

    const init = await ensureWebpushInitialized();
    if (!init) {
      res.status(503).json({ error: "Push notifications not configured (VAPID keys missing)" });
      return;
    }

    if (!title || !body) {
      res.status(400).json({ error: "title and body are required" });
      return;
    }

    const sub = userId ? await loadSubscription(userId) : null;
    if (!sub) {
      res.status(404).json({ error: "No subscription found for user" });
      return;
    }

    const payload = JSON.stringify({ title, body, url: url || "/" });
    try {
      // FIX C6: actually send the notification (was missing before)
      await webpush.sendNotification(sub, payload);
      logger.info({ userId, title }, "push: notification sent");
      res.json({ ok: true, message: "Notification sent" });
    } catch (sendErr: any) {
      // Subscription is stale (410 Gone) → delete it
      if (sendErr?.statusCode === 410 || sendErr?.statusCode === 404) {
        if (userId) await deleteSubscription(userId);
        res.status(410).json({ error: "Subscription expired and was removed" });
        return;
      }
      logger.error({ err: sendErr, userId }, "push: webpush.sendNotification failed");
      res.status(502).json({ error: "Failed to deliver notification" });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    logger.error({ err }, "push: send failed");
    res.status(500).json({ error: msg });
  }
});

pushUserRouter.get("/push/vapid-key", requireAuth, async (_req, res): Promise<void> => {
  try {
    const { publicKey } = await getVapidKeys();
    if (!publicKey) { res.json({ key: null, configured: false }); return; }
    res.json({ key: publicKey, configured: true });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/push/vapid-generate", async (_req, res): Promise<void> => {
  try {
    const existing = await getVapidKeys();
    if (existing.publicKey && existing.privateKey) {
      res.status(409).json({ error: "VAPID keys already configured. Delete from platform_settings first to regenerate." });
      return;
    }
    const { publicKey, privateKey } = generateVapidKeys();
    await upsert("vapid_public_key", publicKey);
    await upsert("vapid_private_key", privateKey);
    webpushInitialized = false; // force re-init on next send
    res.json({ ok: true, publicKey, message: "Claves VAPID generadas y guardadas." });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    logger.error({ err }, "push: vapid-generate failed");
    res.status(500).json({ error: msg });
  }
});

export default router;
