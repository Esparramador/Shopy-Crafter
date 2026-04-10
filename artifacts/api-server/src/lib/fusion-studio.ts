import { logger } from "./logger.js";
import { askClaudeVisionWithBrain, learnFromOperation } from "./claude.js";
import { askGeminiWithSearch } from "./gemini.js";

export interface ImageAnalysis {
  layers: Array<{
    name: string;
    description: string;
    coverage: string;
  }>;
  colors: {
    dominant: string[];
    palette: Array<{ hex: string; name: string; percentage: string }>;
    temperature: string;
    harmony: string;
  };
  textures: Array<{
    material: string;
    finish: string;
    area: string;
  }>;
  composition: {
    layout: string;
    perspective: string;
    depth: string;
    lighting: string;
    shadows: string;
  };
  product: {
    category: string;
    subcategory: string;
    estimatedMaterials: string[];
    estimatedWeight: string;
    estimatedDimensions: string;
    brandStyle: string;
    targetAudience: string;
    priceRange: string;
  };
  productGeneration: {
    suggestedTitle: string;
    suggestedDescription: string;
    suggestedTags: string[];
    suggestedCategory: string;
    suggestedPrice: string;
    seoKeywords: string[];
    photoBriefs: Array<{
      type: string;
      description: string;
      lighting: string;
      props: string[];
      background: string;
    }>;
  };
}

export async function analyzeImageForFusion(
  imageBase64: string,
  mimeType: string,
  additionalImages?: Array<{ base64: string; mimeType: string }>,
  context?: { niche?: string; brandTone?: string; targetAudience?: string }
): Promise<ImageAnalysis> {
  logger.info({ mimeType, hasAdditional: !!additionalImages?.length }, "Fusion Studio: Analyzing image");

  type VisionMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  const allImages: Array<{ base64: string; mediaType: VisionMediaType }> = [
    { base64: imageBase64, mediaType: mimeType as VisionMediaType },
  ];

  if (additionalImages) {
    for (const img of additionalImages.slice(0, 4)) {
      allImages.push({ base64: img.base64, mediaType: img.mimeType as VisionMediaType });
    }
  }

  const prompt = `Eres el Fusion Studio de ShopyBrain — un analizador experto de imágenes de producto que descompone CUALQUIER imagen en todas sus capas, partículas, texturas, colores y materiales.

ANALIZA ${additionalImages?.length ? `estas ${1 + additionalImages.length} imágenes` : "esta imagen"} con precisión absoluta.

${context?.niche ? `Contexto: Nicho ${context.niche}. Tono: ${context.brandTone ?? "profesional"}. Audiencia: ${context.targetAudience ?? "adultos"}.` : ""}

DESCOMPÓN la imagen en TODAS estas dimensiones:

1. **CAPAS VISUALES**: Separa mentalmente la imagen en capas (fondo, producto, sombras, reflejos, texto, decoración, packaging). Para cada capa: nombre, descripción, % de cobertura.

2. **ANÁLISIS DE COLOR**: 
   - Colores dominantes (hex exacto)
   - Paleta completa con % de cada color
   - Temperatura de color (cálida/fría/neutra)
   - Tipo de armonía cromática

3. **TEXTURAS Y MATERIALES**: 
   - Identifica CADA material visible (algodón, metal, plástico, cuero, madera, vidrio, cerámica, etc.)
   - Acabado de cada material (mate, brillante, satinado, rugoso, suave)
   - En qué zona de la imagen está

4. **COMPOSICIÓN**:
   - Layout (centrado, tercios, diagonal, simétrico)
   - Perspectiva (frontal, cenital, 3/4, isométrica, lifestyle)
   - Profundidad de campo (plano, media, bokeh)
   - Iluminación (tipo, dirección, dureza)
   - Sombras (tipo, dirección)

5. **PRODUCTO DETECTADO**:
   - Categoría y subcategoría del producto
   - Materiales estimados de fabricación
   - Peso y dimensiones estimados
   - Estilo de marca que transmite
   - Audiencia objetivo
   - Rango de precio estimado

6. **GENERACIÓN DE PRODUCTO** (para crear el producto en la tienda):
   - Título SEO sugerido (70 chars máx, con keywords)
   - Descripción HTML de 800+ palabras con 8 secciones (Descripción, Características, Material, Tallas/Medidas, Cuidados, Envío, FAQ, Trust badges)
   - 15-25 tags SEO relevantes
   - Categoría sugerida
   - Precio sugerido basado en el análisis visual y materiales
   - 5 keywords SEO principales
   - 6 photo briefs para generar imágenes profesionales adicionales (hero, lifestyle, detalle, escala, packaging, UGC)

RESPONDE EXCLUSIVAMENTE con JSON válido con esta estructura:
{
  "layers": [...],
  "colors": { "dominant": [...], "palette": [...], "temperature": "...", "harmony": "..." },
  "textures": [...],
  "composition": { "layout": "...", "perspective": "...", "depth": "...", "lighting": "...", "shadows": "..." },
  "product": { "category": "...", "subcategory": "...", "estimatedMaterials": [...], "estimatedWeight": "...", "estimatedDimensions": "...", "brandStyle": "...", "targetAudience": "...", "priceRange": "..." },
  "productGeneration": { "suggestedTitle": "...", "suggestedDescription": "...(HTML)...", "suggestedTags": [...], "suggestedCategory": "...", "suggestedPrice": "...", "seoKeywords": [...], "photoBriefs": [...] }
}`;

  const text = await askClaudeVisionWithBrain(
    0,
    prompt,
    allImages,
    `Eres el Fusion Studio de ShopyBrain — sistema experto de descomposición visual de productos para eCommerce.`,
    "images",
    context?.niche,
    16000,
  );
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in Fusion Studio response");

  const analysis = JSON.parse(jsonMatch[0]) as ImageAnalysis;

  learnFromOperation({
    operationType: "fusion_studio_analysis",
    title: `Fusion Studio: ${analysis.product?.category ?? "producto"} — ${analysis.product?.subcategory ?? ""}`,
    content: `Análisis Fusion Studio: Categoría ${analysis.product?.category}. Materiales: ${analysis.textures?.map(t => t.material).join(", ")}. Colores: ${analysis.colors?.dominant?.join(", ")}. Estilo: ${analysis.product?.brandStyle}. Precio estimado: ${analysis.product?.priceRange}. Composición: ${analysis.composition?.layout}, ${analysis.composition?.lighting}.`,
    confidence: 0.85,
    tags: ["fusion-studio", analysis.product?.category ?? "product", "image-analysis"],
  });

  logger.info({
    category: analysis.product?.category,
    materials: analysis.textures?.length,
    colors: analysis.colors?.palette?.length,
  }, "Fusion Studio analysis complete");

  return analysis;
}

