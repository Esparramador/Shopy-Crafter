import { Router } from "express";
import { askClaudeWithVision, claude, SHOPIFY_EXPERT_SYSTEM } from "../lib/claude.js";

const router = Router();

const IMAGE_ANALYSIS_SYSTEM = `${SHOPIFY_EXPERT_SYSTEM}

Eres un experto visual en análisis de productos y marketing de ecommerce. Cuando te muestren imágenes de productos o referencias visuales, extrae toda la información útil con máximo detalle para poder replicar o mejorar el contenido.`;

const VIDEO_ANALYSIS_SYSTEM = `${SHOPIFY_EXPERT_SYSTEM}

Eres un experto en análisis de contenido de video para ecommerce. Cuando analices metadatos de un vídeo, extrae todo el valor estratégico: narrativa, estructura, mensajes clave, estilo visual, llamadas a la acción, y cómo replicar o mejorar ese formato de contenido.`;

/**
 * POST /api/reference/analyze-image
 * Body: { images: Array<{ base64: string; mediaType: string; name?: string }>, context?: string, projectId?: number }
 * Returns: { intelligence: string } — extracted style, textures, colors, composition, brand feel, etc.
 */
router.post("/reference/analyze-image", async (req, res): Promise<void> => {
  const { images, context, projectId } = req.body as {
    images: Array<{ base64: string; mediaType: string; name?: string }>;
    context?: string;
    projectId?: number;
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
        ? img.mediaType
        : "image/jpeg") as ValidMediaType,
    }));

  if (validImages.length === 0) {
    res.status(400).json({ error: "Imágenes no válidas" });
    return;
  }

  const prompt = `Analiza ${validImages.length > 1 ? `estas ${validImages.length} imágenes de referencia` : "esta imagen de referencia"} en detalle para uso en generación de contenido de ecommerce.

${context ? `Contexto adicional del usuario: ${context}` : ""}

Extrae y documenta TODO lo que sea útil:

**PRODUCTO Y CONTENIDO:**
- ¿Qué producto o productos se muestran? Describe en detalle
- ¿Qué información comunica la imagen? ¿Qué explica o muestra?
- Textos visibles, claims, mensajes clave
- Propuesta de valor que transmite

**ESTILO VISUAL:**
- Paleta de colores exacta (colores dominantes, secundarios, acentos)
- Estilo fotográfico (studio, lifestyle, flat lay, editorial, UGC, etc.)
- Iluminación (natural, artificial, difusa, contrastada, dramática)
- Composición (centrada, regla de tercios, simétrica, dinámica)
- Fondo (blanco puro, neutro, texturizado, ambiente real, color sólido)
- Profundidad de campo y enfoque

**TEXTURAS Y MATERIALES:**
- Materiales visibles del producto (tela, metal, vidrio, madera, etc.)
- Acabados (mate, brillante, satinado, rugoso, suave)
- Texturas del entorno o props

**MARCA Y POSICIONAMIENTO:**
- Nivel de marca percibido (premium, accesible, artesanal, técnico, etc.)
- Público objetivo aparente
- Emociones que evoca

**PARA REPLICAR:**
- Cómo reproducir este estilo en nuevas imágenes
- Prompt sugerido para generar imágenes similares con IA

Responde en español, estructurado por secciones. Sé específico y accionable.`;

  try {
    const pid = typeof projectId === "number" ? projectId : 0;
    let intelligence: string;

    if (pid > 0) {
      intelligence = await askClaudeWithVision(pid, prompt, validImages, IMAGE_ANALYSIS_SYSTEM, 2048);
    } else {
      const client = (await import("@anthropic-ai/sdk")).default;
      const ant = new client({ apiKey: process.env.ANTHROPIC_API_KEY });
      const resp = await ant.messages.create(
        {
          model: "claude-sonnet-4-5",
          max_tokens: 2048,
          system: IMAGE_ANALYSIS_SYSTEM,
          messages: [
            {
              role: "user",
              content: [
                ...validImages.map((img) => ({
                  type: "image" as const,
                  source: { type: "base64" as const, media_type: img.mediaType, data: img.base64 },
                })),
                { type: "text" as const, text: prompt },
              ],
            },
          ],
        },
        { signal: AbortSignal.timeout(90_000) }
      );
      const c = resp.content[0];
      intelligence = c.type === "text" ? c.text : "";
    }

    res.json({ intelligence, imageCount: validImages.length });
  } catch (err: any) {
    console.error("[reference/analyze-image]", err);
    res.status(500).json({ error: err.message ?? "Error al analizar la imagen" });
  }
});

