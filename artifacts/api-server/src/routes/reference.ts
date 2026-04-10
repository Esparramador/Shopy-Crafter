/**
 * reference.ts — ShopyBrain Reference Intelligence Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Analyzes images and videos with maximum depth — extracts every component:
 * cinematography, color chemistry, composition geometry, rendering, textures,
 * lighting ratios, emotional arc, brand DNA, etc.
 *
 * CRITICAL: Every analysis is automatically ingested into ShopyBrain OmniCore
 * so the brain learns from every reference it processes.
 */

import { Router } from "express";
import { askClaudeWithVision, claude, SHOPIFY_EXPERT_SYSTEM } from "../lib/claude.js";
import { ingestImageKnowledge, ingestVideoKnowledge } from "../lib/brain-ingester.js";
import { enableLongRunning } from "../lib/long-running.js";

const router = Router();

// ── SYSTEM PROMPTS ──────────────────────────────────────────────────────────

const IMAGE_ANALYSIS_SYSTEM = `${SHOPIFY_EXPERT_SYSTEM}

Eres ShopyBrain Vision Engine — el sistema de análisis visual más avanzado del mundo para ecommerce Shopify.
Cuando analizas imágenes, extraes ABSOLUTAMENTE TODO: desde los componentes técnicos de la fotografía hasta la psicología detrás de cada decisión visual. Tu análisis alimenta directamente el conocimiento de ShopyBrain para que todas las futuras generaciones sean superiores.
Sé exhaustivo, técnico y estratégico. Responde siempre en español.`;

const VIDEO_ANALYSIS_SYSTEM = `${SHOPIFY_EXPERT_SYSTEM}

Eres ShopyBrain Cinematic Engine — el sistema de análisis de producción audiovisual para ecommerce Shopify.
Cuando analizas vídeos, extraes TODOS los componentes que forman la composición: cinematografía, química de colores, renderizado, texturas, composición geométrica, iluminación técnica, ritmo de edición, diseño sonoro, arco emocional, estructura narrativa, VFX, motion design, branding, y la globalización de todos estos elementos en un sistema coherente.
TODO el conocimiento absorbido se transforma en inteligencia accionable. Responde siempre en español.`;

// ── HELPERS ──────────────────────────────────────────────────────────────────

function extractNicheFromContext(context?: string): string | null {
  if (!context) return null;
  const nicheKeywords = [
    "moda", "fashion", "belleza", "beauty", "tecnologia", "tech", "hogar", "home",
    "deporte", "sport", "alimentacion", "food", "joyeria", "jewelry", "pet", "mascota",
    "niños", "baby", "outdoor", "arte", "art", "wellness", "salud", "gaming",
  ];
  const lower = context.toLowerCase();
  for (const kw of nicheKeywords) {
    if (lower.includes(kw)) return kw;
  }
  return null;
}

// ── IMAGE ANALYSIS ────────────────────────────────────────────────────────────

/**
 * POST /api/reference/analyze-image
 * Body: { images: Array<{ base64: string; mediaType: string; name?: string }>, context?: string, projectId?: number, niche?: string }
 */
