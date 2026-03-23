import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.post("/voice/command", async (req, res): Promise<void> => {
  const { transcript, projectId, currentPage } = req.body;

  if (!transcript) {
    res.status(400).json({ error: "transcript required" });
    return;
  }

  let storeName = "tu tienda";
  if (projectId) {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
    if (project) storeName = project.name;
  }

  const systemPrompt = `You are a voice assistant for ShopifyAI Pro, a Shopify optimization platform. The user manages store: ${storeName}. Current page: ${currentPage || "/admin"}.

Interpret this voice command in natural Spanish and return:
1. A natural Spanish spoken response (max 2 sentences, no markdown, conversational tone)
2. An action to execute (if applicable)

Available actions:
- get_revenue: { period: 'today|week|month' }
- get_top_products: { limit: N }
- run_audit: { projectId }
- run_boost: { projectId }
- generate_images: { productId, types: [] }
- change_price: { productId, newPrice }
- get_ab_status: {}
- get_inventory_alerts: {}
- navigate: { path: '/admin/products' }
- search_product: { query: 'string' }

Return JSON ONLY:
{
  "response": "Respuesta hablada natural en español",
  "action": null,
  "confidence": 0.85
}

If confidence < 0.6, response should ask for clarification. Never make up data — if you don't have it, say so.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: transcript }],
    });

    const text = (message.content[0] as any).text;
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : { response: text, action: null, confidence: 0.8 };

    res.json({
      response: parsed.response || "Entendido. ¿Puedes repetirlo?",
      action: parsed.action || null,
      executed: false,
      confidence: parsed.confidence || 0.8,
    });
  } catch (e: any) {
    res.status(500).json({
      response: "Lo siento, hubo un error procesando tu comando.",
      action: null,
      executed: false,
      confidence: 0,
    });
  }
});

export default router;
