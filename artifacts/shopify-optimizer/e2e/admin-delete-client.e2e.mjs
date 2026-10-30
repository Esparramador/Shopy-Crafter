// E2E: botón "Borrar" de la lista de clientes del panel admin (/admin/clients).
//
// Uso:  pnpm --filter @workspace/shopify-optimizer run e2e:admin-delete-client
// Env:  ADMIN_PASSWORD (obligatoria), E2E_ADMIN_EMAIL, E2E_BASE_URL (por defecto
//       https://$REPLIT_DEV_DOMAIN), E2E_CHROMIUM (por defecto `which chromium`).
//       E2E_STRIPE_SECRET_KEY (opcional; sk_test_ disponible también para el API Server).
//
// Crea clientes desechables (@e2e.invalid) vía POST /api/admin/users y verifica:
//   1. La fila del cliente muestra "Borrar"; el modal enseña nombre + email + aviso
//      irreversible; el botón de confirmar está deshabilitado hasta escribir el email.
//   2. Al confirmar, la fila desaparece sin recargar la página y el API devuelve 404.
//   3. Si el usuario ya no existe (borrado por otra vía), el modal muestra el error 404.
//   4. La fila del propio admin no aparece en la tabla (solo se listan clientes).
//   5. Con una suscripción de Stripe activa (fila local sembrada vía psql con un id
//      que NO existe en la cuenta Stripe configurada) el DELETE responde 409, el modal
//      ofrece "Cancelar suscripción…" con enlace al dashboard y, al pulsarlo, dos opciones:
//      "Cancelar ahora y borrar" y "Cancelar al final del periodo y revocar acceso".
//      Con cualquiera de las dos el backend consulta Stripe, recibe resource_missing y FALLA
//      CERRADO: muestra el aviso, no cancela, no desactiva, no borra y el DELETE sigue en 409.
//   6. Un cliente con cancel_at_period_end=1 + current_period_end (sembrado) muestra la fecha.
//   7. Con E2E_STRIPE_SECRET_KEY crea una suscripción pagada de test, la cancela al final
//      del periodo desde el panel, y compara la respuesta, DB, lista y cancel_at de Stripe.
//      Requiere DATABASE_URL + psql.
import { chromium } from "playwright";
import { nanoid } from "nanoid";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = (process.env.E2E_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`).replace(/\/$/, "");
const EMAIL = process.env.E2E_ADMIN_EMAIL || "craftershopy@gmail.com";
const PASSWORD = process.env.ADMIN_PASSWORD;
const SHOTS = process.env.E2E_SCREENSHOT_DIR || "/tmp/admin-delete-client";
const TEST_STRIPE_SECRET = process.env.E2E_STRIPE_SECRET_KEY?.trim();

if (!PASSWORD) fail("ADMIN_PASSWORD no está definido en el entorno");
if (TEST_STRIPE_SECRET && !TEST_STRIPE_SECRET.startsWith("sk_test_")) {
  fail("E2E_STRIPE_SECRET_KEY debe empezar por sk_test_; no se usará una clave de producción");
}
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
let stripeTestCustomerId = null;
let stripeTestSubscriptionId = null;
let stripeTestUserId = null;
let stripeTestSubscriptionLinkedLocally = false;

async function stripeTestRequest(method, resource, values = {}) {
  const response = await fetch(`https://api.stripe.com/v1/${resource}`, {
    method,
    headers: {
      Authorization: `Bearer ${TEST_STRIPE_SECRET}`,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    ...(method === "POST" ? { body: new URLSearchParams(values) } : {}),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Stripe test API ${method} ${resource} devolvió ${response.status}: ${body?.error?.message || "error desconocido"}`);
  }
  return body;
}

function psql(query) {
  return execSync("psql \"$DATABASE_URL\" -v ON_ERROR_STOP=1 -tA -c " + JSON.stringify(query), { encoding: "utf8" }).trim();
}

function stripePeriodEndEpoch(subscription) {
  const itemEnds = (subscription?.items?.data || [])
    .map((item) => item.current_period_end)
    .filter((end) => Number.isInteger(end) && end > 0);
  return Number.isInteger(subscription?.cancel_at) && subscription.cancel_at > 0
    ? subscription.cancel_at
    : itemEnds.length ? Math.max(...itemEnds) : null;
}

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
    check(await cancelBtn.isVisible(), 'Se ofrece el botón "Cancelar suscripción…"');
    await cancelBtn.click();
    const confirmBox = subBlock.locator('[data-testid="delete-client-cancel-sub-confirm"]');
    await confirmBox.waitFor({ state: "visible", timeout: 5000 });
    check(/facturaci/i.test(await confirmBox.innerText()), "Pide confirmación explícita mencionando la facturación");
    const nowBtn = confirmBox.locator('[data-testid="delete-client-cancel-sub-confirm-btn"]');
    const periodEndBtn = confirmBox.locator('[data-testid="delete-client-cancel-sub-period-end-btn"]');
    check(/Cancelar ahora y borrar/.test(await nowBtn.innerText()), 'Opción 1: "Cancelar ahora y borrar"');
    check(/Cancelar al final del periodo y revocar acceso/.test(await periodEndBtn.innerText()), 'Opción 2: "Cancelar al final del periodo y revocar acceso"');
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
    // Opción "al final del periodo": mismo fallo cerrado, y además el usuario NO se desactiva.
    // (Tras el fallo anterior el panel de opciones sigue abierto para reintentar.)
    await confirmBox.waitFor({ state: "visible", timeout: 5000 });
    const [peResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/api/admin/users/${billed.id}/cancel-subscription`) && r.request().method() === "POST"),
      periodEndBtn.click(),
    ]);
    check(peResp.status() === 409, `POST cancel-subscription {atPeriodEnd:true} también falla cerrado con 409 (obtenido ${peResp.status()})`);
    check(JSON.parse(peResp.request().postData() || "{}").atPeriodEnd === true, "La opción 2 envía { atPeriodEnd: true }");
    await cancelErr.waitFor({ state: "visible", timeout: 10000 });
    check(await modal.isVisible(), "El modal permanece abierto tras el fallo de la opción 2");
    const subRow2 = execSync("psql \"$DATABASE_URL\" -tA -c " + JSON.stringify(`SELECT status || '|' || cancel_at_period_end FROM subscriptions WHERE user_id = '${billed.id}'`), { encoding: "utf8" }).trim();
    check(subRow2 === "active|0", `La fila local no queda programada (obtenido "${subRow2}")`);
    const userRow = execSync("psql \"$DATABASE_URL\" -tA -c " + JSON.stringify(`SELECT is_active FROM users WHERE id = '${billed.id}'`), { encoding: "utf8" }).trim();
    check(userRow === "1", `El usuario sigue activo al fallar cerrado (is_active=${userRow})`);
    await page.screenshot({ path: path.join(SHOTS, "07-period-end-fail-closed.png") });
    await modal.getByRole("button", { name: "Cancelar", exact: true }).click();
    const users2 = await (await ctx.request.get(`${BASE}/api/admin/users`)).json();
    check(users2.some((u) => u.id === billed.id), "El usuario con suscripción sigue existiendo en el API");

    // 6. Fecha de fin de periodo visible en la lista para una cancelación programada.
    execSync("psql \"$DATABASE_URL\" -v ON_ERROR_STOP=1 -c " + JSON.stringify(
      `UPDATE subscriptions SET cancel_at_period_end = 1, current_period_end = '2030-02-15T10:00:00Z' WHERE user_id = '${billed.id}'`
    ), { stdio: "pipe" });
    execSync("psql \"$DATABASE_URL\" -v ON_ERROR_STOP=1 -c " + JSON.stringify(`UPDATE users SET is_active = 0 WHERE id = '${billed.id}'`), { stdio: "pipe" });
    const listed = (await (await ctx.request.get(`${BASE}/api/admin/users`)).json()).find((u) => u.id === billed.id);
    check(listed?.subscriptionCancelAtPeriodEnd === 1 && typeof listed?.subscriptionPeriodEnd === "string", "GET /api/admin/users expone cancelAtPeriodEnd + periodEnd de la suscripción");
    await page.reload({ waitUntil: "domcontentloaded" });
    const periodCell = page.locator(`[data-testid="client-period-end-${billed.id}"]`);
    await periodCell.waitFor({ state: "visible", timeout: 10000 });
    const periodText = await periodCell.innerText();
    check(/Fin periodo/.test(periodText) && /2030/.test(periodText), `La lista muestra la fecha de fin de periodo ("${periodText.trim()}")`);
    const row = page.locator(`[data-testid="delete-client-btn-${billed.id}"]`).locator("xpath=ancestor::tr");
    check(/Inactivo/.test(await row.innerText()), "El cliente aparece como Inactivo (acceso revocado)");
    await page.screenshot({ path: path.join(SHOTS, "08-period-end-listed.png") });
  }

  // 7. Camino feliz completo con una suscripción cobrada en una cuenta Stripe de test.
  if (TEST_STRIPE_SECRET) {
    if (!process.env.DATABASE_URL) {
      check(false, "El escenario real de Stripe requiere DATABASE_URL para sembrar y verificar la fila local");
    } else {
      const paid = await createClient("stripe-period-end");
      stripeTestUserId = paid.id;

      const customer = await stripeTestRequest("POST", "customers", {
        email: paid.email,
        name: paid.name,
        source: "tok_visa",
        "metadata[e2e_user_id]": paid.id,
      });
      stripeTestCustomerId = customer.id;

      const subscription = await stripeTestRequest("POST", "subscriptions", {
        customer: stripeTestCustomerId,
        collection_method: "charge_automatically",
        payment_behavior: "error_if_incomplete",
        "items[0][price_data][currency]": "usd",
        "items[0][price_data][unit_amount]": "100",
        "items[0][price_data][recurring][interval]": "month",
        "items[0][price_data][product_data][name]": `E2E period-end ${paid.id}`,
        "metadata[e2e_user_id]": paid.id,
      });
      stripeTestSubscriptionId = subscription.id;
      check(subscription.status === "active", `Stripe creó una suscripción activa de test (obtenido "${subscription.status}")`);

      const firstPeriodEnd = stripePeriodEndEpoch(subscription);
      check(Number.isInteger(firstPeriodEnd), "Stripe devuelve el fin del periodo pagado");
      if (!Number.isInteger(firstPeriodEnd)) throw new Error("Stripe no devolvió current_period_end para la suscripción de test");

      const latestInvoiceId = typeof subscription.latest_invoice === "string"
        ? subscription.latest_invoice
        : subscription.latest_invoice?.id;
      const paidInvoice = latestInvoiceId
        ? await stripeTestRequest("GET", `invoices/${latestInvoiceId}`)
        : null;
      check(paidInvoice?.status === "paid" && Number(paidInvoice?.amount_paid) > 0,
        `La primera factura de test se cobró correctamente (status=${paidInvoice?.status ?? "sin factura"}, amount_paid=${paidInvoice?.amount_paid ?? 0})`);

      psql(
        `INSERT INTO subscriptions (user_id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_end, cancel_at_period_end, stores_limit, images_included)
         VALUES ('${paid.id}', 'starter', 'active', '${stripeTestCustomerId}', '${stripeTestSubscriptionId}', to_timestamp(${firstPeriodEnd}), 0, 3, 45)
         ON CONFLICT (user_id) DO UPDATE SET plan = EXCLUDED.plan, status = EXCLUDED.status,
           stripe_customer_id = EXCLUDED.stripe_customer_id, stripe_subscription_id = EXCLUDED.stripe_subscription_id,
           current_period_end = EXCLUDED.current_period_end, cancel_at_period_end = 0`
      );
      stripeTestSubscriptionLinkedLocally = true;

      const paidRow = page.locator("tr", { hasText: paid.email });
      await paidRow.waitFor({ state: "visible", timeout: 10000 });
      await page.locator(`[data-testid="delete-client-btn-${paid.id}"]`).click();
      await modal.waitFor({ state: "visible", timeout: 10000 });
      await modal.locator('[data-testid="delete-client-confirm-input"]').fill(paid.email);
      const [paidDeleteResponse] = await Promise.all([
        page.waitForResponse((r) => r.url().includes(`/api/admin/users/${paid.id}`) && r.request().method() === "DELETE"),
        modal.locator('[data-testid="delete-client-confirm-btn"]').click(),
      ]);
      check(paidDeleteResponse.status() === 409, `La fila real de Stripe bloquea el borrado (obtenido ${paidDeleteResponse.status()})`);

      const paidSubBlock = modal.locator('[data-testid="delete-client-subscription-block"]');
      await paidSubBlock.waitFor({ state: "visible", timeout: 10000 });
      await paidSubBlock.locator('[data-testid="delete-client-cancel-sub-btn"]').click();
      const paidConfirm = paidSubBlock.locator('[data-testid="delete-client-cancel-sub-confirm"]');
      await paidConfirm.waitFor({ state: "visible", timeout: 5000 });
      const [periodEndResponse] = await Promise.all([
        page.waitForResponse((r) => r.url().includes(`/api/admin/users/${paid.id}/cancel-subscription`) && r.request().method() === "POST"),
        paidConfirm.locator('[data-testid="delete-client-cancel-sub-period-end-btn"]').click(),
      ]);
      const periodEndBody = await periodEndResponse.json().catch(() => ({}));
      check(periodEndResponse.status() === 200, `Cancelar al final del periodo devuelve 200 (obtenido ${periodEndResponse.status()})`);
      check(JSON.parse(periodEndResponse.request().postData() || "{}").atPeriodEnd === true,
        "El botón del panel envía { atPeriodEnd: true }");
      check(periodEndBody?.success === true && periodEndBody?.userDeactivated === true,
        "La respuesta confirma la cancelación programada y la revocación de acceso");
      check(periodEndBody?.stripeSubscriptionId === stripeTestSubscriptionId && periodEndBody?.status === "active",
        "La respuesta corresponde a la suscripción real, que sigue activa hasta fin de periodo");
      check(typeof periodEndBody?.periodEnd === "string", "La respuesta incluye periodEnd");

      const remoteAfterCancel = await stripeTestRequest("GET", `subscriptions/${stripeTestSubscriptionId}`);
      check(remoteAfterCancel.cancel_at_period_end === true, "Stripe confirma cancel_at_period_end=true");
      check(Number.isInteger(remoteAfterCancel.cancel_at), "Stripe devuelve cancel_at para el fin del periodo programado");
      if (Number.isInteger(remoteAfterCancel.cancel_at) && typeof periodEndBody?.periodEnd === "string") {
        const stripeCancelAt = new Date(remoteAfterCancel.cancel_at * 1000).toISOString();
        check(periodEndBody.periodEnd === stripeCancelAt,
          `periodEnd de la respuesta coincide exactamente con Stripe cancel_at (${stripeCancelAt})`);
      }

      const localCancelAtEnd = psql(`SELECT cancel_at_period_end FROM subscriptions WHERE user_id = '${paid.id}'`);
      const localActive = psql(`SELECT is_active FROM users WHERE id = '${paid.id}'`);
      const localPeriodEnd = psql(`SELECT floor(extract(epoch FROM current_period_end))::bigint FROM subscriptions WHERE user_id = '${paid.id}'`);
      check(localCancelAtEnd === "1", `La fila local guarda cancel_at_period_end=1 (obtenido "${localCancelAtEnd}")`);
      check(localActive === "0", `El usuario queda inactivo en la base de datos (is_active=${localActive})`);
      check(Number(localPeriodEnd) === remoteAfterCancel.cancel_at,
        `La fecha local coincide con Stripe cancel_at (${localPeriodEnd} vs ${remoteAfterCancel.cancel_at})`);

      await modal.waitFor({ state: "hidden", timeout: 10000 });
      const listedPaid = (await (await ctx.request.get(`${BASE}/api/admin/users`)).json()).find((u) => u.id === paid.id);
      check(listedPaid?.subscriptionCancelAtPeriodEnd === 1 && listedPaid?.subscriptionPeriodEnd === periodEndBody.periodEnd,
        "El listado del API expone la fecha programada exacta de Stripe");
      await page.reload({ waitUntil: "domcontentloaded" });
      const paidPeriodCell = page.locator(`[data-testid="client-period-end-${paid.id}"]`);
      await paidPeriodCell.waitFor({ state: "visible", timeout: 10000 });
      const displayedPeriod = await paidPeriodCell.innerText();
      const expectedDateLabel = new Date(remoteAfterCancel.cancel_at * 1000)
        .toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
      check(displayedPeriod.includes("Fin periodo") && displayedPeriod.includes(expectedDateLabel),
        `El panel muestra "Fin periodo ${expectedDateLabel}" (obtenido "${displayedPeriod.trim()}")`);
      const paidListedRow = page.locator(`[data-testid="delete-client-btn-${paid.id}"]`).locator("xpath=ancestor::tr");
      check(/Inactivo/.test(await paidListedRow.innerText()), "El cliente de Stripe aparece como Inactivo en la lista");
      await page.screenshot({ path: path.join(SHOTS, "09-stripe-period-end.png") });
    }
  } else {
    console.warn("  ! E2E_STRIPE_SECRET_KEY no definido; se omite el escenario real de Stripe (solo se aceptan claves sk_test_)");
  }

  check(errors.length === 0, `Sin errores JS en la página${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} finally {
  // Cancelar y limpiar primero la suscripción Stripe de test. Si Stripe no confirma
  // la cancelación, se conserva la fila local para que la limpieza del usuario falle cerrada.
  if (TEST_STRIPE_SECRET && stripeTestSubscriptionId) {
    try {
      const cancelled = await stripeTestRequest("DELETE", `subscriptions/${stripeTestSubscriptionId}`);
      if (cancelled.status !== "canceled") throw new Error(`status=${cancelled.status}`);
      if (stripeTestSubscriptionLinkedLocally && stripeTestUserId && process.env.DATABASE_URL) {
        psql(`UPDATE subscriptions SET status = 'canceled', cancel_at_period_end = 0 WHERE user_id = '${stripeTestUserId}'`);
      }
      ok(`Suscripción Stripe de test cancelada para limpieza (${stripeTestSubscriptionId})`);
    } catch (e) {
      console.warn(`  ! No se pudo confirmar la cancelación de limpieza de Stripe; se conserva la protección local: ${String(e.message || e)}`);
      failures.push("No se pudo confirmar la cancelación de la suscripción Stripe de test durante la limpieza");
    }
  }
  if (TEST_STRIPE_SECRET && stripeTestCustomerId) {
    try { await stripeTestRequest("DELETE", `customers/${stripeTestCustomerId}`); }
    catch (e) {
      console.warn(`  ! No se pudo limpiar el cliente Stripe de test: ${String(e.message || e)}`);
      failures.push("No se pudo eliminar el cliente Stripe de test durante la limpieza");
    }
  }
  // Si el escenario 5 quedó a medias, la fila de suscripción sembrada bloquearía la limpieza.
  if (process.env.DATABASE_URL) {
    try { execSync("psql \"$DATABASE_URL\" -c " + JSON.stringify(`DELETE FROM subscriptions WHERE stripe_subscription_id LIKE 'sub_e2e_%'`), { stdio: "pipe" }); } catch {}
  }
  // Limpieza: cualquier usuario de prueba que quede.
  for (const u of created) {
    const r = await ctx.request.delete(`${BASE}/api/admin/users/${u.id}`).catch(() => null);
    if (r && !r.ok() && r.status() !== 404) {
      console.warn(`  ! no se pudo limpiar ${u.email} → ${r.status()}`);
      if (u.id === stripeTestUserId) failures.push("No se pudo borrar el usuario asociado a la suscripción Stripe de test");
    }
  }
  await browser.close();
}

if (failures.length) { console.error(`\n${failures.length} comprobación(es) fallida(s)`); process.exit(1); }
console.log(`\nTodo OK — capturas en ${SHOTS}`);
