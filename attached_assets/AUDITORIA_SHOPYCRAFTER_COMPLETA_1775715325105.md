# 🔬 AUDITORÍA COMPLETA — SHOPY CRAFTER v2.0
## Documento de instrucciones para Replit: Bugs, Mejoras y Potenciación Estratosférica
### Auditoría realizada por Claude (Anthropic) — Abril 2026
### Codebase analizado: 176 archivos, 86,000+ líneas

---

# ÍNDICE

1. **BUGS CRÍTICOS** — Cosas rotas que hay que arreglar YA
2. **BUGS MEDIOS** — Problemas que causan mal funcionamiento parcial
3. **BUGS MENORES** — Cositas que pulir
4. **WEB LAB** — Potenciación del Laboratorio Web
5. **COGS ENGINE** — Cálculo real de costes sin que te los digan
6. **MULTI-PLATAFORMA** — WooCommerce, PrestaShop, Universal
7. **ENTITY RESEARCH** — Investigación de marcas/empresas
8. **AUDITORÍA UNIVERSAL** — Para cualquier tipo de empresa
9. **SHOPY BRAIN** — Potenciación de la IA central
10. **SEGURIDAD** — Vulnerabilidades detectadas
11. **RENDIMIENTO** — Optimizaciones de performance
12. **ARQUITECTURA** — Mejoras estructurales
13. **NUEVAS FUNCIONALIDADES** — Features que faltan para nivel estratosférico

---

# 1. 🚨 BUGS CRÍTICOS — ARREGLAR INMEDIATAMENTE

## BUG-001: Contraseña admin hardcodeada en código fuente
**Archivo:** `api-server/src/index.ts` línea ~307
**Problema:** La contraseña por defecto del admin `"ShopyAdmin2026!"` está en el código fuente en texto plano. Si `ADMIN_PASSWORD` env var no existe en dev, usa esta contraseña hardcodeada. Aunque solo se usa en dev, es un riesgo de seguridad grave si el código se filtra o se despliega mal.
**Fix:**
```typescript
// ANTES (MALO):
const ADMIN_PASS = envPass || "ShopyAdmin2026!";

// DESPUÉS (BIEN):
if (!envPass) {
  logger.warn("⚠️ ADMIN_PASSWORD not set — generating random password for dev");
  const ADMIN_PASS = randomBytes(24).toString("base64url");
  logger.info({ password: ADMIN_PASS }, "🔑 Generated dev admin password (use this to login)");
} else {
  const ADMIN_PASS = envPass;
}
```

## BUG-002: Email admin hardcodeado — impide multi-tenancy
**Archivo:** `api-server/src/index.ts` línea ~300
**Problema:** `sadiagiljoan@gmail.com` está hardcodeado como admin email. Si un cliente despliega su propia instancia, el admin sigue siendo Joan. Debería leerse de variable de entorno.
**Fix:**
```typescript
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@shopycrafter.com";
const ADMIN_NAME = process.env.ADMIN_NAME || "Admin";
```

## BUG-003: apply-price hardcodeado solo para Shopify
**Archivo:** `api-server/src/routes/pricing.ts` línea ~32694
**Problema:** El endpoint `apply-price` usa directamente `shopifyRequest()` en vez del conector de plataforma. Si el proyecto es WooCommerce o PrestaShop, este endpoint CRASH porque intenta llamar a la API de Shopify en un dominio WordPress.
**Fix:**
```typescript
// ANTES (MALO):
await shopifyRequest(projectId, project.shopDomain, `/products/${shopifyProductId}.json`, {
  method: "PUT",
  body: JSON.stringify({ product: { variants: [{ price, compare_at_price: compareAtPrice }] } }),
});

// DESPUÉS (BIEN):
import { getConnector } from "../connectors/index.js";
const connector = getConnector(project);
await connector.updateProduct(shopifyProductId, {
  variants: [{ platformId: "", title: "", price, compareAtPrice: compareAtPrice || undefined }],
});
```

## BUG-004: `askClaudeJsonWithBrain` pasa "cogs_estimation" como useCase pero NO está en el tipo
**Archivo:** `api-server/src/routes/pricing.ts` línea ~33004
**Problema:** Se pasa `"cogs_estimation"` al parámetro `useCase` pero el tipo de `askClaudeJsonWithBrain` solo acepta `"redesign" | "seo" | "pricing" | "images" | "general"`. TypeScript lo marca como error. El resultado es que no se inyecta el contexto de ShopyBrain correcto para COGS.
**Fix:** Cambiar a `"pricing"` que es el más cercano, o ampliar el tipo union para incluir `"cogs_estimation"`.

## BUG-005: entity-research endpoint `/research-entity` responde inmediatamente sin hacer nada
**Archivo:** `api-server/src/routes/entity-research.ts` línea ~22382
**Problema:** El endpoint `POST /shopybrain/research-entity` extrae el nombre de la entidad pero luego simplemente retorna `{ status: "started", researchId, entity }` sin nunca ejecutar la investigación. El único endpoint funcional es `/research-entity-sync`. El async está declarado pero nunca implementado.
**Fix:** O implementar la versión async con un sistema de jobs/queue, o eliminar el endpoint y dejar solo `-sync`. Recomendación: implementar con un job queue:
```typescript
// Crear un job en la base de datos
const job = await db.insert(researchJobsTable).values({
  id: researchId,
  entityName: entity.name,
  status: "running",
  input,
  niche,
}).returning();

// Ejecutar en background
setImmediate(async () => {
  try {
    const research = await deepEntityResearch(entity.name, entity.url);
    // ... procesar y guardar
    await db.update(researchJobsTable)
      .set({ status: "completed", result: research })
      .where(eq(researchJobsTable.id, researchId));
  } catch (err) {
    await db.update(researchJobsTable)
      .set({ status: "failed", error: String(err) })
      .where(eq(researchJobsTable.id, researchId));
  }
});

res.json({ status: "started", researchId, entity });
```
Añadir endpoint `GET /shopybrain/research-status/:researchId` para polling.

