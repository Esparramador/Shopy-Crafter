/**
 * Preguntas frecuentes: datos puros (sin imports de navegador) para que la página /faq y el
 * prerender (JSON-LD FAQPage) lean exactamente la misma lista.
 *
 * Regla de contenido: cada cifra de aquí se puede comprobar en el repositorio
 * (api-server/src/lib/plan-catalog.ts, shop.ts, Terminos.tsx). Precios siempre «desde»; la puesta en
 * marcha es un pago único aparte de la mensualidad. Si cambian los packs, se cambia aquí también.
 */
export interface FaqItem { q: string; a: string }
export interface FaqGroup { title: string; items: FaqItem[] }

export const FAQ_GROUPS: FaqGroup[] = [
  {
    title: "General",
    items: [
      {
        q: "¿Qué es Shopy Crafter?",
        a: "Shopy Crafter es una plataforma de IA y un equipo que la opera para tu tienda online: auditoría de fichas de producto, SEO, imágenes, precios con el coste real (COGS), tests A/B en Shopify, informes y un asistente IA, conectados por API a Shopify, WooCommerce y PrestaShop, más gestión de cobros en Stripe. Además hacemos diseño web, apps nativas y productos de nuestro taller láser, que puedes ver en la Tienda (/tienda).",
      },
      {
        q: "¿Necesito conocimientos técnicos?",
        a: "No. Conectamos tu tienda, activamos los motores y te formamos. Después trabajas desde un portal de cliente donde ves las propuestas, las apruebas o las rechazas, y hablas con nosotros por mensajes.",
      },
      {
        q: "¿Con qué plataformas funciona?",
        a: "Conexión por API con Shopify, WooCommerce (REST API v3) y PrestaShop (Webservice), y con Stripe para cobros y finanzas. Los tests A/B de imagen y precio están disponibles solo en tiendas Shopify. Cualquier otra web se puede auditar a partir de su URL pública.",
      },
      {
        q: "¿Cuánto tarda en verse resultados?",
        a: "Depende del punto de partida de tu tienda y de tu tráfico, y no te prometemos cifras. Empezamos con una auditoría que puntúa cada producto y registramos a diario tus ingresos y pedidos reales, para que midas el antes y el después con tus propios datos.",
      },
    ],
  },
  {
    title: "Precios y packs",
    items: [
      {
        q: "¿Cuánto cuesta?",
        a: "Los packs de tienda (Shopify, WooCommerce y PrestaShop) son Starter desde 49 €/mes, Growth desde 149 €/mes y Enterprise desde 399 €/mes, sin IVA. Los packs de Stripe van desde 39 €/mes. Hay también un pack a medida con presupuesto. El precio final depende de tu plataforma y de lo que haya que montar, y te lo damos por escrito antes de empezar.",
      },
      {
        q: "¿Qué es la puesta en marcha y cuánto cuesta?",
        a: "Es un pago único, separado de la mensualidad, para conectar tu tienda, activar los motores, formarte y hacer la primera revisión. En los packs de tienda parte desde 150 € (Starter), 350 € (Growth) y 750 € (Enterprise), y en WooCommerce y PrestaShop se añade un recargo desde 100 €. Si hay que cargar y optimizar catálogo, rediseñar páginas, crear identidad de marca o integrar un sistema que ya tienes, se presupuesta antes.",
      },
      {
        q: "¿Qué incluye cada pack?",
        a: "Todos los packs de tienda incluyen 1 tienda conectada, auditoría y rediseño de fichas con IA, SEO técnico de producto, pricing con COGS, portal de cliente (aprobaciones, mensajes e informes) y asistente IA. Se diferencian en las cuotas mensuales: Starter hasta 15 productos y 45 imágenes, Growth hasta 60 productos y 300 imágenes, Enterprise hasta 200 productos y 1.200 imágenes, además de auditorías SEO, análisis de competencia, informes y tiempo de respuesta.",
      },
      {
        q: "¿Hay descuento por pago anual?",
        a: "Sí. El pago anual cobra 10 mensualidades en lugar de 12, es decir, dos meses gratis.",
      },
      {
        q: "¿Los precios incluyen IVA?",
        a: "Los precios de los packs y de la puesta en marcha se indican sin IVA, que se añade en la factura. Los productos de la Tienda (/tienda) muestran su precio con IVA incluido.",
      },
      {
        q: "¿Puedo cancelar en cualquier momento?",
        a: "Sí. Puedes cancelar desde el panel de facturación y tu acceso se mantiene hasta el final del periodo ya pagado. Los pagos son por adelantado y no reembolsables salvo error nuestro o lo que prevea la normativa de consumidores; los datos se conservan 30 días más por si quieres reactivar. Está detallado en los Términos (/terminos).",
      },
      {
        q: "¿Puedo probarlo antes de contratar?",
        a: "Cuéntanos tu tienda en Contacto (/contacto) y te preparamos una propuesta sin compromiso con lo que haríamos, en qué orden y cuánto costaría. No damos por hecha ninguna prueba gratuita: lo que haya se te confirma por escrito en la propuesta.",
      },
    ],
  },
  {
    title: "Tienda y taller láser",
    items: [
      {
        q: "¿Qué vendéis en la Tienda?",
        a: "Productos del taller láser (tarjetas de aluminio, placas QR, expositores, kits para negocios, fotos grabadas y regalos 3D) y servicios digitales (webs y diseño, vídeo y animación 3D, y servicios de Google y reseñas). Todo está en la Tienda (/tienda).",
      },
      {
        q: "¿Cómo se paga y cuándo se entrega?",
        a: "El pago es seguro con Stripe, y el precio de cada línea se calcula en el servidor, con IVA incluido. Cada producto indica su plazo de entrega en la ficha. Los servicios a medida se presupuestan antes de empezar.",
      },
      {
        q: "¿Puedo personalizar un producto?",
        a: "Sí. Muchos productos piden en la ficha tu logo, textos o archivos para personalizarlos antes de pagar. Si lo que necesitas no está en el catálogo, escríbenos en Contacto (/contacto).",
      },
    ],
  },
  {
    title: "Webs y apps",
    items: [
      {
        q: "¿Hacéis webs y apps?",
        a: "Sí: diseño web profesional (/diseno-web-profesional), rediseño de tiendas, apps nativas Android e iOS (/desarrollo-apps-nativas) y eCommerce con IA (/ecommerce-ia-automatizacion). El rediseño de portada, colección y ficha de producto parte desde 1.490 € y se presupuesta según las plantillas y colecciones que haya que hacer.",
      },
      {
        q: "¿Puedo ver proyectos vuestros?",
        a: "Sí, en los casos de éxito (/casos-de-exito) y en la sección de proyectos de la página principal (/#fp-projects).",
      },
    ],
  },
  {
    title: "Inteligencia artificial",
    items: [
      {
        q: "¿Qué modelos de IA utilizáis?",
        a: "Combinamos Claude (Anthropic) y Gemini (Google) para texto y análisis, y modelos de generación de imagen a través de Replicate. Cada motor usa el modelo que mejor encaja con su tarea.",
      },
      {
        q: "¿Revisáis lo que genera la IA antes de publicarlo?",
        a: "Tú decides. Puedes dejar que ciertos cambios se apliquen solos o pasar cada propuesta por el panel de aprobaciones de tu portal: la ves, la apruebas o la rechazas, y solo entonces se publica. Recomendamos revisarlo todo al principio y automatizar lo que ya has comprobado.",
      },
      {
        q: "¿Puedo usar comercialmente lo que se genera?",
        a: "El contenido que generes con la plataforma (textos, imágenes, informes) es tuyo, sin perjuicio de las licencias de los modelos subyacentes, según nuestros Términos (/terminos). Revisa siempre textos e imágenes antes de publicarlos.",
      },
      {
        q: "¿Las auditorías son automáticas?",
        a: "Puedes lanzar una auditoría cuando quieras desde la plataforma. Según tu pack, también se programan tareas periódicas como la revisión de PageSpeed y los informes (mensuales, quincenales o semanales).",
      },
    ],
  },
  {
    title: "Seguridad y privacidad",
    items: [
      {
        q: "¿Mis datos están seguros?",
        a: "Las conexiones van cifradas, las credenciales de tu tienda y de Stripe se guardan cifradas y cada cliente solo accede a su propio proyecto. Tratamos los datos conforme al RGPD; el detalle está en la política de privacidad (/privacidad).",
      },
      {
        q: "¿Compartís mis datos con terceros?",
        a: "No los vendemos ni los cedemos. Los proveedores tecnológicos que usamos (alojamiento, IA, pagos) actúan como encargados del tratamiento. Puedes pedirnos la lista en craftershopy@gmail.com.",
      },
    ],
  },
];

/** Todas las preguntas en plano (para el JSON-LD FAQPage del prerender). */
export const FAQ_FLAT: FaqItem[] = FAQ_GROUPS.flatMap(g => g.items);
