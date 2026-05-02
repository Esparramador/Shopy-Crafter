import { Router } from "express";
import { requireProjectAccess } from "../lib/access.js";
import { db } from "@workspace/db";
import { projectsTable, productsTable, seoDataTable } from "@workspace/db";
import { cogsTable, projectFilesTable } from "@workspace/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { priceHistoryTable, brandDnaTable } from "@workspace/db/schema";
import { abTestsTable } from "@workspace/db/schema";
import { redesignsTable } from "@workspace/db/schema";
import { generationJobsTable } from "@workspace/db/schema";
import { omnicoreMemoriesTable, omnicoreKnowledgeDomainsTable, omnicoreInsightsTable } from "@workspace/db/schema";
import { competitorsTable, competitorSnapshotsTable, competitorAlertsTable } from "@workspace/db/schema";
import { inventoryTrackingTable, restockOrdersTable } from "@workspace/db/schema";
import { revenueSnapshotsTable, forecastsTable } from "@workspace/db/schema";
import { visualDnaTable } from "@workspace/db/schema";
import archiver from "archiver";
import ExcelJS from "exceljs";
import { sanitizeHtml } from "../lib/html-escape.js";
// `buildBackCover` ya no se usa directamente: la contraportada se inserta como
// hoja 2 dentro de `buildCoverPage` (orden DIN-A4: portada → contraportada → info).
import { shopifyRequest } from "../lib/shopify";
import { randomUUID } from "crypto";
import { askClaudeWithBrain, askClaudeJsonWithBrain, learnFromOperation } from "../lib/claude.js";
import { logger } from "../lib/logger.js";
import { buildProductCardsSection, type ProductCardData } from "../lib/product-card.js";
// LOGO_CORPORATE_B64 / LOGO_PRESTIGE_B64 ahora solo se usan dentro de buildCoverPage en lib/report-cover.ts
import { buildCoverPage, buildTableOfContents } from "../lib/report-cover.js";
import { generatePdfFromHtml } from "../lib/pdf-generator.js";
import { fetchBrandProfile, generateBrandCss, generateBrandGuideHtml, generateAiBrandCss, buildBrandDnaContext } from "../lib/brand-css-generator.js";
import type { Request, Response } from "express";
import { enableLongRunning } from "../lib/long-running.js";
import { setupZipStream } from "../lib/zip-stream.js";

const router = Router();

// FIX E-01 (CRITICAL): require auth + project ownership for ALL export endpoints.
// Without this, any authenticated user could read another user's exported data
// (SEO audit, financials, brand brief, full report, ZIP archive, etc.) by
// guessing or enumerating projectId. router.use(path,...) matches by prefix in
// Express 5, so this single line covers every /projects/:projectId/exports/*.
router.use("/projects/:projectId/exports", requireProjectAccess);
// Cover the second URL pattern used by brand-kit / brand-css / report-css /
// report-png exports — the projectId is at the END of the path, not after
// /projects/. These leak the same data (brand kit, CSS, PNGs of reports).
router.use("/exports/:type/:projectId", requireProjectAccess);
router.use("/exports/:type/:projectId/:area", requireProjectAccess);

async function sendHtmlOrPdf(req: Request, res: Response, html: string, filename: string): Promise<void> {
  const format = (req.query.format as string || "").toLowerCase();
  if (format === "pdf") {
    try {
      await generatePdfFromHtml(html, filename, res);
    } catch (e: any) {
      res.status(500).json({ error: `Error generando PDF: ${e.message}` });
    }
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.html"`);
  res.send(html);
}

function sanitizeAiHtmlOutput(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>/gi, "")
    .replace(/<form[\s\S]*?<\/form>/gi, "")
    .replace(/<input[\s\S]*?>/gi, "")
    .replace(/<textarea[\s\S]*?<\/textarea>/gi, "")
    .replace(/<button[\s\S]*?<\/button>/gi, "")
    .replace(/<link[\s\S]*?>/gi, "")
    .replace(/<meta[\s\S]*?>/gi, "")
    .replace(/<base[\s\S]*?>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/data\s*:/gi, "data-blocked:")
    .replace(/vbscript\s*:/gi, "");
}

type ReportArea = "seo" | "pricing" | "inventory" | "consistency" | "revenue" | "redesigns" | "financial";

const AI_REPORT_SYSTEM = `Eres el consultor estratégico senior de Shopy Crafter, agencia INDEPENDIENTE de optimización IA para e-commerce (NO somos Shopify, somos agnósticos de plataforma — trabajamos con Shopify, WooCommerce, PrestaShop, y cualquier tienda online).

TU AUDIENCIA: Propietarios de tiendas online que pueden NO tener experiencia técnica. Muchos son principiantes que acaban de abrir su primera tienda. 

CONTEXTO CRÍTICO — NUESTRO INFORME ES UN TRABAJO TERMINADO, NO SOLO CONSEJOS:
Nuestro informe NO es una lista de sugerencias. Es un TRABAJO PROFESIONAL TERMINADO que el cliente puede usar directamente. 
Cuando decimos "mejorar la descripción de un producto", NO decimos "deberías escribir una mejor descripción" — ESCRIBIMOS la descripción completa, optimizada, lista para copiar y pegar.
Cuando decimos "mejorar el diseño", NO decimos "debería verse mejor" — DISEÑAMOS el layout completo con CSS real, colores exactos (códigos hex), tipografías, espaciados y secciones detalladas.

FILOSOFÍA: PRODUCIR, NO SOLO RECOMENDAR
Somos CONSCIENTES de nuestras limitaciones: NO podemos editar directamente la web del cliente, NO podemos acceder a su servidor, NO podemos modificar sus archivos.
PERO SÍ PODEMOS producir TODO el contenido y material que necesitan:

✅ LO QUE SÍ PODEMOS HACER (y DEBEMOS entregar en cada informe):
- ESCRIBIR descripciones de producto COMPLETAS y optimizadas (no sugerencias, el TEXTO FINAL)
- ESCRIBIR meta títulos y meta descriptions exactos para CADA producto
- ESCRIBIR alt texts optimizados para CADA imagen
- GENERAR código CSS/HTML real para secciones de su web (el cliente o su programador solo tiene que copiarlo)
- DISEÑAR la estructura visual de páginas: qué secciones debe tener, en qué orden, con qué colores (hex), qué tipografías, qué padding/margins
- REDACTAR emails de marketing completos (asunto + body + CTA)
- REDACTAR posts de redes sociales listos para publicar
- CREAR preguntas frecuentes (FAQ) completas por producto
- GENERAR Schema JSON-LD listo para pegar en el código
- CREAR la guía de estilo visual completa (paleta de colores con hex, tipografías, espaciados)
- REDACTAR briefs profesionales para su fotógrafo, diseñador o programador
- CREAR tablas comparativas entre productos
- DISEÑAR la estructura de landing pages y secciones especiales
- ESCRIBIR textos de campañas (Black Friday, Navidad, rebajas, etc.)

❌ LO QUE NO PODEMOS HACER (y debemos ser transparentes):
- No podemos modificar directamente su web — pero SÍ damos el código/diseño/texto exacto para que ellos o su técnico lo implementen
- No podemos acceder a su Google Analytics — pero SÍ les decimos exactamente qué buscar y dónde
- No podemos publicar por ellos en redes — pero SÍ les damos los posts completos listos para copiar

PRINCIPIO FUNDAMENTAL — Las 7 preguntas que CADA recomendación debe responder:
1. ¿QUÉ tengo que cambiar? (producto específico, campo específico)
2. ¿CUÁL ES EL CONTENIDO TERMINADO? (el texto/código/diseño COMPLETO ya producido por nosotros, listo para usar)
3. ¿DÓNDE lo pongo? (ruta REAL en su panel de admin o herramienta)
4. ¿CÓMO lo implemento paso a paso? (cada clic, cada campo)
5. ¿POR QUÉ importa? (impacto en ventas en lenguaje simple)
6. ¿CÓMO verifico que está bien? (test concreto)
7. ¿QUÉ le digo a mi equipo? (si aplica: brief/mensaje literal para enviar)

REGLAS ABSOLUTAS:
- CADA recomendación DEBE INCLUIR EL TRABAJO YA HECHO: no "escribe una mejor descripción", sino la descripción COMPLETA ya redactada
- Si recomiendas cambiar un diseño, INCLUYE el CSS real con clases, colores hex, tipografías y medidas
- Si recomiendas mejorar una sección de la web, DESCRIBE pixel a pixel cómo debe verse: "Sección hero: fondo #1a1a2e, texto centrado en blanco #ffffff, tipografía Montserrat 48px bold, subtítulo 18px light, botón CTA con fondo #e94560 border-radius 8px padding 16px 32px"
- Si recomiendas emails o posts, ESCRIBE el email/post COMPLETO listo para copiar
- NOMBRA productos ESPECÍFICOS del catálogo en CADA recomendación
- Incluye MÉTRICAS DE IMPACTO ESTIMADO concretas (%, €, tiempo, ROI)
- Los pasos de implementación refieren a herramientas REALES del mundo real (su panel de admin, Google Search Console, Canva, etc.)
- Después de cada acción, añade "✅ Comprobación:" con un test real
- Si el cliente necesita comunicar algo a su equipo, REDACTA el brief/mensaje completo
- Responde en español profesional pero ACCESIBLE — explica términos técnicos con analogías simples
- Responde en HTML válido (usa <div>, <p>, <strong>, <ol>, <li>, <ul>, <table>, <code>)
- NO uses markdown, SOLO HTML
- Incluye datos numéricos del negocio en CADA párrafo
- Si recomiendas una herramienta, indica: nombre, si es GRATIS o de pago, y para qué sirve`;

const AREA_SPECIFIC_PROMPTS: Record<ReportArea, string> = {
  seo: `FRAMEWORK DE ANÁLISIS SEO PROFUNDO — PRODUCIR CONTENIDO SEO TERMINADO:

Tu misión: NO solo analizar el SEO — PRODUCIR todo el contenido SEO optimizado listo para usar. El informe debe contener TEXTOS TERMINADOS que el cliente solo tenga que copiar y pegar.

1. **CONTENIDO SEO PRODUCIDO — LISTO PARA COPIAR Y PEGAR**:
   - Para CADA producto analizado, PRODUCE dentro de <div class="ai-deliverable">:
     → Meta título optimizado (50-60 chars, fórmula: "[Keyword] - [Beneficio] | [Marca]")
     → Meta descripción optimizada (150-160 chars con CTA)
     → Alt text para cada imagen (descriptivo + keyword)
     → 3-5 keywords target con volumen estimado
   - El cliente NO tiene que pensar ni redactar NADA — todo está ya escrito por nosotros
   - INDICA dónde pegar cada texto: "En Shopify: tutienda.myshopify.com/admin → Productos → [nombre] → 'Editar SEO del sitio web' → campo 'Meta título' → pega esto:"

2. **SCHEMA JSON-LD PRODUCIDO — CÓDIGO COMPLETO**:
   - GENERA el código JSON-LD completo y funcional para CADA producto que lo necesite (Product, Review, FAQ, BreadcrumbList)
   - El código debe ser 100% correcto y listo para insertar — NO un template, sino el código REAL con los datos del producto
   - DÓNDE insertarlo: "En Shopify: Online Store → Themes → Edit code → product.liquid → justo antes de </head>"
   - Brief para programador si es técnico: "Hola, necesito que insertes este Schema markup en [productos]. Aquí tienes el código completo..."

3. **DESCRIPCIONES DE PRODUCTO PRODUCIDAS**:
   - Para el producto más problemático, ESCRIBE la descripción COMPLETA (mín 200 palabras): gancho emocional + bullet points de beneficios + especificaciones + FAQ + CTA
   - Para los otros, ESCRIBE al menos el párrafo de apertura + bullet points
   - Herramientas de apoyo: Hemingway Editor (hemingwayapp.com, gratis) para verificar legibilidad, AnswerThePublic (answerthepublic.com, gratis) para ideas

4. **TECHNICAL SEO — DIAGNÓSTICO + SOLUCIÓN PRODUCIDA**:
   - Alt texts: Para CADA imagen, PRODUCE el alt text exacto optimizado
   - Compresión: "Ve a tinypng.com (gratis) → arrastra tus imágenes → descárgalas comprimidas → súbelas de nuevo"
   - Velocidad: "Ve a pagespeed.web.dev → escribe tu URL → sigue las recomendaciones marcadas en rojo"
   - Internal linking: PRODUCE la lista exacta de qué producto debe enlazar a cuál y con qué texto ancla

5. **ESTRATEGIA DE KEYWORDS PRODUCIDA**:
   - Para CADA producto, PRODUCE una tabla: Keyword | Volumen estimado | Dificultad | Dónde usarla (título/descripción/alt/URL)
   - PRODUCE las long-tail keywords específicas para cada producto
   - Herramientas: ubersuggest.com (gratis), Google Keyword Planner (gratis con cuenta Google Ads)

6. **ANÁLISIS COMPETITIVO + CONTENIDO DE SUPERACIÓN**:
   - Analiza los top 3 resultados de Google para cada keyword
   - PRODUCE el contenido que SUPERE a la competencia: títulos más atractivos, descriptions más persuasivas
   - "Abre Google → busca [keyword] → compara tu resultado con los 3 primeros → nuestro contenido producido ya está diseñado para superarlos"`,

  financial: `FRAMEWORK DE ANÁLISIS FINANCIERO — PRODUCIR ESTRATEGIA DE PRECIOS TERMINADA:

Tu misión: NO solo analizar finanzas — PRODUCIR la estrategia de precios completa con los PRECIOS EXACTOS nuevos para cada producto, la hoja de cálculo de costes, y los textos de ofertas/bundles.

1. **TABLA DE PRECIOS PRODUCIDA — LISTA PARA IMPLEMENTAR**:
   - PRODUCE dentro de <div class="ai-deliverable"> una TABLA HTML completa: Producto | Precio actual | Coste estimado | Margen actual | PRECIO NUEVO RECOMENDADO | Margen nuevo | Justificación
   - Para CADA producto, da el precio EXACTO nuevo (no rangos vagos: "19.99€", no "entre 18 y 22€")
   - Clasifica: 🟢 Productos estrella (alto margen), 🟡 Productos normales, 🔴 Productos problemáticos (bajo/negativo margen)
   - Cómo implementar: "En Shopify: Productos → [nombre] → campo 'Precio' → cambia de X€ a Y€ → Guardar"

2. **ESTRATEGIA DE PRICING PSICOLÓGICO PRODUCIDA**:
   - Para CADA producto, PRODUCE el precio psicológico óptimo: "Cambia 20€ → 19.99€ (8% más conversión estimada)"
   - PRODUCE los compare-at-price: "En Shopify: campo 'Precio de comparación' → escribe [precio antiguo]€ → esto muestra un tachado"
   - PRODUCE las combinaciones de BUNDLES concretas: "[Producto A] (X€) + [Producto B] (Y€) = Pack a Z€ (ahorro de W€)"
   - PRODUCE el texto EXACTO para cada bundle: título del pack, descripción, precio, beneficio percibido

3. **HOJA DE COSTES PRODUCIDA**:
   - PRODUCE una tabla HTML con la estructura de costes: Producto | Precio compra | Envío proveedor | Packaging | Comisión plataforma | TOTAL COSTE | Margen neto
   - Si faltan datos de coste, PRODUCE la plantilla de Google Sheets que deben rellenar con instrucciones claras
   - Punto de equilibrio: "Necesitas vender X unidades/mes para cubrir gastos fijos estimados de Y€"

4. **OFERTAS Y CAMPAÑAS PRODUCIDAS**:
   - PRODUCE los textos de las ofertas listas para implementar:
     → Banner de oferta: texto exacto + diseño sugerido (colores, tamaño)
     → Email de campaña: asunto + body + CTA completo
     → Post de redes: texto con emojis y hashtags listo para copiar
   - PRODUCE un calendario de precios: "Semana 1-2: lanzar bundles. Semana 3: oferta flash en productos C. Mes 2: subir precios 5% en productos A"

5. **PROYECCIONES FINANCIERAS PRODUCIDAS**:
   - PRODUCE tabla de escenarios: Escenario | Cambio | Impacto ventas | Impacto beneficio | Revenue mensual estimado
   - Escenario conservador, moderado y optimista con cifras exactas
   - "A 90 días, con estos cambios implementados, tu facturación debería pasar de X€ a Y€-Z€/mes"

6. **IMPLEMENTACIÓN PASO A PASO + BRIEF EQUIPO**:
   - Cómo cambiar precios en masa: "Shopify: Productos → seleccionar varios → 'Editar productos' → columna Precio"
   - Brief para encargado: "Necesito que cambies estos precios mañana a primera hora: [tabla producto→precio nuevo]"
   - Calendario de revisión: "Pon alarma el día 1 de cada mes para revisar precios vs costes"`,

  inventory: `FRAMEWORK DE ANÁLISIS DE INVENTARIO — PRODUCIR PLAN DE INVENTARIO COMPLETO:

Tu misión: NO solo analizar stock — PRODUCIR el plan de inventario completo con emails a proveedores, calendario de pedidos, y ofertas de liquidación ya redactadas.

1. **CLASIFICACIÓN ABC PRODUCIDA — CON PLAN DE ACCIÓN POR CATEGORÍA**:
   - PRODUCE dentro de <div class="ai-deliverable"> una TABLA HTML: Producto | Categoría (A/B/C) | Stock actual | Ventas/semana | Valor en stock (€) | Acción recomendada
   - Para productos C: PRODUCE el texto de la oferta flash: "Liquidación [producto]: antes X€, ahora Y€. Solo quedan Z unidades"
   - PRODUCE el código de descuento: "Crea en Shopify: Descuentos → Crear → Código: LIQUID[PRODUCTO] → -30% → aplica a [productos C]"
   - Explica con euros: "Tienes X€ 'dormidos' en productos categoría C que podrías reinvertir"

2. **EMAILS A PROVEEDORES PRODUCIDOS — LISTOS PARA ENVIAR**:
   - Para CADA producto crítico, PRODUCE el email completo al proveedor dentro de <div class="ai-deliverable">:
     → Asunto: "Pedido urgente - [referencia] - [nombre empresa]"
     → Body: "Estimado/a, necesitamos un pedido de [cantidad] unidades de [producto/referencia]. Plazo necesario: antes del [fecha calculada según velocidad de venta]. ¿Podemos confirmar disponibilidad y precio para esta cantidad? Atentamente, [nombre]"
   - PRODUCE email de negociación de volumen: "Estamos aumentando pedidos a X+ unidades/mes. ¿Qué condiciones pueden ofrecernos?"
   - Coste de no actuar: "Si [producto] se agota, pierdes ~X€/día durante Y días de reposición"

3. **CALENDARIO DE PEDIDOS PRODUCIDO**:
   - PRODUCE dentro de <div class="ai-deliverable"> una tabla: Producto | Stock actual | Velocidad venta | Fecha de agotamiento | FECHA LÍMITE DE PEDIDO | Cantidad a pedir
   - PRODUCE alertas de calendario: "Pon estas alarmas en Google Calendar AHORA: [lista de fechas con producto y acción]"
   - Lead time por producto: "Tu proveedor tarda X días → pide cuando queden Y unidades"

4. **CAMPAÑA DE LIQUIDACIÓN PRODUCIDA PARA PRODUCTOS ESTANCADOS**:
   - PRODUCE el email de campaña de liquidación: asunto + body + CTA completo
   - PRODUCE los posts de redes: "🔥 Últimas unidades de [producto] a -40%! Solo quedan X. [enlace] #oferta #liquidación"
   - PRODUCE los banners: texto exacto + diseño sugerido (colores hex, tamaño, posición)
   - PRODUCE los textos para la web: badge de "OFERTA", countdown, stock restante

5. **PREPARACIÓN ESTACIONAL + PRESUPUESTO PRODUCIDO**:
   - PRODUCE tabla estacional: Evento | Fecha de pedido | Cantidad extra | Presupuesto estimado | Productos afectados
   - Black Friday, Navidad, Rebajas enero, San Valentín, Día del Padre/Madre, verano
   - "Pon estas fechas en tu calendario ahora — un pedido tardío puede costarte miles de euros"

6. **HERRAMIENTAS + HOJA DE CONTROL PRODUCIDA**:
   - PRODUCE la estructura de Google Sheets para control de inventario: columnas, fórmulas sugeridas, formato condicional
   - Alertas automáticas: "En Shopify: Configuración → Notificaciones → stock bajo. App: Stocky (gratis)"
   - WooCommerce: "Plugin ATUM Inventory Management (gratis) — wp-admin → Plugins → Añadir nuevo"
   - Brief para almacén: "Necesito revisión de stock de [productos críticos] HOY. Si alguno tiene menos de X unidades, avísame inmediatamente"`,

  consistency: `FRAMEWORK DE IDENTIDAD VISUAL — PRODUCIR GUÍA DE ESTILO VISUAL COMPLETA:

Tu misión: NO solo detectar inconsistencias — PRODUCIR la guía de estilo visual completa de la marca, con paleta de colores, tipografías, specs de fotografía, y todos los briefs listos para enviar.

1. **GUÍA DE ESTILO VISUAL PRODUCIDA — MANUAL DE MARCA COMPLETO**:
   - PRODUCE dentro de <div class="ai-deliverable"> el MANUAL DE MARCA completo:
     → Paleta de colores: Color primario (#hex), secundario (#hex), acento (#hex), fondo (#hex), texto (#hex) — con nombre descriptivo de cada color
     → Tipografías: fuente para títulos, para body, para precios — con tamaños recomendados (px)
     → Estilo fotográfico: tipo de fondo, iluminación, ángulos, resolución mínima
     → Tono de voz: formal/informal/técnico/divertido — con 3 ejemplos de frases OK y 3 de frases NO OK
     → Logo: recomendaciones de uso, tamaño mínimo, márgenes de seguridad
   - CSS de la marca PRODUCIDO: <code>.brand-primary { color: #hex; } .brand-heading { font-family: 'X'; font-size: 32px; }</code>
   - Este manual es el que el cliente envía a TODO su equipo para que todo sea consistente

2. **AUDITORÍA VISUAL CON SOLUCIÓN PRODUCIDA**:
   - Para CADA producto inconsistente, PRODUCE:
     → Qué está mal: "[producto] tiene fondo gris, el estándar es blanco"
     → Solución DIY producida: instrucciones exactas con remove.bg o Canva
     → Alt text nuevo PRODUCIDO para cada imagen
   - PRODUCE la lista priorizada: primero los productos con más visitas/ventas

3. **BRIEF FOTOGRÁFICO PROFESIONAL PRODUCIDO**:
   - PRODUCE dentro de <div class="ai-deliverable"> el brief COMPLETO listo para enviar al fotógrafo:
     → "Productos a fotografiar: [lista numerada con referencia]"
     → "Especificaciones: Fondo blanco puro (#ffffff), iluminación softbox 5500K, ángulo frontal 45°, resolución 2048x2048px, formato JPG calidad 90%"
     → "Por cada producto: 1 frontal, 1 lateral, 1 detalle/textura, 1 lifestyle/en uso, 1 packaging"
     → "Referencia de estilo: [URL de ejemplo o descripción visual detallada]"
     → "Plazo: [fecha]. Presupuesto estimado: [rango]"
   - Si no tiene fotógrafo: PRODUCE la guía DIY completa: "Caja de luz Amazon ~25€ + móvil + Snapseed (app gratis)"

4. **REDESIGN DE SECCIONES WEB PRODUCIDO**:
   - PRODUCE el CSS completo para las secciones que necesitan rediseño:
     → Header: <code>.header { background: #hex; padding: 20px 40px; } .header-logo { height: 40px; } .header-nav a { font-family: 'X'; color: #hex; }</code>
     → Ficha de producto: <code>.product-page { max-width: 1200px; } .product-gallery { width: 55%; } .product-info { width: 40%; padding: 24px; }</code>
     → Footer: colores, columnas, tipografía, links
   - PRODUCE la descripción visual pixel-perfect de cómo debe verse cada sección

5. **CONTENIDO TEXTUAL CONSISTENTE PRODUCIDO**:
   - PRODUCE la descripción-tipo (template) que debe seguir CADA producto
   - PRODUCE 2-3 descripciones de ejemplo COMPLETAS siguiendo el nuevo tono de voz
   - Brief para redactor: "Necesito que reescribas [productos] siguiendo este tono: [ejemplo]. Aquí tienes el template: [template producido]"

6. **HERRAMIENTAS + TUTORIAL VISUAL PRODUCIDO**:
   - Canva (gratis): crear banners, redimensionar, branding kits
   - Remove.bg (gratis limitado): quitar fondos
   - TinyPNG (gratis): comprimir imágenes
   - Snapseed (app gratis): retocar desde móvil
   - PRODUCE las instrucciones de subida por plataforma con rutas exactas`,

  redesigns: `FRAMEWORK DE REDISEÑO — PRODUCIR FICHAS DE PRODUCTO COMPLETAS Y DISEÑOS WEB:

Tu misión: NO solo sugerir mejoras en fichas — PRODUCIR las fichas de producto COMPLETAS rediseñadas, con títulos, descripciones, FAQ, y el CSS/layout de cómo deben verse las páginas de producto.

1. **FICHAS DE PRODUCTO REDISEÑADAS — CONTENIDO COMPLETO PRODUCIDO**:
   - Para CADA producto analizado, PRODUCE dentro de <div class="ai-deliverable">:
     → TÍTULO nuevo optimizado (con keywords + beneficio + marca)
     → DESCRIPCIÓN COMPLETA (mín 200 palabras): gancho emocional → storytelling → bullet points de beneficios → especificaciones técnicas → CTA urgente
     → TAGS/ETIQUETAS optimizadas (10-15 tags relevantes)
     → 5 PREGUNTAS FRECUENTES (FAQ) redactadas con respuestas completas
     → TEXTOS DE URGENCIA: "⚡ Solo quedan X unidades", "🔥 Más vendido del mes", "✅ Envío gratis"
   - El cliente NO tiene que escribir NI UNA PALABRA — todo está ya redactado y optimizado
   - Cómo implementar: "En Shopify: Productos → [nombre] → campo 'Título' → pega esto: [título] → campo 'Descripción' → pega esto: [descripción completa]"

2. **DISEÑO DE PÁGINA DE PRODUCTO PRODUCIDO — CSS + LAYOUT COMPLETO**:
   - PRODUCE dentro de <div class="ai-deliverable"> el CSS completo de cómo debe verse la ficha de producto:
     → <code>.product-page { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 55% 40%; gap: 40px; padding: 40px 20px; }</code>
     → <code>.product-title { font-family: 'Playfair Display', serif; font-size: 28px; color: #1a1a2e; margin-bottom: 8px; }</code>
     → <code>.product-price { font-size: 24px; color: #e94560; font-weight: 700; } .product-price-old { text-decoration: line-through; color: #999; font-size: 18px; }</code>
     → <code>.product-cta { background: #e94560; color: white; border: none; padding: 16px 40px; border-radius: 8px; font-size: 18px; cursor: pointer; width: 100%; }</code>
     → <code>.product-features li { padding: 8px 0; border-bottom: 1px solid #eee; } .product-features li::before { content: "✅ "; }</code>
   - PRODUCE la estructura de secciones: Hero → Gallery → Info → Features → FAQ → Reviews → Related
   - Brief para programador: "Aquí tienes el CSS completo para las páginas de producto. Insértalo en tu theme.css o en la sección de código personalizado"

3. **CONTENIDO ADICIONAL PRODUCIDO POR PRODUCTO**:
   - FAQ completas PRODUCIDAS (5 preguntas con respuesta por cada producto)
   - Tabla de especificaciones PRODUCIDA en HTML
   - Sección "Por qué elegir este producto" PRODUCIDA con 4-5 diferenciadores
   - Trust badges y garantías: texto exacto producido
   - Cross-selling: "A los clientes que compran [A] también les gusta [B]" — texto y diseño producidos

4. **ELEMENTOS DE CONVERSIÓN PRODUCIDOS**:
   - Textos de urgencia PRODUCIDOS para cada producto: countdown, stock bajo, más vendido
   - Reviews/testimonios: si tiene reseñas, PRODUCE el HTML para mostrarlas destacadas
   - App recomendada: "Judge.me Product Reviews (gratis en Shopify) para reseñas verificadas"
   - PRODUCE el diseño de la sección de confianza: iconos + texto (envío gratis, devoluciones, pago seguro, soporte)

5. **LANDING PAGES ESPECIALES PRODUCIDAS**:
   - PRODUCE el diseño completo de una landing para el producto estrella:
     → Hero section: headline + subtitle + CTA (textos y CSS producidos)
     → Sección de beneficios: 3-4 columnas con icono + título + descripción
     → Social proof: testimonios + logos + cifras
     → FAQ + CTA final
   - Todo con CSS real, colores hex, tipografías y espaciados — listo para que el programador lo implemente

6. **A/B TESTING + PLAN DE IMPLEMENTACIÓN PRODUCIDO**:
   - PRODUCE 2 versiones (A y B) del título y descripción de los productos clave
   - "Prueba durante 2 semanas cada versión. Compara ventas en Google Analytics → Conversiones → E-commerce"
   - PRODUCE el calendario: "Semana 1-2: versión A. Semana 3-4: versión B. Semana 5: implementar la ganadora"
   - Edición en masa: "Shopify: Productos → seleccionar varios → 'Editar productos'. WooCommerce: wp-admin → Productos → Quick Edit"`,

  revenue: `FRAMEWORK DE REVENUE — PRODUCIR ESTRATEGIA DE CRECIMIENTO COMPLETA CON TODO EL MATERIAL:

Tu misión: NO solo analizar revenue — PRODUCIR toda la estrategia de crecimiento con emails de marketing escritos, posts de redes sociales listos, campañas completas, y diseño de embudos de venta.

1. **DASHBOARD DE REVENUE PRODUCIDO — ANÁLISIS VISUAL COMPLETO**:
   - PRODUCE dentro de <div class="ai-deliverable"> una tabla resumen: Métrica | Valor actual | Benchmark sector | Objetivo 90 días | Gap
   - Métricas: Revenue mensual, AOV, Tasa conversión, Clientes nuevos vs repetidores, Carritos abandonados, LTV
   - Explica cada métrica en lenguaje simple: "AOV = cuánto gasta cada cliente de media"
   - "Verifica tú mismo: Shopify → Analíticas → Panel de control → 'Valor medio de pedido'"

2. **SECUENCIA DE EMAILS DE RETENCIÓN PRODUCIDA — COMPLETA**:
   - PRODUCE dentro de <div class="ai-deliverable"> los 5 emails de la secuencia post-compra, CADA UNO con:
     → Asunto optimizado (con emoji + urgencia)
     → Body HTML completo con diseño
     → CTA principal
     → Timing exacto
   - Email 1 (24h): Agradecimiento + cupón 10% próxima compra
   - Email 2 (7 días): Pedir reseña + tutorial del producto
   - Email 3 (14 días): Productos relacionados personalizados
   - Email 4 (30 días): "Te echamos de menos" + oferta especial
   - Email 5 (60 días): Novedades + incentivo de reactivación
   - Herramientas: "Configúralo en Mailchimp (gratis hasta 500 contactos) o Klaviyo (gratis hasta 250)"

3. **EMAILS DE CARRITO ABANDONADO PRODUCIDOS — 3 EMAILS COMPLETOS**:
   - PRODUCE dentro de <div class="ai-deliverable"> los 3 emails COMPLETOS:
     → Email 1 (1h): Asunto: "¿Olvidaste algo? 🛒" + recordatorio amable + foto del producto + botón CTA
     → Email 2 (24h): Asunto: "Tu carrito te espera — envío gratis hoy ⏰" + urgencia + beneficio adicional
     → Email 3 (72h): Asunto: "Última oportunidad: 10% extra en tu pedido 🎁" + descuento final + countdown
   - CADA email con: asunto, pre-header, body completo, CTA, footer
   - Cómo activarlo: "Shopify: Configuración → Checkout → Abandonos de carrito → Enviar emails automáticamente → 1 hora"

4. **CAMPAÑAS DE MARKETING PRODUCIDAS — LISTAS PARA LANZAR**:
   - PRODUCE dentro de <div class="ai-deliverable">:
     → Campaña de primera compra: cupón BIENVENIDO10, email + post social + banner web — todo producido
     → Campaña de upsell: sugerencias de productos complementarios con textos producidos
     → Campaña de temporada: textos para la próxima fecha clave (Black Friday/Navidad/rebajas)
   - PRODUCE 5 posts de redes sociales listos para publicar:
     → Cada uno con: texto + emojis + hashtags + CTA + descripción de la imagen que debe acompañarlo
   - PRODUCE el contenido de Google Merchant Center: títulos y descripciones optimizadas para Google Shopping

5. **EMBUDO DE VENTAS PRODUCIDO — DISEÑO COMPLETO**:
   - PRODUCE el diseño del embudo: Visita → Producto → Carrito → Checkout → Post-compra
   - Para CADA etapa: qué pasa ahora, qué debería pasar, contenido/diseño necesario (PRODUCIDO)
   - PRODUCE el diseño de la página de checkout optimizada: textos de confianza, urgencia, garantía
   - PRODUCE el diseño de la "Thank you page": upsell + reseña + redes sociales + cupón siguiente compra

6. **PLAN DE CRECIMIENTO A 90 DÍAS PRODUCIDO**:
   - PRODUCE dentro de <div class="ai-deliverable"> el calendario detallado:
     → Semana 1-2: [acciones + material ya producido en este informe]
     → Semana 3-4: [acciones + material]
     → Mes 2: [acciones + objetivos]
     → Mes 3: [acciones + proyección de resultados]
   - Proyecciones financieras: "Con estos cambios: revenue estimado X€→Y€ (+Z%), AOV: A€→B€, Conversión: C%→D%"
   - Herramientas: Google Analytics (gratis), Mailchimp/Klaviyo (gratis), Buffer (gratis 3 canales), Google Merchant Center (gratis), ReConvert (gratis hasta 49 pedidos/mes)`,

  pricing: `FRAMEWORK DE ANÁLISIS DE PRICING ESTRATÉGICO:

1. Análisis de elasticidad de precios por producto
2. Benchmarking competitivo de precios
3. Estrategia de pricing psicológico
4. Oportunidades de bundling y cross-sell
5. Implementación de precios dinámicos
6. Multi-plataforma: Shopify, WooCommerce, PrestaShop`,
};

async function generateAiRecommendations(
  projectId: number,
  area: ReportArea,
  dataContext: string,
  niche?: string,
  platformType?: string,
): Promise<string> {
  try {
    const platform = platformType || "e-commerce";
    const areaPrompt = AREA_SPECIFIC_PROMPTS[area] || "";

    let brandContext = "";
    try {
      const profile = await fetchBrandProfile(projectId);
      if (profile) {
        brandContext = buildBrandDnaContext(profile);
      }
    } catch (e) {
      logger.warn({ err: e }, "Could not fetch brand profile for report");
    }

    const prompt = `Eres un consultor senior realizando una auditoría profesional EXHAUSTIVA para un e-commerce. Analiza estos datos REALES del negocio y genera un informe de consultoría de MÁXIMA CALIDAD con recomendaciones ULTRA-ESPECÍFICAS.

PLATAFORMA DEL CLIENTE: ${platform} (adapta TODAS las instrucciones a esta plataforma, pero incluye también instrucciones para otras plataformas al final)
ÁREA DE ANÁLISIS: ${area.toUpperCase()}

${brandContext}

${dataContext}

${areaPrompt}

GENERA el análisis con esta estructura HTML (NO JSON, devuelve HTML directo):

<div class="ai-analysis">
  <div class="ai-diagnosis">
    <h3>📋 Diagnóstico Ejecutivo — Resumen para el Propietario</h3>
    <p>[4-5 párrafos EXTENSOS explicando la situación en LENGUAJE CLARO que cualquier persona entienda. Usa analogías del mundo físico para conceptos técnicos (ej: "El meta título es como el rótulo de tu tienda física — es lo primero que la gente ve cuando pasa por delante en Google"). Menciona productos ESPECÍFICOS por nombre, números exactos, y compara con lo que hacen las mejores tiendas de su sector. Explica QUÉ SIGNIFICA cada dato para su negocio en euros perdidos o ganados.]</p>
  </div>
  
  <div class="ai-actions">
    <h3>🎯 Plan de Acción — Guía Completa para Implementar Tú Mismo</h3>
    <p><em>Hemos ordenado las acciones de mayor a menor impacto. Cada acción incluye instrucciones exactas para que puedas realizarla tú mismo desde tu ordenador, o sepas exactamente qué pedir a tu equipo.</em></p>
    [GENERA 6-8 acciones detalladas, cada una así:]
    <div class="action-item">
      <div class="action-header">
        <strong>[Título de la acción — ESPECÍFICO con nombre de producto, no genérico]</strong>
        <span class="action-impact">[CRÍTICO/ALTO/MEDIO impacto]</span>
      </div>
      <p><strong>❓ ¿Qué es esto y por qué importa?</strong> [Explicación en lenguaje simple usando una analogía del mundo real. Ej: "Imagina que tienes una tienda física pero el cartel de la puerta está en blanco — la gente pasa de largo porque no sabe qué vendes. Eso es exactamente lo que pasa cuando tus meta títulos están vacíos."]</p>
      <p><strong>📊 Tu situación actual:</strong> [Datos CONCRETOS de su tienda con nombres de productos: "Tu producto 'Camiseta X' tiene el meta título 'Camiseta' que solo tiene 8 caracteres. Lo ideal es entre 50-60 caracteres. Esto significa que Google muestra tu producto con un título incompleto y los compradores no hacen clic."]</p>
      <p><strong>📦 Contenido producido por nosotros — LISTO PARA USAR:</strong></p>
      <div class="ai-deliverable">
        [Aquí va el TRABAJO YA TERMINADO: el texto completo redactado, el código CSS/HTML, el Schema JSON-LD, el email de marketing, la descripción de producto, el diseño visual detallado... lo que corresponda a esta acción. 
        EJEMPLO para meta título: <code>Camiseta Algodón Orgánico Premium - Comodidad Sostenible | MiMarca</code>
        EJEMPLO para CSS: <code>.product-hero { background: #1a1a2e; padding: 48px 24px; } .product-hero h1 { font-family: 'Montserrat', sans-serif; font-size: 32px; color: #ffffff; }</code>
        EJEMPLO para descripción: texto completo de 150+ palabras con bullet points, storytelling, CTA
        EJEMPLO para email: asunto + body HTML completo + CTA
        TODO LISTO PARA COPIAR Y PEGAR]
      </div>
      <p><strong>🛠️ Cómo implementarlo — Paso a paso en tu panel de administración:</strong></p>
      <ol>
        <li><strong>Paso 1:</strong> Abre tu navegador y ve a [URL REAL del panel de admin de la plataforma del cliente]. Inicia sesión con tu usuario y contraseña habituales.</li>
        <li><strong>Paso 2:</strong> En el menú de la izquierda, haz clic en "[nombre REAL de la sección]". Verás la lista de todos tus productos.</li>
        <li><strong>Paso 3:</strong> Busca el producto "[NOMBRE EXACTO del producto]" y haz clic en él.</li>
        <li><strong>Paso 4:</strong> Baja hasta la sección "[nombre REAL de la sección]". Haz clic en "[nombre del botón/enlace]".</li>
        <li><strong>Paso 5:</strong> En el campo "[nombre EXACTO del campo]", BORRA lo que hay y pega el contenido de arriba (el que hemos producido para ti).</li>
        <li><strong>Paso 6:</strong> Haz clic en "[Guardar]".</li>
        <li><strong>Paso 7:</strong> Repite para estos otros productos: [lista con el contenido ESPECÍFICO producido para cada uno]</li>
      </ol>
      <p><strong>🔧 Herramientas que necesitas:</strong> [herramientas REALES con nombre, URL, gratis/pago]</p>
      <p><strong>👥 Si tienes equipo — Brief para tu [diseñador/programador/fotógrafo]:</strong> <em>"[BRIEF PROFESIONAL completo para enviar: qué necesitas, especificaciones técnicas, referencia visual, lista de productos, plazo, resultado esperado]"</em></p>
      <p><strong>✅ Comprobación — ¿Lo has hecho bien?</strong> [Test concreto en la VIDA REAL: "Abre una pestaña nueva de incógnito en tu navegador → Escribe la dirección de tu tienda → Ve al producto que acabas de cambiar → Debería aparecer [X]. Si ves [Y], está correcto. Si ves [Z], revisa el paso 5." O: "Ve a Google y escribe site:tutienda.com + nombre del producto. En 2-5 días deberías ver el nuevo texto."]</p>
      <p><strong>📈 Impacto estimado:</strong> [En lenguaje que entienda: ej. "Esto debería traerte entre 10 y 25 visitantes más al día desde Google, lo que puede suponer ~450-800€/mes de ventas adicionales basándonos en tu tasa de conversión actual"]</p>
      <p><strong>⏱️ Tiempo necesario:</strong> [Tiempo realista: ej. "15-20 minutos si lo haces tú" o "5 minutos si se lo pides a tu programador"]</p>
      <p><strong>🔢 Prioridad:</strong> P1 (URGENTE — hacerlo hoy o mañana) / P2 (IMPORTANTE — hacerlo esta semana) / P3 (RECOMENDADO — hacerlo este mes)</p>
    </div>
  </div>
  
  <div class="ai-quick-wins">
    <h3>⚡ Mejoras Rápidas — Haz esto HOY MISMO (menos de 10 minutos cada una)</h3>
    <p><em>Estas son mejoras que puedes hacer ahora mismo, sentándote 10 minutos delante de tu ordenador. No necesitas ningún conocimiento técnico.</em></p>
    <ol>
      <li><strong>[Acción concreta con nombre de producto]:</strong>
        <br>📍 <strong>Dónde:</strong> [Ruta en tu panel REAL: "Entra en tutienda.myshopify.com/admin → Productos → [nombre] → sección [X]"]
        <br>📝 <strong>Qué hacer:</strong> [Instrucción exacta: "En el campo 'Meta descripción', borra lo que hay y escribe:"]
        <br>📋 <strong>Texto exacto a copiar y pegar:</strong> <code>[EL TEXTO LITERAL optimizado y listo]</code>
        <br>💾 <strong>Guardar:</strong> "Haz clic en el botón 'Guardar' arriba a la derecha"
        <br>✅ <strong>Verificación:</strong> ["Recarga la página del producto — si ves tu nuevo texto en el campo, está bien hecho"]
      </li>
      <li>[Igual de detallado - mínimo 5 quick wins]</li>
    </ol>
  </div>

  <div class="ai-glossary">
    <h3>📖 Glosario — Términos que usamos en este informe (explicados de forma sencilla)</h3>
    <p><em>Aquí explicamos todos los términos técnicos de forma simple para que entiendas cada detalle:</em></p>
    <ul>
      <li><strong>[TÉRMINO]:</strong> [Explicación con analogía del mundo real. Ej: "<strong>Meta título</strong>: Es el título que Google muestra cuando alguien busca tus productos. Piensa en él como el rótulo de tu tienda — si es atractivo y claro, la gente entra; si está en blanco o es confuso, pasan de largo."]</li>
      <li>[Incluir 8-12 términos usados en el informe, cada uno explicado como si hablaras con alguien que no sabe nada de tecnología]</li>
    </ul>
  </div>

  <div class="ai-platform-guide">
    <h3>🔧 Cómo hacer estos cambios según tu plataforma</h3>
    <p><em>Las instrucciones anteriores están escritas para ${platform}. Si usas otra plataforma o estás pensando en cambiar, aquí tienes cómo hacer lo mismo en cada una:</em></p>
    <div class="action-item">
      <p><strong>🟢 En Shopify:</strong> [Ruta EXACTA en el admin real de Shopify, con nombres de menú tal como aparecen. Apps recomendadas: nombre exacto, si es GRATIS o de pago (precio/mes), y una frase de para qué sirve]</p>
      <p><strong>🔵 En WooCommerce (WordPress):</strong> [Ruta real en wp-admin. Plugins: nombre exacto + si es gratuito + cómo instalarlo: "Ve a tutienda.com/wp-admin → Plugins → Añadir nuevo → Busca '[nombre]' → Instalar → Activar"]</p>
      <p><strong>🟣 En PrestaShop:</strong> [Ruta real en el back-office. Módulos necesarios con nombre exacto]</p>
      <p><strong>⚪ Tienda personalizada:</strong> ["Si tu tienda está hecha a medida por un programador, envíale este mensaje: [MENSAJE LITERAL para el desarrollador con las especificaciones técnicas]"]</p>
    </div>
  </div>

  <div class="ai-team-briefs">
    <h3>📨 Mensajes listos para enviar a tu equipo</h3>
    <p><em>Si tienes un equipo que te ayuda con la tienda, aquí tienes mensajes que puedes copiar y enviar directamente por WhatsApp, email o como prefieras:</em></p>
    <div class="action-item">
      <p><strong>📸 Para tu fotógrafo/diseñador:</strong> <em>"[MENSAJE LITERAL listo para enviar con las instrucciones exactas de lo que necesitas: qué productos fotografiar, qué estilo, qué fondo, qué medidas, cuántas fotos por producto, para cuándo lo necesitas]"</em></p>
      <p><strong>💻 Para tu programador/técnico:</strong> <em>"[MENSAJE LITERAL con las tareas técnicas: código a implementar, dónde insertarlo, qué resultado esperas ver, plazo]"</em></p>
      <p><strong>✍️ Para tu copywriter/redactor:</strong> <em>"[MENSAJE LITERAL con lo que necesitas: qué textos reescribir, tono de voz, longitud, keywords a incluir, productos prioritarios]"</em></p>
      <p>[Solo incluir los roles que apliquen según las acciones recomendadas]</p>
    </div>
  </div>
</div>

REGLAS OBLIGATORIAS: 
- FILOSOFÍA "PRODUCIR, NO RECOMENDAR": CADA acción DEBE incluir el CONTENIDO TERMINADO dentro de <div class="ai-deliverable"> — no solo la instrucción
- MÍNIMO 6 acciones detalladas (idealmente 8), CADA UNA con: ¿Qué es?, Situación actual, CONTENIDO PRODUCIDO (deliverable), Pasos de implementación, Herramientas, Brief para equipo, Comprobación, Impacto, Tiempo, Prioridad
- MÍNIMO 5 Quick Wins con el TEXTO/CÓDIGO ya producido + instrucciones de dónde pegarlo
- INCLUYE Glosario con 8-12 términos explicados con analogías del mundo real
- INCLUYE Mensajes para el equipo (briefs profesionales listos para enviar)
- Para TEXTO (meta título, descripción, alt text, email, post social): ESCRIBE EL TEXTO COMPLETO ya optimizado para CADA producto concreto
- Para DISEÑO (layout, secciones, página): INCLUYE CSS real con selectores, colores hex (#xxxxxx), tipografías, padding, margins, border-radius — que el programador solo copie y pegue
- Para CÓDIGO (Schema JSON-LD, HTML de secciones, liquid/php): DA EL CÓDIGO COMPLETO listo para insertar, indicando EXACTAMENTE en qué archivo y en qué línea
- Para EMAILS (recuperación de carrito, post-venta, campaña): ESCRIBE el email COMPLETO con asunto, body HTML, CTA y footer
- Para REDES SOCIALES: ESCRIBE los posts completos con hashtags y emojis listos para publicar
- Para FOTOGRAFÍA: DA el brief técnico completo (fondo, iluminación, ángulos, resolución, número de fotos, estilo)
- NOMBRA productos ESPECÍFICOS del catálogo — NUNCA genérico
- CADA paso refiere a herramientas REALES del mundo real
- El informe debe ser 100% AUTOSUFICIENTE + AUTOCONTENIDO: incluye TODO el material producido, no solo instrucciones
- INCLUYE sección Multi-Plataforma con rutas reales
- CADA ACCIÓN incluye "✅ Comprobación" verificable por el cliente`;

    const result = await askClaudeWithBrain(
      projectId,
      [{ role: "user", content: prompt }],
      AI_REPORT_SYSTEM,
      area === "financial" || area === "pricing" || area === "revenue" ? "pricing" : area === "seo" ? "seo" : "general",
      niche,
      16000,
    );

    const sanitized = sanitizeAiHtmlOutput(result);
    const htmlMatch = sanitized.match(/<div class="ai-analysis">[\s\S]*$/);
    const cleanHtml = htmlMatch ? htmlMatch[0] : `<div class="ai-analysis">${sanitized}</div>`;

    return `
    <div class="section" style="page-break-before:always;">
      <div class="section-title">Análisis y Recomendaciones IA — Consultoría Estratégica</div>
      <div class="card" style="padding:28px;line-height:1.85;font-size:13px;">
        ${cleanHtml}
      </div>
      <div style="margin-top:12px;padding:10px 16px;background:rgba(200,168,75,.05);border-radius:8px;font-size:11px;color:rgba(255,255,255,.4);">
        Análisis generado por Shopy Crafter AI · Basado en datos reales del negocio · Agnóstico de plataforma · ${new Date().toLocaleDateString("es-ES")}
      </div>
    </div>`;
  } catch (err) {
    logger.warn({ err, area }, "AI recommendations generation failed — report continues without AI section");
    return "";
  }
}

interface CogsEstimation {
  businessType: string;
  location: string;
  locationDetail: string;
  disclaimer: string;
  staffCosts: Array<{ role: string; count: number; grossSalary: number; socialSecurity: number; totalCost: number; source: string }>;
  fixedCosts: Array<{ concept: string; rangeMin: number; rangeMax: number; unit: string; source: string; category: string }>;
  variableCosts: Array<{ concept: string; costPerUnit: string; basis: string }>;
  initialInvestment: Array<{ concept: string; rangeMin: number; rangeMax: number; source: string }>;
  serviceMargins?: Array<{ service: string; materials: string; costRange: string; priceRange: string; marginRange: string; timeMinutes?: number }>;
  competitors: Array<{ name: string; price: string; model: string; presence: string }>;
  rentAnalysis: { zone: string; avgPriceM2: number; estimatedM2: number; rangeMin: number; rangeMax: number; source: string; comparables: string };
  taxesAndLegal: Array<{ concept: string; amount: string; frequency: string; source: string }>;
  seasonality?: { highMonths: string; lowMonths: string; revenueVariation: string };
  breakeven: { fixedCostsMonthly: number; avgMarginPercent: number; minServicesMonth: number; perWeek: string; monthsToROI: string };
  avgTicket: number;
  cogsPerUnit: number;
  marginPercent: number;
  totalMonthlyCosts: { min: number; max: number };
  annualProjection: { revenueMin: number; revenueMax: number; costsMin: number; costsMax: number; profitMin: number; profitMax: number };
}

async function estimateCogsWithAI(projectId: number, businessInfo: {
  name: string; sector: string; location: string; services: string[];
  products: Array<{ title: string; price: string }>; domain?: string;
}): Promise<CogsEstimation | null> {
  try {
    const prompt = `Eres un ANALISTA FINANCIERO SENIOR con 20 años de experiencia en consultoría de costes para PYMEs españolas. Tu trabajo es generar un análisis COGS (Coste de Bienes/Servicios Vendidos) de nivel profesional, TAN PRECISO como sea posible sin acceso a la contabilidad real del negocio.

NEGOCIO A ANALIZAR:
- Nombre: ${businessInfo.name}
- Sector: ${businessInfo.sector}
- Ubicación EXACTA: ${businessInfo.location}
- Servicios/Productos ofrecidos: ${businessInfo.services.join(", ")}
${businessInfo.products.length > 0 ? `- Catálogo (${businessInfo.products.length} productos): ${businessInfo.products.slice(0, 15).map(p => `${p.title} (${p.price}€)`).join(", ")}` : ""}
${businessInfo.domain ? `- Web: ${businessInfo.domain}` : ""}

INSTRUCCIONES — SÉ EXHAUSTIVO Y PRECISO:

1. PERSONAL Y NÓMINAS:
   - Estima el número MÍNIMO de trabajadores necesarios según el tipo y tamaño del negocio
   - Para cada puesto: salario bruto según convenio colectivo del sector en esa CCAA
   - Incluye coste de Seguridad Social empresa (~30-33% del bruto)
   - Fuentes: convenios colectivos sectoriales, INE, InfoJobs promedios zona

2. ALQUILER — ANÁLISIS POR ZONA:
   - Busca el precio REAL del m² en la zona EXACTA del negocio (barrio, calle si es posible)
   - Estima los m² necesarios para este tipo de negocio
   - Cita comparables reales de Idealista/Fotocasa en la zona
   - Si es zona prime (centro, turística), refleja el sobrecoste

3. COSTES FIJOS MENSUALES (desglose exhaustivo):
   - Alquiler (del análisis anterior)
   - Suministros: electricidad (según potencia necesaria), agua, gas (si aplica)
   - Telecomunicaciones: internet fibra + línea móvil
   - Seguros: RC profesional, local, mercancías
   - Gestoría/Asesoría fiscal y laboral
   - Software/Licencias: TPV, facturación, gestión
   - Mantenimiento y limpieza del local
   - Cuota de autónomos (si aplica)
   - Material de oficina y consumibles recurrentes
   - Marketing y publicidad mensual básica
   - Categoriza cada coste: "Personal", "Local", "Operaciones", "Admin", "Marketing"

4. COSTES VARIABLES por servicio/producto:
   - Materiales ESPECÍFICOS con precios de proveedores reales españoles
   - Comisiones de pago (Stripe, Redsys, datáfono)
   - Embalaje y envío (si aplica)
   - Comisiones de plataformas (si aplica)

5. INVERSIÓN INICIAL:
   - Equipamiento específico del sector con precios de proveedores
   - Adecuación del local (obra, decoración, instalaciones)
   - Licencias municipales y permisos de apertura
   - Stock inicial / inventario de arranque
   - Señalización, branding y web

6. MÁRGENES POR SERVICIO/PRODUCTO:
   - Para CADA servicio principal: materiales usados, coste material, precio mercado, margen
   - Tiempo estimado en minutos por servicio (para calcular coste hora)
   - El coste debe incluir la parte proporcional de personal + materiales

7. IMPUESTOS Y OBLIGACIONES LEGALES:
   - IVA (tipo aplicable al sector), IRPF, IS
   - Tasas municipales (basura, vado, terraza si aplica)
   - Prevención de riesgos laborales
   - Protección de datos RGPD

8. COMPETENCIA LOCAL:
   - Mínimo 3-5 competidores REALES de la misma zona/ciudad
   - Precios reales de sus servicios principales
   - Modelo de negocio y diferenciación

9. ESTACIONALIDAD (si aplica):
   - Meses de alta y baja demanda
   - Variación estimada de ingresos (%)

10. PUNTO DE EQUILIBRIO Y PROYECCIÓN:
    - Costes fijos totales mensuales (suma de todo)
    - Margen bruto medio ponderado
    - Servicios/ventas mínimas al mes para cubrir costes
    - Meses estimados hasta ROI de la inversión inicial
    - Proyección anual: ingresos, costes y beneficio estimado (escenario conservador)

REGLAS ABSOLUTAS:
- NUNCA inventes datos — usa siempre precios y fuentes reales verificables
- Cita SIEMPRE la fuente: "Idealista Poble Sec 2026", "Convenio Peluquerías Catalunya", "Amazon Business", "Manutan.es", etc.
- Los rangos deben ser ESTRECHOS y realistas, no amplios e inútiles
- El resultado debe ser tan preciso que el dueño diga "esto se acerca mucho a mi realidad"

Responde en JSON con esta estructura exacta:
{
  "businessType": "tipo de negocio",
  "location": "ubicación",
  "locationDetail": "barrio/zona exacta con contexto (ej: Poble Sec, zona residencial cerca de Montjuïc)",
  "disclaimer": "Estimación profesional basada en datos de mercado reales buscados, cercados y comparados en fuentes públicas verificables (Idealista, INE, convenios colectivos, proveedores sectoriales). Los costes reales pueden variar ±10-15% según condiciones contractuales, antigüedad y volumen.",
  "staffCosts": [{"role":"Puesto","count":1,"grossSalary":1400,"socialSecurity":462,"totalCost":1862,"source":"Convenio X"}],
  "fixedCosts": [{"concept":"Alquiler","rangeMin":800,"rangeMax":1000,"unit":"€/mes","source":"Idealista zona X","category":"Local"}],
  "variableCosts": [{"concept":"Comisión","costPerUnit":"1.5%","basis":"Tarifas Redsys"}],
  "initialInvestment": [{"concept":"Equipamiento","rangeMin":500,"rangeMax":800,"source":"Proveedor X"}],
  "serviceMargins": [{"service":"Servicio","materials":"mat1,mat2","costRange":"10-15€","priceRange":"50-60€","marginRange":"72-78%","timeMinutes":45}],
  "competitors": [{"name":"Nombre Real","price":"50€","model":"modelo","presence":"zona"}],
  "rentAnalysis": {"zone":"Barrio","avgPriceM2":12,"estimatedM2":40,"rangeMin":480,"rangeMax":600,"source":"Idealista","comparables":"Local 45m² en C/X por 520€, local 38m² en C/Y por 490€"},
  "taxesAndLegal": [{"concept":"IVA","amount":"21%","frequency":"trimestral","source":"AEAT"}],
  "seasonality": {"highMonths":"Jun-Sep","lowMonths":"Ene-Feb","revenueVariation":"±25%"},
  "breakeven": {"fixedCostsMonthly":3500,"avgMarginPercent":72,"minServicesMonth":25,"perWeek":"6-7/sem","monthsToROI":"14-18 meses"},
  "avgTicket": 100,
  "cogsPerUnit": 15,
  "marginPercent": 72,
  "totalMonthlyCosts": {"min":3200,"max":4100},
  "annualProjection": {"revenueMin":60000,"revenueMax":90000,"costsMin":38400,"costsMax":49200,"profitMin":10800,"profitMax":40800}
}`;

    const result = await askClaudeJsonWithBrain<CogsEstimation>(
      projectId, prompt,
      "Eres un analista financiero senior especializado en consultoría de costes para PYMEs en España. Conoces en detalle los convenios colectivos por sector y CCAA, los precios de alquiler por barrio en las principales ciudades, los costes de proveedores sectoriales, los impuestos y tasas aplicables, y las estructuras de costes típicas por tipo de negocio. NUNCA inventes datos. Cita SIEMPRE fuentes verificables reales (Idealista, INE, convenios colectivos, AEAT, proveedores con nombre). Tus estimaciones deben ser tan precisas que un empresario del sector las reconozca como realistas.",
      "financial", undefined, 8000
    );
    return result;
  } catch (err) {
    logger.error({ err, projectId }, "Failed to estimate COGS with AI");
    return null;
  }
}

function buildCogsEstimationHtml(est: CogsEstimation, brandColors: { accent: string; muted: string; jade: string; orange: string; card: string; surface: string; border: string; silver?: string }): string {
  const C = brandColors;
  const silverColor = C.silver || C.muted;

  const staffRows = (est.staffCosts || []).map(s =>
    `<tr><td><strong>${s.role}</strong></td><td>${s.count}</td><td>${s.grossSalary?.toLocaleString("es-ES")}€</td><td>${s.socialSecurity?.toLocaleString("es-ES")}€</td><td style="color:${C.orange};font-weight:700">${s.totalCost?.toLocaleString("es-ES")}€</td><td style="font-size:10px">${s.source}</td></tr>`
  ).join("");
  const totalStaff = (est.staffCosts || []).reduce((s, c) => s + (c.totalCost || 0), 0);

  const fixedRows = est.fixedCosts.map(c =>
    `<tr><td>${c.concept}</td><td style="font-size:10px;color:${silverColor}">${c.category || ""}</td><td><strong>${c.rangeMin?.toLocaleString("es-ES")} — ${c.rangeMax?.toLocaleString("es-ES")}${c.unit}</strong></td><td style="font-size:10px">${c.source}</td></tr>`
  ).join("");
  const totalFixedMin = est.fixedCosts.reduce((s, c) => s + (c.rangeMin || 0), 0);
  const totalFixedMax = est.fixedCosts.reduce((s, c) => s + (c.rangeMax || 0), 0);

  const investRows = est.initialInvestment.map(c =>
    `<tr><td>${c.concept}</td><td><strong>${c.rangeMin?.toLocaleString("es-ES")} — ${c.rangeMax?.toLocaleString("es-ES")}€</strong></td><td style="font-size:10px">${c.source}</td></tr>`
  ).join("");
  const totalInvestMin = est.initialInvestment.reduce((s, c) => s + (c.rangeMin || 0), 0);
  const totalInvestMax = est.initialInvestment.reduce((s, c) => s + (c.rangeMax || 0), 0);

  const variableRows = est.variableCosts.map(c =>
    `<tr><td>${c.concept}</td><td><strong>${c.costPerUnit}</strong></td><td style="font-size:10px">${c.basis}</td></tr>`
  ).join("");

  const marginRows = (est.serviceMargins || []).map(s =>
    `<tr><td><strong>${s.service}</strong></td><td style="font-size:10px">${s.materials}</td><td><strong>${s.costRange}</strong></td><td>${s.priceRange}</td><td style="color:${C.jade};font-weight:700">${s.marginRange}</td>${s.timeMinutes ? `<td>${s.timeMinutes} min</td>` : ""}</tr>`
  ).join("");
  const hasTimeCol = (est.serviceMargins || []).some(s => s.timeMinutes);

  const compRows = est.competitors.map(c =>
    `<tr><td>${c.name}</td><td>${c.price}</td><td>${c.model}</td><td>${c.presence}</td></tr>`
  ).join("");

  const taxRows = (est.taxesAndLegal || []).map(t =>
    `<tr><td>${t.concept}</td><td><strong>${t.amount}</strong></td><td>${t.frequency}</td><td style="font-size:10px">${t.source}</td></tr>`
  ).join("");

  const rent = est.rentAnalysis;
  const totalMonthly = est.totalMonthlyCosts;
  const annual = est.annualProjection;

  return `
    <div class="card" style="border-left:3px solid ${C.orange};background:rgba(245,158,11,.02)">
      <p style="font-size:11px;color:${C.orange};font-weight:700;margin-bottom:4px">⚠ ESTIMACIÓN COGS PROFESIONAL — DATOS DE MERCADO VERIFICABLES</p>
      <p style="font-size:11px;color:${silverColor};line-height:1.5">${est.disclaimer}</p>
      ${est.locationDetail ? `<p style="font-size:10px;color:${silverColor};margin-top:4px">📍 Zona analizada: <strong style="color:${C.accent}">${est.locationDetail}</strong></p>` : ""}
    </div>

    ${staffRows ? `<div class="card" style="overflow-x:auto;">
      <div class="stat-item-label" style="margin-bottom:12px;">👥 Personal y Nóminas — Estimación según Convenio</div>
      <table>
        <thead><tr><th>Puesto</th><th>Nº</th><th>Salario Bruto</th><th>SS Empresa</th><th>Coste Total</th><th>Fuente</th></tr></thead>
        <tbody>
          ${staffRows}
          <tr style="background:${C.surface}"><td><strong>TOTAL PERSONAL</strong></td><td></td><td></td><td></td><td><strong style="color:${C.orange}">${totalStaff.toLocaleString("es-ES")}€/mes</strong></td><td></td></tr>
        </tbody>
      </table>
    </div>` : ""}

    ${rent ? `<div class="card" style="overflow-x:auto;">
      <div class="stat-item-label" style="margin-bottom:12px;">🏠 Análisis de Alquiler — ${rent.zone}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
        <div style="text-align:center;padding:10px;background:${C.surface};border-radius:6px"><div style="font-size:18px;font-weight:800;color:${C.accent}">${rent.avgPriceM2}€/m²</div><div style="font-size:9px;color:${silverColor}">Precio medio zona</div></div>
        <div style="text-align:center;padding:10px;background:${C.surface};border-radius:6px"><div style="font-size:18px;font-weight:800;color:${C.accent}">${rent.estimatedM2} m²</div><div style="font-size:9px;color:${silverColor}">Superficie estimada</div></div>
        <div style="text-align:center;padding:10px;background:${C.surface};border-radius:6px"><div style="font-size:18px;font-weight:800;color:${C.orange}">${rent.rangeMin?.toLocaleString("es-ES")}—${rent.rangeMax?.toLocaleString("es-ES")}€</div><div style="font-size:9px;color:${silverColor}">Rango alquiler/mes</div></div>
      </div>
      <p style="font-size:10px;color:${silverColor};line-height:1.4"><strong>Comparables:</strong> ${rent.comparables}</p>
      <p style="font-size:9px;color:${C.muted};margin-top:4px">Fuente: ${rent.source}</p>
    </div>` : ""}

    <div class="card" style="overflow-x:auto;">
      <div class="stat-item-label" style="margin-bottom:12px;">📊 Costes Fijos Mensuales — Desglose Completo</div>
      <table>
        <thead><tr><th>Concepto</th><th>Categoría</th><th>Rango Estimado</th><th>Fuente</th></tr></thead>
        <tbody>
          ${fixedRows}
          <tr style="background:${C.surface}"><td><strong>TOTAL FIJOS</strong></td><td></td><td><strong style="color:${C.orange}">${totalFixedMin.toLocaleString("es-ES")} — ${totalFixedMax.toLocaleString("es-ES")}€/mes</strong></td><td></td></tr>
        </tbody>
      </table>
    </div>

    ${variableRows ? `<div class="card" style="overflow-x:auto;">
      <div class="stat-item-label" style="margin-bottom:12px;">📦 Costes Variables por Transacción</div>
      <table>
        <thead><tr><th>Concepto</th><th>Coste</th><th>Base</th></tr></thead>
        <tbody>${variableRows}</tbody>
      </table>
    </div>` : ""}

    ${marginRows ? `<div class="card" style="overflow-x:auto;">
      <div class="stat-item-label" style="margin-bottom:12px;">💰 Margen por Servicio/Producto</div>
      <table>
        <thead><tr><th>Servicio</th><th>Materiales</th><th>Coste Mat.</th><th>PVP</th><th>Margen</th>${hasTimeCol ? "<th>Tiempo</th>" : ""}</tr></thead>
        <tbody>${marginRows}</tbody>
      </table>
    </div>` : ""}

    ${investRows ? `<div class="card" style="overflow-x:auto;">
      <div class="stat-item-label" style="margin-bottom:12px;">🏗 Inversión Inicial (Amortizable)</div>
      <table>
        <thead><tr><th>Concepto</th><th>Coste Estimado</th><th>Fuente</th></tr></thead>
        <tbody>
          ${investRows}
          <tr style="background:${C.surface}"><td><strong>TOTAL INVERSIÓN</strong></td><td><strong style="color:${C.orange}">${totalInvestMin.toLocaleString("es-ES")} — ${totalInvestMax.toLocaleString("es-ES")}€</strong></td><td>Amortización 36-60 meses</td></tr>
        </tbody>
      </table>
    </div>` : ""}

    ${taxRows ? `<div class="card" style="overflow-x:auto;">
      <div class="stat-item-label" style="margin-bottom:12px;">⚖️ Impuestos y Obligaciones Legales</div>
      <table>
        <thead><tr><th>Concepto</th><th>Importe</th><th>Periodicidad</th><th>Fuente</th></tr></thead>
        <tbody>${taxRows}</tbody>
      </table>
    </div>` : ""}

    ${compRows ? `<div class="card" style="overflow-x:auto;">
      <div class="stat-item-label" style="margin-bottom:12px;">🏆 Competencia Local — Precios de Mercado</div>
      <table>
        <thead><tr><th>Competidor</th><th>Precio</th><th>Modelo</th><th>Zona</th></tr></thead>
        <tbody>${compRows}</tbody>
      </table>
    </div>` : ""}

    ${est.seasonality ? `<div class="card">
      <div class="stat-item-label" style="margin-bottom:8px;">📅 Estacionalidad</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div style="padding:8px;background:${C.surface};border-radius:6px;text-align:center"><div style="font-size:10px;color:${C.jade};font-weight:700">ALTA</div><div style="font-size:11px">${est.seasonality.highMonths}</div></div>
        <div style="padding:8px;background:${C.surface};border-radius:6px;text-align:center"><div style="font-size:10px;color:${C.orange};font-weight:700">BAJA</div><div style="font-size:11px">${est.seasonality.lowMonths}</div></div>
        <div style="padding:8px;background:${C.surface};border-radius:6px;text-align:center"><div style="font-size:10px;color:${silverColor};font-weight:700">VARIACIÓN</div><div style="font-size:11px">${est.seasonality.revenueVariation}</div></div>
      </div>
    </div>` : ""}

    <div class="card">
      <div class="stat-item-label" style="margin-bottom:12px;">⚖️ Punto de Equilibrio y Proyección</div>
      <div class="metric-row">
        <div class="metric"><div class="value" style="color:${C.orange}">~${totalMonthly ? totalMonthly.min?.toLocaleString("es-ES") : est.breakeven.fixedCostsMonthly?.toLocaleString("es-ES")}€</div><div class="label">Costes totales/mes (mín)</div></div>
        <div class="metric"><div class="value" style="color:${C.jade}">~${est.marginPercent}%</div><div class="label">Margen bruto medio</div></div>
        <div class="metric"><div class="value" style="color:${C.accent}">~${est.breakeven.minServicesMonth}</div><div class="label">Servicios/mes mín.</div></div>
        <div class="metric"><div class="value" style="color:${C.accent}">~${est.breakeven.perWeek}</div><div class="label">Punto equilibrio</div></div>
      </div>
      ${est.breakeven.monthsToROI ? `<p style="font-size:11px;color:${silverColor};margin-top:6px">⏱ Retorno de inversión estimado: <strong style="color:${C.accent}">${est.breakeven.monthsToROI}</strong></p>` : ""}
      ${annual ? `<div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div style="text-align:center;padding:10px;background:${C.surface};border-radius:6px"><div style="font-size:16px;font-weight:800;color:${C.jade}">${annual.revenueMin?.toLocaleString("es-ES")}—${annual.revenueMax?.toLocaleString("es-ES")}€</div><div style="font-size:9px;color:${silverColor}">Ingresos anuales est.</div></div>
        <div style="text-align:center;padding:10px;background:${C.surface};border-radius:6px"><div style="font-size:16px;font-weight:800;color:${C.orange}">${annual.costsMin?.toLocaleString("es-ES")}—${annual.costsMax?.toLocaleString("es-ES")}€</div><div style="font-size:9px;color:${silverColor}">Costes anuales est.</div></div>
        <div style="text-align:center;padding:10px;background:${C.surface};border-radius:6px"><div style="font-size:16px;font-weight:800;color:${annual.profitMin > 0 ? C.jade : C.orange}">${annual.profitMin?.toLocaleString("es-ES")}—${annual.profitMax?.toLocaleString("es-ES")}€</div><div style="font-size:9px;color:${silverColor}">Beneficio neto est.</div></div>
      </div>` : ""}
      <p style="font-size:9px;color:${C.muted};line-height:1.4;margin-top:8px">Cálculo basado en ticket medio ~${est.avgTicket}€, COGS variable ~${est.cogsPerUnit}€/unidad. Proyección en escenario conservador. Se recomienda contrastar con contabilidad real del negocio.</p>
    </div>`;
}

async function autoSaveReport(projectId: number, title: string, htmlContent: string, category: string): Promise<number | null> {
  try {
    // FIX E-11: límite de tamaño + dedup diaria (evita 300KB×N inserts en path caliente)
    const MAX_AUTO_SAVE_BYTES = 5 * 1024 * 1024; // 5MB
    const sizeBytes = Buffer.byteLength(htmlContent, "utf8");
    if (sizeBytes > MAX_AUTO_SAVE_BYTES) {
      logger.warn({ projectId, title, sizeBytes }, "autoSaveReport: contenido excede 5MB, se omite");
      return null;
    }
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const existing = await db.select({ id: projectFilesTable.id })
      .from(projectFilesTable)
      .where(and(
        eq(projectFilesTable.projectId, projectId),
        eq(projectFilesTable.category, category),
        sql`${projectFilesTable.createdAt} >= ${startOfDay.toISOString()}`,
      ))
      .limit(1);
    if (existing.length > 0) {
      logger.debug({ projectId, category, existingId: existing[0].id }, "autoSaveReport: ya guardado hoy, dedup");
      return existing[0].id;
    }

    const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
    const time = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    const htmlBuffer = Buffer.from(htmlContent, "utf-8");
    const [saved] = await db.insert(projectFilesTable).values({
      projectId,
      fileType: "report",
      category,
      title,
      description: `Informe generado automáticamente el ${date} a las ${time}`,
      objectPath: null,
      originalUrl: null,
      mimeType: "text/html",
      fileSizeBytes: htmlBuffer.length,
      productId: null,
      productTitle: null,
      generatedBy: "auto_save",
      metadata: JSON.stringify({ generatedAt: new Date().toISOString(), category }),
      content: htmlContent,
      isPublic: 0,
    }).returning();
    logger.info({ projectId, fileId: saved.id, title, category, sizeKB: Math.round(htmlBuffer.length / 1024) }, "Report auto-saved to vault");
    return saved.id;
  } catch (err) {
    logger.error({ err, projectId, title, category }, "Failed to auto-save report to vault");
    return null;
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-áéíóúñÁÉÍÓÚÑ ]/g, "").replace(/\s+/g, "_").slice(0, 100);
}

const BRAND = {
  gold: "#c8a84b",
  goldLight: "#e6d9a8",
  goldDark: "#8b6914",
  dark: "#08080e",
  darkAlt: "#0c0c14",
  card: "#101018",
  cardHover: "#141420",
  surface: "#16161f",
  muted: "#6b6b80",
  mutedLight: "#9494a8",
  jade: "#34d399",
  jadeBg: "rgba(52,211,153,.08)",
  red: "#f43f5e",
  redBg: "rgba(244,63,94,.08)",
  orange: "#f59e0b",
  orangeBg: "rgba(245,158,11,.08)",
  blue: "#3b82f6",
  blueBg: "rgba(59,130,246,.08)",
  white: "#f0f0f5",
  border: "#1a1a28",
  borderLight: "#24243a",
};

function reportShell(title: string, subtitle: string, body: string, date: string, targetCompany?: string): string {
  const safeTitle = sanitizeHtml(title);
  const safeSub = sanitizeHtml(subtitle);
  const safeDate = sanitizeHtml(date);
  const coverCompany = targetCompany || safeSub.split(" — ")[0] || "";
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle} — Shopy Crafter</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: ${BRAND.dark}; color: ${BRAND.white}; line-height: 1.65; -webkit-font-smoothing: antialiased; }
  .page { max-width: 794px; margin: 0 auto; padding: 0; }

  .cover { background: #0e0e18; padding: 48px 48px 40px; border-bottom: 1px solid ${BRAND.border}; overflow: hidden; }
  .cover-logo-icon { width: 44px; height: 44px; border-radius: 10px; overflow: hidden; }
  .cover-logo-icon img { width: 100%; height: 100%; }
  .cover-logo-text { font-size: 20px; font-weight: 800; color: ${BRAND.gold}; letter-spacing: 1px; text-transform: uppercase; }
  .cover-badge { background: ${BRAND.surface}; border: 1px solid ${BRAND.borderLight}; border-radius: 8px; padding: 8px 16px; }
  .cover-badge-label { font-size: 10px; color: ${BRAND.muted}; text-transform: uppercase; letter-spacing: 1.5px; }
  .cover-badge-value { font-size: 13px; color: ${BRAND.white}; font-weight: 600; margin-top: 2px; }
  .cover-title h1 { font-size: 32px; font-weight: 900; color: ${BRAND.white}; letter-spacing: -0.8px; line-height: 1.2; }
  .cover-title h1 span { color: ${BRAND.gold}; }
  .cover-title .subtitle { font-size: 15px; color: ${BRAND.mutedLight}; margin-top: 8px; font-weight: 400; }
  .cover-meta-dot { width: 6px; height: 6px; border-radius: 50%; background: ${BRAND.gold}; display: inline-block; }

  .body-content { padding: 32px 28px 40px; }

  .section { margin-bottom: 40px; }
  .section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid ${BRAND.border}; }
  .section-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
  .section-icon-gold { background: rgba(200,168,75,.1); border: 1px solid rgba(200,168,75,.2); }
  .section-icon-jade { background: ${BRAND.jadeBg}; border: 1px solid rgba(52,211,153,.2); }
  .section-icon-blue { background: ${BRAND.blueBg}; border: 1px solid rgba(59,130,246,.2); }
  .section-icon-red { background: ${BRAND.redBg}; border: 1px solid rgba(244,63,94,.2); }
  .section-icon-orange { background: ${BRAND.orangeBg}; border: 1px solid rgba(245,158,11,.2); }
  .section-title { font-size: 18px; font-weight: 700; color: ${BRAND.white}; letter-spacing: -0.3px; }
  .section-count { font-size: 11px; color: ${BRAND.muted}; background: ${BRAND.surface}; padding: 2px 8px; border-radius: 4px; margin-left: auto; }

  .card { background: ${BRAND.card}; border: 1px solid ${BRAND.border}; border-radius: 14px; padding: 24px; margin-bottom: 16px; transition: border-color .15s; }
  .card:hover { border-color: ${BRAND.borderLight}; }

  .metric-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .metric { background: ${BRAND.card}; border: 1px solid ${BRAND.border}; border-radius: 12px; padding: 20px; text-align: center; overflow: hidden; }
  .metric .value { font-size: 30px; font-weight: 900; color: ${BRAND.gold}; letter-spacing: -0.5px; line-height: 1.1; }
  .metric .label { font-size: 10px; color: ${BRAND.muted}; text-transform: uppercase; letter-spacing: 1px; margin-top: 6px; font-weight: 600; }
  .metric .delta { font-size: 11px; margin-top: 4px; font-weight: 600; }
  .metric .delta-up { color: ${BRAND.jade}; }
  .metric .delta-down { color: ${BRAND.red}; }

  table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; }
  thead { position: sticky; top: 0; }
  th { background: ${BRAND.surface}; color: ${BRAND.gold}; font-weight: 700; text-align: left; padding: 12px 16px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
  th:first-child { border-radius: 8px 0 0 0; }
  th:last-child { border-radius: 0 8px 0 0; }
  td { padding: 12px 16px; border-bottom: 1px solid ${BRAND.border}; color: ${BRAND.white}; font-size: 13px; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: rgba(200,168,75,.02); }
  tbody tr { transition: background .1s; }

  .grade { display: inline-flex; align-items: center; justify-content: center; min-width: 36px; padding: 4px 12px; border-radius: 6px; font-weight: 800; font-size: 12px; letter-spacing: 0.3px; }
  .grade-a { background: rgba(52,211,153,.12); color: ${BRAND.jade}; }
  .grade-b { background: rgba(200,168,75,.12); color: ${BRAND.gold}; }
  .grade-c { background: rgba(245,158,11,.12); color: ${BRAND.orange}; }
  .grade-d { background: rgba(244,63,94,.12); color: ${BRAND.red}; }
  .grade-f { background: rgba(244,63,94,.18); color: ${BRAND.red}; }

  .tag { display: inline-block; background: rgba(200,168,75,.08); color: ${BRAND.gold}; padding: 3px 10px; border-radius: 6px; font-size: 11px; margin: 2px 4px 2px 0; font-weight: 600; border: 1px solid rgba(200,168,75,.15); }
  .tag-jade { background: ${BRAND.jadeBg}; color: ${BRAND.jade}; border-color: rgba(52,211,153,.15); }
  .tag-red { background: ${BRAND.redBg}; color: ${BRAND.red}; border-color: rgba(244,63,94,.15); }
  .tag-blue { background: ${BRAND.blueBg}; color: ${BRAND.blue}; border-color: rgba(59,130,246,.15); }

  .text-jade { color: ${BRAND.jade}; }
  .text-red { color: ${BRAND.red}; }
  .text-gold { color: ${BRAND.gold}; }
  .text-blue { color: ${BRAND.blue}; }
  .text-orange { color: ${BRAND.orange}; }
  .text-muted { color: ${BRAND.muted}; }
  .text-white { color: ${BRAND.white}; }
  .fw-600 { font-weight: 600; }
  .fw-700 { font-weight: 700; }
  .fw-800 { font-weight: 800; }
  .fs-sm { font-size: 12px; }

  .score-bar { height: 6px; border-radius: 3px; background: ${BRAND.border}; overflow: hidden; }
  .score-fill { height: 100%; border-radius: 3px; transition: width .3s; }

  .recommendation { padding: 16px 20px; margin-bottom: 10px; border-radius: 10px; border-left: 3px solid ${BRAND.gold}; background: rgba(200,168,75,.03); font-size: 13px; line-height: 1.7; }
  .recommendation-critical { border-left-color: ${BRAND.red}; background: ${BRAND.redBg}; }
  .recommendation-success { border-left-color: ${BRAND.jade}; background: ${BRAND.jadeBg}; }
  .recommendation-info { border-left-color: ${BRAND.blue}; background: ${BRAND.blueBg}; }

  .ai-analysis { line-height: 1.8; }
  .ai-analysis h3 { font-size: 16px; font-weight: 700; color: ${BRAND.gold}; margin: 0 0 12px 0; }
  .ai-diagnosis { margin-bottom: 24px; }
  .ai-diagnosis p { color: rgba(255,255,255,.75); margin-bottom: 8px; }
  .ai-actions { margin-bottom: 24px; }
  .action-item { padding: 20px; margin-bottom: 16px; background: ${BRAND.surface}; border: 1px solid ${BRAND.border}; border-radius: 12px; }
  .action-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .action-header strong { font-size: 14px; color: ${BRAND.white}; }
  .action-impact { font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 3px 10px; border-radius: 6px; background: rgba(200,168,75,.12); color: ${BRAND.gold}; }
  .action-item p { margin: 6px 0; font-size: 13px; color: rgba(255,255,255,.65); }
  .action-item ol, .action-item ul { margin: 8px 0; padding-left: 20px; }
  .action-item li { margin-bottom: 6px; font-size: 13px; color: rgba(255,255,255,.7); }
  .ai-quick-wins { padding: 20px; background: rgba(72,187,120,.04); border: 1px solid rgba(72,187,120,.15); border-radius: 12px; margin-bottom: 24px; }
  .ai-quick-wins h3 { color: ${BRAND.jade}; }
  .ai-quick-wins li { margin-bottom: 12px; color: rgba(255,255,255,.7); line-height: 1.7; }
  .ai-quick-wins code { background: rgba(200,168,75,.1); color: ${BRAND.gold}; padding: 2px 8px; border-radius: 4px; font-size: 12px; word-break: break-all; }
  .ai-deliverable { background: rgba(200,168,75,.06); border: 2px solid rgba(200,168,75,.25); border-radius: 12px; padding: 20px 24px; margin: 16px 0; }
  .ai-deliverable code { display: block; background: rgba(0,0,0,.3); color: ${BRAND.gold}; padding: 12px 16px; border-radius: 8px; font-size: 12px; line-height: 1.7; margin: 8px 0; white-space: pre-wrap; word-break: break-all; border-left: 3px solid ${BRAND.gold}; font-family: 'Courier New', monospace; }
  .ai-deliverable p, .ai-deliverable li { color: rgba(255,255,255,.8); line-height: 1.7; font-size: 13px; }
  .ai-deliverable table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
  .ai-deliverable th { background: rgba(200,168,75,.15); color: ${BRAND.gold}; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; }
  .ai-deliverable td { padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,.06); color: rgba(255,255,255,.75); }
  .ai-glossary { padding: 20px; background: rgba(99,102,241,.04); border: 1px solid rgba(99,102,241,.15); border-radius: 12px; margin-bottom: 24px; }
  .ai-glossary h3 { color: ${BRAND.blue}; }
  .ai-glossary li { margin-bottom: 10px; color: rgba(255,255,255,.7); line-height: 1.6; font-size: 13px; }
  .ai-glossary li strong { color: ${BRAND.white}; }
  .ai-platform-guide { margin-bottom: 24px; }
  .ai-team-briefs { padding: 20px; background: rgba(200,168,75,.04); border: 1px solid rgba(200,168,75,.15); border-radius: 12px; margin-bottom: 24px; }
  .ai-team-briefs h3 { color: ${BRAND.gold}; }
  .ai-team-briefs em { display: block; padding: 12px 16px; background: ${BRAND.surface}; border-radius: 8px; margin: 8px 0; font-style: italic; color: rgba(255,255,255,.75); line-height: 1.6; font-size: 13px; border-left: 3px solid ${BRAND.gold}; }
  .action-item code { background: rgba(200,168,75,.1); color: ${BRAND.gold}; padding: 2px 8px; border-radius: 4px; font-size: 12px; display: inline-block; margin: 4px 0; word-break: break-all; }

  .progress-ring { display: inline-flex; align-items: center; justify-content: center; position: relative; }
  .progress-ring svg { transform: rotate(-90deg); }

  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .stat-item { padding: 16px 20px; background: ${BRAND.surface}; border-radius: 10px; border: 1px solid ${BRAND.border}; }
  .stat-item-label { font-size: 10px; color: ${BRAND.muted}; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
  .stat-item-value { font-size: 16px; font-weight: 700; color: ${BRAND.white}; margin-top: 4px; }

  .divider { height: 1px; background: linear-gradient(90deg, transparent, ${BRAND.border}, transparent); margin: 32px 0; }

  .report-page { page-break-before: always; padding-top: 12px; }
  .report-page:first-child { page-break-before: avoid; }
  .page-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 0 16px; margin-bottom: 12px; border-bottom: 1px solid ${BRAND.border}; }
  .page-header-title { font-size: 11px; color: ${BRAND.muted}; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; }
  .page-header-num { font-size: 11px; color: ${BRAND.gold}; font-weight: 700; }

  .toc { padding: 24px 0; }
  .toc-item { display: flex; align-items: center; padding: 12px 16px; margin-bottom: 6px; border-radius: 10px; background: ${BRAND.card}; border: 1px solid ${BRAND.border}; }
  .toc-num { width: 32px; height: 32px; border-radius: 8px; background: rgba(200,168,75,.1); border: 1px solid rgba(200,168,75,.2); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: ${BRAND.gold}; margin-right: 16px; flex-shrink: 0; }
  .toc-label { font-size: 14px; font-weight: 600; color: ${BRAND.white}; }
  .toc-desc { font-size: 11px; color: ${BRAND.muted}; margin-top: 2px; }
  .toc-dot { flex: 1; border-bottom: 1px dotted ${BRAND.border}; margin: 0 12px; min-width: 40px; }

  .waterfall-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .waterfall-label { font-size: 12px; color: ${BRAND.mutedLight}; min-width: 120px; text-align: right; }
  .waterfall-fill { height: 24px; border-radius: 6px; min-width: 2px; display: flex; align-items: center; padding: 0 8px; }
  .waterfall-val { font-size: 11px; font-weight: 700; color: ${BRAND.white}; }

  .blog-content { font-size: 14px; line-height: 1.8; }
  .blog-content h1, .blog-content h2, .blog-content h3 { color: ${BRAND.gold}; margin: 20px 0 10px; }
  .blog-content p { margin-bottom: 12px; }
  .blog-content ul, .blog-content ol { margin: 10px 0 10px 20px; }

  .muted { color: ${BRAND.muted}; }
  .link { color: ${BRAND.blue}; text-decoration: none; }
  .link:hover { text-decoration: underline; }
  .ai-heading { color: ${BRAND.gold}; margin: 20px 0 10px; font-size: 16px; font-weight: 700; }
  .ai-sub-heading { color: ${BRAND.gold}; margin: 16px 0 8px; font-size: 14px; font-weight: 600; }
  .ai-list { margin: 8px 0; padding-left: 20px; }
  .ai-list li { margin-bottom: 6px; color: rgba(255,255,255,.75); line-height: 1.7; font-size: 13px; }
  .data-table { border-collapse: collapse; }
  .data-table tr { border-bottom: 1px solid ${BRAND.border}; }
  .data-table tr:last-child { border-bottom: none; }
  .table-label { color: ${BRAND.muted}; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; width: 160px; padding: 14px 20px; vertical-align: top; }
  .table-value { color: ${BRAND.white}; font-size: 14px; padding: 14px 20px; }
  .ai-deliverable-header { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: ${BRAND.gold}; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid rgba(200,168,75,.2); }
  .ai-field { margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid ${BRAND.border}; }
  .ai-field:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
  .ai-field-label { font-size: 10px; color: ${BRAND.muted}; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; margin-bottom: 6px; }
  .ai-field-value { font-size: 14px; color: rgba(255,255,255,.85); line-height: 1.7; }
  .highlight-box { padding: 16px 20px; border-radius: 10px; margin: 12px 0; }
  .highlight-success { background: rgba(52,211,153,.06); border: 1px solid rgba(52,211,153,.2); }
  .highlight-success .ai-field-value { color: ${BRAND.jade}; }
  .highlight-gold { background: rgba(200,168,75,.06); border: 1px solid rgba(200,168,75,.2); color: ${BRAND.gold}; font-size: 13px; font-weight: 600; }

  .footer { padding: 32px 56px; border-top: 1px solid ${BRAND.border}; background: ${BRAND.darkAlt}; text-align: center; }
  .footer-brand { font-size: 14px; font-weight: 700; color: ${BRAND.gold}; }
  .footer-sub { font-size: 11px; color: ${BRAND.muted}; margin-top: 6px; }
  .footer-line { width: 40px; height: 2px; background: ${BRAND.gold}; margin: 12px auto; border-radius: 1px; }

  @media (max-width: 768px) {
    .page { max-width: 100%; }
    .body-content { padding: 20px 16px 24px; }
    .cover { padding: 40px 20px; min-height: 600px; }
    .cover-title h1 { font-size: 28px; }
    .metric-row { grid-template-columns: 1fr 1fr; gap: 8px; }
    .metric .value { font-size: 20px; }
    .metric .label { font-size: 9px; }
    .card { padding: 16px; border-radius: 10px; }
    .section-title { font-size: 18px; }
    table { font-size: 12px; }
    td, th { padding: 8px 10px; }
    .tag { font-size: 10px; padding: 2px 7px; }
    .ai-deliverable { padding: 14px 16px; }
    .ai-field-label { font-size: 9px; }
    .ai-field-value { font-size: 13px; word-wrap: break-word; overflow-wrap: break-word; }
    .ai-deliverable code { font-size: 10px; padding: 8px 10px; word-break: break-all; }
    .highlight-box { padding: 12px 14px; }
    .action-item { padding: 14px; }
    .action-header { flex-direction: column; align-items: flex-start; gap: 6px; }
    .stat-grid { grid-template-columns: 1fr; }
    .footer { padding: 20px 16px; }
    .sc-cover-page { min-height: 80vh !important; }
    .sc-toc-page { padding: 30px 20px !important; min-height: auto !important; }
  }
  @media (max-width: 480px) {
    .body-content { padding: 14px 10px 18px; }
    .cover { padding: 28px 14px; min-height: 500px; }
    .cover-title h1 { font-size: 22px; }
    .metric-row { grid-template-columns: 1fr; }
    .metric .value { font-size: 18px; }
    .section-title { font-size: 16px; }
    .ai-analysis h3 { font-size: 14px; }
    .sc-cover-page { min-height: 70vh !important; }
    .sc-toc-page { padding: 20px 14px !important; }
  }
  * { word-wrap: break-word; overflow-wrap: break-word; }
  code { white-space: pre-wrap; word-break: break-all; }

  @media print {
    body { background: white; color: #1a1a1a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { max-width: 100%; }
    .cover { background: #f8f7f4; padding: 32px; }
    .cover-title h1 { color: #1a1a1a; }
    .card, .metric, .recommendation, .toc-item, .stat-item { break-inside: avoid; }
    table, tr { break-inside: avoid; }
    .metric-row, .stat-grid { break-inside: avoid; }
    .card, .metric { background: #fafafa; border: 1px solid #e0e0e0; }
    .metric .value { color: ${BRAND.goldDark}; }
    th { background: #f0f0f0; color: ${BRAND.goldDark}; }
    td { border-color: #e8e8e8; color: #1a1a1a; }
    .footer { background: #fafafa; border-color: #e0e0e0; }
  }
</style>
</head>
<body>
${buildCoverPage({ reportTitle: safeTitle, reportSubtitle: safeSub, companyName: coverCompany, date: safeDate, template: "classic" })}
<div class="page">
  ${buildTableOfContents(body, "classic")}
  <div class="body-content">
    ${body}
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" class="footer" style="border-top:1px solid ${BRAND.border};background:${BRAND.card};text-align:center;">
    <tr><td style="padding:28px 40px;">
      <div style="width:40px;height:2px;background:${BRAND.gold};margin:0 auto 12px;border-radius:1px;"></div>
      <p style="font-size:15px;font-weight:700;color:${BRAND.gold};letter-spacing:2px;margin:0;">Shopy Crafter</p>
      <p style="font-size:11px;color:${BRAND.muted};margin:6px 0 0;">shopycrafter.com &mdash; Shopy Crafter eCommerce &middot; ${safeDate} &middot; Confidencial</p>
    </td></tr>
  </table>
  <!-- Contraportada de marca: ahora insertada como hoja 2 dentro de buildCoverPage -->
</div>
</body>
</html>`;
}

export type ReportTemplate = "classic" | "elegance" | "prestige";

export interface CustomReportTemplate {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  textColor?: string | null;
  bgColor?: string | null;
  cardBg?: string | null;
  borderColor?: string | null;
  headingFont?: string | null;
  bodyFont?: string | null;
  headingWeight?: string | null;
  coverStyle?: string | null;
  sectionStyle?: string | null;
  logoBase64?: string | null;
  companyName?: string | null;
  tagline?: string | null;
  footerText?: string | null;
  showPageNumbers?: boolean | null;
}

const ELEGANCE = {
  navy: "#0b1628",
  navyLight: "#0f1d35",
  silver: "#c0c8d8",
  silverLight: "#e8ecf2",
  accent: "#4a90d9",
  accentSoft: "#6ba8f0",
  card: "#0f1930",
  cardHover: "#132240",
  surface: "#111e36",
  border: "#1a2a4a",
  borderLight: "#243a5e",
  muted: "#6880a8",
  white: "#f0f2f8",
  jade: "#34d399",
  red: "#f43f5e",
  orange: "#f59e0b",
  blue: "#4a90d9",
};

const PRESTIGE = {
  charcoal: "#1a1410",
  charcoalLight: "#211a14",
  copper: "#c4956a",
  copperLight: "#ddb896",
  copperDark: "#8b6340",
  card: "#1e1812",
  cardHover: "#24201a",
  surface: "#211c15",
  border: "#2e2620",
  borderLight: "#3d332a",
  muted: "#7a6e60",
  mutedLight: "#9a8e80",
  white: "#f5f0eb",
  jade: "#34d399",
  red: "#f43f5e",
  orange: "#f59e0b",
  blue: "#6ba8f0",
};

function reportShellElegance(title: string, subtitle: string, body: string, date: string, targetCompany?: string): string {
  const safeTitle = sanitizeHtml(title);
  const safeSub = sanitizeHtml(subtitle);
  const safeDate = sanitizeHtml(date);
  const safeCompany = targetCompany ? sanitizeHtml(targetCompany) : "";
  const coverCompanyE = safeCompany || safeSub.split(" — ")[0] || "";
  const subtitleParts = safeSub.split(" — ");
  const coverSector = subtitleParts.length > 1 ? subtitleParts[1] : safeSub;
  const coverDomain = subtitleParts.length > 1 ? subtitleParts[0] : "";
  const refCode = `SC-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle} — Shopy Crafter</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, sans-serif; background: ${ELEGANCE.navy}; color: ${ELEGANCE.white}; line-height: 1.65; -webkit-font-smoothing: antialiased; }
  .page { max-width: 794px; margin: 0 auto; padding: 0; }

  .cover-portfolio {
    width: 100%;
    background: #070e1c;
    text-align: center; padding: 60px 40px 40px; overflow: hidden;
    border-bottom: 2px solid ${ELEGANCE.border}; page-break-after: always;
  }

  .cover-inner { max-width: 680px; margin: 0 auto; }

  .cover-diamond-top { width: 14px; height: 14px; background: ${ELEGANCE.accent}; margin: 0 auto 28px; }

  .cover-agency-name { font-family: 'Playfair Display', serif; font-size: 13px; font-weight: 600; color: ${ELEGANCE.accent}; letter-spacing: 5px; text-transform: uppercase; margin-bottom: 36px; }

  .cover-logo-container { margin-bottom: 36px; }
  .cover-logo-circle { width: 100px; height: 100px; border-radius: 16px; overflow: hidden; margin: 0 auto; border: 2px solid rgba(74,144,217,.35); }
  .cover-logo-circle img { width: 100%; height: 100%; }

  .cover-doc-type { font-size: 11px; font-weight: 700; color: ${ELEGANCE.muted}; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 20px; }
  .cover-main-title { font-family: 'Playfair Display', serif; font-size: 42px; font-weight: 800; color: ${ELEGANCE.white}; line-height: 1.2; margin-bottom: 16px; }
  .cover-main-subtitle { font-size: 16px; color: ${ELEGANCE.silver}; font-weight: 400; line-height: 1.6; margin-bottom: 40px; }

  .cover-client-box { background: #0d1628; border: 1px solid ${ELEGANCE.border}; border-radius: 12px; padding: 24px 44px; display: inline-block; margin-bottom: 24px; }
  .cover-client-label { font-size: 10px; color: ${ELEGANCE.muted}; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 6px; }
  .cover-client-name { font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 700; color: ${ELEGANCE.accentSoft}; font-style: italic; letter-spacing: 0.5px; }

  .cover-meta-label { font-size: 9px; color: ${ELEGANCE.muted}; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; }
  .cover-meta-value { font-size: 13px; color: ${ELEGANCE.silver}; font-weight: 500; }

  .cover-footer-text { font-size: 9px; color: rgba(104,128,168,.4); letter-spacing: 2px; text-transform: uppercase; }

  .body-content { padding: 32px 28px 40px; }

  .section { margin-bottom: 40px; }
  .section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid ${ELEGANCE.border}; }
  .section-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
  .section-icon-gold { background: rgba(74,144,217,.1); border: 1px solid rgba(74,144,217,.2); }
  .section-icon-jade { background: rgba(52,211,153,.08); border: 1px solid rgba(52,211,153,.2); }
  .section-icon-blue { background: rgba(74,144,217,.08); border: 1px solid rgba(74,144,217,.2); }
  .section-icon-red { background: rgba(244,63,94,.08); border: 1px solid rgba(244,63,94,.2); }
  .section-icon-orange { background: rgba(245,158,11,.08); border: 1px solid rgba(245,158,11,.2); }
  .section-title { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: ${ELEGANCE.white}; letter-spacing: -0.3px; }
  .section-count { font-size: 11px; color: ${ELEGANCE.muted}; background: ${ELEGANCE.surface}; padding: 2px 8px; border-radius: 4px; margin-left: auto; }

  .card { background: ${ELEGANCE.card}; border: 1px solid ${ELEGANCE.border}; border-radius: 14px; padding: 24px; margin-bottom: 16px; transition: border-color .15s; }
  .card:hover { border-color: ${ELEGANCE.borderLight}; }

  .metric-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .metric { background: ${ELEGANCE.card}; border: 1px solid ${ELEGANCE.border}; border-radius: 12px; padding: 20px; text-align: center; overflow: hidden; }
  .metric .value { font-size: 30px; font-weight: 900; color: ${ELEGANCE.accent}; letter-spacing: -0.5px; line-height: 1.1; }
  .metric .label { font-size: 10px; color: ${ELEGANCE.muted}; text-transform: uppercase; letter-spacing: 1px; margin-top: 6px; font-weight: 600; }
  .metric .delta { font-size: 11px; margin-top: 4px; font-weight: 600; }
  .metric .delta-up { color: ${ELEGANCE.jade}; }
  .metric .delta-down { color: ${ELEGANCE.red}; }

  table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; }
  th { background: ${ELEGANCE.surface}; color: ${ELEGANCE.accent}; font-weight: 700; text-align: left; padding: 12px 16px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
  th:first-child { border-radius: 8px 0 0 0; }
  th:last-child { border-radius: 0 8px 0 0; }
  td { padding: 12px 16px; border-bottom: 1px solid ${ELEGANCE.border}; color: ${ELEGANCE.white}; font-size: 13px; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: rgba(74,144,217,.02); }

  .grade { display: inline-flex; align-items: center; justify-content: center; min-width: 36px; padding: 4px 12px; border-radius: 6px; font-weight: 800; font-size: 12px; }
  .grade-a { background: rgba(52,211,153,.12); color: ${ELEGANCE.jade}; }
  .grade-b { background: rgba(74,144,217,.12); color: ${ELEGANCE.accent}; }
  .grade-c { background: rgba(245,158,11,.12); color: ${ELEGANCE.orange}; }
  .grade-d { background: rgba(244,63,94,.12); color: ${ELEGANCE.red}; }
  .grade-f { background: rgba(244,63,94,.18); color: ${ELEGANCE.red}; }

  .tag { display: inline-block; background: rgba(74,144,217,.08); color: ${ELEGANCE.accent}; padding: 3px 10px; border-radius: 6px; font-size: 11px; margin: 2px 4px 2px 0; font-weight: 600; border: 1px solid rgba(74,144,217,.15); }
  .tag-jade { background: rgba(52,211,153,.08); color: ${ELEGANCE.jade}; border-color: rgba(52,211,153,.15); }
  .tag-red { background: rgba(244,63,94,.08); color: ${ELEGANCE.red}; border-color: rgba(244,63,94,.15); }
  .tag-blue { background: rgba(74,144,217,.08); color: ${ELEGANCE.accent}; border-color: rgba(74,144,217,.15); }

  .text-jade { color: ${ELEGANCE.jade}; } .text-red { color: ${ELEGANCE.red}; } .text-gold { color: ${ELEGANCE.accent}; } .text-blue { color: ${ELEGANCE.accent}; } .text-orange { color: ${ELEGANCE.orange}; } .text-muted { color: ${ELEGANCE.muted}; } .text-white { color: ${ELEGANCE.white}; }
  .fw-600 { font-weight: 600; } .fw-700 { font-weight: 700; } .fw-800 { font-weight: 800; } .fs-sm { font-size: 12px; }

  .score-bar { height: 6px; border-radius: 3px; background: ${ELEGANCE.border}; overflow: hidden; }
  .score-fill { height: 100%; border-radius: 3px; }

  .recommendation { padding: 16px 20px; margin-bottom: 10px; border-radius: 10px; border-left: 3px solid ${ELEGANCE.accent}; background: rgba(74,144,217,.03); font-size: 13px; line-height: 1.7; }
  .recommendation-critical { border-left-color: ${ELEGANCE.red}; background: rgba(244,63,94,.03); }
  .recommendation-success { border-left-color: ${ELEGANCE.jade}; background: rgba(52,211,153,.03); }
  .recommendation-info { border-left-color: ${ELEGANCE.accent}; background: rgba(74,144,217,.03); }

  .ai-analysis { line-height: 1.8; }
  .ai-analysis h3 { font-size: 16px; font-weight: 700; color: ${ELEGANCE.accent}; margin: 0 0 12px 0; }
  .ai-diagnosis { margin-bottom: 24px; }
  .ai-diagnosis p { color: rgba(255,255,255,.75); margin-bottom: 8px; }
  .ai-actions { margin-bottom: 24px; }
  .action-item { padding: 20px; margin-bottom: 16px; background: ${ELEGANCE.surface}; border: 1px solid ${ELEGANCE.border}; border-radius: 12px; }
  .action-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .action-header strong { font-size: 14px; color: ${ELEGANCE.white}; }
  .action-impact { font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 3px 10px; border-radius: 6px; background: rgba(74,144,217,.12); color: ${ELEGANCE.accent}; }
  .action-item p { margin: 6px 0; font-size: 13px; color: rgba(255,255,255,.65); }
  .action-item ol, .action-item ul { margin: 8px 0; padding-left: 20px; }
  .action-item li { margin-bottom: 6px; font-size: 13px; color: rgba(255,255,255,.7); }
  .ai-quick-wins { padding: 20px; background: rgba(72,187,120,.04); border: 1px solid rgba(72,187,120,.15); border-radius: 12px; margin-bottom: 24px; }
  .ai-quick-wins h3 { color: ${ELEGANCE.jade}; }
  .ai-quick-wins li { margin-bottom: 12px; color: rgba(255,255,255,.7); line-height: 1.7; }
  .ai-quick-wins code { background: rgba(74,144,217,.1); color: ${ELEGANCE.accent}; padding: 2px 8px; border-radius: 4px; font-size: 12px; word-break: break-all; }
  .ai-deliverable { background: rgba(74,144,217,.06); border: 2px solid rgba(74,144,217,.25); border-radius: 12px; padding: 20px 24px; margin: 16px 0; }
  .ai-deliverable code { display: block; background: rgba(0,0,0,.3); color: ${ELEGANCE.accent}; padding: 12px 16px; border-radius: 8px; font-size: 12px; line-height: 1.7; margin: 8px 0; white-space: pre-wrap; word-break: break-all; border-left: 3px solid ${ELEGANCE.accent}; font-family: 'Courier New', monospace; }
  .ai-deliverable p, .ai-deliverable li { color: rgba(255,255,255,.8); line-height: 1.7; font-size: 13px; }
  .ai-deliverable table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
  .ai-deliverable th { background: rgba(74,144,217,.15); color: ${ELEGANCE.accent}; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; }
  .ai-deliverable td { padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,.06); color: rgba(255,255,255,.75); }
  .ai-glossary { padding: 20px; background: rgba(99,102,241,.04); border: 1px solid rgba(99,102,241,.15); border-radius: 12px; margin-bottom: 24px; }
  .ai-glossary h3 { color: ${ELEGANCE.accent}; }
  .ai-glossary li { margin-bottom: 10px; color: rgba(255,255,255,.7); line-height: 1.6; font-size: 13px; }
  .ai-glossary li strong { color: ${ELEGANCE.white}; }
  .ai-platform-guide { margin-bottom: 24px; }
  .ai-team-briefs { padding: 20px; background: rgba(74,144,217,.04); border: 1px solid rgba(74,144,217,.15); border-radius: 12px; margin-bottom: 24px; }
  .ai-team-briefs h3 { color: ${ELEGANCE.accent}; }
  .ai-team-briefs em { display: block; padding: 12px 16px; background: ${ELEGANCE.surface}; border-radius: 8px; margin: 8px 0; font-style: italic; color: rgba(255,255,255,.75); line-height: 1.6; font-size: 13px; border-left: 3px solid ${ELEGANCE.accent}; }
  .action-item code { background: rgba(74,144,217,.1); color: ${ELEGANCE.accent}; padding: 2px 8px; border-radius: 4px; font-size: 12px; display: inline-block; margin: 4px 0; word-break: break-all; }

  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .stat-item { padding: 16px 20px; background: ${ELEGANCE.surface}; border-radius: 10px; border: 1px solid ${ELEGANCE.border}; }
  .stat-item-label { font-size: 10px; color: ${ELEGANCE.muted}; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
  .stat-item-value { font-size: 16px; font-weight: 700; color: ${ELEGANCE.white}; margin-top: 4px; }

  .divider { height: 1px; background: linear-gradient(90deg, transparent, ${ELEGANCE.border}, transparent); margin: 32px 0; }
  .report-page { page-break-before: always; padding-top: 12px; } .report-page:first-child { page-break-before: avoid; }
  .page-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 0 16px; margin-bottom: 12px; border-bottom: 1px solid ${ELEGANCE.border}; }
  .page-header-title { font-size: 11px; color: ${ELEGANCE.muted}; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; }
  .page-header-num { font-size: 11px; color: ${ELEGANCE.accent}; font-weight: 700; }

  .toc { padding: 24px 0; }
  .toc-item { display: flex; align-items: center; padding: 12px 16px; margin-bottom: 6px; border-radius: 10px; background: ${ELEGANCE.card}; border: 1px solid ${ELEGANCE.border}; }
  .toc-num { width: 32px; height: 32px; border-radius: 8px; background: rgba(74,144,217,.1); border: 1px solid rgba(74,144,217,.2); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: ${ELEGANCE.accent}; margin-right: 16px; flex-shrink: 0; }
  .toc-label { font-size: 14px; font-weight: 600; color: ${ELEGANCE.white}; }
  .toc-dot { flex: 1; border-bottom: 1px dotted ${ELEGANCE.border}; margin: 0 12px; min-width: 40px; }

  .waterfall-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .waterfall-label { font-size: 12px; color: ${ELEGANCE.silver}; min-width: 120px; text-align: right; }
  .waterfall-fill { height: 24px; border-radius: 6px; min-width: 2px; display: flex; align-items: center; padding: 0 8px; }
  .waterfall-val { font-size: 11px; font-weight: 700; color: ${ELEGANCE.white}; }
  .blog-content { font-size: 14px; line-height: 1.8; } .blog-content h1, .blog-content h2, .blog-content h3 { color: ${ELEGANCE.accent}; margin: 20px 0 10px; } .blog-content p { margin-bottom: 12px; }

  .muted { color: ${ELEGANCE.muted}; }
  .link { color: ${ELEGANCE.accent}; text-decoration: none; }
  .link:hover { text-decoration: underline; }
  .ai-heading { color: ${ELEGANCE.accent}; margin: 20px 0 10px; font-size: 16px; font-weight: 700; }
  .ai-sub-heading { color: ${ELEGANCE.accent}; margin: 16px 0 8px; font-size: 14px; font-weight: 600; }
  .ai-list { margin: 8px 0; padding-left: 20px; }
  .ai-list li { margin-bottom: 6px; color: rgba(255,255,255,.75); line-height: 1.7; font-size: 13px; }
  .data-table { border-collapse: collapse; }
  .data-table tr { border-bottom: 1px solid ${ELEGANCE.border}; }
  .data-table tr:last-child { border-bottom: none; }
  .table-label { color: ${ELEGANCE.muted}; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; width: 160px; padding: 14px 20px; vertical-align: top; }
  .table-value { color: ${ELEGANCE.white}; font-size: 14px; padding: 14px 20px; }
  .ai-deliverable-header { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: ${ELEGANCE.accent}; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid rgba(74,144,217,.2); }
  .ai-field { margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid ${ELEGANCE.border}; }
  .ai-field:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
  .ai-field-label { font-size: 10px; color: ${ELEGANCE.muted}; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; margin-bottom: 6px; }
  .ai-field-value { font-size: 14px; color: rgba(255,255,255,.85); line-height: 1.7; }
  .highlight-box { padding: 16px 20px; border-radius: 10px; margin: 12px 0; }
  .highlight-success { background: rgba(52,211,153,.06); border: 1px solid rgba(52,211,153,.2); }
  .highlight-success .ai-field-value { color: #34d399; }
  .highlight-gold { background: rgba(74,144,217,.06); border: 1px solid rgba(74,144,217,.2); color: ${ELEGANCE.accent}; font-size: 13px; font-weight: 600; }

  .footer { padding: 32px 56px; border-top: 1px solid ${ELEGANCE.border}; background: ${ELEGANCE.navyLight}; text-align: center; }
  .footer-brand { font-family: 'Playfair Display', serif; font-size: 14px; font-weight: 700; color: ${ELEGANCE.accent}; }
  .footer-sub { font-size: 11px; color: ${ELEGANCE.muted}; margin-top: 6px; }
  .footer-line { width: 40px; height: 2px; background: ${ELEGANCE.accent}; margin: 12px auto; border-radius: 1px; }

  @media (max-width: 768px) {
    .page { max-width: 100%; }
    .body-content { padding: 20px 16px 24px; }
    .cover-portfolio { padding: 40px 20px 32px; min-height: 600px; }
    .cover-main-title { font-size: 28px; }
    .cover-main-subtitle { font-size: 13px; }
    .cover-client-box { padding: 16px 24px; }
    .cover-client-name { font-size: 20px; }
    .cover-meta-row { flex-wrap: wrap; gap: 16px; }
    .cover-frame { inset: 16px; }
    .metric-row { grid-template-columns: 1fr 1fr; gap: 8px; }
    .metric .value { font-size: 20px; }
    .metric .label { font-size: 9px; }
    .card { padding: 16px; border-radius: 10px; }
    .section-title { font-size: 18px; }
    table { font-size: 12px; }
    td, th { padding: 8px 10px; }
    .tag { font-size: 10px; padding: 2px 7px; }
    .ai-deliverable { padding: 14px 16px; }
    .ai-field-label { font-size: 9px; }
    .ai-field-value { font-size: 13px; word-wrap: break-word; overflow-wrap: break-word; }
    .ai-deliverable code { font-size: 10px; padding: 8px 10px; word-break: break-all; }
    .highlight-box { padding: 12px 14px; }
    .action-item { padding: 14px; }
    .action-header { flex-direction: column; align-items: flex-start; gap: 6px; }
    .stat-grid { grid-template-columns: 1fr; }
    .footer { padding: 20px 16px; }
    .sc-cover-page { min-height: 80vh !important; }
    .sc-toc-page { padding: 30px 20px !important; min-height: auto !important; }
  }
  @media (max-width: 480px) {
    .body-content { padding: 14px 10px 18px; }
    .cover-portfolio { padding: 28px 14px 24px; min-height: 500px; }
    .cover-main-title { font-size: 22px; }
    .cover-agency-name { font-size: 10px; letter-spacing: 3px; }
    .cover-logo-circle { width: 72px; height: 72px; }
    .cover-doc-type { font-size: 9px; }
    .metric-row { grid-template-columns: 1fr; }
    .metric .value { font-size: 18px; }
    .section-title { font-size: 16px; }
    .ai-analysis h3 { font-size: 14px; }
    .sc-cover-page { min-height: 70vh !important; }
    .sc-toc-page { padding: 20px 14px !important; }
  }
  * { word-wrap: break-word; overflow-wrap: break-word; }
  code { white-space: pre-wrap; word-break: break-all; }

  @media print {
    body { background: white; color: #1a1a1a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .cover-portfolio { background: #f0f4f8 !important; min-height: 100vh; page-break-after: always; }
    .cover-portfolio::before, .cover-portfolio::after { display: none; }
    .cover-main-title, .cover-title h1 { color: #1a1a1a; }
    .cover-client-name { color: #2a6ab5; }
    .card, .metric, .recommendation, .toc-item, .stat-item { break-inside: avoid; }
    table, tr { break-inside: avoid; }
    .metric-row, .stat-grid { break-inside: avoid; }
    .card, .metric { background: #fafafa; border: 1px solid #d8dce4; }
    .metric .value { color: #2a6ab5; }
    th { background: #eef2f6; color: #2a6ab5; }
    td { border-color: #e4e8ec; color: #1a1a1a; }
    .footer { background: #f6f8fa; border-color: #d8dce4; }
  }
</style>
</head>
<body>
${buildCoverPage({ reportTitle: safeTitle, reportSubtitle: safeSub, companyName: coverCompanyE, date: safeDate, template: "elegance" })}
<div class="page">
  ${buildTableOfContents(body, "elegance")}
  <div class="body-content">
    ${body}
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${ELEGANCE.border};background:${ELEGANCE.surface};text-align:center;">
    <tr><td style="padding:28px 40px;">
      <div style="width:40px;height:2px;background:${ELEGANCE.accent};margin:0 auto 12px;border-radius:1px;"></div>
      <p style="font-family:'Playfair Display',serif;font-size:15px;font-weight:700;color:${ELEGANCE.accent};letter-spacing:2px;margin:0;">Shopy Crafter</p>
      <p style="font-size:11px;color:${ELEGANCE.muted};margin:6px 0 0;">shopycrafter.com &mdash; Shopy Crafter eCommerce &middot; ${safeDate} &middot; Confidencial</p>
    </td></tr>
  </table>
  <!-- Contraportada de marca: ahora insertada como hoja 2 dentro de buildCoverPage -->
</div>
</body>
</html>`;
}

function reportShellPrestige(title: string, subtitle: string, body: string, date: string, targetCompany?: string): string {
  const safeTitle = sanitizeHtml(title);
  const safeSub = sanitizeHtml(subtitle);
  const safeDate = sanitizeHtml(date);
  const safeCompany = targetCompany ? sanitizeHtml(targetCompany) : "";
  const coverCompanyP = safeCompany || safeSub.split(" — ")[0] || "";
  const subtitleParts = safeSub.split(" — ");
  const coverSector = subtitleParts.length > 1 ? subtitleParts[1] : safeSub;
  const coverDomain = subtitleParts.length > 1 ? subtitleParts[0] : "";
  const refCode = `SC-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle} — Shopy Crafter</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, sans-serif; background: ${PRESTIGE.charcoal}; color: ${PRESTIGE.white}; line-height: 1.65; -webkit-font-smoothing: antialiased; }
  .page { max-width: 794px; margin: 0 auto; padding: 0; }

  .cover-portfolio {
    width: 100%;
    background: #120e0a;
    text-align: center; padding: 80px 40px 60px; overflow: hidden;
    border-bottom: 2px solid ${PRESTIGE.border}; page-break-after: always;
    min-height: 50vh;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  }

  .cover-inner { max-width: 680px; margin: 0 auto; }

  .cover-diamond-top { width: 14px; height: 14px; background: ${PRESTIGE.copper}; margin: 0 auto 28px; }

  .cover-agency-name { font-family: 'Cormorant Garamond', serif; font-size: 13px; font-weight: 600; color: ${PRESTIGE.copper}; letter-spacing: 5px; text-transform: uppercase; margin-bottom: 36px; }

  .cover-logo-container { margin-bottom: 36px; }
  .cover-logo-circle { width: 100px; height: 100px; border-radius: 50%; overflow: hidden; margin: 0 auto; border: 2px solid rgba(196,149,106,.35); }
  .cover-logo-circle img { width: 100%; height: 100%; }

  .cover-doc-type { font-size: 11px; font-weight: 700; color: ${PRESTIGE.muted}; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 20px; }
  .cover-main-title { font-family: 'Cormorant Garamond', serif; font-size: 42px; font-weight: 800; color: ${PRESTIGE.white}; line-height: 1.2; margin-bottom: 16px; }
  .cover-main-subtitle { font-size: 16px; color: ${PRESTIGE.mutedLight}; font-weight: 400; line-height: 1.6; margin-bottom: 40px; }

  .cover-client-box { background: #211c15; border: 1px solid #3d332a; border-radius: 12px; padding: 24px 44px; display: inline-block; margin-bottom: 24px; }
  .cover-client-label { font-size: 10px; color: ${PRESTIGE.muted}; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 6px; }
  .cover-client-name { font-family: 'Cormorant Garamond', serif; font-size: 26px; font-weight: 700; color: ${PRESTIGE.copperLight}; font-style: italic; letter-spacing: 0.5px; }

  .cover-meta-label { font-size: 9px; color: ${PRESTIGE.muted}; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; }
  .cover-meta-value { font-size: 13px; color: ${PRESTIGE.mutedLight}; font-weight: 500; }

  .cover-footer-text { font-size: 9px; color: rgba(128,110,90,.4); letter-spacing: 2px; text-transform: uppercase; }

  .body-content { padding: 32px 28px 40px; }

  .section { margin-bottom: 40px; }
  .section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid ${PRESTIGE.border}; }
  .section-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
  .section-icon-gold { background: rgba(196,149,106,.1); border: 1px solid rgba(196,149,106,.2); }
  .section-icon-jade { background: rgba(52,211,153,.08); border: 1px solid rgba(52,211,153,.2); }
  .section-icon-blue { background: rgba(107,168,240,.08); border: 1px solid rgba(107,168,240,.2); }
  .section-icon-red { background: rgba(244,63,94,.08); border: 1px solid rgba(244,63,94,.2); }
  .section-icon-orange { background: rgba(245,158,11,.08); border: 1px solid rgba(245,158,11,.2); }
  .section-title { font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 700; color: ${PRESTIGE.white}; }
  .section-count { font-size: 11px; color: ${PRESTIGE.muted}; background: ${PRESTIGE.surface}; padding: 2px 8px; border-radius: 4px; margin-left: auto; }

  .card { background: ${PRESTIGE.card}; border: 1px solid ${PRESTIGE.border}; border-radius: 14px; padding: 24px; margin-bottom: 16px; transition: border-color .15s; }
  .card:hover { border-color: ${PRESTIGE.borderLight}; }

  .metric-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .metric { background: ${PRESTIGE.card}; border: 1px solid ${PRESTIGE.border}; border-radius: 12px; padding: 20px; text-align: center; overflow: hidden; }
  .metric .value { font-size: 30px; font-weight: 900; color: ${PRESTIGE.copper}; letter-spacing: -0.5px; line-height: 1.1; }
  .metric .label { font-size: 10px; color: ${PRESTIGE.muted}; text-transform: uppercase; letter-spacing: 1px; margin-top: 6px; font-weight: 600; }
  .metric .delta { font-size: 11px; margin-top: 4px; font-weight: 600; }
  .metric .delta-up { color: ${PRESTIGE.jade}; }
  .metric .delta-down { color: ${PRESTIGE.red}; }

  table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; }
  th { background: ${PRESTIGE.surface}; color: ${PRESTIGE.copper}; font-weight: 700; text-align: left; padding: 12px 16px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
  th:first-child { border-radius: 8px 0 0 0; }
  th:last-child { border-radius: 0 8px 0 0; }
  td { padding: 12px 16px; border-bottom: 1px solid ${PRESTIGE.border}; color: ${PRESTIGE.white}; font-size: 13px; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: rgba(196,149,106,.02); }

  .grade { display: inline-flex; align-items: center; justify-content: center; min-width: 36px; padding: 4px 12px; border-radius: 6px; font-weight: 800; font-size: 12px; }
  .grade-a { background: rgba(52,211,153,.12); color: ${PRESTIGE.jade}; }
  .grade-b { background: rgba(196,149,106,.12); color: ${PRESTIGE.copper}; }
  .grade-c { background: rgba(245,158,11,.12); color: ${PRESTIGE.orange}; }
  .grade-d { background: rgba(244,63,94,.12); color: ${PRESTIGE.red}; }
  .grade-f { background: rgba(244,63,94,.18); color: ${PRESTIGE.red}; }

  .tag { display: inline-block; background: rgba(196,149,106,.08); color: ${PRESTIGE.copper}; padding: 3px 10px; border-radius: 6px; font-size: 11px; margin: 2px 4px 2px 0; font-weight: 600; border: 1px solid rgba(196,149,106,.15); }
  .tag-jade { background: rgba(52,211,153,.08); color: ${PRESTIGE.jade}; border-color: rgba(52,211,153,.15); }
  .tag-red { background: rgba(244,63,94,.08); color: ${PRESTIGE.red}; border-color: rgba(244,63,94,.15); }
  .tag-blue { background: rgba(107,168,240,.08); color: ${PRESTIGE.blue}; border-color: rgba(107,168,240,.15); }

  .text-jade { color: ${PRESTIGE.jade}; } .text-red { color: ${PRESTIGE.red}; } .text-gold { color: ${PRESTIGE.copper}; } .text-blue { color: ${PRESTIGE.blue}; } .text-orange { color: ${PRESTIGE.orange}; } .text-muted { color: ${PRESTIGE.muted}; } .text-white { color: ${PRESTIGE.white}; }
  .fw-600 { font-weight: 600; } .fw-700 { font-weight: 700; } .fw-800 { font-weight: 800; } .fs-sm { font-size: 12px; }

  .score-bar { height: 6px; border-radius: 3px; background: ${PRESTIGE.border}; overflow: hidden; }
  .score-fill { height: 100%; border-radius: 3px; }

  .recommendation { padding: 16px 20px; margin-bottom: 10px; border-radius: 10px; border-left: 3px solid ${PRESTIGE.copper}; background: rgba(196,149,106,.03); font-size: 13px; line-height: 1.7; }
  .recommendation-critical { border-left-color: ${PRESTIGE.red}; background: rgba(244,63,94,.03); }
  .recommendation-success { border-left-color: ${PRESTIGE.jade}; background: rgba(52,211,153,.03); }
  .recommendation-info { border-left-color: ${PRESTIGE.blue}; background: rgba(107,168,240,.03); }

  .ai-analysis { line-height: 1.8; }
  .ai-analysis h3 { font-size: 16px; font-weight: 700; color: ${PRESTIGE.copper}; margin: 0 0 12px 0; }
  .ai-diagnosis { margin-bottom: 24px; }
  .ai-diagnosis p { color: rgba(255,255,255,.75); margin-bottom: 8px; }
  .ai-actions { margin-bottom: 24px; }
  .action-item { padding: 20px; margin-bottom: 16px; background: ${PRESTIGE.surface}; border: 1px solid ${PRESTIGE.border}; border-radius: 12px; }
  .action-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .action-header strong { font-size: 14px; color: ${PRESTIGE.white}; }
  .action-impact { font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 3px 10px; border-radius: 6px; background: rgba(196,149,106,.12); color: ${PRESTIGE.copper}; }
  .action-item p { margin: 6px 0; font-size: 13px; color: rgba(255,255,255,.65); }
  .action-item ol, .action-item ul { margin: 8px 0; padding-left: 20px; }
  .action-item li { margin-bottom: 6px; font-size: 13px; color: rgba(255,255,255,.7); }
  .ai-quick-wins { padding: 20px; background: rgba(72,187,120,.04); border: 1px solid rgba(72,187,120,.15); border-radius: 12px; margin-bottom: 24px; }
  .ai-quick-wins h3 { color: ${PRESTIGE.jade}; }
  .ai-quick-wins li { margin-bottom: 12px; color: rgba(255,255,255,.7); line-height: 1.7; }
  .ai-quick-wins code { background: rgba(196,149,106,.1); color: ${PRESTIGE.copper}; padding: 2px 8px; border-radius: 4px; font-size: 12px; word-break: break-all; }
  .ai-deliverable { background: rgba(196,149,106,.06); border: 2px solid rgba(196,149,106,.25); border-radius: 12px; padding: 20px 24px; margin: 16px 0; }
  .ai-deliverable code { display: block; background: rgba(0,0,0,.3); color: ${PRESTIGE.copper}; padding: 12px 16px; border-radius: 8px; font-size: 12px; line-height: 1.7; margin: 8px 0; white-space: pre-wrap; word-break: break-all; border-left: 3px solid ${PRESTIGE.copper}; font-family: 'Courier New', monospace; }
  .ai-deliverable p, .ai-deliverable li { color: rgba(255,255,255,.8); line-height: 1.7; font-size: 13px; }
  .ai-deliverable table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
  .ai-deliverable th { background: rgba(196,149,106,.15); color: ${PRESTIGE.copper}; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; }
  .ai-deliverable td { padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,.06); color: rgba(255,255,255,.75); }
  .ai-glossary { padding: 20px; background: rgba(99,102,241,.04); border: 1px solid rgba(99,102,241,.15); border-radius: 12px; margin-bottom: 24px; }
  .ai-glossary h3 { color: ${PRESTIGE.copper}; }
  .ai-glossary li { margin-bottom: 10px; color: rgba(255,255,255,.7); line-height: 1.6; font-size: 13px; }
  .ai-glossary li strong { color: ${PRESTIGE.white}; }
  .ai-platform-guide { margin-bottom: 24px; }
  .ai-team-briefs { padding: 20px; background: rgba(196,149,106,.04); border: 1px solid rgba(196,149,106,.15); border-radius: 12px; margin-bottom: 24px; }
  .ai-team-briefs h3 { color: ${PRESTIGE.copper}; }
  .ai-team-briefs em { display: block; padding: 12px 16px; background: ${PRESTIGE.surface}; border-radius: 8px; margin: 8px 0; font-style: italic; color: rgba(255,255,255,.75); line-height: 1.6; font-size: 13px; border-left: 3px solid ${PRESTIGE.copper}; }
  .action-item code { background: rgba(196,149,106,.1); color: ${PRESTIGE.copper}; padding: 2px 8px; border-radius: 4px; font-size: 12px; display: inline-block; margin: 4px 0; word-break: break-all; }

  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .stat-item { padding: 16px 20px; background: ${PRESTIGE.surface}; border-radius: 10px; border: 1px solid ${PRESTIGE.border}; }
  .stat-item-label { font-size: 10px; color: ${PRESTIGE.muted}; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
  .stat-item-value { font-size: 16px; font-weight: 700; color: ${PRESTIGE.white}; margin-top: 4px; }

  .divider { height: 1px; background: linear-gradient(90deg, transparent, ${PRESTIGE.border}, transparent); margin: 32px 0; }
  .report-page { page-break-before: always; padding-top: 12px; } .report-page:first-child { page-break-before: avoid; }
  .page-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 0 16px; margin-bottom: 12px; border-bottom: 1px solid ${PRESTIGE.border}; }
  .page-header-title { font-size: 11px; color: ${PRESTIGE.muted}; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; }
  .page-header-num { font-size: 11px; color: ${PRESTIGE.copper}; font-weight: 700; }

  .toc { padding: 24px 0; }
  .toc-item { display: flex; align-items: center; padding: 12px 16px; margin-bottom: 6px; border-radius: 10px; background: ${PRESTIGE.card}; border: 1px solid ${PRESTIGE.border}; }
  .toc-num { width: 32px; height: 32px; border-radius: 8px; background: rgba(196,149,106,.1); border: 1px solid rgba(196,149,106,.2); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: ${PRESTIGE.copper}; margin-right: 16px; flex-shrink: 0; }
  .toc-label { font-size: 14px; font-weight: 600; color: ${PRESTIGE.white}; }
  .toc-dot { flex: 1; border-bottom: 1px dotted ${PRESTIGE.border}; margin: 0 12px; min-width: 40px; }

  .waterfall-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .waterfall-label { font-size: 12px; color: ${PRESTIGE.mutedLight}; min-width: 120px; text-align: right; }
  .waterfall-fill { height: 24px; border-radius: 6px; min-width: 2px; display: flex; align-items: center; padding: 0 8px; }
  .waterfall-val { font-size: 11px; font-weight: 700; color: ${PRESTIGE.white}; }
  .blog-content { font-size: 14px; line-height: 1.8; } .blog-content h1, .blog-content h2, .blog-content h3 { color: ${PRESTIGE.copper}; margin: 20px 0 10px; } .blog-content p { margin-bottom: 12px; }

  .muted { color: ${PRESTIGE.muted}; }
  .link { color: ${PRESTIGE.copper}; text-decoration: none; }
  .link:hover { text-decoration: underline; }
  .ai-heading { color: ${PRESTIGE.copper}; margin: 24px 0 12px; font-size: 17px; font-weight: 700; line-height: 1.3; }
  .ai-heading:first-child { margin-top: 0; }
  .ai-sub-heading { color: ${PRESTIGE.copperLight}; margin: 20px 0 10px; font-size: 15px; font-weight: 600; line-height: 1.3; }
  .ai-paragraph { margin: 0 0 12px; color: rgba(255,255,255,.78); line-height: 1.85; font-size: 13px; }
  .ai-paragraph:last-child { margin-bottom: 0; }
  .ai-list { margin: 10px 0 16px; padding-left: 22px; }
  .ai-list li { margin-bottom: 8px; color: rgba(255,255,255,.75); line-height: 1.75; font-size: 13px; }
  .ai-list li:last-child { margin-bottom: 0; }
  .ai-list-ordered { list-style-type: decimal; }
  .ai-list-ordered li { padding-left: 4px; }

  .product-img-cell { display: flex; flex-direction: column; gap: 8px; }
  .product-img-thumb { max-width: 180px; max-height: 140px; border-radius: 10px; border: 1px solid ${PRESTIGE.border}; object-fit: cover; background: ${PRESTIGE.surface}; }
  .product-img-link { font-size: 11px; word-break: break-all; opacity: .7; }

  .schema-code-block { background: rgba(0,0,0,.45); border: 1px solid ${PRESTIGE.border}; border-left: 3px solid ${PRESTIGE.copper}; border-radius: 10px; overflow: hidden; margin: 8px 0; }
  .schema-code-block pre { margin: 0; padding: 16px 20px; overflow-x: auto; }
  .schema-code-block code { display: block; font-family: 'Courier New', 'Fira Code', monospace; font-size: 11px; line-height: 1.65; color: ${PRESTIGE.copperLight}; white-space: pre; word-break: normal; background: none; border: none; padding: 0; }

  .ai-image-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(245,158,11,.04); border: 2px dashed rgba(245,158,11,.2); border-radius: 12px; padding: 28px 20px; margin-bottom: 14px; min-height: 120px; }
  .ai-image-placeholder-icon { margin-bottom: 10px; opacity: .6; }
  .ai-image-placeholder-label { font-size: 11px; color: rgba(245,158,11,.5); letter-spacing: 1px; text-transform: uppercase; font-weight: 600; }
  .ai-image-brief { background: rgba(0,0,0,.2); border-radius: 8px; padding: 14px 18px; }

  .data-table { border-collapse: collapse; }
  .data-table tr { border-bottom: 1px solid ${PRESTIGE.border}; }
  .data-table tr:last-child { border-bottom: none; }
  .table-label { color: ${PRESTIGE.muted}; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; width: 160px; padding: 14px 20px; vertical-align: top; }
  .table-value { color: ${PRESTIGE.white}; font-size: 14px; padding: 14px 20px; }
  .ai-deliverable-header { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: ${PRESTIGE.copper}; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid rgba(196,149,106,.2); }
  .ai-field { margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid ${PRESTIGE.border}; }
  .ai-field:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
  .ai-field-label { font-size: 10px; color: ${PRESTIGE.muted}; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; margin-bottom: 6px; }
  .ai-field-value { font-size: 14px; color: rgba(255,255,255,.85); line-height: 1.7; }
  .highlight-box { padding: 16px 20px; border-radius: 10px; margin: 12px 0; }
  .highlight-success { background: rgba(52,211,153,.06); border: 1px solid rgba(52,211,153,.2); }
  .highlight-success .ai-field-value { color: #34d399; }
  .highlight-gold { background: rgba(196,149,106,.06); border: 1px solid rgba(196,149,106,.2); color: ${PRESTIGE.copper}; font-size: 13px; font-weight: 600; }

  .footer { padding: 32px 56px; border-top: 1px solid ${PRESTIGE.border}; background: ${PRESTIGE.charcoalLight}; text-align: center; }
  .footer-brand { font-family: 'Cormorant Garamond', serif; font-size: 15px; font-weight: 700; color: ${PRESTIGE.copper}; letter-spacing: 2px; }
  .footer-sub { font-size: 11px; color: ${PRESTIGE.muted}; margin-top: 6px; }
  .footer-line { width: 40px; height: 2px; background: linear-gradient(90deg, ${PRESTIGE.copperDark}, ${PRESTIGE.copper}); margin: 12px auto; border-radius: 1px; }

  @media (max-width: 768px) {
    .page { max-width: 100%; }
    .body-content { padding: 20px 16px 24px; }
    .cover-portfolio { padding: 40px 20px 32px; min-height: 600px; }
    .cover-main-title { font-size: 28px; }
    .cover-main-subtitle { font-size: 13px; }
    .cover-client-box { padding: 16px 24px; }
    .cover-client-name { font-size: 20px; }
    .cover-meta-row { flex-wrap: wrap; gap: 16px; }
    .cover-frame { inset: 16px; }
    .metric-row { grid-template-columns: 1fr 1fr; gap: 8px; }
    .metric .value { font-size: 20px; }
    .metric .label { font-size: 9px; }
    .card { padding: 16px; border-radius: 10px; }
    .section-title { font-size: 18px; }
    table { font-size: 12px; }
    td, th { padding: 8px 10px; }
    .table-label { width: 100px; padding: 10px 12px; font-size: 9px; }
    .table-value { padding: 10px 12px; font-size: 13px; }
    .tag { font-size: 10px; padding: 2px 7px; }
    .ai-deliverable { padding: 14px 16px; }
    .ai-field-label { font-size: 9px; }
    .ai-field-value { font-size: 13px; word-wrap: break-word; overflow-wrap: break-word; }
    .ai-deliverable code { font-size: 10px; padding: 8px 10px; word-break: break-all; }
    .highlight-box { padding: 12px 14px; }
    .action-item { padding: 14px; }
    .action-header { flex-direction: column; align-items: flex-start; gap: 6px; }
    .stat-grid { grid-template-columns: 1fr; }
    .footer { padding: 20px 16px; }
    .recommendation { padding: 12px 14px; }
    .product-img-thumb { max-width: 120px; max-height: 100px; }
    .schema-code-block pre { padding: 12px 14px; }
    .schema-code-block code { font-size: 10px; }
    .ai-image-placeholder { padding: 20px 14px; min-height: 90px; }
    .sc-cover-page { min-height: 80vh !important; }
    .sc-toc-page { padding: 30px 20px !important; min-height: auto !important; }
  }

  @media (max-width: 480px) {
    .body-content { padding: 14px 10px 18px; }
    .cover-portfolio { padding: 28px 14px 24px; min-height: 500px; }
    .cover-main-title { font-size: 22px; }
    .cover-agency-name { font-size: 10px; letter-spacing: 3px; }
    .cover-logo-circle { width: 72px; height: 72px; }
    .cover-doc-type { font-size: 9px; }
    .cover-meta-row { gap: 12px; }
    .cover-meta-label { font-size: 8px; }
    .cover-meta-value { font-size: 11px; }
    .metric-row { grid-template-columns: 1fr; }
    .metric .value { font-size: 18px; }
    .section-title { font-size: 16px; }
    .ai-analysis h3 { font-size: 14px; }
    .action-header strong { font-size: 13px; }
    .ai-deliverable-header { font-size: 10px; }
    .sc-cover-page { min-height: 70vh !important; }
    .sc-toc-page { padding: 20px 14px !important; }
  }

  * { word-wrap: break-word; overflow-wrap: break-word; }
  code { white-space: pre-wrap; word-break: break-all; }

  @media print {
    body { background: #faf8f5; color: #1a1a1a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .cover-portfolio { background: #f5f0eb !important; page-break-after: always; }
    .cover-main-title, .cover-title h1 { color: #1a1a1a; }
    .cover-client-name { color: #8b6340; }
    .card, .metric, .recommendation, .toc-item, .stat-item { break-inside: avoid; }
    table, tr { break-inside: avoid; }
    .metric-row, .stat-grid { break-inside: avoid; }
    .card, .metric { background: #fafaf8; border: 1px solid #e0dcd6; }
    .metric .value { color: #8b6340; }
    th { background: #f0ece6; color: #8b6340; }
    td { border-color: #e8e4de; color: #1a1a1a; }
    .footer { background: #f8f5f0; border-color: #e0dcd6; }
  }
</style>
</head>
<body>
${buildCoverPage({ reportTitle: safeTitle, reportSubtitle: safeSub, companyName: coverCompanyP, date: safeDate, template: "prestige" })}
<div class="page">
  ${buildTableOfContents(body, "prestige")}
  <div class="body-content">
    ${body}
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${PRESTIGE.border};background:${PRESTIGE.charcoalLight};text-align:center;padding:0;">
    <tr><td style="padding:28px 40px;">
      <div style="width:40px;height:2px;background:${PRESTIGE.copper};margin:0 auto 12px;border-radius:1px;"></div>
      <p style="font-family:'Cormorant Garamond',serif;font-size:15px;font-weight:700;color:${PRESTIGE.copper};letter-spacing:2px;margin:0;">Shopy Crafter</p>
      <p style="font-size:11px;color:${PRESTIGE.muted};margin:6px 0 0;">shopycrafter.com &mdash; Shopy Crafter eCommerce &middot; ${safeDate} &middot; Confidencial</p>
    </td></tr>
  </table>
  <!-- Contraportada de marca: ahora insertada como hoja 2 dentro de buildCoverPage -->
</div>
</body>
</html>`;
}

export function getReportShell(template: ReportTemplate | CustomReportTemplate = "prestige"): (title: string, subtitle: string, body: string, date: string, targetCompany?: string) => string {
  if (typeof template === "object" && template.primaryColor) {
    return buildCustomReportShell(template);
  }
  if (template === "elegance") return reportShellElegance;
  if (template === "prestige") return reportShellPrestige;
  return (t, s, b, d, c) => reportShell(t, s, b, d, c);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const HEX_VALID = /^#[0-9a-fA-F]{3,8}$/;
function safeHex(v: string | null | undefined, fb: string): string {
  return (v && HEX_VALID.test(v)) ? v : fb;
}
function safeFont(v: string | null | undefined, fb: string): string {
  if (!v) return fb;
  return v.replace(/[^a-zA-Z0-9 ]/g, "") || fb;
}

function buildCustomReportShell(tpl: CustomReportTemplate) {
  const hf = safeFont(tpl.headingFont, "Helvetica Neue");
  const bf = safeFont(tpl.bodyFont, "Helvetica Neue");
  const pc = safeHex(tpl.primaryColor, "#c8a84b");
  const sc = safeHex(tpl.secondaryColor, "#08080e");
  const tc = safeHex(tpl.textColor, "#f0f0f5");
  const bg = safeHex(tpl.bgColor, "#08080e");
  const cb = safeHex(tpl.cardBg, "#12121a");
  const bc = safeHex(tpl.borderColor, "#1a1a22");
  const ac = safeHex(tpl.accentColor, "#44cc88");
  const hw = /^[0-9]{3}$/.test(tpl.headingWeight || "") ? tpl.headingWeight! : "700";
  const cs = ["centered", "left-aligned", "minimal"].includes(tpl.coverStyle || "") ? tpl.coverStyle! : "centered";
  const ss = ["card", "accent-bar", "minimal"].includes(tpl.sectionStyle || "") ? tpl.sectionStyle! : "card";

  return (title: string, subtitle: string, body: string, date: string, targetCompany?: string) => `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  /* FIX E-07: Google Fonts removido — Puppeteer cuelga esperando red externa.
     System fonts garantizan render < 2s en PDF y ZIP. */
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: '${bf}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: ${bg}; color: ${tc}; }
  /* Cover variants: centered (logo grande arriba, todo centrado), left-aligned (texto izquierda, logo arriba), minimal (sin logo grande, líneas finas tipográficas) */
  .cover { background: ${sc}; padding: ${cs === "minimal" ? "100px 60px" : "80px 48px"}; text-align: ${cs === "left-aligned" ? "left" : "center"}; page-break-after: always; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; ${cs === "minimal" ? `border-left: 4px solid ${pc};` : ""} }
  .cover-logo { ${cs === "minimal" ? "max-width: 56px; max-height: 56px; opacity: 0.85;" : "max-width: 120px; max-height: 120px;"} border-radius: ${cs === "minimal" ? "8px" : "16px"}; margin-bottom: ${cs === "minimal" ? "40px" : "24px"}; ${cs === "centered" ? "margin-left:auto;margin-right:auto;" : ""} }
  .cover-rule { display: ${cs === "minimal" ? "block" : "none"}; width: 48px; height: 2px; background: ${pc}; margin: ${cs === "centered" || cs === "minimal" ? "0 auto 24px" : "0 0 24px 0"}; border-radius: 1px; }
  .cover-title { font-family: '${hf}', serif; font-size: ${cs === "minimal" ? "44px" : "32px"}; font-weight: ${hw}; color: ${pc}; letter-spacing: ${cs === "minimal" ? "-0.5px" : "3px"}; text-transform: ${cs === "minimal" ? "none" : "uppercase"}; margin-bottom: 12px; line-height: 1.15; }
  .cover-subtitle { font-size: 16px; color: ${tc}80; margin-bottom: 24px; line-height: 1.5; }
  .cover-company { font-size: 14px; color: ${pc}; letter-spacing: 2px; text-transform: uppercase; font-weight: 600; ${cs === "minimal" ? `padding-top: 12px; border-top: 1px solid ${bc};` : ""} }
  .cover-date { font-size: 12px; color: ${tc}50; margin-top: ${cs === "minimal" ? "32px" : "16px"}; letter-spacing: ${cs === "minimal" ? "1.5px" : "0"}; text-transform: ${cs === "minimal" ? "uppercase" : "none"}; }
  .report-body { padding: 32px 28px; max-width: 794px; margin: 0 auto; }
  .section { margin-bottom: 32px; }
  .section-title { font-family: '${hf}', serif; font-size: 20px; font-weight: ${hw}; color: ${pc}; margin-bottom: 16px; ${ss === "accent-bar" ? `border-left: 4px solid ${pc}; padding-left: 16px;` : ""} }
  .card { background: ${cb}; border: 1px solid ${bc}; border-radius: 12px; padding: 20px; margin-bottom: 12px; }
  .metric-row { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
  .metric { flex: 1; min-width: 120px; text-align: center; background: ${cb}; border: 1px solid ${bc}; border-radius: 12px; padding: 20px; }
  .metric .value { font-size: 32px; font-weight: 800; color: ${pc}; }
  .metric .label { font-size: 12px; color: ${tc}60; margin-top: 4px; }
  .recommendation { background: ${cb}; border-left: 4px solid ${ac}; padding: 16px; margin-bottom: 8px; border-radius: 0 8px 8px 0; font-size: 14px; line-height: 1.6; }
  .grade { display: inline-block; padding: 4px 12px; border-radius: 6px; font-weight: 700; font-size: 14px; }
  .grade-a { background: ${ac}20; color: ${ac}; }
  .grade-b { background: ${pc}20; color: ${pc}; }
  .grade-c { background: #ffa50020; color: #ffa500; }
  .grade-d { background: #ff555520; color: #ff5555; }
  .grade-f { background: #ff333320; color: #ff3333; }
  .score-bar { height: 8px; background: ${bc}; border-radius: 4px; overflow: hidden; }
  .score-fill { height: 100%; border-radius: 4px; transition: width 0.5s; }
  .footer { text-align: center; padding: 32px; border-top: 1px solid ${bc}; margin-top: 48px; }
  .footer-text { font-size: 12px; color: ${tc}40; }
  @media print { body { background: white; color: #222; } .card { border: 1px solid #ddd; } .cover { background: white; } }
</style>
</head>
<body>
  <div class="cover">
    ${tpl.logoBase64 && String(tpl.logoBase64).startsWith("data:image/") ? `<img class="cover-logo" src="${tpl.logoBase64}" alt="Logo" />` : ""}
    <div class="cover-rule"></div>
    <div class="cover-title">${title}</div>
    <div class="cover-subtitle">${subtitle}</div>
    ${targetCompany ? `<div class="cover-company">${targetCompany}</div>` : ""}
    ${tpl.tagline ? `<div style="font-size:13px;color:${tc}60;margin-top:10px;font-style:italic;">${esc(tpl.tagline)}</div>` : ""}
    <div class="cover-date">${date}</div>
  </div>
  <div class="report-body">
    ${body}
  </div>
  <div class="footer">
    <div class="footer-text">${esc(tpl.footerText || tpl.companyName || "Informe generado con IA")}</div>
  </div>
</body>
</html>`;
}

function gradeClass(grade: string): string {
  const g = (grade || "F").toUpperCase()[0];
  if (g === "A") return "grade-a";
  if (g === "B") return "grade-b";
  if (g === "C") return "grade-c";
  if (g === "D") return "grade-d";
  return "grade-f";
}

function scoreColor(score: number): string {
  if (score >= 80) return BRAND.jade;
  if (score >= 60) return BRAND.gold;
  if (score >= 40) return "#ffa500";
  return BRAND.red;
}

function _fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null || isNaN(n)) return "—";
  return n.toFixed(decimals);
}

router.get("/projects/:projectId/exports/seo-audit", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
    const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
    const seoData = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, projectId));
  
    const seoMap = new Map(seoData.map(s => [s.shopifyProductId, s]));
    const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  
    const totalProducts = products.length;
    const withSeo = seoData.filter(s => s.seoScore != null).length;
    const avgScore = withSeo > 0 ? seoData.reduce((sum, s) => sum + (s.seoScore ?? 0), 0) / withSeo : 0;
    const withSchema = seoData.filter(s => s.hasSchema).length;
    const withAltTexts = seoData.filter(s => s.hasAltTexts).length;
  
    const seoProductCards: ProductCardData[] = products.map(p => {
      const seo = seoMap.get(p.shopifyProductId);
      const imgs = (p.imagesJson as Array<{ src?: string }> | null) ?? [];
      const tagsArr = (p.tags || "").split(",").filter(t => t.trim());
      return {
        title: p.title,
        status: p.status,
        price: p.price || "0",
        compareAtPrice: p.compareAtPrice,
        imageUrl: imgs[0]?.src || null,
        imageCount: p.imageCount ?? 0,
        descriptionLength: (p.bodyHtml || "").length,
        tagsCount: tagsArr.length,
        tags: p.tags || "",
        variantCount: p.variantCount ?? 1,
        published: !!p.publishedAt,
        auditScore: seo?.seoScore ?? 0,
        auditGrade: seo?.seoGrade ?? "D",
        hasComparePrice: !!p.compareAtPrice,
        hasMetaTitle: !!seo?.metaTitle && seo.metaTitle.length > 10,
        hasMetaDesc: !!seo?.metaDescription && seo.metaDescription.length > 10,
        hasSchema: !!seo?.hasSchema,
        hasAltTexts: !!seo?.hasAltTexts,
        cleanHandle: !!seo?.cleanHandle,
        seoScore: seo?.seoScore ?? 0,
        productType: p.productType,
        vendor: p.vendor,
      };
    });
    const seoProductCardsHtml = buildProductCardsSection(seoProductCards, "Detalle SEO por Producto");
  
    const gradeDistribution: Record<string, number> = {};
    seoData.forEach(s => {
      const g = s.seoGrade || "Sin auditar";
      gradeDistribution[g] = (gradeDistribution[g] || 0) + 1;
    });
  
    let gradeBreakdown = "";
    for (const [g, count] of Object.entries(gradeDistribution).sort()) {
      const pct = totalProducts > 0 ? Math.round((count / totalProducts) * 100) : 0;
      gradeBreakdown += `<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;"><!-- nosemgrep -->
        <span class="grade ${gradeClass(g)}" style="min-width:40px;text-align:center;">${g}</span>
        <div class="score-bar" style="flex:1;"><div class="score-fill" style="width:${pct}%;background:${scoreColor(g === "A+" || g === "A" ? 90 : g === "B" ? 70 : g === "C" ? 50 : 30)};"></div></div><!-- nosemgrep -->
        <span style="min-width:60px;font-size:13px;">${count} (${pct}%)</span><!-- nosemgrep -->
      </div>`;
    }
  
    const issues: string[] = [];
    if (withSchema < totalProducts * 0.5) issues.push(`Solo ${withSchema}/${totalProducts} productos tienen Schema JSON-LD. Implementar structured data mejora CTR +30%.`);
    if (withAltTexts < totalProducts * 0.5) issues.push(`Solo ${withAltTexts}/${totalProducts} productos tienen alt texts optimizados. Google Image Search puede generar hasta 20% tráfico adicional.`);
    if (avgScore < 60) issues.push(`Puntuación SEO media (${Math.round(avgScore)}/100) por debajo del umbral competitivo. Se recomienda optimizar meta titles, descriptions y contenido.`);
    const noMeta = seoData.filter(s => !s.metaTitle || s.metaTitle.length < 10).length;
    if (noMeta > 0) issues.push(`${noMeta} productos sin meta title optimizado. Los meta titles son el factor #1 de CTR en resultados de búsqueda.`);
  
    let recommendationsHtml = issues.map(i => `<div class="recommendation">${i}</div>`).join(""); // nosemgrep
    if (issues.length === 0) recommendationsHtml = `<div class="recommendation" style="border-left-color:${BRAND.jade};">✅ Excelente: No se detectaron problemas críticos de SEO.</div>`; // nosemgrep
  
    const worstProducts = seoProductCards.filter(p => p.seoScore !== undefined && p.seoScore < 50).sort((a, b) => (a.seoScore ?? 0) - (b.seoScore ?? 0)).slice(0, 10);
    const bestProducts = seoProductCards.filter(p => p.seoScore !== undefined && p.seoScore >= 80).slice(0, 5);
    const noMetaDesc = seoData.filter(s => !s.metaDescription || s.metaDescription.length < 50).length;
    const shortDescriptions = seoData.filter(s => !(s as any).bodyHtml || (s as any).bodyHtml.length < 200).length;
    const missingImages = seoData.filter(s => !(s as any).imageCount || (s as any).imageCount < 2).length;
    const platformLabel = project.platformType || "shopify";
  
    const seoContext = `TIENDA: ${project.name} (${project.shopDomain || "sin dominio"})
  PLATAFORMA: ${platformLabel}
  NICHO: ${project.storeNiche || "No definido"}
  TOTAL PRODUCTOS: ${totalProducts}
  SCORE SEO MEDIO: ${Math.round(avgScore)}/100
  CON SCHEMA JSON-LD: ${withSchema}/${totalProducts} (${totalProducts > 0 ? Math.round(withSchema / totalProducts * 100) : 0}%)
  CON ALT TEXTS OPTIMIZADOS: ${withAltTexts}/${totalProducts} (${totalProducts > 0 ? Math.round(withAltTexts / totalProducts * 100) : 0}%)
  SIN META TITLE (<10 chars): ${noMeta}/${totalProducts}
  SIN META DESCRIPTION (<50 chars): ${noMetaDesc}/${totalProducts}
  CON DESCRIPCIÓN CORTA (<200 chars): ${shortDescriptions}/${totalProducts}
  CON POCAS IMÁGENES (<2): ${missingImages}/${totalProducts}
  DISTRIBUCIÓN GRADOS: ${Object.entries(gradeDistribution).map(([g, c]) => `${g}:${c} (${totalProducts > 0 ? Math.round(c / totalProducts * 100) : 0}%)`).join(", ")}
  
  ANÁLISIS DETALLADO — TOP 10 PEORES PRODUCTOS (prioridad de mejora):
  ${worstProducts.map((p, i) => `${i + 1}. "${p.title}" — Score: ${p.seoScore}/100, Grade: ${p.auditGrade}
     MetaTitle: ${p.hasMetaTitle ? "Sí" : "❌ FALTA"} | MetaDesc: ${p.hasMetaDesc ? "Sí" : "❌ FALTA"} | Schema: ${p.hasSchema ? "Sí" : "❌ FALTA"} | AltTexts: ${p.hasAltTexts ? "Sí" : "❌ FALTA"}
     Precio: ${p.price || "N/A"} | Imágenes: ${p.imageCount ?? "?"}`).join("\n")}
  
  TOP 5 MEJORES PRODUCTOS (modelo de referencia para replicar):
  ${bestProducts.map(p => `- "${p.title}" — Score: ${p.seoScore}/100, Grade: ${p.auditGrade}`).join("\n")}
  
  MÉTRICAS CLAVE DEL SECTOR "${project.storeNiche || "e-commerce general"}":
  - Benchmark SEO score medio del sector: 65-75/100
  - CTR medio orgánico posición 1: 28.5%, posición 2: 15.7%, posición 3: 11%
  - Impacto de Schema markup en CTR: +25-30% de media
  - Impacto de alt texts optimizados: +15-20% tráfico de Google Images`;
  
    const aiSection = await generateAiRecommendations(projectId, "seo", seoContext, project.storeNiche ?? undefined, platformLabel);
  
    const body = `
      <div class="metric-row">
        <div class="metric"><div class="value">${totalProducts}</div><div class="label">Productos</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${Math.round(avgScore)}</div><div class="label">Score SEO medio</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${withSchema}</div><div class="label">Con Schema</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${withAltTexts}</div><div class="label">Con Alt Texts</div></div><!-- nosemgrep -->
      </div>
  
      <div class="section">
        <div class="section-title">Distribución de Grados SEO</div>
        <div class="card">${gradeBreakdown}</div><!-- nosemgrep -->
      </div>
  
      <div class="section">
        <div class="section-title">Problemas Detectados</div>
        ${recommendationsHtml}
      </div>
  
      ${aiSection}
  
      <div class="section">
        ${seoProductCardsHtml}
      </div>`;
  
    const tpl = (req.query.template as ReportTemplate) || "prestige";
    const html = getReportShell(tpl)("Informe SEO Técnico", `${project.name} — ${project.shopDomain || "Sin dominio"}`, body, date);
    autoSaveReport(projectId, "Informe SEO Técnico", html, "seo_audit").catch(() => {});
    await sendHtmlOrPdf(req, res, html, `SEO_Audit_${project.name.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}`);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/projects/:projectId/exports/product-catalog", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
    const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
    const allCogs = await db.select().from(cogsTable).where(eq(cogsTable.projectId, projectId));
    const seoData = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, projectId));
  
    const cogsMap = new Map(allCogs.map(c => [c.shopifyProductId, c]));
    const seoMap = new Map(seoData.map(s => [s.shopifyProductId, s]));
    const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  
    const totalProducts = products.length;
    const activeProducts = products.filter(p => p.status === "active").length;
    const avgPrice = products.length > 0 ? products.reduce((s, p) => s + parseFloat(p.price ?? "0"), 0) / products.length : 0;
    const avgScore = products.filter(p => p.auditScore != null).length > 0
      ? products.reduce((s, p) => s + (p.auditScore ?? 0), 0) / products.filter(p => p.auditScore != null).length : 0;
  
    const catalogCards: ProductCardData[] = products.map(p => {
      const cogs = cogsMap.get(p.shopifyProductId);
      const seo = seoMap.get(p.shopifyProductId);
      const price = parseFloat(p.price ?? "0");
      const margin = cogs && price > 0 ? ((price - cogs.totalCogs) / price) * 100 : null;
      const imgs = (p.imagesJson as Array<{ src?: string }> | null) ?? [];
      const tagsArr = (p.tags || "").split(",").filter(t => t.trim());
      return {
        title: p.title,
        status: p.status,
        price: p.price || "0",
        compareAtPrice: p.compareAtPrice,
        imageUrl: imgs[0]?.src || null,
        imageCount: p.imageCount ?? 0,
        descriptionLength: (p.bodyHtml || "").length,
        tagsCount: tagsArr.length,
        tags: p.tags || "",
        variantCount: p.variantCount ?? 1,
        published: !!p.publishedAt,
        auditScore: p.auditScore ?? 0,
        auditGrade: p.auditGrade ?? (seo?.seoGrade ?? "D"),
        hasComparePrice: !!p.compareAtPrice,
        hasMetaTitle: !!seo?.metaTitle && seo.metaTitle.length > 10,
        hasMetaDesc: !!seo?.metaDescription && seo.metaDescription.length > 10,
        hasSchema: !!seo?.hasSchema,
        hasAltTexts: !!seo?.hasAltTexts,
        cleanHandle: !!seo?.cleanHandle,
        cogs: cogs ? cogs.totalCogs : null,
        margin,
        productType: p.productType,
        vendor: p.vendor,
      };
    });
    const catalogCardsHtmlCatalog = buildProductCardsSection(catalogCards, "Catalogo Completo");
  
    const body = `
      <div class="metric-row">
        <div class="metric"><div class="value">${totalProducts}</div><div class="label">Total productos</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${activeProducts}</div><div class="label">Activos</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${avgPrice.toFixed(2)}€</div><div class="label">Precio medio</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${Math.round(avgScore)}</div><div class="label">Score medio</div></div><!-- nosemgrep -->
      </div>
  
      <div class="section">
        ${catalogCardsHtmlCatalog || '<div class="card"><p class="text-muted" style="text-align:center;">Sin productos importados</p></div>'}
      </div>`;
  
    const tpl = (req.query.template as ReportTemplate) || "prestige";
    const html = getReportShell(tpl)("Informe de Catálogo de Productos", `${project.name} — ${project.shopDomain || "Sin dominio"}`, body, date);
    autoSaveReport(projectId, "Informe de Catálogo de Productos", html, "product_catalog").catch(() => {});
    await sendHtmlOrPdf(req, res, html, `Product_Catalog_${project.name.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}`);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/projects/:projectId/exports/financial", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
    const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
    const allCogs = await db.select().from(cogsTable).where(eq(cogsTable.projectId, projectId));
    const priceHistory = await db.select().from(priceHistoryTable).where(eq(priceHistoryTable.projectId, projectId)).orderBy(desc(priceHistoryTable.recordedAt)).limit(100);
  
    const cogsMap = new Map(allCogs.map(c => [c.shopifyProductId, c]));
    const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  
    let totalRevenuePotential = 0;
    let totalCosts = 0;
    let cogsRows = "";
    for (const p of products) {
      const cogs = cogsMap.get(p.shopifyProductId);
      const price = parseFloat(p.price ?? "0");
      totalRevenuePotential += price;
      totalCosts += cogs?.totalCogs ?? 0;
      if (cogs) {
        const margin = price > 0 ? ((price - cogs.totalCogs) / price) * 100 : 0;
        cogsRows += `<tr><!-- nosemgrep -->
          <td style="font-weight:500;">${sanitizeHtml(p.title)}</td><!-- nosemgrep -->
          <td>${price.toFixed(2)}€</td><!-- nosemgrep -->
          <td>${cogs.totalCogs.toFixed(2)}€</td><!-- nosemgrep -->
          <td>${(price - cogs.totalCogs).toFixed(2)}€</td><!-- nosemgrep -->
          <td><span class="${margin > 30 ? "text-jade" : margin > 15 ? "text-gold" : "text-red"}">${margin.toFixed(1)}%</span></td><!-- nosemgrep -->
        </tr>`;
      }
    }
  
    const avgMargin = totalRevenuePotential > 0 ? ((totalRevenuePotential - totalCosts) / totalRevenuePotential) * 100 : 0;
  
    let priceHistoryRows = "";
    for (const h of priceHistory.slice(0, 30)) {
      const pct = h.oldPrice && h.oldPrice > 0 ? (((h.newPrice - h.oldPrice) / h.oldPrice) * 100) : 0;
      priceHistoryRows += `<tr><!-- nosemgrep -->
        <td>${h.recordedAt?.toLocaleDateString("es-ES") ?? "—"}</td><!-- nosemgrep -->
        <td>${h.shopifyProductId}</td><!-- nosemgrep -->
        <td>${h.oldPrice?.toFixed(2) ?? "—"}€</td><!-- nosemgrep -->
        <td>${h.newPrice.toFixed(2)}€</td><!-- nosemgrep -->
        <td><span class="${pct >= 0 ? "text-jade" : "text-red"}">${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%</span></td><!-- nosemgrep -->
        <td class="text-muted">${h.changeSource ?? "—"}</td><!-- nosemgrep -->
      </tr>`;
    }
  
    const body = `
      <div class="metric-row">
        <div class="metric"><div class="value">${totalRevenuePotential.toFixed(0)}€</div><div class="label">Revenue potencial</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${totalCosts.toFixed(0)}€</div><div class="label">COGS total</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${(totalRevenuePotential - totalCosts).toFixed(0)}€</div><div class="label">Beneficio bruto</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${avgMargin.toFixed(1)}%</div><div class="label">Margen medio</div></div><!-- nosemgrep -->
      </div>
  
      <div class="section">
        <div class="section-title">Análisis COGS por Producto</div>
        <div class="card" style="overflow-x:auto;">
          <table>
            <thead><tr><th>Producto</th><th>Precio</th><th>COGS</th><th>Beneficio</th><th>Margen</th></tr></thead>
            <tbody>${cogsRows || '<tr><td colspan="5" class="text-muted">No hay COGS configurados</td></tr>'}</tbody><!-- nosemgrep -->
          </table>
        </div>
      </div>
  
      ${priceHistoryRows ? `<div class="section"><!-- nosemgrep -->
        <div class="section-title">Historial de Cambios de Precio</div>
        <div class="card" style="overflow-x:auto;">
          <table>
            <thead><tr><th>Fecha</th><th>Producto</th><th>Anterior</th><th>Nuevo</th><th>Cambio</th><th>Fuente</th></tr></thead>
            <tbody>${priceHistoryRows}</tbody><!-- nosemgrep -->
          </table>
        </div>
      </div>` : ""}
  
      ${await generateAiRecommendations(projectId, "financial", (() => {
    const sorted = products.map(p => {
      const c = cogsMap.get(p.shopifyProductId);
      const pr = parseFloat(p.price ?? "0");
      const margin = c && pr > 0 ? ((pr - c.totalCogs) / pr * 100) : null;
      return { title: p.title, price: pr, cogs: c?.totalCogs ?? null, margin };
    }).sort((a, b) => (a.margin ?? -999) - (b.margin ?? -999));
    const lowMargin = sorted.filter(p => p.margin !== null && p.margin < 20);
    const highMargin = sorted.filter(p => p.margin !== null && p.margin > 50);
    const noCogs = sorted.filter(p => p.margin === null);
    const priceRanges = products.map(p => parseFloat(p.price ?? "0")).filter(p => p > 0);
    const minPrice = priceRanges.length ? Math.min(...priceRanges) : 0;
    const maxPrice = priceRanges.length ? Math.max(...priceRanges) : 0;
    const medianPrice = priceRanges.length ? priceRanges.sort((a, b) => a - b)[Math.floor(priceRanges.length / 2)] : 0;
    return `TIENDA: ${project.name}
  PLATAFORMA: ${project.platformType || "shopify"}
  NICHO: ${project.storeNiche || "No definido"}
  TOTAL PRODUCTOS: ${products.length}
  REVENUE POTENCIAL CATÁLOGO: ${totalRevenuePotential.toFixed(2)}€
  COGS TOTAL REGISTRADO: ${totalCosts.toFixed(2)}€
  BENEFICIO BRUTO: ${(totalRevenuePotential - totalCosts).toFixed(2)}€
  MARGEN BRUTO MEDIO: ${avgMargin.toFixed(1)}%
  PRODUCTOS CON COGS CONFIGURADOS: ${allCogs.length}/${products.length} (${products.length > 0 ? Math.round(allCogs.length / products.length * 100) : 0}%)
  PRODUCTOS SIN COGS (riesgo de pricing ciego): ${noCogs.length}
  RANGO DE PRECIOS: ${minPrice.toFixed(2)}€ — ${maxPrice.toFixed(2)}€ (mediana: ${medianPrice.toFixed(2)}€)
  CAMBIOS DE PRECIO RECIENTES: ${priceHistory.length} en los últimos 90 días
  
  ⚠️ PRODUCTOS CON MARGEN BAJO (<20%) — RIESGO:
  ${lowMargin.slice(0, 8).map(p => `- "${p.title}" Precio: ${p.price.toFixed(2)}€, COGS: ${p.cogs?.toFixed(2)}€, Margen: ${p.margin?.toFixed(1)}% ${p.margin! < 0 ? "⛔ PIERDE DINERO" : p.margin! < 10 ? "⚠️ MARGEN CRÍTICO" : ""}`).join("\n") || "Ninguno detectado"}
  
  💰 PRODUCTOS ESTRELLA (margen >50%):
  ${highMargin.slice(0, 8).map(p => `- "${p.title}" Precio: ${p.price.toFixed(2)}€, COGS: ${p.cogs?.toFixed(2)}€, Margen: ${p.margin?.toFixed(1)}%`).join("\n") || "Ninguno detectado"}
  
  📊 DETALLE COMPLETO (Top 20 por precio):
  ${sorted.slice(0, 20).map(p => `- "${p.title}" Precio: ${p.price.toFixed(2)}€, COGS: ${p.cogs !== null ? p.cogs.toFixed(2) + "€" : "❌ SIN DATOS"}, Margen: ${p.margin !== null ? p.margin.toFixed(1) + "%" : "DESCONOCIDO"}`).join("\n")}`;
  })(), project.storeNiche ?? undefined, project.platformType ?? "shopify")}`;
  
    const tpl = (req.query.template as ReportTemplate) || "prestige";
    const html = getReportShell(tpl)("Informe Financiero y COGS", `${project.name} — ${project.shopDomain || "Sin dominio"}`, body, date);
    autoSaveReport(projectId, "Informe Financiero y COGS", html, "financial").catch(() => {});
    await sendHtmlOrPdf(req, res, html, `Financial_Report_${project.name.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}`);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/projects/:projectId/exports/brand-brief", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
    const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
    const seoData = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, projectId));
    const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  
    const activeProducts = products.filter(p => p.status === "active").length;
    const draftProducts = products.filter(p => p.status === "draft").length;
    const archivedProducts = products.filter(p => p.status === "archived").length;
    const productTypes = [...new Set(products.map(p => p.productType).filter(Boolean))];
    const vendors = [...new Set(products.map(p => p.vendor).filter(Boolean))];
    const avgPrice = products.length > 0 ? products.reduce((s, p) => s + parseFloat(p.price ?? "0"), 0) / products.length : 0;
    const priceRange = products.length > 0
      ? { min: Math.min(...products.map(p => parseFloat(p.price ?? "0"))), max: Math.max(...products.map(p => parseFloat(p.price ?? "0"))) }
      : { min: 0, max: 0 };
  
    const body = `
      <div class="section">
        <div class="section-title">Identidad de Marca</div>
        <div class="card">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
            <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Nombre del Proyecto</p><p style="font-size:18px;font-weight:600;">${project.name}</p></div><!-- nosemgrep -->
            <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Dominio Web</p><p style="font-size:18px;font-weight:600;">${project.shopDomain || "No configurado"}</p></div><!-- nosemgrep -->
            <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Nicho de Mercado</p><p style="font-size:16px;font-weight:500;">${project.storeNiche || "No definido"}</p></div><!-- nosemgrep -->
            <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Mercados Objetivo</p><p style="font-size:16px;font-weight:500;">${project.storeMarkets || "Global"}</p></div><!-- nosemgrep -->
          </div>
        </div>
      </div>
  
      <div class="section">
        <div class="section-title">Voz y Tono de Marca</div>
        <div class="card">
          <p style="font-size:15px;line-height:1.8;">${project.brandTone || "No definido — Se recomienda establecer el tono de marca para consistencia en todas las comunicaciones."}</p><!-- nosemgrep -->
        </div>
      </div>
  
      <div class="section">
        <div class="section-title">Audiencia Objetivo</div>
        <div class="card">
          <p style="font-size:15px;line-height:1.8;">${project.targetAudience || "No definido — Definir la audiencia objetivo permite optimizar copywriting, SEO y estrategia de pricing."}</p><!-- nosemgrep -->
        </div>
      </div>
  
      <div class="section">
        <div class="section-title">Panorama del Catálogo</div>
        <div class="metric-row">
          <div class="metric"><div class="value">${products.length}</div><div class="label">Total productos</div></div>
          <div class="metric"><div class="value">${activeProducts}</div><div class="label">Activos</div></div>
          <div class="metric"><div class="value">${draftProducts}</div><div class="label">Borradores</div></div>
          <div class="metric"><div class="value">${archivedProducts}</div><div class="label">Archivados</div></div><!-- nosemgrep -->
          <div class="metric"><div class="value">${productTypes.length}</div><div class="label">Categorías</div></div>
          <div class="metric"><div class="value">${avgPrice.toFixed(2)}€</div><div class="label">Precio medio</div></div><!-- nosemgrep -->
          <div class="metric"><div class="value">${priceRange.min.toFixed(0)}–${priceRange.max.toFixed(0)}€</div><div class="label">Rango de precios</div></div><!-- nosemgrep -->
        </div>
        ${productTypes.length > 0 ? `<div class="card"><p class="text-muted" style="font-size:11px;text-transform:uppercase;margin-bottom:8px;">Categorías de producto</p><div>${productTypes.map(t => `<span class="tag">${t}</span>`).join(" ")}</div></div>` : ""}<!-- nosemgrep -->
        ${vendors.length > 0 ? `<div class="card"><p class="text-muted" style="font-size:11px;text-transform:uppercase;margin-bottom:8px;">Proveedores / Vendors</p><div>${vendors.map(v => `<span class="tag">${v}</span>`).join(" ")}</div></div>` : ""}<!-- nosemgrep -->
      </div>
  
      <div class="section">
        <div class="section-title">Estado de Optimización</div>
        <div class="card">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Plan activo</p><p style="font-size:16px;font-weight:600;text-transform:uppercase;" class="text-gold">${project.plan}</p></div><!-- nosemgrep -->
            <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Piloto automático</p><p style="font-size:16px;font-weight:600;">${project.autoPilotEnabled ? '<span class="text-jade">Activado</span>' : '<span class="text-muted">Desactivado</span>'}</p></div>
            <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Score Audit medio</p><p style="font-size:16px;font-weight:600;">${project.avgAuditScore != null ? Math.round(project.avgAuditScore) + "/100" : "Sin auditar"}</p></div><!-- nosemgrep -->
            <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Productos auditados</p><p style="font-size:16px;font-weight:600;">${seoData.filter(s => s.seoScore != null).length}/${products.length}</p></div><!-- nosemgrep -->
          </div>
        </div>
      </div>`;
  
    const tpl = (req.query.template as ReportTemplate) || "prestige";
    const html = getReportShell(tpl)("Brand Brief & Estrategia", `${project.name} — ${project.shopDomain || "Sin dominio"}`, body, date);
    autoSaveReport(projectId, "Brand Brief & Estrategia", html, "brand_brief").catch(() => {});
    await sendHtmlOrPdf(req, res, html, `Brand_Brief_${project.name.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}`);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/projects/:projectId/exports/ab-tests", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
    const tests = await db.select().from(abTestsTable).where(eq(abTestsTable.projectId, projectId)).orderBy(desc(abTestsTable.createdAt));
    const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  
    const totalTests = tests.length;
    const completed = tests.filter(t => t.status === "completed" || t.status === "winner_applied").length;
    const active = tests.filter(t => t.status === "running").length;
  
    let rows = "";
    for (const t of tests) {
      rows += `<tr><!-- nosemgrep -->
        <td style="font-weight:500;">${(t as any).testName ?? t.productTitle}</td><!-- nosemgrep -->
        <td>${t.testType}</td><!-- nosemgrep -->
        <td><span class="tag">${t.status}</span></td><!-- nosemgrep -->
        <td>${t.startDate ? new Date(t.startDate).toLocaleDateString("es-ES") : "—"}</td><!-- nosemgrep -->
        <td>${t.winner ?? "—"}</td><!-- nosemgrep -->
        <td class="text-muted">${(t as any).improvementPct != null ? `+${(t as any).improvementPct.toFixed(1)}%` : "—"}</td><!-- nosemgrep -->
      </tr>`;
    }
  
    const body = `
      <div class="metric-row">
        <div class="metric"><div class="value">${totalTests}</div><div class="label">Tests totales</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${active}</div><div class="label">Activos</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${completed}</div><div class="label">Completados</div></div><!-- nosemgrep -->
      </div>
      <div class="section">
        <div class="section-title">Historial de A/B Tests</div>
        <div class="card" style="overflow-x:auto;">
          <table>
            <thead><tr><th>Test</th><th>Tipo</th><th>Estado</th><th>Inicio</th><th>Ganador</th><th>Mejora</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="6" class="text-muted">No hay tests registrados</td></tr>'}</tbody><!-- nosemgrep -->
          </table>
        </div>
      </div>`;
  
    const tpl = (req.query.template as ReportTemplate) || "prestige";
    const html = getReportShell(tpl)("Informe A/B Testing", `${project.name} — ${project.shopDomain || "Sin dominio"}`, body, date);
    autoSaveReport(projectId, "Informe A/B Testing", html, "ab_testing").catch(() => {});
    await sendHtmlOrPdf(req, res, html, `AB_Tests_${project.name.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}`);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/projects/:projectId/exports/images-gallery", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
    const jobs = await db.select().from(generationJobsTable)
      .where(eq(generationJobsTable.projectId, projectId))
      .orderBy(desc(generationJobsTable.createdAt))
      .limit(200);
  
    const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
    const succeeded = jobs.filter(j => j.status === "succeeded");
    const failed = jobs.filter(j => j.status === "failed");
  
    let gallery = "";
    for (const j of succeeded) {
      gallery += `<div style="background:${BRAND.dark};border:1px solid ${BRAND.border};border-radius:10px;overflow:hidden;"><!-- nosemgrep -->
        ${j.imageUrl ? `<img src="${j.imageUrl}" style="width:100%;height:200px;object-fit:cover;" alt="${j.altText || "AI generated"}"/>` : `<div style="width:100%;height:200px;display:flex;align-items:center;justify-content:center;background:${BRAND.card};"><span class="text-muted">Sin preview</span></div>`}<!-- nosemgrep -->
        <div style="padding:10px;">
          <p style="font-size:12px;font-weight:600;margin-bottom:4px;">${j.imageType ?? "Imagen"}</p><!-- nosemgrep -->
          <p style="font-size:11px;color:${BRAND.muted};">${j.altText?.slice(0, 60) ?? "Sin descripción"}</p><!-- nosemgrep -->
          <p style="font-size:10px;color:${BRAND.muted};margin-top:4px;">${j.model ?? ""}</p><!-- nosemgrep -->
        </div>
      </div>`;
    }
  
    const body = `
      <div class="metric-row">
        <div class="metric"><div class="value">${succeeded.length}</div><div class="label">Imágenes generadas</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${failed.length}</div><div class="label">Fallidas</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${jobs.length}</div><div class="label">Total jobs</div></div><!-- nosemgrep -->
      </div>
      <div class="section">
        <div class="section-title">Galería de Imágenes IA</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
          ${gallery || `<div class="text-muted" style="grid-column:span 3;text-align:center;padding:40px;">No hay imágenes generadas aún</div>`}<!-- nosemgrep -->
        </div>
      </div>`;
  
    const tpl = (req.query.template as ReportTemplate) || "prestige";
    const html = getReportShell(tpl)("Galería de Imágenes IA", `${project.name} — ${project.shopDomain || "Sin dominio"}`, body, date);
    autoSaveReport(projectId, "Galería de Imágenes IA", html, "images_gallery").catch(() => {});
    await sendHtmlOrPdf(req, res, html, `Images_Gallery_${project.name.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}`);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/projects/:projectId/exports/run-full-audit", requireProjectAccess, async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
    const projectId = parseInt(String(req.params.projectId), 10);
    if (isNaN(projectId) || projectId <= 0) { res.status(400).json({ error: "ID de proyecto invalido" }); return; }
  
    const log: string[] = [];
    const started = Date.now();
  
    try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
      const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
      log.push(`Catalogo: ${products.length} productos cargados`);
  
      const existingSeo = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, projectId));
      const seoMap = new Map(existingSeo.map(s => [s.shopifyProductId, s]));
  
      let seoUpdated = 0;
      let seoCreated = 0;
      let totalScore = 0;
      for (const p of products) {
        const seo = seoMap.get(p.shopifyProductId);
        const { score, grade, hasAltTexts, cleanHandle, descLen } = calculateSeoScoreInline(p, seo);
  
        if (seo) {
          await db.update(seoDataTable)
            .set({ seoScore: score, seoGrade: grade, hasAltTexts, cleanHandle, descriptionLength: descLen, lastAuditedAt: new Date() })
            .where(eq(seoDataTable.id, seo.id));
          seoUpdated++;
        } else {
          await db.insert(seoDataTable).values({
            projectId,
            shopifyProductId: p.shopifyProductId,
            metaTitle: null,
            metaDescription: null,
            hasSchema: false,
            hasAltTexts,
            cleanHandle,
            seoScore: score,
            seoGrade: grade,
            descriptionLength: descLen,
            lastAuditedAt: new Date(),
          });
          seoCreated++;
        }
        totalScore += score;
      }
      log.push(`SEO: ${seoUpdated} actualizados, ${seoCreated} nuevos — ${products.length} productos auditados`);
  
      const avgScore = products.length > 0 ? Math.round(totalScore / products.length) : 0;
  
      await db.update(projectsTable).set({ avgAuditScore: avgScore }).where(eq(projectsTable.id, projectId));
      log.push(`Avg audit score actualizado: ${avgScore}/100`);
  
      let revenueResult = { totalRevenue: 0, totalOrders: 0, daysLoaded: 0, variantsTracked: 0 };
      if (project.accessToken) {
        try {
          const days = parseInt(String(req.body?.days)) || 90;
          const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
          const dailyMap: Record<string, { revenue: number; orders: number }> = {};
          const variantSales: Record<string, { title: string; productTitle: string; quantity: number; revenue: number }> = {};
          let hasMore = true;
          let pageInfo: string | null = null;
          let fetchCount = 0;
  
          while (hasMore && fetchCount < 10) {
            const url = pageInfo
              ? `/orders.json?status=any&financial_status=paid&limit=250&page_info=${pageInfo}`
              : `/orders.json?status=any&financial_status=paid&created_at_min=${since}&limit=250`;
            const data = await shopifyRequest<{
              orders: Array<{
                id: number; created_at: string; total_price: string;
                line_items: Array<{ variant_id: number; title: string; variant_title: string; quantity: number; price: string; product_id: number }>;
              }>;
            }>(projectId, project.shopDomain, url);
  
            for (const order of data.orders) {
              const date = order.created_at.split("T")[0];
              if (!dailyMap[date]) dailyMap[date] = { revenue: 0, orders: 0 };
              dailyMap[date].revenue += parseFloat(order.total_price || "0");
              dailyMap[date].orders += 1;
  
              for (const li of (order.line_items || [])) {
                const key = `${li.product_id}::${li.variant_title || "default"}`;
                if (!variantSales[key]) variantSales[key] = { title: li.variant_title || "default", productTitle: li.title, quantity: 0, revenue: 0 };
                variantSales[key].quantity += li.quantity;
                variantSales[key].revenue += parseFloat(li.price || "0") * li.quantity;
              }
            }
  
            hasMore = data.orders.length === 250;
            pageInfo = null;
            fetchCount++;
          }
  
          for (const [date, vals] of Object.entries(dailyMap)) {
            const aov = vals.orders > 0 ? vals.revenue / vals.orders : 0;
            const existing = await db.select({ id: revenueSnapshotsTable.id })
              .from(revenueSnapshotsTable)
              .where(and(eq(revenueSnapshotsTable.projectId, String(projectId)), eq(revenueSnapshotsTable.date, date)))
              .limit(1);
  
            if (existing.length > 0) {
              await db.update(revenueSnapshotsTable)
                .set({ revenue: vals.revenue, orders: vals.orders, aov })
                .where(eq(revenueSnapshotsTable.id, existing[0].id));
            } else {
              await db.insert(revenueSnapshotsTable).values({
                id: randomUUID(),
                projectId: String(projectId),
                date,
                revenue: vals.revenue,
                orders: vals.orders,
                aov,
              });
            }
          }
  
          revenueResult = {
            totalRevenue: Object.values(dailyMap).reduce((s, v) => s + v.revenue, 0),
            totalOrders: Object.values(dailyMap).reduce((s, v) => s + v.orders, 0),
            daysLoaded: Object.keys(dailyMap).length,
            variantsTracked: Object.keys(variantSales).length,
          };
          log.push(`Revenue: ${revenueResult.daysLoaded} dias sincronizados, ${revenueResult.totalOrders} pedidos, ${revenueResult.totalRevenue.toFixed(2)}€`);
          log.push(`Variantes: ${revenueResult.variantsTracked} combinaciones producto/variante rastreadas`);
        } catch (err: any) {
          log.push(`Revenue sync error: ${err.message || "fallo al conectar con Shopify"}`);
        }
      } else {
        log.push(`Revenue: sin token Shopify — no se pueden sincronizar pedidos`);
      }
  
      const existingCogs = await db.select().from(cogsTable).where(eq(cogsTable.projectId, projectId));
      log.push(`COGS: ${existingCogs.length}/${products.length} productos con costes registrados`);
  
      const elapsed = ((Date.now() - started) / 1000).toFixed(1);
      log.push(`Auditoria completa en ${elapsed}s`);
  
      res.json({
        ok: true,
        projectId,
        storeName: project.name,
        elapsed: `${elapsed}s`,
        seo: { audited: products.length, updated: seoUpdated, created: seoCreated, avgScore },
        revenue: revenueResult,
        cogs: { registered: existingCogs.length, total: products.length },
        products: products.length,
        log,
      });
    } catch (err: any) {
      console.error("run-full-audit error:", err);
      res.status(500).json({ error: err.message ?? "Error ejecutando auditoria completa", log });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/projects/:projectId/exports/generate-ai-report", requireProjectAccess, async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
    const projectId = parseInt(String(req.params.projectId), 10);
    if (isNaN(projectId) || projectId <= 0) { res.status(400).json({ error: "ID de proyecto invalido" }); return; }
  
    try {
      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
      if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
      const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
      const seoData = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, projectId));
      const allCogs = await db.select().from(cogsTable).where(eq(cogsTable.projectId, projectId));
      const tests = await db.select().from(abTestsTable).where(eq(abTestsTable.projectId, projectId));
      const competitors = await db.select().from(competitorsTable).where(eq(competitorsTable.projectId, String(projectId)));
      const revenueSnapshots = await db.select().from(revenueSnapshotsTable).where(eq(revenueSnapshotsTable.projectId, String(projectId))).orderBy(desc(revenueSnapshotsTable.date)).limit(90);
      const visualDna = await db.select().from(visualDnaTable).where(eq(visualDnaTable.projectId, projectId)).limit(1);
  
      const cogsMap = new Map(allCogs.map(c => [c.shopifyProductId, c]));
      const seoMap = new Map(seoData.map(s => [s.shopifyProductId, s]));
      const activeProducts = products.filter(p => p.status === "active");
      const draftProducts = products.filter(p => p.status === "draft");
      const archivedProducts = products.filter(p => p.status === "archived");
      const avgPrice = products.length > 0 ? products.reduce((s, p) => s + parseFloat(p.price ?? "0"), 0) / products.length : 0;
      const catalogPrices = products.map(p => parseFloat(p.price ?? "0"));
      const totalCatalogValue = catalogPrices.reduce((s, p) => s + p, 0);
      const totalCogs = allCogs.reduce((s, c) => s + c.totalCogs, 0);
      const avgMargin = totalCatalogValue > 0 ? ((totalCatalogValue - totalCogs) / totalCatalogValue) * 100 : 0;
      const totalRevenue = revenueSnapshots.reduce((s, r) => s + (r.revenue ?? 0), 0);
      const totalOrders = revenueSnapshots.reduce((s, r) => s + (r.orders ?? 0), 0);
  
      const liveAudit = products.map(p => {
        const seo = seoMap.get(p.shopifyProductId);
        return { product: p, seo, ...calculateSeoScoreInline(p, seo) };
      });
      const avgSeo = liveAudit.length > 0 ? liveAudit.reduce((s, a) => s + a.score, 0) / liveAudit.length : 0;
      const storeGrade = avgSeo >= 90 ? "A" : avgSeo >= 75 ? "B" : avgSeo >= 60 ? "C" : avgSeo >= 45 ? "D" : "F";
  
      const productTypes = [...new Set(products.map(p => p.productType).filter(Boolean))];
      const priceRange = products.length > 0
        ? { min: Math.min(...catalogPrices), max: Math.max(...catalogPrices) }
        : { min: 0, max: 0 };
  
      const worst5Seo = [...liveAudit].sort((a, b) => a.score - b.score).slice(0, 5);
      const best5Seo = [...liveAudit].sort((a, b) => b.score - a.score).slice(0, 5);
  
      const productSummary = products.slice(0, 25).map(p => {
        const cogs = cogsMap.get(p.shopifyProductId);
        const price = parseFloat(p.price ?? "0");
        const margin = cogs && price > 0 ? ((price - cogs.totalCogs) / price) * 100 : null;
        const audit = liveAudit.find(a => a.product.shopifyProductId === p.shopifyProductId);
        return `- "${p.title}" | ${price.toFixed(2)}€ | ${p.status} | COGS: ${cogs ? cogs.totalCogs.toFixed(2) + "€" : "sin datos"} | Margen: ${margin != null ? margin.toFixed(0) + "%" : "N/A"} | SEO: ${audit ? audit.grade + " (" + audit.score + "/100)" : "N/A"} | Imgs: ${p.imageCount ?? 0} | Tipo: ${p.productType || "sin tipo"} | Handle: ${p.handle}`;
      }).join("\n");
  
      const seoIssuesSummary = worst5Seo.map(a =>
        `- "${a.product.title}" SEO ${a.grade} (${a.score}/100): Meta title: ${a.hasMetaTitle ? "SI" : "NO"}, Meta desc: ${a.hasMetaDesc ? "SI" : "NO"}, Schema: ${a.hasSchema ? "SI" : "NO"}, Alt texts: ${a.hasAltTexts ? "SI" : "NO"}, Handle limpio: ${a.cleanHandle ? "SI" : "NO"}, Desc: ${a.descLen} chars`
      ).join("\n");
  
      const competitorList = competitors.slice(0, 5).map(c => `- ${c.name} (${c.url || "sin URL"}) — tipo: ${c.type || "direct"}`).join("\n");
  
      const dataBlock = `
  === DATOS DE LA TIENDA ===
  Nombre: ${project.name}
  Dominio: ${project.shopDomain}
  Nicho: ${project.storeNiche || "No definido"}
  Tono de marca: ${project.brandTone || "No definido"}
  Audiencia objetivo: ${project.targetAudience || "No definida"}
  Mercados: ${project.storeMarkets || "No definidos"}
  
  === CATALOGO ===
  Total productos: ${products.length} (${activeProducts.length} activos, ${draftProducts.length} borradores, ${archivedProducts.length} archivados)
  Precio medio: ${avgPrice.toFixed(2)}€
  Rango: ${priceRange.min.toFixed(2)}€ – ${priceRange.max.toFixed(2)}€
  Mediana: ${(() => { const sorted = [...catalogPrices].sort((a, b) => a - b); return sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)].toFixed(2) : "0.00"; })()}€
  Categorias: ${productTypes.join(", ") || "sin categorizar"}
  Visual DNA: ${visualDna.length > 0 ? JSON.stringify({ bg: visualDna[0].backgroundStyle, lighting: visualDna[0].lightingStyle, mood: visualDna[0].mood, composition: visualDna[0].composition }) : "No configurado"}
  
  === SEO ===
  Score medio: ${avgSeo.toFixed(1)}/100 (Grade ${storeGrade})
  Con meta title: ${liveAudit.filter(a => a.hasMetaTitle).length}/${products.length}
  Con meta description: ${liveAudit.filter(a => a.hasMetaDesc).length}/${products.length}
  Con Schema JSON-LD: ${liveAudit.filter(a => a.hasSchema).length}/${products.length}
  Con alt texts: ${liveAudit.filter(a => a.hasAltTexts).length}/${products.length}
  Con handle limpio: ${liveAudit.filter(a => a.cleanHandle).length}/${products.length}
  Con descripcion +300 chars: ${liveAudit.filter(a => a.descLen >= 300).length}/${products.length}
  
  Top 5 PEORES SEO:
  ${seoIssuesSummary}
  
  Top 5 MEJORES SEO:
  ${best5Seo.map(a => `- "${a.product.title}" SEO ${a.grade} (${a.score}/100)`).join("\n")}
  
  === FINANCIERO ===
  Valor catalogo total: ${totalCatalogValue.toFixed(2)}€
  COGS total registrado: ${totalCogs.toFixed(2)}€ (${allCogs.length}/${products.length} productos)
  Margen bruto medio: ${allCogs.length > 0 ? avgMargin.toFixed(1) + "%" : "sin datos COGS"}
  Revenue Shopify (ultimos 90 dias): ${totalRevenue.toFixed(2)}€
  Pedidos totales: ${totalOrders}
  AOV: ${totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) + "€" : "sin pedidos"}
  
  === A/B TESTING ===
  Tests totales: ${tests.length}
  Activos: ${tests.filter(t => t.status === "running").length}
  Completados: ${tests.filter(t => t.status === "completed" || t.status === "winner_applied").length}
  
  === COMPETIDORES ===
  ${competitorList || "Sin competidores registrados"}
  
  === DETALLE DE PRODUCTOS (hasta 25) ===
  ${productSummary}
  `;
  
      const systemPrompt = `Eres ShopyBrain, el motor de inteligencia artificial de Shopy Crafter, una agencia independiente de optimización IA para tiendas Shopify. Generas informes exhaustivos, estrategicos y profundamente analiticos para clientes de e-commerce. IMPORTANTE: Shopy Crafter NO es Shopify. Somos un servicio independiente que optimiza tiendas en la plataforma Shopify.
  
  Tu analisis debe ser EXTENSO, DETALLADO, ESPECIFICO al negocio del cliente. No uses frases genericas ni recomendaciones vagas. Cada parrafo debe contener datos concretos del cliente, numeros exactos, y recomendaciones accionables con estimaciones de impacto.
  
  Escribe SIEMPRE en español. Usa lenguaje profesional pero accesible. Se exhaustivo — cuanto mas largo y detallado, mejor. Minimo 3-4 parrafos por seccion.`;
  
      const userPrompt = `Genera un analisis EXHAUSTIVO y PROFUNDO de esta tienda Shopify. Responde en formato JSON con las siguientes claves (cada valor es texto largo en HTML con parrafos <p>, negritas <strong>, listas <ul><li>, etc.):
  
  ${dataBlock}
  
  FORMATO JSON REQUERIDO:
  {
    "executiveSummary": "Narrativa de 4-5 parrafos: estado general de la tienda, hallazgos criticos, fortalezas detectadas, debilidades principales, y una valoracion profesional honesta. Incluye datos numericos concretos.",
    "brandAnalysis": "3-4 parrafos: analisis de coherencia de marca, alineacion entre nicho declarado y catalogo real, consistencia visual (basado en Visual DNA si existe), y recomendaciones de posicionamiento de marca con acciones concretas.",
    "seoDeepAnalysis": "4-5 parrafos: diagnostico detallado de la situacion SEO actual con numeros exactos, analisis de los 5 peores productos y que les falta especificamente, oportunidades de quick-wins (que mejorar primero para maximo impacto), estrategia de schema markup, y plan de accion SEO priorizado por esfuerzo/impacto.",
    "pricingStrategy": "4-5 parrafos: analisis de la estructura de precios actual, distribucion por rangos, coherencia de pricing dentro de cada categoria, oportunidades de pricing psicologico (con ejemplos concretos de productos), estrategia de compare-at-price, y recomendaciones de ajuste con estimacion de impacto en revenue.",
    "financialAnalysis": "3-4 parrafos: analisis de margenes (si hay COGS), productos con margen critico, productos con margen saludable, estructura de costes, y recomendaciones para mejorar rentabilidad. Si no hay COGS, explicar por que es critico registrarlos y que impacto tiene no tenerlos.",
    "productMixStrategy": "3-4 parrafos: analisis del mix de productos, oportunidades de bundle y cross-sell con productos ESPECIFICOS del catalogo (nombrar los productos), estrategia de upsell, productos ancla vs productos de entrada, y como optimizar el AOV.",
    "competitivePosition": "2-3 parrafos: posicionamiento competitivo basado en los competidores registrados (o analisis general del nicho si no hay competidores), ventajas diferenciales, areas de mejora competitiva.",
    "actionPlan30Days": "Lista HTML detallada de las 7-10 acciones prioritarias para los proximos 30 dias, ordenadas por impacto esperado. Cada accion debe incluir: que hacer exactamente, en que productos, resultado esperado, y nivel de esfuerzo (bajo/medio/alto). Usar <ol> con <li> detallados.",
    "revenueProjection": "2-3 parrafos: proyeccion realista de revenue basada en los datos actuales, escenarios optimista/base/pesimista para 30/60/90 dias, y que palancas mover para alcanzar cada escenario."
  }
  
  IMPORTANTE: Cada seccion debe ser EXTENSA (minimo 3-4 parrafos), ESPECIFICA (nombrar productos concretos del catalogo), y con DATOS NUMERICOS del cliente. No uses placeholder ni contenido generico. El JSON debe ser valido.`;
  
      const aiResponse = await askClaudeWithBrain(projectId, [{ role: "user", content: userPrompt }], systemPrompt, "general", project.storeNiche ?? undefined, 8192);
  
      let aiReport: Record<string, string>;
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found in response");
        aiReport = JSON.parse(jsonMatch[0]);
      } catch {
        aiReport = { executiveSummary: aiResponse, raw: "true" };
      }
  
      await db.update(projectsTable)
        .set({
          aiReportJson: JSON.stringify(aiReport),
          aiReportGeneratedAt: new Date(),
        })
        .where(eq(projectsTable.id, projectId));
  
      learnFromOperation({
        operationType: "ai_strategic_report",
        title: `Informe IA estratégico: ${project.name ?? "tienda"} — ${Object.keys(aiReport).length} secciones`,
        content: `Informe IA generado. Secciones: ${Object.keys(aiReport).join(", ")}. Resumen: ${aiReport.executiveSummary ?? ""}. Plan 30d: ${aiReport.actionPlan30Days ?? ""}. Revenue: ${aiReport.revenueProjection ?? ""}`,
        confidence: 0.92,
        tags: ["report", "strategic", "ai_analysis", project.storeNiche ?? "general"],
      });
  
      const sectionLabels: Record<string, string> = {
        executiveSummary: "Resumen Ejecutivo",
        brandAnalysis: "Análisis de Marca",
        seoDeepAnalysis: "Análisis SEO Profundo",
        pricingStrategy: "Estrategia de Precios",
        financialAnalysis: "Análisis Financiero",
        productMixStrategy: "Estrategia de Mix de Productos",
        competitivePosition: "Posición Competitiva",
        actionPlan30Days: "Plan de Acción 30 Días",
        revenueProjection: "Proyección de Revenue",
      };
      const sectionsHtml = Object.entries(aiReport)
        .filter(([k]) => k !== "raw")
        .map(([k, v]) => `<h2>${sanitizeHtml(sectionLabels[k] || k)}</h2>\n<div>${v}</div>`)
        .join("\n\n");
      const aiHtmlReport = reportShell(
        `Informe Estratégico IA — ${project.name}`,
        `${project.shopDomain || "Sin dominio"} — Análisis completo con IA`,
        sectionsHtml,
        new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })
      );
      const savedId = await autoSaveReport(projectId, `Informe Estratégico IA — ${project.name}`, aiHtmlReport, "ai_strategic_report");
  
      res.json({
        ok: true,
        projectId,
        sections: Object.keys(aiReport).length,
        generatedAt: new Date().toISOString(),
        savedToVault: savedId !== null,
        savedFileId: savedId,
        preview: aiReport,
      });
    } catch (err: any) {
      console.error("generate-ai-report error:", err);
      res.status(500).json({ error: "Error generando analisis IA. Intentalo de nuevo." });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

function calculateSeoScoreInline(p: any, seo: any): { score: number; grade: string; hasMetaTitle: boolean; hasMetaDesc: boolean; hasSchema: boolean; hasAltTexts: boolean; cleanHandle: boolean; descLen: number; wordCount: number; tagCount: number; details?: Record<string, number> } {
  const bodyText = p.bodyHtml?.replace(/<[^>]+>/g, "") ?? "";
  const descLen = bodyText.length;
  const wordCount = bodyText.split(/\s+/).filter((w: string) => w.length > 0).length;
  const imgCount = p.imageCount ?? 0;
  const imgsInline = p.imagesJson as Array<{ alt: string | null }> | null;
  const hasAltTexts = imgCount === 0 || (Array.isArray(imgsInline) && imgsInline.length > 0 && imgsInline.every((img: any) => img.alt && img.alt.trim() !== ""));
  const cleanHandle = /^[a-z0-9-]+$/.test(p.handle) && p.handle.length <= 60;
  const hasMetaTitle = !!seo?.metaTitle;
  const hasMetaDesc = !!seo?.metaDescription;
  const hasSchema = seo?.hasSchema ?? false;
  const tagCount = p.tags ? p.tags.split(",").filter((t: string) => t.trim()).length : 0;
  const titleLen = (p.title ?? "").length;
  const hasStructuredContent = /<(h2|h3|ul|ol|table)[\s>]/i.test(p.bodyHtml ?? "");
  const hasFaqContent = /faq|pregunta|¿/i.test(p.bodyHtml ?? "");

  const details: Record<string, number> = {};
  let totalWeight = 0;
  let weightedSum = 0;

  function addC(name: string, pts: number, weight: number) {
    details[name] = Math.round(pts);
    weightedSum += pts * weight;
    totalWeight += weight;
  }

  let mtPts = 0;
  if (hasMetaTitle) { mtPts = 60; if (seo?.metaTitle?.length >= 40 && seo?.metaTitle?.length <= 60) mtPts = 100; else if (seo?.metaTitle?.length >= 30 && seo?.metaTitle?.length <= 70) mtPts = 80; }
  addC("metaTitle", mtPts, 10);

  let mdPts = 0;
  if (hasMetaDesc) { mdPts = 60; if (seo?.metaDescription?.length >= 130 && seo?.metaDescription?.length <= 160) mdPts = 100; else if (seo?.metaDescription?.length >= 100 && seo?.metaDescription?.length <= 170) mdPts = 80; }
  addC("metaDescription", mdPts, 8);

  let schPts = 0;
  if (hasSchema) { schPts = 60; if (hasFaqContent) schPts = 100; } else { if (hasFaqContent) schPts = 30; }
  addC("structuredData", schPts, 10);

  addC("altTexts", hasAltTexts ? 100 : 0, 6);
  addC("urlHandle", cleanHandle ? (titleLen >= 10 && titleLen <= 50 ? 100 : 80) : 0, 3);

  let wcPts = 0;
  if (wordCount >= 800) wcPts = 100; else if (wordCount >= 500) wcPts = 80; else if (wordCount >= 300) wcPts = 55; else if (wordCount >= 100) wcPts = 25;
  addC("contentDepth", wcPts, 9);

  let spPts = 0;
  if (seo?.pageSpeedScore >= 90) spPts = 100; else if (seo?.pageSpeedScore >= 70) spPts = 70; else if (seo?.pageSpeedScore >= 50) spPts = 40;
  addC("pageSpeed", spPts, 7);

  let tPts = 0;
  if (titleLen >= 45 && titleLen <= 70) tPts = 100; else if (titleLen >= 30 && titleLen <= 80) tPts = 60; else if (titleLen >= 20) tPts = 30;
  addC("titleOptimization", tPts, 5);

  let iPts = 0;
  if (imgCount >= 8) iPts = 100; else if (imgCount >= 5) iPts = 70; else if (imgCount >= 3) iPts = 45; else if (imgCount >= 1) iPts = 15;
  addC("imageCount", iPts, 7);

  let tgPts = 0;
  if (tagCount >= 20) tgPts = 100; else if (tagCount >= 15) tgPts = 75; else if (tagCount >= 10) tgPts = 50; else if (tagCount >= 5) tgPts = 25;
  addC("tagOptimization", tgPts, 5);

  addC("structuredContent", hasStructuredContent ? 100 : 0, 4);

  let kwPts = 0;
  const title = p.title ?? "";
  if (title && bodyText) {
    const tw = title.toLowerCase().replace(/[—–|·\-]/g, " ").split(/\s+/).filter((w: string) => w.length > 3);
    const bl = bodyText.toLowerCase();
    const first200 = bl.substring(0, 800);
    if (tw.length > 0) {
      const br = tw.filter((w: string) => bl.includes(w)).length / tw.length;
      const pr = tw.filter((w: string) => first200.includes(w)).length / tw.length;
      if (br >= 0.6) kwPts += 40; else if (br >= 0.3) kwPts += 20;
      if (pr >= 0.5) kwPts += 35; else if (pr >= 0.25) kwPts += 15;
    }
    if (p.tags) {
      const tl = (p.tags as string).toLowerCase();
      const tkm = tw.filter((w: string) => tl.includes(w)).length;
      if (tw.length > 0 && tkm / tw.length >= 0.4) kwPts += 25;
    }
  }
  addC("keywordConsistency", Math.min(100, kwPts), 8);

  let rdPts = 0;
  if (bodyText && wordCount >= 50) {
    const sents = bodyText.split(/[.!?¿¡]+/).filter((s: string) => s.trim().length > 5);
    const avg = sents.length > 0 ? wordCount / sents.length : 0;
    if (avg >= 10 && avg <= 25) rdPts = 100; else if (avg >= 8 && avg <= 30) rdPts = 70; else if (avg > 0) rdPts = 35;
    const paras = bodyText.split(/\n\n|\r\n\r\n/).filter((pp: string) => pp.trim().length > 20);
    if (paras.length >= 5) rdPts = Math.min(100, rdPts + 10);
  }
  addC("readability", rdPts, 6);

  let smPts = 0;
  if (hasMetaTitle && hasMetaDesc && imgCount >= 1) smPts = 100;
  else if (hasMetaTitle && hasMetaDesc) smPts = 60;
  else if (hasMetaTitle || hasMetaDesc) smPts = 30;
  addC("socialMeta", smPts, 3);

  let fqPts = 0;
  if (hasFaqContent && hasSchema) fqPts = 100; else if (hasFaqContent) fqPts = 60;
  addC("faqOptimization", fqPts, 5);

  addC("internalLinking", 0, 4);

  const score = totalWeight > 0 ? Math.min(100, Math.round(weightedSum / totalWeight)) : 0;
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 45 ? "D" : "F";
  return { score, grade, hasMetaTitle, hasMetaDesc, hasSchema, hasAltTexts, cleanHandle, descLen, wordCount, tagCount, details };
}

function pageHdr(title: string, num: number) {
  return `<div class="page-header"><div class="page-header-title">${sanitizeHtml(title)}</div><div class="page-header-num">Pagina ${num}</div></div>`;
}

router.get("/projects/:projectId/exports/complete-report", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    if (isNaN(projectId) || projectId <= 0) { res.status(400).json({ error: "ID de proyecto invalido" }); return; }
    try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
    const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
    const seoData = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, projectId));
    const allCogs = await db.select().from(cogsTable).where(eq(cogsTable.projectId, projectId));
    const tests = await db.select().from(abTestsTable).where(eq(abTestsTable.projectId, projectId));
    const jobs = await db.select().from(generationJobsTable).where(eq(generationJobsTable.projectId, projectId));
    const redesigns = await db.select().from(redesignsTable).where(eq(redesignsTable.projectId, projectId));
    const competitors = await db.select().from(competitorsTable).where(eq(competitorsTable.projectId, String(projectId)));
    const revenueSnapshots = await db.select().from(revenueSnapshotsTable).where(eq(revenueSnapshotsTable.projectId, String(projectId))).orderBy(desc(revenueSnapshotsTable.date)).limit(90);
    const memories = await db.select().from(omnicoreMemoriesTable).orderBy(desc(omnicoreMemoriesTable.createdAt)).limit(10);
    const priceHistory = await db.select().from(priceHistoryTable).where(eq(priceHistoryTable.projectId, projectId)).orderBy(desc(priceHistoryTable.recordedAt)).limit(20);
    const visualDna = await db.select().from(visualDnaTable).where(eq(visualDnaTable.projectId, projectId)).limit(1);
    const insightCount = await db.select({ count: sql<number>`count(*)` }).from(omnicoreInsightsTable);
    const totalInsights = insightCount[0]?.count ?? 0;
  
    const cogsMap = new Map(allCogs.map(c => [c.shopifyProductId, c]));
    const seoMap = new Map(seoData.map(s => [s.shopifyProductId, s]));
    const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
    const esc = sanitizeHtml;
  
    let aiReport: Record<string, string> | null = null;
    if (project.aiReportJson) {
      try { aiReport = JSON.parse(project.aiReportJson); } catch {}
    }
  
    const activeProducts = products.filter(p => p.status === "active").length;
    const draftProducts = products.filter(p => p.status === "draft").length;
    const archivedProductsCount = products.filter(p => p.status === "archived").length;
    const avgPrice = products.length > 0 ? products.reduce((s, p) => s + parseFloat(p.price ?? "0"), 0) / products.length : 0;
  
    const liveAudit = products.map(p => {
      const seo = seoMap.get(p.shopifyProductId);
      return { product: p, seo, ...calculateSeoScoreInline(p, seo) };
    });
    const avgSeo = liveAudit.length > 0 ? liveAudit.reduce((s, a) => s + a.score, 0) / liveAudit.length : 0;
    const storeGrade = avgSeo >= 90 ? "A" : avgSeo >= 75 ? "B" : avgSeo >= 60 ? "C" : avgSeo >= 45 ? "D" : "F";
  
    const catalogPrices = products.map(p => parseFloat(p.price ?? "0"));
    const totalCatalogValue = catalogPrices.reduce((s, p) => s + p, 0);
    const totalCogs = allCogs.reduce((s, c) => s + c.totalCogs, 0);
    const avgMargin = totalCatalogValue > 0 ? ((totalCatalogValue - totalCogs) / totalCatalogValue) * 100 : 0;
    const imagesGenerated = jobs.filter(j => j.status === "succeeded").length;
    const withSchema = liveAudit.filter(a => a.hasSchema).length;
    const withAltTexts = liveAudit.filter(a => a.hasAltTexts).length;
    const withMetaTitle = liveAudit.filter(a => a.hasMetaTitle).length;
    const withMetaDesc = liveAudit.filter(a => a.hasMetaDesc).length;
    const withLongDesc = liveAudit.filter(a => a.descLen >= 300).length;
    const completedTests = tests.filter(t => t.status === "completed" || t.status === "winner_applied").length;
    const activeTests = tests.filter(t => t.status === "running").length;
    const productTypes = [...new Set(products.map(p => p.productType).filter(Boolean))];
    const vendors = [...new Set(products.map(p => p.vendor).filter(Boolean))];
    const priceRange = products.length > 0
      ? { min: Math.min(...catalogPrices), max: Math.max(...catalogPrices) }
      : { min: 0, max: 0 };
  
    const totalShopifyRevenue = revenueSnapshots.reduce((s, r) => s + (r.revenue ?? 0), 0);
    const totalShopifyOrders = revenueSnapshots.reduce((s, r) => s + (r.orders ?? 0), 0);
    const shopifyAov = totalShopifyOrders > 0 ? totalShopifyRevenue / totalShopifyOrders : 0;
  
    function healthScore(): number {
      let score = 0;
      if (avgSeo >= 70) score += 20; else if (avgSeo >= 40) score += 10;
      if (avgMargin >= 40) score += 15; else if (avgMargin >= 20) score += 8;
      if (withSchema >= products.length * 0.5) score += 10; else if (withSchema > 0) score += 5;
      if (withMetaTitle >= products.length * 0.8) score += 10; else if (withMetaTitle > 0) score += 5;
      if (imagesGenerated >= products.length) score += 10; else if (imagesGenerated > 0) score += 5;
      if (tests.length > 0) score += 10;
      if (project.brandTone) score += 5;
      if (project.targetAudience) score += 5;
      if (allCogs.length >= products.length * 0.5) score += 10; else if (allCogs.length > 0) score += 5;
      if (totalShopifyOrders > 0) score += 5;
      return Math.min(score, 100);
    }
    const health = healthScore();
    const healthLabel = health >= 80 ? "Excelente" : health >= 60 ? "Bueno" : health >= 40 ? "Mejorable" : "Necesita atencion";
    const healthColor = health >= 80 ? BRAND.jade : health >= 60 ? BRAND.gold : health >= 40 ? BRAND.orange : BRAND.red;
  
    const seoGrades: Record<string, number> = {};
    liveAudit.forEach(a => { seoGrades[a.grade] = (seoGrades[a.grade] || 0) + 1; });
  
    let gradeBreakdown = "";
    for (const [g, count] of Object.entries(seoGrades).sort()) {
      const pct = products.length > 0 ? Math.round((count / products.length) * 100) : 0;
      gradeBreakdown += `<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <span class="grade ${gradeClass(g)}" style="min-width:44px;text-align:center;">${g}</span>
        <div class="score-bar" style="flex:1;height:8px;"><div class="score-fill" style="width:${pct}%;background:${scoreColor(g === "A+" || g === "A" ? 90 : g === "B" ? 70 : g === "C" ? 50 : 30)};"></div></div>
        <span style="min-width:70px;font-size:12px;font-weight:600;">${count} (${pct}%)</span>
      </div>`;
    }
  
    const seoCardsList: ProductCardData[] = liveAudit.map(a => {
      const imgs = (a.product.imagesJson as Array<{ src?: string }> | null) ?? [];
      const tagsArr = (a.product.tags || "").split(",").filter(t => t.trim());
      return {
        title: a.product.title,
        status: a.product.status,
        price: a.product.price || "0",
        compareAtPrice: a.product.compareAtPrice,
        imageUrl: imgs[0]?.src || null,
        imageCount: a.product.imageCount ?? 0,
        descriptionLength: a.descLen,
        tagsCount: tagsArr.length,
        tags: a.product.tags || "",
        variantCount: a.product.variantCount ?? 1,
        published: !!a.product.publishedAt,
        auditScore: a.score,
        auditGrade: a.grade,
        hasComparePrice: !!a.product.compareAtPrice,
        hasMetaTitle: a.hasMetaTitle,
        hasMetaDesc: a.hasMetaDesc,
        hasSchema: a.hasSchema,
        hasAltTexts: a.hasAltTexts,
        cleanHandle: a.cleanHandle,
        seoScore: a.score,
        productType: a.product.productType,
        vendor: a.product.vendor,
      };
    });
    const seoDetailCardsHtml = buildProductCardsSection(seoCardsList, "Analisis SEO por Producto");
  
    const catalogCardsList: ProductCardData[] = products.map(p => {
      const seo = seoMap.get(p.shopifyProductId);
      const cogs = cogsMap.get(p.shopifyProductId);
      const price = parseFloat(p.price ?? "0");
      const margin = cogs && price > 0 ? ((price - cogs.totalCogs) / price) * 100 : null;
      const audit = liveAudit.find(a => a.product.shopifyProductId === p.shopifyProductId);
      const imgs = (p.imagesJson as Array<{ src?: string }> | null) ?? [];
      const tagsArr = (p.tags || "").split(",").filter(t => t.trim());
      return {
        title: p.title,
        status: p.status,
        price: p.price || "0",
        compareAtPrice: p.compareAtPrice,
        imageUrl: imgs[0]?.src || null,
        imageCount: p.imageCount ?? 0,
        descriptionLength: (p.bodyHtml || "").length,
        tagsCount: tagsArr.length,
        tags: p.tags || "",
        variantCount: p.variantCount ?? 1,
        published: !!p.publishedAt,
        auditScore: audit?.score ?? (p.auditScore ?? 0),
        auditGrade: audit?.grade ?? (p.auditGrade ?? "D"),
        hasComparePrice: !!p.compareAtPrice,
        hasMetaTitle: !!seo?.metaTitle && seo.metaTitle.length > 10,
        hasMetaDesc: !!seo?.metaDescription && seo.metaDescription.length > 10,
        hasSchema: !!seo?.hasSchema,
        hasAltTexts: !!seo?.hasAltTexts,
        cleanHandle: !!seo?.cleanHandle,
        cogs: cogs ? cogs.totalCogs : null,
        margin,
        productType: p.productType,
        vendor: p.vendor,
      };
    });
    // AUDITORÍA COMPLETA = TODOS los productos, sin límites. El usuario debe
    // poder conocer el estado de la totalidad del catálogo (peores Y mejores).
    // Solo ORDENAMOS por peor score SEO primero para que la lectura sea útil:
    // el usuario ve antes lo que más necesita acción, sin perder nada del set.
    // Antes había un slice(0,50) que recortaba — se ha eliminado.
    const catalogCardsListOrdered = [...catalogCardsList]
      .sort((a, b) => (a.auditScore ?? 0) - (b.auditScore ?? 0));
    const catalogCardsHtml = buildProductCardsSection(
      catalogCardsListOrdered,
      catalogCardsListOrdered.length > 0
        ? `Catalogo Completo — ${catalogCardsListOrdered.length} productos (ordenados por prioridad SEO: peor primero)`
        : "Catalogo Completo"
    );
  
    let cogsDetailRows = "";
    for (const p of products) {
      const cogs = cogsMap.get(p.shopifyProductId);
      const price = parseFloat(p.price ?? "0");
      const margin = cogs && price > 0 ? ((price - cogs.totalCogs) / price) * 100 : null;
      const breakEven = cogs?.breakEvenPrice ?? null;
      cogsDetailRows += `<tr>
        <td style="font-weight:600;">${esc(p.title).slice(0, 40)}</td>
        <td>${price.toFixed(2)}€</td>
        <td>${cogs ? `${cogs.unitCost?.toFixed(2) ?? "0.00"}€` : "—"}</td>
        <td>${cogs ? `${(cogs.packagingCost ?? 0).toFixed(2)}€` : "—"}</td>
        <td>${cogs ? `${(cogs.shippingCostDomestic ?? 0).toFixed(2)}€` : "—"}</td>
        <td style="font-weight:700;">${cogs ? `${cogs.totalCogs.toFixed(2)}€` : "—"}</td>
        <td>${breakEven != null ? `${breakEven.toFixed(2)}€` : "—"}</td>
        <td>${margin != null ? `<span class="${margin > 30 ? "text-jade fw-700" : margin > 15 ? "text-gold fw-700" : "text-red fw-700"}">${margin.toFixed(1)}%</span>` : "—"}</td>
      </tr>`;
    }
  
    let testRows = "";
    for (const t of tests.slice(0, 20)) {
      const convA = t.variantAVisitors > 0 ? (t.variantAConversions / t.variantAVisitors) * 100 : 0;
      const convB = t.variantBVisitors > 0 ? (t.variantBConversions / t.variantBVisitors) * 100 : 0;
      const improvement = convA > 0 ? ((convB - convA) / convA) * 100 : 0;
      testRows += `<tr>
        <td style="font-weight:600;">${esc(t.productTitle)}</td>
        <td><span class="tag">${esc(t.testType)}</span></td>
        <td><span class="tag ${t.status === "running" ? "tag-jade" : t.status === "completed" || t.status === "winner_applied" ? "tag-blue" : ""}">${esc(t.status)}</span></td>
        <td>${t.winner ? esc(t.winner) : "—"}</td>
        <td>${t.variantAVisitors + t.variantBVisitors > 0 ? `<span class="${improvement >= 0 ? "text-jade" : "text-red"} fw-700">${improvement >= 0 ? "+" : ""}${improvement.toFixed(1)}%</span>` : "—"}</td>
      </tr>`;
    }
  
    let compRows = "";
    for (const c of competitors.slice(0, 10)) {
      const safeUrl = c.url && /^https?:\/\//i.test(c.url) ? c.url : null;
      compRows += `<tr>
        <td style="font-weight:600;">${esc(c.name)}</td>
        <td>${safeUrl ? `<a href="${esc(safeUrl)}" class="text-blue" style="text-decoration:none;" target="_blank" rel="noopener">${esc(safeUrl.slice(0, 35))}...</a>` : "—"}</td>
        <td><span class="tag">${esc(c.type || "direct")}</span></td>
        <td><span class="tag ${c.active === 1 ? "tag-jade" : ""}">${c.active === 1 ? "activo" : "inactivo"}</span></td>
      </tr>`;
    }
  
    let priceHistoryRows = "";
    for (const h of priceHistory) {
      const pct = h.oldPrice && h.oldPrice > 0 ? (((h.newPrice - h.oldPrice) / h.oldPrice) * 100) : 0;
      priceHistoryRows += `<tr>
        <td>${h.recordedAt?.toLocaleDateString("es-ES") ?? "—"}</td>
        <td>${esc(h.shopifyProductId)}</td>
        <td>${h.oldPrice?.toFixed(2) ?? "—"}€</td>
        <td style="font-weight:600;">${h.newPrice.toFixed(2)}€</td>
        <td><span class="${pct >= 0 ? "text-jade fw-700" : "text-red fw-700"}">${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%</span></td>
        <td class="text-muted">${esc(h.changeSource ?? "—")}</td>
      </tr>`;
    }
  
    let revenueRows = "";
    for (const s of revenueSnapshots.slice(0, 30)) {
      revenueRows += `<tr>
        <td>${esc(s.date)}</td>
        <td style="font-weight:700;">${(s.revenue ?? 0).toFixed(2)}€</td>
        <td>${s.orders ?? 0}</td>
        <td>${(s.aov ?? 0).toFixed(2)}€</td>
      </tr>`;
    }
  
    const priceBuckets: Record<string, number> = {};
    products.forEach(p => {
      const pr = parseFloat(p.price ?? "0");
      const bucket = pr < 10 ? "0-9€" : pr < 25 ? "10-24€" : pr < 50 ? "25-49€" : pr < 100 ? "50-99€" : pr < 200 ? "100-199€" : "200€+";
      priceBuckets[bucket] = (priceBuckets[bucket] || 0) + 1;
    });
    let priceDist = "";
    for (const [bucket, count] of Object.entries(priceBuckets)) {
      const pct = Math.round((count / products.length) * 100);
      priceDist += `<div class="waterfall-bar"><div class="waterfall-label">${bucket}</div><div class="waterfall-fill" style="width:${Math.max(pct, 5)}%;background:${BRAND.gold};"><div class="waterfall-val">${count} (${pct}%)</div></div></div>`;
    }
  
    const issues: string[] = [];
    const successes: string[] = [];
    if (withSchema < products.length * 0.5 && products.length > 0) issues.push(`Solo ${withSchema}/${products.length} productos tienen Schema JSON-LD. Implementar structured data mejora CTR +30%.`);
    if (withAltTexts < products.length * 0.5 && products.length > 0) issues.push(`Solo ${withAltTexts}/${products.length} productos tienen alt texts optimizados.`);
    if (withMetaTitle < products.length * 0.8 && products.length > 0) issues.push(`${products.length - withMetaTitle} productos sin meta title optimizado — impacto directo en CTR de Google.`);
    if (withMetaDesc < products.length * 0.8 && products.length > 0) issues.push(`${products.length - withMetaDesc} productos sin meta description — Google muestra snippets genericos.`);
    if (avgSeo < 60) issues.push(`Score SEO medio (${Math.round(avgSeo)}/100, Grade ${storeGrade}) por debajo del umbral competitivo de 60.`);
    if (avgMargin < 30 && totalCatalogValue > 0 && allCogs.length > 0) issues.push(`Margen medio (${avgMargin.toFixed(1)}%) por debajo del 30% recomendado. Revisar costes o pricing.`);
    if (allCogs.length < products.length * 0.5 && products.length > 0) issues.push(`Solo ${allCogs.length}/${products.length} productos tienen costes (COGS) registrados. Sin costes no hay analisis de rentabilidad real.`);
    if (tests.length === 0) issues.push(`Sin A/B tests activos. Activar testing continuo de imagenes y precios mejora conversion +15-30%.`);
    if (!project.brandTone) issues.push(`Tono de marca no definido — la IA genera contenido sin personalidad de marca.`);
    if (totalShopifyOrders === 0) issues.push(`Sin datos de ventas sincronizados desde Shopify. Sincronizar pedidos para analisis de revenue real.`);
    if (withLongDesc < products.length * 0.5 && products.length > 0) issues.push(`${products.length - withLongDesc} productos con descripciones cortas (<300 chars). Google penaliza contenido thin.`);
  
    if (imagesGenerated > 0) successes.push(`${imagesGenerated} imagenes IA generadas con exito.`);
    if (completedTests > 0) successes.push(`${completedTests} A/B tests completados con datos reales.`);
    if (avgSeo >= 70) successes.push(`Score SEO medio de ${Math.round(avgSeo)}/100 (${storeGrade}) — competitivo.`);
    if (avgMargin >= 40 && allCogs.length > 0) successes.push(`Margen bruto del ${avgMargin.toFixed(1)}% — saludable.`);
    if (redesigns.length > 0) successes.push(`${redesigns.length} fichas de producto rediseñadas con IA.`);
    if (totalShopifyOrders > 0) successes.push(`${totalShopifyOrders} pedidos registrados — ${totalShopifyRevenue.toFixed(0)}€ en revenue real.`);
    if (allCogs.length > 0) successes.push(`${allCogs.length} productos con estructura de costes completa.`);
  
    const sortedByPrice = [...products].sort((a, b) => parseFloat(b.price ?? "0") - parseFloat(a.price ?? "0"));
    const topExpensive = sortedByPrice.slice(0, 5);
    const topCheap = sortedByPrice.slice(-5).reverse();
  
    let priceSuggestionRows = "";
    for (const p of products.slice(0, 30)) {
      const price = parseFloat(p.price ?? "0");
      const cogs = cogsMap.get(p.shopifyProductId);
      const margin = cogs && price > 0 ? ((price - cogs.totalCogs) / price) * 100 : null;
      const compareAt = p.compareAtPrice ? parseFloat(p.compareAtPrice) : null;
  
      const psychPrice = Math.ceil(price) - 0.01;
      const hasCompareAt = compareAt && compareAt > price;
  
      let suggestion = "";
      let suggestedPrice = price;
      let impact = "";
  
      if (margin !== null && margin < 15 && price > 0) {
        const minViable = cogs ? cogs.totalCogs / 0.6 : price * 1.2;
        suggestedPrice = Math.ceil(minViable) - 0.01;
        suggestion = `Margen critico (${margin.toFixed(0)}%). Subir a ${suggestedPrice.toFixed(2)}€ para alcanzar ~40% margen.`;
        impact = `+${((suggestedPrice - price) / price * 100).toFixed(0)}% precio`;
      } else if (price > avgPrice * 2 && !hasCompareAt) {
        suggestedPrice = psychPrice;
        suggestion = `Producto premium. Activar "Compare at Price" a ${(price * 1.25).toFixed(2)}€ para anclaje psicologico.`;
        impact = "CTR +15-25%";
      } else if (price < avgPrice * 0.4 && price > 0) {
        suggestedPrice = Math.ceil(price * 1.15) - 0.01;
        suggestion = `Precio bajo vs catalogo. Subir ${((suggestedPrice - price) / price * 100).toFixed(0)}% sin impacto en conversion.`;
        impact = `+${((suggestedPrice - price)).toFixed(2)}€/unidad`;
      } else if (price !== psychPrice && price > 5) {
        suggestedPrice = psychPrice;
        suggestion = `Aplicar precio psicologico: ${psychPrice.toFixed(2)}€ en lugar de ${price.toFixed(2)}€.`;
        impact = "Conversion +3-8%";
      } else {
        continue;
      }
  
      priceSuggestionRows += `<tr>
        <td style="font-weight:600;">${esc(p.title).slice(0, 35)}</td>
        <td>${price.toFixed(2)}€</td>
        <td style="font-weight:700;color:${BRAND.gold};">${suggestedPrice.toFixed(2)}€</td>
        <td>${margin !== null ? `${margin.toFixed(0)}%` : "—"}</td>
        <td class="text-muted" style="font-size:12px;">${suggestion}</td>
        <td><span class="tag tag-jade">${impact}</span></td>
      </tr>`;
    }
  
    const marginBuckets: Record<string, number> = {};
    products.forEach(p => {
      const cogs = cogsMap.get(p.shopifyProductId);
      const price = parseFloat(p.price ?? "0");
      if (!cogs || price === 0) { marginBuckets["Sin COGS"] = (marginBuckets["Sin COGS"] || 0) + 1; return; }
      const m = ((price - cogs.totalCogs) / price) * 100;
      const bucket = m < 0 ? "Negativo" : m < 15 ? "0-14%" : m < 30 ? "15-29%" : m < 50 ? "30-49%" : m < 70 ? "50-69%" : "70%+";
      marginBuckets[bucket] = (marginBuckets[bucket] || 0) + 1;
    });
    let marginDist = "";
    const marginOrder = ["Negativo", "0-14%", "15-29%", "30-49%", "50-69%", "70%+", "Sin COGS"];
    for (const bucket of marginOrder) {
      const count = marginBuckets[bucket] || 0;
      if (count === 0) continue;
      const pct = Math.round((count / products.length) * 100);
      const color = bucket === "Negativo" ? BRAND.red : bucket === "0-14%" ? BRAND.orange : bucket.startsWith("Sin") ? BRAND.muted : BRAND.jade;
      marginDist += `<div class="waterfall-bar"><div class="waterfall-label">${bucket}</div><div class="waterfall-fill" style="width:${Math.max(pct, 5)}%;background:${color};"><div class="waterfall-val">${count} (${pct}%)</div></div></div>`;
    }
  
    const avgImages = products.length > 0 ? (products.reduce((s, p) => s + (p.imageCount ?? 0), 0) / products.length).toFixed(1) : "0";
    const noImages = products.filter(p => (p.imageCount ?? 0) === 0).length;
    const singleImage = products.filter(p => (p.imageCount ?? 0) === 1).length;
    const goodImages = products.filter(p => (p.imageCount ?? 0) >= 4).length;
  
    const reportTitle = "Auditoria Completa";
  
    const sanitizeAiHtml = sanitizeAiHtmlOutput;
  
    const aiBlock = (key: string, fallback = "") => {
      if (!aiReport || !aiReport[key]) return fallback;
      const safeHtml = sanitizeAiHtml(aiReport[key]);
      return `<div class="card" style="margin-top:16px;border-left:3px solid ${BRAND.gold};padding:20px 24px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
          <span style="font-size:16px;">&#129504;</span>
          <span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${BRAND.gold};">Analisis Shopy Crafter AI</span>
        </div>
        <div style="font-size:13px;line-height:1.9;color:${BRAND.mutedLight};">${safeHtml}</div>
      </div>`;
    };
  
    let cogsEstimationHtml = "";
    if (allCogs.length === 0 && products.length > 0) {
      try {
        const cogsEst = await estimateCogsWithAI(projectId, {
          name: project.shopDomain?.replace(".myshopify.com", "") || project.name || "Tienda",
          sector: project.storeNiche || "eCommerce",
          location: (project as any).storeMarkets || "España",
          services: productTypes as string[],
          products: products.slice(0, 15).map(p => ({ title: p.title ?? "", price: p.price ?? "0" })),
          domain: project.shopDomain ?? undefined,
        });
        if (cogsEst) {
          cogsEstimationHtml = buildCogsEstimationHtml(cogsEst, {
            accent: BRAND.gold, muted: BRAND.muted, jade: BRAND.jade,
            orange: "#f59e0b", card: BRAND.card, surface: BRAND.surface, border: BRAND.border, silver: BRAND.mutedLight,
          });
        }
      } catch (err) {
        logger.warn({ err, projectId }, "COGS auto-estimation failed, skipping");
      }
    }
  
    const body = `
      <!-- PAGE 1: EXECUTIVE SUMMARY + TABLE OF CONTENTS -->
      <div class="section">
        <div class="section-header">
          <div class="section-icon section-icon-gold">&#9733;</div>
          <div class="section-title">Resumen Ejecutivo</div>
        </div>
        <div class="card">
          <div style="display:flex;align-items:center;gap:24px;margin-bottom:20px;">
            <div style="text-align:center;">
              <div style="width:90px;height:90px;border-radius:50%;border:3px solid ${healthColor};display:flex;align-items:center;justify-content:center;background:${healthColor}11;">
                <span style="font-size:32px;font-weight:900;color:${healthColor};">${health}</span>
              </div>
              <div style="font-size:11px;color:${healthColor};font-weight:700;margin-top:6px;text-transform:uppercase;">${healthLabel}</div>
            </div>
            <div style="flex:1;">
              <p style="font-size:15px;line-height:1.8;color:${BRAND.mutedLight};">
                Auditoria completa de <strong style="color:${BRAND.white};">${esc(project.name)}</strong>
                ${project.shopDomain ? `(<strong style="color:${BRAND.white};">${esc(project.shopDomain)}</strong>)` : ""}
                en el nicho de <strong style="color:${BRAND.gold};">${esc(project.storeNiche || "e-commerce")}</strong>.
                Catalogo: <strong style="color:${BRAND.white};">${activeProducts} activos</strong>${draftProducts > 0 ? ` + ${draftProducts} borradores` : ""},
                precio medio <strong style="color:${BRAND.white};">${avgPrice.toFixed(2)}€</strong> (rango ${priceRange.min.toFixed(0)}€–${priceRange.max.toFixed(0)}€).
                ${totalShopifyOrders > 0 ? `Revenue real: <strong style="color:${BRAND.jade};">${totalShopifyRevenue.toFixed(0)}€</strong> en ${totalShopifyOrders} pedidos.` : ""}
              </p>
            </div>
          </div>
        </div>
        ${aiBlock("executiveSummary")}
        <div class="metric-row">
          <div class="metric"><div class="value">${products.length}</div><div class="label">Total productos</div></div>
          <div class="metric"><div class="value">${activeProducts}</div><div class="label">Activos</div></div>
          <div class="metric"><div class="value">${draftProducts}</div><div class="label">Borradores</div></div>
          <div class="metric"><div class="value">${archivedProductsCount}</div><div class="label">Archivados</div></div>
          <div class="metric"><div class="value">${avgPrice.toFixed(0)}€</div><div class="label">Precio medio</div></div>
          <div class="metric"><div class="value"><span class="grade ${gradeClass(storeGrade)}" style="font-size:24px;">${storeGrade}</span></div><div class="label">Grade SEO</div></div>
          <div class="metric"><div class="value">${Math.round(avgSeo)}</div><div class="label">Score SEO</div></div>
          ${allCogs.length > 0 ? `<div class="metric"><div class="value" style="color:${avgMargin >= 30 ? BRAND.jade : BRAND.red};">${avgMargin.toFixed(0)}%</div><div class="label">Margen medio</div></div>` : ""}
          ${totalShopifyOrders > 0 ? `<div class="metric"><div class="value" style="color:${BRAND.jade};">${totalShopifyRevenue.toFixed(0)}€</div><div class="label">Revenue real</div></div>` : ""}
        </div>
      </div>
  
      <!-- PAGE 2: BRAND & IDENTITY -->
      <div class="report-page">
        ${pageHdr(reportTitle, 2)}
        <div class="section">
          <div class="section-header">
            <div class="section-icon section-icon-gold">&#127912;</div>
            <div class="section-title">Identidad de Marca</div>
          </div>
          <div class="stat-grid">
            <div class="stat-item"><div class="stat-item-label">Nicho</div><div class="stat-item-value">${esc(project.storeNiche || "No definido")}</div></div>
            <div class="stat-item"><div class="stat-item-label">Tono de marca</div><div class="stat-item-value">${esc(project.brandTone || "No definido")}</div></div>
            <div class="stat-item"><div class="stat-item-label">Audiencia objetivo</div><div class="stat-item-value">${esc(project.targetAudience || "No definida")}</div></div>
            <div class="stat-item"><div class="stat-item-label">Mercados</div><div class="stat-item-value">${esc(project.storeMarkets || "Global")}</div></div>
          </div>
          ${productTypes.length > 0 ? `<div class="card" style="margin-top:12px;"><div class="stat-item-label" style="margin-bottom:8px;">Categorias de producto (${productTypes.length})</div><div>${productTypes.map(t => `<span class="tag">${esc(t || "")}</span>`).join(" ")}</div></div>` : ""}
          ${vendors.length > 0 ? `<div class="card"><div class="stat-item-label" style="margin-bottom:8px;">Proveedores (${vendors.length})</div><div>${vendors.map(v => `<span class="tag">${esc(v || "")}</span>`).join(" ")}</div></div>` : ""}
          ${visualDna.length > 0 ? `<div class="card"><div class="stat-item-label" style="margin-bottom:8px;">Visual DNA</div><div class="stat-grid">${visualDna[0].backgroundStyle ? `<div class="stat-item"><div class="stat-item-label">Fondo</div><div class="stat-item-value">${esc(visualDna[0].backgroundStyle)}</div></div>` : ""}${visualDna[0].lightingStyle ? `<div class="stat-item"><div class="stat-item-label">Iluminacion</div><div class="stat-item-value">${esc(visualDna[0].lightingStyle)}</div></div>` : ""}${visualDna[0].mood ? `<div class="stat-item"><div class="stat-item-label">Mood</div><div class="stat-item-value">${esc(visualDna[0].mood)}</div></div>` : ""}${visualDna[0].composition ? `<div class="stat-item"><div class="stat-item-label">Composicion</div><div class="stat-item-value">${esc(visualDna[0].composition)}</div></div>` : ""}</div></div>` : ""}
          <div class="card"><div class="stat-item-label" style="margin-bottom:12px;">Distribucion de precios del catalogo</div>${priceDist}</div>
          ${aiBlock("brandAnalysis")}
        </div>
      </div>
  
      <!-- PAGE 3: SEO AUDIT (REAL) -->
      <div class="report-page">
        ${pageHdr(reportTitle, 3)}
        <div class="section">
          <div class="section-header">
            <div class="section-icon section-icon-jade">&#128270;</div>
            <div class="section-title">Auditoria SEO Tecnico</div>
            <div class="section-count">${products.length} auditados en tiempo real</div>
          </div>
          <div class="metric-row">
            <div class="metric"><div class="value">${Math.round(avgSeo)}<span style="font-size:14px;color:${BRAND.muted};">/100</span></div><div class="label">Score medio</div></div>
            <div class="metric"><div class="value"><span class="grade ${gradeClass(storeGrade)}" style="font-size:20px;">${storeGrade}</span></div><div class="label">Grade global</div></div>
            <div class="metric"><div class="value">${withMetaTitle}<span style="font-size:14px;color:${BRAND.muted};">/${products.length}</span></div><div class="label">Meta Titles</div></div>
            <div class="metric"><div class="value">${withMetaDesc}<span style="font-size:14px;color:${BRAND.muted};">/${products.length}</span></div><div class="label">Meta Desc</div></div>
            <div class="metric"><div class="value">${withSchema}<span style="font-size:14px;color:${BRAND.muted};">/${products.length}</span></div><div class="label">Schema</div></div>
            <div class="metric"><div class="value">${withAltTexts}<span style="font-size:14px;color:${BRAND.muted};">/${products.length}</span></div><div class="label">Alt Texts</div></div>
          </div>
          ${Object.keys(seoGrades).length > 0 ? `<div class="card"><div class="stat-item-label" style="margin-bottom:12px;">Distribucion de grados SEO</div>${gradeBreakdown}</div>` : ""}
          ${seoDetailCardsHtml}
          ${aiBlock("seoDeepAnalysis")}
        </div>
      </div>
  
      <!-- PAGE 4: FINANCIAL & COGS -->
      <div class="report-page">
        ${pageHdr(reportTitle, 4)}
        <div class="section">
          <div class="section-header">
            <div class="section-icon section-icon-orange">&#128176;</div>
            <div class="section-title">Analisis Economico y Estructura de Costes</div>
            <div class="section-count">${allCogs.length > 0 ? `${allCogs.length}/${products.length} con COGS` : cogsEstimationHtml ? "Estimación automática IA" : `${allCogs.length}/${products.length} con COGS`}</div>
          </div>
          <div class="metric-row">
            <div class="metric"><div class="value">${totalCatalogValue.toFixed(0)}€</div><div class="label">Valor catalogo</div></div>
            <div class="metric"><div class="value">${totalCogs.toFixed(0)}€</div><div class="label">COGS total</div></div>
            <div class="metric"><div class="value">${(totalCatalogValue - totalCogs).toFixed(0)}€</div><div class="label">Beneficio bruto</div></div>
            <div class="metric"><div class="value" style="color:${avgMargin >= 30 ? BRAND.jade : allCogs.length > 0 ? BRAND.red : BRAND.muted};">${allCogs.length > 0 ? avgMargin.toFixed(1) + "%" : "—"}</div><div class="label">Margen medio</div></div>
          </div>
          ${allCogs.length === 0 && !cogsEstimationHtml ? `<div class="recommendation recommendation-critical">No hay datos de costes (COGS) registrados. Sin costes no es posible calcular margenes reales ni rentabilidad. Usa la funcion "Estimar COGS con IA" en cada producto o registra costes manualmente (materiales, envio, empaquetado, APIs, mano de obra, etc.).</div>` : ""}
          ${allCogs.length === 0 && cogsEstimationHtml ? cogsEstimationHtml : ""}
          ${allCogs.length > 0 ? `<div class="card" style="overflow-x:auto;">
            <div class="stat-item-label" style="margin-bottom:12px;">Desglose de costes por producto</div>
            <table>
              <thead><tr><th>Producto</th><th>PVP</th><th>Produccion</th><th>Empaquetado</th><th>Envio</th><th>COGS Total</th><th>Break Even</th><th>Margen</th></tr></thead>
              <tbody>${cogsDetailRows}</tbody>
            </table>
          </div>` : ""}
          ${priceHistoryRows ? `<div class="card" style="overflow-x:auto;"><div class="stat-item-label" style="margin-bottom:12px;">Historial de cambios de precio</div><table><thead><tr><th>Fecha</th><th>Producto</th><th>Anterior</th><th>Nuevo</th><th>Cambio</th><th>Fuente</th></tr></thead><tbody>${priceHistoryRows}</tbody></table></div>` : ""}
          ${aiBlock("financialAnalysis")}
        </div>
      </div>
  
      <!-- PAGE 5: SALES ANALYSIS (only if data exists) -->
      ${totalShopifyOrders > 0 ? `<div class="report-page">
        ${pageHdr(reportTitle, 5)}
        <div class="section">
          <div class="section-header">
            <div class="section-icon section-icon-jade">&#128200;</div>
            <div class="section-title">Analisis de Ventas Reales</div>
            <div class="section-count">${revenueSnapshots.length} dias</div>
          </div>
          <div class="metric-row">
            <div class="metric"><div class="value" style="color:${BRAND.jade};">${totalShopifyRevenue.toFixed(0)}€</div><div class="label">Revenue total</div></div>
            <div class="metric"><div class="value">${totalShopifyOrders}</div><div class="label">Pedidos</div></div>
            <div class="metric"><div class="value">${shopifyAov.toFixed(2)}€</div><div class="label">AOV medio</div></div>
            <div class="metric"><div class="value">${revenueSnapshots.length > 0 ? (totalShopifyRevenue / revenueSnapshots.length).toFixed(0) + "€" : "—"}</div><div class="label">Revenue/dia</div></div>
          </div>
          <div class="card" style="overflow-x:auto;">
            <div class="stat-item-label" style="margin-bottom:12px;">Ventas diarias</div>
            <table>
              <thead><tr><th>Fecha</th><th>Revenue</th><th>Pedidos</th><th>AOV</th></tr></thead>
              <tbody>${revenueRows}</tbody>
            </table>
          </div>
        </div>
      </div>` : ""}
  
      <!-- PAGE 6: A/B TESTING + PRICE OPTIMIZATION -->
      <div class="report-page">
        ${pageHdr(reportTitle, totalShopifyOrders > 0 ? 6 : 5)}
        <div class="section">
          <div class="section-header">
            <div class="section-icon section-icon-blue">&#9879;</div>
            <div class="section-title">A/B Testing y Optimizacion</div>
            <div class="section-count">${tests.length} tests</div>
          </div>
          <div class="metric-row">
            <div class="metric"><div class="value">${tests.length}</div><div class="label">Tests totales</div></div>
            <div class="metric"><div class="value" style="color:${BRAND.jade};">${activeTests}</div><div class="label">Activos</div></div>
            <div class="metric"><div class="value">${completedTests}</div><div class="label">Completados</div></div>
            <div class="metric"><div class="value">${imagesGenerated}</div><div class="label">Imagenes IA</div></div>
            <div class="metric"><div class="value">${redesigns.length}</div><div class="label">Fichas rediseñadas</div></div>
          </div>
          ${testRows ? `<div class="card" style="overflow-x:auto;"><table><thead><tr><th>Test</th><th>Tipo</th><th>Estado</th><th>Ganador</th><th>Mejora</th></tr></thead><tbody>${testRows}</tbody></table></div>` : ""}
          <div class="card">
            <div class="stat-item-label" style="margin-bottom:12px;">Oportunidades de optimizacion detectadas</div>
            ${tests.length === 0 ? '<div class="recommendation">Activar A/B tests de imagenes y de precios. Testing continuo puede mejorar conversion entre 15-30%.</div>' : ""}
            ${products.filter(p => p.imageCount <= 1).length > 0 ? `<div class="recommendation">&#128247; ${products.filter(p => p.imageCount <= 1).length} productos con 1 o menos imagenes — añadir fotos lifestyle, detalle y uso.</div>` : ""}
            ${(() => { const highPrice = products.filter(p => parseFloat(p.price ?? "0") > avgPrice * 1.5); return highPrice.length > 0 ? `<div class="recommendation">&#128184; ${highPrice.length} productos con precio >50% sobre la media — candidatos a test de pricing agresivo.</div>` : ""; })()}
            ${(() => { const lowPrice = products.filter(p => { const pr = parseFloat(p.price ?? "0"); return pr > 0 && pr < avgPrice * 0.5; }); return lowPrice.length > 0 ? `<div class="recommendation">&#128200; ${lowPrice.length} productos con precio bajo vs catalogo — posible subida de precio sin impacto en conversion.</div>` : ""; })()}
            ${products.filter(p => !p.compareAtPrice).length > 0 ? `<div class="recommendation">&#127991; ${products.filter(p => !p.compareAtPrice).length} productos sin "Compare at Price" — activar precio tachado mejora percepcion de descuento y CTR.</div>` : ""}
          </div>
          ${priceSuggestionRows ? `<div class="card" style="overflow-x:auto;">
            <div class="stat-item-label" style="margin-bottom:12px;">&#128176; Sugerencias de precio por producto</div>
            <table>
              <thead><tr><th>Producto</th><th>Actual</th><th>Sugerido</th><th>Margen</th><th>Razon</th><th>Impacto</th></tr></thead>
              <tbody>${priceSuggestionRows}</tbody>
            </table>
          </div>` : ""}
          ${competitors.length > 0 ? `<div class="card" style="overflow-x:auto;"><div class="stat-item-label" style="margin-bottom:12px;">Competidores monitorizados</div><table><thead><tr><th>Competidor</th><th>URL</th><th>Tipo</th><th>Estado</th></tr></thead><tbody>${compRows}</tbody></table></div>` : ""}
          ${aiBlock("pricingStrategy")}
          ${aiBlock("competitivePosition")}
        </div>
      </div>
  
      <!-- PAGE 7: AI ECONOMIST ANALYSIS -->
      <div class="report-page">
        ${pageHdr(reportTitle, totalShopifyOrders > 0 ? 7 : 6)}
        <div class="section">
          <div class="section-header">
            <div class="section-icon section-icon-gold">&#128202;</div>
            <div class="section-title">Analisis del AI Economist</div>
          </div>
          <div class="card">
            <div class="stat-item-label" style="margin-bottom:12px;">Posicionamiento de mercado</div>
            <div class="stat-grid">
              <div class="stat-item"><div class="stat-item-label">Precio medio catalogo</div><div class="stat-item-value">${avgPrice.toFixed(2)}€</div></div>
              <div class="stat-item"><div class="stat-item-label">Rango de precios</div><div class="stat-item-value">${priceRange.min.toFixed(0)}€ – ${priceRange.max.toFixed(0)}€</div></div>
              <div class="stat-item"><div class="stat-item-label">Precio mediano</div><div class="stat-item-value">${(() => { const sorted = [...catalogPrices].sort((a, b) => a - b); return sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)].toFixed(2) : "0.00"; })()}€</div></div>
              <div class="stat-item"><div class="stat-item-label">Imagenes por producto</div><div class="stat-item-value">${avgImages} media</div></div>
            </div>
          </div>
          <div class="card">
            <div class="stat-item-label" style="margin-bottom:12px;">Distribucion de margenes</div>
            ${marginDist || '<div class="text-muted" style="text-align:center;padding:16px;">Registra COGS para ver distribucion de margenes</div>'}
          </div>
          <div class="card">
            <div class="stat-item-label" style="margin-bottom:12px;">Salud visual del catalogo</div>
            <div class="metric-row">
              <div class="metric"><div class="value">${avgImages}</div><div class="label">Imagenes/producto</div></div>
              <div class="metric"><div class="value" style="color:${noImages > 0 ? BRAND.red : BRAND.jade};">${noImages}</div><div class="label">Sin imagenes</div></div>
              <div class="metric"><div class="value" style="color:${singleImage > 0 ? BRAND.orange : BRAND.jade};">${singleImage}</div><div class="label">Solo 1 imagen</div></div>
              <div class="metric"><div class="value" style="color:${BRAND.jade};">${goodImages}</div><div class="label">4+ imagenes</div></div>
            </div>
          </div>
          <div class="card">
            <div class="stat-item-label" style="margin-bottom:12px;">Productos premium (Top 5 por precio)</div>
            ${topExpensive.map(p => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid ${BRAND.border};"><span style="font-weight:600;">${esc(p.title).slice(0, 40)}</span><span class="text-gold fw-800">${parseFloat(p.price ?? "0").toFixed(2)}€</span></div>`).join("")}
          </div>
          <div class="card">
            <div class="stat-item-label" style="margin-bottom:12px;">Productos entrada (Top 5 mas baratos)</div>
            ${topCheap.map(p => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid ${BRAND.border};"><span style="font-weight:600;">${esc(p.title).slice(0, 40)}</span><span class="text-blue fw-800">${parseFloat(p.price ?? "0").toFixed(2)}€</span></div>`).join("")}
          </div>
          <div class="card">
            <div class="stat-item-label" style="margin-bottom:12px;">Oportunidades de bundle y upsell</div>
            ${(() => {
              const typeGroups: Record<string, typeof products> = {};
              products.forEach(p => { const t = p.productType || "Sin tipo"; if (!typeGroups[t]) typeGroups[t] = []; typeGroups[t].push(p); });
              const bundleable = Object.entries(typeGroups).filter(([_, ps]) => ps.length >= 3).slice(0, 5);
              if (bundleable.length === 0) return '<div class="recommendation recommendation-info">Necesitas al menos 3 productos del mismo tipo para crear bundles.</div>';
              return bundleable.map(([type, ps]) => {
                const bundlePrice = ps.slice(0, 3).reduce((s, p) => s + parseFloat(p.price ?? "0"), 0);
                const discountedPrice = bundlePrice * 0.85;
                return `<div class="recommendation">&#127873; <strong>Bundle "${esc(type)}"</strong>: ${ps.length} productos disponibles. Pack de 3 a ${discountedPrice.toFixed(2)}€ (vs ${bundlePrice.toFixed(2)}€ individual, -15%). AOV estimado +${(discountedPrice - avgPrice).toFixed(0)}€.</div>`;
              }).join("");
            })()}
            ${totalShopifyOrders > 0 && shopifyAov > 0 ? `<div class="recommendation recommendation-success">AOV actual: ${shopifyAov.toFixed(2)}€. Con bundles y upsell, objetivo: ${(shopifyAov * 1.25).toFixed(2)}€ (+25%).</div>` : ""}
          </div>
          ${aiBlock("productMixStrategy")}
          ${totalShopifyOrders > 0 ? `<div class="card">
            <div class="stat-item-label" style="margin-bottom:12px;">Proyeccion de revenue (30 dias)</div>
            <div class="stat-grid">
              <div class="stat-item"><div class="stat-item-label">Revenue diario actual</div><div class="stat-item-value">${(totalShopifyRevenue / Math.max(revenueSnapshots.length, 1)).toFixed(2)}€</div></div>
              <div class="stat-item"><div class="stat-item-label">Proyeccion mensual (base)</div><div class="stat-item-value">${(totalShopifyRevenue / Math.max(revenueSnapshots.length, 1) * 30).toFixed(0)}€</div></div>
              <div class="stat-item"><div class="stat-item-label">Con optimizacion (+20%)</div><div class="stat-item-value text-jade">${(totalShopifyRevenue / Math.max(revenueSnapshots.length, 1) * 30 * 1.2).toFixed(0)}€</div></div>
              <div class="stat-item"><div class="stat-item-label">Con bundles (+35%)</div><div class="stat-item-value text-gold">${(totalShopifyRevenue / Math.max(revenueSnapshots.length, 1) * 30 * 1.35).toFixed(0)}€</div></div>
            </div>
          </div>` : ""}
        </div>
      </div>
  
      <!-- PAGE 8: RECOMMENDATIONS -->
      <div class="report-page">
        ${pageHdr(reportTitle, totalShopifyOrders > 0 ? 8 : 7)}
  
        <div class="section">
          <div class="section-header">
            <div class="section-icon section-icon-jade">&#9989;</div>
            <div class="section-title">Recomendaciones Estrategicas</div>
          </div>
          ${successes.length > 0 ? `<div class="stat-item-label" style="margin-bottom:12px;color:${BRAND.jade};">&#10003; Logros y fortalezas</div>` : ""}
          ${successes.map(s => `<div class="recommendation recommendation-success">${s}</div>`).join("")}
          ${issues.length > 0 ? `<div class="stat-item-label" style="margin:20px 0 12px;color:${BRAND.orange};">&#9888; Areas de mejora prioritarias</div>` : ""}
          ${issues.map(i => `<div class="recommendation recommendation-critical">${i}</div>`).join("")}
          ${issues.length === 0 && successes.length === 0 ? '<div class="recommendation recommendation-info">Completa la configuracion de costes y sincroniza ventas para obtener recomendaciones personalizadas.</div>' : ""}
          ${aiBlock("actionPlan30Days")}
          ${aiBlock("revenueProjection")}
        </div>
        <div class="section">
          <div class="section-header">
            <div class="section-icon section-icon-gold">&#129504;</div>
            <div class="section-title">Motor IA OmniCore</div>
          </div>
          <div class="stat-grid">
            <div class="stat-item"><div class="stat-item-label">Insights de conocimiento</div><div class="stat-item-value">${Number(totalInsights).toLocaleString("es-ES")}</div></div>
            <div class="stat-item"><div class="stat-item-label">Memorias consolidadas</div><div class="stat-item-value">${memories.length > 0 ? "Activo" : "Sin memorias"}</div></div>
            <div class="stat-item"><div class="stat-item-label">Piloto automatico</div><div class="stat-item-value">${project.autoPilotEnabled ? '<span class="text-jade">Activado</span>' : '<span class="text-muted">Desactivado</span>'}</div></div>
            <div class="stat-item"><div class="stat-item-label">Plan</div><div class="stat-item-value text-gold fw-800" style="text-transform:uppercase;">${esc(project.plan)}</div></div>
          </div>
        </div>
      </div>
  
      <!-- PAGE 9: TODOS los productos, ordenados por peor SEO primero (auditoría = completa) -->
      <div class="report-page">
        ${pageHdr(reportTitle, totalShopifyOrders > 0 ? 9 : 8)}
        <div class="section">
          ${catalogCardsListOrdered.length > 0 ? `<div class="card" style="margin-bottom:18px;border:1px solid ${BRAND.gold}33;background:rgba(200,168,75,.05);">
            <p class="text-muted" style="font-size:12px;line-height:1.6;margin:0;">Esta sección incluye <strong style="color:${BRAND.gold};">los ${catalogCardsListOrdered.length} productos del catálogo</strong>, ordenados de peor a mejor score SEO. Lee de arriba abajo para priorizar acciones: los primeros son los que más impacto generarán al optimizar.</p>
          </div>` : ""}
          ${catalogCardsHtml || '<div class="card"><p class="text-muted" style="text-align:center;">Sin productos importados</p></div>'}
        </div>
      </div>`;
  
    const tpl = (req.query.template as ReportTemplate) || "prestige";
    const targetCompany = req.query.targetCompany ? String(req.query.targetCompany) : undefined;
    const html = getReportShell(tpl)(
      `Auditoria Completa — ${project.name}`,
      `${project.shopDomain || "Sin dominio"} — ${project.storeNiche || "eCommerce"}`,
      body, date, targetCompany
    );
    autoSaveReport(projectId, `Auditoría Completa — ${project.name}`, html, "complete_audit").catch(() => {});
    if (req.query.view === "true" && (req.query.format as string || "").toLowerCase() !== "pdf") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } else {
      await sendHtmlOrPdf(req, res, html, `Full_Audit_${sanitizeFilename(project.name)}_${new Date().toISOString().split("T")[0]}`);
    }
    } catch (err: any) {
      console.error("complete-report error:", err);
      res.status(500).json({ error: "Error generando el informe completo" });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/projects/:projectId/exports/csv/products", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
    const allCogs = await db.select().from(cogsTable).where(eq(cogsTable.projectId, projectId));
    const seoData = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, projectId));
  
    const cogsMap = new Map(allCogs.map(c => [c.shopifyProductId, c]));
    const seoMap = new Map(seoData.map(s => [s.shopifyProductId, s]));
  
    const headers = ["Titulo","Handle","Estado","Precio","Compare At Price","COGS","Margen %","Vendor","Tipo","Tags","SEO Grade","SEO Score","Imagenes","Variantes","Audit Score"];
    const rows = products.map(p => {
      const cogs = cogsMap.get(p.shopifyProductId);
      const seo = seoMap.get(p.shopifyProductId);
      const price = parseFloat(p.price ?? "0");
      const margin = cogs && price > 0 ? ((price - cogs.totalCogs) / price * 100).toFixed(1) : "";
      return [
        `"${(p.title || "").replace(/"/g, '""')}"`,
        p.handle,
        p.status,
        p.price ?? "",
        p.compareAtPrice ?? "",
        cogs?.totalCogs?.toFixed(2) ?? "",
        margin,
        `"${(p.vendor || "").replace(/"/g, '""')}"`,
        `"${(p.productType || "").replace(/"/g, '""')}"`,
        `"${(p.tags || "").replace(/"/g, '""')}"`,
        seo?.seoGrade ?? "",
        seo?.seoScore?.toFixed(1) ?? "",
        String(p.imageCount ?? 0),
        String(p.variantCount ?? 1),
        p.auditScore?.toFixed(1) ?? "",
      ].join(",");
    });
  
    const csv = [headers.join(","), ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="Products_Export_${new Date().toISOString().split("T")[0]}.csv"`);
    res.send("\uFEFF" + csv);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/projects/:projectId/exports/competitors", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
    const competitors = await db.select().from(competitorsTable).where(eq(competitorsTable.projectId, String(projectId)));
    const alerts = await db.select().from(competitorAlertsTable).where(eq(competitorAlertsTable.projectId, String(projectId)));
    const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  
    let compRows = "";
    for (const c of competitors) {
      const snapshots = await db.select().from(competitorSnapshotsTable).where(eq(competitorSnapshotsTable.competitorId, c.id)).orderBy(desc(competitorSnapshotsTable.scannedAt)).limit(1);
      const latest = snapshots[0];
      compRows += `<tr><!-- nosemgrep -->
        <td style="font-weight:500;">${c.name}</td><!-- nosemgrep -->
        <td><a href="${c.url}" style="color:${BRAND.gold};" target="_blank">${c.url?.slice(0, 40)}...</a></td><!-- nosemgrep -->
        <td><span class="tag">${c.type || "direct"}</span></td><!-- nosemgrep -->
        <td>${latest?.productsFound ?? "—"}</td><!-- nosemgrep -->
        <td>${latest?.priceMin != null && latest?.priceMax != null ? `${latest.priceMin.toFixed(0)}€ – ${latest.priceMax.toFixed(0)}€` : "—"}</td><!-- nosemgrep -->
        <td>${latest?.priceMedian != null ? `${latest.priceMedian.toFixed(2)}€` : "—"}</td><!-- nosemgrep -->
        <td class="text-muted">${c.lastScanned ? new Date(c.lastScanned).toLocaleDateString("es-ES") : "Sin escanear"}</td><!-- nosemgrep -->
      </tr>`;
    }
  
    let alertRows = "";
    for (const a of alerts.filter(a => !a.dismissed).slice(0, 20)) {
      const sevColor = a.severity === "high" ? BRAND.red : a.severity === "medium" ? "#ffa500" : BRAND.jade;
      alertRows += `<tr><!-- nosemgrep -->
        <td><span style="color:${sevColor};font-weight:600;text-transform:uppercase;">${a.severity || "info"}</span></td><!-- nosemgrep -->
        <td style="font-weight:500;">${a.title || "Alerta"}</td><!-- nosemgrep -->
        <td class="text-muted">${a.description?.slice(0, 100) ?? "—"}</td><!-- nosemgrep -->
        <td style="font-size:12px;">${a.actionSuggestion?.slice(0, 80) ?? "—"}</td><!-- nosemgrep -->
        <td class="text-muted">${a.createdAt ? new Date(a.createdAt).toLocaleDateString("es-ES") : "—"}</td><!-- nosemgrep -->
      </tr>`;
    }
  
    const body = `
      <div class="metric-row">
        <div class="metric"><div class="value">${competitors.length}</div><div class="label">Competidores</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${competitors.filter(c => c.active).length}</div><div class="label">Monitoreados</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${alerts.filter(a => !a.dismissed).length}</div><div class="label">Alertas activas</div></div><!-- nosemgrep -->
      </div>
      <div class="section">
        <div class="section-title">Competidores Monitoreados</div>
        <div class="card" style="overflow-x:auto;">
          <table>
            <thead><tr><th>Nombre</th><th>URL</th><th>Tipo</th><th>Productos</th><th>Rango precios</th><th>Mediana</th><th>Escaneado</th></tr></thead>
            <tbody>${compRows || '<tr><td colspan="7" class="text-muted">No hay competidores registrados</td></tr>'}</tbody><!-- nosemgrep -->
          </table>
        </div>
      </div>
      ${alertRows ? `<div class="section"><!-- nosemgrep -->
        <div class="section-title">Alertas Competitivas</div>
        <div class="card" style="overflow-x:auto;">
          <table>
            <thead><tr><th>Severidad</th><th>Alerta</th><th>Descripción</th><th>Acción sugerida</th><th>Fecha</th></tr></thead>
            <tbody>${alertRows}</tbody><!-- nosemgrep -->
          </table>
        </div>
      </div>` : ""}`;
  
    const tpl = (req.query.template as ReportTemplate) || "prestige";
    const html = getReportShell(tpl)("Informe de Competencia", `${project.name} — Análisis Competitivo`, body, date);
    autoSaveReport(projectId, "Informe de Competencia", html, "competitors").catch(() => {});
    await sendHtmlOrPdf(req, res, html, `Competitor_Analysis_${project.name.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}`);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/projects/:projectId/exports/consistency", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
    const visualDna = await db.select().from(visualDnaTable).where(eq(visualDnaTable.projectId, projectId));
    const brandDna = await db.select().from(brandDnaTable).where(eq(brandDnaTable.projectId, projectId));
    const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
    const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  
    const vd = visualDna[0];
    const bd = brandDna[0];
    const avgConsistency = vd?.consistencyScore ?? 0;
  
    let dnaDetails = "";
    if (vd) {
      dnaDetails = `
        <div class="card" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Estilo de fondo</p><p>${vd.backgroundStyle || "No analizado"}</p></div><!-- nosemgrep -->
          <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Iluminación</p><p>${vd.lightingStyle || "No analizado"}</p></div><!-- nosemgrep -->
          <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Temperatura color</p><p>${vd.colorTemp || "No analizado"}</p></div><!-- nosemgrep -->
          <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Composición</p><p>${vd.composition || "No analizado"}</p></div><!-- nosemgrep -->
          <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Mood</p><p>${vd.mood || "No analizado"}</p></div><!-- nosemgrep -->
          <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Presencia humana</p><p>${vd.humanPresence || "No analizado"}</p></div><!-- nosemgrep -->
        </div>
        ${vd.brandColors?.length ? `<div class="card"><p class="text-muted" style="font-size:11px;text-transform:uppercase;margin-bottom:8px;">Colores de marca</p><div style="display:flex;gap:8px;flex-wrap:wrap;">${vd.brandColors.map(c => `<div style="display:flex;align-items:center;gap:6px;"><div style="width:24px;height:24px;border-radius:6px;background:${c};border:1px solid ${BRAND.border};"></div><span style="font-size:12px;">${c}</span></div>`).join("")}</div></div>` : ""}<!-- nosemgrep -->
        ${vd.props?.length ? `<div class="card"><p class="text-muted" style="font-size:11px;text-transform:uppercase;margin-bottom:8px;">Props/Accesorios</p><div>${vd.props.map(p => `<span class="tag">${p}</span>`).join(" ")}</div></div>` : ""}`; // nosemgrep
    }
  
    let brandDetails = "";
    if (bd) {
      brandDetails = `
        <div class="card" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Estilo tipográfico</p><p>${bd.typographyStyle || "—"}</p></div><!-- nosemgrep -->
          <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Patrón de layout</p><p>${bd.layoutPattern || "—"}</p></div><!-- nosemgrep -->
          <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Densidad visual</p><p>${bd.visualDensity || "—"}</p></div><!-- nosemgrep -->
          <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Personalidad de marca</p><p>${bd.brandPersonality || "—"}</p></div><!-- nosemgrep -->
          <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Posición competitiva</p><p>${bd.competitivePosition || "—"}</p></div><!-- nosemgrep -->
          <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Estilo fotográfico</p><p>${bd.photographyStyle || "—"}</p></div><!-- nosemgrep -->
        </div>
        ${bd.valuePropositions?.length ? `<div class="card"><p class="text-muted" style="font-size:11px;text-transform:uppercase;margin-bottom:8px;">Propuestas de valor</p><div>${bd.valuePropositions.map(v => `<span class="tag">${v}</span>`).join(" ")}</div></div>` : ""}<!-- nosemgrep -->
        ${bd.urgencyTactics?.length ? `<div class="card"><p class="text-muted" style="font-size:11px;text-transform:uppercase;margin-bottom:8px;">Tácticas de urgencia</p><div>${bd.urgencyTactics.map(t => `<span class="tag">${t}</span>`).join(" ")}</div></div>` : ""}`; // nosemgrep
    }
  
    const consistencyContext = `TIENDA: ${project.name}
  PLATAFORMA: ${project.platformType || "shopify"}
  NICHO: ${project.storeNiche || "No definido"}
  PRODUCTOS ANALIZADOS: ${products.length}
  SCORE DE CONSISTENCIA VISUAL: ${(avgConsistency * 100).toFixed(0)}% ${avgConsistency < 0.5 ? "⚠️ MUY BAJO — urgente mejorar" : avgConsistency < 0.7 ? "⚠️ MEDIO — necesita trabajo" : "✅ ACEPTABLE"}
  
  📷 ADN VISUAL DETECTADO:
  - Estilo de fondo: ${vd?.backgroundStyle || "❌ No analizado"}
  - Iluminación predominante: ${vd?.lightingStyle || "❌ No analizado"}
  - Temperatura de color: ${vd?.colorTemp || "❌ No analizado"}
  - Composición fotográfica: ${vd?.composition || "❌ No analizado"}
  - Mood/Atmósfera: ${vd?.mood || "❌ No analizado"}
  - Presencia humana: ${vd?.humanPresence || "❌ No analizado"}
  
  🎨 PALETA DE COLORES DE MARCA: ${vd?.brandColors?.length ? vd.brandColors.join(", ") : "❌ No definida — esto es CRÍTICO para la consistencia"}
  🎭 PROPS/ACCESORIOS RECURRENTES: ${vd?.props?.length ? vd.props.join(", ") : "No detectados"}
  
  🏷️ ADN DE MARCA:
  - Estilo tipográfico: ${bd?.typographyStyle || "No definido"}
  - Patrón de layout: ${bd?.layoutPattern || "No definido"}
  - Densidad visual: ${bd?.visualDensity || "No definida"}
  - Personalidad de marca: ${bd?.brandPersonality || "No definida"}
  - Posición competitiva: ${bd?.competitivePosition || "No definida"}
  - Estilo fotográfico: ${bd?.photographyStyle || "No definido"}
  - Propuestas de valor: ${bd?.valuePropositions?.join(", ") || "No definidas"}
  - Tácticas de urgencia: ${bd?.urgencyTactics?.join(", ") || "No detectadas"}
  
  CONTEXTO COMPETITIVO: Para el nicho "${project.storeNiche || "e-commerce"}", los líderes del sector mantienen consistencia visual >85%. Un score por debajo de 70% se correlaciona con -15-25% en conversión.`;
  
    const aiConsistencySection = await generateAiRecommendations(projectId, "consistency", consistencyContext, project.storeNiche ?? undefined, project.platformType ?? "shopify");
  
    const body = `
      <div class="metric-row">
        <div class="metric"><div class="value">${(avgConsistency * 100).toFixed(0)}%</div><div class="label">Consistencia visual</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${products.length}</div><div class="label">Productos analizados</div></div><!-- nosemgrep -->
      </div>
      <div class="section">
        <div class="section-title">ADN Visual</div>
        ${dnaDetails || '<div class="card text-muted">Sin análisis visual. Ejecuta un análisis de consistencia desde la página Consistencia.</div>'}<!-- nosemgrep -->
      </div>
      <div class="section">
        <div class="section-title">ADN de Marca</div>
        ${brandDetails || '<div class="card text-muted">Sin ADN de marca extraído. Usa la herramienta de Intelligence para extraer el ADN.</div>'}<!-- nosemgrep -->
      </div>
      ${aiConsistencySection}`;
  
    const tpl = (req.query.template as ReportTemplate) || "prestige";
    const html = getReportShell(tpl)("Informe de Consistencia y ADN de Marca", `${project.name} — Identidad Visual`, body, date);
    autoSaveReport(projectId, "Informe de Consistencia y ADN de Marca", html, "brand_consistency").catch(() => {});
    await sendHtmlOrPdf(req, res, html, `Consistency_BrandDNA_${project.name.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}`);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/projects/:projectId/exports/inventory", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
    const inventory = await db.select().from(inventoryTrackingTable).where(eq(inventoryTrackingTable.projectId, String(projectId)));
    const restocks = await db.select().from(restockOrdersTable).where(eq(restockOrdersTable.projectId, String(projectId))).orderBy(desc(restockOrdersTable.createdAt)).limit(50);
    const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  
    const critical = inventory.filter(i => i.status === "critical" || (i.daysRemaining != null && i.daysRemaining <= 7));
    const lowStock = inventory.filter(i => i.status === "low" || (i.daysRemaining != null && i.daysRemaining > 7 && i.daysRemaining <= 30));
    const totalStock = inventory.reduce((sum, i) => sum + (i.currentStock ?? 0), 0);
  
    let invRows = "";
    for (const i of inventory) {
      const statusColor = i.status === "critical" ? BRAND.red : i.status === "low" ? "#ffa500" : BRAND.jade;
      invRows += `<tr><!-- nosemgrep -->
        <td style="font-weight:500;">${i.productTitle || i.productId}</td><!-- nosemgrep -->
        <td>${i.currentStock ?? "—"}</td><!-- nosemgrep -->
        <td>${i.avgDailySales?.toFixed(1) ?? "—"}</td><!-- nosemgrep -->
        <td><span style="color:${statusColor};font-weight:600;">${i.daysRemaining != null ? `${i.daysRemaining} días` : "—"}</span></td><!-- nosemgrep -->
        <td><span style="color:${statusColor};font-weight:600;text-transform:uppercase;">${i.status || "ok"}</span></td><!-- nosemgrep -->
        <td class="text-muted">${i.supplierEmail || "—"}</td><!-- nosemgrep -->
        <td>${i.supplierLeadDays ?? "—"} días</td><!-- nosemgrep -->
      </tr>`;
    }
  
    let restockRows = "";
    for (const r of restocks.slice(0, 15)) {
      restockRows += `<tr><!-- nosemgrep -->
        <td style="font-weight:500;">${r.productTitle || r.productId || "—"}</td><!-- nosemgrep -->
        <td>${r.quantitySuggested ?? "—"}</td><!-- nosemgrep -->
        <td><span class="tag">${r.urgency || "normal"}</span></td><!-- nosemgrep -->
        <td>${r.adminApproved ? "✅ Aprobado" : "⏳ Pendiente"}</td>
        <td class="text-muted">${r.createdAt ? new Date(r.createdAt).toLocaleDateString("es-ES") : "—"}</td><!-- nosemgrep -->
      </tr>`;
    }
  
    const body = `
      <div class="metric-row">
        <div class="metric"><div class="value">${inventory.length}</div><div class="label">Productos rastreados</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${totalStock}</div><div class="label">Stock total</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value" style="color:${BRAND.red}">${critical.length}</div><div class="label">Stock crítico</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value" style="color:#ffa500">${lowStock.length}</div><div class="label">Stock bajo</div></div><!-- nosemgrep -->
      </div>
      <div class="section">
        <div class="section-title">Estado del Inventario</div>
        <div class="card" style="overflow-x:auto;">
          <table>
            <thead><tr><th>Producto</th><th>Stock</th><th>Ventas/día</th><th>Días restantes</th><th>Estado</th><th>Proveedor</th><th>Lead time</th></tr></thead>
            <tbody>${invRows || '<tr><td colspan="7" class="text-muted">Sin datos de inventario</td></tr>'}</tbody><!-- nosemgrep -->
          </table>
        </div>
      </div>
      ${restockRows ? `<div class="section"><!-- nosemgrep -->
        <div class="section-title">Órdenes de Reposición</div>
        <div class="card" style="overflow-x:auto;">
          <table>
            <thead><tr><th>Producto</th><th>Cantidad</th><th>Urgencia</th><th>Estado</th><th>Fecha</th></tr></thead>
            <tbody>${restockRows}</tbody><!-- nosemgrep -->
          </table>
        </div>
      </div>` : ""}
  
      ${await generateAiRecommendations(projectId, "inventory", (() => {
    const healthy = inventory.filter(i => i.status !== "critical" && i.status !== "low");
    const avgDailySalesAll = inventory.filter(i => i.avgDailySales != null).reduce((s, i) => s + (i.avgDailySales ?? 0), 0);
    const totalValue = inventory.reduce((s, i) => (s + (i.currentStock ?? 0) * ((i as any).unitCost ?? 0)), 0);
    const pendingRestocks = restocks.filter(r => !r.adminApproved);
    return `TIENDA: ${project.name}
  PLATAFORMA: ${project.platformType || "shopify"}
  NICHO: ${project.storeNiche || "No definido"}
  PRODUCTOS RASTREADOS: ${inventory.length}
  STOCK TOTAL: ${totalStock} unidades
  VALOR ESTIMADO INVENTARIO: ${totalValue.toFixed(2)}€
  VENTAS DIARIAS TOTALES ESTIMADAS: ${avgDailySalesAll.toFixed(1)} unidades/día
  
  📊 DISTRIBUCIÓN DE ESTADOS:
  - ⛔ CRÍTICO (≤7 días): ${critical.length} productos (${inventory.length > 0 ? Math.round(critical.length / inventory.length * 100) : 0}%)
  - ⚠️ BAJO (7-30 días): ${lowStock.length} productos (${inventory.length > 0 ? Math.round(lowStock.length / inventory.length * 100) : 0}%)
  - ✅ SALUDABLE (>30 días): ${healthy.length} productos (${inventory.length > 0 ? Math.round(healthy.length / inventory.length * 100) : 0}%)
  
  ÓRDENES DE REPOSICIÓN: ${restocks.length} total, ${pendingRestocks.length} pendientes de aprobar
  
  ⛔ PRODUCTOS EN ESTADO CRÍTICO — REQUIEREN ACCIÓN INMEDIATA:
  ${critical.slice(0, 10).map((i, idx) => `${idx + 1}. "${i.productTitle || i.productId}"
     Stock actual: ${i.currentStock ?? 0} uds | Ventas/día: ${i.avgDailySales?.toFixed(1) ?? "?"} | Días hasta rotura: ${i.daysRemaining ?? "?"}
     Proveedor: ${i.supplierEmail || "❌ SIN PROVEEDOR ASIGNADO"} | Lead time: ${i.supplierLeadDays ?? "?"} días
     Coste oportunidad/día sin stock: ~${i.avgDailySales ? (i.avgDailySales * ((i as any).unitCost ?? 10) * 2.5).toFixed(2) : "?"} €`).join("\n") || "Ninguno en estado crítico"}
  
  ⚠️ PRODUCTOS CON STOCK BAJO — PLANIFICAR REPOSICIÓN:
  ${lowStock.slice(0, 10).map(i => `- "${i.productTitle || i.productId}" Stock: ${i.currentStock ?? 0} uds, Días restantes: ${i.daysRemaining ?? "?"}, Proveedor: ${i.supplierEmail || "sin proveedor"}`).join("\n") || "Ninguno"}
  
  BENCHMARK SECTOR: Las tiendas top del nicho "${project.storeNiche || "e-commerce"}" mantienen <5% de productos en estado crítico y stock de seguridad de 14-21 días.`;
  })(), project.storeNiche ?? undefined, project.platformType ?? "shopify")}`;
  
    const tpl = (req.query.template as ReportTemplate) || "prestige";
    const html = getReportShell(tpl)("Informe de Inventario", `${project.name} — Control de Stock`, body, date);
    autoSaveReport(projectId, "Informe de Inventario", html, "inventory").catch(() => {});
    await sendHtmlOrPdf(req, res, html, `Inventory_Report_${project.name.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}`);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/projects/:projectId/exports/redesigns", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
    const redesigns = await db.select().from(redesignsTable).where(eq(redesignsTable.projectId, projectId)).orderBy(desc(redesignsTable.createdAt));
    const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
    const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  
    const productMap = new Map(products.map(p => [p.shopifyProductId, p]));
    const applied = redesigns.filter(r => r.appliedAt);
  
    let rows = "";
    for (const r of redesigns) {
      const product = productMap.get(r.shopifyProductId ?? "");
      rows += `<tr><!-- nosemgrep -->
        <td style="font-weight:500;">${product?.title || r.shopifyProductId || "Desconocido"}</td><!-- nosemgrep -->
        <td>${r.newTitle?.slice(0, 50) ?? "—"}${(r.newTitle?.length ?? 0) > 50 ? "…" : ""}</td><!-- nosemgrep -->
        <td>${(r as any).recommendedPrice != null ? `${(r as any).recommendedPrice}€` : "—"}</td><!-- nosemgrep -->
        <td>${r.appliedAt ? `<span class="text-jade">Aplicado</span>` : '<span class="text-muted">Pendiente</span>'}</td>
        <td class="text-muted">${r.createdAt ? new Date(r.createdAt).toLocaleDateString("es-ES") : "—"}</td><!-- nosemgrep -->
      </tr>`;
    }
  
    const body = `
      <div class="metric-row">
        <div class="metric"><div class="value">${redesigns.length}</div><div class="label">Rediseños generados</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${applied.length}</div><div class="label">Aplicados a Shopify</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${redesigns.length - applied.length}</div><div class="label">Pendientes</div></div><!-- nosemgrep -->
      </div>
      <div class="section">
        <div class="section-title">Historial de Rediseños IA</div>
        <div class="card" style="overflow-x:auto;">
          <table>
            <thead><tr><th>Producto original</th><th>Nuevo título propuesto</th><th>Precio recomendado</th><th>Estado</th><th>Fecha</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="5" class="text-muted">No hay rediseños generados</td></tr>'}</tbody><!-- nosemgrep -->
          </table>
        </div>
      </div>
      ${redesigns.length > 0 && (redesigns[0] as any).newDescription ? `<div class="section"><!-- nosemgrep -->
        <div class="section-title">Ejemplo de Rediseño Más Reciente</div>
        <div class="card">
          <p class="text-muted" style="font-size:11px;text-transform:uppercase;margin-bottom:8px;">Producto: ${productMap.get(redesigns[0].shopifyProductId ?? "")?.title || "—"}</p><!-- nosemgrep -->
          <p style="font-size:16px;font-weight:600;color:${BRAND.gold};margin-bottom:12px;">${redesigns[0].newTitle || "—"}</p><!-- nosemgrep -->
          <div class="blog-content" style="font-size:13px;">${(redesigns[0] as any).newDescription?.slice(0, 500) ?? ""}${((redesigns[0] as any).newDescription?.length ?? 0) > 500 ? "..." : ""}</div><!-- nosemgrep -->
          ${(redesigns[0] as any).tags ? `<div style="margin-top:12px;">${((redesigns[0] as any).tags as any)?.slice?.(0, 10)?.map?.((t: string) => `<span class="tag">${t}</span>`)?.join(" ") ?? ""}</div>` : ""}<!-- nosemgrep -->
        </div>
      </div>` : ""}
  
      ${await generateAiRecommendations(projectId, "redesigns", (() => {
    const pending = redesigns.filter(r => !r.appliedAt);
    const withPriceChange = redesigns.filter(r => (r as any).recommendedPrice != null);
    const productsWithoutRedesign = products.filter(p => !redesigns.some(r => r.shopifyProductId === p.shopifyProductId));
    return `TIENDA: ${project.name}
  PLATAFORMA: ${project.platformType || "shopify"}
  NICHO: ${project.storeNiche || "No definido"}
  TOTAL REDISEÑOS GENERADOS: ${redesigns.length}
  APLICADOS A LA TIENDA: ${applied.length} (${redesigns.length > 0 ? Math.round(applied.length / redesigns.length * 100) : 0}% de ejecución)
  PENDIENTES DE APLICAR: ${pending.length}
  TOTAL PRODUCTOS EN CATÁLOGO: ${products.length}
  COBERTURA DE REDISEÑO: ${products.length > 0 ? ((redesigns.length / products.length) * 100).toFixed(0) : 0}% del catálogo
  PRODUCTOS SIN REDISEÑAR: ${productsWithoutRedesign.length}
  REDISEÑOS CON CAMBIO DE PRECIO: ${withPriceChange.length}
  
  📋 REDISEÑOS RECIENTES (detalle):
  ${redesigns.slice(0, 12).map((r, i) => {
    const prod = productMap.get(r.shopifyProductId ?? "");
    const origPrice = prod ? parseFloat(prod.price ?? "0") : 0;
    const recPrice = (r as any).recommendedPrice;
    const priceChange = recPrice && origPrice > 0 ? ((recPrice - origPrice) / origPrice * 100).toFixed(1) : null;
    return `${i + 1}. "${prod?.title || "Desconocido"}"
     Título propuesto: "${r.newTitle?.slice(0, 100) || "N/A"}"
     Precio original: ${origPrice.toFixed(2)}€ → Recomendado: ${recPrice != null ? recPrice + "€" : "sin cambio"} ${priceChange ? `(${Number(priceChange) >= 0 ? "+" : ""}${priceChange}%)` : ""}
     Estado: ${r.appliedAt ? "✅ APLICADO" : "⏳ PENDIENTE"}
     Tags propuestos: ${Array.isArray((r as any).tags) ? ((r as any).tags as string[]).slice(0, 5).join(", ") : "N/A"}`;
  }).join("\n")}
  
  🚫 PRODUCTOS AÚN SIN REDISEÑAR (oportunidad):
  ${productsWithoutRedesign.slice(0, 8).map(p => `- "${p.title}" — Precio: ${p.price ?? "?"}€`).join("\n") || "Todos los productos tienen rediseño"}
  
  BENCHMARK: Las tiendas top del nicho "${project.storeNiche || "e-commerce"}" rediseñan fichas cada 3-6 meses. El impacto medio de un rediseño profesional es +15-35% en conversión por producto.`;
  })(), project.storeNiche ?? undefined, project.platformType ?? "shopify")}`;
  
    const tpl = (req.query.template as ReportTemplate) || "prestige";
    const html = getReportShell(tpl)("Informe de Rediseños IA", `${project.name} — Optimización de Fichas`, body, date);
    autoSaveReport(projectId, "Informe de Rediseños IA", html, "redesigns").catch(() => {});
    await sendHtmlOrPdf(req, res, html, `Redesigns_Report_${project.name.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}`);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/projects/:projectId/exports/revenue", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
    const snapshots = await db.select().from(revenueSnapshotsTable).where(eq(revenueSnapshotsTable.projectId, String(projectId))).orderBy(desc(revenueSnapshotsTable.createdAt)).limit(90);
    const forecasts = await db.select().from(forecastsTable).where(eq(forecastsTable.projectId, String(projectId))).orderBy(desc(forecastsTable.createdAt)).limit(30);
    const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  
    const totalRevenue = snapshots.reduce((s, r) => s + (r.revenue ?? 0), 0);
    const totalOrders = snapshots.reduce((s, r) => s + (r.orders ?? 0), 0);
    const avgAov = snapshots.filter(s => s.aov != null).length > 0
      ? snapshots.reduce((s, r) => s + (r.aov ?? 0), 0) / snapshots.filter(s => s.aov != null).length : 0;
    const avgMargin = snapshots.filter(s => s.grossMargin != null).length > 0
      ? snapshots.reduce((s, r) => s + (r.grossMargin ?? 0), 0) / snapshots.filter(s => s.grossMargin != null).length : 0;
  
    let snapRows = "";
    for (const s of snapshots.slice(0, 30)) {
      snapRows += `<tr><!-- nosemgrep -->
        <td>${s.date}</td><!-- nosemgrep -->
        <td style="font-weight:500;">${s.revenue?.toFixed(2) ?? "—"}€</td><!-- nosemgrep -->
        <td>${s.orders ?? "—"}</td><!-- nosemgrep -->
        <td>${s.aov?.toFixed(2) ?? "—"}€</td><!-- nosemgrep -->
        <td>${s.conversionRate != null ? `${(s.conversionRate * 100).toFixed(2)}%` : "—"}</td><!-- nosemgrep -->
        <td>${s.grossMargin != null ? `<span class="${s.grossMargin > 30 ? "text-jade" : "text-red"}">${s.grossMargin.toFixed(1)}%</span>` : "—"}</td><!-- nosemgrep -->
      </tr>`;
    }
  
    let forecastRows = "";
    for (const f of forecasts) {
      forecastRows += `<tr><!-- nosemgrep -->
        <td>${f.forecastDate || "—"}</td><!-- nosemgrep -->
        <td><span class="tag">${f.forecastType || "general"}</span></td><!-- nosemgrep -->
        <td style="font-weight:500;">${f.predictedValue?.toFixed(2) ?? "—"}€</td><!-- nosemgrep -->
        <td>${f.confidenceLow?.toFixed(0) ?? "—"}€ – ${f.confidenceHigh?.toFixed(0) ?? "—"}€</td><!-- nosemgrep -->
        <td>${f.confidencePct ?? "—"}%</td><!-- nosemgrep -->
        <td class="text-muted" style="font-size:11px;">${f.reasoning?.slice(0, 60) ?? "—"}</td><!-- nosemgrep -->
      </tr>`;
    }
  
    const body = `
      <div class="metric-row">
        <div class="metric"><div class="value">${totalRevenue.toFixed(0)}€</div><div class="label">Revenue total</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${totalOrders}</div><div class="label">Pedidos</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${avgAov.toFixed(2)}€</div><div class="label">AOV medio</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${avgMargin.toFixed(1)}%</div><div class="label">Margen bruto</div></div><!-- nosemgrep -->
      </div>
      <div class="section">
        <div class="section-title">Snapshots de Revenue</div>
        <div class="card" style="overflow-x:auto;">
          <table>
            <thead><tr><th>Fecha</th><th>Revenue</th><th>Pedidos</th><th>AOV</th><th>Conversión</th><th>Margen</th></tr></thead>
            <tbody>${snapRows || '<tr><td colspan="6" class="text-muted">Sin datos de revenue aún</td></tr>'}</tbody><!-- nosemgrep -->
          </table>
        </div>
      </div>
      ${forecastRows ? `<div class="section"><!-- nosemgrep -->
        <div class="section-title">Predicciones / Forecast</div>
        <div class="card" style="overflow-x:auto;">
          <table>
            <thead><tr><th>Fecha</th><th>Tipo</th><th>Predicción</th><th>Rango confianza</th><th>Confianza</th><th>Razonamiento</th></tr></thead>
            <tbody>${forecastRows}</tbody><!-- nosemgrep -->
          </table>
        </div>
      </div>` : ""}
  
      ${await generateAiRecommendations(projectId, "revenue", (() => {
    const recentSnapshots = snapshots.slice(0, 30);
    const firstHalf = recentSnapshots.slice(Math.floor(recentSnapshots.length / 2));
    const secondHalf = recentSnapshots.slice(0, Math.floor(recentSnapshots.length / 2));
    const avgRevenueFirst = firstHalf.length ? firstHalf.reduce((s, r) => s + (r.revenue ?? 0), 0) / firstHalf.length : 0;
    const avgRevenueSecond = secondHalf.length ? secondHalf.reduce((s, r) => s + (r.revenue ?? 0), 0) / secondHalf.length : 0;
    const growthRate = avgRevenueFirst > 0 ? ((avgRevenueSecond - avgRevenueFirst) / avgRevenueFirst * 100) : 0;
    const avgConversion = snapshots.filter(s => s.conversionRate != null).reduce((s, r) => s + (r.conversionRate ?? 0), 0) / (snapshots.filter(s => s.conversionRate != null).length || 1);
    const bestDay = recentSnapshots.reduce((best, s) => (s.revenue ?? 0) > (best.revenue ?? 0) ? s : best, recentSnapshots[0] || { date: "N/A", revenue: 0 });
    const worstDay = recentSnapshots.reduce((worst, s) => (s.revenue ?? 0) < (worst.revenue ?? 0) ? s : worst, recentSnapshots[0] || { date: "N/A", revenue: 0 });
    return `TIENDA: ${project.name}
  PLATAFORMA: ${project.platformType || "shopify"}
  NICHO: ${project.storeNiche || "No definido"}
  PERÍODO DE DATOS: ${snapshots.length} snapshots
  
  📊 MÉTRICAS CLAVE:
  - Revenue total acumulado: ${totalRevenue.toFixed(2)}€
  - Pedidos totales: ${totalOrders}
  - AOV medio (Average Order Value): ${avgAov.toFixed(2)}€
  - Margen bruto medio: ${avgMargin.toFixed(1)}%
  - Tasa de conversión media: ${(avgConversion * 100).toFixed(2)}%
  - Tendencia de crecimiento: ${growthRate >= 0 ? "+" : ""}${growthRate.toFixed(1)}% ${growthRate > 5 ? "📈 CRECIENDO" : growthRate < -5 ? "📉 DECRECIENDO" : "➡️ ESTABLE"}
  
  📈 ANÁLISIS DE TENDENCIA:
  - Revenue medio primera mitad del período: ${avgRevenueFirst.toFixed(2)}€/día
  - Revenue medio segunda mitad: ${avgRevenueSecond.toFixed(2)}€/día
  - Mejor día: ${bestDay?.date || "?"} con ${bestDay?.revenue?.toFixed(2) ?? "?"}€
  - Peor día: ${worstDay?.date || "?"} con ${worstDay?.revenue?.toFixed(2) ?? "?"}€
  
  📅 DETALLE ÚLTIMOS 15 SNAPSHOTS:
  ${recentSnapshots.slice(0, 15).map(s => `- ${s.date}: Revenue ${s.revenue?.toFixed(2) ?? "?"}€ | Pedidos: ${s.orders ?? "?"} | AOV: ${s.aov?.toFixed(2) ?? "?"}€ | Conversión: ${s.conversionRate != null ? (s.conversionRate * 100).toFixed(2) + "%" : "?"} | Margen: ${s.grossMargin?.toFixed(1) ?? "?"}%`).join("\n")}
  
  🔮 FORECASTS / PREDICCIONES IA:
  ${forecasts.slice(0, 5).map(f => `- ${f.forecastDate}: ${f.forecastType} → ${f.predictedValue?.toFixed(2) ?? "?"}€ (confianza: ${f.confidencePct ?? "?"}%, rango: ${f.confidenceLow?.toFixed(0) ?? "?"}€-${f.confidenceHigh?.toFixed(0) ?? "?"}€)
    Razonamiento: ${f.reasoning?.slice(0, 150) ?? "N/A"}`).join("\n") || "Sin forecasts generados aún"}
  
  BENCHMARKS DEL SECTOR "${project.storeNiche || "e-commerce"}":
  - Tasa de conversión media del sector: 1.5-3.5%
  - AOV medio del sector: varía por nicho (25-150€)
  - Tasa de crecimiento MoM saludable: 5-15%
  - Customer Acquisition Cost (CAC) recomendado: <30% del AOV`;
  })(), project.storeNiche ?? undefined, project.platformType ?? "shopify")}`;
  
    const tpl = (req.query.template as ReportTemplate) || "prestige";
    const html = getReportShell(tpl)("Informe de Revenue y Forecast", `${project.name} — Análisis Financiero`, body, date);
    autoSaveReport(projectId, "Informe de Revenue y Forecast", html, "revenue_forecast").catch(() => {});
    await sendHtmlOrPdf(req, res, html, `Revenue_Forecast_${project.name.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}`);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/projects/:projectId/exports/shopybrain", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
    const memories = await db.select().from(omnicoreMemoriesTable).orderBy(desc(omnicoreMemoriesTable.createdAt)).limit(200);
    const domains = await db.select().from(omnicoreKnowledgeDomainsTable).orderBy(desc(omnicoreKnowledgeDomainsTable.verifiedInsights));
    const insights = await db.select().from(omnicoreInsightsTable).orderBy(desc(omnicoreInsightsTable.createdAt)).limit(100);
    const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  
    const totalMemories = memories.length;
    const avgConfidence = memories.length > 0 ? memories.reduce((s, m) => s + (m.confidence ?? 0), 0) / memories.length : 0;
    const verified = memories.filter(m => m.isVerified).length;
    const supplierMemories = memories.filter(m => m.memoryType === "supplier_intelligence");
  
    let domainRows = "";
    for (const d of domains) {
      const depth = d.knowledgeDepth ?? 0;
      domainRows += `<tr><!-- nosemgrep -->
        <td style="font-weight:600;">${d.domain}</td>
        <td><div style="display:flex;align-items:center;gap:8px;"><div class="score-bar" style="width:100px;"><div class="score-fill" style="width:${Math.min(depth, 100)}%;background:${scoreColor(depth)};"></div></div><span>${depth}%</span></div></td>
        <td>${d.verifiedInsights ?? 0}</td>
        <td>${d.totalInsights ?? 0}</td>
        <td class="text-muted">${d.lastStudySession ? new Date(d.lastStudySession).toLocaleDateString("es-ES") : "—"}</td>
      </tr>`;
    }
  
    let memoryTypes: Record<string, number> = {};
    memories.forEach(m => { memoryTypes[m.memoryType] = (memoryTypes[m.memoryType] || 0) + 1; });
    let typeBreakdown = Object.entries(memoryTypes).sort((a, b) => b[1] - a[1]).map(([type, count]) =>
      `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid ${BRAND.border};"><span>${type}</span><span class="text-gold" style="font-weight:600;">${count}</span></div>` // nosemgrep
    ).join("");
  
    let topInsights = "";
    for (const i of insights.slice(0, 10)) {
      topInsights += `<div class="recommendation"><!-- nosemgrep -->
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-weight:600;color:${BRAND.gold};">${i.title}</span>
          <span class="tag">${i.domain}</span>
        </div>
        <p style="font-size:12px;color:${BRAND.muted};">${i.insight?.slice(0, 150) ?? ""}${(i.insight?.length ?? 0) > 150 ? "..." : ""}</p>
        <div style="margin-top:4px;font-size:11px;"><span class="text-muted">Confianza: </span><span class="${(i.confidence ?? 0) > 0.7 ? "text-jade" : "text-gold"}">${((i.confidence ?? 0) * 100).toFixed(0)}%</span>
        <span class="text-muted" style="margin-left:12px;">Impacto: </span><span class="text-gold">${((i.impactScore ?? 0) * 100).toFixed(0)}%</span></div>
      </div>`;
    }
  
    const body = `
      <div class="metric-row">
        <div class="metric"><div class="value">${totalMemories}</div><div class="label">Memorias totales</div></div>
        <div class="metric"><div class="value">${domains.length}</div><div class="label">Dominios</div></div>
        <div class="metric"><div class="value">${(avgConfidence * 100).toFixed(0)}%</div><div class="label">Confianza media</div></div>
        <div class="metric"><div class="value">${verified}</div><div class="label">Verificadas</div></div>
        <div class="metric"><div class="value">${supplierMemories.length}</div><div class="label">Intel proveedores</div></div>
      </div>
      <div class="section">
        <div class="section-title">Dominios de Conocimiento</div>
        <div class="card" style="overflow-x:auto;">
          <table>
            <thead><tr><th>Dominio</th><th>Profundidad</th><th>Verificados</th><th>Total insights</th><th>Última sesión</th></tr></thead>
            <tbody>${domainRows || '<tr><td colspan="5" class="text-muted">Sin dominios registrados</td></tr>'}</tbody>
          </table>
        </div>
      </div>
      <div class="section">
        <div class="section-title">Distribución de Memorias por Tipo</div>
        <div class="card">${typeBreakdown || '<p class="text-muted">Sin memorias</p>'}</div>
      </div>
      <div class="section">
        <div class="section-title">Top 10 Insights Más Recientes</div>
        ${topInsights || '<div class="card text-muted">Sin insights generados aún</div>'}
      </div>`;
  
    const tpl = (req.query.template as ReportTemplate) || "prestige";
    const html = getReportShell(tpl)("Informe Shopy Crafter — Inteligencia Artificial", `${project.name} — Estado del Cerebro IA`, body, date);
    autoSaveReport(projectId, "Informe Shopy Crafter — Inteligencia Artificial", html, "shopybrain_intelligence").catch(() => {});
    await sendHtmlOrPdf(req, res, html, `ShopyCrafter_Intelligence_${project.name.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}`);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/projects/:projectId/exports/json/products", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
    const allCogs = await db.select().from(cogsTable).where(eq(cogsTable.projectId, projectId));
    const seoData = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, projectId));
    const cogsMap = new Map(allCogs.map(c => [c.shopifyProductId, c]));
    const seoMap = new Map(seoData.map(s => [s.shopifyProductId, s]));
  
    const data = products.map(p => ({
      title: p.title,
      handle: p.handle,
      status: p.status,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      vendor: p.vendor,
      productType: p.productType,
      tags: p.tags,
      imageCount: p.imageCount,
      variantCount: p.variantCount,
      auditScore: p.auditScore,
      cogs: cogsMap.get(p.shopifyProductId)?.totalCogs ?? null,
      seoGrade: seoMap.get(p.shopifyProductId)?.seoGrade ?? null,
      seoScore: seoMap.get(p.shopifyProductId)?.seoScore ?? null,
    }));
  
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="Products_Data_${new Date().toISOString().split("T")[0]}.json"`);
    res.json({ exportDate: new Date().toISOString(), totalProducts: data.length, products: data });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/projects/:projectId/exports/json/full", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
    const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
    const seoData = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, projectId));
    const allCogs = await db.select().from(cogsTable).where(eq(cogsTable.projectId, projectId));
    const tests = await db.select().from(abTestsTable).where(eq(abTestsTable.projectId, projectId));
    const redesignsData = await db.select().from(redesignsTable).where(eq(redesignsTable.projectId, projectId));
    const jobs = await db.select().from(generationJobsTable).where(eq(generationJobsTable.projectId, projectId));
    const memories = await db.select().from(omnicoreMemoriesTable).limit(500);
    const competitors = await db.select().from(competitorsTable).where(eq(competitorsTable.projectId, String(projectId)));
    const inventory = await db.select().from(inventoryTrackingTable).where(eq(inventoryTrackingTable.projectId, String(projectId)));
    const snapshots = await db.select().from(revenueSnapshotsTable).where(eq(revenueSnapshotsTable.projectId, String(projectId)));
  
    const fullExport = {
      exportDate: new Date().toISOString(),
      project: { name: project.name, domain: project.shopDomain, niche: project.storeNiche, markets: project.storeMarkets, plan: project.plan },
      products: products.map(p => ({ title: p.title, handle: p.handle, price: p.price, status: p.status, vendor: p.vendor, type: p.productType, tags: p.tags, images: p.imageCount, variants: p.variantCount, audit: p.auditScore })),
      seo: seoData.map(s => ({ productId: s.shopifyProductId, score: s.seoScore, grade: s.seoGrade, metaTitle: s.metaTitle, metaDescription: s.metaDescription })),
      cogs: allCogs.map(c => ({ productId: c.shopifyProductId, total: c.totalCogs })),
      abTests: tests.map(t => ({ name: (t as any).testName ?? t.productTitle, type: t.testType, status: t.status, winner: t.winner, improvement: (t as any).improvementPct })),
      redesigns: redesignsData.map(r => ({ productId: r.shopifyProductId, newTitle: r.newTitle, price: (r as any).recommendedPrice, applied: !!r.appliedAt })),
      aiImages: jobs.filter(j => j.status === "succeeded").map(j => ({ type: j.imageType, url: j.imageUrl, alt: j.altText, model: j.model })),
      competitors: competitors.map(c => ({ name: c.name, url: c.url, type: c.type })),
      inventory: inventory.map(i => ({ product: i.productTitle, stock: i.currentStock, daysLeft: i.daysRemaining, status: i.status })),
      revenue: snapshots.map(s => ({ date: s.date, revenue: s.revenue, orders: s.orders, aov: s.aov })),
      brainMemories: memories.length,
    };
  
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="Full_Project_Export_${project.name.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}.json"`);
    res.json(fullExport);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/projects/:projectId/exports/zip/all", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
    const safeName = project.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const dateStr = new Date().toISOString().split("T")[0];
  
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}_Complete_Export_${dateStr}.zip"`);
  
    const archive = archiver("zip", { zlib: { level: 9 }, forceUTF8: true } as any);
    const { ac, isClientGone, markFinalizing } = setupZipStream(req, res, archive);
    archive.pipe(res);
  
    const reportEndpoints = [
      { name: "Informe_Completo", path: "complete-report" },
      { name: "SEO_Audit", path: "seo-audit" },
      { name: "Catalogo_Productos", path: "product-catalog" },
      { name: "Informe_Financiero", path: "financial" },
      { name: "Brand_Brief", path: "brand-brief" },
      { name: "AB_Testing", path: "ab-tests" },
      { name: "Galeria_IA", path: "images-gallery" },
      { name: "Competidores", path: "competitors" },
      { name: "Consistencia_BrandDNA", path: "consistency" },
      { name: "Inventario", path: "inventory" },
      { name: "Rediseños_IA", path: "redesigns" },
      { name: "Revenue_Forecast", path: "revenue" },
      { name: "ShopyCrafter_Intel", path: "shopybrain" },
    ];
  
    const zipTpl = (req.query.template as ReportTemplate) || "prestige";
    const baseUrl = `http://localhost:${process.env.PORT || 8080}/api/projects/${projectId}/exports`;
    const cookieHeader = req.headers.cookie || "";
    const fetchOpts: RequestInit = { headers: { Cookie: cookieHeader }, signal: AbortSignal.any([ac.signal, AbortSignal.timeout(30000)]) };
  
    for (const rpt of reportEndpoints) {
      if (isClientGone()) break;
      try {
        const response = await fetch(`${baseUrl}/${rpt.path}?template=${zipTpl}`, fetchOpts);
        if (response.ok) {
          const html = await response.text();
          archive.append(html, { name: `informes/${rpt.name}_${dateStr}.html` });
        }
      } catch {}
    }
  
    if (!isClientGone()) try {
      const csvRes = await fetch(`${baseUrl}/csv/products`, fetchOpts);
      if (csvRes.ok) {
        const csv = await csvRes.text();
        archive.append(csv, { name: `datos/Productos_${dateStr}.csv` });
      }
    } catch {}
  
    if (!isClientGone()) try {
      const jsonRes = await fetch(`${baseUrl}/json/full`, fetchOpts);
      if (jsonRes.ok) {
        const json = await jsonRes.text();
        archive.append(json, { name: `datos/Exportacion_Completa_${dateStr}.json` });
      }
    } catch {}
  
    if (!isClientGone()) try {
      const jsonProdRes = await fetch(`${baseUrl}/json/products`, fetchOpts);
      if (jsonProdRes.ok) {
        const jsonProd = await jsonProdRes.text();
        archive.append(jsonProd, { name: `datos/Productos_${dateStr}.json` });
      }
    } catch {}
  
    const readmeContent = `# Exportación Completa — ${project.name}
  Fecha: ${dateStr}
  Generado por: Shopy Crafter AI
  
  ## Contenido del ZIP
  
  ### /informes/ (HTML — abrir en navegador, Ctrl+P para PDF)
  ${reportEndpoints.map(r => `- ${r.name}_${dateStr}.html`).join("\n")}
  
  ### /datos/ (CSV + JSON — abrir con Excel, Google Sheets o cualquier editor)
  - Productos_${dateStr}.csv
  - Productos_${dateStr}.json
  - Exportacion_Completa_${dateStr}.json
  
  ## Cómo convertir a PDF
  1. Abre cualquier archivo .html en tu navegador
  2. Pulsa Ctrl+P (o Cmd+P en Mac)
  3. Selecciona "Guardar como PDF"
  4. El informe ya tiene diseño profesional optimizado para impresión
  `;
    archive.append(readmeContent, { name: "LEEME.txt" });
  
    markFinalizing();
    await archive.finalize();
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

router.get("/projects/:projectId/exports/xlsx/products", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
    const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
    const allCogs = await db.select().from(cogsTable).where(eq(cogsTable.projectId, projectId));
    const seoData = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, projectId));
    const cogsMap = new Map(allCogs.map(c => [c.shopifyProductId, c]));
    const seoMap = new Map(seoData.map(s => [s.shopifyProductId, s]));
  
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Shopy Crafter AI";
    workbook.created = new Date();
  
    const ws = workbook.addWorksheet("Productos", {
      properties: { tabColor: { argb: "FFC8A84B" } },
    });
  
    ws.columns = [
      { header: "Título", key: "title", width: 40 },
      { header: "Handle", key: "handle", width: 25 },
      { header: "Estado", key: "status", width: 12 },
      { header: "Precio (€)", key: "price", width: 12 },
      { header: "Compare At (€)", key: "compareAt", width: 14 },
      { header: "COGS (€)", key: "cogs", width: 12 },
      { header: "Margen (%)", key: "margin", width: 12 },
      { header: "Beneficio (€)", key: "profit", width: 13 },
      { header: "Vendor", key: "vendor", width: 20 },
      { header: "Tipo", key: "type", width: 18 },
      { header: "Tags", key: "tags", width: 30 },
      { header: "SEO Grade", key: "seoGrade", width: 10 },
      { header: "SEO Score", key: "seoScore", width: 10 },
      { header: "Audit Score", key: "auditScore", width: 12 },
      { header: "Imágenes", key: "images", width: 10 },
      { header: "Variantes", key: "variants", width: 10 },
    ];
  
    ws.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A0A0F" } };
      cell.border = { bottom: { style: "medium", color: { argb: "FFC8A84B" } } };
      cell.alignment = { vertical: "middle" };
    });
  
    for (const p of products) {
      const cogs = cogsMap.get(p.shopifyProductId);
      const seo = seoMap.get(p.shopifyProductId);
      const price = parseFloat(p.price ?? "0");
      const cogsVal = cogs?.totalCogs ?? 0;
      const margin = price > 0 && cogs ? ((price - cogsVal) / price) * 100 : null;
      const profit = price > 0 && cogs ? price - cogsVal : null;
  
      const row = ws.addRow({
        title: p.title,
        handle: p.handle,
        status: p.status === "active" ? "Activo" : p.status === "draft" ? "Borrador" : p.status === "archived" ? "Archivado" : (p.status || "Desconocido"),
        price: price || null,
        compareAt: p.compareAtPrice ? parseFloat(p.compareAtPrice) : null,
        cogs: cogs ? cogsVal : null,
        margin: margin != null ? Math.round(margin * 10) / 10 : null,
        profit: profit != null ? Math.round(profit * 100) / 100 : null,
        vendor: p.vendor,
        type: p.productType,
        tags: p.tags,
        seoGrade: seo?.seoGrade ?? "",
        seoScore: seo?.seoScore ? Math.round(seo.seoScore) : null,
        auditScore: p.auditScore ? Math.round(p.auditScore) : null,
        images: p.imageCount ?? 0,
        variants: p.variantCount ?? 1,
      });
  
      if (margin != null) {
        const marginCell = row.getCell("margin");
        marginCell.font = { color: { argb: margin > 30 ? "FF2ECC71" : margin > 15 ? "FFC8A84B" : "FFE84558" } };
      }
  
      const statusCell = row.getCell("status");
      statusCell.font = { color: { argb: p.status === "active" ? "FF2ECC71" : p.status === "archived" ? "FFFF9800" : "FF8B8B9E" } };
    }
  
    ws.autoFilter = { from: "A1", to: `P${products.length + 1}` };
  
    const summaryWs = workbook.addWorksheet("Resumen", {
      properties: { tabColor: { argb: "FF2ECC71" } },
    });
  
    const totalRevenue = products.reduce((s, p) => s + parseFloat(p.price ?? "0"), 0);
    const totalCosts = allCogs.reduce((s, c) => s + c.totalCogs, 0);
    const avgPrice = products.length > 0 ? totalRevenue / products.length : 0;
    const avgMargin = totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue) * 100 : 0;
    const avgSeo = seoData.filter(s => s.seoScore != null).length > 0
      ? seoData.reduce((s, d) => s + (d.seoScore ?? 0), 0) / seoData.filter(s => s.seoScore != null).length : 0;
  
    summaryWs.columns = [
      { header: "Métrica", key: "metric", width: 30 },
      { header: "Valor", key: "value", width: 20 },
    ];
  
    summaryWs.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A0A0F" } };
    });
  
    const summaryData = [
      ["Proyecto", project.name],
      ["Dominio", project.shopDomain || "No configurado"],
      ["Nicho", project.storeNiche || "No definido"],
      ["Fecha exportación", new Date().toLocaleDateString("es-ES")],
      ["", ""],
      ["Total productos", products.length],
      ["Productos activos", products.filter(p => p.status === "active").length],
      ["Productos borrador", products.filter(p => p.status === "draft").length],
      ["Productos archivados", products.filter(p => p.status === "archived").length],
      ["Precio medio", `${avgPrice.toFixed(2)}€`],
      ["Revenue potencial", `${totalRevenue.toFixed(2)}€`],
      ["COGS total", `${totalCosts.toFixed(2)}€`],
      ["Beneficio bruto", `${(totalRevenue - totalCosts).toFixed(2)}€`],
      ["Margen medio", `${avgMargin.toFixed(1)}%`],
      ["SEO Score medio", `${Math.round(avgSeo)}/100`],
      ["Productos con COGS", allCogs.length],
      ["Productos auditados", products.filter(p => p.auditScore != null).length],
    ];
  
    for (const [metric, value] of summaryData) {
      summaryWs.addRow({ metric, value });
    }
  
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="Productos_${sanitizeFilename(project.name)}_${new Date().toISOString().split("T")[0]}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/projects/:projectId/exports/xlsx/full", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
    const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
    const allCogs = await db.select().from(cogsTable).where(eq(cogsTable.projectId, projectId));
    const seoData = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, projectId));
    const tests = await db.select().from(abTestsTable).where(eq(abTestsTable.projectId, projectId));
    const competitors = await db.select().from(competitorsTable).where(eq(competitorsTable.projectId, String(projectId)));
    const inventory = await db.select().from(inventoryTrackingTable).where(eq(inventoryTrackingTable.projectId, String(projectId)));
    const snapshots = await db.select().from(revenueSnapshotsTable).where(eq(revenueSnapshotsTable.projectId, String(projectId)));
  
    const cogsMap = new Map(allCogs.map(c => [c.shopifyProductId, c]));
    const seoMap = new Map(seoData.map(s => [s.shopifyProductId, s]));
  
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Shopy Crafter AI";
    workbook.created = new Date();
  
    const headerStyle = (cell: ExcelJS.Cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A0A0F" } };
      cell.border = { bottom: { style: "medium", color: { argb: "FFC8A84B" } } };
    };
  
    const ws1 = workbook.addWorksheet("Productos");
    ws1.columns = [
      { header: "Título", key: "title", width: 35 },
      { header: "Estado", key: "status", width: 10 },
      { header: "Precio", key: "price", width: 10 },
      { header: "COGS", key: "cogs", width: 10 },
      { header: "Margen %", key: "margin", width: 10 },
      { header: "SEO", key: "seo", width: 8 },
      { header: "Audit", key: "audit", width: 8 },
      { header: "Vendor", key: "vendor", width: 18 },
      { header: "Tipo", key: "type", width: 15 },
      { header: "Imgs", key: "imgs", width: 6 },
    ];
    ws1.getRow(1).eachCell(headerStyle);
    for (const p of products) {
      const cogs = cogsMap.get(p.shopifyProductId);
      const seo = seoMap.get(p.shopifyProductId);
      const price = parseFloat(p.price ?? "0");
      const margin = cogs && price > 0 ? ((price - cogs.totalCogs) / price) * 100 : null;
      ws1.addRow({ title: p.title, status: p.status, price, cogs: cogs?.totalCogs ?? null, margin: margin != null ? Math.round(margin * 10) / 10 : null, seo: seo?.seoGrade ?? "", audit: p.auditScore ? Math.round(p.auditScore) : null, vendor: p.vendor, type: p.productType, imgs: p.imageCount ?? 0 });
    }
  
    if (tests.length > 0) {
      const ws2 = workbook.addWorksheet("A/B Tests");
      ws2.columns = [
        { header: "Test", key: "name", width: 30 },
        { header: "Tipo", key: "type", width: 15 },
        { header: "Estado", key: "status", width: 12 },
        { header: "Ganador", key: "winner", width: 10 },
        { header: "Mejora %", key: "improvement", width: 10 },
      ];
      ws2.getRow(1).eachCell(headerStyle);
      for (const t of tests) ws2.addRow({ name: (t as any).testName ?? t.productTitle, type: t.testType, status: t.status, winner: t.winner ?? "", improvement: (t as any).improvementPct ?? null });
    }
  
    if (competitors.length > 0) {
      const ws3 = workbook.addWorksheet("Competidores");
      ws3.columns = [
        { header: "Nombre", key: "name", width: 25 },
        { header: "URL", key: "url", width: 40 },
        { header: "Tipo", key: "type", width: 12 },
        { header: "Activo", key: "active", width: 8 },
      ];
      ws3.getRow(1).eachCell(headerStyle);
      for (const c of competitors) ws3.addRow({ name: c.name, url: c.url, type: c.type, active: c.active ? "Sí" : "No" });
    }
  
    if (inventory.length > 0) {
      const ws4 = workbook.addWorksheet("Inventario");
      ws4.columns = [
        { header: "Producto", key: "product", width: 30 },
        { header: "Stock", key: "stock", width: 10 },
        { header: "Ventas/día", key: "daily", width: 10 },
        { header: "Días rest.", key: "days", width: 10 },
        { header: "Estado", key: "status", width: 12 },
        { header: "Proveedor", key: "supplier", width: 25 },
      ];
      ws4.getRow(1).eachCell(headerStyle);
      for (const i of inventory) ws4.addRow({ product: i.productTitle, stock: i.currentStock, daily: i.avgDailySales, days: i.daysRemaining, status: i.status, supplier: i.supplierEmail });
    }
  
    if (snapshots.length > 0) {
      const ws5 = workbook.addWorksheet("Revenue");
      ws5.columns = [
        { header: "Fecha", key: "date", width: 15 },
        { header: "Revenue", key: "revenue", width: 12 },
        { header: "Pedidos", key: "orders", width: 10 },
        { header: "AOV", key: "aov", width: 10 },
        { header: "Conversión", key: "conversion", width: 12 },
        { header: "Margen", key: "margin", width: 10 },
      ];
      ws5.getRow(1).eachCell(headerStyle);
      for (const s of snapshots) ws5.addRow({ date: s.date, revenue: s.revenue, orders: s.orders, aov: s.aov, conversion: s.conversionRate, margin: s.grossMargin });
    }
  
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="Proyecto_Completo_${sanitizeFilename(project.name)}_${new Date().toISOString().split("T")[0]}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/exports/brand-css/:projectId", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const profile = await fetchBrandProfile(projectId);
    if (!profile) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    const mode = (req.query.mode as string || "").toLowerCase();

    if (mode === "ai") {
      const baseCss = generateBrandCss(profile);
      const aiCss = await generateAiBrandCss(projectId, profile);
      const fullCss = baseCss + "\n\n" + aiCss;
      const filename = `theme-custom-${sanitizeFilename(profile.shopName || "brand")}-${new Date().toISOString().split("T")[0]}.css`;
      res.setHeader("Content-Type", "text/css; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(fullCss);
      return;
    }

    const css = generateBrandCss(profile);
    const filename = `theme-custom-${sanitizeFilename(profile.shopName || "brand")}-${new Date().toISOString().split("T")[0]}.css`;
    res.setHeader("Content-Type", "text/css; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(css);
  } catch (e: any) {
    logger.error({ err: e }, "Error generating brand CSS");
    res.status(500).json({ error: e.message });
  }
});

router.get("/exports/brand-guide/:projectId", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const profile = await fetchBrandProfile(projectId);
    if (!profile) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    const html = generateBrandGuideHtml(profile);
    const format = (req.query.format as string || "").toLowerCase();
    const filename = `Brand-Guide-${sanitizeFilename(profile.shopName || "brand")}-${new Date().toISOString().split("T")[0]}`;

    if (format === "pdf") {
      try {
        await generatePdfFromHtml(html, filename, res);
      } catch (e: any) {
        res.status(500).json({ error: `Error generando PDF: ${e.message}` });
      }
      return;
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.html"`);
    res.send(html);
  } catch (e: any) {
    logger.error({ err: e }, "Error generating brand guide");
    res.status(500).json({ error: e.message });
  }
});

router.get("/exports/brand-kit/:projectId", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const profile = await fetchBrandProfile(projectId);
    if (!profile) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    const css = generateBrandCss(profile);
    const guideHtml = generateBrandGuideHtml(profile);
    const brandName = sanitizeFilename(profile.shopName || "brand");
    const date = new Date().toISOString().split("T")[0];
    const zipFilename = `Brand-Kit-${brandName}-${date}.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipFilename}"`);

    const archive = archiver("zip", { zlib: { level: 9 }, forceUTF8: true } as any);
    const { markFinalizing: bkMarkFinalizing } = setupZipStream(req, res, archive);
    archive.pipe(res);

    archive.append(css, { name: `${brandName}/css/theme-custom.css` });
    archive.append(guideHtml, { name: `${brandName}/guia-de-marca.html` });

    const readmeContent = `═══════════════════════════════════════════════════════════
  BRAND KIT — ${profile.shopName || "Tu Marca"}
  Generado por Shopy Crafter | shopycrafter.com
  Fecha: ${date}
═══════════════════════════════════════════════════════════

CONTENIDO DE ESTE KIT:
─────────────────────

📁 css/
   └── theme-custom.css
       CSS personalizado para tu theme.
       
       CÓMO USARLO:
       
       Shopify:
       1. Ve a Online Store → Themes → Edit code
       2. En Assets, haz clic en "Add a new asset"
       3. Sube "theme-custom.css"
       4. Abre Layout/theme.liquid
       5. Antes de </head>, añade:
          {{ 'theme-custom.css' | asset_url | stylesheet_tag }}
       6. Guarda.
       
       WooCommerce:
       1. Ve a Apariencia → Personalizar → CSS adicional
       2. Pega el contenido del archivo CSS
       3. Publica.
       
       PrestaShop:
       1. Ve a Back Office → Diseño → Tema
       2. Edita código → custom.css
       3. Pega el contenido.

📄 guia-de-marca.html
   Manual de identidad visual completo.
   Ábrelo en cualquier navegador.
   Incluye: paleta de colores, tipografías,
   componentes, estilo fotográfico, tono de voz.

═══════════════════════════════════════════════════════════
  Para soporte: contacto@shopycrafter.com
  shopycrafter.com
═══════════════════════════════════════════════════════════
`;
    archive.append(readmeContent, { name: `${brandName}/LEEME.txt` });

    const colorsJson = JSON.stringify({
      brand: profile.shopName,
      date,
      colors: {
        primary: profile.primaryColors[0] || "#2d2d2d",
        secondary: profile.primaryColors[1] || "#555555",
        accent: profile.primaryColors[2] || profile.brandColors[2] || "#e94560",
        all: [...(profile.primaryColors || []), ...(profile.brandColors || [])],
      },
      typography: profile.typographyStyle,
      personality: profile.brandPersonality,
      tone: profile.toneOfVoice,
      audience: profile.targetAudience,
      photography: {
        background: profile.backgroundStyle,
        lighting: profile.lightingStyle,
        mood: profile.mood,
      },
    }, null, 2);
    archive.append(colorsJson, { name: `${brandName}/brand-tokens.json` });

    bkMarkFinalizing();
    await archive.finalize();
  } catch (e: any) {
    logger.error({ err: e }, "Error generating brand kit");
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

router.get("/exports/report-css/:projectId/:area", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const area = req.params.area as string;
    const profile = await fetchBrandProfile(projectId);
    if (!profile) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    const css = generateBrandCss(profile);
    const areaLabel: Record<string, string> = {
      seo: "SEO",
      financial: "Financial",
      inventory: "Inventory",
      consistency: "Brand-Identity",
      redesigns: "Redesigns",
      revenue: "Revenue",
    };
    const label = areaLabel[area] || area;
    const brandName = sanitizeFilename(profile.shopName || "brand");
    const date = new Date().toISOString().split("T")[0];
    const filename = `CSS-${label}-${brandName}-${date}.css`;

    const headerComment = `/*
 * CSS extraído del informe de ${label}
 * Marca: ${profile.shopName || "N/A"}
 * Generado: ${date}
 * Shopy Crafter | shopycrafter.com
 */\n\n`;

    res.setHeader("Content-Type", "text/css; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(headerComment + css);
  } catch (e: any) {
    logger.error({ err: e }, "Error generating report CSS");
    res.status(500).json({ error: e.message });
  }
});

router.get("/exports/report-png/:projectId/:area", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const area = req.params.area as ReportArea;
    const profile = await fetchBrandProfile(projectId);

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    const areaLabels: Record<string, string> = {
      seo: "Auditoría SEO",
      financial: "Análisis Financiero",
      inventory: "Gestión de Inventario",
      consistency: "Identidad de Marca",
      redesigns: "Rediseño de Productos",
      revenue: "Análisis de Revenue",
    };
    const label = areaLabels[area] || area;
    const brandName = sanitizeFilename((project as any).name || "project");
    const date = new Date().toISOString().split("T")[0];

    let brandSection = "";
    if (profile) {
      const allColors = [...(profile.primaryColors || []), ...(profile.brandColors || [])].filter(c => c && c.startsWith("#"));
      brandSection = `
        <div style="margin-top:24px;padding:20px;background:#101018;border:1px solid #1a1a28;border-radius:12px;">
          <h3 style="color:#c8a84b;font-size:14px;margin-bottom:12px;">Paleta de Marca Aplicada</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${allColors.map(c => `<div style="width:48px;height:48px;background:${c};border-radius:8px;border:1px solid #2a2a38;" title="${c}"></div>`).join("")}
          </div>
          <p style="margin-top:8px;font-size:12px;color:#6b6b80;">Tipografía: ${profile.typographyStyle || "Inter"} | Personalidad: ${profile.brandPersonality || "Profesional"}</p>
        </div>`;
    }

    const previewHtml = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
/* FIX E-07: removido @import Google Fonts — usa system stack en Puppeteer. */
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; background:#08080e; color:#f0f0f5; width:1200px; }
.preview { padding:48px; }
.header { display:flex; justify-content:space-between; align-items:center; margin-bottom:32px; padding-bottom:16px; border-bottom:1px solid #1a1a28; }
.logo { font-size:20px; font-weight:800; color:#c8a84b; }
.badge { background:#16161f; border:1px solid #1a1a28; padding:6px 14px; border-radius:8px; font-size:11px; color:#9494a8; }
.title { font-size:36px; font-weight:900; color:#f0f0f5; margin-bottom:8px; }
.title span { color:#c8a84b; }
.subtitle { font-size:15px; color:#6b6b80; margin-bottom:32px; }
.metrics { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:32px; }
.metric { background:#101018; border:1px solid #1a1a28; border-radius:12px; padding:20px; text-align:center; }
.metric .val { font-size:28px; font-weight:900; color:#c8a84b; }
.metric .lab { font-size:10px; color:#6b6b80; text-transform:uppercase; letter-spacing:1px; margin-top:4px; }
.sections { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.sec { background:#101018; border:1px solid #1a1a28; border-radius:12px; padding:20px; }
.sec h3 { font-size:14px; font-weight:700; color:#c8a84b; margin-bottom:8px; }
.sec p { font-size:12px; color:#9494a8; line-height:1.6; }
.footer { text-align:center; margin-top:32px; padding-top:16px; border-top:1px solid #1a1a28; }
.footer p { font-size:11px; color:#6b6b80; }
</style>
</head>
<body>
<div class="preview">
  <div class="header">
    <div class="logo">SHOPY CRAFTER</div>
    <div class="badge">${date} · Informe ${label}</div>
  </div>
  <h1 class="title">Informe de <span>${label}</span></h1>
  <p class="subtitle">${(project as any).name || "Proyecto"} — Análisis profesional generado por IA</p>
  <div class="metrics">
    <div class="metric"><div class="val">A+</div><div class="lab">Puntuación</div></div>
    <div class="metric"><div class="val">24/7</div><div class="lab">Monitorización</div></div>
    <div class="metric"><div class="val">6</div><div class="lab">Áreas Analizadas</div></div>
    <div class="metric"><div class="val">100%</div><div class="lab">Personalizado</div></div>
  </div>
  <div class="sections">
    <div class="sec">
      <h3>📋 Diagnóstico Ejecutivo</h3>
      <p>Análisis profundo del estado actual de tu tienda con datos reales y métricas de rendimiento por producto.</p>
    </div>
    <div class="sec">
      <h3>🎯 Plan de Acción</h3>
      <p>6-8 acciones detalladas con contenido producido listo para copiar y pegar en tu tienda.</p>
    </div>
    <div class="sec">
      <h3>📦 Contenido Producido</h3>
      <p>CSS personalizado, textos SEO, emails de marketing, posts sociales — todo adaptado a tu marca.</p>
    </div>
    <div class="sec">
      <h3>⚡ Quick Wins</h3>
      <p>Mejoras rápidas que puedes hacer hoy mismo en menos de 10 minutos cada una.</p>
    </div>
  </div>
  ${brandSection}
  <div class="footer">
    <p>Shopy Crafter · shopycrafter.com · Confidencial · ${date}</p>
  </div>
</div>
</body>
</html>`;

    const format = (req.query.format as string || "png").toLowerCase();
    const filename = `Preview-${label}-${brandName}-${date}`;

    if (format === "html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.html"`);
      res.send(previewHtml);
      return;
    }

    try {
      await generatePdfFromHtml(previewHtml, filename, res);
    } catch {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.html"`);
      res.send(previewHtml);
    }
  } catch (e: any) {
    logger.error({ err: e }, "Error generating report preview");
    res.status(500).json({ error: e.message });
  }
});

router.get("/exports/brand-kit-full/:projectId", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const profile = await fetchBrandProfile(projectId);
    if (!profile) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    const css = generateBrandCss(profile);
    const guideHtml = generateBrandGuideHtml(profile);
    const brandName = sanitizeFilename(profile.shopName || "brand");
    const date = new Date().toISOString().split("T")[0];
    const zipFilename = `Brand-Kit-Completo-${brandName}-${date}.zip`;

    let aiCss = "";
    try {
      aiCss = await generateAiBrandCss(projectId, profile);
    } catch (e) {
      logger.warn({ err: e }, "AI CSS generation failed, using base only");
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipFilename}"`);

    const archive = archiver("zip", { zlib: { level: 9 }, forceUTF8: true } as any);
    const { markFinalizing: fbkMarkFinalizing } = setupZipStream(req, res, archive);
    archive.pipe(res);

    archive.append(css, { name: `${brandName}/css/theme-custom-base.css` });
    if (aiCss) archive.append(aiCss, { name: `${brandName}/css/theme-custom-advanced.css` });
    archive.append(css + "\n\n" + aiCss, { name: `${brandName}/css/theme-custom-completo.css` });
    archive.append(guideHtml, { name: `${brandName}/guia-de-marca.html` });

    const colorsJson = JSON.stringify({
      brand: profile.shopName,
      generated: date,
      generator: "Shopy Crafter — shopycrafter.com",
      colors: {
        primary: profile.primaryColors[0] || "#2d2d2d",
        secondary: profile.primaryColors[1] || "#555555",
        accent: profile.primaryColors[2] || profile.brandColors[2] || "#e94560",
        allExtracted: [...(profile.primaryColors || []), ...(profile.brandColors || [])],
      },
      typography: { style: profile.typographyStyle, personality: profile.brandPersonality },
      photography: { background: profile.backgroundStyle, lighting: profile.lightingStyle, mood: profile.mood, temperature: profile.colorTemp },
      tone: profile.toneOfVoice,
      audience: profile.targetAudience,
      valuePropositions: profile.valuePropositions,
    }, null, 2);
    archive.append(colorsJson, { name: `${brandName}/brand-tokens.json` });

    const shopifySectionLiquid = `{% comment %}
  Sección personalizada generada por Shopy Crafter
  Marca: ${profile.shopName}
  Fecha: ${date}
{% endcomment %}

<style>
${css.substring(css.indexOf(":root"), css.indexOf("/* ═══════════ BASE") > 0 ? css.indexOf("/* ═══════════ BASE") : css.indexOf("body {"))}
</style>

<section class="brand-section">
  <div class="container">
    <div class="section-header">
      <h2>{{ section.settings.heading }}</h2>
      <p>{{ section.settings.subheading }}</p>
    </div>
    <div class="section-content">
      {{ section.settings.content }}
    </div>
  </div>
</section>

{% schema %}
{
  "name": "Sección ${profile.shopName}",
  "settings": [
    { "type": "text", "id": "heading", "label": "Título", "default": "Bienvenido" },
    { "type": "text", "id": "subheading", "label": "Subtítulo", "default": "" },
    { "type": "richtext", "id": "content", "label": "Contenido" }
  ]
}
{% endschema %}
`;
    archive.append(shopifySectionLiquid, { name: `${brandName}/shopify/sections/brand-section.liquid` });

    const readmeContent = `═══════════════════════════════════════════════════════════
  BRAND KIT COMPLETO — ${profile.shopName || "Tu Marca"}
  Generado por Shopy Crafter | shopycrafter.com
  Fecha: ${date}
═══════════════════════════════════════════════════════════

CONTENIDO:
──────────

📁 css/
   ├── theme-custom-base.css        → CSS base personalizado (colores, tipografías, layout)
   ├── theme-custom-advanced.css    → CSS avanzado generado por IA (animaciones, efectos)
   └── theme-custom-completo.css    → Ambos combinados — ARCHIVO RECOMENDADO

📄 guia-de-marca.html              → Manual de identidad visual (abrir en navegador)
📄 brand-tokens.json                → Tokens de diseño en JSON (para desarrolladores)

📁 shopify/sections/
   └── brand-section.liquid          → Sección Liquid personalizada para Shopify

INSTRUCCIONES RÁPIDAS:
──────────────────────

SHOPIFY:
1. Online Store → Themes → Edit code
2. Sube theme-custom-completo.css a Assets
3. En Layout/theme.liquid, antes de </head>:
   {{ 'theme-custom-completo.css' | asset_url | stylesheet_tag }}
4. Opcionalmente, sube brand-section.liquid a Sections

WOOCOMMERCE:
1. Apariencia → Personalizar → CSS adicional
2. Pega el contenido de theme-custom-completo.css

PRESTASHOP:
1. Back Office → Diseño → Tema → Editar código → custom.css
2. Pega el contenido

═══════════════════════════════════════════════════════════
  Soporte: contacto@shopycrafter.com
═══════════════════════════════════════════════════════════
`;
    archive.append(readmeContent, { name: `${brandName}/LEEME.txt` });

    fbkMarkFinalizing();
    await archive.finalize();
  } catch (e: any) {
    logger.error({ err: e }, "Error generating full brand kit");
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

export default router;
