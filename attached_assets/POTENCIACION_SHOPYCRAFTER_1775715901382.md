# ⚡ SHOPY CRAFTER — POTENCIACIÓN ESTRATOSFÉRICA
## Documento de implementación para Replit
## Cada módulo potenciado al 100% con código listo para implantar
## REGLA DE ORO: No romper nada existente — solo AMPLIAR y MEJORAR

---

# FILOSOFÍA: SHOPY BRAIN COMO ORQUESTADOR CENTRAL

ShopyBrain no es solo un chatbot — es el CEREBRO CENTRAL que:
1. **APRENDE** de cada operación que pasa por la plataforma
2. **CONECTA** conocimiento entre dominios (pricing aprende de SEO, SEO aprende de competidores)
3. **PREDICE** necesidades del usuario antes de que pregunte
4. **MEJORA** exponencialmente con cada interacción

Cada mejora que se implemente debe seguir el patrón:
```
ACCIÓN → RESULTADO → APRENDIZAJE → MEMORIA → MEJORES FUTURAS ACCIONES
```

---

# MÓDULO 1: SHOPY BRAIN — CEREBRO EXPONENCIAL

## 1.1 Nuevo sistema de aprendizaje continuo por CADA operación

Actualmente `learnFromOperation` guarda texto plano. Necesita guardar DATOS ESTRUCTURADOS que se puedan consultar y reutilizar.

### Archivo a modificar: `api-server/src/lib/claude.ts`

Buscar la función `learnFromOperation` y REEMPLAZAR con esta versión potenciada. NO borrar la función actual, solo expandirla:

```typescript
/**
 * learnFromOperation v2 — ENHANCED: Guarda datos estructurados + extrae patrones automáticamente.
 * Compatibilidad total con v1 — mismos parámetros, más potencia.
 */
export function learnFromOperation(params: {
  operationType: string;
  niche?: string | null;
  productType?: string | null;
  title: string;
  content: string;
  confidence?: number;
  tags?: string[];
  // NUEVOS campos opcionales (v2):
  structuredData?: Record<string, unknown>;
  sourceProjectId?: number;
  relatedProductId?: string;
  monetaryValues?: { revenue?: number; cost?: number; margin?: number; price?: number };
  metrics?: Record<string, number>;
}): void {
  const {
    operationType, niche, productType, title, content,
    confidence = 0.7, tags = [],
    structuredData, sourceProjectId, relatedProductId, monetaryValues, metrics,
  } = params;

  const memTypeMap: Record<string, string> = {
    redesign: "prompt_template",
    seo: "niche_keyword",
    seo_meta: "niche_keyword",
    seo_keywords: "niche_keyword",
    seo_blog: "niche_keyword",
    seo_audit: "niche_keyword",
    pricing: "pricing_pattern",
    pricing_analysis: "pricing_pattern",
    price_simulation: "pricing_pattern",
    price_elasticity: "pricing_pattern",
    financial_forecast: "pricing_pattern",
    cogs_estimation: "pricing_pattern",
    images: "image_pattern",
    image_generation: "image_pattern",
    alt_text: "image_pattern",
    ab_winner: "ab_insight",
    ab_test: "ab_insight",
    consistency: "image_pattern",
    product_copy: "prompt_template",
    product_creation: "prompt_template",
    catalog_analysis: "general",
    email_flow: "prompt_template",
    email_content: "prompt_template",
    competitor_analysis: "competitor_intel",
    competitor_scan: "competitor_intel",
    entity_research: "competitor_intel",
    web_lab_design_analysis: "design_pattern",
    web_lab_css_patterns: "design_pattern",
    web_lab_ux_insights: "design_pattern",
    brand_css: "design_pattern",
    brand_kit: "design_pattern",
    theme_edit: "general",
    inventory_analysis: "general",
    supplier_research: "pricing_pattern",
    agency_proposal: "general",
    agency_quote: "general",
  };

  const resolvedMemType = memTypeMap[operationType] ?? "general";
  const resolvedTitle = title.slice(0, 200);
  const allTags = [...new Set([...tags, operationType, niche ?? "", productType ?? ""].filter(Boolean))];

  // 1. Guardar memoria principal (como antes, pero con datos estructurados)
  db.insert(omnicoreMemoriesTable).values({
    id: randomBytes(16).toString("hex"),
    memoryType: resolvedMemType,
    niche: niche ?? null,
    productType: productType ?? null,
    market: "es",
    title: resolvedTitle,
    content: content.slice(0, 15000),
    confidence,
    sourceType: `learn_${operationType}`,
    tags: JSON.stringify(allTags),
    isVerified: 0,
    useCount: 1,
    successCount: 1,
    successRate: 0.8,
  }).catch(() => {});

  // 2. NUEVO: Si hay datos monetarios, guardar en tabla de pricing intelligence
  if (monetaryValues && Object.keys(monetaryValues).length > 0) {
    db.execute(sql`
      INSERT INTO pricing_intelligence (id, niche, product_type, operation_type, 
        revenue, cost, margin, price, created_at)
      VALUES (${randomBytes(8).toString("hex")}, ${niche}, ${productType}, 
        ${operationType}, ${monetaryValues.revenue ?? null}, ${monetaryValues.cost ?? null},
        ${monetaryValues.margin ?? null}, ${monetaryValues.price ?? null}, NOW())
      ON CONFLICT DO NOTHING
    `).catch(() => {});
  }

  // 3. NUEVO: Detectar cross-connections automáticamente
  // Si una operación de pricing menciona keywords de SEO, crear conexión
  detectAndSaveCrossConnections(operationType, content, niche, allTags).catch(() => {});
}

async function detectAndSaveCrossConnections(
  operationType: string, content: string, niche: string | null, tags: string[]
): Promise<void> {
  const domainKeywords: Record<string, RegExp> = {
    pricing: /precio|margen|cogs|revenue|profit|coste|€|\$|margin|break.?even/i,
    seo: /seo|keyword|meta|title|description|schema|google|ranking|tráfico/i,
    design: /css|diseño|color|tipograf|layout|responsive|ux|ui|accesib/i,
    marketing: /email|campaña|engagement|conversión|funnel|cta|newsletter/i,
    competitor: /competidor|competencia|rival|mercado|benchmark|amenaza/i,
    inventory: /stock|inventario|unidades|agotad|restock|almacén/i,
  };

  const detectedDomains: string[] = [];
  for (const [domain, regex] of Object.entries(domainKeywords)) {
    if (regex.test(content)) detectedDomains.push(domain);
  }

  // Si la operación toca 2+ dominios, guardar cross-connection
  if (detectedDomains.length >= 2) {
    const connectionTitle = `Cross-domain: ${detectedDomains.join(" ↔ ")} [${operationType}]`;
    const connectionContent = `Operación "${operationType}" en nicho "${niche}" conecta conocimiento de: ${detectedDomains.join(", ")}. Contexto: ${content.slice(0, 500)}`;

    await db.insert(omnicoreCrossConnectionsTable).values({
      id: randomBytes(12).toString("hex"),
      domainA: detectedDomains[0],
      domainB: detectedDomains[1],
      connectionType: "auto_detected",
      strength: Math.min(0.9, 0.5 + (detectedDomains.length * 0.1)),
      insight: connectionContent.slice(0, 1000),
      evidence: `Detectado en operación ${operationType}`,
      discoveredAt: new Date(),
    }).catch(() => {});
  }
}
```

## 1.2 Contexto inteligente por relevancia (no cargar TODO)

### Archivo a modificar: `api-server/src/lib/claude.ts`

Buscar la función `buildShopyBrainContext` — NO reemplazar, añadir una función alternativa más eficiente y usarla en las funciones `askClaudeWithBrain` y `askClaudeJsonWithBrain`:

