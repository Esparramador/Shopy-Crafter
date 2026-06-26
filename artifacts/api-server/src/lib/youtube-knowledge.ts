/**
 * YouTube Knowledge Base — ShopyBrain YouTube Expert System
 * ─────────────────────────────────────────────────────────────────────────────
 * Fuentes: AI-Youtube-Shorts-Generator (ViralVadoo algorithm), tube-virality
 *          (virality metrics), youtube-automation (lifecycle & A/B patterns),
 *          youtube-transcript-api (transcript processing),
 *          + 3 comedy prompts del usuario
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── VIRALITY SIGNALS (from ViralVadoo/SamurAIGPT highlights.py) ─────────────
export const VIRALITY_SIGNALS = [
  { rank: 1, name: "HOOK MOMENTS",       desc: 'Statements that create immediate curiosity ("The secret is...", "Nobody talks about...", "I was completely wrong about...")' },
  { rank: 2, name: "EMOTIONAL PEAKS",    desc: "Genuine surprise, laughter, anger, vulnerability, excitement; raw unscripted reactions" },
  { rank: 3, name: "OPINION BOMBS",      desc: "Strong, polarizing or counter-intuitive statements that trigger agree/disagree" },
  { rank: 4, name: "REVELATION MOMENTS", desc: "Surprising facts, stats, or confessions that reframe how the viewer thinks" },
  { rank: 5, name: "CONFLICT/TENSION",   desc: "Disagreement, pushback, or a problem being confronted head-on" },
  { rank: 6, name: "QUOTABLE ONE-LINERS",desc: "A sentence that works as a standalone quote card" },
  { rank: 7, name: "STORY PEAKS",        desc: "The climax or twist of an anecdote; the payoff moment" },
  { rank: 8, name: "PRACTICAL VALUE",    desc: "A concrete tip, hack, or insight the viewer can immediately apply" },
];

// ─── VIRALITY METRICS (from tube-virality research) ──────────────────────────
export const VIRALITY_METRICS = {
  engagementRate:    { weight: 0.30, desc: "Likes+Comments+Shares / Views — primary engagement signal" },
  growthVelocity:    { weight: 0.25, desc: "Views gained in first 24-48h — critical early momentum" },
  audienceReach:     { weight: 0.20, desc: "Views / Subscriber Count — virality beyond own audience" },
  subscriberGrowth:  { weight: 0.15, desc: "New subs gained after publication" },
  trendingDuration:  { weight: 0.10, desc: "Hours on trending list per country" },
};

// ─── VIDEO FORMAT CATALOG (40+ formats) ──────────────────────────────────────
export interface VideoFormat {
  id: string;
  name: string;
  emoji: string;
  category: string;
  duration: string;
  aspect: string;
  hook: string;
  structure: string[];
  bestFor: string[];
  viralPotential: number;
  productionDifficulty: number;
  tips: string[];
}

export const VIDEO_FORMATS: VideoFormat[] = [
  // ── SHORTS / VERTICAL ──
  {
    id: "short-hook",
    name: "YouTube Short — Hook Viral",
    emoji: "⚡",
    category: "Shorts",
    duration: "15-60s",
    aspect: "9:16",
    hook: "Los primeros 3 segundos son TODO — empieza in media res, sin intro, con la frase más impactante",
    structure: ["Hook brutal (0-3s)", "Desarrollo rápido (3-45s)", "Remate/CTA (45-60s)"],
    bestFor: ["Tendencias", "Reacciones", "Tips rápidos", "Before/After"],
    viralPotential: 10,
    productionDifficulty: 2,
    tips: [
      "Nunca pongas intro con logo — empieza con la frase más fuerte",
      "Subtítulos grandes siempre (80% se ve sin audio)",
      "Loop si es posible — que el final lleve al principio",
      "Texto en pantalla refuerza el audio (no lo repite)",
    ],
  },
  {
    id: "short-tutorial",
    name: "Tutorial Express (Short)",
    emoji: "🎓",
    category: "Shorts",
    duration: "45-60s",
    aspect: "9:16",
    hook: '"En 60 segundos aprenderás lo que [EXPERTOS] tardaron años en descubrir"',
    structure: ["Promesa (0-5s)", "Paso 1 (5-20s)", "Paso 2 (20-40s)", "Resultado final (40-55s)", "CTA suscripción (55-60s)"],
    bestFor: ["How-to", "Recetas", "Trucos", "Software"],
    viralPotential: 8,
    productionDifficulty: 3,
    tips: [
      "Máx 3 pasos — más complejo va a Long Form",
      "Muestra el resultado final al inicio (spoiler del resultado)",
      "Usa texto de apoyo en cada paso",
    ],
  },
  {
    id: "short-poc",
    name: "Proof of Concept (Short)",
    emoji: "🧪",
    category: "Shorts",
    duration: "30-60s",
    aspect: "9:16",
    hook: '"¿Funciona realmente? Lo probé y..."',
    structure: ["Claim audaz (0-5s)", "Setup del experimento (5-20s)", "Ejecución (20-45s)", "Resultado sorpresa (45-60s)"],
    bestFor: ["Life hacks", "Productos", "Teorías"],
    viralPotential: 9,
    productionDifficulty: 3,
    tips: ["El resultado debe ser sorprendente o confirmar miedo/esperanza del espectador"],
  },

  // ── UGC (User Generated Content) ──
  {
    id: "ugc-review",
    name: "UGC Review Auténtico",
    emoji: "📱",
    category: "UGC",
    duration: "30-90s",
    aspect: "9:16",
    hook: "Habla como si le contaras a un amigo, NO como publicidad — mucha autenticidad",
    structure: ["Presentación personal rápida (0-5s)", "Problema que tenías (5-20s)", "Producto/solución (20-60s)", "Resultado real (60-80s)", "Dónde conseguirlo (80-90s)"],
    bestFor: ["Ecommerce", "Shopify", "Apps", "Servicios"],
    viralPotential: 7,
    productionDifficulty: 2,
    tips: [
      "Luz natural, fondo real (no estudio) — la autenticidad vende",
      "Muestra el producto en uso real, no solo describir",
      "Incluye un defecto honesto — aumenta credibilidad x3",
      "Habla del ANTES (dolor) antes del DESPUÉS (solución)",
    ],
  },
  {
    id: "ugc-testimonial",
    name: "UGC Testimonio Transformación",
    emoji: "🌟",
    category: "UGC",
    duration: "45-120s",
    aspect: "9:16",
    hook: '"Llevaba [X tiempo] con este problema hasta que..."',
    structure: ["Hook personal (0-8s)", "El problema/dolor (8-30s)", "El descubrimiento (30-60s)", "La transformación (60-100s)", "Recomendación directa (100-120s)"],
    bestFor: ["Salud", "Fitness", "Belleza", "Educación", "Software B2B"],
    viralPotential: 8,
    productionDifficulty: 2,
    tips: [
      "Emoción real > producción perfecta",
      "Datos específicos: 'perdí 8kg en 6 semanas', NO 'perdí peso'",
    ],
  },
  {
    id: "ugc-unboxing",
    name: "Unboxing + Primera Impresión",
    emoji: "📦",
    category: "UGC",
    duration: "2-8min",
    aspect: "16:9 o 9:16",
    hook: '"Acabo de recibir esto y no me lo esperaba para nada..."',
    structure: ["Expectativas antes de abrir (0-30s)", "Unboxing real (30s-2min)", "Primera impresión (2-4min)", "Test rápido (4-6min)", "Veredicto (último min)"],
    bestFor: ["Electrónica", "Moda", "Gadgets", "Suscripciones box"],
    viralPotential: 7,
    productionDifficulty: 2,
    tips: [
      "Reacción real > guión preparado",
      "Cierra con cliffhanger: 'en 30 días os cuento si sigue funcionando'",
    ],
  },

  // ── EDUCATIVO / EXPLAINER ──
  {
    id: "explainer-animated",
    name: "Explainer Animado",
    emoji: "🎬",
    category: "Educativo",
    duration: "3-8min",
    aspect: "16:9",
    hook: '"¿Por qué [COSA CONFUSA] funciona así? En 5 minutos lo entenderás mejor que muchos expertos"',
    structure: ["Hook + promesa (0-30s)", "El problema/confusión (30s-1min)", "Explicación con analogías (1-5min)", "Ejemplo práctico (5-7min)", "Resumen clave + CTA (último 30s)"],
    bestFor: ["Finanzas", "Tecnología", "Ciencia", "Marketing", "Historia"],
    viralPotential: 7,
    productionDifficulty: 7,
    tips: [
      "Una sola idea central — no 5 ideas a medias",
      "Analogías > datos crudos para conceptos abstractos",
      "Capítulos/timestamps siempre para vídeos +5min",
    ],
  },
  {
    id: "how-to-step",
    name: "Tutorial Paso a Paso",
    emoji: "🔧",
    category: "Educativo",
    duration: "5-20min",
    aspect: "16:9",
    hook: '"Haz [RESULTADO DESEADO] en [TIEMPO ESPECÍFICO] — guía completa"',
    structure: ["Hook resultado final (0-30s)", "Lo que aprenderás (30s-1min)", "Paso 1 (1-Xmin)", "Paso 2..N", "Recap + recursos (último 1min)"],
    bestFor: ["Software", "Bricolaje", "Cocina", "Código", "Diseño"],
    viralPotential: 6,
    productionDifficulty: 4,
    tips: [
      "Muestra el resultado final EN EL THUMBNAIL — el 'antes' y el 'después'",
      "Pinned comment con timestamps y recursos",
      "Describe el PROBLEMA primero, luego la solución",
    ],
  },
  {
    id: "listicle",
    name: "Listicle / Top N",
    emoji: "📋",
    category: "Educativo",
    duration: "5-15min",
    aspect: "16:9",
    hook: '"Las [N] razones por las que [COSA] — el #3 te va a sorprender"',
    structure: ["Hook + número (0-20s)", "Intro breve (20-45s)", "Items 1 a N (cuerpo)", "El mejor/peor al final (último)"],
    bestFor: ["Recomendaciones", "Errores comunes", "Herramientas", "Estrategias"],
    viralPotential: 8,
    productionDifficulty: 3,
    tips: [
      "Números impares funcionan mejor (7, 9, 11) — percepción de más investigación",
      "El item más polémico/sorprendente va al final — retención máxima",
      "Thumbnail con número grande y cara de sorpresa",
    ],
  },

  // ── PRODUCTO / ECOMMERCE ──
  {
    id: "product-demo",
    name: "Demo de Producto",
    emoji: "🛍️",
    category: "Producto",
    duration: "1-3min",
    aspect: "16:9 o 9:16",
    hook: "Muestra el producto resolviendo el problema en los primeros 5 segundos — no describas, DEMUESTRA",
    structure: ["Problema visible (0-10s)", "Presentación producto (10-30s)", "Demo en uso real (30s-2min)", "Características clave (2-2.5min)", "CTA compra (último 15s)"],
    bestFor: ["Shopify", "Ecommerce", "Gadgets", "Herramientas"],
    viralPotential: 6,
    productionDifficulty: 4,
    tips: [
      "Luz de 3 puntos para productos físicos — hace que brille",
      "Hands-in-frame (manos usando el producto) > producto solo en mesa",
      "Precio visible (sin miedo) — el que no puede pagar no es tu cliente",
      "Urgencia real: stock limitado, oferta por tiempo",
    ],
  },
  {
    id: "explode-view",
    name: "Vista Explosionada / Explode View",
    emoji: "💥",
    category: "Producto",
    duration: "30s-2min",
    aspect: "16:9",
    hook: "Muestra todos los componentes separados flotando, luego el ensamblado — impacto visual máximo",
    structure: ["Vista final del producto (0-5s)", "Explosión de componentes (5-20s)", "Narración de cada parte (20s-1.5min)", "Reensamblado (1.5-2min)"],
    bestFor: ["Tecnología", "Maquinaria", "Productos premium", "Ingeniería", "Arquitectura"],
    viralPotential: 9,
    productionDifficulty: 8,
    tips: [
      "Usar IA generativa (Runway/Veo) para crear la animación de explosión",
      "Música épica instrumental — sin letra, que no distraiga",
      "Narración en voz en off explicando cada componente",
      "Ideal para posicionamiento premium — 'aquí está todo lo que hay dentro'",
    ],
  },
  {
    id: "disassemble-assemble",
    name: "Desmontaje y Montaje (ASMR técnico)",
    emoji: "🔩",
    category: "Producto",
    duration: "2-10min",
    aspect: "16:9",
    hook: '"¿Qué hay dentro de [PRODUCTO]? Lo abrimos para descubrirlo"',
    structure: ["Intro: el producto cerrado (0-20s)", "Desmontaje metodológico (20s-5min)", "Interior/componentes (5-7min)", "Montaje o conclusión (7-10min)"],
    bestFor: ["Tecnología", "Electrónica", "Relojes", "Calzado premium", "Maquinaria"],
    viralPotential: 8,
    productionDifficulty: 5,
    tips: [
      "Audio ASMR de las piezas — los tornillos, los clicks — muy satisfactorio",
      "Cámara cenital para el desmontaje",
      "Macro lens para detalles internos",
      "No hagas spoiler del interior — mantén la tensión",
    ],
  },
  {
    id: "comparison",
    name: "Comparativa / Versus",
    emoji: "⚔️",
    category: "Producto",
    duration: "5-15min",
    aspect: "16:9",
    hook: '"[PRODUCTO A] vs [PRODUCTO B]: cuál comprar en [AÑO] — la comparativa honesta"',
    structure: ["Los contendientes (0-30s)", "Criterios de comparación (30s-1min)", "Comparativa por categoría (1-12min)", "Veredicto final (último 2min)"],
    bestFor: ["Tech", "Software", "Productos físicos", "Servicios"],
    viralPotential: 8,
    productionDifficulty: 5,
    tips: [
      "Sé honesto sobre cuándo elegir cada opción — la audiencia lo agradece",
      "Tabla comparativa visual siempre",
      "El titular con 'cuál comprar' convierte mejor que 'comparativa'",
    ],
  },

  // ── PODCAST / ENTREVISTA ──
  {
    id: "podcast-full",
    name: "Podcast Completo",
    emoji: "🎙️",
    category: "Podcast",
    duration: "30-90min",
    aspect: "16:9",
    hook: "El thumbnail y título lo es todo — la miniatura debe capturar la emoción o controversia del episodio",
    structure: ["Intro con los mejores momentos del episodio (0-2min)", "Presentación del invitado (2-5min)", "Cuerpo de la entrevista", "Cierre con recomendaciones del invitado"],
    bestFor: ["Negocios", "Emprendimiento", "Tecnología", "Salud mental", "Política"],
    viralPotential: 5,
    productionDifficulty: 6,
    tips: [
      "Clipa los mejores 3-5 momentos como Shorts para distribución masiva",
      "Timestamps en la descripción — el algoritmo los indexa",
      "Mención de invitado en thumbnail > solo foto",
      "El episodio pillar alimenta 5-10 contenidos derivados (clips, blog, newsletter)",
    ],
  },
  {
    id: "podcast-clip",
    name: "Clip de Podcast Viral",
    emoji: "✂️",
    category: "Podcast",
    duration: "45s-3min",
    aspect: "9:16 o 16:9",
    hook: "El momento más polémico, más sorprendente o más emotivo del episodio completo",
    structure: ["El momento más fuerte directamente (0-5s)", "Contexto mínimo (5-15s)", "El desarrollo del momento (15s-2.5min)", "Link al episodio completo (último 5s)"],
    bestFor: ["Distribución en Reels", "Clips virales", "Top of Funnel"],
    viralPotential: 9,
    productionDifficulty: 4,
    tips: [
      "Subtítulos dinámicos (al estilo MrBeast/Lex Fridman clips) — indispensable",
      "El thumbnail del clip puede ser diferente al del episodio completo",
      "Un episodio bueno genera 5-10 clips independientes",
    ],
  },

  // ── TRAILER / TEASER ──
  {
    id: "channel-trailer",
    name: "Trailer de Canal",
    emoji: "🎥",
    category: "Trailer",
    duration: "60-120s",
    aspect: "16:9",
    hook: "¿Por qué deberían suscribirse? Respóndelo en los primeros 10 segundos",
    structure: ["Quién eres + qué haces (0-15s)", "El valor que ofreces (15-40s)", "Prueba social / mejores momentos (40-80s)", "CTA de suscripción (80-120s)"],
    bestFor: ["Lanzamiento de canal", "Rebranding", "Primera impresión"],
    viralPotential: 4,
    productionDifficulty: 7,
    tips: [
      "Música energética que refleje el tono del canal",
      "Usa los mejores clips que ya tienes — no produzcas nuevo material solo para el trailer",
      "Termina con el logo y CTA claro de suscripción",
    ],
  },
  {
    id: "video-trailer",
    name: "Teaser de Vídeo (Anticipación)",
    emoji: "🎞️",
    category: "Trailer",
    duration: "15-45s",
    aspect: "9:16 o 16:9",
    hook: "Muestra el momento más impactante del vídeo completo — el spoiler que genera urgencia de ver más",
    structure: ["El momento climático (0-10s)", "Pregunta/tensión (10-25s)", "Link/fecha del vídeo completo (25-45s)"],
    bestFor: ["Series", "Documentales", "Long form", "Experimentos"],
    viralPotential: 7,
    productionDifficulty: 3,
    tips: [
      "El cliffhanger debe ser real, no clickbait vacío",
      "Publica el teaser 24-48h antes del vídeo principal",
    ],
  },
  {
    id: "product-launch-trailer",
    name: "Trailer de Lanzamiento de Producto",
    emoji: "🚀",
    category: "Trailer",
    duration: "30-90s",
    aspect: "16:9",
    hook: "Estilo Apple/Nike — emoción primero, características después (o nunca)",
    structure: ["Problema que resuelve (0-15s)", "Revelación dramática del producto (15-40s)", "Beneficios clave en imágenes (40-70s)", "Fecha/precio/CTA (último 20s)"],
    bestFor: ["Shopify product launch", "Apps", "Servicios premium", "Cursos"],
    viralPotential: 8,
    productionDifficulty: 8,
    tips: [
      "Música orquestal o electrónica épica — sin letra",
      "Aspira al estilo Apple Keynote — slow motion, luz perfecta, silencio dramático",
      "El nombre del producto se revela tarde — genera tensión",
    ],
  },

  // ── STORYTELLING / VLOG ──
  {
    id: "vlog-day",
    name: "Vlog 'Un día en mi vida'",
    emoji: "📹",
    category: "Storytelling",
    duration: "10-20min",
    aspect: "16:9",
    hook: '"Un día en la vida de [ROL ASPIRACIONAL] — lo que nadie te cuenta"',
    structure: ["Rutina matinal (hook: el momento más interesante del día) (0-1min)", "Contexto del día (1-3min)", "El día chronológico con reflexiones (3-18min)", "Reflexión final del día (último 2min)"],
    bestFor: ["Lifestyle", "Emprendedores", "Creadores", "Nómadas digitales"],
    viralPotential: 6,
    productionDifficulty: 4,
    tips: [
      "Empieza con el momento más interesante del día, no con despertar",
      "Voz en off reflexiva > solo imágenes mudas",
      "Música lo-fi o cinematográfica de fondo",
    ],
  },
  {
    id: "story-transformation",
    name: "Historia de Transformación",
    emoji: "🦋",
    category: "Storytelling",
    duration: "8-20min",
    aspect: "16:9",
    hook: '"De [ANTES TERRIBLE] a [DESPUÉS INCREÍBLE] en [TIEMPO ESPECÍFICO]"',
    structure: ["El punto más bajo (hook, 0-1min)", "Cómo llegué ahí (1-4min)", "El punto de inflexión (4-8min)", "La transformación (8-15min)", "Lo que aprendí (último 2min)"],
    bestFor: ["Fitness", "Negocios", "Salud mental", "Finanzas personales"],
    viralPotential: 9,
    productionDifficulty: 4,
    tips: [
      "Datos específicos: kilos, euros, tiempo — no vagas promesas",
      "Fotos/videos del 'antes' son ORO — no tires nunca el material de inicio",
      "La vulnerabilidad honesta conecta más que el éxito perfecto",
    ],
  },
  {
    id: "mini-documentary",
    name: "Mini Documental",
    emoji: "🎦",
    category: "Storytelling",
    duration: "10-30min",
    aspect: "16:9",
    hook: "Una historia real con estructura de 3 actos — planteo, conflicto, resolución",
    structure: ["Planteo: el mundo antes (0-3min)", "Conflicto: el problema/reto (3-15min)", "Clímax (15-22min)", "Resolución + reflexión (22-30min)"],
    bestFor: ["Marcas con historia", "Investigaciones", "Behind the scenes premium"],
    viralPotential: 7,
    productionDifficulty: 9,
    tips: [
      "Entrevistas en b-roll con música de fondo emocional",
      "Establece personajes con los que el espectador pueda identificarse",
      "Finaliza con esperanza o llamada a la acción — no con nihilismo",
    ],
  },

  // ── REACCIÓN / COMMENTARY ──
  {
    id: "reaction",
    name: "Reacción / Commentary",
    emoji: "😱",
    category: "Reacción",
    duration: "5-20min",
    aspect: "16:9",
    hook: '"No puedo creer que [PERSONA/EMPRESA] haya hecho esto..."',
    structure: ["Setup del contexto en 30s (0-30s)", "Reproducción del contenido con comentarios (30s-15min)", "Análisis final / tu opinión (último 2-3min)"],
    bestFor: ["Noticias de industria", "Controversias", "Anuncios de empresas", "Momentos culturales"],
    viralPotential: 8,
    productionDifficulty: 3,
    tips: [
      "Tu reacción debe añadir valor — análisis, contexto, humor — no solo 'wow'",
      "Usa picture-in-picture (tu cara + el contenido) para mayor engagement",
      "Los primeros en reaccionar ganan — velocidad > perfección",
    ],
  },

  // ── SÁTIRA / COMEDIA ──
  {
    id: "satira-politica",
    name: "Sátira Política (Monólogo)",
    emoji: "🎭",
    category: "Comedia",
    duration: "3-10min",
    aspect: "16:9",
    hook: '"Esta semana [POLÍTICO] ha superado todas las expectativas... de incompetencia"',
    structure: ["El gancho — la noticia absurda (0-30s)", "Contexto irónico (30s-2min)", "El desarrollo cómico con ejemplos (2-7min)", "El remate ácido (último 30s)"],
    bestFor: ["Noticias", "Política", "Actualidad", "Sociedad"],
    viralPotential: 9,
    productionDifficulty: 5,
    tips: [
      "La ironía funciona mejor que el ataque directo — más sofisticado y más compartible",
      "Usa hechos reales, exagerados al absurdo — no inventes",
      "Tono cínico-informativo (estilo El Intermedio / The Daily Show)",
      "Thumbnail con cara de incredulidad + texto sarcástico",
    ],
  },
  {
    id: "satira-sketch",
    name: "Sketch Cómico (Actuado)",
    emoji: "🎪",
    category: "Comedia",
    duration: "2-5min",
    aspect: "16:9",
    hook: "Setup en 15 segundos — plantea la situación absurda inmediatamente",
    structure: ["Setup: la situación absurda (0-15s)", "Escalada del absurdo (15s-3min)", "Punchline / remate (último 30s)"],
    bestFor: ["Comedia de situación", "Parodias", "Personajes recurrentes"],
    viralPotential: 8,
    productionDifficulty: 7,
    tips: [
      "El personaje debe tener una característica exagerada y consistente",
      "La escalada del absurdo es la clave — cada 'sí' lleva a una situación más ridícula",
      "El remate debe sorprender pero parecer inevitable en retrospectiva",
    ],
  },
  {
    id: "vox-pop",
    name: "Vox Pop / Reportero Callejero",
    emoji: "🎤",
    category: "Comedia",
    duration: "2-6min",
    aspect: "16:9 o 9:16",
    hook: '"Preguntamos a la gente sobre [TEMA ABSURDO] y las respuestas son..."',
    structure: ["Setup del experimento (0-20s)", "Entrevistas con respuestas variopintas (20s-5min)", "Remate del reportero con cara seria (último 20s)"],
    bestFor: ["Política", "Tendencias", "Experimentos sociales"],
    viralPotential: 9,
    productionDifficulty: 5,
    tips: [
      "El reportero debe mantener cara seria — contraste con el absurdo",
      "Las respuestas más ridículas van en el medio, no al final",
      "El punchline final del reportero es el sello de la pieza",
    ],
  },
  {
    id: "fact-check-comico",
    name: "Fact-Check Cómico",
    emoji: "🔍",
    category: "Comedia",
    duration: "2-5min",
    aspect: "16:9",
    hook: '"[PERSONA] acaba de decir [AFIRMACIÓN] — veamos qué dijo hace 2 años..."',
    structure: ["La afirmación reciente (0-15s)", "El contraste histórico (15-60s)", "Análisis ácido (1-4min)", "Veredicto sarcástico (último 20s)"],
    bestFor: ["Política", "Empresas", "Figuras públicas", "Promesas incumplidas"],
    viralPotential: 9,
    productionDifficulty: 5,
    tips: [
      "Los primeros 3 segundos deben tener la contradicción más potente",
      "Usa clips reales, datos verificables — la veracidad es la coraza",
      "Tono de incredulidad honesta, no rabia — más efectivo y más compartible",
    ],
  },

  // ── SECTORES ESPECÍFICOS ──
  {
    id: "ecommerce-haul",
    name: "Haul de Compras",
    emoji: "🛒",
    category: "Ecommerce",
    duration: "8-20min",
    aspect: "16:9",
    hook: '"Gasté [CANTIDAD] en [TIENDA] y esto es lo que me llegó — honesto al 100%"',
    structure: ["Contexto de la compra (0-1min)", "Producto 1 (unboxing + opinión) (1-3min)", "Producto 2...N", "Rating final y lo mejor/peor (último 2min)"],
    bestFor: ["Fashion", "Beauty", "Gadgets", "Home decor", "Shopify stores"],
    viralPotential: 8,
    productionDifficulty: 3,
    tips: [
      "Incluye siempre 1-2 productos decepcionantes — la honestidad engancha",
      "El precio de cada producto en pantalla siempre",
      "Links de afiliado en descripción — monetización directa",
    ],
  },
  {
    id: "shopify-tutorial",
    name: "Tutorial Shopify / Ecommerce",
    emoji: "🏪",
    category: "Ecommerce",
    duration: "10-30min",
    aspect: "16:9",
    hook: '"Monté una tienda Shopify en [TIEMPO] y gané [CANTIDAD] — te enseño cómo"',
    structure: ["El resultado primero (0-1min)", "Por qué Shopify (1-3min)", "Tutorial paso a paso (3-25min)", "Errores a evitar (25-28min)", "Recursos + CTA (último 2min)"],
    bestFor: ["Dropshipping", "Print on demand", "Ecommerce", "Side hustles"],
    viralPotential: 7,
    productionDifficulty: 5,
    tips: [
      "Screencast de pantalla con tu voz — la gente quiere ver el proceso real",
      "Resultados reales con capturas de dashboard — no promesas vacías",
      "Actualiza el título con el año — '2026' añade siempre",
    ],
  },
  {
    id: "behind-scenes",
    name: "Behind the Scenes / Backstage",
    emoji: "🎬",
    category: "Storytelling",
    duration: "5-15min",
    aspect: "16:9",
    hook: '"Lo que nadie ve cuando [HAGO X] — el proceso real sin filtros"',
    structure: ["La pregunta que todos tienen (0-30s)", "El proceso sin filtros (30s-12min)", "Los fracasos y aprendizajes (12-14min)", "Reflexión final (último 1min)"],
    bestFor: ["Creadores", "Artistas", "Empresas", "Marcas premium"],
    viralPotential: 7,
    productionDifficulty: 4,
    tips: [
      "Muestra los errores — la vulnerabilidad conecta más que la perfección",
      "El 'making of' de un producto o vídeo popular siempre funciona",
      "Música lofi/ambient que no compita con el audio de situación",
    ],
  },
];

// ─── COMEDY PROMPTS (guardados del usuario — 26 Jun 2026) ─────────────────────
export const COMEDY_PROMPTS = [
  {
    id: "satirico-politico",
    name: "El Analista Político Sarcástico",
    emoji: "🎙️",
    useCase: "Guiones de vídeos de sátira política",
    prompt: `Actúa como un presentador de noticias satíricas (estilo The Daily Show o El Intermedio). Elige una noticia política reciente de [INSERTAR ACONTECIMIENTO POLÍTICO]. Escribe un guion para un video de YouTube de 60 segundos.

REGLAS:
- Usa la ironía, el sarcasmo y exageraciones absurdas.
- Haz una burla inteligente sobre las promesas de los políticos en lugar de atacar directamente.
- Mantén un ritmo rápido y un tono cínico pero informativo.
- Incluye acotaciones visuales (ej. [Poner cara de incredulidad] o [Mostrar gráfico falso con números inventados que suben]).`,
  },
  {
    id: "entrevistador-incomodo",
    name: "El Entrevistador Incómodo",
    emoji: "🎤",
    useCase: "Formatos cortos o Vox Pops cómicos",
    prompt: `Actúa como un reportero callejero de comedia absurda. Escribe un guion de 30 segundos donde el reportero le pregunta a un ciudadano promedio sobre [INSERTAR TEMA POLÍTICO, ej: una nueva ley de impuestos].

REGLAS:
- Las respuestas del ciudadano deben ser respuestas sin sentido, exageradamente ridículas o que mezclan la política con problemas domésticos irrelevantes.
- El reportero debe asentir con total seriedad ante las locuras que dice el ciudadano.
- Cierra con un remate (punchline) corto que deje al espectador pensando.`,
  },
  {
    id: "detector-hipocresia",
    name: "Detector de Hipocresía",
    emoji: "🔍",
    useCase: "YouTube Shorts de fact-checking cómico",
    prompt: `Actúa como un verificador de hechos (fact-checker) cómico. Escribe el guion para un YouTube Short donde analizas una frase reciente dicha por [INSERTAR NOMBRE DE POLÍTICO].

En los primeros 3 segundos, haz un gancho fuerte diciendo: "Político X acaba de descubrir la solución a nuestros problemas, lástima que mintió sobre lo mismo hace 2 años".
- Usa un tono de incredulidad.
- Divide el guion en clips donde contrastas lo que dice el político con la realidad, usando un tono ácido y divertido.`,
  },
];

// ─── TITLE PATTERNS (A/B test analysis from youtube-automation research) ─────
export const TITLE_PATTERNS = {
  high_performing: [
    { pattern: "Número específico + promesa", example: '"7 razones por las que tu tienda Shopify NO vende (y cómo arreglarlo)"', avgShareBoost: "+22%" },
    { pattern: "Pregunta polarizante", example: '"¿Vale la pena Shopify en 2026? La verdad que nadie te cuenta"', avgShareBoost: "+18%" },
    { pattern: "Contraste antes/después", example: '"De 0€ a 10.000€/mes en Shopify — lo que realmente pasó"', avgShareBoost: "+25%" },
    { pattern: "Autoridad + revelación", example: '"Después de analizar 500 tiendas Shopify, esto es lo que funciona"', avgShareBoost: "+20%" },
    { pattern: "Negación sorprendente", example: '"Por qué DEJÉ de optimizar mi tienda (y mis ventas se triplicaron)"', avgShareBoost: "+28%" },
    { pattern: "Urgencia temporal", example: '"Lo que debes hacer con tu Shopify ANTES de que llegue el Q4"', avgShareBoost: "+15%" },
    { pattern: "Relatable problem", example: '"Tu tienda Shopify tiene estas 5 fugas de dinero (y no lo sabes)"', avgShareBoost: "+19%" },
  ],
  low_performing: [
    { pattern: "Genérico sin gancho", example: '"Tutorial de Shopify 2026"', avgShareImpact: "-30%" },
    { pattern: "Todo en mayúsculas (clickbait obvio)", example: '"¡¡GANA DINERO CON SHOPIFY AHORA!!"', avgShareImpact: "-25%" },
    { pattern: "Demasiado largo (>70 chars)", example: '"Cómo configurar completamente tu tienda Shopify paso a paso desde cero para principiantes"', avgShareImpact: "-20%" },
    { pattern: "Sin promesa de valor", example: '"Mi experiencia con Shopify"', avgShareImpact: "-35%" },
  ],
};

// ─── HOOK FRAMEWORKS ──────────────────────────────────────────────────────────
export const HOOK_FRAMEWORKS = [
  { name: "The Curiosity Gap",    template: "Lo que [NADIE] te dice sobre [TEMA]...", example: "Lo que nadie te dice sobre vender en Shopify" },
  { name: "The Counter-Intuitive",template: "Por qué [ACCIÓN OBVIA] es lo peor que puedes hacer", example: "Por qué bajar precios es lo peor que puedes hacer" },
  { name: "The Time Bomb",        template: "Tienes [TIEMPO] para [ACCIÓN] antes de [CONSECUENCIA]", example: "Tienes 30 días para preparar tu Shopify antes del Q4" },
  { name: "The Social Proof",     template: "Esto es lo que hacen los [TOP X%] que los demás ignoran", example: "Esto es lo que hacen las tiendas top 1% que las demás ignoran" },
  { name: "The Confession",       template: "Cometí el mayor error de [CONTEXTO] y aquí está...", example: "Cometí el mayor error de mi vida con mi tienda Shopify" },
  { name: "The Transformation",   template: "De [ESTADO MALO] a [ESTADO BUENO] en [TIEMPO]", example: "De 0 ventas a 50 pedidos/día en 90 días" },
  { name: "The Question Hook",    template: "¿Por qué [COSA COMÚN] no funciona para [AUDIENCIA]?", example: "¿Por qué los anuncios de Facebook no funcionan para tu tienda?" },
  { name: "The Statistic Shock",  template: "[X]% de [GRUPO] [HACE COSA SORPRENDENTE] — ¿eres uno de ellos?", example: "El 87% de tiendas Shopify fallan por este motivo — ¿eres uno de ellos?" },
];

// ─── SECTOR STRATEGIES ───────────────────────────────────────────────────────
export const SECTOR_STRATEGIES: Record<string, {
  bestFormats: string[];
  topHooks: string[];
  contentPillars: string[];
  postingFrequency: string;
  viralTriggers: string[];
}> = {
  ecommerce_shopify: {
    bestFormats: ["ugc-review", "product-demo", "shopify-tutorial", "comparison", "listicle"],
    topHooks: ["'Gané X€ en mi primera semana'", "'Este producto se vende solo'", "'Error que cometí en mi tienda'"],
    contentPillars: ["Case studies reales", "Optimización de conversión", "Herramientas y apps", "Estrategias de tráfico", "Behind the scenes de tiendas exitosas"],
    postingFrequency: "3-4 vídeos/semana + 2 Shorts/día",
    viralTriggers: ["Resultados económicos reales", "Errores comunes", "Comparativas de herramientas", "Q4 strategies"],
  },
  politica_satira: {
    bestFormats: ["satira-politica", "fact-check-comico", "vox-pop", "reaction", "short-poc"],
    topHooks: ["Contradicción flagrante de político", "Promesa vs realidad", "Dato absurdo real"],
    contentPillars: ["Actualidad semanal", "Fact-checking cómico", "Vox pop callejero", "Análisis satírico de declaraciones"],
    postingFrequency: "Diario en Shorts + 2-3 Long Form/semana",
    viralTriggers: ["Escándalo político", "Declaración ridícula", "Hipocresía documentada", "Reacción en vivo a noticia"],
  },
  tecnologia: {
    bestFormats: ["explainer-animated", "how-to-step", "comparison", "explode-view", "listicle"],
    topHooks: ["'La IA que cambia todo'", "'Por qué [EMPRESA] tiene miedo de esto'", "'El software que uso y pago'"],
    contentPillars: ["Reviews honestas", "Tutoriales prácticos", "Tendencias emergentes", "Comparativas", "Casos de uso reales con IA"],
    postingFrequency: "2-3 Long Form/semana + Shorts de noticias",
    viralTriggers: ["Lanzamiento de herramienta IA", "Fallo de empresa tech", "Estadística sorprendente", "Antes/después de usar herramienta"],
  },
  fitness_salud: {
    bestFormats: ["story-transformation", "ugc-testimonial", "how-to-step", "listicle", "short-tutorial"],
    topHooks: ["'En 30 días cambié esto'", "'El error que cometía cada día'", "'Lo que los nutricionistas no te dicen'"],
    contentPillars: ["Transformaciones reales", "Mitos vs realidad", "Rutinas prácticas", "Nutrición simplificada", "Mentalidad y hábitos"],
    postingFrequency: "4-5 vídeos/semana + Shorts diarios",
    viralTriggers: ["Antes/después visual", "Desmitificar creencia popular", "Reto de X días", "Reacción a dieta de famoso"],
  },
  moda_belleza: {
    bestFormats: ["ugc-review", "ecommerce-haul", "comparison", "short-hook", "ugc-testimonial"],
    topHooks: ["'Gasté 300€ en Zara y esto es lo real'", "'El dupe perfecto de [MARCA LUJOSA]'", "'Tendencia que va a morir pronto'"],
    contentPillars: ["Hauls honestos", "Dupes y alternativas", "Guías de estilo por tipo de cuerpo", "Sostenibilidad", "Tendencias anticipadas"],
    postingFrequency: "5+ Shorts/semana + 2-3 Long Form",
    viralTriggers: ["Haul inesperado", "Fallo de marca famosa", "Tendencia que viene de X país", "GRWM con storyline"],
  },
  educacion_cursos: {
    bestFormats: ["explainer-animated", "how-to-step", "listicle", "mini-documentary", "podcast-clip"],
    topHooks: ["'Lo que no te enseñan en la universidad'", "'Aprendí esto en 10 minutos y cambió mi carrera'", "'El sistema educativo está roto porque...'"],
    contentPillars: ["Habilidades prácticas", "Crítica al sistema educativo", "Aprendizaje acelerado", "Recursos gratuitos", "Casos de estudio"],
    postingFrequency: "2-3 Long Form/semana + clips de valor",
    viralTriggers: ["Estadística educativa impactante", "Habilidad que deja sin empleo", "Ruta alternativa exitosa", "Crítica a credencialismo"],
  },
};

// ─── CONTENT CATEGORIES ───────────────────────────────────────────────────────
export interface ContentCategory {
  id: string;
  name: string;
  emoji: string;
  description: string;
  defaultTone: string;
  defaultStyle: string;
  defaultFormat: string;
  inputLabel: string;
  inputPlaceholder: string;
  systemRole: string;
  viralTriggers: string[];
  recommendedFormats: string[];
}

export const CONTENT_CATEGORIES: ContentCategory[] = [
  {
    id: "politica",
    name: "Sátira Política",
    emoji: "🏛️",
    description: "Análisis y humor político inteligente",
    defaultTone: "ácido",
    defaultStyle: "monólogo",
    defaultFormat: "satira-politica",
    inputLabel: "Noticia o tema político",
    inputPlaceholder: "Ej: Óscar López llama 'payaso' a Feijóo, La nueva ley del impuesto digital, El debate sobre las saunas...",
    systemRole: "Eres el mejor guionista de sátira política en español. Tu estilo domina El Intermedio, La Resistencia, The Daily Show y Wyoming. Combinas ironía inteligente, humor absurdo y crítica política constructiva.",
    viralTriggers: ["Contradicción política", "Promesa incumplida", "Escándalo", "Hipocresía flagrante", "Debate absurdo"],
    recommendedFormats: ["satira-politica", "fact-check-comico", "vox-pop", "short-hook", "podcast-clip"],
  },
  {
    id: "historia",
    name: "Historia & Documentales",
    emoji: "🏺",
    description: "Relatos históricos que enganchan desde el primer segundo",
    defaultTone: "épico",
    defaultStyle: "storytelling",
    defaultFormat: "mini-documental",
    inputLabel: "Período histórico, personaje o evento",
    inputPlaceholder: "Ej: La caída del Imperio Romano, Los piratas del Caribe reales, Por qué Cleopatra no era egipcia, El inventor que Tesla plagió...",
    systemRole: "Eres el mejor narrador de historia para YouTube en español, con el talento narrativo de YouTube Canales Historia en Mapas, Draw Curiosities y Kurzgesagt adaptado al castellano. Haces los momentos históricos APASIONANTES y relevantes para hoy.",
    viralTriggers: ["El dato que nadie conoce", "La conspiración real", "El personaje olvidado", "El giro histórico inesperado", "La conexión con el presente"],
    recommendedFormats: ["mini-documental", "listicle", "short-hook", "explainer-animated"],
  },
  {
    id: "ia-tech",
    name: "IA & Tecnología",
    emoji: "🤖",
    description: "Divulgación tech educativa y viral",
    defaultTone: "asombrado",
    defaultStyle: "explainer",
    defaultFormat: "explainer-animated",
    inputLabel: "Tema de IA, software o tecnología",
    inputPlaceholder: "Ej: Claude 4 vs ChatGPT en la vida real, Cómo funciona un LLM explicado con patatas, La IA que dejará sin trabajo a los diseñadores...",
    systemRole: "Eres el mejor divulgador de inteligencia artificial y tecnología en YouTube español. Tienes el don de 3Blue1Brown para visualizar lo abstracto, la accesibilidad de Dot CSV y la energía de Fireship. Haces que lo más complejo sea fascinante en 60 segundos.",
    viralTriggers: ["IA que supera al humano", "Herramienta que no conoces", "El futuro ya está aquí", "Riesgo real de la IA", "El truco técnico revelador"],
    recommendedFormats: ["explainer-animated", "short-tutorial", "listicle", "short-hook", "comparison"],
  },
  {
    id: "personajes",
    name: "Personajes & Objetos",
    emoji: "🍋",
    description: "Frutas, objetos y personajes que explican el mundo",
    defaultTone: "divertido",
    defaultStyle: "personaje-explica",
    defaultFormat: "short-hook",
    inputLabel: "Concepto a explicar y personaje narrador",
    inputPlaceholder: "Ej: Una manzana explica la inflación, Tipos de jefes como frutas, Un robot bipolar explica la depresión, El aguacate más ansioso del mundo explica el mercado inmobiliario...",
    systemRole: "Eres el mejor guionista de contenido con personajes animados o metafóricos para YouTube. Te especializas en hacer que frutas, animales, objetos cotidianos o personajes abstractos expliquen conceptos complejos de forma viral, divertida y memorable. Tu estilo combina la narrativa de Pixar con la pedagogía de Sal Khan y el humor de South Park.",
    viralTriggers: ["El personaje inesperado", "La metáfora perfecta", "El concepto complejo hecho ridículamente simple", "El final giro de guión", "La voz del personaje"],
    recommendedFormats: ["short-hook", "short-tutorial", "explainer-animated", "satira-politica"],
  },
  {
    id: "educativo",
    name: "Educativo con Personaje",
    emoji: "🎓",
    description: "Aprendizaje con narrador que engancha",
    defaultTone: "didáctico",
    defaultStyle: "storytelling",
    defaultFormat: "explainer-animated",
    inputLabel: "Concepto, habilidad o materia + personaje narrador",
    inputPlaceholder: "Ej: Un detective explica la psicología del engaño, Una bruja explica la química, Un astronauta enseña productividad desde el espacio...",
    systemRole: "Eres el mejor guionista de contenido educativo con personajes narradores para YouTube. Creas mundos donde un personaje memorable (robot, mago, detective, animal, fantasma) enseña conceptos complejos de forma entretenida y memorable. Combinas la narrativa de Pixar con la pedagogía de Sal Khan.",
    viralTriggers: ["El personaje que engancha emocionalmente", "La revelación pedagógica", "El método inesperado para enseñar", "El giro que lo cambia todo"],
    recommendedFormats: ["explainer-animated", "short-tutorial", "mini-documental", "short-hook"],
  },
  {
    id: "lifestyle",
    name: "Lifestyle & Bienestar",
    emoji: "✨",
    description: "Vida sana, productividad, hábitos y bienestar",
    defaultTone: "inspirador",
    defaultStyle: "vlog",
    defaultFormat: "vlog-day",
    inputLabel: "Hábito, rutina, consejo o transformación",
    inputPlaceholder: "Ej: Mi rutina de 5am que cambió todo, Cómo dejé de procrastinar para siempre, El método japonés que me cura la ansiedad...",
    systemRole: "Eres el mejor creador de contenido de lifestyle, productividad y bienestar de YouTube en español. Combinas la honestidad de Ali Abdaal, la energía de Lewis Howes y la profundidad de Jay Shetty adaptado al público hispanohablante. Haces el contenido de bienestar HONESTO, práctico y sin positividad tóxica.",
    viralTriggers: ["El hábito que cambia todo", "La rutina secreta de los exitosos", "El error que todos cometen", "El resultado en X días", "La verdad incómoda del bienestar"],
    recommendedFormats: ["vlog-day", "listicle", "short-tutorial", "short-hook", "how-to-step"],
  },
  {
    id: "finanzas",
    name: "Finanzas & Emprendimiento",
    emoji: "💰",
    description: "Dinero, inversión y negocios sin filtros",
    defaultTone: "directo",
    defaultStyle: "listicle",
    defaultFormat: "listicle",
    inputLabel: "Estrategia financiera, error o secreto de negocios",
    inputPlaceholder: "Ej: Cómo invertir con 100€, El error que te hace pobre, Los negocios que no requieren capital, Por qué la clase media no ahorra nunca...",
    systemRole: "Eres el mejor divulgador de finanzas personales y emprendimiento de YouTube en español. Combinas la claridad de Andynsane, la profundidad de Ben Felix y la practicidad de Graham Stephan para el mercado hispano. Eres radical y honesto — no vendes humo.",
    viralTriggers: ["El secreto que los ricos conocen", "El error financiero del común", "Cómo ganar sin invertir", "La estrategia del 1%", "Lo que nadie te dice del dinero"],
    recommendedFormats: ["listicle", "how-to-step", "comparison", "short-hook", "explainer-animated"],
  },
  {
    id: "ciencia",
    name: "Ciencia & Naturaleza",
    emoji: "🔬",
    description: "Divulgación científica que vuela la cabeza",
    defaultTone: "asombrado",
    defaultStyle: "documental",
    defaultFormat: "mini-documental",
    inputLabel: "Fenómeno, descubrimiento o paradoja científica",
    inputPlaceholder: "Ej: Por qué el espacio huele a bistec, El animal que no puede morir, El descubrimiento que rompió la física, Si el Sol desapareciera ahora mismo...",
    systemRole: "Eres el mejor divulgador científico de YouTube en español, con el talento de Vsauce para hacer preguntas que explotan el cerebro, la profundidad de Carl Sagan y la accesibilidad de SciShow. Haces la ciencia PERTURBADORAMENTE fascinante.",
    viralTriggers: ["El dato que te vuela la cabeza", "La pregunta que nadie se hace", "La paradoja científica", "El descubrimiento que cambia todo", "Lo que la ciencia AÚN no entiende"],
    recommendedFormats: ["mini-documental", "explainer-animated", "short-hook", "listicle"],
  },
  {
    id: "entretenimiento",
    name: "Entretenimiento & Humor",
    emoji: "😂",
    description: "Humor, trends y análisis de cultura pop",
    defaultTone: "hilarante",
    defaultStyle: "reacción",
    defaultFormat: "reaction",
    inputLabel: "Tendencia, meme, película, serie o fenómeno viral",
    inputPlaceholder: "Ej: Los peores anuncios de 2026, React a los TikToks más absurdos del año, Por qué [SERIE] no tiene sentido, El ranking de las películas más ridículas...",
    systemRole: "Eres el mejor creador de entretenimiento de YouTube en español. Dominas el humor situacional, las reacciones auténticas y el análisis de cultura pop con toque cómico. Combinas la energía de Ibai, la profundidad crítica de NostalgiCritic y la accesibilidad de Willyrex pero con contenido más elaborado y guionizado.",
    viralTriggers: ["La reacción genuina que no esperabas", "El análisis inesperado", "El meme elevado a arte", "La nostalgia inesperada", "El ranking polémico"],
    recommendedFormats: ["reaction", "listicle", "short-hook", "podcast-clip"],
  },
  {
    id: "monologuista",
    name: "Monologuista IA 🎤",
    emoji: "🎤",
    description: "Stand-up comedy con acento andaluz u otro personaje",
    defaultTone: "hilarante",
    defaultStyle: "monólogo",
    defaultFormat: "satira-sketch",
    inputLabel: "Tema del monólogo (cotidiano, político, generacional…)",
    inputPlaceholder: "Ej: Las apps de citas en Sevilla, Los turistas en agosto en Málaga, Ir al médico de cabecera en Andalucía, La cuesta de enero siendo autónomo en el Sur...",
    systemRole: `Eres el mejor guionista de monólogos de comedia en español con ACENTO ANDALUZ AUTÉNTICO.

LÉXICO ANDALUZ QUE DEBES USAR (de forma natural, no forzada):
- «macho», «tío», «illo», «jöe», «coñe», «arsa», «vamos a ve», «miarma», «chacho»
- «mu» (muy), «tó» (todo), «na» (nada), «poquito», «nea», «¿sabes lo que te digo?»
- Verbos: «echar pa'lante», «ponerse fino», «estar fino», «dar la lata», «pegarse una juerga»
- Frases: «¡Dios mío de mi vida!», «Aquí en la tierra del ole», «como Dios manda», «a buenas horas mangas verdes»

ESTRUCTURA DEL MONÓLOGO PERFECTO:
1. GANCHO (0-10s): Observación cotidiana que todos reconocen → «¿A que sí, macho?»
2. ESCALADA: Exagerar la situación paso a paso hasta el absurdo andaluz
3. GIRO: Un twist inesperado que reencuadra todo con humor
4. REMATE: La frase perfecta que se queda en la cabeza — quotable, compartible
5. CIERRE: Pequeño callback al inicio que cierra el círculo

REGLAS DE ORO del stand-up andaluz:
- El timing está en las pausas (escríbelas como [PAUSA] o [MIRANDO AL PÚBLICO])
- Las exageraciones deben ser RECONOCIBLES, no ridículas
- El público andaluz se ríe CON el humor, no de él
- Mezcla situaciones universales con detalles muy específicos del Sur
- El acento es parte del chiste — úsalo estratégicamente`,
    viralTriggers: ["La situación cotidiana exagerada", "El acento como personaje", "El giro inesperado", "La frase memorable final", "La observación que todos pensaban pero nadie decía"],
    recommendedFormats: ["satira-sketch", "short-hook", "podcast-clip", "vox-pop"],
  },
];

// ─── CONTENT TEMPLATES PER CATEGORY ──────────────────────────────────────────
export interface ContentTemplate {
  id: string;
  categoryId: string;
  name: string;
  emoji: string;
  useCase: string;
  prompt: string;
}

export const CONTENT_TEMPLATES: ContentTemplate[] = [
  // ── Política ──
  ...COMEDY_PROMPTS.map(p => ({ ...p, categoryId: "politica" })),

  // ── Historia ──
  {
    id: "historia-dato-secreto",
    categoryId: "historia",
    name: "El Dato que Nadie Sabe",
    emoji: "🕵️",
    useCase: "Historia con revelación inesperada",
    prompt: `Narra la historia de [TEMA] revelando UN dato completamente desconocido por el gran público que cambia cómo se ve todo. Estructura: [Dato impactante al inicio] → [Contexto histórico] → [Por qué importa hoy] → [La revelación que reencuadra todo]. Tono épico pero accesible. Velocidad narrativa alta.`,
  },
  {
    id: "historia-personaje-olvidado",
    categoryId: "historia",
    name: "El Genio Olvidado",
    emoji: "🎖️",
    useCase: "Historia de un personaje histórico que merece reconocimiento",
    prompt: `Cuenta la historia de [PERSONAJE] como si fuera la película de acción más épica que nadie filmó. Empieza con una escena dramática de su vida. Incluye: quién era, qué logró, por qué la historia lo olvidó, y por qué debería importarnos hoy. Ritmo cinematográfico.`,
  },

  // ── IA & Tech ──
  {
    id: "ia-explica-simple",
    categoryId: "ia-tech",
    name: "La IA Explicada Sin Tecnicismos",
    emoji: "🧩",
    useCase: "Explicar un concepto técnico de forma viral",
    prompt: `Explica [CONCEPTO TÉCNICO] como si tu audiencia fueran estudiantes de 15 años inteligentes pero sin conocimientos técnicos. Usa una analogía del mundo real poderosa. Estructura: [Analogía hook] → [Cómo funciona realmente] → [Para qué sirve en la práctica] → [Dato que sorprende]. Sin jerga. Sin condescendencia.`,
  },
  {
    id: "ia-vs-humano",
    categoryId: "ia-tech",
    name: "IA vs Humano: El Experimento",
    emoji: "⚔️",
    useCase: "Comparativa IA vs humano con resultado sorprendente",
    prompt: `Diseña un experimento donde [IA/HERRAMIENTA] y un humano experto compiten en [TAREA]. Empieza con el resultado final (quién ganó) y luego narra el proceso. Incluye momentos donde la IA sorprendió, momentos donde falló inesperadamente, y la conclusión honesta sobre lo que esto significa para el futuro.`,
  },

  // ── Personajes ──
  {
    id: "fruta-explica",
    categoryId: "personajes",
    name: "La Fruta que Explica el Mundo",
    emoji: "🍊",
    useCase: "Una fruta u objeto explicando un concepto complejo",
    prompt: `Escribe un monólogo en primera persona de [FRUTA/OBJETO] que explica [CONCEPTO ECONÓMICO/SOCIAL/CIENTÍFICO]. El personaje tiene una personalidad exagerada y usa su propia naturaleza como metáfora perfecta. Ej: "Soy un aguacate y voy a explicarte por qué no puedes comprar una casa". El humor viene de la metáfora siendo PERFECTAMENTE acertada.`,
  },
  {
    id: "tipos-como-frutas",
    categoryId: "personajes",
    name: "Tipos de [X] como Frutas",
    emoji: "🫐",
    useCase: "Clasificación viral de arquetipos usando frutas",
    prompt: `Crea un vídeo tipo "Los 5 tipos de [TIPO DE PERSONA/TRABAJADOR/SITUACIÓN] como si fueran frutas". Cada fruta debe ser una metáfora perfecta y divertida del arquetipo. El humor viene de lo EXACTAMENTE ACERTADO que es cada comparación. Incluye una descripción visual de cómo se comporta cada "fruta" en situaciones específicas.`,
  },

  // ── Educativo ──
  {
    id: "detective-explica",
    categoryId: "educativo",
    name: "El Detective que Investiga",
    emoji: "🔍",
    useCase: "Un detective investiga y explica un concepto",
    prompt: `Un detective (o científico forense) investiga [CONCEPTO/PROBLEMA] como si fuera un crimen. Usa terminología policial aplicada al tema. El "caso" se resuelve enseñando el concepto. Estructura: [El crimen/misterio] → [Pistas/evidencias] → [Sospechosos/teorías] → [La resolución que lo explica todo]. Tono serio pero con humor de noir.`,
  },

  // ── Lifestyle ──
  {
    id: "rutina-secreta",
    categoryId: "lifestyle",
    name: "La Rutina Que No Esperabas",
    emoji: "⏰",
    useCase: "Rutina o hábito con giro inesperado",
    prompt: `Presenta una rutina o hábito [TEMA] pero con un giro: empieza mostrando el resultado transformador, luego el proceso contraintuitivo, y finalmente la ciencia que lo explica. El tono es honesto sobre lo que ES difícil y lo que NO lo es. Nada de positividad tóxica. Incluye el fracaso que tuviste antes de que funcionara.`,
  },

  // ── Finanzas ──
  {
    id: "secreto-rico",
    categoryId: "finanzas",
    name: "Lo Que Los Ricos Hacen Diferente",
    emoji: "💎",
    useCase: "Revelación financiera contraintuitiva",
    prompt: `Revela UN comportamiento financiero específico que separa a los que construyen riqueza de los que no. Empieza con la estadística o dato impactante, explica la mentalidad detrás, da el paso concreto que puede hacer alguien hoy con cualquier nivel de ingresos, y desmonta el mito más común sobre ese tema. Honesto y sin productos que vender.`,
  },

  // ── Ciencia ──
  {
    id: "pregunta-vsauce",
    categoryId: "ciencia",
    name: "La Pregunta que Rompe el Cerebro",
    emoji: "🌌",
    useCase: "Pregunta científica fascinante con respuesta que sorprende",
    prompt: `Empieza con una pregunta aparentemente simple sobre [TEMA] que tiene una respuesta que CAMBIA cómo ves la realidad. Estilo Vsauce: la pregunta lleva a otra pregunta más profunda, hasta revelar algo sobre la naturaleza del universo/vida/mente que es perturbadoramente bello. Incluye un dato científico reciente que nadie conoce.`,
  },

  // ── Entretenimiento ──
  {
    id: "ranking-polemico",
    categoryId: "entretenimiento",
    name: "El Ranking Que Va a Enfadar a Alguien",
    emoji: "🏆",
    useCase: "Ranking de cultura pop deliberadamente polémico",
    prompt: `Crea un ranking de [PELÍCULAS/SERIES/CANCIONES/PERSONAJES] que sea deliberadamente polémico pero con argumentos irrebatibles. Para cada posición: el argumento de por qué está ahí, la contradicción obvia que la gente va a gritar en los comentarios, y la defensa brillante que hace el argumento más sólido. El objetivo es DIVIDIR la sección de comentarios de forma positiva.`,
  },

  // ── Monologuista ──
  {
    id: "monologuista-cotidiano",
    categoryId: "monologuista",
    name: "Lo Cotidiano Andaluz",
    emoji: "☀️",
    useCase: "Situación del día a día exagerada con acento andaluz",
    prompt: `Escribe un monólogo de stand-up de 2-3 minutos sobre [TEMA COTIDIANO] desde la perspectiva de un andaluz de a pie. Empieza con una observación que TODOS reconocen, escala hacia el absurdo con detalles muy específicos del sur de España, incluye un giro inesperado, y remata con una frase memorable que la gente va a repetir. Usa el léxico andaluz de forma natural: «macho», «illo», «vamos a ve», «mu», «na», «jöe». Marca las pausas con [PAUSA] y las miradas al público con [AL PÚBLICO].`,
  },
  {
    id: "monologuista-millennial",
    categoryId: "monologuista",
    name: "Millennial Andaluz en 2026",
    emoji: "📱",
    useCase: "Humor generacional sobre millennials/Gen-Z desde el sur",
    prompt: `Escribe un monólogo de stand-up sobre [TEMA GENERACIONAL] desde la perspectiva de un millennial andaluz de 30-something. Mezcla referencias a: Instagram, el precio de los alquileres, la economía de plataformas, el turismo masivo, y la identidad andaluza en 2026. El humor viene del contraste entre las expectativas de su generación y la realidad del sur de España. Tono de «nos reímos porque si no, lloramos». Voz auténtica, léxico andaluz.`,
  },
  {
    id: "monologuista-turistas",
    categoryId: "monologuista",
    name: "Los Turistas en el Sur",
    emoji: "🏖️",
    useCase: "Monólogo sobre turistas en Andalucía con humor afectuoso",
    prompt: `Escribe un monólogo de stand-up sobre la invasión turística en [CIUDAD ANDALUZA] en verano. El narrador andaluz observa a los turistas con cariño exasperado. Incluye: el inglés que pide paella a las 11am, el turista que se queja del calor (¡como si no supiera que viene a Andalucía!), el instagrammer en el Albaicín, y el alemán que descubre el jamón. El remate debe ser un momento de orgullo andaluz inesperado. Tono: afectuoso, nunca xenófobo.`,
  },
  {
    id: "monologuista-trabajo",
    categoryId: "monologuista",
    name: "El Trabajo en Andalucía",
    emoji: "💼",
    useCase: "Humor sobre la cultura laboral y el mercado de trabajo andaluz",
    prompt: `Escribe un monólogo de stand-up sobre [ASPECTO DEL TRABAJO] en el contexto del sur de España. Aborda los tópicos (con humor que los desmonta), la realidad de los sueldos, la temporada turística, el autónomo andaluz, o la burocracia de las administraciones. El chiste siempre apunta AL SISTEMA, nunca a la gente trabajadora. Usa el humor para hablar de algo serio de forma que duela menos.`,
  },
];

// ─── CATEGORY PROMPT BUILDER ──────────────────────────────────────────────────
export function buildCategoryPrompt(categoryId: string, format?: string, templateId?: string): string {
  const category = CONTENT_CATEGORIES.find(c => c.id === categoryId) || CONTENT_CATEGORIES[0];
  const formatKB  = format ? VIDEO_FORMATS.find(f => f.id === format) : null;
  const template  = templateId ? CONTENT_TEMPLATES.find(t => t.id === templateId) : null;

  return `${category.systemRole}

## TU ESPECIALIDAD: ${category.name} ${category.emoji}
${category.description}

## TRIGGERS VIRALES PARA ESTA CATEGORÍA
${category.viralTriggers.map((t, i) => `${i + 1}. ${t}`).join("\n")}

## SEÑALES UNIVERSALES DE VIRALIDAD (algoritmo YouTube)
${VIRALITY_SIGNALS.slice(0, 5).map(s => `${s.rank}. **${s.name}**: ${s.desc}`).join("\n")}

## SEÑALES DEL ALGORITMO 2026
- CTR objetivo: >4% en nichos competidos
- Retención media objetivo: >50%
- Los primeros 30 segundos son críticos — el algoritmo juzga aquí
- Velocidad de visualizaciones en 24-48h = señal de momentum

## PATRONES DE TÍTULO DE ALTO RENDIMIENTO
${TITLE_PATTERNS.high_performing.slice(0, 4).map(p => `• ${p.pattern} (${p.avgShareBoost}): "${p.example}"`).join("\n")}

## HOOKS MÁS EFECTIVOS
${HOOK_FRAMEWORKS.slice(0, 4).map(h => `• **${h.name}**: ${h.template}`).join("\n")}

${formatKB ? `
## FORMATO SELECCIONADO: ${formatKB.name} ${formatKB.emoji}
- Duración: ${formatKB.duration} | Aspecto: ${formatKB.aspect}
- Estructura: ${formatKB.structure.join(" → ")}
- Tips clave: ${formatKB.tips.slice(0, 3).join("; ")}
` : ""}

${template ? `## PLANTILLA A APLICAR: ${template.name} ${template.emoji}
${template.prompt}
` : ""}`;
}

// ─── CONTENT TYPE DETECTION PROMPT (from SamurAIGPT highlights.py) ───────────
export const CONTENT_TYPE_PROMPT = `Analiza este transcript de vídeo y clasifica el tipo de contenido.
Elige uno: podcast, interview, tutorial, lecture, commentary, debate, vlog, satira, ugc, product_review, other.
También estima la densidad del contenido: low (mucho relleno/charla), medium, o high (info densa/historias).
Responde solo con JSON: {"content_type": "...", "density": "..."}`;

// ─── YOUTUBE ALGORITHM SIGNALS (2024-2026) ────────────────────────────────────
export const ALGORITHM_SIGNALS = {
  critical: [
    "CTR (Click-Through Rate) — objetivo: >4% en nichos competidos, >7% en nichos nuevos",
    "Retención media — objetivo: >50% del vídeo visto (40%+ ya es bueno)",
    "Retención primeros 30 segundos — el algoritmo juzga aquí si el vídeo 'engancha'",
    "Velocidad de visualizaciones primeras 24-48h — señal de momentum",
  ],
  important: [
    "Likes/Dislikes ratio — objetivo: >95% positive",
    "Comments por view — el algoritmo premia la discusión",
    "Shares (especialmente en Stories y WhatsApp)",
    "Click en playlists sugeridas",
  ],
  thumbnail_best_practices: [
    "Cara humana con emoción fuerte (sorpresa, miedo, felicidad exagerada) +35% CTR",
    "Contraste alto — funciona en miniaturas pequeñas de móvil",
    "Texto grande legible en 3 segundos: máx 3-5 palabras",
    "Color complementario al rojo/azul/negro de YouTube (los más comunes) — diferénciate",
    "A/B test de thumbnail — cambia a las 48h si el CTR es <3%",
  ],
  posting_timing: {
    best_days: ["Jueves", "Viernes", "Sábado"],
    best_hours_utc: ["15:00-17:00 UTC (17:00-19:00 ES)"],
    shorts_any_time: "Los Shorts funcionan 24/7 — pública cuando tengas el contenido listo",
  },
};

// ─── SYSTEM PROMPT BUILDER ────────────────────────────────────────────────────
export function buildYouTubeExpertPrompt(sector?: string, format?: string): string {
  const sectorKB = sector ? SECTOR_STRATEGIES[sector] : null;
  const formatKB = format ? VIDEO_FORMATS.find(f => f.id === format) : null;

  return `Eres el máximo experto mundial en YouTube, creación de contenido viral, producción de vídeo y estrategia de canales.

Tu conocimiento incluye:

## SEÑALES DE VIRALIDAD (algoritmo confirmado)
${VIRALITY_SIGNALS.map(s => `${s.rank}. **${s.name}**: ${s.desc}`).join("\n")}

## MÉTRICAS DE VIRALIDAD
${Object.entries(VIRALITY_METRICS).map(([k,v]) => `- **${k}** (peso ${(v.weight*100).toFixed(0)}%): ${v.desc}`).join("\n")}

## SEÑALES DEL ALGORITMO DE YOUTUBE 2026
${ALGORITHM_SIGNALS.critical.map(s => `• ${s}`).join("\n")}

## PATRONES DE TÍTULO QUE FUNCIONAN
${TITLE_PATTERNS.high_performing.map(p => `• ${p.pattern} (${p.avgShareBoost}): "${p.example}"`).join("\n")}

## FRAMEWORKS DE HOOK
${HOOK_FRAMEWORKS.map(h => `• **${h.name}**: ${h.template}`).join("\n")}

${sectorKB ? `
## ESTRATEGIA PARA EL SECTOR (${sector})
- Mejores formatos: ${sectorKB.bestFormats.join(", ")}
- Frecuencia de publicación: ${sectorKB.postingFrequency}
- Pilares de contenido: ${sectorKB.contentPillars.join(", ")}
- Triggers virales: ${sectorKB.viralTriggers.join(", ")}
` : ""}

${formatKB ? `
## FORMATO SELECCIONADO: ${formatKB.name}
- Duración: ${formatKB.duration} | Aspecto: ${formatKB.aspect}
- Estructura: ${formatKB.structure.join(" → ")}
- Tips clave: ${formatKB.tips.slice(0,3).join("; ")}
` : ""}

Aplica todo este conocimiento en cada respuesta. Sé específico, práctico y orientado a resultados medibles.`;
}

// ─── VIRALITY SCORE CALCULATOR ───────────────────────────────────────────────
export interface ViralityInput {
  hasStrongHook: boolean;
  hasEmotionalPeak: boolean;
  hasConflict: boolean;
  hasPracticalValue: boolean;
  hasStoryArc: boolean;
  titleScore: number;
  hasNumberInTitle: boolean;
  estimatedDurationSecs: number;
  sector?: string;
}

export function calculateViralityScore(input: ViralityInput): { score: number; breakdown: Record<string, number>; recommendations: string[] } {
  const breakdown: Record<string, number> = {
    hook:          input.hasStrongHook ? 20 : 0,
    emotion:       input.hasEmotionalPeak ? 15 : 0,
    conflict:      input.hasConflict ? 15 : 0,
    practicalValue:input.hasPracticalValue ? 15 : 0,
    story:         input.hasStoryArc ? 10 : 0,
    titleQuality:  Math.min(input.titleScore, 15),
    numberInTitle: input.hasNumberInTitle ? 5 : 0,
    durationBonus: input.estimatedDurationSecs >= 45 && input.estimatedDurationSecs <= 90 ? 5 : 0,
  };

  const score = Math.min(100, Object.values(breakdown).reduce((a, b) => a + b, 0));

  const recommendations: string[] = [];
  if (!input.hasStrongHook)      recommendations.push("Añade un hook más fuerte en los primeros 3 segundos — es la señal viral más importante");
  if (!input.hasEmotionalPeak)   recommendations.push("Incluye un momento de emoción genuina (sorpresa, humor, vulnerabilidad)");
  if (!input.hasConflict)        recommendations.push("Añade tensión o conflicto — el espectador necesita algo que resolver");
  if (!input.hasPracticalValue)  recommendations.push("Incluye un tip o insight accionable que el espectador pueda aplicar hoy");
  if (!input.hasNumberInTitle)   recommendations.push("Los números en el título aumentan el CTR un 22% en media — considera añadir uno");

  return { score, breakdown, recommendations };
}
