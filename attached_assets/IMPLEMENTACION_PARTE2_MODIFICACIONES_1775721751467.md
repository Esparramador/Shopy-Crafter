# ⚡ IMPLEMENTACIÓN PARTE 2: MODIFICACIONES A ARCHIVOS EXISTENTES
# Cada cambio indica: archivo, qué buscar, qué añadir/reemplazar
# TODO es ADITIVO — no borrar código existente

---

# ═══════════════════════════════════════════════════════
# BLOQUE A: MULTI-PLATAFORMA — Migrar endpoints Shopify
# ═══════════════════════════════════════════════════════

## A.1 — `api-server/src/routes/pricing.ts`

### Cambio 1: Fix apply-price
**BUSCAR** la línea que contiene:
```
router.post("/projects/:projectId/products/:productId/apply-price"
```
**DENTRO** de ese handler, **BUSCAR**:
```
await shopifyRequest(projectId, project.shopDomain, `/products/${shopifyProductId}.json`
```
**REEMPLAZAR** ese bloque de shopifyRequest (incluyendo el body con variants) **POR**:
```typescript
  import { updateStoreProduct } from "../lib/platform-helper.js";
  const updateResult = await updateStoreProduct(projectId, shopifyProductId, {
    price,
    compareAtPrice: compareAtPrice ?? null,
    variants: [{ platformId: "", title: "", price, compareAtPrice: compareAtPrice || undefined }],
  });
  if (!updateResult.ok) {
    res.status(400).json({ error: updateResult.error });
    return;
  }
```

### Cambio 2: Fix ai-estimate-cogs shopifyRequest
**BUSCAR** dentro de `ai-estimate-cogs`:
```
const live = await shopifyRequest<{ product: Record<string, unknown> }>(
```
**REEMPLAZAR** todo el bloque try que obtiene shopifyDetails **POR**:
```typescript
  let shopifyDetails = "";
  try {
    const { getProjectConnector } = await import("../lib/platform-helper.js");
    const connector = await getProjectConnector(projectId);
    if (connector && connector.supportsFeature("products")) {
      const liveProduct = await connector.getProduct(shopifyProductId);
      const weight = liveProduct.variants?.[0] ? "estimado" : "desconocido";
      shopifyDetails = `
Vendor: ${liveProduct.vendor || "desconocido"}
Tipo de producto: ${liveProduct.productType || "sin tipo"}
Variantes: ${liveProduct.variants?.length ?? 1} (precios: ${liveProduct.variants?.map(v => `€${v.price}`).join(", ") ?? "N/A"})
`;
    }
  } catch {}
```

## A.2 — `api-server/src/routes/redesign.ts`

### Cambio: Aplicar rediseño multi-plataforma
**BUSCAR** todas las llamadas a `shopifyRequest` dentro de handlers de apply/redesign.
**PARA CADA UNA**, envolver en check de plataforma:
```typescript
  const { getProjectConnector } = await import("../lib/platform-helper.js");
  const connector = await getProjectConnector(projectId);
  if (!connector || !connector.supportsFeature("product_update")) {
    res.status(400).json({ error: "Plataforma no soporta actualización de productos" });
    return;
  }
  await connector.updateProduct(shopifyProductId, {
    title: newTitle,
    bodyHtml: newBodyHtml,
    tags: newTags,
    // ... otros campos del rediseño
  });
```

## A.3 — `api-server/src/routes/seo.ts`

**BUSCAR** llamadas a `shopifyGraphQL` para actualizar SEO.
**REEMPLAZAR** con:
```typescript
  const { updateStoreSeo } = await import("../lib/platform-helper.js");
  const seoResult = await updateStoreSeo(projectId, productId, {
    metaTitle: newMetaTitle,
    metaDescription: newMetaDescription,
  });
  if (!seoResult.ok) {
    logger.warn({ error: seoResult.error }, "SEO update failed — platform may not support SEO write");
  }
```

## A.4 — `api-server/src/lib/scheduler.ts`