```typescript
/**
 * buildSmartBrainContext — Versión optimizada que solo carga memorias RELEVANTES.
 * Usa full-text search de PostgreSQL para encontrar las memorias más relevantes
 * al query actual, en vez de cargar todas y filtrar en JS.
 */
export async function buildSmartBrainContext(
  query: string,
  useCase: string,
  niche?: string | null,
  platformType?: string,
  maxChars = 12000,
): Promise<string> {
  try {
    // Extraer keywords del query actual para búsqueda relevante
    const keywords = query
      .toLowerCase()
      .replace(/[^\wáéíóúñü\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 8);

    if (keywords.length === 0) {
      // Fallback a la versión original si no hay keywords
      return buildShopyBrainContext(niche ?? undefined, useCase, query, platformType);
    }

    const searchTerms = keywords.join(" | ");

    // 1. Buscar memorias relevantes por contenido (full-text search)
    const relevantMemories = await db.execute(sql`
      SELECT title, content, memory_type, niche, confidence, 
             ts_rank(to_tsvector('spanish', coalesce(title,'') || ' ' || coalesce(content,'')), 
                     to_tsquery('spanish', ${searchTerms})) as rank
      FROM omnicore_memories 
      WHERE to_tsvector('spanish', coalesce(title,'') || ' ' || coalesce(content,'')) 
            @@ to_tsquery('spanish', ${searchTerms})
      ORDER BY rank DESC, confidence DESC
      LIMIT 15
    `).catch(() => ({ rows: [] }));

    // 2. Buscar insights relevantes
    const relevantInsights = await db.execute(sql`
      SELECT title, insight, domain, confidence, impact_score
      FROM omnicore_insights
      WHERE to_tsvector('spanish', coalesce(title,'') || ' ' || coalesce(insight,''))
            @@ to_tsquery('spanish', ${searchTerms})
      ORDER BY impact_score DESC, confidence DESC
      LIMIT 8
    `).catch(() => ({ rows: [] }));

    // 3. Si hay nicho, buscar memorias específicas del nicho
    const nicheMemories = niche ? await db.select()
      .from(omnicoreMemoriesTable)
      .where(sql`lower(${omnicoreMemoriesTable.niche}) LIKE ${'%' + niche.toLowerCase() + '%'}`)
      .orderBy(desc(omnicoreMemoriesTable.confidence))
      .limit(5) : [];

    // 4. Construir contexto compacto y relevante
    const lines: string[] = ["━━━ SHOPY BRAIN — CONTEXTO RELEVANTE ━━━"];

    // Plataforma
    if (platformType && platformType !== "shopify") {
      const platformNotes: Record<string, string> = {
        woocommerce: "Plataforma: WooCommerce. API: WC REST v3, Basic Auth. SEO: Yoast/RankMath. Status: publish/draft/private.",
        prestashop: "Plataforma: PrestaShop. API: Webservice XML/JSON. SEO: URL amigables + meta tags nativos. Stock: stock_availables.",
        universal: "Plataforma: Auditoría Universal (web genérica). Sin gestión de productos — solo análisis SEO, diseño, PageSpeed.",
      };
      if (platformNotes[platformType]) lines.push(`🔧 ${platformNotes[platformType]}`);
    }

    // Memorias relevantes (las más útiles para este query)
    let charCount = 0;
    const memRows = (relevantMemories as any).rows ?? [];
    if (memRows.length > 0) {
      lines.push("\n🧠 Conocimiento relevante:");
      for (const m of memRows) {
        const chunk = `  [${m.memory_type}] ${m.title}: ${(m.content ?? "").slice(0, 800)}`;
        if (charCount + chunk.length > maxChars * 0.6) break;
        lines.push(chunk);
        charCount += chunk.length;
      }
    }

    // Insights relevantes
    const insRows = (relevantInsights as any).rows ?? [];
    if (insRows.length > 0) {
      lines.push("\n💡 Insights aplicables:");
      for (const ins of insRows) {
        const chunk = `  [${ins.domain}] ${ins.title}: ${ins.insight} (confianza: ${ins.confidence})`;
        if (charCount + chunk.length > maxChars * 0.8) break;
        lines.push(chunk);
        charCount += chunk.length;
      }
    }

    // Memorias de nicho
    if (nicheMemories.length > 0) {
      lines.push(`\n📌 Conocimiento del nicho "${niche}":`);
      for (const m of nicheMemories.slice(0, 3)) {
        const chunk = `  ${m.title}: ${(m.content ?? "").slice(0, 500)}`;
        if (charCount + chunk.length > maxChars) break;
        lines.push(chunk);
        charCount += chunk.length;
      }
    }

    lines.push("━━━ FIN CONTEXTO RELEVANTE ━━━");
    return lines.join("\n");
  } catch {
    // Fallback silencioso a función original
    return buildShopyBrainContext(niche ?? undefined, useCase, query, platformType);
  }
}
```

Ahora, en `askClaudeWithBrain`, cambiar la llamada para usar `buildSmartBrainContext`:

```typescript
// En askClaudeWithBrain, REEMPLAZAR:
const [brainContext, brandDna] = await Promise.all([
  buildShopyBrainContext(niche, useCase, lastUserMsg, platform),
  buildBrandDnaContext(projectId),
]);

// POR:
const [brainContext, brandDna] = await Promise.all([
  buildSmartBrainContext(lastUserMsg ?? "", useCase, niche, platform),
  buildBrandDnaContext(projectId),
]);
```

Hacer lo mismo en `askClaudeJsonWithBrain`.

## 1.3 Auto-study mejorado — El cerebro estudia TEMAS NUEVOS cada día

### Archivo a modificar: `api-server/src/lib/scheduler.ts`

Buscar la función `runOmniCoreDailyDeepStudy`. Dentro del array `ALL_DOMAINS` ya existen 30+ dominios. El problema es que el estudio es genérico. AÑADIR después de la función actual esta nueva función:

```typescript
/**
 * runAdaptiveStudy — Estudia temas BASADOS en lo que los usuarios están preguntando.
 * Analiza las últimas 24h de actividad y estudia los gaps de conocimiento detectados.
 */
export async function runAdaptiveStudy(): Promise<void> {
  log("adaptive-study", "🎓 Starting adaptive study based on recent user activity");

  try {
    // 1. Analizar las últimas memorias guardadas para detectar gaps
    const recentMemories = await db.select({
      memoryType: omnicoreMemoriesTable.memoryType,
      niche: omnicoreMemoriesTable.niche,
      content: omnicoreMemoriesTable.content,
    })
    .from(omnicoreMemoriesTable)
    .where(gte(omnicoreMemoriesTable.createdAt, new Date(Date.now() - 48 * 60 * 60 * 1000)))
    .orderBy(desc(omnicoreMemoriesTable.createdAt))
    .limit(30);

    if (recentMemories.length === 0) {
      log("adaptive-study", "No recent activity — studying trending ecommerce topics instead");
      // Estudiar tendencias si no hay actividad
      const trendingResult = await askGeminiWithSearch(
        `What are the top 5 ecommerce trends and strategies being discussed THIS WEEK in 2026?
         Include: new tools, pricing strategies, marketing tactics, platform updates, AI in ecommerce.
         For EACH trend, explain: what it is, why it matters, how to implement it, expected impact.
         Be specific with real data, examples, and actionable advice.`,
        "You are a cutting-edge ecommerce research analyst. Search for the LATEST information."
      );
      
      if (trendingResult?.text) {
        await db.insert(omnicoreMemoriesTable).values({
          id: randomBytes(16).toString("hex"),
          memoryType: "trending_knowledge",
          title: `Tendencias ecommerce semana ${new Date().toISOString().slice(0, 10)}`,
          content: trendingResult.text.slice(0, 10000),
          confidence: 0.85,
          sourceType: "adaptive_study_trending",
          tags: JSON.stringify(["trending", "ecommerce", "2026"]),
          isVerified: 0,
        }).catch(() => {});
      }
      return;
    }

    // 2. Extraer los temas y nichos que más se han trabajado
    const nicheCount: Record<string, number> = {};
    const typeCount: Record<string, number> = {};
    const contentKeywords: string[] = [];
    
    for (const m of recentMemories) {
      if (m.niche) nicheCount[m.niche] = (nicheCount[m.niche] ?? 0) + 1;
      if (m.memoryType) typeCount[m.memoryType] = (typeCount[m.memoryType] ?? 0) + 1;
      // Extraer keywords del contenido
      const words = (m.content ?? "").toLowerCase().match(/\b[a-záéíóúñü]{5,}\b/g) ?? [];
      contentKeywords.push(...words.slice(0, 20));
    }

    const topNiches = Object.entries(nicheCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const topTypes = Object.entries(typeCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
    
    // Frecuencia de keywords para detectar temas recurrentes
    const kwFreq: Record<string, number> = {};
    for (const kw of contentKeywords) {
      kwFreq[kw] = (kwFreq[kw] ?? 0) + 1;
    }
    const topKeywords = Object.entries(kwFreq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(e => e[0]);

    log("adaptive-study", `Top niches: ${topNiches.map(n => n[0]).join(", ")}. Top types: ${topTypes.map(t => t[0]).join(", ")}. Keywords: ${topKeywords.join(", ")}`);

    // 3. Para cada nicho activo, estudiar en profundidad
    for (const [niche] of topNiches) {
      const studyPrompt = `Eres un experto en ecommerce y negocios. Investiga las ÚLTIMAS tendencias, estrategias y datos sobre el nicho "${niche}" en España y Europa.