## BUG-006: `PlatformNotSupportedError` muestra mensaje incorrecto
**Archivo:** `api-server/src/lib/connectors/types.ts` línea ~4569
**Problema:** El mensaje de error dice `"Plataformas disponibles: shopify"` cuando ya existen WooCommerce, PrestaShop y Universal. El usuario ve un mensaje incorrecto.
**Fix:**
```typescript
super(`La plataforma "${platformType}" aún no está soportada. Plataformas disponibles: shopify, woocommerce, prestashop, universal`);
```

## BUG-007: keepAlive en web-lab no funciona correctamente
**Archivo:** `api-server/src/routes/web-lab.ts` línea ~50144-50149
**Problema:** El interval verifica `if (!res.writableEnded && !res.headersSent) return;` — esto es contradictorio. Si los headers NO se han enviado, hace return (no escribe). Pero si ya se enviaron, intenta escribir un espacio. El problema es que esto rompe JSON parsing si se envía un espacio antes del JSON. El cliente recibe ` {...json}` que no es JSON válido.
**Fix:** Usar streaming SSE en vez de intentar mantener viva una respuesta JSON:
```typescript
res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache");
const sendProgress = (msg: string) => {
  if (!res.writableEnded) res.write(`data: ${JSON.stringify({ progress: msg })}\n\n`);
};
// Al final:
res.write(`data: ${JSON.stringify({ done: true, result: analysis })}\n\n`);
res.end();
```
O más simple: eliminar el keepAlive y confiar en los timeouts del servidor (ya están en 10 min).

---

# 2. ⚠️ BUGS MEDIOS

## BUG-008: Deduplicación de productos usa DELETE no estándar
**Archivo:** `api-server/src/index.ts` línea ~246
**Problema:** `DELETE FROM products a USING products b` es sintaxis PostgreSQL no estándar. Si algún día se migra a otro DB, rompe. Además, no hay índice para acelerar este JOIN.
**Fix:** Está bien para Postgres, pero añadir un comentario y un check:
```typescript
// PostgreSQL-specific syntax — migrate if changing DB engine
```

## BUG-009: `shopifyProductId` se usa como campo genérico en COGs pero no es Shopify
**Archivo:** `api-server/src/routes/pricing.ts`, tabla `cogsTable`
**Problema:** El campo se llama `shopifyProductId` pero ya soportáis WooCommerce y PrestaShop. El nombre es confuso y puede causar problemas si un producto WooCommerce tiene el mismo ID numérico que uno de Shopify.
**Fix:** Renombrar a `platformProductId` en todo el schema y rutas. Requiere migración de DB:
```sql
ALTER TABLE cogs RENAME COLUMN shopify_product_id TO platform_product_id;
ALTER TABLE products RENAME COLUMN shopify_product_id TO platform_product_id;
ALTER TABLE seo_data RENAME COLUMN shopify_product_id TO platform_product_id;
```

## BUG-010: `warmupProdKnowledge` solo funciona con Shopify
**Archivo:** `api-server/src/index.ts` línea ~372-496
**Problema:** El warmup de productos usa directamente `shopifyRequestPaged` y `shopifyGraphQL`. Si el proyecto es WooCommerce o PrestaShop, el warmup falla silenciosamente y los productos nunca se sincronizan al arrancar.
**Fix:**
```typescript
import { getConnector } from "./connectors/index.js";

// En warmupProdKnowledge:
const connector = getConnector(project);
const products = await connector.getProducts({ status: "active", limit: 250 });
// ... mapear a formato interno
```

## BUG-011: psychologicalPrice genera precios ilógicos para rangos medios
**Archivo:** `api-server/src/routes/pricing.ts` línea ~32278-32288
**Problema:** Para precios entre 100-500€:
```typescript
const rounded = Math.round(price / 10) * 10;
return rounded % 50 === 0 ? rounded - 1 : rounded + 9;
```
Ejemplo: precio 135€ → rounded=140 → 140%50≠0 → return 149€ (¡subió 14€!). Precio 150€ → rounded=150 → 150%50===0 → return 149€ (bajó 1€). El algoritmo es inconsistente.
**Fix:**
```typescript
function psychologicalPrice(price: number): number {
  if (price < 10) return Math.floor(price) - 0.01 + 1; // 9.99
  if (price < 20) return Math.floor(price) + 0.95; // 14.95
  if (price < 50) return Math.round(price / 5) * 5 - 0.05; // 29.95, 34.95
  if (price < 100) return Math.round(price / 10) * 10 - 0.01; // 49.99, 79.99
  if (price < 500) return Math.round(price / 10) * 10 - 1; // 139, 199, 249
  return Math.round(price / 50) * 50 - 1; // 499, 999
}
```

## BUG-012: `escapeHtml` no importado en web-lab
**Archivo:** `api-server/src/routes/web-lab.ts` línea ~50054
**Problema:** Se usa `escapeHtml(cssUrl)` pero no hay import visible de `escapeHtml`. Si no está importado globalmente, esto crashea al analizar URLs con caracteres especiales.
**Fix:** Añadir import:
```typescript
import { escapeHtml } from "../lib/html-escape.js";
```

## BUG-013: WooCommerce connector no maneja rate limiting
**Archivo:** `api-server/src/lib/connectors/woocommerce.ts`
**Problema:** A diferencia del Shopify connector que tiene cola con backoff, WooCommerce hace requests directos sin queue. Si se sincronizan muchos productos, WooCommerce puede devolver 429 y no se reintenta.
**Fix:** Crear un `wc-queue.ts` similar a `claude-queue.ts`, o mejor, crear un queue genérico de plataforma.

---

# 3. 📝 BUGS MENORES

## BUG-014: Niche detection hardcodeada a "comics"
**Archivo:** `api-server/src/index.ts` línea ~276
```typescript
if (domain.includes("comic")) {
  niche = "comics y arte digital";
```
Esto es un residuo de desarrollo con Comic Crafter. Para clientes nuevos con dominios que contengan "comic" se les asigna niche incorrecto.
**Fix:** Eliminar este bloque y pedir el niche explícitamente en onboarding, o detectar con IA.

