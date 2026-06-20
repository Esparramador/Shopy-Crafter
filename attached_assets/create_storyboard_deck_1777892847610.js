const PptxGenJS = require("pptxgenjs");
const fs = require("fs");
const path = require("path");

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_16x9";
pptx.title = "ShopyCrafter - Storyboard & Production Deck";
pptx.author = "ShopyCrafter Creative Team";

// Brand colors
const DARK = "0A0A0A";
const GOLD = "FFD700";
const NEON = "00FF9F";
const CYAN = "00F0FF";
const WHITE = "FFFFFF";

// Image paths
const imgDir = "/home/workdir/artifacts/imagine_images/";

// Helper function to add slide with dark background
function addDarkSlide(titleText) {
  const slide = pptx.addSlide();
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: "100%", h: "100%",
    fill: { color: DARK }
  });
  // Gold accent bar top
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: "100%", h: 0.15,
    fill: { color: GOLD }
  });
  if (titleText) {
    slide.addText(titleText, {
      x: 0.5, y: 0.3, w: 9, h: 0.6,
      fontSize: 24, color: GOLD, fontFace: "Arial", bold: true
    });
  }
  return slide;
}

// SLIDE 1 - COVER
let slide = addDarkSlide();
slide.addText("SHOPYCRAFTER", {
  x: 0.5, y: 1.5, w: 9, h: 1,
  fontSize: 44, color: GOLD, fontFace: "Arial Black", align: "center"
});
slide.addText("VIDEO CAMPAIGN STORYBOARD DECK", {
  x: 0.5, y: 2.5, w: 9, h: 0.6,
  fontSize: 20, color: NEON, fontFace: "Arial", align: "center"
});
slide.addText("Concepto 4: Si nosotros gestionáramos [tu tienda]", {
  x: 0.5, y: 3.2, w: 9, h: 0.5,
  fontSize: 14, color: CYAN, fontFace: "Arial", align: "center"
});
slide.addText("6 Videos 9:16 + Master Cut 2:10 + Todos los Assets de Producción", {
  x: 0.5, y: 4.0, w: 9, h: 0.4,
  fontSize: 12, color: WHITE, fontFace: "Arial", align: "center"
});
slide.addText("Ingeniería de E-commerce con IA | www.shopycrafter.com", {
  x: 0.5, y: 5.0, w: 9, h: 0.3,
  fontSize: 10, color: "888888", fontFace: "Arial", align: "center"
});

// SLIDE 2 - STRATEGY
slide = addDarkSlide("CAMPAIGN STRATEGY");
slide.addText([
  { text: "Objetivo: ", options: { bold: true, color: GOLD } },
  { text: "Posicionar ShopyCrafter como el socio premium de 'ingeniería de e-commerce' con IA para tiendas Shopify de alto volumen.", options: { color: WHITE } }
], { x: 0.5, y: 1.0, w: 9, h: 0.8, fontSize: 12 });
slide.addText([
  { text: "Mensaje Clave: ", options: { bold: true, color: GOLD } },
  { text: '"Si ShopyCrafter gestionara tu tienda… tus resultados serían otros."', options: { color: CYAN, italic: true } }
], { x: 0.5, y: 1.8, w: 9, h: 0.6, fontSize: 12 });
slide.addText("Estructura Narrativa (6 vídeos que fluyen como 1 solo film de 2:10):", {
  x: 0.5, y: 2.5, w: 9, h: 0.4, fontSize: 11, color: NEON, bold: true
});
slide.addText("1. Command Center (Misterio + Autoridad) → 2. Lupa (Análisis profundo) → 3. Robotic Blueprint (Construcción IA) → 4. Dashboard (Resultados explosivos) → 5. Split-Screen (Transformación dramática) → 6. CTA Hero (Cierre poderoso)", {
  x: 0.5, y: 2.9, w: 9, h: 1.2, fontSize: 10, color: WHITE
});
slide.addText("Character Lock: Crafter (holographic AI woman, cyberpunk suit, neon-green hair) – usar misma referencia en todos los vídeos para coherencia total.", {
  x: 0.5, y: 4.2, w: 9, h: 0.6, fontSize: 10, color: "CCCCCC"
});

