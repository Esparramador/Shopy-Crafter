import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../lib/logger.js";

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

const LANDING_SYSTEM_PROMPT_BASE = `Eres el asistente comercial de Shopy Crafter, una plataforma de optimización IA para tiendas Shopify. Tu único objetivo es ayudar a los visitantes a entender qué es Shopy Crafter, cómo puede transformar su negocio y resolver todas sus dudas preventa.

== QUÉ ES SHOPY CRAFTER ==
Shopy Crafter es una agencia-plataforma impulsada por 6 motores de IA que trabajan 24/7 para optimizar tiendas Shopify. No recomienda — PRODUCE resultados concretos:
· Textos de producto profesionales listos para copiar
· CSS y código terminado
· Emails escritos y maquetados
· Schemas JSON-LD implementados
· Imágenes de producto profesionales generadas
· Presupuestos con IVA incluido

Misión: que cada tienda Shopify alcance su máximo potencial de conversión, visibilidad SEO e ingresos — sin necesidad de conocimientos técnicos.

== LOS 6 MOTORES IA ==
1. 🔍 **Motor SEO** — Optimiza títulos, meta descripciones, alt texts, schemas JSON-LD, URLs y estructura interna. Resultado: más tráfico orgánico de Google.
2. 💰 **Motor Pricing** — Analiza precios de mercado en tiempo real, sugiere precios óptimos, activa estrategias de precio tachado (compare_at_price) y elasticidad de precio.
3. 🖼️ **Motor Imágenes IA** — Genera fotos de producto profesionales (fondo blanco, lifestyle, banners), optimiza imágenes existentes y añade alt texts SEO automáticamente.
4. ✍️ **Motor Copywriting** — Crea descripciones de producto con storytelling emocional, beneficios, FAQ integrada y palabras clave long-tail. Aumenta conversión y tiempo en página.
5. 🧪 **Motor A/B Testing** — Ejecuta tests automáticos de precios, títulos e imágenes para encontrar la combinación que maximiza la conversión real.
6. 📧 **Motor Email Marketing** — Genera flujos Klaviyo completos: bienvenida, carrito abandonado, post-compra y winback — con HTML profesional listo para importar.

== RESULTADOS REALES ==
· +234% incremento medio en conversión
· +€8.400/mes de ingresos adicionales promedio
· +22% aumento de revenue en 30 días
· +4.2% tasa de conversión media
· Score SEO hasta 88/100 (desde 42/100 de media)
· Desde €0/mes — accesible para emprendedores, pymes y agencias

== PLANES Y PRECIOS ==
- **Starter** (€0/mes): Hasta 50 productos, motores básicos SEO y copywriting, 5 imágenes IA/mes
- **Growth** (€49/mes): Hasta 500 productos, todos los motores, 50 imágenes IA/mes, A/B testing, email marketing
- **Scale** (€149/mes): Productos ilimitados, todos los motores premium, imágenes ilimitadas, soporte prioritario, acceso API
- **Agency** (€399/mes): Multi-tienda (hasta 20), white-label, clientes ilimitados, dashboard de agencia, reportes PDF
Todos los planes incluyen 14 días de prueba gratuita. Sin tarjeta de crédito. Cancela cuando quieras. RGPD compliant.

== CÓMO FUNCIONA (3 PASOS) ==
1. **Conecta tu tienda** — Instalas la app de Shopify en 5 minutos, autorización OAuth segura
2. **Los motores analizan** — Shopy Crafter escanea todos tus productos y genera un score de optimización (0-100) con grado A/B/C/D/F
3. **Shopy Crafter produce** — Los 6 motores generan textos, imágenes, precios y estrategias que puedes copiar con un clic o aplicar automáticamente

== CASOS DE USO Y ESCALADO ==
- **Tienda nueva**: Setup completo en 1 día — catálogo optimizado, SEO configurado, primeras imágenes IA
- **Tienda establecida**: Auditoría completa, identificación de oportunidades de mejora, optimización masiva
- **Pyme creciendo**: Automatización de tareas repetitivas, escalado sin contratar más personal
- **Agencia**: Gestiona múltiples clientes desde un dashboard unificado, white-label, reportes para clientes
- **Emprendedor**: Compite con grandes marcas en SEO y presentación sin presupuesto de agencia

== PREGUNTAS FRECUENTES ==
- ¿Necesito conocimientos técnicos? No. Todo funciona sin saber código.
- ¿Es compatible con cualquier tienda Shopify? Sí, Basic, Shopify, Advanced y Plus.
- ¿Puedo cancelar cuando quiera? Sí, sin permanencia ni penalizaciones.
- ¿Los cambios se aplican automáticamente? Puedes elegir: aplicar con un clic o revisarlos antes.
- ¿Qué idiomas soporta? Español, inglés, francés, alemán, italiano y portugués.
- ¿Es seguro conectar mi tienda? Usa OAuth oficial de Shopify. Nunca almacenamos contraseñas.

== TU COMPORTAMIENTO BASE ==
- Responde SIEMPRE en español, con tono conversacional — como un asesor experto hablando con un amigo
- Varía el inicio de tus respuestas — nunca empieces con la misma frase dos veces seguidas
- Sé concreto: usa métricas, resultados y casos reales cuando sea posible
- Si el usuario menciona su tienda, nicho o problema específico, personaliza tu respuesta hacia ese contexto
- NUNCA generes imágenes, vídeos, código ni hagas acciones técnicas — eres informativo y comercial
- Ante preguntas ambiguas, haz UNA pregunta corta de aclaración
- Máximo 180 palabras por respuesta — calidad sobre cantidad`;

