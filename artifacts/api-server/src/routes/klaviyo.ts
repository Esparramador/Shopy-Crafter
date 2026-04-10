import { Router } from "express";
import { requireAdmin } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { getKlaviyoHeaders } from "../lib/klaviyo-headers.js";

const router = Router();

const KLAVIYO_BASE = "https://a.klaviyo.com/api";
const REVISION = "2024-02-15";

function klaviyoHeaders() {
  return getKlaviyoHeaders(REVISION);
}

async function klaviyoGet<T>(path: string): Promise<T> {
  const res = await fetch(`${KLAVIYO_BASE}${path}`, { headers: klaviyoHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Klaviyo ${path} → ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

async function klaviyoPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${KLAVIYO_BASE}${path}`, {
    method: "POST",
    headers: klaviyoHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Klaviyo POST ${path} → ${res.status}: ${err}`);
  }
  return res.json() as Promise<T>;
}

// ─── GET LISTS ────────────────────────────────────────────────────────────────
router.get("/klaviyo/lists", requireAdmin, async (req, res): Promise<void> => {
  try {
    const data = await klaviyoGet("/lists/?fields[list]=name,created,updated,opt_in_process");
    res.json(data);
  } catch (err) {
    logger.error({ err }, "Klaviyo lists fetch failed");
    res.status(500).json({ error: "Error al obtener listas de Klaviyo" });
  }
});

// ─── GET CAMPAIGNS ────────────────────────────────────────────────────────────
router.get("/klaviyo/campaigns", requireAdmin, async (req, res): Promise<void> => {
  try {
    const data = await klaviyoGet("/campaigns/?filter=equals(messages.channel,'email')&fields[campaign]=name,status,created_at,updated_at,send_time");
    res.json(data);
  } catch (err) {
    logger.error({ err }, "Klaviyo campaigns fetch failed");
    res.status(500).json({ error: "Error al obtener campañas de Klaviyo" });
  }
});

// ─── GET METRICS (overview stats) ────────────────────────────────────────────
router.get("/klaviyo/metrics", requireAdmin, async (req, res): Promise<void> => {
  try {
    const data = await klaviyoGet("/metrics/?fields[metric]=name,created,updated,integration");
    res.json(data);
  } catch (err) {
    logger.error({ err }, "Klaviyo metrics fetch failed");
    res.status(500).json({ error: "Error al obtener métricas de Klaviyo" });
  }
});

// ─── GET PROFILES (subscriber count) ─────────────────────────────────────────
router.get("/klaviyo/profiles/count", requireAdmin, async (req, res): Promise<void> => {
  try {
    const data = await klaviyoGet<{ data: unknown[]; links?: { next?: string } }>("/profiles/?page[size]=1&fields[profile]=id");
    res.json({ count: (data as { data: unknown[] }).data?.length ?? 0 });
  } catch (err) {
    logger.error({ err }, "Klaviyo profiles count failed");
    res.status(500).json({ error: "Error al obtener conteo de perfiles" });
  }
});

// ─── GET FLOWS ────────────────────────────────────────────────────────────────
router.get("/klaviyo/flows", requireAdmin, async (req, res): Promise<void> => {
  try {
    const data = await klaviyoGet("/flows/?fields[flow]=name,status,created,updated,trigger_type");
    res.json(data);
  } catch (err) {
    logger.error({ err }, "Klaviyo flows fetch failed");
    res.status(500).json({ error: "Error al obtener flows de Klaviyo" });
  }
});

