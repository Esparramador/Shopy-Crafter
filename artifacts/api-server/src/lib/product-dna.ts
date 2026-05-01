/**
 * PRODUCT DNA EXTRACTOR
 * ─────────────────────────────────────────────────────────────────────────────
 * Builds a hyper-detailed, 100% real product dossier from product images +
 * description + (optional) extra reference assets. The dossier is injected
 * into every keyframe and video prompt by the Cinematic Director so the
 * model never invents materials, colors or text that don't exist.
 *
 * Uses Claude Sonnet vision (multi-image) to extract:
 *   - Materials (cuero, algodón orgánico, acero inoxidable, …)
 *   - Textures (mate, satinada, granulada, tejido cross-hatch, …)
 *   - Layers (interior, exterior, suela, costuras, hardware)
 *   - Visible text (logos, etiquetas, badges, claims serigrafiados)
 *   - Color palette (3-6 hex codes)
 *   - Hardware details (cremalleras, hebillas, botones)
 *   - Branding cues (tipografía, posición logo, monograma)
 *   - Dimensions cues (proporciones aparentes en la foto)
 *   - Key features distinguibles
 *   - Beneficios funcionales que VEN (no inventados)
 */

import { askClaudeWithVision, safeJsonParse } from "./claude.js";
import { logger } from "./logger.js";

export interface ProductDNA {
  productName: string;
  brand?: string;
  category?: string;
  /** 1-3 frases que describen QUÉ es el producto, en términos visuales. */
  visualSummary: string;
  /** Materiales identificables visualmente con notas de superficie. */
  materials: Array<{ name: string; surface: string; location: string }>;
  /** Capas / partes (e.g. exterior, interior, base, asas, suela). */
  layers: Array<{ name: string; description: string }>;
  /** Texturas predominantes, ordenadas por superficie ocupada. */
  textures: string[];
  /** Hardware (cremalleras, hebillas, broches, costuras visibles). */
  hardware: string[];
  /** Branding y typography visibles. */
  branding: {
    logoPlacement?: string;
    typography?: string;
    visibleText: string[];
  };
  /** Paleta de colores aproximados. */
  palette: Array<{ hex: string; role: string }>;
  /** Proporciones aparentes para encuadres realistas. */
  proportions?: string;
  /** Features distinguibles (lo que hace único al producto). */
  keyFeatures: string[];
  /** Claims o beneficios que aparecen en la imagen o descripción. */
  visibleClaims: string[];
  /** Ideas concretas para "deconstruction" / exploded view en el ad. */
  deconstructionPoints: Array<{
    layer: string;
    explanation: string;
    visualHint: string;
  }>;
  /** Identity-lock paragraph ready to inject into image/video prompts. */
  identityLockBlock: string;
}

const PRODUCT_DNA_SYSTEM = `Eres un director de arte y product photographer senior con 20 años en campañas premium (Apple, Hermès, Tesla, Nike). Tu trabajo: extraer un dossier 100% REAL del producto observando sus imágenes y leyendo su descripción. Nunca inventas. Si no lo ves, no lo escribes. Devuelves SIEMPRE JSON válido sin texto fuera.`;

/**
 * Build the Product DNA from one or more product images + textual description.
 * Returns a structured dossier and a ready-to-inject identity-lock block that
 * downstream prompts can paste verbatim.
 */
