# 🎨 DISEÑADOR DE PLANTILLAS — Template Studio
## Crear, personalizar y compartir plantillas de informes profesionales
## Para tu empresa, clientes, amigos — cualquier persona

---

# QUÉ ES Y PARA QUÉ SIRVE

Ahora mismo tu app tiene 3 plantillas hardcodeadas: `classic`, `elegance`, `prestige`. Si un cliente quiere un informe con SUS colores de marca, SU logo, y SU tipografía, no puede.

**Template Studio** permite:
- Crear plantillas de informe con branding personalizado
- Subir logo propio (empresa, cliente, marca)
- Elegir colores, tipografías, layout
- Preview en tiempo real mientras diseñas
- Guardar y reutilizar para cualquier tipo de informe
- Compartir plantillas por link (para amigos/clientes)
- La IA sugiere diseño basándose en URL/Instagram de la marca

---

# BACKEND — 4 cosas a hacer

## 1. Esquema DB — Nueva tabla `report_templates`

```sql
CREATE TABLE report_templates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  
  -- Branding
  logo_base64 TEXT,
  company_name VARCHAR(200),
  tagline VARCHAR(300),
  
  -- Colors
  primary_color VARCHAR(9) DEFAULT '#c8a84b',
  secondary_color VARCHAR(9) DEFAULT '#08080e',
  accent_color VARCHAR(9) DEFAULT '#44cc88',
  text_color VARCHAR(9) DEFAULT '#f0f0f5',
  bg_color VARCHAR(9) DEFAULT '#08080e',
  card_bg VARCHAR(9) DEFAULT '#12121a',
  border_color VARCHAR(9) DEFAULT '#1a1a22',
  
  -- Typography
  heading_font VARCHAR(100) DEFAULT 'Helvetica Neue',
  body_font VARCHAR(100) DEFAULT 'Helvetica Neue',
  heading_weight VARCHAR(10) DEFAULT '700',
  
  -- Layout
  cover_style VARCHAR(20) DEFAULT 'centered',  -- centered | left-aligned | minimal | full-bleed
  toc_style VARCHAR(20) DEFAULT 'numbered',     -- numbered | bullet | minimal | none
  section_style VARCHAR(20) DEFAULT 'card',     -- card | line | minimal | accent-bar
  metric_style VARCHAR(20) DEFAULT 'grid',      -- grid | inline | large | minimal
  
  -- Footer
  footer_text VARCHAR(300),
  footer_url VARCHAR(300),
  show_page_numbers BOOLEAN DEFAULT true,
  show_date BOOLEAN DEFAULT true,
  
  -- Sharing
  is_public BOOLEAN DEFAULT false,
  share_token VARCHAR(64),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 2. Nueva ruta — `api-server/src/routes/report-templates.ts`

```typescript
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { reportTemplatesTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { randomBytes } from "crypto";
import { logger } from "../lib/logger.js";
import { askClaudeWithBrain } from "../lib/claude.js";
import { askGeminiWithSearch } from "../lib/gemini.js";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET all templates for current user
router.get("/report-templates", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const templates = await db.select().from(reportTemplatesTable)
      .where(eq(reportTemplatesTable.userId, userId))
      .orderBy(desc(reportTemplatesTable.updatedAt));
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: "Error cargando plantillas" });
  }
});

// GET single template (by id or share token)
router.get("/report-templates/:idOrToken", async (req: Request, res: Response) => {
  try {
    const param = req.params.idOrToken;
    const id = parseInt(param);
    
    let template;
    if (!isNaN(id)) {
      [template] = await db.select().from(reportTemplatesTable)
        .where(eq(reportTemplatesTable.id, id));
    } else {
      [template] = await db.select().from(reportTemplatesTable)
        .where(eq(reportTemplatesTable.shareToken, param));
    }
    
    if (!template) { res.status(404).json({ error: "Plantilla no encontrada" }); return; }
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: "Error cargando plantilla" });
  }
});

