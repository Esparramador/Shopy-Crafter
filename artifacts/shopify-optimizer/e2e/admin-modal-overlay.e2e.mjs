// E2E: los widgets flotantes del admin (panel Setup, botón de voz, FAB del
// asistente) no tapan los modales del panel admin. Cubre varias páginas (ver
// PAGES): /admin/clients ("Invitar"), /admin/group-chat ("Nuevo grupo"),
// /admin/tienda ("Crear plan"), /admin/calendar ("Nueva Cita") y la página de
// proyecto /projects/:id/audit ("Crear Producto"). Todas usan
// .modal-overlay/<ModalOverlay> y el hook useModalLock.
//
// Uso:  pnpm --filter @workspace/shopify-optimizer run e2e:admin-modal-overlay
// Env:  ADMIN_PASSWORD (obligatoria), E2E_ADMIN_EMAIL, E2E_BASE_URL (por defecto
//       https://$REPLIT_DEV_DOMAIN), E2E_CHROMIUM (por defecto `which chromium`).
//
// Comprueba, por página, en escritorio (1280px) y móvil (375px):
//   1. Sin modal, hay widgets flotantes (.floating-widget) visibles.
//   2. Con el modal abierto, <body> lleva data-modal-open, todos los
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

// Páginas admin cubiertas: ruta + texto del botón que abre un modal.
const PAGES = [
  { id: "clients", path: "/admin/clients", open: "Invitar" },
  { id: "group-chat", path: "/admin/group-chat", open: "Nuevo grupo" },
  { id: "tienda", path: "/admin/tienda", open: "Crear plan", tab: "Planes" },
  { id: "calendar", path: "/admin/calendar", open: "Nueva Cita" },
  // Página de proyecto (RequireAdmin): ":id" se sustituye por el primer proyecto del admin.
  { id: "project-audit", path: "/projects/:id/audit", open: "Crear Producto" },
];
const ONLY = process.env.E2E_PAGES ? process.env.E2E_PAGES.split(",").map(s => s.trim()) : null;
const pagesToRun = ONLY ? PAGES.filter(p => ONLY.includes(p.id)) : PAGES;
if (!pagesToRun.length) fail(`E2E_PAGES no coincide con ninguna página (${PAGES.map(p => p.id).join(", ")})`);

async function widgetState(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll(".floating-widget")).map(el => {
    const cs = getComputedStyle(el);
    return { visibility: cs.visibility, pointerEvents: cs.pointerEvents, z: cs.zIndex };
  }));
}

async function runViewport(spec, vpLabel, viewport) {
  const label = `${spec.id}/${vpLabel}`;
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport });
  const login = await ctx.request.post(`${BASE}/api/auth/login`, { data: { email: EMAIL, password: PASSWORD } });
  if (!login.ok()) fail(`Login admin ${EMAIL} → ${login.status()}`);
  let pagePath = spec.path;
  if (pagePath.includes(":id")) {
    const res = await ctx.request.get(`${BASE}/api/projects`);
    const projects = res.ok() ? await res.json() : [];
    if (!Array.isArray(projects) || !projects.length) fail(`[${label}] no hay proyectos para resolver ${spec.path}`);
    pagePath = pagePath.replace(":id", String(projects[0].id));
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem("shopycrafter_coach_dismissed", "1"));
  await page.goto(`${BASE}${pagePath}`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "#replit-dev-banner{display:none!important}" });
  if (spec.tab) {
    const tabBtn = page.locator("button", { hasText: spec.tab }).first();
    await tabBtn.waitFor({ state: "visible", timeout: 30000 });
    await tabBtn.click();
  }
  const inviteBtn = page.locator("button", { hasText: spec.open }).first();
  await inviteBtn.waitFor({ state: "visible", timeout: 30000 });
  await page.waitForTimeout(1500); // widgets flotantes cargan su estado por API

  // 1. Sin modal: hay widgets visibles.
  const before = await widgetState(page);
  check(before.length > 0, `[${label}] hay ${before.length} widgets flotantes en la página`);
  check(before.every(w => w.visibility === "visible"), `[${label}] sin modal, los widgets flotantes están visibles`);
  check(await page.evaluate(() => !document.body.hasAttribute("data-modal-open")), `[${label}] sin modal, <body> no lleva data-modal-open`);
  await page.screenshot({ path: path.join(SHOTS, `${spec.id}-${vpLabel}-before.png`) });

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
  // Solo se comprueban los botones cuyo centro cae dentro del viewport: en móvil
  // los formularios largos hacen scroll dentro del modal y el resto queda fuera.
  const buttons = overlay.locator("button");
  const nBtn = await buttons.count();
  let covered = 0, tested = 0;
  for (let i = 0; i < nBtn; i++) {
    const b = buttons.nth(i);
    const box = await b.boundingBox();
    if (!box) continue;
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    if (cx < 0 || cy < 0 || cx > viewport.width || cy > viewport.height) continue;
    tested++;
    const insideModal = await page.evaluate(({ x, y }) => {
      const top = document.elementFromPoint(x, y);
      return !!top && !!top.closest(".modal-overlay");
    }, { x: cx, y: cy });
    if (!insideModal) covered++;
  }
  check(tested > 0 && covered === 0, `[${label}] ninguno de los ${tested} botones visibles del modal está tapado por otro elemento`);
  await page.screenshot({ path: path.join(SHOTS, `${spec.id}-${vpLabel}-modal.png`) });

  // 3. Al cerrar, vuelven.
  await page.keyboard.press("Escape").catch(() => {});
  const stillOpen = () => overlay.isVisible().catch(() => false);
  if (await stillOpen()) {
    const closeBtn = overlay.locator("button", { hasText: /cancelar|cerrar|^[✕×]$/i }).first();
    if (await closeBtn.count()) await closeBtn.click().catch(() => {});
  }
  if (await stillOpen()) {
    const iconClose = overlay.locator("button:has(svg.lucide-x), button[aria-label*='errar' i], button[aria-label*='close' i]").first();
    if (await iconClose.count()) await iconClose.click().catch(() => {});
  }
  if (await stillOpen()) {
    // Último recurso: clic en el fondo del overlay (cierre por e.target === e.currentTarget).
    await overlay.click({ position: { x: 4, y: 60 } }).catch(() => {});
  }
  await overlay.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
  const after = await widgetState(page);
  check(await page.evaluate(() => !document.body.hasAttribute("data-modal-open")), `[${label}] tras cerrar, <body> ya no lleva data-modal-open`);
  check(after.every(w => w.visibility === "visible"), `[${label}] tras cerrar, los widgets flotantes vuelven a verse`);
  check(errors.length === 0, `[${label}] sin errores JS en la página${errors.length ? ` → ${errors[0]}` : ""}`);
  await ctx.close();
}

try {
  for (const spec of pagesToRun) {
    await runViewport(spec, "desktop", { width: 1280, height: 800 });
    await runViewport(spec, "mobile", { width: 375, height: 740 });
  }
} finally {
  await browser.close();
}
if (failures.length) { console.error(`\n${failures.length} comprobaciones fallidas. Capturas en ${SHOTS}`); process.exit(1); }
console.log(`\nTODO OK. Capturas en ${SHOTS}`);
