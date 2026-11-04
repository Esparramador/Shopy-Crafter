/**
 * Páginas por palabra clave (comparativas, guías de migración y páginas de servicio).
 *
 * Contenido ESTRUCTURADO (no HTML): lo pinta `ComparisonPage.tsx`. Texto en línea admite
 * `**negrita**`, `` `código` `` y `[texto](/ruta)`.
 *
 * Regla de contenido: solo afirmaciones que se puedan comprobar en el código de la plataforma
 * (platform-capabilities, plan-catalog, shop) o que sean criterio técnico sin cifras. Nada de cifras de
 * resultados, garantías ni comparativas con competidores sin fuente. Precios siempre «desde».
 */

export interface Item { t: string; d: string }
export interface Faq { q: string; a: string }
export interface Related { href: string; label: string; desc: string }
export interface Section {
  id: string;
  h: string;
  /** Párrafo de entrada, antes del contenido. */
  intro?: string;
  paras?: string[];
  /** Tarjetas (idea corta + explicación). */
  cards?: Item[];
  /** Lista de comprobación o pasos numerados. */
  steps?: Item[];
  /** Lista con viñetas simples. */
  bullets?: string[];
  /** Aviso al pie de la sección. */
  note?: string;
}
export interface CompareTable {
  caption: string;
  head: [string, string, string];
  rows: [string, string, string][];
  note?: string;
}

export type PackSet = "store" | "stripe" | "none";

export interface ComparisonPage {
  path: string;
  canonical: string;
  metaTitle: string;
  metaDescription: string;
  /** Etiqueta sobre el titular. */
  badge: string;
  /** Familia, para las migas de pan y el enlazado. */
  group: "Comparativas" | "Migración" | "Servicios" | "Guías";
  tag: string;
  h1: string;
  subtitle: string;
  /** Tres ideas clave, justo debajo del hero. */
  points: Item[];
  table?: CompareTable;
  sections: Section[];
  packs: PackSet;
  faqs: Faq[];
  related: Related[];
  cta: { title: string; text: string; asunto: string };
  /** HTML plano generado a partir de lo anterior; lo consume el prerender (src/seo/routes.ts). */
  body: string;
}
type PageSource = Omit<ComparisonPage, "body">;

/* ── Packs (fuente: api-server/src/lib/plan-catalog.ts; precios sin IVA, siempre «desde») ── */
export const STORE_PACKS = [
  { name: "Starter", monthly: 49, setup: 150, surcharge: 20, line: "15 productos y 45 imágenes al mes", extra: "1 auditoría SEO y 1 test A/B al mes (Shopify)" },
  { name: "Growth", monthly: 149, setup: 350, surcharge: 30, line: "60 productos y 300 imágenes al mes", extra: "Llamada de seguimiento de 30 min al mes", featured: true },
  { name: "Enterprise", monthly: 399, setup: 750, surcharge: 50, line: "200 productos y 1.200 imágenes al mes", extra: "Llamada de seguimiento de 60 min al mes" },
];
export const STRIPE_PACKS = [
  { name: "Starter", monthly: 39, setup: 90, line: "Hasta 20 facturas o enlaces de pago al mes", extra: "Informe mensual" },
  { name: "Growth", monthly: 99, setup: 190, line: "Hasta 100 facturas y 50 cambios de suscripción al mes", extra: "Informe quincenal y conciliación mensual de payouts", featured: true },
  { name: "Enterprise", monthly: 249, setup: 390, line: "Hasta 400 facturas y 300 cambios de suscripción al mes", extra: "Informe semanal y conciliación semanal de payouts" },
];

const STORE_CTA = { title: "¿Quieres ver qué haría la IA en tu tienda?", text: "Cuéntanos tu plataforma y tu catálogo y te proponemos un pack con el alcance y el precio de partida. Sin compromiso.", asunto: "Automatización de tienda con IA" };

