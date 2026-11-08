// Lectura de las capas del cursor de la portada para los e2e:
// punto (.sc-cursor), anillo (.sc-cursor-ring) y halo (.fp-cursor-glow).
// El punto y el anillo se colocan con la propiedad CSS `translate` y crecen con
// `scale`; el centro de su caja es la posición que ve el visitante.

export async function readLayers(page) {
  return page.evaluate(() => {
    const layer = selector => {
      const el = document.querySelector(selector);
      if (!el) return { present: false };
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        present: true,
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
        opacity: Number(style.opacity),
        display: style.display,
        pointerEvents: style.pointerEvents,
        visible: style.display !== "none" && Number(style.opacity) > 0.05,
      };
    };
    return {
      dot: layer(".sc-cursor"),
      ring: layer(".sc-cursor-ring"),
      glow: layer(".fp-cursor-glow"),
      cursorOn: document.documentElement.classList.contains("sc-cursor-on"),
      path: location.pathname,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  });
}

/** Mueve el ratón en pasos (eventos pointermove reales) y espera a que el anillo, que va con retardo, llegue. */
export async function moveAndSettle(page, x, y, settleMs = 1200) {
  await page.mouse.move(x, y, { steps: 8 });
  await page.waitForTimeout(settleMs);
  return readLayers(page);
}

export const near = (a, b, tolerance = 2) => Math.abs(a - b) <= tolerance;
