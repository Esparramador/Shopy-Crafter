#!/usr/bin/env node
// Verifica que Contacto conserva un único footer compartido, después del
// formulario y en el flujo normal de la página en escritorio y móvil.
//
// Uso: pnpm --filter @workspace/shopify-optimizer run e2e:contacto-footer
// Env opcionales: E2E_BASE_URL (por defecto https://$REPLIT_DEV_DOMAIN),
//                 E2E_CHROMIUM (por defecto `which chromium`).
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const BASE = (process.env.E2E_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`).replace(/\/$/, "");
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800, isMobile: false },
  { name: "mobile", width: 375, height: 812, isMobile: true },
];

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!BASE || BASE === "https://undefined") {
  fail("Define E2E_BASE_URL o REPLIT_DEV_DOMAIN para indicar el servidor web");
}

function chromiumPath() {
  if (process.env.E2E_CHROMIUM) return process.env.E2E_CHROMIUM;
  try { return execSync("which chromium", { encoding: "utf8" }).trim(); } catch { return undefined; }
}

const browser = await chromium.launch({
  executablePath: chromiumPath(),
  headless: true,
  args: ["--no-sandbox"],
});
const failures = [];
function check(condition, message) {
  if (condition) console.log(`✓ ${message}`);
  else {
    console.error(`✗ ${message}`);
    failures.push(message);
  }
}

try {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile,
      hasTouch: viewport.isMobile,
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(String(error)));

    await page.goto(`${BASE}/contacto`, { waitUntil: "domcontentloaded" });
    await page.locator("form").waitFor({ state: "visible", timeout: 20_000 });
    const form = page.locator("form");
    const footers = page.locator("footer");
    const footerCount = await footers.count();
    check(footerCount === 1, `[${viewport.name}] aparece exactamente un footer (encontrados ${footerCount})`);

    if (footerCount === 1) {
      const footer = footers.first();
      const afterForm = await form.evaluate((formElement, footerElement) =>
        Boolean(formElement.compareDocumentPosition(footerElement) & Node.DOCUMENT_POSITION_FOLLOWING),
      await footer.elementHandle());
      check(afterForm, `[${viewport.name}] el footer aparece después del formulario en el documento`);

      const position = await footer.evaluate(element => getComputedStyle(element).position);
      check(position !== "fixed" && position !== "sticky", `[${viewport.name}] el footer no es fijo ni sticky (position: ${position})`);

      await footer.scrollIntoViewIfNeeded();
      const bounds = await page.evaluate(() => {
        const formRect = document.querySelector("form").getBoundingClientRect();
        const footerRect = document.querySelector("footer").getBoundingClientRect();
        return {
          formBottom: formRect.bottom,
          footerTop: footerRect.top,
          overlap: formRect.left < footerRect.right
            && footerRect.left < formRect.right
            && formRect.top < footerRect.bottom
            && footerRect.top < formRect.bottom,
        };
      });
      check(bounds.footerTop >= bounds.formBottom - 1, `[${viewport.name}] el footer comienza tras el formulario`);
      check(!bounds.overlap, `[${viewport.name}] el footer no se solapa con el formulario`);
    }

    check(pageErrors.length === 0, `[${viewport.name}] sin errores de JavaScript (${pageErrors.slice(0, 2).join(" | ")})`);
    await context.close();
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} comprobación(es) fallida(s)`);
  process.exit(1);
}
console.log("\n✓ Contacto mantiene un único footer sin cubrir el formulario en escritorio y móvil");
