import { Router, Request, Response } from "express";
import { requireAdmin } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { getKlaviyoHeaders } from "../lib/klaviyo-headers.js";
import { askGeminiJson, askGemini } from "../lib/gemini.js";
import { askClaudeWithBrain, askClaudeJsonWithBrain, learnFromOperation } from "../lib/claude.js";
import { db } from "@workspace/db";
import { omnicoreMemoriesTable } from "@workspace/db/schema";
import { v4 as uuid } from "uuid";
import { enableLongRunning } from "../lib/long-running.js";

const router = Router();

const KLAVIYO_BASE = "https://a.klaviyo.com/api";
const REVISION = "2024-02-15";

function kHeaders() {
  return getKlaviyoHeaders(REVISION);
}

async function kGet<T>(path: string): Promise<T> {
  const res = await fetch(`${KLAVIYO_BASE}${path}`, { headers: kHeaders() });
  if (!res.ok) throw new Error(`Klaviyo ${path} ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function kPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${KLAVIYO_BASE}${path}`, { method: "POST", headers: kHeaders(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Klaviyo POST ${path} ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

const KLAVIYO_EXPERT_SYSTEM = `You are OmniCore, an elite eCommerce email marketing expert with deep expertise in Klaviyo.
You know exactly how Klaviyo flows work, what triggers they use, what segmentation is most effective, and how to write 
high-converting email copy for Shopify stores.
You understand: abandoned cart flows, welcome series, post-purchase sequences, win-back campaigns, browse abandonment,
product review requests, VIP programs, and seasonal campaigns.
You write in the brand's tone and always include specific Klaviyo template variables like {{ first_name }}, 
{{ event.ExtraContext.product_name }}, {{ organization.name }}, etc.
Always respond with structured, complete, production-ready content.`;

export interface WorkflowPlan {
  storeName: string;
  shopDomain: string;
  niche: string;
  flows: FlowSpec[];
  segments: SegmentSpec[];
  metrics: string[];
  implementation_order: string[];
  expected_revenue_impact: string;
}

export interface FlowSpec {
  id: string;
  name: string;
  trigger: string;
  trigger_type: "metric" | "list" | "segment" | "date";
  description: string;
  emails: EmailSpec[];
  estimated_revenue: string;
  priority: "critical" | "high" | "medium";
  flow_filters?: string[];
}

export interface EmailSpec {
  position: number;
  delay: string;
  subject: string;
  preview_text: string;
  html_body: string;
  purpose: string;
  key_cta: string;
}

export interface SegmentSpec {
  name: string;
  definition: string;
  use_case: string;
}

// ─── GENERATE FULL KLAVIYO WORKFLOW PLAN ──────────────────────────────────────
router.post("/klaviyo-ai/generate-workflow", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  enableLongRunning(res);
  try {
    
    const { shopDomain, storeName, niche, market = "es", existingFlows = [], storeContext = "" } = req.body as {
      shopDomain: string; storeName: string; niche: string; market?: string;
      existingFlows?: string[]; storeContext?: string;
    };
  
    if (!shopDomain || !storeName || !niche) {
      res.status(400).json({ error: "shopDomain, storeName y niche son requeridos" });
      return;
    }
  
    try {
      logger.info({ shopDomain, niche }, "Generating Klaviyo workflow plan with Gemini");
  
      // Step 1: Gemini gathers market intelligence for this niche
      const marketIntel = await askGeminiJson<{
        topFlows: string[];
        avgCartValue: string;
        buyerBehavior: string;
        seasonalPeaks: string[];
        emailFrequency: string;
        conversionTips: string[];
      }>(`
  You are a Klaviyo email marketing expert analyzing the ${niche} eCommerce niche in ${market === "es" ? "Spain/Spanish market" : market}.
  
  For the store ${storeName} (${shopDomain}) in the ${niche} niche, provide:
  - Top 5 highest-ROI Klaviyo flows for this niche
  - Average cart value range for this niche
  - Typical buyer behavior patterns
  - Seasonal peaks (months)
  - Recommended email frequency
  - Top conversion optimization tips specific to this niche
  
  Return JSON: {
    "topFlows": ["string"],
    "avgCartValue": "string",
    "buyerBehavior": "string",
    "seasonalPeaks": ["string"],
    "emailFrequency": "string",
    "conversionTips": ["string"]
  }`, KLAVIYO_EXPERT_SYSTEM);
  
      // Step 2: Claude generates the full workflow plan
      const prompt = `You are OmniCore, an elite Klaviyo expert for Shopify stores. 
  Create a complete, production-ready Klaviyo workflow plan for:
  
  STORE: ${storeName}
  DOMAIN: ${shopDomain}  
  NICHE: ${niche}
  MARKET: ${market}
  EXISTING FLOWS: ${existingFlows.length > 0 ? existingFlows.join(", ") : "None (new setup)"}
  STORE CONTEXT: ${storeContext || "Standard Shopify store"}
  
  GEMINI MARKET INTELLIGENCE:
  - Top flows for this niche: ${marketIntel.topFlows.join(", ")}
  - Average cart value: ${marketIntel.avgCartValue}
  - Buyer behavior: ${marketIntel.buyerBehavior}
  - Seasonal peaks: ${marketIntel.seasonalPeaks.join(", ")}
  - Conversion tips: ${marketIntel.conversionTips.join("; ")}
  
  Generate a complete Klaviyo setup with 6 essential flows. For each flow include 2-4 emails with full HTML body.
  
  Return JSON matching this structure exactly:
  {
    "storeName": "string",
    "shopDomain": "string",
    "niche": "string",
    "flows": [
      {
        "id": "string (kebab-case)",
        "name": "string",
        "trigger": "string (Klaviyo metric name like 'Placed Order', 'Checkout Started', etc)",
        "trigger_type": "metric",
        "description": "string",
        "estimated_revenue": "string",
        "priority": "critical|high|medium",
        "flow_filters": ["string"],
        "emails": [
          {
            "position": 1,
            "delay": "string (e.g. '0 minutes', '1 hour', '24 hours')",
            "subject": "string (with emojis, personalized with {{ first_name }})",
            "preview_text": "string",
            "html_body": "string (complete responsive HTML email, no markdown, use inline styles, include Klaviyo template variables)",
            "purpose": "string",
            "key_cta": "string"
          }
        ]
      }
    ],
    "segments": [
      {
        "name": "string",
        "definition": "string",
        "use_case": "string"
      }
    ],
    "metrics": ["string"],
    "implementation_order": ["string (flow id in priority order)"],
    "expected_revenue_impact": "string"
  }
  
  FLOWS TO CREATE (all 6 are mandatory):
  1. abandoned-cart — Checkout Started, not Placed Order. 3 emails: 1h, 24h, 72h
  2. welcome-series — Added to Newsletter List. 3 emails: immediate, day 3, day 7
  3. post-purchase — Placed Order. 3 emails: immediate thank you, day 3 how-to, day 14 review request
  4. browse-abandonment — Viewed Product, no checkout. 2 emails: 1h, 24h
  5. win-back — 90+ days no purchase. 2 emails: day 0, day 7
  6. vip-program — High spenders (above average cart × 3 purchases). 2 emails
  
  ALL email HTML must:
  - Be complete responsive HTML with inline CSS
  - Use dark/light safe colors
  - Include the store name ${storeName} and domain ${shopDomain}
  - Use {{ first_name|default:'amig@' }} for personalization
  - Include clear CTA button linking to {{ shop.url }}
  - Be professional, brand-consistent, conversion-focused
  - Be written in ${market === "es" ? "Spanish" : "English"}`;
  
      const projectId = (req.body as Record<string, unknown>).projectId ? parseInt(String((req.body as Record<string, unknown>).projectId)) : 0;
      const plan = await askClaudeJsonWithBrain<WorkflowPlan>(projectId, prompt, KLAVIYO_EXPERT_SYSTEM, "general", niche, 8000);
  
      // Step 3: Save to OmniCore memory
      try {
        await db.insert(omnicoreMemoriesTable).values({
          id: uuid(),
          memoryType: "klaviyo_workflow",
          niche,
          market,
          title: `Klaviyo Workflow Plan: ${storeName} (${shopDomain})`,
          content: JSON.stringify({ plan, marketIntel }),
          confidence: 0.9,
          sourceType: "gemini_claude_generated",
          tags: JSON.stringify(["klaviyo", "email", "workflow", shopDomain, niche]),
          isVerified: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (dbErr) {
        logger.warn(dbErr, "Failed to save Klaviyo plan to OmniCore");
      }
  
      res.json({ plan, marketIntel, source: "gemini+claude+omnicore" });
    } catch (err) {
      const errStr = err instanceof Error ? err.message : String(err);
      logger.error(err, "Klaviyo workflow generation failed");
  
      if (errStr.includes("credit balance is too low") || errStr.includes("insufficient_quota")) {
        res.status(402).json({ error: "⚠️ Créditos de IA agotados — Recarga en console.anthropic.com para continuar." });
      } else if (errStr.includes("rate_limit") || errStr.includes("Too many requests")) {
        res.status(429).json({ error: "⏳ Demasiadas peticiones. Espera unos segundos e inténtalo de nuevo." });
      } else if (errStr.includes("overloaded")) {
        res.status(503).json({ error: "🔄 Servicio de IA sobrecargado temporalmente. Inténtalo en 1-2 minutos." });
      } else {
        res.status(500).json({ error: "Error generando el workflow de Klaviyo. Inténtalo de nuevo." });
      }
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ─── GENERATE SINGLE EMAIL TEMPLATE ───────────────────────────────────────────
router.post("/klaviyo-ai/generate-email", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  enableLongRunning(res);
  try {
    
    const { flowType, emailPosition, storeName, shopDomain, niche, market = "es", delay, tone = "warm" } = req.body as {
      flowType: string; emailPosition: number; storeName: string; shopDomain: string;
      niche: string; market?: string; delay?: string; tone?: string;
    };
  
    try {
      const emailPrompt = `Create a complete, responsive HTML email for Klaviyo.\n\nFlow: ${flowType}\nEmail #${emailPosition} (${delay || "immediate"})\nStore: ${storeName} (${shopDomain})\nNiche: ${niche}\nTone: ${tone}\nLanguage: ${market === "es" ? "Spanish" : "English"}\n\nRequirements:\n- Complete HTML with DOCTYPE, head, body, inline CSS\n- Responsive (max-width 600px)\n- Dark background (#0a0a0f) with gold accents (#c8a84b)\n- Use {{ first_name|default:'amig@' }} for personalization\n- CTA button with direct link to {{ shop.url }}\n- Klaviyo unsubscribe footer: {% unsubscribe %}\n- Professional, high-converting copy specific to ${niche}\n- Include product image placeholder: {{ event.ExtraContext.image_url|default:'' }}\n\nReturn ONLY the complete HTML, no markdown, no explanation.`;
      const emailProjectId = (req.body as Record<string, unknown>).projectId ? parseInt(String((req.body as Record<string, unknown>).projectId)) : 0;
      const html = await askClaudeWithBrain(emailProjectId, [{ role: "user", content: emailPrompt }], undefined, "general", niche, 4000);
  
      learnFromOperation({
        operationType: "email_content",
        niche: niche ?? null,
        title: `Email ${flowType} #${emailPosition} — ${storeName}`,
        content: `Flow: ${flowType}, Email #${emailPosition}, Tienda: ${storeName} (${shopDomain}), Nicho: ${niche}, Tono: ${tone}, Delay: ${delay ?? "immediate"}. Template HTML generado con éxito.`,
        confidence: 0.7,
        tags: ["email", "klaviyo", flowType, niche].filter(Boolean),
      });
  
      res.json({ html, flowType, emailPosition });
    } catch (err) {
      const errStr = err instanceof Error ? err.message : String(err);
      logger.error(err, "Klaviyo email generation failed");
  
      if (errStr.includes("credit balance is too low") || errStr.includes("insufficient_quota")) {
        res.status(402).json({ error: "⚠️ Créditos de IA agotados — Recarga en console.anthropic.com para continuar." });
      } else if (errStr.includes("rate_limit") || errStr.includes("Too many requests")) {
        res.status(429).json({ error: "⏳ Demasiadas peticiones. Espera unos segundos." });
      } else if (errStr.includes("overloaded")) {
        res.status(503).json({ error: "🔄 Servicio de IA sobrecargado. Inténtalo en 1-2 minutos." });
      } else {
        res.status(500).json({ error: "Error generando el email. Inténtalo de nuevo." });
      }
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ─── PUSH FLOW TO KLAVIYO ─────────────────────────────────────────────────────
router.post("/klaviyo-ai/push-flow", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { flow } = req.body as { flow: FlowSpec };
    if (!flow) { res.status(400).json({ error: "flow requerido" }); return; }
  
    try {
      // Create the flow via Klaviyo API
      const flowData = await kPost<{ data: { id: string } }>("/flows/", {
        data: {
          type: "flow",
          attributes: {
            name: flow.name,
            status: "draft",
            trigger_type: "metric",
          },
        },
      });
  
      const flowId = flowData.data.id;
      logger.info({ flowId, name: flow.name }, "Flow created in Klaviyo");
  
      res.json({
        success: true,
        flowId,
        flowName: flow.name,
        note: "Flow creado como draft en Klaviyo. Las acciones de email deben configurarse manualmente en el editor de Klaviyo. Los templates HTML están listos para copiar.",
        klaviyoUrl: `https://www.klaviyo.com/flows/${flowId}`,
      });
    } catch (err) {
      logger.error(err, "Klaviyo push flow failed");
      // Return helpful error but don't fail completely
      res.status(200).json({
        success: false,
        error: String(err),
        note: "No se pudo crear el flow via API. Usa los templates HTML generados para crear el flow manualmente en Klaviyo.",
      });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ─── GET WORKFLOW STATUS ───────────────────────────────────────────────────────
router.get("/klaviyo-ai/status", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const flows = await kGet<{ data: Array<{ id: string; attributes: { name: string; status: string } }> }>("/flows/?page[size]=100&fields[flow]=name,status");
    res.json({
      flowCount: flows.data?.length ?? 0,
      flows: flows.data?.map(f => ({ id: f.id, name: f.attributes.name, status: f.attributes.status })) ?? [],
      geminiAvailable: !!(process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_BASE_URL),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