KEYWORDS de contexto detectados en la actividad reciente: ${topKeywords.join(", ")}

INSTRUCCIONES:
1. Busca datos REALES y actuales (2025-2026) sobre este nicho
2. Encuentra: tamaño de mercado, competidores principales, precios medios, márgenes típicos
3. Estrategias de pricing que funcionan en este nicho ESPECÍFICAMENTE
4. Tendencias de diseño web y UX para tiendas de ${niche}
5. Keywords SEO de alto volumen para ${niche} en español
6. Mejores prácticas de email marketing para ${niche}
7. Costes típicos de producción/sourcing para productos de ${niche}
8. Proveedores y fabricantes conocidos del sector

FORMATO: Responde con datos concretos, números, URLs reales cuando sea posible.`;

      try {
        const result = await askGeminiWithSearch(studyPrompt,
          `You are a specialized ecommerce analyst for the "${niche}" industry. Use Google Search to find REAL current data.`
        );

        if (result?.text && result.text.length > 200) {
          await db.insert(omnicoreMemoriesTable).values({
            id: randomBytes(16).toString("hex"),
            memoryType: "niche_deep_study",
            niche,
            title: `Deep study: ${niche} — ${new Date().toISOString().slice(0, 10)}`,
            content: result.text.slice(0, 12000),
            confidence: 0.82,
            sourceType: "adaptive_study",
            tags: JSON.stringify(["adaptive_study", niche, ...topKeywords.slice(0, 5)]),
            isVerified: 0,
          }).catch(() => {});

          log("adaptive-study", `✅ Deep study complete for niche: ${niche} (${result.text.length} chars)`);
        }
      } catch (err) {
        log("adaptive-study", `⚠️ Study failed for ${niche}: ${err}`);
      }

      // Pausa entre nichos para no saturar
      await new Promise(r => setTimeout(r, 3000));
    }

    log("adaptive-study", "🏁 Adaptive study complete");
  } catch (err) {
    log("adaptive-study", `❌ Adaptive study failed: ${err}`);
  }
}
```

Registrar el nuevo cron job en `registerCronJobs`:
```typescript
// AÑADIR dentro de registerCronJobs():
cron.schedule("30 5 * * *", () => { // 5:30am cada día
  runAdaptiveStudy().catch(err => log("adaptive-study", `Failed: ${err}`));
});
```

---

# MÓDULO 2: WEB LAB — ANÁLISIS CON INTELIGENCIA DE MARCA

## 2.1 Endpoint mejorado con investigación de marca automática

### Archivo a modificar: `api-server/src/routes/web-lab.ts`

Buscar el bloque `router.post("/web-lab/analyze"` y DENTRO del try, ANTES de la llamada a `askClaudeJsonWithBrain`, INSERTAR este código de investigación de marca:

```typescript
    // ══════════════════════════════════════════════════════════════════
    // NUEVO: Investigación automática de marca ANTES del análisis CSS
    // ══════════════════════════════════════════════════════════════════
    const brandName = req.body.brandName || null;
    const instagram = req.body.instagram || null;
    
    let brandResearch = {
      brandInfo: null as any,
      instagramInfo: null as any,
      competitorDesign: null as any,
      sectorDesign: null as any,
    };

    // Extraer dominio para búsqueda
    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname.replace("www.", "");
    const searchName = brandName || domain.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");

    logger.info({ searchName, instagram, domain }, "🔍 Web Lab: Starting brand research");

    try {
      const [brandResult, igResult, competitorResult, sectorResult] = await Promise.allSettled([
        // 1. Investigar la marca
        askGeminiWithSearch(
          `Investiga "${searchName}" (${url}). Qué es, qué vende, sector/nicho, 
           público objetivo (edad, género, poder adquisitivo), estilo de marca 
           (luxury, streetwear, corporate, artesanal, tech, minimal, bold...),
           colores que usa, valores de marca, rango de precios.
           SOLO JSON: { "name": "", "sector": "", "audience": "", "style": "", 
           "colors": [], "values": [], "priceRange": "", "luxuryLevel": 1-10, 
           "designAdjectives": [] }`,
          "Brand analyst. Return ONLY valid JSON. Search Google for real info."
        ),

        // 2. Investigar Instagram
        instagram
          ? askGeminiWithSearch(
              `Analiza @${instagram} en Instagram: estilo visual, colores dominantes,
               tipo de fotos, engagement, estética general, filtros, tipo de producto mostrado.
               JSON: { "handle": "", "followers": "", "aesthetic": "", "colors": [], 
               "photoStyle": "", "contentTypes": [], "mood": "" }`,
              "Instagram visual analyst. Return ONLY JSON."
            )
          : askGeminiWithSearch(
              `Busca la cuenta oficial de Instagram de "${searchName}" (${url}).
               Si la encuentras, analiza su estilo visual.
               JSON: { "handle": "", "found": false, "aesthetic": "", "colors": [] }`,
              "Social media researcher. Return ONLY JSON."
            ),

        // 3. Diseño de competidores del mismo sector
        askGeminiWithSearch(
          `Busca 3 webs de competidores de "${searchName}" y analiza su DISEÑO WEB.
           Patrones de diseño, colores, tipografías, estilo de layout, estilo de fotos.
           JSON: { "competitors": [{ "name": "", "url": "", "designStyle": "", 
           "colors": [], "fonts": [], "highlights": "" }] }`,
          "Competitive design analyst. Return ONLY JSON."
        ),

        // 4. Tendencias de diseño del sector
        askGeminiWithSearch(
          `What are the best web design trends for ${searchName}'s sector in 2026?
           Find 3 award-winning websites in the same industry.
           JSON: { "trends": [], "awardWinningExamples": [{ "url": "", "why": "" }],
           "recommendedFonts": [], "colorTrends": [] }`,
          "Web design trend analyst. Return ONLY JSON."
        ),
      ]);

      const parseSafe = (r: PromiseSettledResult<any>) => {
        if (r.status !== "fulfilled") return null;
        try {
          const text = r.value?.text ?? "";
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        } catch { return null; }
      };

      brandResearch.brandInfo = parseSafe(brandResult);
      brandResearch.instagramInfo = parseSafe(igResult);
      brandResearch.competitorDesign = parseSafe(competitorResult);
      brandResearch.sectorDesign = parseSafe(sectorResult);

      logger.info({
        hasBrand: !!brandResearch.brandInfo,
        hasIg: !!brandResearch.instagramInfo,
        hasCompetitors: !!brandResearch.competitorDesign,
        hasTrends: !!brandResearch.sectorDesign,
      }, "✅ Brand research complete");
    } catch (err) {
      logger.warn({ err }, "Brand research partially failed — continuing with available data");
    }

    // ══════════════════════════════════════════════════════════════════
    // Construir prompt ENRIQUECIDO con inteligencia de marca
    // ══════════════════════════════════════════════════════════════════
    const brandContextBlock = `
