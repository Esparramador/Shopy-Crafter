import type { Response } from "express";
import { logger } from "./logger.js";

const CHROMIUM_PATH = process.env.CHROMIUM_PATH
  || process.env.PUPPETEER_EXECUTABLE_PATH
  || "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium";

const PDF_TIMEOUT_MS = Number(process.env.PDF_TIMEOUT_MS) || 60_000;
const MAX_HTML_SIZE_MB = 5;

export async function generatePdfFromHtml(
  htmlContent: string,
  filename: string,
  res: Response
): Promise<void> {
  const htmlSizeBytes = Buffer.byteLength(htmlContent, "utf8");
  if (htmlSizeBytes > MAX_HTML_SIZE_MB * 1024 * 1024) {
    throw new Error(`HTML too large: ${(htmlSizeBytes / 1024 / 1024).toFixed(1)}MB (max ${MAX_HTML_SIZE_MB}MB)`);
  }

  let browser: any = null;
  let page: any = null;

  try {
    const puppeteer = await import("puppeteer-core");
    browser = await puppeteer.default.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--font-render-hinting=none",
      ],
    });

    page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on("request", (r: any) => {
      const t = r.resourceType();
      const url = r.url();
      if (t === "script" || t === "xhr" || t === "fetch" || t === "websocket") {
        r.abort();
      } else if (t === "stylesheet" && (url.startsWith("http://") || url.startsWith("https://"))) {
        logger.debug({ url }, "PDF: blocking external stylesheet");
        r.abort();
      } else if (t === "font" && (url.startsWith("http://") || url.startsWith("https://"))) {
        logger.debug({ url }, "PDF: blocking external font");
        r.abort();
      } else {
        r.continue();
      }
    });

    await page.setContent(htmlContent, {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });

    await new Promise(r => setTimeout(r, 800));

    const pdfBuffer = await Promise.race([
      page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "0", bottom: "0", left: "0", right: "0" },
        preferCSSPageSize: false,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`PDF generation timed out after ${PDF_TIMEOUT_MS}ms`)),
          PDF_TIMEOUT_MS
        )
      ),
    ]);

    const safeName = filename
      .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ _-]/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 80);

    logger.info({ filename: safeName, sizeBytes: pdfBuffer.length }, "PDF generated");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.pdf"`);
    res.setHeader("Content-Length", String(pdfBuffer.length));
    res.send(Buffer.from(pdfBuffer));

  } finally {
    if (page) { try { await page.close(); } catch {} }
    if (browser) { try { await browser.close(); } catch {} }
  }
}