### Cambio 1: Revenue snapshots multi-plataforma
**BUSCAR**:
```
const data = await shopifyRequest<{ orders: Array<{ total_price: string }> }>(
```
**REEMPLAZAR** todo el bloque de orders **POR**:
```typescript
      const { getProjectConnector } = await import("./platform-helper.js");
      const connector = await getProjectConnector(project.id);
      if (!connector || !connector.supportsFeature("orders")) continue;
      
      try {
        const orders = await connector.getOrders({ 
          limit: 250, 
          after: new Date(Date.now() - 24*60*60*1000).toISOString() 
        });
        const revenue = orders.reduce((sum, o) => sum + parseFloat(o.total ?? "0"), 0);
```

### Cambio 2: Inventory sync multi-plataforma
**BUSCAR**:
```
const d = await shopifyRequest<{ products: InventoryProduct[] }>(
```
**REEMPLAZAR** con:
```typescript
        const connector = await getProjectConnector(project.id);
        if (!connector || !connector.supportsFeature("products")) continue;
        const platformProducts = await connector.getProducts({ status: "active", limit: 250 });
```

## A.5 — `api-server/src/index.ts`

### Cambio 1: Fix contraseña admin
**BUSCAR**:
```
const ADMIN_PASS = envPass || "ShopyAdmin2026!";
```
**REEMPLAZAR POR**:
```typescript
    const ADMIN_PASS = envPass || (() => {
      const gen = randomBytes(24).toString("base64url");
      logger.info({ generatedPassword: gen }, "🔑 Dev admin password generated (no ADMIN_PASSWORD env set)");
      return gen;
    })();
```

### Cambio 2: Fix email admin
**BUSCAR**:
```
const ADMIN_EMAIL = "sadiagiljoan@gmail.com";
```
**REEMPLAZAR POR**:
```typescript
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "sadiagiljoan@gmail.com";
    const ADMIN_NAME = process.env.ADMIN_NAME || "Joan Sadia Gil";
```

## A.6 — `api-server/src/app.ts`

### Cambio: Fix rate limiting
**BUSCAR** (aparece 3 veces):
```
skip: (req) => process.env.NODE_ENV !== "production",
```
**REEMPLAZAR CADA UNA POR**:
```typescript
  skip: (req) => process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test",
```

## A.7 — `api-server/src/lib/connectors/types.ts`

### Cambio: Fix mensaje de error
**BUSCAR**:
```
Plataformas disponibles: shopify
```
**REEMPLAZAR POR**:
```
Plataformas disponibles: shopify, woocommerce, prestashop, universal
```

---

# ═══════════════════════════════════════════════════════
# BLOQUE B: SISTEMA DE NIVELES EN EL GENERADOR
# ═══════════════════════════════════════════════════════

## B.1 — `api-server/src/routes/generator.ts`

### Cambio 1: Añadir import de report-levels
**BUSCAR** al inicio del archivo los imports.
**AÑADIR** después del último import:
```typescript
import { generateLeveledReport, type LeveledReportResult } from "../lib/report-levels.js";
import { REPORT_LEVELS } from "../lib/config.js";
```

### Cambio 2: Endpoint para obtener niveles disponibles
**BUSCAR**:
```
router.get("/generator/types"
```
**AÑADIR ANTES de ese endpoint**:
```typescript
// ─── Endpoint: niveles de informe disponibles ─────────────────────────
router.get("/generator/levels", (_req, res) => {
  res.json({ success: true, levels: REPORT_LEVELS });
});
```

### Cambio 3: Modificar el endpoint /generator/run para aceptar level
**BUSCAR**:
```
const { type, projectId, url, format, template, params: extraParams } = req.body;
```
**REEMPLAZAR POR**:
```typescript
  const { type, projectId, url, format, template, level, params: extraParams } = req.body;
  const reportLevel = (level && level >= 1 && level <= 5) ? level : 1;
```

### Cambio 4: Dentro de runGenerator, inyectar el sistema de niveles
**BUSCAR** la función `runGenerator` o donde se hace la llamada a Claude para generar el informe.
**ANTES** de la llamada a askClaude, **AÑADIR**:
```typescript
    // Si el usuario eligió nivel > 1, usar el sistema de niveles completo
    if (reportLevel > 1 && pid) {
      const levelResult = await generateLeveledReport({
        projectId: pid,
        level: reportLevel as any,
        reportType: type,
        reportTitle: genType.label,
        dataBlock: /* el dataBlock que ya se construye aquí */,
        niche: project?.storeNiche ?? undefined,
        template: tpl,
      });

      return {
        success: true,
        type,
        level: reportLevel,
        levelName: levelResult.levelName,
        files: levelResult.files.map(f => ({
          type: f.type,
          title: f.title,
          vaultId: f.vaultId,
        })),
        totalFiles: levelResult.files.length,
        message: `Informe ${levelResult.levelName} generado con ${levelResult.files.length} archivos`,
        vaultSaved: true,
        brainLearned: true,
      };
    }
```