const PAGE_SOURCES: PageSource[] = [
  /* ───────────────────────── Shopify vs WooCommerce ───────────────────────── */
  {
    path: "/shopify-vs-woocommerce",
    canonical: "https://shopycrafter.com/shopify-vs-woocommerce",
    metaTitle: "Shopify vs WooCommerce: comparativa para elegir plataforma — Shopy Crafter",
    metaDescription: "¿Shopify o WooCommerce? Comparamos coste, mantenimiento, SEO, flexibilidad y automatización con IA, con criterios de decisión según el tipo de negocio. Trabajamos con las dos.",
    badge: "Comparativa",
    group: "Comparativas",
    tag: "Shopify vs WooCommerce",
    h1: "Shopify vs WooCommerce: cuál elegir según tu negocio",
    subtitle: "Una comparación de criterio, no de marketing: qué te da cada plataforma, qué te exige y para quién encaja mejor. Trabajamos con las dos, así que no tenemos una favorita que vender.",
    points: [
      { t: "Shopify: menos mantenimiento", d: "Alojamiento, seguridad y actualizaciones de la plataforma van incluidos en la cuota. Encaja si quieres vender y no gestionar servidores." },
      { t: "WooCommerce: más control", d: "Es código abierto sobre WordPress: flexibilidad total a cambio de que alguien se ocupe de hosting, plugins y copias." },
      { t: "La IA funciona en las dos", d: "Conectamos Shopify y WooCommerce por API oficial. La diferencia está en qué puede automatizarse (p. ej., los tests A/B son solo de Shopify)." },
    ],
    table: {
      caption: "Shopify frente a WooCommerce, criterio a criterio",
      head: ["Criterio", "Shopify", "WooCommerce"],
      rows: [
        ["Modelo", "Plataforma como servicio: cuota mensual, todo alojado", "Plugin de código abierto sobre WordPress: alojamiento propio"],
        ["Puesta en marcha", "Rápida: tema, productos y pagos desde el panel", "Más pasos: WordPress, tema, plugins, hosting y seguridad"],
        ["Mantenimiento técnico", "Lo gestiona Shopify", "Lo gestionas tú o un tercero: actualizaciones, copias y compatibilidad de plugins"],
        ["Coste", "Cuota de plataforma + apps de pago + comisiones si no usas Shopify Payments", "Sin cuota de plataforma, pero con hosting, plugins premium y mantenimiento"],
        ["Flexibilidad", "Alta dentro de su ecosistema; el checkout está más cerrado", "Muy alta: puedes tocar casi cualquier parte"],
        ["SEO", "Buena base técnica de fábrica; URLs con estructura fija", "Control total de URLs y servidor; depende de cómo lo configures"],
        ["Automatización con IA", "API moderna con webhooks; es donde más podemos automatizar", "API REST v3 con webhooks; cubrimos catálogo, pedidos e inventario"],
      ],
      note: "Valoración de criterio técnico, no medición. Las tarifas de Shopify, hosting y plugins cambian: contrástalas con los proveedores antes de decidir.",
    },
    sections: [
      {
        id: "coste", h: "El coste real no es la cuota",
        intro: "Compara el coste total, no la primera cifra que ves.",
        cards: [
          { t: "En Shopify", d: "Cuota mensual de plataforma, las apps de pago que añadas y las comisiones por transacción si usas una pasarela distinta de Shopify Payments." },
          { t: "En WooCommerce", d: "El plugin es gratuito, pero necesitas hosting de calidad, plugins premium (pagos, SEO, envíos), certificado y copias, y a alguien que mantenga todo actualizado." },
        ],
        note: "Si lo que se compara es trabajo del equipo, WooCommerce suele costar más horas; si se compara cuota, Shopify cuesta más cada mes. Depende de quién tenga el conocimiento técnico en casa.",
      },
      {
        id: "ia", h: "Qué cambia a la hora de automatizar con IA",
        paras: [
          "Las dos plataformas exponen API y webhooks, y en las dos podemos auditar fichas, reescribir títulos y descripciones, generar imágenes de producto, calcular precios con coste real y vigilar inventario y pedidos.",
          "La diferencia concreta que verificamos en nuestra plataforma: en Shopify además gestionamos colecciones y temas y lanzamos tests A/B de imagen y precio; en WooCommerce sumamos cupones, clientes e informes de ventas.",
        ],
      },
      {
        id: "elegir", h: "Cuándo elegir cada una",
        cards: [
          { t: "Elige Shopify si…", d: "quieres lanzar pronto, no tienes equipo técnico, prefieres una cuota previsible y valoras que la plataforma se mantenga sola." },
          { t: "Elige WooCommerce si…", d: "ya tienes un WordPress con contenido y tráfico, necesitas personalizaciones que Shopify no permite o tienes quien lo mantenga." },
        ],
      },
      {
        id: "migrar", h: "¿Estás en WooCommerce y te planteas cambiar?",
        paras: ["Migrar es viable si se planifica, y las redirecciones 301 son la pieza que protege el posicionamiento. Tienes la [guía de migración WooCommerce → Shopify](/migrar-woocommerce-shopify). Si prefieres quedarte, [automatizamos WooCommerce](/automatizacion-woocommerce-ia) sin cambiar de plataforma."],
      },
    ],
    packs: "store",
    faqs: [
      { q: "¿Es Shopify mejor que WooCommerce?", a: "Ninguna es mejor en abstracto. Shopify reduce el mantenimiento; WooCommerce da más control a cambio de más responsabilidad técnica. La elección depende de tu equipo, tu catálogo y tu presupuesto de mantenimiento." },
      { q: "¿Trabajáis con las dos plataformas?", a: "Sí. Conectamos Shopify, WooCommerce y PrestaShop por sus API oficiales y aplicamos la misma IA de auditoría, SEO, imágenes y precios." },
      { q: "¿Qué cuesta automatizar mi tienda?", a: "Los packs parten de 49 €/mes más una puesta en marcha de pago único desde 150 €. En WooCommerce y PrestaShop se suma un recargo mensual de 20, 30 o 50 € según el pack. Precios sin IVA." },
    ],
    related: [
      { href: "/automatizacion-shopify-ia", label: "Automatización Shopify con IA", desc: "Qué hacemos sobre tu tienda Shopify." },
      { href: "/automatizacion-woocommerce-ia", label: "Automatización WooCommerce con IA", desc: "IA sobre tu WooCommerce sin migrar." },
      { href: "/migrar-woocommerce-shopify", label: "Migrar WooCommerce a Shopify", desc: "Checklist por fases y redirecciones 301." },
    ],
    cta: { title: "¿No sabes qué plataforma te conviene?", text: "Cuéntanos tu catálogo y cómo trabajas y te damos una recomendación razonada, aunque no acabe en proyecto.", asunto: "Shopify o WooCommerce" },
  },

  /* ───────────────────────── Shopify vs PrestaShop ───────────────────────── */
  {
    path: "/shopify-vs-prestashop",
    canonical: "https://shopycrafter.com/shopify-vs-prestashop",
    metaTitle: "Shopify vs PrestaShop: comparativa para el mercado español — Shopy Crafter",
    metaDescription: "PrestaShop y Shopify comparadas en coste, mantenimiento, SEO, integraciones y automatización con IA. Criterios para decidir si quedarte o migrar. Trabajamos con ambas.",
    badge: "Comparativa",
    group: "Comparativas",
    tag: "Shopify vs PrestaShop",
    h1: "Shopify vs PrestaShop: cómo decidir en una tienda española",
    subtitle: "PrestaShop es de código abierto y tiene mucha base instalada en España y Europa; Shopify es una plataforma alojada. Te contamos en qué se diferencian y qué conviene según tu situación.",
    points: [
      { t: "Dos modelos distintos", d: "PrestaShop se instala en tu hosting y la gestionas tú. Shopify se contrata como servicio y se actualiza sola." },
      { t: "Curva de aprendizaje", d: "El back-office de PrestaShop da mucho control pero es más denso; el de Shopify es más guiado y limitado." },
      { t: "Automatizamos ambas", d: "Conectamos PrestaShop por Webservice y Shopify por su API oficial. No necesitas cambiar de plataforma para usar IA." },
    ],
    table: {
      caption: "Shopify frente a PrestaShop, criterio a criterio",
      head: ["Criterio", "Shopify", "PrestaShop"],
      rows: [
        ["Modelo", "SaaS: cuota mensual, alojamiento incluido", "Código abierto: hosting propio"],
        ["Mantenimiento", "Lo gestiona la plataforma", "Actualizaciones de versión y módulos a tu cargo"],
        ["Curva de aprendizaje", "Más guiada", "Más densa; más control del back-office"],
        ["Coste", "Cuota + apps + comisiones según pasarela", "Sin cuota de plataforma; hosting, módulos de pago y mantenimiento"],
        ["Pagos", "Shopify Payments y pasarelas externas", "Módulos de pago de terceros u oficiales; configuración más técnica"],
        ["SEO", "Buena base técnica de fábrica", "Muy configurable; depende del hosting, los módulos y la configuración"],
        ["Automatización con IA", "API moderna con webhooks", "Webservice oficial: catálogo, SEO por producto, categorías, pedidos e inventario"],
      ],
      note: "Valoración de criterio técnico, no medición. Contrasta tarifas y módulos con sus proveedores.",
    },
    sections: [
      {
        id: "contexto", h: "El contexto en España",
        paras: ["PrestaShop lleva años instalada en muchas tiendas españolas, y eso tiene un efecto práctico: hay agencias, módulos y soporte local abundantes. Shopify ofrece interfaz y soporte en español y un ecosistema de apps amplio. La pregunta útil no es cuál es «mejor», sino cuánto mantenimiento técnico quieres asumir."],
      },
      {
        id: "mantenimiento", h: "Dónde suele doler PrestaShop",
        bullets: [
          "Actualizar de versión puede romper módulos que dependen de la anterior.",
          "Los módulos premium de pago, SEO o envíos suman coste y trabajo de compatibilidad.",
          "El rendimiento depende de tu hosting y de cómo esté configurado.",
        ],
        note: "Son los puntos que más veces vemos al auditar tiendas PrestaShop, no una estadística.",
      },
      {
        id: "ia", h: "Qué automatizamos en cada plataforma",
        paras: ["En PrestaShop: auditoría de fichas, rediseño de textos con IA, meta título y descripción escritos en tu tienda, categorías, pedidos con sus estados, inventario, imágenes y precios con coste real. En Shopify, además: colecciones, temas y tests A/B de imagen y precio. Detalle en [Automatización PrestaShop](/automatizacion-prestashop-ia) y [Automatización Shopify](/automatizacion-shopify-ia)."],
      },
      {
        id: "decidir", h: "Cuándo quedarte y cuándo migrar",
        cards: [
          { t: "Quédate en PrestaShop si…", d: "tu tienda funciona, tienes quien la mantenga y tus módulos a medida son parte del negocio." },
          { t: "Plantéate Shopify si…", d: "el mantenimiento te consume tiempo, las actualizaciones te dan miedo o quieres una cuota previsible." },
        ],
        note: "Si migras, la [guía de migración PrestaShop → Shopify](/migrar-prestashop-shopify) explica las redirecciones y las combinaciones de producto.",
      },
    ],
    packs: "store",
    faqs: [
      { q: "¿Puedo usar vuestra IA sin salir de PrestaShop?", a: "Sí. Basta una clave del Webservice de PrestaShop con los permisos adecuados; no instalamos módulos de terceros." },
      { q: "¿Migrar mejora el SEO?", a: "No por sí mismo. Una migración bien hecha lo conserva con redirecciones 301 y aprovecha para limpiar fichas, pero no hay garantía de resultados." },
      { q: "¿Cuánto cuesta?", a: "Los packs parten de 49 €/mes más puesta en marcha desde 150 €. En PrestaShop se suma un recargo mensual de 20, 30 o 50 € según el pack. Precios sin IVA." },
    ],
    related: [
      { href: "/automatizacion-prestashop-ia", label: "Automatización PrestaShop con IA", desc: "Qué hacemos sobre tu PrestaShop." },
      { href: "/migrar-prestashop-shopify", label: "Migrar PrestaShop a Shopify", desc: "Checklist y herramientas de migración." },
      { href: "/shopify-vs-woocommerce", label: "Shopify vs WooCommerce", desc: "La otra gran comparativa." },
    ],
    cta: { title: "¿PrestaShop o Shopify? Lo vemos con tus datos", text: "Revisamos tu tienda actual y te decimos con franqueza si compensa quedarte, optimizarla o migrar.", asunto: "Shopify o PrestaShop" },
  },

  /* ───────────────────────── Migrar WooCommerce → Shopify ───────────────────────── */
  {
    path: "/migrar-woocommerce-shopify",
    canonical: "https://shopycrafter.com/migrar-woocommerce-shopify",
    metaTitle: "Migrar WooCommerce a Shopify: guía y checklist cuidando el SEO — Shopy Crafter",
    metaDescription: "Guía por fases para migrar de WooCommerce a Shopify: exportación, catálogo, redirecciones 301, pagos y puesta en marcha. Checklist y errores a evitar.",
    badge: "Guía de migración",
    group: "Migración",
    tag: "WooCommerce → Shopify",
    h1: "Cómo migrar de WooCommerce a Shopify cuidando el SEO y las ventas",
    subtitle: "Una guía por fases con la lista de comprobación que usamos: qué exportar, cómo mover el catálogo, qué redirecciones crear y qué probar antes de abrir al público.",
    points: [
      { t: "Las redirecciones 301 son lo crítico", d: "Cada URL antigua con tráfico debe apuntar a su equivalente nueva. Sin ellas se pierde posicionamiento." },
      { t: "Se planifica por fases", d: "Preparación, catálogo, SEO, pagos y puesta en marcha, con pruebas antes de cambiar el dominio." },
      { t: "Cotizamos tras auditar", d: "Cada migración depende de tu catálogo y de los datos; la auditamos primero y la presupuestamos aparte." },
    ],
    sections: [
      {
        id: "porque", h: "Por qué migran las tiendas WooCommerce",
        paras: ["Los motivos que más oímos: cansancio del mantenimiento de WordPress (actualizaciones, plugins incompatibles, hosting), ganas de una cuota previsible y querer más automatización. No siempre compensa: si tu WooCommerce funciona y tienes quien lo cuide, [automatizarlo con IA](/automatizacion-woocommerce-ia) puede bastar. Compara antes en [Shopify vs WooCommerce](/shopify-vs-woocommerce)."],
      },
      {
        id: "checklist", h: "Checklist de migración por fases",
        steps: [
          { t: "1. Preparación", d: "Exporta productos, variantes, SKUs, precios e imágenes; clientes y pedidos históricos; y documenta todas las URLs actuales. Elige plan de Shopify, tema y dominio." },
          { t: "2. Catálogo", d: "En catálogos pequeños basta el CSV nativo de Shopify; para volúmenes mayores se usan apps de migración como Matrixify o LitExtension, o desarrollo a medida. Verifica variantes, precios de comparación y stock." },
          { t: "3. SEO y redirecciones", d: "Crea las 301 de cada URL antigua (por ejemplo, `/producto/slug` → `/products/slug` y `/categoria/slug` → `/collections/slug`), revísalas en Shopify (Configuración → URL de redirección) y actualiza el sitemap en Google Search Console." },
          { t: "4. Pagos y ajustes", d: "Configura la pasarela de pago, envíos, impuestos y correos transaccionales. Prueba un pedido completo en modo de prueba." },
          { t: "5. Puesta en marcha", d: "Comprueba que las redirecciones responden, que no hay errores 404 críticos y que el análisis (GA4/Tag Manager) funciona; vigila el tráfico orgánico las primeras semanas." },
        ],
      },
      {
        id: "ia", h: "Aprovechar la migración para limpiar el catálogo",
        paras: ["Un cambio de plataforma es buen momento para revisar títulos, descripciones, textos alternativos de imagen y datos estructurados. Con Shopy Crafter auditamos cada ficha, reescribimos con IA lo que lo necesite y generamos imágenes de producto donde falten, con tu aprobación antes de publicar. [Cómo lo hacemos en Shopify](/automatizacion-shopify-ia)."],
      },
      {
        id: "errores", h: "Errores que conviene evitar",
        cards: [
          { t: "No crear las redirecciones 301", d: "Es el fallo más costoso: las URLs con enlaces y posicionamiento dejan de funcionar." },
          { t: "Copiar el contenido sin revisarlo", d: "Si las fichas eran flojas en WooCommerce, lo seguirán siendo en Shopify." },
          { t: "No probar el checkout", d: "Hay que probar el pedido completo con la pasarela real antes de abrir." },
          { t: "Migrar en plena temporada alta", d: "Elige un periodo de poco tráfico para poder corregir con calma." },
        ],
      },
    ],
    packs: "store",
    faqs: [
      { q: "¿Se pierde el posicionamiento al migrar?", a: "Si se planifican bien las redirecciones 301 y se mantienen los contenidos, el riesgo se reduce mucho, pero ninguna migración puede garantizar que el tráfico se mantenga idéntico." },
      { q: "¿Hacéis la migración?", a: "Auditamos tu tienda y presupuestamos la migración aparte, según catálogo, variantes y datos. Escríbenos y lo valoramos." },
      { q: "¿Se migran pedidos y clientes?", a: "Se pueden exportar e importar con herramientas de migración, aunque no todo se traslada igual. Lo revisamos en la auditoría previa." },
    ],
    related: [
      { href: "/shopify-vs-woocommerce", label: "Shopify vs WooCommerce", desc: "Antes de migrar, compara." },
      { href: "/automatizacion-shopify-ia", label: "Automatización Shopify con IA", desc: "Qué hacemos tras la migración." },
      { href: "/tienda/rediseno-tienda", label: "Rediseño de tienda online", desc: "Servicio de la Tienda, desde 1.490 €." },
    ],
    cta: { title: "¿Quieres que auditemos tu migración?", text: "Revisamos tu WooCommerce, te decimos qué se puede mover tal cual y qué hay que rehacer, y te damos un presupuesto.", asunto: "Migración WooCommerce a Shopify" },
  },

  /* ───────────────────────── Migrar PrestaShop → Shopify ───────────────────────── */
  {
    path: "/migrar-prestashop-shopify",
    canonical: "https://shopycrafter.com/migrar-prestashop-shopify",
    metaTitle: "Migrar PrestaShop a Shopify: guía por fases y redirecciones 301 — Shopy Crafter",
    metaDescription: "Cómo migrar de PrestaShop a Shopify cuidando el SEO: diferencias de URLs y combinaciones, herramientas de migración, redirecciones 301, pagos y puesta en marcha.",
    badge: "Guía de migración",
    group: "Migración",
    tag: "PrestaShop → Shopify",
    h1: "Cómo migrar de PrestaShop a Shopify cuidando el SEO",
    subtitle: "Qué cambia entre las dos plataformas, qué herramientas existen y qué lista de comprobación seguir para migrar el catálogo, las URLs y los pagos sin sorpresas.",
    points: [
      { t: "URLs y combinaciones distintas", d: "PrestaShop usa `.html` y «combinaciones»; Shopify usa `/products/` y variantes. Hay que mapearlo." },
      { t: "Herramientas, no magia", d: "Existen apps de migración, pero las combinaciones complejas y los datos sucios requieren revisión manual." },
      { t: "Se cotiza tras auditar", d: "El esfuerzo depende de tu catálogo; lo auditamos y presupuestamos aparte." },
    ],
    sections: [
      {
        id: "porque", h: "Por qué se migra desde PrestaShop",
        paras: ["Los motivos habituales: actualizaciones de versión que rompen módulos, coste creciente de módulos premium y dependencia de desarrolladores PHP. Antes de decidir, compara en [Shopify vs PrestaShop](/shopify-vs-prestashop); si prefieres quedarte, [automatizamos PrestaShop](/automatizacion-prestashop-ia) tal como está."],
      },
      {
        id: "diferencias", h: "Diferencias técnicas que condicionan la migración",
        cards: [
          { t: "Estructura de URLs", d: "PrestaShop: `/categoria/nombre-producto.html` o `/nombre-producto-id.html`. Shopify: `/products/nombre-producto` y `/collections/nombre`. Necesitarás una 301 por cada URL de producto y categoría." },
          { t: "Combinaciones y variantes", d: "Lo que PrestaShop llama «combinaciones» es una «variante» en Shopify. Con varios atributos (talla, color, material) hay que revisar los límites de opciones de Shopify." },
        ],
      },
      {
        id: "herramientas", h: "Herramientas de migración habituales",
        bullets: [
          "**LitExtension** y **Cart2Cart**: migración automatizada de productos, clientes, pedidos y páginas.",
          "**Matrixify**: importación y exportación por hojas, más flexible para catálogos con atributos complejos.",
        ],
        note: "Son herramientas de terceros, ajenas a Shopy Crafter. Compara sus condiciones y alcance antes de elegir.",
      },
      {
        id: "checklist", h: "Checklist por fases",
        steps: [
          { t: "Preparación", d: "Exporta productos con combinaciones, precios, imágenes y stock; lista las URLs activas; exporta clientes y pedidos. Elige plan y tema de Shopify." },
          { t: "Catálogo", d: "Migra con una herramienta, verifica variantes, precios de coste y comparación, imágenes y páginas de contenido (envíos, sobre nosotros…)." },
          { t: "SEO y redirecciones", d: "Genera el mapa de URLs antiguas → nuevas, impórtalo en Shopify (Configuración → URL de redirección, por CSV), actualiza el sitemap y vigila los 404 las primeras semanas." },
          { t: "Pagos e impuestos", d: "Configura la pasarela, comprueba el IVA en Shopify Markets y prueba un pedido completo en modo de prueba." },
        ],
      },
      {
        id: "ia", h: "Después: fichas limpias con IA",
        paras: ["Con el catálogo ya en Shopify, auditamos cada ficha, reescribimos títulos y descripciones, generamos las imágenes que falten y preparamos los datos estructurados, siempre con tu aprobación antes de publicar. [Ver qué automatizamos en Shopify](/automatizacion-shopify-ia)."],
      },
    ],
    packs: "store",
    faqs: [
      { q: "¿Se pueden migrar las combinaciones de PrestaShop?", a: "Sí, como variantes, pero con varios atributos hay que revisar las limitaciones de Shopify y comprobar el resultado ficha a ficha." },
      { q: "¿Cuánto cuesta migrar?", a: "Se audita y se presupuesta aparte, según catálogo y datos. Los packs de IA son independientes y parten de 49 €/mes." },
      { q: "¿Y si prefiero no migrar?", a: "Puedes usar la IA sobre tu PrestaShop actual por Webservice, sin cambiar de plataforma." },
    ],
    related: [
      { href: "/shopify-vs-prestashop", label: "Shopify vs PrestaShop", desc: "Compara antes de decidir." },
      { href: "/automatizacion-prestashop-ia", label: "Automatización PrestaShop con IA", desc: "Quedarte y optimizar." },
      { href: "/automatizacion-shopify-ia", label: "Automatización Shopify con IA", desc: "Lo que hacemos tras migrar." },
    ],
    cta: { title: "¿Valoras migrar tu PrestaShop?", text: "Auditamos tu catálogo y tus URLs y te decimos qué esfuerzo supone y cuánto costaría.", asunto: "Migración PrestaShop a Shopify" },
  },

  /* ───────────────────────── Stripe + Shopify ───────────────────────── */
  {
    path: "/shopify-stripe-pagos",
    canonical: "https://shopycrafter.com/shopify-stripe-pagos",
    metaTitle: "Stripe y Shopify: qué conviene saber de los pagos — Shopy Crafter",
    metaDescription: "Shopify Payments o Stripe: diferencias de funcionamiento, qué comprobar (comisiones, métodos de pago, suscripciones) y cómo gestionamos tu cuenta Stripe con IA.",
    badge: "Guía de pagos",
    group: "Guías",
    tag: "Stripe + Shopify",
    h1: "Stripe y Shopify: qué comprobar antes de elegir cómo cobrar",
    subtitle: "Shopify Payments y Stripe no son lo mismo. Te explicamos en qué se parecen, qué criterios usar para elegir y dónde encaja nuestra gestión de cuentas Stripe.",
    points: [
      { t: "Compara el coste total", d: "Comisión de la pasarela, posible comisión adicional de Shopify y coste de los métodos locales. Las tarifas cambian: consúltalas en cada proveedor." },
      { t: "Comprueba la disponibilidad", d: "Qué pasarelas y métodos de pago están disponibles depende de tu país y de tu plan de Shopify." },
      { t: "Stripe más allá del checkout", d: "Facturas, suscripciones, reembolsos y payouts se gestionan en Stripe; ahí es donde ayudamos." },
    ],
    table: {
      caption: "Qué mirar al comparar Shopify Payments y Stripe",
      head: ["Aspecto", "Shopify Payments", "Stripe"],
      rows: [
        ["Integración", "Nativa en Shopify, sin cuenta externa", "Cuenta propia en Stripe; la conexión con Shopify depende de la disponibilidad en tu país"],
        ["Comisiones", "Tarifa de procesamiento de la plataforma", "Tarifa de Stripe, y puede haber comisión adicional de Shopify al usar una pasarela externa"],
        ["Métodos de pago", "Según país y configuración", "Muy amplios, según país y activación en tu cuenta"],
        ["Suscripciones y facturación", "Mediante apps de suscripción", "Stripe Billing y facturas propias"],
        ["Panel de datos", "Dentro de Shopify", "Panel de Stripe, con informes de cobros, payouts y disputas"],
      ],
      note: "Comprueba siempre tarifas y disponibilidad en la documentación vigente de Shopify y de Stripe: cambian con el tiempo y por país.",
    },
    sections: [
      {
        id: "elegir", h: "Cómo elegir",
        paras: ["Si Shopify Payments está disponible en tu país y no necesitas funciones específicas de Stripe, suele ser lo más simple: todo en un solo panel. Considera Stripe si necesitas facturación y suscripciones avanzadas, integraciones por API con otros sistemas o un solo panel de cobros para varios canales."],
      },
      {
        id: "optimizar", h: "Qué ayuda a que más pedidos acaben en cobro",
        bullets: [
          "Ofrecer pago acelerado (Apple Pay, Google Pay) en móvil, donde evita teclear la tarjeta.",
          "Activar los métodos locales que tus clientes ya usan, si tu proveedor los ofrece.",
          "Revisar las reglas antifraude para no bloquear compras legítimas, por ejemplo regalos con dirección de envío distinta a la de facturación.",
          "Probar un pedido completo en modo de prueba tras cada cambio de configuración.",
        ],
        note: "No prometemos porcentajes de mejora: depende de tu tienda y de tu público.",
      },
      {
        id: "gestion", h: "Cómo ayudamos con Stripe",
        paras: ["Conectamos tu cuenta Stripe a tu portal y gestionamos clientes, cobros, suscripciones, facturas, reembolsos y payouts desde un solo panel, con alertas de pagos fallidos y disputas. Más en [Gestión de Stripe con IA](/gestion-stripe-ia)."],
      },
      {
        id: "pricing", h: "Precios con las comisiones dentro",
        paras: ["En nuestras tiendas con [pricing con COGS real](/automatizacion-shopify-ia) el cálculo de márgenes incluye las comisiones de pago, para que cada precio deje el margen que esperas. El motor trabaja sobre los datos del producto y no toca tu pasarela de pago."],
      },
    ],
    packs: "stripe",
    faqs: [
      { q: "¿Puedo usar Stripe con Shopify?", a: "Depende de tu país y de tu configuración de Shopify. Comprueba la disponibilidad en la documentación vigente de Shopify; nosotros gestionamos tu cuenta Stripe independientemente de dónde la uses." },
      { q: "¿Qué comisiones pagaré?", a: "Las que publiquen Shopify y Stripe en cada momento para tu país y plan. No las fijamos nosotros, por eso no las cifra esta página." },
      { q: "¿Qué cuesta vuestra gestión de Stripe?", a: "Los packs de Stripe parten de 39 €/mes más puesta en marcha desde 90 €, sin IVA." },
    ],
    related: [
      { href: "/gestion-stripe-ia", label: "Gestión de Stripe con IA", desc: "Cobros, suscripciones y facturas en un panel." },
      { href: "/automatizacion-shopify-ia", label: "Automatización Shopify con IA", desc: "Catálogo, SEO y precios." },
      { href: "/tienda", label: "Tienda de Shopy Crafter", desc: "Servicios web y productos con pago por Stripe." },
    ],
    cta: { title: "¿Quieres poner orden en tus cobros?", text: "Revisamos tu cuenta Stripe y tu configuración de pago y te proponemos qué automatizar.", asunto: "Gestión de Stripe" },
  },

  /* ───────────────────────── Agencias ───────────────────────── */
  {
    path: "/agencia-shopify-ia",
    canonical: "https://shopycrafter.com/agencia-shopify-ia",
    metaTitle: "IA para agencias y freelancers de eCommerce — Shopy Crafter",
    metaDescription: "Para agencias que llevan tiendas Shopify, WooCommerce o PrestaShop: auditoría, SEO, imágenes, pricing y tests A/B con IA, con aprobación del cliente y portal propio. Hablamos de alcance, no de promesas.",
    badge: "Para agencias",
    group: "Servicios",
    tag: "Agencias",
    h1: "IA para agencias que llevan tiendas Shopify, WooCommerce y PrestaShop",
    subtitle: "Las tareas repetitivas de catálogo (auditar fichas, reescribir textos, generar imágenes, vigilar precios) hechas con IA y con la aprobación del cliente antes de publicar. Cada tienda de cliente es un proyecto aislado.",
    points: [
      { t: "Un proyecto por tienda", d: "Cada cliente tiene su portal, sus archivos y sus datos, aislados del resto." },
      { t: "Nada se publica sin visto bueno", d: "Las propuestas pasan por el panel de aprobaciones: el cliente las ve, las aprueba o las rechaza." },
      { t: "Cuotas claras", d: "Cada pack tiene cupos mensuales definidos (productos, imágenes, auditorías, tests). Sin «ilimitado» que luego no lo es." },
    ],
    sections: [
      {
        id: "que", h: "Qué puede quitarse de encima una agencia",
        cards: [
          { t: "Auditoría de catálogo", d: "Puntuación por ficha de título, descripción, SEO, imágenes y precio, con la lista de problemas concretos." },
          { t: "Textos e imágenes con IA", d: "Títulos, descripciones y meta tags nuevos, e imágenes de producto con consistencia de marca (Visual DNA), listos para aprobar." },
          { t: "SEO técnico de producto", d: "Datos estructurados, textos alternativos y análisis de rendimiento por producto." },
          { t: "Pricing con coste real", d: "Coste por producto con comisiones, envío y embalaje; márgenes y precio recomendado." },
          { t: "Tests A/B (Shopify)", d: "Tests de imagen y de precio con decisión estadística: el ganador se declara a partir del 95 % de confianza." },
          { t: "Competencia e informes", d: "Análisis de competencia con IA e informes periódicos según el pack." },
        ],
      },
      {
        id: "portal", h: "Portal de cliente",
        paras: ["Tus clientes ven sus aprobaciones, mensajes directos con su gestor, informes y los archivos de su proyecto. Lo que hacemos queda registrado junto a los datos reales de su tienda (ingresos y pedidos diarios)."],
      },
      {
        id: "plataformas", h: "Tres plataformas, un mismo método",
        paras: ["Trabajamos con [Shopify](/automatizacion-shopify-ia), [WooCommerce](/automatizacion-woocommerce-ia) y [PrestaShop](/automatizacion-prestashop-ia). Los packs y precios son los mismos; cambia el conector y, en WooCommerce y PrestaShop, un recargo mensual por los plugins o módulos que mantenemos."],
      },
      {
        id: "alcance", h: "Lo que no prometemos",
        bullets: [
          "No ofrecemos marca blanca ni informes con tu logotipo: los informes salen con el portal de Shopy Crafter.",
          "No hay catálogos ilimitados: los cupos mensuales dependen del pack.",
          "No garantizamos resultados comerciales concretos: dependen de la tienda y del mercado.",
        ],
      },
    ],
    packs: "store",
    faqs: [
      { q: "¿Puedo llevar varias tiendas de clientes?", a: "Cada tienda es un proyecto con su pack. Para varias, hablamos de un acuerdo según volumen; escríbenos con el número de tiendas y plataformas." },
      { q: "¿Los clientes ven vuestro nombre?", a: "Sí, el portal es el de Shopy Crafter. No ofrecemos marca blanca." },
      { q: "¿Cuánto cuesta?", a: "Cada tienda parte de 49 €/mes más una puesta en marcha desde 150 €, sin IVA. En WooCommerce y PrestaShop hay un recargo mensual de 20, 30 o 50 € según pack." },
    ],
    related: [
      { href: "/automatizacion-shopify-ia", label: "Automatización Shopify con IA", desc: "El detalle por plataforma." },
      { href: "/ecommerce-ia-automatizacion", label: "eCommerce con IA", desc: "Qué se automatiza y qué no." },
      { href: "/faq", label: "Preguntas frecuentes", desc: "Packs, portal y funcionamiento." },
    ],
    cta: { title: "Cuéntanos tu cartera de tiendas", text: "Dinos cuántas tiendas llevas y en qué plataformas y te proponemos un esquema de packs.", asunto: "Colaboración con agencia" },
  },

  /* ───────────────────────── eCommerce con IA ───────────────────────── */
  {
    path: "/ecommerce-ia-automatizacion",
    canonical: "https://shopycrafter.com/ecommerce-ia-automatizacion",
    metaTitle: "eCommerce con IA: qué se puede automatizar en una tienda online — Shopy Crafter",
    metaDescription: "Qué tareas de una tienda online hace bien la IA (fichas, SEO, imágenes, precios, tests A/B, competencia) y cuáles siguen necesitando a una persona. Con aprobación previa.",
    badge: "eCommerce con IA",
    group: "Guías",
    tag: "eCommerce + IA",
    h1: "eCommerce con IA: qué se puede automatizar y qué no",
    subtitle: "Una guía sin humo: las cinco tareas de catálogo donde la IA ahorra trabajo real, cómo se controla lo que publica y qué decisiones siguen siendo humanas.",
    points: [
      { t: "Ahorra trabajo repetitivo", d: "Auditar fichas, reescribir textos o generar variantes de imagen son tareas donde la IA acelera mucho." },
      { t: "Tú decides qué se publica", d: "Los cambios pueden pasar por un panel de aprobaciones antes de aplicarse en tu tienda." },
      { t: "La estrategia sigue siendo tuya", d: "Colecciones, fotografía de lanzamiento, atención al cliente y decisiones de rebajas no se delegan." },
    ],
    sections: [
      {
        id: "cinco", h: "Cinco áreas donde la IA ayuda de verdad",
        cards: [
          { t: "1. Fichas de producto", d: "Auditoría con puntuación y reescritura de títulos, descripciones y meta tags con el tono de tu marca." },
          { t: "2. Imágenes de producto", d: "Fondos limpios, escenas y variantes con consistencia visual. Para lanzamientos premium, una sesión de fotos real sigue siendo mejor." },
          { t: "3. SEO técnico", d: "Datos estructurados, textos alternativos y revisión de rendimiento, aplicados de forma consistente en todo el catálogo." },
          { t: "4. Precios con coste real", d: "El precio se decide sabiendo el margen: coste del producto con comisiones, envío y embalaje, y precios de la competencia." },
          { t: "5. Tests A/B y competencia", d: "Tests de imagen y precio con decisión estadística (Shopify) y análisis de competencia con IA para detectar movimientos de mercado." },
        ],
      },
      {
        id: "control", h: "Cómo se controla lo que hace la IA",
        paras: ["Cada propuesta puede aprobarse o rechazarse desde tu portal antes de aplicarse. Lo habitual es empezar revisando todo y automatizar solo lo que ya has comprobado que sale bien. Todo cambio queda registrado."],
      },
      {
        id: "humano", h: "Lo que sigue necesitando a una persona",
        bullets: [
          "Estrategia de colecciones y categorías.",
          "Fotografía de producto para lanzamientos premium.",
          "Atención al cliente.",
          "Decisiones de precio en momentos críticos (rebajas, campañas).",
        ],
      },
      {
        id: "plataforma", h: "¿Importa la plataforma?",
        paras: ["Shopify permite lo más completo (colecciones, temas, tests A/B y webhooks), pero no hace falta cambiar de plataforma: también conectamos [WooCommerce](/automatizacion-woocommerce-ia) por REST API y [PrestaShop](/automatizacion-prestashop-ia) por Webservice, con auditoría, SEO, imágenes, precios, pedidos e inventario."],
      },
      {
        id: "empezar", h: "Cómo empezar",
        steps: [
          { t: "Conectar la tienda", d: "Con las credenciales de la API oficial de tu plataforma. Sin instalar nada en tu servidor." },
          { t: "Auditar el catálogo", d: "Puntuación por producto y lista priorizada de problemas." },
          { t: "Elegir el pack", d: "Según cuántos productos e imágenes quieras trabajar al mes." },
        ],
      },
    ],
    packs: "store",
    faqs: [
      { q: "¿Sustituye la IA a mi equipo?", a: "No. Quita trabajo repetitivo, pero la estrategia, la marca y la relación con el cliente siguen siendo tuyas." },
      { q: "¿Las imágenes con IA son tan buenas como una sesión de fotos?", a: "Sirven muy bien para fondos limpios, variantes y escenas. Para producto estrella o lanzamientos premium, recomendamos fotografía real." },
      { q: "¿Puedo revisar los cambios antes de que se publiquen?", a: "Sí. Las propuestas pasan por el panel de aprobaciones de tu portal." },
    ],
    related: [
      { href: "/automatizacion-shopify-ia", label: "Automatización Shopify", desc: "Detalle para Shopify." },
      { href: "/automatizacion-woocommerce-ia", label: "Automatización WooCommerce", desc: "Detalle para WooCommerce." },
      { href: "/automatizacion-prestashop-ia", label: "Automatización PrestaShop", desc: "Detalle para PrestaShop." },
    ],
    cta: STORE_CTA,
  },

  /* ───────────────────────── Automatización Shopify ───────────────────────── */
  {
    path: "/automatizacion-shopify-ia",
    canonical: "https://shopycrafter.com/automatizacion-shopify-ia",
    metaTitle: "Automatización de tiendas Shopify con IA — Shopy Crafter",
    metaDescription: "Automatiza tu tienda Shopify con IA: auditoría de catálogo, SEO de fichas, imágenes de producto, pricing con COGS real, A/B testing, inventario y pedidos. Conexión nativa con la API de Shopify.",
    badge: "Shopify + IA",
    group: "Servicios",
    tag: "Shopify",
    h1: "Automatización de tiendas Shopify con inteligencia artificial",
    subtitle: "Conectamos tu tienda Shopify por API y ponemos a trabajar la IA sobre tu catálogo, tus precios y tus pedidos, con aprobación previa de cada cambio si así lo quieres.",
    points: [
      { t: "Conexión oficial", d: "Una app con Client ID y Client Secret (o token de acceso) a la API de Shopify. Trabajamos sobre tus datos reales." },
      { t: "Todo en un panel", d: "Catálogo, SEO, imágenes, precios, A/B, colecciones, temas, inventario y pedidos." },
      { t: "Tú apruebas", d: "Cada propuesta pasa por el panel de aprobaciones de tu portal antes de aplicarse." },
    ],
    sections: [
      {
        id: "que", h: "Qué automatizamos en Shopify",
        cards: [
          { t: "Auditoría de catálogo", d: "Puntuación por producto de título, descripción, SEO, imágenes y precio, con la lista de problemas de cada ficha." },
          { t: "Rediseño de fichas con IA", d: "Nuevos títulos, descripciones, etiquetas, meta title y meta description, listos para aplicar." },
          { t: "Imágenes de producto", d: "Fondos limpios, lifestyle y variantes, con consistencia visual de marca (Visual DNA)." },
          { t: "SEO técnico", d: "Datos estructurados, textos alternativos y análisis de rendimiento por producto." },
          { t: "Pricing con COGS real", d: "Coste por producto con comisiones, envío y embalaje; márgenes, precio recomendado y simulador de escenarios." },
          { t: "A/B testing", d: "Tests de imagen y de precio con decisión estadística." },
          { t: "Colecciones, temas, inventario y pedidos", d: "Gestión desde el mismo panel." },
        ],
      },
      {
        id: "datos", h: "Datos reales, no estimaciones",
        paras: ["La plataforma registra cada día los ingresos y pedidos de tu tienda (día cerrado, sin contar cancelados ni reembolsados) y recibe los webhooks de Shopify de pedidos pagados, cancelados y reembolsos. Así ves la evolución real junto a cada cambio que aplicamos."],
      },
      {
        id: "aprobacion", h: "Tú decides qué se publica",
        paras: ["Cada propuesta puede pasar por el panel de aprobaciones de tu portal: la ves, la apruebas o la rechazas, y solo entonces se aplica. En el mismo portal tienes mensajes directos con tu gestor, informes y los archivos de tu proyecto, aislados del resto de clientes."],
      },
      {
        id: "otras", h: "¿Tienes WooCommerce o PrestaShop?",
        paras: ["La misma plataforma trabaja con [WooCommerce](/automatizacion-woocommerce-ia) y [PrestaShop](/automatizacion-prestashop-ia), y gestiona cobros con [Stripe](/gestion-stripe-ia)."],
      },
    ],
    packs: "store",
    faqs: [
      { q: "¿Necesito instalar algo en mi tienda?", a: "No hace falta ninguna instalación de código: la conexión se hace con las credenciales de la app de Shopify." },
      { q: "¿Puedo revisar los cambios antes de que se apliquen?", a: "Sí. Las propuestas pasan por tu panel de aprobaciones y solo se aplican cuando las apruebas." },
      { q: "¿Qué cuesta?", a: "Los packs parten de 49 €/mes, con puesta en marcha de pago único desde 150 €. Precios sin IVA." },
    ],
    related: [
      { href: "/automatizacion-woocommerce-ia", label: "WooCommerce con IA", desc: "La misma IA sobre WooCommerce." },
      { href: "/gestion-stripe-ia", label: "Gestión de Stripe", desc: "Cobros, suscripciones y facturas." },
      { href: "/tienda/rediseno-tienda", label: "Rediseño de tienda", desc: "Portada, colección y ficha, desde 1.490 €." },
    ],
    cta: STORE_CTA,
  },

  /* ───────────────────────── Automatización WooCommerce ───────────────────────── */
  {
    path: "/automatizacion-woocommerce-ia",
    canonical: "https://shopycrafter.com/automatizacion-woocommerce-ia",
    metaTitle: "Automatización WooCommerce con IA: SEO, pedidos e inventario — Shopy Crafter",
    metaDescription: "Conecta tu WooCommerce por REST API y automatiza con IA la auditoría de productos, el SEO, las imágenes, los precios, pedidos, clientes, cupones e inventario. Sin plugins adicionales.",
    badge: "WooCommerce + IA",
    group: "Servicios",
    tag: "WooCommerce",
    h1: "Automatización de tiendas WooCommerce con inteligencia artificial",
    subtitle: "Optimiza tu tienda WooCommerce sin migrar de plataforma: conexión directa por REST API v3 y la IA trabajando sobre tu catálogo real.",
    points: [
      { t: "Sin plugins adicionales", d: "Solo una Consumer Key (ck_) y un Consumer Secret (cs_). La plataforma lee y escribe por la API oficial." },
      { t: "Sin migrar", d: "Mejoras tu catálogo en el WooCommerce que ya tienes." },
      { t: "Ingresos contados una vez", d: "Los webhooks de pedidos alimentan tus métricas diarias sin duplicar." },
    ],
    sections: [
      {
        id: "que", h: "Qué gestionamos en WooCommerce",
        cards: [
          { t: "Productos", d: "Auditoría por ficha, rediseño de títulos y descripciones con IA, edición y precios." },
          { t: "Pedidos y clientes", d: "Listado, estado y datos de cliente para entender quién compra." },
          { t: "Cupones", d: "Consulta de los cupones activos y sus condiciones." },
          { t: "Inventario", d: "Stock por producto y variante, con alertas de rotura." },
          { t: "Informes de ventas", d: "Ingresos y pedidos por periodo." },
          { t: "Imágenes, SEO y pricing con IA", d: "Imágenes de producto generadas con IA, textos SEO de cada ficha y precio con COGS real." },
        ],
        note: "El A/B testing automático, las colecciones y los temas están disponibles solo para Shopify.",
      },
      {
        id: "ingresos", h: "Ingresos contados una sola vez",
        paras: ["Los webhooks de pedidos de WooCommerce alimentan tus métricas diarias: cada pedido cuenta una sola vez y se descuenta si se cancela, se reembolsa o se elimina. Así tus informes cuadran con tu contabilidad."],
      },
      {
        id: "recargo", h: "Por qué WooCommerce lleva un recargo",
        paras: ["En WooCommerce y PrestaShop se suma un recargo mensual de 20, 30 o 50 € según el pack: cubre los plugins y módulos de pago y SEO que actualizamos y probamos cada mes, y las copias que restauramos si algo se rompe. En Shopify lo hace la plataforma."],
      },
      {
        id: "otras", h: "WooCommerce o Shopify",
        paras: ["No hace falta cambiar de plataforma para usar IA. Si aun así estás valorando el cambio, lee la [comparativa Shopify vs WooCommerce](/shopify-vs-woocommerce) y la [guía de migración](/migrar-woocommerce-shopify)."],
      },
    ],
    packs: "store",
    faqs: [
      { q: "¿Tengo que instalar un plugin?", a: "No. Basta una Consumer Key y un Consumer Secret de la API REST de WooCommerce." },
      { q: "¿Qué no hacéis en WooCommerce?", a: "No gestionamos temas ni colecciones, y los tests A/B automáticos son solo de Shopify." },
      { q: "¿Cuánto cuesta?", a: "Packs desde 49 €/mes más recargo mensual de 20, 30 o 50 € según pack, y puesta en marcha desde 150 €. Sin IVA." },
    ],
    related: [
      { href: "/shopify-vs-woocommerce", label: "Shopify vs WooCommerce", desc: "Comparativa de criterio." },
      { href: "/migrar-woocommerce-shopify", label: "Migrar a Shopify", desc: "Guía por fases." },
      { href: "/gestion-stripe-ia", label: "Gestión de Stripe", desc: "Cobros y suscripciones." },
    ],
    cta: STORE_CTA,
  },

  /* ───────────────────────── Automatización PrestaShop ───────────────────────── */
  {
    path: "/automatizacion-prestashop-ia",
    canonical: "https://shopycrafter.com/automatizacion-prestashop-ia",
    metaTitle: "Automatización PrestaShop con IA: SEO, catálogo y pedidos — Shopy Crafter",
    metaDescription: "Conecta PrestaShop por Webservice y automatiza con IA el SEO de productos, categorías, imágenes, precios, pedidos e inventario. Para tiendas PrestaShop en España y Latinoamérica.",
    badge: "PrestaShop + IA",
    group: "Servicios",
    tag: "PrestaShop",
    h1: "Automatización de tiendas PrestaShop con inteligencia artificial",
    subtitle: "Tu PrestaShop, optimizado con IA a través del Webservice oficial: catálogo, SEO, categorías, pedidos e inventario desde un único panel.",
    points: [
      { t: "Webservice oficial", d: "Una clave de 32 caracteres con los permisos adecuados. Sin módulos de terceros." },
      { t: "SEO escrito en tu tienda", d: "Meta título y meta descripción por producto, directamente en PrestaShop." },
      { t: "Panel en español", d: "Panel, informes y contenido de la IA en español, con cortes diarios en zona horaria de Madrid." },
    ],
    sections: [
      {
        id: "que", h: "Qué gestionamos en PrestaShop",
        cards: [
          { t: "Productos", d: "Auditoría de fichas, rediseño con IA y edición." },
          { t: "SEO por producto", d: "Meta título y meta descripción escritos directamente en tu tienda." },
          { t: "Categorías", d: "Estructura del catálogo." },
          { t: "Pedidos", d: "Con los estados de PrestaShop: cancelado, reembolsado o error de pago no cuentan como venta." },
          { t: "Inventario", d: "Stock y alertas." },
          { t: "Imágenes y pricing con IA", d: "Imágenes de producto generadas con IA y precio con COGS real." },
        ],
        note: "El A/B testing automático, las colecciones y los temas están disponibles solo para Shopify.",
      },
      {
        id: "recargo", h: "Por qué PrestaShop lleva un recargo",
        paras: ["En PrestaShop y WooCommerce se suma un recargo mensual de 20, 30 o 50 € según el pack: cubre la actualización y prueba mensual de módulos y las copias que restauramos si algo se rompe. En Shopify lo hace la plataforma."],
      },
      {
        id: "otras", h: "¿Valorando otra plataforma?",
        paras: ["Consulta la [comparativa Shopify vs PrestaShop](/shopify-vs-prestashop) y la [guía de migración PrestaShop → Shopify](/migrar-prestashop-shopify)."],
      },
    ],
    packs: "store",
    faqs: [
      { q: "¿Necesito instalar un módulo?", a: "No. Usamos el Webservice oficial de PrestaShop con una clave y los permisos que tú le des." },
      { q: "¿Funciona con versiones antiguas?", a: "Depende de que tu Webservice esté disponible y activo. Lo comprobamos al conectar." },
      { q: "¿Cuánto cuesta?", a: "Packs desde 49 €/mes más recargo mensual de 20, 30 o 50 € según pack, y puesta en marcha desde 150 €. Sin IVA." },
    ],
    related: [
      { href: "/shopify-vs-prestashop", label: "Shopify vs PrestaShop", desc: "Comparativa de criterio." },
      { href: "/migrar-prestashop-shopify", label: "Migrar a Shopify", desc: "Guía por fases." },
      { href: "/gestion-stripe-ia", label: "Gestión de Stripe", desc: "Cobros y suscripciones." },
    ],
    cta: STORE_CTA,
  },

  /* ───────────────────────── Gestión de Stripe ───────────────────────── */
  {
    path: "/gestion-stripe-ia",
    canonical: "https://shopycrafter.com/gestion-stripe-ia",
    metaTitle: "Gestión de Stripe con IA: cobros, suscripciones y facturas — Shopy Crafter",
    metaDescription: "Gestiona tu cuenta Stripe desde un panel con IA: clientes, cobros, suscripciones, facturas, reembolsos, pagos a banco y balance. Stripe Connect y portal de cliente.",
    badge: "Stripe",
    group: "Servicios",
    tag: "Stripe",
    h1: "Gestión de Stripe: cobros, suscripciones y facturación en un solo panel",
    subtitle: "Conecta tu cuenta Stripe y gestiona clientes, cobros, suscripciones y facturas sin entrar en cinco pantallas distintas.",
    points: [
      { t: "Todo en un panel", d: "Clientes, cobros, suscripciones, facturas, reembolsos, payouts y balance." },
      { t: "Conexión segura", d: "Stripe Connect (OAuth) o clave secreta, guardada cifrada y rotable desde el panel." },
      { t: "Vista en tu portal", d: "Ves la actividad de tu cuenta en modo solo lectura." },
    ],
    sections: [
      {
        id: "que", h: "Qué gestionamos en Stripe",
        cards: [
          { t: "Clientes", d: "Alta y consulta de clientes." },
          { t: "Cobros", d: "Cobros puntuales desde el panel." },
          { t: "Suscripciones", d: "Consulta y cancelación." },
          { t: "Facturas", d: "Creación, envío y anulación." },
          { t: "Reembolsos", d: "Totales o parciales." },
          { t: "Payouts y balance", d: "Qué tienes disponible y qué está en camino." },
          { t: "Productos y transacciones", d: "Alta y baja de productos y precios, e historial de transacciones." },
        ],
      },
      {
        id: "seguridad", h: "Stripe Connect y claves seguras",
        paras: ["Puedes conectar tu cuenta mediante Stripe Connect (OAuth) o con tu clave secreta. Las claves se guardan cifradas y se pueden rotar desde el panel. Los webhooks de Stripe se verifican con firma."],
      },
      {
        id: "portal", h: "Portal de cliente con vista de Stripe",
        paras: ["Si trabajamos para ti, ves en tu portal la actividad de tu cuenta Stripe: cobros, clientes, facturas, suscripciones y pagos, en modo solo lectura. Los packs incluyen alertas de pagos fallidos y disputas."],
      },
      {
        id: "tienda", h: "Stripe con tu tienda online",
        paras: ["Stripe se combina con [Shopify](/automatizacion-shopify-ia), [WooCommerce](/automatizacion-woocommerce-ia) o [PrestaShop](/automatizacion-prestashop-ia). Para Shopify en concreto, lee la [guía de Stripe y Shopify](/shopify-stripe-pagos)."],
      },
    ],
    packs: "stripe",
    faqs: [
      { q: "¿Podéis mover dinero de mi cuenta?", a: "Gestionamos cobros, facturas y reembolsos dentro de lo que tú autorices. Los payouts a tu banco los ejecuta Stripe según tu configuración; nosotros los consultamos y conciliamos." },
      { q: "¿Qué datos ve mi equipo en el portal?", a: "Cobros, clientes, facturas, suscripciones y pagos de tu cuenta, en solo lectura." },
      { q: "¿Cuánto cuesta?", a: "Los packs de Stripe parten de 39 €/mes con puesta en marcha desde 90 €. Sin IVA." },
    ],
    related: [
      { href: "/shopify-stripe-pagos", label: "Stripe y Shopify", desc: "Qué comprobar al elegir cómo cobrar." },
      { href: "/automatizacion-shopify-ia", label: "Automatización Shopify", desc: "Catálogo, SEO y precios." },
      { href: "/tienda", label: "Tienda", desc: "Pago por Stripe en nuestros productos." },
    ],
    cta: { title: "¿Quieres ordenar tu cuenta Stripe?", text: "Revisamos tu cuenta y te proponemos un pack con lo que hay que vigilar y automatizar.", asunto: "Gestión de Stripe" },
  },

  /* ───────────────────────── Diseño web ───────────────────────── */
  {
    path: "/diseno-web-profesional",
    canonical: "https://shopycrafter.com/diseno-web-profesional",
    metaTitle: "Diseño web profesional con 3D, animación e IA — Shopy Crafter",
    metaDescription: "Diseñamos y desarrollamos webs y landings a medida: 3D con Three.js, animaciones con GSAP y diseño basado en el ADN de tu marca. Precios de partida en la Tienda.",
    badge: "Diseño web",
    group: "Servicios",
    tag: "Diseño y desarrollo web",
    h1: "Diseño y desarrollo web a medida, con 3D, animación e IA",
    subtitle: "Webs y landings diseñadas a partir del ADN de tu marca, con 3D en tiempo real y animaciones fluidas, sin plantillas genéricas.",
    points: [
      { t: "Parte de tu marca", d: "Colores, tipografías, tono y referencias visuales. Nada de plantilla repetida." },
      { t: "3D y animación con criterio", d: "Three.js y GSAP donde aportan, con la web rápida y adaptada a móvil." },
      { t: "Precio de partida claro", d: "Landing desde 990 €, web corporativa desde 1.690 €. El precio final depende del alcance." },
    ],
    sections: [
      {
        id: "como", h: "Cómo diseñamos",
        paras: ["Partimos del ADN de tu marca. Nuestro estudio de diseño con IA genera la propuesta en HTML real, que vemos en vivo y afinamos contigo antes de publicarla en tu dominio."],
      },
      {
        id: "tech", h: "Tecnologías que usamos",
        cards: [
          { t: "3D en tiempo real", d: "Three.js y React Three Fiber, modelos GLB y visores de producto." },
          { t: "Animación", d: "GSAP, ScrollTrigger, SplitType y scroll suave con Lenis." },
          { t: "Efectos", d: "Shaders, partículas, degradados animados y transiciones de página." },
          { t: "Componentes", d: "Bento grids, carruseles 3D, visualización de datos y secciones hero." },
        ],
      },
      {
        id: "servicios", h: "Qué puedes contratar",
        cards: [
          { t: "Landing con 3D y animación", d: "Una página de venta de hasta 6 secciones. Desde 990 €.", },
          { t: "Web corporativa", d: "Hasta 5 páginas con formulario y SEO técnico de base. Desde 1.690 €." },
          { t: "Rediseño de tienda online", d: "Portada, colección y ficha en Shopify, WooCommerce o PrestaShop. Desde 1.490 €." },
        ],
        note: "Precios de partida sin IVA; el presupuesto final se cierra según el alcance. Puedes pedirlos desde la [Tienda](/tienda).",
      },
      {
        id: "proyectos", h: "Proyectos reales",
        paras: ["Puedes ver algunos de nuestros trabajos en la sección de [proyectos realizados](/#fp-projects). Si tu web es una tienda, la combinamos con la optimización de catálogo con IA para [Shopify](/automatizacion-shopify-ia), [WooCommerce](/automatizacion-woocommerce-ia) o [PrestaShop](/automatizacion-prestashop-ia)."],
      },
    ],
    packs: "none",
    faqs: [
      { q: "¿Cuánto cuesta una web?", a: "Una landing parte de 990 € y una web corporativa de hasta 5 páginas de 1.690 €, sin IVA. El precio final depende del alcance, los idiomas y el material que aportes." },
      { q: "¿Cuánto se tarda?", a: "Depende del servicio; en la Tienda indicamos el plazo orientativo de cada uno y lo confirmamos en el presupuesto." },
      { q: "¿Puedo editar la web después?", a: "Lo acordamos al presupuestar: dejamos claro qué parte puedes editar tú y qué parte mantenemos nosotros." },
    ],
    related: [
      { href: "/tienda/landing-3d", label: "Landing con 3D y animación", desc: "Desde 990 €." },
      { href: "/tienda/web-corporativa", label: "Web corporativa", desc: "Desde 1.690 €." },
      { href: "/desarrollo-apps-nativas", label: "Apps nativas", desc: "Tu web como app." },
    ],
    cta: { title: "Cuéntanos qué web necesitas", text: "Dinos tu marca, tu objetivo y tus referencias y te enviamos un presupuesto cerrado.", asunto: "Diseño web" },
  },

  /* ───────────────────────── Apps nativas ───────────────────────── */
  {
    path: "/desarrollo-apps-nativas",
    canonical: "https://shopycrafter.com/desarrollo-apps-nativas",
    metaTitle: "Desarrollo de apps nativas Android e iOS — Shopy Crafter",
    metaDescription: "Convertimos tu web o tu tienda en app para Android e iOS con Capacitor: una sola base de código, notificaciones push y acceso al dispositivo. Nuestra propia app Android es el ejemplo.",
    badge: "Apps nativas",
    group: "Servicios",
    tag: "Apps móviles",
    h1: "Desarrollo de apps para Android e iOS",
    subtitle: "Tu web o tu tienda como app instalable, con notificaciones push y experiencia nativa, a partir de una sola base de código.",
    points: [
      { t: "Una sola base de código", d: "Tu web (React) empaquetada con Capacitor para Android e iOS." },
      { t: "Notificaciones push", d: "Avisos en el móvil de pedidos, mensajes o novedades." },
      { t: "Presupuesto cerrado", d: "Antes de empezar acordamos alcance y precio; no hay tarifa publicada porque depende del proyecto." },
    ],
    sections: [
      {
        id: "prueba", h: "Nuestra propia app como prueba",
        paras: ["Shopy Crafter tiene su propia app Android, construida con Capacitor sobre la misma base de código que la plataforma web. Puedes verla desde nuestra [página principal](/)."],
      },
      {
        id: "como", h: "Cómo construimos las apps",
        cards: [
          { t: "Capacitor", d: "Una sola base de código web empaquetada como app nativa." },
          { t: "Notificaciones push", d: "Avisos en el móvil para pedidos, mensajes o novedades." },
          { t: "Acceso al dispositivo", d: "Cámara, archivos y almacenamiento cuando la app lo necesita." },
          { t: "Publicación", d: "Preparamos la app para Google Play y App Store." },
        ],
      },
      {
        id: "para", h: "Para qué proyectos encaja",
        paras: ["Tiendas online que quieren fidelizar con una app, paneles internos para equipos y portales de cliente. Si ya tienes web, partimos de ella; si no, la [diseñamos](/diseno-web-profesional) pensando desde el principio en web y app."],
      },
    ],
    packs: "none",
    faqs: [
      { q: "¿Cuánto cuesta una app?", a: "Depende del proyecto, así que se presupuesta antes de empezar y el presupuesto es cerrado. Puedes pedirlo desde la Tienda o por el formulario de contacto." },
      { q: "¿Android e iOS?", a: "Con Capacitor la misma base sirve para ambas. Publicar en App Store requiere una cuenta de desarrollador de Apple, que se acuerda al presupuestar." },
      { q: "¿La app se actualiza con la web?", a: "Depende de cómo se empaquete; lo definimos contigo en el presupuesto." },
    ],
    related: [
      { href: "/tienda/app-nativa", label: "App nativa en la Tienda", desc: "Pide presupuesto." },
      { href: "/diseno-web-profesional", label: "Diseño web profesional", desc: "Web y landing a medida." },
      { href: "/sobre-nosotros", label: "Sobre nosotros", desc: "Quiénes somos." },
    ],
    cta: { title: "¿Tienes una idea de app?", text: "Cuéntanos qué quieres que haga y te enviamos un presupuesto cerrado.", asunto: "App nativa" },
  },
];

