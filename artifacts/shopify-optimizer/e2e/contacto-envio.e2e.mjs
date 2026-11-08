#!/usr/bin/env node
// Envía el formulario de Contacto contra una API SIMULADA (page.route) y
// comprueba que el visitante ve un resultado claro: la confirmación cuando el
// envío sale bien y un error comprensible, conservando sus datos, cuando falla.
// Ninguna petición llega al servidor real: /api/contact se intercepta siempre.
//
// Uso: pnpm --filter @workspace/shopify-optimizer run e2e:contacto-envio
// Env: ver e2e/public-e2e-helpers.mjs (E2E_BASE_URL, E2E_CHROMIUM, E2E_CHANNEL).
import { DESKTOP, MOBILE, createChecker, launchBrowser, newContext, openPublic, trackPageErrors } from "./public-e2e-helpers.mjs";

// Datos desechables: dominio reservado .invalid, nunca un cliente real.
const TEST_DATA = {
  name: "Prueba E2E Contacto",
  email: "e2e-contacto@example.invalid",
  message: "Mensaje automático de prueba e2e. No responder.",
};

const OUTCOMES = {
  success: { status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) },
  serverDown: { status: 502, contentType: "text/html", body: "<html><body>Bad gateway</body></html>" },
  rejected: { status: 422, contentType: "application/json", body: JSON.stringify({ error: "El email no es válido (respuesta simulada)" }) },
  unconfirmed: { status: 200, contentType: "application/json", body: JSON.stringify({ success: false }) },
};

const { check, finish } = createChecker();
const browser = await launchBrowser();

/** Abre Contacto con /api/contact simulada; `outcome` se puede cambiar entre envíos. */
async function openContact(viewport) {
  const context = await newContext(browser, viewport);
  const page = await context.newPage();
  const errors = trackPageErrors(page);
  const state = { outcome: "success", requests: [] };
  await page.route("**/api/contact", async route => {
    const request = route.request();
    state.requests.push({
      method: request.method(),
      key: request.headers()["idempotency-key"],
      body: request.postDataJSON(),
    });
    if (state.outcome === "network") return route.abort("failed");
    return route.fulfill(OUTCOMES[state.outcome]);
  });
  await openPublic(page, "/contacto", "form");
  await page.locator("form").waitFor({ state: "visible", timeout: 25_000 });
  return { context, page, errors, state };
}

async function fillForm(page) {
  const form = page.locator("form");
  // El primer foco salta la demo que rellena el formulario sola.
  await form.locator("input[type='text']").first().click();
  await form.locator("input[type='text']").first().fill(TEST_DATA.name);
  await form.locator("input[type='email']").fill(TEST_DATA.email);
  await form.locator("textarea").fill(TEST_DATA.message);
}

const submitButton = page => page.locator("form button[type='submit']");

try {
  for (const viewport of [DESKTOP, MOBILE]) {
    const tag = `[${viewport.name}]`;

    // 1) Envío correcto: confirmación visible y datos de prueba en la petición.
    {
      const { context, page, errors, state } = await openContact(viewport);
      await fillForm(page);
      await submitButton(page).click();
      const success = page.getByTestId("contact-success");
      await success.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
      check(await success.isVisible(), `${tag} éxito: se muestra la confirmación`);
      check(/Solicitud recibida/i.test(await success.textContent().catch(() => "")), `${tag} éxito: el texto dice «¡Solicitud recibida!»`);
      check(await success.getAttribute("role").catch(() => null) === "status", `${tag} éxito: la confirmación se anuncia (role=status)`);
      const sent = state.requests[0];
      check(state.requests.length === 1 && sent?.method === "POST", `${tag} éxito: una sola petición POST a /api/contact (${state.requests.length})`);
      check(sent?.body?.name === TEST_DATA.name && sent?.body?.email === TEST_DATA.email && sent?.body?.message === TEST_DATA.message,
        `${tag} éxito: la petición lleva los datos desechables escritos`);
      check(typeof sent?.key === "string" && sent.key.length >= 16, `${tag} éxito: la petición lleva Idempotency-Key`);
      check(errors.length === 0, `${tag} éxito: sin errores de JavaScript${errors.length ? ` (${errors[0]})` : ""}`);
      await context.close();
    }

    // 2) Fallos: cada uno explica lo ocurrido, conserva los datos y deja reintentar.
    const failures = [
      { outcome: "serverDown", expect: /No se ha podido confirmar el envío/, label: "servidor caído (502 HTML)" },
      { outcome: "rejected", expect: /El email no es válido \(respuesta simulada\)/, label: "rechazo con motivo (422)" },
      { outcome: "network", expect: /No se ha podido conectar/, label: "sin conexión" },
      { outcome: "unconfirmed", expect: /No se ha podido confirmar que recibimos tu solicitud/, label: "respuesta sin confirmar" },
    ];
    for (const failure of failures) {
      const { context, page, errors, state } = await openContact(viewport);
      state.outcome = failure.outcome;
      await fillForm(page);
      await submitButton(page).click();
      const alert = page.getByTestId("contact-error");
      await alert.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
      const text = (await alert.textContent().catch(() => "")) || "";
      check(failure.expect.test(text), `${tag} ${failure.label}: el visitante lee el error («${text.slice(0, 70)}»)`);
      check(await alert.getAttribute("role").catch(() => null) === "alert", `${tag} ${failure.label}: el error se anuncia (role=alert)`);
      check(!(await page.getByTestId("contact-success").isVisible()), `${tag} ${failure.label}: no se muestra una confirmación falsa`);
      check(await page.locator("form input[type='email']").inputValue() === TEST_DATA.email
        && await page.locator("form textarea").inputValue() === TEST_DATA.message,
        `${tag} ${failure.label}: el formulario conserva los datos`);
      check(await submitButton(page).isEnabled() && /ENVIAR SOLICITUD/.test(await submitButton(page).textContent()),
        `${tag} ${failure.label}: el botón vuelve a estar disponible`);

      if (failure.outcome === "serverDown") {
        // Reintento con los mismos datos: sale bien y reutiliza la misma clave.
        state.outcome = "success";
        await submitButton(page).click();
        await page.getByTestId("contact-success").waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
        check(await page.getByTestId("contact-success").isVisible(), `${tag} reintento tras el fallo: se confirma el envío`);
        check(state.requests.length === 2 && state.requests[0].key === state.requests[1].key,
          `${tag} reintento tras el fallo: misma Idempotency-Key, sin duplicar la solicitud`);
      }
      check(errors.length === 0, `${tag} ${failure.label}: sin errores de JavaScript${errors.length ? ` (${errors[0]})` : ""}`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}

finish("Contacto explica al visitante el envío correcto y cada tipo de fallo, en escritorio y móvil");
