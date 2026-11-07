// Utilidades compartidas por los e2e de la web pública.
//
// Env: E2E_BASE_URL (por defecto https://$REPLIT_DEV_DOMAIN),
//      E2E_CHROMIUM (ruta del navegador; por defecto `which chromium`),
//      E2E_CHANNEL (p. ej. "chrome" para usar el Chrome instalado en un Mac).
import { chromium } from "playwright";
import { execSync } from "node:child_process";

export const BASE = (process.env.E2E_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`).replace(/\/$/, "");

export const DESKTOP = { name: "escritorio", width: 1280, height: 800, isMobile: false };
export const MOBILE = { name: "móvil", width: 390, height: 844, isMobile: true };

export function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!BASE || BASE === "https://undefined") {
  fail("Define E2E_BASE_URL o REPLIT_DEV_DOMAIN para indicar el servidor web");
}

function chromiumPath() {
  if (process.env.E2E_CHROMIUM) return process.env.E2E_CHROMIUM;
  if (process.env.E2E_CHANNEL) return undefined;
  try { return execSync("which chromium", { encoding: "utf8" }).trim() || undefined; } catch { return undefined; }
}

export function launchBrowser() {
  return chromium.launch({
    executablePath: chromiumPath(),
    channel: process.env.E2E_CHROMIUM ? undefined : process.env.E2E_CHANNEL,
    headless: true,
    args: ["--no-sandbox"],
  });
}

/** Contexto con el tamaño pedido; en móvil, táctil como un teléfono real. */
export function newContext(browser, viewport, extra = {}) {
  return browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.isMobile,
    ...extra,
  });
}

/** Registro de comprobaciones: imprime cada una y acumula las fallidas. */
export function createChecker() {
  const failures = [];
  const check = (condition, message) => {
    if (condition) console.log(`✓ ${message}`);
    else {
      console.error(`✗ ${message}`);
      failures.push(message);
    }
  };
  const finish = (okMessage) => {
    if (failures.length) {
      console.error(`\n✗ ${failures.length} comprobación(es) fallida(s)`);
      process.exit(1);
    }
    console.log(`\n✓ ${okMessage}`);
  };
  return { check, finish, failures };
}

/**
 * Las páginas públicas mantienen abierta la conexión del CMS: nunca se espera
 * a `networkidle`, sino a un elemento real ya pintado.
 */
export async function openPublic(page, path, readySelector = "footer") {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator(readySelector).first().waitFor({ state: "attached", timeout: 25_000 });
}

// El cliente HMR de Vite apunta al puerto 443 de Replit (vite.config.ts); fuera
// de Replit su WebSocket no abre y lo avisa como error. No es de la página.
const DEV_NOISE = [/WebSocket closed without opened/];

/** Errores de JavaScript de la página (no cuenta el stream del CMS ni el HMR de Vite). */
export function trackPageErrors(page) {
  const errors = [];
  page.on("pageerror", error => {
    const text = String(error);
    if (!DEV_NOISE.some(re => re.test(text))) errors.push(text);
  });
  return errors;
}

/** Desplazamiento inmediato: las páginas usan `scroll-behavior: smooth`. */
export function scrollToInstant(page, y) {
  return page.evaluate(top => window.scrollTo({ top: top === "end" ? document.scrollingElement.scrollHeight : top, behavior: "instant" }), y);
}
