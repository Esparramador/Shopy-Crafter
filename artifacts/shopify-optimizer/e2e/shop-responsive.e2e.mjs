#!/usr/bin/env node
// Comprueba las pantallas públicas de la tienda, el precio servido y el cajón
// en móvil, paisaje, tableta y escritorio.
import { createChecker, launchBrowser, newContext, openPublic, trackPageErrors } from "./public-e2e-helpers.mjs";

const VIEWPORTS = [
  { name: "móvil estrecho", width: 320, height: 740, isMobile: true },
  { name: "móvil grande", width: 390, height: 844, isMobile: true },
  { name: "móvil paisaje", width: 844, height: 390, isMobile: true },
  { name: "tableta vertical", width: 768, height: 1024, isMobile: true },
  { name: "tableta paisaje", width: 1024, height: 768, isMobile: true },
  { name: "escritorio", width: 1280, height: 800, isMobile: false },
];
const ROUTES = [
  { path: "/tienda", ready: "#catalogo h2", content: "#catalogo h2" },
  { path: "/tienda/tarjetas-metalicas", ready: ".shop-pd-form", content: ".shop-pd-info h1" },
  { path: "/tienda/carrito", ready: ".shop-cart h1", content: ".shop-cart h1" },
  { path: "/tienda/gracias?pedido=00000000000000000000000000000000", ready: ".shop-thanks", content: ".shop-thanks h1" },
];
const { check, finish } = createChecker();
const browser = await launchBrowser();

