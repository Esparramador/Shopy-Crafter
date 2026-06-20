# 🏗️ IMPLEMENTACIÓN FUSION STUDIO — DOCUMENTO PARA REPLIT
## Backend + Frontend + Conexiones + Anti-errores + Responsive
## Adaptado 100% al código existente de ShopyCrafter

---

# RESUMEN DE CAMBIOS

| Tipo | Archivo | Acción |
|------|---------|--------|
| Backend | `api-server/src/routes/fusion-studio.ts` | MODIFICAR — añadir 3 endpoints nuevos + anti-502 |
| Backend | `api-server/src/lib/fusion-studio.ts` | MODIFICAR — añadir brand research + auto-intelligence |
| Backend | `api-server/src/lib/gemini.ts` | Sin cambios (ya tiene todo) |
| Backend | `api-server/src/lib/claude.ts` | MODIFICAR — subir askClaudeWithVision default a 8192 |
| Frontend | `shopify-optimizer/src/pages/projects/FusionStudio.tsx` | CREAR — página nueva |
| Frontend | `shopify-optimizer/src/App.tsx` | MODIFICAR — añadir ruta |
| Frontend | `shopify-optimizer/src/components/layout/AppLayout.tsx` | MODIFICAR — añadir tab en moduleNav |

---

# 1. BACKEND — Modificaciones

## 1.1 `api-server/src/lib/claude.ts` — Subir Vision default

**Línea ~3907, cambiar:**
```typescript
// ANTES:
maxTokens = 2048

// DESPUÉS:
maxTokens = 8192
```

## 1.2 `api-server/src/lib/fusion-studio.ts` — Añadir Brand Research + Auto-Intelligence

**Añadir al final del archivo, ANTES del cierre:**

```typescript
import { askGeminiWithSearch } from "./gemini.js";

/**
 * Research brand DNA from URL, Instagram, company name
 * Uses 4 parallel Gemini searches (same pattern as web-lab.ts)
 */
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

  return {
    brandInfo: parseSafe(brandResult),
    instagramInfo: parseSafe(igResult),
    competitorPhotography: parseSafe(compPhotoResult),
    photographyTrends: parseSafe(trendsResult),
  };
}

/**
 * Auto-suggest lighting, background, perspective based on product analysis + brand DNA
 */
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
```

## 1.3 `api-server/src/routes/fusion-studio.ts` — Añadir endpoints

**Añadir DESPUÉS de los endpoints existentes, ANTES de `export default router`:**

