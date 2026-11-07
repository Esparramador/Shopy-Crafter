#!/usr/bin/env node
// Cursor de la portada tras cambiar el tamaño de la ventana: con el ratón ya
// activo se redimensiona Inicio (escritorio → ancho intermedio → escritorio
// grande) y se comprueba que punto, anillo y halo siguen al siguiente
// movimiento en la ventana nueva, alineados entre sí, y que no bloquean los
// controles que hay debajo.
//
// Uso: pnpm --filter @workspace/shopify-optimizer run e2e:portada-cursor-resize
// Env: ver e2e/public-e2e-helpers.mjs (E2E_BASE_URL, E2E_CHROMIUM, E2E_CHANNEL).
import { DESKTOP, createChecker, launchBrowser, newContext, openPublic, trackPageErrors } from "./public-e2e-helpers.mjs";
import { moveAndSettle, near, readLayers } from "./cursor-layers.mjs";

const SIZES = [
  { name: "intermedio 1024", width: 1024, height: 720 },
  { name: "intermedio 900", width: 900, height: 700 },
  { name: "escritorio 1440", width: 1440, height: 900 },
];

const { check, finish } = createChecker();
const browser = await launchBrowser();

function checkAligned(tag, layers, x, y) {
  check(layers.dot.visible && near(layers.dot.cx, x) && near(layers.dot.cy, y),
    `${tag} el punto está en el ratón (${Math.round(layers.dot.cx)}, ${Math.round(layers.dot.cy)} → ${x}, ${y})`);
  check(layers.ring.visible && near(layers.ring.cx, x, 3) && near(layers.ring.cy, y, 3),
    `${tag} el anillo alcanza el ratón (${Math.round(layers.ring.cx)}, ${Math.round(layers.ring.cy)})`);
  check(layers.glow.visible && near(layers.glow.cx, x) && near(layers.glow.cy, y),
    `${tag} el halo está centrado en el ratón (${Math.round(layers.glow.cx)}, ${Math.round(layers.glow.cy)})`);
  check([layers.dot, layers.ring, layers.glow].every(l => l.pointerEvents === "none"), `${tag} ninguna capa captura clics`);
}

try {
  const context = await newContext(browser, DESKTOP, { reducedMotion: "no-preference" });
  const page = await context.newPage();
  const errors = trackPageErrors(page);
  await openPublic(page, "/", ".fp-cursor-glow");
  await page.locator(".l-nav-links").waitFor({ state: "visible", timeout: 20_000 });

  // Ratón activo antes de redimensionar.
  let layers = await moveAndSettle(page, 600, 400);
  checkAligned(`[${DESKTOP.width}×${DESKTOP.height}]`, layers, 600, 400);

  for (const size of SIZES) {
    const tag = `[${size.name}]`;
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.waitForTimeout(500);
    layers = await readLayers(page);
    check(layers.viewport.width === size.width, `${tag} la ventana mide ${layers.viewport.width} px`);

    // Siguiente movimiento, en coordenadas de la ventana nueva y cerca de su borde derecho.
    const x = size.width - 120;
    const y = Math.round(size.height * 0.6);
    layers = await moveAndSettle(page, x, y);
    checkAligned(tag, layers, x, y);

    // Lo que hay bajo el ratón es la página, no una capa del cursor.
    const underPointer = await page.evaluate(([px, py]) => {
      const el = document.elementFromPoint(px, py);
      return el ? `${el.tagName.toLowerCase()}.${String(el.className)}` : "";
    }, [x, y]);
    check(!/sc-cursor|fp-cursor-glow/.test(underPointer), `${tag} bajo el ratón está la página (${underPointer.slice(0, 50)})`);

    // Un control real responde con el cursor encima: el enlace «Precios» de la cabecera, si se ve a este ancho,
    // o el botón del menú cuando la cabecera está plegada.
    const pricing = page.locator(".l-nav-links a[href='#fp-pricing']");
    const burger = page.locator(".lxk-burger");
    if (await pricing.isVisible()) {
      const box = await pricing.boundingBox();
      await moveAndSettle(page, box.x + box.width / 2, box.y + box.height / 2, 400);
      const hover = await page.evaluate(() => document.querySelector(".sc-cursor")?.classList.contains("sc-cursor-hover"));
      check(hover, `${tag} el cursor crece sobre el enlace «Precios»`);
      layers = await readLayers(page);
      check(near(layers.dot.cx, box.x + box.width / 2) && near(layers.dot.cy, box.y + box.height / 2),
        `${tag} con el aumento, el punto sigue centrado en el ratón`);
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForFunction(() => Math.abs(document.getElementById("fp-pricing").getBoundingClientRect().top) < 80, null, { timeout: 8_000 }).catch(() => {});
      const top = await page.evaluate(() => document.getElementById("fp-pricing").getBoundingClientRect().top);
      check(Math.abs(top) < 80, `${tag} el clic con el cursor encima lleva a «Precios» (top ${Math.round(top)} px)`);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    } else if (await burger.isVisible()) {
      const box = await burger.boundingBox();
      await moveAndSettle(page, box.x + box.width / 2, box.y + box.height / 2, 400);
      await page.mouse.down();
      await page.mouse.up();
      const expanded = await burger.getAttribute("aria-expanded");
      check(expanded === "true", `${tag} el clic con el cursor encima abre el menú`);
      await burger.click();
    } else {
      check(false, `${tag} hay un control de navegación visible`);
    }
  }

  check(errors.length === 0, `sin errores de JavaScript${errors.length ? ` (${errors.slice(0, 2).join(" | ")})` : ""}`);
  await context.close();
} finally {
  await browser.close();
}

finish("Punto, anillo y halo siguen al ratón tras redimensionar Inicio, sin bloquear controles");