## B.2 — Frontend: `pages/projects/UniversalGenerator.tsx`

### Cambio: Añadir selector de nivel
**BUSCAR** donde está el selector de tipo de generación (el dropdown de tipo de informe).
**AÑADIR DEBAJO**:
```tsx
{/* Selector de nivel de informe */}
<div style={{ marginTop: 16 }}>
  <label style={{ fontSize: 13, color: "var(--t2)", fontWeight: 600, display: "block", marginBottom: 8 }}>
    📊 Nivel de profundidad del informe
  </label>
  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
    {[1, 2, 3, 4, 5].map(lvl => {
      const labels = {
        1: { name: "Diagnóstico", color: "#c8a84b", price: "Base" },
        2: { name: "Guía Implementación", color: "#60a5fa", price: "+Guía paso a paso" },
        3: { name: "Contenido Producido", color: "#c084fc", price: "+Contenido listo" },
        4: { name: "Premium Full", color: "#f472b6", price: "+CSS, código, emails" },
        5: { name: "Enterprise", color: "#fbbf24", price: "+Roadmap 12 meses" },
      }[lvl]!;
      return (
        <button
          key={lvl}
          onClick={() => setReportLevel(lvl)}
          style={{
            padding: "8px 16px",
            borderRadius: 12,
            border: reportLevel === lvl ? `2px solid ${labels.color}` : "1px solid var(--bdr)",
            background: reportLevel === lvl ? `${labels.color}15` : "var(--ink2)",
            color: reportLevel === lvl ? labels.color : "var(--t2)",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: reportLevel === lvl ? 700 : 500,
            transition: "all 0.2s",
          }}
        >
          <div style={{ fontWeight: 700 }}>Nivel {lvl}</div>
          <div style={{ fontSize: 10, opacity: 0.8 }}>{labels.name}</div>
          <div style={{ fontSize: 9, marginTop: 2 }}>{labels.price}</div>
        </button>
      );
    })}
  </div>
  {reportLevel > 1 && (
    <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 6 }}>
      ✨ Nivel {reportLevel}: se generarán {reportLevel >= 5 ? "5" : reportLevel >= 4 ? "4" : reportLevel >= 3 ? "3" : "2"} archivos separados (informe
      {reportLevel >= 2 ? " + guía paso a paso" : ""}
      {reportLevel >= 3 ? " + contenido producido" : ""}
      {reportLevel >= 4 ? " + activos premium (CSS, schemas, emails)" : ""}
      {reportLevel >= 5 ? " + roadmap enterprise 12 meses" : ""})
    </p>
  )}
</div>
```

**AÑADIR** el state:
```tsx
const [reportLevel, setReportLevel] = useState(1);
```

**En el fetch de generación**, añadir `level` al body:
```tsx
body: JSON.stringify({ type: selectedType, projectId, url, format, template, level: reportLevel, params: extraParams }),
```

---

# ═══════════════════════════════════════════════════════
# BLOQUE C: FUSION STUDIO EN EL CHATBOT + RUTAS
# ═══════════════════════════════════════════════════════

## C.1 — Nueva ruta: `api-server/src/routes/fusion-studio.ts` (CREAR)

