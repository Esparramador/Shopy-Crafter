#!/usr/bin/env node
// El botón flotante del asistente no tapa el pie: al final de cada página
// pública con asistente, ningún enlace ni texto del pie queda debajo del botón,
// y el botón sigue visible, por encima de todo y abriendo el asistente.
//
// Uso: pnpm --filter @workspace/shopify-optimizer run e2e:chat-boton-pie
// Env: ver e2e/public-e2e-helpers.mjs (E2E_BASE_URL, E2E_CHROMIUM, E2E_CHANNEL).
import { DESKTOP, MOBILE, createChecker, launchBrowser, newContext, openPublic, scrollToInstant, trackPageErrors } from "./public-e2e-helpers.mjs";

// Rutas donde App.tsx monta el asistente (PublicChatbotSlot): portada y páginas con PublicLayout.
const ROUTES = ["/", "/faq", "/contacto", "/blog", "/sobre-nosotros", "/privacidad", "/casos-de-exito"];
const VIEWPORTS = [
  { ...MOBILE, name: "móvil 390" },
  { name: "móvil 360", width: 360, height: 740, isMobile: true },
  { name: "tableta 820", width: 820, height: 1180, isMobile: true },
  { ...DESKTOP, name: "escritorio" },
];
const FAB = "button[aria-label='Abrir asistente de ventas']";

const { check, finish } = createChecker();
const browser = await launchBrowser();

try {
  for (const viewport of VIEWPORTS) {
    const context = await newContext(browser, viewport);
    for (const route of ROUTES) {
      const tag = `[${viewport.name} ${route}]`;
      const page = await context.newPage();
      const errors = trackPageErrors(page);
      await openPublic(page, route);
      const fab = page.locator(FAB);
      try {
        await fab.waitFor({ state: "visible", timeout: 20_000 });
      } catch {
        check(false, `${tag} el botón del asistente aparece`);
        await page.close();
        continue;
      }
      await scrollToInstant(page, "end");
      await page.waitForTimeout(300);

      const report = await page.evaluate(selector => {
        const button = document.querySelector(selector);
        const b = button.getBoundingClientRect();
        const footer = document.querySelector("footer");
        const pad = 4; // margen: ni rozar el botón.
        const covered = [];
        for (const el of footer.querySelectorAll("a, button, p, li, span, strong, h2, h3, h4")) {
          if (!el.getClientRects().length) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const overlaps = r.left < b.right + pad && b.left - pad < r.right && r.top < b.bottom + pad && b.top - pad < r.bottom;
          if (overlaps) covered.push(`${el.tagName.toLowerCase()} «${(el.textContent || "").trim().slice(0, 30)}»`);
        }
        const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return {
          covered: [...new Set(covered)],
          fabOnTop: Boolean(hit && (hit === button || button.contains(hit))),
          fabInView: b.top >= 0 && b.bottom <= window.innerHeight && b.left >= 0 && b.right <= window.innerWidth,
          footerPaddingBottom: getComputedStyle(footer).paddingBottom,
        };
      }, FAB);

      check(report.covered.length === 0, `${tag} al final de la página el botón no tapa nada del pie${report.covered.length ? `: ${report.covered.slice(0, 4).join(", ")} (padding-bottom ${report.footerPaddingBottom})` : ""}`);
      check(report.fabInView && report.fabOnTop, `${tag} el botón sigue visible y por encima al final de la página`);
      await fab.click();
      const opened = await page.locator("button[aria-label='Cerrar asistente']").isVisible().catch(() => false);
      check(opened, `${tag} el botón abre el asistente`);
      check(errors.length === 0, `${tag} sin errores de JavaScript${errors.length ? ` (${errors[0]})` : ""}`);
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
}

finish("El botón del asistente deja libres los enlaces y textos del pie en móvil, tableta y escritorio");
