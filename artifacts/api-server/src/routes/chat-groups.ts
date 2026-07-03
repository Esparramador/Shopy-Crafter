/**
 * chat-groups.ts — Group Chat API (admin + client)
 * ─────────────────────────────────────────────────
 * Admin endpoints (require admin):
 *   GET    /admin/chat-groups             → list groups + members
 *   POST   /admin/chat-groups             → create group
 *   DELETE /admin/chat-groups/:id         → delete group
 *   POST   /admin/chat-groups/:id/members → add member (projectId)
 *   DELETE /admin/chat-groups/:id/members/:projectId → remove member
 *   GET    /admin/chat-groups/:id/messages → fetch messages
 *   POST   /admin/chat-groups/:id/messages → send message as admin
 *
 * Client endpoints (require auth for the right project):
 *   GET    /client/chat-groups            → groups client belongs to
 *   GET    /client/chat-groups/:id/messages → fetch messages
 *   POST   /client/chat-groups/:id/messages → send message as client
 */
import { Router } from "express";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAdmin, requireAuth } from "../lib/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();

async function getDb() {
  const { db } = await import("@workspace/db");
  return db;
}

async function ensureTables(): Promise<void> {
  try {
    const db = await getDb();
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_groups (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_group_members (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
        project_id INTEGER NOT NULL,
        added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(group_id, project_id)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS group_messages (
        id TEXT PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
        project_id TEXT,
        from_role TEXT NOT NULL,
        from_name TEXT NOT NULL,
        content TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    logger.info("✅ chat_groups tables ready");
  } catch (err) {
    logger.warn({ err }, "chat_groups table setup warning (non-fatal)");
  }
}
ensureTables();

// ── ADMIN: List groups ─────────────────────────────────────────────────────
router.get("/admin/chat-groups", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const db = await getDb();
    const groups = await db.execute(sql`
      SELECT g.id, g.name, g.description, g.created_at,
        json_agg(
          json_build_object('projectId', m.project_id, 'addedAt', m.added_at)
        ) FILTER (WHERE m.id IS NOT NULL) AS members,
        (SELECT COUNT(*) FROM group_messages gm WHERE gm.group_id = g.id AND gm.is_read = 0 AND gm.from_role = 'client') AS unread_count
      FROM chat_groups g
      LEFT JOIN chat_group_members m ON m.group_id = g.id
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `);
    res.json({ groups: groups.rows });
  } catch (err: any) {
    logger.error({ err }, "chat-groups: list error");
    res.status(500).json({ error: err?.message ?? "Error interno" });
  }
});

// ── ADMIN: Create group ────────────────────────────────────────────────────
router.post("/admin/chat-groups", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { name, description, projectIds = [] } = req.body as { name: string; description?: string; projectIds?: number[] };
    if (!name?.trim()) { res.status(400).json({ error: "name requerido" }); return; }
    const db = await getDb();
    const [group] = (await db.execute(sql`
      INSERT INTO chat_groups (name, description) VALUES (${name.trim()}, ${description ?? null})
      RETURNING *
    `)).rows as any[];

    for (const pid of projectIds) {
      await db.execute(sql`
        INSERT INTO chat_group_members (group_id, project_id) VALUES (${group.id}, ${pid})
        ON CONFLICT DO NOTHING
      `);
    }
    res.status(201).json({ group });
  } catch (err: any) {
    logger.error({ err }, "chat-groups: create error");
    res.status(500).json({ error: err?.message ?? "Error interno" });
  }
});

// ── ADMIN: Delete group ────────────────────────────────────────────────────
router.delete("/admin/chat-groups/:id", requireAdmin, async (req, res): Promise<void> => {
  try {
    const db = await getDb();
    const gid = Number(req.params.id);
    await db.execute(sql`DELETE FROM chat_groups WHERE id = ${gid}`);
    res.json({ ok: true });
  } catch (err: any) {
    logger.error({ err }, "chat-groups: delete error");
    res.status(500).json({ error: err?.message ?? "Error interno" });
  }
});

// ── ADMIN: Add member ──────────────────────────────────────────────────────
router.post("/admin/chat-groups/:id/members", requireAdmin, async (req, res): Promise<void> => {
  try {
    const db = await getDb();
    const { projectId } = req.body as { projectId: number };
    const gid = Number(req.params.id);
    await db.execute(sql`
      INSERT INTO chat_group_members (group_id, project_id) VALUES (${gid}, ${projectId})
      ON CONFLICT DO NOTHING
    `);
    res.json({ ok: true });
  } catch (err: any) {
    logger.error({ err }, "chat-groups: add member error");
    res.status(500).json({ error: err?.message ?? "Error interno" });
  }
});

// ── ADMIN: Remove member ───────────────────────────────────────────────────
router.delete("/admin/chat-groups/:id/members/:projectId", requireAdmin, async (req, res): Promise<void> => {
  try {
    const db = await getDb();
    const gid = Number(req.params.id);
    const pid = Number(req.params.projectId);
    await db.execute(sql`DELETE FROM chat_group_members WHERE group_id = ${gid} AND project_id = ${pid}`);
    res.json({ ok: true });
  } catch (err: any) {
    logger.error({ err }, "chat-groups: remove member error");
    res.status(500).json({ error: err?.message ?? "Error interno" });
  }
});