## BUG-015: Modelo de Claude hardcodeado como `claude-sonnet-4-5`
**Archivo:** Múltiples archivos (claude.ts, brain-ingester.ts)
**Problema:** El modelo está en texto plano en el código. Cuando Anthropic lance nuevos modelos, hay que cambiar en N sitios.
**Fix:** Centralizar:
```typescript
// lib/config.ts
export const AI_MODELS = {
  claude: process.env.CLAUDE_MODEL || "claude-sonnet-4-5",
  gemini: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  geminiPro: process.env.GEMINI_PRO_MODEL || "gemini-2.5-pro",
};
```

## BUG-016: `returnRate * returnProcessingCost` es cálculo incorrecto en COGS
**Archivo:** `api-server/src/routes/pricing.ts` línea ~32247
**Problema:** `const returns = n("returnRate") * n("returnProcessingCost")` — esto multiplica la tasa (ej: 0.08) por el coste de procesar una devolución (ej: 5€) = 0.40€. Pero debería ser el coste esperado POR UNIDAD VENDIDA. La fórmula actual es correcta matemáticamente, pero el nombre de la variable `returnProcessingCost` sugiere que es el coste total de una devolución, no el coste por unidad. Si el usuario introduce 5€ como "coste de procesar una devolución", el cálculo 0.08 * 5 = 0.40€/unidad es correcto. Pero debería incluir también el coste del producto perdido (restock, envío retorno, etc.).
**Fix mejorado:**
```typescript
const returnCostPerUnit = n("returnRate") * (
  n("returnProcessingCost") +    // Procesar la devolución
  n("returnShippingCost") +       // Envío de retorno (NUEVO CAMPO)
  n("returnRestockingCost")       // Re-stocking (NUEVO CAMPO)
);
```

---

# 4. 🧪 WEB LAB — POTENCIACIÓN A NIVEL ESTRATOSFÉRICO

El Web Lab actual es funcional pero básico. Aquí están las mejoras para hacerlo profesional de verdad:

## WL-001: Añadir investigación de marca ANTES del análisis CSS

**Estado actual:** El Web Lab recibe una URL, extrae HTML+CSS, y pide a Claude que analice y mejore.
**Problema:** Claude no sabe NADA sobre la marca, su Instagram, su audiencia, su competencia. El CSS mejorado es genérico.

**Mejora — Inyectar contexto de marca:**
```typescript
// En web-lab.ts, ANTES de llamar a Claude para análisis:

// 1. Buscar info de la marca con Gemini
const brandContext = await askGeminiWithSearch(
  `Investiga esta marca/empresa: ${url}
   Busca: 
   - Su perfil de Instagram y estilo visual
   - Sus colores de marca, tipografías, estética
   - Su sector/nicho
   - Su audiencia objetivo
   - Su competencia directa y cómo se posicionan visualmente
   - Su tono de comunicación
   Devuelve JSON: {
     brandName, instagram, followers, visualStyle,
     colorScheme, typography, sector, targetAudience,
     competitors: [{name, url, visualStyle}],
     communicationTone, luxuryLevel (1-10),
     designReferences: [urls de webs con diseño similar que funciona bien]
   }`,
  "You are a brand analyst and design researcher. Search Google for real brand info."
);

// 2. Si el usuario proporcionó Instagram, buscar directamente
if (req.body.instagram) {
  const igResearch = await askGeminiWithSearch(
    `Analiza el perfil de Instagram @${req.body.instagram}. 
     Busca: estilo visual, paleta de colores, tipo de contenido, 
     engagement, frecuencia de posts, hashtags principales, 
     estética general, filtros que usan, tipo de fotografía.`,
    "You are a social media visual analyst."
  );
}

// 3. Inyectar TODO en el prompt de Claude
const enrichedPrompt = `
CONTEXTO DE MARCA (investigado en tiempo real):
${JSON.stringify(brandContext)}

PERFIL INSTAGRAM:
${igResearch ?? "No proporcionado"}

INSTRUCCIÓN CRÍTICA: El CSS mejorado DEBE reflejar la identidad visual de esta marca.
No generes CSS genérico. El CSS debe sentirse como SI ESTA MARCA lo hubiera diseñado.
Los colores, tipografías, espaciado y estética deben ser coherentes con su Instagram,
su sector y su audiencia.

CÓDIGO HTML REAL:
${webContent.html.slice(0, 80000)}

CSS ACTUAL:
${webContent.css.slice(0, 60000)}
`;
```

## WL-002: Nuevo campo de input — Instagram / Nombre de marca
**Frontend — WebLab.tsx:**
Añadir campos opcionales en el formulario de análisis:
```tsx
<input 
  placeholder="Instagram de la marca (ej: @zara)" 
  value={instagram}
  onChange={e => setInstagram(e.target.value)}
/>
<input 
  placeholder="Nombre de la marca (ej: Zara)" 
  value={brandName}
  onChange={e => setBrandName(e.target.value)}
/>
```
Enviar al backend:
```typescript
body: JSON.stringify({ url, projectId, template, instagram, brandName })
```

## WL-003: ShopyBrain busca la marca en Google automáticamente
Si el usuario solo pone la URL, ShopyBrain debe:
1. Extraer el dominio
2. Buscar en Google: `"{dominio}" marca empresa información`
3. Buscar Instagram: `"{dominio}" instagram`
4. Buscar sector: `"{dominio}" que vende sector`
5. Usar toda esta info para contextualizar el CSS

