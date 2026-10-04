export interface ComparisonPage {
  path: string;
  canonical: string;
  metaTitle: string;
  metaDescription: string;
  badge: string;
  tag: string;
  h1: string;
  subtitle: string;
  body: string;
  schema?: Record<string, unknown>;
}

const COMPARISON_PAGES: ComparisonPage[] = [
  {
    path: "/shopify-vs-woocommerce",
    canonical: "https://shopycrafter.com/shopify-vs-woocommerce",
    metaTitle: "Shopify vs WooCommerce 2026: Comparativa completa — Shopy Crafter",
    metaDescription: "¿Shopify o WooCommerce? Comparamos costes reales, SEO, facilidad de uso, escalabilidad y capacidad de automatización con IA. Con tabla de decisión por tipo de negocio.",
    badge: "Comparativa 2026",
    tag: "Shopify vs WooCommerce",
    h1: "Shopify vs WooCommerce: ¿cuál elegir en 2026?",
    subtitle: "Comparamos las dos plataformas líderes en 12 criterios reales: coste total, SEO, escalabilidad y automatización con IA. Sin sesgos, con datos.",
    body: `
<h2>Resumen ejecutivo</h2>
<p>Para la mayoría de tiendas online en 2026, Shopify gana en facilidad, mantenimiento y capacidad de automatización con IA. WooCommerce sigue siendo la mejor opción para empresas con equipo técnico PHP dedicado y requisitos de customización extrema. A continuación, la comparativa detallada.</p>

<h2>Comparativa en los 7 criterios clave</h2>

<div style="overflow-x:auto;margin:32px 0">
<table style="width:100%;border-collapse:collapse;font-size:14px">
<thead>
<tr style="background:rgba(200,168,75,0.1);border-bottom:2px solid rgba(200,168,75,0.3)">
<th style="padding:12px 16px;text-align:left;color:#e6c668;font-weight:700">Criterio</th>
<th style="padding:12px 16px;text-align:center;color:#e6c668;font-weight:700">Shopify</th>
<th style="padding:12px 16px;text-align:center;color:#e6c668;font-weight:700">WooCommerce</th>
</tr>
</thead>
<tbody>
<tr style="border-bottom:1px solid rgba(255,255,255,0.06)">
<td style="padding:12px 16px;color:rgba(255,255,255,0.8)">Facilidad de uso</td>
<td style="padding:12px 16px;text-align:center;color:#2dd49f">★★★★★ Sin conocimientos técnicos</td>
<td style="padding:12px 16px;text-align:center;color:rgba(255,255,255,0.5)">★★★☆☆ Requiere WordPress + PHP</td>
</tr>
<tr style="border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02)">
<td style="padding:12px 16px;color:rgba(255,255,255,0.8)">Coste mensual real (tienda media)</td>
<td style="padding:12px 16px;text-align:center;color:#2dd49f">29-299 €/mes todo incluido</td>
<td style="padding:12px 16px;text-align:center;color:rgba(255,255,255,0.5)">60-300 €/mes (hosting + plugins + mant.)</td>
</tr>
<tr style="border-bottom:1px solid rgba(255,255,255,0.06)">
<td style="padding:12px 16px;color:rgba(255,255,255,0.8)">SEO técnico</td>
<td style="padding:12px 16px;text-align:center;color:#2dd49f">★★★★☆ Excelente de fábrica</td>
<td style="padding:12px 16px;text-align:center;color:#2dd49f">★★★★★ Control total del servidor</td>
</tr>
<tr style="border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02)">
<td style="padding:12px 16px;color:rgba(255,255,255,0.8)">Escalabilidad</td>
<td style="padding:12px 16px;text-align:center;color:#2dd49f">★★★★★ Sin límites técnicos</td>
<td style="padding:12px 16px;text-align:center;color:rgba(255,255,255,0.5)">★★★☆☆ Requiere inversión técnica</td>
</tr>
<tr style="border-bottom:1px solid rgba(255,255,255,0.06)">
<td style="padding:12px 16px;color:rgba(255,255,255,0.8)">Apps / plugins</td>
<td style="padding:12px 16px;text-align:center;color:#2dd49f">8.000+ apps verificadas</td>
<td style="padding:12px 16px;text-align:center;color:rgba(255,255,255,0.5)">55.000+ plugins (calidad variable)</td>
</tr>
<tr style="border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02)">
<td style="padding:12px 16px;color:rgba(255,255,255,0.8)">Automatización con IA</td>
<td style="padding:12px 16px;text-align:center;color:#2dd49f">★★★★★ API moderna + webhooks</td>
<td style="padding:12px 16px;text-align:center;color:rgba(255,255,255,0.5)">★★★☆☆ API limitada, desarrollo propio</td>
</tr>
<tr>
<td style="padding:12px 16px;color:rgba(255,255,255,0.8)">Mantenimiento técnico</td>
<td style="padding:12px 16px;text-align:center;color:#2dd49f">★★★★★ Gestionado por Shopify</td>
<td style="padding:12px 16px;text-align:center;color:rgba(255,255,255,0.5)">★★☆☆☆ Actualizaciones manuales constantes</td>
</tr>
</tbody>
</table>
</div>

<h2>Coste total de propiedad: la sorpresa de WooCommerce</h2>
<p>WooCommerce es "gratis" como plugin, pero el coste real incluye: hosting WordPress de calidad (15-60 €/mes), plugins premium imprescindibles (300-800 €/año), SSL/CDN/backups (100-200 €/año), y mantenimiento técnico (si lo subcontratas: 800-2.500 €/año). El TCO real de WooCommerce para una tienda media es de 1.500-4.000 €/año vs 350-1.000 €/año de Shopify.</p>

<h2>La diferencia decisiva en 2026: automatización con IA</h2>
<p>La API de Shopify (REST + GraphQL + webhooks en tiempo real) permite automatización profunda que WooCommerce no puede igualar sin desarrollo a medida costoso. Herramientas como Shopy Crafter usan webhooks de Shopify para activar automáticamente la generación de imágenes IA, optimización SEO y tests A/B cada vez que se añade un nuevo producto. En WooCommerce, implementar algo similar requeriría un equipo de desarrollo dedicado.</p>

<h2>¿Cuándo elegir cada una?</h2>
<p><strong>Elige Shopify si:</strong> quieres lanzar rápido, no tienes equipo técnico, planeas usar automatización IA, o quieres escalar sin sorpresas técnicas.</p>
<p><strong>Elige WooCommerce si:</strong> tienes equipo PHP interno, ya tienes un WordPress consolidado con mucho contenido, o necesitas customización extrema que el ecosistema Shopify no permite.</p>

<h2>¿Estás en WooCommerce y consideras migrar?</h2>
<p>La migración de WooCommerce a Shopify, bien planificada, no solo es posible — puede dejarte con una tienda mejor optimizada que la original. Con Shopy Crafter, puedes aprovechar el cambio de plataforma para optimizar automáticamente todo el catálogo (imágenes IA, SEO técnico, pricing) en las primeras 48 horas.</p>
    `.trim(),
  },
  {
    path: "/shopify-vs-prestashop",
    canonical: "https://shopycrafter.com/shopify-vs-prestashop",
    metaTitle: "Shopify vs PrestaShop 2026: Comparativa para el mercado español — Shopy Crafter",
    metaDescription: "PrestaShop tiene gran implantación en España. Shopify ha crecido masivamente. Comparamos ambas plataformas en costes reales, SEO, integraciones y automatización IA para el mercado español.",
    badge: "Comparativa 2026",
    tag: "Shopify vs PrestaShop",
    h1: "Shopify vs PrestaShop: la comparativa para el mercado español 2026",
    subtitle: "PrestaShop es la plataforma eCommerce más usada en España. Shopify crece a doble dígito. ¿Cuál conviene más para tu tienda en 2026?",
    body: `
<h2>El contexto español: PrestaShop vs Shopify</h2>
<p>PrestaShop nació en Francia en 2007 y tiene una penetración muy alta en España y Europa. Shopify ha acelerado su expansión española en 2024-2026 con soporte completo en español, Shopify Payments en EUR y un ecosistema de agencias locales creciente. La pregunta es legítima: para una tienda en España, ¿cuál es mejor?</p>

<div style="overflow-x:auto;margin:32px 0">
<table style="width:100%;border-collapse:collapse;font-size:14px">
<thead>
<tr style="background:rgba(200,168,75,0.1);border-bottom:2px solid rgba(200,168,75,0.3)">
<th style="padding:12px 16px;text-align:left;color:#e6c668;font-weight:700">Criterio</th>
<th style="padding:12px 16px;text-align:center;color:#e6c668;font-weight:700">Shopify</th>
<th style="padding:12px 16px;text-align:center;color:#e6c668;font-weight:700">PrestaShop</th>
</tr>
</thead>
<tbody>
<tr style="border-bottom:1px solid rgba(255,255,255,0.06)">
<td style="padding:12px 16px;color:rgba(255,255,255,0.8)">Modelo de negocio</td>
<td style="padding:12px 16px;text-align:center;color:#2dd49f">SaaS todo incluido</td>
<td style="padding:12px 16px;text-align:center;color:rgba(255,255,255,0.5)">Open source (hosting propio)</td>
</tr>
<tr style="border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02)">
<td style="padding:12px 16px;color:rgba(255,255,255,0.8)">Coste mensual real</td>
<td style="padding:12px 16px;text-align:center;color:#2dd49f">29-299 €/mes</td>
<td style="padding:12px 16px;text-align:center;color:rgba(255,255,255,0.5)">50-250 €/mes (hosting + módulos)</td>
</tr>
<tr style="border-bottom:1px solid rgba(255,255,255,0.06)">
<td style="padding:12px 16px;color:rgba(255,255,255,0.8)">Curva de aprendizaje</td>
<td style="padding:12px 16px;text-align:center;color:#2dd49f">Baja — intuitu y visual</td>
<td style="padding:12px 16px;text-align:center;color:rgba(255,255,255,0.5)">Media-alta — back-office complejo</td>
</tr>
<tr style="border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02)">
<td style="padding:12px 16px;color:rgba(255,255,255,0.8)">SEO técnico</td>
<td style="padding:12px 16px;text-align:center;color:#2dd49f">★★★★☆ Muy bueno de fábrica</td>
<td style="padding:12px 16px;text-align:center;color:rgba(255,255,255,0.5)">★★★★☆ Bueno con módulos</td>
</tr>
<tr style="border-bottom:1px solid rgba(255,255,255,0.06)">
<td style="padding:12px 16px;color:rgba(255,255,255,0.8)">Stripe / pagos</td>
<td style="padding:12px 16px;text-align:center;color:#2dd49f">Integración nativa</td>
<td style="padding:12px 16px;text-align:center;color:rgba(255,255,255,0.5)">Módulo oficial de Stripe (de pago)</td>
</tr>
<tr style="border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02)">
<td style="padding:12px 16px;color:rgba(255,255,255,0.8)">Automatización IA</td>
<td style="padding:12px 16px;text-align:center;color:#2dd49f">★★★★★ Ecosistema IA maduro</td>
<td style="padding:12px 16px;text-align:center;color:rgba(255,255,255,0.5)">★★☆☆☆ API limitada</td>
</tr>
<tr>
<td style="padding:12px 16px;color:rgba(255,255,255,0.8)">Soporte 24/7</td>
<td style="padding:12px 16px;text-align:center;color:#2dd49f">Chat y email oficial</td>
<td style="padding:12px 16px;text-align:center;color:rgba(255,255,255,0.5)">Comunidad + partners (coste)</td>
</tr>
</tbody>
</table>
</div>

<h2>Pagos en España: Stripe y Bizum</h2>
<p>Ambas plataformas soportan Stripe. En Shopify, la integración es nativa y permite activar Bizum (vía Stripe), Apple Pay y Google Pay en minutos. En PrestaShop, necesitas el módulo oficial de Stripe (módulo de pago, ~79€ + actualización anual) y la configuración es más técnica. Para el mercado español donde Bizum representa el 35%+ de los pagos online, la facilidad de integración de Shopify es una ventaja real.</p>

<h2>SEO: ¿cuál posiciona mejor?</h2>
<p>En teoría, PrestaShop tiene más control técnico (acceso al servidor, customización total de URLs). En la práctica, muchas instalaciones de PrestaShop tienen problemas históricos: URLs duplicadas en categorías, paginación mal configurada, y caídas de Core Web Vitals por hosting subóptimo. Shopify tiene Core Web Vitals optimizados de fábrica y CDN global incluido. Con herramientas como Shopy Crafter, el SEO de Shopify puede automatizarse completamente.</p>

<h2>La ventaja de Shopify en 2026: el ecosistema IA</h2>
<p>La API de Shopify es moderna, bien documentada y soporta webhooks en tiempo real. PrestaShop tiene una API más antigua (basada en XML, menos intuitiva) que limita las integraciones profundas. Plataformas de automatización como Shopy Crafter solo están disponibles para Shopify precisamente porque la automatización real (detección de nuevos productos, optimización automática, A/B testing) requiere la infraestructura moderna de Shopify.</p>

<h2>Conclusión para el mercado español</h2>
<p>PrestaShop sigue siendo válido para empresas con equipo técnico PHP dedicado y requisitos B2B complejos. Para la mayoría de PYMES y marcas D2C en España en 2026, Shopify ofrece mejor equilibrio entre funcionalidad, mantenimiento cero y capacidad de automatización IA. Si estás valorando migrar de PrestaShop a Shopify, la transición puede realizarse sin perder SEO y aprovecharse para optimizar todo el catálogo desde el primer día.</p>
    `.trim(),
  },
  {
    path: "/migrar-woocommerce-shopify",
    canonical: "https://shopycrafter.com/migrar-woocommerce-shopify",
    metaTitle: "Migrar WooCommerce a Shopify 2026: Guía completa sin perder SEO — Shopy Crafter",
    metaDescription: "Guía paso a paso para migrar de WooCommerce a Shopify en 2026: checklist de migración, redirecciones 301, migración de catálogo y cómo optimizar tu nueva tienda con IA desde el día 1.",
    badge: "Guía de migración",
    tag: "WooCommerce → Shopify",
    h1: "Cómo migrar de WooCommerce a Shopify sin perder SEO ni ventas",
    subtitle: "La guía completa con checklist paso a paso, herramientas recomendadas y cómo aprovechar la migración para salir con una tienda mejor optimizada que la original.",
    body: `
<h2>¿Por qué migrar de WooCommerce a Shopify?</h2>
<p>Las razones más frecuentes: fatiga del mantenimiento técnico de WordPress (actualizaciones constantes, vulnerabilidades de seguridad, caídas por hosting), querer escalar sin preocupaciones de infraestructura, y aprovechar la automatización con IA que la API de Shopify permite de forma nativa. La migración bien planificada no solo es posible — puede dejarte con una tienda mejor.</p>

<h2>Checklist de migración WooCommerce → Shopify</h2>

<h3>✅ Fase 1: Preparación (1 semana antes)</h3>
<ul style="padding-left:24px;color:rgba(255,255,255,0.7);line-height:2">
<li>Exportar inventario completo: productos, variantes, SKUs, precios, imágenes</li>
<li>Exportar base de clientes y pedidos históricos</li>
<li>Documentar todas las URLs actuales (para redirecciones 301)</li>
<li>Contratar plan Shopify adecuado (mínimo Basic)</li>
<li>Elegir y personalizar tema de Shopify</li>
<li>Configurar dominio personalizado en Shopify</li>
</ul>

<h3>✅ Fase 2: Migración del catálogo</h3>
<ul style="padding-left:24px;color:rgba(255,255,255,0.7);line-height:2">
<li>Catálogos pequeños (&lt;100 productos): importar CSV nativo de Shopify</li>
<li>Catálogos medios (100-500): usar Matrixify o LitExtension</li>
<li>Catálogos grandes (&gt;500): Cart2Cart o desarrollo a medida</li>
<li>Verificar variantes, precios de comparación y stock</li>
<li>Importar imágenes de producto (o generar nuevas con IA)</li>
</ul>

<h3>✅ Fase 3: SEO — el paso más crítico</h3>
<ul style="padding-left:24px;color:rgba(255,255,255,0.7);line-height:2">
<li>Configurar redirecciones 301 de todas las URLs de WooCommerce a Shopify</li>
<li>WooCommerce: /producto/slug → Shopify: /products/slug</li>
<li>WooCommerce: /categoria/slug → Shopify: /collections/slug</li>
<li>Verificar redirecciones en Shopify: Settings > URL Redirects</li>
<li>Actualizar sitemap en Google Search Console</li>
<li>Activar optimización IA del catálogo (oportunidad perfecta para partir de cero bien)</li>
</ul>

<h3>✅ Fase 4: Pagos y configuración</h3>
<ul style="padding-left:24px;color:rgba(255,255,255,0.7);line-height:2">
<li>Configurar Shopify Payments o Stripe</li>
<li>Activar Bizum, Apple Pay, Google Pay</li>
<li>Configurar zonas de envío e impuestos</li>
<li>Probar checkout completo en modo test</li>
<li>Configurar emails automáticos (confirmación de pedido, envío, etc.)</li>
</ul>

<h3>✅ Fase 5: Go Live</h3>
<ul style="padding-left:24px;color:rgba(255,255,255,0.7);line-height:2">
<li>Verificar que TODAS las redirecciones 301 funcionan</li>
<li>Comprobar 0 errores 404 críticos</li>
<li>Actualizar sitemap en Google Search Console</li>
<li>Configurar Google Analytics 4 + Google Tag Manager</li>
<li>Monitorizar tráfico orgánico los primeros 30 días</li>
</ul>

<h2>El superpoder oculto de la migración: SEO desde cero con IA</h2>
<p>La mayoría de tiendas WooCommerce llevan años acumulando deuda técnica SEO: títulos sin optimizar, schemas JSON-LD incorrectos, imágenes de baja calidad, descripciones duplicadas. La migración a Shopify es la oportunidad perfecta para empezar con todo optimizado.</p>
<p>Con Shopy Crafter, puedes procesar todo el catálogo en las primeras 48 horas post-migración: generación automática de imágenes profesionales, títulos SEO optimizados para Google Shopping, schemas JSON-LD correctos por producto, y configuración del auto-pilot para que cada nuevo producto salga optimizado desde el primer segundo.</p>

<h2>Errores que debes evitar</h2>
<ul style="padding-left:24px;color:rgba(255,255,255,0.7);line-height:2">
<li><strong>No configurar redirecciones 301:</strong> es el error más costoso. Puedes perder el 50-80% del tráfico orgánico sin ellas.</li>
<li><strong>Copiar el contenido sin mejorar:</strong> si el SEO de WooCommerce era malo, lo seguirá siendo en Shopify.</li>
<li><strong>No probar el checkout antes del go live:</strong> especialmente con Stripe y métodos de pago alternativos.</li>
<li><strong>Lanzar en temporada alta:</strong> planifica la migración en períodos de bajo tráfico.</li>
</ul>
    `.trim(),
  },
  {
    path: "/migrar-prestashop-shopify",
    canonical: "https://shopycrafter.com/migrar-prestashop-shopify",
    metaTitle: "Migrar PrestaShop a Shopify 2026: Guía paso a paso — Shopy Crafter",
    metaDescription: "Cómo migrar de PrestaShop a Shopify manteniendo el SEO y sin perder ventas. Checklist completo, herramientas de migración recomendadas y cómo optimizar tu nueva tienda Shopify con IA.",
    badge: "Guía de migración",
    tag: "PrestaShop → Shopify",
    h1: "Cómo migrar de PrestaShop a Shopify sin perder SEO",
    subtitle: "Guía completa para tiendas PrestaShop que quieren pasarse a Shopify: checklist de migración, gestión de redirecciones, pasarelas de pago y optimización con IA desde el día 1.",
    body: `
<h2>¿Por qué migrar de PrestaShop a Shopify?</h2>
<p>Las razones más habituales que escuchamos de tiendas PrestaShop: mantenimiento técnico cada vez más exigente (actualizaciones de versión complejas, incompatibilidades de módulos), coste creciente de módulos premium, dificultad para adoptar nuevas tecnologías como la automatización con IA, y el deseo de reducir la dependencia de desarrolladores PHP. Shopify resuelve todos estos puntos.</p>

<h2>Las diferencias técnicas que debes conocer</h2>
<p>PrestaShop y Shopify tienen estructuras de datos y URLs muy diferentes. Antes de migrar, es importante entender estas diferencias para planificar bien las redirecciones y la migración de datos.</p>

<h3>Estructura de URLs</h3>
<p>PrestaShop usa: <code>/categoria/nombre-producto.html</code> o <code>/nombre-producto-id.html</code><br>
Shopify usa: <code>/products/nombre-producto</code> y <code>/collections/nombre-coleccion</code><br>
Necesitarás redirecciones 301 para TODAS las URLs de producto y categoría.</p>

<h3>Estructura de datos de producto</h3>
<p>PrestaShop tiene "combinaciones" (lo que Shopify llama "variantes"). La migración de combinaciones complejas (múltiples atributos: talla + color + material) requiere herramientas específicas o desarrollo a medida.</p>

<h2>Herramientas de migración recomendadas</h2>
<ul style="padding-left:24px;color:rgba(255,255,255,0.7);line-height:2">
<li><strong>LitExtension:</strong> La mejor opción para PrestaShop → Shopify. Maneja combinaciones/variantes, imágenes, clientes, pedidos y páginas de contenido.</li>
<li><strong>Cart2Cart:</strong> Alternativa robusta con soporte para catálogos grandes (+5.000 productos).</li>
<li><strong>Matrixify (Excelify):</strong> Más técnico, pero el más flexible para catálogos con atributos complejos.</li>
</ul>

<h2>Checklist de migración PrestaShop → Shopify</h2>

<h3>✅ Preparación</h3>
<ul style="padding-left:24px;color:rgba(255,255,255,0.7);line-height:2">
<li>Exportar todos los productos con combinaciones/variantes, precios, imágenes y stock</li>
<li>Documentar todas las URLs de producto y categoría activas</li>
<li>Exportar base de clientes (datos, historial de pedidos)</li>
<li>Contratar plan Shopify adecuado para el tamaño de tu catálogo</li>
<li>Elegir tema y configurar la tienda base en Shopify</li>
</ul>

<h3>✅ Migración de catálogo</h3>
<ul style="padding-left:24px;color:rgba(255,255,255,0.7);line-height:2">
<li>Usar LitExtension o Cart2Cart para migración automática</li>
<li>Verificar que las variantes se importan correctamente</li>
<li>Verificar precios de coste y comparación</li>
<li>Comprobar imágenes (tamaño, resolución, nombres de fichero)</li>
<li>Migrar páginas de contenido (sobre nosotros, política de envíos, etc.)</li>
</ul>

<h3>✅ SEO — redirecciones 301</h3>
<ul style="padding-left:24px;color:rgba(255,255,255,0.7);line-height:2">
<li>Generar mapa completo de URLs antiguas → URLs nuevas</li>
<li>Importar redirecciones en Shopify (Settings > URL Redirects, importación CSV)</li>
<li>Verificar que Googlebot puede rastrear la nueva estructura</li>
<li>Actualizar sitemap.xml en Google Search Console</li>
<li>Monitorizar errores 404 los primeros 30 días</li>
</ul>

<h3>✅ Pagos y configuración</h3>
<ul style="padding-left:24px;color:rgba(255,255,255,0.7);line-height:2">
<li>Configurar Shopify Payments (EUR nativo) o Stripe</li>
<li>Activar Bizum, Apple Pay, Google Pay</li>
<li>Verificar impuestos IVA (configuración en Shopify Markets)</li>
<li>Probar checkout completo con tarjeta real en modo test</li>
</ul>

<h2>La oportunidad: optimizar todo con IA desde el primer día</h2>
<p>La migración de PrestaShop a Shopify es la oportunidad perfecta para hacer un reset completo del SEO y las imágenes de producto. Muchas tiendas PrestaShop llevan años con fichas de producto que nunca se han optimizado correctamente.</p>
<p>Con Shopy Crafter, en las primeras 48 horas en Shopify puedes tener: imágenes profesionales generadas con IA para todo el catálogo, títulos SEO optimizados para Google Shopping, schemas JSON-LD correctos y el auto-pilot activado para que cada nuevo producto salga optimizado automáticamente.</p>
    `.trim(),
  },
  {
    path: "/shopify-stripe-pagos",
    canonical: "https://shopycrafter.com/shopify-stripe-pagos",
    metaTitle: "Stripe + Shopify: Configuración, comisiones y mejores prácticas 2026 — Shopy Crafter",
    metaDescription: "Todo sobre integrar Stripe en tu tienda Shopify: configuración paso a paso, comisiones reales, comparativa con Shopify Payments, Bizum, Apple Pay y optimización del checkout para España.",
    badge: "Guía de pagos",
    tag: "Stripe + Shopify",
    h1: "Stripe + Shopify: la guía completa de pagos para tiendas españolas",
    subtitle: "Cómo configurar Stripe en tu tienda Shopify, cuánto cuesta realmente, qué métodos de pago activar para el mercado español y cómo reducir el abandono de carrito.",
    body: `
<h2>¿Stripe o Shopify Payments?</h2>
<p>Esta es la primera pregunta que todo comerciante español se hace. La respuesta corta: Shopify Payments si está disponible en tu país y no necesitas features avanzadas de Stripe. Stripe si necesitas: Radar para detección de fraude personalizada, Billing para suscripciones complejas, o integración vía API con sistemas externos.</p>

<div style="overflow-x:auto;margin:32px 0">
<table style="width:100%;border-collapse:collapse;font-size:14px">
<thead>
<tr style="background:rgba(200,168,75,0.1);border-bottom:2px solid rgba(200,168,75,0.3)">
<th style="padding:12px 16px;text-align:left;color:#e6c668;font-weight:700">Concepto</th>
<th style="padding:12px 16px;text-align:center;color:#e6c668;font-weight:700">Shopify Payments</th>
<th style="padding:12px 16px;text-align:center;color:#e6c668;font-weight:700">Stripe directo</th>
</tr>
</thead>
<tbody>
<tr style="border-bottom:1px solid rgba(255,255,255,0.06)">
<td style="padding:12px 16px;color:rgba(255,255,255,0.8)">Comisión Shopify adicional</td>
<td style="padding:12px 16px;text-align:center;color:#2dd49f">0% (eliminada)</td>
<td style="padding:12px 16px;text-align:center;color:rgba(255,255,255,0.5)">0,5-2% según plan</td>
</tr>
<tr style="border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02)">
<td style="padding:12px 16px;color:rgba(255,255,255,0.8)">Comisión tarjeta EU (Visa/MC)</td>
<td style="padding:12px 16px;text-align:center;color:#2dd49f">~1,6% + 0,25€</td>
<td style="padding:12px 16px;text-align:center;color:rgba(255,255,255,0.5)">1,5% + 0,25€</td>
</tr>
<tr style="border-bottom:1px solid rgba(255,255,255,0.06)">
<td style="padding:12px 16px;color:rgba(255,255,255,0.8)">Bizum</td>
<td style="padding:12px 16px;text-align:center;color:#2dd49f">Disponible</td>
<td style="padding:12px 16px;text-align:center;color:#2dd49f">Disponible (vía Stripe)</td>
</tr>
<tr style="border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02)">
<td style="padding:12px 16px;color:rgba(255,255,255,0.8)">Apple Pay / Google Pay</td>
<td style="padding:12px 16px;text-align:center;color:#2dd49f">Incluido</td>
<td style="padding:12px 16px;text-align:center;color:#2dd49f">Incluido</td>
</tr>
<tr style="border-bottom:1px solid rgba(255,255,255,0.06)">
<td style="padding:12px 16px;color:rgba(255,255,255,0.8)">Shop Pay (1-clic)</td>
<td style="padding:12px 16px;text-align:center;color:#2dd49f">Sí (+18% conversión)</td>
<td style="padding:12px 16px;text-align:center;color:rgba(255,255,255,0.5)">No disponible</td>
</tr>
<tr style="border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02)">
<td style="padding:12px 16px;color:rgba(255,255,255,0.8)">Suscripciones / pagos recurrentes</td>
<td style="padding:12px 16px;text-align:center;color:rgba(255,255,255,0.5)">Vía app de suscripciones</td>
<td style="padding:12px 16px;text-align:center;color:#2dd49f">Stripe Billing nativo</td>
</tr>
<tr>
<td style="padding:12px 16px;color:rgba(255,255,255,0.8)">Dashboard de analytics</td>
<td style="padding:12px 16px;text-align:center;color:#2dd49f">Integrado en Shopify</td>
<td style="padding:12px 16px;text-align:center;color:#2dd49f">Dashboard Stripe separado</td>
</tr>
</tbody>
</table>
</div>

<h2>Cómo configurar Stripe en Shopify: paso a paso</h2>

<h3>Paso 1: Crear y verificar tu cuenta Stripe</h3>
<p>Ve a stripe.com/es y crea una cuenta de empresa o autónomo. Necesitas: CIF/NIF, cuenta bancaria en EUR, y documentación de identidad. La verificación KYC tarda 1-3 días hábiles. Hasta que se verifica, puedes usar Stripe en modo test.</p>

<h3>Paso 2: Conectar Stripe con Shopify</h3>
<p>En tu Shopify: Configuración > Pagos > Proveedores externos > Stripe. Haz clic en "Conectar con Stripe" — esto usa OAuth y no requiere copiar API keys manualmente. Una vez conectado, verás el botón verde de "Activo".</p>

<h3>Paso 3: Activar métodos de pago para España</h3>
<p>En el panel de Stripe, activa: Tarjetas (Visa, Mastercard, Amex), Bizum, Apple Pay, Google Pay, y opcionalmente Klarna o Afterpay para compras a plazos. En Shopify, ve a Pagos > Accelerated checkouts para activar Shop Pay, Apple Pay y Google Pay en el botón de checkout rápido.</p>

<h3>Paso 4: Configurar detección de fraude</h3>
<p>Stripe Radar está incluido y activo por defecto. Revisa las reglas en el panel de Stripe para asegurarte de que no bloquea pagos legítimos de tarjetas españolas. El ajuste más común: reducir el umbral de bloqueo de tarjetas con dirección de facturación diferente al envío (habitual en regalos).</p>

<h2>Reducir el abandono de carrito con Stripe en Shopify</h2>
<ul style="padding-left:24px;color:rgba(255,255,255,0.7);line-height:2">
<li><strong>Shop Pay:</strong> +18% de conversión media en mobile. Actívalo si usas Shopify Payments.</li>
<li><strong>Apple Pay / Google Pay:</strong> En mobile, eliminar la introducción de datos de tarjeta aumenta la conversión un 12-20%.</li>
<li><strong>Bizum:</strong> Imprescindible en España. Representa hasta el 35% de los pagos en algunas tiendas.</li>
<li><strong>Preautorización de tarjeta:</strong> Para productos de alta demanda, activa la captura diferida para reservar stock sin cobrar hasta el envío.</li>
</ul>

<h2>Stripe + Shopy Crafter: pricing inteligente compatible</h2>
<p>El motor de pricing de Shopy Crafter calcula el precio óptimo de cada producto basándose en el COGS real (incluyendo las comisiones de Stripe y Shopify Payments) y los precios de competencia. El resultado: precios que maximizan la conversión sin sacrificar margen. Totalmente compatible con cualquier configuración de Stripe — el motor trabaja sobre los datos de producto, no interfiere con la pasarela de pago.</p>
    `.trim(),
  },
  {
    path: "/agencia-shopify-ia",
    canonical: "https://shopycrafter.com/agencia-shopify-ia",
    metaTitle: "Shopy Crafter para Agencias Shopify: Gestiona múltiples tiendas con IA — Shopy Crafter",
    metaDescription: "Solución para agencias que gestionan múltiples tiendas Shopify. Automatiza imágenes IA, SEO técnico y A/B testing para todos tus clientes desde un único panel centralizado.",
    badge: "Para agencias",
    tag: "Agencias Shopify",
    h1: "Shopy Crafter para agencias: gestiona múltiples tiendas Shopify con IA",
    subtitle: "La plataforma IA que las agencias usan para entregar mejores resultados en menos tiempo. Catálogos ilimitados, optimización en masa y reporting automático para tus clientes.",
    body: `
<h2>El reto de las agencias Shopify en 2026</h2>
<p>Las agencias digitales que gestionan tiendas Shopify se enfrentan a un reto creciente: los clientes exigen más resultados con los mismos presupuestos, la competencia ha aumentado, y las tareas de optimización (imágenes, SEO, pricing, tests A/B) consumen una cantidad desproporcionada de tiempo humano. Shopy Crafter resuelve este problema poniendo en piloto automático las tareas más repetitivas y escalables.</p>

<h2>¿Qué hace Shopy Crafter diferente para agencias?</h2>

<h3>Panel centralizado multi-tienda</h3>
<p>Desde un único panel, gestiona todos tus clientes Shopify: audita el estado de cada catálogo, lanza optimizaciones en masa, monitoriza el rendimiento de tests A/B y descarga informes de resultados para cada cliente. Sin cambiar de cuenta ni de contraseña.</p>

<h3>Optimización en masa de catálogos</h3>
<p>El motor de Shopy Crafter puede procesar catálogos completos en paralelo. Para una agencia con 10 clientes y 200 productos cada uno: genera 2.000 imágenes IA, optimiza 2.000 títulos SEO e implementa 2.000 schemas JSON-LD en menos de 48 horas. Lo que antes requería semanas de trabajo manual.</p>

<h3>White label y branding de agencia</h3>
<p>Los informes de optimización pueden llevar el logo y branding de tu agencia. Los clientes reciben los resultados como si fueran generados por tu equipo, con la calidad y profundidad que Shopy Crafter garantiza automáticamente.</p>

<h2>Los 6 motores IA que más valor aportan a agencias</h2>

<h3>1. Imágenes IA en masa</h3>
<p>Genera imágenes de producto profesionales para todos los productos de todos tus clientes a €0,25/producto. Fondo blanco para Google Shopping, lifestyle shots por nicho, múltiples ángulos. La calidad es consistente porque usa flux-1.1-pro con el Visual DNA de cada marca.</p>

<h3>2. SEO técnico automatizado</h3>
<p>Schemas JSON-LD correctos, meta titles/descriptions optimizados, análisis de Core Web Vitals y generación de contenido para páginas de colección — para todo el catálogo de cada cliente, sin intervención manual.</p>

<h3>3. A/B Testing estadístico</h3>
<p>Tests de imagen, precio y descripción con auto-winner al 95% de confianza. Los resultados llegan como informe mensual por cliente: qué variante ganó, cuánto mejoró la conversión, y los próximos tests recomendados.</p>

<h3>4. Pricing con márgenes reales</h3>
<p>El motor de COGS calcula el coste real de cada producto (incluyendo Stripe, Shopify Payments, logística y packaging) y propone el precio óptimo. Para agencias que tienen acceso a los datos financieros del cliente, esto genera insights de márgenes que antes requerirían un análisis manual de horas.</p>

<h3>5. Análisis de competencia</h3>
<p>El motor de análisis de competencia usa Gemini Search para monitorizar precios, posicionamiento y estrategia de contenido de los competidores de cada cliente. Informes semanales automáticos sin trabajo manual adicional.</p>

<h3>6. Informes mensuales automáticos</h3>
<p>El plan Agency Pro incluye 3 informes mensuales por cliente con: resumen de optimizaciones aplicadas, resultados de A/B tests, métricas de SEO orgánico, y recomendaciones prioritarias para el mes siguiente. Listos para enviar al cliente sin edición.</p>

<h2>ROI para la agencia</h2>
<p>Una agencia típica gestiona 8-15 clientes Shopify. Sin Shopy Crafter, la optimización de catálogos (imágenes, SEO, pricing) consume 40-60 horas/mes de trabajo humano. Con Shopy Crafter, ese trabajo se reduce a 4-6 horas de supervisión. La diferencia: 35-55 horas/mes recuperadas para trabajo de mayor valor (estrategia, nuevos clientes, desarrollo creativo).</p>
<p>Al precio del plan Agency Pro (149 €/mes), el coste por hora recuperada es de 2,7-4,3 €/hora. Cualquier agencia que facture más de 30 €/hora tiene un ROI positivo inmediato.</p>

<h2>Casos de uso típicos en agencias</h2>
<ul style="padding-left:24px;color:rgba(255,255,255,0.7);line-height:2">
<li><strong>Onboarding de nuevo cliente:</strong> Auditoría completa del catálogo + plan de optimización en 24h, en lugar de 1 semana de análisis manual.</li>
<li><strong>Reporting mensual:</strong> Informes automáticos con métricas reales para cada cliente, en lugar de compilar datos manualmente de 6 fuentes diferentes.</li>
<li><strong>Lanzamiento de nuevos productos:</strong> Auto-pilot activo garantiza que cada nuevo producto del cliente sale optimizado sin que la agencia tenga que hacer nada.</li>
<li><strong>Mejora de conversión:</strong> A/B testing estadístico continuo sin configuración manual para cada test.</li>
</ul>
    `.trim(),
  },
  {
    path: "/ecommerce-ia-automatizacion",
    canonical: "https://shopycrafter.com/ecommerce-ia-automatizacion",
    metaTitle: "eCommerce con IA 2026: Automatización completa para tiendas Shopify — Shopy Crafter",
    metaDescription: "Cómo la IA está transformando el eCommerce en 2026: automatización de imágenes, SEO, pricing y A/B testing para tiendas Shopify. Los resultados reales y cómo empezar.",
    badge: "eCommerce IA 2026",
    tag: "eCommerce + IA",
    h1: "eCommerce con inteligencia artificial: la automatización que cambia las reglas",
    subtitle: "En 2026, las tiendas online que crecen más rápido no son las que trabajan más — son las que han automatizado más con IA. Así funciona la revolución del eCommerce inteligente.",
    body: `
<h2>El eCommerce ha cambiado más en 2025-2026 que en los 10 años anteriores</h2>
<p>La adopción masiva de modelos de IA generativa (Claude, Gemini, GPT-4) y de visión artificial (flux, Midjourney) ha creado una brecha creciente entre las tiendas que automatizan y las que no. Las primeras crecen con la mitad del equipo y el doble de velocidad. Las segundas pierden competitividad cada trimestre que pasa.</p>

<h2>Las 5 áreas donde la IA ya ha superado al trabajo manual</h2>

<h3>1. Generación de imágenes de producto</h3>
<p>Hasta 2024, una sesión de fotos profesional para un producto costaba 150-400€ y tardaba 1-2 semanas (incluida edición). En 2026, la IA genera imágenes de calidad profesional en 90 segundos a ~0,25€/imagen. La calidad visual es comparable en el 80% de los casos. Para catálogos de 100+ productos, el ahorro es de decenas de miles de euros anuales.</p>

<h3>2. SEO técnico de catálogo</h3>
<p>Optimizar manualmente los títulos, meta descriptions, schemas y descripciones de 500 productos puede llevar semanas de trabajo. Un motor de IA como el de Shopy Crafter procesa 500 productos en 2-3 horas con resultados más consistentes que los humanos (no se cansa, no omite campos, sigue siempre la misma estructura óptima).</p>

<h3>3. Fijación de precios inteligente</h3>
<p>Muchas tiendas fijan precios una vez y no vuelven a tocarlos. Con IA, el pricing se apoya en datos: coste real de cada producto (COGS con comisiones, envío y embalaje), precios de la competencia y tests A/B de precio. Así cada cambio de precio se decide sabiendo el margen que deja.</p>

<h3>4. Tests A/B estadísticos</h3>
<p>El A/B testing tradicional requería: configuración técnica, esperar semanas para resultados estadísticos, interpretación manual y aplicación manual del ganador. En 2026, el A/B testing con IA es completamente automático: se configura solo, declara ganador al llegar al 95% de confianza, y aplica el cambio automáticamente. El tiempo de ciclo pasa de semanas a días.</p>

<h3>5. Análisis de competencia</h3>
<p>Monitorizar precios y estrategias de 10-20 competidores manualmente requería horas semanales. Gemini Search analiza el panorama competitivo de cualquier nicho en minutos y genera un informe accionable automáticamente. Las tiendas con monitorización de competencia en tiempo real reaccionan más rápido a cambios de mercado.</p>

<h2>El stack IA de una tienda Shopify en 2026</h2>
<p>Las tiendas más avanzadas usan en 2026 una combinación de:</p>
<ul style="padding-left:24px;color:rgba(255,255,255,0.7);line-height:2">
<li><strong>Shopify</strong> como plataforma base (API moderna, webhooks en tiempo real)</li>
<li><strong>Shopy Crafter</strong> para optimización de catálogo (imágenes, SEO, pricing, A/B testing)</li>
<li><strong>Stripe o Shopify Payments</strong> para pagos optimizados</li>
<li><strong>Klaviyo</strong> para email marketing con segmentación IA</li>
<li><strong>Google Analytics 4 + Looker Studio</strong> para análisis de datos</li>
</ul>

<h2>¿Cuánto se puede automatizar realmente?</h2>
<p>Tanto como quieras: los cambios pueden aplicarse solos o pasar antes por el panel de aprobaciones del cliente. Lo habitual es empezar revisando cada propuesta y automatizar lo que ya se ha comprobado.</p>
<p>Las tareas que siguen requiriendo intervención humana: estrategia de colecciones y categorías, fotografías de producto para lanzamientos premium, atención al cliente, y decisiones estratégicas de pricing en momentos críticos (rebajas, Black Friday).</p>

<h2>Por qué Shopify es la plataforma IA-first en 2026</h2>
<p>La elección de plataforma determina cuánto puedes automatizar. Shopify tiene la API más moderna y el ecosistema de herramientas IA más rico. La diferencia con WooCommerce o PrestaShop no es solo de features: es de arquitectura. Los webhooks en tiempo real de Shopify permiten que la automatización sea instantánea; en plataformas alternativas, habría que desarrollar esta infraestructura desde cero. Aun así, Shopy Crafter también se conecta de forma nativa a WooCommerce (REST API v3) y PrestaShop (Webservice), con auditoría, SEO, imágenes, pricing, pedidos e inventario.</p>

<h2>Cómo empezar con IA en tu tienda Shopify</h2>
<p>El camino más sencillo: conecta tu tienda Shopify a Shopy Crafter (requiere solo el Access Token de Shopify, no código ni instalaciones), lanza una auditoría completa del catálogo (gratuita), y activa los motores que más valor aportan para tu nicho. En 48 horas, tu catálogo estará optimizado con IA y el auto-pilot activado para todos los productos futuros.</p>
    `.trim(),
  },
  {
    path: "/automatizacion-shopify-ia",
    canonical: "https://shopycrafter.com/automatizacion-shopify-ia",
    metaTitle: "Automatización de tiendas Shopify con IA — Shopy Crafter",
    metaDescription: "Automatiza tu tienda Shopify con IA: auditoría de catálogo, SEO de fichas, imágenes de producto, pricing con COGS real, A/B testing, inventario y pedidos. Conexión nativa con la API de Shopify.",
    badge: "Shopify + IA",
    tag: "Shopify",
    h1: "Automatización de tiendas Shopify con inteligencia artificial",
    subtitle: "Conectamos tu tienda Shopify por API y ponemos a trabajar la IA sobre tu catálogo, tus precios y tus pedidos, con aprobación previa de cada cambio si así lo quieres.",
    body: `
<h2>Qué automatizamos en Shopify</h2>
<p>Shopy Crafter se conecta a tu tienda con la API oficial de Shopify (app con Client ID y Client Secret, o token de acceso) y trabaja directamente sobre tus datos reales:</p>
<ul style="padding-left:24px;color:rgba(255,255,255,0.7);line-height:2">
<li><strong>Auditoría de catálogo:</strong> puntuación por producto de título, descripción, SEO, imágenes y precio, con la lista de problemas concretos de cada ficha.</li>
<li><strong>Rediseño de fichas con IA:</strong> nuevos títulos, descripciones, etiquetas, meta title y meta description, listos para aplicar en Shopify.</li>
<li><strong>Imágenes de producto con IA:</strong> fondos limpios, lifestyle y variantes, con consistencia visual de marca (Visual DNA).</li>
<li><strong>SEO técnico:</strong> datos estructurados, textos alternativos y análisis de rendimiento por producto.</li>
<li><strong>Pricing con COGS real:</strong> coste por producto con comisiones, envío y embalaje; márgenes y precio recomendado; simulador de escenarios.</li>
<li><strong>A/B testing:</strong> tests de imagen y de precio con decisión estadística.</li>
<li><strong>Colecciones, temas, inventario y pedidos:</strong> gestión desde el mismo panel.</li>
</ul>

<h2>Datos reales, no estimaciones</h2>
<p>La plataforma registra cada día los ingresos y pedidos de tu tienda (día cerrado, sin contar cancelados ni reembolsos) y recibe los webhooks de Shopify de pedidos pagados, cancelados y reembolsos. Con eso ves la evolución real de tu negocio junto a cada cambio que aplicamos.</p>

<h2>Tú decides qué se publica</h2>
<p>Cada propuesta puede pasar por el panel de aprobaciones de tu portal de cliente: la ves, la apruebas o la rechazas, y solo entonces se aplica. En el mismo portal tienes mensajes directos con tu gestor, informes y todos los archivos de tu proyecto, aislados del resto de clientes.</p>

<h2>¿Tienes WooCommerce o PrestaShop?</h2>
<p>La misma plataforma trabaja también con <a href="/automatizacion-woocommerce-ia" style="color:#e6c668">WooCommerce</a> y <a href="/automatizacion-prestashop-ia" style="color:#e6c668">PrestaShop</a>, y gestiona pagos con <a href="/gestion-stripe-ia" style="color:#e6c668">Stripe</a>.</p>
    `.trim(),
  },
  {
    path: "/automatizacion-woocommerce-ia",
    canonical: "https://shopycrafter.com/automatizacion-woocommerce-ia",
    metaTitle: "Automatización WooCommerce con IA: SEO, pedidos e inventario — Shopy Crafter",
    metaDescription: "Conecta tu WooCommerce por REST API y automatiza con IA la auditoría de productos, el SEO, las imágenes, los precios, pedidos, clientes, cupones e inventario. Sin plugins pesados.",
    badge: "WooCommerce + IA",
    tag: "WooCommerce",
    h1: "Automatización de tiendas WooCommerce con inteligencia artificial",
    subtitle: "Optimiza tu tienda WooCommerce sin migrar de plataforma: conexión directa por REST API v3 y la IA trabajando sobre tu catálogo real.",
    body: `
<h2>Conexión directa con la REST API de WooCommerce</h2>
<p>Solo necesitamos una Consumer Key (ck_) y un Consumer Secret (cs_) de tu WooCommerce. Sin instalar plugins adicionales en tu WordPress: la plataforma lee y escribe a través de la API oficial.</p>

<h2>Qué gestionamos en WooCommerce</h2>
<ul style="padding-left:24px;color:rgba(255,255,255,0.7);line-height:2">
<li><strong>Productos:</strong> auditoría por ficha, rediseño de títulos y descripciones con IA, edición y precios.</li>
<li><strong>Pedidos y clientes:</strong> listado, estado y datos de cliente para entender quién compra.</li>
<li><strong>Cupones:</strong> consulta de los cupones activos y sus condiciones.</li>
<li><strong>Inventario:</strong> stock por producto y variante, con alertas de rotura.</li>
<li><strong>Informes de ventas:</strong> ingresos y pedidos por periodo.</li>
<li><strong>Imágenes, SEO y pricing con IA:</strong> imágenes de producto generadas con IA, textos SEO de cada ficha y precio con COGS real. El A/B testing automático está disponible solo para Shopify.</li>
</ul>

<h2>Ingresos contados una sola vez</h2>
<p>Los webhooks de pedidos de WooCommerce alimentan tus métricas diarias: cada pedido cuenta una sola vez y se descuenta si se cancela, se reembolsa o se elimina. Así tus informes cuadran con tu contabilidad.</p>

<h2>WooCommerce o Shopify</h2>
<p>No hace falta cambiar de plataforma para usar IA. Si aun así estás valorando el cambio, lee nuestra <a href="/shopify-vs-woocommerce" style="color:#e6c668">comparativa Shopify vs WooCommerce</a> y la <a href="/migrar-woocommerce-shopify" style="color:#e6c668">guía de migración</a>.</p>
    `.trim(),
  },
  {
    path: "/automatizacion-prestashop-ia",
    canonical: "https://shopycrafter.com/automatizacion-prestashop-ia",
    metaTitle: "Automatización PrestaShop con IA: SEO, catálogo y pedidos — Shopy Crafter",
    metaDescription: "Conecta PrestaShop por Webservice y automatiza con IA el SEO de productos, categorías, imágenes, precios, pedidos e inventario. Para tiendas PrestaShop en España y Latinoamérica.",
    badge: "PrestaShop + IA",
    tag: "PrestaShop",
    h1: "Automatización de tiendas PrestaShop con inteligencia artificial",
    subtitle: "Tu PrestaShop, optimizado con IA a través del Webservice oficial: catálogo, SEO, categorías, pedidos e inventario desde un único panel.",
    body: `
<h2>Conexión por el Webservice de PrestaShop</h2>
<p>Basta con una clave del Webservice de PrestaShop (32 caracteres) con los permisos adecuados. La plataforma trabaja con la API oficial, sin módulos de terceros.</p>

<h2>Qué gestionamos en PrestaShop</h2>
<ul style="padding-left:24px;color:rgba(255,255,255,0.7);line-height:2">
<li><strong>Productos:</strong> auditoría de fichas, rediseño con IA y edición.</li>
<li><strong>SEO por producto:</strong> meta título y meta descripción escritos directamente en tu tienda.</li>
<li><strong>Categorías:</strong> estructura del catálogo.</li>
<li><strong>Pedidos:</strong> con los estados de PrestaShop (cancelado, reembolsado o error de pago no cuentan como venta).</li>
<li><strong>Inventario:</strong> stock y alertas.</li>
<li><strong>Imágenes y pricing con IA:</strong> imágenes de producto generadas con IA y precio con COGS real. El A/B testing automático está disponible solo para Shopify.</li>
</ul>

<h2>Pensado para el mercado hispanohablante</h2>
<p>Todo el panel, los informes y el contenido que genera la IA están en español, y la plataforma trabaja en la zona horaria de Madrid para los cortes diarios de ventas.</p>

<h2>¿Valorando otra plataforma?</h2>
<p>Consulta la <a href="/shopify-vs-prestashop" style="color:#e6c668">comparativa Shopify vs PrestaShop</a> y la <a href="/migrar-prestashop-shopify" style="color:#e6c668">guía de migración PrestaShop → Shopify</a>.</p>
    `.trim(),
  },
  {
    path: "/gestion-stripe-ia",
    canonical: "https://shopycrafter.com/gestion-stripe-ia",
    metaTitle: "Gestión de Stripe con IA: cobros, suscripciones y facturas — Shopy Crafter",
    metaDescription: "Gestiona tu cuenta Stripe desde un panel con IA: clientes, cobros, suscripciones, facturas, reembolsos, pagos a banco y balance. Stripe Connect y portal de cliente incluidos.",
    badge: "Stripe",
    tag: "Stripe",
    h1: "Gestión de pagos con Stripe: cobros, suscripciones y facturación en un solo panel",
    subtitle: "Conecta tu cuenta Stripe y gestiona clientes, cobros, suscripciones y facturas sin entrar en cinco pantallas distintas.",
    body: `
<h2>Qué gestionamos en Stripe</h2>
<ul style="padding-left:24px;color:rgba(255,255,255,0.7);line-height:2">
<li><strong>Clientes:</strong> alta y consulta de clientes.</li>
<li><strong>Cobros y payment intents:</strong> cobros puntuales desde el panel.</li>
<li><strong>Suscripciones:</strong> consulta y cancelación.</li>
<li><strong>Facturas:</strong> creación, envío y anulación.</li>
<li><strong>Reembolsos:</strong> totales o parciales.</li>
<li><strong>Pagos a banco (payouts) y balance:</strong> qué tienes disponible y qué está en camino.</li>
<li><strong>Productos de Stripe:</strong> alta y baja de productos y precios.</li>
<li><strong>Transacciones:</strong> historial completo.</li>
</ul>

<h2>Stripe Connect y claves seguras</h2>
<p>Puedes conectar tu cuenta mediante Stripe Connect (OAuth) o con tu clave secreta. Las claves se guardan cifradas y se pueden rotar desde el panel. Los webhooks de Stripe se verifican con firma.</p>

<h2>Portal de cliente con vista de Stripe</h2>
<p>Si trabajamos para ti, ves en tu portal la actividad de tu cuenta Stripe: cobros, clientes, facturas, suscripciones y pagos, en modo solo lectura.</p>

<h2>Stripe con tu tienda online</h2>
<p>Stripe se combina con <a href="/automatizacion-shopify-ia" style="color:#e6c668">Shopify</a>, <a href="/automatizacion-woocommerce-ia" style="color:#e6c668">WooCommerce</a> o <a href="/automatizacion-prestashop-ia" style="color:#e6c668">PrestaShop</a>. Para Shopify en concreto, lee la <a href="/shopify-stripe-pagos" style="color:#e6c668">guía de Stripe + Shopify</a>.</p>
    `.trim(),
  },
  {
    path: "/diseno-web-profesional",
    canonical: "https://shopycrafter.com/diseno-web-profesional",
    metaTitle: "Diseño web profesional con 3D, animación e IA — Shopy Crafter",
    metaDescription: "Diseñamos y desarrollamos webs y landings a medida: 3D con Three.js, animaciones con GSAP, scroll inmersivo y diseño basado en el ADN de tu marca. Mira nuestras 30 demos interactivas.",
    badge: "Diseño web",
    tag: "Diseño y desarrollo web",
    h1: "Diseño y desarrollo web a medida, con 3D, animación e IA",
    subtitle: "Webs y landings que se sienten de otro nivel: diseño a partir del ADN de tu marca, 3D en tiempo real y animaciones fluidas, sin plantillas.",
    body: `
<h2>Cómo diseñamos</h2>
<p>Partimos del ADN de tu marca: colores, tipografías, tono y referencias visuales. Nuestro estudio de diseño con IA genera la propuesta en HTML real, que vemos en vivo y afinamos contigo antes de publicarla.</p>

<h2>Tecnologías que dominamos</h2>
<ul style="padding-left:24px;color:rgba(255,255,255,0.7);line-height:2">
<li><strong>3D en tiempo real:</strong> Three.js y React Three Fiber, modelos GLB, vistas explosionadas y visores de producto.</li>
<li><strong>Animación:</strong> GSAP, ScrollTrigger, SplitType y scroll suave con Lenis.</li>
<li><strong>Efectos:</strong> shaders, partículas, degradados animados, cursor magnético y transiciones de página.</li>
<li><strong>Componentes premium:</strong> bento grids, carruseles 3D, visualización de datos y secciones hero.</li>
</ul>

<h2>30 demos interactivas</h2>
<p>Hemos publicado 30 demos que puedes abrir y probar en tu navegador: desde héroes con partículas hasta narrativas 3D con scroll. Míralas en nuestro <a href="/portfolio" style="color:#e6c668">portfolio</a>.</p>

<h2>Webs para tiendas online</h2>
<p>Si tu web es una tienda, la combinamos con la optimización de catálogo con IA para <a href="/automatizacion-shopify-ia" style="color:#e6c668">Shopify</a>, <a href="/automatizacion-woocommerce-ia" style="color:#e6c668">WooCommerce</a> o <a href="/automatizacion-prestashop-ia" style="color:#e6c668">PrestaShop</a>.</p>
    `.trim(),
  },
  {
    path: "/desarrollo-apps-nativas",
    canonical: "https://shopycrafter.com/desarrollo-apps-nativas",
    metaTitle: "Desarrollo de apps nativas Android e iOS — Shopy Crafter",
    metaDescription: "Convertimos tu web o tu tienda en app nativa para Android e iOS con Capacitor: una sola base de código, notificaciones push y acceso al dispositivo. Nuestra propia app Android es el ejemplo.",
    badge: "Apps nativas",
    tag: "Apps móviles",
    h1: "Desarrollo de apps nativas para Android e iOS",
    subtitle: "Tu web o tu tienda como app instalable, con notificaciones push y experiencia nativa, a partir de una sola base de código.",
    body: `
<h2>Nuestra propia app como prueba</h2>
<p>Shopy Crafter tiene su propia app Android, construida con Capacitor sobre la misma base de código que la plataforma web. Puedes descargarla desde nuestra <a href="/" style="color:#e6c668">página principal</a>.</p>

<h2>Cómo construimos las apps</h2>
<ul style="padding-left:24px;color:rgba(255,255,255,0.7);line-height:2">
<li><strong>Capacitor:</strong> una sola base de código web (React) empaquetada como app nativa para Android e iOS.</li>
<li><strong>Notificaciones push:</strong> avisos en el móvil para pedidos, mensajes o novedades.</li>
<li><strong>Acceso al dispositivo:</strong> cámara, archivos y almacenamiento cuando la app lo necesita.</li>
<li><strong>Actualizaciones:</strong> los cambios de la web se reflejan en la app sin rehacerla.</li>
</ul>

<h2>Para qué tipo de proyectos</h2>
<p>Tiendas online que quieren fidelizar con una app, paneles internos para equipos y portales de cliente. Si ya tienes web, partimos de ella; si no, la <a href="/diseno-web-profesional" style="color:#e6c668">diseñamos</a> pensando desde el principio en web y app.</p>
    `.trim(),
  },
];

export const COMPARISON_DATA: Record<string, ComparisonPage> = Object.fromEntries(
  COMPARISON_PAGES.map(p => [p.path, p])
);

export function getComparisonPage(path: string): ComparisonPage | undefined {
  return COMPARISON_DATA[path];
}
