const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
const stream = fs.createWriteStream('/home/runner/workspace/Informe-Servicios-ShopyCrafter-2026.pdf');
doc.pipe(stream);

const GOLD = '#C9A84C';
const DARK = '#0A0A0F';
const TEXT = '#E0E0E6';
const MUTED = '#8A8A9A';
const GREEN = '#2ECC71';
const WHITE = '#FFFFFF';
const RED = '#E74C3C';
const BLUE = '#3498DB';
const PURPLE = '#9B59B6';

let currentPage = 0;

function newPage(doc) {
  if (currentPage > 0) doc.addPage();
  currentPage++;
  doc.rect(0, 0, 595, 842).fill(DARK);
  return 65;
}

function pageHeader(doc, section) {
  doc.fontSize(10).fillColor(GOLD).text('Shopy Crafter', 50, 30, { continued: false });
  doc.fontSize(9).fillColor(MUTED).text(section, 50, 30, { align: 'right', width: 495 });
  doc.moveTo(50, 48).lineTo(545, 48).strokeColor('#2A2A3A').lineWidth(0.5).stroke();
}

function pageFooter(doc, pageNum) {
  const y = 790;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#2A2A3A').lineWidth(0.5).stroke();
  doc.fontSize(9).fillColor(GOLD).text('Shopy Crafter', 50, y + 6);
  doc.fontSize(9).fillColor(MUTED).text(`shopycrafter.com`, 200, y + 6, { width: 195, align: 'center' });
  doc.fontSize(9).fillColor(MUTED).text(`${pageNum}`, 400, y + 6, { width: 145, align: 'right' });
}

function checkSpace(doc, needed, sectionName) {
  if (doc.y + needed > 760) {
    pageFooter(doc, currentPage);
    newPage(doc);
    pageHeader(doc, sectionName);
    doc.y = 65;
    return 65;
  }
  return doc.y;
}

function sectionTitle(doc, num, title1, title2) {
  doc.roundedRect(50, doc.y, 28, 28, 5).fill(GOLD);
  doc.fontSize(12).fillColor(DARK).text(num, 53, doc.y + 7, { width: 22, align: 'center' });
  doc.fontSize(22).fillColor(WHITE).text(title1 + ' ', 88, doc.y + 2, { continued: true }).fillColor(GOLD).text(title2);
  doc.y += 40;
}

function h3(doc, text, sectionName) {
  checkSpace(doc, 40, sectionName);
  doc.fontSize(16).fillColor(GOLD).text(text, 50, doc.y, { width: 495 });
  doc.y += 24;
}

function h4(doc, text, sectionName) {
  checkSpace(doc, 30, sectionName);
  doc.fontSize(13).fillColor(WHITE).text(text, 50, doc.y, { width: 495 });
  doc.y += 20;
}

function para(doc, text, sectionName, opts = {}) {
  const fontSize = opts.fontSize || 10;
  const color = opts.color || TEXT;
  const lineGap = opts.lineGap || 3;
  doc.fontSize(fontSize).fillColor(color);
  const h = doc.heightOfString(text, { width: 495, lineGap });
  checkSpace(doc, h + 8, sectionName);
  doc.text(text, 50, doc.y, { width: 495, lineGap });
  doc.y += h + 12;
}

function bullet(doc, items, sectionName, opts = {}) {
  const indent = opts.indent || 65;
  const color = opts.color || TEXT;
  items.forEach(item => {
    const h = doc.heightOfString(item, { width: 545 - indent - 10, fontSize: 10 });
    checkSpace(doc, h + 6, sectionName);
    doc.fontSize(10).fillColor(opts.bulletColor || GOLD).text('●', 50, doc.y);
    doc.fontSize(10).fillColor(color).text(item, indent, doc.y, { width: 545 - indent - 10, lineGap: 2 });
    doc.y += h + 6;
  });
  doc.y += 6;
}

function checkBullet(doc, items, sectionName) {
  items.forEach(item => {
    const h = doc.heightOfString(item, { width: 470, fontSize: 10 });
    checkSpace(doc, h + 6, sectionName);
    doc.fontSize(10).fillColor(GREEN).text('✓ ', 55, doc.y, { continued: true }).fillColor(TEXT).text(item, { width: 470, lineGap: 2 });
    doc.y += h + 6;
  });
  doc.y += 6;
}

function drawTable(doc, headers, rows, colWidths, sectionName, opts = {}) {
  const x0 = 50;
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const cellPad = 8;

  checkSpace(doc, 30, sectionName);
  doc.rect(x0, doc.y, totalW, 22).fill('#1A1A28');
  let cx = x0;
  headers.forEach((h, i) => {
    doc.fontSize(8).fillColor(GOLD).text(h.toUpperCase(), cx + cellPad, doc.y + 6, { width: colWidths[i] - cellPad * 2 });
    cx += colWidths[i];
  });
  doc.y += 22;

  rows.forEach((row, ri) => {
    const heights = row.map((cell, ci) => {
      const w = colWidths[ci] - cellPad * 2;
      return doc.heightOfString(String(cell), { width: w, fontSize: 9 }) + 10;
    });
    const rowH = Math.max(...heights, 22);

    checkSpace(doc, rowH + 2, sectionName);

    if (ri % 2 === 0) doc.rect(x0, doc.y, totalW, rowH).fill('#0F0F18');
    if (opts.highlightRows && opts.highlightRows.includes(ri)) doc.rect(x0, doc.y, totalW, rowH).fill('#1A1510');

    cx = x0;
    row.forEach((cell, ci) => {
      const isPrice = opts.priceCol !== undefined && ci === opts.priceCol;
      const isBold = ci === 0;
      doc.fontSize(9).fillColor(isPrice ? GOLD : (isBold ? WHITE : TEXT))
        .text(String(cell), cx + cellPad, doc.y + 5, { width: colWidths[ci] - cellPad * 2, lineGap: 2 });
      cx += colWidths[ci];
    });

    doc.moveTo(x0, doc.y + rowH).lineTo(x0 + totalW, doc.y + rowH).strokeColor('#1E1E2A').lineWidth(0.3).stroke();
    doc.y += rowH;
  });
  doc.y += 12;
}

function statBox(doc, stats, sectionName) {
  checkSpace(doc, 80, sectionName);
  const boxW = 115;
  stats.forEach((s, i) => {
    const sx = 50 + i * (boxW + 8);
    doc.roundedRect(sx, doc.y, boxW, 65, 8).fill('#111118');
    doc.fontSize(24).fillColor(GOLD).text(s[0], sx, doc.y + 10, { width: boxW, align: 'center' });
    doc.fontSize(8).fillColor(MUTED).text(s[1].toUpperCase(), sx, doc.y + 42, { width: boxW, align: 'center' });
  });
  doc.y += 80;
}

function motorCard(doc, code, name, desc, sectionName) {
  const h = doc.heightOfString(desc, { width: 430, fontSize: 9 }) + 35;
  checkSpace(doc, h + 8, sectionName);
  doc.roundedRect(50, doc.y, 495, h, 6).fill('#111118');
  doc.fontSize(14).fillColor(GOLD).text(code, 62, doc.y + 10);
  doc.fontSize(13).fillColor(WHITE).text(name, 100, doc.y + 10, { width: 430 });
  doc.fontSize(9).fillColor(MUTED).text(desc, 62, doc.y + 30, { width: 470, lineGap: 3 });
  doc.y += h + 8;
}

function flowStep(doc, num, title, desc, sectionName) {
  const h = doc.heightOfString(desc, { width: 440, fontSize: 9 }) + 25;
  checkSpace(doc, h + 6, sectionName);
  doc.circle(65, doc.y + 10, 12).fill(GOLD);
  doc.fontSize(10).fillColor(DARK).text(num, 55, doc.y + 6, { width: 20, align: 'center' });
  doc.fontSize(12).fillColor(WHITE).text(title, 88, doc.y + 2);
  doc.fontSize(9).fillColor(MUTED).text(desc, 88, doc.y + 20, { width: 440, lineGap: 3 });
  doc.y += h + 8;
}

function planCard(doc, plan, x, sectionName) {
  const featH = plan.features.length * 14 + (plan.excluded || []).length * 14 + 90;
  checkSpace(doc, featH, sectionName);

  const cardH = featH;
  doc.roundedRect(x, doc.y, 238, cardH, 6).fill('#111118');
  if (plan.popular) {
    doc.roundedRect(x, doc.y, 238, cardH, 6).strokeColor(GOLD).lineWidth(1).stroke();
    doc.roundedRect(x + 148, doc.y - 8, 80, 16, 8).fill(GOLD);
    doc.fontSize(7).fillColor(DARK).text('MÁS POPULAR', x + 150, doc.y - 5, { width: 76, align: 'center' });
  }

  let py = doc.y + 14;
  doc.fontSize(14).fillColor(WHITE).text(plan.name, x + 14, py, { width: 210 }); py += 22;
  doc.fontSize(20).fillColor(GOLD).text(plan.price, x + 14, py, { width: 210 }); py += 26;
  doc.fontSize(9).fillColor(MUTED).text(plan.setup, x + 14, py, { width: 210 }); py += 18;

  plan.features.forEach(f => {
    doc.fontSize(8).fillColor(GREEN).text('✓ ', x + 14, py, { continued: true }).fillColor(TEXT).text(f, { width: 200 });
    py += 14;
  });
  (plan.excluded || []).forEach(f => {
    doc.fontSize(8).fillColor(RED).text('✕ ', x + 14, py, { continued: true }).fillColor(MUTED).text(f, { width: 200 });
    py += 14;
  });

  return cardH;
}


// ================================================================
//  PORTADA
// ================================================================
newPage(doc);
doc.roundedRect(197, 100, 200, 22, 11).strokeColor(GOLD).lineWidth(1).stroke();
doc.fontSize(9).fillColor(GOLD).text('DOCUMENTO CONFIDENCIAL', 197, 106, { width: 200, align: 'center' });

doc.roundedRect(247, 150, 60, 60, 14).fill(GOLD);
doc.fontSize(28).fillColor(DARK).text('SC', 247, 168, { width: 60, align: 'center' });

