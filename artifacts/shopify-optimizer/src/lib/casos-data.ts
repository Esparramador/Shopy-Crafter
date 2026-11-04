/**
 * Proyectos y casos de Shopy Crafter.
 *
 * Todo sale de proyectos reales del propio repositorio (api-server/src/routes/portfolio-seed.ts y las
 * capturas de public/portfolio/): qué hace cada sistema, con qué está hecho y en qué estado está.
 * Sin cifras de resultados, sin testimonios y sin clientes que no estén ya en el portfolio público.
 * Si se añade un caso, debe poder comprobarse igual de bien.
 */
export interface CasoImagen { src: string; alt: string; w: number; h: number }

export interface Caso {
  slug: string;
  name: string;
  /** Tipo de trabajo, en una línea. */
  niche: string;
  category: string;
  status: string;
  client: string;
  headline: string;
  summary: string;
  /** Párrafos de la descripción: el primero plantea el problema, el resto cuenta cómo se resolvió. */
  paragraphs: string[];
  features: string[];
  tech: string[];
  images: CasoImagen[];
  /** Siguiente paso natural para quien lee el caso. */
  cta: { href: string; label: string };
}

export const CASES: Caso[] = [
  {
    slug: "brasas-y-paellas",
    name: "Brasa y Paellas",
    niche: "Software a medida para restaurantes",
    category: "Sistemas a medida",
    status: "En producción",
    client: "Brasa y Paellas",
    headline: "Brasa y Paellas · sistema integral del restaurante",
    summary: "El restaurante entero en un solo sistema hecho a medida: carta digital por QR con IA, TPV de sala, pantalla de cocina, panel de gestión y facturación preparada para VeriFactu.",
    paragraphs: [
      "El restaurante trabajaba con papel, una caja y varias herramientas que no se hablaban. Construimos un único sistema que une sala, cocina, carta y gestión, instalado en el ordenador del local y accesible desde cualquier móvil o tablet de la casa.",
      "El cliente escanea el QR de su mesa, ve la carta en su idioma y pide. El pedido llega a la sala y a la cocina en el momento, cada pantalla enseña solo lo que le toca, y la cuenta sale del mismo sitio. El dueño cambia un precio o una foto desde el panel y lo ve toda la sala al instante.",
      "Está hecho para un restaurante de verdad: sigue funcionando si se cae internet, guarda copia de todo y se puede replicar en otro local con su propia marca. Es la base sobre la que se conectan la carta por QR y la recepcionista de IA del mismo restaurante."
    ],
    features: [
      "Carta digital por QR con camarero de IA que recomienda y resuelve dudas",
      "TPV de sala con plano de mesas, cuentas y cobro",
      "Pantalla de cocina (KDS) con los pedidos en tiempo real",
      "Panel de gestión: carta, precios, fotos, alérgenos y traducciones",
      "Usuarios y fichajes del equipo",
      "Facturación preparada para VeriFactu (AEAT): numeración, huella y QR fiscal",
      "Seis interfaces sincronizadas en tiempo real, sin recargar",
      "Funciona sin internet y se instala en el ordenador del local",
      "Copias de seguridad y arranque con doble clic",
      "Replicable: cada restaurante nuevo, con su marca y sus datos"
    ],
    tech: ["Python", "JavaScript", "IA conversacional", "VeriFactu", "Tiempo real", "Offline-first", "QR dinámicos"],
    images: [
      { src: "/portfolio/brasas-y-paellas-2.webp", alt: "TPV de sala", w: 1600, h: 1012 },
      { src: "/portfolio/brasas-y-paellas-3.webp", alt: "Pantalla de cocina", w: 1600, h: 937 },
      { src: "/portfolio/brasas-y-paellas-1.webp", alt: "Sistema completo de Brasa y Paellas", w: 1600, h: 1605 },
      { src: "/portfolio/brasas-y-paellas-4.webp", alt: "Camarero con IA en la carta", w: 860, h: 1800 }
    ],
    cta: { href: "/contacto", label: "Quiero un sistema así para mi local" },
  },
  {
    slug: "brasas-caller",
    name: "Brasas Caller",
    niche: "Asistente telefónico y WhatsApp con IA",
    category: "Sistemas a medida",
    status: "En producción",
    client: "Brasa y Paellas · Bar Alexanca",
    headline: "Brasas Caller · robot conversacional y centro de mando del restaurante",
    summary: "Un robot conversacional que contesta el teléfono y el WhatsApp del restaurante, y Brasas Caller, la app donde queda anotado todo lo que hace. Conectada a la carta por QR y al TPV: todo el local, en una sola app.",
    paragraphs: [
      "Son dos piezas que trabajan como una. La primera es Aina, el robot conversacional: descuelga el teléfono y responde los WhatsApp con el tono de la casa, de día y de noche. Sabe la carta, los horarios y las normas del local, comprueba si de verdad hay mesa y deja la reserva hecha. Cuando el caso lo pide (un grupo grande, un encargo de paella, una franja casi llena, un pedido para llevar) no decide sola: se lo pasa al jefe.",
      "La segunda es Brasas Caller, la app del restaurante. Es donde el robot lo anota todo: cada reserva con su mesa, cada cliente con su historial, cada conversación entera. El jefe abre la app y ve el día, el plano de sala por horas y lo que espera su visto bueno; aprueba con un toque y el cliente recibe la confirmación por WhatsApp.",
      "Y no está sola. Brasas Caller está vinculada al Smart Menú (la carta de los QR se edita desde la misma app) y al TPV del local (el plano de mesas, las comandas y los pedidos). Reservas, carta, sala y caja dejan de ser cuatro programas: se llevan desde un único sitio, conectados entre sí y con los datos en el ordenador del propio restaurante."
    ],
    features: [
      "Robot conversacional que atiende el teléfono con voz natural y el WhatsApp",
      "Todo lo que hace queda anotado en la app: reservas, clientes y conversaciones",
      "Reserva con un motor de aforo real: mesas, turnos y topes por franja",
      "Reglas del jefe: qué confirma sola y qué espera su visto bueno",
      "Plano de sala por horas: mover, juntar mesas y sentar con el dedo",
      "Vinculada al Smart Menú: la carta de los QR se gestiona desde la misma app",
      "Vinculada al TPV: plano de mesas, comandas y pedidos para llevar",
      "CRM que se llena solo: visitas, ticket medio y ausencias",
      "Confirmaciones y recordatorios por WhatsApp, con bandeja para contestar a mano",
      "App Android con PIN, roles (jefe y encargado) y avisos al móvil",
      "Calendario de Google y encargos de paella con su fianza calculada",
      "Los datos viven en el ordenador del restaurante, no en la nube de un tercero"
    ],
    tech: ["Python", "FastAPI", "IA conversacional", "Voz en tiempo real", "Twilio", "WhatsApp Business", "Android", "SQLite", "Google Calendar"],
    images: [
      { src: "/portfolio/brasas-caller-1.webp", alt: "El día del restaurante: reservas y pendientes de aprobar", w: 780, h: 1689 },
      { src: "/portfolio/brasas-caller-2.webp", alt: "Plano de sala por horas", w: 780, h: 1689 },
      { src: "/portfolio/brasas-caller-3.webp", alt: "Réplica del plano del TPV en el móvil", w: 780, h: 1689 },
      { src: "/portfolio/brasas-caller-4.webp", alt: "Entrada con PIN a la app del jefe", w: 780, h: 1689 }
    ],
    cta: { href: "/contacto", label: "Quiero un asistente para mi negocio" },
  },
  {
    slug: "smart-menu-qr",
    name: "Smart Menú",
    niche: "Carta digital con QR dinámico",
    category: "Sistemas a medida",
    status: "En producción",
    client: "Hostelería",
    headline: "Smart Menús interactivos con QR dinámicos",
    summary: "La carta deja de ser un PDF: una carta interactiva en 16 idiomas, con alérgenos, fotos y pedido desde la mesa, detrás de un QR que se puede cambiar sin reimprimir.",
    paragraphs: [
      "Una carta que vende. El cliente la abre con el QR de su mesa, sin instalar nada, en su idioma y con la moneda que elija. Filtra por alérgenos o por dieta, ve la información nutricional de cada plato, le pregunta a un camarero de IA qué le recomienda y puede pedir desde el móvil.",
      "Los QR son dinámicos: si cambia la carta, la web o la promoción, se cambia el destino desde el panel y el papel impreso sigue valiendo. Cada mesa tiene el suyo, así el pedido llega sabiendo de dónde viene, y cada QR cuenta cuántas veces se escanea, qué día y a qué hora.",
      "Se entrega con los cartelitos de mesa listos para imprenta y con el diseño adaptado a la marca del local. Funciona solo o conectado al TPV y a la app del restaurante, que es como lo tiene Brasa y Paellas."
    ],
    features: [
      "16 idiomas y cambio de divisa",
      "Los 14 alérgenos de la UE y filtros de dieta automáticos",
      "Información nutricional y maridajes por plato",
      "Camarero de IA que recomienda y resuelve dudas",
      "Pedido desde la mesa, directo a sala y cocina",
      "Un QR por mesa, que se reapunta sin reimprimir",
      "Estadísticas de escaneos por QR, día y hora",
      "Seis temas visuales adaptados a la marca del local",
      "Cartelitos de mesa listos para imprenta",
      "Conectable al TPV y a la app de gestión del restaurante"
    ],
    tech: ["JavaScript", "QR dinámicos", "Cloudflare Workers", "i18n", "IA conversacional"],
    images: [
      { src: "/portfolio/smart-menu-qr-1.webp", alt: "Smart Menú en el móvil del cliente", w: 860, h: 1800 }
    ],
    cta: { href: "/contacto", label: "Quiero una carta digital" },
  },
  {
    slug: "rastalo-tpv",
    name: "RastaLo TPV",
    niche: "TPV a medida con asistente de voz",
    category: "Sistemas a medida",
    status: "En producción",
    client: "Rasta Lo Barcelona",
    headline: "RastaLo TPV · un Jarvis para llevar el negocio",
    summary: "Un TPV a medida con Antonia dentro: una asistente tipo Jarvis a la que se le habla y hace el trabajo de verdad. Cobra, agenda, busca clientas, saca informes y maneja el ordenador.",
    paragraphs: [
      "No es un TPV con un micrófono añadido. Antonia está siempre a la escucha: se la llama por su nombre o con dos palmadas, entiende la orden y la ejecuta dentro del sistema. «Ponme una cita a María el jueves a las cinco», «cóbrale el servicio», «¿cuánto llevamos este mes?», «ordena las facturas por fecha». Cada paso queda a la vista: lo que ha hecho, y lo que no ha podido hacer y por qué.",
      "Debajo hay un TPV completo hecho a la medida de un salón: servicios por categorías, comanda por silla, cobro en efectivo, tarjeta o partido, agenda de citas, fichas de clientas con sus visitas y su gasto, stock, devoluciones y descuentos. Y la parte que nadie quiere llevar a mano: fichajes y nóminas del equipo, caja, gastos, informes y resultado del mes, facturación con sus series y la contabilidad separada por titular, preparada para los modelos trimestrales y para VeriFactu.",
      "Antonia también sale del TPV: abre programas, ordena archivos, genera imágenes y vídeos para las redes del negocio y estudia a la competencia. Se instala en el ordenador del local con doble clic y funciona en Windows y en Mac."
    ],
    features: [
      "Conversación por voz en directo: se le habla y se le puede interrumpir",
      "Se despierta por su nombre o con dos palmadas",
      "45 herramientas reales: cobrar, crear citas, buscar, facturar, informar",
      "Caja con comanda por silla y cobro en efectivo, tarjeta o partido",
      "Agenda de citas y fichas de clientas con visitas y gasto",
      "Panel del negocio: ventas, servicios más vendidos y resultado del mes",
      "Equipo: fichajes, nóminas y rendimiento por trabajadora",
      "Contabilidad por titular, series de factura y resumen para los modelos 303 y 130",
      "Controla el ordenador para tareas fuera del TPV",
      "Genera imágenes y vídeo para las redes del negocio",
      "Enseña cada acción: hecha, o no hecha y el motivo",
      "Tres temas visuales y perfiles con PIN"
    ],
    tech: ["Python", "FastAPI", "JavaScript", "Voz en tiempo real", "IA con herramientas", "TPV", "VeriFactu", "Windows y macOS"],
    images: [
      { src: "/portfolio/rastalo-tpv-1.webp", alt: "Caja: servicios, comanda por silla y cobro", w: 1600, h: 1000 },
      { src: "/portfolio/rastalo-tpv-2.webp", alt: "Panel del negocio: ventas, servicios más vendidos y resultado del mes", w: 1600, h: 1000 },
      { src: "/portfolio/rastalo-tpv-3.webp", alt: "Agenda de citas del día", w: 1600, h: 1000 },
      { src: "/portfolio/rastalo-tpv-4.webp", alt: "Fichas de clientas con visitas y gasto", w: 1600, h: 1000 },
      { src: "/portfolio/rastalo-tpv-5.webp", alt: "Antonia a la escucha dentro del TPV", w: 1600, h: 1000 },
      { src: "/portfolio/rastalo-tpv-6.webp", alt: "Antonia ejecuta una orden dicha en voz alta", w: 1440, h: 900 }
    ],
    cta: { href: "/contacto", label: "Quiero un TPV a medida" },
  },
  {
    slug: "crafter-eventos",
    name: "Crafter Eventos",
    niche: "Producto propio · galería de eventos por QR",
    category: "Webs y apps",
    status: "En producción",
    client: "Producto propio",
    headline: "Crafter Eventos · galería de fotos por QR",
    summary: "Los invitados escanean el QR de la mesa y suben sus fotos y vídeos sin instalar nada. La organizadora lo ve en directo y entrega todo en calidad original.",
    paragraphs: [
      "Un producto completo para bodas y eventos, de la idea al cobro. El invitado escanea el QR de su mesa, sube sus fotos y vídeos desde el navegador y listo: sin instalar nada y sin registrarse. Todo se guarda en calidad original.",
      "La organizadora tiene un panel con el muro en directo, favoritas, álbumes, fotos ocultas y descarga de todo en un ZIP sin recomprimir, por partes cuando el evento es grande. Los novios reciben un enlace privado para ver y descargar su galería, y cada evento puede tener sus propios usuarios con contraseña.",
      "Detrás hay un negocio montado: planes con pago por tarjeta, modo de prueba, y una administración desde la que se da de alta a cada organizadora y se lleva su cuenta por separado, sin que se mezclen los eventos de unas con los de otras. Se usa desde la web o desde su app Android."
    ],
    features: [
      "Subida desde el QR, sin app ni registro para el invitado",
      "Fotos y vídeos guardados en calidad original",
      "Muro en directo con favoritas, álbumes y fotos ocultas",
      "Descarga en ZIP con los archivos originales, por partes en eventos grandes",
      "Enlace privado para los novios y usuarios con contraseña por evento",
      "Planes y cobro con tarjeta (Stripe), con modo de prueba",
      "Administración de organizadoras, cada una con sus eventos",
      "Protección de acceso: bloqueo tras varios intentos fallidos",
      "App Android y versión instalable desde el navegador",
      "Tarjeta de mesa con el QR lista para imprimir"
    ],
    tech: ["TypeScript", "Cloudflare Workers", "D1", "R2", "Stripe", "PWA", "Android"],
    images: [
      { src: "/portfolio/crafter-eventos-1.webp", alt: "Muro en directo de la organizadora", w: 780, h: 1688 },
      { src: "/portfolio/crafter-eventos-2.webp", alt: "Lo que ve el invitado al escanear el QR", w: 780, h: 1688 },
      { src: "/portfolio/crafter-eventos-3.webp", alt: "QR de subida del evento", w: 780, h: 1688 },
      { src: "/portfolio/crafter-eventos-4.webp", alt: "Galería privada de los novios", w: 780, h: 1688 },
      { src: "/portfolio/crafter-eventos-5.webp", alt: "Tarjeta de mesa lista para imprimir", w: 796, h: 1120 }
    ],
    cta: { href: "/tienda", label: "Ver la tienda" },
  },
  {
    slug: "apps-redes-ia",
    name: "Apps de redes con IA",
    niche: "Apps Android con IA para redes sociales",
    category: "Apps con IA",
    status: "En producción",
    client: "Brasa y Paellas y Bar Alexanca · Crafter Mando · Empresas de limpieza",
    headline: "Apps de redes con IA · tres apps a medida",
    summary: "Un mismo motor de contenido con IA y una app Android distinta para cada caso: un grupo de hostelería, nuestra propia app de marketing y una pensada para empresas de limpieza. Desliza para ver las tres.",
    paragraphs: [
      "Las redes piden constancia y nadie tiene horas. Construimos un motor de contenido con IA y, sobre él, apps Android con su marca, sus redes y su manera de trabajar. No es la misma app con otro logo: cada una resuelve un caso distinto.",
      "Redes del Grupo lleva varios negocios desde una sola app. Crafter Mando es nuestra herramienta propia: crea el contenido, prepara las campañas, mide los resultados y publica a la vez en Instagram y Facebook de las marcas que llevamos. La app para empresas de limpieza trabaja en piloto automático. En las tres manda la misma regla: nada se publica sin el visto bueno de quien decide."
    ],
    features: [
      "Una app Android a medida por cliente, con su marca",
      "Crear posts, carruseles, reels e infografías desde el móvil",
      "IA que conoce la marca, el producto, la carta o el horario de cada negocio",
      "Cola de aprobación: borrador, aprobado, programado, publicado",
      "Publicación automática a su hora",
      "Piloto automático: el calendario del mes y su contenido, generados",
      "Asistente al que se le pide el trabajo en lenguaje natural",
      "Estudio de vídeo con guion, planos y revisión",
      "Varias redes y varios negocios desde una sola app",
      "Perfil y métricas reales de cada cuenta"
    ],
    tech: ["Flutter", "Android", "Python", "TypeScript", "Cloudflare Workers", "Meta API", "IA generativa"],
    images: [
      { src: "/portfolio/redes-del-grupo-2.webp", alt: "Redes del Grupo: crear una publicación", w: 1080, h: 2200 },
      { src: "/portfolio/warriors-instagram-1.webp", alt: "Crafter Mando: crear, cola y métricas", w: 1600, h: 844 },
      { src: "/portfolio/lph-app-1.webp", alt: "Estudio: reel, imagen, infografía o carrusel a partir de una idea", w: 780, h: 1689 },
      { src: "/portfolio/redes-del-grupo-3.webp", alt: "Redes del Grupo: planificador", w: 1080, h: 2200 },
      { src: "/portfolio/redes-del-grupo-4.webp", alt: "Perfil real de la cuenta", w: 1080, h: 2200 },
      { src: "/portfolio/lph-app-2.webp", alt: "Planificador mensual con piloto automático", w: 780, h: 1689 },
      { src: "/portfolio/warriors-instagram-2.webp", alt: "Crafter Mando: asistente y estudio de vídeo", w: 800, h: 844 },
      { src: "/portfolio/redes-del-grupo-5.webp", alt: "La misma app con la marca de otro local", w: 1080, h: 2200 },
      { src: "/portfolio/lph-app-3.webp", alt: "Conexiones con Instagram, Facebook, YouTube y TikTok", w: 780, h: 1689 }
    ],
    cta: { href: "/desarrollo-apps-nativas", label: "Ver desarrollo de apps" },
  },
  {
    slug: "warriors-hardcore",
    name: "Warriors Hardcore",
    niche: "Web de lanzamiento con 3D y scroll",
    category: "Webs y apps",
    status: "Entregado",
    client: "Warriors Hardcore",
    headline: "Warriors Hardcore · web de lanzamiento",
    summary: "Web de lanzamiento de una línea de suplementación deportiva, en cuatro idiomas, con el producto girando en 3D y una versión cinematográfica guiada por el scroll.",
    paragraphs: [
      "La marca necesitaba presentar su línea con la fuerza de su imagen. Diseñamos y construimos la web de lanzamiento en español, inglés, alemán e italiano, con cada producto mostrado con su foto oficial, su fórmula y una versión con el bote en 3D real que gira en pantalla.",
      "Preparamos además una versión inmersiva en la que el visitante recorre un mundo 3D al hacer scroll, capítulo a capítulo, y una versión ligera que funciona sin conexión. Con la web se entregaron los QR para imprenta y el material gráfico de la campaña."
    ],
    features: [
      "Cuatro idiomas: español, inglés, alemán e italiano",
      "Producto en 3D real que gira en pantalla",
      "Versión cinematográfica: un mundo 3D recorrido con el scroll",
      "Versión ligera que funciona sin conexión",
      "Ocho fórmulas, cada una con su ficha",
      "QR para imprenta y material de campaña",
      "Adaptada a móvil, tablet y escritorio"
    ],
    tech: ["HTML", "CSS", "JavaScript", "Three.js", "WebGL", "Cloudflare Workers"],
    images: [
      { src: "/portfolio/warriors-hardcore-1.webp", alt: "Portada de la web de Warriors Hardcore", w: 1440, h: 830 },
      { src: "/portfolio/warriors-hardcore-2.webp", alt: "Bote en 3D girando en la web", w: 1440, h: 830 },
      { src: "/portfolio/warriors-hardcore-3.webp", alt: "Escenas de producto de la web", w: 1440, h: 830 },
      { src: "/portfolio/warriors-hardcore-4.webp", alt: "La web en el móvil", w: 390, h: 788 }
    ],
    cta: { href: "/diseno-web-profesional", label: "Ver diseño web profesional" },
  },
  {
    slug: "taller-laser",
    name: "Taller láser",
    niche: "Taller láser: aluminio, madera y QR",
    category: "Taller láser",
    status: "En producción",
    client: "Producto propio",
    headline: "Taller láser · tarjetas de aluminio, placas QR y regalos grabados",
    summary: "Con nuestra xTool F2 grabamos y cortamos en el estudio: tarjetas de visita en aluminio, placas QR de madera para reseñas, expositores y fotos grabadas. Se compran en nuestra tienda.",
    paragraphs: [
      "El taller es la parte física de lo que hacemos. Con una xTool F2 de doble láser, infrarrojo para metal y diodo para madera, grabamos tarjetas de visita en aluminio anodizado, placas QR para reseñas de Google, expositores de mostrador y fotos en madera o aluminio.",
      "Cada pieza parte de un diseño preparado para su material, con prueba antes de grabar, y los QR se comprueban con varios móviles antes de entregarlos. Hemos hecho las tarjetas de producto de Warriors Hardcore, las de Lazy Lizard las placas QR de Hanakaze Serigraphy y la placa de reseñas de RastaLo Barcelona.",
      "Todo se puede pedir en la tienda de la web, con precio por cantidad y pago con tarjeta, y se combina con lo digital: el QR de una tarjeta puede abrir una galería de Crafter Eventos, una carta por QR o un regalo web en 3D."
    ],
    features: [
      "Tarjetas de visita en aluminio anodizado grabadas por las dos caras",
      "Placas QR de madera para reseñas de Google, wifi, carta o pago",
      "Expositores de tarjetas con el logo del negocio",
      "Fotos grabadas en aluminio y en madera",
      "QR comprobados con varios móviles antes de entregar",
      "Tienda online con precios por cantidad y pago con tarjeta"
    ],
    tech: ["xTool F2", "Láser IR 1064 nm", "Láser de diodo 455 nm", "Aluminio anodizado", "Contrachapado", "Stripe"],
    images: [
      { src: "/portfolio/taller-laser-1.webp", alt: "Tarjeta grabándose en la xTool F2", w: 720, h: 1280 },
      { src: "/portfolio/taller-laser-2.webp", alt: "Tarjeta metálica de Warriors Hardcore", w: 683, h: 1200 },
      { src: "/portfolio/taller-laser-7.webp", alt: "Placas QR de madera con soporte para Hanakaze Serigraphy", w: 1500, h: 1080 },
      { src: "/portfolio/taller-laser-3.webp", alt: "Placa de reseñas de Google en madera para RastaLo", w: 982, h: 1200 },
      { src: "/portfolio/taller-laser-4.webp", alt: "Tarjeta metálica de Shopy Crafter", w: 1400, h: 918 },
      { src: "/portfolio/taller-laser-5.webp", alt: "Tarjetas de Lazy Lizard", w: 943, h: 1200 },
      { src: "/portfolio/taller-laser-6.webp", alt: "Ilustración grabada en una tarjeta de aluminio", w: 1600, h: 900 }
    ],
    cta: { href: "/tienda", label: "Ver el taller en la tienda" },
  },
  {
    slug: "qr-artisticos-3d",
    name: "QR artísticos",
    niche: "QR artísticos para marcas",
    category: "Diseño de marca",
    status: "En producción",
    client: "Varias marcas",
    headline: "QR artísticos para marcas",
    summary: "Códigos QR diseñados a medida e integrados con la identidad visual de cada marca, con arte e ilustraciones que mantienen una lectura fiable.",
    paragraphs: [
      "Diseñamos códigos QR que forman parte de la imagen de cada marca. Integramos el código con ilustraciones, fotografías, colores y composiciones visuales hechas a medida, sin perder de vista que debe seguir siendo fácil de escanear.",
      "Se pueden usar en tarjetas, cartas de restaurante, escaparates, packaging e invitaciones. También pueden ser dinámicos: el destino se cambia sin reimprimir y se pueden consultar sus escaneos.",
      "Antes de entregar cada pieza, comprobamos su lectura con distintos móviles y tamaños. Los archivos se preparan en PNG, SVG o PDF, listos para imprenta."
    ],
    features: [
      "QR integrados en ilustraciones y fotografías de la marca",
      "Diseño con el logotipo y los colores de cada negocio",
      "Composiciones artísticas adaptadas a tarjetas, cartas, escaparates y packaging",
      "Códigos dinámicos con destino editable y seguimiento de escaneos",
      "Entrega en PNG, SVG y PDF listos para imprenta",
      "Lectura comprobada con varios móviles antes de la entrega"
    ],
    tech: ["Diseño gráfico", "IA generativa", "QR dinámicos"],
    images: [
      { src: "/portfolio/qr-artisticos-3d-6.webp", alt: "QR artístico con un bosque ilustrado visto desde el aire", w: 768, h: 768 },
      { src: "/portfolio/qr-artisticos-3d-7.webp", alt: "Código QR integrado con un personaje ilustrado", w: 1100, h: 1100 },
      { src: "/portfolio/qr-artisticos-3d-8.webp", alt: "Código QR integrado en una composición ilustrada", w: 1100, h: 1100 },
      { src: "/portfolio/qr-artisticos-3d-10.webp", alt: "Código QR artístico con los colores de la marca", w: 1100, h: 1100 }
    ],
    cta: { href: "/tienda", label: "Pedir un QR artístico" },
  },
  {
    slug: "agente-j-bond",
    name: "Agente J.Bond",
    niche: "Agentes de IA a medida y su plataforma",
    category: "Plataformas e IA",
    status: "En producción",
    client: "Plataforma propia",
    headline: "Agente J.Bond · agentes de IA a medida y la plataforma que los dirige",
    summary: "Diseñamos agentes de IA personalizados para cualquier trabajo y equipos de agentes que trabajan al unísono. Y la plataforma que los dirige, por CLI, por MCP o por API, según lo que pida cada cliente.",
    paragraphs: [
      "Empezó como nuestra herramienta de trabajo y hoy es también lo que construimos para otros. Un agente no es un chat: es un especialista con un oficio, unas herramientas y unas reglas. Diseñamos agentes a medida para cualquier trabajo (atender, vender, programar, revisar, llevar las cuentas, diseñar) y los organizamos en equipos que trabajan a la vez sobre el mismo proyecto, con un director que reparte, una pizarra compartida y un agente de calidad que no da nada por bueno sin comprobarlo.",
      "La plataforma que los dirige se adapta a cómo trabaja cada cliente. Puede manejarse desde una interfaz web, desde la línea de comandos (CLI), exponer sus capacidades por MCP para que las use cualquier asistente, o integrarse por API en el software que la empresa ya tiene. Trabaja con varios motores de IA (Claude, Gemini y ChatGPT), eligiendo el que conviene a cada tarea.",
      "Desde la misma plataforma llevamos los proyectos y archivos de cada cliente, los chatbots de WhatsApp y los asistentes telefónicos, el estudio de QR y la administración de nuestros productos."
    ],
    features: [
      "Agentes personalizados y especializados en cualquier trabajo",
      "Equipos de agentes que trabajan al unísono sobre el mismo proyecto",
      "Plataformas que funcionan por CLI, por MCP o por API, según el cliente",
      "Varios motores de IA: Claude, Gemini y ChatGPT",
      "Director que reparte el trabajo y agente de calidad que lo verifica",
      "Memoria, proyectos y archivos por cliente",
      "Chatbots de WhatsApp y asistentes telefónicos",
      "Estudio de QR y NFC integrado",
      "Biblioteca de equipos listos para lanzar",
      "Acceso desde el móvil con su propia app"
    ],
    tech: ["Python", "JavaScript", "Agentes IA", "MCP", "CLI", "API", "Cloudflare", "Android"],
    images: [
      { src: "/portfolio/agente-j-bond-1.webp", alt: "Equipo de agentes de la plataforma", w: 1600, h: 1000 },
      { src: "/portfolio/agente-j-bond-2.webp", alt: "Estudio de QR dentro de la plataforma", w: 1600, h: 982 }
    ],
    cta: { href: "/contacto", label: "Cuéntanos qué quieres automatizar" },
  },
  {
    slug: "pequenos-genios",
    name: "Pequeños Genios",
    niche: "Producto propio · app educativa",
    category: "Webs y apps",
    status: "En pruebas",
    client: "Producto propio",
    headline: "Pequeños Genios · aprender jugando",
    summary: "Una app de juegos educativos para niños de 4 a 12 años: 35 juegos de matemáticas, lengua, ciencia, historia y tecnología, un tutor con IA y retos en familia. Sin anuncios y sin compras.",
    paragraphs: [
      "Una app pensada para que un niño aprenda sin darse cuenta y para que sus padres estén tranquilos. Tiene 35 juegos repartidos en siete categorías (minijuegos, juegos con IA, matemáticas, ciencia, lenguaje, historia y geografía, y tecnología), con la dificultad adaptada a la edad y pistas cuando se atasca.",
      "Alrededor de los juegos hay un mundo: el reto del día, GenioBot (un tutor con IA al que se le pregunta), el laboratorio, el ranking, los duelos y el reto familiar para competir en casa. El apartado de aprendizaje con IA genera contenido de 200 temas, de los dinosaurios al cuerpo humano, y hay un modo para aprender inglés.",
      "Se puede jugar sin crear cuenta y sin conexión: el progreso se guarda en el dispositivo y se sincroniza si más adelante se crea una cuenta. No tiene anuncios ni compras dentro de la app."
    ],
    features: [
      "35 juegos en siete categorías",
      "Dificultad adaptada a la edad, de infantil a experto",
      "GenioBot: un tutor con IA al que preguntar",
      "Reto del día y recompensas diarias",
      "Duelos y reto familiar para jugar en casa",
      "Aprendizaje con IA: 200 temas en diez áreas",
      "Aprende idiomas: vocabulario de inglés",
      "Se juega sin cuenta y sin conexión",
      "Sin anuncios y sin compras",
      "Avatares, niveles y ranking"
    ],
    tech: ["React", "Capacitor", "Android", "IA generativa"],
    images: [
      { src: "/portfolio/pequenos-genios-1.webp", alt: "Portada de Pequeños Genios", w: 780, h: 1689 },
      { src: "/portfolio/pequenos-genios-2.webp", alt: "Inicio: reto del día, juegos y GenioBot", w: 780, h: 1689 },
      { src: "/portfolio/pequenos-genios-3.webp", alt: "35 juegos en siete categorías", w: 780, h: 1689 },
      { src: "/portfolio/pequenos-genios-4.webp", alt: "Una partida de fracciones", w: 780, h: 1689 },
      { src: "/portfolio/pequenos-genios-5.webp", alt: "Aprendizaje con IA por temas", w: 780, h: 1689 }
    ],
    cta: { href: "/desarrollo-apps-nativas", label: "Ver desarrollo de apps" },
  },
  {
    slug: "comic-crafter",
    name: "Comic Crafter",
    niche: "Producto propio · estudio creativo con IA",
    category: "Webs y apps",
    status: "En desarrollo y creación",
    client: "Producto propio",
    headline: "Comic Crafter · estudio creativo con IA",
    summary: "De la idea al cómic terminado: guion, personajes, viñetas, voces, vídeo animado y modelos 3D con IA. En desarrollo: la app y su tienda se están construyendo ahora.",
    paragraphs: [
      "Comic Crafter es nuestro producto propio y está en pleno desarrollo: un estudio completo para crear historias con inteligencia artificial sin saber dibujar. El usuario escribe la idea, diseña a sus personajes, genera las páginas en el estilo que elija y puede convertirlas en vídeo con voces o en una figura 3D.",
      "Alrededor de la app estamos construyendo la marca entera: la tienda en Shopify con un tema diseñado a medida, los cómics personalizados por encargo, la impresión 3D de personajes y el estudio de marketing con el que se prepara su contenido."
    ],
    features: [
      "Guiones y tramas generados con IA",
      "Diseño de personajes que se mantienen de una página a otra",
      "Viñetas en varios estilos: cómic, manga, infantil",
      "Voces con IA y vídeo animado de la historia",
      "Personajes en 3D listos para imprimir",
      "Tienda Shopify con tema propio",
      "Cómics personalizados por encargo",
      "Estudio de marketing para su contenido"
    ],
    tech: ["React", "IA generativa", "Shopify", "Liquid", "3D", "Android"],
    images: [],
    cta: { href: "/contacto", label: "Hablar de un proyecto parecido" },
  },
];

export const CASE_CATEGORIES: string[] = Array.from(new Set(CASES.map(c => c.category)));