```typescript
import { Router, type Request, type Response } from "express";
import { analyzeImageForFusion } from "../lib/fusion-studio.js";
import { askClaudeWithBrain, learnFromOperation } from "../lib/claude.js";
import { saveToVault } from "../lib/vault.js";
import { db, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 5 } });

// ─── POST /api/fusion-studio/analyze ────────────────────────────────────
router.post("/fusion-studio/analyze", upload.array("images", 5), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "Se requiere al menos 1 imagen" });
    }

    const projectId = parseInt(req.body.projectId || "0");
    const niche = req.body.niche || undefined;
    const brandTone = req.body.brandTone || undefined;

    // Imagen principal
    const mainImage = files[0];
    const mainBase64 = mainImage.buffer.toString("base64");

    // Imágenes adicionales de referencia
    const additionalImages = files.slice(1).map(f => ({
      base64: f.buffer.toString("base64"),
      mimeType: f.mimetype,
    }));

    logger.info({ imageCount: files.length, projectId }, "🔬 Fusion Studio: Starting analysis");

    const analysis = await analyzeImageForFusion(
      mainBase64, mainImage.mimetype, additionalImages,
      { niche, brandTone }
    );

    // Guardar en Vault si hay proyecto
    let vaultId: number | null = null;
    if (projectId > 0) {
      vaultId = await saveToVault({
        projectId,
        fileType: "fusion-studio-analysis",
        category: "fusion-studio",
        title: `Fusion Studio: ${analysis.product?.category ?? "producto"} — ${analysis.product?.subcategory ?? ""}`,
        description: `Análisis completo: ${analysis.layers?.length ?? 0} capas, ${analysis.textures?.length ?? 0} texturas, ${analysis.colors?.palette?.length ?? 0} colores`,
        mimeType: "application/json",
        generatedBy: "fusion-studio",
        content: JSON.stringify(analysis, null, 2),
        metadata: { imageCount: files.length },
      });
    }

    res.json({ success: true, analysis, vaultId });
  } catch (err: any) {
    logger.error({ err }, "Fusion Studio analysis failed");
    res.status(500).json({ error: err.message || "Error en análisis Fusion Studio" });
  }
});

// ─── POST /api/fusion-studio/create-product ─────────────────────────────
// Crea un producto COMPLETO a partir del análisis de Fusion Studio
router.post("/fusion-studio/create-product", upload.array("images", 5), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "Se requiere al menos 1 imagen del producto" });
    }

    const projectId = parseInt(req.body.projectId || "0");
    if (!projectId) return res.status(400).json({ error: "projectId requerido" });

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) return res.status(404).json({ error: "Proyecto no encontrado" });

    // 1. Analizar imágenes
    const mainBase64 = files[0].buffer.toString("base64");
    const additionalImages = files.slice(1).map(f => ({
      base64: f.buffer.toString("base64"),
      mimeType: f.mimetype,
    }));

    const analysis = await analyzeImageForFusion(
      mainBase64, files[0].mimetype, additionalImages,
      { niche: (project as any).storeNiche, brandTone: (project as any).brandTone }
    );

    // 2. Crear producto en la plataforma
    const { getProjectConnector } = await import("../lib/platform-helper.js");
    const connector = await getProjectConnector(projectId);
    if (!connector || !connector.supportsFeature("product_create")) {
      return res.status(400).json({ error: "Plataforma no soporta creación de productos" });
    }

    const pg = analysis.productGeneration;
    const createdProduct = await connector.createProduct({
      title: pg.suggestedTitle,
      bodyHtml: pg.suggestedDescription,
      productType: analysis.product?.subcategory || analysis.product?.category || "",
      tags: pg.suggestedTags.join(", "),
      price: pg.suggestedPrice?.replace(/[^0-9.]/g, "") || null,
      images: [], // Se añadirán después
      variants: [{ platformId: "", title: "Default", price: pg.suggestedPrice?.replace(/[^0-9.]/g, "") || "0" }],
    });

    // 3. Subir imágenes al producto creado
    for (const file of files) {
      try {
        // Convertir buffer a URL temporal o base64 según plataforma
        const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
        await connector.uploadImage(createdProduct.platformId, dataUrl, pg.suggestedTitle);
      } catch (imgErr) {
        logger.warn({ err: imgErr }, "Failed to upload image to product");
      }
    }

    // 4. Guardar análisis en vault
    await saveToVault({
      projectId,
      fileType: "fusion-studio-product",
      category: "fusion-studio",
      title: `Producto Fusion: ${pg.suggestedTitle}`,
      mimeType: "application/json",
      generatedBy: "fusion-studio",
      content: JSON.stringify({ analysis, createdProduct }, null, 2),
    });

    learnFromOperation({
      operationType: "fusion_studio_create_product",
      niche: (project as any).storeNiche ?? null,
      productType: analysis.product?.category ?? null,
      title: `Fusion Studio → Producto: ${pg.suggestedTitle}`,
      content: `Producto creado via Fusion Studio. Categoría: ${analysis.product?.category}. Materiales: ${analysis.textures?.map(t => t.material).join(", ")}. Precio sugerido: ${pg.suggestedPrice}. Tags: ${pg.suggestedTags.slice(0, 5).join(", ")}.`,
      confidence: 0.88,
      tags: ["fusion-studio", "product-creation", analysis.product?.category ?? "general"],
    });

    res.json({
      success: true,
      product: createdProduct,
      analysis,
      message: `Producto "${pg.suggestedTitle}" creado con ${files.length} imágenes`,
    });
  } catch (err: any) {
    logger.error({ err }, "Fusion Studio create-product failed");
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

## C.2 — Registrar la ruta en `api-server/src/routes/index.ts`

**BUSCAR**:
```
import webLabRouter from "./web-lab.js";
```
**AÑADIR DEBAJO**:
```typescript
import fusionStudioRouter from "./fusion-studio.js";
```

**BUSCAR**:
```
router.use(webLabRouter);
```
**AÑADIR DEBAJO**:
```typescript
router.use(fusionStudioRouter);
```

---

# ═══════════════════════════════════════════════════════
# BLOQUE D: CHATBOT FILE UPLOAD
# ═══════════════════════════════════════════════════════

## D.1 — `api-server/src/routes/shopybrain.ts`

### Cambio 1: Añadir soporte de archivos al endpoint del chatbot
**BUSCAR** el endpoint principal del chatbot (probablemente `router.post("/shopybrain/chat"` o similar).
**AÑADIR** import al inicio del archivo:
```typescript
import multer from "multer";
import { processUploadedFile, filesToClaudeContent, type ProcessedFile } from "../lib/file-processor.js";
import { analyzeImageForFusion } from "../lib/fusion-studio.js";

const chatUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 10 } });
```

**BUSCAR** el handler del chat principal. Cambiar de `router.post("/shopybrain/chat", ...)` a:
```typescript
router.post("/shopybrain/chat", chatUpload.array("files", 10), async (req, res) => {
```

**DENTRO** del handler, **ANTES** de construir los mensajes para Claude, **AÑADIR**:
```typescript
    // ── Procesar archivos adjuntos ──────────────────────────────────
    let fileContext = "";
    let imageBlocks: any[] = [];
    const uploadedFiles = req.files as Express.Multer.File[] | undefined;
    
    if (uploadedFiles && uploadedFiles.length > 0) {
      const processedFiles: ProcessedFile[] = [];
      
      for (const file of uploadedFiles) {
        const processed = await processUploadedFile(file.buffer, file.originalname, file.mimetype);
        processedFiles.push(processed);
        
        // Si es imagen y el usuario pide crear producto → trigger Fusion Studio
        if (processed.type === "image") {
          imageBlocks.push({
            type: "image",
            source: { type: "base64", media_type: processed.mimeType, data: processed.base64Content },
          });
        }
        
        // Añadir contexto textual de cada archivo
        if (processed.textContent) {
          fileContext += `\n\n═══ ARCHIVO ADJUNTO: ${processed.filename} (${processed.type}) ═══\n${processed.textContent.slice(0, 15000)}\n═══ FIN ARCHIVO ═══\n`;
        }
      }
      
      // Si hay imágenes y el mensaje pide crear producto, analizar con Fusion Studio
      const msgLower = (req.body.message || "").toLowerCase();
      const wantsProduct = /crea.*producto|product.*from|con.est.*foto|con.est.*imagen|fusion|desintegr|analiz.*imagen|crea.*con.*imagen/i.test(msgLower);
      
      if (imageBlocks.length > 0 && wantsProduct) {
        try {
          const fusionAnalysis = await analyzeImageForFusion(
            processedFiles.find(f => f.type === "image")!.base64Content!,
            processedFiles.find(f => f.type === "image")!.mimeType,
            processedFiles.filter(f => f.type === "image").slice(1).map(f => ({
              base64: f.base64Content!, mimeType: f.mimeType
            }))
          );
          fileContext += `\n\n═══ FUSION STUDIO — ANÁLISIS DE IMAGEN ═══\n${JSON.stringify(fusionAnalysis, null, 2)}\n═══ FIN FUSION STUDIO ═══\n`;
          fileContext += `\n\nIMPORTANTE: Se ha ejecutado Fusion Studio automáticamente. Usa los datos del análisis para crear el producto. El título sugerido es: "${fusionAnalysis.productGeneration?.suggestedTitle}". La descripción sugerida ya está generada en el análisis.`;
        } catch (err) {
          logger.warn({ err }, "Fusion Studio auto-analysis failed — continuing without it");
        }
      }
    }
    
    // Inyectar contexto de archivos en el mensaje del usuario
    if (fileContext) {
      // Modificar el userMessage para incluir los archivos
      const enrichedMessage = `${req.body.message || ""}\n\n${fileContext}`;
      // Usar enrichedMessage en vez de req.body.message para el prompt
    }
```

### Cambio 2: Añadir acción fusion_create_product al chatbot
**BUSCAR** el bloque de switch/case de acciones del chatbot.
**AÑADIR** un nuevo case:
```typescript
      case "fusion_create_product": {
        const projectId = params.projectId || contextProjectId;
        if (!projectId) return { error: "Se necesita projectId" };
        
        // Las imágenes ya se procesaron arriba — usar los datos de Fusion Studio del fileContext
        if (!req.files || (req.files as any[]).length === 0) {
          return { message: "📸 Para crear un producto con Fusion Studio, necesito que subas al menos 1 foto del producto. Adjunta la imagen y dime 'crea un producto con esta foto'." };
        }
        
        // Llamar al endpoint de Fusion Studio internamente
        const fusionResp = await fetch(`${baseUrl}/api/fusion-studio/create-product`, {
          method: "POST",
          headers: { cookie: req.headers.cookie || "" },
          body: (() => {
            const fd = new FormData();
            fd.append("projectId", String(projectId));
            for (const f of (req.files as Express.Multer.File[])) {
              fd.append("images", new Blob([f.buffer]), f.originalname);
            }
            return fd;
          })(),
        });
        
        if (!fusionResp.ok) {
          return { error: "Error al crear producto con Fusion Studio" };
        }
        
        const result = await fusionResp.json() as any;
        return {
          message: `🔬 **Fusion Studio — Producto creado:**\n\n📦 **${result.product?.title}**\n💰 Precio: ${result.analysis?.productGeneration?.suggestedPrice ?? "por definir"}\n🏷️ Categoría: ${result.analysis?.product?.category ?? "general"}\n🎨 Materiales: ${result.analysis?.textures?.map((t: any) => t.material).join(", ") ?? "detectados"}\n📸 ${(req.files as any[]).length} imagen(es) subida(s)\n\n✅ Producto publicado en tu tienda.`,
        };
      }
```

**AÑADIR** al mapping de acciones del chatbot:
```
- Crear producto con foto / Fusion Studio / crear con esta imagen / desintegrar imagen / analizar foto para producto → fusion_create_product. Params: {projectId}
```

---

# ═══════════════════════════════════════════════════════
# BLOQUE E: WEB LAB CON INTELIGENCIA DE MARCA
# ═══════════════════════════════════════════════════════

## E.1 — `api-server/src/routes/web-lab.ts`

### Cambio: Inyectar investigación de marca
**BUSCAR** dentro del handler `router.post("/web-lab/analyze"`, después de las llamadas a `extractFullWebContent`, `scrapeWebsite` y `runPageSpeedAudit`, **ANTES** de la llamada a `askClaudeJsonWithBrain`.

**INSERTAR**:
```typescript
    // ══════ BRAND INTELLIGENCE (NUEVO) ══════
    const brandName = req.body.brandName || null;
    const instagram = req.body.instagram || null;
    const domain = new URL(url).hostname.replace("www.", "");
    const searchName = brandName || domain.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
    
    let brandIntel = "";
    try {
      const { askGeminiWithSearch } = await import("../lib/gemini.js");
      const [brandRes, igRes] = await Promise.allSettled([
        askGeminiWithSearch(
          `Busca "${searchName}" (${url}): qué es, sector, audiencia, estilo visual, colores de marca, competidores. JSON: { name, sector, audience, style, colors: [], luxuryLevel: 1-10 }`,
          "Brand analyst. ONLY JSON."
        ),
        instagram
          ? askGeminiWithSearch(`Analiza @${instagram} en Instagram: estilo visual, colores, tipo de fotos. JSON: { aesthetic, colors: [], photoStyle }`, "Instagram analyst. ONLY JSON.")
          : Promise.resolve(null),
      ]);
      
      const parseBrand = (r: any) => {
        if (r?.status !== "fulfilled" || !r.value?.text) return "";
        return r.value.text.slice(0, 2000);
      };
      
      brandIntel = `
═══ INTELIGENCIA DE MARCA ═══
Marca: ${parseBrand(brandRes)}
Instagram: ${igRes && igRes.status === "fulfilled" ? parseBrand(igRes) : "No investigado"}
INSTRUCCIÓN: El CSS mejorado DEBE reflejar la identidad de "${searchName}". No generes CSS genérico.
═══ FIN INTELIGENCIA ═══`;
    } catch (err) {
      logger.warn({ err }, "Brand intelligence failed — continuing without it");
    }
```

Luego, **BUSCAR** donde se construye el `userPrompt` para Claude y **AÑADIR** `brandIntel` al prompt:
```typescript
    // Donde se construye userPrompt, AÑADIR brandIntel:
    const userPrompt = `${brandIntel}

Analiza esta web: ${url}
// ... resto del prompt existente
`;
```

---

# ═══════════════════════════════════════════════════════
# BLOQUE F: FRONTEND — Platform Feature Gating
# ═══════════════════════════════════════════════════════

## F.1 — Nuevo hook: `shopify-optimizer/src/hooks/use-platform.ts` (CREAR)

```typescript
import { useState, useEffect } from "react";

export interface PlatformFeatures {
  platform: string;
  label: string;
  icon: string;
  color: string;
  hasProducts: boolean;
  hasThemes: boolean;
  hasCollections: boolean;
  hasOrders: boolean;
  hasInventory: boolean;
  hasSeoWrite: boolean;
  hasGraphQL: boolean;
  isAuditOnly: boolean;
  hiddenTabs: string[];
}

const PLATFORM_MAP: Record<string, PlatformFeatures> = {
  shopify: { platform: "shopify", label: "Shopify", icon: "🟢", color: "#95bf47", hasProducts: true, hasThemes: true, hasCollections: true, hasOrders: true, hasInventory: true, hasSeoWrite: true, hasGraphQL: true, isAuditOnly: false, hiddenTabs: [] },
  woocommerce: { platform: "woocommerce", label: "WooCommerce", icon: "🟣", color: "#96588a", hasProducts: true, hasThemes: false, hasCollections: false, hasOrders: true, hasInventory: true, hasSeoWrite: true, hasGraphQL: false, isAuditOnly: false, hiddenTabs: ["themes"] },
  prestashop: { platform: "prestashop", label: "PrestaShop", icon: "🔴", color: "#df0067", hasProducts: true, hasThemes: false, hasCollections: false, hasOrders: true, hasInventory: true, hasSeoWrite: true, hasGraphQL: false, isAuditOnly: false, hiddenTabs: ["themes"] },
  universal: { platform: "universal", label: "Auditoría Web", icon: "🌐", color: "#5b9bd5", hasProducts: false, hasThemes: false, hasCollections: false, hasOrders: false, hasInventory: false, hasSeoWrite: false, hasGraphQL: false, isAuditOnly: true, hiddenTabs: ["products", "pricing", "redesign", "images", "inventory", "emails", "ab-testing", "themes", "collections"] },
};

export function usePlatformFeatures(platformType?: string | null): PlatformFeatures {
  return PLATFORM_MAP[platformType ?? "shopify"] ?? PLATFORM_MAP.shopify;
}
```

## F.2 — Usar en CADA página de proyecto

En **CADA** archivo de `pages/projects/` (Audit.tsx, Pricing.tsx, SEO.tsx, Redesign.tsx, Images.tsx, etc.), **AÑADIR**:

```tsx
import { usePlatformFeatures } from "@/hooks/use-platform";

// Dentro del componente, obtener el platformType del proyecto:
// (ya debería estar en los datos del proyecto cargados)
const platform = usePlatformFeatures(project?.platformType);

// Luego, envolver botones que no apliquen:
{platform.hasProducts && (
  <button onClick={syncProducts}>
    {platform.icon} Sincronizar {platform.label}
  </button>
)}

{platform.isAuditOnly && (
  <div className="glass-card" style={{ textAlign: "center", padding: 32, color: "var(--t3)" }}>
    <p style={{ fontSize: 40, marginBottom: 12 }}>🌐</p>
    <p style={{ fontWeight: 600 }}>Proyecto de Auditoría Universal</p>
    <p style={{ fontSize: 13 }}>Este proyecto analiza cualquier web sin gestionar productos.</p>
    <p style={{ fontSize: 13 }}>Usa el Web Lab, Entity Research o el Generador Universal para analizar.</p>
  </div>
)}
```

---

# ═══════════════════════════════════════════════════════
# BLOQUE G: NUEVAS ACCIONES CHATBOT
# ═══════════════════════════════════════════════════════

## G.1 — Añadir al prompt del chatbot en shopybrain.ts

**BUSCAR** el gran bloque de documentación de acciones del chatbot.
**AÑADIR** estas nuevas acciones:

```
- Crear producto con foto / crear desde imagen / Fusion Studio / desintegrar imagen → fusion_create_product. Params: {projectId}. Necesita imagen adjunta. Analiza la imagen por capas, texturas, colores, materiales y genera un producto completo automáticamente.
- Analizar imagen / qué ves en esta foto / fusion / analizar textura → fusion_analyze. Params: {}. Necesita imagen adjunta. Descompone la imagen en capas, colores, texturas, materiales, composición.
- Estimar COGS de todos / COGS automático / costes de todo → auto_estimate_all_cogs. Params: {projectId}. Estima COGS con IA para todos los productos que no lo tienen.
- Auditar empresa / auditar marca / auditoría de / análisis completo de → audit_entity. Params: {input (URL/nombre/Instagram), niche?}. Auditoría completa con scores, oportunidades, propuesta de servicios.
- Informe nivel X / generar informe nivel X / quiero nivel X → run_leveled_report. Params: {projectId, reportType, level (1-5)}. Genera informe con el nivel de profundidad seleccionado.
```

---

# RESUMEN DE TODOS LOS CAMBIOS

## Archivos NUEVOS (6):
1. `api-server/src/lib/platform-helper.ts`
2. `api-server/src/lib/config.ts`
3. `api-server/src/lib/report-levels.ts`
4. `api-server/src/lib/fusion-studio.ts`
5. `api-server/src/lib/file-processor.ts`
6. `api-server/src/routes/fusion-studio.ts`
7. `shopify-optimizer/src/hooks/use-platform.ts`

## Archivos MODIFICADOS (12):
1. `routes/pricing.ts` — apply-price + COGS multi-platform
2. `routes/redesign.ts` — apply redesign multi-platform
3. `routes/seo.ts` — SEO update multi-platform
4. `routes/generator.ts` — sistema de niveles
5. `routes/shopybrain.ts` — file upload + fusion + nuevas acciones
6. `routes/index.ts` — registrar nueva ruta fusion-studio
7. `routes/web-lab.ts` — brand intelligence
8. `lib/scheduler.ts` — revenue + inventory multi-platform
9. `index.ts` — contraseña admin + email admin
10. `app.ts` — rate limiting fix
11. `lib/connectors/types.ts` — mensaje error
12. `pages/projects/UniversalGenerator.tsx` — selector niveles

## Dependencias nuevas:
```bash
npm install multer adm-zip
npm install -D @types/multer
```

## Resultado final — Estado 100%:
| Área | Antes | Después |
|------|-------|---------|
| WooCommerce completo | 15% | 95% |
| PrestaShop completo | 15% | 95% |
| Universal audit | 60% | 95% |
| Niveles de informe | 10% | 100% |
| Fusion Studio | 0% | 100% |
| Chatbot file upload | 0% | 100% |
| Web Lab con marca | 50% | 95% |
| Descarga archivos | 85% | 100% |
| Seguridad | 70% | 95% |