doc.fontSize(36).fillColor(WHITE).text('Informe Ejecutivo de', 0, 240, { align: 'center' });
doc.fontSize(36).fillColor(GOLD).text('Servicios y Capacidades', 0, 282, { align: 'center' });

doc.moveTo(267, 335).lineTo(327, 335).strokeColor(GOLD).lineWidth(2).stroke();

doc.fontSize(13).fillColor(MUTED).text(
  'Catálogo completo de servicios, tecnología, precios y capacidades\nde la plataforma de agencia Shopify con IA más avanzada del mercado.',
  0, 355, { align: 'center', lineGap: 5 }
);

const metaY = 440;
doc.fontSize(8).fillColor(GOLD).text('EMPRESA', 150, metaY);
doc.fontSize(11).fillColor(TEXT).text('Shopy Crafter', 150, metaY + 14);
doc.fontSize(8).fillColor(GOLD).text('MOTOR IA', 340, metaY);
doc.fontSize(11).fillColor(TEXT).text('ShopyBrain (OmniCore AI)', 340, metaY + 14);
doc.fontSize(8).fillColor(GOLD).text('FECHA', 150, metaY + 45);
doc.fontSize(11).fillColor(TEXT).text('Marzo 2026', 150, metaY + 59);
doc.fontSize(8).fillColor(GOLD).text('WEB', 340, metaY + 45);
doc.fontSize(11).fillColor(TEXT).text('shopycrafter.com', 340, metaY + 59);
doc.fontSize(8).fillColor(GOLD).text('CONTACTO', 150, metaY + 90);
doc.fontSize(11).fillColor(TEXT).text('craftershopy@gmail.com', 150, metaY + 104);
doc.fontSize(8).fillColor(GOLD).text('VERSIÓN', 340, metaY + 90);
doc.fontSize(11).fillColor(TEXT).text('1.0', 340, metaY + 104);

// ================================================================
//  ÍNDICE
// ================================================================
let y = newPage(doc);
pageHeader(doc, 'Índice de Contenidos');
doc.y = y;
sectionTitle(doc, '—', 'Índice de', 'Contenidos');

para(doc, 'Este informe presenta de forma exhaustiva todas las capacidades, servicios, tecnología y precios de la plataforma Shopy Crafter. Cada capítulo se desarrolla con el detalle necesario para su correcta comprensión.', 'Índice', { color: MUTED, fontSize: 11 });

const tocItems = [
  ['01', 'Resumen Ejecutivo', 'Visión general de la plataforma, métricas clave y propuesta de valor'],
  ['02', 'Arquitectura Tecnológica', 'Motor dual de IA, seguridad, compliance e integraciones'],
  ['03', 'Los 6 Motores de Optimización', 'Descripción detallada de cada motor con casos de uso'],
  ['04', 'Catálogo de 79 Acciones IA', 'Todas las acciones automatizadas por categoría con descripciones'],
  ['05', 'Planes de Suscripción', 'Los 4 planes con features detalladas y comparativa'],
  ['06', 'Servicios Puntuales y Packs', 'Catálogo de servicios one-time, packs y servicios recurrentes'],
  ['07', 'Estándar de Calidad 100/100', 'Las 7 dimensiones de auditoría y 16 criterios SEO'],
  ['08', 'Ventajas Competitivas', 'Comparativas vs agencias tradicionales y apps Shopify'],
  ['09', 'Flujo de Trabajo del Cliente', 'Proceso de onboarding, optimización y crecimiento continuo'],
  ['10', 'Benchmarks por Industria', 'Datos de referencia y métricas clave por sector'],
  ['11', 'Contacto y Siguiente Paso', 'Datos de contacto, garantías y siguiente paso'],
];

tocItems.forEach(([num, title, desc]) => {
  checkSpace(doc, 40, 'Índice');
  doc.moveTo(50, doc.y + 36).lineTo(545, doc.y + 36).strokeColor('#1E1E2A').lineWidth(0.3).stroke();
  doc.fontSize(12).fillColor(GOLD).text(num, 55, doc.y + 4);
  doc.fontSize(12).fillColor(WHITE).text(title, 85, doc.y + 4, { width: 400 });
  doc.fontSize(9).fillColor(MUTED).text(desc, 85, doc.y + 22, { width: 440 });
  doc.y += 42;
});

pageFooter(doc, currentPage);

// ================================================================
//  CAPÍTULO 1: RESUMEN EJECUTIVO
// ================================================================
y = newPage(doc);
const S1 = '01 · Resumen Ejecutivo';
pageHeader(doc, S1);
doc.y = y;
sectionTitle(doc, '01', 'Resumen', 'Ejecutivo');

para(doc, 'Shopy Crafter es una agencia Shopify de nueva generación, 100% potenciada por inteligencia artificial, que representa un cambio de paradigma en la gestión de tiendas de comercio electrónico. A diferencia de las agencias tradicionales que dependen de equipos humanos de 5-10 personas y plazos de semanas, Shopy Crafter automatiza todo el ciclo de vida de una tienda Shopify — desde la creación del catálogo hasta la optimización continua — en cuestión de minutos.', S1, { fontSize: 11 });

para(doc, 'La plataforma opera 24 horas al día, 7 días a la semana, 365 días al año, a través de ShopyBrain (OmniCore AI), un motor de inteligencia artificial dual que combina la potencia de Claude (Anthropic) para razonamiento complejo y generación de contenido, con Gemini (Google) para investigación de mercado en tiempo real mediante Google Search Grounding.', S1, { fontSize: 11 });

statBox(doc, [['79', 'Acciones IA'], ['46K+', 'Insights'], ['6', 'Motores'], ['24/7', 'Operativo']], S1);

h3(doc, 'Propuesta de Valor', S1);
para(doc, 'Shopy Crafter no es una herramienta más de Shopify. Es una agencia completa encapsulada en una plataforma de IA que actúa como COO, CTO, CMO y CFO virtual de tu negocio. Donde antes necesitabas un desarrollador, un diseñador, un redactor SEO, un analista financiero y un project manager, ahora tienes un solo motor de IA que coordina 6 motores especializados y ejecuta 79 acciones automatizadas.', S1);

para(doc, 'La propuesta es simple: mismos resultados (o superiores) que una agencia premium, a una fracción del coste, con disponibilidad total y consistencia garantizada. Todo verificable y medible con nuestro estándar de calidad 100/100.', S1);

h3(doc, 'Modelo de Negocio', S1);
para(doc, 'Shopy Crafter opera con un modelo de negocio flexible y transparente, diseñado para adaptarse a las necesidades de cada cliente:', S1);

bullet(doc, [
  'Servicios puntuales (one-time): Para necesidades específicas como auditorías, rediseños de catálogo, generación de imágenes o informes de competencia. Sin compromiso mensual.',
  'Retainers mensuales (recurring): Para optimización continua, A/B testing, auto-pilot 24/7, y crecimiento compuesto semana a semana.',
  'Pagos exclusivamente por Shopify: No utilizamos Stripe ni pasarelas externas. Todo se gestiona a través del ecosistema Shopify para máxima simplicidad.',
], S1);

h3(doc, 'Garantías Fundamentales', S1);
checkBullet(doc, [
  'Sin tarjeta de crédito para empezar — prueba sin compromiso',
  'Setup en menos de 5 minutos — conecta tu tienda y la IA empieza a trabajar',
  'Sin permanencia — cancela en cualquier momento sin penalización',
  'RGPD compliant — todos los datos procesados y almacenados en la Unión Europea',
  'Encriptación AES-256 — todos los tokens de acceso Shopify encriptados',
  '99.9% de uptime garantizado — disponibilidad casi total',
  'Soporte completo en español — comunicación directa sin barreras',
], S1);

h3(doc, 'Resultados Esperados', S1);
para(doc, 'Basándonos en los datos acumulados de nuestro cerebro OmniCore (46.199 insights de eCommerce), los clientes que implementan los 6 motores de optimización pueden esperar:', S1);

bullet(doc, [
  'Incremento medio en conversión del 15-35% en los primeros 3 meses',
  'Mejora del score SEO de productos del 40-60% al 85-100% (estándar world-class)',
  'Reducción del 70-90% en tiempo de gestión de catálogo (automatización vs manual)',
  'Aumento del AOV (Average Order Value) del 10-20% mediante pricing inteligente',
  'Generación de imágenes profesionales a una fracción del coste de fotografía tradicional (~€0.25/producto vs €50-200/producto con fotógrafo)',
], S1);

pageFooter(doc, currentPage);

// ================================================================
//  CAPÍTULO 2: ARQUITECTURA TECNOLÓGICA
// ================================================================
y = newPage(doc);
const S2 = '02 · Arquitectura Tecnológica';
pageHeader(doc, S2);
doc.y = y;
sectionTitle(doc, '02', 'Arquitectura', 'Tecnológica');

para(doc, 'ShopyBrain es el corazón tecnológico de Shopy Crafter. Es un sistema de inteligencia artificial multi-modelo que orquesta diferentes motores de IA especializados para cubrir cada necesidad de una tienda Shopify profesional. A continuación se detalla cada componente de la arquitectura.', S2, { fontSize: 11 });

h3(doc, 'Motor Dual de IA — ShopyBrain (OmniCore AI)', S2);

para(doc, 'El motor de IA de ShopyBrain no depende de un solo modelo. Utiliza una arquitectura dual que combina los mejores modelos del mercado, cada uno para su especialidad:', S2);

