#!/usr/bin/env node
// Recorre las páginas públicas en escritorio y móvil y comprueba que cada una
// tiene exactamente un pie, después de su contenido principal, en el flujo
// normal del documento (ni fijo ni sticky) y sin taparlo.
//
// Uso: pnpm --filter @workspace/shopify-optimizer run e2e:public-footers
// Env: ver e2e/public-e2e-helpers.mjs (E2E_BASE_URL, E2E_CHROMIUM, E2E_CHANNEL).
import { DESKTOP, MOBILE, createChecker, launchBrowser, newContext, openPublic, scrollToInstant, trackPageErrors } from "./public-e2e-helpers.mjs";

// Rutas públicas fijas de App.tsx (las de detalle con :slug dependen del CMS).
const ROUTES = [
  "/",
  "/sobre-nosotros",
  "/casos-de-exito",
  "/programa-de-afiliados",
  "/faq",
  "/preguntas-frecuentes",
  "/blog",
  "/changelog",
  "/privacidad",
  "/terminos",
  "/cookies",
  "/contacto",
  "/shopify-vs-woocommerce",
  "/shopify-vs-prestashop",
  "/migrar-woocommerce-shopify",
  "/migrar-prestashop-shopify",
  "/shopify-stripe-pagos",
  "/agencia-shopify-ia",
  "/ecommerce-ia-automatizacion",
  "/automatizacion-shopify-ia",
  "/automatizacion-woocommerce-ia",
  "/automatizacion-prestashop-ia",
  "/gestion-stripe-ia",
  "/diseno-web-profesional",
  "/desarrollo-apps-nativas",
  "/tienda",
  "/tienda/carrito",
  ...(process.env.E2E_EXTRA_ROUTES || "").split(",").map(r => r.trim()).filter(Boolean),
];

const { check, finish } = createChecker();
const browser = await launchBrowser();

try {
  for (const viewport of [DESKTOP, MOBILE]) {
    const context = await newContext(browser, viewport);
    for (const route of ROUTES) {
      const tag = `[${viewport.name} ${route}]`;
      const page = await context.newPage();
      const pageErrors = trackPageErrors(page);
      try {
        await openPublic(page, route);
      } catch (error) {
        check(false, `${tag} la página pinta un pie (${String(error).split("\n")[0]})`);
        await page.close();
        continue;
      }
      // Deja que las rutas perezosas terminen de montar antes de contar.
      await page.waitForTimeout(400);

      const report = await page.evaluate(() => {
        const footers = [...document.querySelectorAll("footer")];
        const extraContentinfo = [...document.querySelectorAll("[role='contentinfo']")].filter(el => el.tagName !== "FOOTER");
        const result = { count: footers.length, extraContentinfo: extraContentinfo.length };
        if (footers.length !== 1) return result;
        const footer = footers[0];
        // Contenido principal: <main> en las páginas con marco común; la portada usa #fullpage.
        const content = document.querySelector("main") || document.getElementById("fullpage");
        const style = getComputedStyle(footer);
        let fixedAncestor = null;
        for (let el = footer; el && el !== document.documentElement; el = el.parentElement) {
          const pos = getComputedStyle(el).position;
          if (pos === "fixed" || pos === "sticky") { fixedAncestor = `${el.tagName.toLowerCase()}.${el.className} (${pos})`; break; }
        }
        const measure = () => {
          const f = footer.getBoundingClientRect();
          const c = content.getBoundingClientRect();
          return {
            footerTop: f.top, footerBottom: f.bottom, footerHeight: f.height,
            contentBottom: c.bottom,
            overlap: c.left < f.right && f.left < c.right && c.top < f.bottom && f.top < c.bottom && Math.min(c.bottom, f.bottom) - Math.max(c.top, f.top) > 1,
          };
        };
        window.scrollTo({ top: 0, behavior: "instant" });
        const atTop = measure();
        return {
          ...result,
          hasContent: Boolean(content),
          contentContainsFooter: Boolean(content?.contains(footer)),
          after: Boolean(content && (content.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING)),
          display: style.display, visibility: style.visibility, opacity: Number(style.opacity),
          fixedAncestor,
          atTop,
          viewportHeight: window.innerHeight,
        };
      });

      check(report.count === 1, `${tag} aparece exactamente un pie (encontrados ${report.count})`);
      check(report.extraContentinfo === 0, `${tag} no hay otro bloque contentinfo además del pie`);
      if (report.count !== 1) { await page.close(); continue; }

      check(report.hasContent && !report.contentContainsFooter && report.after, `${tag} el pie va después del contenido principal`);
      check(report.display !== "none" && report.visibility !== "hidden" && report.opacity > 0.5 && report.atTop.footerHeight > 40,
        `${tag} el pie es visible (display ${report.display}, alto ${Math.round(report.atTop.footerHeight)} px)`);
      check(!report.fixedAncestor, `${tag} el pie no es fijo ni sticky${report.fixedAncestor ? ` (${report.fixedAncestor})` : ""}`);
      check(report.atTop.footerTop >= report.atTop.contentBottom - 1 && !report.atTop.overlap,
        `${tag} al cargar, el pie empieza tras el contenido (pie ${Math.round(report.atTop.footerTop)} ≥ contenido ${Math.round(report.atTop.contentBottom)})`);

      // Al final de la página el pie es lo último y nada lo tapa.
      await scrollToInstant(page, "end");
      await page.waitForTimeout(250);
      const bottom = await page.evaluate(() => {
        const footer = document.querySelector("footer");
        const content = document.querySelector("main") || document.getElementById("fullpage");
        const f = footer.getBoundingClientRect();
        const c = content.getBoundingClientRect();
        const pageBottom = document.scrollingElement.scrollHeight - window.scrollY;
        const link = footer.querySelector("a[href]");
        let linkHit = true, linkHitBy = "";
        if (link) {
          link.scrollIntoView({ block: "center", behavior: "instant" });
          // Primera línea del enlace: si el texto salta de línea, el centro de la caja cae entre líneas.
          const r = link.getClientRects()[0] || link.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + Math.min(8, r.width / 2), r.top + r.height / 2);
          linkHit = Boolean(hit && (link === hit || link.contains(hit)));
          if (!linkHit) linkHitBy = hit ? `${hit.tagName.toLowerCase()}.${String(hit.className).slice(0, 40)}` : "nada";
        }
        return {
          footerTop: f.top, footerBottom: f.bottom, contentBottom: c.bottom,
          viewportHeight: window.innerHeight,
          pageBottom,
          linkHit, linkHitBy,
        };
      });
      check(bottom.footerTop >= bottom.contentBottom - 1, `${tag} al final, el pie sigue por debajo del contenido`);
      check(Math.abs(bottom.footerBottom - bottom.pageBottom) <= 2, `${tag} el pie cierra la página (borde inferior ${Math.round(bottom.footerBottom)} / fin ${Math.round(bottom.pageBottom)})`);
      check(bottom.linkHit, `${tag} el primer enlace del pie recibe el clic (nada encima)${bottom.linkHit ? "" : ` — encima: ${bottom.linkHitBy}`}`);
      check(pageErrors.length === 0, `${tag} sin errores de JavaScript${pageErrors.length ? ` (${pageErrors.slice(0, 2).join(" | ")})` : ""}`);
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
}

finish(`Las ${ROUTES.length} páginas públicas tienen un único pie, tras su contenido y en el flujo normal, en escritorio y móvil`);
