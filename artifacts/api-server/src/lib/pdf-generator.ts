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

    // FIX A4: viewport explícito a A4 @ 96dpi (794x1123 px) para que `100vh`,
    // `min-height: 100vh` y demás unidades viewport equivalgan EXACTAMENTE a
    // la altura de la página A4. Sin esto, Puppeteer usa el viewport default
    // (800x600) y `100vh = 600px`, por lo que portadas con `min-height:100vh`
    // se quedan cortas y el contenido se desborda a una segunda página
    // (efecto "portada partida en dos hojas" al imprimir el PDF).
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });

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