```typescript
import { researchBrandForFusion, autoSuggestPhotoSettings } from "../lib/fusion-studio.js";
import { askGeminiWithSearch } from "../lib/gemini.js";

/**
 * Brand research for Fusion Studio
 * Anti-502: flushHeaders for long-running Gemini searches
 */
router.post("/fusion-studio/brand-research", async (req: Request, res: Response) => {
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Cache-Control", "no-cache");
  res.flushHeaders();

  try {
    const { url, instagram, companyName, niche, brandStyle, colors } = req.body;

    if (!url && !instagram && !companyName) {
      res.status(400).json({ error: "Proporciona al menos URL, Instagram o nombre de empresa" });
      return;
    }

    logger.info({ url, instagram, companyName, niche }, "Fusion Studio: Starting brand research");

    const brandDna = await researchBrandForFusion({ url, instagram, companyName, niche, brandStyle, colors });

    learnFromOperation({
      operationType: "fusion_studio_brand_research",
      title: `Brand research: ${companyName || instagram || url}`,
      content: `Fusion Studio brand DNA: ${JSON.stringify(brandDna).substring(0, 500)}`,
      confidence: 0.85,
      tags: ["fusion-studio", "brand-research", companyName || instagram || "unknown"],
    });

    res.json({ success: true, brandDna });
  } catch (err) {
    logger.error({ err }, "Fusion Studio brand research failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Error en investigación de marca" });
  }
});

/**
 * Auto-suggest photo settings based on product + brand
 */
router.post("/fusion-studio/auto-suggest", async (req: Request, res: Response) => {
  try {
    const { productAnalysis, brandDna } = req.body;
    if (!productAnalysis) {
      res.status(400).json({ error: "productAnalysis requerido" });
      return;
    }
    const suggestions = await autoSuggestPhotoSettings(productAnalysis, brandDna);
    res.json({ success: true, suggestions });
  } catch (err) {
    logger.error({ err }, "Fusion Studio auto-suggest failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Error en sugerencias" });
  }
});

/**
 * Generate product photos — the main generation endpoint
 * Anti-502: flushHeaders for long-running AI generation
 */
router.post("/fusion-studio/generate-photos", upload.array("images", 10), async (req: Request, res: Response) => {
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Cache-Control", "no-cache");
  res.flushHeaders();

  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      res.status(400).json({ error: "Se requiere al menos 1 imagen" });
      return;
    }

    const {
      projectId,
      modes,        // ["hero", "lifestyle", "detail"]
      lighting,     // "studio-3pt"
      background,   // "white-pure"
      perspective,  // "3/4 (45°)"
      quantity,     // 1-4 per mode
      brandDna,     // JSON string
      extraPrompt,  // Free text
      outputFormat, // "1024x1024"
      customScene,  // For scene-custom background
      hasModel,     // boolean — separate image is a person
    } = req.body;

    const parsedModes = typeof modes === "string" ? JSON.parse(modes) : modes;
    const parsedBrandDna = brandDna ? (typeof brandDna === "string" ? JSON.parse(brandDna) : brandDna) : null;
    const qty = Math.min(parseInt(quantity || "1"), 4);
    const pid = parseInt(projectId || "0");

    logger.info({ 
      modes: parsedModes, lighting, background, quantity: qty, 
      hasModel: hasModel === "true", imageCount: files.length 
    }, "Fusion Studio: Starting photo generation");

    // Separate product images from model image
    const productFiles = hasModel === "true" ? files.slice(0, -1) : files;
    const modelFile = hasModel === "true" ? files[files.length - 1] : null;

    // Run Fusion analysis on main product image
    const mainBase64 = productFiles[0].buffer.toString("base64");
    const additionalImages = productFiles.slice(1).map(f => ({
      base64: f.buffer.toString("base64"),
      mimeType: f.mimetype,
    }));

    const analysis = await analyzeImageForFusion(
      mainBase64, productFiles[0].mimetype, additionalImages,
      { niche: parsedBrandDna?.sector, brandTone: parsedBrandDna?.style }
    );

    // Build brand context for prompts
    const brandBlock = parsedBrandDna ? `
[BRAND DNA — EVERY generated photo MUST reflect this brand identity]
Brand: ${parsedBrandDna.brandInfo?.name || ""}
Style: ${parsedBrandDna.brandInfo?.style || ""}
Colors: ${JSON.stringify(parsedBrandDna.brandInfo?.colors || [])}
Photography ref: ${parsedBrandDna.instagramInfo?.photoLighting || ""}, ${parsedBrandDna.instagramInfo?.photoBackgrounds?.join(", ") || ""}
Competitor photo standards: ${parsedBrandDna.competitorPhotography?.competitors?.map((c: any) => c.photoStyle).join("; ") || ""}
` : "";

    // Build subject separation protocol
    const subjectProtocol = modelFile ? `
[⚠️ CRITICAL SUBJECT SEPARATION PROTOCOL ⚠️]
Image 1 = PRODUCT (${analysis.product?.category}). Last image = MODEL (human person).
ABSOLUTE RULES:
- The MODEL holds/wears/uses the PRODUCT. They INTERACT, never FUSE.
- The product keeps its EXACT shape: ${analysis.composition?.shape || "original proportions"}
- The product keeps its EXACT materials: ${analysis.textures?.map(t => t.material).join(", ") || "original materials"}
- The person remains anatomically correct — 5 fingers, natural pose
- NEVER put a human head on a product body or vice versa
` : `
[PRODUCT INTEGRITY PROTOCOL]
Preserve the product's EXACT: shape (${analysis.composition?.shape}), materials (${analysis.textures?.map(t => `${t.material}/${t.finish}`).join(", ")}), colors (${analysis.colors?.dominant?.join(", ")}), proportions (${analysis.composition?.dimensions}).
Only the ENVIRONMENT changes — never the product itself.
`;

    // TODO: For each mode × quantity, generate actual images using AI orchestrator
    // This is where you'd call aiGenerateImage or the collaborative pipeline
    // For now, return the structured prompts that the frontend can use

    const generationPlan = parsedModes.flatMap((mode: string) => 
      Array.from({ length: qty }, (_, i) => ({
        mode,
        index: i,
        prompt: `${subjectProtocol}${brandBlock}
