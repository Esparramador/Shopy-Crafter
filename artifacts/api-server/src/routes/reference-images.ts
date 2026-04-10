import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, productsTable, generationJobsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { shopifyRequest } from "../lib/shopify";
import { askClaudeWithBrain, learnFromOperation } from "../lib/claude";
import { checkProductionLimit, recordUsage } from "../lib/plan-limits.js";
import { saveToVault } from "../lib/vault.js";
import { Buffer } from "node:buffer";
import multer from "multer";
import { enableLongRunning } from "../lib/long-running.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Solo se aceptan imágenes"));
  },
});

interface SceneConfig {
  key: string;
  label: string;
  promptTemplate: (productDesc: string, productType: string, niche: string) => string;
}

function getScenesForProductType(productType: string, _niche: string): SceneConfig[] {
  const lower = productType.toLowerCase();

  if (/camis|camiseta|polo|sudadera|hoodie|jersey|blusa|top|vest|shirt|t-?shirt|ropa/i.test(lower)) {
    return [
      { key: "model_front", label: "Modelo frontal", promptTemplate: (desc, _pt, _n) => `Professional fashion photography: attractive model wearing this exact ${desc}. Front view, standing pose, clean studio background, editorial fashion magazine quality. The garment details, texture, color, and design must be EXACTLY preserved. Sharp focus on the clothing.` },
      { key: "model_back", label: "Modelo trasera", promptTemplate: (desc, _pt, _n) => `Professional fashion photography: attractive model wearing this exact ${desc}. Back view, slightly turned, showing the back design and fit. Clean studio background, soft lighting. Every detail of the garment must be EXACTLY preserved.` },
      { key: "model_side", label: "Modelo lateral", promptTemplate: (desc, _pt, _n) => `Professional fashion photography: attractive model wearing this exact ${desc}. Three-quarter side view, natural pose, showing the silhouette and drape of the fabric. Clean background, editorial quality lighting. Product details EXACTLY preserved.` },
      { key: "model_lifestyle", label: "Modelo lifestyle", promptTemplate: (desc, _pt, n) => `Lifestyle fashion photography: model wearing this exact ${desc} in a real-world aspirational setting matching ${n} aesthetic. Urban environment, golden hour lighting, candid but styled pose. The garment must be EXACTLY the same as the reference — same color, design, details.` },
      { key: "flat_lay", label: "Flat lay", promptTemplate: (desc, _pt, _n) => `Premium flat-lay product photography of this exact ${desc}. Overhead shot on marble or clean surface, styled with complementary accessories (watch, sunglasses, shoes). The garment is neatly folded/arranged. Every design detail, color, and texture EXACTLY preserved. Magazine-quality composition.` },
      { key: "detail_closeup", label: "Detalle close-up", promptTemplate: (desc, _pt, _n) => `Extreme macro photography of this exact ${desc}. Close-up on fabric texture, stitching quality, label, or unique design detail. Shallow depth of field, studio lighting emphasizing material quality. Product details EXACTLY preserved.` },
      { key: "action_urban", label: "Acción urbana", promptTemplate: (desc, _pt, n) => `Dynamic street style photography: model wearing this exact ${desc} walking confidently through a vibrant urban setting matching ${n} aesthetic. Motion in the environment, sharp focus on the outfit. Wind catching the fabric. Cinematic color grading. Product details EXACTLY preserved. Nike campaign quality.` },
      { key: "artistic_editorial", label: "Editorial artístico", promptTemplate: (desc, _pt, _n) => `High-fashion editorial photography: model wearing this exact ${desc} in a dramatic, artistic pose. Dramatic studio lighting with color gels, smoke machine atmosphere, avant-garde composition. The garment is the star — every detail EXACTLY preserved. Vogue Italia editorial quality.` },
    ];
  }

  if (/zapato|zapatilla|bamba|sneaker|bota|sandalia|calzado|shoe|boot/i.test(lower)) {
    return [
      { key: "product_hero", label: "Hero producto", promptTemplate: (desc, _pt, _n) => `Professional studio product photography of this exact ${desc}. Three-quarter angle on white background, floating shadow, dramatic lighting. Every detail of the shoe — color, texture, sole, laces, logo — EXACTLY preserved. Commercial e-commerce quality.` },
      { key: "model_worn", label: "Modelo calzado", promptTemplate: (desc, _pt, n) => `Professional fashion photography: person wearing this exact ${desc}. Shot from ankle down, walking on urban street matching ${n} aesthetic. The shoe details, color, and design must be EXACTLY preserved. Editorial quality, sharp focus on the footwear.` },
      { key: "pair_angle", label: "Par ángulo", promptTemplate: (desc, _pt, _n) => `Studio photography of a pair of this exact ${desc}. One shoe facing forward, one at an angle, showing different perspectives. White background, soft shadows. Every detail EXACTLY preserved.` },
      { key: "sole_detail", label: "Suela detalle", promptTemplate: (desc, _pt, _n) => `Product photography showing the sole/bottom of this exact ${desc}. Clean shot showing tread pattern, material quality, branding on sole. Studio white background. All details EXACTLY preserved.` },
      { key: "lifestyle_context", label: "Lifestyle contexto", promptTemplate: (desc, _pt, n) => `Lifestyle photography: person wearing this exact ${desc} in an aspirational ${n} setting. Full outfit visible, natural environment, golden hour or dramatic lighting. Shoe details, color, design EXACTLY preserved.` },
      { key: "detail_texture", label: "Textura detalle", promptTemplate: (desc, _pt, _n) => `Extreme close-up macro photography of this exact ${desc}. Focus on material texture, stitching, construction quality. Shallow depth of field, emphasizing premium craftsmanship. All details EXACTLY preserved.` },
      { key: "action_sport", label: "Acción deportiva", promptTemplate: (desc, _pt, n) => `Dynamic action photography: athlete/person wearing this exact ${desc} in mid-movement — running, jumping, skateboarding, dancing. Motion blur on background, razor-sharp focus on the footwear. Dramatic low angle, ${n} environment. Shoe details EXACTLY preserved. Nike/Adidas campaign quality.` },
      { key: "artistic_display", label: "Display artístico", promptTemplate: (desc, _pt, _n) => `Artistic product photography: this exact ${desc} floating/levitating against a dramatic gradient background with dynamic color splashes and light rays. Energy and movement conveyed through the composition. Every shoe detail EXACTLY preserved. Sneaker culture art gallery quality.` },
    ];
  }

  if (/joya|collar|anillo|pulsera|pendiente|arete|colgante|jewelry|ring|bracelet|necklace/i.test(lower)) {
    return [
      { key: "hero_elegant", label: "Hero elegante", promptTemplate: (desc, _pt, _n) => `Luxury jewelry photography of this exact ${desc}. On dark velvet or marble surface, dramatic side lighting creating sparkle and reflections. Every gem, metal finish, and design detail EXACTLY preserved. Commercial luxury quality.` },
      { key: "model_worn", label: "Modelo puesto", promptTemplate: (desc, _pt, _n) => `Fashion photography: elegant person wearing this exact ${desc}. Close-up on the jewelry piece, soft skin tones, complementary styling. The jewelry design, color, gems, and metal finish must be EXACTLY preserved. Vogue editorial quality.` },
      { key: "scale_hand", label: "Escala en mano", promptTemplate: (desc, _pt, _n) => `Product photography of this exact ${desc} held in or placed on a hand/wrist/neck, showing real size and proportions. Clean background, soft lighting. Every detail of the piece EXACTLY preserved.` },
      { key: "macro_detail", label: "Macro detalle", promptTemplate: (desc, _pt, _n) => `Extreme macro photography of this exact ${desc}. Focus on gemstone facets, metal engravings, clasp mechanism, or texture details. Dramatic lighting creating sparkle. All details EXACTLY preserved.` },
      { key: "gift_styled", label: "Estilo regalo", promptTemplate: (desc, _pt, _n) => `Styled product photography of this exact ${desc} in luxury gift box or on branded packaging. Complementary styling with roses or ribbons. The jewelry piece must be EXACTLY preserved in every detail.` },
    ];
  }

  if (/cosmetica|maquillaje|crema|serum|perfume|beauty|skincare|makeup|locion/i.test(lower)) {
    return [
      { key: "hero_clean", label: "Hero minimalista", promptTemplate: (desc, _pt, _n) => `Premium beauty product photography of this exact ${desc}. Clean white/pastel background, soft diffused lighting, product centered with subtle shadow. Every label, color, shape, and packaging detail EXACTLY preserved.` },
      { key: "texture_swatch", label: "Textura/swatch", promptTemplate: (desc, _pt, _n) => `Beauty product photography showing this exact ${desc} with a texture swatch — product spread/swatched next to the container. The product packaging must be EXACTLY preserved. Clean, bright, beauty editorial quality.` },
      { key: "model_application", label: "Modelo aplicación", promptTemplate: (desc, _pt, _n) => `Beauty editorial photography: model applying or showcasing this exact ${desc}. Close-up on face/skin, dewy natural lighting, the product visible in frame. Product packaging EXACTLY preserved.` },
      { key: "ingredients_styled", label: "Ingredientes", promptTemplate: (desc, _pt, _n) => `Styled product photography of this exact ${desc} surrounded by its key natural ingredients (botanicals, fruits, herbs). Clean background, editorial beauty magazine quality. Product EXACTLY preserved.` },
      { key: "routine_flatlay", label: "Rutina flatlay", promptTemplate: (desc, _pt, _n) => `Overhead flat-lay beauty photography featuring this exact ${desc} as the star product, surrounded by complementary skincare items. Marble or clean surface, organized layout. Main product EXACTLY preserved.` },
    ];
  }

  if (/comida|alimento|bebida|cafe|te|chocolate|snack|food|drink|wine|cerveza/i.test(lower)) {
    return [
      { key: "hero_appetite", label: "Hero apetitoso", promptTemplate: (desc, _pt, _n) => `Professional food/beverage photography of this exact ${desc}. Dramatic lighting, steam/condensation if applicable, styled with complementary elements. Product packaging/presentation EXACTLY preserved. Commercial food photography quality.` },
      { key: "pouring_action", label: "Acción servir", promptTemplate: (desc, _pt, _n) => `Action shot food photography of this exact ${desc} being poured, served, or prepared. Dynamic composition with motion blur on liquid/steam. Product EXACTLY preserved. Professional culinary photography.` },
      { key: "table_setting", label: "Mesa servida", promptTemplate: (desc, _pt, n) => `Lifestyle food photography of this exact ${desc} on a styled table setting matching ${n} aesthetic. Complementary dishes, cutlery, napkins. Natural window lighting. Product EXACTLY preserved.` },
      { key: "ingredients_raw", label: "Ingredientes", promptTemplate: (desc, _pt, _n) => `Styled food photography of this exact ${desc} surrounded by its raw ingredients. Rustic surface, natural lighting, deconstructed recipe feel. Product EXACTLY preserved.` },
      { key: "macro_texture", label: "Macro textura", promptTemplate: (desc, _pt, _n) => `Extreme close-up food photography of this exact ${desc}. Showing texture, color richness, freshness details. Shallow depth of field, dramatic side lighting. Product EXACTLY preserved.` },
    ];
  }

  if (/electr|gadget|tech|phone|auricular|altavoz|cargador|cable|accesorio.*tech/i.test(lower)) {
    return [
      { key: "hero_tech", label: "Hero tecnológico", promptTemplate: (desc, _pt, _n) => `Premium tech product photography of this exact ${desc}. Dark gradient background, dramatic rim lighting, floating shadow effect. Every button, port, logo, color, and design detail EXACTLY preserved. Apple-style commercial quality.` },
      { key: "in_use", label: "En uso", promptTemplate: (desc, _pt, _n) => `Lifestyle tech photography: person using this exact ${desc} in a modern workspace or lifestyle context. Natural lighting, clean environment. Product details EXACTLY preserved. Commercial tech brand quality.` },
      { key: "angle_45", label: "Ángulo 45°", promptTemplate: (desc, _pt, _n) => `Studio product photography of this exact ${desc} at 45-degree angle. Dark background, edge lighting highlighting form factor. Every detail EXACTLY preserved. Premium tech catalog quality.` },
      { key: "scale_context", label: "Escala contexto", promptTemplate: (desc, _pt, _n) => `Product photography of this exact ${desc} next to common objects (smartphone, coffee cup, hand) showing real scale. Clean background. All product details EXACTLY preserved.` },
      { key: "detail_ports", label: "Detalle puertos", promptTemplate: (desc, _pt, _n) => `Macro product photography of this exact ${desc}. Close-up on key functional details — buttons, ports, connectors, screen, texture. Dramatic lighting. All details EXACTLY preserved.` },
    ];
  }

  return [
    { key: "hero_studio", label: "Hero estudio", promptTemplate: (desc, _pt, _n) => `Professional studio product photography of this exact ${desc}. Pure white background, 3-point lighting, centered composition, soft shadows. Every detail, color, texture, and design element EXACTLY preserved. Phase One commercial quality.` },
    { key: "lifestyle_context", label: "Lifestyle contexto", promptTemplate: (desc, _pt, n) => `Lifestyle product photography of this exact ${desc} in an aspirational real-world setting matching ${n} aesthetic. Natural lighting, shallow depth of field. Product details EXACTLY preserved. Editorial magazine quality.` },
    { key: "model_interaction", label: "Con modelo", promptTemplate: (desc, _pt, n) => `Professional photography: person interacting with or using this exact ${desc} in a natural ${n} context. Product prominently featured. Every product detail EXACTLY preserved. Commercial lifestyle quality.` },
    { key: "detail_macro", label: "Detalle macro", promptTemplate: (desc, _pt, _n) => `Extreme macro close-up photography of this exact ${desc}. Focus on material quality, texture, craftsmanship details. Shallow depth of field, dramatic lighting. Every detail EXACTLY preserved.` },
    { key: "action_scene", label: "Escena de acción", promptTemplate: (desc, _pt, n) => `Dynamic action photography: person actively using this exact ${desc} in an energetic, aspirational ${n} setting. Motion blur on background, sharp focus on product. Action/sport/movement context that shows the product in its ideal use case. Product details EXACTLY preserved. Nike/GoPro commercial quality.` },
    { key: "artistic_render", label: "Render artístico", promptTemplate: (desc, _pt, _n) => `Artistic editorial photography of this exact ${desc}. Dramatic chiaroscuro lighting, smoke/mist atmosphere, dark moody background. The product as the hero element, almost sculptural. Every detail EXACTLY preserved. Gallery exhibition quality, Hasselblad medium format look.` },
    { key: "scale_comparison", label: "Escala comparación", promptTemplate: (desc, _pt, _n) => `Product scale reference photography of this exact ${desc} next to a human hand or common everyday object. Clean background, clear size comparison. Product details EXACTLY preserved.` },
    { key: "flat_lay_styled", label: "Flat lay estilizado", promptTemplate: (desc, _pt, _n) => `Premium styled flat-lay photography of this exact ${desc} with 2-3 complementary lifestyle items. Overhead shot, clean surface, curated composition. Product details EXACTLY preserved.` },
  ];
}

