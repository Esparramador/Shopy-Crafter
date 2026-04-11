import { logger } from "./logger.js";
import { askClaudeVisionWithBrain, askClaudeJsonWithBrain, learnFromOperation } from "./claude.js";
import { askGeminiWithSearch } from "./gemini.js";

export interface GarmentSide {
  imageIndex: number;
  side: "front" | "back" | "unknown";
  reason: string;
}

export async function detectGarmentSides(
  files: Array<{ buffer: Buffer; mimetype: string }>,
  productCategory?: string,
): Promise<GarmentSide[]> {
  if (files.length === 0) return [];
  if (files.length === 1) return [{ imageIndex: 0, side: "front", reason: "Single image defaults to front" }];

  type VisionMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  const images = files.map(f => ({
    base64: f.buffer.toString("base64"),
    mediaType: f.mimetype as VisionMediaType,
  }));

  try {
    const text = await askClaudeVisionWithBrain(
      0,
      `You are analyzing ${images.length} images of a garment (${productCategory || "clothing"}).
For EACH image, determine if it shows the FRONT or BACK of the garment.

Front indicators: smaller logo/brand mark on chest, front collar view, buttons/zippers visible from front, main facing side
Back indicators: larger print/artwork on back, back of collar/neck, back label, viewing the garment from behind, large graphic design

Return ONLY valid JSON:
{ "sides": [${images.map((_, i) => `{ "imageIndex": ${i}, "side": "front" | "back", "reason": "brief reason" }`).join(", ")}] }`,
      images,
      "You are a garment analysis expert specializing in identifying the front and back of clothing items. Be precise.",
      "images",
      undefined,
      8192,
    );

    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.sides && Array.isArray(parsed.sides)) {
        logger.info({ sides: parsed.sides }, "Fusion Studio: Garment sides detected");
        return parsed.sides;
      }
    }
  } catch (err) {
    logger.warn({ err }, "Fusion Studio: Garment side detection failed, using defaults");
  }

  return files.map((_, i) => ({
    imageIndex: i,
    side: i === 0 ? "front" as const : "back" as const,
    reason: "Default assignment",
  }));
}

export function getGarmentCategory(productCategory: string, subcategory: string): "tops" | "bottoms" | "one-pieces" {
  const lower = `${productCategory} ${subcategory}`.toLowerCase();
  if (lower.match(/pantal|jeans|shorts|falda|skirt|trouser|pant|leggin/)) return "bottoms";
  if (lower.match(/vestido|dress|mono|jumpsuit|overall|onesie|romper|body/)) return "one-pieces";
  return "tops";
}

export function buildModelPersonPrompt(
  mode: string,
  analysis: ImageAnalysis,
  brandDna: Record<string, unknown> | null,
  extraPrompt?: string,
): string {
  const audience = analysis.product?.targetAudience || "young adults";
  const style = analysis.product?.brandStyle || "streetwear";
  const isUrban = style.toLowerCase().match(/street|urban|casual|sport/);
  const isLuxury = (analysis.visualDna?.luxuryScore ?? 5) >= 7;

  let pose = "standing naturally, relaxed confident pose, arms at sides";
  let setting = "clean studio background, professional photography lighting";
  let facing = "facing the camera, front view";

  if (mode === "tryon-back") {
    facing = "facing AWAY from camera, BACK view, showing their back to the viewer";
    pose = "standing naturally, slight head turn showing jawline, viewed from behind";
  } else if (mode === "tryon-lifestyle") {
    setting = isUrban
      ? "urban city street, golden hour sunlight, graffiti walls in background"
      : isLuxury
        ? "luxury minimalist interior, soft natural window light"
        : "outdoor park setting, natural dappled sunlight, bokeh background";
    pose = "walking casually, mid-stride natural movement, candid authentic feel";
  }

  const genderHint = audience.toLowerCase().includes("women") || audience.toLowerCase().includes("mujer")
    ? "female" : audience.toLowerCase().includes("men") || audience.toLowerCase().includes("hombre")
    ? "male" : "person";

  const ageHint = audience.toLowerCase().includes("teen") ? "18-22 year old"
    : audience.toLowerCase().includes("adult") || audience.toLowerCase().includes("adulto") ? "25-35 year old"
    : "25-30 year old";

  return `Full body photograph of an attractive ${ageHint} ${genderHint} model, ${facing}, ${pose}, wearing a plain simple white t-shirt and dark fitted jeans, ${setting}, shot on Canon EOS R5, 85mm f/1.4 lens, shallow depth of field, 4K ultra high resolution, professional fashion photography, sharp focus, natural skin texture, photorealistic${extraPrompt ? `, ${extraPrompt}` : ""}`;
}

