import { db, platformSettingsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import webpush from "web-push";
import { logger } from "./logger.js";

const SUB_KEY_PREFIX = "push_sub::";

async function loadSubscription(userId: string): Promise<webpush.PushSubscription | null> {
  try {
    const [row] = await db.select().from(platformSettingsTable)
      .where(eq(platformSettingsTable.key, SUB_KEY_PREFIX + userId)).limit(1);
    if (!row?.value) return null;
    return JSON.parse(row.value) as webpush.PushSubscription;
  } catch { return null; }
}

async function getVapidKeys() {
  const subject = process.env.VAPID_SUBJECT || "mailto:craftershopy@gmail.com";
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY, subject };
  }
  try {
    const [pubRow] = await db.select().from(platformSettingsTable)
      .where(eq(platformSettingsTable.key, "vapid_public_key")).limit(1);
    const [privRow] = await db.select().from(platformSettingsTable)
      .where(eq(platformSettingsTable.key, "vapid_private_key")).limit(1);
    if (pubRow?.value && privRow?.value) {
      return { publicKey: pubRow.value, privateKey: privRow.value, subject };
    }
  } catch {}
  return { publicKey: null, privateKey: null, subject };
}

let initialized = false;
async function ensureInit(): Promise<boolean> {
  const k = await getVapidKeys();
  if (!k.publicKey || !k.privateKey) return false;
  if (initialized) return true;
  try {
    webpush.setVapidDetails(k.subject, k.publicKey, k.privateKey);
    initialized = true;
    return true;
  } catch { return false; }
}

export async function sendPushToUser(userId: string, title: string, body: string, url = "/"): Promise<void> {
  try {
    const ok = await ensureInit();
    if (!ok) return;
    const sub = await loadSubscription(userId);
    if (!sub) return;
    const payload = JSON.stringify({ title, body, url });
    await webpush.sendNotification(sub, payload);
    logger.info({ userId, title }, "push-helper: notification sent");
  } catch (err: any) {
    if (err?.statusCode !== 410) logger.warn({ err, userId }, "push-helper: send failed");
  }
}

export async function sendPushToAdmins(title: string, body: string, url = "/"): Promise<void> {
  try {
    const admins = await db.select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.role, "admin"));
    await Promise.all(admins.map(a => sendPushToUser(a.id, title, body, url)));
  } catch (err) {
    logger.warn({ err }, "push-helper: sendPushToAdmins failed");
  }
}

export async function sendPushToClientByProject(projectId: string, title: string, body: string, url = "/"): Promise<void> {
  try {
    const clients = await db.select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.clientId, projectId));
    await Promise.all(clients.map(c => sendPushToUser(c.id, title, body, url)));
  } catch (err) {
    logger.warn({ err }, "push-helper: sendPushToClientByProject failed");
  }
}