// CREATE template
router.post("/report-templates", upload.single("logo"), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { name, companyName, tagline, primaryColor, secondaryColor, accentColor,
            textColor, bgColor, cardBg, borderColor, headingFont, bodyFont,
            headingWeight, coverStyle, tocStyle, sectionStyle, metricStyle,
            footerText, footerUrl, showPageNumbers, showDate, isPublic } = req.body;

    if (!name) { res.status(400).json({ error: "Nombre requerido" }); return; }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80) + "-" + Date.now().toString(36);
    const shareToken = randomBytes(32).toString("hex");
    
    let logoBase64 = req.body.logoBase64 || null;
    if (req.file) {
      logoBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    }

    const [template] = await db.insert(reportTemplatesTable).values({
      userId,
      name,
      slug,
      logoBase64,
      companyName: companyName || null,
      tagline: tagline || null,
      primaryColor: primaryColor || "#c8a84b",
      secondaryColor: secondaryColor || "#08080e",
      accentColor: accentColor || "#44cc88",
      textColor: textColor || "#f0f0f5",
      bgColor: bgColor || "#08080e",
      cardBg: cardBg || "#12121a",
      borderColor: borderColor || "#1a1a22",
      headingFont: headingFont || "Helvetica Neue",
      bodyFont: bodyFont || "Helvetica Neue",
      headingWeight: headingWeight || "700",
      coverStyle: coverStyle || "centered",
      tocStyle: tocStyle || "numbered",
      sectionStyle: sectionStyle || "card",
      metricStyle: metricStyle || "grid",
      footerText: footerText || null,
      footerUrl: footerUrl || null,
      showPageNumbers: showPageNumbers !== "false",
      showDate: showDate !== "false",
      isPublic: isPublic === "true",
      shareToken,
    }).returning();

    res.json({ success: true, template });
  } catch (err) {
    logger.error({ err }, "Error creating report template");
    res.status(500).json({ error: "Error creando plantilla" });
  }
});

// UPDATE template
router.put("/report-templates/:id", upload.single("logo"), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const updates: any = { ...req.body, updatedAt: new Date() };
    delete updates.id;
    delete updates.userId;
    delete updates.slug;
    delete updates.shareToken;
    
    if (req.file) {
      updates.logoBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    }
    
    if (updates.showPageNumbers !== undefined) updates.showPageNumbers = updates.showPageNumbers !== "false";
    if (updates.showDate !== undefined) updates.showDate = updates.showDate !== "false";
    if (updates.isPublic !== undefined) updates.isPublic = updates.isPublic === "true";

    const [template] = await db.update(reportTemplatesTable)
      .set(updates)
      .where(eq(reportTemplatesTable.id, id))
      .returning();

    res.json({ success: true, template });
  } catch (err) {
    res.status(500).json({ error: "Error actualizando plantilla" });
  }
});

// DELETE template
router.delete("/report-templates/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(reportTemplatesTable).where(eq(reportTemplatesTable.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error eliminando plantilla" });
  }
});

// AI SUGGEST — generate template design from brand URL/Instagram
router.post("/report-templates/ai-suggest", async (req: Request, res: Response) => {
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const { url, instagram, companyName, niche } = req.body;
    
    const brandSearch = await askGeminiWithSearch(
      `Research "${companyName || url}" ${url ? `(${url})` : ""} ${instagram ? `Instagram: @${instagram}` : ""}. 
       Find exact brand colors (hex), fonts used, visual style, and suggest a professional report template design.
       Return JSON: {
         "primaryColor": "#hex", "secondaryColor": "#hex", "accentColor": "#hex",
         "textColor": "#hex", "bgColor": "#hex",
         "headingFont": "font name", "bodyFont": "font name",
         "coverStyle": "centered|left-aligned|minimal|full-bleed",
         "sectionStyle": "card|line|minimal|accent-bar",
         "designNotes": "why these choices work for this brand"
       }`,
      "Brand design analyst specializing in report templates. Return ONLY JSON."
    );

    let suggestion = {};
    try {
      const match = brandSearch.text.match(/\{[\s\S]*\}/);
      suggestion = match ? JSON.parse(match[0]) : {};
    } catch {}

    res.json({ success: true, suggestion });
  } catch (err) {
    res.status(500).json({ error: "Error generando sugerencia" });
  }
});

export default router;
```

## 3. Registrar en `routes/index.ts`

```typescript
import reportTemplatesRouter from "./report-templates.js";
// ... en la zona protegida (después de requireAdmin):
router.use(reportTemplatesRouter);
```

## 4. Modificar `getReportShell` para usar templates custom

```typescript
// En exports.ts, modificar getReportShell para aceptar templates custom:
export function getReportShell(template: ReportTemplate | any = "prestige") {
  // Si es un objeto (template custom de la DB), generar shell dinámico
  if (typeof template === "object" && template.primaryColor) {
    return buildCustomReportShell(template);
  }
  // Templates built-in
  if (template === "elegance") return reportShellElegance;
  if (template === "prestige") return reportShellPrestige;
  return (t, s, b, d, c) => reportShell(t, s, b, d, c);
}

