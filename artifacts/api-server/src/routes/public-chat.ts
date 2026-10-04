import { Router } from "express";
import { askGeminiChat, askGeminiStream, askGeminiWithSearch, askGeminiWithUrls } from "../lib/gemini.js";
import { logger } from "../lib/logger.js";
import { learnFromOperation } from "../lib/claude.js";
import { buildModulesBlock, buildPricingBlock } from "../lib/platform-knowledge.js";

const router = Router();

// ══════════════════════════════════════════════════════════════════════════════
// INTENT CLASSIFIER — patrones extraídos de Rasa NLU
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

  const emailMatch = msg.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
  if (emailMatch) entities.email = emailMatch[0];
  const budgetMatch = msg.match(/(\d+)\s*(€|eur|euros?)/i);
  if (budgetMatch) entities.budget = budgetMatch[0];

  if (/hablar con (humano|persona|agente|alguien|empleado|comercial|soporte)|persona real|quiero que me llame|llámame|hablar con vosotros|contacto directo/.test(msg)) {
    return { intent: "human_handoff", entities, confidence: 0.92, needsHumanHandoff: true, buyingIntent: false };
  }
  if (/^(hola|buenos|buenas|hey|hi|hello|qué tal|saludos|ey|ola|good morning|good afternoon|buenas tardes|buenas noches)\b/.test(msg) && msg.length < 40) {
    return { intent: "greet", entities, confidence: 0.95, needsHumanHandoff: false, buyingIntent: false };
  }
  if (/demo|reservar|agendar|contratar|suscribir|empezar ya|cómo me registro|quiero acceso|quiero (empezar|probarlo|la prueba)|prueba gratuita|free trial|acceso|darme de alta/.test(msg)) {
    return { intent: "contact_sales", entities, confidence: 0.88, needsHumanHandoff: false, buyingIntent: true };
  }
  if (/cuánto cuesta|precio|tarifa|plan|coste|cost|pricing|cuánto (vale|es)|es gratis|gratuito|pago/.test(msg)) {
    return { intent: "faq/pricing", entities, confidence: 0.85, needsHumanHandoff: false, buyingIntent: false };
  }
  if (/cómo funciona|cómo se usa|para qué sirve|qué hace|qué es shopy|explicar|cuéntame|cuéntame más|cómo trabaja|cómo ayuda/.test(msg)) {
    return { intent: "faq/how_it_works", entities, confidence: 0.82, needsHumanHandoff: false, buyingIntent: false };
  }
  if (/seguro|seguridad|confianza|oauth|contraseña|datos|privacidad|rgpd|gdpr|acceso a mi tienda|mi tienda es segura/.test(msg)) {
    return { intent: "faq/security", entities, confidence: 0.8, needsHumanHandoff: false, buyingIntent: false };
  }
  if (/motor|función|qué puede hacer|imagen|seo|email|klaviyo|a\.b test|precio|copywriting|generá|automatiz/.test(msg)) {
    return { intent: "faq/features", entities, confidence: 0.78, needsHumanHandoff: false, buyingIntent: false };
  }
  if (/newsletter|suscribir(me)?|recibir noticias|actualizaciones|novedades/.test(msg)) {
    return { intent: "signup_newsletter", entities, confidence: 0.82, needsHumanHandoff: false, buyingIntent: false };
  }
  if (/^(gracias|muchas gracias|genial|perfecto|excelente|muy bien|entendido|ok gracias|fenomenal|guay|estupendo|que bueno|muy útil)/.test(msg)) {
    return { intent: "thank", entities, confidence: 0.88, needsHumanHandoff: false, buyingIntent: false };
  }
  if (/^(adiós|hasta luego|bye|chao|nos vemos|hasta pronto|me voy|hasta mañana|hasta)$/.test(msg)) {
    return { intent: "bye", entities, confidence: 0.9, needsHumanHandoff: false, buyingIntent: false };
  }
  if (/^(sí|si|yes|claro|claro que sí|por supuesto|de acuerdo|ok|okay|vale|acepto|afirmativo|exacto|efectivamente|correcto|adelante|va|dale)/.test(msg) && msg.length < 30) {
    return { intent: "affirm", entities, confidence: 0.85, needsHumanHandoff: false, buyingIntent: false };
  }
  if (/^(no|nope|no gracias|negativo|para nada|tampoco|ahora no|en otro momento|lo pensaré)/.test(msg) && msg.length < 30) {
    return { intent: "deny", entities, confidence: 0.85, needsHumanHandoff: false, buyingIntent: false };
  }
  if (/ayuda|help|no (sé|entiendo|funciona)|problema|error|issue|soporte/.test(msg)) {
    return { intent: "need_help_broad", entities, confidence: 0.7, needsHumanHandoff: false, buyingIntent: false };
  }
  if (msg.length < 5 || /^(\.\.\.|xd|jaja|gg|lol|wtf|hmm|meh|ok\.|ah\.|ya\.?)$/.test(msg)) {
    return { intent: "out_of_scope", entities, confidence: 0.6, needsHumanHandoff: false, buyingIntent: false };
  }

  return { intent: "general", entities, confidence: 0.55, needsHumanHandoff: false, buyingIntent: false };
}

