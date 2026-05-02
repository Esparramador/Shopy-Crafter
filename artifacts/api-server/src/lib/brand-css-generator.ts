import { db } from "@workspace/db";
import { brandDnaTable, visualDnaTable, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { askClaudeWithBrain } from "./claude.js";

export interface BrandProfile {
  projectId: number;
  shopName: string;
  shopDomain: string;
  niche: string;
  primaryColors: string[];
  brandColors: string[];
  typographyStyle: string;
  layoutPattern: string;
  toneOfVoice: string;
  brandPersonality: string;
  photographyStyle: string;
  backgroundStyle: string;
  lightingStyle: string;
  colorTemp: string;
  mood: string;
  targetAudience: string;
  valuePropositions: string[];
}

export async function fetchBrandProfile(projectId: number): Promise<BrandProfile | null> {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project) return null;

  const [brandDna] = await db.select().from(brandDnaTable).where(eq(brandDnaTable.projectId, projectId)).limit(1);
  const [visualDna] = await db.select().from(visualDnaTable).where(eq(visualDnaTable.projectId, projectId)).limit(1);

  return {
    projectId,
    shopName: (project as any).shopName || (project as any).name || "",
    shopDomain: (project as any).shopDomain || "",
    niche: (project as any).niche || "",
    primaryColors: brandDna?.primaryColors || [],
    brandColors: visualDna?.brandColors || [],
    typographyStyle: brandDna?.typographyStyle || "",
    layoutPattern: brandDna?.layoutPattern || "",
    toneOfVoice: brandDna?.toneOfVoice || "",
    brandPersonality: brandDna?.brandPersonality || "",
    photographyStyle: brandDna?.photographyStyle || "",
    backgroundStyle: visualDna?.backgroundStyle || "",
    lightingStyle: visualDna?.lightingStyle || "",
    colorTemp: visualDna?.colorTemp || "",
    mood: visualDna?.mood || "",
    targetAudience: brandDna?.targetAudience || "",
    valuePropositions: brandDna?.valuePropositions || [],
  };
}

function resolveColors(profile: BrandProfile): { primary: string; secondary: string; accent: string; background: string; text: string; textLight: string; border: string; success: string; warning: string; cta: string; ctaHover: string } {
  const allColors = [...(profile.primaryColors || []), ...(profile.brandColors || [])].filter(c => c && c.startsWith("#"));
  const primary = allColors[0] || "#2d2d2d";
  const secondary = allColors[1] || "#555555";
  const accent = allColors[2] || "#e94560";
  const background = allColors[3] || "#ffffff";
  const text = allColors[4] || "#1a1a2e";

  return {
    primary,
    secondary,
    accent,
    background: isLightColor(background) ? background : "#ffffff",
    text: isLightColor(text) ? "#1a1a2e" : text,
    textLight: "#6b7280",
    border: "#e5e7eb",
    success: "#10b981",
    warning: "#f59e0b",
    cta: accent,
    ctaHover: darkenColor(accent, 15),
  };
}