drawTable(doc,
  ['Componente', 'Proveedor', 'Función Principal'],
  [
    ['Claude Sonnet 4.5', 'Anthropic', 'Modelo principal para razonamiento complejo, análisis financiero, generación de contenido profesional (descripciones 800-1200 palabras), auditorías SEO de 16 criterios, y toma de decisiones estratégicas. Max 4096 tokens por respuesta.'],
    ['Gemini 2.0 Flash', 'Google', 'Investigación de mercado en tiempo real mediante Google Search Grounding. Busca precios de competidores reales, tendencias de mercado, datos de productos similares, todo en tiempo real desde la web.'],
    ['Flux 1.1 Pro', 'Replicate', 'Generación de imágenes de producto profesionales. 8 tipos de imagen por producto (Hero, Lifestyle, Detalle, Packaging, UGC, Escala, Bundle, Infografía). Precisión del 94%, generación en menos de 2 segundos.'],
    ['Recraft v3', 'Replicate', 'Motor de consistencia visual. Asegura que todas las imágenes generadas mantienen la identidad de marca: paleta de colores, estilo fotográfico, iluminación cinematográfica (ratio Rembrandt 5:1).'],
    ['OmniCore Brain', 'Propio', 'Cerebro acumulativo con 46.199 insights y 311 memorias consolidadas de eCommerce. 37 dominios de conocimiento. 12 cron jobs de aprendizaje continuo que mejoran el sistema 24/7 sin intervención humana.'],
  ],
  [110, 75, 310], S2
);

h3(doc, 'OmniCore Brain: El Cerebro que Nunca Duerme', S2);

para(doc, 'A diferencia de un sistema de IA estático que siempre da las mismas respuestas, OmniCore Brain es un cerebro que aprende y evoluciona continuamente. Su arquitectura incluye:', S2);

bullet(doc, [
  '46.199 insights acumulados cubriendo IA, diseño, marketing, eCommerce, SEO, pricing y cientos de dominios de conocimiento especializados.',
  '311 memorias consolidadas que representan el conocimiento destilado más importante, listo para aplicar en decisiones estratégicas.',
  '37 dominios de conocimiento que van desde "Shopify Liquid templating" hasta "Psicología de pricing para eCommerce".',
  '12 cron jobs de aprendizaje continuo que funcionan como un equipo de analistas trabajando en turnos las 24 horas:',
], S2);

drawTable(doc,
  ['Cron Job', 'Frecuencia', 'Función'],
  [
    ['Renovación Tokens', 'Cada 20h', 'Renueva tokens de Shopify con 4h de margen de seguridad'],
    ['Micro-learning', 'Cada 3h', 'Aprende 2 dominios × 3 insights = 6 nuevos insights/ciclo'],
    ['Consolidación', 'Cada 6h', 'Convierte insights crudos en memorias consolidadas útiles'],
    ['Cross-synthesis', 'Cada 12h', 'Encuentra conexiones cruzadas entre dominios de conocimiento'],
    ['Deep Study', '1:00 AM', 'Estudio profundo: 14 dominios × 5 insights = 70 insights/noche'],
    ['Revenue Snapshots', '2:00 AM', 'Captura datos de revenue de Shopify para análisis temporal'],
    ['Datos Reales', '3:00 AM', 'Integración de datos reales de las tiendas conectadas'],
    ['Competidores', '6:00 AM', 'Escaneo automático de precios de competidores'],
    ['Inventario', '7:00 AM', 'Sincronización de stock y alertas de inventario'],
    ['Mega-synthesis', 'Dom 0:00', 'Síntesis estratégica semanal de todo lo aprendido'],
    ['Retroanálisis', 'Dom 3:00', 'Re-evaluación de insights antiguos con nueva información'],
    ['Auto-evaluación', '1º/mes', 'Informe mensual de rendimiento del propio cerebro'],
  ],
  [130, 90, 275], S2
);

h3(doc, 'Seguridad y Compliance', S2);

para(doc, 'La seguridad de los datos de nuestros clientes es prioridad absoluta. Cada capa del sistema implementa medidas de protección:', S2);

drawTable(doc,
  ['Aspecto', 'Implementación', 'Detalle'],
  [
    ['Encriptación', 'AES-256', 'Todos los tokens de acceso Shopify se almacenan encriptados con el estándar más robusto del mercado'],
    ['RGPD', 'Compliant', 'Datos procesados y almacenados dentro de la Unión Europea. Derecho al olvido implementado'],
    ['Tokens', 'Auto-rotación', 'Renovación automática cada 20 horas con 4h de margen de seguridad para evitar interrupciones'],
    ['Pagos', 'Sin datos PCI', 'No almacenamos datos de tarjeta de crédito. Todos los pagos vía Shopify Payments'],
    ['Sesiones', 'Autenticación segura', 'Express-session con roles granulares (admin/client). Sesiones seguras con HttpOnly cookies'],
    ['API', 'Rate limiting', 'Protección contra ataques de fuerza bruta y abuso de API'],
  ],
  [90, 100, 305], S2
);

h3(doc, 'Integraciones Nativas', S2);

para(doc, 'Shopy Crafter se integra nativamente con los servicios más importantes del ecosistema eCommerce:', S2);

drawTable(doc,
  ['Servicio', 'Tipo', 'Uso Principal'],
  [
    ['Shopify Admin API', 'REST + GraphQL', 'Gestión completa: productos, colecciones, pedidos, themes, metafields, inventario, clientes, analytics'],
    ['Google Search (Gemini)', 'API Grounding', 'Investigación de mercado en tiempo real: precios competidores, tendencias, datos de producto'],
    ['Google PageSpeed', 'API', 'Auditoría de Core Web Vitals: LCP (<2.5s), CLS (<0.1), INP (<200ms)'],
    ['Replicate', 'API', 'Generación de imágenes con IA: Flux 1.1 Pro para calidad fotográfica, Recraft v3 para consistencia'],
    ['Klaviyo', 'API', 'Email marketing profesional: flujos automatizados (Welcome, Cart, Post-Purchase, Win-Back, Browse)'],
    ['Gmail', 'API', 'Comunicaciones de la agencia desde craftershopy@gmail.com con identidad "Shopy Crafter"'],
  ],
  [120, 90, 285], S2
);

pageFooter(doc, currentPage);

// ================================================================
//  CAPÍTULO 3: LOS 6 MOTORES
// ================================================================
y = newPage(doc);
const S3 = '03 · Los 6 Motores de Optimización';
pageHeader(doc, S3);
doc.y = y;
sectionTitle(doc, '03', 'Los 6 Motores de', 'Optimización');

para(doc, 'Cada motor es un sistema especializado que trabaja de forma autónoma y coordinada para optimizar un aspecto crítico de tu tienda Shopify. Los 6 motores funcionan como un equipo de especialistas que trabajan en paralelo, compartiendo información a través del cerebro OmniCore para maximizar el impacto.', S3, { fontSize: 11 });

h3(doc, 'M1 — Generación de Imágenes Profesionales', S3);
para(doc, 'El motor de imágenes genera fotografía de producto profesional mediante inteligencia artificial generativa, eliminando la necesidad de sesiones fotográficas costosas y lentas.', S3);

bullet(doc, [
  'Tecnología: Replicate Flux 1.1 Pro (calidad fotográfica) + Recraft v3 (consistencia de marca)',
  'Coste: Aproximadamente €0.25 por producto (8 imágenes) — vs €50-200/producto con fotógrafo profesional',
  'Velocidad: Menos de 2 segundos por imagen generada',
  'Precisión: 94% de precisión en la calidad final',
  '8 tipos de imagen por producto: Hero (producto principal sobre fondo limpio), Lifestyle (producto en contexto de uso), Detalle (close-up de materiales/texturas), Packaging (cómo llega al cliente), UGC (aspecto de contenido generado por usuario), Escala (referencia de tamaño), Bundle (agrupación de productos), Infografía (SVG con especificaciones técnicas)',
], S3);

h3(doc, 'M2 — Consistencia Visual', S3);
para(doc, 'La consistencia visual es lo que diferencia una tienda profesional de una amateur. Este motor asegura que cada imagen de tu catálogo mantiene una identidad visual coherente.', S3);

bullet(doc, [
  'Brand Guidelines Encoding: Codifica tu guía de marca (colores, tipografía, tono) para aplicarla a cada imagen',
  'Iluminación cinematográfica: Ratio Rembrandt 5:1 para iluminación profesional consistente',
  'Paleta de colores: Mantiene la coherencia cromática en todo el catálogo',
  'Estilo fotográfico: El mismo estilo visual se aplica a todos los productos sin variación',
], S3);

h3(doc, 'M3 — A/B Testing Automático', S3);
para(doc, 'El motor de A/B testing permite experimentar con variantes de productos de forma científica, midiendo el impacto real en conversiones.', S3);

bullet(doc, [
  'Variables testeables: Títulos, precios, imágenes, descripciones de producto',
  'Pixel tracking integrado: Mide visitas, clics, conversiones y revenue por variante',
  'Confianza estadística: Calcula automáticamente cuándo hay suficientes datos para declarar un ganador',
  'Auto-aplicación: Los ganadores se aplican automáticamente sin intervención manual',
  'Testing simultáneo: Múltiples tests corriendo en paralelo en diferentes productos',
], S3);

h3(doc, 'M4 — Auto-Pilot 24/7', S3);
para(doc, 'El verdadero diferenciador de Shopy Crafter. Mientras duermes, 12 cron jobs trabajan para mejorar tu tienda continuamente. No es una promesa — es código ejecutándose cada hora, cada día, cada semana.', S3);

bullet(doc, [
  'Aprendizaje continuo: El cerebro aprende 6 nuevos insights cada 3 horas y 70 cada noche',
  'Competencia vigilada: Escaneo automático de precios de competidores cada mañana a las 6:00',
  'Inventario monitoreado: Sincronización de stock y alertas de rotura cada mañana a las 7:00',
  'Revenue tracking: Snapshots de ingresos a las 2:00 AM para análisis temporal',
  'Síntesis semanal: Cada domingo, el cerebro sintetiza todo lo aprendido en la semana',
  'Auto-evaluación mensual: El 1º de cada mes, el sistema genera un informe de su propio rendimiento',
], S3);

h3(doc, 'M5 — Pricing Financiero', S3);
para(doc, 'El pricing es donde la mayoría de las tiendas Shopify dejan dinero sobre la mesa. Este motor aplica ciencia financiera real a cada decisión de precio.', S3);

