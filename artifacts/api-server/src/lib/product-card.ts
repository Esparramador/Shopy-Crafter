import { sanitizeHtml } from "./html-escape.js";

const BRAND = {
  gold: "#c8a84b",
  goldLight: "#e6d9a8",
  goldDark: "#8b6914",
  dark: "#08080e",
  darkAlt: "#0c0c14",
  card: "#101018",
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

export interface ProductCardData {
  title: string;
  status: string;
  price: string | number;
  compareAtPrice?: string | number | null;
  imageUrl?: string | null;
  imageCount: number;
  descriptionLength: number;
  tagsCount: number;
  tags?: string;
  variantCount: number;
  published: boolean;
  auditScore: number;
  auditGrade: string;
  hasComparePrice: boolean;
  hasMetaTitle?: boolean;
  hasMetaDesc?: boolean;
  hasSchema?: boolean;
  hasAltTexts?: boolean;
  cleanHandle?: boolean;
  seoScore?: number;
  cogs?: number | null;
  margin?: number | null;
  productType?: string | null;
  vendor?: string | null;
  issues?: string[];
}

interface Recommendation {
  dimension: string;
  icon: string;
  status: "success" | "warning" | "critical";
  current: string;
  recommendation: string;
  impact: string;
}

function getRecommendations(p: ProductCardData): Recommendation[] {
  const recs: Recommendation[] = [];

  const titleLen = p.title.length;
  if (titleLen < 40) {
    recs.push({ dimension: "Titulo", icon: "&#9998;", status: "critical", current: `${titleLen} caracteres`, recommendation: "Ampliar a 45-65 caracteres con keyword principal al inicio + beneficio clave", impact: "+15-25% CTR en busquedas" });
  } else if (titleLen > 70) {
    recs.push({ dimension: "Titulo", icon: "&#9998;", status: "warning", current: `${titleLen} caracteres`, recommendation: "Reducir a 45-65 caracteres — se trunca en Google y Shopify", impact: "+10% visibilidad SERP" });
  } else {
    recs.push({ dimension: "Titulo", icon: "&#9998;", status: "success", current: `${titleLen} chars — longitud optima`, recommendation: "Titulo bien optimizado", impact: "SEO optimizado" });
  }

  if (p.descriptionLength < 200) {
    recs.push({ dimension: "Descripcion", icon: "&#128221;", status: "critical", current: `${p.descriptionLength} caracteres`, recommendation: "Crear descripcion profesional de 800-1200 palabras con 8 secciones: Hero Hook, Beneficios, Specs, Casos de uso, Cuidado, FAQ, CTA, Trust Badges", impact: "+25-40% conversion" });
  } else if (p.descriptionLength < 500) {
    recs.push({ dimension: "Descripcion", icon: "&#128221;", status: "warning", current: `${p.descriptionLength} caracteres`, recommendation: "Ampliar a 800+ palabras con storytelling, FAQ schema-ready y beneficios detallados", impact: "+15-25% conversion" });
  } else if (p.descriptionLength < 1000) {
    recs.push({ dimension: "Descripcion", icon: "&#128221;", status: "warning", current: `${p.descriptionLength} caracteres`, recommendation: "Buena base — anadir FAQ, especificaciones tecnicas y trust badges para llegar a 1200+ palabras", impact: "+10-15% conversion" });
  } else {
    recs.push({ dimension: "Descripcion", icon: "&#128221;", status: "success", current: `${p.descriptionLength} chars — descripcion completa`, recommendation: "Descripcion robusta y profesional", impact: "Conversion optimizada" });
  }

  if (p.imageCount === 0) {
    recs.push({ dimension: "Imagenes", icon: "&#128247;", status: "critical", current: "Sin imagenes", recommendation: "Anadir minimo 4 imagenes: Hero, Lifestyle, Detalle, Packaging — productos con imagenes convierten 94% mas", impact: "+94% conversion" });
  } else if (p.imageCount < 3) {
    recs.push({ dimension: "Imagenes", icon: "&#128247;", status: "warning", current: `${p.imageCount} imagen${p.imageCount > 1 ? "es" : ""}`, recommendation: `Anadir ${4 - p.imageCount} imagenes mas (Hero, Lifestyle, Detalle, Packaging) — cada imagen adicional mejora la confianza del comprador`, impact: "+30-50% conversion" });
  } else if (p.imageCount < 8) {
    recs.push({ dimension: "Imagenes", icon: "&#128247;", status: "warning", current: `${p.imageCount} imagenes`, recommendation: `Ampliar a 8+ imagenes con variantes de angulo, contexto de uso y close-ups — las mejores tiendas Shopify usan 8-12 imagenes`, impact: "+15-25% conversion" });
  } else {
    recs.push({ dimension: "Imagenes", icon: "&#128247;", status: "success", current: `${p.imageCount} imagenes — galeria completa`, recommendation: "Excelente galeria de producto", impact: "Confianza maximizada" });
  }

  const price = parseFloat(String(p.price || "0"));
  if (!p.hasComparePrice && price > 0) {
    recs.push({ dimension: "Precio", icon: "&#128176;", status: "warning", current: `${price.toFixed(2)}€ sin precio tachado`, recommendation: "Anadir compare_at_price (20-35% superior) — el efecto de anclaje aumenta el valor percibido y la urgencia de compra", impact: "+12-20% conversion" });
  } else if (price <= 0) {
    recs.push({ dimension: "Precio", icon: "&#128176;", status: "critical", current: "Sin precio definido", recommendation: "Establecer precio competitivo basado en investigacion de mercado", impact: "Producto no vendible" });
  } else {
    const compareAt = parseFloat(String(p.compareAtPrice || "0"));
    const discount = compareAt > 0 ? Math.round((1 - price / compareAt) * 100) : 0;
    recs.push({ dimension: "Precio", icon: "&#128176;", status: "success", current: `${price.toFixed(2)}€${compareAt > 0 ? ` (antes ${compareAt.toFixed(2)}€ — ${discount}% dto)` : ""}`, recommendation: "Estrategia de pricing con anclaje activa", impact: "Percepcion de valor optimizada" });
  }

  if (p.tagsCount < 5) {
    recs.push({ dimension: "Tags SEO", icon: "&#127991;", status: "critical", current: `${p.tagsCount} tags`, recommendation: "Ampliar a 22-28 tags: keywords transaccionales, long-tail, materiales, audiencia, estilo, temporada, LSI semanticas", impact: "+20-35% trafico organico" });
  } else if (p.tagsCount < 15) {
    recs.push({ dimension: "Tags SEO", icon: "&#127991;", status: "warning", current: `${p.tagsCount} tags`, recommendation: "Anadir tags hasta 22+: incluir keywords long-tail, intenciones de busqueda transaccionales y LSI semanticas", impact: "+10-20% trafico organico" });
  } else if (p.tagsCount < 22) {
    recs.push({ dimension: "Tags SEO", icon: "&#127991;", status: "warning", current: `${p.tagsCount} tags`, recommendation: "Cerca del optimo — anadir tags de temporada, buyer persona especifico y keywords en ingles para SEO internacional", impact: "+5-10% trafico" });
  } else {
    recs.push({ dimension: "Tags SEO", icon: "&#127991;", status: "success", current: `${p.tagsCount} tags — cobertura completa`, recommendation: "Tags SEO bien optimizados", impact: "Trafico organico maximizado" });
  }

  if (p.hasMetaTitle !== undefined) {
    const seoChecks = [
      { label: "Meta Title", ok: !!p.hasMetaTitle },
      { label: "Meta Description", ok: !!p.hasMetaDesc },
      { label: "Schema JSON-LD", ok: !!p.hasSchema },
      { label: "Alt Texts", ok: !!p.hasAltTexts },
      { label: "Handle limpio", ok: !!p.cleanHandle },
    ];
    const passing = seoChecks.filter(c => c.ok).length;
    const failing = seoChecks.filter(c => !c.ok).map(c => c.label);
    if (failing.length > 0) {
      recs.push({ dimension: "SEO Meta", icon: "&#128269;", status: failing.length >= 3 ? "critical" : "warning", current: `${passing}/5 criterios SEO`, recommendation: `Faltan: ${failing.join(", ")} — cada meta tag mejora la indexacion y click-through en Google`, impact: `+${failing.length * 8}-${failing.length * 15}% CTR SERP` });
    } else {
      recs.push({ dimension: "SEO Meta", icon: "&#128269;", status: "success", current: "5/5 criterios SEO", recommendation: "SEO completo y optimizado", impact: "Indexacion maxima" });
    }
  }

  if (p.variantCount <= 1) {
    recs.push({ dimension: "Variantes", icon: "&#128230;", status: "warning", current: "1 variante (por defecto)", recommendation: "Crear variantes inteligentes segun tipo de producto (tallas, colores, materiales, formatos) — los productos con variantes generan 2-3x mas revenue", impact: "+40-120% revenue" });
  } else if (p.variantCount < 4) {
    recs.push({ dimension: "Variantes", icon: "&#128230;", status: "warning", current: `${p.variantCount} variantes`, recommendation: "Ampliar opciones para cubrir mas preferencias del comprador — las tiendas top tienen 6-30 variantes", impact: "+15-30% revenue" });
  } else {
    recs.push({ dimension: "Variantes", icon: "&#128230;", status: "success", current: `${p.variantCount} variantes`, recommendation: "Catalogo de variantes profesional", impact: "Opciones completas" });
  }

  if (!p.published) {
    recs.push({ dimension: "Visibilidad", icon: "&#128064;", status: "critical", current: "NO PUBLICADO", recommendation: "Publicar inmediatamente — el producto es INVISIBLE para los clientes de tu tienda", impact: "0 ventas hasta publicar" });
  }

  return recs;
}

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return BRAND.jade;
  if (grade.startsWith("B")) return BRAND.gold;
  if (grade.startsWith("C")) return BRAND.orange;
  return BRAND.red;
}

