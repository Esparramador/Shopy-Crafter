import { Router } from "express";
import { db, auditLogTable } from "@workspace/db";
import { randomBytes } from "crypto";
import { getKlaviyoHeaders } from "../lib/klaviyo-headers.js";

const router = Router();

router.post("/contact", async (req, res): Promise<void> => {
  const {
    name, email, phone, storeUrl, niche, revenue,
    services, socialMedia, message,
  } = req.body as {
    name: string; email: string; phone?: string; storeUrl?: string;
    niche?: string; revenue?: string; services?: string[];
    socialMedia?: string; message?: string;
  };

  if (!name?.trim() || !email?.trim()) {
    res.status(400).json({ error: "Nombre y email son obligatorios" });
    return;
  }

  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRx.test(email)) {
    res.status(400).json({ error: "Email inválido" });
    return;
  }

  const leadData = {
    name: name.trim(), email: email.toLowerCase().trim(),
    phone: phone?.trim() ?? null,
    storeUrl: storeUrl?.trim() ?? null,
    niche: niche?.trim() ?? null,
    revenue: revenue ?? null,
    services: services ?? [],
    socialMedia: socialMedia?.trim() ?? null,
    message: message?.trim() ?? null,
    submittedAt: new Date().toISOString(),
  };

  await db.insert(auditLogTable).values({
    id: randomBytes(8).toString("hex"),
    userId: "public",
    action: "lead_form_submitted",
    details: JSON.stringify(leadData),
    ipAddress: req.ip ?? "unknown",
  }).catch(() => {});

  const klaviyoKey = process.env.KLAVIYO_API_KEY;
  if (klaviyoKey) {
    try {
      await fetch("https://a.klaviyo.com/api/events/", {
        method: "POST",
        headers: getKlaviyoHeaders(),
        body: JSON.stringify({
          data: {
            type: "event",
            attributes: {
              properties: {
                ...leadData,
                servicesStr: (services ?? []).join(", "),
                notifyAdmin: true,
              },
              metric: { data: { type: "metric", attributes: { name: "Lead Form Submitted" } } },
              profile: {
                data: {
                  type: "profile",
                  attributes: {
                    email: leadData.email,
                    first_name: leadData.name.split(" ")[0],
                    last_name: leadData.name.split(" ").slice(1).join(" ") || "",
                    phone_number: leadData.phone ?? undefined,
                    properties: {
                      storeUrl: leadData.storeUrl,
                      niche: leadData.niche,
                      revenue: leadData.revenue,
                      services: Array.isArray(leadData.services) ? leadData.services.join(", ") : (leadData.services ?? ""),
                      source: "Landing Form",
                    },
                  },
                },
              },
            },
          },
        }),
      });

      await fetch("https://a.klaviyo.com/api/events/", {
        method: "POST",
        headers: getKlaviyoHeaders(),
        body: JSON.stringify({
          data: {
            type: "event",
            attributes: {
              properties: {
                leadName: leadData.name,
                leadEmail: leadData.email,
                leadStore: leadData.storeUrl ?? "—",
                leadNiche: leadData.niche ?? "—",
                leadRevenue: leadData.revenue ?? "—",
                leadServices: (services ?? []).join(", ") || "—",
                leadMessage: leadData.message ?? "—",
                leadPhone: leadData.phone ?? "—",
              },
              metric: { data: { type: "metric", attributes: { name: "New Lead Alert" } } },
              profile: {
                data: {
                  type: "profile",
                  attributes: { email: "sadiagiljoan@gmail.com" },
                },
              },
            },
          },
        }),
      });
    } catch (err) {
      req.log?.warn({ err }, "Klaviyo lead event failed");
    }
  }

  res.json({ success: true, message: "Solicitud recibida. Te contactaremos en menos de 24h." });
});

router.get("/leads", async (req, res): Promise<void> => {
  const { pool } = await import("@workspace/db");
  const result = await pool.query(
    `SELECT id, details, created_at FROM audit_log WHERE action = 'lead_form_submitted' ORDER BY created_at DESC LIMIT 100`
  );
  const leads = result.rows.map((r: { id: string; details: string; created_at: string }) => ({
    id: r.id,
    ...JSON.parse(r.details),
    createdAt: r.created_at,
  }));
  res.json(leads);
});

export default router;
