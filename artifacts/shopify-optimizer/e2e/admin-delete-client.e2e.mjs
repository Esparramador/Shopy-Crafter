// E2E: botón "Borrar" de la lista de clientes del panel admin (/admin/clients).
//
// Uso:  pnpm --filter @workspace/shopify-optimizer run e2e:admin-delete-client
// Env:  ADMIN_PASSWORD (obligatoria), E2E_ADMIN_EMAIL, E2E_BASE_URL (por defecto
//       https://$REPLIT_DEV_DOMAIN), E2E_CHROMIUM (por defecto `which chromium`).
//
// Crea dos clientes desechables (@e2e.invalid) vía POST /api/admin/users y verifica:
//   1. La fila del cliente muestra "Borrar"; el modal enseña nombre + email + aviso
//      irreversible; el botón de confirmar está deshabilitado hasta escribir el email.
//   2. Al confirmar, la fila desaparece sin recargar la página y el API devuelve 404.
//   3. Si el usuario ya no existe (borrado por otra vía), el modal muestra el error 404.
//   4. La fila del propio admin no aparece en la tabla (solo se listan clientes).
//   5. Con una suscripción de Stripe activa (fila local sembrada vía psql con un id
//      que NO existe en la cuenta Stripe configurada) el DELETE responde 409, el modal
//      ofrece "Cancelar suscripción y borrar" con enlace al dashboard y pide confirmación
//      extra. Al confirmar, el backend consulta Stripe, recibe resource_missing y FALLA
//      CERRADO: muestra el aviso, no cancela, no borra y el DELETE sigue en 409.
//      (El camino feliz — cancelación confirmada por Stripe — se cubre en
//      api-server/src/lib/subscription-cancel.test.ts; no se ejerce aquí para no tocar
//      facturación real.) Requiere DATABASE_URL + psql; si faltan, se omite con aviso.
import { chromium } from "playwright";
import { nanoid } from "nanoid";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = (process.env.E2E_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`).replace(/\/$/, "");
const EMAIL = process.env.E2E_ADMIN_EMAIL || "craftershopy@gmail.com";
const PASSWORD = process.env.ADMIN_PASSWORD;
const SHOTS = process.env.E2E_SCREENSHOT_DIR || "/tmp/admin-delete-client";

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
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } });
const created = [];

async function createClient(label) {
  const tag = nanoid(8).toLowerCase();
  const data = { email: `e2e-del-${label}-${tag}@e2e.invalid`, name: `E2E Del ${label} ${tag}`, role: "client", password: `E2e-${nanoid(18)}` };
  const r = await ctx.request.post(`${BASE}/api/admin/users`, { data });
  const body = await r.json().catch(() => ({}));
  if (!(r.ok() && body.id)) fail(`No se pudo crear el cliente ${label} → ${r.status()}`);
  const u = { ...data, id: body.id };
  created.push(u);
  return u;
}

try {
  const login = await ctx.request.post(`${BASE}/api/auth/login`, { data: { email: EMAIL, password: PASSWORD } });
  if (!login.ok()) fail(`Login admin ${EMAIL} → ${login.status()}`);
  const me = await (await ctx.request.get(`${BASE}/api/auth/me`)).json().catch(() => ({}));
  const adminId = me?.id ?? me?.user?.id ?? null;

  const target = await createClient("ok");
  const ghost = await createClient("gone");
  const billed = await createClient("sub");
  ok(`Clientes de prueba creados: ${target.email}, ${ghost.email}, ${billed.email}`);

  // 5a. Siembra local de una suscripción "activa" con un id que no existe en Stripe.
  const fakeSubId = `sub_e2e_${nanoid(12)}`;
  let seeded = false;
  if (process.env.DATABASE_URL) {
    try {
      execSync("psql \"$DATABASE_URL\" -v ON_ERROR_STOP=1 -c " + JSON.stringify(
        `INSERT INTO subscriptions (user_id, plan, status, stripe_subscription_id, stores_limit, images_included) VALUES ('${billed.id}', 'starter', 'active', '${fakeSubId}', 3, 45) ON CONFLICT (user_id) DO UPDATE SET plan = EXCLUDED.plan, status = EXCLUDED.status, stripe_subscription_id = EXCLUDED.stripe_subscription_id`
      ), { stdio: "pipe" });
      seeded = true;
      ok(`Suscripción activa sembrada para ${billed.email} (${fakeSubId})`);
    } catch (e) { console.warn(`  ! no se pudo sembrar la suscripción (${String(e.stderr || e.message).trim()}); se omite el escenario 5`); }
  } else console.warn("  ! DATABASE_URL no definido; se omite el escenario 5");

  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  let navigations = 0;
  page.on("framenavigated", (f) => { if (f === page.mainFrame()) navigations++; });

  // El tour de bienvenida (CoachMarks) se muestra en perfiles nuevos y su overlay
  // intercepta los clics; marcarlo como ya visto antes de cargar la app.
  await page.addInitScript(() => localStorage.setItem("shopycrafter_coach_dismissed", "1"));
  await page.goto(`${BASE}/admin/clients`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "#replit-dev-banner{display:none!important}" });
  const row = page.locator("tr", { hasText: target.email });
  await row.waitFor({ state: "visible", timeout: 30000 });
  const navsAfterLoad = navigations;

  // 4. El admin no aparece en la tabla → no hay botón Borrar para él.
  if (adminId) check(await page.locator(`[data-testid="delete-client-btn-${adminId}"]`).count() === 0, "No hay botón Borrar para el usuario admin");
  check(await page.locator("tr", { hasText: EMAIL }).count() === 0, "La fila del admin no se lista entre los clientes");

  // 1. Botón + modal de confirmación.
  const delBtn = page.locator(`[data-testid="delete-client-btn-${target.id}"]`);
  check(await delBtn.isVisible(), "La fila del cliente muestra el botón Borrar");
  await delBtn.click();
  const modal = page.locator('[data-testid="delete-client-modal"]');
  await modal.waitFor({ state: "visible", timeout: 10000 });
  const modalText = await modal.innerText();
  check(modalText.includes(target.name), "El modal muestra el nombre del cliente");
  check(modalText.includes(target.email), "El modal muestra el email del cliente");
  check(/irreversible|no se puede deshacer/i.test(modalText), "El modal avisa de que es irreversible");
  const confirmBtn = modal.locator('[data-testid="delete-client-confirm-btn"]');
  check(await confirmBtn.isDisabled(), "Confirmar está deshabilitado antes de escribir el email");
  const input = modal.locator('[data-testid="delete-client-confirm-input"]');
  await input.fill("otro@correo.com");
  check(await confirmBtn.isDisabled(), "Confirmar sigue deshabilitado con un email incorrecto");
  await input.fill(target.email);
  check(await confirmBtn.isEnabled(), "Confirmar se habilita al escribir el email exacto");
  await page.screenshot({ path: path.join(SHOTS, "01-modal.png") });

  // Cancelar cierra sin borrar.
  await modal.getByRole("button", { name: "Cancelar", exact: true }).click();
  await modal.waitFor({ state: "hidden", timeout: 5000 });
  check(await row.isVisible(), "Cancelar cierra el modal y la fila sigue ahí");
  check((await ctx.request.get(`${BASE}/api/admin/users`)).ok(), "API sigue accesible tras cancelar");

  // 2. Borrado real: la fila desaparece sin recargar.
  await delBtn.click();
  await modal.waitFor({ state: "visible", timeout: 10000 });
  await input.fill(target.email);
  const [delResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/api/admin/users/${target.id}`) && r.request().method() === "DELETE"),
    confirmBtn.click(),
  ]);
  check(delResp.status() === 200, `DELETE devuelve 200 (obtenido ${delResp.status()})`);
  await modal.waitFor({ state: "hidden", timeout: 10000 });
  await row.waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
  check((await row.count()) === 0, "La fila del cliente desaparece del listado");
  check(navigations === navsAfterLoad, "No hubo recarga de página al borrar");
  const users = await (await ctx.request.get(`${BASE}/api/admin/users`)).json();
  check(!users.some((u) => u.id === target.id), "El usuario ya no existe en el API");
  await page.screenshot({ path: path.join(SHOTS, "02-after-delete.png") });

  // 3. Error del API visible: borrar el segundo por API y luego intentarlo desde la UI.
  const ghostRow = page.locator("tr", { hasText: ghost.email });
  check(await ghostRow.isVisible(), "El segundo cliente sigue listado");
  const preDel = await ctx.request.delete(`${BASE}/api/admin/users/${ghost.id}`);
  check(preDel.ok(), "Segundo cliente borrado por API (fuera de la UI)");
  await page.locator(`[data-testid="delete-client-btn-${ghost.id}"]`).click();
  await modal.waitFor({ state: "visible", timeout: 10000 });
  await modal.locator('[data-testid="delete-client-confirm-input"]').fill(ghost.email);
  await modal.locator('[data-testid="delete-client-confirm-btn"]').click();
  const errBox = modal.locator('[data-testid="delete-client-error"]');
  await errBox.waitFor({ state: "visible", timeout: 10000 });
  const errText = await errBox.innerText();
  check(/no encontrado/i.test(errText), `El modal muestra el error 404 del API ("${errText.trim()}")`);
  check(await modal.isVisible(), "El modal permanece abierto tras el error");
  await page.screenshot({ path: path.join(SHOTS, "03-error-404.png") });
  await modal.getByRole("button", { name: "Cancelar", exact: true }).click();

  // 5. Cliente con suscripción Stripe activa → cancelar desde el propio aviso y borrar.
  if (seeded) {
    const preDel = await ctx.request.delete(`${BASE}/api/admin/users/${billed.id}`);
    const preBody = await preDel.json().catch(() => ({}));
    check(preDel.status() === 409 && preBody?.subscription?.stripeSubscriptionId === fakeSubId, `DELETE por API devuelve 409 con la suscripción (obtenido ${preDel.status()})`);
    check(typeof preBody?.subscription?.stripeDashboardUrl === "string" && preBody.subscription.stripeDashboardUrl.includes(fakeSubId), "El 409 incluye stripeDashboardUrl");

    const billedRow = page.locator("tr", { hasText: billed.email });
    check(await billedRow.isVisible(), "El cliente con suscripción sigue listado");
    await page.locator(`[data-testid="delete-client-btn-${billed.id}"]`).click();
    await modal.waitFor({ state: "visible", timeout: 10000 });
    await modal.locator('[data-testid="delete-client-confirm-input"]').fill(billed.email);
    await modal.locator('[data-testid="delete-client-confirm-btn"]').click();
    const subBlock = modal.locator('[data-testid="delete-client-subscription-block"]');
    await subBlock.waitFor({ state: "visible", timeout: 10000 });
    const subText = await subBlock.innerText();
    check(/starter/.test(subText) && /active/.test(subText), "El aviso muestra plan y estado de la suscripción");
    const link = subBlock.locator('[data-testid="delete-client-stripe-link"]');
    check((await link.getAttribute("href") || "").includes(`dashboard.stripe.com`) && (await link.getAttribute("href") || "").includes(fakeSubId), "Hay enlace directo a la suscripción en el dashboard de Stripe");
    check(await modal.locator('[data-testid="delete-client-confirm-btn"]').isDisabled(), "Borrar definitivamente queda deshabilitado mientras la suscripción bloquea");
    check((await modal.locator('[data-testid="delete-client-error"]').count()) === 0, "El 409 no se muestra como error genérico");
    await page.screenshot({ path: path.join(SHOTS, "04-sub-block.png") });

    const cancelBtn = subBlock.locator('[data-testid="delete-client-cancel-sub-btn"]');
    check(await cancelBtn.isVisible(), 'Se ofrece el botón "Cancelar suscripción y borrar"');
    await cancelBtn.click();
    const confirmBox = subBlock.locator('[data-testid="delete-client-cancel-sub-confirm"]');
    await confirmBox.waitFor({ state: "visible", timeout: 5000 });
    check(/facturaci/i.test(await confirmBox.innerText()), "Pide confirmación explícita mencionando la facturación");
    // Volver atrás no cancela nada.
    await confirmBox.locator('[data-testid="delete-client-cancel-sub-back-btn"]').click();
    await confirmBox.waitFor({ state: "hidden", timeout: 5000 });
    const stillThere = await ctx.request.delete(`${BASE}/api/admin/users/${billed.id}`);
    check(stillThere.status() === 409, "Volver no toca la suscripción (DELETE sigue en 409)");
    await page.screenshot({ path: path.join(SHOTS, "05-sub-confirm.png") });

    // Confirmar: Stripe no conoce el id → el backend falla cerrado (409), nada se cancela ni se borra.
    await cancelBtn.click();
    await confirmBox.waitFor({ state: "visible", timeout: 5000 });
    let deleteRetried = false;
    const onReq = (r) => { if (r.method() === "DELETE" && r.url().endsWith(`/api/admin/users/${billed.id}`)) deleteRetried = true; };
    page.on("request", onReq);
    const [cancelResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/api/admin/users/${billed.id}/cancel-subscription`) && r.request().method() === "POST"),
      confirmBox.locator('[data-testid="delete-client-cancel-sub-confirm-btn"]').click(),
    ]);
    const cancelBody = await cancelResp.json().catch(() => ({}));
    check(cancelResp.status() === 409, `POST cancel-subscription falla cerrado con 409 al no encontrar la suscripción en Stripe (obtenido ${cancelResp.status()})`);
    check(typeof cancelBody?.stripeDashboardUrl === "string" && cancelBody.stripeDashboardUrl.includes(fakeSubId), "La respuesta de error incluye el enlace al dashboard de Stripe");
    const cancelErr = modal.locator('[data-testid="delete-client-error"]');
    await cancelErr.waitFor({ state: "visible", timeout: 10000 });
    const cancelErrText = await cancelErr.innerText();
    check(/dashboard de Stripe/i.test(cancelErrText) && /no se marca como cancelada/i.test(cancelErrText), `El modal explica que no se ha cancelado y remite al dashboard ("${cancelErrText.trim().slice(0, 80)}…")`);
    await page.waitForTimeout(1000);
    page.off("request", onReq);
    check(!deleteRetried, "No se reintenta el DELETE cuando la cancelación no se ha confirmado");
    check(await modal.isVisible(), "El modal permanece abierto tras el fallo");
    check(await modal.locator('[data-testid="delete-client-confirm-btn"]').isDisabled(), "Borrar definitivamente sigue deshabilitado");
    const afterFail = await ctx.request.delete(`${BASE}/api/admin/users/${billed.id}`);
    check(afterFail.status() === 409, `La fila local sigue bloqueando el borrado (DELETE ${afterFail.status()})`);
    const subRow = execSync("psql \"$DATABASE_URL\" -tA -c " + JSON.stringify(`SELECT status FROM subscriptions WHERE user_id = '${billed.id}'`), { encoding: "utf8" }).trim();
    check(subRow === "active", `La suscripción local sigue en "active" (obtenido "${subRow}")`);
    await page.screenshot({ path: path.join(SHOTS, "06-sub-fail-closed.png") });
    await modal.getByRole("button", { name: "Cancelar", exact: true }).click();
    const users2 = await (await ctx.request.get(`${BASE}/api/admin/users`)).json();
    check(users2.some((u) => u.id === billed.id), "El usuario con suscripción sigue existiendo en el API");
  }

  check(errors.length === 0, `Sin errores JS en la página${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} finally {
  // Si el escenario 5 quedó a medias, la fila de suscripción sembrada bloquearía la limpieza.
  if (process.env.DATABASE_URL) {
    try { execSync("psql \"$DATABASE_URL\" -c " + JSON.stringify(`DELETE FROM subscriptions WHERE stripe_subscription_id LIKE 'sub_e2e_%'`), { stdio: "pipe" }); } catch {}
  }
  // Limpieza: cualquier usuario de prueba que quede.
  for (const u of created) {
    const r = await ctx.request.delete(`${BASE}/api/admin/users/${u.id}`).catch(() => null);
    if (r && !r.ok() && r.status() !== 404) console.warn(`  ! no se pudo limpiar ${u.email} → ${r.status()}`);
  }
  await browser.close();
}

if (failures.length) { console.error(`\n${failures.length} comprobación(es) fallida(s)`); process.exit(1); }
console.log(`\nTodo OK — capturas en ${SHOTS}`);
