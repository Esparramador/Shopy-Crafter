export const AI_SERVICES_CATEGORY = "ai-services";

export interface ShopServiceVariant {
  label: string;
  detail: string;
  subject: string;
}

export interface ShopServiceOffer {
  group: "agents" | "ads";
  icon: "assistant" | "chatbot" | "custom" | "ads";
  name: string;
  description: string;
  variants: ShopServiceVariant[];
}

export const SHOP_SERVICE_OFFERS: ShopServiceOffer[] = [
  {
    group: "agents",
    icon: "assistant",
    name: "Asistente virtual conversacional",
    description:
      "Atiende conversaciones por WhatsApp y teléfono con respuestas y flujos adaptados a tu negocio.",
    variants: [
      {
        label: "Solo diseño",
        detail: "Diseño del agente y sus conversaciones, sin conectarlo ni configurarlo.",
        subject: "Diseño de asistente virtual para WhatsApp y teléfono, sin configuración",
      },
      {
        label: "Integración y configuración",
        detail: "Conexión con tus canales y puesta a punto; requiere trabajo de configuración.",
        subject: "Integración y configuración de asistente virtual para WhatsApp y teléfono",
      },
      {
        label: "App personalizada opcional",
        detail: "Añade una app propia conectada al asistente y a tu flujo de trabajo.",
        subject: "Asistente virtual con app personalizada",
      },
    ],
  },
  {
    group: "agents",
    icon: "chatbot",
    name: "Chatbot conversacional para web",
    description:
      "Un chatbot para tu landing o web que responde preguntas y orienta a cada visitante hacia el siguiente paso.",
    variants: [
      {
        label: "Diseño del chatbot",
        detail: "Definimos el tono, los contenidos y los flujos de conversación.",
        subject: "Diseño de chatbot conversacional para landing o web",
      },
      {
        label: "Integración y configuración",
        detail: "Lo conectamos a tu web y configuramos sus respuestas y recorridos.",
        subject: "Integración y configuración de chatbot para web",
      },
    ],
  },
  {
    group: "agents",
    icon: "custom",
    name: "Agente de IA a medida",
    description:
      "Diseñamos agentes para tareas concretas, con las skills y herramientas que necesita el trabajo.",
    variants: [
      {
        label: "Solo diseño",
        detail: "Definición del agente y sus instrucciones; se entrega sin configurar.",
        subject: "Diseño de agente de IA a medida con skills",
      },
      {
        label: "Conexión y puesta en marcha",
        detail: "Integramos y configuramos el agente; el alcance y el tiempo se acuerdan antes.",
        subject: "Integración y configuración de agente de IA a medida con skills",
      },
      {
        label: "App personalizada opcional",
        detail: "Una aplicación propia para usar el agente en tu proceso.",
        subject: "Agente de IA a medida con app personalizada",
      },
    ],
  },
  {
    group: "ads",
    icon: "ads",
    name: "Campañas de Google Ads",
    description:
      "Preparación de campañas y seguimiento según tus objetivos, sector y presupuesto publicitario.",
    variants: [
      {
        label: "Configuración inicial",
        detail: "Estructura, anuncios y medición acordados antes de activar la campaña.",
        subject: "Configuración inicial de campañas de Google Ads",
      },
      {
        label: "Gestión continua",
        detail: "Revisión y ajustes periódicos; inversión publicitaria aparte del servicio.",
        subject: "Gestión continua de campañas de Google Ads",
      },
    ],
  },
];

export function shopServiceContactHref(subject: string): string {
  return `/contacto?asunto=${encodeURIComponent(subject.trim().slice(0, 120))}`;
}