function buildCustomReportShell(tpl: any) {
  return (title: string, subtitle: string, body: string, date: string, targetCompany?: string) => `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(tpl.headingFont || "Helvetica Neue")}:wght@400;600;700&family=${encodeURIComponent(tpl.bodyFont || "Helvetica Neue")}:wght@300;400;500;600&display=swap');
  
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: '${tpl.bodyFont || "Helvetica Neue"}', sans-serif; background: ${tpl.bgColor || "#08080e"}; color: ${tpl.textColor || "#f0f0f5"}; }
  
  .cover { background: ${tpl.secondaryColor || "#08080e"}; padding: 80px 48px; text-align: ${tpl.coverStyle === "left-aligned" ? "left" : "center"}; page-break-after: always; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; }
  .cover-logo { max-width: 120px; max-height: 120px; border-radius: 16px; margin-bottom: 24px; ${tpl.coverStyle === "centered" ? "margin-left:auto;margin-right:auto;" : ""} }
  .cover-title { font-family: '${tpl.headingFont || "Helvetica Neue"}', serif; font-size: 32px; font-weight: ${tpl.headingWeight || "700"}; color: ${tpl.primaryColor || "#c8a84b"}; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 8px; }
  .cover-subtitle { font-size: 16px; color: ${tpl.textColor || "#f0f0f5"}80; margin-bottom: 24px; }
  .cover-company { font-size: 14px; color: ${tpl.primaryColor || "#c8a84b"}60; letter-spacing: 2px; text-transform: uppercase; }
  .cover-date { font-size: 12px; color: ${tpl.textColor || "#f0f0f5"}40; margin-top: 16px; }
  
  .report-body { padding: 48px; max-width: 900px; margin: 0 auto; }
  
  .section { margin-bottom: 32px; }
  .section-title { font-family: '${tpl.headingFont || "Helvetica Neue"}', serif; font-size: 20px; font-weight: ${tpl.headingWeight || "700"}; color: ${tpl.primaryColor || "#c8a84b"}; margin-bottom: 16px; ${tpl.sectionStyle === "accent-bar" ? `border-left: 4px solid ${tpl.primaryColor || "#c8a84b"}; padding-left: 16px;` : ""} }
  
  .card { background: ${tpl.cardBg || "#12121a"}; border: 1px solid ${tpl.borderColor || "#1a1a22"}; border-radius: 12px; padding: 20px; margin-bottom: 12px; }
  
  .metric-row { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
  .metric { flex: 1; min-width: 120px; text-align: center; background: ${tpl.cardBg || "#12121a"}; border: 1px solid ${tpl.borderColor || "#1a1a22"}; border-radius: 12px; padding: 20px; }
  .metric .value { font-size: 32px; font-weight: 800; color: ${tpl.primaryColor || "#c8a84b"}; }
  .metric .label { font-size: 12px; color: ${tpl.textColor || "#f0f0f5"}60; margin-top: 4px; }
  
  .recommendation { background: ${tpl.cardBg || "#12121a"}; border-left: 4px solid ${tpl.accentColor || "#44cc88"}; padding: 16px; margin-bottom: 8px; border-radius: 0 8px 8px 0; font-size: 14px; line-height: 1.6; }
  
  .grade { display: inline-block; padding: 4px 12px; border-radius: 6px; font-weight: 700; font-size: 14px; }
  .grade-a { background: ${tpl.accentColor || "#44cc88"}20; color: ${tpl.accentColor || "#44cc88"}; }
  .grade-b { background: ${tpl.primaryColor || "#c8a84b"}20; color: ${tpl.primaryColor || "#c8a84b"}; }
  .grade-c { background: #ffa50020; color: #ffa500; }
  .grade-d { background: #ff555520; color: #ff5555; }
  .grade-f { background: #ff333320; color: #ff3333; }
  
  .score-bar { height: 8px; background: ${tpl.borderColor || "#1a1a22"}; border-radius: 4px; overflow: hidden; }
  .score-fill { height: 100%; border-radius: 4px; transition: width 0.5s; }
  
  .footer { text-align: center; padding: 32px; border-top: 1px solid ${tpl.borderColor || "#1a1a22"}; margin-top: 48px; }
  .footer-text { font-size: 12px; color: ${tpl.textColor || "#f0f0f5"}40; }
  
  @media print {
    body { background: white; color: #222; }
    .card { border: 1px solid #ddd; }
    .cover { background: white; }
  }
</style>
</head>
<body>
  <div class="cover">
    ${tpl.logoBase64 ? `<img class="cover-logo" src="${tpl.logoBase64}" alt="Logo" />` : ""}
    <div class="cover-title">${title}</div>
    <div class="cover-subtitle">${subtitle}</div>
    ${targetCompany ? `<div class="cover-company">${targetCompany}</div>` : ""}
    ${tpl.tagline ? `<div style="font-size:13px;color:${tpl.textColor}50;margin-top:8px;">${tpl.tagline}</div>` : ""}
    <div class="cover-date">${date}</div>
  </div>
  <div class="report-body">
    ${body}
  </div>
  <div class="footer">
    <div class="footer-text">${tpl.footerText || tpl.companyName || "Informe generado con IA"}</div>
    ${tpl.footerUrl ? `<div class="footer-text" style="margin-top:4px;">${tpl.footerUrl}</div>` : ""}
  </div>
</body>
</html>`;
}
```

---

# FRONTEND — Página Template Studio

## Ruta: `/admin/template-studio`

**Añadir en `App.tsx`:**
```tsx
<Route path="/admin/template-studio">
  {() => <AppLayout><TemplateStudio /></AppLayout>}
