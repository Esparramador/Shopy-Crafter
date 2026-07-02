import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import ExcelJS from "exceljs";
import PptxGenJS from "pptxgenjs";

// ══════════════════════════════════════════════════════════════════════════
// GENERIC OFFICE DOCUMENT GENERATOR — real .docx / .xlsx / .pptx buffers
// Used by the `generate_office_document` chat action so the platform can
// REALLY execute document-generation skills (docx/xlsx/pptx/excel-generator/
// invoice-generator/resume-maker) instead of only describing them.
// ══════════════════════════════════════════════════════════════════════════

export interface OfficeSection {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: { headers: string[]; rows: string[][] };
}

export interface OfficeDocRequest {
  title: string;
  subtitle?: string;
  sections: OfficeSection[];
}

const BRAND_HEX = "C8A84B";
const DARK_HEX = "0A1628";

export async function generateOfficeDocx(req: OfficeDocRequest): Promise<Buffer> {
  const children: Paragraph[] = [];
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: req.title, bold: true, size: 44, color: DARK_HEX })],
  }));
  if (req.subtitle) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: req.subtitle, size: 24, color: "666666" })],
    }));
  }
  for (const section of req.sections) {
    if (section.heading) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
        children: [new TextRun({ text: section.heading, bold: true, size: 28, color: BRAND_HEX })],
      }));
    }
    for (const p of section.paragraphs || []) {
      children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: p, size: 22 })] }));
    }
    for (const b of section.bullets || []) {
      children.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 80 }, children: [new TextRun({ text: b, size: 22 })] }));
    }
  }
  const doc = new Document({ sections: [{ children }] });
  return await Packer.toBuffer(doc);
}

export async function generateOfficeXlsx(req: OfficeDocRequest): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Shopy Crafter";
  const ws = wb.addWorksheet(req.title.slice(0, 30) || "Reporte");
  ws.mergeCells("A1:D1");
  ws.getCell("A1").value = req.title;
  ws.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF0A1628" } };
  let row = 3;
  for (const section of req.sections) {
    if (section.heading) {
      ws.getCell(`A${row}`).value = section.heading;
      ws.getCell(`A${row}`).font = { bold: true, size: 12, color: { argb: "FFC8A84B" } };
      row += 1;
    }
    if (section.table) {
      const headerRow = ws.getRow(row);
      section.table.headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A1628" } };
      });
      row += 1;
      for (const r of section.table.rows) {
        r.forEach((v, i) => { ws.getRow(row).getCell(i + 1).value = v; });
        row += 1;
      }
      row += 1;
    }
    for (const p of section.paragraphs || []) { ws.getCell(`A${row}`).value = p; row += 1; }
    for (const b of section.bullets || []) { ws.getCell(`A${row}`).value = `• ${b}`; row += 1; }
    row += 1;
  }
  ws.columns.forEach(col => { col.width = 30; });
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function generateOfficePptx(req: OfficeDocRequest): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "SC_16x9", width: 13.33, height: 7.5 });
  pptx.layout = "SC_16x9";

  const cover = pptx.addSlide();
  cover.background = { color: "0A1628" };
  cover.addText(req.title, { x: 0.6, y: 2.6, w: 12, h: 1.5, fontSize: 36, bold: true, color: "FFFFFF" });
  if (req.subtitle) cover.addText(req.subtitle, { x: 0.6, y: 4.1, w: 12, h: 0.8, fontSize: 18, color: "C8A84B" });

  for (const section of req.sections) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    let y = 0.5;
    if (section.heading) {
      slide.addText(section.heading, { x: 0.5, y, w: 12, h: 0.8, fontSize: 24, bold: true, color: "0A1628" });
      y += 1.0;
    }
    const bulletLines = [
      ...(section.paragraphs || []),
      ...(section.bullets || []).map(b => `• ${b}`),
    ];
    if (bulletLines.length > 0) {
      slide.addText(bulletLines.join("\n"), { x: 0.5, y, w: 12, h: 6 - y, fontSize: 16, color: "333333", valign: "top" });
    }
    if (section.table) {
      const rows = [section.table.headers, ...section.table.rows];
      slide.addTable(rows as any, { x: 0.5, y, w: 12, fontSize: 12, border: { type: "solid", color: "CCCCCC", pt: 1 } });
    }
  }
  const buf = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return buf;
}

export async function generateOfficeDocument(
  format: "docx" | "xlsx" | "pptx",
  req: OfficeDocRequest,
): Promise<{ buffer: Buffer; mimeType: string; extension: string }> {
  if (format === "xlsx") {
    return {
      buffer: await generateOfficeXlsx(req),
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      extension: "xlsx",
    };
  }
  if (format === "pptx") {
    return {
      buffer: await generateOfficePptx(req),
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      extension: "pptx",
    };
  }
  return {
    buffer: await generateOfficeDocx(req),
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extension: "docx",
  };
}
