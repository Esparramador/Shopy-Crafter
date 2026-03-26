import { Router } from "express";
import { randomBytes } from "crypto";
import { db, agencyCostStructureTable, serviceCatalogTable, pricingDecisionsTable, projectsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";
import { safeDecrypt } from "../lib/crypto.js";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DEFAULT_SERVICES = [
  { serviceName: "Setup Starter", serviceType: "setup", costTimeHours: 1.5, costPlatform: 1.5, priceCurrent: 297, priceMin: 197, priceMax: 497, marketAvgPrice: 350, ourPositioning: "mid" },
  { serviceName: "Setup Agency Pro", serviceType: "setup", costTimeHours: 2.5, costPlatform: 4.5, priceCurrent: 597, priceMin: 397, priceMax: 897, marketAvgPrice: 650, ourPositioning: "premium" },
  { serviceName: "Setup Enterprise", serviceType: "setup", costTimeHours: 5, costPlatform: 12, priceCurrent: 1497, priceMin: 997, priceMax: 2497, marketAvgPrice: 1800, ourPositioning: "premium" },
  { serviceName: "Retainer Starter", serviceType: "retainer", costTimeHours: 2, costPlatform: 3, priceCurrent: 49, priceMin: 39, priceMax: 79, marketAvgPrice: 59, ourPositioning: "mid" },
  { serviceName: "Retainer Agency Pro", serviceType: "retainer", costTimeHours: 4, costPlatform: 8, priceCurrent: 149, priceMin: 99, priceMax: 249, marketAvgPrice: 179, ourPositioning: "premium" },
  { serviceName: "Retainer Enterprise", serviceType: "retainer", costTimeHours: 8, costPlatform: 20, priceCurrent: 399, priceMin: 299, priceMax: 599, marketAvgPrice: 450, ourPositioning: "premium" },
  { serviceName: "Auditoría One-Shot", serviceType: "extra", costTimeHours: 2, costPlatform: 2, priceCurrent: 197, priceMin: 147, priceMax: 297, marketAvgPrice: 220, ourPositioning: "premium" },
  { serviceName: "Boost Único", serviceType: "extra", costTimeHours: 1, costPlatform: 3.5, priceCurrent: 297, priceMin: 197, priceMax: 447, marketAvgPrice: 320, ourPositioning: "premium" },
  { serviceName: "Pack Imágenes IA", serviceType: "extra", costTimeHours: 0.5, costPlatform: 12, priceCurrent: 97, priceMin: 67, priceMax: 147, marketAvgPrice: 110, ourPositioning: "mid" },
  { serviceName: "Consultoría /hora", serviceType: "consultation", costTimeHours: 1, costPlatform: 0.5, priceCurrent: 150, priceMin: 100, priceMax: 250, marketAvgPrice: 160, ourPositioning: "premium" },
  { serviceName: "Reporte PDF Premium", serviceType: "extra", costTimeHours: 0.5, costPlatform: 0.5, priceCurrent: 97, priceMin: 67, priceMax: 147, marketAvgPrice: 100, ourPositioning: "premium" },
];

async function ensureDefaultServices() {
  const existing = await db.select().from(serviceCatalogTable);
  if (existing.length === 0) {
    for (const svc of DEFAULT_SERVICES) {
      const totalCost = (svc.costTimeHours * 80) * 0.3 + svc.costPlatform;
      await db.insert(serviceCatalogTable).values({
        id: randomBytes(12).toString("hex"),
        ...svc,
        totalCost,
        costTools: 0,
      });
    }
  }
}

async function ensureDefaultCostStructure() {
  const existing = await db.select().from(agencyCostStructureTable);
  if (!existing.length) {
    await db.insert(agencyCostStructureTable).values({
      id: randomBytes(12).toString("hex"),
    });
  }
}

router.get("/agency/cost-structure", requireAdmin, async (req, res): Promise<void> => {
  await ensureDefaultCostStructure();
  const [costs] = await db.select().from(agencyCostStructureTable);
  res.json(costs);
});

router.put("/agency/cost-structure", requireAdmin, async (req, res): Promise<void> => {
  await ensureDefaultCostStructure();
  const [existing] = await db.select().from(agencyCostStructureTable);
  const body = { ...req.body, updatedAt: new Date() };
  delete body.id;
  await db.update(agencyCostStructureTable).set(body).where(eq(agencyCostStructureTable.id, existing.id));
  const [updated] = await db.select().from(agencyCostStructureTable);
  res.json(updated);
});

router.get("/agency/services", requireAdmin, async (req, res): Promise<void> => {
  await ensureDefaultServices();
  const services = await db.select().from(serviceCatalogTable).orderBy(serviceCatalogTable.serviceType);
  res.json(services);
});

router.put("/agency/services/:id", requireAdmin, async (req, res): Promise<void> => {
  const body = { ...req.body };
  delete body.id;
  await db.update(serviceCatalogTable).set(body as any).where(eq(serviceCatalogTable.id, String(req.params.id)));
  const [updated] = await db.select().from(serviceCatalogTable).where(eq(serviceCatalogTable.id, String(req.params.id)));
  res.json(updated);
});

router.post("/agency/analyze-pricing", requireAdmin, async (req, res): Promise<void> => {
  await ensureDefaultCostStructure();
  await ensureDefaultServices();
  const [costs] = await db.select().from(agencyCostStructureTable);
  const services = await db.select().from(serviceCatalogTable).where(eq(serviceCatalogTable.isActive, 1));

  const systemPrompt = `Eres Shopy Brain actuando como CFO y Director Comercial experto.
Analiza la estructura de costes y precios de esta agencia Shopify AI.
Proporciona recomendaciones específicas de pricing con justificación completa.
Responde en JSON:
{
  "recommendations": [
    {
      "serviceId": "...",
      "serviceName": "...",
      "currentPrice": 000,
      "suggestedPrice": 000,
      "direction": "up|down|ok",
      "reasoning": "...",
      "confidence": 0.0-1.0,
      "marginAnalysis": "..."
    }
  ],
  "overallAssessment": "...",
  "totalRevenueOpportunity": 000,
  "priorityActions": ["acción 1", "acción 2", "acción 3"]
}`;

  const userMsg = `Estructura de costes: ${JSON.stringify(costs)}
Servicios: ${JSON.stringify(services.map(s => ({ id: s.id, name: s.serviceName, type: s.serviceType, cost: s.totalCost, price: s.priceCurrent, marketAvg: s.marketAvgPrice })))}

Análisis el posicionamiento de precios, márgenes y oportunidades de mejora.`;

  const aiRes = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userMsg }],
  });

  const raw = aiRes.content[0].type === "text" ? aiRes.content[0].text : "{}";
  let analysis: any = {};
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    analysis = m ? JSON.parse(m[0]) : {};
  } catch {}

  if (analysis.recommendations?.length) {
    for (const rec of analysis.recommendations) {
      if (rec.serviceId) {
        await db.update(serviceCatalogTable).set({
          priceSuggested: rec.suggestedPrice,
          omnicoreRecommendation: rec.reasoning,
          omnicoreConfidence: rec.confidence,
          priceChangeSuggested: (rec.suggestedPrice ?? 0) - (rec.currentPrice ?? 0),
          lastPriceReview: new Date(),
        }).where(eq(serviceCatalogTable.id, rec.serviceId));
      }
    }
  }

  res.json(analysis);
});

