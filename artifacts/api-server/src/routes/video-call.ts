import { Router } from "express";
import webpush from "web-push";
import { db, projectsTable, platformSettingsTable, usersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { requireAuth, requireAdmin } from "../lib/auth.js";
import crypto from "crypto";

const router = Router();

// ─── In-memory call store (ephemeral, TTL 10min) ──────────────────────────────
interface VideoCall {
  id: string;
  projectId: number;
  clientId: string;           // id del proyecto (= session.clientId del cliente)
  clientUserId: string | null; // users.id of the client user (primary match)
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

// ─── Push helper ─────────────────────────────────────────────────────────────
const SUB_KEY_PREFIX    = "push_sub::";
const CLIENT_SUB_PFX    = "push_sub_client::";
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

// Helper: check if a call matches this client session (dual strategy: userId first, clientId fallback)
function callMatchesClient(call: VideoCall, userId: string | null, clientId: string | null): boolean {
  if (userId && call.clientUserId && call.clientUserId === userId) return true;
  if (clientId && call.clientId && call.clientId === clientId) return true;
  return false;
}

// ─── Push subscription endpoint ───────────────────────────────────────────────
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

// ─── VAPID public key ─────────────────────────────────────────────────────────
router.get("/video-call/vapid-key", async (_req, res): Promise<void> => {
  const keys = await getVapidKeys();
  res.json({ publicKey: keys.publicKey || null });
});

// ─── Admin: initiate call → client ───────────────────────────────────────────
router.post("/admin/video-call/initiate", requireAdmin, async (req, res): Promise<void> => {
  const { projectId } = req.body as { projectId: number };
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  try {
    const [project] = await db.select({ id: projectsTable.id, name: projectsTable.name })
      .from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    // El cliente de un proyecto es el usuario cuyo users.client_id = id del
    // proyecto (projects.client_id es la credencial OAuth de la tienda, no sirve).
    const projectClientKey = String(project.id);
    let clientUserId: string | null = null;
    try {
      const [clientUser] = await db.select({ id: usersTable.id })
        .from(usersTable)
        .where(and(eq(usersTable.clientId, projectClientKey), eq(usersTable.role, "client")))
        .limit(1);
      clientUserId = clientUser?.id ?? null;
    } catch (err) {
      logger.warn({ err, projectId }, "video-call: client user lookup failed");
    }

    const callId = crypto.randomUUID();
    // Sala pública en meet.jit.si: el nombre debe ser impredecible.
    const token  = crypto.randomBytes(12).toString("hex");
    const jitsiRoom = `ShopyCrafter-${projectId}-${token}`;
    const roomUrl   = `https://meet.jit.si/${jitsiRoom}`;

    calls.set(callId, {
      id: callId, projectId,
      clientId: projectClientKey, clientUserId,
      roomUrl, jitsiRoom, status: "ringing",
      initiatedBy: "admin", createdAt: Date.now(),
    });

    // Best-effort push
    if (clientUserId) await tryPush(SUB_KEY_PREFIX + clientUserId, {
      type: "incoming_call", callId,
      title: "📹 Shopy Crafter te llama",
      body: "Tu asesor quiere iniciar una videollamada.",
      url: "/client/messages",
    });
    await tryPush(CLIENT_SUB_PFX + projectClientKey, {
      type: "incoming_call", callId,
      title: "📹 Shopy Crafter te llama",
      body: "Tu asesor quiere iniciar una videollamada.",
      url: "/client/messages",
    });

    logger.info({ callId, projectId, clientUserId }, "video-call: admin initiated");
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
  const call = calls.get(String(req.params.callId));
  if (!call) { res.status(404).json({ error: "Llamada no encontrada o expirada" }); return; }
  call.status = "active";
  // Notify client
  if (call.clientUserId) await tryPush(SUB_KEY_PREFIX + call.clientUserId, {
    type: "call_accepted", callId: call.id,
    title: "✅ Llamada aceptada — Únete ahora",
    url: "/client/messages",
  });
  if (call.clientId) await tryPush(CLIENT_SUB_PFX + call.clientId, {
    type: "call_accepted", callId: call.id,
    title: "✅ Llamada aceptada — Únete ahora",
    url: "/client/messages",
  });
  res.json({ ok: true, roomUrl: call.roomUrl });
});

// ─── Admin: end/reject call ───────────────────────────────────────────────────
router.delete("/admin/video-call/:callId", requireAdmin, async (req, res): Promise<void> => {
  const call = calls.get(String(req.params.callId));
  if (call) {
    call.status = "ended";
    if (call.clientUserId) await tryPush(SUB_KEY_PREFIX + call.clientUserId, { type: "call_ended", callId: call.id, title: "📴 Llamada finalizada" });
  }
  res.json({ ok: true });
});

// ─── Client: poll for incoming calls (matches by userId OR clientId) ──────────
router.get("/client/video-call/incoming", requireAuth, async (req, res): Promise<void> => {
  const session = req.session as any;
  const userId   = session.userId   as string | null ?? null;
  const clientId = session.clientId as string | null ?? null;

  for (const call of calls.values()) {
    if (call.status !== "ringing" && call.status !== "active") continue;
    if (callMatchesClient(call, userId, clientId)) {
      res.json({ call: { id: call.id, roomUrl: call.roomUrl, status: call.status, initiatedBy: call.initiatedBy, projectId: call.projectId, createdAt: call.createdAt } });
      return;
    }
  }
  res.json({ call: null });
});

// ─── Client: accept incoming call ────────────────────────────────────────────
router.post("/client/video-call/:callId/accept", requireAuth, async (req, res): Promise<void> => {
  const call = calls.get(String(req.params.callId));
  if (!call) { res.status(404).json({ error: "Llamada no encontrada o expirada" }); return; }
  call.status = "active";
  res.json({ ok: true, roomUrl: call.roomUrl });
});

// ─── Client: reject incoming call ────────────────────────────────────────────
router.post("/client/video-call/:callId/reject", requireAuth, async (req, res): Promise<void> => {
  const call = calls.get(String(req.params.callId));
  if (!call) { res.status(404).json({ error: "Llamada no encontrada" }); return; }
  call.status = "rejected";
  res.json({ ok: true });
});

// ─── Client: request call → admin ────────────────────────────────────────────
router.post("/client/video-call/request", requireAuth, async (req, res): Promise<void> => {
  const session  = req.session as any;
  const userId   = session.userId   as string ?? "";
  const clientId = session.clientId as string | null ?? null;
  // session.projectId no existe: el proyecto del cliente es session.clientId.
  const projectId = Number(clientId) || 0;

  const callId    = crypto.randomUUID();
  const token     = crypto.randomBytes(12).toString("hex");
  const jitsiRoom = `ShopyCrafter-cli-${projectId || userId.slice(0, 6)}-${token}`;
  const roomUrl   = `https://meet.jit.si/${jitsiRoom}`;

  calls.set(callId, {
    id: callId, projectId,
    clientId: clientId ?? userId, clientUserId: userId,
    roomUrl, jitsiRoom, status: "ringing",
    initiatedBy: "client", createdAt: Date.now(),
  });

  await tryPush(ADMIN_PRIMARY_KEY, {
    type: "incoming_call", callId,
    title: "📹 Cliente quiere hablar contigo",
    body: "Un cliente solicita una videollamada.",
    url: "/admin/messages",
  });

  logger.info({ callId, projectId, userId }, "video-call: client requested");
  res.json({ callId, roomUrl });
});

// ─── Client: end call ─────────────────────────────────────────────────────────
router.delete("/client/video-call/:callId", requireAuth, async (req, res): Promise<void> => {
  const session = req.session as any;
  const call = calls.get(String(req.params.callId));
  if (call && (session.role === "admin" || callMatchesClient(call, session.userId ?? null, session.clientId ?? null))) {
    call.status = "ended";
  }
  res.json({ ok: true });
});

export default router;
