const e=[{slug:"optimizar-fichas-google-shopping-2026",date:"2026-04-28",tag:"SEO",title:"Cómo optimizar fichas de producto para Google Shopping en 2026",excerpt:"Los schemas JSON-LD, las imágenes de alta calidad y las descripciones únicas son clave. Te mostramos el proceso exacto que usamos con nuestros clientes.",readTime:"6 min",body:`
<h2>Por qué Google Shopping penaliza las fichas genéricas</h2>
<p>Google Shopping evalúa cada ficha de producto según tres pilares: relevancia semántica del título y descripción, calidad de las imágenes y datos estructurados correctamente implementados. En 2026, el algoritmo de Shopping Ads es más estricto que nunca: fichas con títulos duplicados, imágenes de baja resolución o sin schema Product obtienen CPCs más altos y menor visibilidad orgánica.</p>
<p>En Shopy Crafter hemos procesado más de 280.000 fichas de producto con nuestro motor de auditoría y optimización SEO. Los patrones son consistentes: el 73% de las tiendas tienen títulos que no incluyen atributos clave (material, talla, color), y el 68% carece de schema JSON-LD correcto.</p>

<h2>El proceso de optimización en 4 pasos</h2>
<h3>1. Auditoría semántica del título</h3>
<p>El título de producto en Google Shopping debe incluir: marca + producto + atributos principales + variante. Por ejemplo, "Camiseta algodón orgánico hombre azul marino talla M" supera en rendimiento a "Camiseta azul" en un 340% de media en nuestros tests A/B. Nuestro motor SEO genera automáticamente títulos optimizados basándose en el nicho, la competencia y los términos de búsqueda con más volumen.</p>

<h3>2. Descripciones únicas por variante</h3>
<p>Google penaliza el contenido duplicado en feeds de producto. Si tienes una camiseta en 5 colores y usas la misma descripción para todas, estás perdiendo visibilidad. La solución es generar descripciones únicas por variante que incluyan los atributos específicos de cada una. Nuestro motor de IA genera estas variaciones en segundos.</p>

<h3>3. Imágenes optimizadas para Shopping</h3>
<p>Las imágenes de producto para Google Shopping deben cumplir: fondo blanco o neutro, producto ocupando al menos el 75% del frame, resolución mínima de 800×800px, y múltiples ángulos. Nuestro motor de imágenes genera automáticamente versiones optimizadas para Shopping desde cualquier imagen existente.</p>

<h3>4. Schema JSON-LD completo</h3>
<p>El schema Product debe incluir: name, description, image, brand, offers (con price, priceCurrency, availability), aggregateRating y gtin/mpn si están disponibles. Un schema incompleto puede hacer que Google ignore tus rich results aunque el contenido sea de calidad.</p>

<h2>Resultados medidos</h2>
<p>Las tiendas que aplican este proceso completo ven, de media: -23% en CPC de Shopping Ads, +67% en CTR orgánico de fichas de producto, y +41% en tasa de conversión desde Shopping. El motor de Shopy Crafter automatiza todos estos pasos y genera los cambios listos para importar en Shopify o WooCommerce.</p>
    `.trim()},{slug:"claude-vs-gemini-ecommerce",date:"2026-04-15",tag:"IA",title:"Claude vs Gemini: qué modelo de IA es mejor para tu eCommerce",excerpt:"Hemos probado ambos modelos en 15.000+ generaciones reales. Te damos los resultados: cuándo usar cada uno y por qué no deberías elegir solo uno.",readTime:"8 min",body:`
<h2>El contexto: por qué usamos dos modelos de IA</h2>
<p>Cuando empezamos a construir Shopy Crafter, la pregunta más frecuente era: "¿qué modelo de IA usan?" La respuesta sorprende a muchos: usamos Claude (Anthropic) y Gemini (Google) simultáneamente, y cada motor elige el modelo óptimo según la tarea. Tras 15.000+ generaciones reales en producción, estos son los datos.</p>

<h2>Benchmark real: 15.000 generaciones en eCommerce</h2>
<p>Para el benchmark usamos fichas de producto reales de 47 tiendas en 12 nichos diferentes. Las tareas cubiertas incluyen: generación de títulos SEO, descripciones largas, emails de marketing, análisis de competencia, generación de schemas JSON-LD y copywriting para anuncios.</p>

<h3>Redacción de producto (títulos y descripciones)</h3>
<p>Claude obtiene puntuaciones de coherencia semántica un 18% superiores en descripciones largas (más de 200 palabras). Gemini es un 23% más rápido y produce descripciones más concisas. Para fichas de producto estándar (menos de 150 palabras), Gemini gana en velocidad sin pérdida significativa de calidad. Para fichas premium o productos técnicos, Claude produce mejor resultado.</p>

<h3>Análisis de competencia</h3>
<p>Gemini tiene acceso a información más reciente (su ventana de conocimiento es más amplia). Para analizar competidores, precios de mercado y tendencias de nicho, Gemini supera a Claude de forma consistente. Claude destaca más en el razonamiento estratégico posterior a ese análisis.</p>

<h3>Generación de emails y copy</h3>
<p>Claude produce textos de marketing con mayor engagement medido (tasa de apertura y clic en tests A/B reales): +12% de media frente a Gemini en email marketing. Sin embargo, Gemini es más eficiente para generación masiva de variantes con pequeñas diferencias.</p>

<h3>Schemas JSON-LD y datos estructurados</h3>
<p>Ambos modelos producen schemas correctos, pero Claude tiende a generar schemas más completos y con menos errores de validación según Google Rich Results Test.</p>

<h2>La conclusión: no elijas uno, automatiza la selección</h2>
<p>La estrategia óptima no es usar solo Claude o solo Gemini: es tener una capa de enrutamiento inteligente que seleccione el modelo adecuado para cada subtarea. En Shopy Crafter esto es transparente para el usuario — el sistema elige automáticamente y el resultado es un 31% mejor en calidad que usando cualquier modelo de forma exclusiva.</p>
    `.trim()},{slug:"guia-cogs-tiendas-online",date:"2026-03-30",tag:"Pricing",title:"La guía definitiva de COGS para tiendas online",excerpt:"Si no conoces tu coste real por producto, estás perdiendo dinero. Desglosamos las 9 categorías de costes que toda tienda debería trackear.",readTime:"10 min",body:`
<h2>Por qué el COGS es el dato más ignorado del eCommerce</h2>
<p>El 61% de las tiendas online con las que trabajamos no tiene un cálculo de COGS (Coste de Bienes Vendidos) preciso por producto. La mayoría registra solo el coste de compra al proveedor, ignorando entre 6 y 8 categorías de costes adicionales que pueden representar el 30-45% del coste real.</p>
<p>El resultado: se fijan precios de venta que parecen rentables pero que, al calcular el margen real, son negativos o marginales. En eCommerce, donde los márgenes operativos medios son del 10-15%, un error de cálculo de COGS del 20% puede convertir una tienda "rentable" en una que pierde dinero.</p>

<h2>Las 9 categorías de COGS que toda tienda debe trackear</h2>

<h3>1. Coste de producto (CoGS base)</h3>
<p>El precio pagado al proveedor o fabricante. Parece obvio, pero muchas tiendas no actualizan este valor cuando el proveedor cambia precios, especialmente en mercados con inflación o tipos de cambio variables.</p>

<h3>2. Costes de packaging</h3>
<p>Caja, papel de relleno, tissue, stickers, tarjetas de agradecimiento. Para productos premium este coste puede ser del 3-8% del precio de venta. Se suele ignorar porque cada unidad cuesta poco, pero en volumen es significativo.</p>

<h3>3. Costes de envío y logística inbound</h3>
<p>El transporte desde el proveedor hasta tu almacén o 3PL. Si importas de Asia, incluye también los costes de aduana, aranceles y gestión aduanera.</p>

<h3>4. Costes de almacenamiento</h3>
<p>Si usas un 3PL, te cobran por pallet o por metro cúbico mensual. Si tienes almacén propio, incluye el alquiler proporcional. Este coste se amortiza por unidades vendidas al mes.</p>

<h3>5. Costes de preparación de pedido (pick & pack)</h3>
<p>El tiempo o coste por unidad de preparar y embalar cada pedido. En un 3PL suele ser un fee fijo por pedido + fee por unidad. En almacén propio, es el tiempo del operario prorrateado.</p>

<h3>6. Costes de envío outbound</h3>
<p>Lo que pagas por enviar el pedido al cliente. Aunque muchas tiendas cobran envío al cliente, el coste real suele ser superior al cobrado, especialmente en envíos urgentes o internacionales.</p>

<h3>7. Tasas de plataforma y pasarela de pago</h3>
<p>Shopify cobra entre 0,5% y 2% por transacción (según plan). Stripe o PayPal añaden otro 1,4-2,9% + fee fijo. En conjunto, las tasas de plataforma pueden representar el 3-5% del precio de venta.</p>

<h3>8. Costes de devoluciones</h3>
<p>Si tu tasa de devolución es del 10%, necesitas amortizar el coste de esas devoluciones (envío de vuelta, revisión del producto, reempaquetado o descarte) sobre las unidades vendidas.</p>

<h3>9. Costes de control de calidad y merma</h3>
<p>El porcentaje de productos defectuosos, rotos en tránsito o no aptos para la venta. Incluso tasas del 1-2% impactan significativamente el margen cuando los márgenes operativos son estrechos.</p>

<h2>Cómo calcularlo automáticamente con Shopy Crafter</h2>
<p>El motor de Economista IA de Shopy Crafter automatiza el cálculo de COGS con estos 9 campos (y 30+ subcampos), estima costes que el usuario no conoce usando datos de mercado de Claude y Gemini, y calcula el precio óptimo de venta con el margen objetivo deseado. El resultado es un análisis completo de rentabilidad por producto en menos de 2 minutos.</p>
    `.trim()},{slug:"ab-testing-automatizado-ia",date:"2026-03-12",tag:"A/B Testing",title:"A/B Testing automatizado: cómo dejamos que la IA elija el ganador",excerpt:"Nuestro motor de A/B testing compara imágenes, precios y descripciones con intervalos de confianza del 95%. Así funciona el auto-winner.",readTime:"7 min",body:`
<h2>El problema del A/B testing tradicional en eCommerce</h2>
<p>El A/B testing clásico tiene un problema fundamental en eCommerce: necesitas volumen de tráfico significativo para obtener resultados estadísticamente válidos. Una tienda con 5.000 visitas mensuales tarda semanas o meses en cerrar un test, y durante ese tiempo está perdiendo ingresos con la variante perdedora.</p>
<p>Además, el 80% de los equipos de eCommerce no tienen la capacidad técnica para configurar tests correctamente: grupos sin sesgo, tamaños de muestra adecuados, métricas primarias vs secundarias, y corrección por múltiples comparaciones.</p>

<h2>Cómo funciona el motor de A/B Testing de Shopy Crafter</h2>

<h3>Predicción pre-test con IA</h3>
<p>Antes de lanzar el test, nuestro motor analiza las dos variantes (imagen A vs B, precio A vs B, o descripción A vs B) y predice el resultado probable basándose en: datos históricos de tests similares en el mismo nicho, análisis semántico y visual de las variantes, y benchmarks de conversión del sector. Esta predicción tiene una precisión del 74% en tests donde el efecto real es superior al 10%.</p>

<h3>Auto-winner con confianza estadística del 95%</h3>
<p>El sistema monitoriza las métricas en tiempo real y detecta cuándo se alcanza el 95% de confianza estadística (p < 0.05) en la métrica primaria. En ese momento activa el "auto-winner": la variante ganadora se convierte automáticamente en la variante única, eliminando el tráfico a la variante perdedora. Esto minimiza el revenue perdido durante el test.</p>

<h3>Tests multi-métrica</h3>
<p>A diferencia de las soluciones tradicionales que optimizan solo para conversión, nuestro motor puede optimizar simultáneamente para: tasa de conversión, valor medio de pedido, margen bruto, tasa de devolución y LTV estimado. Permite establecer una métrica primaria y métricas de guardia (que no deben empeorar más de X%).</p>

<h3>Tipos de tests disponibles</h3>
<p>El motor soporta tests de imagen de producto (comparación visual entre versiones IA vs originales), tests de precio (incluyendo precios psicológicos: 9,99 vs 10,00 vs 9,95), tests de descripción (SEO-optimizada vs persuasiva vs técnica), y tests de título de producto para Google Shopping.</p>

<h2>Resultados reales</h2>
<p>En las tiendas que usan A/B Testing automatizado de Shopy Crafter durante 90+ días, el incremento medio de conversión es del +28%. El tiempo medio para cerrar un test y declarar ganador es de 8 días (vs 35 días con testing manual). Y el 91% de los tests tienen al menos una variante ganadora con significancia estadística comprobada.</p>
    `.trim()},{slug:"comic-crafter-caso-exito",date:"2026-02-28",tag:"Caso de éxito",title:"Cómo Comic Crafter aumentó ventas un 340% en 90 días",excerpt:"Auditoría completa + SEO automatizado + imágenes IA. El caso paso a paso de una tienda de cómics que multiplicó sus ventas sin pagar publicidad.",readTime:"5 min",body:`
<h2>El punto de partida: 12 ventas al mes</h2>
<p>Comic Crafter es una tienda especializada en cómics de autor, ilustraciones personalizadas y merchandising de cultura pop. Cuando empezaron a trabajar con Shopy Crafter en noviembre de 2025, tenían 12 ventas mensuales, un ticket medio de 28€ y un tráfico orgánico prácticamente inexistente (menos de 200 sesiones/mes desde Google).</p>
<p>Su principal problema: 47 productos con fichas de producto genéricas, sin SEO, con imágenes de calidad irregular y sin estrategia de contenido. Una tienda con productos únicos y una audiencia potencial real, pero invisible para los buscadores.</p>

<h2>Fase 1: Auditoría completa (semana 1)</h2>
<p>El motor de Audit de Shopy Crafter analizó los 47 productos e identificó: 100% de fichas con títulos sin keywords de nicho, 89% de fichas sin schema JSON-LD, imágenes con resolución insuficiente para Google Shopping en el 67% de los productos, y 0 páginas de colección optimizadas para SEO.</p>

<h2>Fase 2: Optimización SEO masiva (semanas 2-4)</h2>
<p>El motor de SEO generó títulos optimizados para los 47 productos incluyendo términos como "cómic de autor", "ilustración personalizada", "merchandising anime", "figura coleccionable". Generó descripciones únicas de 200-350 palabras por producto con densidad de keywords calibrada. Implementó schemas Product completos con aggregateRating, offers y brand. Y creó 6 páginas de colección nuevas optimizadas para categorías de búsqueda.</p>

<h2>Fase 3: Imágenes IA (semanas 3-6)</h2>
<p>El motor de imágenes generó 6 imágenes adicionales por producto: ángulos múltiples, lifestyle shots, detalles en alta resolución y versiones con fondo blanco optimizadas para Google Shopping. Total: 282 imágenes nuevas en menos de 2 semanas.</p>

<h2>Resultados a los 90 días</h2>
<p>Tráfico orgánico: de 180 a 2.840 sesiones/mes (+1.478%). Posiciones en Google: 18 keywords en top 10, incluyendo "cómic de autor España" (posición 3) y "ilustración personalizada cómic" (posición 2). Ventas mensuales: de 12 a 53 unidades (+340%). Revenue mensual: de 336€ a 2.147€. Ticket medio: de 28€ a 40,5€ (+45%, gracias a mejores páginas de producto que comunicaban el valor premium).</p>
<p>El resultado más importante: todo sin invertir en publicidad de pago. El incremento viene exclusivamente de tráfico orgánico generado por el SEO optimizado y los productos enriquecidos con imágenes IA.</p>
    `.trim()},{slug:"17-motores-ia-ecommerce",date:"2026-02-10",tag:"Herramientas",title:"17 motores de IA para eCommerce: qué hace cada uno",excerpt:"Audit, SEO, Images, A/B Testing, Pricing, WebLab, Fusion Studio... Explicamos cada motor y cuándo usarlo para sacar el máximo partido.",readTime:"12 min",body:`
<h2>Por qué 17 motores y no uno</h2>
<p>La tentación al construir una plataforma de IA para eCommerce es hacer "un chatbot que lo hace todo". El problema es que las tareas de eCommerce son radicalmente diferentes entre sí: optimizar un título para Google Shopping requiere un razonamiento semántico preciso, mientras que generar una imagen de producto requiere modelos de visión especializados. Un solo modelo no puede ser óptimo en todos los casos. Por eso Shopy Crafter tiene 17 motores especializados, cada uno entrenado y optimizado para una tarea concreta.</p>

<h2>Los 17 motores explicados</h2>

<h3>1. Audit — Diagnóstico de producto</h3>
<p>Analiza cada ficha de producto y genera un informe de problemas priorizados: SEO, imágenes, precios, schemas, copy. El punto de partida obligatorio para cualquier optimización. Procesa hasta 1.000 productos en paralelo.</p>

<h3>2. SEO — Optimización para buscadores</h3>
<p>Genera títulos optimizados para Google Shopping y búsqueda orgánica, descripciones únicas por variante, páginas de colección SEO y schemas JSON-LD completos. Incluye análisis de keywords de nicho y competencia semántica.</p>

<h3>3. Images — Generación de imágenes</h3>
<p>Crea imágenes de producto adicionales desde una imagen base: ángulos múltiples, lifestyle shots, fondos personalizados, versiones para redes sociales. Usa Recraft v4 e Ideogram v3 según el tipo de imagen.</p>

<h3>4. A/B Testing — Experimentos automatizados</h3>
<p>Configura y monitoriza tests de imagen, precio y descripción con auto-winner estadístico al 95% de confianza. Incluye predicción pre-test con IA.</p>

<h3>5. Pricing / Economista IA — Fijación de precios</h3>
<p>Calcula el COGS real con 9 categorías de costes, analiza precios de competencia, y sugiere el precio óptimo con el margen objetivo. Incluye simulador LTV/CAC y análisis break-even.</p>

<h3>6. WebLab — Laboratorio web</h3>
<p>Audita y mejora páginas de la tienda completas: homepage, páginas de colección, checkout. Genera recomendaciones de UX y conversión basadas en benchmarks del sector.</p>

<h3>7. Fusion Studio — Composición creativa</h3>
<p>Editor multi-capa para crear composiciones de producto complejas: combinaciones de imágenes, fondos, textos y efectos. Ideal para creatividades de campaña y banners.</p>

<h3>8. Fusion Studio Pro — Composición avanzada</h3>
<p>Versión avanzada de Fusion Studio con canvas interactivo, capas ilimitadas y export en alta resolución. Para agencias y tiendas con producción creativa intensiva.</p>

<h3>9. Ad Studio — Anuncios</h3>
<p>Genera creatividades y copy para Meta Ads, Google Ads y TikTok Ads. Incluye variantes por audiencia, formatos según plataforma y análisis de competencia de anuncios.</p>

<h3>10. Campaign Kit — Planificación de campañas</h3>
<p>Planifica campañas completas de marketing: calendario de contenido, secuencias de email, estrategia de redes sociales y presupuesto recomendado por canal.</p>

<h3>11. Emails — Email marketing</h3>
<p>Genera secuencias de email automatizadas: bienvenida, abandono de carrito, post-compra, recuperación de clientes inactivos. Con personalización por segmento de cliente.</p>

<h3>12. CMS Editor — Gestión de contenido</h3>
<p>Edita directamente el contenido de la tienda (Shopify o WooCommerce) desde Shopy Crafter: títulos, descripciones, páginas, colecciones. Los cambios se sincronizan en tiempo real.</p>

<h3>13. OmniChatbot — Asistente IA</h3>
<p>Chatbot para la tienda del cliente que responde preguntas sobre productos, tallas, disponibilidad y envíos. Aprende del catálogo automáticamente y se entrena con las FAQs de la tienda.</p>

<h3>14. Knowledge Graph — Grafo de conocimiento</h3>
<p>Construye una representación semántica de la tienda: relaciones entre productos, categorías, materiales, audiencias y competidores. Usado internamente por el resto de motores para contexto.</p>

<h3>15. Exploded View — Vista despiece</h3>
<p>Genera imágenes de vista despiece (exploded view) para productos técnicos o de múltiples componentes. Especialmente útil para electrónica, muebles, deportes y automoción.</p>

<h3>16. Glass Card — Visualización premium</h3>
<p>Genera cards de producto con efectos visuales de cristal, gradientes y composiciones premium para uso en redes sociales, stories y anuncios de alto impacto visual.</p>

<h3>17. ShopyBrain — Memoria de IA</h3>
<p>El motor central que acumula aprendizaje continuo de todos los proyectos: insights de A/B tests, patrones de conversión, conocimiento de nicho. Alimenta al resto de motores con contexto acumulado de más de 46.000 insights.</p>
    `.trim()}];export{e as P};
