import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAdmin } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import Anthropic from "@anthropic-ai/sdk";
import { safeDecrypt } from "../lib/crypto.js";
import { buildShopyBrainContext, learnFromOperation } from "../lib/claude.js";

const router = Router();
router.use(requireAdmin);

const KLAVIYO_BASE = "https://a.klaviyo.com/api";
const REVISION = "2024-10-15";

function klaviyoHeaders() {
  const key = process.env.KLAVIYO_API_KEY;
  if (!key) throw new Error("KLAVIYO_API_KEY not set");
  return {
    "Authorization": `Klaviyo-API-Key ${key}`,
    "Content-Type": "application/json",
    "revision": REVISION,
  };
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

const TRIGGER_MAP: Record<string, string> = {
  checkout_abandoned: "Checkout Started",
  order_placed: "Placed Order",
  customer_subscribed: "Subscribed to List",
  review_requested: "Fulfilled Order",
  win_back: "Placed Order",
  vip_upgrade: "Placed Order",
  stock_back: "Back in Stock",
  price_drop: "Viewed Product",
  welcome: "Subscribed to List",
};

const DELAY_MAP: Record<string, number> = {
  immediate: 0,
  "1h": 3600,
  "3h": 10800,
  "24h": 86400,
  "3d": 259200,
  "7d": 604800,
};

router.get("/emails/flows", async (req, res): Promise<void> => {
  try {
    const projectId = req.query.projectId ? Number(req.query.projectId) : null;
    const query = projectId
      ? "SELECT * FROM email_flows WHERE project_id = $1 ORDER BY created_at DESC"
      : "SELECT * FROM email_flows ORDER BY created_at DESC";
    const params = projectId ? [projectId] : [];
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/emails/flows/:id", async (req, res): Promise<void> => {
  try {
    const { rows } = await pool.query("SELECT * FROM email_flows WHERE id = $1", [req.params.id]);
    if (!rows.length) { res.status(404).json({ error: "Flow not found" }); return; }
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/emails/flows", async (req, res): Promise<void> => {
  const {
    project_id, name, flow_type, trigger_type,
    send_delay = "1h", subject_a, subject_b, preview_text,
    tone = "urgente", language = "es", from_email, from_name, reply_email,
  } = req.body;

  try {
    const { rows } = await pool.query(
      `INSERT INTO email_flows 
        (project_id, name, flow_type, trigger_type, send_delay, subject_a, subject_b, 
         preview_text, tone, language, from_email, from_name, reply_email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [project_id, name, flow_type, trigger_type, send_delay, subject_a, subject_b,
        preview_text, tone, language, from_email, from_name, reply_email]
    );
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/emails/flows/:id", async (req, res): Promise<void> => {
  const fields = [
    "name", "flow_type", "trigger_type", "send_delay", "subject_a", "subject_b",
    "preview_text", "tone", "language", "html_content", "text_content",
    "variables_used", "from_email", "from_name", "reply_email",
  ];
  const updates: string[] = [];
  const values: any[] = [];
  let i = 1;
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = $${i}`);
      values.push(req.body[f]);
      i++;
    }
  }
  if (!updates.length) { res.status(400).json({ error: "No fields to update" }); return; }
  updates.push(`updated_at = NOW()`);
  values.push(req.params.id);

  try {
    const { rows } = await pool.query(
      `UPDATE email_flows SET ${updates.join(", ")} WHERE id = $${i} RETURNING *`,
      values
    );
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/emails/flows/:id", async (req, res): Promise<void> => {
  try {
    await pool.query("DELETE FROM email_flows WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/emails/generate", async (req, res): Promise<void> => {
  const { flowType, tone = "urgente", projectId, includeOptions = [], language = "es", referenceContext } = req.body;

  if (!projectId) { res.status(400).json({ error: "projectId requerido — selecciona un proyecto" }); return; }

  try {
    const { rows: projRows } = await pool.query("SELECT name, store_niche, brand_tone, shop_domain FROM projects WHERE id = $1", [projectId]);
    if (!projRows.length) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    const project = projRows[0];
    const storeName = project.name;
    const niche = project.store_niche || "ecommerce";
    const brandTone = project.brand_tone || "";
    const shopDomain = project.shop_domain || "";

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const client = new Anthropic({ apiKey: anthropicKey });

    const brainContext = await buildShopyBrainContext(niche, "general");

    const systemPrompt = `Eres un experto en email marketing de eCommerce con años de experiencia creando emails de alta conversión.
Generas emails HTML completos, profesionales y que realmente convierten para tiendas Shopify.
SIEMPRE devuelves JSON válido y nada más.

⚠️ REGLA CRÍTICA: Este email es EXCLUSIVAMENTE para "${storeName}".
- TODOS los textos, headers, footers y subjects DEBEN usar "${storeName}" — NUNCA otro nombre.
- NUNCA uses nombres genéricos como "Tu Tienda", "Mi Marca", "Acme", "Store Name".
- El nicho es "${niche}" — todo el copy debe ser relevante a este nicho.
${brandTone ? `- El tono de voz de la marca es: "${brandTone}".` : ""}
${shopDomain ? `- El dominio real es "${shopDomain}".` : ""}
${brainContext}`;

    const userPrompt = `Genera un email HTML completo y profesional para "${storeName}" (nicho: ${niche}).

TIPO DE FLOW: ${flowType}
TONO: ${tone}
IDIOMA: ${language}
INCLUIR: ${includeOptions.join(", ") || "imagen producto, urgencia, CTA"}
${referenceContext ? `\nCONTEXTO DE REFERENCIA:\n${referenceContext}\n` : ""}

VARIABLES KLAVIYO A USAR:
- {{ first_name }} — nombre del cliente
- {{ product_title }} — nombre del producto  
- {{ product_image_url }} — imagen del producto
- {{ product_url }} — link al producto
- {{ checkout_url }} — link al carrito abandonado
- {{ discount_code }} — código de descuento
- {{ store_name }} — nombre de la tienda (= "${storeName}")

REGLAS HTML CRÍTICAS (email clients):
- Ancho máximo: 600px, centrado con margin: 0 auto
- Fondo exterior: #0a0a0f
- Fondo email: #13131f  
- Texto principal: #f0eefc
- Texto secundario: #9d9db8
- CTA button: fondo #c8a84b, texto #060400, padding: 14px 32px, border-radius: 6px
- Font: Arial, sans-serif (NO Google Fonts)
- SIEMPRE inline CSS — los email clients ignoran <style>
- NUNCA uses flexbox ni grid — usa tablas para layout
- El HTML debe ser completamente auto-contenido
- TODOS los textos visibles deben hacer referencia a "${storeName}", NO a nombres genéricos

Devuelve SOLO este JSON (nada más):
{
  "subject_a": "asunto variante A para ${storeName} (máx 55 chars)",
  "subject_b": "asunto variante B con {{ first_name }} para ${storeName} (máx 55 chars)",
  "preview_text": "texto preview de ${storeName} (máx 90 chars)",
  "html": "HTML completo del email con TODO referenciando a ${storeName} (tabla-based, inline CSS)",
  "text": "versión texto plano del email mencionando ${storeName}",
  "variables_used": ["lista de variables Klaviyo usadas"]
}`;

    const message = await client.messages.create(
      {
        model: "claude-sonnet-4-5",
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      },
      { signal: AbortSignal.timeout(90_000) }
    );

    const content = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in Claude response");

    const result = JSON.parse(jsonMatch[0]);

    // ShopyBrain learns from every email generated
    learnFromOperation({
      operationType: "redesign",
      niche,
      title: `Email ${flowType} generado para ${storeName}`,
      content: `Flow: ${flowType} | Tone: ${tone} | Tienda: ${storeName} | Subjects: ${result.subject_a ?? ""} / ${result.subject_b ?? ""}`,
      confidence: 0.68,
      tags: ["email", flowType, tone, niche],
    });

    res.json(result);
  } catch (err: any) {
    logger.error("Email generate error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post("/emails/flows/:id/push", async (req, res): Promise<void> => {
  const flowId = req.params.id;

  try {
    const { rows } = await pool.query(
      `SELECT ef.*, p.name as project_name 
       FROM email_flows ef 
       LEFT JOIN projects p ON p.id = ef.project_id 
       WHERE ef.id = $1`,
      [flowId]
    );
    if (!rows.length) { res.status(404).json({ error: "Flow not found" }); return; }
    const flow = rows[0];

    if (!flow.html_content) { res.status(400).json({ error: "Generate email content first" }); return; }

    const templateName = `[${flow.project_name || "ShopifyAI"}] ${flow.name}`;

    const templateRes = await klaviyoPost<any>("/templates/", {
      data: {
        type: "template",
        attributes: {
          name: templateName,
          editor_type: "CODE",
          html: flow.html_content,
          text: flow.text_content || "",
        },
      },
    });
    const klaviyoTemplateId = templateRes.data?.id;
    if (!klaviyoTemplateId) throw new Error("Template creation failed");

    const flowRes = await klaviyoPost<any>("/flows/", {
      data: {
        type: "flow",
        attributes: {
          name: templateName,
          status: "live",
          trigger_type: "metric",
          trigger_options: {
            metric: { name: TRIGGER_MAP[flow.trigger_type] || "Placed Order" },
          },
        },
      },
    });
    const klaviyoFlowId = flowRes.data?.id;
    if (!klaviyoFlowId) throw new Error("Flow creation failed");

    const delaySeconds = DELAY_MAP[flow.send_delay] || 3600;

    await klaviyoPost("/flow-actions/", {
      data: {
        type: "flow-action",
        attributes: {
          action_type: "send_email",
          settings: {
            subject: flow.subject_a || "{{ subject }}",
            preview_text: flow.preview_text || "",
            from_email: flow.from_email || "noreply@shopifyai.pro",
            from_label: flow.from_name || flow.project_name || "ShopifyAI",
            reply_to_email: flow.reply_email || flow.from_email || "noreply@shopifyai.pro",
          },
          send_options: { use_smart_sending: true },
          rendering_options: {
            shorten_links: true,
            add_tracking_params: true,
            add_org_prefix: false,
          },
        },
        relationships: {
          flow: { data: { type: "flow", id: klaviyoFlowId } },
          template: { data: { type: "template", id: klaviyoTemplateId } },
        },
      },
    });

    await pool.query(
      `UPDATE email_flows 
       SET klaviyo_template_id = $1, klaviyo_flow_id = $2, klaviyo_status = 'live', 
           klaviyo_error = NULL, pushed_at = NOW(), updated_at = NOW()
       WHERE id = $3`,
      [klaviyoTemplateId, klaviyoFlowId, flowId]
    );

    res.json({ success: true, klaviyoTemplateId, klaviyoFlowId });
  } catch (err: any) {
    logger.error("Push to Klaviyo error:", err.message);
    await pool.query(
      `UPDATE email_flows SET klaviyo_status = 'error', klaviyo_error = $1 WHERE id = $2`,
      [err.message, flowId]
    );
    res.status(500).json({ error: err.message });
  }
});

router.post("/emails/flows/:id/sync", async (req, res): Promise<void> => {
  const flowId = req.params.id;

  try {
    const { rows } = await pool.query("SELECT * FROM email_flows WHERE id = $1", [flowId]);
    if (!rows.length) { res.status(404).json({ error: "Flow not found" }); return; }
    const flow = rows[0];

    if (!flow.klaviyo_flow_id) {
      res.status(400).json({ error: "Flow not pushed to Klaviyo yet" });
      return;
    }

    const metricsRes = await fetch(`${KLAVIYO_BASE}/flow-actions/?filter=equals(flow.id,"${flow.klaviyo_flow_id}")`, {
      headers: klaviyoHeaders(),
    });

    if (metricsRes.ok) {
      const data = await metricsRes.json() as any;
      const action = data.data?.[0];
      if (action) {
        const stats = action.attributes?.tracking_options;
        await pool.query(
          `UPDATE email_flows SET last_synced_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [flowId]
        );
      }
    }

    res.json({ success: true, synced_at: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
