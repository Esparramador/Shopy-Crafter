import { Router } from "express";
import { askGeminiChat, askGeminiStream } from "../lib/gemini.js";
import { MASTER_CATALOG } from "../lib/master-skills-injector.js";
import { logger } from "../lib/logger.js";
import { learnFromOperation } from "../lib/claude.js";

const router = Router();

// ══════════════════════════════════════════════════════════════════════════════
// INTENT CLASSIFIER — patrones extraídos de Rasa NLU (rasa-demo/data/nlu/)
// Intents: greet, contact_sales, book_demo, signup_newsletter, thank, bye,
//          affirm, deny, out_of_scope, need_help_broad, human_handoff,
//          feedback, faq/pricing, faq/how_it_works, faq/security, faq/features
// ══════════════════════════════════════════════════════════════════════════════

interface IntentResult {
  intent: string;
  entities: Record<string, string>;
  confidence: number;
  needsHumanHandoff: boolean;
  buyingIntent: boolean;
}

function classifyIntent(
  message: string,
  history: Array<{ role: string; content: string }>,
): IntentResult {
  const msg = message.toLowerCase().trim();
  const entities: Record<string, string> = {};

  // Entity extraction (Rasa: name, email, company, budget)
  const emailMatch = msg.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
  if (emailMatch) entities.email = emailMatch[0];
  const budgetMatch = msg.match(/(\d+)\s*(€|eur|euros?)/i);
  if (budgetMatch) entities.budget = budgetMatch[0];

  // Human handoff (from Rasa: human_handoff intent)
  if (/hablar con (humano|persona|agente|alguien|empleado|comercial|soporte)|persona real|quiero que me llame|llámame|hablar con vosotros|contacto directo/.test(msg)) {
    return { intent: "human_handoff", entities, confidence: 0.92, needsHumanHandoff: true, buyingIntent: false };
  }

  // Greet (from Rasa: greet intent — 70+ examples)
  if (/^(hola|buenos|buenas|hey|hi|hello|qué tal|saludos|ey|ola|good morning|good afternoon|buenas tardes|buenas noches)\b/.test(msg) && msg.length < 40) {
    return { intent: "greet", entities, confidence: 0.95, needsHumanHandoff: false, buyingIntent: false };
  }

  // Contact sales / Book demo (from Rasa: contact_sales + book_demo)
  if (/demo|reservar|agendar|contratar|suscribir|empezar ya|cómo me registro|quiero acceso|quiero (empezar|probarlo|la prueba)|prueba gratuita|free trial|acceso|darme de alta/.test(msg)) {
    return { intent: "contact_sales", entities, confidence: 0.88, needsHumanHandoff: false, buyingIntent: true };
  }

  // FAQ: pricing (from Rasa: faq/pricing)
  if (/cuánto cuesta|precio|tarifa|plan|coste|cost|pricing|cuánto (vale|es)|es gratis|gratuito|pago/.test(msg)) {
    return { intent: "faq/pricing", entities, confidence: 0.85, needsHumanHandoff: false, buyingIntent: false };
  }

  // FAQ: how it works
  if (/cómo funciona|cómo se usa|para qué sirve|qué hace|qué es shopy|explicar|cuéntame|cuéntame más|cómo trabaja|cómo ayuda/.test(msg)) {
    return { intent: "faq/how_it_works", entities, confidence: 0.82, needsHumanHandoff: false, buyingIntent: false };
  }

  // FAQ: security / trust (from Rasa: out_of_scope handling)
  if (/seguro|seguridad|confianza|oauth|contraseña|datos|privacidad|rgpd|gdpr|acceso a mi tienda|mi tienda es segura/.test(msg)) {
    return { intent: "faq/security", entities, confidence: 0.8, needsHumanHandoff: false, buyingIntent: false };
  }

  // FAQ: features / capabilities
  if (/motor|función|qué puede hacer|imagen|seo|email|klaviyo|a\.b test|precio|copywriting|generá|automatiz/.test(msg)) {
    return { intent: "faq/features", entities, confidence: 0.78, needsHumanHandoff: false, buyingIntent: false };
  }

  // Signup newsletter (from Rasa: signup_newsletter)
  if (/newsletter|suscribir(me)?|recibir noticias|actualizaciones|novedades/.test(msg)) {
    return { intent: "signup_newsletter", entities, confidence: 0.82, needsHumanHandoff: false, buyingIntent: false };
  }

  // Thank (from Rasa: thank intent)
  if (/^(gracias|muchas gracias|genial|perfecto|excelente|muy bien|entendido|ok gracias|fenomenal|guay|estupendo|que bueno|muy útil)/.test(msg)) {
    return { intent: "thank", entities, confidence: 0.88, needsHumanHandoff: false, buyingIntent: false };
  }

  // Bye (from Rasa: bye intent)
  if (/^(adiós|hasta luego|bye|chao|nos vemos|hasta pronto|me voy|hasta mañana|hasta)$/.test(msg)) {
    return { intent: "bye", entities, confidence: 0.9, needsHumanHandoff: false, buyingIntent: false };
  }

  // Affirm (from Rasa: affirm — 80+ examples: yes, sí, claro, ok, perfecto, sure...)
  if (/^(sí|si|yes|claro|claro que sí|por supuesto|de acuerdo|ok|okay|vale|acepto|afirmativo|exacto|efectivamente|correcto|adelante|va|dale)/.test(msg) && msg.length < 30) {
    return { intent: "affirm", entities, confidence: 0.85, needsHumanHandoff: false, buyingIntent: false };
  }

  // Deny (from Rasa: deny — no, nope, no gracias...)
  if (/^(no|nope|no gracias|negativo|para nada|tampoco|ahora no|en otro momento|lo pensaré)/.test(msg) && msg.length < 30) {
    return { intent: "deny", entities, confidence: 0.85, needsHumanHandoff: false, buyingIntent: false };
  }

  // Need help broad (from Rasa: need_help_broad)
  if (/ayuda|help|no (sé|entiendo|funciona)|problema|error|issue|soporte/.test(msg)) {
    return { intent: "need_help_broad", entities, confidence: 0.7, needsHumanHandoff: false, buyingIntent: false };
  }

  // Out of scope (from Rasa: out_of_scope — mensajes muy cortos o irrelevantes)
  if (msg.length < 5 || /^(\.\.\.|xd|jaja|gg|lol|wtf|hmm|meh|ok\.|ah\.|ya\.?)$/.test(msg)) {
    return { intent: "out_of_scope", entities, confidence: 0.6, needsHumanHandoff: false, buyingIntent: false };
  }

  return { intent: "general", entities, confidence: 0.55, needsHumanHandoff: false, buyingIntent: false };
}

