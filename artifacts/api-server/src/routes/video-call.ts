import { Router } from "express";
import webpush from "web-push";
import { db, projectsTable, platformSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { requireAuth, requireAdmin } from "../lib/auth.js";
import crypto from "crypto";

const router = Router();

// ─── In-memory call store (ephemeral, TTL 10min) ──────────────────────────────
interface VideoCall {
  id: string;
  projectId: number;
  clientId: string;
  roomUrl: string;
  jitsiRoom: string;
  status: "ringing" | "active" | "ended" | "rejected";
  initiatedBy: "admin" | "client";
  createdAt: number;
}

const calls = new Map<string, VideoCall>();

setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [id, call] of calls.entries()) {
    if (call.createdAt < cutoff) calls.delete(id);
  }
}, 60_000);

// ─── Push helper keys ─────────────────────────────────────────────────────────
const SUB_KEY_PREFIX   = "push_sub::";
const CLIENT_SUB_PFX   = "push_sub_client::";
const ADMIN_PRIMARY_KEY = "push_sub_admin_primary";

async function getVapidKeys(): Promise<{ publicKey: string | null; privateKey: string | null; subject: string }> {
  const subject = process.env.VAPID_SUBJECT || "mailto:craftershopy@gmail.com";
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY, subject };
  }
  try {
    const [pub]  = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, "vapid_public_key")).limit(1);
    const [priv] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, "vapid_private_key")).limit(1);
    return { publicKey: pub?.value ?? null, privateKey: priv?.value ?? null, subject };
  } catch { return { publicKey: null, privateKey: null, subject }; }
}

async function loadSub(key: string): Promise<webpush.PushSubscription | null> {
  try {
    const [row] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, key)).limit(1);
    if (!row?.value) return null;
    return JSON.parse(row.value) as webpush.PushSubscription;
  } catch { return null; }
}

async function upsertSetting(key: string, value: string): Promise<void> {
  const [ex] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, key)).limit(1);
  if (ex) await db.update(platformSettingsTable).set({ value, updatedAt: new Date() }).where(eq(platformSettingsTable.key, key));
  else     await db.insert(platformSettingsTable).values({ key, value });
}

async function tryPush(subKey: string, payload: object): Promise<void> {
  const keys = await getVapidKeys();
  if (!keys.publicKey || !keys.privateKey) return;
  const sub = await loadSub(subKey);
  if (!sub) return;
  try {
    webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
    await webpush.sendNotification(sub, JSON.stringify(payload));
  } catch (err: any) {
    logger.warn({ err: err?.message, subKey }, "video-call: push silently failed");
  }
}