function gradeBg(grade: string): string {
  if (grade.startsWith("A")) return BRAND.jadeBg;
  if (grade.startsWith("B")) return "rgba(200,168,75,.12)";
  if (grade.startsWith("C")) return BRAND.orangeBg;
  return BRAND.redBg;
}

function scoreColor(score: number): string {
  if (score >= 85) return BRAND.jade;
  if (score >= 60) return BRAND.gold;
  if (score >= 40) return BRAND.orange;
  return BRAND.red;
}

function statusBadge(status: string, published: boolean): string {
  if (!published) return `<span style="display:inline-block;padding:3px 10px;border-radius:6px;font-size:10px;font-weight:700;letter-spacing:0.5px;background:${BRAND.redBg};color:${BRAND.red};border:1px solid rgba(244,63,94,.2);text-transform:uppercase;">No Publicado</span>`;
  if (status === "active") return `<span style="display:inline-block;padding:3px 10px;border-radius:6px;font-size:10px;font-weight:700;letter-spacing:0.5px;background:${BRAND.jadeBg};color:${BRAND.jade};border:1px solid rgba(52,211,153,.2);text-transform:uppercase;">Activo</span>`;
  if (status === "draft") return `<span style="display:inline-block;padding:3px 10px;border-radius:6px;font-size:10px;font-weight:700;letter-spacing:0.5px;background:rgba(200,168,75,.1);color:${BRAND.gold};border:1px solid rgba(200,168,75,.2);text-transform:uppercase;">Borrador</span>`;
  if (status === "archived") return `<span style="display:inline-block;padding:3px 10px;border-radius:6px;font-size:10px;font-weight:700;letter-spacing:0.5px;background:${BRAND.orangeBg};color:${BRAND.orange};border:1px solid rgba(245,158,11,.2);text-transform:uppercase;">Archivado</span>`;
  return `<span style="display:inline-block;padding:3px 10px;border-radius:6px;font-size:10px;font-weight:700;letter-spacing:0.5px;background:${BRAND.surface};color:${BRAND.muted};border:1px solid ${BRAND.border};text-transform:uppercase;">${sanitizeHtml(status || "?")}</span>`;
}