// ══════════════════════════════════════════════════════════════════════════════
// CONVERSATION STAGE TRACKER — inspired by Rasa stories.yml
// Stages mirror Rasa's story flows: initial → exploring → considering → converting
// ══════════════════════════════════════════════════════════════════════════════

type ConvStage = "initial" | "exploring" | "considering" | "converting" | "wrapup";

interface StageInfo {
  stage: ConvStage;
  userMsgCount: number;
  mentionedPricing: boolean;
  mentionedDemo: boolean;
  hasFrustration: boolean;
}

function getConversationStage(
  history: Array<{ role: string; content: string }>,
): StageInfo {
  const userMsgs = history.filter(m => m.role === "user");
  const allUserText = userMsgs.map(m => m.content.toLowerCase()).join(" ");

  const mentionedPricing = /precio|plan|coste|tarifa|gratis|pago/.test(allUserText);
  const mentionedDemo = /demo|prueba|empezar|acceso|contratar|suscribir/.test(allUserText);
  const hasFrustration = /no funciona|no entiendo|no sirve|mal|fatal|error|problema|difícil/.test(allUserText);

  let stage: ConvStage = "initial";
  if (userMsgs.length >= 1) stage = "exploring";
  if (userMsgs.length >= 3 || mentionedPricing) stage = "considering";
  if (mentionedDemo || (userMsgs.length >= 5 && mentionedPricing)) stage = "converting";
  if (userMsgs.length >= 8) stage = "wrapup";

  return { stage, userMsgCount: userMsgs.length, mentionedPricing, mentionedDemo, hasFrustration };
}