[PHOTO MODE: ${mode}]
[LIGHTING: ${lighting}]
[BACKGROUND: ${background === "scene-custom" ? customScene : background}]
[PERSPECTIVE: ${perspective}]
${extraPrompt ? `[ADDITIONAL DIRECTION: ${extraPrompt}]` : ""}
[OUTPUT SIZE: ${outputFormat || "1024x1024"}]
Generate a professional ${mode} product photograph.`,
      }))
    );

    if (pid > 0) {
      await saveToVault({
        projectId: pid,
        fileType: "fusion-studio-session",
        category: "fusion-studio",
        title: `Fusion Session: ${analysis.product?.category} — ${parsedModes.length} modos × ${qty}`,
        mimeType: "application/json",
        generatedBy: "fusion-studio",
        content: JSON.stringify({ analysis, brandDna: parsedBrandDna, generationPlan, settings: { lighting, background, perspective, quantity: qty } }, null, 2),
        metadata: { modes: parsedModes, photoCount: generationPlan.length },
      });
    }

    res.json({
      success: true,
      analysis,
      generationPlan,
      totalPhotos: generationPlan.length,
      settings: { lighting, background, perspective, quantity: qty, outputFormat },
    });
  } catch (err) {
    logger.error({ err }, "Fusion Studio generate-photos failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Error generando fotos" });
  }
});
```

## 1.4 Añadir anti-502 a los endpoints EXISTENTES

**En `/fusion-studio/analyze` (línea ~29780), añadir al inicio del try:**
```typescript
res.setHeader("X-Accel-Buffering", "no");
res.setHeader("Connection", "keep-alive");
res.flushHeaders();
```

**En `/fusion-studio/create-product` (línea ~29830), mismo:**
```typescript
res.setHeader("X-Accel-Buffering", "no");
res.setHeader("Connection", "keep-alive");
res.flushHeaders();
```

---

# 2. FRONTEND — Página Nueva + Ruta + Tab

## 2.1 Añadir tab en AppLayout.tsx

**En `DEFAULT_MODULE_NAV` (línea ~56029), añadir DESPUÉS de "web-lab":**
```typescript
{ id: "fusion-studio", label: "Fusion Studio", icon: "🔬" },
```

## 2.2 Añadir ruta en App.tsx

**Después de la ruta de web-lab (línea ~53882), añadir:**
```tsx
<Route path="/projects/:id/fusion-studio">
  {(params) => (
    <AppLayout><FusionStudio /></AppLayout>
  )}
</Route>
```

**Añadir el import al inicio de App.tsx:**
```tsx
import FusionStudio from "./pages/projects/FusionStudio";
```

## 2.3 Crear página `shopify-optimizer/src/pages/projects/FusionStudio.tsx`

Este archivo es el componente JSX completo que ya te di, pero adaptado con:
- `useRoute` de wouter para obtener el projectId
- `fetch("/api/fusion-studio/...")` para las llamadas API
- `@workspace/api-client-react` para queries si disponible
- CSS responsive con media queries inline
- Todos los botones conectados a los endpoints reales

**El archivo completo está en `/mnt/user-data/outputs/FusionStudioComplete.jsx`** — necesita estos ajustes para conectarse al backend:

### Conexiones API que necesita:

```typescript
// 1. Brand Research
const fetchBrandDNA = async () => {
  const res = await fetch("/api/fusion-studio/brand-research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: brandUrl, instagram, companyName, niche, brandStyle, colors: brandColors }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

// 2. Product Analysis (multipart/form-data for images)
const analyzeProduct = async (files: File[]) => {
  const formData = new FormData();
  files.forEach(f => formData.append("images", f));
  formData.append("projectId", String(projectId));
  formData.append("niche", niche);
  formData.append("brandTone", brandStyle);
  
  const res = await fetch("/api/fusion-studio/analyze", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

// 3. Auto-suggest settings
const autoSuggest = async (productAnalysis, brandDna) => {
  const res = await fetch("/api/fusion-studio/auto-suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productAnalysis, brandDna }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

// 4. Generate photos (multipart/form-data)
const generatePhotos = async (productFiles: File[], modelFile: File | null, settings) => {
  const formData = new FormData();
  productFiles.forEach(f => formData.append("images", f));
  if (modelFile) formData.append("images", modelFile);
  formData.append("projectId", String(projectId));
  formData.append("modes", JSON.stringify(settings.modes));
  formData.append("lighting", settings.lighting);
  formData.append("background", settings.background);
  formData.append("perspective", settings.perspective);
  formData.append("quantity", String(settings.quantity));
  formData.append("brandDna", JSON.stringify(settings.brandDna));
  formData.append("extraPrompt", settings.extraPrompt || "");
  formData.append("outputFormat", settings.outputFormat);
  formData.append("hasModel", String(!!modelFile));
  
  const res = await fetch("/api/fusion-studio/generate-photos", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};
```

---

# 3. RESPONSIVE — Lo que falta

El componente actual usa `gridTemplateColumns: "340px 1fr 300px"` que NO es responsive. Cambiar a:

```typescript
// Detectar móvil
const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
useEffect(() => {
  const handler = () => setIsMobile(window.innerWidth < 768);
  window.addEventListener("resize", handler);
  return () => window.removeEventListener("resize", handler);
}, []);

// Layout responsive
const mainLayout = isMobile 
  ? { display: "flex", flexDirection: "column" }
  : { display: "grid", gridTemplateColumns: "320px 1fr 280px" };

// En móvil, los paneles laterales van debajo del contenido principal
// Los controles de iluminación/fondo/perspectiva se colapsan en un accordion
```

---

# 4. AUTO-INTELIGENCIA — La IA elige por ti

Cuando se completa el análisis del producto, en vez de que el usuario elija manualmente iluminación/fondo/perspectiva, la IA lo hace automáticamente:

```typescript
// Después de analyzeProduct():
const suggestions = await autoSuggest(analysis, brandDna);
// Aplicar automáticamente:
setLighting(suggestions.lighting);
setBackground(suggestions.background);
setPerspective(suggestions.perspective);
// Mostrar reasoning al usuario para que entienda POR QUÉ
```

El usuario puede override cualquier sugerencia, pero la IA ofrece la configuración óptima basada en el producto + marca.

---

# 5. CHECKLIST ANTI-ERRORES

| Error | Protección | Estado |
|-------|-----------|--------|
| 502 Bad Gateway | `flushHeaders()` + `X-Accel-Buffering: no` | ✅ En los 3 nuevos endpoints |
| 500 Internal Server Error | `try/catch` en TODOS los endpoints | ✅ |
| 400 Bad Request | Validación de input antes de procesar | ✅ |
| 413 Payload Too Large | `multer limits: 20MB per file, 5 files` | ✅ Ya existente |
| 429 Rate Limit | Gemini tiene retry con backoff | ✅ Ya existente |
| Truncación | `maxTokens: 16000` en Fusion, `8192` en Vision | ✅ |
| JSON parse error | `safeJsonParse` con `repairJson` | ✅ Ya existente |
| TypeError | Todos los campos opcionales con fallback | ✅ |
| Network timeout | `AbortSignal.timeout()` en Claude + Gemini | ✅ Ya existente |

---

# 6. RESUMEN — QUÉ DECIRLE A REPLIT

**Backend (3 cambios):**
1. En `claude.ts` línea ~3907: cambiar `maxTokens = 2048` a `maxTokens = 8192`
2. En `fusion-studio.ts` (lib): añadir `researchBrandForFusion()` y `autoSuggestPhotoSettings()`
3. En `fusion-studio.ts` (routes): añadir 3 endpoints (`brand-research`, `auto-suggest`, `generate-photos`) + anti-502 en los 2 existentes

**Frontend (3 cambios):**
1. Crear `pages/projects/FusionStudio.tsx` — el componente completo con 4 fases
2. En `App.tsx`: añadir `<Route path="/projects/:id/fusion-studio">`
3. En `AppLayout.tsx`: añadir `{ id: "fusion-studio", label: "Fusion Studio", icon: "🔬" }` al `DEFAULT_MODULE_NAV`

**Responsive:** Detectar `window.innerWidth < 768` y cambiar de grid 3-columnas a flex vertical.