router.post("/agency/quote", requireAdmin, async (req, res): Promise<void> => {
  const { clientType, numStores, services: selectedServices, timeline, contractLength, niche, estimatedRevenue } = req.body;

  const servicesList = await db.select().from(serviceCatalogTable).where(eq(serviceCatalogTable.isActive, 1));
  const [costs] = await db.select().from(agencyCostStructureTable);

  const systemPrompt = `Eres Shopy Brain como CFO y Director Comercial. 
Genera una propuesta de precio completa y justificada para este cliente potencial.
Responde en JSON:
{
  "setupPrice": 000,
  "monthlyRetainer": 000,
  "annualValue": 000,
  "yourCosts": 000,
  "yourMargin": 000,
  "marginPct": 00,
  "justification": "...",
  "discountIfAnnual": 000,
  "priceAnnual": 000,
  "upsellOpportunities": ["..."],
  "riskAssessment": "...",
  "negotiationFloor": 000,
  "negotiationNotes": "...",
  "roiProjection": "...",
  "recommendedPlan": "starter|agency_pro|enterprise"
}`;

  const userMsg = `Cliente: ${clientType}, ${numStores} tiendas, nicho: ${niche ?? "general"}, revenue estimado: €${estimatedRevenue}/mes
Servicios solicitados: ${JSON.stringify(selectedServices)}
Timeline: ${timeline}, Contrato: ${contractLength}
Costes plataforma: ${JSON.stringify(costs)}
Catálogo servicios: ${JSON.stringify(servicesList.map(s => ({ name: s.serviceName, price: s.priceCurrent, cost: s.totalCost })))}`;

  const aiRes = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: "user", content: userMsg }],
  });

  const raw = aiRes.content[0].type === "text" ? aiRes.content[0].text : "{}";
  let quote: any = {};
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    quote = m ? JSON.parse(m[0]) : {};
  } catch {}

  res.json(quote);
});

