import type { Response } from "express";

const CHROMIUM_PATH = "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium";

export async function generatePdfFromHtml(
  htmlContent: string,
  filename: string,
  res: Response
): Promise<void> {
  let browser: any = null;
  try {
    const puppeteer = await import("puppeteer-core");
    browser = await puppeteer.default.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", (r: any) => {
      const t = r.resourceType();
      if (t === "script" || t === "xhr" || t === "fetch" || t === "websocket") r.abort();
      else r.continue();
    });
    await page.setContent(htmlContent, { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise(r => setTimeout(r, 1000));
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
    const safeName = filename.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ _-]/g, "_").replace(/\s+/g, "_").slice(0, 80);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.pdf"`);
    res.setHeader("Content-Length", String(pdfBuffer.length));
    res.send(Buffer.from(pdfBuffer));
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }
}