═══ INTELIGENCIA DE MARCA (investigación en tiempo real) ═══
${brandResearch.brandInfo ? `
MARCA: ${JSON.stringify(brandResearch.brandInfo)}
` : "Marca: No se encontró información — genera CSS basado en análisis del HTML/CSS actual."}
${brandResearch.instagramInfo ? `
INSTAGRAM: ${JSON.stringify(brandResearch.instagramInfo)}
INSTRUCCIÓN: El CSS DEBE reflejar la estética de su Instagram. Si su Instagram es minimal y 
oscuro, el CSS debe ser minimal y oscuro. Si es colorido y bold, el CSS debe reflejar eso.
` : ""}
${brandResearch.competitorDesign ? `
COMPETIDORES (diseño web): ${JSON.stringify(brandResearch.competitorDesign)}
INSTRUCCIÓN: El CSS mejorado debe ser MEJOR que el de los competidores. Identifica qué hacen 
bien los competidores e incorpóralo, pero con el ADN de marca de "${searchName}".
` : ""}
${brandResearch.sectorDesign ? `
TENDENCIAS DEL SECTOR: ${JSON.stringify(brandResearch.sectorDesign)}
` : ""}

REGLA CRÍTICA: NO generes CSS genérico de "web bonita". 
El CSS debe sentirse EXACTAMENTE como la marca "${searchName}".
Si es una marca de lujo → CSS minimal, mucho whitespace, serif fonts, animaciones suaves.
Si es streetwear → CSS bold, colores vibrantes, sans-serif gruesas, layouts asimétricos.
Si es tech → CSS clean, monospace accents, colores fríos, grid riguroso.
Si es artesanal → CSS cálido, texturas sutiles, serif orgánicos, paleta tierra.
═══ FIN INTELIGENCIA DE MARCA ═══
`;
```

Luego, inyectar `brandContextBlock` en el `userPrompt` que se pasa a Claude:
```typescript
    // Donde se construye el userPrompt, AÑADIR brandContextBlock:
    const userPrompt = `${brandContextBlock}

Analiza este código web REAL y genera mejoras profesionales:

URL: ${url}
${pageSpeed ? `PageSpeed Mobile: ${pageSpeed.performanceScore}/100, SEO: ${pageSpeed.seoScore}/100` : ""}
${scraperData ? `Title: ${scraperData.title}, Images: ${scraperData.images?.total}, Missing alt: ${scraperData.images?.withoutAlt}` : ""}

HTML (primeros 80KB):
${webContent.html.slice(0, 80000)}

CSS ACTUAL (completo):
${webContent.css.slice(0, 60000)}`;
```

También, guardar la investigación de marca en el resultado:
```typescript
    // En el JSON de respuesta final, AÑADIR:
    const result = JSON.stringify({
      success: true,
      analysis,
      brandResearch, // NUEVO: incluir investigación de marca
      // ... resto igual
    });
```

Y guardar en ShopyBrain:
```typescript
    // DESPUÉS de los learnFromOperation existentes, AÑADIR:
    if (brandResearch.brandInfo) {
      learnFromOperation({
        operationType: "web_lab_brand_intelligence",
        title: `Brand intelligence: ${searchName} — ${url}`,
        content: `Marca: ${JSON.stringify(brandResearch.brandInfo)}. Instagram: ${JSON.stringify(brandResearch.instagramInfo)}. Competidores: ${JSON.stringify(brandResearch.competitorDesign)}. Sector design trends: ${JSON.stringify(brandResearch.sectorDesign)}.`,
        confidence: 0.85,
        tags: ["web-lab", "brand-intelligence", searchName, url],
      });
    }
```

## 2.2 Frontend — Añadir campos de marca al formulario

### Archivo a modificar: `pages/projects/WebLab.tsx`

Buscar donde está el input de URL del Web Lab y AÑADIR campos adicionales:

```tsx
{/* AÑADIR después del input de URL existente: */}
<div style={{ display: "flex", gap: 12, marginTop: 12 }}>
  <input
    className="input-field"
    style={{ flex: 1 }}
    placeholder="Instagram de la marca (ej: @zara) — opcional"
    value={instagram}
    onChange={e => setInstagram(e.target.value)}
  />
  <input
    className="input-field"
    style={{ flex: 1 }}
    placeholder="Nombre de la marca (ej: Zara) — opcional"
    value={brandName}
    onChange={e => setBrandName(e.target.value)}
  />
</div>
<p style={{ fontSize: 12, color: "var(--t3)", marginTop: 4 }}>
  💡 Si proporcionas el Instagram o nombre, ShopyBrain investigará la identidad 
  visual de la marca para generar un CSS 100% alineado con su estética.
</p>
```

Añadir los states:
```tsx
const [instagram, setInstagram] = useState("");
const [brandName, setBrandName] = useState("");
```

Y en el fetch de análisis, añadir al body:
```tsx
body: JSON.stringify({ 
  url, 
  projectId, 
  template,
  instagram: instagram.replace("@", "").trim() || undefined,
  brandName: brandName.trim() || undefined,
}),
```

---

# MÓDULO 3: COGS — MOTOR DE COSTES HIPER-POTENCIADO

## 3.1 Clasificación automática de producto antes de estimar costes

### Archivo a modificar: `api-server/src/routes/pricing.ts`

Buscar el endpoint `router.post("/projects/:projectId/products/:productId/ai-estimate-cogs"`. 
ANTES de las 3 búsquedas de Gemini (matResult, shipResult, suppResult), INSERTAR:

```typescript
  // ══════════════════════════════════════════════════════════════════
  // NUEVO: Clasificación inteligente del producto para búsquedas precisas
  // ══════════════════════════════════════════════════════════════════
  let productClassification = {
    category: "physical" as string,
    manufacturingMethod: "unknown" as string,
    estimatedWeight: "500g" as string,
    materialComposition: [] as string[],
    shippingCategory: "standard" as string,
    searchTerms: {
      material: product.title,
      shipping: "paquete pequeño",
      supplier: product.title,
    },
  };

  try {
    const classResult = await askClaudeJson<{
      category: string;
      manufacturingMethod: string;
      estimatedWeight: string;
      estimatedDimensions: string;
      materialComposition: string[];
      complexityLevel: string;
      isFragile: boolean;
      shippingCategory: string;
      specificSearchQueries: {
        materialSearch: string;
        shippingSearch: string;
        supplierSearch: string;
        packagingSearch: string;
      };
    }>(projectId,
      `Clasifica este producto para estimar costes de producción:
       Título: "${product.title}"
       Descripción: "${(product.bodyHtml ?? "").replace(/<[^>]+>/g, " ").slice(0, 1500)}"
       Tipo: "${productType}"
       Vendor: "${product.vendor}"
       Precio: €${product.price}
       ${shopifyDetails}
       
       RESPONDE con JSON:
       {
         "category": "physical|digital|service|subscription",
         "manufacturingMethod": "handmade|3d_printed|injection_molded|textile|assembled|wholesale_resale|dropship|print_on_demand|food|cosmetic|electronic|artisan|jewellery|paper_print",
         "estimatedWeight": "Xg o Xkg",
         "estimatedDimensions": "largo x ancho x alto cm",
         "materialComposition": ["material1", "material2"],
         "complexityLevel": "simple|medium|complex|very_complex",
         "isFragile": false,
         "shippingCategory": "standard|oversized|fragile|hazmat|cold_chain",
         "specificSearchQueries": {
           "materialSearch": "la query EXACTA para buscar en Google los materiales de este producto con precios",
           "shippingSearch": "la query EXACTA para buscar tarifas de envío para este tipo/peso de producto",
           "supplierSearch": "la query EXACTA para buscar proveedores/fabricantes de este tipo de producto",
           "packagingSearch": "la query EXACTA para buscar packaging específico para este producto"
         }
       }`,
      "You are a manufacturing and supply chain expert. Classify this product for cost estimation. Return ONLY valid JSON.",
      2048, 30_000
    );

    productClassification = {
      ...productClassification,
      ...classResult,
      searchTerms: {
        material: classResult.specificSearchQueries?.materialSearch ?? product.title,
        shipping: classResult.specificSearchQueries?.shippingSearch ?? "envío paquete ecommerce",
        supplier: classResult.specificSearchQueries?.supplierSearch ?? product.title,
      },
    };
    
    logger.info({ classification: productClassification }, "✅ Product classified for COGS estimation");
  } catch (err) {
    logger.warn({ err }, "Product classification failed — using defaults");
  }
```