**Implementación en web-lab.ts:**
```typescript
async function autoResearchBrand(url: string, brandName?: string, instagram?: string): Promise<BrandResearchResult> {
  const domain = new URL(url).hostname.replace("www.", "");
  const searchName = brandName || domain.replace(/\.[^.]+$/, "");
  
  const [brandInfo, igInfo, competitorDesign] = await Promise.allSettled([
    // 1. Información general de la marca
    askGeminiWithSearch(
      `Busca información completa sobre "${searchName}" (${url}):
       - Qué es, qué vende, sector/nicho
       - Público objetivo (edad, género, nivel económico)
       - Estilo de marca (luxury, streetwear, corporate, artesanal, tech...)
       - Colores que usa en su marca
       - Valores de marca
       Devuelve JSON: { name, sector, audience, style, colors: [], values: [], priceRange }`,
      "Brand research analyst. Return ONLY JSON."
    ),
    
    // 2. Instagram (si no lo dio el usuario, buscarlo)
    instagram 
      ? askGeminiWithSearch(
          `Analiza @${instagram} en Instagram: estilo visual, colores, 
           tipo de fotos, engagement, estética general.
           JSON: { handle, followers, aesthetic, colors: [], photoStyle, engagement }`,
          "Instagram visual analyst. Return ONLY JSON."
        )
      : askGeminiWithSearch(
          `Busca la cuenta oficial de Instagram de "${searchName}" (${url}).
           Si la encuentras, analiza su estilo visual.
           JSON: { handle, found: boolean, aesthetic, colors: [], photoStyle }`,
          "Social media researcher. Return ONLY JSON."
        ),
    
    // 3. Diseño de competidores del mismo sector
    askGeminiWithSearch(
      `Busca 3 competidores directos de "${searchName}" y analiza el diseño 
       de sus webs. ¿Qué patrones de diseño usan? ¿Qué colores? ¿Qué tipografías?
       JSON: { competitors: [{ name, url, designStyle, colors: [], fonts: [] }] }`,
      "Competitive design analyst. Return ONLY JSON."
    ),
  ]);
  
  return {
    brand: parseSafe(brandInfo),
    instagram: parseSafe(igInfo),
    competitorDesign: parseSafe(competitorDesign),
  };
}
```

## WL-004: CSS generado con tokens de marca inyectados
El CSS actual se genera sin variables de marca. Mejora:
```css
/* El CSS generado debe empezar SIEMPRE con tokens de marca */
:root {
  /* 🎨 Tokens de marca — ${brandName} */
  --brand-primary: ${brandColors[0] || "#2d2d2d"};
  --brand-secondary: ${brandColors[1] || "#666"};
  --brand-accent: ${brandColors[2] || "#e94560"};
  --brand-bg: ${brandBg || "#fff"};
  --brand-text: ${brandText || "#1a1a2e"};
  
  /* 📝 Tipografía de marca */
  --font-heading: ${detectedFonts.heading || "'Inter', sans-serif"};
  --font-body: ${detectedFonts.body || "'Inter', sans-serif"};
  
  /* 📐 Espaciado basado en sector */
  --space-unit: ${isLuxury ? "12px" : "8px"};
  --border-radius: ${isLuxury ? "0px" : isPlayful ? "16px" : "8px"};
}
```

## WL-005: Generación de múltiples variantes de CSS
En vez de un solo CSS, generar 3 variantes:
1. **Conservative** — Mejoras mínimas, mantiene el 90% del estilo actual
2. **Brand-aligned** — CSS completamente alineado con la identidad de marca
3. **Bold redesign** — Propuesta más atrevida con tendencias actuales

Esto permite al cliente elegir nivel de cambio.

## WL-006: Preview visual del CSS mejorado
Añadir un endpoint que sirva el HTML original con el CSS mejorado inyectado, para preview:
```typescript
router.get("/web-lab/preview/:vaultId", async (req, res) => {
  const [reportFile] = await db.select().from(projectFilesTable)
    .where(eq(projectFilesTable.id, vaultId));
  const [cssFile] = await db.select().from(projectFilesTable)
    .where(and(
      eq(projectFilesTable.projectId, reportFile.projectId),
      eq(projectFilesTable.fileType, "web-lab-css"),
    ))
    .orderBy(desc(projectFilesTable.createdAt))
    .limit(1);
  
  // Inyectar CSS en el HTML original
  const previewHtml = originalHtml.replace("</head>", 
    `<style>${cssFile.content}</style></head>`
  );
  res.setHeader("Content-Type", "text/html");
  res.send(previewHtml);
});
```

---

# 5. 💰 COGS ENGINE — CÁLCULO REAL DE COSTES

El motor de COGS actual es BUENO pero tiene gaps importantes. Aquí están las mejoras para que realmente calcule costes sin que se los digan:

## COGS-001: Pipeline de investigación de costes más profundo

**Estado actual:** 3 búsquedas paralelas con Gemini (materiales, envío, proveedores).
**Problema:** Gemini a veces devuelve datos inventados porque el prompt es demasiado genérico.

**Fix — Búsquedas más específicas y trianguladas:**
```typescript
// EN VEZ DE 3 búsquedas genéricas, hacer 8 búsquedas HIPER-ESPECÍFICAS:

const searches = await Promise.allSettled([
  // 1. Coste de materiales por tipo EXACTO de producto
  askGeminiWithSearch(
    `Busca en AliExpress y Alibaba: "${product.title}" wholesale price. 
     También busca: "${productType}" bulk price per unit.
     Necesito precios REALES con URLs. Solo datos verificables.`
  ),
  
  // 2. Envío doméstico España — tarifas ACTUALES
  askGeminiWithSearch(
    `Tarifas envío ecommerce España 2026 paquetes ${estimatedWeight}. 
     Busca: correos express ecommerce tarifas, seur paquetería tarifas, 
     nacex ecommerce, gls spain rates.
     Solo precios con fuente verificable.`
  ),
  
  // 3. Envío internacional — tarifas ACTUALES
  askGeminiWithSearch(
    `International shipping rates from Spain to Europe 2026 
     for packages ${estimatedWeight}. DHL Express, FedEx, UPS.
     Real current rates only.`
  ),
  
  // 4. Packaging ecommerce — precios REALES
  askGeminiWithSearch(
    `Comprar cajas cartón ecommerce España precio por unidad. 
     Busca en: rajapack.es, cajas.es, kartox.com, amazon.es cajas envío.
     Incluir: caja + relleno + cinta + etiqueta.`
  ),
  
  // 5. Producción/fabricación — si es producto manufacturado
  askGeminiWithSearch(
    `Coste fabricación "${productType}" en España por unidad 2026.
     Busca talleres, imprentas 3D, fabricantes textiles, 
     según el tipo de producto. MOQ y precio unitario.`
  ),
  
  // 6. Comisiones de plataforma — datos EXACTOS
  askGeminiWithSearch(
    `${platform} payment processing fees 2026. 
     Transaction fee percentage + fixed fee per transaction.
     ${platform === "shopify" ? "Shopify Payments Spain rates" : ""}
     ${platform === "woocommerce" ? "Stripe Spain fees, PayPal Spain fees" : ""}
     ${platform === "prestashop" ? "Redsys fees, Stripe Spain" : ""}`
  ),
  
  // 7. Marketing benchmark — CAC por sector
  askGeminiWithSearch(
    `Customer acquisition cost (CAC) ecommerce ${niche} Spain 2026.
     Average CPC Google Ads ${niche} España.
     Facebook Ads CPM ${niche} Spain. Average conversion rate.`
  ),
  
  // 8. Fulfillment Spain — si no hacen ellos el envío
  askGeminiWithSearch(
    `Fulfillment center Spain ecommerce prices per order 2026.
     Busca: byrd fulfillment, huboo, bezos españa, logisfashion.
     Pick and pack price per order.`
  ),
]);
```