async function generateDynamicCreativeScenes(
  projectId: number,
  productTitle: string,
  productType: string,
  niche: string,
  existingSceneCount: number
): Promise<SceneConfig[]> {
  try {
    const result = await askClaudeWithBrain(
      projectId,
      [{ role: "user", content: `PRODUCT: "${productTitle}"
CATEGORY: ${productType || "general"}
NICHE: ${niche}
EXISTING SCENES: ${existingSceneCount} standard scenes already generated.

Generate 3-4 CREATIVE and UNIQUE additional scene ideas for this SPECIFIC product that go BEYOND standard product photography. Think like a world-class creative director — the kind of shots that make a product go viral on social media.

CREATIVE DIRECTIONS to consider (pick what fits THIS product):
- ACTION SCENES: Someone actively using the product in its ideal context (skateboarding, cooking, exercising, creating art, etc.)
- ARTISTIC/EDITORIAL: Dramatic lighting, paint splashes, smoke, slow-motion freeze-frame effects
- PERSPECTIVE PLAY: Extreme angles, bird's eye, worm's eye, through-glass, reflection shots
- STORYTELLING: Before/after, unboxing sequence, making-of, behind-the-scenes
- ENVIRONMENTAL: Product in unexpected but aspirational locations (rooftop sunset, beach, mountain peak, rain)
- ANIMATION FEEL: Frozen motion, levitating product, dynamic energy lines, splash/explosion effects
- 3D MODEL SHOWCASE: Someone painting/crafting/sculpting the product, artisan workshop feel
- CULTURAL/LIFESTYLE: Product integrated into a specific lifestyle moment (morning routine, date night, adventure trip)

For EACH scene return EXACTLY this JSON format (array):
[{"key":"unique_key","label":"Short Spanish label","prompt":"Detailed English prompt for image editing. Must say 'this exact [product]' and end with 'Product details EXACTLY preserved.'"}]

Output ONLY the JSON array — no markdown, no explanations.` }],
      `You are the world's most creative commercial photography art director. You've directed campaigns for Apple, Nike, Zara, Dyson, and Glossier. You think beyond conventional product photography. Your scenes tell stories, evoke emotions, and make products feel alive. Every prompt must be technically precise for an AI image editor that will transform a reference photo. Output ONLY valid JSON.`,
      "images",
      niche
    );

    const cleaned = result.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
    let parsed: Array<{ key: string; label: string; prompt: string }>;
    try { parsed = JSON.parse(cleaned); } catch { return []; }
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(s => s.key && s.label && s.prompt).map(s => ({
      key: s.key,
      label: s.label,
      promptTemplate: (_desc: string, _pt: string, _n: string) => s.prompt,
    }));
  } catch {
    return [];
  }
}