Luego, MODIFICAR las 3 búsquedas de Gemini para usar las queries específicas del clasificador:

```typescript
  // REEMPLAZAR los prompts genéricos de las 3 búsquedas por las queries clasificadas:
  
  const [matResult, shipResult, suppResult, packResult] = await Promise.allSettled([
    // 1. Materiales — query ESPECÍFICA del clasificador
    askGeminiWithSearch(
      `${productClassification.searchTerms.material}
       
       Busca PRECIOS REALES en: AliExpress, Amazon, proveedores industriales España.
       Materiales necesarios: ${productClassification.materialComposition.join(", ") || "detectar del tipo de producto"}.
       Método fabricación: ${productClassification.manufacturingMethod}.
       
       JSON: { "materials": [{"material": "", "priceRange": "€", "source": "", "url": ""}], 
       "avgMaterialCost": 0, "insight": "" }`,
      "Supply chain cost analyst. Search for REAL prices. ONLY JSON."
    ),
    
    // 2. Envío — con peso y categoría específicos
    askGeminiWithSearch(
      `${productClassification.searchTerms.shipping}
       
       Peso estimado: ${productClassification.estimatedWeight}.
       Categoría envío: ${productClassification.shippingCategory}.
       Busca tarifas 2025-2026 de: Correos Express, SEUR, MRW, Nacex, GLS, DHL.
       Para envío NACIONAL España y a EUROPA.
       
       JSON: { "carriers": [{"carrier": "", "domestic": "€", "international": "€", "source": ""}], 
       "insight": "", "recommendedCarrier": "" }`,
      "Logistics analyst. Current Spanish carrier rates. ONLY JSON."
    ),
    
    // 3. Proveedores — query específica
    askGeminiWithSearch(
      `${productClassification.searchTerms.supplier}
       
       Busca en Alibaba, AliExpress mayorista, fabricantes españoles de ${niche}.
       Método: ${productClassification.manufacturingMethod}.
       
       JSON: { "suppliers": [{"supplier": "", "priceRange": "€/ud", "moq": "", "origin": "", "url": ""}], 
       "avgCost": 0, "insight": "" }`,
      "Manufacturing sourcing analyst. REAL supplier prices. ONLY JSON."
    ),

    // 4. NUEVA BÚSQUEDA: Packaging específico
    askGeminiWithSearch(
      `${productClassification.searchTerms?.packaging ?? `Packaging ecommerce para ${productType} España precios`}
       
       Busca en: rajapack.es, uline, amazon.es cajas envío, kartox.com.
       Incluir: caja, relleno protector, cinta, etiqueta, bolsa.
       Producto: ${productClassification.shippingCategory === "fragile" ? "FRÁGIL — necesita protección extra" : "estándar"}.
       
       JSON: { "items": [{"item": "", "pricePerUnit": 0, "source": ""}], 
       "totalPackagingCost": 0, "insight": "" }`,
      "Packaging procurement analyst. ONLY JSON."
    ),
  ]);
```

## 3.2 Tabla de benchmarks que aprende con cada estimación

### Archivo NUEVO a crear: `api-server/src/lib/cogs-benchmarks.ts`

```typescript
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger.js";

interface CogsBenchmark {
  productCategory: string;
  manufacturingMethod: string;
  niche: string;
  avgMaterialCost: number;
  avgShippingDomestic: number;
  avgShippingInternational: number;
  avgPackagingCost: number;
  avgFulfillmentCost: number;
  avgPlatformFeePct: number;
  avgReturnRate: number;
  avgCac: number;
  sampleSize: number;
}

/**
 * Guardar/actualizar benchmark tras una estimación exitosa.
 * Usa media móvil ponderada para que datos nuevos tengan más peso.
 */
export async function updateCogsBenchmark(params: {
  productCategory: string;
  manufacturingMethod: string;
  niche: string;
  materialCost: number;
  shippingDomestic: number;
  shippingInternational: number;
  packagingCost: number;
  fulfillmentCost: number;
  platformFeePct: number;
  returnRate: number;
  cac: number;
}): Promise<void> {
  try {
    // Crear tabla si no existe (idempotent)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cogs_benchmarks (
        id SERIAL PRIMARY KEY,
        product_category TEXT NOT NULL,
        manufacturing_method TEXT NOT NULL DEFAULT 'unknown',
        niche TEXT NOT NULL DEFAULT 'general',
        avg_material_cost DECIMAL(10,4) DEFAULT 0,
        avg_shipping_domestic DECIMAL(10,4) DEFAULT 0,
        avg_shipping_international DECIMAL(10,4) DEFAULT 0,
        avg_packaging_cost DECIMAL(10,4) DEFAULT 0,
        avg_fulfillment_cost DECIMAL(10,4) DEFAULT 0,
        avg_platform_fee_pct DECIMAL(6,4) DEFAULT 0,
        avg_return_rate DECIMAL(6,4) DEFAULT 0,
        avg_cac DECIMAL(10,4) DEFAULT 0,
        sample_size INTEGER DEFAULT 0,
        last_updated TIMESTAMP DEFAULT NOW(),
        UNIQUE(product_category, manufacturing_method, niche)
      )
    `);

    // Upsert con media móvil
    await db.execute(sql`
      INSERT INTO cogs_benchmarks 
        (product_category, manufacturing_method, niche, 
         avg_material_cost, avg_shipping_domestic, avg_shipping_international,
         avg_packaging_cost, avg_fulfillment_cost, avg_platform_fee_pct,
         avg_return_rate, avg_cac, sample_size, last_updated)
      VALUES 
        (${params.productCategory}, ${params.manufacturingMethod}, ${params.niche},
         ${params.materialCost}, ${params.shippingDomestic}, ${params.shippingInternational},
         ${params.packagingCost}, ${params.fulfillmentCost}, ${params.platformFeePct},
         ${params.returnRate}, ${params.cac}, 1, NOW())
      ON CONFLICT (product_category, manufacturing_method, niche) DO UPDATE SET
        avg_material_cost = (cogs_benchmarks.avg_material_cost * cogs_benchmarks.sample_size + ${params.materialCost}) / (cogs_benchmarks.sample_size + 1),
        avg_shipping_domestic = (cogs_benchmarks.avg_shipping_domestic * cogs_benchmarks.sample_size + ${params.shippingDomestic}) / (cogs_benchmarks.sample_size + 1),
        avg_shipping_international = (cogs_benchmarks.avg_shipping_international * cogs_benchmarks.sample_size + ${params.shippingInternational}) / (cogs_benchmarks.sample_size + 1),
        avg_packaging_cost = (cogs_benchmarks.avg_packaging_cost * cogs_benchmarks.sample_size + ${params.packagingCost}) / (cogs_benchmarks.sample_size + 1),
        avg_fulfillment_cost = (cogs_benchmarks.avg_fulfillment_cost * cogs_benchmarks.sample_size + ${params.fulfillmentCost}) / (cogs_benchmarks.sample_size + 1),
        avg_platform_fee_pct = (cogs_benchmarks.avg_platform_fee_pct * cogs_benchmarks.sample_size + ${params.platformFeePct}) / (cogs_benchmarks.sample_size + 1),
        avg_return_rate = (cogs_benchmarks.avg_return_rate * cogs_benchmarks.sample_size + ${params.returnRate}) / (cogs_benchmarks.sample_size + 1),
        avg_cac = (cogs_benchmarks.avg_cac * cogs_benchmarks.sample_size + ${params.cac}) / (cogs_benchmarks.sample_size + 1),
        sample_size = cogs_benchmarks.sample_size + 1,
        last_updated = NOW()
    `);

    logger.info({ 
      category: params.productCategory, 
      method: params.manufacturingMethod, 
      niche: params.niche 
    }, "📊 COGS benchmark updated");
  } catch (err) {
    logger.warn({ err }, "Failed to update COGS benchmark — non-critical");
  }
}