// ─── CREATE EVENT (track event for a profile) ─────────────────────────────────
router.post("/klaviyo/events", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { email, eventName, properties } = req.body as { email: string; eventName: string; properties?: Record<string, unknown> };
    if (!email || !eventName) {
      res.status(400).json({ error: "email y eventName son requeridos" });
      return;
    }
    try {
      await klaviyoPost("/events/", {
        data: {
          type: "event",
          attributes: {
            properties: properties ?? {},
            metric: { data: { type: "metric", attributes: { name: eventName } } },
            profile: { data: { type: "profile", attributes: { email } } },
          },
        },
      });
      res.json({ success: true });
    } catch (err) {
      logger.error({ err }, "Klaviyo event create failed");
      res.status(500).json({ error: "Error al crear evento en Klaviyo" });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ─── SUBSCRIBE TO LIST ─────────────────────────────────────────────────────────
router.post("/klaviyo/subscribe", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { email, firstName, lastName, listId } = req.body as { email: string; firstName?: string; lastName?: string; listId: string };
    if (!email || !listId) {
      res.status(400).json({ error: "email y listId son requeridos" });
      return;
    }
    try {
      await klaviyoPost(`/lists/${listId}/relationships/profiles/`, {
        data: [{
          type: "profile",
          attributes: {
            email,
            first_name: firstName ?? "",
            last_name: lastName ?? "",
          },
        }],
      });
      res.json({ success: true });
    } catch (err) {
      logger.error({ err }, "Klaviyo subscribe failed");
      res.status(500).json({ error: "Error al suscribir perfil" });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ─── SEND TRANSACTIONAL EMAIL VIA EVENT ──────────────────────────────────────
router.post("/klaviyo/send-email", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { email, subject, metricName, properties, name } = req.body as {
      email: string;
      subject: string;
      metricName: string;
      properties?: Record<string, unknown>;
      name?: string;
    };
  
    if (!email || !metricName) {
      res.status(400).json({ error: "email y metricName son requeridos" });
      return;
    }
  
    try {
      await klaviyoPost("/events/", {
        data: {
          type: "event",
          attributes: {
            properties: { subject, ...properties },
            metric: { data: { type: "metric", attributes: { name: metricName } } },
            profile: { data: { type: "profile", attributes: { email, first_name: name ?? "" } } },
          },
        },
      });
      res.json({ success: true, message: `Email event '${metricName}' enviado a ${email}` });
    } catch (err) {
      logger.error({ err }, "Klaviyo send-email failed");
      res.status(500).json({ error: "Error al enviar email via Klaviyo" });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ─── TEST CONNECTION ──────────────────────────────────────────────────────────
router.get("/klaviyo/test", requireAdmin, async (req, res): Promise<void> => {
  try {
    const data = await klaviyoGet<{ data: Array<{ id: string; attributes: { name: string } }>; meta?: { total: number } }>("/lists/");
    res.json({
      connected: true,
      listCount: data.data?.length ?? 0,
      firstList: data.data?.[0]?.attributes?.name ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Klaviyo connection test failed");
    res.status(500).json({ connected: false, error: String(err) });
  }
});

// ─── SEND CLIENT WELCOME EMAIL ────────────────────────────────────────────────
router.post("/klaviyo/welcome-client", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { email, name, shopDomain, plan, loginUrl, inviteToken } = req.body as {
      email: string;
      name: string;
      shopDomain?: string;
      plan?: string;
      loginUrl?: string;
      inviteToken?: string;
    };
  
    if (!email || !name) {
      res.status(400).json({ error: "email y name son requeridos" });
      return;
    }
  
    try {
      await klaviyoPost("/events/", {
        data: {
          type: "event",
          attributes: {
            properties: {
              clientName: name,
              shopDomain: shopDomain ?? "",
              plan: plan ?? "Starter",
              loginUrl: loginUrl ?? "https://shopifyai.pro/login",
              inviteUrl: inviteToken ? `https://shopifyai.pro/invite/${inviteToken}` : null,
              agencyName: "Shopy Crafter",
            },
            metric: { data: { type: "metric", attributes: { name: "Client Welcome" } } },
            profile: { data: { type: "profile", attributes: { email, first_name: name } } },
          },
        },
      });
      res.json({ success: true, message: `Welcome email enviado a ${email}` });
    } catch (err) {
      logger.error({ err }, "Klaviyo welcome-client failed");
      res.status(500).json({ error: "Error al enviar welcome email" });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

export default router;