export interface ImageAnalysis {
  sceneClassification: {
    type: string;
    subtype: string;
    hasModel: boolean;
    hasMultipleProducts: boolean;
    isFood: boolean;
    isTech: boolean;
    isFashion: boolean;
    isJewelry: boolean;
    isArt: boolean;
    isAnimal: boolean;
    isInfographic: boolean;
    renderType: string;
    confidence: number;
  };
  layers: Array<{
    name: string;
    description: string;
    coverage: string;
  }>;
  componentBreakdown: Array<{
    partName: string;
    material: string;
    function: string;
    position: string;
    dimensions: string;
    details: string;
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
    focalLength: string;
    productionTechnique: string;
  };
  modelAnalysis: {
    detected: boolean;
    gender: string;
    ageRange: string;
    pose: string;
    clothing: string;
    interaction: string;
    skinTone: string;
    hairStyle: string;
    expression: string;
  } | null;
  foodAnalysis: {
    detected: boolean;
    cuisineType: string;
    dishName: string;
    ingredients: string[];
    cookingTechnique: string;
    plating: string;
    temperature: string;
    garnishes: string[];
    servingStyle: string;
  } | null;
  product: {
    category: string;
    subcategory: string;
    estimatedMaterials: string[];
    estimatedWeight: string;
    estimatedDimensions: string;
    brandStyle: string;
    targetAudience: string;
    priceRange: string;
    manufacturingProcess: string;
    qualityLevel: string;
    usageContext: string;
    seasonality: string;
  };
  visualDna: {
    styleFingerprint: string;
    moodBoard: string[];
    photographySchool: string;
    editingStyle: string;
    brandArchetype: string;
    emotionalTone: string;
    luxuryScore: number;
    uniqueElements: string[];
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

  const prompt = `Eres el Fusion Studio de ShopyBrain — el motor de visión artificial más avanzado del mundo para eCommerce. Tu misión: EXTRAER EL 100% de la información de CUALQUIER imagen, sin importar el tipo (producto, comida, tecnología, moda, joyería, arte, mascota, persona con producto, infografía técnica, etc.).

ANALIZA ${additionalImages?.length ? `estas ${1 + additionalImages.length} imágenes` : "esta imagen"} como si fueras una combinación de:
- Un ingeniero de materiales (identifica CADA componente y material)
- Un fotógrafo de Vogue/Apple (analiza composición y técnica)
- Un chef estrella Michelin (si hay comida: ingredientes, técnica, emplatado)
- Un sastre de alta costura (si hay moda: tejidos, cortes, acabados)
- Un joyero de Cartier (si hay joyería: metales, piedras, quilates)
- Un director de arte de Apple (ADN visual, estilo único)

${context?.niche ? `Contexto: Nicho ${context.niche}. Tono: ${context.brandTone ?? "profesional"}. Audiencia: ${context.targetAudience ?? "adultos"}.` : ""}

EXTRAE ABSOLUTAMENTE TODO:

1. **CLASIFICACIÓN DE ESCENA**: ¿Qué tipo de imagen es?
   - Tipo: product_only | product_with_model | food | tech | fashion | jewelry | art | animal | infographic | lifestyle | packaging
   - ¿Hay modelo/persona? ¿Hay múltiples productos? ¿Es comida? ¿Es tecnología? ¿Es moda? ¿Es joyería? ¿Es arte/diseño? ¿Es animal/mascota? ¿Es una infografía/plano técnico?
   - ¿Es foto real, CGI, ilustración, render 3D, foto editada?
   - Nivel de confianza (0-1)

2. **CAPAS VISUALES**: Separa la imagen en TODAS sus capas (fondo, producto, sombras, reflejos, texto, decoración, packaging, modelo, props). Para cada capa: nombre, descripción detallada, % de cobertura.

3. **DESGLOSE DE COMPONENTES** (como un plano técnico de ingeniería):
   - Nombra CADA parte/componente visible del producto (ej: para un reloj → bisel, cristal, corona, esfera, correa, hebilla, fondo de caja...)
   - Para CADA componente: material exacto, función, posición en el producto, dimensiones estimadas, detalles técnicos
   - Si es comida: cada ingrediente visible, capa del plato, técnica de cocción de cada elemento
   - Si es tech: cada componente electrónico, puerto, sensor, botón visible
   - Si es moda: cada panel de tela, costura, cierre, etiqueta, acabado

4. **ANÁLISIS DE COLOR**: Colores dominantes (hex exacto), paleta completa con %, temperatura (Kelvin estimado), armonía cromática

5. **TEXTURAS Y MATERIALES**: CADA material visible con su acabado (mate/brillante/satinado/rugoso/texturado), zona de la imagen

6. **COMPOSICIÓN TÉCNICA**:
   - Layout, perspectiva, profundidad de campo, iluminación (tipo, dirección, dureza, setup estimado)
   - Sombras (tipo, dirección, dureza)
   - Distancia focal estimada del lente
   - Técnica de producción (foto estudio, foto natural, CGI, compositing, AI-generated)

7. **ANÁLISIS DE MODELO** (si hay persona):
   - Género, rango de edad, pose, ropa, cómo interactúa con el producto
   - Tono de piel, estilo de pelo, expresión facial
   - Si NO hay modelo, devolver null

8. **ANÁLISIS GASTRONÓMICO** (si hay comida):
   - Tipo de cocina (italiana, japonesa, francesa, fusión, etc.)
   - Nombre del plato
   - Ingredientes visibles (TODOS, uno por uno)
   - Técnica de cocción (al horno, sous vide, a la brasa, fritura, etc.)
   - Estilo de emplatado (fine dining, rústico, minimalista, abundante)
   - Temperatura aparente (caliente con vapor, frío, temperatura ambiente)
   - Guarniciones y decoraciones
   - Estilo de servicio (plato individual, familiar, take away)
   - Si NO hay comida, devolver null

9. **PRODUCTO DETECTADO**:
   - Categoría y subcategoría
   - Materiales de fabricación
   - Peso y dimensiones estimados
   - Estilo de marca, audiencia, rango de precio
   - Proceso de fabricación (artesanal, industrial, inyección, cosido a mano, 3D print, etc.)
   - Nivel de calidad (premium/mid-range/budget/luxury/ultra-luxury)
   - Contexto de uso (diario, ocasión especial, profesional, deportivo, etc.)
   - Estacionalidad (todo el año, verano, invierno, festivo, etc.)

10. **ADN VISUAL** (la "huella dactilar" estética de esta imagen):
    - Fingerprint de estilo en 1 frase (ej: "Minimalismo escandinavo con acentos cobre")
    - 5 palabras de mood board
    - Escuela fotográfica (editorial, comercial, artística, documental, lifestyle, flat-lay)
    - Estilo de edición (clean, moody, film-grain, high-contrast, muted, vibrant, HDR)
    - Arquetipo de marca (Hero/Sage/Explorer/Creator/Rebel/Lover/Caregiver/Magician)
    - Tono emocional (aspiracional, confianza, urgencia, exclusividad, calidez, aventura)
    - Luxury score (1-10)
    - Elementos únicos que hacen esta imagen memorable

11. **GENERACIÓN DE PRODUCTO** (para crear el producto en la tienda):
    - Título SEO (70 chars, keywords potentes)
    - Descripción HTML de 800+ palabras con 8 secciones
    - 15-25 tags SEO, categoría, precio sugerido real de mercado
    - 5 keywords SEO principales
    - 6 photo briefs detallados para generar imágenes profesionales (hero, lifestyle, detalle, escala, packaging, UGC)

RESPONDE EXCLUSIVAMENTE con JSON válido:
{
  "sceneClassification": { "type": "...", "subtype": "...", "hasModel": false, "hasMultipleProducts": false, "isFood": false, "isTech": false, "isFashion": false, "isJewelry": false, "isArt": false, "isAnimal": false, "isInfographic": false, "renderType": "photo|cgi|illustration|render3d|ai_generated", "confidence": 0.95 },
  "layers": [{ "name": "...", "description": "...", "coverage": "..." }],
  "componentBreakdown": [{ "partName": "...", "material": "...", "function": "...", "position": "...", "dimensions": "...", "details": "..." }],
  "colors": { "dominant": ["#hex"], "palette": [{ "hex": "#...", "name": "...", "percentage": "..." }], "temperature": "...", "harmony": "..." },
  "textures": [{ "material": "...", "finish": "...", "area": "..." }],
  "composition": { "layout": "...", "perspective": "...", "depth": "...", "lighting": "...", "shadows": "...", "focalLength": "...", "productionTechnique": "..." },
  "modelAnalysis": null,
  "foodAnalysis": null,
  "product": { "category": "...", "subcategory": "...", "estimatedMaterials": [...], "estimatedWeight": "...", "estimatedDimensions": "...", "brandStyle": "...", "targetAudience": "...", "priceRange": "...", "manufacturingProcess": "...", "qualityLevel": "...", "usageContext": "...", "seasonality": "..." },
  "visualDna": { "styleFingerprint": "...", "moodBoard": [...], "photographySchool": "...", "editingStyle": "...", "brandArchetype": "...", "emotionalTone": "...", "luxuryScore": 7, "uniqueElements": [...] },
  "productGeneration": { "suggestedTitle": "...", "suggestedDescription": "...(HTML)...", "suggestedTags": [...], "suggestedCategory": "...", "suggestedPrice": "...", "seoKeywords": [...], "photoBriefs": [...] }
}`;

  const text = await askClaudeVisionWithBrain(
    0,
    prompt,
    allImages,
    `Eres el Fusion Studio de ShopyBrain — el motor de visión artificial más avanzado del mundo para eCommerce. Extraes el 100% de la información de CUALQUIER imagen: productos, comida, tecnología, moda, joyería, arte, animales, personas. Desglosas cada componente como un plano técnico de ingeniería.`,
    "images",
    context?.niche,
    24000,
  );
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in Fusion Studio response");

  let analysis: ImageAnalysis;
  try {
    analysis = JSON.parse(jsonMatch[0]) as ImageAnalysis;
  } catch (parseErr) {
    logger.warn({ textPreview: jsonMatch[0].slice(0, 300) }, "Fusion Studio: JSON parse failed, attempting cleanup");
    const cleaned = jsonMatch[0]
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/[\x00-\x1f]/g, " ")
      .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');
    try {
      analysis = JSON.parse(cleaned) as ImageAnalysis;
    } catch {
      logger.error({ parseErr }, "Fusion Studio: Double parse failure");
      throw new Error("Fusion Studio: AI returned invalid JSON");
    }
  }