/**
 * Obtener benchmarks para un tipo de producto.
 * Devuelve datos de referencia basados en productos similares ya estimados.
 */
export async function getCogsBenchmark(
  productCategory: string,
  manufacturingMethod: string,
  niche: string
): Promise<CogsBenchmark | null> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM cogs_benchmarks 
      WHERE product_category = ${productCategory}
        AND (manufacturing_method = ${manufacturingMethod} OR manufacturing_method = 'unknown')
        AND (niche = ${niche} OR niche = 'general')
      ORDER BY 
        CASE WHEN manufacturing_method = ${manufacturingMethod} AND niche = ${niche} THEN 0
             WHEN manufacturing_method = ${manufacturingMethod} THEN 1
             WHEN niche = ${niche} THEN 2
             ELSE 3 END,
        sample_size DESC
      LIMIT 1
    `);

    const rows = (result as any).rows;
    return rows?.[0] ?? null;
  } catch {
    return null;
  }
}
```

Luego en `pricing.ts`, DESPUÉS de la estimación exitosa del endpoint `ai-estimate-cogs`, AÑADIR:

```typescript
  // DESPUÉS de `res.json({...})`:
  // Guardar benchmark para futuras estimaciones
  import { updateCogsBenchmark } from "../lib/cogs-benchmarks.js";
  
  const ownEq = estimated.ownEquipment ?? {};
  updateCogsBenchmark({
    productCategory: productClassification.category,
    manufacturingMethod: productClassification.manufacturingMethod,
    niche: niche,
    materialCost: ownEq.materialCost ?? 0,
    shippingDomestic: ownEq.shippingCostDomestic ?? 0,
    shippingInternational: ownEq.shippingCostInternational ?? 0,
    packagingCost: ownEq.packagingCost ?? 0,
    fulfillmentCost: ownEq.fulfillmentFee ?? 0,
    platformFeePct: ownEq.shopifyPaymentFee ?? 0.015,
    returnRate: ownEq.returnRate ?? 0.08,
    cac: ownEq.cac ?? 0,
  }).catch(() => {});
```

---

# MÓDULO 4: MULTI-PLATAFORMA — RUTAS GENÉRICAS

## 4.1 Función helper para obtener conector de cualquier proyecto

### Archivo NUEVO a crear: `api-server/src/lib/platform-helper.ts`

```typescript
import { db, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { IPlatformConnector } from "./connectors/types.js";
import { logger } from "./logger.js";

/**
 * getProjectConnector — Obtiene el conector de plataforma correcto para un proyecto.
 * Funciona con Shopify, WooCommerce, PrestaShop y Universal.
 * NUNCA lanza error — devuelve null si la plataforma no es soportada.
 */
export async function getProjectConnector(projectId: number): Promise<IPlatformConnector | null> {
  try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) return null;

    const platformType = (project as any).platformType ?? "shopify";

    switch (platformType) {
      case "shopify": {
        const { ShopifyConnector } = await import("./connectors/shopify.js");
        return new ShopifyConnector(project);
      }
      case "woocommerce": {
        const { WooCommerceConnector } = await import("./connectors/woocommerce.js");
        return new WooCommerceConnector(project);
      }
      case "prestashop": {
        const { PrestaShopConnector } = await import("./connectors/prestashop.js");
        return new PrestaShopConnector(project);
      }
      case "universal": {
        const { UniversalAuditConnector } = await import("./connectors/universal.js");
        return new UniversalAuditConnector(project);
      }
      default:
        logger.warn({ projectId, platformType }, "Unsupported platform type");
        return null;
    }
  } catch (err) {
    logger.error({ err, projectId }, "Failed to get platform connector");
    return null;
  }
}

/**
 * withConnector — Wrapper que ejecuta una operación con el conector correcto.
 * Si la plataforma no soporta la feature, devuelve un error amigable.
 */
export async function withConnector<T>(
  projectId: number,
  feature: string,
  fn: (connector: IPlatformConnector) => Promise<T>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  const connector = await getProjectConnector(projectId);
  if (!connector) {
    return { success: false, error: "Proyecto no encontrado o plataforma no soportada" };
  }
  if (!connector.supportsFeature(feature as any)) {
    return { success: false, error: `La plataforma ${connector.platformType} no soporta "${feature}"` };
  }
  try {
    const data = await fn(connector);
    return { success: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { success: false, error: msg };
  }
}
```

## 4.2 Fix del endpoint apply-price para multi-plataforma

### Archivo a modificar: `api-server/src/routes/pricing.ts`

Buscar el endpoint `router.post("/projects/:projectId/products/:productId/apply-price"`. 
REEMPLAZAR la llamada a `shopifyRequest` por:

```typescript
  // REEMPLAZAR:
  // await shopifyRequest(projectId, project.shopDomain, `/products/${shopifyProductId}.json`, { ... });
  
  // POR:
  const { getProjectConnector } = await import("../lib/platform-helper.js");
  const connector = await getProjectConnector(projectId);
  if (!connector) {
    res.status(400).json({ error: "Plataforma no configurada para este proyecto" });
    return;
  }
  
  if (!connector.supportsFeature("product_update")) {
    res.status(400).json({ error: `La plataforma ${connector.platformType} no soporta actualización de precios` });
    return;
  }

  await connector.updateProduct(shopifyProductId, {
    variants: [{
      platformId: "",
      title: "",
      price: price,
      compareAtPrice: compareAtPrice ?? undefined,
    }],
  });
```

## 4.3 Fix del warmup para multi-plataforma

### Archivo a modificar: `api-server/src/index.ts`

Buscar la función `warmupProdKnowledge`. Dentro del loop `for (const project of projects)`, 
REEMPLAZAR la parte de `shopifyRequestPaged` por la versión genérica. 

El cambio es grande, así que el patrón es:

```typescript
// REEMPLAZAR todas las llamadas shopifyRequestPaged por:
const { getProjectConnector } = await import("./lib/platform-helper.js");
const connector = await getProjectConnector(project.id);
if (!connector || !connector.supportsFeature("products")) {
  logger.info({ projectId: project.id }, "⏭ Warmup: platform doesn't support products, skipping");
  continue;
}

const allProducts = await connector.getProducts({ status: "active", limit: 250 });
// ... continuar con el procesamiento como antes, pero usando PlatformProduct en vez de ShopifyProductRaw
```

---

# MÓDULO 5: ENTITY RESEARCH — INVESTIGACIÓN EXHAUSTIVA

## 5.1 Búsqueda proactiva de Instagram, TikTok, LinkedIn

### Archivo a modificar: `api-server/src/lib/gemini.ts`

Buscar la función `deepEntityResearch`. Dentro del array de búsquedas paralelas, AÑADIR estas dimensiones extras al final:

