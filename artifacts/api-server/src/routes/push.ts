import { Router } from "express";
import crypto from "node:crypto";
import { db, platformSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const subscriptions: Map<string, any> = new Map();

async function getVapidKeys(): Promise<{ publicKey: string | null; privateKey: string | null }> {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  try {
    const [pubRow] = await db.select().from(platformSettingsTable)
      .where(eq(platformSettingsTable.key, "vapid_public_key")).limit(1);
    const [privRow] = await db.select().from(platformSettingsTable)
      .where(eq(platformSettingsTable.key, "vapid_private_key")).limit(1);
    if (pubRow?.value && privRow?.value) {
      return { publicKey: pubRow.value, privateKey: privRow.value };
    }
  } catch {}
  return { publicKey: null, privateKey: null };
}

function generateVapidKeys(): { publicKey: string; privateKey: string } {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const publicKey = ecdh.getPublicKey("base64url") as string;
  const privateKey = ecdh.getPrivateKey("base64url") as string;
  return { publicKey, privateKey };
}

router.post("/push/subscribe", async (req, res): Promise<void> => {
  const userId = (req.session as any).userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const { subscription } = req.body;
  if (!subscription) { res.status(400).json({ error: "subscription required" }); return; }

  subscriptions.set(userId, subscription);
  res.json({ ok: true, message: "Push notifications activadas" });
});

router.delete("/push/subscribe", async (req, res): Promise<void> => {
  const userId = (req.session as any).userId;
  if (userId) subscriptions.delete(userId);
  res.json({ ok: true });
});

router.post("/push/send", async (req, res): Promise<void> => {
  const { userId, title, body, url } = req.body;

  const { publicKey } = await getVapidKeys();
  if (!publicKey) {
    res.status(503).json({ error: "Push notifications not configured (VAPID keys missing)" });
    return;
  }

  const sub = userId ? subscriptions.get(userId) : null;
  if (!sub) {
    res.status(404).json({ error: "No subscription found for user" });
    return;
  }

  res.json({ ok: true, message: "Notification queued", title, body });
});

router.get("/push/vapid-key", async (_req, res): Promise<void> => {
  const { publicKey } = await getVapidKeys();
  if (!publicKey) {
    res.json({ key: null, configured: false });
    return;
  }
  res.json({ key: publicKey, configured: true });
});

router.post("/push/vapid-generate", async (req, res): Promise<void> => {
  const existing = await getVapidKeys();
  if (existing.publicKey) {
    res.json({ publicKey: existing.publicKey, message: "VAPID keys already configured" });
    return;
  }

  const keys = generateVapidKeys();

  try {
    await db.insert(platformSettingsTable).values({ key: "vapid_public_key", value: keys.publicKey });
    await db.insert(platformSettingsTable).values({ key: "vapid_private_key", value: keys.privateKey });
  } catch {
    try {
      await db.update(platformSettingsTable).set({ value: keys.publicKey })
        .where(eq(platformSettingsTable.key, "vapid_public_key"));
      await db.update(platformSettingsTable).set({ value: keys.privateKey })
        .where(eq(platformSettingsTable.key, "vapid_private_key"));
    } catch {}
  }

  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;

  res.json({ publicKey: keys.publicKey, message: "VAPID keys generated and saved" });
});

export default router;
