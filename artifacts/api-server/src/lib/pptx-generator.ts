import PptxGenJS from "pptxgenjs";

const BRAND = {
  dark: "0A1628",
  primary: "C8A84B",
  accent: "4A90D9",
  text: "E8E8E8",
  muted: "8B95A5",
  success: "2ECC71",
  danger: "E74C3C",
  warning: "F39C12",
  bg: "0F1D32",
};

function addCoverSlide(pptx: PptxGenJS, title: string, subtitle: string): void {
  const slide = pptx.addSlide();
  slide.background = { fill: BRAND.dark };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: "100%", h: 0.08,
    fill: { color: BRAND.primary },
  });

  slide.addText(title, {
    x: 0.8, y: 1.8, w: 8.4, h: 1.5,
    fontSize: 36, fontFace: "Arial",
    color: BRAND.text, bold: true,
    align: "left",
  });

  slide.addText(subtitle, {
    x: 0.8, y: 3.3, w: 8.4, h: 0.6,
    fontSize: 16, fontFace: "Arial",
    color: BRAND.muted, italic: true,
    align: "left",
  });

  slide.addText("Shopy Crafter — Inteligencia Comercial", {
    x: 0.8, y: 4.6, w: 8.4, h: 0.4,
    fontSize: 11, fontFace: "Arial",
    color: BRAND.primary,
    align: "left",
  });

  const now = new Date();
  slide.addText(
    `${now.toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })}`,
    { x: 0.8, y: 5.0, w: 8.4, h: 0.3, fontSize: 10, fontFace: "Arial", color: BRAND.muted, align: "left" },
  );
}

function addSectionSlide(pptx: PptxGenJS, title: string): void {
  const slide = pptx.addSlide();
  slide.background = { fill: BRAND.bg };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0.6, y: 2.2, w: 1.2, h: 0.06,
    fill: { color: BRAND.primary },
  });

  slide.addText(title, {
    x: 0.6, y: 2.5, w: 8.8, h: 1,
    fontSize: 28, fontFace: "Arial",
    color: BRAND.text, bold: true,
    align: "left",
  });
}

function addKpiSlide(
  pptx: PptxGenJS,
  title: string,
  kpis: Array<{ label: string; value: string; color?: string }>,
): void {
  const slide = pptx.addSlide();
  slide.background = { fill: BRAND.dark };

  slide.addText(title, {
    x: 0.6, y: 0.3, w: 8.8, h: 0.5,
    fontSize: 20, fontFace: "Arial",
    color: BRAND.primary, bold: true,
  });

  const cols = Math.min(kpis.length, 4);
  const cardW = (9.0 / cols) - 0.3;
  kpis.forEach((kpi, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 0.5 + col * (cardW + 0.3);
    const y = 1.2 + row * 2.0;

    slide.addShape(pptx.ShapeType.roundRect, {
      x, y, w: cardW, h: 1.6,
      fill: { color: BRAND.bg },
      rectRadius: 0.1,
    });

    slide.addText(kpi.value, {
      x, y: y + 0.2, w: cardW, h: 0.8,
      fontSize: 28, fontFace: "Arial",
      color: kpi.color || BRAND.primary,
      bold: true, align: "center",
    });

    slide.addText(kpi.label, {
      x, y: y + 1.0, w: cardW, h: 0.4,
      fontSize: 11, fontFace: "Arial",
      color: BRAND.muted, align: "center",
    });
  });
}

function addTableSlide(
  pptx: PptxGenJS,
  title: string,
  headers: string[],
  rows: string[][],
): void {
  const slide = pptx.addSlide();
  slide.background = { fill: BRAND.dark };

  slide.addText(title, {
    x: 0.5, y: 0.2, w: 9, h: 0.5,
    fontSize: 18, fontFace: "Arial",
    color: BRAND.primary, bold: true,
  });

  const tableRows: PptxGenJS.TableRow[] = [
    headers.map(h => ({
      text: h,
      options: {
        bold: true,
        fontSize: 10,
        fontFace: "Arial",
        color: BRAND.dark,
        fill: { color: BRAND.primary },
        align: "center" as const,
        border: { type: "solid" as const, pt: 0.5, color: BRAND.primary },
      },
    })),
    ...rows.map(row =>
      row.map(cell => ({
        text: cell,
        options: {
          fontSize: 9,
          fontFace: "Arial",
          color: BRAND.text,
          fill: { color: BRAND.bg },
          align: "center" as const,
          border: { type: "solid" as const, pt: 0.5, color: "1A2A44" },
        },
      })),
    ),
  ];

  const colW = 9.0 / headers.length;
  slide.addTable(tableRows, {
    x: 0.5, y: 0.9, w: 9,
    colW: Array(headers.length).fill(colW),
    border: { type: "solid", pt: 0.5, color: "1A2A44" },
    autoPage: true,
  });
}

function addBulletSlide(pptx: PptxGenJS, title: string, bullets: string[]): void {
  const slide = pptx.addSlide();
  slide.background = { fill: BRAND.dark };

  slide.addText(title, {
    x: 0.6, y: 0.3, w: 8.8, h: 0.5,
    fontSize: 20, fontFace: "Arial",
    color: BRAND.primary, bold: true,
  });

  const textItems = bullets.map(b => ({
    text: b,
    options: {
      fontSize: 13,
      fontFace: "Arial" as const,
      color: BRAND.text,
      bullet: { code: "2022" },
      breakLine: true,
      paraSpaceAfter: 8,
    },
  }));

  slide.addText(textItems as any, {
    x: 0.8, y: 1.0, w: 8.4, h: 4.0,
    valign: "top",
  });
}

