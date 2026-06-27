/**
 * Google Calendar Integration — Shopy Crafter
 * ─────────────────────────────────────────────────────────────────────────────
 * GET  /api/calendar/oauth/url            — Google OAuth URL (calendar scope)
 * GET  /api/calendar/oauth/callback       — exchange code + store tokens
 * GET  /api/calendar/status               — connection status
 * DELETE /api/calendar/oauth/disconnect   — remove tokens
 * GET  /api/calendar/events               — list appointments (local DB)
 * POST /api/calendar/events               — create appointment (+Google Cal)
 * PUT  /api/calendar/events/:id           — update appointment
 * DELETE /api/calendar/events/:id         — cancel appointment
 * POST /api/calendar/events/:id/complete  — post-meeting: services + quote
 * GET  /api/calendar/slots                — available slots for a date
 * POST /api/calendar/sync                 — sync from Google Calendar
 */

import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { google } from "googleapis";

const router = Router();
router.use(requireAdmin);

// ─── OAuth config (reuses Google OAuth client from YouTube integration) ───────
const CLIENT_ID     = process.env.YOUTUBE_CLIENT_ID     || "";
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET || "";

const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

function getRedirectUri(): string {
  if (process.env.REPLIT_DEV_DOMAIN)
    return `https://${process.env.REPLIT_DEV_DOMAIN}/api/calendar/oauth/callback`;
  return `${process.env.APP_URL || "https://shopycrafter.com"}/api/calendar/oauth/callback`;
}

function makeOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, getRedirectUri());
}