// ══════════════════════════════════════════════════════════════════════════════
// CONVERSATION STAGE TRACKER
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
// BLOQUE 1 — CLIENT CONTEXT EXTRACTOR
// Detecta URL, nombre de empresa y hechos clave del negocio en la conversación
// ══════════════════════════════════════════════════════════════════════════════

interface ClientFacts {
  niche?: string;
  audience?: string;
  challenge?: string;
  goal?: string;
  currentPlatform?: string;
  monthlyRevenue?: string;
  productType?: string;
  location?: string;
}

interface ClientContext {
  detectedUrl?: string;
  detectedCompanyName?: string;
  facts: ClientFacts;
  hasResearchTarget: boolean;
  advisorMode: boolean;
  factCount: number;
}

function extractClientContext(
  messages: Array<{ role: string; content: string }>,
): ClientContext {
  const userText = messages.filter(m => m.role === "user").map(m => m.content).join("\n");

  // URL detection (https or bare domain)
  const urlMatch = userText.match(/https?:\/\/[^\s,)]+/);
  const domainMatch = userText.match(/\b([a-zA-Z0-9][a-zA-Z0-9-]{2,}\.(com|es|shop|store|net|org|co\.uk|io|co))\b/i);

  // Company name detection
  const companyPatterns = [
    /(?:mi (?:tienda|empresa|marca|negocio|web) (?:se llama|es|lleva el nombre))\s*["']?([A-ZÁÉÍÓÚÑ][a-zA-ZáéíóúñÁÉÍÓÚÑ\s&'-]{2,35})/i,
    /(?:tengo una? (?:tienda|empresa|marca) (?:llamada?|de nombre)\s+)["']?([A-ZÁÉÍÓÚÑ][a-zA-ZáéíóúñÁÉÍÓÚÑ\s&'-]{2,35})/i,
    /(?:somos|soy)\s+([A-ZÁÉÍÓÚÑ][a-zA-ZáéíóúñÁÉÍÓÚÑ\s&'-]{2,30})\s+(?:y|,|\.)/i,
    /(?:la marca|la tienda|el negocio)\s+(?:se llama|es)\s+["']?([A-ZÁÉÍÓÚÑ][a-zA-ZáéíóúñÁÉÍÓÚÑ\s&'-]{2,35})/i,
  ];
  let detectedCompanyName: string | undefined;
  for (const p of companyPatterns) {
    const m = userText.match(p);
    if (m?.[1]?.trim()) { detectedCompanyName = m[1].trim(); break; }
  }

  const facts: ClientFacts = {};

  // Niche / sector
  const nichePatterns = [
    /(?:vend(?:emos?|o)|tienda de|me dedico a|negocio de|en el sector|sector|nicho)\s*(?:de|:)?\s*([^.!\n,]{5,60})/i,
    /(?:somos una?|soy una?)\s+(?:tienda|empresa|marca|negocio)\s+de\s+([^.!\n,]{5,50})/i,
    /(?:productos?|artículos?|servicios?)\s+(?:de|para)\s+([^.!\n,]{5,50})/i,
  ];
  for (const p of nichePatterns) {
    const m = userText.match(p);
    if (m?.[1]) { facts.niche = m[1].trim(); break; }
  }

  // Audience / target
  const audienceMatch = userText.match(
    /(?:clientes?|audiencia|target|público objetivo|compran|compradores?)\s*(?:son|es|:)\s*([^.!\n,]{5,60})/i
  );
  if (audienceMatch?.[1]) facts.audience = audienceMatch[1].trim();

  // Challenge / problem
  const challengePatterns = [
    /(?:problema|reto|dificultad|nos cuesta|no conseguimos?|falla|nos va mal en|bajo en|necesitamos mejorar)\s+(?:es\s+)?([^.!\n,]{5,80})/i,
    /(?:no estamos? vendiendo|poca? tráfico|pocas? ventas|bajo? conversión|muchos abandonos?)/i,
  ];
  for (const p of challengePatterns) {
    const m = userText.match(p);
    if (m) { facts.challenge = (m[1] ?? m[0]).trim(); break; }
  }

  // Goal
  const goalMatch = userText.match(
    /(?:quiero|queremos|necesito|buscamos?|objetivo es|meta es|aspiramos? a)\s+([^.!\n,]{5,80})/i
  );
  if (goalMatch?.[1]) facts.goal = goalMatch[1].trim();

  // Current platform
  if (/shopify/i.test(userText)) facts.currentPlatform = "Shopify";
  else if (/woocommerce|wordpress/i.test(userText)) facts.currentPlatform = "WooCommerce";
  else if (/prestashop/i.test(userText)) facts.currentPlatform = "PrestaShop";
  else if (/wix/i.test(userText)) facts.currentPlatform = "Wix";
  else if (/magento/i.test(userText)) facts.currentPlatform = "Magento";
  else if (/tiendanube/i.test(userText)) facts.currentPlatform = "Tiendanube";

  // Revenue / size
  const revMatch = userText.match(/(\d[\d.,]*)\s*(€|eur|euros?|k€|k\s*euros?)\s*(?:al mes|mensual|por mes|\/mes)/i);
  if (revMatch) facts.monthlyRevenue = revMatch[0];

  // Location
  const locMatch = userText.match(/(?:somos? de|estamos? en|con sede en|tienda en|España|México|Argentina|Colombia|Madrid|Barcelona|[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{3,}(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{3,})?)\b/);
  if (locMatch) facts.location = locMatch[0].trim();

  const detectedUrl = urlMatch?.[0] || (domainMatch ? `https://${domainMatch[0]}` : undefined);
  const hasResearchTarget = !!(detectedUrl || detectedCompanyName);
  const factCount = Object.values(facts).filter(Boolean).length;
  const advisorMode = hasResearchTarget || factCount >= 1 || messages.filter(m => m.role === "user").length >= 3;

  return { detectedUrl, detectedCompanyName, facts, hasResearchTarget, advisorMode, factCount };
}

// ══════════════════════════════════════════════════════════════════════════════
// BLOQUE 2 — QUICK COMPANY RESEARCH (Gemini Search / URL Context)
// Si detectamos URL o nombre → investigamos en tiempo real → inyectamos el resumen
// ══════════════════════════════════════════════════════════════════════════════

async function quickResearch(ctx: ClientContext): Promise<string> {
  try {
    if (ctx.detectedUrl) {
      const res = await Promise.race([
        askGeminiWithUrls(
          `Analiza este sitio de ecommerce brevemente (máx 300 palabras): ¿qué vende, a quién, precio aproximado, puntos fuertes y debilidades visibles de la tienda online? ¿Qué herramientas de marketing detectas?`,
          [ctx.detectedUrl],
          "Eres un auditor experto de ecommerce. Sé conciso y específico.",
        ),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error("timeout")), 15000)),
      ]);
      if (res && typeof res === "object" && "text" in res && res.text) {
        return `\n\n== ANÁLISIS REAL DEL SITIO WEB DETECTADO (${ctx.detectedUrl}) ==\n${res.text}\n(Análisis realizado ahora mismo con IA web)`;
      }
    }

    if (ctx.detectedCompanyName) {
      const name = ctx.detectedCompanyName;
      const res = await Promise.race([
        askGeminiWithSearch(
          `Busca información sobre "${name}" en ecommerce o retail. ¿Qué venden, dónde están, qué tamaño tienen, qué debilidades de marketing/ecommerce podrían tener? Sé breve (máx 200 palabras).`,
          "Eres un auditor experto de ecommerce y marketing digital. Sé conciso.",
        ),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error("timeout")), 15000)),
      ]);
      if (res && typeof res === "object" && "text" in res && res.text) {
        return `\n\n== INVESTIGACIÓN REALIZADA SOBRE "${name}" ==\n${res.text}\n(Búsqueda web realizada ahora mismo)`;
      }
    }
  } catch (err) {
    logger.warn({ err }, "quickResearch timeout/error — skipping");
  }
  return "";
}