export async function buildProductDNA(args: {
  projectId: number;
  productName: string;
  brand?: string;
  category?: string;
  description?: string;
  /**
   * Product images. The first one is the "hero". Up to 4 images recommended
   * (Claude vision handles up to ~5 well; more = diminishing returns + cost).
   */
  images: Array<{ buffer: Buffer; mime: "image/jpeg" | "image/png" | "image/webp" }>;
  /** Optional: brand guidelines / known materials to bias extraction. */
  brandHints?: string;
  /** Language for visualClaims/visualSummary. Other fields stay in English-friendly tokens. */
  language?: string;
}): Promise<ProductDNA> {
  if (!args.images?.length) {
    // Fallback: synthesize a minimal DNA from text alone (best effort).
    return synthDNAFromText(args);
  }

  const lang = args.language || "es";
  const imageBlocks = args.images.slice(0, 4).map((img) => ({
    base64: img.buffer.toString("base64"),
    mediaType: img.mime,
  }));

  const userPrompt = `Analiza el producto "${args.productName}"${args.brand ? ` de la marca "${args.brand}"` : ""} a partir de las ${imageBlocks.length} imágenes adjuntas.

${args.description ? `Descripción real (no inventes nada que no esté aquí ni en las imágenes):\n"""${args.description.slice(0, 1500)}"""\n\n` : ""}${args.brandHints ? `Pistas de marca: ${args.brandHints.slice(0, 400)}\n\n` : ""}Devuelve JSON con este shape EXACTO:
{
  "productName": "${args.productName}",
  "brand": ${args.brand ? `"${args.brand}"` : "null"},
  "category": "categoría visual (ej. mochila urbana de cuero, sneaker running, smartwatch metálico)",
  "visualSummary": "1-3 frases en ${lang} describiendo el producto SOLO por lo que se ve (forma, color principal, sensación premium, etc.)",
  "materials": [
    { "name": "material identificable (ej. cuero granulado full-grain, mesh técnico transpirable)", "surface": "mate/satinado/brillante/texturizado", "location": "dónde aparece (ej. cuerpo principal, panel lateral)" }
  ],
  "layers": [
    { "name": "exterior / interior / asas / suela / etc.", "description": "qué es y cómo se ve" }
  ],
  "textures": ["3-6 texturas predominantes ordenadas por superficie"],
  "hardware": ["cremalleras YKK metálicas, hebilla cuadrada acero, costuras visible double-stitch, botones mate, etc."],
  "branding": {
    "logoPlacement": "dónde está el logo si es visible",
    "typography": "tipografía si la hay (sans-serif geométrico, serif elegante, etc.)",
    "visibleText": ["palabras o claims serigrafiados que se LEAN en la imagen"]
  },
  "palette": [
    { "hex": "#000000", "role": "principal" },
    { "hex": "#dddddd", "role": "secundario" }
  ],
  "proportions": "descripción de proporciones aparentes (ej. forma rectangular vertical, base estable, asas más cortas que el alto del cuerpo)",
  "keyFeatures": ["3-6 features distinguibles que diferencian este producto"],
  "visibleClaims": ["beneficios o claims que VEAS en la imagen o estén en la descripción real"],
  "deconstructionPoints": [
    { "layer": "exterior", "explanation": "${lang}: qué se ve cuando se separa esta capa", "visualHint": "blueprint/exploded view in ${lang}" },
    { "layer": "interior", "explanation": "...", "visualHint": "..." }
  ]
}

REGLAS DURAS (NO violar):
- Cero invenciones. Si no lo ves o no lo lees en la descripción → NO lo escribes.
- materials.location debe referirse a una parte del producto que sea VISIBLE en al menos una imagen.
- palette.hex debe ser una aproximación honesta del color real, no genéricos como #ffffff o #000000 salvo que sea blanco/negro real.
- branding.visibleText: solo palabras que un humano podría LEER en la imagen.
- deconstructionPoints debe contener entre 3 y 8 capas que un infografista podría dibujar como "exploded view" del producto. Cada una con explicación clara y un hint visual ejecutable.
- visibleClaims puede mezclar lo de la imagen + lo de la descripción REAL si la pasaron.
- Salida 100% JSON válido, sin Markdown ni comentarios.`;

  let raw = "";
  try {
    raw = await askClaudeWithVision(
      args.projectId,
      userPrompt,
      imageBlocks,
      PRODUCT_DNA_SYSTEM,
      4096,
      120_000,
    );
  } catch (err: any) {
    logger.warn({ err: err?.message, projectId: args.projectId }, "buildProductDNA: vision call failed, falling back to text-only DNA");
    return synthDNAFromText(args);
  }

  let parsed: ProductDNA;
  try {
    // Strip code-fence if present
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
    const obj = cleaned.match(/\{[\s\S]*\}/);
    parsed = safeJsonParse<ProductDNA>(obj ? obj[0] : cleaned, "buildProductDNA");
  } catch (err: any) {
    logger.warn({ err: err?.message, raw: raw.slice(0, 200) }, "buildProductDNA: parse failed, using text fallback");
    return synthDNAFromText(args);
  }

  // Defensive: ensure required fields exist
  parsed.productName = parsed.productName || args.productName;
  parsed.brand = parsed.brand || args.brand;
  parsed.materials = Array.isArray(parsed.materials) ? parsed.materials : [];
  parsed.layers = Array.isArray(parsed.layers) ? parsed.layers : [];
  parsed.textures = Array.isArray(parsed.textures) ? parsed.textures : [];
  parsed.hardware = Array.isArray(parsed.hardware) ? parsed.hardware : [];
  parsed.palette = Array.isArray(parsed.palette) ? parsed.palette : [];
  parsed.keyFeatures = Array.isArray(parsed.keyFeatures) ? parsed.keyFeatures : [];
  parsed.visibleClaims = Array.isArray(parsed.visibleClaims) ? parsed.visibleClaims : [];
  parsed.deconstructionPoints = Array.isArray(parsed.deconstructionPoints) ? parsed.deconstructionPoints : [];
  parsed.branding = parsed.branding || { visibleText: [] };
  parsed.branding.visibleText = parsed.branding.visibleText || [];

  parsed.identityLockBlock = buildIdentityLockBlock(parsed);
  return parsed;
}

