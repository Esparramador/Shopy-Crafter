import XLSX from "xlsx";

interface CogsProduct {
  title: string;
  price: number;
  unitCost: number;
  materialCost: number;
  packagingCost: number;
  shippingDomestic: number;
  shippingInternational: number;
  fulfillmentFee: number;
  platformFee: number;
  marketingCost: number;
  returnRate: number;
  totalCogs: number;
  marginPct: number;
}

interface SupplierEntry {
  name: string;
  category: string;
  country: string;
  priceMin: number;
  priceMax: number;
  currency: string;
  moq: string;
  leadDays: string;
  paymentTerms: string;
  certifications: string;
  score: number;
  shipsInternationally: boolean;
}

interface FinancialSummary {
  projectName: string;
  domain: string;
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  grossMarginPct: number;
  totalOrders: number;
  aov: number;
  productCount: number;
  topProducts: Array<{ title: string; revenue: number; margin: number }>;
  alerts: string[];
}

function applyHeaderStyle(ws: XLSX.WorkSheet, range: string): void {
  if (!ws["!cols"]) ws["!cols"] = [];
}

function autoWidth(ws: XLSX.WorkSheet, data: any[][]): void {
  const cols: XLSX.ColInfo[] = [];
  if (data.length === 0) return;
  const maxCols = Math.max(...data.map(r => r.length));
  for (let c = 0; c < maxCols; c++) {
    let maxLen = 10;
    for (const row of data) {
      const val = row[c];
      if (val != null) {
        const len = String(val).length;
        if (len > maxLen) maxLen = len;
      }
    }
    cols.push({ wch: Math.min(maxLen + 2, 45) });
  }
  ws["!cols"] = cols;
}