## COGS-002: Detección automática del tipo de producto y peso
**Problema:** El sistema necesita que el producto tenga peso en Shopify. Muchos no lo tienen.
**Fix — Estimación inteligente por IA:**
```typescript
// Antes de las búsquedas de costes:
const productClassification = await askClaudeJson(projectId, 
  `Clasifica este producto para estimar sus costes de producción:
   Título: "${product.title}"
   Descripción: "${product.bodyHtml?.slice(0, 2000)}"
   Tipo: "${product.productType}"
   Vendor: "${product.vendor}"
   Precio: €${product.price}
   
   Responde JSON:
   {
     "productCategory": "physical|digital|service|subscription",
     "manufacturingMethod": "handmade|3d_printed|injection_molded|textile|assembled|wholesale_resale|dropship|print_on_demand|food|cosmetic|electronic",
     "estimatedWeight": { "value": 500, "unit": "g", "confidence": "high|medium|low" },
     "estimatedDimensions": { "length": 20, "width": 15, "height": 10, "unit": "cm" },
     "materialComposition": ["plástico ABS", "pintura acrílica"],
     "complexityLevel": "simple|medium|complex|very_complex",
     "estimatedProductionTime": "5 min|30 min|2 hours|1 day",
     "isFragile": false,
     "requiresSpecialPackaging": false,
     "shippingCategory": "standard|oversized|fragile|hazmat|cold_chain",
     "countryOfOrigin": "likely_china|likely_spain|likely_europe|unknown"
   }`,
  "You are a manufacturing and logistics expert.", 4096, 30_000
);
```

## COGS-003: Base de datos de costes conocidos por categoría
Crear una tabla `cogs_benchmarks` que se alimente con cada estimación exitosa:
```sql
CREATE TABLE cogs_benchmarks (
  id SERIAL PRIMARY KEY,
  product_category TEXT NOT NULL,
  manufacturing_method TEXT,
  niche TEXT,
  country TEXT DEFAULT 'ES',
  avg_material_cost DECIMAL(10,2),
  avg_shipping_domestic DECIMAL(10,2),
  avg_shipping_international DECIMAL(10,2),
  avg_packaging_cost DECIMAL(10,2),
  avg_fulfillment_cost DECIMAL(10,2),
  avg_platform_fee_pct DECIMAL(5,4),
  avg_return_rate DECIMAL(5,4),
  avg_cac DECIMAL(10,2),
  sample_size INTEGER DEFAULT 1,
  last_updated TIMESTAMP DEFAULT NOW(),
  sources JSONB
);
```
Cada vez que se estima un COGS con datos reales, actualizar los benchmarks:
```typescript
// Después de una estimación exitosa:
await db.insert(cogsBenchmarksTable).values({
  productCategory: classification.productCategory,
  manufacturingMethod: classification.manufacturingMethod,
  niche,
  avgMaterialCost: estimated.materialBreakdown.reduce((s, m) => s + m.costPerUnit, 0),
  avgShippingDomestic: estimated.shippingBreakdown[0]?.domestic ?? 0,
  // ...
}).onConflictDoUpdate({
  target: [cogsBenchmarksTable.productCategory, cogsBenchmarksTable.manufacturingMethod, cogsBenchmarksTable.niche],
  set: {
    avgMaterialCost: sql`(${cogsBenchmarksTable.avgMaterialCost} * ${cogsBenchmarksTable.sampleSize} + ${newCost}) / (${cogsBenchmarksTable.sampleSize} + 1)`,
    sampleSize: sql`${cogsBenchmarksTable.sampleSize} + 1`,
  },
});
```

## COGS-004: Tarifas de envío por defecto actualizadas automáticamente
Crear un cron job semanal que actualice las tarifas de envío con Gemini:
```typescript
// En scheduler.ts:
cron.schedule("0 3 * * 1", async () => { // Cada lunes a las 3am
  const carriers = ["correos_express", "seur", "mrw", "nacex", "gls", "dhl"];
  for (const carrier of carriers) {
    const rates = await askGeminiWithSearch(
      `Current ${carrier} ecommerce shipping rates Spain 2026. 
       Domestic small package (0-2kg), medium (2-5kg), large (5-15kg).
       Return only JSON with verified prices.`
    );
    await db.insert(shippingRatesTable).values({
      carrier,
      rates: parseSafe(rates),
      updatedAt: new Date(),
    }).onConflictDoUpdate({ target: [shippingRatesTable.carrier], set: { rates: parseSafe(rates), updatedAt: new Date() } });
  }
});
```

---

# 6. 🌐 MULTI-PLATAFORMA — WooCommerce, PrestaShop, Universal

## MP-001: El conector factory tiene un bug en el switch
**Archivo:** `api-server/src/connectors/index.ts` y `api-server/src/lib/connectors/index.ts`
**Problema:** Hay DOS archivos `connectors/index.ts` que hacen lo mismo pero con código diferente. El de `src/connectors/` no importa `UniversalAuditConnector`. El de `src/lib/connectors/` sí.
**Fix:** Eliminar el archivo duplicado `src/connectors/index.ts` y que todas las rutas importen desde `src/lib/connectors/index.ts`.

## MP-002: Rutas hardcodeadas para Shopify que necesitan ser multi-plataforma
Las siguientes rutas llaman directamente a funciones de Shopify en vez de usar el conector:

| Ruta | Archivo | Función Shopify directa |
|------|---------|------------------------|
| `/products/:id/sync` | products.ts | `shopifyRequestPaged()` |
| `/projects/:id/scan` | products.ts | `shopifyRequestPaged()` + `shopifyGraphQL()` |
| `/pricing/apply-price` | pricing.ts | `shopifyRequest()` |
| `warmupProdKnowledge` | index.ts | `shopifyRequestPaged()` + `shopifyGraphQL()` |
| `/seo/apply` | seo.ts | `shopifyGraphQL()` |
| `/store/status` | store.ts | `shopifyRequest()` |

**Fix para cada una:** Reemplazar la llamada directa a Shopify por el conector:
```typescript
// Patrón genérico:
import { getConnector } from "../lib/connectors/index.js";

const connector = getConnector(project);
if (connector.supportsFeature("products")) {
  const products = await connector.getProducts({ status: "active" });
}
```

## MP-003: WooCommerce SEO — falta integración con Yoast/RankMath
**Archivo:** `woocommerce.ts` — `getSeoData` y `updateSeo`
**Estado actual:** Lee SEO de `yoast_head_json` pero no implementa escritura via la API de Yoast.
**Fix:**
```typescript
async updateSeo(platformProductId: string, data: Partial<SeoData>): Promise<SeoData> {
  // WooCommerce + Yoast: usar meta fields
  const metaPayload: Record<string, string> = {};
  if (data.metaTitle) metaPayload["yoast_wpseo_title"] = data.metaTitle;
  if (data.metaDescription) metaPayload["yoast_wpseo_metadesc"] = data.metaDescription;
  if (data.focusKeyword) metaPayload["yoast_wpseo_focuskw"] = data.focusKeyword;
  
  // Update via WC REST API meta_data
  await this.wcRequest("PUT", `/products/${platformProductId}`, {
    meta_data: Object.entries(metaPayload).map(([key, value]) => ({ key, value })),
    slug: data.handle || undefined,
  });
  
  return { metaTitle: data.metaTitle || "", metaDescription: data.metaDescription || "" };
}
```

## MP-004: PrestaShop — falta en el router de conectores principal
**Archivo:** `api-server/src/connectors/index.ts`
**Problema:** El switch no tiene case para "prestashop" pero SÍ existe el conector.
**Fix:**
```typescript
case "prestashop":
  const { PrestaShopConnector } = await import("../lib/connectors/prestashop.js");
  return new PrestaShopConnector(project);
```

## MP-005: Formulario NewProject necesita campo platformType
**Archivo:** `pages/NewProject.tsx`
**Problema:** El frontend para crear proyectos necesita un selector de plataforma visible.
**Fix:** Añadir un selector:
```tsx
<select value={platformType} onChange={e => setPlatformType(e.target.value)}>
  <option value="shopify">Shopify</option>
  <option value="woocommerce">WooCommerce</option>
  <option value="prestashop">PrestaShop</option>
  <option value="universal">Auditoría Universal (cualquier web)</option>
</select>
```
Y adaptar los campos de conexión según la plataforma:
- **Shopify:** Domain + Access Token
- **WooCommerce:** URL + Consumer Key + Consumer Secret
- **PrestaShop:** URL + API Key
- **Universal:** Solo URL

---

# 7. 🔬 ENTITY RESEARCH — Potenciación

## ER-001: Investigación debe buscar Instagram proactivamente
**Estado actual:** Si le das un nombre, busca en Google. Pero no busca ESPECÍFICAMENTE el Instagram.
**Fix — Añadir dimensión de Instagram dedicada:**
```typescript
// En deepEntityResearch (gemini.ts), añadir a las 12 búsquedas paralelas:
{
  label: "instagram_deep",
  query: `${entity} Instagram official account. 
          Find: exact handle, followers count, posting frequency, 
          type of content, visual aesthetic, engagement rate, 
          top hashtags, story highlights themes.`,
  system: "You are a social media analyst."
},
{
  label: "tiktok_deep", 
  query: `${entity} TikTok official account. 
          Find: handle, followers, content style, viral videos, 
          posting strategy.`,
  system: "You are a social media analyst."
},
```

