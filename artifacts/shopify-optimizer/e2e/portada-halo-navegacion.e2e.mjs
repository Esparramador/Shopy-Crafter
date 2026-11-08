#!/usr/bin/env node
// El halo dorado de la portada sigue al ratón en Inicio, desaparece al navegar
// (sin recargar) a otra página pública y vuelve a funcionar al regresar a Inicio.
// También comprueba que la navegación y los controles siguen respondiendo.
//
// Uso: pnpm --filter @workspace/shopify-optimizer run e2e:portada-halo
// Env: ver e2e/public-e2e-helpers.mjs (E2E_BASE_URL, E2E_CHROMIUM, E2E_CHANNEL).
import { DESKTOP, createChecker, launchBrowser, newContext, openPublic, trackPageErrors } from "./public-e2e-helpers.mjs";
import { moveAndSettle, near, readLayers } from "./cursor-layers.mjs";

const { check, finish } = createChecker();
const browser = await launchBrowser();

try {
  const context = await newContext(browser, DESKTOP, { reducedMotion: "no-preference" });
  const page = await context.newPage();
  const errors = trackPageErrors(page);
  await openPublic(page, "/", ".fp-cursor-glow");
  await page.locator(".l-nav-links").waitFor({ state: "visible", timeout: 20_000 });
  // Marca en window: si la página se recargase entera, desaparecería.
  await page.evaluate(() => { window.__e2eSinRecarga = true; });
  const sameDocument = () => page.evaluate(() => window.__e2eSinRecarga === true);

  // 1) En Inicio el halo sigue al ratón.
  let layers = await moveAndSettle(page, 420, 360);
  check(layers.glow.present && layers.glow.visible, "[Inicio] el halo se ve al mover el ratón");
  check(near(layers.glow.cx, 420) && near(layers.glow.cy, 360), `[Inicio] el halo está centrado en el ratón (${Math.round(layers.glow.cx)}, ${Math.round(layers.glow.cy)})`);
  check(layers.glow.pointerEvents === "none", "[Inicio] el halo no captura clics");

  // 2) Navegación SPA a /tienda desde la cabecera: el halo se va con la portada.
  await page.locator("a.lxk-nav-shop").click();
  await page.locator(".shop-nav").waitFor({ state: "visible", timeout: 20_000 });
  layers = await readLayers(page);
  check(layers.path === "/tienda", `[navegación] se llega a la Tienda (${layers.path})`);
  check(await sameDocument(), "[navegación] sin recargar la página (SPA)");
  check(!layers.glow.present || !layers.glow.visible, "[Tienda] el halo de la portada ya no está visible justo al llegar");
  layers = await moveAndSettle(page, 640, 420);
  check(!layers.glow.present || !layers.glow.visible, "[Tienda] mover el ratón no hace reaparecer el halo");
  check(layers.dot.visible && near(layers.dot.cx, 640) && near(layers.dot.cy, 420), "[Tienda] el cursor SC sigue al ratón");

  // 3) Los controles de la página nueva funcionan: el enlace «Inicio» devuelve a la portada.
  await page.locator(".shop-nav-controls a", { hasText: "Inicio" }).click();
  await page.locator(".fp-cursor-glow").waitFor({ state: "attached", timeout: 20_000 });
  await page.locator(".l-nav-links").waitFor({ state: "visible", timeout: 20_000 });
  layers = await readLayers(page);
  check(layers.path === "/", `[regreso] se vuelve a Inicio (${layers.path})`);
  check(await sameDocument(), "[regreso] sin recargar la página (SPA)");
  check(!layers.glow.visible, "[regreso] el halo espera al ratón antes de mostrarse");

  // 4) Al mover el ratón el halo se activa de nuevo y en la posición nueva.
  layers = await moveAndSettle(page, 700, 300);
  check(layers.glow.visible, "[regreso] el halo vuelve a verse al mover el ratón");
  check(near(layers.glow.cx, 700) && near(layers.glow.cy, 300), `[regreso] el halo sigue al ratón (${Math.round(layers.glow.cx)}, ${Math.round(layers.glow.cy)})`);
  check(near(layers.dot.cx, 700) && near(layers.ring.cx, 700, 3), "[regreso] punto y anillo alineados con el halo");

  // 5) Los controles de la portada siguen funcionando: «Precios» lleva a su sección.
  const before = await page.evaluate(() => window.scrollY);
  await page.locator(".l-nav-links a[href='#fp-pricing']").click();
  await page.waitForFunction(() => {
    const r = document.getElementById("fp-pricing")?.getBoundingClientRect();
    return r && Math.abs(r.top) < 80;
  }, null, { timeout: 8_000 }).catch(() => {});
  const pricingTop = await page.evaluate(() => document.getElementById("fp-pricing").getBoundingClientRect().top);
  const after = await page.evaluate(() => window.scrollY);
  check(after > before && Math.abs(pricingTop) < 80, `[controles] «Precios» desplaza a su sección (top ${Math.round(pricingTop)} px)`);

  // 6) Y al salir otra vez con la historia del navegador, el halo tampoco queda.
  for (let i = 0; i < 4 && layers.path === "/"; i++) {
    await page.goBack();
    await page.waitForTimeout(700);
    layers = await readLayers(page);
  }
  check(layers.path === "/tienda", `[historia] «Atrás» del navegador vuelve a la Tienda (${layers.path})`);
  layers = await moveAndSettle(page, 500, 500);
  check(!layers.glow.present || !layers.glow.visible, "[historia] tras «Atrás» no queda halo");

  check(errors.length === 0, `sin errores de JavaScript${errors.length ? ` (${errors.slice(0, 2).join(" | ")})` : ""}`);
  await context.close();
} finally {
  await browser.close();
}

finish("El halo de la portada se apaga al salir de Inicio y vuelve al regresar, con la navegación y los controles intactos");