bullet(doc, [
  'Análisis P&L por producto: Ingresos, COGS, margen bruto, margen neto, breakeven',
  'COGS real: Materiales + producción + packaging + envío + comisiones Shopify + comisiones pasarela',
  'Unit Economics: AOV, CLV, CAC, ROAS — todas las métricas que importan',
  'Elasticidad precio-demanda: Cuánto puedes subir/bajar el precio sin perder volumen',
  'Simulador de escenarios: "Si cambio el precio de €29 a €34, ¿cuánto más facturo?"',
  'Psicología de precios aplicada: Charm pricing (.97/.99), anchoring con compare_at_price 30-40% mayor, decoy effect, free shipping thresholds',
  'Forecast financiero: Proyecciones a 3-6 meses con escenarios optimista, base y pesimista',
  'Investigación competitiva en tiempo real: Google Search para verificar precios del mercado real',
], S3);

h3(doc, 'M6 — SEO Técnico', S3);
para(doc, 'SEO no es solo "poner keywords". ShopyBrain implementa una auditoría nivel Semrush con 16 criterios ponderados que cubren cada aspecto del posicionamiento orgánico.', S3);

bullet(doc, [
  'Auditoría de 16 criterios ponderados: Cada producto recibe un score detallado con recomendaciones específicas',
  'Schema JSON-LD: Genera automáticamente Product, BreadcrumbList, Organization, FAQ y WebSite schemas para Rich Snippets en Google',
  'Meta tags optimizados: Title (60 chars con keyword), meta description (130-155 chars con CTA)',
  'Alt texts inteligentes: Descripciones descriptivas con keywords naturales para todas las imágenes',
  'Keyword Intelligence: Investigación con Google Search real — buyer intent, long-tail, LSI keywords',
  'Estrategia de blog: Calendario editorial, keyword clusters, y generación de artículos 1500+ palabras',
  'Sitemap optimizado: Verificación y optimización del sitemap XML',
  'Core Web Vitals: Auditoría via Google PageSpeed API (LCP <2.5s, CLS <0.1, INP <200ms)',
], S3);

pageFooter(doc, currentPage);

// ================================================================
//  CAPÍTULO 4: CATÁLOGO DE 79 ACCIONES
// ================================================================
y = newPage(doc);
const S4 = '04 · Catálogo de 79 Acciones IA';
pageHeader(doc, S4);
doc.y = y;
sectionTitle(doc, '04', 'Catálogo de', '79 Acciones IA');

para(doc, 'ShopyBrain ejecuta 79 acciones automatizadas que cubren el 100% de las operaciones necesarias para gestionar una tienda Shopify profesional. Cada acción está diseñada para ejecutarse de forma autónoma — el usuario solo necesita indicar qué quiere y ShopyBrain se encarga del resto.', S4, { fontSize: 11 });

para(doc, 'Las acciones se pueden ejecutar individualmente o en cadena. Por ejemplo, al pedir "monta mi tienda desde cero", ShopyBrain ejecuta automáticamente: investigación de nicho → creación de 20-30 productos → colecciones → páginas → SEO → schemas → alt texts → email flows, todo en secuencia sin intervención manual.', S4);

h3(doc, 'Gestión de Productos — 14 acciones', S4);
drawTable(doc,
  ['Acción', 'Descripción Detallada'],
  [
    ['Crear producto', 'Crea un producto completo con investigación de mercado real (Google Search), pricing psicológico (.97/.99), descripción profesional de 800-1200 palabras con 8 secciones, 22-28 tags SEO optimizados, y opción de generación de imágenes IA'],
    ['Editar producto', 'Modifica cualquier campo de un producto existente: título, descripción, precio, tags, imágenes, vendor, product type, metafields'],
    ['Eliminar producto', 'Elimina un producto de la tienda Shopify de forma permanente'],
    ['Buscar producto', 'Búsqueda inteligente por título, vendor, product type o cualquier campo'],
    ['Listar productos', 'Listado paginado con cursor-based pagination de Shopify (no page=N)'],
    ['Listar todos', 'Lista completa de todo el catálogo para análisis global'],
    ['Publicar producto', 'Cambia un producto de borrador a publicado en la tienda'],
    ['Cambiar estado', 'Cambia entre active, draft y archived con validación de impacto'],
    ['Cambiar precio', 'Actualiza el precio con psicología aplicada (compare_at_price automático)'],
    ['Optimizar producto', 'Optimización integral: título + descripción + tags + SEO + meta en una acción'],
    ['Optimizar todo', 'Optimización masiva de todo el catálogo — cada producto recibe tratamiento completo'],
    ['Rediseño IA', 'Rediseño completo con metodología Semrush: análisis, investigación, nuevo contenido'],
    ['Rediseño masivo', 'Rediseño bulk: modo "all" (todo el catálogo) o "weak" (solo productos con score bajo)'],
    ['Aplicar rediseño', 'Aplica campos específicos de un rediseño previamente aprobado'],
  ],
  [120, 375], S4
);

h3(doc, 'Imágenes IA — 3 acciones', S4);
drawTable(doc,
  ['Acción', 'Descripción', 'Coste'],
  [
    ['Generar imágenes', '8 tipos de imagen profesional para un producto específico: Hero, Lifestyle, Detalle, Packaging, UGC, Escala, Bundle, Infografía', '~€0.25/prod'],
    ['Generación masiva', 'Genera imágenes para múltiples productos en batch, manteniendo consistencia visual entre todos', '~€0.25/prod'],
    ['Optimizar imágenes', 'Compresión inteligente, añadir alt text descriptivo con keywords, configurar lazy loading para rendimiento', 'Incluido'],
  ],
  [120, 285, 90], S4, { priceCol: 2 }
);

h3(doc, 'SEO Técnico — 10 acciones', S4);
drawTable(doc,
  ['Acción', 'Descripción Detallada'],
  [
    ['Auditoría SEO completa', '16 criterios ponderados nivel Semrush: título (12%), descripción (22%), precio (10%), imágenes (18%), SEO meta (18%), calidad contenido (12%), trust signals (8%). Score global + recomendaciones priorizadas'],
    ['Keyword Intelligence', 'Investigación de keywords con Google Search real: buyer intent ("comprar X"), long-tail ("mejor X para Y"), LSI (sinónimos), commercial investigation ("review X")'],
    ['Estrategia de blog', 'Calendario editorial completo: topics por mes, keyword clusters, pillar pages, formato de artículos, frecuencia recomendada'],
    ['Generar artículo', 'Artículo optimizado de 1500+ palabras con schema FAQ markup para featured snippets, interno linking, CTAs'],
    ['Schemas JSON-LD', 'Genera Product, BreadcrumbList, Organization, FAQ, WebSite schemas para Rich Snippets en Google'],
    ['Meta tags masivos', 'Genera meta title (60 chars) y meta description (130-155 chars) optimizados para todo el catálogo'],
    ['Corregir alt texts', 'Revisa y corrige los alt texts de todas las imágenes con descripciones y keywords naturales'],
    ['Generar sitemap', 'Optimiza el sitemap XML para máxima indexación en Google'],
    ['PageSpeed audit', 'Auditoría via Google PageSpeed API: LCP, CLS, INP, puntuación de rendimiento, recomendaciones'],
    ['Filtro de auditoría', 'Filtra y segmenta auditorías por criterios específicos para análisis focalizado'],
  ],
  [140, 355], S4
);

h3(doc, 'Pricing e Inteligencia Financiera — 6 acciones', S4);
drawTable(doc,
  ['Acción', 'Descripción Detallada'],
  [
    ['Precio óptimo', 'Calcula el precio que maximiza beneficio basándose en competidores reales (Google Search), elasticidad de demanda, y posicionamiento del producto'],
    ['Estimación COGS', 'Calcula el coste real por unidad: materiales + producción + packaging + envío + comisiones Shopify (2.4-2.9%) + comisiones pasarela'],
    ['Simulador de precios', 'Simula escenarios: "si cambio el precio de €29 a €34, ¿qué impacto tiene en margen, volumen y revenue total?"'],
    ['Forecast financiero', 'Proyección a 3-6 meses con 3 escenarios (optimista/base/pesimista), análisis de estacionalidad, y recomendaciones de crecimiento'],
    ['Dashboard financiero', 'Dashboard completo: revenue, márgenes bruto/neto, AOV, CLV, CAC, ROAS, breakeven, runway — todo en tiempo real'],
    ['Pricing competitivo', 'Investiga precios de competidores en tiempo real usando Google Search Grounding de Gemini. Datos reales, no estimaciones'],
  ],
  [140, 355], S4
);

h3(doc, 'A/B Testing — 3 acciones', S4);
drawTable(doc,
  ['Acción', 'Descripción Detallada'],
  [
    ['Crear test A/B', 'Configura un test con pixel tracking: elige variable (título, precio, imagen, descripción), define variantes, establece duración y criterios de éxito'],
    ['Listar tests', 'Muestra todos los tests activos con métricas en tiempo real: visitas, clics, conversiones, revenue, nivel de confianza estadística'],
    ['Declarar ganador', 'Cuando un test alcanza confianza estadística suficiente, declara el ganador y aplica la variante ganadora al producto original automáticamente'],
  ],
  [140, 355], S4
);

h3(doc, 'Email Marketing — 2 acciones', S4);
drawTable(doc,
  ['Acción', 'Descripción Detallada'],
  [
    ['Generar flujo completo', 'Genera flujos automatizados profesionales: Welcome Series (5 emails: bienvenida + descuento, historia, best sellers, social proof, recordatorio), Abandoned Cart (3 emails: recordatorio 1h, urgencia 24h, descuento 48h), Post-Purchase (4 emails: confirmación, tips, review, cross-sell), Win-Back (clientes inactivos 60-90 días), Browse Abandonment'],
    ['Generar email individual', 'Genera un email individual con copy profesional, CTA optimizado, diseño responsive HTML, subject line con A/B test suggestion, preheader text, y personalización dinámica'],
  ],
  [140, 355], S4
);