```typescript
    // AÑADIR a las búsquedas paralelas existentes:
    
    // Dimensión 10: INSTAGRAM DEEP DIVE
    withTimeout(
      withRetry(() =>
        searchWithGrounding(
          `Find the official Instagram account of "${entity}". Analyze: exact handle, follower count, posting frequency (posts per week), content types (product shots, lifestyle, UGC, reels, stories), visual aesthetic (colors, filters, mood), engagement rate, top hashtags used, bio description, link in bio destination. If multiple accounts exist, identify the main brand account.${knowledgeCtx}`,
          `Search for "${entity}" Instagram profile and analyze their visual social media strategy in detail.`
        ),
        "instagram_deep"
      ),
      PER_SEARCH_TIMEOUT,
      "instagram_deep"
    ).catch(fallback("instagram_deep")),

    // Dimensión 11: TIKTOK + YOUTUBE
    withTimeout(
      withRetry(() =>
        searchWithGrounding(
          `Find "${entity}" on TikTok and YouTube. For TikTok: handle, followers, content style, viral videos, posting frequency. For YouTube: channel name, subscribers, content types (tutorials, unboxings, ads, behind-scenes), most viewed video. Also check Pinterest, LinkedIn company page.${knowledgeCtx}`,
          `Search for "${entity}" presence on TikTok, YouTube, Pinterest, and LinkedIn.`
        ),
        "social_extended"
      ),
      PER_SEARCH_TIMEOUT,
      "social_extended"
    ).catch(fallback("social_extended")),

    // Dimensión 12: FINANCIALS & BUSINESS MODEL
    withTimeout(
      withRetry(() =>
        searchWithGrounding(
          `Research the business model and financial indicators of "${entity}". Find: estimated annual revenue, number of employees, funding rounds (if startup), business model (D2C, wholesale, marketplace, subscription), year founded, headquarters location, key executives/founders, company registration information if available.${knowledgeCtx}`,
          `Search for "${entity}" business financials, revenue estimates, funding, and company structure.`
        ),
        "financials"
      ),
      PER_SEARCH_TIMEOUT,
      "financials"
    ).catch(fallback("financials")),
```

## 5.2 Síntesis con Claude más potente

### Archivo a modificar: `api-server/src/routes/entity-research.ts`

En el endpoint `/research-entity-sync`, buscar el `synthPrompt` donde Claude sintetiza todo. 
AÑADIR al final del prompt:

```typescript
    // AÑADIR al synthPrompt, antes del bloque de formato JSON:
    const extraSynthInstructions = `

INSTRUCCIONES ADICIONALES DE SÍNTESIS:

1. SCORING: Asigna un score 0-100 a cada dimensión:
   - brandStrength (0-100): fuerza de marca, reconocimiento, trust
   - digitalPresence (0-100): presencia online total
   - contentQuality (0-100): calidad del contenido que producen
   - customerSentiment (0-100): opinión general de clientes
   - competitivePosition (0-100): posición vs competidores
   - growthPotential (0-100): potencial de crecimiento detectado

2. OPORTUNIDADES ACCIONABLES: Para cada oportunidad, incluye:
   - Qué hacer exactamente
   - Por qué funciona (con datos)
   - Impacto estimado
   - Dificultad de implementación (1-5)
   - Tiempo estimado de implementación

3. GENERACIÓN DE PROPUESTA AUTOMÁTICA: Basándote en los problemas detectados,
   genera una propuesta de servicios de ShopyCrafter con precios del catálogo.
   Incluye: servicios recomendados, precio total, ROI estimado.

4. ALERTAS: Si detectas algo urgente (web caída, reviews muy negativas, 
   problema de seguridad, competidor ganando terreno), márcalo como ALERTA ROJA.
`;
```

---

# MÓDULO 6: AUDITORÍA UNIVERSAL POTENCIADA

## 6.1 Nuevo endpoint de auditoría completa para cualquier web

### Archivo a modificar: `api-server/src/routes/entity-research.ts`

AÑADIR al final del archivo, ANTES de `export default router`:

