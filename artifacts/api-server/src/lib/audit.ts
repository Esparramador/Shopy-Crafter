export interface AuditScores {
  overallScore: number;
  grade: string;
  titleScore: number;
  descriptionScore: number;
  priceScore: number;
  imageScore: number;
  seoScore: number;
  contentQualityScore: number;
  trustScore: number;
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

  const title = product.title ?? "";
  const titleLen = title.length;
  let titleScore = 0;

  if (titleLen === 0) {
    titleScore = 0;
    problems.push("Sin título");
  } else if (titleLen < 20) {
    titleScore = 15;
    problems.push("Título muy corto — imposible posicionar en Google");
    suggestions.push("El título debe tener 45-70 caracteres con keyword principal al inicio");
  } else if (titleLen >= 20 && titleLen < 35) {
    titleScore = 35;
    problems.push("Título corto — falta contexto y keywords");
    suggestions.push("Amplía el título a 45-70 chars: [Keyword Principal] — [Beneficio] | [Material/Detalle]");
  } else if (titleLen >= 35 && titleLen < 45) {
    titleScore = 60;
    suggestions.push("Título aceptable pero podría incluir más keywords long-tail");
  } else if (titleLen >= 45 && titleLen <= 70) {
    titleScore = 85;
  } else if (titleLen > 70 && titleLen <= 90) {
    titleScore = 65;
    suggestions.push("Título largo — acórtalo a 70 chars para que no se trunque en Google SERPs");
  } else {
    titleScore = 40;
    problems.push("Título excesivamente largo — se truncará en resultados de búsqueda");
  }

  const genericWords = ["product", "item", "nuevo", "artículo", "test", "copy", "untitled", "draft", "sin título"];
  if (genericWords.some((w) => title.toLowerCase().includes(w))) {
    titleScore = Math.max(0, titleScore - 35);
    problems.push("Título genérico — las tiendas top nunca usan palabras como 'product' o 'item'");
    suggestions.push("Reemplaza con nombre descriptivo: material + producto + beneficio clave");
  }

  const hasCapitalStart = /^[A-ZÁÉÍÓÚÑ]/.test(title);
  if (hasCapitalStart) titleScore = Math.min(100, titleScore + 5);

  const hasSeparator = /[—–|·]/.test(title);
  if (hasSeparator && titleLen >= 45) titleScore = Math.min(100, titleScore + 10);

  const bodyHtml = product.body_html ?? "";
  const bodyText = bodyHtml.replace(/<[^>]+>/g, "");
  const bodyLen = bodyText.length;
  const wordCount = bodyText.split(/\s+/).filter(w => w.length > 0).length;
  let descriptionScore = 0;

  if (bodyLen === 0) {
    descriptionScore = 0;
    problems.push("Sin descripción — impacto devastador en SEO y conversión");
    suggestions.push("Las tiendas top tienen descripciones de 800-1500 palabras con storytelling, beneficios, FAQ y especificaciones");
  } else if (wordCount < 50) {
    descriptionScore = 10;
    problems.push(`Descripción extremadamente corta (${wordCount} palabras)`);
    suggestions.push("Mínimo 300 palabras para SEO básico. Las tiendas top usan 800-1500 palabras");
  } else if (wordCount < 100) {
    descriptionScore = 25;
    problems.push(`Descripción pobre (${wordCount} palabras)`);
    suggestions.push("Amplía a mínimo 300 palabras con secciones de beneficios, especificaciones y FAQ");
  } else if (wordCount < 200) {
    descriptionScore = 40;
    suggestions.push("Descripción corta — las fichas top de Shopify tienen 400-800 palabras mínimo");
  } else if (wordCount < 300) {
    descriptionScore = 55;
    suggestions.push("Descripción aceptable pero lejos del estándar premium (600+ palabras)");
  } else if (wordCount < 500) {
    descriptionScore = 70;
  } else if (wordCount < 800) {
    descriptionScore = 85;
  } else {
    descriptionScore = 92;
  }

  const hasH2 = /<h2[\s>]/i.test(bodyHtml);
  const hasH3 = /<h3[\s>]/i.test(bodyHtml);
  const hasBullets = bodyHtml.includes("<ul>") || bodyHtml.includes("<li>") || bodyHtml.includes("<ol>");
  const hasBold = bodyHtml.includes("<strong>") || bodyHtml.includes("<b>");
  const hasTable = bodyHtml.includes("<table");
  const hasEmoji = /[\u{1F300}-\u{1F9FF}]|✅|✓|★|⭐|💎|🎁|🔥|❤|✨|📦|🚀|💯/u.test(bodyText);

  let structureBonus = 0;
  if (hasH2) structureBonus += 2;
  if (hasH3) structureBonus += 1;
  if (hasBullets) structureBonus += 3;
  if (hasBold) structureBonus += 1;
  if (hasTable) structureBonus += 2;
  if (hasEmoji) structureBonus += 1;
  descriptionScore = Math.min(100, descriptionScore + structureBonus);

  if (!hasBullets && bodyLen > 200) {
    suggestions.push("Añade listas de beneficios con bullet points — aumentan un 24% la lectura");
  }
  if (!hasH2 && bodyLen > 300) {
    suggestions.push("Usa encabezados H2 para secciones (Beneficios, Especificaciones, FAQ) — mejora SEO y UX");
  }

  let priceScore = 0;
  const price = product.price ?? (product.variants?.[0]?.price);

  const priceNum = parseFloat(price ?? "0");
  if (!price || !Number.isFinite(priceNum) || priceNum <= 0) {
    priceScore = 0;
    problems.push("Sin precio válido — producto no vendible");
    suggestions.push("Configura un precio competitivo basado en investigación de mercado");
  } else {
    priceScore = 40;

    if (product.compare_at_price && parseFloat(product.compare_at_price) > priceNum) {
      const discount = ((parseFloat(product.compare_at_price) - priceNum) / parseFloat(product.compare_at_price)) * 100;
      if (discount >= 10 && discount <= 50) {
        priceScore += 25;
      } else if (discount > 50) {
        priceScore += 15;
        suggestions.push("Descuento superior al 50% — puede parecer sospechoso. Mantén entre 15-40%");
      } else {
        priceScore += 10;
        suggestions.push("Descuento menor al 10% — no genera suficiente urgencia. Apunta a 15-30%");
      }
    } else {
      suggestions.push("Añade compare_at_price (PVP tachado) — las tiendas top lo usan en el 80% de productos");
    }

    const priceStr = priceNum.toFixed(2);
    if (priceStr.endsWith(".99") || priceStr.endsWith(".95") || priceStr.endsWith(".90")) {
      priceScore += 15;
    } else if (priceStr.endsWith(".00")) {
      priceScore += 5;
      suggestions.push("Pricing psicológico: cambia de .00 a .99 o .95 — aumenta conversiones un 8-12%");
    } else {
      priceScore += 8;
    }

    if (priceNum > 0) priceScore += 10;

    if ((product.variants?.length ?? 0) > 1) {
      priceScore = Math.min(100, priceScore + 10);
    }
  }

  let imageScore = 0;
  const imgCount = product.images?.length ?? 0;

  if (imgCount === 0) {
    imageScore = 0;
    problems.push("Sin imágenes — las tiendas top tienen 8-12 imágenes por producto");
    suggestions.push("Añade mínimo 8 imágenes: hero frontal, lifestyle, detalle/textura, escala/tamaño, packaging, proceso, variantes, contexto de uso");
  } else if (imgCount === 1) {
    imageScore = 10;
    problems.push("Solo 1 imagen — los compradores necesitan ver el producto desde múltiples ángulos");
    suggestions.push("Los productos con 8+ imágenes convierten 3.4x más que los de 1-2 imágenes");
  } else if (imgCount === 2) {
    imageScore = 20;
    problems.push("Solo 2 imágenes — muy por debajo del estándar de calidad");
  } else if (imgCount === 3) {
    imageScore = 35;
    problems.push("Solo 3 imágenes — insuficiente para una ficha profesional");
    suggestions.push("Añade imágenes de lifestyle, detalle, empaquetado y UGC");
  } else if (imgCount === 4) {
    imageScore = 50;
    suggestions.push("4 imágenes es aceptable pero no premium — apunta a 8+ para máxima conversión");
  } else if (imgCount === 5) {
    imageScore = 65;
    suggestions.push("Buen número de imágenes — añade 3 más (lifestyle, escala, behind-the-scenes)");
  } else if (imgCount === 6 || imgCount === 7) {
    imageScore = 78;
    suggestions.push("Casi perfecto — 1-2 imágenes más (UGC, contexto de uso) para llegar a 100");
  } else if (imgCount >= 8 && imgCount <= 12) {
    imageScore = 95;
  } else {
    imageScore = 100;
  }

  const hasAltTexts = imgCount > 0 && product.images?.every((img) => img.alt && img.alt.trim().length >= 10);
  const someAltTexts = imgCount > 0 && product.images?.some((img) => img.alt && img.alt.trim() !== "");

  if (imgCount > 0 && !hasAltTexts) {
    if (!someAltTexts) {
      problems.push("Ninguna imagen tiene alt text — gran oportunidad SEO perdida (Google Images)");
      imageScore = Math.max(0, imageScore - 15);
    } else {
      suggestions.push("Algunas imágenes sin alt text descriptivo (mínimo 10 chars) — completa todas con keywords");
      imageScore = Math.max(0, imageScore - 8);
    }
  } else if (hasAltTexts) {
    imageScore = Math.min(100, imageScore + 5);
  }

  let seoScore = 0;
  const tags = product.tags ?? "";
  const tagList = tags ? tags.split(",").map(t => t.trim()).filter(t => t.length > 0) : [];
  const tagCount = tagList.length;
  const metafields = product.metafields ?? [];
  const metaTitle = metafields.find((m) => m.namespace === "seo" && m.key === "title");
  const metaDesc = metafields.find((m) => m.namespace === "seo" && m.key === "description");

  if (metaTitle && metaTitle.value.length >= 30) {
    seoScore += 20;
    if (metaTitle.value.length >= 40 && metaTitle.value.length <= 60) {
      seoScore += 5;
    }
  } else if (metaTitle) {
    seoScore += 10;
    suggestions.push("Meta title muy corto — debe tener 40-60 chars con keyword al inicio");
  } else {
    problems.push("Sin meta title SEO — Google usará el título del producto por defecto");
    suggestions.push("Añade meta title optimizado: [Keyword] — [Beneficio] | [Marca] (40-60 chars)");
  }

  if (metaDesc && metaDesc.value.length >= 100) {
    seoScore += 20;
    if (metaDesc.value.length >= 130 && metaDesc.value.length <= 160) {
      seoScore += 5;
    }
  } else if (metaDesc) {
    seoScore += 10;
    suggestions.push("Meta description corta — debe tener 130-155 chars con CTA y keywords");
  } else {
    problems.push("Sin meta description — impacto crítico en CTR de Google (puede reducir clics un 30%)");
    suggestions.push("Añade meta description: [Beneficio] + [Keyword] + [CTA] (130-155 chars)");
  }

  if (hasAltTexts && imgCount >= 4) {
    seoScore += 10;
  } else if (someAltTexts) {
    seoScore += 5;
  }

  if (titleLen >= 30 && titleLen <= 70) {
    seoScore += 10;
  } else if (titleLen > 20) {
    seoScore += 5;
  }

  if (tagCount >= 20) {
    seoScore += 15;
  } else if (tagCount >= 15) {
    seoScore += 12;
  } else if (tagCount >= 10) {
    seoScore += 8;
    suggestions.push("Añade más tags (20+) con keywords long-tail, sinónimos, y variaciones en español e inglés");
  } else if (tagCount >= 5) {
    seoScore += 4;
    problems.push(`Solo ${tagCount} tags — muy por debajo del mínimo recomendado (15-25)`);
    suggestions.push("Tags óptimos: tipo producto + material + uso + audiencia + estilo + temporada + keywords long-tail");
  } else {
    problems.push(`Solo ${tagCount} tags — prácticamente invisible en búsqueda interna y SEO`);
    suggestions.push("Necesitas mínimo 15 tags optimizados para competir en SEO");
  }

  if (bodyLen >= 800) {
    seoScore += 10;
  } else if (bodyLen >= 400) {
    seoScore += 5;
  }

  let contentQualityScore = 0;
  const lowerBody = bodyText.toLowerCase();
  const hasBenefits = hasBullets && wordCount >= 100;
  const hasSpecs = hasTable || /especificacion|dimensi|material|compos|caracter/i.test(bodyText);
  const hasFaq = /pregunta|faq|¿/i.test(bodyText);
  const hasCta = /compra|añad|carrito|ordena|descubr|consig/i.test(lowerBody);
  const hasGuarantee = /garant|devoluci|envío|shipping|gratis|free/i.test(lowerBody);
  const hasStorytelling = wordCount >= 200 && hasH2;

  if (hasBenefits) contentQualityScore += 12;
  if (hasSpecs) contentQualityScore += 12;
  if (hasFaq) contentQualityScore += 12;
  if (hasCta) contentQualityScore += 8;
  if (hasGuarantee) contentQualityScore += 8;
  if (hasStorytelling) contentQualityScore += 12;
  if (wordCount >= 500) contentQualityScore += 8;
  if (hasEmoji) contentQualityScore += 3;
  if (hasH3) contentQualityScore += 3;

  let readabilityPts = 0;
  if (wordCount >= 50) {
    const sentences = bodyText.split(/[.!?¿¡]+/).filter(s => s.trim().length > 5);
    const avgSentLen = sentences.length > 0 ? wordCount / sentences.length : 0;
    if (avgSentLen >= 10 && avgSentLen <= 25) readabilityPts = 8;
    else if (avgSentLen >= 8 && avgSentLen <= 30) readabilityPts = 5;
    else if (avgSentLen > 0) readabilityPts = 2;

    const paragraphs = bodyText.split(/\n\s*\n/).filter(p => p.trim().length > 20);
    if (paragraphs.length >= 6) readabilityPts += 4;
    else if (paragraphs.length >= 3) readabilityPts += 2;
  }
  contentQualityScore += readabilityPts;

  const titleWords = title.toLowerCase().replace(/[—–|·\-]/g, " ").split(/\s+/).filter(w => w.length > 3);
  let keywordConsistencyPts = 0;
  if (titleWords.length > 0 && wordCount >= 50) {
    const matchedInBody = titleWords.filter(w => lowerBody.includes(w)).length;
    const bodyRatio = matchedInBody / titleWords.length;
    if (bodyRatio >= 0.6) keywordConsistencyPts += 4;
    else if (bodyRatio >= 0.3) keywordConsistencyPts += 2;

    const first300 = lowerBody.substring(0, Math.min(lowerBody.length, 1200));
    const prominenceMatch = titleWords.filter(w => first300.includes(w)).length;
    if (prominenceMatch / titleWords.length >= 0.5) keywordConsistencyPts += 4;
    else if (prominenceMatch / titleWords.length >= 0.25) keywordConsistencyPts += 2;
  }
  contentQualityScore += keywordConsistencyPts;

  if (readabilityPts <= 2 && wordCount >= 100) suggestions.push("Mejora la legibilidad: frases de 10-25 palabras, párrafos cortos (estilo Semrush SEO Writing Assistant)");
  if (keywordConsistencyPts <= 2 && titleWords.length > 0) suggestions.push("Las keywords del título no aparecen en la descripción — Semrush recomienda repetir keywords en los primeros párrafos");
  if (!hasBenefits && bodyLen > 0) suggestions.push("Añade sección de beneficios con bullet points — es lo primero que leen los compradores");
  if (!hasSpecs && bodyLen > 0) suggestions.push("Añade tabla de especificaciones técnicas (material, dimensiones, peso, color)");
  if (!hasFaq && bodyLen > 0) suggestions.push("Añade sección FAQ (3-5 preguntas frecuentes) — activa Rich Snippets en Google y reduce abandonos");
  if (!hasCta && bodyLen > 0) suggestions.push("Añade un CTA claro al final de la descripción");
  if (!hasGuarantee && bodyLen > 0) suggestions.push("Añade información de garantía, envío y devoluciones — aumenta confianza un 18%");

  let trustScore = 0;
  if (hasGuarantee) trustScore += 18;
  if (imgCount >= 5) trustScore += 12;
  if (hasAltTexts) trustScore += 8;
  if (wordCount >= 300) trustScore += 12;
  if (product.compare_at_price) trustScore += 10;
  if (tagCount >= 10) trustScore += 8;
  if (metaDesc) trustScore += 8;
  if (metaTitle) trustScore += 8;
  if (hasFaq) trustScore += 8;
  if (hasSpecs) trustScore += 8;

  const weights = {
    title: 0.12,
    description: 0.22,
    price: 0.10,
    image: 0.18,
    seo: 0.18,
    contentQuality: 0.12,
    trust: 0.08,
  };

  const overallScore =
    titleScore * weights.title +
    descriptionScore * weights.description +
    priceScore * weights.price +
    imageScore * weights.image +
    seoScore * weights.seo +
    contentQualityScore * weights.contentQuality +
    trustScore * weights.trust;

  const grade = scoreToGrade(overallScore);

  return {
    overallScore: Math.round(overallScore),
    grade,
    titleScore: Math.round(titleScore),
    descriptionScore: Math.round(descriptionScore),
    priceScore: Math.round(priceScore),
    imageScore: Math.round(imageScore),
    seoScore: Math.round(seoScore),
    contentQualityScore: Math.round(contentQualityScore),
    trustScore: Math.round(trustScore),
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