h3(doc, 'Competencia e Inventario — 4 acciones', S4);
drawTable(doc,
  ['Acción', 'Descripción Detallada'],
  [
    ['Escanear competidor', 'Escaneo completo de un competidor: catálogo de productos, rango de precios, posicionamiento, gaps de mercado, fortalezas/debilidades, oportunidades para tu tienda'],
    ['Analizar producto competidor', 'Análisis detallado de un producto específico de la competencia: precio, descripción, SEO, imágenes, reviews, posicionamiento vs tu catálogo'],
    ['Sincronizar inventario', 'Sincronización de niveles de stock con Shopify: cantidades disponibles, SKUs, ubicaciones, variantes'],
    ['Alertas de inventario', 'Alertas automáticas: stock bajo, roturas de stock inminentes, sugerencias de restock basadas en velocidad de venta'],
  ],
  [150, 345], S4
);

h3(doc, 'Colecciones y Páginas — 6 acciones', S4);
drawTable(doc,
  ['Acción', 'Descripción Detallada'],
  [
    ['Crear colección', 'Crea colecciones inteligentes (automáticas por tags/vendor/type) o manuales con descripción SEO y reglas de filtrado'],
    ['Listar colecciones', 'Lista todas las colecciones con conteo de productos, tipo (smart/manual) y estado'],
    ['Auto-colecciones', 'Genera automáticamente colecciones basadas en análisis de tags, product types y vendors del catálogo existente'],
    ['Crear página', 'Crea páginas de contenido profesional: About Us, FAQ, Shipping Policy, Returns Policy, Contact. Con copy profesional y SEO'],
    ['Listar páginas', 'Lista todas las páginas de contenido de la tienda'],
    ['Diseñar todas las páginas', 'Diseña todas las páginas esenciales de una tienda desde cero con contenido profesional'],
  ],
  [140, 355], S4
);

h3(doc, 'Theme / Código Shopify — 10 acciones', S4);
drawTable(doc,
  ['Acción', 'Descripción Detallada'],
  [
    ['Listar themes', 'Lista todos los themes instalados con estado (main/unpublished) e información'],
    ['Listar archivos', 'Lista archivos del theme: layout, templates, sections, snippets, assets, config, locales'],
    ['Leer archivo', 'Lee el contenido de cualquier archivo del theme (Liquid, JSON, CSS, JS)'],
    ['Editar archivo', 'Edita un archivo del theme preservando lo existente (lee antes de escribir, siempre)'],
    ['Editar CSS', 'Modifica estilos CSS específicos sin romper los existentes'],
    ['Editar settings', 'Modifica configuración del Theme Editor: colores, tipografía, layout, spacing'],
    ['Crear sección', 'Crea una sección personalizada de Online Store 2.0 con schema completo'],
    ['Auditar theme', 'Auditoría completa: rendimiento, SEO, accesibilidad, mobile, best practices'],
    ['Analizar componente', 'Análisis detallado de un componente específico del theme'],
    ['Corregir código', 'Detecta y corrige errores en Liquid, CSS o JavaScript del theme'],
  ],
  [130, 365], S4
);

h3(doc, 'CMS, Agencia, Brain y Setup — 13 acciones', S4);
drawTable(doc,
  ['Acción', 'Descripción Detallada'],
  [
    ['Leer CMS', 'Lee la configuración actual de la landing page (hero, pricing, features, contact, nav, footer)'],
    ['Actualizar CMS', 'Actualiza un campo específico del CMS (ej: hero.headline, pricing.plans.0.price)'],
    ['Actualizar CMS batch', 'Actualiza múltiples campos del CMS en una sola operación atómica'],
    ['Resetear CMS', 'Restaura el CMS a los valores por defecto de la plataforma'],
    ['Presupuesto', 'Genera presupuesto personalizado basado en servicios seleccionados por el cliente'],
    ['Propuesta comercial', 'Genera propuesta comercial profesional completa, lista para enviar como PDF'],
    ['Investigar proveedores', 'Búsqueda global de proveedores: Alibaba, 1688, Global Sources, IndiaMART, ThomasNet'],
    ['Auditar oferta', 'Auditoría de la oferta de servicios actual de Shopy Crafter vs mercado'],
    ['Stats del cerebro', 'Estadísticas de OmniCore: insights, memorias, dominios, rendimiento'],
    ['Sincronizar cerebro', 'Fuerza un ciclo de aprendizaje inmediato del cerebro'],
    ['Exportar cerebro', 'Exporta el conocimiento acumulado de OmniCore Brain'],
    ['Diagnóstico', 'Health check completo: DB, APIs externas, cron jobs, tokens, estado general'],
    ['Setup completo', 'Configura tienda COMPLETA desde cero en 9 pasos automáticos secuenciales'],
  ],
  [140, 355], S4
);

pageFooter(doc, currentPage);

// ================================================================
//  CAPÍTULO 5: PLANES DE SUSCRIPCIÓN
// ================================================================
y = newPage(doc);
const S5 = '05 · Planes de Suscripción';
pageHeader(doc, S5);
doc.y = y;
sectionTitle(doc, '05', 'Planes de', 'Suscripción');

para(doc, 'Shopy Crafter ofrece 4 planes diseñados para adaptarse a cada etapa de crecimiento de tu negocio. Desde un pago único para necesidades puntuales hasta un plan enterprise con infraestructura dedicada. Transparente, sin letra pequeña, sin sorpresas.', S5, { fontSize: 11 });

h3(doc, 'Plan 1: Photoshoot Pro — Pago Único', S5);
para(doc, 'Ideal para tiendas que necesitan un refresh visual de su catálogo sin compromiso mensual. Un solo pago, resultados profesionales.', S5);

drawTable(doc, ['', ''], [
  ['Precio', '€497 — pago único, sin retainer mensual'],
  ['Incluye', '120 imágenes IA (4 variantes × 30 SKUs)'],
  ['', 'Consistencia visual automática con guía de marca'],
  ['', 'Iluminación cinematográfica (ratio Rembrandt 5:1)'],
  ['', 'Audit SEO semántico de 30 fichas de producto'],
  ['', '1 sesión estratégica de pricing financiero (análisis de margen óptimo)'],
  ['', 'Entrega en 7 días laborables'],
  ['', 'Soporte por email durante 30 días post-entrega'],
  ['No incluye', 'A/B testing automático, Auto-pilot continuo, Acceso a futuros motores'],
], [120, 375], S5);

h3(doc, 'Plan 2: Growth Studio — Mensual', S5);
para(doc, 'El plan para tiendas en crecimiento que quieren optimización continua y resultados compuestos semana a semana. El punto de entrada para desbloquear el poder de los 6 motores.', S5);

drawTable(doc, ['', ''], [
  ['Precio', '€297/mes + €197 setup único'],
  ['Incluye', 'Generación ilimitada de imágenes de producto con IA'],
  ['', 'Consistencia visual automática (brand guidelines encoding)'],
  ['', 'A/B testing visual automático en 3 productos simultáneos'],
  ['', 'Motor de pricing financiero: análisis de elasticidad precio-demanda'],
  ['', 'SEO técnico automático para hasta 100 URLs/mes'],
  ['', 'Auto-pilot básico: ejecución automática de ganadores A/B'],
  ['', 'Dashboard de analytics con atribución multicanal'],
  ['', 'Soporte por email y chat (respuesta <24h)'],
  ['', 'Integraciones: Shopify, Google Analytics, Meta Pixel'],
  ['No incluye', 'A/B testing ilimitado, Custom AI model training, Soporte dedicado'],
], [120, 375], S5);

h3(doc, 'Plan 3: Performance Lab — MÁS POPULAR', S5);
para(doc, 'El plan estrella para tiendas con volumen que buscan maximizar conversión y revenue. Desbloquea todo el potencial de la plataforma con IA personalizada y soporte prioritario.', S5);

drawTable(doc, ['', ''], [
  ['Precio', '€797/mes + €397 setup único'],
  ['Incluye', 'Todo lo incluido en Growth Studio, más:'],
  ['', 'A/B testing visual ilimitado (productos simultáneos ilimitados)'],
  ['', 'Auto-pilot avanzado: optimización 24/7 cross-producto'],
  ['', 'Pricing financiero predictivo con simulación de escenarios'],
  ['', 'SEO técnico automático ilimitado (crawling y fixes automáticos)'],
  ['', 'Motor de recomendaciones basado en semantic search'],
  ['', 'Algorithmic Schema Augmentation: contenido SEO generado por IA a escala'],
  ['', 'Custom AI model fine-tuning con tus datos históricos'],
  ['', 'Soporte prioritario por chat y videollamada (respuesta <4h)'],
  ['', 'Sesión mensual de estrategia con especialista (60 min)'],
  ['', 'Acceso anticipado a nuevos motores IA'],
  ['No incluye', 'Account manager dedicado con SLA contractual'],
], [120, 375], S5);

h3(doc, 'Plan 4: Enterprise Omnicore', S5);
para(doc, 'Para marcas y retailers con necesidades enterprise que requieren infraestructura dedicada, compliance certificado y soporte 24/7 con SLA contractual.', S5);

drawTable(doc, ['', ''], [
  ['Precio', 'Desde €2.497/mes — setup incluido — precio personalizado'],
  ['Incluye', 'Todo lo incluido en Performance Lab, más:'],
  ['', 'Account manager dedicado con SLA contractual'],
  ['', 'Custom AI development: motores IA diseñados para tus casos de uso'],
  ['', 'Infraestructura dedicada (no multi-tenant)'],
  ['', 'API privada con webhooks personalizados'],
  ['', 'Integración con ERPs, PIMs y custom stacks'],
  ['', 'White-label completo (remoción de branding ShopyBrain)'],
  ['', 'SSO enterprise (SAML, OAuth, Active Directory integration)'],
  ['', 'Compliance certificado: GDPR, SOC2, ISO 27001'],
  ['', 'Soporte 24/7 con respuesta garantizada <1h (critical issues)'],
  ['', 'Sesiones estratégicas semanales + Quarterly Business Reviews'],
  ['', 'Training continuo del equipo (onboarding ilimitado)'],
  ['', 'Desarrollo de features custom bajo demanda'],
], [120, 375], S5);

pageFooter(doc, currentPage);

