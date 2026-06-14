export interface Release {
  version: string;
  date: string;
  tag: string;
  title: string;
  changes: string[];
  description?: string;
}

export const RELEASES: Release[] = [
  {
    version: "3.8.0",
    date: "2026-04-30",
    tag: "Major",
    title: "ShopyBrain OmniCore v3",
    description: "La mayor actualización del motor de memoria e inteligencia acumulada de Shopy Crafter. OmniCore v3 introduce aprendizaje continuo entre proyectos, sincronización de conocimiento multi-cuenta y un sistema de dominios de conocimiento especializado por sector de eCommerce.",
    changes: [
      "Nuevo motor de aprendizaje continuo con 46.890+ insights acumulados",
      "Brain Sync: sincronización automática de conocimiento entre proyectos",
      "Sistema de dominios de conocimiento (43 dominios activos)",
      "Dashboard de memorias con búsqueda semántica avanzada",
    ],
  },
  {
    version: "3.7.0",
    date: "2026-04-12",
    tag: "Feature",
    title: "Ad Studio + Campaign Kit",
    description: "Dos nuevos motores para cubrir toda la cadena de marketing de pago y planificación de campañas. Ad Studio genera creatividades y copy listo para publicar en Meta, Google y TikTok. Campaign Kit orquesta campañas completas con calendario de contenido, presupuesto y estrategia por canal.",
    changes: [
      "Nuevo motor Ad Studio para creación de anuncios multi-plataforma",
      "Campaign Kit para planificación integral de campañas",
      "Soporte para Meta Ads, Google Ads y TikTok Ads",
      "Generación automática de variantes por audiencia objetivo",
    ],
  },
  {
    version: "3.6.0",
    date: "2026-03-28",
    tag: "Feature",
    title: "Economista IA (Pricing COGS)",
    description: "El motor más solicitado por nuestra comunidad: análisis automático de costes reales de producto y fijación de precio óptimo con IA. Cubre las 9 categorías de COGS (coste de bienes vendidos) con 30+ campos de detalle, y calcula el precio de venta recomendado según el margen objetivo y la competencia del mercado.",
    changes: [
      "9 categorías de COGS con 30+ campos de coste detallados",
      "Estimación automática dual (Claude + Gemini) de costes",
      "Cálculo de precio óptimo con análisis de competencia",
      "Waterfall de margen y análisis break-even integrado",
      "Simulador LTV/CAC con proyecciones a 12 meses",
    ],
  },
  {
    version: "3.5.0",
    date: "2026-03-10",
    tag: "Feature",
    title: "A/B Testing con predicción IA",
    description: "El motor de A/B Testing ahora incluye predicción de resultados antes de ejecutar el experimento, basada en datos históricos de tests similares en el mismo nicho. Esto permite priorizar qué tests lanzar primero y estimar el impacto esperado en revenue antes de comprometer tráfico.",
    changes: [
      "Predicción de resultados antes de ejecutar el test (revenue, margen, conversión)",
      "Auto-winner con 95% de confianza estadística",
      "Soporte para tests de imagen, precio y descripción",
      "Dashboard con métricas en tiempo real y reportes exportables",
    ],
  },
  {
    version: "3.4.0",
    date: "2026-02-20",
    tag: "Feature",
    title: "Fusion Studio + Exploded View",
    description: "Actualización mayor de las capacidades creativas de la plataforma. Fusion Studio estrena un canvas interactivo multi-capa con soporte para composiciones complejas. Exploded View introduce un tipo de imagen completamente nuevo: vistas despiece de producto generadas por IA, especialmente útiles para productos técnicos.",
    changes: [
      "Editor creativo multi-capa con canvas interactivo",
      "Fusion Studio Pro para composiciones avanzadas",
      "Exploded View: visualización desglosada de productos",
      "Export a PNG/JPG/WebP en alta resolución",
    ],
  },
  {
    version: "3.3.0",
    date: "2026-02-05",
    tag: "Mejora",
    title: "Sistema de Logros y Gamificación",
    description: "Shopy Crafter introduce un sistema de logros y progresión para mantener la motivación del equipo y facilitar la adopción de buenas prácticas de eCommerce. El roadmap personalizado 30-60-90 días guía al usuario por las acciones de mayor impacto según su situación de partida.",
    changes: [
      "10 logros con XP y niveles de progreso",
      "Roadmap personalizado 30-60-90 días por proyecto",
      "Notificaciones de hitos alcanzados",
      "Panel de automatizaciones con scheduling",
    ],
  },
  {
    version: "3.2.0",
    date: "2026-01-15",
    tag: "Mejora",
    title: "Command Center + Universal Search",
    description: "Rediseño del centro de operaciones de la plataforma. El Command Center centraliza el estado de todos los motores activos, automatizaciones en curso y métricas clave en una vista única. La búsqueda universal permite encontrar cualquier producto, proyecto o configuración desde cualquier pantalla.",
    changes: [
      "Centro de control unificado con overview del sistema",
      "Búsqueda universal cross-project y cross-módulo",
      "Vault mejorado con 7 categorías y 95+ archivos",
      "Inteligencia competitiva con 24 competidores trackeados",
    ],
  },
];
