const PptxGenJS = require("pptxgenjs");

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_16x9";
pptx.author = "Grok AI";
pptx.title = "Optimización de Proveedores 2026 - Hotel & Negocio";

// Slide 1 - Title
let slide = pptx.addSlide();
slide.addText("OPTIMIZACIÓN DE PROVEEDORES 2026", { x: 0.5, y: 2.5, w: 9, h: 1, fontSize: 36, bold: true, color: "1F4E79", align: "center" });
slide.addText("Estrategias, Costes Ocultos y Plan de Acción", { x: 0.5, y: 3.6, w: 9, h: 0.6, fontSize: 20, color: "666666", align: "center" });
slide.addText("Hotel + Plataforma Digital + Bodega de Vinos", { x: 0.5, y: 4.3, w: 9, h: 0.5, fontSize: 16, color: "888888", align: "center" });

// Slide 2 - Resumen Ejecutivo
slide = pptx.addSlide();
slide.addText("RESUMEN EJECUTIVO", { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 24, bold: true, color: "1F4E79" });
slide.addText([
    { text: "Ahorro Potencial Anual: ", options: { bold: true } },
    { text: "47.000 - 60.000 €", options: { bold: true, color: "006400" } }
], { x: 0.5, y: 1.2, w: 9, h: 0.5, fontSize: 18 });
slide.addText("• Margen Bruto Objetivo: 62-65% (+6-8 puntos)\n• Proveedores óptimos: 10-12 (reducción del 40%)\n• ROI de la optimización: 285-340%\n• Tiempo de implementación: 90 días", { x: 0.5, y: 1.8, w: 9, h: 2.5, fontSize: 16 });

// Slide 3 - Estrategias Clave
slide = pptx.addSlide();
slide.addText("12 ESTRATEGIAS AVANZADAS", { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 24, bold: true, color: "1F4E79" });
slide.addText("1. Consolidación de Proveedores (Ahorro 8-12%)\n2. Contratos Anuales con Volumen (10-15%)\n3. Dual Sourcing Estratégico\n4. Pago Inmediato vs Plazo (2-3%)\n5. Revisión Trimestral de Precios\n6. Categorización ABC de Proveedores\n7. Alianzas Estratégicas\n8. Centralización de Compras\n9. Análisis de Coste Total de Propiedad (TCO)\n10. Programa de Fidelización\n11. Benchmarking Externo\n12. Digitalización de Pedidos", { x: 0.5, y: 1.0, w: 9, h: 4.5, fontSize: 14 });

// Slide 4 - Costes Ocultos
slide = pptx.addSlide();
slide.addText("15+ COSTES OCULTOS (47-55% del COGS)", { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 22, bold: true, color: "1F4E79" });
slide.addText("• Rotura y Merma: 280-420€/mes (3.5-5%)\n• Almacenamiento en Frío: 380-520€/mes\n• Coste de Oportunidad del Espacio: 420-630€/mes\n• Personal de Barra Proporcional: 1.850-2.400€/mes\n• Devoluciones y Quejas: 180-280€/mes\n• Pérdida por Caducidad: 120-200€/mes\n• Coste Financiero del Stock: 220-350€/mes\n• Tiempo de Gestión Administrativa: 380-520€/mes\n• Pérdida de Oportunidad: 300-500€/mes", { x: 0.5, y: 1.0, w: 9, h: 4.5, fontSize: 13 });

// Slide 5 - Plan 90 Días
slide = pptx.addSlide();
slide.addText("PLAN DE ACCIÓN 90 DÍAS", { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 24, bold: true, color: "1F4E79" });
slide.addText("Semanas 1-4: Auditoría + Clasificación ABC + Benchmarking\nSemanas 5-8: Negociación Top 5 + Dual Sourcing\nSemanas 9-12: Digitalización + Formación + Optimización Stock\nSemana 13-16: Revisión de Resultados + Mejora Continua\n\nAhorro Esperado: 28.800 - 35.400 €/año", { x: 0.5, y: 1.0, w: 9, h: 3.5, fontSize: 15 });

// Slide 6 - Recomendación Final
slide = pptx.addSlide();
slide.addText("RECOMENDACIÓN FINAL", { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 24, bold: true, color: "1F4E79" });
slide.addText("MEJOR COMBINACIÓN GLOBAL:\n\n• Mahou + Torres + Coca-Cola (Hotel)\n• Freepik + Runway + Claude (Plataforma AI)\n• Torres + Mahou + Local (Bodega de Vinos)\n\nAhorro Total Potencial: 47.000 - 60.000 €/año\nROI: 285-340%\nTiempo de Recuperación: 4-6 meses", { x: 0.5, y: 1.0, w: 9, h: 4, fontSize: 15, color: "006400" });

pptx.writeFile({ fileName: "Presentacion_Optimizacion_Proveedores_2026.pptx" });
console.log("PowerPoint creado exitosamente");