function recStatusColor(status: "success" | "warning" | "critical"): { border: string; bg: string; icon: string; iconColor: string } {
  if (status === "success") return { border: `rgba(52,211,153,.25)`, bg: BRAND.jadeBg, icon: "&#10003;", iconColor: BRAND.jade };
  if (status === "warning") return { border: `rgba(245,158,11,.25)`, bg: BRAND.orangeBg, icon: "&#9888;", iconColor: BRAND.orange };
  return { border: `rgba(244,63,94,.25)`, bg: BRAND.redBg, icon: "&#10007;", iconColor: BRAND.red };
}

export function buildProductCard(product: ProductCardData): string {
  const esc = sanitizeHtml;
  const price = parseFloat(String(product.price || "0"));
  const compareAt = parseFloat(String(product.compareAtPrice || "0"));
  const recs = getRecommendations(product);
  const sc = scoreColor(product.auditScore);
  const gc = gradeColor(product.auditGrade);
  const gb = gradeBg(product.auditGrade);

  const imgSection = product.imageUrl
    ? `<div style="width:140px;height:140px;flex-shrink:0;border-radius:12px;overflow:hidden;background:${BRAND.surface};border:1px solid ${BRAND.border};">
        <img src="${esc(product.imageUrl)}" alt="${esc(product.title)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:${BRAND.muted};font-size:32px;\\'>&#128247;</div>'" />
      </div>`
    : `<div style="width:140px;height:140px;flex-shrink:0;border-radius:12px;overflow:hidden;background:${BRAND.surface};border:1px solid ${BRAND.border};display:flex;align-items:center;justify-content:center;color:${BRAND.muted};font-size:32px;">&#128247;</div>`;

  const imgCountColor = product.imageCount === 0 ? BRAND.red : product.imageCount < 3 ? BRAND.orange : product.imageCount < 8 ? BRAND.gold : BRAND.jade;

  const tagsColor = product.tagsCount < 5 ? BRAND.red : product.tagsCount < 15 ? BRAND.orange : product.tagsCount < 22 ? BRAND.gold : BRAND.jade;

  const variantColor = product.variantCount <= 1 ? BRAND.orange : product.variantCount < 4 ? BRAND.gold : BRAND.jade;

  const descBarWidth = Math.min(100, Math.round((product.descriptionLength / 1200) * 100));
  const descColor = product.descriptionLength < 200 ? BRAND.red : product.descriptionLength < 500 ? BRAND.orange : product.descriptionLength < 1000 ? BRAND.gold : BRAND.jade;

  let priceHtml = "";
  if (price > 0) {
    priceHtml = `<span style="font-size:22px;font-weight:900;color:${BRAND.white};letter-spacing:-0.5px;">${price.toFixed(2)}€</span>`;
    if (compareAt > 0 && compareAt > price) {
      const discount = Math.round((1 - price / compareAt) * 100);
      priceHtml += ` <span style="font-size:13px;color:${BRAND.muted};text-decoration:line-through;margin-left:6px;">${compareAt.toFixed(2)}€</span>`;
      priceHtml += ` <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;background:${BRAND.jadeBg};color:${BRAND.jade};border:1px solid rgba(52,211,153,.2);margin-left:6px;">-${discount}%</span>`;
    }
  } else {
    priceHtml = `<span style="font-size:16px;font-weight:700;color:${BRAND.red};">Sin precio</span>`;
  }

  let marginHtml = "";
  if (product.margin != null) {
    const mColor = product.margin > 30 ? BRAND.jade : product.margin > 15 ? BRAND.gold : BRAND.red;
    marginHtml = `<div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
      <span style="font-size:10px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.5px;">Margen:</span>
      <span style="font-size:13px;font-weight:700;color:${mColor};">${product.margin.toFixed(1)}%</span>
      ${product.cogs ? `<span style="font-size:10px;color:${BRAND.muted};">(COGS: ${product.cogs.toFixed(2)}€)</span>` : ""}
    </div>`;
  }

  const recsHtml = recs.map(r => {
    const s = recStatusColor(r.status);
    return `<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 12px;margin-bottom:6px;border-radius:8px;background:${s.bg};border:1px solid ${s.border};">
      <div style="width:22px;height:22px;flex-shrink:0;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;color:${s.iconColor};margin-top:1px;">${s.icon}</div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
          <span style="font-size:11px;font-weight:700;color:${BRAND.white};">${r.icon} ${esc(r.dimension)}</span>
          <span style="font-size:10px;color:${BRAND.mutedLight};">${esc(r.current)}</span>
          <span style="margin-left:auto;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;background:${r.status === "success" ? BRAND.jadeBg : r.status === "warning" ? BRAND.orangeBg : BRAND.redBg};color:${r.status === "success" ? BRAND.jade : r.status === "warning" ? BRAND.orange : BRAND.red};border:1px solid ${s.border};">${esc(r.impact)}</span>
        </div>
        <div style="font-size:11px;color:${BRAND.mutedLight};line-height:1.5;">${esc(r.recommendation)}</div>
      </div>
    </div>`;
  }).join("");

  return `<div style="background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:16px;padding:24px;margin-bottom:20px;position:relative;overflow:hidden;">
    <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,${gc},${sc},transparent);"></div>

    <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;">
      ${imgSection}

      <div style="flex:1;min-width:220px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div style="flex:1;min-width:0;">
            <h3 style="margin:0 0 6px;font-size:17px;font-weight:800;color:${BRAND.white};letter-spacing:-0.3px;line-height:1.3;">${esc(product.title)}</h3>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              ${statusBadge(product.status, product.published)}
              ${product.productType ? `<span style="font-size:10px;color:${BRAND.muted};background:${BRAND.surface};padding:2px 8px;border-radius:4px;border:1px solid ${BRAND.border};">${esc(product.productType)}</span>` : ""}
              ${product.vendor ? `<span style="font-size:10px;color:${BRAND.muted};">${esc(product.vendor)}</span>` : ""}
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:10px;">
            <div style="text-align:center;">
              <div style="display:inline-flex;align-items:center;justify-content:center;min-width:40px;padding:6px 14px;border-radius:8px;font-weight:900;font-size:16px;letter-spacing:0.3px;background:${gb};color:${gc};border:1px solid ${gc}22;">${esc(product.auditGrade)}</div>
              <div style="font-size:9px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.5px;margin-top:3px;">Grado</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:22px;font-weight:900;color:${sc};letter-spacing:-0.5px;">${product.auditScore}</div>
              <div style="font-size:9px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.5px;">/ 100</div>
            </div>
          </div>
        </div>

        <div style="margin-top:12px;">${priceHtml}</div>
        ${marginHtml}

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-top:14px;">
          <div style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:8px;padding:8px 10px;text-align:center;">
            <div style="font-size:16px;font-weight:800;color:${imgCountColor};">${product.imageCount}</div>
            <div style="font-size:9px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.5px;">Imagenes</div>
            <div style="height:3px;border-radius:2px;background:${BRAND.border};margin-top:4px;overflow:hidden;"><div style="height:100%;width:${Math.min(100, Math.round((product.imageCount / 8) * 100))}%;border-radius:2px;background:${imgCountColor};"></div></div>
          </div>
          <div style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:8px;padding:8px 10px;text-align:center;">
            <div style="font-size:16px;font-weight:800;color:${tagsColor};">${product.tagsCount}</div>
            <div style="font-size:9px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.5px;">Tags</div>
            <div style="height:3px;border-radius:2px;background:${BRAND.border};margin-top:4px;overflow:hidden;"><div style="height:100%;width:${Math.min(100, Math.round((product.tagsCount / 28) * 100))}%;border-radius:2px;background:${tagsColor};"></div></div>
          </div>
          <div style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:8px;padding:8px 10px;text-align:center;">
            <div style="font-size:16px;font-weight:800;color:${variantColor};">${product.variantCount}</div>
            <div style="font-size:9px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.5px;">Variantes</div>
          </div>
          <div style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:8px;padding:8px 10px;text-align:center;">
            <div style="font-size:12px;font-weight:700;color:${descColor};">${product.descriptionLength}ch</div>
            <div style="font-size:9px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.5px;">Descripcion</div>
            <div style="height:3px;border-radius:2px;background:${BRAND.border};margin-top:4px;overflow:hidden;"><div style="height:100%;width:${descBarWidth}%;border-radius:2px;background:${descColor};"></div></div>
          </div>
        </div>
      </div>
    </div>

    <div style="margin-top:14px;padding:12px;background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:10px;">
      <div style="font-size:10px;font-weight:700;color:${BRAND.gold};text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;">&#128270; SEO Checklist (6 criterios)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">
        ${[
          { label: "Meta Title", ok: product.hasMetaTitle !== false },
          { label: "Meta Desc", ok: product.hasMetaDesc !== false },
          { label: "Schema/JSON-LD", ok: product.hasSchema !== false },
          { label: "Alt Texts", ok: product.hasAltTexts !== false },
          { label: "Clean Handle", ok: product.cleanHandle !== false },
          { label: "Imagenes 4+", ok: product.imageCount >= 4 },
        ].map(c => `<div style="display:flex;align-items:center;gap:6px;padding:4px 8px;border-radius:6px;background:${c.ok ? BRAND.jadeBg : BRAND.redBg};border:1px solid ${c.ok ? "rgba(52,211,153,.15)" : "rgba(244,63,94,.15)"};">
          <span style="font-size:12px;color:${c.ok ? BRAND.jade : BRAND.red};">${c.ok ? "&#10003;" : "&#10007;"}</span>
          <span style="font-size:10px;color:${c.ok ? BRAND.jade : BRAND.red};font-weight:600;">${c.label}</span>
        </div>`).join("")}
      </div>
    </div>

    ${recs.length > 0 ? `
    <div style="margin-top:16px;padding-top:16px;border-top:1px solid ${BRAND.border};">
      <div style="font-size:11px;font-weight:700;color:${BRAND.gold};text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">&#128161; Mejoras recomendadas</div>
      ${recsHtml}
    </div>` : ""}
  </div>`;
}

export function buildProductCardsSection(products: ProductCardData[], sectionTitle?: string): string {
  if (!products.length) return "";
  const title = sectionTitle || "Catalogo de Productos";
  const cards = products.map(p => buildProductCard(p)).join("");
  return `<div style="margin-bottom:32px;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid ${BRAND.border};">
      <div style="width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;background:rgba(200,168,75,.1);border:1px solid rgba(200,168,75,.2);">&#128722;</div>
      <div style="font-size:18px;font-weight:700;color:${BRAND.white};letter-spacing:-0.3px;">${sanitizeHtml(title)}</div>
      <div style="font-size:11px;color:${BRAND.muted};background:${BRAND.surface};padding:2px 8px;border-radius:4px;margin-left:auto;">${products.length} productos</div>
    </div>
    ${cards}
  </div>`;
}