router.post("/agency/budget", requireAdmin, async (req, res): Promise<void> => {
  const {
    clientName, clientNIF, clientEmail, clientPhone, clientAddress,
    storeName, storeNiche, numProducts, numCollections,
    selectedServices: budgetItems,
    includeIVA = true, ivaRate = 21,
    notes, paymentTerms, validDays = 30,
  } = req.body;

  const servicesList = await db.select().from(serviceCatalogTable).where(eq(serviceCatalogTable.isActive, 1));
  const [costs] = await db.select().from(agencyCostStructureTable);

  const systemPrompt = `Eres ShopyBrain como Director Financiero (CFO) experto en presupuestos para agencias Shopify.
Genera un presupuesto/factura proforma ULTRA-DETALLADO y profesional para el cliente.

REGLAS ABSOLUTAS:
1. Cada servicio DEBE tener: nombre, descripción detallada, unidades, precio unitario, subtotal
2. Los precios deben ser REALISTAS y competitivos para el mercado español/europeo
3. DESGLOSA cada servicio al máximo detalle (no agrupar, detallar cada línea)
4. Incluye SIEMPRE: horas de consultoría, coste por imagen generada, coste de auditorías, coste de SEO, etc.
5. ${includeIVA ? `Base imponible, IVA (${ivaRate}%) y total final DEBEN estar calculados EXACTAMENTE` : "Este presupuesto está EXENTO DE IVA. ivaRate=0, ivaAmount=0, total = baseImponible. NO incluyas línea de IVA."}
6. Si el cliente pide productos, desglosa: creación de fichas, fotografía IA, copywriting, SEO por producto
7. Incluye una sección de condiciones: plazo de entrega, forma de pago, validez del presupuesto

Catálogo de servicios actual: ${JSON.stringify(servicesList.map(s => ({ name: s.serviceName, type: s.serviceType, price: s.priceCurrent, cost: s.totalCost })))}
Costes internos: ${JSON.stringify(costs)}

Responde en JSON con esta estructura EXACTA:
{
  "budgetNumber": "PRES-2026-XXXX",
  "date": "DD/MM/YYYY",
  "validUntil": "DD/MM/YYYY",
  "client": { "name": "...", "nif": "...", "email": "...", "phone": "...", "address": "..." },
  "agency": { "name": "Shopy Crafter", "nif": "...", "email": "info@shopycrafter.com", "web": "shopycrafter.com" },
  "sections": [
    {
      "sectionName": "Nombre de la sección (ej: Diseño Web, Creación de Productos, SEO...)",
      "items": [
        { "concept": "Descripción detallada del servicio", "units": 1, "unitPrice": 000.00, "subtotal": 000.00 }
      ],
      "sectionSubtotal": 000.00
    }
  ],
  "summary": {
    "baseImponible": 0000.00,
    "ivaRate": ${ivaRate},
    "ivaAmount": 000.00,
    "total": 0000.00,
    "totalInWords": "Mil doscientos euros con cero céntimos"
  },
  "conditions": {
    "paymentTerms": "...",
    "deliveryTime": "...",
    "validity": "...",
    "includesRevisions": "...",
    "additionalNotes": "..."
  },
  "internalAnalysis": {
    "totalCostForUs": 000.00,
    "totalMargin": 000.00,
    "marginPercentage": 00,
    "hoursEstimated": 00,
    "profitabilityRating": "alta|media|baja",
    "recommendation": "..."
  }
}`;

  const userMsg = `CLIENTE: ${clientName || "Sin nombre"}
NIF/CIF: ${clientNIF || "No proporcionado"}
Email: ${clientEmail || ""}, Teléfono: ${clientPhone || ""}
Dirección: ${clientAddress || ""}
TIENDA: ${storeName || "Nueva tienda Shopify"}
NICHO: ${storeNiche || "general"}
PRODUCTOS A CREAR: ${numProducts || 0}
COLECCIONES: ${numCollections || 0}
IVA: ${includeIVA ? `Sí (${ivaRate}%)` : "No (exento)"}
CONDICIONES DE PAGO: ${paymentTerms || "50% inicio, 50% entrega"}
VALIDEZ: ${validDays} días
NOTAS: ${notes || "Sin notas adicionales"}

SERVICIOS SOLICITADOS:
${(budgetItems ?? []).map((s: any) => `- ${s.name}: ${s.description || ""} (qty: ${s.qty || 1})`).join("\n") || "Paquete completo: diseño web + productos + SEO + auditoría + imágenes IA"}`;

  try {
    const aiRes = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 6000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMsg }],
    });

    const raw = aiRes.content[0].type === "text" ? aiRes.content[0].text : "{}";
    let budget: any = {};
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      budget = m ? JSON.parse(m[0]) : {};
    } catch { budget = { error: "Error parsing AI response", raw }; }

    res.json(budget);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/agency/proposal", requireAdmin, async (req, res): Promise<void> => {
  const { clientName, storeName, services: selectedServices, quote, auditResults } = req.body;

  const systemPrompt = `Eres Shopy Brain generando una propuesta comercial profesional en español.
Genera una propuesta completa y convincente que NO describa lo que haces, sino LO QUE EL CLIENTE GANA.
Incluye: página de título, resumen ejecutivo, diagnóstico, servicios propuestos, inversión, proyección ROI, próximos pasos.
Usa markdown con formato claro. Sé conciso pero impactante. Máximo 800 palabras.`;

  const userMsg = `Cliente: ${clientName}
Tienda: ${storeName}
Servicios: ${JSON.stringify(selectedServices)}
Propuesta económica: ${JSON.stringify(quote)}
${auditResults ? `Resultados auditoría: ${JSON.stringify(auditResults)}` : ""}`;

  const aiRes = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: "user", content: userMsg }],
  });

  const proposal = aiRes.content[0].type === "text" ? aiRes.content[0].text : "";
  res.json({ proposal, tokensUsed: aiRes.usage?.input_tokens + aiRes.usage?.output_tokens });
});