// ══════════════════════════════════════════════════════════════════════════════
// DYNAMIC SYSTEM PROMPT — se enriquece con contexto de intent + stage
// Patrón: Rasa domain.yml responses + stories.yml conditional branches
// ══════════════════════════════════════════════════════════════════════════════

const LANDING_SYSTEM_PROMPT_BASE = `Eres el asistente comercial de Shopy Crafter, una plataforma SaaS de inteligencia artificial para ecommerce y creatividad digital. Conoces PERFECTAMENTE cada módulo, herramienta y capacidad de la plataforma.

REGLA ABSOLUTA: NUNCA digas que algo "no existe", "no está disponible" o "solo gestionamos X" si ese módulo aparece en esta descripción. Shopy Crafter es MUCHO más que Shopify — es una plataforma completa de IA con más de 14 módulos en producción. Si preguntan por el Lab Web, Fusion Studio Pro, Librería de Prompts, Tripo3D, o cualquier otro módulo listado aquí — CONFÍRMALO con seguridad y explica qué hace.

== QUE ES SHOPY CRAFTER ==
Shopy Crafter es una plataforma SaaS todo-en-uno impulsada por IA que combina:
- Optimizacion completa de tiendas Shopify (SEO, precios, copywriting, email, A/B testing, imagenes)
- Estudio creativo multimedia (generacion de imagen IA, video IA, 3D, diseno web, efectos)
- Libreria de prompts con mas de 6.677 templates de marketing listos para usar
- Lab Web con analisis PageSpeed / Core Web Vitals / Lighthouse
- Herramientas de agencia multi-cliente con white-label
NO es solo "optimizacion Shopify" — es un ecosistema completo de produccion creativa y marketing con IA.

== MODULO 1: OPTIMIZACION SHOPIFY (los motores clasicos) ==
Conectas tu tienda Shopify (OAuth seguro, 5 minutos) y los motores trabajan 24/7:
- Motor SEO: keyword research, titulos, meta descripciones, schemas JSON-LD (Product/FAQ/Review/BreadcrumbList), alt texts, arquitectura URL, internal linking
- Motor Pricing: precios de mercado en tiempo real, price anchoring, elasticidad, compare_at_price automatico, bundling, psicologia de precios
- Motor Imagenes IA: fotos de producto profesionales (fondo blanco, lifestyle, banners), optimizacion de imagenes, alt texts SEO automaticos
- Motor Copywriting: descripciones con storytelling, AIDA/PAS, benefits-first, FAQ integrada, keywords long-tail
- Motor A/B Testing: tests automaticos de precios, titulos e imagenes para maximizar conversion real
- Motor Email Marketing: flujos Klaviyo completos (bienvenida, carrito abandonado, post-compra, winback VIP) con HTML listo para importar
- Auditoria completa: score de optimizacion 0-100 (grado A/B/C/D/F) por producto con recomendaciones priorizadas

== MODULO 2: LAB WEB (analisis de rendimiento web) ==
El Lab Web SI EXISTE y es una herramienta potente en la plataforma:
- Analisis PageSpeed / Google Lighthouse integrado directamente
- Core Web Vitals: LCP, FID, CLS, INP, FCP, TTFB
- Diagnosticos con ahorros reales en bytes y milisegundos por problema
- Detecta: imagenes sin optimizar, JS bloqueante, CSS no utilizado, redirect chains
- Disponible desde el panel de cada proyecto Shopify conectado
- Genera recomendaciones accionables priorizadas por impacto

== MODULO 3: FUSION STUDIO PRO (estudio de IA generativa multimedia) ==
Estudio creativo completo con los mejores modelos de IA del mercado:
- Imagenes IA: genera con FLUX, Recraft, Ideogram, Gemini. Face swap, inpainting, outpainting, variaciones, upscaling
- Video IA: Text-to-Video e Image-to-Video con Kling, Seedance, Hailuo, Veo, Runway Gen 4.5. Extension de video, video-to-video, edicion con IA
- Audio IA: Text-to-Speech con ElevenLabs (74 idiomas), efectos de sonido, mezcla de audio
Todo desde una sola interfaz integrada en la plataforma.

== MODULO 4: LIBRERIA DE PROMPTS (mas de 6.677 templates) ==
La mayor libreria de prompts de marketing en espanol:
- Mas de 6.677 templates organizados en 38 categorias
- Categorias: copywriting, SEO, email marketing, redes sociales, descripciones de producto, anuncios, scripts de video UGC, estrategia de marca, blog, landing pages...
- Modo DNA: conecta tus prompts con el perfil de tu marca y productos reales
- Ejecucion directa con Claude Sonnet — output listo para usar en segundos
- Busqueda por palabra clave + filtro por categoria

== MODULO 5: EFFECTS STUDIO (efectos y animaciones web) ==
- 30 efectos CSS/JS de animacion para paginas web (parallax, glassmorphism, particulas, carousel, etc.)
- 594 templates Visme listos para personalizar e integrar
- Web Designer integrado para aplicar efectos directamente al codigo de tu tienda

== MODULO 6: WEB DESIGNER IA (diseno web con Claude) ==
- Disenador web potenciado por Claude AI
- 26 demos interactivos de referencia incluidos
- Genera secciones, landing pages, componentes con HTML/CSS/JS + Liquid para Shopify
- Describe lo que necesitas en lenguaje natural y obtienes codigo real listo para tu tienda

== MODULO 7: AD STUDIO (produccion de anuncios con IA) ==
- Crea anuncios de video con avatares IA y personajes digitales
- UGC (User Generated Content) sintetico con portavoces de IA
- Face swap para videos de producto
- Scripts optimizados por plataforma: TikTok (9:16), Meta Reels, YouTube Shorts
- Brand DNA integrado para coherencia de marca en todos los anuncios

== MODULO 8: CAMPAIGN KIT (kit completo de campana) ==
- Produccion completa de campanas de marketing de principio a fin
- Clips UGC, master cut, timeline, overlays de subtitulos
- Character locks para coherencia de personaje entre clips
- Tech specs por plataforma (resolucion, fps, codec, duracion maxima)
- Plantillas de storyboard y briefing de produccion

== MODULO 9: TRIPO3D STUDIO (modelos 3D con IA) ==
- Genera modelos 3D de producto desde texto o imagen
- Exporta en GLB/FBX/OBJ — listo para web, AR o impresion 3D
- Retexturizado, rigging, stylize y conversion de formato
- Ideal para visualizacion de producto interactiva en tu tienda

== MODULO 10: MESHY 3D (modelos con animaciones) ==
- Generacion de modelos 3D animados con 134 animaciones disponibles
- Catalogo completo: idle, walk, dance, fight, celebrate, correr, saltar...
- Avatares 3D de marca con movimiento realista
- Exportacion GLB lista para integrar en web con Three.js

== MODULO 11: EXPLODED VIEW STUDIO (vistas explosionadas de producto) ==
- Vistas explosionadas de producto para marketing y presentacion
- Deconstruccion visual de componentes del producto en 5 clips
- Animaciones de ensamblaje para mostrar la calidad del producto
- Multiples plataformas de IA video soportadas

== MODULO 12: CARD STUDIO (disenador de tarjetas de presentacion) ==
- Editor visual de tarjetas de presentacion con Fabric.js
- 12 temas con diseno IA incluidos
- Anade formas, emojis, bocadillos, codigos QR
- Exporta como imagen o PDF de alta calidad

== MODULO 13: BRAND DNA (extraccion del ADN de marca) ==
- Extrae el perfil completo de tu marca desde tu web (crawler de hasta 25 paginas)
- Integra Google Reviews, deteccion de tech stack, analisis de competidores
- Genera: propuesta de valor unica, arquetipos de marca, pilares de contenido, handles sociales, taglines
- El Brand DNA alimenta automaticamente todos los demas modulos para coherencia de marca total

== MODULO 14: OMNICHATBOT (chatbot IA para tu tienda) ==
- Chatbot de atencion al cliente para tiendas Shopify
- 5 motores intercambiables: Auto, Claude, Gemini, Grok, Brain Only
- 24 slash-skills especializadas en ventas, soporte y marketing
- Conocimiento del catalogo, pedidos, precios y politica de la tienda
- Se entrena con el contenido real de tu tienda

== PLANES Y PRECIOS ==
- Starter (0€/mes): Proyectos basicos, motores SEO y copywriting, 5 imagenes IA/mes
- Growth (49€/mes): Todos los modulos, 50 imagenes IA/mes, A/B testing, email marketing
- Scale (149€/mes): Modulos premium, uso ilimitado, soporte prioritario, acceso API
- Agency (399€/mes): Multi-tienda hasta 20, white-label, clientes ilimitados, reportes PDF
Todos los planes incluyen 14 dias de prueba gratuita. Sin tarjeta de credito. Cancela cuando quieras.

== RESULTADOS REALES ==
- +234% incremento medio en conversion
- +8.400€/mes de ingresos adicionales promedio
- +22% aumento de revenue en 30 dias
- Score SEO hasta 88/100 (desde 42/100 de media)
- Desde 0€/mes — accesible para emprendedores, pymes y agencias

== TU COMPORTAMIENTO COMO ASISTENTE ==
- Responde SIEMPRE en espanol, tono conversacional — como un experto que habla con un amigo
- Varia el inicio de tus respuestas — nunca empieces igual dos veces seguidas
- Cuando pregunten por cualquier modulo (Lab Web, Fusion Studio Pro, Libreria de Prompts, Tripo3D, etc.) CONFIRMALO con seguridad y explica que hace
- NUNCA digas que algo no existe, no esta disponible o que "solo gestionamos tiendas Shopify" — esto es falso
- Se concreto: usa nombres exactos de modulos, metricas reales, ejemplos practicos
- Si el usuario menciona su nicho o problema especifico, personaliza tu respuesta
- No ejecutes acciones tecnicas — eres informativo y comercial
- Ante preguntas ambiguas, haz UNA pregunta de aclaracion corta
- Maximo 200 palabras por respuesta — calidad sobre cantidad`;