// SLIDE 3 - CHARACTER
slide = addDarkSlide("CHARACTER REFERENCE – CRAFER (LOCK 100%)");
slide.addText("DESCRIPCIÓN EXACTA (copia-pega en todos los generadores de IA):", {
  x: 0.5, y: 1.0, w: 9, h: 0.4, fontSize: 11, color: GOLD, bold: true
});
slide.addText("Sleek holographic AI woman, 30 years old, sharp cyberpunk tailored black suit with glowing cyan and neon-green circuit lines, short asymmetrical hair with vibrant neon-green highlights, confident professional expression, subtle holographic shimmer and edge glow, cinematic lighting, ultra-detailed face, premium corporate tech aesthetic.", {
  x: 0.5, y: 1.5, w: 9, h: 1.5, fontSize: 10, color: WHITE
});
slide.addText("PASO CRÍTICO:", {
  x: 0.5, y: 3.2, w: 9, h: 0.3, fontSize: 11, color: NEON, bold: true
});
slide.addText("1. Genera PRIMERO una imagen de referencia de Crafter usando la descripción arriba.\n2. Usa esa imagen como 'Image Reference / Character Lock / IP-Adapter' en Kling, Runway, Luma y Pika.\n3. Resultado: 100% coherencia de personaje en los 6 vídeos.", {
  x: 0.5, y: 3.5, w: 9, h: 1.2, fontSize: 10, color: "CCCCCC"
});

// SLIDE 4-9 - ONE SLIDE PER VIDEO (with image + summary)
const videoData = [
  { num: "01", title: "COMMAND CENTER", duration: "22s", img: "Kdz0B.jpg", desc: "Futuristic command center. Crafter appears. Golden metrics explode. Headline: 'Si ShopyCrafter gestionara tu tienda'" },
  { num: "02", title: "LUPA DE PRECISIÓN", duration: "20s", img: "ic1fU.jpg", desc: "Magnifying glass reveals optimized code & metrics. Conversion jumps 2.4% → 8.7%. Headline: 'Análisis profundo. Resultados reales.'" },
  { num: "03", title: "ROBOTIC BLUEPRINT", duration: "24s", img: "OD24o.jpg", desc: "Robotic arms build Shopify store blueprint. Crafter directs. Golden light burst. Headline: 'Construimos tu tienda perfecta'" },
  { num: "04", title: "DASHBOARD DORADO", duration: "18s", img: "HL1Mn.jpg", desc: "Golden conversion graphs skyrocketing. +347% in 90 days. Crafter satisfied. Headline: '+347% conversión en 90 días'" },
  { num: "05", title: "SPLIT-SCREEN", duration: "25s", img: "2mF2e.jpg", desc: "Before (grey laggy) vs After (golden optimized). Crafter walks across the beam. Dramatic transformation. Headline: 'Antes. Después. ShopyCrafter.'" },
];

videoData.forEach((v, i) => {
  slide = addDarkSlide(`VIDEO ${v.num} – ${v.title} (${v.duration})`);
  const imgPath = path.join(imgDir, v.img);
  if (fs.existsSync(imgPath)) {
    slide.addImage({ path: imgPath, x: 0.3, y: 1.0, w: 5.5, h: 3.7, sizing: { type: "contain", w: 5.5, h: 3.7 } });
  }
  slide.addText(v.desc, {
    x: 6.0, y: 1.0, w: 3.7, h: 2.5, fontSize: 10, color: WHITE, valign: "top"
  });
  slide.addText("Prompt listo en el PDF de 16:9. VO y timing en el .srt adjunto.", {
    x: 6.0, y: 3.6, w: 3.7, h: 0.8, fontSize: 9, color: NEON
  });
  slide.addText(`→ Ver prompt completo y VO exacto en ShopyCrafter_16x9_Prompts_and_Locution_Brief.pdf`, {
    x: 0.5, y: 5.0, w: 9, h: 0.3, fontSize: 8, color: "888888"
  });
});