// ─── Ensure DB tables ──────────────────────────────────────────────────────────
async function ensureTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS calendar_tokens (
      user_id       VARCHAR(255) PRIMARY KEY,
      access_token  TEXT NOT NULL,
      refresh_token TEXT,
      expires_at    TIMESTAMPTZ,
      email         TEXT,
      calendar_id   TEXT DEFAULT 'primary',
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS calendar_appointments (
      id                   SERIAL PRIMARY KEY,
      google_event_id      TEXT UNIQUE,
      client_name          TEXT NOT NULL,
      company              TEXT,
      email                TEXT,
      phone                TEXT,
      meeting_date         TIMESTAMPTZ NOT NULL,
      duration_minutes     INTEGER DEFAULT 60,
      description          TEXT,
      status               TEXT DEFAULT 'pending',
      color                TEXT DEFAULT '#f59e0b',
      arrival_time         TIMESTAMPTZ,
      services_requested   JSONB DEFAULT '[]',
      services_rendered    JSONB DEFAULT '[]',
      actual_duration_min  INTEGER,
      quote_amount         DECIMAL(10,2),
      quote_breakdown      JSONB DEFAULT '[]',
      notes                TEXT,
      created_by           TEXT DEFAULT 'admin',
      created_at           TIMESTAMPTZ DEFAULT NOW(),
      updated_at           TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_appointments_date ON calendar_appointments(meeting_date)
  `);
}

ensureTables().catch(err => logger.error({ err }, "calendar ensureTables failed"));

// ─── Token helpers ─────────────────────────────────────────────────────────────
async function getValidToken(userId: string): Promise<string | null> {
  const rows = await db.execute<{
    access_token: string; refresh_token: string | null; expires_at: Date | null;
  }>(sql`SELECT access_token, refresh_token, expires_at FROM calendar_tokens WHERE user_id = ${userId}`);
  if (!rows.rows.length) return null;
  const row = rows.rows[0];
  if (row.expires_at && new Date(row.expires_at) > new Date(Date.now() + 60_000)) {
    return row.access_token;
  }
  if (!row.refresh_token) return null;
  try {
    const oauth2Client = makeOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: row.refresh_token });
    const { credentials } = await oauth2Client.refreshAccessToken();
    const expiresAt = credentials.expiry_date ? new Date(credentials.expiry_date) : new Date(Date.now() + 3600_000);
    await db.execute(sql`
      UPDATE calendar_tokens SET access_token = ${credentials.access_token!},
        expires_at = ${expiresAt}, updated_at = NOW()
      WHERE user_id = ${userId}
    `);
    return credentials.access_token!;
  } catch (err) {
    logger.error({ err }, "calendar token refresh failed");
    return null;
  }
}

async function getCalendarClient() {
  const token = await getValidToken("admin");
  if (!token) throw new Error("Google Calendar no conectado. Ve a Calendario → Conectar con Google.");
  const oauth2Client = makeOAuth2Client();
  oauth2Client.setCredentials({ access_token: token });
  return google.calendar({ version: "v3", auth: oauth2Client });
}

// ─── Helper: sync local appointment to Google Calendar ──────────────────────
async function upsertGoogleEvent(appt: any, googleEventId?: string | null): Promise<string | null> {
  try {
    const cal = await getCalendarClient();
    const start = new Date(appt.meeting_date);
    const end = new Date(start.getTime() + (appt.duration_minutes || 60) * 60_000);
    const event: any = {
      summary: `📅 ${appt.client_name}${appt.company ? ` — ${appt.company}` : ""}`,
      description: [
        appt.description,
        appt.phone ? `📱 ${appt.phone}` : "",
        appt.email ? `✉️ ${appt.email}` : "",
        `\nGenerado por Shopy Crafter CRM`,
      ].filter(Boolean).join("\n"),
      start: { dateTime: start.toISOString(), timeZone: "Europe/Madrid" },
      end:   { dateTime: end.toISOString(),   timeZone: "Europe/Madrid" },
      colorId: appt.status === "confirmed" ? "2" : appt.status === "completed" ? "9" : "5",
    };
    if (googleEventId) {
      const res = await cal.events.update({ calendarId: "primary", eventId: googleEventId, requestBody: event });
      return res.data.id || googleEventId;
    } else {
      const res = await cal.events.insert({ calendarId: "primary", requestBody: event });
      return res.data.id || null;
    }
  } catch (err: any) {
    logger.warn({ err: err?.message }, "Google Calendar event upsert failed (non-fatal)");
    return null;
  }
}

// ─── STATUS ─────────────────────────────────────────────────────────────────
router.get("/calendar/status", async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await db.execute<{ email: string | null; updated_at: Date }>(
      sql`SELECT email, updated_at FROM calendar_tokens WHERE user_id = 'admin'`
    );
    if (!rows.rows.length) { res.json({ connected: false }); return; }
    const token = await getValidToken("admin");
    res.json({ connected: !!token, email: rows.rows[0].email, lastSync: rows.rows[0].updated_at });
  } catch { res.json({ connected: false }); }
});

// ─── OAUTH URL ───────────────────────────────────────────────────────────────
router.get("/calendar/oauth/url", (_req: Request, res: Response): void => {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    res.status(500).json({ error: "YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET no configurados." });
    return;
  }
  const redirectUri = getRedirectUri();
  const oauth2Client = makeOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: CALENDAR_SCOPES,
    prompt: "consent",
    state: "shopycrafter_calendar",
    login_hint: "craftershopy@gmail.com",
  });
  res.json({ url, redirectUri });
});

// ─── OAUTH CALLBACK ──────────────────────────────────────────────────────────
router.get("/calendar/oauth/callback", async (req: Request, res: Response): Promise<void> => {
  const code = req.query["code"] as string;
  if (!code) { res.status(400).send("Código OAuth faltante"); return; }
  try {
    const oauth2Client = makeOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600_000);

    // Get user email
    oauth2Client.setCredentials(tokens);
    let email: string | null = null;
    try {
      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
      const me = await oauth2.userinfo.get();
      email = me.data.email || null;
    } catch {}

    await db.execute(sql`
      INSERT INTO calendar_tokens (user_id, access_token, refresh_token, expires_at, email, updated_at)
      VALUES ('admin', ${tokens.access_token!}, ${tokens.refresh_token || null}, ${expiresAt}, ${email}, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        access_token  = EXCLUDED.access_token,
        refresh_token = COALESCE(EXCLUDED.refresh_token, calendar_tokens.refresh_token),
        expires_at    = EXCLUDED.expires_at,
        email         = COALESCE(EXCLUDED.email, calendar_tokens.email),
        updated_at    = NOW()
    `);

    logger.info({ email }, "Google Calendar connected");
    res.send(`<html><body style="font-family:sans-serif;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
      <div style="text-align:center">
        <div style="font-size:48px">📅</div>
        <h2 style="color:#f59e0b">¡Google Calendar conectado!</h2>
        <p style="color:#888">${email || "craftershopy@gmail.com"}</p>
        <p style="color:#666;font-size:13px">Puedes cerrar esta pestaña</p>
        <script>window.opener?.postMessage({type:"CALENDAR_CONNECTED",email:"${email}"},"*");setTimeout(()=>window.close(),2000)</script>
      </div></body></html>`);
  } catch (err: any) {
    logger.error({ err }, "calendar oauth callback error");
    res.status(500).send(`Error conectando Google Calendar: ${err.message}`);
  }
});

// ─── DISCONNECT ──────────────────────────────────────────────────────────────
router.delete("/calendar/oauth/disconnect", async (_req: Request, res: Response): Promise<void> => {
  await db.execute(sql`DELETE FROM calendar_tokens WHERE user_id = 'admin'`).catch(() => {});
  res.json({ ok: true });
});

// ─── LIST EVENTS ─────────────────────────────────────────────────────────────
router.get("/calendar/events", async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to, status } = req.query as Record<string, string>;
    let whereClause = sql`WHERE 1=1`;
    if (from) whereClause = sql`WHERE meeting_date >= ${new Date(from)}`;
    if (to)   whereClause = sql`${whereClause} AND meeting_date <= ${new Date(to)}`;
    if (status) whereClause = sql`${whereClause} AND status = ${status}`;

    const rows = await db.execute(sql`
      SELECT * FROM calendar_appointments
      ${whereClause}
      ORDER BY meeting_date ASC
      LIMIT 500
    `);
    res.json({ appointments: rows.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CREATE APPOINTMENT ───────────────────────────────────────────────────────
router.post("/calendar/events", async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      client_name, company, email, phone,
      meeting_date, duration_minutes = 60,
      description, services_requested = [],
    } = req.body as any;

    if (!client_name || !meeting_date) {
      res.status(400).json({ error: "client_name y meeting_date son obligatorios" });
      return;
    }

    // Insert to local DB first
    const inserted = await db.execute<{ id: number }>(sql`
      INSERT INTO calendar_appointments
        (client_name, company, email, phone, meeting_date, duration_minutes, description, services_requested, status)
      VALUES
        (${client_name}, ${company || null}, ${email || null}, ${phone || null},
         ${new Date(meeting_date)}, ${duration_minutes}, ${description || null},
         ${JSON.stringify(services_requested)}, 'confirmed')
      RETURNING id
    `);
    const id = inserted.rows[0]?.id;

    // Sync to Google Calendar (non-blocking)
    const appt = { client_name, company, email, phone, meeting_date, duration_minutes, description };
    const googleEventId = await upsertGoogleEvent(appt);
    if (googleEventId && id) {
      await db.execute(sql`
        UPDATE calendar_appointments SET google_event_id = ${googleEventId} WHERE id = ${id}
      `).catch(() => {});
    }

    const rows = await db.execute(sql`SELECT * FROM calendar_appointments WHERE id = ${id}`);
    res.json({ appointment: rows.rows[0], syncedToGoogle: !!googleEventId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── UPDATE APPOINTMENT ───────────────────────────────────────────────────────
router.put("/calendar/events/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params["id"]!);
    const {
      client_name, company, email, phone,
      meeting_date, duration_minutes, description,
      status, services_requested, notes,
    } = req.body as any;

    await db.execute(sql`
      UPDATE calendar_appointments SET
        client_name       = COALESCE(${client_name ?? null}, client_name),
        company           = COALESCE(${company ?? null}, company),
        email             = COALESCE(${email ?? null}, email),
        phone             = COALESCE(${phone ?? null}, phone),
        meeting_date      = COALESCE(${meeting_date ? new Date(meeting_date) : null}, meeting_date),
        duration_minutes  = COALESCE(${duration_minutes ?? null}, duration_minutes),
        description       = COALESCE(${description ?? null}, description),
        status            = COALESCE(${status ?? null}, status),
        services_requested= COALESCE(${services_requested ? JSON.stringify(services_requested) : null}::jsonb, services_requested),
        notes             = COALESCE(${notes ?? null}, notes),
        updated_at        = NOW()
      WHERE id = ${id}
    `);

    // Sync update to Google Calendar
    const rows = await db.execute(sql`SELECT * FROM calendar_appointments WHERE id = ${id}`);
    const appt = rows.rows[0] as any;
    if (appt?.google_event_id) {
      upsertGoogleEvent(appt, appt.google_event_id).catch(() => {});
    }

    res.json({ appointment: appt });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE APPOINTMENT ───────────────────────────────────────────────────────
router.delete("/calendar/events/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params["id"]!);
    const rows = await db.execute(sql`SELECT google_event_id FROM calendar_appointments WHERE id = ${id}`);
    const googleEventId = (rows.rows[0] as any)?.google_event_id;

    await db.execute(sql`DELETE FROM calendar_appointments WHERE id = ${id}`);

    // Remove from Google Calendar
    if (googleEventId) {
      try {
        const cal = await getCalendarClient();
        await cal.events.delete({ calendarId: "primary", eventId: googleEventId });
      } catch {}
    }

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── COMPLETE MEETING (post-reunión) ─────────────────────────────────────────
router.post("/calendar/events/:id/complete", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params["id"]!);
    const {
      arrival_time,
      services_rendered = [],
      actual_duration_min,
      notes,
    } = req.body as any;

    // Build quote from services
    const quoteBreakdown = (services_rendered as any[]).map(s => ({
      name: s.name || s,
      price: s.price || 0,
      hours: s.hours || 0,
      subtotal: (s.price || 0) * (s.hours || 1),
    }));
    const quoteAmount = quoteBreakdown.reduce((acc, s) => acc + s.subtotal, 0);

    await db.execute(sql`
      UPDATE calendar_appointments SET
        arrival_time        = ${arrival_time ? new Date(arrival_time) : null},
        services_rendered   = ${JSON.stringify(services_rendered)}::jsonb,
        actual_duration_min = ${actual_duration_min ?? null},
        quote_amount        = ${quoteAmount || null},
        quote_breakdown     = ${JSON.stringify(quoteBreakdown)}::jsonb,
        notes               = COALESCE(${notes ?? null}, notes),
        status              = 'completed',
        updated_at          = NOW()
      WHERE id = ${id}
    `);

    const rows = await db.execute(sql`SELECT * FROM calendar_appointments WHERE id = ${id}`);
    const appt = rows.rows[0] as any;

    // Update Google Calendar event to show completed + quote
    if (appt?.google_event_id) {
      upsertGoogleEvent({ ...appt, status: "completed" }, appt.google_event_id).catch(() => {});
    }

    res.json({ appointment: appt, quoteAmount, quoteBreakdown });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AVAILABLE SLOTS ──────────────────────────────────────────────────────────
router.get("/calendar/slots", async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, duration = "60" } = req.query as Record<string, string>;
    if (!date) { res.status(400).json({ error: "date requerido (YYYY-MM-DD)" }); return; }

    const dayStart = new Date(`${date}T08:00:00`);
    const dayEnd   = new Date(`${date}T20:00:00`);
    const dur = parseInt(duration) || 60;

    // Get existing appointments for that day
    const rows = await db.execute<{ meeting_date: Date; duration_minutes: number }>(sql`
      SELECT meeting_date, duration_minutes FROM calendar_appointments
      WHERE meeting_date >= ${dayStart} AND meeting_date < ${dayEnd}
        AND status NOT IN ('cancelled')
      ORDER BY meeting_date ASC
    `);

    const busySlots = rows.rows.map(r => ({
      start: new Date(r.meeting_date).getTime(),
      end:   new Date(r.meeting_date).getTime() + (r.duration_minutes || 60) * 60_000,
    }));

    // Also check Google Calendar free/busy
    try {
      const cal = await getCalendarClient();
      const fb = await cal.freebusy.query({
        requestBody: {
          timeMin: dayStart.toISOString(),
          timeMax: dayEnd.toISOString(),
          items: [{ id: "primary" }],
        },
      });
      const gcalBusy = fb.data.calendars?.["primary"]?.busy || [];
      gcalBusy.forEach(b => {
        if (b.start && b.end) busySlots.push({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() });
      });
    } catch {}

    // Generate free slots every 30 min
    const slots: Array<{ time: string; available: boolean; label: string }> = [];
    let cursor = dayStart.getTime();
    while (cursor + dur * 60_000 <= dayEnd.getTime()) {
      const slotEnd = cursor + dur * 60_000;
      const isBusy = busySlots.some(b => cursor < b.end && slotEnd > b.start);
      const dt = new Date(cursor);
      slots.push({
        time: dt.toISOString(),
        label: dt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
        available: !isBusy,
      });
      cursor += 30 * 60_000;
    }

    res.json({ date, slots, totalAvailable: slots.filter(s => s.available).length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SYNC FROM GOOGLE ─────────────────────────────────────────────────────────
router.post("/calendar/sync", async (_req: Request, res: Response): Promise<void> => {
  try {
    const cal = await getCalendarClient();
    const now = new Date();
    const future = new Date(now.getTime() + 90 * 24 * 3600_000);

    const events = await cal.events.list({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
      maxResults: 100,
      singleEvents: true,
      orderBy: "startTime",
      q: "Shopy Crafter",
    });

    const items = events.data.items || [];
    let synced = 0;
    for (const ev of items) {
      if (!ev.id || !ev.start?.dateTime) continue;
      const existing = await db.execute(
        sql`SELECT id FROM calendar_appointments WHERE google_event_id = ${ev.id}`
      );
      if (!existing.rows.length) {
        const nameParts = (ev.summary || "").replace("📅", "").split("—");
        await db.execute(sql`
          INSERT INTO calendar_appointments
            (google_event_id, client_name, company, meeting_date, duration_minutes, description, status)
          VALUES (
            ${ev.id}, ${nameParts[0]?.trim() || ev.summary || "Cita"},
            ${nameParts[1]?.trim() || null},
            ${new Date(ev.start.dateTime)},
            ${Math.round(((new Date(ev.end?.dateTime || ev.start.dateTime)).getTime() - new Date(ev.start.dateTime).getTime()) / 60_000)},
            ${ev.description || null}, 'confirmed'
          ) ON CONFLICT (google_event_id) DO NOTHING
        `).catch(() => {});
        synced++;
      }
    }
    res.json({ synced, total: items.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── STATS ────────────────────────────────────────────────────────────────────
router.get("/calendar/stats", async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await db.execute<any>(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'confirmed' AND meeting_date >= NOW()) AS upcoming,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COALESCE(SUM(quote_amount) FILTER (WHERE status = 'completed'), 0) AS total_revenue,
        COALESCE(AVG(actual_duration_min) FILTER (WHERE status = 'completed'), 0) AS avg_duration
      FROM calendar_appointments
    `);
    res.json(stats.rows[0] || {});
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