interface CogsProduct {
  title: string;
  price: number;
  totalCogs: number;
  marginPct: number;
}

interface ExecutiveData {
  projectName: string;
  domain: string;
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  grossMarginPct: number;
  totalOrders: number;
  aov: number;
  productCount: number;
  products: CogsProduct[];
  alerts: string[];
  recommendations: string[];
  deadCosts?: { totalDeadCost: number; items: Array<{ title: string; cost: number; reason: string }> };
}

export async function generateExecutivePptx(data: ExecutiveData): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Shopy Crafter";
  pptx.company = "Shopy Crafter — Inteligencia Comercial";
  pptx.title = `Informe Ejecutivo — ${data.projectName}`;

  addCoverSlide(pptx, `Informe Ejecutivo`, `${data.projectName} — ${data.domain}`);

  addSectionSlide(pptx, "1. Dashboard Financiero");

  addKpiSlide(pptx, "KPIs Principales", [
    { label: "Revenue Total", value: `€${data.totalRevenue.toLocaleString("es-ES")}` },
    { label: "COGS Total", value: `€${data.totalCogs.toLocaleString("es-ES")}`, color: BRAND.warning },
    { label: "Beneficio Bruto", value: `€${data.grossProfit.toLocaleString("es-ES")}`, color: BRAND.success },
    { label: "Margen Bruto", value: `${data.grossMarginPct}%`, color: data.grossMarginPct >= 40 ? BRAND.success : BRAND.danger },
  ]);

  addKpiSlide(pptx, "Métricas Operativas", [
    { label: "Total Pedidos", value: String(data.totalOrders) },
    { label: "Ticket Medio (AOV)", value: `€${data.aov}` },
    { label: "Productos", value: String(data.productCount) },
    { label: "Margen Neto Est.", value: `${Math.max(0, data.grossMarginPct - 10)}%` },
  ]);

  if (data.products.length > 0) {
    addSectionSlide(pptx, "2. Análisis COGS por Producto");

    const sorted = [...data.products].sort((a, b) => b.marginPct - a.marginPct);
    const top10 = sorted.slice(0, 10);
    addTableSlide(
      pptx,
      "Top Productos por Margen",
      ["Producto", "Precio", "COGS", "Margen %"],
      top10.map(p => [
        p.title.substring(0, 35),
        `€${p.price}`,
        `€${Math.round(p.totalCogs * 100) / 100}`,
        `${Math.round(p.marginPct * 10) / 10}%`,
      ]),
    );

    const bottom5 = sorted.slice(-5).reverse();
    if (bottom5.length > 0 && bottom5.some(p => p.marginPct < 30)) {
      addTableSlide(
        pptx,
        "Productos con Menor Margen (Riesgo)",
        ["Producto", "Precio", "COGS", "Margen %"],
        bottom5.map(p => [
          p.title.substring(0, 35),
          `€${p.price}`,
          `€${Math.round(p.totalCogs * 100) / 100}`,
          `${Math.round(p.marginPct * 10) / 10}%`,
        ]),
      );
    }
  }

  if (data.deadCosts && data.deadCosts.items.length > 0) {
    addSectionSlide(pptx, "3. Costes Muertos Identificados");

    addKpiSlide(pptx, "Impacto de Costes Muertos", [
      { label: "Coste Muerto Total", value: `€${data.deadCosts.totalDeadCost.toLocaleString("es-ES")}`, color: BRAND.danger },
      { label: "Items Afectados", value: String(data.deadCosts.items.length), color: BRAND.warning },
      { label: "% del COGS", value: data.totalCogs > 0 ? `${Math.round((data.deadCosts.totalDeadCost / data.totalCogs) * 1000) / 10}%` : "N/A", color: BRAND.danger },
    ]);

    addTableSlide(
      pptx,
      "Detalle Costes Muertos",
      ["Producto/Concepto", "Coste (€)", "Razón"],
      data.deadCosts.items.slice(0, 8).map(item => [
        item.title.substring(0, 30),
        `€${item.cost}`,
        item.reason.substring(0, 40),
      ]),
    );
  }

  if (data.alerts.length > 0) {
    addSectionSlide(pptx, "4. Alertas y Riesgos");
    addBulletSlide(pptx, "Alertas Detectadas", data.alerts);
  }

  if (data.recommendations.length > 0) {
    addSectionSlide(pptx, "5. Recomendaciones Estratégicas");
    addBulletSlide(pptx, "Acciones Recomendadas", data.recommendations);
  }

  const closingSlide = pptx.addSlide();
  closingSlide.background = { fill: BRAND.dark };
  closingSlide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 4.95, w: "100%", h: 0.08,
    fill: { color: BRAND.primary },
  });
  closingSlide.addText("Gracias", {
    x: 0, y: 1.5, w: "100%", h: 1,
    fontSize: 40, fontFace: "Arial",
    color: BRAND.primary, bold: true, align: "center",
  });
  closingSlide.addText(`${data.projectName} — Generado por Shopy Crafter`, {
    x: 0, y: 2.8, w: "100%", h: 0.5,
    fontSize: 14, fontFace: "Arial",
    color: BRAND.muted, align: "center",
  });

  const arrayBuf = await pptx.write({ outputType: "arraybuffer" }) as ArrayBuffer;
  return Buffer.from(arrayBuf);
}