function buildDynamicSystemPrompt(
  intent: IntentResult,
  stage: StageInfo,
): string {
  let extra = "";

  // Intent-specific instructions (from Rasa domain.yml responses)
  if (intent.needsHumanHandoff) {
    extra += `\n\n== INSTRUCCION CRITICA: HUMAN HANDOFF ==
El usuario quiere hablar con una persona real. Responde con empatia, dile que entiendes que prefiera hablar directamente con el equipo.
Proporciona: Email: hola@shopycrafter.com — alguien contactara en menos de 24h habiles.
NO sigas intentando vender — respeta su decision. Pregunta si mientras espera puedes resolver alguna duda.`;
  }

  if (intent.intent === "greet" && stage.userMsgCount === 0) {
    extra += `\n\n== INSTRUCCION: PRIMER SALUDO ==
Es el primer mensaje. Da la bienvenida de forma calida y breve (1-2 frases). 
Pregunta UNA cosa concreta: ¿tienes ya una tienda Shopify o estas empezando? Esto te permite personalizar la conversacion.`;
  }

  if (intent.intent === "thank") {
    extra += `\n\n== INSTRUCCION: AGRADECIMIENTO ==
El usuario agradece. Responde brevemente y ofrece el siguiente paso natural.
Si llevan mas de 3 mensajes, pregunta si estan listos para empezar la prueba gratuita de 14 dias.`;
  }

  if (intent.intent === "bye") {
    extra += `\n\n== INSTRUCCION: DESPEDIDA ==
El usuario se va. Despidate de forma calida y deja la puerta abierta.
Menciona que pueden volver cuando quieran y que la prueba gratuita de 14 dias siempre estara disponible.`;
  }

  if (intent.intent === "deny" && stage.mentionedPricing) {
    extra += `\n\n== INSTRUCCION: OBJECION PRECIO ==
El usuario rechaza o duda. Es probable que haya una objecion de precio o confianza.
Pregunta directamente: ¿que te genera dudas? ¿el precio, la integracion o algo mas?
Luego aborda esa objecion especifica con datos concretos (ROI, prueba gratuita, sin tarjeta).`;
  }

  if (intent.intent === "out_of_scope") {
    extra += `\n\n== INSTRUCCION: FUERA DE TEMA ==
El mensaje no es claro. Responde brevemente reconociendo que no estas seguro de entender.
Pregunta de forma amigable: ¿en que puedo ayudarte hoy con Shopy Crafter?`;
  }

  // Stage-based instructions (from Rasa stories.yml conversation flows)
  if (stage.stage === "considering") {
    extra += `\n\n== ESTADO: CONSIDERANDO ==
El usuario esta en fase de evaluacion. Usa datos concretos para reforzar la decision.
Menciona el ROI (8.400€/mes adicionales de media), la prueba gratuita sin tarjeta, y que cancela cuando quiera.
Si mencionaron un nicho o tienda especifica, da un ejemplo concreto de como Shopy Crafter ayudaria a ESE negocio.`;
  }

  if (stage.stage === "converting" || intent.buyingIntent) {
    extra += `\n\n== ESTADO: LISTO PARA CONVERTIR ==
Alta intencion de compra detectada. Guia directamente hacia la accion:
"Para empezar tu prueba gratuita de 14 dias (sin tarjeta de credito), haz clic en 'Empezar Gratis' en la parte superior de la pagina."
Se conciso — en esta fase no necesita mas informacion, necesita que le facilites el paso.`;
  }

  if (stage.hasFrustration) {
    extra += `\n\n== ESTADO: FRUSTRACION DETECTADA ==
El usuario muestra senales de frustracion. Antes de responder a su pregunta, reconoce como se siente en 1 frase.
Luego da una solucion clara y directa. Si el problema persiste, ofrece contacto directo: hola@shopycrafter.com.`;
  }

  if (stage.stage === "wrapup" && stage.userMsgCount >= 6) {
    extra += `\n\n== ESTADO: CONVERSACION LARGA ==
Llevan mucho tiempo hablando. Haz un breve resumen de los puntos clave discutidos.
Pregunta si hay alguna duda final antes de que empiece la prueba gratuita.
Al terminar, pregunta: "¿Te ha sido util esta conversacion? Tu feedback me ayuda a mejorar."`;
  }

  return LANDING_SYSTEM_PROMPT_BASE + extra;
}