// ================================================================
//  CAPÍTULO 6: SERVICIOS PUNTUALES Y PACKS
// ================================================================
y = newPage(doc);
const S6 = '06 · Servicios Puntuales y Packs';
pageHeader(doc, S6);
doc.y = y;
sectionTitle(doc, '06', 'Servicios Puntuales', 'y Packs');

para(doc, 'Para clientes que no necesitan un plan mensual, Shopy Crafter ofrece un catálogo de servicios puntuales (one-time) que se pueden contratar de forma individual. Cada servicio tiene un precio fijo, transparente y sin sorpresas.', S6, { fontSize: 11 });

h3(doc, 'Catálogo de 9 Servicios Puntuales', S6);

drawTable(doc,
  ['Servicio', 'Precio', 'Qué Incluye', 'Entrega'],
  [
    ['Auditoría Completa de Tienda', '€197/tienda', 'Análisis integral de todos los productos: SEO (16 criterios ponderados), COGS, pricing, imágenes, competencia. Informe con plan de acción priorizado por impacto en revenue', '3-5 días'],
    ['Rediseño IA por Producto', '€9/producto', 'Título SEO optimizado (45-65 chars, keyword-first), descripción de 400+ palabras, tags SEO optimizados, meta description 150-160 chars, keywords researched', '24-48h'],
    ['Imagen IA Profesional', '€3/imagen', 'Imagen profesional generada por IA: Hero, Lifestyle, Detalle, Packaging, UGC, Escala, Bundle o Infografía. Calidad fotográfica con Flux 1.1 Pro', 'Inmediato'],
    ['Informe Pricing y Márgenes', '€97/informe', 'COGS real por producto, unit economics completos, márgenes por SKU, análisis competitivo de precios del mercado, estrategia de pricing con psicología aplicada', '3-5 días'],
    ['Optimización SEO por Producto', '€7/producto', 'Meta title, meta description, keywords researched, Schema JSON-LD Product, alt texts optimizados, sugerencias de internal linking', '24-48h'],
    ['Informe de Competencia', '€97/informe', 'Análisis detallado de competidores directos: catálogo, precios, posicionamiento, fortalezas, debilidades, gaps de mercado, oportunidades', '5-7 días'],
    ['Investigación de Proveedores', '€97/invest.', 'Búsqueda global (Alibaba, 1688, Global Sources, IndiaMART, ThomasNet), comparativa de precios, MOQ, lead times, términos de negociación', '5-7 días'],
    ['Setup Email Marketing', '€197', 'Templates profesionales responsive, 5 flujos automatizados (Welcome, Abandoned Cart, Post-Purchase, Win-Back, Browse Abandonment), configuración Klaviyo', '5-7 días'],
    ['Proyección de Ventas', '€127/informe', 'Forecast a 3-6 meses con 3 escenarios (optimista/base/pesimista), análisis de estacionalidad, recomendaciones de crecimiento, puntos de breakeven', '3-5 días'],
  ],
  [120, 65, 260, 50], S6, { priceCol: 1 }
);

h3(doc, 'Packs Recomendados — Mejor Valor', S6);

para(doc, 'Los packs combinan varios servicios para ofrecer una transformación completa a mejor precio. Son la opción más popular entre nuestros clientes.', S6);

drawTable(doc,
  ['Pack', 'Contenido', 'Precio', 'Ideal Para'],
  [
    ['Pack Rediseño 30', '30 productos × rediseño completo IA (título + descripción + tags + SEO)', '€270', 'Tiendas con catálogo existente que necesita actualización'],
    ['Pack Imágenes 30', '30 productos × imagen profesional IA (8 tipos disponibles)', '€90', 'Tiendas sin fotografía profesional o con imágenes amateur'],
    ['Pack SEO 30', '30 productos × optimización SEO completa (meta, keywords, schema)', '€210', 'Tiendas con poco tráfico orgánico que quieren mejorar SEO'],
    ['Pack Tienda Completa', 'Auditoría + 30 Rediseños + 30 SEO + Informe Pricing', '€774', 'Tiendas que quieren una transformación base completa'],
    ['Pack Premium Total', 'Todo lo anterior + 120 Imágenes IA + Setup Email + Informe Competencia', '€1.258', 'Transformación total de la tienda — el mejor valor'],
  ],
  [110, 210, 60, 115], S6, { priceCol: 2 }
);

h3(doc, 'Servicios Recurrentes Mensuales', S6);

para(doc, 'Para clientes que prefieren un servicio continuo sin comprometerse con un plan completo. Ideal como complemento o como primer paso antes de un plan de suscripción.', S6);

drawTable(doc,
  ['Servicio', 'Precio', 'Qué Incluye'],
  [
    ['Mantenimiento Básico', '€49/mes', 'Monitorización de la tienda, actualizaciones mensuales de catálogo, soporte por email para consultas'],
    ['Gestión Activa', '€149/mes', 'Optimización continua del catálogo, informes semanales de rendimiento, A/B testing activo, recomendaciones estratégicas'],
    ['Premium Ilimitado', '€399/mes', 'Todo incluido sin límites: optimización 24/7, prioridad en todas las acciones, SLA 99.9% de uptime, account manager asignado'],
  ],
  [130, 80, 285], S6, { priceCol: 1 }
);

pageFooter(doc, currentPage);

// ================================================================
//  CAPÍTULO 7: ESTÁNDAR DE CALIDAD 100/100
// ================================================================
y = newPage(doc);
const S7 = '07 · Estándar de Calidad 100/100';
pageHeader(doc, S7);
doc.y = y;
sectionTitle(doc, '07', 'Estándar de Calidad', '100/100');

para(doc, 'El estándar de calidad 100/100 es el nivel más exigente del mercado para productos Shopify. Cada producto creado o optimizado por ShopyBrain se mide contra este estándar, que combina 7 dimensiones ponderadas y 16 criterios SEO específicos.', S7, { fontSize: 11 });

para(doc, 'Este estándar no es arbitrario — está basado en las mejores prácticas de Semrush, Ahrefs, Google Search Quality Guidelines, y años de datos acumulados en el cerebro OmniCore sobre qué funciona y qué no en eCommerce.', S7);

h3(doc, 'Las 7 Dimensiones de Auditoría', S7);

para(doc, 'Cada producto recibe un score global calculado como media ponderada de 7 dimensiones. Los pesos reflejan el impacto real de cada dimensión en las ventas:', S7);

drawTable(doc,
  ['Dimensión', 'Peso', 'Criterios Detallados', 'Por Qué Este Peso'],
  [
    ['Título', '12%', '45-65 caracteres, keyword principal primero, sin caracteres especiales, formato SEO optimizado, coherente con el producto', 'El título es lo primero que ve Google y el cliente. Crítico para CTR'],
    ['Descripción', '22%', '800-1200 palabras, 8 secciones (storytelling, beneficios, especificaciones, cómo usar, FAQ, trust, CTA, garantía), legibilidad Flesch-Kincaid, keyword density 1-3%', 'La descripción es el contenido principal para SEO y para convencer al cliente. Máximo peso'],
    ['Precio', '10%', 'Precio establecido, compare_at_price 30-40% superior (efecto "antes/ahora"), pricing psicológico (.97/.99), margen mínimo 40%', 'Sin precio correcto no hay negocio. Compare_at_price aumenta conversión 15-25%'],
    ['Imágenes', '18%', '8+ imágenes ideales (hero, lifestyle, detalle, packaging, UGC, escala, bundle, infografía), alt text descriptivo con keywords, lazy loading', 'Las imágenes son el factor #1 de conversión en eCommerce. Alto peso justificado'],
    ['SEO Meta', '18%', 'Meta title ≤60 chars con keyword, meta description 130-155 chars con CTA, Schema JSON-LD Product, canonical URL, Open Graph tags', 'Sin SEO meta correcto, Google no posiciona. Mismo peso que imágenes por importancia'],
    ['Calidad Contenido', '12%', 'Consistencia de keywords a lo largo del texto, estructura de headings (H1-H3), links internos a productos/colecciones relacionados, readability score', 'La calidad del contenido afecta al ranking de Google y al tiempo en página'],
    ['Trust Signals', '8%', 'Sección FAQ (3-5 preguntas), mención de garantía, política de devoluciones, badges de seguridad, testimonios/reviews', 'Trust signals reducen la fricción de compra. Menor peso pero crítico para conversión'],
  ],
  [75, 35, 210, 175], S7
);

h3(doc, 'Los 16 Criterios SEO (Nivel Semrush)', S7);

para(doc, 'Más allá de las 7 dimensiones de auditoría, cada producto se evalúa contra 16 criterios SEO técnicos específicos. Estos criterios están alineados con las herramientas profesionales de SEO como Semrush y Ahrefs:', S7);

drawTable(doc,
  ['#', 'Criterio', 'Qué Se Evalúa', 'Impacto'],
  [
    ['1', 'Title Tag', 'Keyword principal + marca, máximo 60 caracteres, formato "Producto - Categoría | Marca"', 'Alto'],
    ['2', 'Meta Description', '150-160 chars, incluye keyword + CTA, único por página', 'Alto'],
    ['3', 'URL Slug', 'Limpio, basado en keyword, sin stop words ni números ID', 'Medio'],
    ['4', 'H1 Heading', 'Único por página, contiene keyword principal', 'Alto'],
    ['5', 'Content Length', '800+ palabras para productos, 1500+ para blog posts', 'Alto'],
    ['6', 'Keyword Density', 'Entre 1% y 3% — natural, no forzado', 'Medio'],
    ['7', 'Internal Linking', 'Enlaces a colecciones, productos relacionados, blog posts relevantes', 'Medio'],
    ['8', 'Image Alt Text', 'Descriptivo, incluye keyword de forma natural, no "img001"', 'Medio'],
    ['9', 'Schema Product', 'JSON-LD con price, availability, rating, brand, SKU', 'Alto'],
    ['10', 'BreadcrumbList', 'Schema de navegación para Rich Snippets', 'Medio'],
    ['11', 'Open Graph', 'Tags para compartir en redes sociales con imagen y descripción', 'Bajo'],
    ['12', 'Twitter Cards', 'Tags específicos de Twitter/X para compartir', 'Bajo'],
    ['13', 'Canonical URL', 'Evita contenido duplicado por URLs de variantes', 'Alto'],
    ['14', 'Mobile Responsive', 'Google indexa mobile-first — debe funcionar perfecto en móvil', 'Alto'],
    ['15', 'Core Web Vitals', 'LCP <2.5s, CLS <0.1, INP <200ms', 'Alto'],
    ['16', 'Content Quality', 'Readability, estructura, FAQ markup, UGC, comprehensiveness', 'Alto'],
  ],
  [20, 100, 255, 50], S7
);

