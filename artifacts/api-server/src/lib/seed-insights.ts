import { db } from "@workspace/db";
import { omnicoreInsightsTable, omnicoreMemoriesTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { logger } from "./logger.js";

function uid() { return randomBytes(8).toString("hex"); }

interface SeedInsight {
  domain: string;
  title: string;
  insight: string;
  confidence: number;
  insightType: string;
}

const SEED_INSIGHTS: SeedInsight[] = [
  // ─── ECOMMERCE (6) ───
  { domain: "ecommerce", title: "Regla del 3-click checkout", insight: "Cada paso adicional en el checkout reduce la conversión un 7-10%. Los mejores checkouts reducen fricción a 3 pasos o menos. Shopify Plus permite one-page checkout que puede aumentar la conversión un 35%.", confidence: 0.92, insightType: "principle" },
  { domain: "ecommerce", title: "Above the fold CTA", insight: "El 80% de la atención del usuario se concentra en el primer scroll. Un CTA visible sin hacer scroll aumenta las conversiones entre un 20-30%. El contraste del botón debe ser 4.5:1 mínimo.", confidence: 0.89, insightType: "pattern" },
  { domain: "ecommerce", title: "Velocidad de carga y revenue", insight: "Cada 100ms de mejora en tiempo de carga aumenta la conversión un 1.11% (Deloitte). Una tienda que carga en 1s convierte 2.5x más que una que carga en 5s.", confidence: 0.94, insightType: "correlation" },
  { domain: "ecommerce", title: "Mobile-first obligatorio", insight: "El 72% del tráfico eCommerce es móvil pero solo genera el 55% de las conversiones. Diseñar mobile-first y optimizar el touch target a mínimo 44px cierra esta brecha.", confidence: 0.91, insightType: "principle" },
  { domain: "ecommerce", title: "Urgencia real vs fabricada", insight: "La urgencia basada en datos reales (stock bajo real, ofertas con fecha límite verificable) convierte 4x más que contadores falsos. Los usuarios detectan urgencia falsa y genera desconfianza.", confidence: 0.87, insightType: "pattern" },
  { domain: "ecommerce", title: "Product page social proof", insight: "Mostrar reviews con fotos de clientes reales aumenta la conversión un 12.5%. Las reviews con imágenes tienen 6x más impacto que solo texto. El número mágico mínimo es 10 reviews.", confidence: 0.88, insightType: "correlation" },

  // ─── SHOPIFY TECHNICAL (6) ───
  { domain: "shopify_technical", title: "Metafields para datos estructurados", insight: "Usar metafields nativos de Shopify en vez de apps de terceros reduce el tiempo de carga un 40% y elimina dependencias. Desde 2023, los metafields se pueden definir directamente desde el admin.", confidence: 0.91, insightType: "principle" },
  { domain: "shopify_technical", title: "Liquid render performance", insight: "Evitar {% for %} loops anidados en Liquid. Un loop dentro de otro con 50 productos × 10 variantes genera 500 iteraciones que pueden añadir 2-3 segundos al render.", confidence: 0.88, insightType: "warning" },
  { domain: "shopify_technical", title: "Predictive search API", insight: "La Predictive Search API de Shopify devuelve resultados en <200ms vs la búsqueda estándar que tarda 500-800ms. Integrarla mejora la experiencia de búsqueda y aumenta el discovery un 15%.", confidence: 0.86, insightType: "opportunity" },
  { domain: "shopify_technical", title: "Checkout extensibility", insight: "Las Checkout Extensions de Shopify permiten personalizar el checkout sin Shopify Plus. Upsells en checkout generan un 10-15% de incremento en AOV cuando se implementan correctamente.", confidence: 0.84, insightType: "opportunity" },
  { domain: "shopify_technical", title: "Theme section schema", insight: "Definir settings en schema.json con tipos específicos (range, select, color) reduce errores del merchant un 60% vs campos de texto libre. La validación nativa previene roturas de layout.", confidence: 0.87, insightType: "principle" },
  { domain: "shopify_technical", title: "Webhooks vs polling", insight: "Usar webhooks de Shopify en vez de polling reduce las llamadas a la API un 95% y garantiza datos en tiempo real. El polling cada 5 minutos consume 288 llamadas/día por recurso.", confidence: 0.93, insightType: "principle" },

  // ─── FINANCIAL ANALYSIS (6) ───
  { domain: "financial_analysis", title: "Unit economics mínimos", insight: "Una tienda online necesita un margen bruto mínimo del 60% para ser sostenible después de costes de adquisición, operaciones y logística. Por debajo del 40%, es prácticamente imposible ser rentable con paid media.", confidence: 0.88, insightType: "principle" },
  { domain: "financial_analysis", title: "CAC:LTV ratio saludable", insight: "El ratio LTV/CAC debe ser ≥3:1 para un negocio sostenible. Por cada €1 invertido en adquirir un cliente, debe generar ≥€3 en su lifetime. Ratio <2:1 señala problemas graves.", confidence: 0.92, insightType: "principle" },
  { domain: "financial_analysis", title: "Break-even publicitario", insight: "El ROAS de break-even se calcula como 1/margen bruto. Con margen del 60%, necesitas ROAS mínimo de 1.67x. Con margen del 30%, necesitas 3.33x — haciendo paid media casi inviable.", confidence: 0.91, insightType: "pattern" },
  { domain: "financial_analysis", title: "Cash conversion cycle", insight: "Reducir el ciclo de conversión de efectivo (días inventario + días cobro - días pago) de 45 a 20 días puede liberar un 30-40% del capital de trabajo. Drop shipping lo reduce a 0.", confidence: 0.85, insightType: "pattern" },
  { domain: "financial_analysis", title: "Cohort analysis para retención", insight: "Analizar cohortes mensuales revela que el 80% de la retención se decide en los primeros 90 días. Las tiendas con tasa de repetición >25% en los primeros 3 meses tienen 5x más probabilidad de ser rentables.", confidence: 0.87, insightType: "correlation" },
  { domain: "financial_analysis", title: "Contribución marginal por canal", insight: "Calcular el margen de contribución por canal (no solo ROAS) revela que email marketing genera 42x ROI medio vs 2-4x de paid social. Reasignar budget según contribución marginal optimiza P&L.", confidence: 0.86, insightType: "principle" },

  // ─── MARKETING (5) ───
  { domain: "marketing", title: "Storytelling de marca en 3 actos", insight: "Las marcas que usan estructura de 3 actos (problema → lucha → transformación) en su storytelling generan 22x más engagement. El héroe siempre es el cliente, nunca la marca.", confidence: 0.89, insightType: "principle" },
  { domain: "marketing", title: "Consistencia de marca multicanal", insight: "Las marcas con identidad visual consistente en todos los canales generan 3.5x más reconocimiento. Inconsistencias en color, tipografía o tono reducen la confianza un 40%.", confidence: 0.87, insightType: "correlation" },
  { domain: "marketing", title: "Content pillar strategy", insight: "Organizar el contenido en 4-6 pilares temáticos genera 3x más tráfico orgánico que publicar sin estructura. Cada pilar debe tener 1 pieza larga (2000+ palabras) rodeada de 8-12 cluster posts.", confidence: 0.86, insightType: "pattern" },
  { domain: "marketing", title: "Marketing de escasez ética", insight: "Ediciones limitadas genuinas (colecciones cápsula de 100 unidades) generan 6x más urgencia que descuentos del 50%. La escasez real construye marca; la fabricada la destruye.", confidence: 0.88, insightType: "principle" },
  { domain: "marketing", title: "Influencer marketing micro vs macro", insight: "Los micro-influencers (10K-50K seguidores) generan 60% más engagement y 6.7x más coste-efectividad que los macro. Su tasa de conversión media es 3.86% vs 1.21% de macro.", confidence: 0.85, insightType: "correlation" },

  // ─── SEO & CONTENT (5) ───
  { domain: "seo_content", title: "Schema markup para eCommerce", insight: "Implementar Product schema, Review schema y FAQ schema aumenta el CTR orgánico un 30-40%. Los rich snippets con estrellas en Google generan 2x más clicks que resultados sin ellos.", confidence: 0.91, insightType: "principle" },
  { domain: "seo_content", title: "Topic authority sobre keywords", insight: "Google prioriza la autoridad temática sobre keywords individuales. Cubrir un tema con 15-20 artículos interconectados genera más tráfico que 50 artículos sueltos sin relación.", confidence: 0.89, insightType: "principle" },
  { domain: "seo_content", title: "Title tag formula eCommerce", insight: "La fórmula [Producto] + [Beneficio] + [Año] en title tags genera 20% más CTR que solo [Producto] + [Marca]. Ejemplo: 'Zapatillas Running Amortiguación Máxima 2024 | Brand'.", confidence: 0.84, insightType: "pattern" },
  { domain: "seo_content", title: "Internal linking para product discovery", insight: "Cada producto debe tener mínimo 3-5 internal links desde contenido relacionado. Las tiendas con internal linking estratégico mejoran el crawl budget un 60% y el ranking un 40%.", confidence: 0.87, insightType: "pattern" },
  { domain: "seo_content", title: "Alt text como SEO + accesibilidad", insight: "Alt texts descriptivos (no keyword stuffing) mejoran el ranking en Google Images un 25% y el tráfico de imagen un 40%. Deben describir el producto, color, uso y contexto.", confidence: 0.88, insightType: "principle" },

  // ─── PRICING SCIENCE (5) ───
  { domain: "pricing_science", title: "Efecto ancla en pricing", insight: "Mostrar un precio tachado (compare-at price) junto al precio real aumenta la percepción de valor un 60-80%. El descuento óptimo es 20-35% — más del 50% genera desconfianza.", confidence: 0.90, insightType: "principle" },
  { domain: "pricing_science", title: "Charm pricing .99 vs .00", insight: "Los precios terminados en .99 venden 24% más que los terminados en .00 en productos <€50. Para productos premium >€100, los precios redondos (€150 vs €149.99) transmiten más calidad.", confidence: 0.88, insightType: "pattern" },
  { domain: "pricing_science", title: "Efecto decoy en bundles", insight: "Añadir una opción 'señuelo' (más cara con poco valor extra) hace que la opción target parezca mejor deal. El efecto decoy aumenta la elección de la opción target un 40-60%.", confidence: 0.87, insightType: "principle" },
  { domain: "pricing_science", title: "Dynamic pricing boundaries", insight: "Los precios pueden variar un máximo de ±15% sin que el consumidor perciba injusticia. Más allá, genera efecto 'surge pricing' negativo. La elasticidad varía por categoría.", confidence: 0.83, insightType: "warning" },
  { domain: "pricing_science", title: "Free shipping threshold óptimo", insight: "El umbral de envío gratis debe ser 20-30% por encima del AOV actual. Si el AOV es €45, poner envío gratis a partir de €55-60 aumenta el AOV un 30% con impacto mínimo en margen.", confidence: 0.91, insightType: "pattern" },

  // ─── CONSUMER PSYCHOLOGY (5) ───
  { domain: "consumer_psychology", title: "Efecto dotación en personalización", insight: "Cuando un usuario personaliza un producto (color, texto, diseño), su valoración aumenta un 200-300% por el efecto dotación. El producto 'ya es suyo' antes de comprarlo.", confidence: 0.88, insightType: "principle" },
  { domain: "consumer_psychology", title: "Paradoja de la elección", insight: "Más de 7 opciones reduce la probabilidad de compra un 40%. Reducir de 24 a 6 variantes de mermelada aumentó las ventas un 600% (estudio Iyengar/Lepper). Curar > ofrecer todo.", confidence: 0.91, insightType: "principle" },
  { domain: "consumer_psychology", title: "Loss aversion en marketing", insight: "Las personas sienten las pérdidas 2.5x más intensamente que las ganancias equivalentes. 'No te pierdas' es 2x más efectivo que 'Aprovecha'. Pero debe usarse con moderación.", confidence: 0.89, insightType: "principle" },
  { domain: "consumer_psychology", title: "Efecto halo visual", insight: "El diseño visual atractivo hace que los usuarios perciban el producto como 15-20% mejor en calidad y funcionalidad. La primera impresión visual se forma en 50ms y es difícil de revertir.", confidence: 0.86, insightType: "correlation" },
  { domain: "consumer_psychology", title: "Reciprocidad y contenido gratuito", insight: "Ofrecer contenido de valor gratis (guías, herramientas, templates) activa el principio de reciprocidad. Los usuarios que reciben valor primero tienen 3x más probabilidad de comprar.", confidence: 0.87, insightType: "principle" },

  // ─── DESIGN & UX (5) ───
  { domain: "design_ux", title: "Visual hierarchy F-pattern", insight: "Los usuarios escanean páginas en patrón F: horizontal arriba, horizontal medio, vertical izquierda. Colocar CTAs y mensajes clave en estas zonas aumenta la interacción un 30%.", confidence: 0.90, insightType: "principle" },
  { domain: "design_ux", title: "Whitespace y percepción de lujo", insight: "El whitespace (espacio negativo) aumenta la comprensión del contenido un 20% y la percepción de calidad premium un 40%. Las marcas de lujo usan 40-60% de whitespace.", confidence: 0.87, insightType: "principle" },
  { domain: "design_ux", title: "Color psychology en CTAs", insight: "No existe un color 'mejor' universal para CTAs. Lo que importa es el contraste con el entorno. Un CTA que contrasta fuertemente con su fondo aumenta la visibilidad un 70%.", confidence: 0.88, insightType: "contradiction" },
  { domain: "design_ux", title: "Tipografía y legibilidad", insight: "El tamaño mínimo para body text es 16px. Los párrafos de 50-75 caracteres por línea tienen máxima legibilidad. Line-height de 1.5-1.6 reduce la fatiga visual un 25%.", confidence: 0.92, insightType: "principle" },
  { domain: "design_ux", title: "Progressive disclosure", insight: "Mostrar información progresivamente (expand/collapse, tabs, progressive forms) reduce la carga cognitiva un 50% y aumenta la completación de formularios un 35%.", confidence: 0.86, insightType: "pattern" },

  // ─── PAID MEDIA (5) ───
  { domain: "paid_media", title: "Creative fatigue ciclo", insight: "Los anuncios en Meta pierden un 15-20% de eficacia cada 2 semanas por creative fatigue. Rotar 5-8 creatividades cada 14 días mantiene el CPM estable y el CTR >1.5%.", confidence: 0.88, insightType: "pattern" },
  { domain: "paid_media", title: "Attribution window óptima", insight: "La ventana de atribución de 7 días click genera datos 30% más precisos que 28 días para eCommerce. El 85% de las conversiones post-click ocurren en las primeras 72h.", confidence: 0.85, insightType: "pattern" },
  { domain: "paid_media", title: "Broad targeting era", insight: "En 2024+, las audiencias amplias con buen creative superan a los lookalikes refinados en Meta Ads un 40%. El algoritmo de Meta optimiza mejor con más datos y menos restricciones.", confidence: 0.84, insightType: "prediction" },
  { domain: "paid_media", title: "Video ads hook 3 segundos", insight: "El 65% de los usuarios decide si ver un video ad en los primeros 3 segundos. Los hooks más efectivos: pregunta provocadora, dato sorprendente, o transformación visual impactante.", confidence: 0.89, insightType: "principle" },
  { domain: "paid_media", title: "Google Shopping feed optimization", insight: "Los títulos de producto en Google Shopping con formato [Marca] + [Tipo] + [Atributo clave] + [Color/Talla] generan 20% más CTR. Incluir GTINs válidos mejora la elegibilidad un 30%.", confidence: 0.87, insightType: "pattern" },

  // ─── LOGISTICS (5) ───
  { domain: "logistics", title: "Envío gratis como driver de conversión", insight: "El envío gratis es el factor #1 de decisión de compra para el 73% de los consumidores. Incorporar el coste de envío en el precio del producto mantiene el margen sin ahuyentar.", confidence: 0.91, insightType: "principle" },
  { domain: "logistics", title: "Dead stock identificación temprana", insight: "Los productos sin venta en 90 días deben marcarse como dead stock. Cada mes adicional en almacén cuesta un 1.5-2% del valor del producto. Liquidar rápido es mejor que almacenar.", confidence: 0.85, insightType: "warning" },
  { domain: "logistics", title: "3PL vs fulfillment propio", insight: "Para tiendas con <100 pedidos/día, un 3PL reduce costes logísticos un 25-30%. Por encima de 200 pedidos/día, fulfillment propio empieza a ser más rentable.", confidence: 0.83, insightType: "pattern" },
  { domain: "logistics", title: "Packaging como branding", insight: "Un unboxing experience memorable genera que el 40% de los clientes compartan en redes sociales. El coste de packaging premium (€1-3 extra) genera UGC que vale €50-200 en ad spend.", confidence: 0.87, insightType: "opportunity" },
  { domain: "logistics", title: "Velocidad de entrega expectativas", insight: "El 53% de los consumidores espera entrega en 2-3 días. Ofrecer entrega en 24h aumenta la conversión un 25% pero el margen debe absorber el coste incremental.", confidence: 0.86, insightType: "pattern" },

  // ─── SALES (5) ───
  { domain: "sales", title: "SPIN selling adaptado a eCommerce", insight: "Las descripciones de producto que siguen SPIN (Situación, Problema, Implicación, Need-payoff) convierten 30% más que las descriptivas. Primero el dolor, luego la solución.", confidence: 0.86, insightType: "principle" },
  { domain: "sales", title: "Upsell timing perfecto", insight: "El mejor momento para upsell es después del 'sí' inicial: en el checkout (conversión 10-15%) o en la thank you page (conversión 3-5%). Pre-checkout reduce la conversión base.", confidence: 0.88, insightType: "pattern" },
  { domain: "sales", title: "Cross-sell por complementariedad", insight: "Los cross-sells basados en complementariedad real (funda para el móvil, no otro móvil) tienen 3x más conversión. Amazon genera el 35% de sus ingresos con 'Frequently bought together'.", confidence: 0.90, insightType: "principle" },
  { domain: "sales", title: "Objeciones anticipadas", insight: "Responder las 3 objeciones principales en la página de producto (antes de que el cliente las piense) reduce el abandono un 28%. Las objeciones más comunes: precio, calidad, envío.", confidence: 0.85, insightType: "pattern" },
  { domain: "sales", title: "Escasez numérica específica", insight: "'Quedan 3 unidades' es 4x más efectivo que 'Stock limitado'. La especificidad genera credibilidad. Pero solo funciona con datos reales — el fraude se detecta y destruye confianza.", confidence: 0.87, insightType: "pattern" },

  // ─── MERCHANDISING (5) ───
  { domain: "merchandising", title: "Regla del 3 en product display", insight: "Mostrar productos en grupos de 3 facilita la comparación y decisión. Grids de 3 columnas en desktop generan 15% más interacción que 4 o 5 columnas.", confidence: 0.84, insightType: "principle" },
  { domain: "merchandising", title: "Hero product strategy", insight: "Cada colección necesita un 'hero product' que genere tráfico y 2-3 'complementarios'. El hero product recibe el 40-50% del tráfico de la colección.", confidence: 0.86, insightType: "pattern" },
  { domain: "merchandising", title: "Seasonal merchandising calendario", insight: "Preparar colecciones estacionales con 4-6 semanas de antelación captura el 80% de las búsquedas tempranas. Primavera→febrero, Verano→abril, Navidad→octubre.", confidence: 0.85, insightType: "pattern" },
  { domain: "merchandising", title: "Category page como landing page", insight: "Las category pages bien optimizadas (descripción SEO, filtros intuitivos, hero image) generan 3x más conversión que redirigir todo el tráfico a la home.", confidence: 0.87, insightType: "principle" },
  { domain: "merchandising", title: "Visual merchandising digital", insight: "Las imágenes de producto en contexto (lifestyle) generan 22% más conversión que fotos sobre fondo blanco. La combinación ideal: 2-3 fotos técnicas + 2-3 lifestyle.", confidence: 0.88, insightType: "pattern" },

  // ─── PHOTOGRAPHY (5) ───
  { domain: "photography", title: "Regla de los tercios en producto", insight: "Posicionar el producto en los puntos de intersección de la regla de los tercios genera imágenes 35% más atractivas que centrado perfecto. Aplica a fotos lifestyle.", confidence: 0.85, insightType: "principle" },
  { domain: "photography", title: "Iluminación natural vs artificial", insight: "La luz natural difusa (ventana norte, día nublado) genera las fotos de producto más profesionales con menor inversión. La golden hour produce tonos cálidos ideales para lifestyle.", confidence: 0.84, insightType: "pattern" },
  { domain: "photography", title: "Consistencia visual del catálogo", insight: "Un catálogo con estilo fotográfico consistente (misma iluminación, ángulo, fondo) aumenta la percepción de profesionalismo un 50% y el tiempo en página un 25%.", confidence: 0.89, insightType: "principle" },
  { domain: "photography", title: "Zoom y detalle conversion impact", insight: "Las tiendas con zoom de alta resolución (+2000px) y fotos de detalle tienen 35% más conversión. Los clientes no pueden tocar el producto — las fotos deben compensar.", confidence: 0.87, insightType: "correlation" },
  { domain: "photography", title: "360° y video de producto", insight: "Las fotos 360° reducen las devoluciones un 25-30% porque el cliente entiende mejor el producto. Los videos de producto de 15-30s aumentan la conversión un 20%.", confidence: 0.86, insightType: "correlation" },

  // ─── COPYWRITING (5) ───
  { domain: "copywriting", title: "Fórmula AIDA en product descriptions", insight: "Attention (título impactante) → Interest (beneficio clave) → Desire (imaginación de uso) → Action (CTA claro). Las descripciones AIDA convierten 35% más que las descriptivas.", confidence: 0.88, insightType: "principle" },
  { domain: "copywriting", title: "Beneficios sobre características", insight: "Los clientes compran beneficios, no características. 'Batería de 5000mAh' es una feature; 'Tu móvil dura todo el día sin cargarlo' es un beneficio. Los beneficios venden 2x más.", confidence: 0.91, insightType: "principle" },
  { domain: "copywriting", title: "Power words en títulos", insight: "Palabras como 'Exclusivo', 'Premium', 'Garantizado', 'Probado' aumentan el CTR un 20-30%. Pero deben ser veraces — poder words falsas destruyen la confianza.", confidence: 0.84, insightType: "pattern" },
  { domain: "copywriting", title: "Tone of voice consistente", insight: "Las marcas con tono de voz consistente y definido generan 3x más reconocimiento. Debe documentarse: ¿tuteas o usted? ¿Formal o casual? ¿Técnico o emocional?", confidence: 0.86, insightType: "principle" },
  { domain: "copywriting", title: "Meta descriptions que venden", insight: "Las meta descriptions con CTA y número específico ('Descubre 12 modelos desde 29€ · Envío gratis') generan 30% más CTR que las descriptivas genéricas.", confidence: 0.85, insightType: "pattern" },

  // ─── AI & TECHNOLOGY (5) ───
  { domain: "ai_technology", title: "Prompt engineering para eCommerce", insight: "Los prompts estructurados con contexto + rol + formato + restricciones generan outputs 5x más útiles. Incluir ejemplos (few-shot) mejora la calidad un 40% adicional.", confidence: 0.88, insightType: "principle" },
  { domain: "ai_technology", title: "AI generativa para product descriptions", insight: "La IA genera descripciones de producto un 90% más rápido con calidad comparable a copywriters junior. El flujo ideal: IA genera draft → humano edita y añade personalidad.", confidence: 0.86, insightType: "pattern" },
  { domain: "ai_technology", title: "Chatbots IA para atención al cliente", insight: "Los chatbots con LLMs resuelven el 65-80% de las consultas de primer nivel sin intervención humana. El ahorro medio es 40% en costes de atención, con satisfacción similar.", confidence: 0.85, insightType: "correlation" },
  { domain: "ai_technology", title: "Computer vision para SEO de imágenes", insight: "Usar IA de visión para generar alt texts descriptivos automáticamente mejora el SEO de imágenes sin esfuerzo manual. Los alt texts generados por IA son 80% tan buenos como los humanos.", confidence: 0.83, insightType: "pattern" },
  { domain: "ai_technology", title: "Personalización con ML", insight: "La personalización basada en comportamiento (no solo demografía) aumenta la conversión un 30%. Los sistemas de recomendación tipo collaborative filtering generan el 35% de los ingresos de Amazon.", confidence: 0.87, insightType: "correlation" },

  // ─── SOCIAL MEDIA (5) ───
  { domain: "social_media", title: "Regla 80/20 de contenido social", insight: "El 80% del contenido social debe aportar valor (educación, entretenimiento, inspiración) y el 20% ser promocional. Las cuentas que invierten esta proporción pierden followers rápidamente.", confidence: 0.88, insightType: "principle" },
  { domain: "social_media", title: "Timing de publicación por plataforma", insight: "Instagram: martes-jueves 10-14h. TikTok: lunes-viernes 7-9h y 17-20h. LinkedIn: martes-jueves 8-10h. El engagement varía hasta un 50% según la hora de publicación.", confidence: 0.82, insightType: "pattern" },
  { domain: "social_media", title: "Reels vs posts estáticos", insight: "Los Reels generan 22% más reach que posts estáticos en Instagram. El algoritmo favorece video corto. Pero los carruseles educativos generan 3x más guardados (saves = gold).", confidence: 0.85, insightType: "correlation" },
  { domain: "social_media", title: "Community building sobre followers", insight: "500 seguidores comprometidos que comentan y comparten generan más ventas que 50K pasivos. Las métricas de engagement (saves, shares, comments) predicen ventas 10x mejor que followers.", confidence: 0.89, insightType: "principle" },
  { domain: "social_media", title: "UGC como motor de contenido", insight: "El contenido generado por usuarios tiene 6.9x más engagement que el de marca. Crear un hashtag de marca y repostear UGC genera un loop de contenido gratuito y auténtico.", confidence: 0.87, insightType: "pattern" },

  // ─── EMAIL & AUTOMATION (5) ───
  { domain: "email_automation", title: "Welcome series de 5 emails", insight: "La secuencia de bienvenida genera 3x más revenue que cualquier otro flujo. Los 5 emails: 1) Bienvenida + cupón, 2) Historia de marca, 3) Bestsellers, 4) Social proof, 5) Oferta especial.", confidence: 0.90, insightType: "pattern" },
  { domain: "email_automation", title: "Segmentación por comportamiento", insight: "Los emails segmentados por comportamiento (compras previas, categorías visitadas) generan 760% más revenue que los emails masivos. 3 segmentos mínimos: activos, tibios, dormidos.", confidence: 0.91, insightType: "principle" },
  { domain: "email_automation", title: "Subject line testing", insight: "Subject lines con 6-10 palabras tienen la tasa de apertura más alta (21%). La personalización con nombre aumenta la apertura un 26%. Los emojis aumentan un 15% en mobile.", confidence: 0.85, insightType: "pattern" },
  { domain: "email_automation", title: "Win-back flow timing", insight: "El flow de win-back (recuperación de clientes dormidos) es más efectivo a los 60-90 días de la última compra. El incentivo óptimo es 15-20% de descuento exclusivo.", confidence: 0.84, insightType: "pattern" },
  { domain: "email_automation", title: "Deliverability y sender reputation", insight: "Mantener la tasa de spam por debajo del 0.1% es crítico. Limpiar la lista cada 90 días (eliminar no-engagers) mejora la deliverability un 30% y el ROI un 25%.", confidence: 0.87, insightType: "warning" },

  // ─── SUSTAINABILITY (3) ───
  { domain: "sustainability", title: "Eco-friendly como diferenciador", insight: "El 73% de los millennials están dispuestos a pagar más por productos sostenibles. La sostenibilidad genuina (no greenwashing) es el diferenciador #1 para marcas emergentes.", confidence: 0.85, insightType: "opportunity" },
  { domain: "sustainability", title: "Packaging sostenible ROI", insight: "El packaging 100% reciclable o compostable cuesta un 10-15% más pero genera un 40% más de contenido UGC. Los clientes comparten empaques eco-friendly como statement social.", confidence: 0.83, insightType: "correlation" },
  { domain: "sustainability", title: "Certificaciones que importan", insight: "Las certificaciones reconocidas (B Corp, Fair Trade, FSC) aumentan la conversión un 12-18%. Las auto-declaraciones ('eco-friendly') sin certificación tienen 0% de impacto.", confidence: 0.84, insightType: "pattern" },

  // ─── CUSTOMER SERVICE (3) ───
  { domain: "customer_service", title: "Respuesta en primera hora", insight: "El 82% de los consumidores esperan respuesta en menos de 1 hora. Las tiendas que responden en <15 minutos tienen un NPS 30 puntos más alto que las que tardan >4h.", confidence: 0.89, insightType: "principle" },
  { domain: "customer_service", title: "NPS como predictor de crecimiento", insight: "Cada punto de NPS se correlaciona con un 0.5-1% de crecimiento anual. Un NPS >50 indica excelencia. Las tiendas con NPS >70 crecen 2.5x más rápido que la media.", confidence: 0.86, insightType: "correlation" },
  { domain: "customer_service", title: "Post-purchase experience", insight: "Un email de seguimiento de envío personalizado reduce las consultas de 'dónde está mi pedido' un 70%. Las actualizaciones proactivas de estado generan más confianza.", confidence: 0.87, insightType: "pattern" },

  // ─── INTERNATIONAL (3) ───
  { domain: "international", title: "Multi-moneda impacto en conversión", insight: "Mostrar precios en moneda local aumenta la conversión un 30-40% en mercados internacionales. Los clientes abandonan un 13% más cuando ven precios en moneda extranjera.", confidence: 0.89, insightType: "correlation" },
  { domain: "international", title: "Localización vs traducción", insight: "La localización (adaptar contenido a cultura local) genera 2x más conversión que la simple traducción. Incluye adaptar ejemplos, referencias culturales, y formatos de fecha/moneda.", confidence: 0.86, insightType: "principle" },
  { domain: "international", title: "Cross-border logistics", insight: "Los aranceles e impuestos ocultos son la causa #1 de abandono en compras cross-border (48%). Mostrar el precio DDP (delivered duty paid) reduce el abandono un 35%.", confidence: 0.85, insightType: "warning" },

  // ─── BRAND STRATEGY (3) ───
  { domain: "brand_strategy", title: "Propuesta de valor en 10 palabras", insight: "Las marcas que pueden articular su propuesta de valor en ≤10 palabras generan 3x más recall. Si no puedes explicar por qué eres diferente en una frase, el cliente tampoco puede.", confidence: 0.88, insightType: "principle" },
  { domain: "brand_strategy", title: "Brand equity vs precio", insight: "Las marcas con alto brand equity (reconocimiento, asociaciones positivas, lealtad) pueden cobrar un 20-25% premium sobre la competencia sin afectar el volumen de ventas.", confidence: 0.87, insightType: "correlation" },
  { domain: "brand_strategy", title: "Diferenciación por nicho", insight: "Las marcas que se posicionan como expertas en un nicho específico generan 5x más confianza que las generalistas. Es mejor ser el #1 en un nicho que el #15 en un mercado amplio.", confidence: 0.89, insightType: "principle" },
];

export async function loadSeedInsights(): Promise<number> {
  const existing = await db.select({ count: sql<number>`count(*)` }).from(omnicoreInsightsTable);
  const count = Number(existing[0]?.count ?? 0);

  if (count > 0) {
    logger.info({ existingInsights: count }, "Seed insights skipped — table already has data");
    return 0;
  }

  logger.info(`Loading ${SEED_INSIGHTS.length} seed insights into OmniCore Brain...`);
  let loaded = 0;

  for (const seed of SEED_INSIGHTS) {
    const insId = `seed-${seed.domain}-${uid()}`;
    try {
      await db.insert(omnicoreInsightsTable).values({
        id: insId,
        domain: seed.domain,
        insightType: seed.insightType,
        title: seed.title,
        insight: seed.insight,
        confidence: seed.confidence,
        impactScore: seed.confidence * 0.9,
        source: "seed_data",
      }).onConflictDoNothing();

      if (seed.confidence >= 0.85) {
        await db.insert(omnicoreMemoriesTable).values({
          id: `mem-${insId}`,
          memoryType: "general",
          niche: "general",
          title: `[Seed·${seed.domain}] ${seed.title}`,
          content: seed.insight.slice(0, 4000),
          confidence: seed.confidence,
          sourceType: "seed_data",
        }).onConflictDoNothing();
      }

      loaded++;
    } catch (err) {
      logger.warn({ insId, err }, "Failed to insert seed insight");
    }
  }

  logger.info({ loaded, total: SEED_INSIGHTS.length }, `Seed insights loaded: ${loaded}/${SEED_INSIGHTS.length}`);
  return loaded;
}