router.post("/reference/analyze-image", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
    const { images, context, projectId, niche: bodyNiche } = req.body as {
      images: Array<{ base64: string; mediaType: string; name?: string }>;
      context?: string;
      projectId?: number;
      niche?: string;
    };
  
    if (!images || !Array.isArray(images) || images.length === 0) {
      res.status(400).json({ error: "Se requiere al menos una imagen" });
      return;
    }
    if (images.length > 5) {
      res.status(400).json({ error: "Máximo 5 imágenes por análisis" });
      return;
    }
  
    const validMediaTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
    type ValidMediaType = typeof validMediaTypes[number];
  
    const validImages = images
      .filter((img) => img.base64 && img.mediaType)
      .map((img) => ({
        base64: img.base64.replace(/^data:[^;]+;base64,/, ""),
        mediaType: (validMediaTypes.includes(img.mediaType as ValidMediaType)
          ? img.mediaType : "image/jpeg") as ValidMediaType,
      }));
  
    if (validImages.length === 0) {
      res.status(400).json({ error: "Imágenes no válidas" });
      return;
    }
  
    const niche = bodyNiche ?? extractNicheFromContext(context);
  
    const prompt = `Analiza ${validImages.length > 1 ? `estas ${validImages.length} imágenes de referencia` : "esta imagen de referencia"} con el máximo nivel de detalle técnico y estratégico para uso en ShopyBrain y generación de contenido de ecommerce.
  
  ${context ? `Contexto del usuario: ${context}` : ""}
  ${niche ? `Nicho detectado: ${niche}` : ""}
  
  ═══ ANÁLISIS COMPLETO ═══
  
  **1. PRODUCTO Y CONTENIDO COMUNICADO:**
  - ¿Qué producto/s se muestran? Descripción detallada
  - Qué información comunica visualmente
  - Textos visibles, claims, mensajes implícitos
  - Propuesta de valor transmitida
  - Beneficios comunicados sin palabras
  
  **2. FOTOGRAFÍA TÉCNICA:**
  - Tipo de plano (primer plano, plano general, detalle, cenital, picado, etc.)
  - Focal/lente estimada (gran angular, normal, teleobjetivo, macro)
  - Profundidad de campo y bokeh
  - Exposición y rango dinámico
  - Nitidez, distorsión, aberraciones intencionales
  - Técnica de fotografía (foto real, CGI, compositing, retoque)
  
  **3. ILUMINACIÓN:**
  - Fuentes de luz principales y relleno
  - Dirección y ángulo (frontal, lateral, contraluz, cenital)
  - Calidad de luz (dura, suave, difusa, puntual)
  - Temperatura de color (cálida, fría, neutra — en Kelvin aproximado)
  - Sombras (densidad, dirección, difuminado)
  - Reflejos, highlights y catchlights visibles
  - ¿Estudio controlado o luz natural/ambiente?
  
  **4. COMPOSICIÓN GEOMÉTRICA:**
  - Regla aplicada (tercios, simetría, diagonal, fibonacci, zentral)
  - Punto/s de atención y jerarquía visual
  - Equilibrio y peso visual
  - Líneas guía y vectores de movimiento visual
  - Espacio negativo y respiración visual
  - Proporción y escala relativa de elementos
  
  **5. PALETA DE COLORES Y QUÍMICA:**
  - Colores dominantes (aproximación HEX o RGB)
  - Colores secundarios y de acento
  - Armonía de color (análoga, complementaria, triádica, monocromática)
  - Saturación general y contraste cromático
  - Temperatura emocional de la paleta
  - Coherencia con la identidad de marca
  
  **6. TEXTURAS Y MATERIALES:**
  - Materiales del producto (tela: algodón/seda/denim/neopreno, metal: mate/pulido/cepillado, vidrio, madera, plástico, etc.)
  - Acabados superficiales (mate, brillante, satinado, rugoso, suave, velvety)
  - Texturas del entorno o props
  - Cómo las texturas comunican valor y calidad
  - Tactilidad implícita que transmite la imagen
  
  **7. RENDERIZADO Y ESTILO DE POST-PRODUCCIÓN:**
  - Tipo de tratamiento (fotografía pura, CGI completo, compositing, heavy retouch)
  - Estilo de retoque y skin/product retouching
  - Grading de color aplicado
  - Efectos aplicados (viñeteo, aberración cromática, grain, halos)
  - Limpieza vs naturalidad intencional
  - Nivel de "perfectness" vs autenticidad
  
  **8. ESTILO FOTOGRÁFICO GLOBAL:**
  - Categoría (studio, lifestyle, flat lay, editorial, UGC/social, lookbook, pack shot, CGI)
  - Referentes visuales de la fotografía (fotógrafos, marcas, estilos que recuerda)
  - Mood y atmósfera general
  - Época o tendencia visual (minimalismo, maximalism, grunge, clean, organic, etc.)
  
  **9. MARCA Y POSICIONAMIENTO:**
  - Nivel de lujo percibido (básico / mid / premium / ultra-luxury)
  - Público objetivo que la imagen atrae
  - Emociones que evoca y respuesta psicológica esperada
  - ¿Cómo posiciona el producto frente a competidores?
  - Coherencia con identidad de marca percibida
  
  **10. SÍNTESIS PARA SHOPYBRAIN — REPLICACIÓN:**
  - Fórmula precisa para replicar este estilo
  - Prompt optimizado para generar imágenes similares con Flux/DALL-E/Midjourney:
    \`\`\`
    [PROMPT IMAGEN IA]
    \`\`\`
  - 3 variaciones del mismo estilo para A/B testing
  - Qué cambiarías para el mercado español/latinoamericano
  - Cómo adaptar para diferentes tipos de productos en el mismo nicho
  
  Responde en español, con secciones numeradas. Máxima especificidad técnica.`;
  
    try {
      const pid = typeof projectId === "number" && projectId > 0 ? projectId : 0;
      let intelligence: string;
  
      if (pid > 0) {
        intelligence = await askClaudeWithVision(pid, prompt, validImages, IMAGE_ANALYSIS_SYSTEM, 3000);
      } else {
        const client = (await import("@anthropic-ai/sdk")).default;
        const ant = new client({ apiKey: process.env.ANTHROPIC_API_KEY });
        const resp = await ant.messages.create(
          {
            model: "claude-sonnet-4-5",
            max_tokens: 16000,
            system: IMAGE_ANALYSIS_SYSTEM,
            messages: [{
              role: "user",
              content: [
                ...validImages.map((img) => ({
                  type: "image" as const,
                  source: { type: "base64" as const, media_type: img.mediaType, data: img.base64 },
                })),
                { type: "text" as const, text: prompt },
              ],
            }],
          },
          { signal: AbortSignal.timeout(180_000) }
        );
        const c = resp.content[0];
        intelligence = c.type === "text" ? c.text : "";
      }
  
      // ── AUTO-INGEST TO SHOPYBRAIN ──────────────────────────────────────────
      ingestImageKnowledge({
        intelligence,
        niche,
        imageCount: validImages.length,
        title: `Análisis visual: ${context?.slice(0, 60) ?? `${validImages.length} imágenes de referencia`}`,
      });
  
      res.json({
        intelligence,
        imageCount: validImages.length,
        learnedByShopyBrain: true,
        niche: niche ?? null,
      });
    } catch (err: any) {
      console.error("[reference/analyze-image]", err);
      res.status(500).json({ error: err.message ?? "Error al analizar la imagen" });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ── VIDEO / CINEMATIC ANALYSIS ────────────────────────────────────────────────

/**
 * POST /api/reference/analyze-video
 * Body: { url?: string; description?: string; title?: string; context?: string; niche?: string }
 */
router.post("/reference/analyze-video", async (req, res): Promise<void> => {
  try {
    const { url, description, title, context, niche: bodyNiche } = req.body as {
      url?: string;
      description?: string;
      title?: string;
      context?: string;
      niche?: string;
    };
  
    if (!url && !description && !title) {
      res.status(400).json({ error: "Se requiere URL, título o descripción del vídeo" });
      return;
    }
  
    const niche = bodyNiche ?? extractNicheFromContext(context ?? description);
  
    // ── Scrape metadata if URL provided ──────────────────────────────────────
    let metaContext = "";
    if (url) {
      try {
        const normalized = url.startsWith("http") ? url : `https://${url}`;
        const pageRes = await fetch(normalized, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; ShopifyAIBot/1.0)",
            "Accept": "text/html,*/*;q=0.9",
          },
          signal: AbortSignal.timeout(30_000),
        });
        if (pageRes.ok) {
          const html = await pageRes.text();
          const metaTitle = (html.match(/<title[^>]*>([^<]{1,300})<\/title>/i) ?? [])[1]?.trim() ?? "";
          const metaDesc = (html.match(/<meta[^>]*name="description"[^>]*content="([^"]{1,500})"/i) ?? [])[1]?.trim() ?? "";
          const ogTitle = (html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]{1,300})"/i) ?? [])[1]?.trim() ?? "";
          const ogDesc = (html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]{1,500})"/i) ?? [])[1]?.trim() ?? "";
          const ytDesc = (html.match(/"shortDescription":\s*"([^"]{1,1000})"/i) ?? [])[1]?.trim() ?? "";
          const ytKeywords = (html.match(/"keywords":\s*"([^"]{1,300})"/i) ?? [])[1]?.trim() ?? "";
          const schemaDesc = (html.match(/"description":\s*"([^"]{1,500})"/i) ?? [])[1]?.trim() ?? "";
  
          metaContext = [
            metaTitle || ogTitle ? `Título: ${metaTitle || ogTitle}` : "",
            metaDesc || ogDesc ? `Descripción: ${metaDesc || ogDesc}` : "",
            ytDesc ? `Descripción completa: ${ytDesc.slice(0, 800)}` : "",
            ytKeywords ? `Keywords: ${ytKeywords}` : "",
            schemaDesc && !ytDesc ? `Schema desc: ${schemaDesc.slice(0, 300)}` : "",
          ].filter(Boolean).join("\n");
        }
      } catch {
        /* Scraping is optional — continue without metadata */
      }
    }
  
    const prompt = `Analiza este vídeo de referencia para ecommerce con MÁXIMA profundidad técnica, cinematográfica y estratégica.
  ShopyBrain absorberá TODO este conocimiento para mejorar todas las futuras generaciones de contenido.
  
  ═══ DATOS DEL VÍDEO ═══
  ${url ? `URL: ${url}` : ""}
  ${title ? `Título declarado: ${title}` : ""}
  ${metaContext ? `\nMetadatos scrapeados:\n${metaContext}` : ""}
  ${description ? `\nDescripción del usuario:\n${description}` : ""}
  ${context ? `\nContexto adicional: ${context}` : ""}
  ${niche ? `\nNicho de mercado: ${niche}` : ""}
  
  ═══ EXTRACCIÓN EXHAUSTIVA ═══
  
  **1. NARRATIVA Y ESTRUCTURA CINEMATOGRÁFICA:**
  - Arco narrativo completo (planteamiento → desarrollo → clímax → resolución)
  - Estructura temporal en actos o beats clave
  - Tipo de historia (demo producto, testimonial, branded content, tutorial, UGC, storytelling emocional)
  - Punto de vista narrativo (primera persona, tercera, omnisciente, POV del producto)
  - Ganchos y momentos de retención de atención
  - Ritmo narrativo (lento/contemplativo, rápido/dinámico, mixto)
  
  **2. CINEMATOGRAFÍA TÉCNICA:**
  - Tipos de planos utilizados (detalle, primer plano, plano medio, general, cenital, drone, POV, over-the-shoulder)
  - Movimientos de cámara (estático, travelling, zoom, dolly, handheld, steadicam, drone sweep)
  - Profundidad de campo y uso del desenfoque (bokeh)
  - Ángulos de cámara y punto de vista
  - Técnicas especiales (slow motion, time lapse, stop motion, cámara rápida)
  - Estabilización vs movimiento orgánico intencional
  
  **3. COMPOSICIÓN VISUAL Y GEOMETRÍA:**
  - Reglas de composición aplicadas (tercios, simetría, diagonal, profundidad, leading lines)
  - Distribución del peso visual frame a frame
  - Uso del espacio negativo
  - Proporción y escala de elementos en cuadro
  - Cómo se guía la mirada del espectador
  - Color blocking y equilibrio cromático visual
  
  **4. ILUMINACIÓN Y FOTOGRAFÍA DE LUZ:**
  - Esquema de iluminación dominante (3 puntos, Rembrandt, contraluz, silhouette, high-key, low-key)
  - Fuentes de luz (natural, HMI, LED, practicals/práctica, néon, natural+relleno)
  - Temperatura de color por escena (3200K tungsten, 5600K daylight, bicolor, mixto)
  - Ratios de iluminación (contraste entre luz principal y relleno)
  - Difusores, rebotadores, modificadores de luz
  - Cómo la luz refuerza el mensaje emocional y el producto
  
  **5. COLOR GRADING Y QUÍMICA DE COLOR:**
  - Paleta de color global y por escenas
  - LUT/Look aplicado (cine clásico, teal&orange, desaturado moody, hyper-saturado, vintage, clean/natural)
  - Contraste y curvas de tono (S-curve, lifted blacks, crushed shadows)
  - Tratamiento de altas luces (rolloff, blow-out intencional)
  - Separación de color en sombras vs luces
  - Temperatura y tinte global
  - Cómo el grading refuerza la marca y el mensaje
  - Coherencia cromática de marca (brand color chemistry)
  
  **6. TEXTURAS Y MATERIALES EN PANTALLA:**
  - Texturas del producto en movimiento (cómo se perciben los materiales)
  - Superficies y fondos (liso, texturizado, orgánico, abstracto)
  - Props y elementos escenográficos
  - Naturaleza (hojas, agua, tierra) vs industria vs hogar vs estudio
  - Cómo las texturas generan sensaciones táctiles a través de la pantalla
  - Materiales que elevan o bajan el valor percibido
  
  **7. RENDERIZADO Y TÉCNICA DE POST-PRODUCCIÓN:**
  - Tipo de producción (100% real, CGI, CGI+live action, animación 2D/3D, motion graphics)
  - Técnica de retoque y color (DaVinci Resolve, Premiere, Final Cut, Capcut estilo)
  - VFX y efectos visuales (partículas, transiciones, overlays, glitch, luma matte)
  - Títulos y tipografía en pantalla (font, peso, animación, timing)
  - Motion graphics y branded elements
  - Lower thirds y call-outs
  - Grain, noise, aberraciones o imperfecciones intencionales
  - Nivel de "producción" vs "autenticidad" buscada
  
  **8. DISEÑO SONORO Y MÚSICA:**
  - Tipo de música (original, licensed track, stock music, sin música)
  - BPM aproximado y cómo acompaña al ritmo visual
  - Uso de voz en off (profesional, casual, UGC, ASMR, narrator)
  - SFX y sound design (sonidos de producto, ambientes, foley)
  - Silencio como herramienta dramática
  - Cómo el audio refuerza el mensaje y las emociones
  
  **9. RITMO DE EDICIÓN Y MONTAJE:**
  - Duración total estimada y por segmento
  - Velocidad media de corte (cortes por minuto)
  - Tipos de transición (corte directo, fade, wipe, match cut, jump cut, whip pan)
  - Sincronización música-imagen (beat cutting, on-beat, off-beat)
  - Uso del slow motion para enfatizar momentos clave
  - Flujo de información (qué se muestra primero, qué se reserva para el final)
  - Hook en los primeros 3 segundos
  
  **10. STORYTELLING EMOCIONAL Y PSICOLOGÍA:**
  - Arco emocional que busca provocar en el espectador
  - Técnicas de identificación y empatía
  - Momentos de tensión y resolución
  - Uso del deseo, aspiración, FOMO, pertenencia, transformación
  - Prueba social y credibilidad implícita
  - Cómo se construye la confianza en el producto
  - Trigger emocional principal (belleza, poder, conexión, seguridad, placer, logro)
  
  **11. MARCA, PRODUCTO Y POSICIONAMIENTO:**
  - Cómo se presenta el producto en pantalla (hero moment, integrado en lifestyle, en uso)
  - Momentos de "money shot" del producto
  - Valores de marca comunicados sin palabras
  - Público objetivo explícito e implícito
  - Posicionamiento de precio y nivel de mercado (mass, mid, premium, luxury)
  - Competidores a los que hace referencia implícita
  - Call to action y conversión buscada
  
  **12. GLOBALIZACIÓN — SISTEMA TOTAL:**
  - Cómo todos los elementos anteriores se integran en un sistema coherente
  - La "química" entre color + luz + música + ritmo + narrativa
  - Qué hace que este vídeo funcione o falle como unidad
  - El "feeling" o sensación global que genera
  - Qué elementos son transferibles a otras categorías de producto
  
  **13. SÍNTESIS PARA SHOPYBRAIN — REPLICACIÓN Y MEJORA:**
  - Brief creativo completo para replicar este vídeo
  - Prompt para generar imágenes del mismo estilo:
    \`\`\`
    [PROMPT IMAGEN IA — estilo visual de este vídeo]
    \`\`\`
  - Guión de 30 segundos adaptado para el nicho ${niche ?? "de ecommerce español"}
  - 3 variaciones de concepto para A/B testing
  - Errores o debilidades del vídeo a evitar
  - Cómo elevar este formato para el mercado español/latinoamericano
  
  Responde en español. Sé exhaustivo, técnico y estratégico. Este análisis alimenta directamente el megacerebro ShopyBrain.`;
  
    try {
      const intelligence = await claude(prompt, 4000);
  
      // ── AUTO-INGEST TO SHOPYBRAIN ────────────────────────────────────────────
      ingestVideoKnowledge({
        intelligence,
        niche,
        videoUrl: url,
        title: title ?? metaContext.split("\n")[0]?.replace("Título: ", ""),
      });
  
      res.json({
        intelligence,
        url: url ?? null,
        hasMetadata: !!metaContext,
        learnedByShopyBrain: true,
        niche: niche ?? null,
        analysisDepth: "cinematic_full",
      });
    } catch (err: any) {
      console.error("[reference/analyze-video]", err);
      res.status(500).json({ error: err.message ?? "Error al analizar el vídeo" });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ── MANUAL INGEST ENDPOINT ───────────────────────────────────────────────────

/**
 * POST /api/reference/ingest
 * Manually ingest any text intelligence into ShopyBrain.
 * Body: { intelligence: string, sourceType: string, niche?: string, title?: string }
 */
router.post("/reference/ingest", async (req, res): Promise<void> => {
  try {
    const { intelligence, sourceType, niche, title } = req.body as {
      intelligence: string;
      sourceType: "image_reference" | "video_reference" | "manual";
      niche?: string;
      title?: string;
    };
  
    if (!intelligence || intelligence.trim().length < 50) {
      res.status(400).json({ error: "Se requiere inteligencia de al menos 50 caracteres" });
      return;
    }
  
    const { ingestToShopyBrain } = await import("../lib/brain-ingester.js");
    ingestToShopyBrain({
      sourceType: sourceType ?? "manual",
      rawIntelligence: intelligence,
      niche: niche ?? null,
      title: title ?? "Ingesta manual de inteligencia",
    });
  
    res.json({
      success: true,
      message: "Inteligencia enviada a ShopyBrain OmniCore para aprendizaje",
      learnedByShopyBrain: true,
      niche: niche ?? null,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

export default router;