h3(doc, 'Especificaciones de Producto World-Class', S7);

para(doc, 'Cada producto que ShopyBrain crea o rediseña cumple con estas especificaciones mínimas:', S7);

drawTable(doc,
  ['Elemento', 'Especificación', 'Ejemplo'],
  [
    ['Título', '45-65 caracteres, keyword principal PRIMERO', '"Cómic Coleccionable Batman Dark Knight Returns - Edición Deluxe"'],
    ['Descripción', '800-1200 palabras con 8 secciones obligatorias', 'Storytelling, Beneficios, Specs, Cómo Usar, FAQ, Trust, CTA, Garantía'],
    ['Tags', '22-28 tags optimizados para búsqueda y colecciones', '"comic, batman, dc, coleccionable, edicion-limitada, regalo..."'],
    ['Precio', 'Investigado vs competidores, .97/.99 endings', '€34.97 (compare_at_price: €49.99)'],
    ['Imágenes', '8 mínimo de tipos diferentes', 'Hero, Lifestyle, Detalle, Packaging, UGC, Escala, Bundle, Infografía'],
    ['Meta Title', '≤60 caracteres con keyword', '"Batman Dark Knight Returns Cómic Coleccionable | Shopy Crafter"'],
    ['Meta Desc', '130-155 caracteres con keyword + CTA', '"Edición deluxe del clásico de Frank Miller. Envío 24h. Garantía..."'],
  ],
  [80, 200, 215], S7
);

pageFooter(doc, currentPage);

// ================================================================
//  CAPÍTULO 8: VENTAJAS COMPETITIVAS
// ================================================================
y = newPage(doc);
const S8 = '08 · Ventajas Competitivas';
pageHeader(doc, S8);
doc.y = y;
sectionTitle(doc, '08', 'Ventajas', 'Competitivas');

para(doc, 'Shopy Crafter compite en dos frentes: contra agencias tradicionales de Shopify y contra el ecosistema de apps individuales de Shopify. En ambos casos, la plataforma ofrece ventajas significativas que analizamos a continuación.', S8, { fontSize: 11 });

h3(doc, 'Shopy Crafter vs Agencia Tradicional', S8);

para(doc, 'Una agencia Shopify tradicional cobra entre €2.000 y €10.000 al mes por un equipo de 5-10 personas que trabaja en horario laboral. Shopy Crafter ofrece capacidades equivalentes o superiores con un solo motor de IA que trabaja 24/7:', S8);

drawTable(doc,
  ['Aspecto', 'Agencia Tradicional', 'Shopy Crafter', 'Ventaja'],
  [
    ['Equipo necesario', '5-10 personas (dev, diseñador, SEO, copywriter, PM)', '1 plataforma IA con 6 motores', '80-90% menos coste de personal'],
    ['Tiempo de entrega', '2-8 semanas por proyecto', 'Minutos a horas', '95% más rápido'],
    ['Coste mensual', '€2.000-10.000/mes', '€297-797/mes', '70-90% más económico'],
    ['Disponibilidad', 'Horario laboral (9-18h, L-V)', '24 horas / 7 días / 365 días', 'Disponibilidad total'],
    ['Consistencia', 'Variable (depende del equipo)', '100% consistente (misma IA)', 'Calidad garantizada'],
    ['Escalabilidad', 'Limitada (hay que contratar)', 'Ilimitada (misma plataforma)', 'Escala sin fricción'],
    ['Aprendizaje', 'Manual (cada persona aprende sola)', 'Acumulativo (46K+ insights)', 'Conocimiento compuesto'],
    ['SEO', 'Manual, parcial, inconsistente', '16 criterios automáticos nivel Semrush', 'Cobertura total'],
    ['Imágenes', 'Fotógrafo + estudio + edición', 'IA generativa en <2 segundos', '99% más rápido y barato'],
    ['A/B Testing', 'Herramientas externas + análisis manual', 'Integrado con auto-ganadores', 'Automatización completa'],
  ],
  [95, 145, 125, 130], S8
);

h3(doc, 'Shopy Crafter vs Apps Shopify Individuales', S8);

para(doc, 'Muchas tiendas intentan replicar las capacidades de Shopy Crafter combinando 5-8 apps de Shopify individuales. El resultado suele ser un stack fragmentado, caro y difícil de gestionar:', S8);

drawTable(doc,
  ['Aspecto', 'Apps Individuales (5-8 apps)', 'Shopy Crafter'],
  [
    ['Coste combinado', '€150-500/mes en 5-8 apps diferentes (SEO app + Image app + Pricing app + A/B app + Email app...)', 'Todo incluido desde €297/mes — un solo pago, una sola factura'],
    ['Integración', 'Fragmentada — cada app es independiente, no comparten datos', 'Unificada — los 6 motores trabajan coordinados, comparten datos vía OmniCore Brain'],
    ['Estrategia global', 'Sin visión global — cada app optimiza su métrica sin contexto', 'IA con visión holística del negocio — coordina SEO, pricing, imágenes y testing'],
    ['Soporte', 'Múltiples vendors con distintos SLAs, idiomas y calidades', 'Un solo punto de contacto, en español, con SLA claro'],
    ['Datos', 'Silos de datos separados — no puedes cruzar info entre apps', 'OmniCore Brain unifica todos los datos para análisis cruzados'],
    ['Configuración', 'Configurar 5-8 apps diferentes, cada una con su interfaz', 'Una sola interfaz con chatbot natural — dile qué quieres y se hace'],
  ],
  [110, 210, 175], S8
);

statBox(doc, [['99.9%', 'Uptime'], ['94%', 'Precisión IA'], ['<2s', 'Velocidad'], ['12', 'Cron Jobs 24/7']], S8);

pageFooter(doc, currentPage);

// ================================================================
//  CAPÍTULO 9: FLUJO DE TRABAJO
// ================================================================
y = newPage(doc);
const S9 = '09 · Flujo de Trabajo del Cliente';
pageHeader(doc, S9);
doc.y = y;
sectionTitle(doc, '09', 'Flujo de Trabajo', 'del Cliente');

para(doc, 'El proceso de trabajo con Shopy Crafter está diseñado para ser lo más simple y rápido posible. De zero a tienda optimizada en 3 fases, con resultados visibles desde el primer día.', S9, { fontSize: 11 });

h3(doc, 'Fase 1 — Onboarding (Día 1)', S9);

para(doc, 'El onboarding es instantáneo. No hay reuniones de 2 horas, no hay cuestionarios de 50 preguntas, no hay semanas de "discovery". Conecta tu tienda y la IA empieza a trabajar.', S9);

flowStep(doc, '1', 'Conecta tu tienda Shopify',
  'Introduce tu dominio Shopify (ej: mi-tienda.myshopify.com) y un Access Token con los permisos necesarios. La plataforma se conecta al instante con la API de Shopify y comienza a escanear todo tu catálogo, configuración, themes, metafields y métricas actuales. Este proceso tarda menos de 5 minutos.', S9);

flowStep(doc, '2', 'La IA audita cada producto',
  'ShopyBrain analiza cada producto de tu catálogo contra el estándar 100/100: título (12%), descripción (22%), precio (10%), imágenes (18%), SEO (18%), calidad de contenido (12%), trust signals (8%). Cada producto recibe una nota de A a F y una lista priorizada de mejoras con impacto estimado en revenue. Recibes un informe completo con las 12 acciones más urgentes.', S9);

h3(doc, 'Fase 2 — Optimización (Semana 1)', S9);

para(doc, 'Con la auditoría completada, ShopyBrain ejecuta las optimizaciones de mayor impacto. Esta fase transforma tu catálogo de mediocre a profesional.', S9);

flowStep(doc, '3', 'Rediseño masivo del catálogo',
  'Cada producto recibe un rediseño completo con metodología Semrush: título SEO de 45-65 caracteres con keyword-first, descripción de 800-1200 palabras con 8 secciones profesionales (storytelling, beneficios, especificaciones, uso, FAQ, trust, CTA, garantía), y 22-28 tags optimizados para búsqueda y colecciones automáticas.', S9);

flowStep(doc, '4', 'Generación de imágenes IA',
  '8 tipos de imagen profesional por producto generados con Replicate Flux 1.1 Pro: Hero (fondo limpio), Lifestyle (contexto de uso), Detalle (close-up materiales), Packaging (presentación), UGC (aspecto natural), Escala (referencia tamaño), Bundle (agrupación), Infografía (specs). Todo con consistencia visual de marca vía Recraft v3.', S9);

flowStep(doc, '5', 'SEO + Pricing + Email Marketing',
  'Meta tags optimizados para todos los productos (title 60 chars + description 130-155 chars). Schemas JSON-LD (Product, BreadcrumbList, Organization, FAQ) para Rich Snippets en Google. Alt texts descriptivos en todas las imágenes. Sitemap optimizado. Análisis competitivo de precios con Google Search real. Setup completo de 5 flujos de email marketing (Welcome, Cart, Post-Purchase, Win-Back, Browse).', S9);

h3(doc, 'Fase 3 — Crecimiento Continuo (Semana 2+)', S9);

para(doc, 'Aquí es donde Shopy Crafter se diferencia de una agencia que hace un proyecto y se va. El sistema sigue mejorando tu tienda cada día, cada semana, sin que tengas que hacer nada.', S9);

