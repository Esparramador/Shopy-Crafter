import { shopifyRequest } from "./shopify.js";
import { logger } from "./logger.js";

export interface ShopifyTheme {
  id: number;
  name: string;
  role: "main" | "unpublished" | "demo" | "development";
  created_at: string;
  updated_at: string;
  previewable: boolean;
  processing: boolean;
  theme_store_id: number | null;
}

export interface ThemeAsset {
  key: string;
  content_type: string;
  size: number;
  created_at: string;
  updated_at: string;
  public_url?: string;
}

export interface ThemeAssetContent extends ThemeAsset {
  value?: string;
  attachment?: string;
}

export interface ThemeFileTree {
  layout: string[];
  templates: string[];
  sections: string[];
  snippets: string[];
  assets: string[];
  config: string[];
  locales: string[];
  blocks: string[];
  other: string[];
}

export async function listThemes(projectId: number, shopDomain: string): Promise<ShopifyTheme[]> {
  const data = await shopifyRequest<{ themes: ShopifyTheme[] }>(
    projectId, shopDomain, "/themes.json"
  );
  return data.themes ?? [];
}

export async function getActiveTheme(projectId: number, shopDomain: string): Promise<ShopifyTheme | null> {
  const themes = await listThemes(projectId, shopDomain);
  return themes.find(t => t.role === "main") ?? null;
}

export async function listThemeAssets(projectId: number, shopDomain: string, themeId: number): Promise<ThemeAsset[]> {
  const data = await shopifyRequest<{ assets: ThemeAsset[] }>(
    projectId, shopDomain, `/themes/${themeId}/assets.json`
  );
  return data.assets ?? [];
}

export function buildFileTree(assets: ThemeAsset[]): ThemeFileTree {
  const tree: ThemeFileTree = {
    layout: [], templates: [], sections: [], snippets: [],
    assets: [], config: [], locales: [], blocks: [], other: [],
  };

  for (const asset of assets) {
    const key = asset.key;
    if (key.startsWith("layout/")) tree.layout.push(key);
    else if (key.startsWith("templates/")) tree.templates.push(key);
    else if (key.startsWith("sections/")) tree.sections.push(key);
    else if (key.startsWith("snippets/")) tree.snippets.push(key);
    else if (key.startsWith("assets/")) tree.assets.push(key);
    else if (key.startsWith("config/")) tree.config.push(key);
    else if (key.startsWith("locales/")) tree.locales.push(key);
    else if (key.startsWith("blocks/")) tree.blocks.push(key);
    else tree.other.push(key);
  }

  return tree;
}

export async function readThemeFile(
  projectId: number, shopDomain: string, themeId: number, assetKey: string
): Promise<ThemeAssetContent | null> {
  try {
    const data = await shopifyRequest<{ asset: ThemeAssetContent }>(
      projectId, shopDomain, `/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(assetKey)}`
    );
    return data.asset ?? null;
  } catch (err) {
    logger.warn({ assetKey, err: err instanceof Error ? err.message : String(err) }, "Failed to read theme file");
    return null;
  }
}

export async function writeThemeFile(
  projectId: number, shopDomain: string, themeId: number,
  assetKey: string, value: string
): Promise<ThemeAssetContent | null> {
  const data = await shopifyRequest<{ asset: ThemeAssetContent }>(
    projectId, shopDomain, `/themes/${themeId}/assets.json`, {
      method: "PUT",
      body: JSON.stringify({ asset: { key: assetKey, value } }),
    }
  );
  return data.asset ?? null;
}

export async function deleteThemeFile(
  projectId: number, shopDomain: string, themeId: number, assetKey: string
): Promise<boolean> {
  try {
    await shopifyRequest(
      projectId, shopDomain, `/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(assetKey)}`, {
        method: "DELETE",
      }
    );
    return true;
  } catch {
    return false;
  }
}