// SLIDE 10 - CONCATENATION
slide = addDarkSlide("INTELLIGENT MASTER CUT – 2:10 EPIC FILM");
slide.addText("Los 6 vídeos están diseñados para concatenarse en UN solo film de 2 minutos 10 segundos con flujo emocional perfecto.", {
  x: 0.5, y: 1.0, w: 9, h: 0.5, fontSize: 11, color: WHITE
});
slide.addText("FLUJO DE EDICIÓN RECOMENDADO:", {
  x: 0.5, y: 1.6, w: 9, h: 0.3, fontSize: 11, color: GOLD, bold: true
});
slide.addText("0:00-0:22  Video 1 (Command Center) → Golden light wipe\n0:22-0:42  Video 2 (Lupa) → Robotic arm sweep\n0:42-1:06  Video 3 (Blueprint) → Particle burst\n1:06-1:24  Video 4 (Dashboard) → Golden beam extend\n1:24-1:49  Video 5 (Split-Screen) → Crafter orbit fade\n1:49-2:10  Video 6 (CTA) + extended logo zoom", {
  x: 0.5, y: 1.9, w: 9, h: 2.0, fontSize: 9, color: "CCCCCC", fontFace: "Courier"
});
slide.addText("Herramientas: CapCut (gratis + rápido) | Premiere Pro | DaVinci Resolve\nMúsica: Una sola pista continua (exportar 2:10 bed primero)\nColor: Aplicar mismo LUT dark teal + golden highlights a todos los clips", {
  x: 0.5, y: 4.0, w: 9, h: 0.8, fontSize: 9, color: NEON
});

// SLIDE 11 - TECHNICAL + NEXT STEPS
slide = addDarkSlide("TECHNICAL SPECS & NEXT STEPS");
slide.addText("ESPECIFICACIONES TÉCNICAS", {
  x: 0.5, y: 1.0, w: 4, h: 0.3, fontSize: 11, color: GOLD, bold: true
});
slide.addText("• 9:16 (1080×1920) 30fps H.264 8-12 Mbps\n• 16:9 (1920×1080) 30fps H.264 15-20 Mbps\n• Master Cut: 1920×1080 + letterbox 2.35:1\n• Audio: 48kHz 24-bit, -14 LUFS, -1 dBTP\n• LUT recomendado: Dark teal shadows + golden highlights", {
  x: 0.5, y: 1.3, w: 4.5, h: 1.8, fontSize: 9, color: WHITE
});
slide.addText("HERRAMIENTAS IA RECOMENDADAS", {
  x: 5.2, y: 1.0, w: 4.5, h: 0.3, fontSize: 11, color: GOLD, bold: true
});
slide.addText("1. Kling AI 1.6 (mejor consistencia de personaje)\n2. Runway Gen-3 Alpha (mejor prompt adherence)\n3. Luma Dream Machine (mejor 3D/robotic)\n4. Pika Labs 2.1 (más rápido para iterar)", {
  x: 5.2, y: 1.3, w: 4.5, h: 1.8, fontSize: 9, color: WHITE
});
slide.addText("PRÓXIMOS PASOS (24-48h)", {
  x: 0.5, y: 3.3, w: 9, h: 0.3, fontSize: 11, color: NEON, bold: true
});
slide.addText("1. Generar imagen de referencia de Crafter hoy\n2. Ejecutar los 6 prompts en paralelo (Kling/Runway/Luma)\n3. Editar master cut siguiendo la tabla de concatenación (2-3h)\n4. Grabar locución con el brief adjunto\n5. Exportar + subir a web + campañas ads\n6. A/B test: Video 5 vs Video 6 como standalone", {
  x: 0.5, y: 3.6, w: 9, h: 1.3, fontSize: 9, color: "CCCCCC"
});

slide.addText("TODO LISTO. SHOPYCRAFTER VA A ROMPERLA.", {
  x: 0.5, y: 5.0, w: 9, h: 0.4, fontSize: 12, color: GOLD, bold: true, align: "center"
});

// Save
pptx.writeFile({ fileName: "/home/workdir/artifacts/ShopyCrafter_Storyboard_Deck.pptx" })
  .then(() => console.log("✅ PPTX created: ShopyCrafter_Storyboard_Deck.pptx"))
  .catch(err => console.error("Error:", err));