export function generateCogsXlsx(products: CogsProduct[], projectName: string): Buffer {
  const wb = XLSX.utils.book_new();

  const methData = [
    [`ESTIMACIÓN COGS COMPLETA — ${projectName.toUpperCase()}`],
    [],
    ["Paso", "Qué se hace", "Fuente de datos", "Nivel de precisión"],
    ["1", "Identificar partidas de coste directo", "Análisis cadena de valor del producto", "Alta"],
    ["2", "Buscar precios de mercado actuales", "Proveedores + benchmarks del sector", "Media-Alta"],
    ["3", "Calcular coste por unidad", "Fórmulas (precio × cantidad / unidades)", "Alta"],
    ["4", "Añadir rangos (Bajo / Promedio / Alto)", "Múltiples proveedores y calidades", "Media"],
    ["5", "Calcular COGS total y Margen Bruto", "Suma de todos los costes variables", "Alta"],
    ["6", "Proyecciones de volumen y EBITDA", "Escenarios conservador / realista / optimista", "Media"],
  ];
  const wsMeth = XLSX.utils.aoa_to_sheet(methData);
  autoWidth(wsMeth, methData);
  XLSX.utils.book_append_sheet(wb, wsMeth, "Metodología");

  const compHeader = [
    "Producto", "Precio Venta (€)", "Coste Unitario (€)", "Material (€)",
    "Packaging (€)", "Envío Nacional (€)", "Envío Intl. (€)", "Fulfillment (€)",
    "Plataforma (€)", "Marketing (€)", "Tasa Devolución (%)", "COGS Total (€)",
    "Margen Bruto (%)",
  ];
  const compRows = products.map(p => [
    p.title, p.price, p.unitCost, p.materialCost,
    p.packagingCost, p.shippingDomestic, p.shippingInternational, p.fulfillmentFee,
    p.platformFee, p.marketingCost, Math.round(p.returnRate * 100 * 10) / 10,
    p.totalCogs, Math.round(p.marginPct * 10) / 10,
  ]);
  const compData = [
    [`COMPARATIVA DETALLADA POR PRODUCTO — ${projectName}`],
    [],
    compHeader,
    ...compRows,
  ];
  const wsComp = XLSX.utils.aoa_to_sheet(compData);
  autoWidth(wsComp, compData);
  XLSX.utils.book_append_sheet(wb, wsComp, "Comparativa_Detallada");

  const totalRev = products.reduce((s, p) => s + p.price, 0);
  const totalCogs = products.reduce((s, p) => s + p.totalCogs, 0);
  const totalMargin = totalRev - totalCogs;
  const marginPct = totalRev > 0 ? (totalMargin / totalRev) * 100 : 0;

  const costBreakdown = [
    ["Tipo de Coste", "Coste Total (€)", "% del COGS", "Impacto en Margen"],
    ["Coste Unitario Producción", products.reduce((s, p) => s + p.unitCost, 0), "", "Base"],
    ["Materiales", products.reduce((s, p) => s + p.materialCost, 0), "", "Alto"],
    ["Packaging", products.reduce((s, p) => s + p.packagingCost, 0), "", "Medio"],
    ["Envío Nacional", products.reduce((s, p) => s + p.shippingDomestic, 0), "", "Medio"],
    ["Envío Internacional", products.reduce((s, p) => s + p.shippingInternational, 0), "", "Alto"],
    ["Fulfillment", products.reduce((s, p) => s + p.fulfillmentFee, 0), "", "Medio"],
    ["Plataforma / Pagos", products.reduce((s, p) => s + p.platformFee, 0), "", "Fijo"],
    ["Marketing / CAC", products.reduce((s, p) => s + p.marketingCost, 0), "", "Variable"],
  ];
  for (const row of costBreakdown.slice(1)) {
    const cost = row[1] as number;
    row[2] = totalCogs > 0 ? `${Math.round((cost / totalCogs) * 1000) / 10}%` : "0%";
  }
  costBreakdown.push(["TOTAL COGS", totalCogs, "100%", ""]);

  const breakdownData = [
    [`DESGLOSE DE COSTES — ${projectName}`],
    [],
    ...costBreakdown,
  ];
  const wsBreak = XLSX.utils.aoa_to_sheet(breakdownData);
  autoWidth(wsBreak, breakdownData);
  XLSX.utils.book_append_sheet(wb, wsBreak, "Desglose_Costes");

  const sorted = [...products].sort((a, b) => b.marginPct - a.marginPct);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const summaryData = [
    [`RESUMEN EJECUTIVO — ${projectName}`],
    [],
    ["Indicador", "Valor", "Observación"],
    ["Total Productos Analizados", products.length, ""],
    ["Revenue Total Agregado", `€${Math.round(totalRev * 100) / 100}`, "Suma de precios de venta"],
    ["COGS Total Agregado", `€${Math.round(totalCogs * 100) / 100}`, "Incluyendo todos los costes"],
    ["Margen Bruto Global", `€${Math.round(totalMargin * 100) / 100} (${Math.round(marginPct * 10) / 10}%)`, ""],
    ["Mejor Margen", best ? `${best.title} (${Math.round(best.marginPct * 10) / 10}%)` : "N/A", "Producto más rentable"],
    ["Peor Margen", worst ? `${worst.title} (${Math.round(worst.marginPct * 10) / 10}%)` : "N/A", "Producto a revisar"],
    ["Productos con margen < 20%", products.filter(p => p.marginPct < 20).length, "Riesgo de pérdida con devoluciones"],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  autoWidth(wsSummary, summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen_Ejecutivo");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buf);
}

export function generateSupplierComparisonXlsx(
  suppliers: SupplierEntry[],
  projectName: string,
): Buffer {
  const wb = XLSX.utils.book_new();

  const methData = [
    [`ANÁLISIS Y COMPARATIVA DE PROVEEDORES — ${projectName.toUpperCase()}`],
    [],
    ["Paso", "Acción", "Datos utilizados", "Fuente típica"],
    ["1", "Identificar categorías de productos clave", "Lista de categorías del proyecto", "Catálogo + historial"],
    ["2", "Seleccionar proveedores reales del nicho", "Proveedores encontrados por IA", "Google + directorios B2B"],
    ["3", "Recopilar precios unitarios + condiciones", "Precio, MOQ, plazo, pago", "Catálogos + negociaciones"],
    ["4", "Evaluar: Precio 40%, Calidad 30%, Servicio 30%", "Ponderación estándar", "Matriz de decisión"],
    ["5", "Calcular Coste Total de Propiedad (TCO)", "Precio + transporte + roturas + servicio", "Análisis financiero"],
  ];
  const wsMeth = XLSX.utils.aoa_to_sheet(methData);
  autoWidth(wsMeth, methData);
  XLSX.utils.book_append_sheet(wb, wsMeth, "Metodología");

  const categories = [...new Set(suppliers.map(s => s.category))].sort();

  for (const cat of categories) {
    const catSuppliers = suppliers.filter(s => s.category === cat);
    const header = [
      "Proveedor", "País", "Precio Mín", "Precio Máx", "Moneda",
      "MOQ", "Plazo Entrega", "Pago", "Certificaciones",
      "Envío Intl.", "Puntuación (1-10)",
    ];
    const rows = catSuppliers.map(s => [
      s.name, s.country, s.priceMin, s.priceMax, s.currency,
      s.moq, s.leadDays, s.paymentTerms, s.certifications,
      s.shipsInternationally ? "Sí" : "No", s.score,
    ]);
    const sheetData = [
      [`PROVEEDORES — ${cat.toUpperCase()}`],
      [],
      header,
      ...rows,
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    autoWidth(ws, sheetData);
    const sheetName = cat.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, "").substring(0, 28);
    XLSX.utils.book_append_sheet(wb, ws, sheetName || "General");
  }

  const scoreRanking = [...suppliers].sort((a, b) => b.score - a.score);
  const rankData = [
    ["RANKING GLOBAL DE PROVEEDORES"],
    [],
    ["#", "Proveedor", "Categoría", "País", "Score", "Precio Mín", "MOQ", "Plazo"],
    ...scoreRanking.map((s, i) => [
      i + 1, s.name, s.category, s.country, s.score, s.priceMin, s.moq, s.leadDays,
    ]),
  ];
  const wsRank = XLSX.utils.aoa_to_sheet(rankData);
  autoWidth(wsRank, rankData);
  XLSX.utils.book_append_sheet(wb, wsRank, "Ranking_Global");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buf);
}

export function generateFinancialSummaryXlsx(summary: FinancialSummary): Buffer {
  const wb = XLSX.utils.book_new();

  const dashData = [
    [`INFORME FINANCIERO — ${summary.projectName.toUpperCase()}`],
    [`Dominio: ${summary.domain}`],
    [],
    ["Indicador", "Valor", "Unidad"],
    ["Revenue Total", summary.totalRevenue, "€"],
    ["COGS Total", summary.totalCogs, "€"],
    ["Beneficio Bruto", summary.grossProfit, "€"],
    ["Margen Bruto", summary.grossMarginPct, "%"],
    ["Total Pedidos", summary.totalOrders, "uds"],
    ["AOV (Ticket Medio)", summary.aov, "€"],
    ["Productos en Catálogo", summary.productCount, "uds"],
    [],
    ["ALERTAS FINANCIERAS"],
    ...summary.alerts.map(a => [a]),
  ];
  const wsDash = XLSX.utils.aoa_to_sheet(dashData);
  autoWidth(wsDash, dashData);
  XLSX.utils.book_append_sheet(wb, wsDash, "Dashboard");

  if (summary.topProducts.length > 0) {
    const topData = [
      ["TOP PRODUCTOS POR REVENUE"],
      [],
      ["Producto", "Revenue (€)", "Margen (%)"],
      ...summary.topProducts.map(p => [p.title, p.revenue, Math.round(p.margin * 10) / 10]),
    ];
    const wsTop = XLSX.utils.aoa_to_sheet(topData);
    autoWidth(wsTop, topData);
    XLSX.utils.book_append_sheet(wb, wsTop, "Top_Productos");
  }

  const scenarioData = [
    ["ESCENARIOS DE PROYECCIÓN"],
    [],
    ["Escenario", "Pedidos/Mes", "Revenue Mensual (€)", "COGS Mensual (€)", "Beneficio (€)", "Margen (%)"],
    [
      "Conservador",
      Math.round(summary.totalOrders * 0.7),
      Math.round(summary.totalRevenue * 0.7),
      Math.round(summary.totalCogs * 0.7),
      Math.round((summary.totalRevenue - summary.totalCogs) * 0.7),
      summary.grossMarginPct,
    ],
    [
      "Realista",
      summary.totalOrders,
      summary.totalRevenue,
      summary.totalCogs,
      summary.grossProfit,
      summary.grossMarginPct,
    ],
    [
      "Optimista",
      Math.round(summary.totalOrders * 1.4),
      Math.round(summary.totalRevenue * 1.4),
      Math.round(summary.totalCogs * 1.35),
      Math.round(summary.totalRevenue * 1.4 - summary.totalCogs * 1.35),
      Math.round(((summary.totalRevenue * 1.4 - summary.totalCogs * 1.35) / (summary.totalRevenue * 1.4)) * 1000) / 10,
    ],
  ];
  const wsScen = XLSX.utils.aoa_to_sheet(scenarioData);
  autoWidth(wsScen, scenarioData);
  XLSX.utils.book_append_sheet(wb, wsScen, "Escenarios");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buf);
}
