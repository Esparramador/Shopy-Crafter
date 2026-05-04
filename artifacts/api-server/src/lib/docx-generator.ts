import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, HeadingLevel, BorderStyle, ShadingType,
  PageBreak, Header, Footer,
} from "docx";

const BRAND_HEX = "C8A84B";
const DARK_HEX = "0A1628";
const TEXT_HEX = "333333";
const MUTED_HEX = "666666";

interface CogsProduct {
  title: string;
  price: number;
  totalCogs: number;
  marginPct: number;
}

interface ExecutiveDocxData {
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

function kpiParagraph(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 24, color: TEXT_HEX }),
      new TextRun({ text: value, size: 24, color: BRAND_HEX, bold: true }),
    ],
  });
}

function sectionTitle(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 400, after: 200 },
    children: [
      new TextRun({ text, bold: true, size: 28, color: DARK_HEX }),
    ],
  });
}

function bulletItem(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 80 },
    children: [
      new TextRun({ text, size: 22, color: TEXT_HEX }),
    ],
  });
}

function makeCell(text: string, opts?: { bold?: boolean; header?: boolean; align?: typeof AlignmentType[keyof typeof AlignmentType] }): TableCell {
  return new TableCell({
    width: { size: 0, type: WidthType.AUTO },
    shading: opts?.header
      ? { type: ShadingType.SOLID, color: DARK_HEX, fill: DARK_HEX }
      : undefined,
    children: [
      new Paragraph({
        alignment: opts?.align ?? AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            bold: opts?.bold ?? opts?.header ?? false,
            size: opts?.header ? 20 : 20,
            color: opts?.header ? "FFFFFF" : TEXT_HEX,
          }),
        ],
      }),
    ],
  });
}

export async function generateExecutiveDocx(data: ExecutiveDocxData): Promise<Buffer> {
  const now = new Date();
  const dateStr = now.toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });

  const sections: Paragraph[] = [];

  sections.push(new Paragraph({ spacing: { after: 600 }, children: [] }));
  sections.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [
      new TextRun({ text: "INFORME EJECUTIVO", bold: true, size: 48, color: DARK_HEX }),
    ],
  }));
  sections.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [
      new TextRun({ text: data.projectName, bold: true, size: 36, color: BRAND_HEX }),
    ],
  }));
  sections.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [
      new TextRun({ text: data.domain, size: 24, color: MUTED_HEX, italics: true }),
    ],
  }));
  sections.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [
      new TextRun({ text: dateStr, size: 22, color: MUTED_HEX }),
    ],
  }));
  sections.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [
      new TextRun({ text: "Generado por Shopy Crafter — Inteligencia Comercial", size: 20, color: BRAND_HEX, italics: true }),
    ],
  }));

  sections.push(new Paragraph({ children: [new PageBreak()] }));

  sections.push(sectionTitle("1. Dashboard Financiero"));
  sections.push(kpiParagraph("Revenue Total", `€${data.totalRevenue.toLocaleString("es-ES")}`));
  sections.push(kpiParagraph("COGS Total", `€${data.totalCogs.toLocaleString("es-ES")}`));
  sections.push(kpiParagraph("Beneficio Bruto", `€${data.grossProfit.toLocaleString("es-ES")}`));
  sections.push(kpiParagraph("Margen Bruto", `${data.grossMarginPct}%`));
  sections.push(kpiParagraph("Total Pedidos", String(data.totalOrders)));
  sections.push(kpiParagraph("Ticket Medio (AOV)", `€${data.aov}`));
  sections.push(kpiParagraph("Productos en Catálogo", String(data.productCount)));

  if (data.products.length > 0) {
    sections.push(new Paragraph({ children: [new PageBreak()] }));
    sections.push(sectionTitle("2. Análisis COGS por Producto"));

    const sorted = [...data.products].sort((a, b) => b.marginPct - a.marginPct);
    const top15 = sorted.slice(0, 15);

    const headerRow = new TableRow({
      children: [
        makeCell("Producto", { header: true }),
        makeCell("Precio", { header: true, align: AlignmentType.RIGHT }),
        makeCell("COGS", { header: true, align: AlignmentType.RIGHT }),
        makeCell("Margen %", { header: true, align: AlignmentType.RIGHT }),
      ],
    });

    const dataRows = top15.map(p => new TableRow({
      children: [
        makeCell(p.title.substring(0, 50)),
        makeCell(`€${p.price}`, { align: AlignmentType.RIGHT }),
        makeCell(`€${Math.round(p.totalCogs * 100) / 100}`, { align: AlignmentType.RIGHT }),
        makeCell(`${Math.round(p.marginPct * 10) / 10}%`, { bold: p.marginPct < 20, align: AlignmentType.RIGHT }),
      ],
    }));

    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows],
    });
    sections.push(table as any);

    const lowMargin = sorted.filter(p => p.marginPct < 20);
    if (lowMargin.length > 0) {
      sections.push(new Paragraph({ spacing: { before: 300, after: 100 }, children: [
        new TextRun({ text: `⚠ ${lowMargin.length} producto(s) con margen inferior al 20%:`, bold: true, size: 22, color: "CC0000" }),
      ]}));
      for (const p of lowMargin.slice(0, 5)) {
        sections.push(bulletItem(`${p.title} — Margen: ${Math.round(p.marginPct * 10) / 10}%`));
      }
    }
  }

  if (data.deadCosts && data.deadCosts.items.length > 0) {
    sections.push(new Paragraph({ children: [new PageBreak()] }));
    sections.push(sectionTitle("3. Costes Muertos Identificados"));
    sections.push(kpiParagraph("Coste Muerto Total", `€${data.deadCosts.totalDeadCost.toLocaleString("es-ES")}`));
    sections.push(kpiParagraph("Items Afectados", String(data.deadCosts.items.length)));
    if (data.totalCogs > 0) {
      sections.push(kpiParagraph("% del COGS", `${Math.round((data.deadCosts.totalDeadCost / data.totalCogs) * 1000) / 10}%`));
    }
    sections.push(new Paragraph({ spacing: { before: 200 }, children: [] }));
    for (const item of data.deadCosts.items.slice(0, 10)) {
      sections.push(bulletItem(`${item.title}: €${item.cost} — ${item.reason}`));
    }
  }

  if (data.alerts.length > 0) {
    sections.push(new Paragraph({ children: [new PageBreak()] }));
    sections.push(sectionTitle("4. Alertas y Riesgos"));
    for (const alert of data.alerts) {
      sections.push(bulletItem(alert));
    }
  }

  if (data.recommendations.length > 0) {
    sections.push(sectionTitle("5. Recomendaciones Estratégicas"));
    for (const rec of data.recommendations) {
      sections.push(bulletItem(rec));
    }
  }

  const doc = new Document({
    creator: "Shopy Crafter",
    title: `Informe Ejecutivo — ${data.projectName}`,
    description: `Informe ejecutivo generado automáticamente para ${data.projectName}`,
    sections: [{
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: `Shopy Crafter — ${data.projectName}`, size: 16, color: MUTED_HEX, italics: true }),
            ],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `Informe generado el ${dateStr} — Confidencial`, size: 16, color: MUTED_HEX }),
            ],
          })],
        }),
      },
      children: sections,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