// ══════════════════════════════════════════════════════════════════════════════
// BLOQUE 3 — ADVISOR MODE SYSTEM PROMPT BUILDER
// Construye el bloque de contexto personalizado + modo consultor
// ══════════════════════════════════════════════════════════════════════════════

function buildClientContextBlock(ctx: ClientContext, researchSummary: string): string {
  if (!ctx.advisorMode && !ctx.hasResearchTarget && ctx.factCount === 0) return researchSummary;

  let block = "";

  if (ctx.hasResearchTarget || ctx.factCount >= 1) {
    block += `\n\n== DATOS DEL NEGOCIO DEL VISITANTE ==\n`;
    block += `MODO ACTIVADO: ASESOR PERSONALIZADO — responde usando ESPECÍFICAMENTE su situación real, no genérica.\n\n`;

    if (ctx.detectedUrl) block += `🌐 URL de su tienda: ${ctx.detectedUrl}\n`;
    if (ctx.detectedCompanyName) block += `🏢 Nombre: ${ctx.detectedCompanyName}\n`;

    const { facts } = ctx;
    if (Object.keys(facts).length > 0) {
      block += `\n📋 LO QUE SÉ DE SU NEGOCIO (extraído de la conversación):\n`;
      if (facts.niche) block += `  • Sector/Producto: ${facts.niche}\n`;
      if (facts.currentPlatform) block += `  • Plataforma actual: ${facts.currentPlatform}\n`;
      if (facts.audience) block += `  • Audiencia: ${facts.audience}\n`;
      if (facts.challenge) block += `  • Problema/Reto: ${facts.challenge}\n`;
      if (facts.goal) block += `  • Objetivo: ${facts.goal}\n`;
      if (facts.monthlyRevenue) block += `  • Revenue mensual: ${facts.monthlyRevenue}\n`;
      if (facts.location) block += `  • Ubicación: ${facts.location}\n`;
    }

    block += `
== INSTRUCCIONES DE ASESOR PERSONAL ==
- Usa todos los datos anteriores para dar consejos CONCRETOS y ESPECÍFICOS para SU negocio
- NO repitas información genérica de Shopy Crafter — aplícala a SU caso
- Si conoces su nicho: da ejemplos de resultados en ese mismo sector
- Si conoces su problema: explica EXACTAMENTE cómo el módulo concreto de Shopy Crafter lo resuelve
- Si tienen URL/empresa: referencia algo específico de lo que sabes sobre ellos
- Cada 2-3 respuestas, haz UNA pregunta de diagnóstico para completar el perfil
- Cuando tengas 3+ hechos del negocio: ofrece un "Mini-diagnóstico gratuito" con:
  → Los 3 problemas más probables en su situación
  → Cómo los resuelve Shopy Crafter específicamente
  → El siguiente paso: auditoría de su tienda para medir con sus datos reales`;
  }

  if (researchSummary) {
    block += researchSummary;
  }

  return block;
}