// ─── Push subscription endpoint (saves by role: clientId or admin-primary) ────
router.post("/video-call/push-register", requireAuth, async (req, res): Promise<void> => {
  const session = req.session as any;
  const { subscription } = req.body as { subscription: webpush.PushSubscription };
  if (!subscription?.endpoint || !subscription?.keys) { res.status(400).json({ error: "Invalid subscription" }); return; }
  try {
    await upsertSetting(SUB_KEY_PREFIX + session.userId, JSON.stringify(subscription));
    if (session.role === "client" && session.clientId) {
      await upsertSetting(CLIENT_SUB_PFX + session.clientId, JSON.stringify(subscription));
    }
    if (session.role === "admin") {
      await upsertSetting(ADMIN_PRIMARY_KEY, JSON.stringify(subscription));
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// ─── VAPID public key (for SW registration) ───────────────────────────────────
router.get("/video-call/vapid-key", async (_req, res): Promise<void> => {
  const keys = await getVapidKeys();
  res.json({ publicKey: keys.publicKey || null });
});

// ─── Admin: initiate call → client ───────────────────────────────────────────
router.post("/admin/video-call/initiate", requireAdmin, async (req, res): Promise<void> => {
  const { projectId } = req.body as { projectId: number };
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  try {
    const [project] = await db.select({ clientId: projectsTable.clientId, name: projectsTable.name })
      .from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
    if (!project?.clientId) { res.status(404).json({ error: "Proyecto no encontrado o sin cliente" }); return; }

    const callId = crypto.randomUUID();
    const token = Math.random().toString(36).slice(2, 8);
    const jitsiRoom = `ShopyCrafter-${projectId}-${token}`;
    const roomUrl = `https://meet.jit.si/${jitsiRoom}#config.startWithAudioMuted=false&config.disableDeepLinking=true&config.prejoinPageEnabled=false&userInfo.displayName=Equipo%20Shopy%20Crafter`;

    calls.set(callId, { id: callId, projectId, clientId: project.clientId, roomUrl, jitsiRoom, status: "ringing", initiatedBy: "admin", createdAt: Date.now() });

    await tryPush(CLIENT_SUB_PFX + project.clientId, {
      type: "incoming_call", callId,
      title: "📹 Shopy Crafter te llama",
      body: "Tu asesor quiere iniciar una videollamada. Toca para unirte.",
      url: "/client/messages",
    });

    logger.info({ callId, projectId, clientId: project.clientId }, "video-call: admin initiated");
    res.json({ callId, roomUrl, jitsiRoom });
  } catch (err: any) {
    logger.error({ err: err?.message }, "video-call: initiate failed");
    res.status(500).json({ error: err?.message || "Error iniciando llamada" });
  }
});

// ─── Admin: get pending client-initiated calls ────────────────────────────────
router.get("/admin/video-call/pending", requireAdmin, async (_req, res): Promise<void> => {
  const pending: VideoCall[] = [];
  for (const call of calls.values()) {
    if (call.initiatedBy === "client" && call.status === "ringing") {
      pending.push(call);
    }
  }
  res.json({ calls: pending });
});

// ─── Admin: accept client call request ───────────────────────────────────────
router.post("/admin/video-call/:callId/accept", requireAdmin, async (req, res): Promise<void> => {
  const call = calls.get(req.params.callId);
  if (!call) { res.status(404).json({ error: "Llamada no encontrada o expirada" }); return; }
  call.status = "active";
  await tryPush(CLIENT_SUB_PFX + call.clientId, {
    type: "call_accepted", callId: call.id,
    title: "✅ Llamada aceptada",
    body: "El equipo de Shopy Crafter aceptó tu llamada. Toca para unirte.",
    url: "/client/messages",
  });
  res.json({ ok: true, roomUrl: call.roomUrl });
});

// ─── Admin: end call ──────────────────────────────────────────────────────────
router.delete("/admin/video-call/:callId", requireAdmin, async (req, res): Promise<void> => {
  const call = calls.get(req.params.callId);
  if (call) {
    call.status = "ended";
    await tryPush(CLIENT_SUB_PFX + call.clientId, {
      type: "call_ended", callId: call.id,
      title: "📴 Llamada finalizada",
      body: "La videollamada ha terminado.",
    });
  }
  res.json({ ok: true });
});

// ─── Client: poll for incoming calls ─────────────────────────────────────────
router.get("/client/video-call/incoming", requireAuth, async (req, res): Promise<void> => {
  const clientId = (req.session as any).clientId;
  if (!clientId) { res.json({ call: null }); return; }
  for (const call of calls.values()) {
    if (call.clientId === clientId && (call.status === "ringing" || call.status === "active")) {
      res.json({ call: { id: call.id, roomUrl: call.roomUrl, status: call.status, initiatedBy: call.initiatedBy, createdAt: call.createdAt } });
      return;
    }
  }
  res.json({ call: null });
});

// ─── Client: accept incoming call ────────────────────────────────────────────
router.post("/client/video-call/:callId/accept", requireAuth, async (req, res): Promise<void> => {
  const call = calls.get(req.params.callId);
  if (!call) { res.status(404).json({ error: "Llamada no encontrada o expirada" }); return; }
  call.status = "active";
  res.json({ ok: true, roomUrl: call.roomUrl });
});

// ─── Client: reject incoming call ────────────────────────────────────────────
router.post("/client/video-call/:callId/reject", requireAuth, async (req, res): Promise<void> => {
  const call = calls.get(req.params.callId);
  if (!call) { res.status(404).json({ error: "Llamada no encontrada" }); return; }
  call.status = "rejected";
  res.json({ ok: true });
});

// ─── Client: request call → admin ────────────────────────────────────────────
router.post("/client/video-call/request", requireAuth, async (req, res): Promise<void> => {
  const session = req.session as any;
  const clientId = session.clientId;
  const projectId = session.projectId || 0;
  if (!clientId) { res.status(401).json({ error: "Not authenticated" }); return; }

  try {
    const callId = crypto.randomUUID();
    const token = Math.random().toString(36).slice(2, 8);
    const jitsiRoom = `ShopyCrafter-cli-${projectId}-${token}`;
    const roomUrl = `https://meet.jit.si/${jitsiRoom}#config.startWithAudioMuted=false&config.disableDeepLinking=true&config.prejoinPageEnabled=false&userInfo.displayName=Cliente`;

    calls.set(callId, { id: callId, projectId, clientId, roomUrl, jitsiRoom, status: "ringing", initiatedBy: "client", createdAt: Date.now() });

    await tryPush(ADMIN_PRIMARY_KEY, {
      type: "incoming_call", callId,
      title: "📹 Cliente quiere hablar contigo",
      body: "Un cliente solicita una videollamada. Toca para responder.",
      url: "/admin/messages",
    });

    logger.info({ callId, projectId, clientId }, "video-call: client requested");
    res.json({ callId, roomUrl });
  } catch (err: any) {
    logger.error({ err: err?.message }, "video-call: client request failed");
    res.status(500).json({ error: err?.message || "Error solicitando llamada" });
  }
});

// ─── Client: end call ─────────────────────────────────────────────────────────
router.delete("/client/video-call/:callId", requireAuth, async (req, res): Promise<void> => {
  const call = calls.get(req.params.callId);
  if (call) call.status = "ended";
  res.json({ ok: true });
});

export default router;
