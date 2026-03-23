export interface AuditScores {
  overallScore: number;
  grade: string;
  titleScore: number;
  descriptionScore: number;
  priceScore: number;
  imageScore: number;
  seoScore: number;
  problems: string[];
  suggestions: string[];
}

export function auditProduct(product: {
  title?: string | null;
  body_html?: string | null;
  price?: string | null;
  compare_at_price?: string | null;
  images?: Array<{ alt?: string | null }>;
  tags?: string | null;
  variants?: Array<{ price?: string }>;
  metafields?: Array<{ namespace: string; key: string; value: string }>;
}): AuditScores {
  const problems: string[] = [];
  const suggestions: string[] = [];

  // TITLE SCORE (0-100)
  let titleScore = 0;
  const title = product.title ?? "";
  const titleLen = title.length;

  if (titleLen >= 40 && titleLen <= 70) {
    titleScore = 100;
  } else if (titleLen >= 25 && titleLen < 40) {
    titleScore = 60;
    problems.push("Título corto");
    suggestions.push("El título debería tener entre 40-70 caracteres con la keyword principal");
  } else if (titleLen > 70) {
    titleScore = 70;
    suggestions.push("El título es demasiado largo — acórtalo a 70 caracteres máximo");
  } else {
    titleScore = 20;
    problems.push("Título muy corto");
  }

  const genericWords = ["product", "item", "nuevo", "artículo"];
  if (genericWords.some((w) => title.toLowerCase().includes(w))) {
    titleScore = Math.max(0, titleScore - 30);
    problems.push("Título genérico");
    suggestions.push("Evita palabras genéricas como 'product', 'item' o 'artículo'");
  }

  // DESCRIPTION SCORE (0-100)
  let descriptionScore = 0;
  const bodyHtml = product.body_html ?? "";
  const bodyText = bodyHtml.replace(/<[^>]+>/g, "");
  const bodyLen = bodyText.length;

  if (bodyLen === 0) {
    descriptionScore = 0;
    problems.push("Sin descripción");
    suggestions.push("Añade una descripción de al menos 300 caracteres con bullet points y beneficios");
  } else if (bodyLen < 100) {
    descriptionScore = 20;
    problems.push(`Descripción pobre (${bodyLen} chars)`);
    suggestions.push("Amplía la descripción a mínimo 300 caracteres");
  } else if (bodyLen < 300) {
    descriptionScore = 50;
    suggestions.push("La descripción es corta — añade más beneficios y características");
  } else if (bodyLen < 600) {
    descriptionScore = 75;
  } else {
    descriptionScore = 90;
  }

  if (bodyHtml.includes("<ul>") || bodyHtml.includes("<li>")) {
    descriptionScore = Math.min(100, descriptionScore + 10);
  } else if (bodyLen > 100) {
    suggestions.push("Añade bullet points (listas) para mejorar la legibilidad");
  }

  if (bodyHtml.includes("<strong>") || bodyHtml.includes("<b>")) {
    descriptionScore = Math.min(100, descriptionScore + 5);
  }

  // PRICE SCORE (0-100)
  let priceScore = 0;
  const price = product.price ?? (product.variants?.[0]?.price);

  if (!price || parseFloat(price) === 0) {
    priceScore = 0;
    problems.push("Sin precio");
    suggestions.push("Configura el precio del producto");
  } else {
    priceScore = 50;
    const priceNum = parseFloat(price);

    if (product.compare_at_price && parseFloat(product.compare_at_price) > priceNum) {
      priceScore += 25;
    } else {
      suggestions.push("Añade un precio de comparación (compare_at_price) para mostrar descuento");
    }

    const priceStr = price.replace(".", ",");
    if (priceStr.endsWith(",99") || priceStr.endsWith(",95") || priceStr.endsWith(",90")) {
      priceScore += 15;
    } else {
      suggestions.push("Usa precios psicológicos: €X.99, €X.95, €X.90");
    }

    priceScore += 10;
  }

  // IMAGE SCORE (0-100)
  let imageScore = 0;
  const imgCount = product.images?.length ?? 0;

  if (imgCount === 0) {
    imageScore = 0;
    problems.push("Sin imágenes");
    suggestions.push("Añade al menos 5 imágenes: hero, lifestyle, detalle, packaging, UGC");
  } else if (imgCount === 1) {
    imageScore = 20;
    problems.push("Solo 1 imagen");
    suggestions.push("Los productos con 5+ imágenes convierten 3.4x mejor");
  } else if (imgCount === 2) {
    imageScore = 40;
    problems.push("Solo 2 imágenes");
  } else if (imgCount === 3) {
    imageScore = 65;
    suggestions.push("Añade más imágenes (lifestyle, UGC, detalle)");
  } else if (imgCount === 4) {
    imageScore = 80;
  } else {
    imageScore = 100;
  }

  const hasAltTexts = product.images?.every((img) => img.alt && img.alt.trim() !== "");
  if (imgCount > 0 && !hasAltTexts) {
    problems.push("Imágenes sin alt text");
    suggestions.push("Añade alt texts descriptivos con keywords a cada imagen");
  }

  // SEO SCORE (0-100)
  let seoScore = 0;
  const tags = product.tags ?? "";
  const tagCount = tags ? tags.split(",").filter((t) => t.trim()).length : 0;
  const metafields = product.metafields ?? [];
  const metaTitle = metafields.find((m) => m.namespace === "seo" && m.key === "title");
  const metaDesc = metafields.find((m) => m.namespace === "seo" && m.key === "description");

  if (metaDesc) {
    seoScore += 30;
  } else {
    problems.push("Sin meta description");
    suggestions.push("Añade una meta description de 140-155 chars con keyword y CTA");
  }

  if (hasAltTexts && imgCount > 0) {
    seoScore += 20;
  }

  if (title.length > 30) {
    seoScore += 25;
  }

  if (tagCount >= 10) {
    seoScore += 25;
  } else {
    problems.push(`Solo ${tagCount} tags SEO`);
    suggestions.push("Añade al menos 10 tags con keywords relevantes (en español e inglés)");
  }

  // OVERALL
  const overallScore = (titleScore + descriptionScore + priceScore + imageScore + seoScore) / 5;
  const grade = scoreToGrade(overallScore);

  return {
    overallScore: Math.round(overallScore),
    grade,
    titleScore: Math.round(titleScore),
    descriptionScore: Math.round(descriptionScore),
    priceScore: Math.round(priceScore),
    imageScore: Math.round(imageScore),
    seoScore: Math.round(seoScore),
    problems,
    suggestions,
  };
}

export function scoreToGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}