// ══════════════════════════════════════════════════════════════════════════════
// DYNAMIC SYSTEM PROMPT
// ══════════════════════════════════════════════════════════════════════════════

const LANDING_SYSTEM_PROMPT_BASE = `Eres ShopyAdvisor, el asesor comercial de Shopy Crafter: una plataforma de IA y un equipo que la opera para tiendas online (Shopify, WooCommerce y PrestaShop), además de diseño web y apps nativas a medida.

== REGLAS DE VERACIDAD (obligatorias, hay consecuencias legales) ==
- Solo afirmas lo que aparece en los módulos, planes y servicios de abajo. Si algo no está, dilo y ofrece hablar con el equipo.
- NUNCA inventes cifras de resultados (conversión, ingresos, ROI, % de mejora, número de clientes) ni prometas resultados concretos.
- Si piden una estimación, explica que primero se hace una auditoría de su tienda y que los resultados se miden con sus propios datos.
- No existen: marca blanca, SLA, API pública, soporte 24/7 ni cuotas ilimitadas. El A/B testing es solo para tiendas Shopify.
- Contacto humano: formulario de contacto de la web o craftershopy@gmail.com.

${buildModulesBlock()}

${buildPricingBlock()}

== TU COMPORTAMIENTO PRINCIPAL ==
- Responde SIEMPRE en español, tono conversacional y profesional
- Cuando tengas datos del negocio del visitante: úsalos para explicar qué módulo o servicio le encaja y por qué
- Cuando NO tengas datos: haz UNA pregunta para conocer su negocio (nicho, reto, plataforma actual)
- Sé conciso: máximo 200 palabras por respuesta`;