export function categorizeFile(key: string): {
  type: "liquid" | "css" | "js" | "json" | "svg" | "image" | "font" | "other";
  editable: boolean;
  description: string;
} {
  if (key.endsWith(".liquid")) return { type: "liquid", editable: true, description: "Plantilla Liquid (HTML + Liquid tags)" };
  if (key.endsWith(".css") || key.endsWith(".scss")) return { type: "css", editable: true, description: "Hoja de estilos CSS" };
  if (key.endsWith(".js")) return { type: "js", editable: true, description: "JavaScript" };
  if (key.endsWith(".json")) return { type: "json", editable: true, description: "Configuración JSON" };
  if (key.endsWith(".svg")) return { type: "svg", editable: true, description: "Imagen SVG" };
  if (/\.(png|jpg|jpeg|gif|webp|ico|avif)$/i.test(key)) return { type: "image", editable: false, description: "Imagen binaria" };
  if (/\.(woff|woff2|ttf|eot|otf)$/i.test(key)) return { type: "font", editable: false, description: "Fuente tipográfica" };
  return { type: "other", editable: true, description: "Archivo" };
}

export async function getThemeStructureSummary(
  projectId: number, shopDomain: string, themeId: number
): Promise<{
  theme: ShopifyTheme | null;
  fileTree: ThemeFileTree;
  totalFiles: number;
  editableFiles: number;
  summary: string;
}> {
  const themes = await listThemes(projectId, shopDomain);
  const theme = themes.find(t => t.id === themeId) ?? null;
  const assets = await listThemeAssets(projectId, shopDomain, themeId);
  const fileTree = buildFileTree(assets);
  const editableFiles = assets.filter(a => categorizeFile(a.key).editable).length;

  const summary = [
    `Theme: ${theme?.name ?? "Unknown"} (${theme?.role ?? "?"})`,
    `Total archivos: ${assets.length} (${editableFiles} editables)`,
    `Layout: ${fileTree.layout.length} | Templates: ${fileTree.templates.length} | Sections: ${fileTree.sections.length}`,
    `Snippets: ${fileTree.snippets.length} | Assets: ${fileTree.assets.length} | Config: ${fileTree.config.length}`,
    `Locales: ${fileTree.locales.length} | Blocks: ${fileTree.blocks.length}`,
  ].join("\n");

  return { theme, fileTree, totalFiles: assets.length, editableFiles, summary };
}

