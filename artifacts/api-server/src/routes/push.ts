import { Router } from "express";

const router = Router();

const subscriptions: Map<string, any> = new Map();

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

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
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
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    res.json({ key: null, configured: false });
    return;
  }
  res.json({ key, configured: true });
});

export default router;