/* ── HTML para el prerender (rastreadores sin JS): mismo contenido que ve la persona, sin estilos. ── */
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (t: string) =>
  esc(t)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

function toHtml(p: PageSource): string {
  const out: string[] = [];
  out.push(...p.points.map(x => `<p><strong>${esc(x.t)}.</strong> ${inline(x.d)}</p>`));
  if (p.table) {
    const t = p.table;
    out.push(`<table><caption>${esc(t.caption)}</caption><thead><tr>${t.head.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>`
      + t.rows.map(r => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join("") + "</tbody></table>");
    if (t.note) out.push(`<p>${esc(t.note)}</p>`);
  }
  for (const s of p.sections) {
    out.push(`<h2>${esc(s.h)}</h2>`);
    if (s.intro) out.push(`<p>${inline(s.intro)}</p>`);
    s.paras?.forEach(x => out.push(`<p>${inline(x)}</p>`));
    if (s.cards) out.push("<ul>" + s.cards.map(c => `<li><strong>${esc(c.t)}:</strong> ${inline(c.d)}</li>`).join("") + "</ul>");
    if (s.steps) out.push("<ol>" + s.steps.map(c => `<li><strong>${esc(c.t)}:</strong> ${inline(c.d)}</li>`).join("") + "</ol>");
    if (s.bullets) out.push("<ul>" + s.bullets.map(b => `<li>${inline(b)}</li>`).join("") + "</ul>");
    if (s.note) out.push(`<p>${inline(s.note)}</p>`);
  }
  if (p.faqs.length) {
    out.push("<h2>Preguntas frecuentes</h2>");
    p.faqs.forEach(f => out.push(`<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`));
  }
  out.push("<h2>Sigue leyendo</h2><ul>" + p.related.map(r => `<li><a href="${r.href}">${esc(r.label)}</a>: ${esc(r.desc)}</li>`).join("") + "</ul>");
  return out.join("\n");
}

const COMPARISON_PAGES: ComparisonPage[] = PAGE_SOURCES.map(p => ({ ...p, body: toHtml(p) }));

export const COMPARISON_DATA: Record<string, ComparisonPage> = Object.fromEntries(
  COMPARISON_PAGES.map(p => [p.path, p])
);

export function getComparisonPage(path: string): ComparisonPage | undefined {
  return COMPARISON_DATA[path];
}
