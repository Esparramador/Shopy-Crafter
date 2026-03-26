import { Router } from "express";
import { db, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { learnFromOperation } from "../lib/claude";

const router = Router();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.post("/voice/command", async (req, res): Promise<void> => {
  const { transcript, projectId, currentPage } = req.body;

  if (!transcript) {
    res.status(400).json({ error: "transcript required" });
    return;
  }

  let storeName = "tu tienda";
  let activeProjectId: number | null = null;
  if (projectId) {
    activeProjectId = parseInt(projectId);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, activeProjectId));
    if (project) storeName = project.name;
  }

  const systemPrompt = `Eres el asistente de voz de Shopy Crafter (ShopyBrain). La tienda activa es: ${storeName}. Página actual: ${currentPage || "/admin"}.${activeProjectId ? ` ProjectId: ${activeProjectId}` : ""}

Interpreta este comando de voz en español y devuelve:
1. Una respuesta hablada natural en español (max 2 frases, sin markdown, tono conversacional)
2. Una acción a ejecutar (si aplica)

Acciones disponibles:
- store_status: Ver estado de la tienda. Params: {projectId}
- list_products: Listar productos activos. Params: {projectId, limit?}
- list_all_products: Listar TODOS los productos (active, draft, archived). Params: {projectId, limit?, statusFilter? ("any","active","draft","archived")}
- create_product: Crear producto en Shopify. Params: {projectId, title, price?, productType?, aiGenerate?}
- edit_product: Editar producto. Params: {projectId, productId, title?, bodyHtml?, tags?, status?, price?}
- change_price: Cambiar precio. Params: {projectId, productId, price, compareAtPrice?}
- set_product_status: Cambiar estado de producto (publicar/despublicar/archivar). Params: {projectId, productId, status ("active","draft","archived")}
- scan_store: Escanear/auditar TODOS los productos de la tienda (incluye draft y archived). Params: {projectId, statusFilter? ("any","active","draft","archived")}
- regenerate_token: Regenerar token de Shopify. Params: {projectId}
- get_scopes: Ver permisos OAuth. Params: {projectId}
- search_product: Buscar producto. Params: {projectId, query}
- publish_product: Publicar producto. Params: {projectId, productId}
- delete_product: Eliminar producto. Params: {projectId, productId}
- get_orders: Ver pedidos. Params: {projectId, limit?}
- search_suppliers: Buscar proveedores de un producto. Params: {productName, productCategory?, materials?, targetMarket?, qualityTier?, budget?, country?}
- modify_audit_filter: Cambiar filtro de auditoría (qué productos incluir). Params: {projectId, statusFilter ("any","active","draft","archived"), autoScan? (boolean)}
- diagnose_app: Diagnosticar el funcionamiento de la app, detectar y reparar errores. Params: {projectId, checks? ("all","token","sync","products","connectivity")}
- inspect_code: Leer y analizar código fuente de la app. Params: {filePath, analyze? (boolean)}
- fix_code: Aplicar corrección a un archivo de código. Params: {filePath, oldCode, newCode, description}
- list_source_files: Listar archivos del código fuente. Params: {directory?, pattern?}
- analyze_component: Analizar componente buscando bugs. Params: {filePath, focusOn? ("bugs","ux","performance","logic","all")}
- navigate: Navegar a página. Params: {path}
- navigate: Ir a /projects/{projectId}/audit para ver auditoría visual

Devuelve SOLO JSON válido:
{
  "response": "Respuesta hablada natural en español",
  "action": {"type": "nombre_accion", "params": {...}} o null,
  "confidence": 0.85
}

Si confidence < 0.6, pide aclaración. Nunca inventes datos.`;

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

    if (parsed.confidence >= 0.6 && parsed.action) {
      learnFromOperation({
        operationType: "voice_command",
        title: `Voice: ${transcript.slice(0, 80)}`,
        content: `Comando: "${transcript}". Acción: ${JSON.stringify(parsed.action)}. Respuesta: ${parsed.response?.slice(0, 200)}. Página: ${currentPage ?? "unknown"}.`,
        confidence: parsed.confidence ?? 0.7,
        tags: ["voice", "command", parsed.action?.type ?? "general"].filter(Boolean),
      });
    }

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