/**
 * POST /api/reference/analyze-video
 * Body: { url?: string; description?: string; title?: string; context?: string }
 * Returns: { intelligence: string } — extracted narrative, structure, style, messages
 */
router.post("/reference/analyze-video", async (req, res): Promise<void> => {
  const { url, description, title, context } = req.body as {
    url?: string;
    description?: string;
    title?: string;
    context?: string;
  };

  if (!url && !description && !title) {
    res.status(400).json({ error: "Se requiere URL, título o descripción del vídeo" });
    return;
  }

  let metaContext = "";

  if (url) {
    try {
      const normalized = url.startsWith("http") ? url : `https://${url}`;
      const pageRes = await fetch(normalized, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ShopifyAI/1.0)",
          "Accept": "text/html,*/*;q=0.9",
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const metaTitle = (html.match(/<title[^>]*>([^<]{1,200})<\/title>/i) ?? [])[1]?.trim() ?? "";
        const metaDesc = (html.match(/<meta[^>]*name="description"[^>]*content="([^"]{1,400})"/i) ?? [])[1]?.trim() ?? "";
        const ogTitle = (html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]{1,200})"/i) ?? [])[1]?.trim() ?? "";
        const ogDesc = (html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]{1,400})"/i) ?? [])[1]?.trim() ?? "";
        const ytDesc = (html.match(/"shortDescription":\s*"([^"]{1,800})"/i) ?? [])[1]?.trim() ?? "";
        metaContext = [
          metaTitle || ogTitle ? `Título: ${metaTitle || ogTitle}` : "",
          metaDesc || ogDesc ? `Descripción: ${metaDesc || ogDesc}` : "",
          ytDesc ? `Descripción completa: ${ytDesc.slice(0, 600)}` : "",
        ].filter(Boolean).join("\n");
      }
    } catch {
      /* scrapear es opcional */
    }
  }

  const prompt = `Analiza este vídeo de referencia para ecommerce/marketing y extrae todo el conocimiento estratégico y de contenido.

**DATOS DEL VÍDEO:**
${url ? `URL: ${url}` : ""}
${title ? `Título: ${title}` : ""}
${metaContext ? `\nMetadatos extraídos:\n${metaContext}` : ""}
${description ? `\nDescripción proporcionada por el usuario:\n${description}` : ""}
${context ? `\nContexto adicional: ${context}` : ""}

Basándote en toda esta información, analiza y extrae:

**NARRATIVA Y ESTRUCTURA:**
- ¿Qué historia cuenta el vídeo? ¿Cuál es el arco narrativo?
- Estructura temporal (apertura → desarrollo → cierre)
- Puntos de giro o momentos clave
- Duración aproximada y ritmo del contenido

**CONTENIDO Y MENSAJES:**
- Mensaje principal y mensajes secundarios
- Propuesta de valor comunicada
- Claims y promesas del producto
- Llamadas a la acción (CTAs)
- Testimonios o prueba social presente

**ESTILO VISUAL Y TÉCNICO:**
- Estilo de producción (casero/UGC, semi-pro, producción profesional, animación)
- Paleta de colores y ambiente visual
- Tipo de música o sonido (si es inferible)
- Velocidad y estilo de edición

**PRODUCTO Y MARCA:**
- Cómo se presenta el producto
- Qué aspectos del producto se destacan
- Público objetivo al que va dirigido
- Posicionamiento de marca

**PARA REPLICAR O MEJORAR:**
- Cómo crear contenido similar
- Qué mejorarías de este enfoque
- Prompt o brief creativo para generar contenido similar

Responde en español, estructurado y muy accionable.`;

  try {
    const intelligence = await claude(prompt, 2048);
    res.json({ intelligence, url: url ?? null, hasMetadata: !!metaContext });
  } catch (err: any) {
    console.error("[reference/analyze-video]", err);
    res.status(500).json({ error: err.message ?? "Error al analizar el vídeo" });
  }
});

export default router;