  if (!analysis.sceneClassification) analysis.sceneClassification = { type: "product_only", subtype: "", hasModel: false, hasMultipleProducts: false, isFood: false, isTech: false, isFashion: false, isJewelry: false, isArt: false, isAnimal: false, isInfographic: false, renderType: "photo", confidence: 0.5 };
  if (!analysis.componentBreakdown) analysis.componentBreakdown = [];
  if (!analysis.visualDna) analysis.visualDna = { styleFingerprint: "", moodBoard: [], photographySchool: "", editingStyle: "", brandArchetype: "", emotionalTone: "", luxuryScore: 5, uniqueElements: [] };
  if (!analysis.modelAnalysis) analysis.modelAnalysis = null;
  if (!analysis.foodAnalysis) analysis.foodAnalysis = null;
  if (!analysis.layers) analysis.layers = [];
  if (!analysis.colors) analysis.colors = { dominant: [], palette: [], temperature: "", harmony: "" };
  if (!analysis.textures) analysis.textures = [];
  if (!analysis.composition) analysis.composition = { layout: "", perspective: "", depth: "", lighting: "", shadows: "", focalLength: "", productionTechnique: "" };
  if (!analysis.product) analysis.product = { category: "", subcategory: "", estimatedMaterials: [], estimatedWeight: "", estimatedDimensions: "", brandStyle: "", targetAudience: "", priceRange: "", manufacturingProcess: "", qualityLevel: "", usageContext: "", seasonality: "" };
  if (!analysis.productGeneration) analysis.productGeneration = { suggestedTitle: "", suggestedDescription: "", suggestedTags: [], suggestedCategory: "", suggestedPrice: "", seoKeywords: [], photoBriefs: [] };

