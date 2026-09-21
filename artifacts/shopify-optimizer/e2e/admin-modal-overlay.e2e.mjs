// E2E: los widgets flotantes del admin (panel Setup, botón de voz, FAB del
// asistente) no tapan los modales de /admin/clients.
//
// Uso:  pnpm --filter @workspace/shopify-optimizer run e2e:admin-modal-overlay
// Env:  ADMIN_PASSWORD (obligatoria), E2E_ADMIN_EMAIL, E2E_BASE_URL (por defecto
//       https://$REPLIT_DEV_DOMAIN), E2E_CHROMIUM (por defecto `which chromium`).
//
// Comprueba, en escritorio (1280px) y móvil (375px):
//   1. Sin modal, hay widgets flotantes (.floating-widget) visibles.
//   2. Con el modal "Invitar" abierto, <body> lleva data-modal-open, todos los
//      .floating-widget quedan ocultos (visibility hidden) y el punto central de
//      los botones del modal responde al propio modal (nada lo tapa).
//   3. Al cerrar el modal los widgets vuelven a verse.
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = (process.env.E2E_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`).replace(/\/$/, "");
const EMAIL = process.env.E2E_ADMIN_EMAIL || "craftershopy@gmail.com";
const PASSWORD = process.env.ADMIN_PASSWORD;
const SHOTS = process.env.E2E_SCREENSHOT_DIR || "/tmp/admin-modal-overlay";
if (!PASSWORD) fail("ADMIN_PASSWORD no está definido en el entorno");
mkdirSync(SHOTS, { recursive: true });

function fail(msg) { console.error(`✗ ${msg}`); process.exit(1); }
function ok(msg) { console.log(`✓ ${msg}`); }
const failures = [];
function check(cond, msg) { if (cond) ok(msg); else { console.error(`✗ ${msg}`); failures.push(msg); } }
function chromiumPath() {
  if (process.env.E2E_CHROMIUM) return process.env.E2E_CHROMIUM;
  try { return execSync("which chromium", { encoding: "utf8" }).trim(); } catch { return undefined; }
}

const browser = await chromium.launch({ executablePath: chromiumPath(), headless: true, args: ["--no-sandbox"] });

async function widgetState(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll(".floating-widget")).map(el => {
    const cs = getComputedStyle(el);
    return { visibility: cs.visibility, pointerEvents: cs.pointerEvents, z: cs.zIndex };
  }));
}

async function runViewport(label, viewport) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport });
  const login = await ctx.request.post(`${BASE}/api/auth/login`, { data: { email: EMAIL, password: PASSWORD } });
  if (!login.ok()) fail(`Login admin ${EMAIL} → ${login.status()}`);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem("shopycrafter_coach_dismissed", "1"));
  await page.goto(`${BASE}/admin/clients`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "#replit-dev-banner{display:none!important}" });
  const inviteBtn = page.locator("button", { hasText: "Invitar" }).first();
  await inviteBtn.waitFor({ state: "visible", timeout: 30000 });
  await page.waitForTimeout(1500); // widgets flotantes cargan su estado por API

  // 1. Sin modal: hay widgets visibles.
  const before = await widgetState(page);
  check(before.length > 0, `[${label}] hay ${before.length} widgets flotantes en la página`);
  check(before.every(w => w.visibility === "visible"), `[${label}] sin modal, los widgets flotantes están visibles`);
  check(await page.evaluate(() => !document.body.hasAttribute("data-modal-open")), `[${label}] sin modal, <body> no lleva data-modal-open`);
  await page.screenshot({ path: path.join(SHOTS, `${label}-before.png`) });

  // 2. Con modal abierto: widgets ocultos y nada tapa los botones del modal.
  await inviteBtn.click();
  const overlay = page.locator(".modal-overlay").first();
  await overlay.waitFor({ state: "visible", timeout: 10000 });
  await page.waitForTimeout(300);
  const during = await widgetState(page);
  check(await page.evaluate(() => document.body.getAttribute("data-modal-open") === "true"), `[${label}] con modal, <body> lleva data-modal-open`);
  check(during.length > 0 && during.every(w => w.visibility === "hidden" && w.pointerEvents === "none"), `[${label}] con modal, todos los widgets flotantes quedan ocultos y sin pointer-events`);
  const overlayZ = await overlay.evaluate(el => getComputedStyle(el).zIndex);
  check(overlayZ === "1000", `[${label}] el overlay usa .modal-overlay (z-index 1000, no inline 500)`);
  const buttons = overlay.locator("button");
  const nBtn = await buttons.count();
  let covered = 0;
  for (let i = 0; i < nBtn; i++) {
    const b = buttons.nth(i);
    const box = await b.boundingBox();
    if (!box) continue;
    const insideModal = await page.evaluate(({ x, y }) => {
      const top = document.elementFromPoint(x, y);
      return !!top && !!top.closest(".modal-overlay");
    }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    if (!insideModal) covered++;
  }
  check(nBtn > 0 && covered === 0, `[${label}] ninguno de los ${nBtn} botones del modal está tapado por otro elemento`);
  await page.screenshot({ path: path.join(SHOTS, `${label}-modal.png`) });

  // 3. Al cerrar, vuelven.
  await page.keyboard.press("Escape").catch(() => {});
  const closeBtn = overlay.locator("button", { hasText: /cancelar|cerrar/i }).first();
  if (await overlay.isVisible().catch(() => false) && await closeBtn.count()) await closeBtn.click();
  await overlay.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
  const after = await widgetState(page);
  check(await page.evaluate(() => !document.body.hasAttribute("data-modal-open")), `[${label}] tras cerrar, <body> ya no lleva data-modal-open`);
  check(after.every(w => w.visibility === "visible"), `[${label}] tras cerrar, los widgets flotantes vuelven a verse`);
  check(errors.length === 0, `[${label}] sin errores JS en la página${errors.length ? ` → ${errors[0]}` : ""}`);
  await ctx.close();
}

try {
  await runViewport("desktop", { width: 1280, height: 800 });
  await runViewport("mobile", { width: 375, height: 740 });
} finally {
  await browser.close();
}
if (failures.length) { console.error(`\n${failures.length} comprobaciones fallidas. Capturas en ${SHOTS}`); process.exit(1); }
console.log(`\nTODO OK. Capturas en ${SHOTS}`);