export async function researchBrandForFusion(opts: {
  url?: string;
  instagram?: string;
  companyName?: string;
  niche?: string;
  brandStyle?: string;
  colors?: string[];
}): Promise<{
  brandInfo: Record<string, unknown> | null;
  instagramInfo: Record<string, unknown> | null;
  competitorPhotography: Record<string, unknown> | null;
  photographyTrends: Record<string, unknown> | null;
}> {
  const searchName = opts.companyName || opts.url?.replace(/https?:\/\/(www\.)?/, "").split("/")[0] || "brand";

  const parseSafe = (r: PromiseSettledResult<{ text: string; sources: string[]; queries: string[] }>): Record<string, unknown> | null => {
    if (r.status !== "fulfilled") return null;
    try {
      const text = r.value?.text ?? "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch { return null; }
  };

  logger.info({ searchName, url: opts.url, instagram: opts.instagram }, "Fusion Studio: Starting brand research with 4 parallel Gemini searches");

  const [brandResult, igResult, compPhotoResult, trendsResult] = await Promise.allSettled([
    askGeminiWithSearch(
      `Research "${searchName}"${opts.url ? ` (${opts.url})` : ""}. Find: industry, target audience (age, gender, income), brand style (luxury/streetwear/minimal/artisanal/tech/etc), brand colors (hex codes), price range, brand values, photography style used in their marketing. Return ONLY JSON: { "name": "", "sector": "", "audience": "", "style": "", "colors": [], "values": [], "priceRange": "", "photographyStyle": "", "luxuryLevel": 0, "designAdjectives": [] }`,
      "Brand photography analyst. Return ONLY valid JSON."
    ),
    opts.instagram
      ? askGeminiWithSearch(
          `Analyze @${opts.instagram} on Instagram. Focus on PHOTOGRAPHY STYLE: lighting (natural/studio/dramatic), backgrounds (white/lifestyle/outdoor), angles (frontal/3-4/overhead), editing (high contrast/muted/vibrant), props commonly used, composition patterns. JSON: { "handle": "", "followers": "", "aesthetic": "", "photoLighting": "", "photoBackgrounds": [], "photoAngles": [], "editingStyle": "", "propsUsed": [], "colors": [], "mood": "" }`,
          "Instagram product photography analyst. Return ONLY JSON."
        )
      : askGeminiWithSearch(
          `Search for "${searchName}" official Instagram. If found, analyze their product photography style. JSON: { "handle": "", "found": false, "aesthetic": "", "photoLighting": "", "photoBackgrounds": [] }`,
          "Social media researcher. Return ONLY JSON."
        ),
    askGeminiWithSearch(
      `Find 3 competitors of "${searchName}" in ${opts.niche || "ecommerce"}. Analyze their PRODUCT PHOTOGRAPHY specifically: backgrounds, lighting, props, angles, editing style. JSON: { "competitors": [{ "name": "", "url": "", "photoStyle": "", "backgrounds": [], "lighting": "", "props": [], "highlights": "" }] }`,
      "Competitive product photography analyst. Return ONLY JSON."
    ),
    askGeminiWithSearch(
      `What are the best product photography trends for ${opts.niche || searchName + "'s sector"} in 2026? Find award-winning product photos in this industry. What lighting, backgrounds, angles, props work best? JSON: { "trends": [], "bestPractices": { "lighting": "", "backgrounds": [], "angles": [], "props": [], "editing": "" }, "examples": [{ "brand": "", "why": "" }] }`,
      "Product photography trend analyst. Return ONLY JSON."
    ),
  ]);

  logger.info({ searchName }, "Fusion Studio: Brand research complete");

  return {
    brandInfo: parseSafe(brandResult),
    instagramInfo: parseSafe(igResult),
    competitorPhotography: parseSafe(compPhotoResult),
    photographyTrends: parseSafe(trendsResult),
  };
}

export async function autoSuggestPhotoSettings(
  productAnalysis: ImageAnalysis,
  brandDna: Record<string, unknown> | null,
): Promise<{
  lighting: string;
  background: string;
  perspective: string;
  props: string[];
  colorGrading: string;
  reasoning: string;
}> {
  const prompt = `You are a SENIOR PRODUCT PHOTOGRAPHER. Based on this product analysis and brand DNA, suggest the OPTIMAL photo settings.

PRODUCT: ${productAnalysis.product?.category} — ${productAnalysis.product?.subcategory}
Materials: ${productAnalysis.textures?.map(t => `${t.material} (${t.finish})`).join(", ")}
Colors: ${productAnalysis.colors?.dominant?.join(", ")}
Brand style: ${productAnalysis.product?.brandStyle}
${brandDna ? `BRAND DNA: ${JSON.stringify(brandDna)}` : ""}

Return JSON:
{
  "lighting": "studio-3pt | natural-window | dramatic-rembrandt | soft-diffused | golden-hour | neon-accent | rim-silhouette | low-key-moody | high-key-bright | backlit",
  "background": "white-pure | grey-soft | dark-black | gradient-brand | marble-luxury | wood-natural | concrete | nature-outdoor | fabric-textile | scene-custom",
  "perspective": "Frontal 0° | 3/4 (45°) | Lateral 90° | Cenital (top-down) | Contrapicado | Isométrica | Dutch Angle | Nivel de ojo",
  "props": ["prop1", "prop2", "prop3"],
  "colorGrading": "warm | cool | neutral | muted | vibrant | high-contrast | film-grain",
  "reasoning": "Brief explanation of why these settings work for this product+brand"
}`;

  const text = await askClaudeVisionWithBrain(0, prompt, [], undefined, "images", undefined, 2048);
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { lighting: "studio-3pt", background: "white-pure", perspective: "3/4 (45°)", props: [], colorGrading: "neutral", reasoning: "Default settings" };
  } catch {
    return { lighting: "studio-3pt", background: "white-pure", perspective: "3/4 (45°)", props: [], colorGrading: "neutral", reasoning: "Default settings" };
  }
}