  const sceneType = analysis.sceneClassification.type || "unknown";
  const components = (analysis.componentBreakdown || []).map(c => c.partName).slice(0, 8).join(", ");
  const visualDnaStr = analysis.visualDna.styleFingerprint || "";

  learnFromOperation({
    operationType: "fusion_studio_analysis",
    title: `Fusion Studio [${sceneType}]: ${analysis.product?.category ?? "producto"} — ${analysis.product?.subcategory ?? ""}`,
    content: `Análisis Fusion Studio (${sceneType}): Categoría ${analysis.product?.category}. Componentes: ${components}. Materiales: ${analysis.textures?.map(t => t.material).join(", ")}. Colores: ${analysis.colors?.dominant?.join(", ")}. Estilo: ${analysis.product?.brandStyle}. Precio: ${analysis.product?.priceRange}. Calidad: ${analysis.product?.qualityLevel}. ADN Visual: ${visualDnaStr}. ${analysis.foodAnalysis?.detected ? `Comida: ${analysis.foodAnalysis.cuisineType} - ${analysis.foodAnalysis.dishName}. ` : ""}${analysis.modelAnalysis?.detected ? `Modelo: ${analysis.modelAnalysis.gender}, ${analysis.modelAnalysis.pose}. ` : ""}Fabricación: ${analysis.product?.manufacturingProcess}. Luxury: ${analysis.visualDna?.luxuryScore}/10.`,
    confidence: 0.9,
    tags: ["fusion-studio", sceneType, analysis.product?.category ?? "product", "image-analysis", ...(analysis.foodAnalysis?.detected ? ["food", analysis.foodAnalysis.cuisineType] : []), ...(analysis.modelAnalysis?.detected ? ["model"] : [])],
  });

  logger.info({
    sceneType,
    category: analysis.product?.category,
    components: analysis.componentBreakdown?.length,
    materials: analysis.textures?.length,
    colors: analysis.colors?.palette?.length,
    hasModel: analysis.sceneClassification?.hasModel,
    isFood: analysis.sceneClassification?.isFood,
    luxuryScore: analysis.visualDna?.luxuryScore,
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

  const text = await askClaudeVisionWithBrain(0, prompt, [], undefined, "images", undefined, 8192);
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { lighting: "studio-3pt", background: "white-pure", perspective: "3/4 (45°)", props: [], colorGrading: "neutral", reasoning: "Default settings" };
  } catch {
    return { lighting: "studio-3pt", background: "white-pure", perspective: "3/4 (45°)", props: [], colorGrading: "neutral", reasoning: "Default settings" };
  }
}