async function generateReferenceImagePrompt(
  projectId: number,
  productTitle: string,
  productType: string,
  niche: string,
  sceneLabel: string,
  sceneKey: string
): Promise<string | null> {
  try {
    const systemPrompt = `You are the world's TOP commercial photography art director specializing in product photography with reference images. You direct campaigns for Nike, Zara, Sephora, Apple.

Your job: Write ONE hyper-specific image editing prompt that will transform a reference photo of a product into a professional commercial shot for a specific scene type.

CRITICAL RULES:
1. The reference image shows the REAL product — every detail (color, shape, texture, design, logos) must be EXACTLY preserved.
2. You are EDITING the reference — specify what to CHANGE around the product (background, lighting, model, context) while keeping the product IDENTICAL.
3. For wearable products (clothing, shoes, jewelry, accessories): ALWAYS include a model wearing/using the product. Specify model type, pose, expression, demographic.
4. For beauty/cosmetics: Include model applying or showcasing the product with close-up skin detail.
5. Include SPECIFIC technical direction: lighting type, color temperature, composition, lens simulation, mood.
6. Output ONLY the editing prompt — no explanations, no markdown.
7. Maximum 150 words. Every word must add visual direction.
8. NEVER include text/typography/watermarks.
9. Emphasize: "The product must remain EXACTLY as shown in the reference image."`;

    const userPrompt = `PRODUCT: "${productTitle}"
CATEGORY: ${productType}
STORE NICHE: ${niche}
SCENE TYPE: ${sceneLabel} (key: ${sceneKey})

Write a specialized image editing prompt for this SPECIFIC product and scene. The reference image will be provided alongside your prompt to the image model.`;

    const result = await askClaudeWithBrain(projectId, [{ role: "user", content: userPrompt }], systemPrompt, "images", niche);
    const cleaned = result.replace(/```[\s\S]*?```/g, "").replace(/```/g, "").replace(/^["']|["']$/g, "").trim();
    if (cleaned.length < 30) return null;
    return cleaned;
  } catch {
    return null;
  }
}

function validateImageUrl(url: string): void {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error("URL de imagen inválida"); }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("Solo se aceptan URLs http/https");
  const hostname = parsed.hostname.toLowerCase();
  const blocked = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "metadata.google.internal", "169.254.169.254"];
  if (blocked.includes(hostname)) throw new Error("URL no permitida");
  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname)) throw new Error("URL de red privada no permitida");
}

async function downloadImageToBuffer(url: string): Promise<Buffer> {
  validateImageUrl(url);
  const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!resp.ok) throw new Error(`No se pudo descargar imagen: ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}

async function uploadBufferToShopify(opts: {
  projectId: number;
  shopDomain: string;
  shopifyProductId: string;
  imageBuffer: Buffer;
  altText: string;
  position: number;
}): Promise<{ success: boolean; shopifyImageId?: number; error?: string }> {
  try {
    const base64 = opts.imageBuffer.toString("base64");
    const uploadData = await shopifyRequest<{ image: { id: number } }>(
      opts.projectId, opts.shopDomain,
      `/products/${opts.shopifyProductId}/images.json`,
      { method: "POST", body: JSON.stringify({ image: { attachment: base64, alt: opts.altText, position: opts.position } }) }
    );
    return { success: true, shopifyImageId: uploadData.image.id };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Error subiendo imagen" };
  }
}

router.post("/projects/:projectId/products/:productId/images/generate-from-reference",
  upload.single("referenceImage"),
  async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
      const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
      const shopifyProductId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  
      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
      if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
      const [product] = await db.select().from(productsTable)
        .where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, shopifyProductId)));
  
      const productTitle = product?.title || req.body.productTitle || "Producto";
      const productType = product?.productType || req.body.productType || "";
      const niche = project.storeNiche || "general";
      const referenceImageUrl = req.body.referenceImageUrl;
      let selectedScenes: string[] | null = null;
      if (req.body.scenes) {
        try { selectedScenes = JSON.parse(req.body.scenes) as string[]; } catch { /* ignore malformed */ }
      }
      const autoUpload = req.body.autoUpload !== "false";
  
      let referenceBuffer: Buffer;
      try {
        if (req.file) {
          referenceBuffer = req.file.buffer;
        } else if (referenceImageUrl) {
          referenceBuffer = await downloadImageToBuffer(referenceImageUrl);
        } else {
          res.status(400).json({ error: "Se requiere una imagen de referencia (archivo o URL)" });
          return;
        }
      } catch (e: unknown) {
        res.status(400).json({ error: `Error con imagen de referencia: ${e instanceof Error ? e.message : "desconocido"}` });
        return;
      }
  
      const existingImages = await shopifyRequest<{ images: Array<{ id: number; alt: string }> }>(
        projectId, project.shopDomain, `/products/${shopifyProductId}/images.json`
      ).catch(() => ({ images: [] }));
      const existingAlts = new Set((existingImages.images || []).map(img => (img.alt || "").toLowerCase().trim()));
  
      const allScenes = getScenesForProductType(productType, niche);
      const filteredScenes = allScenes.filter(s => {
        const altCheck = `${productTitle} - ${s.label}`.toLowerCase().trim();
        return !existingAlts.has(altCheck);
      });
      const scenesToGenerate = selectedScenes
        ? filteredScenes.filter(s => selectedScenes.includes(s.key))
        : filteredScenes;
  
      if (scenesToGenerate.length === 0 && allScenes.length > 0) {
        res.json({ message: "El producto ya tiene todas las escenas generadas. No hay imágenes nuevas que crear.", existingImages: existingImages.images?.length ?? 0 });
        return;
      }
  
      const limitCheck = await checkProductionLimit(projectId, "image", scenesToGenerate.length);
      const allowedCount = limitCheck.allowed ? scenesToGenerate.length : Math.max(0, limitCheck.remaining?.images ?? 0);
      if (allowedCount === 0) {
        res.status(403).json({ error: "Límite de imágenes alcanzado para tu plan", planLimit: true });
        return;
      }
  
      const finalScenes = scenesToGenerate.slice(0, allowedCount);
  
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
  
      const sendEvent = (data: Record<string, unknown>) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };
  
      sendEvent({ type: "started", totalScenes: finalScenes.length, scenes: finalScenes.map(s => ({ key: s.key, label: s.label })) });
  
      const results: Array<{ scene: string; label: string; success: boolean; shopifyImageId?: number; error?: string }> = [];
  
      try {
        const { editImageFromBuffer } = await import("@workspace/integrations-openai-ai-server/image");
        let position = 1;
  
        for (const scene of finalScenes) {
          sendEvent({ type: "generating", scene: scene.key, label: scene.label, progress: results.length + 1, total: finalScenes.length });
  
          try {
            const aiPrompt = await generateReferenceImagePrompt(projectId, productTitle, productType, niche, scene.label, scene.key);
            const prompt = aiPrompt || scene.promptTemplate(productTitle, productType, niche);
  
            const generatedBuffer = await editImageFromBuffer(referenceBuffer, prompt, "reference.png");
  
            const altTextPrompt = `Genera un alt text SEO conciso (max 125 chars) para una foto de producto Shopify. Producto: ${productTitle}. Escena: ${scene.label}. Nicho: ${niche}. Incluye keyword principal. En español.`;
            const altText = await askClaudeWithBrain(projectId, [{ role: "user", content: altTextPrompt }], undefined, "images", niche).catch(() => `${productTitle} - ${scene.label}`);
  
            let shopifyImageId: number | undefined;
            if (autoUpload) {
              const uploadResult = await uploadBufferToShopify({
                projectId,
                shopDomain: project.shopDomain,
                shopifyProductId,
                imageBuffer: generatedBuffer,
                altText: altText.slice(0, 125),
                position: position++,
              });
              if (uploadResult.success) shopifyImageId = uploadResult.shopifyImageId;
            }
  
            await recordUsage(projectId, "image", 1);
  
            const [job] = await db.insert(generationJobsTable).values({
              projectId,
              shopifyProductId,
              imageType: scene.key,
              status: "succeeded",
              prompt: prompt.slice(0, 2000),
              model: "gpt-image-1",
              estimatedCost: 0.04,
              altText: altText.slice(0, 125),
              shopifyImageId: shopifyImageId ?? null,
              completedAt: new Date(),
            }).returning();
  
            await saveToVault({
              projectId,
              fileType: "image",
              category: scene.key,
              title: `${scene.label} — ${productTitle} (desde referencia)`,
              description: altText.slice(0, 125),
              mimeType: "image/png",
              content: generatedBuffer.toString("base64"),
              productId: shopifyProductId,
              productTitle: productTitle,
              generatedBy: "reference_image_engine",
              metadata: { model: "gpt-image-1", sceneKey: scene.key, jobId: job.id, encoding: "base64" },
            }).catch(() => {});
  
            results.push({ scene: scene.key, label: scene.label, success: true, shopifyImageId });
            sendEvent({ type: "completed", scene: scene.key, label: scene.label, success: true, shopifyImageId, progress: results.length, total: finalScenes.length });
  
          } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : "Error generando imagen";
            results.push({ scene: scene.key, label: scene.label, success: false, error: errorMsg });
            sendEvent({ type: "error", scene: scene.key, label: scene.label, error: errorMsg, progress: results.length, total: finalScenes.length });
          }
        }
  
        const successCount = results.filter(r => r.success).length;
        const failedCount = results.filter(r => !r.success).length;
  
        learnFromOperation({
          operationType: "images",
          niche,
          productType,
          title: `Imágenes desde referencia: ${productTitle} (${successCount}/${results.length} exitosas)`,
          content: `Tipo: reference_image\nProducto: ${productTitle}\nEscenas: ${results.map(r => `${r.label}(${r.success ? "ok" : "fail"})`).join(", ")}\nModelo: gpt-image-1`,
          confidence: 0.85,
          tags: ["reference_image", niche, productType].filter(Boolean),
        });
  
        sendEvent({ type: "done", results, summary: { total: results.length, success: successCount, failed: failedCount } });
      } catch (fatalErr: unknown) {
        const msg = fatalErr instanceof Error ? fatalErr.message : "Error fatal en generación";
        sendEvent({ type: "error", scene: "system", label: "Sistema", error: msg, progress: 0, total: finalScenes.length });
        sendEvent({ type: "done", results, summary: { total: finalScenes.length, success: 0, failed: finalScenes.length } });
      }
      res.end();
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
  }
);