function buildDynamicSystemPrompt(
  intent: IntentResult,
  stage: StageInfo,
  ctx: ClientContext,
  researchSummary: string,
): string {
  let extra = "";

  if (intent.needsHumanHandoff) {
    extra += `\n\n== HUMAN HANDOFF ==
El usuario quiere hablar con una persona real. Responde con empatía y da el email: craftershopy@gmail.com o el formulario de contacto. No sigas vendiendo.`;
  }

  if (intent.intent === "greet" && stage.userMsgCount === 0) {
    extra += `\n\n== PRIMER SALUDO ==
Da la bienvenida calida y breve (1-2 frases). 
Pregunta: ¿tienes ya una tienda online o estás empezando? (o si detectaste su nicho: ¿cuál es tu mayor reto ahora mismo con tu tienda de ${ctx.facts.niche ?? "ecommerce"}?)`;
  }

  if (intent.intent === "thank") {
    extra += `\n\n== AGRADECIMIENTO ==
Responde brevemente y ofrece el siguiente paso. Si llevan más de 3 mensajes, pregunta si están listos para suscribirse.`;
  }

  if (intent.intent === "bye") {
    extra += `\n\n== DESPEDIDA ==
Despídete cálidamente y deja la puerta abierta. Menciona que pueden volver cuando quieran.`;
  }

  if (intent.intent === "deny" && stage.mentionedPricing) {
    extra += `\n\n== OBJECIÓN PRECIO ==
Pregunta directamente: ¿qué te genera dudas? ¿el precio, la integración o algo más? Luego aborda esa objeción con hechos (plan desde 19 €/mes, sin permanencia, se cancela desde el portal).`;
  }

  if (stage.stage === "considering") {
    extra += `\n\n== ESTADO: CONSIDERANDO ==
Recuerda los hechos: sin permanencia, se cancela desde el portal, primero se audita la tienda.
${ctx.facts.niche ? `Para una tienda de ${ctx.facts.niche}, da un ejemplo específico de cómo Shopy Crafter ayudaría.` : ""}`;
  }

  if (stage.stage === "converting" || intent.buyingIntent) {
    extra += `\n\n== LISTO PARA CONVERTIR ==
Alta intención de compra. Guía directamente: "Para empezar, déjanos tus datos en el formulario de contacto y te activamos la cuenta. Sin permanencia." Sé conciso.`;
  }

  if (stage.hasFrustration) {
    extra += `\n\n== FRUSTRACIÓN DETECTADA ==
Reconoce cómo se siente en 1 frase, luego da solución clara. Si el problema persiste: craftershopy@gmail.com.`;
  }

  const clientBlock = buildClientContextBlock(ctx, researchSummary);

  return LANDING_SYSTEM_PROMPT_BASE + extra + clientBlock;
}