/**
 * Builds an identity-lock paragraph that downstream prompts (image + video)
 * can prepend verbatim to anchor the product description across all scenes.
 */
function buildIdentityLockBlock(dna: ProductDNA): string {
  const lines: string[] = [];
  lines.push(`PRODUCT IDENTITY LOCK — never deviate from these descriptors across scenes:`);
  lines.push(`- Product: ${dna.productName}${dna.brand ? ` by ${dna.brand}` : ""} (${dna.category || "consumer product"}).`);
  if (dna.visualSummary) lines.push(`- Visual summary: ${dna.visualSummary}`);
  if (dna.materials.length) {
    lines.push(`- Materials: ${dna.materials.slice(0, 5).map((m) => `${m.name} (${m.surface}) at ${m.location}`).join("; ")}.`);
  }
  if (dna.textures.length) lines.push(`- Textures: ${dna.textures.slice(0, 5).join(", ")}.`);
  if (dna.hardware.length) lines.push(`- Hardware: ${dna.hardware.slice(0, 5).join(", ")}.`);
  if (dna.palette.length) {
    lines.push(`- Color palette: ${dna.palette.slice(0, 5).map((p) => `${p.hex} (${p.role})`).join(", ")}.`);
  }
  if (dna.branding?.logoPlacement) lines.push(`- Logo: ${dna.branding.logoPlacement}.`);
  if (dna.branding?.visibleText?.length) {
    lines.push(`- Visible text on product (preserve spelling EXACTLY): "${dna.branding.visibleText.slice(0, 4).join('", "')}".`);
  }
  if (dna.proportions) lines.push(`- Proportions: ${dna.proportions}.`);
  if (dna.keyFeatures.length) lines.push(`- Key distinguishing features: ${dna.keyFeatures.slice(0, 5).join("; ")}.`);
  return lines.join("\n");
}

function synthDNAFromText(args: {
  productName: string;
  brand?: string;
  category?: string;
  description?: string;
  language?: string;
}): ProductDNA {
  const dna: ProductDNA = {
    productName: args.productName,
    brand: args.brand,
    category: args.category || "product",
    visualSummary: args.description?.slice(0, 240) || `${args.productName}${args.brand ? ` by ${args.brand}` : ""}`,
    materials: [],
    layers: [],
    textures: [],
    hardware: [],
    branding: { visibleText: [] },
    palette: [],
    proportions: undefined,
    keyFeatures: [],
    visibleClaims: args.description ? [args.description.slice(0, 200)] : [],
    deconstructionPoints: [
      { layer: "exterior", explanation: "Product main surface", visualHint: "exterior shell, hero angle" },
      { layer: "details", explanation: "Hardware and finishing details", visualHint: "macro close-up of details" },
    ],
    identityLockBlock: "",
  };
  dna.identityLockBlock = buildIdentityLockBlock(dna);
  return dna;
}

/** Returns a compact (≤300 chars) summary of the DNA for use in tight prompts. */
export function compactProductDNA(dna: ProductDNA): string {
  const parts: string[] = [];
  parts.push(`${dna.productName}${dna.brand ? ` (${dna.brand})` : ""}`);
  if (dna.materials.length) parts.push(dna.materials.slice(0, 2).map((m) => m.name).join("/"));
  if (dna.palette.length) parts.push(dna.palette.slice(0, 3).map((p) => p.hex).join(" "));
  if (dna.keyFeatures.length) parts.push(dna.keyFeatures.slice(0, 2).join("; "));
  return parts.join(" · ").slice(0, 300);
}
