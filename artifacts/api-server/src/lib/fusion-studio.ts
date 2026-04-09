import { logger } from "./logger.js";
import { askClaudeVisionWithBrain, learnFromOperation } from "./claude.js";

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