// ─── Shopify Billing Integration ───────────────────────────────────────────

router.get("/agency/shopify-products", requireAdmin, async (_req, res): Promise<void> => {
  const shopDomain = process.env.SHOP_DOMAIN;
  const storefrontToken = process.env.STOREFRONT_ACCESS_TOKEN;

  if (!shopDomain || !storefrontToken ) {
    res.json({ products: [], configured: false, message: "Configura SHOP_DOMAIN con tu tienda en Ajustes" });
    return;
  }

  const domain = shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  try {
    const response = await fetch(`https://${domain}/api/2024-10/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": storefrontToken },
      body: JSON.stringify({
        query: `query {
          products(first: 50) {
            edges { node {
              id title productType
              priceRange { minVariantPrice { amount currencyCode } }
              variants(first: 5) { edges { node { id title price { amount currencyCode } availableForSale } } }
            } }
          }
        }`
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json() as any;
    const products = data.data?.products?.edges?.map((e: any) => e.node) ?? [];
    res.json({ products, configured: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message, configured: true });
  }
});

router.post("/agency/payment-link", requireAdmin, async (req, res): Promise<void> => {
  const { serviceId, clientName, note } = req.body;
  const shopDomain = process.env.SHOP_DOMAIN;
  const storefrontToken = process.env.STOREFRONT_ACCESS_TOKEN;

  if (!shopDomain || !storefrontToken ) {
    res.status(400).json({ error: "SHOP_DOMAIN no configurado. Ve a Ajustes → Shopify." });
    return;
  }

  const [service] = await db.select().from(serviceCatalogTable).where(eq(serviceCatalogTable.id, serviceId));
  if (!service) { res.status(404).json({ error: "Servicio no encontrado" }); return; }

  if (!service.shopifyVariantId) {
    res.json({
      checkoutUrl: null,
      service: { name: service.serviceName, price: service.priceCurrent },
      requiresMapping: true,
      error: `"${service.serviceName}" no tiene producto Shopify vinculado. Ve a Mi Pricing → Shopify Sync para vincularlo.`,
    });
    return;
  }

  const domain = shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const customNote = [clientName && `Cliente: ${clientName}`, note].filter(Boolean).join(" — ");

  try {
    const response = await fetch(`https://${domain}/api/2024-10/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": storefrontToken },
      body: JSON.stringify({
        query: `mutation cartCreate($lines:[CartLineInput!]!,$note:String){cartCreate(input:{lines:$lines,note:$note}){cart{id checkoutUrl}userErrors{field message}}}`,
        variables: { lines: [{ merchandiseId: service.shopifyVariantId, quantity: 1 }], note: customNote },
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json() as any;
    const checkoutUrl = data.data?.cartCreate?.cart?.checkoutUrl;
    const errors = data.data?.cartCreate?.userErrors;
    if (!checkoutUrl || errors?.length) throw new Error(errors?.[0]?.message ?? "Checkout no creado");
    res.json({ checkoutUrl, service: { name: service.serviceName, price: service.priceCurrent } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/agency/services/:id/shopify-variant", requireAdmin, async (req, res): Promise<void> => {
  const { variantId, productId } = req.body;
  await db.update(serviceCatalogTable)
    .set({ shopifyVariantId: variantId ?? null, shopifyProductId: productId ?? null })
    .where(eq(serviceCatalogTable.id, String(req.params.id)));
  const [updated] = await db.select().from(serviceCatalogTable).where(eq(serviceCatalogTable.id, String(req.params.id)));
  res.json(updated);
});

router.get("/agency/pricing-decisions", requireAdmin, async (req, res): Promise<void> => {
  const decisions = await db.select().from(pricingDecisionsTable)
    .orderBy(desc(pricingDecisionsTable.createdAt))
    .limit(20);
  res.json(decisions);
});

router.post("/agency/push-services-to-shopify", requireAdmin, async (req, res): Promise<void> => {
  await ensureDefaultServices();
  const services = await db.select().from(serviceCatalogTable).where(eq(serviceCatalogTable.isActive, 1));

  const { projectId } = req.body as { projectId?: number };

  let adminToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ?? "";
  let shopDomain = process.env.SHOP_DOMAIN ?? "";

  if (projectId) {
    const [project] = await db
      .select({ accessToken: projectsTable.accessToken, shopDomain: projectsTable.shopDomain })
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId));

    if (project?.accessToken) {
      adminToken = safeDecrypt(project.accessToken) || project.accessToken;
    }
    if (project?.shopDomain) {
      shopDomain = project.shopDomain;
    }
  }

  const buildProduct = (svc: typeof services[0]) => {
    const price = (svc.priceSuggested ?? svc.priceCurrent ?? 0).toFixed(2);
    const compareAtPrice = svc.priceMax ? (svc.priceMax * 1.2).toFixed(2) : null;
    const isRecurring = svc.serviceType === "retainer";
    const typeLabel = svc.serviceType === "retainer" ? "/mes" : svc.serviceType === "consultation" ? "/hora" : "";
    return {
      title: `${svc.serviceName}${typeLabel ? ` (${typeLabel})` : ""}`,
      body_html: `<p><strong>${svc.serviceName}</strong></p><!-- nosemgrep -->
<p>${svc.omnicoreRecommendation ?? `Servicio de agencia Shopify AI — ${svc.serviceType}.`}</p>
<ul>
  <li>✓ Implementación por expertos ShopyBrain</li>
  <li>✓ Resultados medibles y reportados</li>
  ${isRecurring ? "<li>✓ Optimización continua mensual</li>" : "<li>✓ Entrega en 48-72 horas</li>"}
  <li>✓ Soporte prioritario incluido</li>
</ul>
<p><strong>Precio: €${price}${typeLabel}</strong></p>`,
      vendor: "ShopyBrain Agency",
      product_type: svc.serviceType,
      tags: `shopify-ai, agencia, ${svc.serviceType}, shopify-automatization`,
      status: "active",
      variants: [{ price, compare_at_price: compareAtPrice }],
    };
  };

  const shopifyProducts = services.map(buildProduct);

  if (!adminToken) {
    res.json({
      success: false,
      message: "No hay token de admin disponible. Conecta tu tienda como proyecto o configura SHOPIFY_ADMIN_ACCESS_TOKEN.",
      requiresManualImport: true,
      shopifyProducts,
      instructions: [
        "Opción A: Conecta comiccrafter.es como proyecto en la app → el token se captura automáticamente → vuelve aquí y selecciona el proyecto",
        "Opción B: Ve a Shopify Admin → Configuración → Apps → Desarrollar apps → crea un token con write_products y configúralo como SHOPIFY_ADMIN_ACCESS_TOKEN",
      ],
    });
    return;
  }

  const adminDomain = shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const headers = { "Content-Type": "application/json", "X-Shopify-Access-Token": adminToken };
  const apiBase = `https://${adminDomain}/admin/api/2024-10`;

  const results: Array<{ service: string; shopifyId: string | null; status: string; error?: string }> = [];
  const createdIds: string[] = [];

  for (const product of shopifyProducts) {
    try {
      const response = await fetch(`${apiBase}/products.json`, {
        method: "POST",
        headers,
        body: JSON.stringify({ product }),
      });
      const data = await response.json() as { product?: { id: string }; errors?: unknown };
      if (!response.ok || data.errors) {
        results.push({ service: product.title, shopifyId: null, status: "error", error: JSON.stringify(data.errors ?? "HTTP error") });
      } else {
        const id = String(data.product?.id ?? "");
        results.push({ service: product.title, shopifyId: id, status: "created" });
        if (id) createdIds.push(id);
      }
    } catch (err) {
      results.push({ service: product.title, shopifyId: null, status: "error", error: err instanceof Error ? err.message : "unknown" });
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  let collectionId: string | null = null;
  let collectionStatus = "not_attempted";

  if (createdIds.length > 0) {
    try {
      const colRes = await fetch(`${apiBase}/custom_collections.json?handle=shopify-automatization`, { headers });
      const colData = await colRes.json() as { custom_collections?: Array<{ id: string }> };
      const existing = colData.custom_collections?.[0];

      if (existing) {
        collectionId = String(existing.id);
      } else {
        const createColRes = await fetch(`${apiBase}/custom_collections.json`, {
          method: "POST",
          headers,
          body: JSON.stringify({ custom_collection: { title: "Shopify Automatization", handle: "shopify-automatization", published: true } }),
        });
        const createColData = await createColRes.json() as { custom_collection?: { id: string } };
        collectionId = String(createColData.custom_collection?.id ?? "");
      }

      if (collectionId) {
        for (const productId of createdIds) {
          await fetch(`${apiBase}/collects.json`, {
            method: "POST",
            headers,
            body: JSON.stringify({ collect: { product_id: productId, collection_id: collectionId } }),
          });
          await new Promise((r) => setTimeout(r, 300));
        }
        collectionStatus = "assigned";
      }
    } catch (err) {
      collectionStatus = `error: ${err instanceof Error ? err.message : "unknown"}`;
    }
  }

  const created = results.filter((r) => r.status === "created").length;
  const failed = results.filter((r) => r.status === "error").length;

  res.json({
    success: created > 0,
    created,
    failed,
    collectionStatus,
    collectionId,
    results,
    message: created > 0
      ? `✅ ${created} productos creados en Shopify${collectionStatus === "assigned" ? " y añadidos a la colección shopify-automatization" : ""}${failed > 0 ? ` · ${failed} fallaron` : ""}`
      : "No se pudo crear ningún producto",
    storeUrl: `https://${adminDomain}/collections/shopify-automatization`,
  });
});

export default router;