```typescript
// ─── POST /api/shopybrain/audit-entity ─────────────────────────────────────
// Auditoría completa de cualquier empresa/marca/web
router.post("/shopybrain/audit-entity", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { input, niche, projectId: rawProjectId } = req.body as { 
    input: string; niche?: string; projectId?: number 
  };

  if (!input?.trim()) {
    res.status(400).json({ error: "input requerido (URL, nombre, Instagram)" });
    return;
  }

  const startTime = Date.now();
  logger.info({ input, niche }, "📊 Full entity audit starting");

  try {
    const entity = await extractEntityName(input.trim());
    const entityDisplay = entity.name || input;
    const url = entity.url || (input.startsWith("http") ? input : `https://${input}`);

    // FASE 1: Investigación de entidad (ya existe, reutilizar)
    const existingKnowledge = await loadExistingEntityKnowledge(entityDisplay);
    
    const research = await deepEntityResearch(
      entityDisplay,
      entity.url,
      existingKnowledge.hasKnowledge ? existingKnowledge.summary : undefined
    );

    // FASE 2: Auditoría técnica (PageSpeed + Scraping)
    let technicalAudit = { pageSpeed: null as any, scraping: null as any };
    try {
      const { scrapeWebsite } = await import("../lib/web-scraper.js");
      const { runDualPageSpeed } = await import("../lib/pagespeed.js");
      
      const [scrapingResult, pageSpeedResult] = await Promise.allSettled([
        scrapeWebsite(url),
        runDualPageSpeed(url),
      ]);
      
      technicalAudit.scraping = scrapingResult.status === "fulfilled" ? scrapingResult.value : null;
      technicalAudit.pageSpeed = pageSpeedResult.status === "fulfilled" ? pageSpeedResult.value : null;
    } catch {}

    // FASE 3: Síntesis completa con Claude
    const client = await getClaudeClient(rawProjectId || 0);
    const auditResponse = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 16000,
      system: `Eres el auditor principal de ShopyBrain. Generas auditorías de negocio COMPLETAS y ACCIONABLES.
Combinas: análisis de marca, SEO, UX, competencia, oportunidades de negocio.
Respondes en español. SIEMPRE con datos concretos y acciones específicas.`,
      messages: [{
        role: "user",
        content: `Genera una auditoría COMPLETA de: "${entityDisplay}" (${url})

DATOS DE INVESTIGACIÓN:
${JSON.stringify({
  overview: research.overview.slice(0, 3000),
  products: research.products.slice(0, 2000),
  social: research.social.slice(0, 2000),
  reviews: research.reviews.slice(0, 2000),
  competitors: research.competitors.slice(0, 2000),
})}

DATOS TÉCNICOS:
PageSpeed Mobile: ${technicalAudit.pageSpeed?.mobile?.performanceScore ?? "N/A"}/100
PageSpeed Desktop: ${technicalAudit.pageSpeed?.desktop?.performanceScore ?? "N/A"}/100
SEO Score: ${technicalAudit.pageSpeed?.mobile?.seoScore ?? "N/A"}/100
Title: ${technicalAudit.scraping?.title ?? "N/A"}
Meta Description: ${technicalAudit.scraping?.metaDescription ?? "N/A"}
Images total: ${technicalAudit.scraping?.images?.total ?? "N/A"}
Images sin alt: ${technicalAudit.scraping?.images?.withoutAlt ?? "N/A"}
H1s: ${technicalAudit.scraping?.headings?.h1?.join(", ") ?? "N/A"}

FORMATO DE RESPUESTA — JSON:
{
  "entityName": "",
  "overallScore": 0-100,
  "executiveSummary": "3-4 frases resumen",
  "scores": {
    "brand": 0-100, "seo": 0-100, "ux": 0-100, "performance": 0-100,
    "content": 0-100, "social": 0-100, "competitive": 0-100
  },
  "strengths": ["punto fuerte 1", "punto fuerte 2"],
  "criticalIssues": [
    { "issue": "", "impact": "high|medium|low", "fix": "", "estimatedCost": "€X", "estimatedTime": "X días" }
  ],
  "opportunities": [
    { "opportunity": "", "potentialRevenue": "€X/mes", "difficulty": 1-5, "timeToImplement": "" }
  ],
  "competitiveAnalysis": "",
  "recommendedServices": [
    { "service": "nombre servicio ShopyCrafter", "price": "€X", "why": "por qué lo necesita" }
  ],
  "totalRecommendedInvestment": "€X",
  "estimatedROI": "X% en Y meses",
  "alerts": ["alerta urgente si la hay"]
}`
      }],
    }, { signal: AbortSignal.timeout(120_000) });

    const auditText = auditResponse.content[0].type === "text" ? auditResponse.content[0].text : "{}";
    const jsonMatch = auditText.match(/\{[\s\S]*\}/);
    const audit = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    // FASE 4: Guardar en ShopyBrain
    await upsertEntityMemory({
      entityName: entityDisplay,
      title: `Auditoría completa: ${entityDisplay} — Score ${audit.overallScore ?? "?"}`,
      content: JSON.stringify(audit).slice(0, 12000),
      memoryType: "entity_audit",
      niche: niche ?? audit.sector ?? null,
      confidence: 0.9,
      tags: ["audit", "entity", entityDisplay],
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info({ entity: entityDisplay, score: audit.overallScore, elapsed: `${elapsed}s` }, "✅ Entity audit complete");

    res.json({
      success: true,
      audit,
      technical: {
        pageSpeed: technicalAudit.pageSpeed,
        scraping: technicalAudit.scraping ? {
          title: technicalAudit.scraping.title,
          metaDescription: technicalAudit.scraping.metaDescription,
          images: technicalAudit.scraping.images,
          headings: technicalAudit.scraping.headings,
        } : null,
      },
      research: {
        sourcesFound: research.allSources.length,
        queriesExecuted: research.allQueries.length,
      },
      elapsed: `${elapsed}s`,
    });
  } catch (err) {
    logger.error({ err }, "Entity audit failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Error en auditoría" });
  }
});
```

---

# MÓDULO 7: BUGS CRÍTICOS — FIXES EXACTOS

## 7.1 Contraseña admin

### Archivo: `api-server/src/index.ts`
Buscar la línea:
```typescript
const ADMIN_PASS = envPass || "ShopyAdmin2026!";
```
REEMPLAZAR por:
```typescript
const ADMIN_PASS = envPass || (() => {
  const generated = randomBytes(24).toString("base64url");
  logger.info({ password: generated }, "🔑 No ADMIN_PASSWORD set — generated random dev password");
  return generated;
})();
```

## 7.2 Rate limiting en producción

### Archivo: `api-server/src/app.ts`
Buscar TODAS las apariciones de:
```typescript
skip: (req) => process.env.NODE_ENV !== "production",
```
REEMPLAZAR CADA UNA por:
```typescript
skip: (req) => process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test",
```

## 7.3 Modelo centralizado

### Archivo NUEVO: `api-server/src/lib/config.ts`
```typescript
export const AI_CONFIG = {
  claude: {
    model: process.env.CLAUDE_MODEL || "claude-sonnet-4-5",
    maxTokensDefault: 4096,
    maxTokensLong: 16000,
    timeoutMs: 180_000,
  },
  gemini: {
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    proModel: process.env.GEMINI_PRO_MODEL || "gemini-2.5-pro",
    maxOutputTokens: 65_536,
  },
};
```
Luego importar en `claude.ts`, `gemini.ts`, `scheduler.ts`, `brain-ingester.ts`:
```typescript
import { AI_CONFIG } from "./config.js";
// Usar AI_CONFIG.claude.model en vez de "claude-sonnet-4-5" hardcodeado
```

## 7.4 PlatformNotSupportedError mensaje correcto

### Archivo: `api-server/src/lib/connectors/types.ts`
Buscar:
```typescript
super(`La plataforma "${platformType}" aún no está soportada. Plataformas disponibles: shopify`);
```
REEMPLAZAR por:
```typescript
super(`La plataforma "${platformType}" aún no está soportada. Plataformas disponibles: shopify, woocommerce, prestashop, universal`);
```

Hacer lo mismo en `api-server/src/connectors/types.ts` si existe.

---

# MÓDULO 8: NUEVAS ACCIONES DEL CHATBOT

## 8.1 Acción: auto_estimate_all_cogs

### Archivo a modificar: `api-server/src/routes/shopybrain.ts`

En el bloque de acciones del chatbot (el gran switch/case), AÑADIR:

```typescript
      case "auto_estimate_all_cogs": {
        const projectId = params.projectId || contextProjectId;
        if (!projectId) return { error: "Se necesita projectId" };
        
        // Obtener todos los productos sin COGS
        const productsWithoutCogs = await db.execute(sql`
          SELECT p.shopify_product_id, p.title, p.product_type, p.price
          FROM products p
          LEFT JOIN cogs c ON p.project_id = c.project_id AND p.shopify_product_id = c.shopify_product_id
          WHERE p.project_id = ${projectId} AND (c.id IS NULL OR c.total_cogs = 0)
          LIMIT 20
        `);
        
        const rows = (productsWithoutCogs as any).rows ?? [];
        if (rows.length === 0) {
          return { message: "✅ Todos los productos ya tienen COGS estimado." };
        }

        // Estimar COGS para cada uno
        let estimated = 0;
        const results: string[] = [];
        for (const product of rows.slice(0, 10)) { // Máximo 10 a la vez
          try {
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/products/${product.shopify_product_id}/ai-estimate-cogs`, {
              method: "POST",
              headers: { "Content-Type": "application/json", cookie: req.headers.cookie || "" },
            });
            if (resp.ok) {
              const data = await resp.json() as any;
              estimated++;
              results.push(`✅ ${product.title}: €${data.ownEquipment?.totalCogs ?? "?"}/ud (${data.confidenceLevel ?? "?"})`);
            }
          } catch {}
          await new Promise(r => setTimeout(r, 2000)); // Pausa entre estimaciones
        }

        return {
          message: `📊 COGS estimado para ${estimated}/${rows.length} productos:\n${results.join("\n")}${rows.length > 10 ? `\n\n⚠️ Quedan ${rows.length - 10} productos pendientes. Ejecuta de nuevo para continuar.` : ""}`,
        };
      }
```

También añadir al prompt del chatbot la documentación de la nueva acción:
```
- Estimar COGS de todos / COGS automático / costes de todo el catálogo → auto_estimate_all_cogs. Params: {projectId}
```

## 8.2 Acción: analyze_external_store mejorada

Ya existe pero necesita usar entity research + web lab combinados. En el case `analyze_external_store`, AÑADIR:

```typescript
      // DENTRO del case "analyze_external_store", DESPUÉS del análisis actual:
      
      // Si hay URL, también hacer análisis de diseño Web Lab lite
      if (url) {
        try {
          const webLabResp = await fetch(`${baseUrl}/api/web-lab/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: req.headers.cookie || "" },
            body: JSON.stringify({ url, projectId: projectId || 0, brandName: name }),
          });
          if (webLabResp.ok) {
            const webLabData = await webLabResp.json() as any;
            // Combinar resultado con el análisis de entidad
            result.designScore = webLabData.analysis?.overallScore;
            result.designCategories = webLabData.analysis?.categories;
          }
        } catch {}
      }
```

---

# RESUMEN DE ARCHIVOS A MODIFICAR

| # | Archivo | Qué hacer |
|---|---------|-----------|
| 1 | `lib/claude.ts` | Expandir `learnFromOperation`, añadir `buildSmartBrainContext` |
| 2 | `lib/scheduler.ts` | Añadir `runAdaptiveStudy` + cron job |
| 3 | `routes/web-lab.ts` | Insertar investigación de marca antes del análisis CSS |
| 4 | `pages/projects/WebLab.tsx` | Añadir campos Instagram + nombre marca |
| 5 | `routes/pricing.ts` | Clasificación de producto + 4 búsquedas + fix apply-price |
| 6 | `lib/cogs-benchmarks.ts` | NUEVO archivo — sistema de benchmarks |
| 7 | `lib/platform-helper.ts` | NUEVO archivo — helper multi-plataforma |
| 8 | `lib/config.ts` | NUEVO archivo — config centralizada |
| 9 | `index.ts` | Fix contraseña admin + warmup multi-plataforma |
| 10 | `app.ts` | Fix rate limiting |
| 11 | `lib/connectors/types.ts` | Fix mensaje error plataformas |
| 12 | `lib/gemini.ts` | Añadir 3 dimensiones de búsqueda a entity research |
| 13 | `routes/entity-research.ts` | Añadir endpoint audit-entity |
| 14 | `routes/shopybrain.ts` | Añadir acción auto_estimate_all_cogs |

**REGLA DE ORO: Cada cambio es ADITIVO. No se borra código existente. Se amplía.**