router.get("/reference-image-scenes", (req, res): void => {
  try {
    const productType = (req.query.productType as string) || "";
    const niche = (req.query.niche as string) || "general";
    const scenes = getScenesForProductType(productType, niche);
    res.json({ scenes: scenes.map(s => ({ key: s.key, label: s.label })), productType, niche });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

interface TryOnScene {
  key: string;
  label: string;
  aspectRatio: "1024x1024" | "1536x1024" | "1024x1536";
}

function getTryOnScenes(productType: string): TryOnScene[] {
  const lower = productType.toLowerCase();

  if (/camis|camiseta|polo|sudadera|hoodie|jersey|blusa|top|vest|shirt|ropa|vestido|falda|pantalon|chaqueta|abrigo/i.test(lower)) {
    return [
      { key: "model_front", label: "Modelo frontal — outfit completo", aspectRatio: "1024x1536" },
      { key: "model_street", label: "Street style — paseo urbano", aspectRatio: "1024x1536" },
      { key: "model_editorial", label: "Editorial de moda — revista", aspectRatio: "1024x1536" },
      { key: "model_casual", label: "Casual lifestyle — día a día", aspectRatio: "1536x1024" },
      { key: "model_close", label: "Close-up — detalle del outfit", aspectRatio: "1024x1024" },
    ];
  }

  if (/zapato|zapatilla|sneaker|bota|sandalia|calzado|shoe|boot/i.test(lower)) {
    return [
      { key: "feet_street", label: "Calzado en calle — caminando", aspectRatio: "1536x1024" },
      { key: "feet_full", label: "Outfit completo — calzado visible", aspectRatio: "1024x1536" },
      { key: "feet_detail", label: "Close-up — detalle del calzado", aspectRatio: "1024x1024" },
      { key: "feet_lifestyle", label: "Lifestyle — en contexto", aspectRatio: "1536x1024" },
    ];
  }

  if (/joya|collar|anillo|pulsera|pendiente|arete|reloj|gafas|bolso|accesorio/i.test(lower)) {
    return [
      { key: "worn_elegant", label: "Modelo con accesorio — elegante", aspectRatio: "1024x1536" },
      { key: "worn_closeup", label: "Close-up — accesorio puesto", aspectRatio: "1024x1024" },
      { key: "worn_lifestyle", label: "Lifestyle — uso cotidiano", aspectRatio: "1536x1024" },
      { key: "worn_editorial", label: "Editorial — revista de moda", aspectRatio: "1024x1536" },
    ];
  }

  if (/cosmetica|maquillaje|crema|serum|perfume|beauty|skincare|makeup|locion|champu|shampoo/i.test(lower)) {
    return [
      { key: "model_apply", label: "Modelo aplicando producto", aspectRatio: "1024x1024" },
      { key: "model_result", label: "Resultado — piel/cabello perfecto", aspectRatio: "1024x1536" },
      { key: "model_routine", label: "Rutina de belleza", aspectRatio: "1536x1024" },
      { key: "model_closeup", label: "Close-up facial con producto", aspectRatio: "1024x1024" },
    ];
  }

  return [
    { key: "model_using", label: "Modelo usando el producto", aspectRatio: "1024x1024" },
    { key: "model_lifestyle", label: "Lifestyle con producto", aspectRatio: "1536x1024" },
    { key: "model_hero", label: "Hero con modelo", aspectRatio: "1024x1536" },
    { key: "model_detail", label: "Detalle de uso", aspectRatio: "1024x1024" },
  ];
}

const multiUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Solo se aceptan imágenes"));
  },
});

