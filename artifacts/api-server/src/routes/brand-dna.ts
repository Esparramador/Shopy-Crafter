import { Router } from "express";
import { db, projectsTable, brandDnaTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { enableLongRunning } from "../lib/long-running.js";
import { askClaudeJsonWithBrain, SHOPIFY_EXPERT_SYSTEM, learnFromOperation } from "../lib/claude.js";
import { logger } from "../lib/logger.js";
import { crawlSiteFromSitemap, formatTechStackForPrompt } from "../lib/site-crawler.js";
import { extractGoogleBusinessProfile, formatGoogleReviewsForPrompt } from "../lib/google-reviews.js";

const router = Router();

let migrationDone = false;
async function ensureMigration() {
  if (migrationDone) return;
  try {
    await db.execute(sql`
      ALTER TABLE brand_dna
        ADD COLUMN IF NOT EXISTS sector text,
        ADD COLUMN IF NOT EXISTS company_description text,
        ADD COLUMN IF NOT EXISTS services text[],
        ADD COLUMN IF NOT EXISTS brand_values text[],
        ADD COLUMN IF NOT EXISTS brand_archetype text,
        ADD COLUMN IF NOT EXISTS social_handles text[],
        ADD COLUMN IF NOT EXISTS unique_value_proposition text,
        ADD COLUMN IF NOT EXISTS taglines text[],
        ADD COLUMN IF NOT EXISTS content_pillars text[],
        ADD COLUMN IF NOT EXISTS website_url text,
        ADD COLUMN IF NOT EXISTS full_profile_json text,
        ADD COLUMN IF NOT EXISTS extraction_status text
    `);
    migrationDone = true;
  } catch (e) {
    migrationDone = true;
  }
}

async function scrapePage(url: string): Promise<string> {
  try {
    const fullUrl = url.startsWith("http") ? url : `https://${url}`;
    const res = await fetch(fullUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.5",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return "";
    const html = await res.text();

    const title = (html.match(/<title[^>]*>([^<]{1,200})<\/title>/i) ?? [])[1]?.trim() ?? "";
    const desc = (html.match(/<meta[^>]*name="description"[^>]*content="([^"]{1,400})"/i) ?? html.match(/<meta[^>]*content="([^"]{1,400})"[^>]*name="description"/i) ?? [])[1]?.trim() ?? "";
    const ogTitle = (html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]{1,200})"/i) ?? [])[1] ?? "";
    const ogDesc = (html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]{1,400})"/i) ?? [])[1] ?? "";
    const h1s = [...html.matchAll(/<h1[^>]*>([^<]{2,200})<\/h1>/gi)].map(m => m[1].replace(/<[^>]+>/g, "").trim()).filter(Boolean).slice(0, 5);
    const h2s = [...html.matchAll(/<h2[^>]*>([^<]{2,150})<\/h2>/gi)].map(m => m[1].replace(/<[^>]+>/g, "").trim()).filter(Boolean).slice(0, 12);
    const h3s = [...html.matchAll(/<h3[^>]*>([^<]{2,120})<\/h3>/gi)].map(m => m[1].replace(/<[^>]+>/g, "").trim()).filter(Boolean).slice(0, 10);
    const paras = [...html.matchAll(/<p[^>]{0,50}>([^<]{20,500})<\/p>/gi)].map(m => m[1].replace(/<[^>]+>/g, "").trim()).filter(Boolean).slice(0, 15);
    const jsonLd = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1].trim().slice(0, 600)).join("\n").slice(0, 2000);

    const socialPatterns: Array<{ p: string; re: RegExp }> = [
      { p: "instagram", re: /instagram\.com\/(?!reel|p\/|stories|explore)([\w.]{2,40})/gi },
      { p: "tiktok", re: /tiktok\.com\/@([\w.]{2,40})/gi },
      { p: "facebook", re: /facebook\.com\/(?!sharer|share|dialog)([\w.]{2,60})/gi },
      { p: "twitter", re: /(?:twitter|x)\.com\/([\w]{2,40})/gi },
      { p: "youtube", re: /youtube\.com\/@([\w-]{2,50})/gi },
      { p: "linkedin", re: /linkedin\.com\/company\/([\w-]{2,60})/gi },
      { p: "pinterest", re: /pinterest\.com\/([\w.]{2,40})/gi },
      { p: "threads", re: /threads\.net\/@([\w.]{2,40})/gi },
    ];
    const socials: string[] = [];
    for (const { p, re } of socialPatterns) {
      const found = [...html.matchAll(re)].map(m => `${p}:@${(m[1] ?? "").replace(/^\/?/, "")}`);
      if (found.length) socials.push(found[0]);
    }

    const hexColors = [...new Set([...html.matchAll(/#([0-9a-fA-F]{6})\b/g)].map(m => `#${m[1].toUpperCase()}`))].slice(0, 15);

    return [
      title && `TÍTULO: ${title}`,
      ogTitle && ogTitle !== title && `OG-TITLE: ${ogTitle}`,
      desc && `DESC: ${desc}`,
      ogDesc && ogDesc !== desc && `OG-DESC: ${ogDesc}`,
      h1s.length && `H1: ${h1s.join(" | ")}`,
      h2s.length && `H2: ${h2s.join(" | ")}`,
      h3s.length && `H3: ${h3s.join(" | ")}`,
      paras.length && `PÁRRAFOS: ${paras.slice(0, 8).join(" // ")}`,
      jsonLd && `JSON-LD: ${jsonLd}`,
      socials.length && `REDES SOCIALES DETECTADAS: ${[...new Set(socials)].join(", ")}`,
      hexColors.length > 4 && `COLORES-CSS: ${hexColors.slice(0, 12).join(", ")}`,
    ].filter(Boolean).join("\n");
  } catch {
    return "";
  }
}

const BRAND_DNA_EXTRACTION_PROMPT = (allContent: string, brandName: string, websiteUrl: string) => `
Eres un experto mundial en identidad de marca, branding estratégico y análisis digital. Tu misión es extraer el ADN completo y 100% verídico de esta marca a partir de los datos reales de su sitio web.

SITIO WEB ANALIZADO: ${websiteUrl}
MARCA: ${brandName}

DATOS REALES EXTRAÍDOS DEL SITIO WEB:
${allContent}

Analiza TODOS los datos anteriores y extrae el ADN de marca más completo y preciso posible. Devuelve ÚNICAMENTE JSON válido con la siguiente estructura:

{
  "companyInfo": {
    "name": "nombre oficial exacto de la empresa/marca",
    "sector": "sector/industria ESPECÍFICO (ej: 'Moda streetwear premium', 'Cosmética natural orgánica', 'Software B2B SaaS para PYMES', 'Arquitectura de interiores de lujo'...)",
    "subsector": "subsector más específico",
    "description": "descripción completa y detallada de qué hace la empresa — 2-3 frases sustanciales basadas en el contenido real",
    "mission": "misión detectada o null",
    "vision": "visión detectada o null",
    "foundedYear": null,
    "location": "ciudad y país detectados o null",
    "languages": ["idiomas en que opera la marca"]
  },
  "services": [
    {"name": "nombre del servicio/producto/colección", "description": "descripción breve real", "category": "categoría"}
  ],
  "brandIdentity": {
    "archetype": "uno de: Héroe|Sabio|Creator|Explorador|Rebelde|Mago|Amante|Cuidador|Gobernante|Bufón|Hombre Corriente|Inocente",
    "personality": ["adjetivos reales detectados de la comunicación de la marca"],
    "values": ["valores core detectados en el contenido — solo los reales, no inventados"],
    "tone": "formal|semiformal|casual|irreverente|técnico|emocional|inspiracional|educativo|premium",
    "voiceCharacteristics": ["características específicas y reales de la voz de marca"],
    "uniqueValueProposition": "propuesta de valor única detectada en el sitio — en el idioma de la marca",
    "taglines": ["todos los slogans y frases de marca detectadas textualmente"],
    "messagingPillars": ["3-5 pilares de mensaje que aparecen repetidamente en el contenido"]
  },
  "visualIdentity": {
    "primaryColors": ["#HEX colores primarios reales detectados en CSS/diseño"],
    "secondaryColors": ["#HEX colores secundarios"],
    "typographyStyle": "serif|sans-serif|geometric|humanist|display|monospace|mixed",
    "typographyDescription": "descripción del estilo tipográfico detectado",
    "layoutPattern": "minimalista|denso|editorial|e-commerce|corporate|playful|luxury|tech",
    "photographyStyle": "lifestyle|product|editorial|documental|ilustración|CGI|mixto|flat-lay",
    "visualDensity": "limpio|moderado|denso",
    "aestheticKeywords": ["palabras que describen la estética visual real de la marca"]
  },
  "targetAudience": {
    "primary": "descripción detallada del cliente ideal detectado en el contenido",
    "demographics": {
      "ageRange": "ej: 25-45",
      "gender": "todos|mujeres|hombres|profesionales",
      "income": "bajo|medio|alto|muy alto",
      "education": "básica|universitaria|postgrado|profesional"
    },
    "psychographics": ["características psicográficas detectadas"],
    "painPoints": ["problemas que la marca declara resolver"],
    "desires": ["aspiraciones que la marca evoca"],
    "geography": ["mercados geográficos detectados"]
  },
  "marketPosition": {
    "pricePoint": "budget|mid|premium|luxury",
    "mainCompetitors": ["competidores detectados o mencionados"],
    "competitiveAdvantage": "ventaja competitiva real que declara la marca",
    "marketGaps": ["nichos específicos que ocupa"]
  },
  "digitalPresence": {
    "socialHandles": [
      {"platform": "instagram|tiktok|facebook|twitter|youtube|linkedin|pinterest|threads", "handle": "handle exacto detectado"}
    ],
    "contentTopics": ["temas de contenido detectados en headings/párrafos"],
    "engagementStyle": "educativo|entretenimiento|inspiracional|promocional|mixto|aspiracional"
  },
  "contentStrategy": {
    "contentPillars": ["3-5 pilares de contenido detectados"],
    "ctaStyle": "urgente|suave|educativo|emocional|exclusivo",
    "copywritingStyle": "descripción real del estilo de escritura de la marca",
    "keyMessages": ["mensajes clave que repite la marca"]
  },
  "intelligence": {
    "summary": "resumen ejecutivo del ADN de marca en 3 frases concisas",
    "uniqueInsights": ["insights únicos sobre esta marca basados en los datos reales"],
    "contentPersonalizationGuide": "guía de cómo generar contenido auténtico para esta marca",
    "confidenceScore": 0.0,
    "dataQuality": "real|inferred|estimated"
  }
}

REGLAS CRÍTICAS:
1. Extrae SOLO lo que puedas detectar en los datos reales. NO inventes información.
2. Si no encuentras un campo con certeza, usa null o [].
3. Los colores deben ser exactos en hex si aparecen en los datos CSS.
4. Los social handles deben ser exactos tal como aparecen.
5. El sector debe ser MUY específico y detallado, nunca genérico.
6. La UVP y taglines deben ser en el idioma original de la marca.
7. confidenceScore: 0.9 si hay muchos datos reales, 0.6 si son inferidos, 0.3 si son estimados.
8. Responde SOLO JSON. Sin comentarios, sin markdown fences.
`;

interface FullBrandDna {
  companyInfo: {
    name?: string; sector?: string; subsector?: string; description?: string;
    mission?: string; vision?: string; foundedYear?: number | null;
    location?: string; languages?: string[];
  };
  services?: Array<{ name: string; description?: string; category?: string }>;
  brandIdentity?: {
    archetype?: string; personality?: string[]; values?: string[]; tone?: string;
    voiceCharacteristics?: string[]; uniqueValueProposition?: string;
    taglines?: string[]; messagingPillars?: string[];
  };
  visualIdentity?: {
    primaryColors?: string[]; secondaryColors?: string[];
    typographyStyle?: string; typographyDescription?: string;
    layoutPattern?: string; photographyStyle?: string; visualDensity?: string;
    aestheticKeywords?: string[];
  };
  targetAudience?: {
    primary?: string;
    demographics?: { ageRange?: string; gender?: string; income?: string; education?: string };
    psychographics?: string[]; painPoints?: string[]; desires?: string[]; geography?: string[];
  };
  marketPosition?: {
    pricePoint?: string; mainCompetitors?: string[]; competitiveAdvantage?: string; marketGaps?: string[];
  };
  digitalPresence?: {
    socialHandles?: Array<{ platform: string; handle: string }>;
    contentTopics?: string[]; engagementStyle?: string;
  };
  contentStrategy?: {
    contentPillars?: string[]; ctaStyle?: string; copywritingStyle?: string; keyMessages?: string[];
  };
  intelligence?: {
    summary?: string; uniqueInsights?: string[]; contentPersonalizationGuide?: string;
    confidenceScore?: number; dataQuality?: string;
  };
}

// GET /api/projects/:projectId/brand-dna
router.get("/projects/:projectId/brand-dna", async (req, res): Promise<void> => {
  try {
    await ensureMigration();
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) { res.status(400).json({ error: "projectId inválido" }); return; }

    const rows = await db.execute(
      sql`SELECT * FROM brand_dna WHERE project_id = ${projectId} ORDER BY extracted_at DESC LIMIT 1`
    );
    const row = rows.rows[0] ?? null;

    if (!row) { res.json({ ok: true, brandDna: null }); return; }

    let fullProfile: FullBrandDna | null = null;
    if (row.full_profile_json) {
      try { fullProfile = JSON.parse(row.full_profile_json as string); } catch { /* ignore */ }
    }

    res.json({ ok: true, brandDna: row, fullProfile });
  } catch (e: any) {
    logger.error("brand-dna GET error", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/projects/:projectId/brand-dna/extract-full
// Comprehensive Brand DNA extraction — scrapes multiple pages in parallel, runs full Claude analysis
router.post("/projects/:projectId/brand-dna/extract-full", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    await ensureMigration();

    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) { res.status(400).json({ error: "projectId inválido" }); return; }

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    const { websiteUrl } = req.body as { websiteUrl?: string };
    const baseUrl = (websiteUrl?.trim() ||
      (project.shopDomain ? (project.shopDomain.includes("://") ? project.shopDomain : `https://${project.shopDomain}`) : "")
    ).replace(/\/$/, "");

    if (!baseUrl) { res.status(400).json({ error: "URL del sitio web requerida" }); return; }

    // Mark as extracting
    await db.execute(sql`UPDATE brand_dna SET extraction_status = 'extracting' WHERE project_id = ${projectId}`);

    // BLOQUE 1: Crawl multi-página desde sitemap.xml + extracción Google Reviews en paralelo
    const brandName = project.name || baseUrl;

    const [crawlResult, googleProfile] = await Promise.all([
      crawlSiteFromSitemap(baseUrl, 25),
      extractGoogleBusinessProfile(brandName, baseUrl).catch(() => null),
    ]);

    const techBlock = formatTechStackForPrompt(crawlResult.techStack);
    const reviewsBlock = googleProfile ? formatGoogleReviewsForPrompt(googleProfile) : "";
    const socialHandlesFromCrawl = crawlResult.socialHandles.join(", ");

    const enrichedContent = [
      crawlResult.allContent,
      "",
      "=== ANÁLISIS TÉCNICO DEL SITIO ===",
      techBlock,
      socialHandlesFromCrawl && `REDES SOCIALES DETECTADAS EN SITIO: ${socialHandlesFromCrawl}`,
      crawlResult.colorPalette.length && `PALETA DE COLORES DEL SITIO: ${crawlResult.colorPalette.slice(0, 15).join(", ")}`,
      crawlResult.sitemapFound && `SITEMAP: Sí — ${crawlResult.totalPagesDiscovered} páginas descubiertas, ${crawlResult.pagesCrawled} analizadas`,
      "",
      reviewsBlock && "=== GOOGLE BUSINESS PROFILE ===",
      reviewsBlock,
    ].filter(Boolean).join("\n").slice(0, 22000);

    const allContent = enrichedContent;

    if (!allContent.trim() || crawlResult.pagesCrawled === 0) {
      res.status(422).json({ error: "No se pudo extraer contenido del sitio web. Verifica que la URL sea accesible." });
      return;
    }

    // BLOQUE 2: Análisis Claude — extracción de ADN completa
    const system = `${SHOPIFY_EXPERT_SYSTEM} Eres el experto máximo en análisis de identidad de marca y branding estratégico. Analizas datos reales de sitios web (${crawlResult.pagesCrawled} páginas analizadas), tech stack detectado y reseñas de Google para extraer el ADN de marca más completo y verídico posible. Siempre devuelves JSON válido sin markdown.`;

    interface DnaResult extends FullBrandDna {}

    const profile = await askClaudeJsonWithBrain<DnaResult>(
      projectId,
      BRAND_DNA_EXTRACTION_PROMPT(allContent, brandName, baseUrl),
      system,
      "brand_analysis",
      undefined,
      16000,
      240_000,
    );

    // BLOQUE 3: Guardar en DB (raw SQL para las nuevas columnas)
    const colors = profile.visualIdentity?.primaryColors ?? [];
    const secondaryColors = profile.visualIdentity?.secondaryColors ?? [];
    const allColors = [...colors, ...secondaryColors];
    const socialHandles = (profile.digitalPresence?.socialHandles ?? []).map(h => `${h.platform}:${h.handle}`);
    const services = (profile.services ?? []).map(s => s.name);
    const profileJson = JSON.stringify(profile);

    const existing = await db.execute(sql`SELECT id FROM brand_dna WHERE project_id = ${projectId} LIMIT 1`);

    if (existing.rows.length > 0) {
      await db.execute(sql`
        UPDATE brand_dna SET
          primary_colors = ${allColors}::text[],
          typography_style = ${profile.visualIdentity?.typographyStyle ?? null},
          layout_pattern = ${profile.visualIdentity?.layoutPattern ?? null},
          visual_density = ${profile.visualIdentity?.visualDensity ?? null},
          tone_of_voice = ${profile.brandIdentity?.tone ?? null},
          value_propositions = ${(profile.brandIdentity?.messagingPillars ?? [])}::text[],
          target_audience = ${profile.targetAudience?.primary ?? null},
          photography_style = ${profile.visualIdentity?.photographyStyle ?? null},
          brand_personality = ${(profile.brandIdentity?.personality ?? []).join(", ")},
          competitive_position = ${profile.marketPosition?.competitiveAdvantage ?? null},
          extracted_from_url = ${baseUrl},
          sector = ${profile.companyInfo?.sector ?? null},
          company_description = ${profile.companyInfo?.description ?? null},
          services = ${services}::text[],
          brand_values = ${(profile.brandIdentity?.values ?? [])}::text[],
          brand_archetype = ${profile.brandIdentity?.archetype ?? null},
          social_handles = ${socialHandles}::text[],
          unique_value_proposition = ${profile.brandIdentity?.uniqueValueProposition ?? null},
          taglines = ${(profile.brandIdentity?.taglines ?? [])}::text[],
          content_pillars = ${(profile.contentStrategy?.contentPillars ?? [])}::text[],
          website_url = ${baseUrl},
          full_profile_json = ${profileJson},
          extraction_status = 'done',
          updated_at = NOW()
        WHERE project_id = ${projectId}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO brand_dna (
          project_id, primary_colors, typography_style, layout_pattern, visual_density,
          tone_of_voice, value_propositions, target_audience, photography_style,
          brand_personality, competitive_position, extracted_from_url,
          sector, company_description, services, brand_values, brand_archetype,
          social_handles, unique_value_proposition, taglines, content_pillars,
          website_url, full_profile_json, extraction_status
        ) VALUES (
          ${projectId},
          ${allColors}::text[],
          ${profile.visualIdentity?.typographyStyle ?? null},
          ${profile.visualIdentity?.layoutPattern ?? null},
          ${profile.visualIdentity?.visualDensity ?? null},
          ${profile.brandIdentity?.tone ?? null},
          ${(profile.brandIdentity?.messagingPillars ?? [])}::text[],
          ${profile.targetAudience?.primary ?? null},
          ${profile.visualIdentity?.photographyStyle ?? null},
          ${(profile.brandIdentity?.personality ?? []).join(", ")},
          ${profile.marketPosition?.competitiveAdvantage ?? null},
          ${baseUrl},
          ${profile.companyInfo?.sector ?? null},
          ${profile.companyInfo?.description ?? null},
          ${services}::text[],
          ${(profile.brandIdentity?.values ?? [])}::text[],
          ${profile.brandIdentity?.archetype ?? null},
          ${socialHandles}::text[],
          ${profile.brandIdentity?.uniqueValueProposition ?? null},
          ${(profile.brandIdentity?.taglines ?? [])}::text[],
          ${(profile.contentStrategy?.contentPillars ?? [])}::text[],
          ${baseUrl},
          ${profileJson},
          'done'
        )
      `);
    }

    // BLOQUE 4: Actualizar projectsTable con campos clave
    const projectUpdates: Record<string, string> = {};
    if (profile.companyInfo?.sector) projectUpdates.storeNiche = profile.companyInfo.sector;
    if (profile.brandIdentity?.tone) projectUpdates.brandTone = profile.brandIdentity.tone;
    if (profile.targetAudience?.primary) projectUpdates.targetAudience = profile.targetAudience.primary;
    if (Object.keys(projectUpdates).length > 0) {
      await db.update(projectsTable).set(projectUpdates as any).where(eq(projectsTable.id, projectId)).catch(() => {});
    }

    // BLOQUE 5: Aprender del resultado
    if (profile.companyInfo?.name || brandName) {
      learnFromOperation({
        operationType: "brand_analysis",
        niche: profile.companyInfo?.sector ?? project.storeNiche ?? "general",
        title: `Brand DNA extraído: ${profile.companyInfo?.name ?? brandName}`,
        content: `Sector: ${profile.companyInfo?.sector ?? ""}\nArquetipo: ${profile.brandIdentity?.archetype ?? ""}\nUVP: ${profile.brandIdentity?.uniqueValueProposition ?? ""}\nTono: ${profile.brandIdentity?.tone ?? ""}\nAudiencia: ${profile.targetAudience?.primary ?? ""}\nSummary: ${profile.intelligence?.summary ?? ""}`,
        confidence: profile.intelligence?.confidenceScore ?? 0.75,
        tags: ["brand_dna", "full_extraction", profile.companyInfo?.sector ?? "", profile.brandIdentity?.archetype ?? ""].filter(Boolean),
      });
    }

    res.json({
      ok: true,
      websiteUrl: baseUrl,
      profile,
      pagesScraped: crawlResult.pagesCrawled,
      totalPagesDiscovered: crawlResult.totalPagesDiscovered,
      sitemapFound: crawlResult.sitemapFound,
      techStack: crawlResult.techStack,
      googleProfile: googleProfile ?? null,
      socialHandles: crawlResult.socialHandles,
    });

  } catch (e: any) {
    logger.error("brand-dna extract-full error", e);
    try {
      const projectId = parseInt(req.params.projectId, 10);
      if (!isNaN(projectId)) {
        await db.execute(sql`UPDATE brand_dna SET extraction_status = 'error' WHERE project_id = ${projectId}`).catch(() => {});
      }
    } catch { /* ignore */ }
    res.status(500).json({ error: e.message ?? "Error en extracción de Brand DNA" });
  }
});

// PUT /api/projects/:projectId/brand-dna
// Manual update of brand DNA fields
router.put("/projects/:projectId/brand-dna", async (req, res): Promise<void> => {
  try {
    await ensureMigration();
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) { res.status(400).json({ error: "projectId inválido" }); return; }

    const { fullProfile } = req.body as { fullProfile: FullBrandDna };
    if (!fullProfile) { res.status(400).json({ error: "fullProfile requerido" }); return; }

    const colors = fullProfile.visualIdentity?.primaryColors ?? [];
    const socialHandles = (fullProfile.digitalPresence?.socialHandles ?? []).map(h => `${h.platform}:${h.handle}`);
    const services = (fullProfile.services ?? []).map(s => s.name);
    const profileJson = JSON.stringify(fullProfile);

    const existing = await db.execute(sql`SELECT id FROM brand_dna WHERE project_id = ${projectId} LIMIT 1`);

    if (existing.rows.length > 0) {
      await db.execute(sql`
        UPDATE brand_dna SET
          primary_colors = ${colors}::text[],
          tone_of_voice = ${fullProfile.brandIdentity?.tone ?? null},
          value_propositions = ${(fullProfile.brandIdentity?.messagingPillars ?? [])}::text[],
          target_audience = ${fullProfile.targetAudience?.primary ?? null},
          photography_style = ${fullProfile.visualIdentity?.photographyStyle ?? null},
          brand_personality = ${(fullProfile.brandIdentity?.personality ?? []).join(", ")},
          sector = ${fullProfile.companyInfo?.sector ?? null},
          company_description = ${fullProfile.companyInfo?.description ?? null},
          services = ${services}::text[],
          brand_values = ${(fullProfile.brandIdentity?.values ?? [])}::text[],
          brand_archetype = ${fullProfile.brandIdentity?.archetype ?? null},
          social_handles = ${socialHandles}::text[],
          unique_value_proposition = ${fullProfile.brandIdentity?.uniqueValueProposition ?? null},
          taglines = ${(fullProfile.brandIdentity?.taglines ?? [])}::text[],
          content_pillars = ${(fullProfile.contentStrategy?.contentPillars ?? [])}::text[],
          full_profile_json = ${profileJson},
          updated_at = NOW()
        WHERE project_id = ${projectId}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO brand_dna (project_id, primary_colors, tone_of_voice, value_propositions, target_audience,
          photography_style, brand_personality, sector, company_description, services,
          brand_values, brand_archetype, social_handles, unique_value_proposition,
          taglines, content_pillars, full_profile_json, extraction_status)
        VALUES (
          ${projectId}, ${colors}::text[], ${fullProfile.brandIdentity?.tone ?? null},
          ${(fullProfile.brandIdentity?.messagingPillars ?? [])}::text[],
          ${fullProfile.targetAudience?.primary ?? null},
          ${fullProfile.visualIdentity?.photographyStyle ?? null},
          ${(fullProfile.brandIdentity?.personality ?? []).join(", ")},
          ${fullProfile.companyInfo?.sector ?? null},
          ${fullProfile.companyInfo?.description ?? null},
          ${services}::text[], ${(fullProfile.brandIdentity?.values ?? [])}::text[],
          ${fullProfile.brandIdentity?.archetype ?? null}, ${socialHandles}::text[],
          ${fullProfile.brandIdentity?.uniqueValueProposition ?? null},
          ${(fullProfile.brandIdentity?.taglines ?? [])}::text[],
          ${(fullProfile.contentStrategy?.contentPillars ?? [])}::text[],
          ${profileJson}, 'manual'
        )
      `);
    }

    res.json({ ok: true });
  } catch (e: any) {
    logger.error("brand-dna PUT error", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/projects/:projectId/brand-dna/research-by-name
// Brand DNA research using only the info provided (name, niche, socials, description) — no URL required
router.post("/projects/:projectId/brand-dna/research-by-name", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    await ensureMigration();
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) { res.status(400).json({ error: "projectId inválido" }); return; }

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    const brandName = project.name;
    const niche = (project as any).storeNiche ?? "";
    const tone = (project as any).brandTone ?? "";
    const audience = (project as any).targetAudience ?? "";
    const markets = (project as any).storeMarkets ?? "";
    const description = (project as any).projectDescription ?? "";
    const instagram = (project as any).instagramHandle ?? "";
    const tiktok = (project as any).tiktokHandle ?? "";
    const linkedin = (project as any).linkedinUrl ?? "";
    const facebook = (project as any).facebookUrl ?? "";
    const youtube = (project as any).youtubeUrl ?? "";

    await db.execute(sql`
      INSERT INTO brand_dna (project_id, extraction_status)
      VALUES (${projectId}, 'extracting')
      ON CONFLICT (project_id) DO UPDATE SET extraction_status = 'extracting'
    `).catch(() => {});

    const contextBlock = [
      `NOMBRE DE LA MARCA: ${brandName}`,
      niche && `SECTOR/NICHO: ${niche}`,
      tone && `TONO DE MARCA (indicado por el cliente): ${tone}`,
      audience && `AUDIENCIA OBJETIVO: ${audience}`,
      markets && `MERCADOS: ${markets}`,
      description && `DESCRIPCIÓN DEL PROYECTO/ENCARGO: ${description}`,
      "",
      "REDES SOCIALES:",
      instagram && `Instagram: ${instagram}`,
      tiktok && `TikTok: ${tiktok}`,
      linkedin && `LinkedIn: ${linkedin}`,
      facebook && `Facebook: ${facebook}`,
      youtube && `YouTube: ${youtube}`,
    ].filter(Boolean).join("\n");

    const prompt = `Eres un experto mundial en branding estratégico e identidad de marca. Tu misión es construir el Brand DNA más completo posible para la marca "${brandName}" usando la información proporcionada y tu conocimiento.

INFORMACIÓN PROPORCIONADA POR EL CLIENTE:
${contextBlock}

INSTRUCCIONES:
- Usa los datos proporcionados como base y enriquécelos con inferencias estratégicas coherentes.
- Si el cliente indicó un tono, úsalo. Si indicó nicho, especifícalo al máximo.
- Para campos sin datos explícitos, infiere de forma coherente con el nombre, sector y contexto.
- Los social handles detectados deben usarse en digitalPresence.socialHandles.
- dataQuality debe ser "inferred" ya que no hay datos de scraping web real.
- confidenceScore: 0.65 (buena inferencia sin web scraping).
- Devuelve SOLO JSON válido con la misma estructura que se describe a continuación.

${BRAND_DNA_EXTRACTION_PROMPT(contextBlock, brandName, "")}`;

    interface DnaResult extends FullBrandDna {}

    const profile = await askClaudeJsonWithBrain<DnaResult>(
      projectId,
      prompt,
      `${SHOPIFY_EXPERT_SYSTEM} Eres experto en identidad de marca y branding estratégico. Construyes perfiles de Brand DNA completos y estratégicamente coherentes basándote en el contexto del cliente. Siempre devuelves JSON válido sin markdown.`,
      "brand_analysis",
      undefined,
      8000,
      120_000,
    );

    const colors = profile.visualIdentity?.primaryColors ?? [];
    const secondaryColors = profile.visualIdentity?.secondaryColors ?? [];
    const allColors = [...colors, ...secondaryColors];
    const socialHandles: string[] = [];
    if (instagram) socialHandles.push(`instagram:${instagram}`);
    if (tiktok) socialHandles.push(`tiktok:${tiktok}`);
    if (linkedin) socialHandles.push(`linkedin:${linkedin}`);
    if (facebook) socialHandles.push(`facebook:${facebook}`);
    if (youtube) socialHandles.push(`youtube:${youtube}`);
    (profile.digitalPresence?.socialHandles ?? []).forEach(h => {
      const key = `${h.platform}:${h.handle}`;
      if (!socialHandles.includes(key)) socialHandles.push(key);
    });
    const services = (profile.services ?? []).map(s => s.name);
    const profileJson = JSON.stringify(profile);

    const existing = await db.execute(sql`SELECT id FROM brand_dna WHERE project_id = ${projectId} LIMIT 1`);

    if (existing.rows.length > 0) {
      await db.execute(sql`
        UPDATE brand_dna SET
          primary_colors = ${allColors}::text[],
          typography_style = ${profile.visualIdentity?.typographyStyle ?? null},
          layout_pattern = ${profile.visualIdentity?.layoutPattern ?? null},
          visual_density = ${profile.visualIdentity?.visualDensity ?? null},
          tone_of_voice = ${profile.brandIdentity?.tone ?? null},
          value_propositions = ${(profile.brandIdentity?.messagingPillars ?? [])}::text[],
          target_audience = ${profile.targetAudience?.primary ?? null},
          photography_style = ${profile.visualIdentity?.photographyStyle ?? null},
          brand_personality = ${(profile.brandIdentity?.personality ?? []).join(", ")},
          competitive_position = ${profile.marketPosition?.competitiveAdvantage ?? null},
          sector = ${profile.companyInfo?.sector ?? null},
          company_description = ${profile.companyInfo?.description ?? null},
          services = ${services}::text[],
          brand_values = ${(profile.brandIdentity?.values ?? [])}::text[],
          brand_archetype = ${profile.brandIdentity?.archetype ?? null},
          social_handles = ${socialHandles}::text[],
          unique_value_proposition = ${profile.brandIdentity?.uniqueValueProposition ?? null},
          taglines = ${(profile.brandIdentity?.taglines ?? [])}::text[],
          content_pillars = ${(profile.contentStrategy?.contentPillars ?? [])}::text[],
          full_profile_json = ${profileJson},
          extraction_status = 'done',
          updated_at = NOW()
        WHERE project_id = ${projectId}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO brand_dna (
          project_id, primary_colors, typography_style, layout_pattern, visual_density,
          tone_of_voice, value_propositions, target_audience, photography_style,
          brand_personality, competitive_position,
          sector, company_description, services, brand_values, brand_archetype,
          social_handles, unique_value_proposition, taglines, content_pillars,
          full_profile_json, extraction_status
        ) VALUES (
          ${projectId}, ${allColors}::text[],
          ${profile.visualIdentity?.typographyStyle ?? null},
          ${profile.visualIdentity?.layoutPattern ?? null},
          ${profile.visualIdentity?.visualDensity ?? null},
          ${profile.brandIdentity?.tone ?? null},
          ${(profile.brandIdentity?.messagingPillars ?? [])}::text[],
          ${profile.targetAudience?.primary ?? null},
          ${profile.visualIdentity?.photographyStyle ?? null},
          ${(profile.brandIdentity?.personality ?? []).join(", ")},
          ${profile.marketPosition?.competitiveAdvantage ?? null},
          ${profile.companyInfo?.sector ?? null},
          ${profile.companyInfo?.description ?? null},
          ${services}::text[], ${(profile.brandIdentity?.values ?? [])}::text[],
          ${profile.brandIdentity?.archetype ?? null}, ${socialHandles}::text[],
          ${profile.brandIdentity?.uniqueValueProposition ?? null},
          ${(profile.brandIdentity?.taglines ?? [])}::text[],
          ${(profile.contentStrategy?.contentPillars ?? [])}::text[],
          ${profileJson}, 'done'
        )
      `);
    }

    if (profile.companyInfo?.sector) {
      await db.update(projectsTable).set({
        storeNiche: profile.companyInfo.sector,
        brandTone: profile.brandIdentity?.tone ?? undefined,
        targetAudience: profile.targetAudience?.primary ?? undefined,
      } as any).where(eq(projectsTable.id, projectId)).catch(() => {});
    }

    learnFromOperation({
      operationType: "brand_analysis",
      niche: profile.companyInfo?.sector ?? niche ?? "general",
      title: `Brand DNA por nombre: ${brandName}`,
      content: `Sector: ${profile.companyInfo?.sector ?? ""}\nArquetipo: ${profile.brandIdentity?.archetype ?? ""}\nUVP: ${profile.brandIdentity?.uniqueValueProposition ?? ""}\nTono: ${profile.brandIdentity?.tone ?? ""}\nSummary: ${profile.intelligence?.summary ?? ""}`,
      confidence: profile.intelligence?.confidenceScore ?? 0.65,
      tags: ["brand_dna", "name_research", profile.companyInfo?.sector ?? "", profile.brandIdentity?.archetype ?? ""].filter(Boolean),
    });

    res.json({ ok: true, profile, method: "name_research" });

  } catch (e: any) {
    logger.error("brand-dna research-by-name error", e);
    try {
      const projectId = parseInt(req.params.projectId, 10);
      if (!isNaN(projectId)) {
        await db.execute(sql`UPDATE brand_dna SET extraction_status = 'error' WHERE project_id = ${projectId}`).catch(() => {});
      }
    } catch { /* ignore */ }
    res.status(500).json({ error: e.message ?? "Error en investigación de marca" });
  }
});

export default router;