</Route>
```

**Añadir en `DEFAULT_SHOPYBRAIN_NAV` del `AppLayout.tsx`:**
```typescript
{ label: "Template Studio", icon: "🎨", href: "/admin/template-studio" },
```

## Componente: `pages/admin/TemplateStudio.tsx`

La interfaz tiene 2 columnas:
- **Izquierda:** Editor de configuración (logo, colores, fuentes, layout, textos)
- **Derecha:** Preview en tiempo real del informe

### Funcionalidades:
1. **Upload de logo** — drag & drop o click, convierte a base64
2. **Color pickers** — primary, secondary, accent, text, bg, cards, borders (7 colores)
3. **Selector de fuentes** — Google Fonts populares con preview
4. **Layout options** — Cover style, TOC style, Section style, Metric style
5. **AI Suggest** — Introduce URL/Instagram/nombre y la IA sugiere todo el diseño
6. **Preview en vivo** — Un informe de ejemplo se renderiza con los cambios en tiempo real
7. **Guardar** — Guarda la plantilla en la DB
8. **Compartir** — Genera link público para que otros usen la plantilla
9. **Mis plantillas** — Lista de plantillas guardadas, editar/duplicar/eliminar

### Flujo de uso:
```
1. Nuevo Template → Nombre + (opcional: URL/Instagram para AI suggest)
2. La IA busca la marca y pre-rellena colores/fuentes
3. El usuario ajusta lo que quiera en el editor
4. Preview en tiempo real muestra cómo quedaría un informe SEO
5. Guardar → La plantilla aparece como opción en TODOS los exports
6. Al exportar cualquier informe → Puede elegir "classic", "elegance", "prestige" O su template custom
```

---

# CONEXIÓN CON EL SISTEMA EXISTENTE

## Dónde aparecen las plantillas custom como opción:

| Lugar | Archivo | Cómo conectar |
|-------|---------|---------------|
| Export Center | `ExportCenter.tsx` | Añadir selector de template con las del usuario |
| Web Lab reports | `web-lab.ts` | Pasar template ID al `getReportShell()` |
| Report Levels | `report-levels.ts` | Ya acepta `template` param — pasar custom |
| SEO Audit export | `exports.ts` | Añadir query param `?templateId=X` |
| Pricing report | `exports.ts` | Mismo patrón |
| Full audit | `exports.ts` | Mismo patrón |
| Client portal reports | `client.ts` | Renderizar con template del proyecto |

**Cambio necesario en cada endpoint de export:**
```typescript
// Al inicio de cada endpoint de export, añadir:
let reportShell = getReportShell("prestige"); // default
if (req.query.templateId) {
  const [customTpl] = await db.select().from(reportTemplatesTable)
    .where(eq(reportTemplatesTable.id, parseInt(req.query.templateId as string)));
  if (customTpl) reportShell = getReportShell(customTpl);
}
```

---

# EJEMPLO DE USO REAL

**Caso: Tu amigo tiene una tienda de vinos y te pide un informe**

1. Abres Template Studio
2. Escribes la URL de su tienda + @instagram
3. La IA investiga: colores burgundy + dorado, tipografía serif elegante, estilo premium
4. Pre-rellena todo el template con esos valores
5. Subes el logo de su tienda
6. Ajustas el footer: "Informe elaborado por [Tu nombre] para [Su tienda]"
7. Guardas como "Vinos Premium Template"
8. Vas a Export Center → Seleccionas "Vinos Premium Template"
9. Generas informe SEO/Pricing/Audit → Sale con SU branding
10. Le compartes el link del template para que él también pueda usarlo

---

# RESUMEN TÉCNICO

| Componente | Archivo | Acción |
|-----------|---------|--------|
| DB schema | `schema/report_templates.ts` | CREAR — nueva tabla |
| Backend routes | `routes/report-templates.ts` | CREAR — CRUD + AI suggest |
| Backend exports | `routes/exports.ts` | MODIFICAR — aceptar templateId |
| Backend report shell | `routes/exports.ts` | MODIFICAR — `buildCustomReportShell()` |
| Route index | `routes/index.ts` | MODIFICAR — registrar nuevo router |
| Frontend page | `pages/admin/TemplateStudio.tsx` | CREAR — editor + preview |
| Frontend App.tsx | `App.tsx` | MODIFICAR — añadir ruta |
| Frontend Layout | `AppLayout.tsx` | MODIFICAR — añadir tab en nav |
| Frontend ExportCenter | `ExportCenter.tsx` | MODIFICAR — selector de template |

**Tiempo estimado: 4-6 horas**