// ══════════════════════════════════════════════════════════════════════════════
// ROUTE — non-streaming (Gemini Flash)
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
      .map(m => ({ role: m.role as "user" | "assistant", content: String(m.content).slice(0, 1200) }))
      .slice(-12);

    const lastUserMsg = [...sanitized].reverse().find(m => m.role === "user");
    const intent = lastUserMsg
      ? classifyIntent(lastUserMsg.content, sanitized.slice(0, -1))
      : { intent: "general", entities: {}, confidence: 0.5, needsHumanHandoff: false, buyingIntent: false };

    const stage = getConversationStage(sanitized.slice(0, -1));
    const ctx = extractClientContext(sanitized);

    // Research if URL or company detected
    const researchSummary = ctx.hasResearchTarget ? await quickResearch(ctx) : "";

    const systemPrompt = buildDynamicSystemPrompt(intent, stage, ctx, researchSummary);

    logger.info(
      { intent: intent.intent, stage: stage.stage, advisorMode: ctx.advisorMode, hasResearch: !!researchSummary },
      "landing-chat (gemini) intent classified"
    );

    const text = await askGeminiChat(sanitized, systemPrompt, { maxOutputTokens: 2048 });

    if (!text.trim()) {
      res.status(502).json({ error: "El asistente no pudo generar una respuesta ahora mismo. Inténtalo de nuevo." });
      return;
    }

    res.json({ content: text, _intent: intent.intent, _stage: stage.stage, _advisor: ctx.advisorMode });
  } catch (err) {
    logger.error({ err }, "landing-chat error");
    res.status(500).json({ error: "Error procesando tu consulta. Inténtalo de nuevo." });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ROUTE — streaming (Gemini Flash via SSE)
// ══════════════════════════════════════════════════════════════════════════════

router.post("/public/landing-chat/stream", async (req, res) => {
  const { messages } = req.body as {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages requerido" }); return;
  }

  const sanitized = messages
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({ role: m.role as "user" | "assistant", content: String(m.content).slice(0, 1200) }))
    .slice(-14);

  const lastUserMsg = [...sanitized].reverse().find(m => m.role === "user");
  const intent = lastUserMsg
    ? classifyIntent(lastUserMsg.content, sanitized.slice(0, -1))
    : { intent: "general", entities: {}, confidence: 0.5, needsHumanHandoff: false, buyingIntent: false };

  const stage = getConversationStage(sanitized.slice(0, -1));
  const ctx = extractClientContext(sanitized);

  // Fire research BEFORE starting SSE headers so we can include it in the prompt
  const researchSummary = ctx.hasResearchTarget ? await quickResearch(ctx) : "";

  const systemPrompt = buildDynamicSystemPrompt(intent, stage, ctx, researchSummary);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  let fullResponse = "";
  try {
    const stream = askGeminiStream(sanitized, systemPrompt);

    for await (const chunk of stream) {
      if (res.destroyed) break;
      if (chunk.text) {
        fullResponse += chunk.text;
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        (res as any).flush?.();
      }
      if (chunk.done) {
        res.write(`data: ${JSON.stringify({ done: true, _intent: intent.intent, _stage: stage.stage, _advisor: ctx.advisorMode })}\n\n`);
        break;
      }
      if (chunk.error) {
        res.write(`data: ${JSON.stringify({ error: chunk.error, done: true })}\n\n`);
        break;
      }
    }
  } catch (err) {
    logger.error({ err }, "landing-chat/stream error");
    if (!res.headersSent) { res.status(500).json({ error: String(err) }); return; }
    res.write(`data: ${JSON.stringify({ error: String(err), done: true })}\n\n`);
  }

  if (!res.destroyed) res.end();

  // Async learning
  if (fullResponse.length > 80 && lastUserMsg) {
    setImmediate(() => {
      try {
        const q = lastUserMsg.content;
        const isValuable = q.length > 20 && !["greet", "bye", "out_of_scope"].includes(intent.intent);
        if (!isValuable) return;
        learnFromOperation({
          operationType: "landing_chat_insight",
          title: `Landing chat (${intent.intent}${ctx.advisorMode ? "/advisor" : ""}): ${q.slice(0, 100)}`,
          content: `Visitante preguntó: "${q}"\nNicho: ${ctx.facts.niche ?? "desconocido"}\nReto: ${ctx.facts.challenge ?? "desconocido"}\nRespuesta: ${fullResponse.slice(0, 700)}`,
          confidence: intent.confidence >= 0.8 ? 0.75 : 0.6,
          tags: ["landing_chat", intent.intent, stage.stage, ...(ctx.advisorMode ? ["advisor_mode"] : []), ...(ctx.hasResearchTarget ? ["research"] : [])],
        });
      } catch {}
    });
  }
});

export default router;
