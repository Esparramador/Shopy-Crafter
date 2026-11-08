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

async function installShopyControlMock(page) {
  await page.addInitScript(() => {
    window.__shopyControlCalls = [];
    window.shopyControl = {
      solicitud: datos => window.__shopyControlCalls.push(datos),
    };
  });
  await page.route("https://crafter-mando.crafteragency.workers.dev/p/sc.js", route =>
    route.fulfill({ contentType: "application/javascript", body: "" }));
}

/** Abre Contacto con /api/contact simulada; `outcome` se puede cambiar entre envíos. */
async function openContact(viewport, { shopyControlAvailable = true } = {}) {
  const context = await newContext(browser, viewport);
  const page = await context.newPage();
  const errors = trackPageErrors(page);
  const state = { outcome: "success", requests: [] };
  if (shopyControlAvailable) {
    await installShopyControlMock(page);
  } else {
    await page.route("https://crafter-mando.crafteragency.workers.dev/p/sc.js", route =>
      route.fulfill({ contentType: "application/javascript", body: "" }));
  }
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
  await form.locator("input[type='tel']").fill("+34 600 111 222");
  await form.locator("input[placeholder='mitienda.com']").fill("tienda-e2e.example.invalid");
  await form.locator("select").nth(0).selectOption({ label: "Moda y ropa" });
  await form.locator("select").nth(1).selectOption({ label: "€1.000 – €5.000" });
  await form.locator("input[placeholder='@tu_cuenta o URL']").fill("@e2e_contacto");
  await form.getByRole("button", { name: "Auditoría completa" }).click();
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
      const calls = await page.evaluate(() => window.__shopyControlCalls);
      check(calls.length === 1
        && calls[0].nombre === TEST_DATA.name
        && calls[0].email === TEST_DATA.email
        && calls[0].telefono === "+34 600 111 222"
        && calls[0].web === "tienda-e2e.example.invalid"
        && calls[0].mensaje === [
          "Servicios: Auditoría completa",
          "Nicho: Moda y ropa",
          "Facturación: €1.000 – €5.000",
          "Redes sociales: @e2e_contacto",
          `Mensaje: ${TEST_DATA.message}`,
        ].join("\n"),
      `${tag} éxito: Shopy Control recibe una copia completa tras confirmar el envío`);
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
      check((await page.evaluate(() => window.__shopyControlCalls)).length === 0,
        `${tag} ${failure.label}: no se envía copia a Shopy Control si falla el envío`);
      check(await submitButton(page).isEnabled() && /ENVIAR SOLICITUD/.test(await submitButton(page).textContent()),
        `${tag} ${failure.label}: el botón vuelve a estar disponible`);

      if (failure.outcome === "serverDown") {
        // Reintento con los mismos datos: sale bien y reutiliza la misma clave.
        state.outcome = "success";
        await submitButton(page).click();
        await page.getByTestId("contact-success").waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
        check(await page.getByTestId("contact-success").isVisible(), `${tag} reintento tras el fallo: se confirma el envío`);
        check((await page.evaluate(() => window.__shopyControlCalls)).length === 1,
          `${tag} reintento tras el fallo: solo se copia el envío confirmado`);
        check(state.requests.length === 2 && state.requests[0].key === state.requests[1].key,
          `${tag} reintento tras el fallo: misma Idempotency-Key, sin duplicar la solicitud`);
      }
      check(errors.length === 0, `${tag} ${failure.label}: sin errores de JavaScript${errors.length ? ` (${errors[0]})` : ""}`);
      await context.close();
    }
  }

  // Validación nativa: no se envía al servidor ni a Shopy Control antes de completar los campos obligatorios.
  {
    const { context, page, state } = await openContact(DESKTOP);
    await page.locator("form input[type='text']").first().click();
    await submitButton(page).click();
    check(state.requests.length === 0, "validación: un formulario incompleto no llama al servidor");
    check((await page.evaluate(() => window.__shopyControlCalls)).length === 0,
      "validación: un formulario incompleto no llama a Shopy Control");
    await context.close();
  }

  // If the external script fails to initialize, the primary contact request still succeeds.
  {
    const { context, page, errors, state } = await openContact(DESKTOP, { shopyControlAvailable: false });
    await fillForm(page);
    await submitButton(page).click();
    await page.getByTestId("contact-success").waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
    check(state.requests.length === 1 && await page.getByTestId("contact-success").isVisible(),
      "script ausente: el envío principal y su confirmación siguen funcionando");
    check(errors.length === 0, `script ausente: sin errores de JavaScript${errors.length ? ` (${errors[0]})` : ""}`);
    await context.close();
  }

  // Portada: recorre los tres pasos y comprueba los campos adicionales del formulario visible.
  {
    const context = await newContext(browser, DESKTOP);
    const page = await context.newPage();
    const errors = trackPageErrors(page);
    const requests = [];
    await installShopyControlMock(page);
    await page.route("**/api/contact", async route => {
      requests.push(route.request().postDataJSON());
      await route.fulfill(OUTCOMES.success);
    });
    await openPublic(page, "/", "body");
    await page.locator("#fp-contact").scrollIntoViewIfNeeded();
    const hero = page.locator("#fp-contact .vfh-root");
    const opener = page.getByRole("button", { name: "Abrir formulario sin esperar" });
    if (await opener.isVisible().catch(() => false)) await opener.click();

    await hero.locator("input[placeholder='Tu nombre']").waitFor({ state: "visible", timeout: 20_000 });
    await hero.locator("input[placeholder='Tu nombre']").fill("Prueba E2E Portada");
    await hero.locator("input[placeholder='tu@email.com']").fill("e2e-portada@example.invalid");
    await hero.locator("input[type='tel']").fill("+34 600 333 444");
    await hero.getByRole("button", { name: "Siguiente →" }).click();

    await hero.locator("input[placeholder='mitienda.com']").fill("portada-e2e.example.invalid");
    await hero.locator("select").nth(0).selectOption({ label: "Otro" });
    await hero.locator("input[placeholder='Describe tu nicho…']").fill("Comida artesanal");
    await hero.locator("select").nth(1).selectOption({ label: "€5.000 – €15.000" });
    await hero.locator("input[placeholder='@tutienda']").fill("@e2e_portada");
    await hero.getByRole("button", { name: "Siguiente →" }).click();

    await hero.getByRole("button", { name: "SEO y contenido" }).click();
    await hero.locator("textarea").nth(0).fill("Información de prueba");
    await hero.locator("textarea").nth(1).fill("Proveedor de prueba");
    await hero.locator("textarea").nth(2).fill("Mensaje de prueba");
    await hero.getByRole("button", { name: /Enviar y analizar gratis/ }).click();
    await page.getByText("¡Solicitud recibida!").waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});

    const calls = await page.evaluate(() => window.__shopyControlCalls);
    check(requests.length === 1 && requests[0]?.name === "Prueba E2E Portada"
      && requests[0]?.email === "e2e-portada@example.invalid",
    "portada: el formulario sigue enviando su petición original al servidor");
    check(calls.length === 1
      && calls[0].nombre === "Prueba E2E Portada"
      && calls[0].email === "e2e-portada@example.invalid"
      && calls[0].telefono === "+34 600 333 444"
      && calls[0].web === "portada-e2e.example.invalid"
      && calls[0].mensaje === [
        "Servicios: SEO y contenido",
        "Nicho: Comida artesanal",
        "Facturación: €5.000 – €15.000",
        "Redes sociales: @e2e_portada",
        "Información extra: Información de prueba",
        "Proveedores: Proveedor de prueba",
        "Mensaje: Mensaje de prueba",
      ].join("\n"),
    "portada: Shopy Control recibe los campos agrupados tras confirmar el envío");
    check(errors.length === 0, `portada: sin errores de JavaScript${errors.length ? ` (${errors[0]})` : ""}`);
    await context.close();
  }
} finally {
  await browser.close();
}

finish("Los formularios de portada y contacto conservan su envío y copian solo solicitudes confirmadas");