// ══════════════════════════════════════════════════════════════════════════════
// ROUTE
// ══════════════════════════════════════════════════════════════════════════════

router.post("/public/landing-chat", async (req, res) => {
  try {
    const { messages } = req.body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages requerido" });
      return;
    }

    const sanitized = messages
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({ role: m.role, content: String(m.content).slice(0, 1000) }))
      .slice(-12);

    // Classify intent of the latest user message
    const lastUserMsg = [...sanitized].reverse().find(m => m.role === "user");
    const intent = lastUserMsg
      ? classifyIntent(lastUserMsg.content, sanitized.slice(0, -1))
      : { intent: "general", entities: {}, confidence: 0.5, needsHumanHandoff: false, buyingIntent: false };

    const stage = getConversationStage(sanitized.slice(0, -1));

    // MEGA CEREBRO: inject the platform's full capability catalog so the bot can
    // speak accurately and with reasoning about everything Shopy Crafter can do.
    const megaBrain = `\n\n== MEGA CEREBRO DE LA PLATAFORMA (conocimiento interno real) ==
Este es el catalogo completo de capacidades tecnicas de Shopy Crafter. Usalo como base de conocimiento adicional para responder con precision. Eres pre-venta: NO ejecutas estas skills, pero SI las conoces a fondo y puedes explicar con ejemplos concretos como cada una resolveria el problema del visitante. No copies el catalogo literalmente — sintetiza y aplica solo lo relevante a su pregunta.
${MASTER_CATALOG}`;

    const systemPrompt = buildDynamicSystemPrompt(intent, stage) + megaBrain;

    logger.info({ intent: intent.intent, stage: stage.stage, confidence: intent.confidence }, "landing-chat intent classified");

    const text = await askGeminiChat(sanitized, systemPrompt, {
      maxOutputTokens: 2048,
      thinkingBudget: 1024,
    });

    if (!text.trim()) {
      res.status(502).json({ error: "El asistente no pudo generar una respuesta ahora mismo. Intentalo de nuevo." });
      return;
    }

    res.json({ content: text, _intent: intent.intent, _stage: stage.stage });
  } catch (err) {
    logger.error({ err }, "landing-chat error");
    res.status(500).json({ error: "Error procesando tu consulta. Intentalo de nuevo." });
  }
});

