/**
 * Google Business Profile + Reviews Extractor
 * ─────────────────────────────────────────────────────────────────────────────
 * Uses Gemini with Google Search grounding to extract Google Business Profile
 * data (rating, reviews, hours, categories, address) without direct scraping.
 * Gemini's Search grounding bypasses the anti-scrape restrictions on Google.
 */

import { askGeminiWithSearch, isGeminiSearchBlocked } from "./gemini.js";
import { logger } from "./logger.js";

export interface GoogleReview {
  rating: number;
  text: string;
  date: string;
  authorName?: string;
}

export interface GoogleBusinessProfile {
  businessName: string | null;
  rating: number | null;
  reviewCount: number | null;
  ratingDistribution: Record<string, number>;
  categories: string[];
  address: string | null;
  phone: string | null;
  website: string | null;
  hours: Record<string, string>;
  recentReviews: GoogleReview[];
  attributes: string[];
  priceLevel: string | null;
  totalScore: number | null;
  sentimentSummary: string | null;
  topMentions: string[];
  source: "gemini_search" | "unavailable";
  confidence: number;
}

export async function extractGoogleBusinessProfile(
  businessName: string,
  domain: string,
  locale = "es"
): Promise<GoogleBusinessProfile> {
  const EMPTY: GoogleBusinessProfile = {
    businessName,
    rating: null,
    reviewCount: null,
    ratingDistribution: {},
    categories: [],
    address: null,
    phone: null,
    website: domain || null,
    hours: {},
    recentReviews: [],
    attributes: [],
    priceLevel: null,
    totalScore: null,
    sentimentSummary: null,
    topMentions: [],
    source: "unavailable",
    confidence: 0,
  };

  if (isGeminiSearchBlocked()) {
    logger.warn("google-reviews: Gemini Search not configured — skipping");
    return EMPTY;
  }

  try {
    const searchQuery = locale === "es"
      ? `"${businessName}" reseñas google maps valoración ${domain}`
      : `"${businessName}" google reviews rating ${domain}`;

    const systemPrompt = `Eres un extractor de datos de Google Business Profile. 
Usa la búsqueda web para encontrar información real y actual del negocio en Google Maps / Google Business.
Devuelve SOLO JSON estrictamente válido. Nunca inventes datos. Si no encuentras un dato, usa null o [].`;

    const userPrompt = `Busca en Google el perfil de negocio de "${businessName}" (dominio: ${domain}).

EXTRAE EXACTAMENTE:
1. Puntuación media de Google Maps (número 1.0-5.0)
2. Número TOTAL de reseñas en Google
3. Distribución de estrellas (cuántos usuarios dieron 1★, 2★, 3★, 4★, 5★) — si disponible
4. Categorías del negocio en Google Maps (ej: "Tienda de ropa", "Joyería")
5. Dirección física completa
6. Teléfono de contacto
7. Horarios de apertura (por día de la semana)
8. Atributos destacados de Google (ej: "Entrega a domicilio", "Pago con tarjeta", "Accesible en silla de ruedas")
9. Nivel de precio (€, €€, €€€, €€€€) si aplica
10. Las 3-5 reseñas más representativas (texto extracto, puntuación, fecha, nombre del autor si disponible)
11. Temas o menciones frecuentes en las reseñas (qué se menciona más: calidad, precio, atención, envío, etc.)
12. Un resumen del sentimiento general de las reseñas en 2-3 frases

Devuelve JSON válido con esta estructura exacta:
{
  "businessName": "nombre del negocio",
  "rating": 4.5,
  "reviewCount": 1234,
  "ratingDistribution": {"5": 800, "4": 300, "3": 80, "2": 30, "1": 24},
  "categories": ["Tienda de ropa", "Moda"],
  "address": "Calle Ejemplo 123, 28001 Madrid, España",
  "phone": "+34 91 123 4567",
  "hours": {"lunes": "10:00–20:00", "martes": "10:00–20:00"},
  "attributes": ["Envío a domicilio", "Pago con tarjeta"],
  "priceLevel": "€€",
  "recentReviews": [
    {"rating": 5, "text": "Excelente servicio...", "date": "2026-05", "authorName": "María G."}
  ],
  "topMentions": ["calidad", "envío rápido", "buen precio"],
  "sentimentSummary": "Los clientes destacan principalmente la calidad del producto y la rapidez del envío. La atención al cliente recibe elogios frecuentes."
}`;

    const result = await askGeminiWithSearch(userPrompt, systemPrompt, [domain]);

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn({ businessName }, "google-reviews: no JSON in Gemini response");
      return { ...EMPTY, source: "unavailable" };
    }

    const parsed = JSON.parse(jsonMatch[0]) as Partial<GoogleBusinessProfile>;

    const profile: GoogleBusinessProfile = {
      businessName: parsed.businessName ?? businessName,
      rating: typeof parsed.rating === "number" ? parsed.rating : null,
      reviewCount: typeof parsed.reviewCount === "number" ? parsed.reviewCount : null,
      ratingDistribution: (parsed.ratingDistribution && typeof parsed.ratingDistribution === "object")
        ? parsed.ratingDistribution as Record<string, number>
        : {},
      categories: Array.isArray(parsed.categories) ? parsed.categories.filter(c => typeof c === "string") : [],
      address: typeof parsed.address === "string" ? parsed.address : null,
      phone: typeof parsed.phone === "string" ? parsed.phone : null,
      website: domain || null,
      hours: (parsed.hours && typeof parsed.hours === "object") ? parsed.hours as Record<string, string> : {},
      attributes: Array.isArray(parsed.attributes) ? parsed.attributes.filter(a => typeof a === "string") : [],
      priceLevel: typeof parsed.priceLevel === "string" ? parsed.priceLevel : null,
      recentReviews: Array.isArray(parsed.recentReviews)
        ? parsed.recentReviews
            .filter((r): r is GoogleReview => r && typeof r === "object" && typeof (r as any).rating === "number")
            .slice(0, 5)
        : [],
      topMentions: Array.isArray(parsed.topMentions) ? parsed.topMentions.slice(0, 10) : [],
      sentimentSummary: typeof parsed.sentimentSummary === "string" ? parsed.sentimentSummary : null,
      totalScore: null,
      source: "gemini_search",
      confidence: parsed.rating ? 0.8 : 0.4,
    };

    if (profile.rating && profile.reviewCount) {
      profile.totalScore = Math.round(profile.rating * 20);
    }

    logger.info({ businessName, rating: profile.rating, reviews: profile.reviewCount }, "google-reviews: extracted");
    return profile;
  } catch (err) {
    logger.warn({ err, businessName }, "google-reviews: extraction failed");
    return { ...EMPTY, source: "unavailable" };
  }
}