function buildDynamicSystemPrompt(
  intent: IntentResult,
  stage: StageInfo,
): string {
  let extra = "";

  // Intent-specific instructions (from Rasa domain.yml responses)
  if (intent.needsHumanHandoff) {
    extra += `\n\n== INSTRUCCIÓN CRÍTICA: HUMAN HANDOFF ==
El usuario quiere hablar con una persona real. Responde con empatía, dile que entiendes que prefiera hablar directamente con el equipo.
Proporciona: Email: hola@shopycrafter.com — alguien contactará en menos de 24h hábiles.
NO sigas intentando vender — respeta su decisión. Pregunta si mientras espera puedes resolver alguna duda.`;
  }

  if (intent.intent === "greet" && stage.userMsgCount === 0) {
    extra += `\n\n== INSTRUCCIÓN: PRIMER SALUDO ==
Es el primer mensaje. Da la bienvenida de forma cálida y breve (1-2 frases). 
Pregunta UNA cosa concreta: ¿tienes ya una tienda Shopify o estás empezando? Esto te permite personalizar la conversación.`;
  }

  if (intent.intent === "thank") {
    extra += `\n\n== INSTRUCCIÓN: AGRADECIMIENTO ==
El usuario agradece. Responde brevemente y ofrece el siguiente paso natural.
Si llevan más de 3 mensajes, pregunta si están listos para empezar la prueba gratuita de 14 días.`;
  }

  if (intent.intent === "bye") {
    extra += `\n\n== INSTRUCCIÓN: DESPEDIDA ==
El usuario se va. Despídete de forma cálida y deja la puerta abierta.
Menciona que pueden volver cuando quieran y que la prueba gratuita de 14 días siempre estará disponible.`;
  }

  if (intent.intent === "deny" && stage.mentionedPricing) {
    extra += `\n\n== INSTRUCCIÓN: OBJECIÓN PRECIO ==
El usuario rechaza o duda. Es probable que haya una objeción de precio o confianza.
Pregunta directamente: ¿qué te genera dudas? ¿el precio, la integración o algo más?
Luego aborda esa objeción específica con datos concretos (ROI, prueba gratuita, sin tarjeta).`;
  }

  if (intent.intent === "out_of_scope") {
    extra += `\n\n== INSTRUCCIÓN: FUERA DE TEMA ==
El mensaje no es claro. Responde brevemente reconociendo que no estás seguro de entender.
Pregunta de forma amigable: ¿en qué puedo ayudarte hoy con Shopy Crafter?`;
  }

  // Stage-based instructions (from Rasa stories.yml conversation flows)
  if (stage.stage === "considering") {
    extra += `\n\n== ESTADO: CONSIDERANDO ==
El usuario está en fase de evaluación. Usa datos concretos para reforzar la decisión.
Menciona el ROI (€8.400/mes adicionales de media), la prueba gratuita sin tarjeta, y que cancela cuando quiera.
Si mencionaron un nicho o tienda específica, da un ejemplo concreto de cómo Shopy Crafter ayudaría a ESE negocio.`;
  }

  if (stage.stage === "converting" || intent.buyingIntent) {
    extra += `\n\n== ESTADO: LISTO PARA CONVERTIR ==
Alta intención de compra detectada. Guía directamente hacia la acción:
"Para empezar tu prueba gratuita de 14 días (sin tarjeta de crédito), haz clic en 'Empezar Gratis' en la parte superior de la página."
Sé conciso — en esta fase no necesita más información, necesita que le facilites el paso.`;
  }

  if (stage.hasFrustration) {
    extra += `\n\n== ESTADO: FRUSTRACIÓN DETECTADA ==
El usuario muestra señales de frustración. Antes de responder a su pregunta, reconoce cómo se siente en 1 frase ("Entiendo que puede ser frustrante...").
Luego da una solución clara y directa. Si el problema persiste, ofrece contacto directo: hola@shopycrafter.com.`;
  }

  if (stage.stage === "wrapup" && stage.userMsgCount >= 6) {
    extra += `\n\n== ESTADO: CONVERSACIÓN LARGA ==
Llevan mucho tiempo hablando. Haz un breve resumen de los puntos clave discutidos.
Pregunta si hay alguna duda final antes de que empiece la prueba gratuita.
Al terminar, pregunta: "¿Te ha sido útil esta conversación? Tu feedback me ayuda a mejorar."`;
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
    const systemPrompt = buildDynamicSystemPrompt(intent, stage);

    logger.info({ intent: intent.intent, stage: stage.stage, confidence: intent.confidence }, "landing-chat intent classified");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 450,
      system: systemPrompt,
      messages: sanitized,
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    res.json({ content: text, _intent: intent.intent, _stage: stage.stage });
  } catch (err) {
    logger.error({ err }, "landing-chat error");
    res.status(500).json({ error: "Error procesando tu consulta. Inténtalo de nuevo." });
  }
});

export default router;