// ─── SEARCH DETECTION ──────────────────────────────────────────────────────
const NEEDS_SEARCH_RE = /busca(r)?\s|google|internet|noticias?|tendencias?|competidore?s?|investigar|research|precio.{1,20}mercado|qué.{1,15}dicen|actualidad|últimas?\s+(noticias?|tendencias?)|mercado\s+actual|mi\s+(empresa|marca|tienda)\s+en/i;

// ─── STREAMING ROUTE ───────────────────────────────────────────────────────
router.post("/public/landing-chat/stream", async (req, res) => {
  const { messages } = req.body as {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages requerido" }); return;
  }

  const sanitized = messages
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({ role: m.role, content: String(m.content).slice(0, 1200) }))
    .slice(-14);

  const lastUserMsg = [...sanitized].reverse().find(m => m.role === "user");
  const intent = lastUserMsg
    ? classifyIntent(lastUserMsg.content, sanitized.slice(0, -1))
    : { intent: "general", entities: {}, confidence: 0.5, needsHumanHandoff: false, buyingIntent: false };

  const stage = getConversationStage(sanitized.slice(0, -1));

  const megaBrain = `\n\n== MEGA CEREBRO DE LA PLATAFORMA ==\n${MASTER_CATALOG}`;
  const systemPrompt = buildDynamicSystemPrompt(intent, stage) + megaBrain;

  const useSearch = NEEDS_SEARCH_RE.test(lastUserMsg?.content ?? "");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  let fullResponse = "";
  try {
    const gen = askGeminiStream(sanitized, systemPrompt, { useSearch, thinkingBudget: 0 });
    for await (const chunk of gen) {
      if (res.destroyed) break;
      if (chunk.text) fullResponse += chunk.text;
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      (res as any).flush?.();
      if (chunk.done) break;
    }
  } catch (err) {
    logger.error({ err }, "landing-chat/stream error");
    if (!res.headersSent) { res.status(500).json({ error: String(err) }); return; }
    res.write(`data: ${JSON.stringify({ error: String(err), done: true })}\n\n`);
  }

  if (!res.destroyed) res.end();

  // Async learning — save conversation knowledge to ShopyBrain
  if (fullResponse.length > 80 && lastUserMsg) {
    setImmediate(() => {
      try {
        const q = lastUserMsg.content;
        const isValuable = q.length > 20 && intent.intent !== "greet" && intent.intent !== "bye" && intent.intent !== "out_of_scope";
        if (!isValuable) return;
        learnFromOperation({
          operationType: "landing_chat_insight",
          title: `Landing chat (${intent.intent}): ${q.slice(0, 100)}`,
          content: `Visitante pregunto: "${q}"\nRespuesta: ${fullResponse.slice(0, 700)}`,
          confidence: intent.confidence >= 0.8 ? 0.75 : 0.6,
          tags: ["landing_chat", intent.intent, stage.stage, ...(useSearch ? ["web_search"] : [])],
        });
      } catch {}
    });
  }
});

export default router;