router.post(
  "/projects/:projectId/products/:productId/images/virtual-tryon",
  multiUpload.fields([
    { name: "modelImage", maxCount: 1 },
    { name: "productImages", maxCount: 5 },
  ]),
  async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
      const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
      const shopifyProductId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  
      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
      if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
      const [product] = await db.select().from(productsTable)
        .where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, shopifyProductId)));
  
      const productTitle = product?.title || req.body.productTitle || "Producto";
      const productType = product?.productType || req.body.productType || "";
      const niche = project.storeNiche || "general";
      const autoUpload = req.body.autoUpload !== "false";
  
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const modelImageFile = files?.modelImage?.[0];
      const productImageFiles = files?.productImages || [];
  
      let modelBuffer: Buffer | null = null;
      const productBuffers: Buffer[] = [];
  
      if (modelImageFile) {
        modelBuffer = modelImageFile.buffer;
      } else if (req.body.modelImageUrl) {
        try { modelBuffer = await downloadImageToBuffer(req.body.modelImageUrl); } catch (e) {
          res.status(400).json({ error: `Error descargando imagen del modelo: ${e instanceof Error ? e.message : "desconocido"}` }); return;
        }
      }
  
      if (!modelBuffer) {
        res.status(400).json({ error: "Se requiere una imagen de la persona/modelo (modelImage o modelImageUrl)" }); return;
      }
  
      for (const f of productImageFiles) {
        productBuffers.push(f.buffer);
      }
  
      if (req.body.productImageUrls) {
        try {
          const urls: string[] = JSON.parse(req.body.productImageUrls);
          const maxUrls = 5;
          for (const url of urls.slice(0, maxUrls)) {
            const buf = await downloadImageToBuffer(url);
            productBuffers.push(buf);
          }
        } catch { /* ignore parse errors */ }
      }
  
      if (productBuffers.length === 0) {
        res.status(400).json({ error: "Se requiere al menos una imagen del producto (productImages o productImageUrls)" }); return;
      }
  
      if (productBuffers.length > 5) {
        productBuffers.length = 5;
      }
  
      let selectedScenes: string[] | null = null;
      if (req.body.scenes) {
        try { selectedScenes = JSON.parse(req.body.scenes); } catch { /* ignore */ }
      }
  
      const allScenes = getTryOnScenes(productType);
      const scenesToGen = selectedScenes
        ? allScenes.filter(s => selectedScenes!.includes(s.key))
        : allScenes;
  
      const limitCheck = await checkProductionLimit(projectId, "image", scenesToGen.length);
      const allowedCount = limitCheck.allowed ? scenesToGen.length : Math.max(0, limitCheck.remaining?.images ?? 0);
      if (allowedCount === 0) {
        res.status(403).json({ error: "Límite de imágenes alcanzado para tu plan", planLimit: true }); return;
      }
      const finalScenes = scenesToGen.slice(0, allowedCount);
  
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
  
      const sendEvent = (data: Record<string, unknown>) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };
  
      sendEvent({ type: "started", totalScenes: finalScenes.length, scenes: finalScenes.map(s => ({ key: s.key, label: s.label })) });
  
      const results: Array<{ scene: string; label: string; success: boolean; shopifyImageId?: number; error?: string }> = [];
  
      try {
        const { editMultipleImagesFromBuffers } = await import("@workspace/integrations-openai-ai-server/image");
        let position = 1;
  
        for (const scene of finalScenes) {
          sendEvent({ type: "generating", scene: scene.key, label: scene.label, progress: results.length + 1, total: finalScenes.length });
  
          try {
            const aiPrompt = await generateTryOnPrompt(projectId, productTitle, productType, niche, scene.label, scene.key);
  
            const imageInputs: Array<{ buffer: Buffer; name: string }> = [
              { buffer: modelBuffer, name: "person_model.png" },
              ...productBuffers.map((buf, i) => ({ buffer: buf, name: `product_${i + 1}.png` })),
            ];
  
            const generatedBuffer = await editMultipleImagesFromBuffers(imageInputs, aiPrompt, scene.aspectRatio);
  
            const altTextRaw = await askClaudeWithBrain(projectId, [{
              role: "user",
              content: `Genera un alt text SEO conciso (max 125 chars) para una foto de producto. Producto: ${productTitle}. Escena: ${scene.label}. Es una foto tipo "virtual try-on" con modelo real. En español. Solo el texto, sin comillas ni markdown.`
            }], undefined, "images", niche).catch(() => `${productTitle} - ${scene.label}`);
            const altText = altTextRaw.replace(/```[\s\S]*?```/g, "").replace(/["`]/g, "").split("\n")[0].trim().slice(0, 125);
  
            let shopifyImageId: number | undefined;
            if (autoUpload) {
              const uploadResult = await uploadBufferToShopify({
                projectId,
                shopDomain: project.shopDomain,
                shopifyProductId,
                imageBuffer: generatedBuffer,
                altText,
                position: position++,
              });
              if (uploadResult.success) shopifyImageId = uploadResult.shopifyImageId;
            }
  
            await recordUsage(projectId, "image", 1);
  
            const [job] = await db.insert(generationJobsTable).values({
              projectId,
              shopifyProductId,
              imageType: `tryon_${scene.key}`,
              status: "succeeded",
              prompt: aiPrompt.slice(0, 2000),
              model: "gpt-image-1",
              estimatedCost: 0.08,
              altText,
              shopifyImageId: shopifyImageId ?? null,
              completedAt: new Date(),
            }).returning();
  
            await saveToVault({
              projectId,
              fileType: "image",
              category: `tryon_${scene.key}`,
              title: `Virtual Try-On: ${scene.label} — ${productTitle}`,
              description: altText,
              mimeType: "image/png",
              content: generatedBuffer.toString("base64"),
              productId: shopifyProductId,
              productTitle,
              generatedBy: "virtual_tryon_engine",
              metadata: { model: "gpt-image-1", sceneKey: scene.key, jobId: job.id, encoding: "base64" },
            }).catch(() => {});
  
            results.push({ scene: scene.key, label: scene.label, success: true, shopifyImageId });
            sendEvent({ type: "completed", scene: scene.key, label: scene.label, success: true, shopifyImageId, progress: results.length, total: finalScenes.length });
          } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : "Error generando imagen";
            results.push({ scene: scene.key, label: scene.label, success: false, error: errorMsg });
            sendEvent({ type: "error", scene: scene.key, label: scene.label, error: errorMsg, progress: results.length, total: finalScenes.length });
          }
        }
  
        const successCount = results.filter(r => r.success).length;
        const failedCount = results.filter(r => !r.success).length;
  
        learnFromOperation({
          operationType: "images",
          niche,
          productType,
          title: `Virtual Try-On: ${productTitle} (${successCount}/${results.length} exitosas)`,
          content: `Tipo: virtual_tryon\nProducto: ${productTitle}\nEscenas: ${results.map(r => `${r.label}(${r.success ? "ok" : "fail"})`).join(", ")}\nModelo: gpt-image-1\nImágenes producto: ${productBuffers.length}`,
          confidence: 0.90,
          tags: ["virtual_tryon", niche, productType].filter(Boolean),
        });
  
        sendEvent({ type: "done", results, summary: { total: results.length, success: successCount, failed: failedCount } });
      } catch (fatalErr: unknown) {
        const msg = fatalErr instanceof Error ? fatalErr.message : "Error fatal";
        sendEvent({ type: "error", scene: "system", label: "Sistema", error: msg, progress: 0, total: finalScenes.length });
        sendEvent({ type: "done", results, summary: { total: finalScenes.length, success: 0, failed: finalScenes.length } });
      }
      res.end();
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
  }
);