try {
  for (const viewport of VIEWPORTS) {
    const context = await newContext(browser, viewport);
    for (const route of ROUTES) {
      const page = await context.newPage();
      const errors = trackPageErrors(page);
      const tag = `[${viewport.name} ${route.path.split("?")[0]}]`;
      try {
        await openPublic(page, route.path, route.ready);
        await page.locator(route.content).waitFor({ state: "visible", timeout: 25_000 });
        if (route.path === "/tienda") {
          const firstCard = page.locator(".shop-card").first();
          await firstCard.waitFor({ state: "visible", timeout: 25_000 });
          if (viewport.isMobile) {
            check(await page.locator(".shop-card-cta").first().isVisible(), `${tag} CTA visible sin hover`);
          } else {
            await firstCard.hover();
            check(await page.locator(".shop-card-cta").first().isVisible(), `${tag} CTA responde al ratón`);
            await firstCard.focus();
            check(await page.locator(".shop-card-cta").first().isVisible(), `${tag} CTA disponible con teclado`);
          }
        }
        const report = await page.evaluate(() => {
          const main = document.querySelector("main");
          const heading = main?.querySelector("h1, h2");
          const footer = document.querySelector("footer.shop-footer");
          const header = document.querySelector("header.shop-nav");
          const rect = (el) => {
            const r = el?.getBoundingClientRect();
            return r ? { width: r.width, height: r.height, left: r.left, right: r.right } : null;
          };
          return {
            overflow: document.documentElement.scrollWidth - window.innerWidth,
            main: rect(main), heading: rect(heading), header: rect(header), footer: rect(footer),
            footerStyle: footer ? getComputedStyle(footer).display : "missing",
            productPrice: Boolean(document.querySelector(".shop-price strong")),
            productActions: Boolean(document.querySelector(".shop-pd-actions button")),
            cartSummary: Boolean(document.querySelector(".shop-cart-summary")),
            bodyWidth: document.body.scrollWidth,
          };
        });
        check(report.overflow <= 0 && report.bodyWidth <= viewport.width, `${tag} no desborda horizontalmente (${Math.max(report.overflow, report.bodyWidth - viewport.width)} px)`);
        check(report.main?.width > 0 && report.heading?.height > 0, `${tag} el contenido esencial se muestra`);
        check(report.header?.height > 0 && report.header.left >= 0 && report.header.right <= viewport.width + 1, `${tag} la cabecera cabe en la pantalla`);
        check(report.footer?.height > 40 && report.footerStyle !== "none", `${tag} el pie está visible en el documento`);
        if (route.path.includes("tarjetas-metalicas")) {
          check(report.productPrice && report.productActions, `${tag} precio y acciones de compra visibles`);
          const variantPrices = await page.locator(".shop-seg label").allTextContents();
          check(variantPrices.some(text => text.includes("0,45")) && variantPrices.some(text => text.includes("0,55")), `${tag} ambas caras muestran el precio del catálogo`);
        }
        if (route.path === "/tienda/carrito") {
          check(report.cartSummary || await page.locator(".shop-empty").isVisible(), `${tag} resumen o estado vacío visible`);
        }
        check(errors.length === 0, `${tag} sin errores JavaScript${errors.length ? ` (${errors[0]})` : ""}`);
      } catch (error) {
        check(false, `${tag} carga y se muestra (${String(error).split("\n")[0]})`);
      } finally {
        await page.close();
      }
    }

    // Comprueba el flujo de precio, cotización y drawer en los dos extremos
    // táctiles/escritorio sin repetir una interacción larga en cada tamaño.
    if (viewport.name === "móvil estrecho" || viewport.name === "escritorio") {
      const detail = await context.newPage();
      const detailErrors = trackPageErrors(detail);
      try {
        await openPublic(detail, "/tienda/tarjetas-metalicas", ".shop-pd-form");
        await detail.locator("#f-nombre").fill("Prueba");
        await detail.locator(".shop-seg label:has(input[value='una-cara'])").click();
        await detail.waitForFunction(() => document.querySelector(".shop-price strong")?.textContent?.includes("45,00"));
        check(true, `[${viewport.name}] una cara calcula 100 × 0,45 €`);
        await detail.locator(".shop-seg label:has(input[value='doble-cara'])").click();
        await detail.waitForFunction(() => document.querySelector(".shop-price strong")?.textContent?.includes("55,00"));
        check(true, `[${viewport.name}] doble cara calcula 100 × 0,55 €`);
        if (viewport.name === "móvil estrecho") {
          const quote = await detail.evaluate(async () => {
            const response = await fetch("/api/shop/quote", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ items: [
                { slug: "tarjetas-metalicas", variant: "una-cara", qty: 100, fields: { nombre: "Prueba" } },
                { slug: "tarjetas-metalicas", variant: "doble-cara", qty: 100, fields: { nombre: "Prueba" } },
              ] }),
            });
            return { status: response.status, body: await response.json() };
          });
          check(quote.status === 200 && quote.body.lines?.[0]?.totalCents === 4500 && quote.body.lines?.[1]?.totalCents === 5500,
            "el API cotiza 45 € a una cara y 55 € a doble cara por 100 tarjetas");
        }
        await detail.locator(".shop-pd-actions button").nth(1).click();
        const drawer = detail.locator(".shop-drawer");
        await drawer.waitFor({ state: "visible", timeout: 10_000 });
        await detail.waitForFunction(() => {
          const panel = document.querySelector(".shop-drawer");
          if (!panel) return false;
          const r = panel.getBoundingClientRect();
          return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1;
        }, null, { timeout: 10_000 });
        const drawerReport = await drawer.evaluate(el => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        });
        check(true, `[${viewport.name}] cajón dentro de pantalla (${Math.round(drawerReport.left)}–${Math.round(drawerReport.right)} × ${Math.round(drawerReport.top)}–${Math.round(drawerReport.bottom)})`);
        check(await detail.locator(".shop-drawer-ctas a").isVisible(), `[${viewport.name}] acción principal del cajón accesible`);
        check(detailErrors.length === 0, `[${viewport.name}] ficha y cajón sin errores JavaScript`);
      } catch (error) {
        check(false, `[${viewport.name}] interacción de ficha y cajón (${String(error).split("\n")[0]})`);
      } finally {
        await detail.close();
      }
    }
    await context.close();
  }

  const reducedContext = await newContext(browser, VIEWPORTS[1], { reducedMotion: "reduce" });
  const reducedPage = await reducedContext.newPage();
  try {
    await openPublic(reducedPage, "/tienda", "#catalogo h2");
    await reducedPage.locator(".shop-card").first().waitFor({ state: "visible", timeout: 25_000 });
    const motion = await reducedPage.evaluate(() => ({
      requested: matchMedia("(prefers-reduced-motion: reduce)").matches,
      promoAnimation: getComputedStyle(document.querySelector(".shop-promo")).animationName,
      shineAnimation: getComputedStyle(document.querySelector(".shop-btn-shine"), "::after").animationName,
      cardTransition: getComputedStyle(document.querySelector(".shop-card")).transitionDuration,
    }));
    check(motion.requested && motion.promoAnimation === "none" && motion.shineAnimation === "none" &&
      motion.cardTransition.split(",").every(duration => parseFloat(duration) <= 0.001),
    "prefers-reduced-motion reduce animaciones y transiciones de la tienda");
  } finally {
    await reducedPage.close();
    await reducedContext.close();
  }
} finally {
  await browser.close();
}

finish("La tienda mantiene precios, controles y contenido utilizables en todas las orientaciones comprobadas");
