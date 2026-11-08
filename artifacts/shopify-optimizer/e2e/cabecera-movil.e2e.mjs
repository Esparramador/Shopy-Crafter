#!/usr/bin/env node
// Cabeceras públicas en teléfonos estrechos (390, 360 y 320 px): marca y
// controles en una sola fila, sin desbordar ni pisarse, con objetivos táctiles
// de 44 px y el inicio de sesión alcanzable desde el menú.
// Cubre PublicLayout (páginas públicas) y ShopLayout (/tienda).
//
// Uso: pnpm --filter @workspace/shopify-optimizer run e2e:cabecera-movil
// Env: ver e2e/public-e2e-helpers.mjs (E2E_BASE_URL, E2E_CHROMIUM, E2E_CHANNEL).
import { createChecker, launchBrowser, newContext, openPublic, trackPageErrors } from "./public-e2e-helpers.mjs";

const WIDTHS = [390, 360, 320];
const PAGES = [
  { route: "/faq", header: "header.pp-nav", layout: "PublicLayout" },
  { route: "/contacto", header: "header.pp-nav", layout: "PublicLayout" },
  { route: "/tienda", header: "header.shop-nav", layout: "ShopLayout" },
  { route: "/tienda/carrito", header: "header.shop-nav", layout: "ShopLayout" },
];
const MIN_TAP = 44;

const { check, finish } = createChecker();
const browser = await launchBrowser();

try {
  for (const width of WIDTHS) {
    const context = await newContext(browser, { width, height: 760, isMobile: true });
    for (const { route, header, layout } of PAGES) {
      const tag = `[${width}px ${route}]`;
      const page = await context.newPage();
      const errors = trackPageErrors(page);
      await openPublic(page, route, header);
      await page.locator(header).waitFor({ state: "visible", timeout: 20_000 });
      await page.waitForTimeout(500);

      const r = await page.evaluate(selector => {
        const head = document.querySelector(selector);
        const hr = head.getBoundingClientRect();
        const controls = [...head.querySelectorAll("a, button")]
          .filter(el => !el.closest("#pp-menu") && el.getClientRects().length && getComputedStyle(el).visibility !== "hidden")
          .map(el => {
            const b = el.getBoundingClientRect();
            return {
              label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 24),
              left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height,
              clipped: el.scrollWidth > el.clientWidth + 1,
              wraps: [...el.querySelectorAll("span")].some(s => s.getClientRects().length > 1),
            };
          });
        return { headerHeight: hr.height, headerTop: hr.top, docOverflow: document.documentElement.scrollWidth - window.innerWidth, controls };
      }, header);

      check(r.docOverflow <= 0, `${tag} sin desbordamiento horizontal (${r.docOverflow} px)`);
      check(r.headerHeight <= 72, `${tag} la cabecera ocupa una fila (${Math.round(r.headerHeight)} px)`);
      const rowTops = r.controls.map(c => c.top + c.height / 2);
      check(Math.max(...rowTops) - Math.min(...rowTops) <= 6, `${tag} marca y controles alineados en la misma fila`);
      check(r.controls.every(c => c.left >= 0 && c.right <= width), `${tag} todos los controles caben en la pantalla`);
      const sorted = [...r.controls].sort((a, b) => a.left - b.left);
      const overlapping = sorted.some((c, i) => i > 0 && c.left < sorted[i - 1].right - 0.5);
      check(!overlapping, `${tag} los controles no se pisan`);
      const small = r.controls.filter(c => c.height < MIN_TAP - 0.5 || c.width < MIN_TAP - 0.5);
      check(small.length === 0, `${tag} objetivos táctiles de al menos ${MIN_TAP} px${small.length ? `: ${small.map(c => `${c.label} ${Math.round(c.width)}×${Math.round(c.height)}`).join(", ")}` : ""}`);
      check(r.controls.every(c => !c.clipped && !c.wraps), `${tag} ningún texto se corta ni salta de línea`);

      if (layout === "PublicLayout") {
        await page.locator(".pp-burger").click();
        const login = page.locator("#pp-menu a[href='/login']");
        check(await login.isVisible(), `${tag} «Iniciar sesión» está en el menú móvil`);
        const box = await login.boundingBox();
        check(box && box.height >= MIN_TAP && box.x >= 0 && box.x + box.width <= width, `${tag} «Iniciar sesión» es fácil de tocar`);
      } else {
        check(r.controls.some(c => /Carrito/.test(c.label)) && r.controls.some(c => /Atrás/.test(c.label)) && r.controls.some(c => /Inicio/.test(c.label)),
          `${tag} se ven «Atrás», «Inicio» y «Carrito»`);
      }
      check(errors.length === 0, `${tag} sin errores de JavaScript${errors.length ? ` (${errors[0]})` : ""}`);
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
}

finish("Las cabeceras públicas y de la Tienda caben en una fila legible y táctil de 390 a 320 px");
