// Medidas de layout compartidas por los E2E (getBoundingClientRect real, no capturas).
// Usadas por client-chatbot-layout.e2e.mjs y por el modo móvil de convai-voice-call.e2e.mjs.

/** Rectángulo de un locator de Playwright en coordenadas del viewport. */
export const rectOf = (loc) => loc.evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
});

/** `inner` cabe entero dentro de `outer` (con tolerancia de medio píxel). */
export const inside = (inner, outer, tol = 0.5) =>
  inner.x >= outer.x - tol && inner.y >= outer.y - tol && inner.right <= outer.right + tol && inner.bottom <= outer.bottom + tol;

/** Dos rectángulos se solapan. */
export const overlap = (a, b) => a.x < b.right - 0.5 && b.x < a.right - 0.5 && a.y < b.bottom - 0.5 && b.y < a.bottom - 0.5;

/** Rectángulo del viewport actual de la página. */
export const viewportRect = (page) => {
  const vp = page.viewportSize();
  return { x: 0, y: 0, w: vp.width, h: vp.height, right: vp.width, bottom: vp.height };
};

/** Parsea "375x812" → { width, height } (o null si no es válido). */
export function parseViewport(value) {
  const m = /^(\d{2,4})x(\d{2,4})$/.exec(String(value || "").trim());
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}