// ── ADMIN: Get group messages ──────────────────────────────────────────────
router.get("/admin/chat-groups/:id/messages", requireAdmin, async (req, res): Promise<void> => {
  try {
    const db = await getDb();
    const gid = Number(req.params.id);
    const msgs = await db.execute(sql`
      SELECT * FROM group_messages WHERE group_id = ${gid}
      ORDER BY created_at ASC LIMIT 200
    `);
    await db.execute(sql`
      UPDATE group_messages SET is_read = 1
      WHERE group_id = ${gid} AND from_role = 'client'
    `);
    res.json(msgs.rows);
  } catch (err: any) {
    logger.error({ err }, "chat-groups: get messages error");
    res.status(500).json({ error: err?.message ?? "Error interno" });
  }
});

// ── ADMIN: Send message ────────────────────────────────────────────────────
router.post("/admin/chat-groups/:id/messages", requireAdmin, async (req, res): Promise<void> => {
  try {
    const db = await getDb();
    const gid = Number(req.params.id);
    const { content } = req.body as { content: string };
    if (!content?.trim()) { res.status(400).json({ error: "content requerido" }); return; }
    const [msg] = (await db.execute(sql`
      INSERT INTO group_messages (id, group_id, from_role, from_name, content, is_read)
      VALUES (${randomUUID()}, ${gid}, 'admin', 'Admin', ${content.trim()}, 1)
      RETURNING *
    `)).rows as any[];
    res.status(201).json(msg);
  } catch (err: any) {
    logger.error({ err }, "chat-groups: admin send error");
    res.status(500).json({ error: err?.message ?? "Error interno" });
  }
});

// ── CLIENT: List groups client belongs to ─────────────────────────────────
router.get("/client/chat-groups", requireAuth, async (req, res): Promise<void> => {
  try {
    const db = await getDb();
    const projectId = (req.session as any).projectId;
    if (!projectId) { res.json({ groups: [] }); return; }
    const groups = await db.execute(sql`
      SELECT g.id, g.name, g.description, g.created_at,
        (SELECT COUNT(*) FROM group_messages gm WHERE gm.group_id = g.id AND gm.is_read = 0 AND gm.from_role = 'admin') AS unread_count
      FROM chat_groups g
      INNER JOIN chat_group_members m ON m.group_id = g.id AND m.project_id = ${Number(projectId)}
      ORDER BY g.created_at DESC
    `);
    res.json({ groups: groups.rows });
  } catch (err: any) {
    logger.error({ err }, "chat-groups: client list error");
    res.status(500).json({ error: err?.message ?? "Error interno" });
  }
});

// ── CLIENT: Get group messages ─────────────────────────────────────────────
router.get("/client/chat-groups/:id/messages", requireAuth, async (req, res): Promise<void> => {
  try {
    const db = await getDb();
    const gid = Number(req.params.id);
    const projectId = (req.session as any).projectId;
    const member = await db.execute(sql`
      SELECT id FROM chat_group_members WHERE group_id = ${gid} AND project_id = ${Number(projectId)}
    `);
    if (!member.rows.length) { res.status(403).json({ error: "No autorizado" }); return; }

    const msgs = await db.execute(sql`
      SELECT * FROM group_messages WHERE group_id = ${gid}
      ORDER BY created_at ASC LIMIT 200
    `);
    await db.execute(sql`
      UPDATE group_messages SET is_read = 1
      WHERE group_id = ${gid} AND from_role = 'admin'
    `);
    res.json(msgs.rows);
  } catch (err: any) {
    logger.error({ err }, "chat-groups: client get messages error");
    res.status(500).json({ error: err?.message ?? "Error interno" });
  }
});

// ── CLIENT: Send message ───────────────────────────────────────────────────
router.post("/client/chat-groups/:id/messages", requireAuth, async (req, res): Promise<void> => {
  try {
    const db = await getDb();
    const gid = Number(req.params.id);
    const projectId = (req.session as any).projectId;
    const projectName = (req.session as any).projectName ?? "Cliente";
    const member = await db.execute(sql`
      SELECT id FROM chat_group_members WHERE group_id = ${gid} AND project_id = ${Number(projectId)}
    `);
    if (!member.rows.length) { res.status(403).json({ error: "No autorizado" }); return; }

    const { content } = req.body as { content: string };
    if (!content?.trim()) { res.status(400).json({ error: "content requerido" }); return; }
    const [msg] = (await db.execute(sql`
      INSERT INTO group_messages (id, group_id, project_id, from_role, from_name, content)
      VALUES (${randomUUID()}, ${gid}, ${String(projectId)}, 'client', ${projectName}, ${content.trim()})
      RETURNING *
    `)).rows as any[];
    res.status(201).json(msg);
  } catch (err: any) {
    logger.error({ err }, "chat-groups: client send error");
    res.status(500).json({ error: err?.message ?? "Error interno" });
  }
});

export default router;