export function intelligentMerge(
  originalContent: string, editInstruction: string, newCode: string, fileType: string
): { merged: string; changes: string[] } {
  const changes: string[] = [];

  if (fileType === "css") {
    if (editInstruction.includes("añadir") || editInstruction.includes("agregar") || editInstruction.includes("add")) {
      const merged = originalContent.trimEnd() + "\n\n" + newCode.trim() + "\n";
      changes.push("CSS añadido al final del archivo");
      return { merged, changes };
    }
  }

  if (fileType === "json") {
    try {
      const original = JSON.parse(originalContent);
      const patch = JSON.parse(newCode);
      const merged = deepMerge(original, patch);
      changes.push("JSON fusionado (deep merge, sin sobrescritura de campos no mencionados)");
      return { merged: JSON.stringify(merged, null, 2), changes };
    } catch {
      changes.push("JSON no parseable — se aplica reemplazo completo");
      return { merged: newCode, changes };
    }
  }

  return { merged: newCode, changes: ["Contenido reemplazado completamente"] };
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] && typeof source[key] === "object" && !Array.isArray(source[key]) &&
      result[key] && typeof result[key] === "object" && !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export function analyzeThemeFileContent(key: string, content: string): {
  fileType: string;
  lineCount: number;
  liquidTags: string[];
  cssSelectors: string[];
  schemaBlocks: string[];
  includes: string[];
  sections: string[];
  warnings: string[];
} {
  const lines = content.split("\n");
  const lineCount = lines.length;
  const fileType = categorizeFile(key).type;

  const liquidTags: string[] = [];
  const cssSelectors: string[] = [];
  const schemaBlocks: string[] = [];
  const includes: string[] = [];
  const sections: string[] = [];
  const warnings: string[] = [];

  if (fileType === "liquid") {
    const tagMatches = content.match(/\{%[-\s]*(\w+)/g);
    if (tagMatches) {
      const unique = [...new Set(tagMatches.map(m => m.replace(/\{%[-\s]*/, "")))];
      liquidTags.push(...unique);
    }

    const renderMatches = content.match(/\{%[-\s]*(?:render|include)\s+['"]([^'"]+)['"]/g);
    if (renderMatches) {
      includes.push(...renderMatches.map(m => {
        const match = m.match(/['"]([^'"]+)['"]/);
        return match ? match[1] : m;
      }));
    }

    const sectionMatches = content.match(/\{%[-\s]*section\s+['"]([^'"]+)['"]/g);
    if (sectionMatches) {
      sections.push(...sectionMatches.map(m => {
        const match = m.match(/['"]([^'"]+)['"]/);
        return match ? match[1] : m;
      }));
    }

    const schemaMatch = content.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
    if (schemaMatch) {
      try {
        const schema = JSON.parse(schemaMatch[1]);
        schemaBlocks.push(`name: ${schema.name ?? "unnamed"}`);
        if (schema.settings) schemaBlocks.push(`settings: ${schema.settings.length} campos`);
        if (schema.blocks) schemaBlocks.push(`blocks: ${schema.blocks.length} tipos`);
        if (schema.presets) schemaBlocks.push(`presets: ${schema.presets.length}`);
      } catch {
        schemaBlocks.push("schema presente pero no parseable");
      }
    }

    if (content.includes("{{ content_for_header }}")) warnings.push("Contiene content_for_header (archivo de layout principal)");
    if (content.includes("{{ content_for_layout }}")) warnings.push("Contiene content_for_layout (layout)");

    if (lineCount > 500) warnings.push(`Archivo largo (${lineCount} líneas) — considera dividir en snippets`);
    if (includes.length > 10) warnings.push(`Muchas inclusiones (${includes.length}) — puede afectar rendimiento`);
  }

  if (fileType === "css") {
    const selectorMatches = content.match(/^[^@\s{/][^{]*\{/gm);
    if (selectorMatches) {
      cssSelectors.push(...selectorMatches.slice(0, 30).map(s => s.replace("{", "").trim()));
    }
    if (lineCount > 1000) warnings.push(`CSS muy largo (${lineCount} líneas) — considera dividir`);
  }

  return { fileType, lineCount, liquidTags, cssSelectors, schemaBlocks, includes, sections, warnings };
}

export const THEME_ARCHITECTURE_KNOWLEDGE = `
═══ ARQUITECTURA DE THEMES SHOPIFY (Online Store 2.0) ═══

ESTRUCTURA DE ARCHIVOS:
├── layout/          → Plantillas base (theme.liquid = wrapper principal, contiene <html>, <head>, {{ content_for_header }}, {{ content_for_layout }})
├── templates/       → JSON templates (index.json, product.json, collection.json, page.json, cart.json, blog.json, article.json, 404.json, search.json, customers/*.json)
│   └── Cada .json define qué sections renderizar y en qué orden
├── sections/        → Componentes reutilizables con {% schema %} (header, footer, hero, featured-collection, newsletter, etc.)
│   └── Cada sección tiene: HTML+Liquid + {% schema %} con settings/blocks/presets
├── snippets/        → Fragmentos reutilizables sin schema (product-card, price, image, icon, etc.)
│   └── Se incluyen con {% render 'snippet-name' %} (NO {% include %} que es legacy)
├── blocks/          → Bloques de sección (OS 2.0) — sub-componentes de sections
├── assets/          → CSS, JS, imágenes, fuentes, SVGs
├── config/          → settings_schema.json (define los controles del Theme Editor) + settings_data.json (valores actuales)
└── locales/         → Traducciones (en.default.json, es.json, etc.)

LIQUID FUNDAMENTALS:
- Variables: {{ product.title }}, {{ shop.name }}, {{ settings.color_primary }}
- Tags: {% if %}, {% for %}, {% unless %}, {% case %}, {% assign %}, {% capture %}
- Filtros: | money, | img_url: '500x', | strip_html, | truncate: 100, | date: '%Y-%m-%d'
- Objetos globales: product, collection, cart, customer, shop, settings, section, block, template, request, content_for_header
- Secciones: {% section 'header' %} en layouts, o referenciadas en templates JSON
- Render vs Include: {% render 'snippet' %} (aislado, recomendado) vs {% include %} (legacy, comparte scope)

SCHEMA DE SECCIÓN ({% schema %}):
{
  "name": "Nombre visible en Theme Editor",
  "tag": "section",
  "class": "section-class",
  "settings": [
    { "type": "text", "id": "heading", "label": "Título", "default": "..." },
    { "type": "richtext", "id": "description", "label": "Descripción" },
    { "type": "image_picker", "id": "image", "label": "Imagen" },
    { "type": "color", "id": "bg_color", "label": "Color de fondo", "default": "#ffffff" },
    { "type": "select", "id": "layout", "label": "Layout", "options": [...] },
    { "type": "range", "id": "padding", "min": 0, "max": 100, "step": 4, "default": 36, "label": "Padding" },
    { "type": "url", "id": "link", "label": "Enlace" },
    { "type": "product", "id": "featured_product", "label": "Producto destacado" },
    { "type": "collection", "id": "collection", "label": "Colección" }
  ],
  "blocks": [
    { "type": "slide", "name": "Slide", "settings": [...] },
    { "type": "testimonial", "name": "Testimonio", "settings": [...] }
  ],
  "presets": [{ "name": "Hero Banner", "category": "Image" }],
  "max_blocks": 6,
  "templates": ["index", "page"]
}

TEMPLATES JSON (Online Store 2.0):
{
  "sections": {
    "header": { "type": "header", "settings": {} },
    "hero": { "type": "hero-banner", "settings": { "heading": "Welcome" } },
    "featured": { "type": "featured-collection", "settings": { "collection": "frontpage" } }
  },
  "order": ["header", "hero", "featured"]
}

CSS EN SHOPIFY:
- Archivos en assets/ → se referencian con {{ 'style.css' | asset_url | stylesheet_tag }}
- Variables CSS personalizables: usar settings del theme + custom properties
- Breakpoints estándar: 750px (mobile), 990px (tablet), 1200px (desktop)
- NUNCA borrar estilos existentes sin entender dependencias
- Prefijo de clases: usar prefijo único para evitar colisiones (ej: .sc-hero, .sc-banner)

SETTINGS_SCHEMA.JSON:
Define los controles del Theme Editor (Personalizar). Estructura:
[
  {
    "name": "Colors",
    "settings": [
      { "type": "color", "id": "color_primary", "label": "Primary", "default": "#000000" }
    ]
  },
  {
    "name": "Typography",
    "settings": [
      { "type": "font_picker", "id": "heading_font", "label": "Heading font", "default": "helvetica_n4" }
    ]
  }
]

REGLAS CRÍTICAS PARA EDITAR THEMES:
1. SIEMPRE leer el archivo ANTES de editarlo — NUNCA sobrescribir a ciegas
2. Entender las dependencias: qué snippets incluye, qué variables usa, qué sección lo llama
3. Los archivos de layout (theme.liquid, password.liquid) son CRÍTICOS — un error rompe toda la tienda
4. settings_data.json contiene TODOS los valores personalizados del merchant — NUNCA sobrescribirlo entero
5. Para CSS: añadir al final o crear nuevo archivo, NUNCA borrar selectores existentes sin verificar
6. Para sections: preservar el {% schema %} existente, solo modificar si se entiende el impacto
7. Para templates JSON: respetar el orden y los IDs de sección existentes
8. Backup mental: siempre poder revertir un cambio (guardar el original en la respuesta)
9. Usar {% render %} en vez de {% include %} para nuevos snippets
10. Validar Liquid syntax: tags cerrados, filtros correctos, objetos accesibles en el scope

SEO EN THEMES:
- <title> en theme.liquid: {{ page_title }} — {{ shop.name }}
- Meta description: <meta name="description" content="{{ page_description | escape }}">
- Canonical: <link rel="canonical" href="{{ canonical_url }}">
- Schema.org JSON-LD: Product, BreadcrumbList, Organization, WebSite
- Open Graph + Twitter Cards en <head>
- Alt text en imágenes: {{ image.alt | escape }}
- Heading hierarchy: solo 1 <h1> por página
- Lazy loading: loading="lazy" en imágenes below the fold
- Preload: <link rel="preload"> para CSS crítico y hero image

RENDIMIENTO:
- Minimizar Liquid loops anidados (O(n²) en colecciones grandes)
- Usar {% render %} (aislado) vs {% include %} (comparte scope, más lento)
- Paginar colecciones: {% paginate collection.products by 12 %}
- Defer JS no crítico: <script defer src="...">
- Preconnect CDN: <link rel="preconnect" href="https://cdn.shopify.com">
- Optimizar imágenes: {{ image | image_url: width: 800 }} con srcset
- Evitar inline styles — usar clases CSS
`;

export const EXPERT_FINANCIAL_KNOWLEDGE = `
═══ ANÁLISIS FINANCIERO EXPERTO ═══

MÉTRICAS CLAVE ECOMMERCE:
- AOV (Average Order Value): Ingreso total / Número de pedidos
- CLV (Customer Lifetime Value): AOV × Frecuencia de compra × Vida media del cliente
- CAC (Customer Acquisition Cost): Gasto marketing / Nuevos clientes adquiridos
- ROAS (Return on Ad Spend): Ingresos de ads / Gasto en ads (>4x es bueno)
- Margen bruto: (Ingresos - COGS) / Ingresos × 100
- Margen neto: (Ingresos - Todos los costes) / Ingresos × 100
- Break-even: Costes fijos / (Precio - Coste variable unitario)
- Burn rate: Gasto mensual operativo sin ingresos
- Runway: Capital disponible / Burn rate = meses de supervivencia

ESTRUCTURA DE COSTES SHOPIFY:
- Shopify Basic: $39/mes | Shopify: $105/mes | Advanced: $399/mes
- Comisión tarjeta: 2.9% + $0.30 (Basic) | 2.6% + $0.30 (Shopify) | 2.4% + $0.30 (Advanced)
- Comisión Shopify Payments: 0% con Shopify Payments, 2% sin (Basic), 1% (Shopify), 0.5% (Advanced)
- Apps: presupuesto $50-500/mes según complejidad
- Theme premium: $150-380 one-time
- Dominio: $14-50/año

PRICING PSYCHOLOGY:
- Anchoring: Mostrar precio tachado antes (€49 → €29)
- Charm pricing: Terminar en .97 o .99 (efecto "left-digit")
- Decoy effect: Plan intermedio parece mejor frente al premium
- Bundle discount: Descuento percibido mayor que el real
- Free shipping threshold: "Envío gratis desde €X" (aumenta AOV 15-30%)
- Scarcity: "Solo quedan 3" / "Oferta válida 24h"
- Social proof pricing: "El más vendido" / "Elegido por 10.000+ clientes"

UNIT ECONOMICS MODELO:
Precio venta: €X
- COGS: €Y (materiales + producción + packaging)
- Envío: €Z
- Comisiones: €W (Shopify + pasarela pago)
- Marketing por unidad: €V (CAC / unidades por cliente)
= Margen por unidad: €(X-Y-Z-W-V)
= Margen %: ((X-Y-Z-W-V)/X) × 100

BENCHMARK POR INDUSTRIA:
- Fashion/Apparel: Margen bruto 50-70%, AOV €60-120
- Electronics: Margen bruto 15-30%, AOV €150-400
- Beauty/Cosmetics: Margen bruto 60-80%, AOV €40-80
- Home & Garden: Margen bruto 40-60%, AOV €80-200
- Food & Beverage: Margen bruto 30-50%, AOV €30-60
- Jewelry: Margen bruto 60-80%, AOV €100-500
- Sports/Fitness: Margen bruto 40-60%, AOV €60-150
- Pet supplies: Margen bruto 40-55%, AOV €35-70
- Art/Crafts/Comics: Margen bruto 50-75%, AOV €20-80
`;

export const EXPERT_SEO_KNOWLEDGE = `
═══ SEO TÉCNICO EXPERTO PARA SHOPIFY ═══

ON-PAGE SEO:
- Title tag: Keyword principal + Marca. Máx 60 chars. Formato: "Producto - Categoría | Marca"
- Meta description: 150-160 chars. Incluir keyword + CTA. Único por página.
- H1: Único por página, contiene keyword principal.
- URL slug: /products/keyword-principal (corto, sin stop words, sin números ID)
- Alt text imágenes: Descriptivo, incluir keyword natural. NO "img001" ni "foto producto"
- Internal linking: Cada producto enlaza a colección, productos relacionados, blog posts relevantes
- Schema.org: Product (price, availability, rating), BreadcrumbList, Organization, FAQ

TECHNICAL SEO SHOPIFY:
- Robots.txt: Shopify lo genera automáticamente. No bloquear /collections/ ni /products/
- Sitemap: /sitemap.xml auto-generado. Verificar en Google Search Console
- Canonical URLs: Shopify las genera, pero verificar en product.liquid
- Pagination: rel="next" / rel="prev" en colecciones paginadas
- 301 Redirects: Admin → Online Store → Navigation → URL Redirects
- Speed: Core Web Vitals (LCP <2.5s, CLS <0.1, INP <200ms)
- Mobile-first: Google indexa la versión móvil primero
- HTTPS: Shopify lo incluye por defecto (SSL gratis)
- Hreflang: Para tiendas multi-idioma
- Structured data: JSON-LD en theme.liquid o product.liquid

KEYWORD RESEARCH PARA ECOMMERCE:
- Buyer intent keywords: "comprar X", "X barato", "mejor X para Y", "X vs Y"
- Commercial investigation: "review X", "opiniones X", "comparativa X"
- Informational: "cómo usar X", "qué es X", "guía de X"
- Long-tail: Más específicas, menos competencia, mayor conversión
- LSI (Latent Semantic Indexing): Sinónimos y términos relacionados
- Tools: Google Keyword Planner, Ahrefs, SEMrush, Ubersuggest

CONTENT STRATEGY:
- Blog posts: 1-2/semana, 1500+ palabras, keyword focused
- Product descriptions: 300+ palabras, features + benefits + uso + FAQ
- Collection descriptions: 150-300 palabras con keywords de categoría
- FAQ pages: Schema FAQ markup para featured snippets
- User-generated content: Reviews como contenido indexable

LINK BUILDING PARA ECOMMERCE:
- Guest posting en blogs del nicho
- Product reviews por influencers/bloggers
- PR digital (lanzamientos, stories)
- Directorios de nicho
- Broken link building
- Partnerships/colaboraciones
- Social signals (no ranking directo pero amplificación)

ERRORES SEO COMUNES EN SHOPIFY:
- Contenido duplicado por variant URLs (?variant=123)
- Thin content en productos sin descripción
- Canonical tags incorrectos
- Imágenes sin alt text
- Páginas de colección sin texto descriptivo
- No usar breadcrumbs
- Meta descriptions duplicadas o ausentes
- No optimizar para Core Web Vitals
- No usar Schema.org Product
`;

export const EXPERT_MARKETING_KNOWLEDGE = `
═══ MARKETING DIGITAL Y BRANDING EXPERTO ═══

FUNNEL DE VENTAS ECOMMERCE:
1. AWARENESS: Social media, SEO, Ads, PR, Influencers
2. CONSIDERATION: Blog, Email, Retargeting, Reviews, Comparativas
3. CONVERSION: Landing pages, Ofertas, Urgency, Social proof, Cart recovery
4. RETENTION: Email flows, Loyalty program, Cross-sell, Upsell, Community
5. ADVOCACY: Referrals, UGC, Reviews, Testimonios, Ambassador programs

EMAIL MARKETING (KLAVIYO):
Flows esenciales:
- Welcome Series: 3-5 emails tras suscripción. E1: Bienvenida + descuento. E2: Historia de marca. E3: Best sellers. E4: Social proof. E5: Último recordatorio descuento.
- Abandoned Cart: 3 emails. E1: 1h después (recordatorio). E2: 24h (urgencia + social proof). E3: 48h (descuento extra).
- Post-Purchase: E1: Confirmación + tracking. E2: Tips de uso. E3: Review request. E4: Cross-sell.
- Win-Back: Para clientes inactivos 60-90 días. Descuento personalizado + "te echamos de menos".
- Browse Abandonment: Recordar productos vistos sin comprar.
Métricas objetivo: Open rate >25%, Click rate >3%, Revenue per recipient >$0.50

SOCIAL MEDIA STRATEGY:
- Instagram: Producto lifestyle, Reels (reach), Stories (engagement), Shopping tags
- TikTok: Trends, behind-the-scenes, UGC, TikTok Shop
- Pinterest: Product pins, Idea pins, SEO visual (alta intención de compra)
- Facebook: Groups, Marketplace, Ads (retargeting)
- Frecuencia: 4-7 posts/semana Instagram, 1-3 TikToks/día, 5-10 pins/día

PAID MEDIA:
- Google Ads: Shopping (ROAS 4-8x), Search (brand terms), Display (retargeting)
- Meta Ads: Lookalike audiences, Dynamic product ads, Catalog sales, Collection ads
- Budget mínimo recomendado: €500-1000/mes para datos significativos
- Testing: A/B creatives, audiencias, placements. Mínimo 3-5 días por test
- Scaling: Incrementar presupuesto 20% cada 48h si ROAS es positivo

BRANDING:
- Brand identity: Logo, colores, tipografía, tono de voz, valores, misión
- Brand positioning: Qué problema resuelves, para quién, cómo te diferencias
- Brand voice: Consistente en todos los canales. Formal/informal, técnico/accesible, serio/divertido
- Visual identity: Fotografía consistente, packaging memorable, unboxing experience
- Brand story: Origen, propósito, impacto. Conectar emocionalmente.

CRO (CONVERSION RATE OPTIMIZATION):
- Homepage: Hero claro, value proposition, trust signals, featured products
- Product page: Imágenes grandes (zoom), description completa, reviews, size guide, FAQ, related products
- Cart: Resumen claro, shipping estimado, payment badges, cross-sell
- Checkout: Minimal distractions, guest checkout, multiple payment, trust badges
- Benchmark: Conversion rate 1-3% (promedio), 3-5% (bueno), >5% (excelente)
`;

export const EXPERT_SUPPLIER_KNOWLEDGE = `
═══ PROVEEDORES Y CADENA DE SUMINISTRO ═══

SOURCING PLATFORMS:
- Alibaba: Fabricantes directos China. MOQ 100-1000 unidades. Lead time 30-60 días.
- 1688.com: Versión china de Alibaba. Precios más bajos, requiere agente.
- Global Sources: Proveedores verificados, ferias comerciales.
- DHgate: Smaller MOQ, dropshipping-friendly.
- IndiaMART: Fabricantes India. Textil, joyería, artesanía.
- ThomasNet: Fabricantes USA/Europa. Mayor calidad, mayor precio.
- Faire: Wholesale marketplace para retail independiente.

EVALUACIÓN DE PROVEEDORES:
- Trade Assurance: Verificar en Alibaba (protección al comprador)
- Muestras: SIEMPRE pedir muestra antes de pedido grande (€20-100)
- Certificaciones: ISO 9001 (calidad), ISO 14001 (ambiental), BSCI (ética laboral)
- Capacidad de producción: Unidades/mes, equipamiento, personal
- Comunicación: Respuesta <24h, inglés/español, WeChat/WhatsApp
- Payment terms: T/T (30% depósito + 70% antes envío), L/C para pedidos grandes
- Incoterms: FOB (Free On Board), CIF (Cost Insurance Freight), DDP (Delivered Duty Paid)

CÁLCULO DE COSTES IMPORTACIÓN:
- Precio FOB (fábrica)
- + Flete marítimo/aéreo (€2-8/kg marítimo, €8-15/kg aéreo)
- + Seguro (0.3-0.5% del valor)
- + Aranceles aduaneros (% según código HS y país origen)
- + IVA importación (21% España)
- + Gastos despacho aduanas (€50-200)
- + Transporte interno (€50-300)
- = Coste landed (en tu almacén)

DROPSHIPPING vs STOCK:
Dropshipping:
- Pro: Sin inventario, bajo riesgo, fácil empezar
- Contra: Márgenes 15-30%, envío lento (7-21 días), sin control de calidad
- Plataformas: CJdropshipping, Spocket, Zendrop, DSers
Stock propio:
- Pro: Márgenes 50-70%, envío rápido, control calidad, branding
- Contra: Inversión inicial, riesgo inventario, almacenamiento
- Break-even: Generalmente rentable desde 50-100 ventas/mes

FULFILLMENT:
- Self-fulfillment: Control total, viable hasta 50-100 pedidos/día
- 3PL (Third Party Logistics): ShipBob, ShipStation, Deliverr. Desde $5-10/pedido
- Amazon FBA: Multi-channel fulfillment. Prime badge. Comisiones 15-30%
- Shopify Fulfillment Network: Integración nativa, precios competitivos
`;