flowStep(doc, '6', 'A/B Testing automático',
  'Tests automáticos en títulos, precios, imágenes y descripciones con pixel tracking real. El sistema mide visitas, clics, conversiones y revenue por variante. Cuando un test alcanza confianza estadística suficiente, el ganador se aplica automáticamente al producto original. El siguiente test se configura automáticamente.', S9);

flowStep(doc, '7', 'Auto-Pilot 24/7',
  '12 cron jobs trabajan mientras duermes: análisis de competidores cada mañana a las 6:00, sincronización de inventario a las 7:00, snapshots de revenue a las 2:00 AM, deep learning a la 1:00 AM con 70 nuevos insights por noche, síntesis estratégica semanal cada domingo, y auto-evaluación mensual el primer día de cada mes.', S9);

flowStep(doc, '8', 'Reporting y dashboard en tiempo real',
  'Dashboard con todas las métricas que importan: revenue (total y por producto), conversión rate, márgenes bruto y neto, AOV, CLV, CAC, ROAS, SEO scores por producto, resultados de A/B tests, estado de inventario. Informes semanales con recomendaciones accionables. Forecast financiero actualizado cada mes.', S9);

pageFooter(doc, currentPage);

// ================================================================
//  CAPÍTULO 10: BENCHMARKS
// ================================================================
y = newPage(doc);
const S10 = '10 · Benchmarks por Industria';
pageHeader(doc, S10);
doc.y = y;
sectionTitle(doc, '10', 'Benchmarks por', 'Industria');

para(doc, 'ShopyBrain utiliza estos datos de referencia del sector eCommerce para calibrar estrategias de pricing, objetivos de margen y metas de conversión para cada cliente. Los benchmarks se actualizan continuamente a través del cerebro OmniCore.', S10, { fontSize: 11 });

h3(doc, 'Métricas de Referencia por Sector', S10);

drawTable(doc,
  ['Industria', 'Margen Bruto', 'AOV Típico', 'Conversión', 'Notas'],
  [
    ['Fashion / Apparel', '50-70%', '€60-120', '1-3%', 'Alto margen, alta competencia. Clave: branding + imágenes lifestyle'],
    ['Electronics', '15-30%', '€150-400', '0.5-2%', 'Bajo margen, alto AOV. Clave: specs detalladas + comparativas'],
    ['Beauty / Cosmetics', '60-80%', '€40-80', '2-4%', 'Muy alto margen. Clave: UGC + reviews + ingredientes'],
    ['Home & Garden', '40-60%', '€80-200', '1-3%', 'Margen medio-alto. Clave: imágenes de contexto + dimensions'],
    ['Food & Beverage', '30-50%', '€30-60', '2-4%', 'Bajo AOV, buena repetición. Clave: subscriptions + bundles'],
    ['Jewelry', '60-80%', '€100-500', '0.5-2%', 'Muy alto margen y AOV. Clave: detalle + certificados + gift wrapping'],
    ['Sports / Fitness', '40-60%', '€60-150', '1-3%', 'Margen medio. Clave: rendimiento + testimonios + before/after'],
    ['Pet Supplies', '40-55%', '€35-70', '2-4%', 'Buena repetición. Clave: UGC mascotas + subscriptions'],
    ['Art / Crafts / Comics', '50-75%', '€20-80', '1-3%', 'Alto margen en coleccionables. Clave: ediciones limitadas + storytelling'],
  ],
  [100, 60, 60, 55, 220], S10
);

h3(doc, 'Métricas Clave que ShopyBrain Monitoriza', S10);

para(doc, 'Estas son las métricas que ShopyBrain trackea, analiza y optimiza para cada tienda conectada:', S10);

drawTable(doc,
  ['Métrica', 'Definición', 'Fórmula', 'Objetivo'],
  [
    ['AOV', 'Average Order Value', 'Ingreso total / Nº pedidos', 'Según industria'],
    ['CLV', 'Customer Lifetime Value', 'AOV × Frecuencia compra × Vida media', '3-5x el CAC'],
    ['CAC', 'Customer Acquisition Cost', 'Gasto marketing / Nuevos clientes', 'Menor que CLV/3'],
    ['ROAS', 'Return on Ad Spend', 'Ingresos de ads / Gasto en ads', '>4x es bueno'],
    ['Conversion Rate', '% de visitantes que compran', 'Pedidos / Visitas × 100', '>2% bueno, >5% excelente'],
    ['Margen Bruto', 'Rentabilidad antes de gastos fijos', '(Ingresos - COGS) / Ingresos × 100', '>40% mínimo'],
    ['Margen Neto', 'Rentabilidad real después de todo', '(Ingresos - Todos costes) / Ingresos', '>10% saludable'],
    ['Breakeven', 'Punto de equilibrio', 'Costes fijos / (Precio - Coste variable)', 'Alcanzar en <6 meses'],
    ['Email Open Rate', '% de emails abiertos', 'Abiertos / Enviados × 100', '>25%'],
    ['Email Click Rate', '% de clicks en emails', 'Clicks / Abiertos × 100', '>3%'],
  ],
  [85, 130, 140, 140], S10
);

h3(doc, 'Estructura de Costes Shopify', S10);

para(doc, 'Para calcular márgenes correctamente, ShopyBrain tiene en cuenta todos los costes de la plataforma Shopify:', S10);

drawTable(doc,
  ['Concepto', 'Basic ($39/mes)', 'Shopify ($105/mes)', 'Advanced ($399/mes)'],
  [
    ['Comisión tarjeta', '2.9% + $0.30', '2.6% + $0.30', '2.4% + $0.30'],
    ['Comisión sin Shopify Payments', '2% adicional', '1% adicional', '0.5% adicional'],
    ['Apps (presupuesto típico)', '$50-200/mes', '$100-300/mes', '$200-500/mes'],
    ['Theme premium', '$150-380 one-time', '$150-380 one-time', '$150-380 one-time'],
    ['Dominio', '$14-50/año', '$14-50/año', '$14-50/año'],
  ],
  [140, 115, 115, 125], S10
);

pageFooter(doc, currentPage);

// ================================================================
//  CAPÍTULO 11: CONTACTO
// ================================================================
y = newPage(doc);
const S11 = '11 · Contacto y Siguiente Paso';
pageHeader(doc, S11);
doc.y = y;
sectionTitle(doc, '11', 'Siguiente', 'Paso');

para(doc, 'Estamos listos para potenciar tu tienda Shopify. Nuestro proceso de onboarding es simple: una conversación de 15 minutos para entender tu negocio, y en 5 minutos más tu tienda está conectada y la IA trabajando.', S11, { fontSize: 12, color: MUTED });

doc.y += 10;
h3(doc, 'Datos de Contacto', S11);

drawTable(doc, ['', ''], [
  ['Empresa', 'Shopy Crafter'],
  ['Web', 'shopycrafter.com'],
  ['Email comercial', 'craftershopy@gmail.com'],
  ['Motor IA', 'ShopyBrain (OmniCore AI)'],
  ['Pagos', 'Exclusivamente vía Shopify (sin tarjeta de crédito)'],
  ['Idioma', 'Español (soporte completo)'],
], [140, 355], S11);

h3(doc, 'Garantías de Servicio', S11);

checkBullet(doc, [
  'Sin permanencia — cancela en cualquier momento sin penalización ni preguntas',
  'Sin tarjeta de crédito para comenzar — prueba sin riesgo',
  'Setup en menos de 5 minutos — de cero a tienda optimizada al instante',
  'RGPD compliant — todos los datos procesados y almacenados en la Unión Europea',
  'Encriptación AES-256 — todos los tokens de acceso protegidos con el estándar más robusto',
  '99.9% de uptime garantizado — disponibilidad casi total, respaldada contractualmente',
  'Soporte completo en español — comunicación directa, sin barreras de idioma',
  'Transparencia total — sin letra pequeña, sin fees ocultos, sin sorpresas',
], S11);

h3(doc, 'Proceso de Contratación', S11);

flowStep(doc, '1', 'Contacto inicial',
  'Envía un email a craftershopy@gmail.com o rellena el formulario en shopycrafter.com. Te responderemos en menos de 24 horas con disponibilidad para una llamada.', S11);

flowStep(doc, '2', 'Sesión de descubrimiento (15 minutos)',
  'Llamada rápida para entender tu negocio: nicho, número de productos, objetivos, presupuesto. Sin compromiso. Te recomendamos el plan o servicios más adecuados.', S11);

flowStep(doc, '3', 'Conexión y onboarding (5 minutos)',
  'Conectas tu tienda Shopify con un Access Token. ShopyBrain comienza a escanear y auditar automáticamente. En menos de una hora tienes tu primera auditoría completa.', S11);

flowStep(doc, '4', 'Resultados desde el día 1',
  'Los motores empiezan a trabajar inmediatamente: rediseño de productos, generación de imágenes, optimización SEO, análisis de pricing. Resultados visibles desde las primeras horas.', S11);

doc.y += 20;
checkSpace(doc, 100, S11);
doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#2A2A3A').lineWidth(0.5).stroke();
doc.y += 20;
doc.fontSize(24).fillColor(GOLD).text('Shopy ', 0, doc.y, { continued: true, align: 'center', width: 595 }).fillColor(WHITE).text('Crafter');
doc.y += 35;
doc.fontSize(12).fillColor(MUTED).text('La agencia Shopify que trabaja 24/7 por ti', 0, doc.y, { align: 'center', width: 595 });
doc.y += 25;
doc.fontSize(9).fillColor(MUTED).text('© 2026 Shopy Crafter. Todos los derechos reservados.', 0, doc.y, { align: 'center', width: 595 });
doc.y += 14;
doc.fontSize(8).fillColor(MUTED).text('Documento generado por ShopyBrain (OmniCore AI) — Marzo 2026', 0, doc.y, { align: 'center', width: 595 });

pageFooter(doc, currentPage);

// ================================================================
doc.end();
stream.on('finish', () => {
  const size = fs.statSync('/home/runner/workspace/Informe-Servicios-ShopyCrafter-2026.pdf').size;
  console.log(`PDF generado: ${(size / 1024).toFixed(0)} KB — ${currentPage} páginas`);
});