## ER-002: Guardar perfil completo de marca en tabla dedicada
**Estado actual:** Todo se guarda como "memorias" genéricas en `omnicoreMemoriesTable`.
**Problema:** No hay forma fácil de recuperar el perfil completo de una entidad.
**Fix — Tabla `entity_profiles`:**
```sql
CREATE TABLE entity_profiles (
  id TEXT PRIMARY KEY,
  entity_name TEXT NOT NULL,
  entity_url TEXT,
  sector TEXT,
  sub_sector TEXT,
  target_audience JSONB,
  -- Social
  instagram_handle TEXT,
  instagram_followers INTEGER,
  instagram_aesthetic TEXT,
  tiktok_handle TEXT,
  twitter_handle TEXT,
  facebook_page TEXT,
  youtube_channel TEXT,
  linkedin_page TEXT,
  -- Brand
  brand_colors JSONB,
  typography_style TEXT,
  visual_aesthetic TEXT,
  tone_of_voice TEXT,
  brand_values JSONB,
  -- Business
  price_range TEXT,
  product_count_estimate INTEGER,
  estimated_revenue TEXT,
  market_position TEXT,
  ecommerce_platform TEXT,
  -- Competitive
  main_competitors JSONB,
  strengths JSONB,
  weaknesses JSONB,
  opportunities JSONB,
  -- Metadata
  research_depth TEXT, -- quick | full | deep
  last_researched_at TIMESTAMP,
  confidence_score DECIMAL(3,2),
  sources JSONB,
  full_report TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## ER-003: Auto-refresh de entidades investigadas
Si una entidad fue investigada hace más de 30 días, re-investigar automáticamente las dimensiones que cambian rápido (social, precios, noticias):
```typescript
// En scheduler.ts:
cron.schedule("0 4 * * 3", async () => { // Miércoles 4am
  const staleEntities = await db.select().from(entityProfilesTable)
    .where(sql`last_researched_at < NOW() - INTERVAL '30 days'`)
    .limit(5);
  
  for (const entity of staleEntities) {
    await quickRefreshEntity(entity.entityName, entity.entityUrl);
  }
});
```

---

# 8. 📊 AUDITORÍA UNIVERSAL — Para cualquier empresa

## AU-001: El `UniversalAuditConnector` es demasiado limitado
**Estado actual:** Solo hace HEAD request + scraping + PageSpeed.
**Mejora — Auditoría completa multi-dimensión:**
```typescript
async runFullAudit(): Promise<FullAuditResult> {
  const url = this.getUrl();
  
  const [scraping, pageSpeed, entityResearch, webLabAnalysis] = 
    await Promise.allSettled([
      // 1. Scraping técnico (ya existe)
      scrapeWebsite(url),
      
      // 2. PageSpeed (ya existe)
      runDualPageSpeed(url),
      
      // 3. NUEVO: Investigación de entidad
      deepEntityResearch(this.storeDomain),
      
      // 4. NUEVO: Análisis de diseño web (Web Lab lite)
      this.runDesignAudit(url),
      
      // 5. NUEVO: Análisis SEO profundo
      this.runSeoAudit(url),
      
      // 6. NUEVO: Análisis de competencia
      this.runCompetitorAudit(url),
      
      // 7. NUEVO: Análisis de accesibilidad
      this.runAccessibilityAudit(url),
      
      // 8. NUEVO: Análisis de seguridad básico
      this.runSecurityAudit(url),
    ]);
    
  return { /* ... todas las dimensiones */ };
}
```

## AU-002: Informe de auditoría descargable como PDF profesional
Para cualquier web/marca, generar un informe PDF con:
- Portada con logo de ShopyCrafter
- Resumen ejecutivo (score global + áreas)
- Análisis de diseño/UX
- Análisis SEO
- Análisis de rendimiento (PageSpeed)
- Análisis de marca (si se investigó)
- Competencia
- Recomendaciones priorizadas
- Presupuesto estimado para implementar las mejoras

---

# 9. 🧠 SHOPY BRAIN — Potenciación

## SB-001: Contexto de ShopyBrain es demasiado grande y lento
**Problema:** `buildShopyBrainContext` carga TODAS las memorias, insights, prompts, contenido absorbido, visual DNA. Esto puede ser 50,000+ caracteres inyectados en CADA prompt de Claude. Gasta tokens innecesariamente.
**Fix — Contexto inteligente por relevancia:**
```typescript
// En vez de cargar todo, usar embeddings o keyword matching para seleccionar
// solo las memorias RELEVANTES al task actual:
async function buildSmartContext(
  query: string, 
  useCase: string, 
  niche?: string,
  maxChars = 8000
): Promise<string> {
  // 1. Extraer keywords del query actual
  const keywords = extractKeywords(query);
  
  // 2. Buscar solo memorias relevantes (con scoring)
  const relevantMemories = await db.select()
    .from(omnicoreMemoriesTable)
    .where(sql`
      to_tsvector('spanish', content || ' ' || title) 
      @@ to_tsquery('spanish', ${keywords.join(' & ')})
    `)
    .orderBy(desc(omnicoreMemoriesTable.confidence))
    .limit(10);
  
  // 3. Construir contexto compacto
  let context = "";
  for (const m of relevantMemories) {
    const chunk = `[${m.memoryType}] ${m.title}: ${m.content?.slice(0, 500)}\n`;
    if ((context + chunk).length > maxChars) break;
    context += chunk;
  }
  
  return context;
}
```

## SB-002: Modelo Claude debería ser configurable por tipo de tarea
No todas las tareas necesitan el mismo modelo:
```typescript
const MODEL_BY_TASK: Record<string, string> = {
  // Tareas simples → Haiku (barato y rápido)
  "extract_insights": "claude-haiku-4-5-20251001",
  "classify_product": "claude-haiku-4-5-20251001",
  "simple_qa": "claude-haiku-4-5-20251001",
  
  // Tareas medias → Sonnet
  "redesign": "claude-sonnet-4-5",
  "seo_optimization": "claude-sonnet-4-5",
  "email_generation": "claude-sonnet-4-5",
  
  // Tareas complejas → Opus (si disponible) o Sonnet
  "financial_analysis": "claude-sonnet-4-5",
  "entity_synthesis": "claude-sonnet-4-5",
  "brand_strategy": "claude-sonnet-4-5",
};
```

---

# 10. 🔒 SEGURIDAD

## SEC-001: SSRF en web-lab y web-scraper
**Archivo:** `web-lab.ts`, `web-scraper.ts`
**Problema:** `extractFullWebContent` permite fetchear cualquier URL incluyendo IPs internas (127.0.0.1, 10.x.x.x, 192.168.x.x). Un atacante podría usar el Web Lab para escanear la red interna.
**Fix:** Ya existe `validateUrlWithDnsCheck` — verificar que se usa en TODOS los puntos de fetch y que bloquea IPs privadas:
```typescript
function isPrivateIP(ip: string): boolean {
  return /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.0\.0\.0|localhost|::1)/.test(ip);
}
```

## SEC-002: No hay validación de input en `askClaudeJson` JSON parsing
**Archivo:** `claude.ts` línea ~1101
**Problema:** `JSON.parse(text)` sin try-catch externo. Si Claude devuelve JSON malformado, la app crashea.
**Fix:** Ya hay match con regex, pero el fallback `JSON.parse(text)` debería estar en try-catch.

## SEC-003: Rate limiting se salta en development
**Archivo:** `app.ts` — todos los limiters tienen `skip: (req) => process.env.NODE_ENV !== "production"`
**Problema:** En Replit, `NODE_ENV` puede no estar seteado, lo que significa que el rate limiting podría estar deshabilitado en producción.
**Fix:**
```typescript
skip: (req) => process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test",
```

---

# 11. ⚡ RENDIMIENTO

## PERF-001: `buildShopyBrainContext` hace 7+ queries a DB en CADA request
Cachear el contexto por 60 segundos:
```typescript
const brainContextCache = new Map<string, { value: string; ts: number }>();