export function formatGoogleReviewsForPrompt(profile: GoogleBusinessProfile): string {
  if (profile.source === "unavailable" || !profile.rating) {
    return "⭐ RESEÑAS GOOGLE: No disponibles para esta marca.";
  }
  const lines: string[] = [];
  lines.push(`⭐ GOOGLE BUSINESS PROFILE:`);
  lines.push(`  Puntuación: ${profile.rating}/5 (${profile.reviewCount?.toLocaleString("es-ES") ?? "?"} reseñas)`);
  if (profile.categories.length) lines.push(`  Categorías: ${profile.categories.join(", ")}`);
  if (profile.address) lines.push(`  Dirección: ${profile.address}`);
  if (profile.priceLevel) lines.push(`  Precio: ${profile.priceLevel}`);
  if (profile.attributes.length) lines.push(`  Atributos: ${profile.attributes.join(", ")}`);
  if (profile.topMentions.length) lines.push(`  Mencionado frecuentemente: ${profile.topMentions.join(", ")}`);
  if (profile.sentimentSummary) lines.push(`  Sentimiento: ${profile.sentimentSummary}`);
  if (profile.recentReviews.length) {
    lines.push(`  Reseñas destacadas:`);
    profile.recentReviews.slice(0, 3).forEach(r => {
      lines.push(`    ${"★".repeat(r.rating)} "${r.text.slice(0, 150)}..."`);
    });
  }
  return lines.join("\n");
}