function isLightColor(hex: string): boolean {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

function darkenColor(hex: string, percent: number): string {
  const c = hex.replace("#", "");
  const r = Math.max(0, parseInt(c.substring(0, 2), 16) - Math.round(255 * percent / 100));
  const g = Math.max(0, parseInt(c.substring(2, 4), 16) - Math.round(255 * percent / 100));
  const b = Math.max(0, parseInt(c.substring(4, 6), 16) - Math.round(255 * percent / 100));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function resolveTypography(profile: BrandProfile): { heading: string; body: string; accent: string; importUrl: string } {
  const style = (profile.typographyStyle || "").toLowerCase();
  if (style.includes("serif") || style.includes("elegant") || style.includes("luxury")) {
    return {
      heading: "'Playfair Display', 'Georgia', serif",
      body: "'Lora', 'Georgia', serif",
      accent: "'Inter', sans-serif",
      importUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800;900&family=Lora:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap",
    };
  }
  if (style.includes("modern") || style.includes("bold") || style.includes("impact")) {
    return {
      heading: "'Montserrat', 'Helvetica Neue', sans-serif",
      body: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      accent: "'Montserrat', sans-serif",
      importUrl: "https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&display=swap",
    };
  }
  if (style.includes("playful") || style.includes("fun") || style.includes("comic")) {
    return {
      heading: "'Poppins', 'Nunito', sans-serif",
      body: "'Nunito', 'Open Sans', sans-serif",
      accent: "'Poppins', sans-serif",
      importUrl: "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&family=Nunito:wght@300;400;500;600;700&display=swap",
    };
  }
  if (style.includes("minimal") || style.includes("clean")) {
    return {
      heading: "'DM Sans', 'Helvetica Neue', sans-serif",
      body: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      accent: "'DM Sans', sans-serif",
      importUrl: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap",
    };
  }
  return {
    heading: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    body: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    accent: "'Inter', sans-serif",
    importUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap",
  };
}

export function generateBrandCss(profile: BrandProfile): string {
  const colors = resolveColors(profile);
  const fonts = resolveTypography(profile);
  const date = new Date().toISOString().split("T")[0];

  return `/*
 * ═══════════════════════════════════════════════════════════════════
 *  CUSTOM BRAND CSS — ${profile.shopName || "Tu Marca"}
 *  Generado por Shopy Crafter | shopycrafter.com
 *  Fecha: ${date}
 *  Tienda: ${profile.shopDomain || "N/A"}
 *  Nicho: ${profile.niche || "e-commerce"}
 *  Personalidad de marca: ${profile.brandPersonality || "Profesional"}
 * ═══════════════════════════════════════════════════════════════════
 *
 *  INSTRUCCIONES DE USO:
 *  ─────────────────────
 *  Shopify: Online Store → Themes → Edit code → Assets → Añadir nuevo asset → theme-custom.css
 *           Luego en Layout/theme.liquid, antes de </head>, añade:
 *           {{ 'theme-custom.css' | asset_url | stylesheet_tag }}
 *
 *  WooCommerce: Apariencia → Personalizar → CSS adicional → Pega este archivo completo
 *               O en wp-content/themes/tu-theme/style.css al final
 *
 *  PrestaShop: Back Office → Diseño → Tema → Editar código → custom.css
 *
 *  NOTA: Este CSS está diseñado para funcionar sobre cualquier theme base.
 *  Las variables CSS permiten personalizar colores sin editar el código.
 * ═══════════════════════════════════════════════════════════════════
 */

/* ═══════════ GOOGLE FONTS ═══════════ */
@import url('${fonts.importUrl}');

/* ═══════════ VARIABLES CSS — PALETA DE MARCA ═══════════ */
:root {
  /* Colores principales de tu marca */
  --brand-primary: ${colors.primary};
  --brand-secondary: ${colors.secondary};
  --brand-accent: ${colors.accent};
  --brand-background: ${colors.background};
  --brand-text: ${colors.text};
  --brand-text-light: ${colors.textLight};
  --brand-border: ${colors.border};
  --brand-success: ${colors.success};
  --brand-warning: ${colors.warning};
  --brand-cta: ${colors.cta};
  --brand-cta-hover: ${colors.ctaHover};

  /* Tipografías de tu marca */
  --font-heading: ${fonts.heading};
  --font-body: ${fonts.body};
  --font-accent: ${fonts.accent};

  /* Espaciado base */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --space-3xl: 64px;

  /* Bordes */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Sombras */
  --shadow-sm: 0 1px 2px rgba(0,0,0,.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,.07);
  --shadow-lg: 0 10px 25px rgba(0,0,0,.1);
  --shadow-xl: 0 20px 40px rgba(0,0,0,.12);
}

/* ═══════════ BASE — TIPOGRAFÍA GLOBAL ═══════════ */
body {
  font-family: var(--font-body);
  color: var(--brand-text);
  background-color: var(--brand-background);
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
  color: var(--brand-text);
  line-height: 1.2;
  letter-spacing: -0.02em;
}

h1 { font-size: clamp(28px, 5vw, 42px); font-weight: 800; }
h2 { font-size: clamp(22px, 4vw, 32px); font-weight: 700; }
h3 { font-size: clamp(18px, 3vw, 24px); font-weight: 600; }
h4 { font-size: 18px; font-weight: 600; }

p { margin-bottom: var(--space-md); color: var(--brand-text-light); }

a { color: var(--brand-primary); text-decoration: none; transition: color .2s ease; }
a:hover { color: var(--brand-cta-hover); }

/* ═══════════ HEADER / NAVEGACIÓN ═══════════ */
.header,
.site-header,
header {
  background: var(--brand-background);
  border-bottom: 1px solid var(--brand-border);
  padding: var(--space-md) var(--space-xl);
}

.header-logo,
.site-header__logo,
.header__heading a {
  font-family: var(--font-heading);
  font-size: 22px;
  font-weight: 800;
  color: var(--brand-primary);
  letter-spacing: -0.5px;
}

nav a,
.header__menu-item,
.site-nav a {
  font-family: var(--font-accent);
  font-size: 14px;
  font-weight: 500;
  color: var(--brand-text);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: color .2s;
}

nav a:hover,
.header__menu-item:hover,
.site-nav a:hover {
  color: var(--brand-primary);
}

/* ═══════════ HERO / BANNER PRINCIPAL ═══════════ */
.hero,
.hero-banner,
.slideshow__slide,
.banner {
  position: relative;
  padding: var(--space-3xl) var(--space-xl);
  text-align: center;
  background: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-secondary) 100%);
  color: #ffffff;
}

.hero h1,
.hero-banner h1,
.slideshow__heading,
.banner__heading {
  font-family: var(--font-heading);
  font-size: clamp(32px, 6vw, 56px);
  font-weight: 900;
  color: #ffffff;
  margin-bottom: var(--space-md);
  text-shadow: 0 2px 8px rgba(0,0,0,.15);
}

.hero p,
.hero-banner p,
.slideshow__subheading,
.banner__text {
  font-size: clamp(16px, 2vw, 20px);
  color: rgba(255,255,255,.9);
  max-width: 640px;
  margin: 0 auto var(--space-lg);
}

/* ═══════════ BOTONES — CTA ═══════════ */
.btn,
.button,
button[type="submit"],
.btn--primary,
.shopify-payment-button__button,
.product-form__submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--brand-cta);
  color: #ffffff;
  font-family: var(--font-accent);
  font-size: 15px;
  font-weight: 600;
  padding: var(--space-md) var(--space-xl);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all .2s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  box-shadow: var(--shadow-sm);
}

.btn:hover,
.button:hover,
button[type="submit"]:hover,
.btn--primary:hover,
.product-form__submit:hover {
  background: var(--brand-cta-hover);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.btn--secondary,
.button--secondary {
  background: transparent;
  color: var(--brand-primary);
  border: 2px solid var(--brand-primary);
}

.btn--secondary:hover,
.button--secondary:hover {
  background: var(--brand-primary);
  color: #ffffff;
}

/* ═══════════ GRID DE PRODUCTOS ═══════════ */
.collection-products,
.grid--collection,
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-lg);
  padding: var(--space-xl) 0;
}

/* ═══════════ TARJETA DE PRODUCTO ═══════════ */
.product-card,
.grid__item,
.card-wrapper {
  background: var(--brand-background);
  border: 1px solid var(--brand-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all .3s ease;
  position: relative;
}

.product-card:hover,
.grid__item:hover,
.card-wrapper:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-4px);
  border-color: var(--brand-primary);
}

.product-card__image-wrapper,
.card__media,
.grid-product__image-wrapper {
  position: relative;
  overflow: hidden;
  aspect-ratio: 1 / 1;
  background: #f9fafb;
}

.product-card__image-wrapper img,
.card__media img,
.grid-product__image-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform .4s ease;
}

.product-card:hover img,
.grid__item:hover img,
.card-wrapper:hover img {
  transform: scale(1.05);
}

.product-card__info,
.card__content,
.grid-product__meta {
  padding: var(--space-md) var(--space-lg);
}

.product-card__title,
.card__heading a,
.grid-product__title {
  font-family: var(--font-heading);
  font-size: 16px;
  font-weight: 600;
  color: var(--brand-text);
  margin-bottom: var(--space-xs);
  line-height: 1.3;
}

.product-card__price,
.price-item,
.grid-product__price {
  font-family: var(--font-accent);
  font-size: 18px;
  font-weight: 700;
  color: var(--brand-primary);
}

.product-card__price--compare,
.price-item--regular,
.grid-product__price--original {
  text-decoration: line-through;
  color: var(--brand-text-light);
  font-size: 14px;
  font-weight: 400;
}

/* ═══════════ BADGES / ETIQUETAS ═══════════ */
.badge,
.card__badge,
.product-tag {
  position: absolute;
  top: var(--space-sm);
  left: var(--space-sm);
  background: var(--brand-accent);
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  z-index: 2;
}

.badge--sale {
  background: #ef4444;
}

.badge--new {
  background: var(--brand-success);
}

.badge--bestseller {
  background: var(--brand-warning);
  color: var(--brand-text);
}

/* ═══════════ PÁGINA DE PRODUCTO ═══════════ */
.product-page,
.product-template,
.product__info-wrapper {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-xl);
}

.product-page__layout,
.product__media-wrapper {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2xl);
  align-items: start;
}

@media (max-width: 768px) {
  .product-page__layout,
  .product__media-wrapper {
    grid-template-columns: 1fr;
    gap: var(--space-lg);
  }
}

.product-page__title,
.product__title h1,
.product-single__title {
  font-family: var(--font-heading);
  font-size: clamp(24px, 4vw, 36px);
  font-weight: 800;
  color: var(--brand-text);
  margin-bottom: var(--space-sm);
  letter-spacing: -0.5px;
}

.product-page__price,
.product__price,
.product-single__price {
  font-family: var(--font-accent);
  font-size: 28px;
  font-weight: 800;
  color: var(--brand-primary);
  margin-bottom: var(--space-md);
}

.product-page__description,
.product__description,
.product-single__description {
  font-size: 15px;
  line-height: 1.8;
  color: var(--brand-text-light);
  margin-bottom: var(--space-lg);
}

.product-page__description ul,
.product__description ul {
  list-style: none;
  padding: 0;
}

.product-page__description ul li::before,
.product__description ul li::before {
  content: "✓ ";
  color: var(--brand-success);
  font-weight: 700;
}

/* ═══════════ TRUST BADGES / CONFIANZA ═══════════ */
.trust-badges,
.product-trust {
  display: flex;
  gap: var(--space-lg);
  padding: var(--space-md) 0;
  border-top: 1px solid var(--brand-border);
  border-bottom: 1px solid var(--brand-border);
  margin: var(--space-lg) 0;
}

.trust-badge {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 13px;
  color: var(--brand-text-light);
}

.trust-badge__icon {
  font-size: 18px;
}

/* ═══════════ SECCIONES DE CONTENIDO ═══════════ */
.content-section,
.shopify-section,
.rich-text {
  padding: var(--space-3xl) var(--space-xl);
  max-width: 1200px;
  margin: 0 auto;
}

.section-header {
  text-align: center;
  margin-bottom: var(--space-2xl);
}

.section-header h2 {
  font-family: var(--font-heading);
  font-size: clamp(24px, 4vw, 36px);
  font-weight: 800;
  color: var(--brand-text);
  margin-bottom: var(--space-sm);
}

.section-header p {
  font-size: 16px;
  color: var(--brand-text-light);
  max-width: 600px;
  margin: 0 auto;
}

/* ═══════════ TESTIMONIOS ═══════════ */
.testimonials {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-lg);
}

.testimonial-card {
  background: var(--brand-background);
  border: 1px solid var(--brand-border);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  position: relative;
}

.testimonial-card::before {
  content: '"';
  font-family: var(--font-heading);
  font-size: 64px;
  color: var(--brand-primary);
  opacity: 0.15;
  position: absolute;
  top: 10px;
  left: 20px;
  line-height: 1;
}

.testimonial-card__text {
  font-size: 15px;
  line-height: 1.7;
  color: var(--brand-text);
  font-style: italic;
  margin-bottom: var(--space-md);
}

.testimonial-card__author {
  font-weight: 600;
  color: var(--brand-primary);
  font-size: 14px;
}

/* ═══════════ FAQ / PREGUNTAS FRECUENTES ═══════════ */
.faq-section {
  max-width: 800px;
  margin: 0 auto;
}

.faq-item {
  border-bottom: 1px solid var(--brand-border);
  padding: var(--space-lg) 0;
}

.faq-item__question {
  font-family: var(--font-heading);
  font-size: 16px;
  font-weight: 600;
  color: var(--brand-text);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.faq-item__answer {
  font-size: 14px;
  color: var(--brand-text-light);
  line-height: 1.7;
  padding-top: var(--space-md);
}

/* ═══════════ FOOTER ═══════════ */
.footer,
.site-footer,
footer {
  background: var(--brand-text);
  color: rgba(255,255,255,.7);
  padding: var(--space-3xl) var(--space-xl) var(--space-xl);
}

.footer h4,
.site-footer h4 {
  font-family: var(--font-heading);
  color: #ffffff;
  font-size: 16px;
  font-weight: 700;
  margin-bottom: var(--space-md);
}

.footer a,
.site-footer a {
  color: rgba(255,255,255,.6);
  transition: color .2s;
}

.footer a:hover,
.site-footer a:hover {
  color: var(--brand-primary);
}

.footer__grid,
.site-footer__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-xl);
  max-width: 1200px;
  margin: 0 auto;
}

/* ═══════════ CARRITO ═══════════ */
.cart-item,
.cart__item {
  display: flex;
  gap: var(--space-md);
  padding: var(--space-md) 0;
  border-bottom: 1px solid var(--brand-border);
  align-items: center;
}

.cart-item__image,
.cart__image {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-md);
  object-fit: cover;
}

.cart-item__title,
.cart__item-name {
  font-family: var(--font-heading);
  font-weight: 600;
  color: var(--brand-text);
}

.cart-total,
.cart__footer {
  font-size: 20px;
  font-weight: 800;
  color: var(--brand-primary);
  padding: var(--space-lg) 0;
  text-align: right;
}

/* ═══════════ NEWSLETTER / SUSCRIPCIÓN ═══════════ */
.newsletter,
.newsletter-section {
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
  padding: var(--space-3xl) var(--space-xl);
  text-align: center;
  color: #ffffff;
  border-radius: var(--radius-xl);
  margin: var(--space-2xl) 0;
}

.newsletter h2 {
  color: #ffffff;
  margin-bottom: var(--space-sm);
}

.newsletter p {
  color: rgba(255,255,255,.85);
  margin-bottom: var(--space-lg);
}

.newsletter-form {
  display: flex;
  gap: var(--space-sm);
  max-width: 500px;
  margin: 0 auto;
}

.newsletter-form input[type="email"] {
  flex: 1;
  padding: var(--space-md) var(--space-lg);
  border: 2px solid rgba(255,255,255,.3);
  border-radius: var(--radius-md);
  background: rgba(255,255,255,.1);
  color: #ffffff;
  font-size: 15px;
}

.newsletter-form input[type="email"]::placeholder {
  color: rgba(255,255,255,.5);
}

.newsletter-form button {
  background: #ffffff;
  color: var(--brand-primary);
  font-weight: 700;
  border: none;
  padding: var(--space-md) var(--space-xl);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: transform .2s;
}

.newsletter-form button:hover {
  transform: translateY(-2px);
}

/* ═══════════ RESPONSIVE ═══════════ */
@media (max-width: 768px) {
  .trust-badges,
  .product-trust {
    flex-wrap: wrap;
    gap: var(--space-md);
  }

  .newsletter-form {
    flex-direction: column;
  }

  .collection-products,
  .product-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-md);
  }

  .footer__grid,
  .site-footer__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .collection-products,
  .product-grid {
    grid-template-columns: 1fr;
  }
}

/* ═══════════ ANIMACIONES ═══════════ */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-in {
  animation: fadeInUp 0.5s ease-out forwards;
}

/* ═══════════ UTILIDADES ═══════════ */
.text-primary { color: var(--brand-primary); }
.text-accent { color: var(--brand-accent); }
.text-muted { color: var(--brand-text-light); }
.bg-primary { background-color: var(--brand-primary); }
.bg-accent { background-color: var(--brand-accent); }
.text-center { text-align: center; }
.container { max-width: 1200px; margin: 0 auto; padding: 0 var(--space-xl); }

/*
 * ═══════════════════════════════════════════════════════════════════
 *  FIN DEL CSS PERSONALIZADO — ${profile.shopName || "Tu Marca"}
 *  Generado por Shopy Crafter | shopycrafter.com
 *  Para soporte: contacto@shopycrafter.com
 * ═══════════════════════════════════════════════════════════════════
 */
`;
}

export function generateBrandGuideHtml(profile: BrandProfile): string {
  const colors = resolveColors(profile);
  const fonts = resolveTypography(profile);
  const date = new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Brand Guide — ${profile.shopName || "Tu Marca"}</title>
<style>
@import url('${fonts.importUrl}');
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', sans-serif; background: #0a0a12; color: #f0f0f5; line-height: 1.6; }
.page { max-width: 794px; margin: 0 auto; padding: 32px 28px; }
.cover { text-align: center; padding: 80px 40px; border-bottom: 2px solid #1a1a28; margin-bottom: 48px; }
.cover h1 { font-size: 42px; font-weight: 900; color: #c8a84b; margin-bottom: 8px; }
.cover p { color: #9494a8; font-size: 16px; }
.section { margin-bottom: 48px; }
.section h2 { font-size: 24px; font-weight: 800; color: #c8a84b; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid #1a1a28; }
.color-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; }
.color-swatch { border-radius: 12px; overflow: hidden; border: 1px solid #1a1a28; }
.color-swatch__preview { height: 100px; }
.color-swatch__info { padding: 12px; background: #101018; }
.color-swatch__name { font-size: 13px; font-weight: 600; color: #f0f0f5; }
.color-swatch__hex { font-size: 12px; color: #6b6b80; font-family: monospace; }
.font-example { padding: 24px; background: #101018; border: 1px solid #1a1a28; border-radius: 12px; margin-bottom: 16px; }
.font-example h3 { margin-bottom: 8px; color: #c8a84b; font-size: 14px; }
.font-example .demo { margin-top: 12px; }
.spec-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.spec-table th { background: #16161f; color: #c8a84b; font-weight: 700; text-align: left; padding: 12px 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
.spec-table td { padding: 12px 16px; border-bottom: 1px solid #1a1a28; color: #f0f0f5; }
.spec-table tr:hover td { background: rgba(200,168,75,.02); }
.component-preview { padding: 32px; background: ${colors.background}; border-radius: 12px; border: 1px solid #1a1a28; margin-bottom: 16px; }
.code-block { background: #0c0c14; border: 1px solid #1a1a28; border-radius: 8px; padding: 16px; font-family: 'Courier New', monospace; font-size: 12px; color: #c8a84b; white-space: pre-wrap; overflow-x: auto; margin-top: 12px; }
.note { background: rgba(200,168,75,.06); border: 1px solid rgba(200,168,75,.2); border-radius: 8px; padding: 16px; font-size: 13px; color: rgba(255,255,255,.75); margin: 16px 0; }
.footer { text-align: center; padding: 32px; border-top: 1px solid #1a1a28; margin-top: 48px; color: #6b6b80; font-size: 12px; }
</style>
</head>
<body>
<div class="page">
  <div class="cover">
    <h1>Guía de Marca</h1>
    <p>${profile.shopName || "Tu Marca"} — Manual de Identidad Visual</p>
    <p style="margin-top:8px;font-size:13px;color:#6b6b80;">Generado: ${date} | shopycrafter.com</p>
  </div>

  <div class="section">
    <h2>🎨 Paleta de Colores</h2>
    <div class="color-grid">
      <div class="color-swatch">
        <div class="color-swatch__preview" style="background:${colors.primary}"></div>
        <div class="color-swatch__info"><div class="color-swatch__name">Primario</div><div class="color-swatch__hex">${colors.primary}</div></div>
      </div>
      <div class="color-swatch">
        <div class="color-swatch__preview" style="background:${colors.secondary}"></div>
        <div class="color-swatch__info"><div class="color-swatch__name">Secundario</div><div class="color-swatch__hex">${colors.secondary}</div></div>
      </div>
      <div class="color-swatch">
        <div class="color-swatch__preview" style="background:${colors.accent}"></div>
        <div class="color-swatch__info"><div class="color-swatch__name">Acento / CTA</div><div class="color-swatch__hex">${colors.accent}</div></div>
      </div>
      <div class="color-swatch">
        <div class="color-swatch__preview" style="background:${colors.background}"></div>
        <div class="color-swatch__info"><div class="color-swatch__name">Fondo</div><div class="color-swatch__hex">${colors.background}</div></div>
      </div>
      <div class="color-swatch">
        <div class="color-swatch__preview" style="background:${colors.text}"></div>
        <div class="color-swatch__info"><div class="color-swatch__name">Texto</div><div class="color-swatch__hex">${colors.text}</div></div>
      </div>
      <div class="color-swatch">
        <div class="color-swatch__preview" style="background:${colors.success}"></div>
        <div class="color-swatch__info"><div class="color-swatch__name">Éxito</div><div class="color-swatch__hex">${colors.success}</div></div>
      </div>
    </div>
    <div class="note">
      <strong>📋 Cómo usar:</strong> Usa el color Primario para títulos y logo. El Acento para botones CTA y enlaces importantes. El Secundario para fondos de sección y elementos decorativos.
    </div>
  </div>

  <div class="section">
    <h2>🔤 Tipografías</h2>
    <div class="font-example">
      <h3>Títulos (Headings)</h3>
      <div class="demo" style="font-family:${fonts.heading};font-size:32px;font-weight:800;color:${colors.primary};">Título de ejemplo H1</div>
      <div class="demo" style="font-family:${fonts.heading};font-size:24px;font-weight:700;color:${colors.text};margin-top:8px;">Subtítulo de ejemplo H2</div>
      <div class="code-block">font-family: ${fonts.heading};
font-weight: 800;
color: ${colors.primary};</div>
    </div>
    <div class="font-example">
      <h3>Texto de cuerpo (Body)</h3>
      <div class="demo" style="font-family:${fonts.body};font-size:15px;color:${colors.textLight};line-height:1.7;">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation.</div>
      <div class="code-block">font-family: ${fonts.body};
font-size: 15px;
line-height: 1.7;
color: ${colors.textLight};</div>
    </div>
    <div class="font-example">
      <h3>Precios y datos destacados</h3>
      <div class="demo" style="font-family:${fonts.accent};font-size:28px;font-weight:800;color:${colors.primary};">€149.99</div>
      <div class="code-block">font-family: ${fonts.accent};
font-size: 28px;
font-weight: 800;
color: ${colors.primary};</div>
    </div>
  </div>

  <div class="section">
    <h2>🧩 Componentes Visuales</h2>
    
    <h3 style="color:#f0f0f5;margin-bottom:16px;font-size:16px;">Botón CTA Principal</h3>
    <div class="component-preview" style="text-align:center;">
      <div style="display:inline-block;background:${colors.cta};color:#fff;font-family:${fonts.accent};font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;text-transform:uppercase;letter-spacing:0.5px;">Añadir al carrito</div>
    </div>
    <div class="code-block">.btn-cta {
  background: ${colors.cta};
  color: #ffffff;
  font-family: ${fonts.accent};
  font-size: 15px;
  font-weight: 600;
  padding: 14px 32px;
  border-radius: 8px;
  border: none;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  cursor: pointer;
}
.btn-cta:hover {
  background: ${colors.ctaHover};
}</div>

    <h3 style="color:#f0f0f5;margin:24px 0 16px;font-size:16px;">Tarjeta de Producto</h3>
    <div class="component-preview">
      <div style="max-width:280px;margin:0 auto;background:${colors.background};border:1px solid ${colors.border};border-radius:12px;overflow:hidden;">
        <div style="height:200px;background:linear-gradient(135deg,${colors.primary}22,${colors.secondary}22);display:flex;align-items:center;justify-content:center;font-size:48px;">📦</div>
        <div style="padding:16px 20px;">
          <div style="font-family:${fonts.heading};font-size:16px;font-weight:600;color:${colors.text};">Nombre del Producto</div>
          <div style="font-family:${fonts.body};font-size:13px;color:${colors.textLight};margin:4px 0 12px;">Descripción breve del producto</div>
          <div style="font-family:${fonts.accent};font-size:20px;font-weight:800;color:${colors.primary};">€49.99</div>
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>📸 Estilo Fotográfico</h2>
    <table class="spec-table">
      <tr><th>Elemento</th><th>Especificación</th></tr>
      <tr><td>Fondo</td><td>${profile.backgroundStyle || "Blanco puro (#ffffff) o neutro claro"}</td></tr>
      <tr><td>Iluminación</td><td>${profile.lightingStyle || "Softbox difusa 5500K, sin sombras duras"}</td></tr>
      <tr><td>Temperatura de color</td><td>${profile.colorTemp || "Neutra — 5000K-5500K"}</td></tr>
      <tr><td>Estado de ánimo</td><td>${profile.mood || "Profesional y limpio"}</td></tr>
      <tr><td>Estilo de fotografía</td><td>${profile.photographyStyle || "Producto centrado, ángulo 30-45°"}</td></tr>
      <tr><td>Resolución mínima</td><td>2048 × 2048px (1:1 para Shopify)</td></tr>
      <tr><td>Formato</td><td>JPG calidad 90% o WebP</td></tr>
    </table>
    <div class="note">
      <strong>📷 Brief para fotógrafo:</strong> "Necesito fotos de producto con fondo ${profile.backgroundStyle || "blanco puro"}, iluminación ${profile.lightingStyle || "softbox 5500K"}, resolución mínima 2048×2048px. Por cada producto: 1 frontal, 1 lateral, 1 detalle, 1 lifestyle. Entrega en JPG calidad 90%."
    </div>
  </div>

  <div class="section">
    <h2>🗣️ Tono de Voz</h2>
    <table class="spec-table">
      <tr><th>Elemento</th><th>Definición</th></tr>
      <tr><td>Tono general</td><td>${profile.toneOfVoice || "Profesional pero accesible"}</td></tr>
      <tr><td>Personalidad</td><td>${profile.brandPersonality || "Confiable y cercano"}</td></tr>
      <tr><td>Audiencia objetivo</td><td>${profile.targetAudience || "Propietarios de tiendas online"}</td></tr>
      <tr><td>Propuesta de valor</td><td>${(profile.valuePropositions || []).join(", ") || "Calidad, servicio, confianza"}</td></tr>
    </table>
  </div>

  <div class="section">
    <h2>📐 Espaciado y Layout</h2>
    <table class="spec-table">
      <tr><th>Variable</th><th>Valor</th><th>Uso</th></tr>
      <tr><td><code>--space-xs</code></td><td>4px</td><td>Espacios mínimos entre elementos inline</td></tr>
      <tr><td><code>--space-sm</code></td><td>8px</td><td>Padding interno de badges, tags</td></tr>
      <tr><td><code>--space-md</code></td><td>16px</td><td>Padding de tarjetas, gap de grid</td></tr>
      <tr><td><code>--space-lg</code></td><td>24px</td><td>Separación entre secciones pequeñas</td></tr>
      <tr><td><code>--space-xl</code></td><td>32px</td><td>Padding de contenedores principales</td></tr>
      <tr><td><code>--space-2xl</code></td><td>48px</td><td>Separación entre secciones grandes</td></tr>
      <tr><td><code>--space-3xl</code></td><td>64px</td><td>Padding de hero y secciones principales</td></tr>
    </table>
  </div>

  <div class="footer">
    <p>Generado por <strong style="color:#c8a84b;">Shopy Crafter</strong> | shopycrafter.com</p>
    <p style="margin-top:4px;">Este documento es confidencial y exclusivo para ${profile.shopName || "el cliente"}</p>
  </div>
</div>
</body>
</html>`;
}

export async function generateAiBrandCss(projectId: number, profile: BrandProfile): Promise<string> {
  const colors = resolveColors(profile);

  const prompt = `Genera un CSS COMPLETO y PROFESIONAL personalizado para la tienda "${profile.shopName}" (${profile.shopDomain}).
  
DATOS DE MARCA:
- Nicho: ${profile.niche}
- Personalidad: ${profile.brandPersonality}
- Tono: ${profile.toneOfVoice}
- Audiencia: ${profile.targetAudience}
- Colores: primario ${colors.primary}, secundario ${colors.secondary}, acento ${colors.accent}
- Tipografía estilo: ${profile.typographyStyle}
- Estilo fotográfico: ${profile.photographyStyle}
- Layout: ${profile.layoutPattern}

GENERA CSS adicional que incluya:
1. Animaciones sutiles para hover en productos (adaptadas al tono de la marca)
2. Estilos para página "Sobre Nosotros" con la personalidad de la marca
3. Estilos para sección de ofertas/promociones
4. Estilos para popup de newsletter
5. Estilos para página de "Colecciones"
6. Estilos para breadcrumbs y navegación secundaria
7. Estilos para quick-view de producto
8. Estilos para filtros y ordenación de productos
9. Dark mode toggle (si aplica al estilo de la marca)
10. Loading skeleton animations

Usa SOLO los colores de la marca dados. NO uses colores genéricos.
Devuelve SOLO el código CSS sin explicaciones ni markdown. Empieza con /* y termina con */.`;

  const aiCss = await askClaudeWithBrain(
    projectId,
    [{ role: "user", content: prompt }],
    "Eres un diseñador CSS senior especializado en e-commerce. Generas CSS pixel-perfect, moderno, accesible y optimizado para conversión.",
    "general",
    profile.niche,
    8000,
  );

  const cleaned = aiCss
    .replace(/```css\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  return cleaned;
}

export function buildBrandDnaContext(profile: BrandProfile): string {
  const colors = resolveColors(profile);
  const fonts = resolveTypography(profile);
  
  return `
═══ IDENTIDAD VISUAL DEL CLIENTE — OBLIGATORIO USAR ESTOS COLORES Y TIPOGRAFÍAS ═══
Marca: ${profile.shopName || "Cliente"}
Dominio: ${profile.shopDomain || "N/A"}
Nicho: ${profile.niche || "e-commerce"}
Personalidad: ${profile.brandPersonality || "Profesional"}
Tono de voz: ${profile.toneOfVoice || "Profesional y accesible"}
Audiencia objetivo: ${profile.targetAudience || "Propietarios de tiendas online"}

PALETA DE COLORES DE LA MARCA (USAR ESTOS EXACTOS):
- Color primario: ${colors.primary}
- Color secundario: ${colors.secondary} 
- Color acento/CTA: ${colors.accent}
- Fondo: ${colors.background}
- Texto principal: ${colors.text}
- Texto secundario: ${colors.textLight}

TIPOGRAFÍAS DE LA MARCA:
- Títulos: ${fonts.heading}
- Cuerpo: ${fonts.body}
- Acentos: ${fonts.accent}
- Import: ${fonts.importUrl}

ESTILO FOTOGRÁFICO:
- Fondo: ${profile.backgroundStyle || "No definido"}
- Iluminación: ${profile.lightingStyle || "No definido"}
- Temperatura: ${profile.colorTemp || "No definido"}
- Mood: ${profile.mood || "No definido"}

INSTRUCCIÓN: Cuando generes código CSS en el informe, USA los colores y tipografías EXACTOS de arriba (los del cliente), NO colores genéricos. Cada <code> CSS debe usar ${colors.primary}, ${colors.accent}, ${fonts.heading}, etc.
═══════════════════════════════════════════════════════════════════════════════════
`;
}