async function buildShopyBrainContext(niche, useCase, query, platform) {
  const cacheKey = `${niche}-${useCase}-${platform}`;
  const cached = brainContextCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 60_000) return cached.value;
  
  // ... build context
  brainContextCache.set(cacheKey, { value: context, ts: Date.now() });
  return context;
}
```

## PERF-002: Warmup hace demasiadas operaciones al arrancar
El servidor tarda mucho en arrancar porque hace warmup de productos + knowledge + revenue. Mover a background después de que el servidor esté healthy:
```typescript
// En index.ts, después de listen:
server.on("listening", () => {
  // Responder a health checks inmediatamente
  // Warmup en background con delay
  setTimeout(() => warmupProdKnowledge(), 10_000);
});
```

## PERF-003: Compression ya está activada pero faltan headers de cache para assets estáticos
```typescript
app.use("/assets", express.static(assetsDir, {
  maxAge: "7d",
  etag: true,
  lastModified: true,
}));
```

---

# 12. 🏗️ ARQUITECTURA

## ARCH-001: Duplicación de connectors index
Hay DOS `connectors/index.ts`:
- `src/connectors/index.ts`
- `src/lib/connectors/index.ts`

Eliminar `src/connectors/` y consolidar en `src/lib/connectors/`.

## ARCH-002: Tipos de plataforma inconsistentes
En algunos sitios se usa `"shopify"` como string literal, en otros viene de un tipo union. Consolidar:
```typescript
// En @workspace/db o tipos compartidos:
export type PlatformType = "shopify" | "woocommerce" | "prestashop" | "universal";
export const SUPPORTED_PLATFORMS: PlatformType[] = ["shopify", "woocommerce", "prestashop", "universal"];
```

## ARCH-003: Rutas demasiado grandes
`shopybrain.ts` es ENORME (5000+ líneas con todo el chatbot). Dividir en:
- `shopybrain-router.ts` — rutas Express
- `shopybrain-actions.ts` — lógica de acciones
- `shopybrain-prompts.ts` — prompts del sistema
- `shopybrain-pricing.ts` — conocimiento de precios/servicios

---

# 13. 🚀 NUEVAS FUNCIONALIDADES PARA NIVEL ESTRATOSFÉRICO

## NEW-001: Dashboard de Auditoría Visual (antes/después)
Crear una página que muestre:
- Screenshot de la web original (via Puppeteer o API de screenshot)
- Preview con CSS mejorado lado a lado
- Diff visual de colores, tipografías, espaciado
- Score de mejora: "Tu web mejoraría un 34% en UX"

## NEW-002: Auto-COGS para TODO el catálogo
Botón "Estimar COGS de todos mis productos" que:
1. Clasifica todos los productos por categoría
2. Busca costes por categoría (no por producto individual — más eficiente)
3. Aplica costes base por categoría + ajustes por producto
4. Genera un dashboard de márgenes de todo el catálogo

## NEW-003: Widget embebible "Audit Score"
Un badge que el cliente puede poner en su web:
```html
<script src="https://shopycrafter.com/widget/audit-badge.js" 
        data-store="mitienda.com" data-score="87"></script>
```
Muestra: "Optimizado por ShopyCrafter — Score: 87/100 ⭐"

## NEW-004: Alertas de precio de competidores
Monitoring semanal de precios de competidores con alertas:
- "Tu competidor X bajó el precio de Y un 15%"
- "Nuevo producto detectado en competidor Z"

## NEW-005: Generador de propuestas comerciales con datos de auditoría
Cuando se hace una auditoría de una marca, generar automáticamente:
- Una propuesta comercial personalizada
- Con los problemas detectados
- Con el presupuesto de ShopyCrafter para solucionarlos
- Con ROI estimado

## NEW-006: API pública para clientes
Permitir a los clientes acceder a sus datos via API:
- `GET /api/v1/audit/score` — Score actual
- `GET /api/v1/products/health` — Salud del catálogo
- `GET /api/v1/pricing/margins` — Márgenes
- `GET /api/v1/seo/report` — Estado SEO

## NEW-007: Modo "Agency" — multi-cliente
Dashboard donde ShopyCrafter gestiona múltiples tiendas de clientes diferentes, con:
- Vista consolidada de todos los clientes
- Alertas por cliente
- Facturación por cliente
- Templates reutilizables entre clientes

## NEW-008: Integración con Google Search Console y Google Analytics
Para datos REALES de tráfico y SEO, no estimaciones de Gemini:
```typescript
// Conectar via OAuth2
router.post("/projects/:id/connect-gsc", async (req, res) => {
  // Google Search Console API
  // Datos: impresiones, clicks, CTR, posición media por keyword
});

router.post("/projects/:id/connect-ga4", async (req, res) => {
  // Google Analytics 4 API
  // Datos: sesiones, bounce rate, conversiones, revenue real
});
```

---

# RESUMEN DE PRIORIDADES

## 🔴 URGENTE (hacer primero):
1. BUG-001: Contraseña hardcodeada
2. BUG-003: apply-price solo Shopify
3. BUG-005: endpoint research-entity vacío
4. BUG-007: keepAlive rompe JSON en web-lab
5. SEC-003: Rate limiting deshabilitado en prod

## 🟡 IMPORTANTE (hacer en sprint 2):
1. MP-002: Rutas hardcodeadas para Shopify
2. COGS-001: Pipeline de investigación mejorado
3. WL-001: Investigación de marca en Web Lab
4. BUG-009: Renombrar shopifyProductId
5. BUG-010: Warmup multi-plataforma

## 🟢 MEJORA (hacer en sprint 3):
1. WL-002 a WL-006: Potenciación completa Web Lab
2. COGS-002 a COGS-004: Motor COGS estratosférico
3. ER-001 a ER-003: Entity Research mejorado
4. NEW-001 a NEW-008: Nuevas funcionalidades

## 🔵 NICE-TO-HAVE (futuro):
1. ARCH-001 a ARCH-003: Refactoring arquitectónico
2. PERF-001 a PERF-003: Optimizaciones
3. SB-001 a SB-002: ShopyBrain optimizado

---

*Auditoría realizada analizando los 176 archivos del codebase completo.
Cada bug y mejora incluye el archivo exacto, la línea aproximada, y el código de fix.*
*Este documento está listo para ser compartido con Replit como guía de implementación.*