router.get("/virtual-tryon-scenes", (req, res): void => {
  try {
    const productType = (req.query.productType as string) || "";
    const scenes = getTryOnScenes(productType);
    res.json({ scenes: scenes.map(s => ({ key: s.key, label: s.label })), productType });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

async function generateTryOnPrompt(
  projectId: number,
  productTitle: string,
  productType: string,
  niche: string,
  sceneLabel: string,
  sceneKey: string
): Promise<string> {
  const systemPrompt = `You are the world's TOP fashion photographer and creative director specializing in virtual try-on and product-on-model photography. You have directed campaigns for Zara, Nike, Chanel, Supreme, Gucci, and Sephora.

Your job: Write ONE hyper-specific image editing prompt that will DRESS the person from Image 1 (the model photo) with ALL the products/items shown in Image 2+ (the product photos).

CRITICAL RULES:
1. Image 1 is the PERSON/MODEL. PRESERVE their face, identity, body type, skin tone, and natural features EXACTLY. Do not alter the person's appearance.
2. Images 2+ are the PRODUCT(S) to put ON the model. Every product detail (color, pattern, texture, design, brand elements) must be EXACTLY preserved on the model.
3. The result must look like a REAL photograph — no AI artifacts, no uncanny valley, no floating products.
4. Specify the EXACT scene/setting matching the shot type. Include specific lighting, environment, mood.
5. For clothing: the garments must FIT naturally on the person's body with proper draping, wrinkles, and shadows.
6. For accessories: they must be worn/held naturally with proper scale and positioning.
7. For cosmetics: show natural application with realistic skin interaction.
8. Output ONLY the prompt — no explanations, no markdown, no quotes.
9. Maximum 200 words. Every word must add visual direction.
10. NEVER include text/typography/watermarks in the image.
11. Always start with: "Take the person from Image 1 and..."`;

  const userPrompt = `PRODUCT: "${productTitle}"
CATEGORY: ${productType}
STORE NICHE: ${niche}
SCENE: ${sceneLabel} (key: ${sceneKey})
NUMBER OF PRODUCT IMAGES: Multiple product/outfit pieces to combine on the model

Write the specialized virtual try-on prompt for this product and scene.`;

  try {
    const result = await askClaudeWithBrain(projectId, [{ role: "user", content: userPrompt }], systemPrompt, "images", niche);
    const cleaned = result.replace(/```[\s\S]*?```/g, "").replace(/```/g, "").replace(/^["']|["']$/g, "").trim();
    if (cleaned.length >= 50) return cleaned;
  } catch { /* fall through to default */ }

  return `Take the person from Image 1 and dress them wearing ALL the clothing and accessories shown in the product images (Images 2+). The product "${productTitle}" must appear EXACTLY as shown — same color, texture, pattern, design details. The person's face, identity, and body type must remain EXACTLY the same. Create a professional ${sceneLabel} photo with natural lighting, realistic fabric draping, proper shadows, and commercial fashion photography quality. Shot on 85mm f/1.8 lens, editorial magazine quality.`;
}

export default router;
export { getScenesForProductType, getTryOnScenes, downloadImageToBuffer, uploadBufferToShopify, generateDynamicCreativeScenes };
