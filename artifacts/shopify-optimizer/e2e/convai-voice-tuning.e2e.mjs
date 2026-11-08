#!/usr/bin/env node
// E2E: formulario "Voz de Arturo" (Fusion Studio Pro → Audio AI Tools → ConvAI Agents).
//
// Comprueba, con sesión real de admin y contra ElevenLabs:
//   1. La tarjeta carga los valores actuales del servidor (sliders + badge de origen).
//   2. "Escuchar muestra" obtiene audio/mpeg del endpoint de previsualización.
//   3. Mover un slider habilita "Guardar y aplicar ahora"; el servidor persiste
//      el valor y aplica/verifica los tres agentes existentes sin recrearlos.
//   4. Se restauran los valores anteriores al terminar (siempre, también si falla).
//   6. (#148) La voz guardada llega también al agente de CLIENTES: se guarda un
//      ajuste distinto, un usuario cliente efímero (@e2e.invalid) pide
//      /api/voice/client-call-url y se lee ese agente en
//      /api/voice/convai/agents/:agentId (stability, similarity_boost, speed).
//      El usuario se borra siempre al terminar.
//   7. (#149) Solo si E2E_RESTART_CMD está definido: se guarda otro ajuste, se
//      ejecuta ese comando para reiniciar el proceso API (p. ej. reiniciar el
//      workflow), se espera a /api/healthz y la primera /api/voice/convai/call-url
//      debe aplicar los valores persistidos al agente existente, conservando
//      ELEVEN_CONVAI_DEFAULT_AGENT_ID si está fijado.
//
// Uso: ADMIN_PASSWORD=… node e2e/convai-voice-tuning.e2e.mjs
// Env: ADMIN_PASSWORD (obligatoria), E2E_ADMIN_EMAIL, E2E_BASE_URL, E2E_CHROMIUM,
//      E2E_RESTART_CMD (opcional, paso 7), E2E_RESTART_TIMEOUT_MS (por defecto 180000).

import { chromium } from "playwright";
import { nanoid } from "nanoid";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = (process.env.E2E_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`).replace(/\/$/, "");
const EMAIL = process.env.E2E_ADMIN_EMAIL || "craftershopy@gmail.com";
const PASSWORD = process.env.ADMIN_PASSWORD;
const OUT = path.resolve("generated-artifacts/e2e/convai-voice-tuning");
mkdirSync(OUT, { recursive: true });

function fail(msg) { console.error(`✗ ${msg}`); process.exit(1); }
function ok(msg) { console.log(`✓ ${msg}`); }
function assert(cond, msg) { if (!cond) throw new Error(msg); ok(msg); }
if (!PASSWORD) fail("ADMIN_PASSWORD no está definido en el entorno");

function chromiumPath() {
  if (process.env.E2E_CHROMIUM) return process.env.E2E_CHROMIUM;
  try { return execSync("which chromium", { encoding: "utf8" }).trim(); } catch { return undefined; }
}

const browser = await chromium.launch({ executablePath: chromiumPath(), headless: true, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });
let original = null;
let exitCode = 0;
let testClient = null;
const closeEnough = (actual, expected) => Number.isFinite(Number(actual)) && Math.abs(Number(actual) - expected) < 0.005;
const otherValue = (v, lo, hi) => Math.round((v + 0.1 <= hi ? v + 0.1 : v - 0.1) * 100) / 100;
async function readAgentTts(agentId) {
  const r = await ctx.request.get(`${BASE}/api/voice/convai/agents/${encodeURIComponent(agentId)}`);
  if (!r.ok()) throw new Error(`GET /api/voice/convai/agents/${agentId} → ${r.status()}`);
  return (await r.json()).agent?.conversation_config?.tts ?? {};
}
function assertTts(tts, expected, label) {
  assert(closeEnough(tts.stability, expected.stability), `${label}: stability=${tts.stability} (esperado ${expected.stability})`);
  assert(closeEnough(tts.similarity_boost, expected.similarityBoost), `${label}: similarity_boost=${tts.similarity_boost} (esperado ${expected.similarityBoost})`);
  assert(closeEnough(tts.speed, expected.speed), `${label}: speed=${tts.speed} (esperado ${expected.speed})`);
}
try {
  const login = await ctx.request.post(`${BASE}/api/auth/login`, { data: { email: EMAIL, password: PASSWORD } });
  if (!login.ok()) fail(`Login admin ${EMAIL} → ${login.status()}`);
  const before = await ctx.request.get(`${BASE}/api/voice/convai/voice-settings`);
  if (!before.ok()) fail(`GET voice-settings → ${before.status()}`);
  original = (await before.json()).settings;
  ok(`Ajustes actuales en servidor: ${JSON.stringify(original)}`);

  const projects = await (await ctx.request.get(`${BASE}/api/projects`)).json();
  if (!Array.isArray(projects) || !projects.length) fail("no hay proyectos para abrir Fusion Studio Pro");
  const page = await ctx.newPage();
  const errors = [];
  let voiceTuningPutCount = 0;
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("request", request => {
    if (request.url().includes("/api/voice/convai/voice-settings") && request.method() === "PUT") {
      voiceTuningPutCount++;
    }
  });
  await page.addInitScript(() => localStorage.setItem("shopycrafter_coach_dismissed", "1"));
  await page.goto(`${BASE}/projects/${projects[0].id}/fusion-studio-pro`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "#replit-dev-banner{display:none!important}" });

  await page.locator("button", { hasText: "Audio AI Tools" }).first().click();
  await page.locator("button", { hasText: "ConvAI Agents" }).first().click();
  const card = page.getByTestId("convai-voice-tuning-card");
  await card.waitFor({ state: "visible", timeout: 20_000 });
  await page.getByTestId("convai-voice-tuning-speed").waitFor({ state: "visible", timeout: 20_000 });

  // 1. Valores cargados
  const shown = {
    stability: Number(await page.getByTestId("convai-voice-tuning-stability").inputValue()),
    similarityBoost: Number(await page.getByTestId("convai-voice-tuning-similarityBoost").inputValue()),
    speed: Number(await page.getByTestId("convai-voice-tuning-speed").inputValue()),
  };
  assert(JSON.stringify(shown) === JSON.stringify(original), `Los sliders muestran los valores del servidor (${JSON.stringify(shown)})`);
  assert(await page.getByTestId("convai-voice-tuning-save").isDisabled(), "Guardar está deshabilitado sin cambios");
  assert(await page.getByTestId("convai-voice-tuning-save-apply").isDisabled(), "Guardar y aplicar está deshabilitado sin cambios");
  await card.screenshot({ path: path.join(OUT, "01-loaded.png") });

  // 2. Escuchar muestra → audio/mpeg
  const previewResp = page.waitForResponse(r => r.url().includes("/api/voice/convai/voice-settings/preview"), { timeout: 60_000 });
  await page.getByTestId("convai-voice-tuning-preview").click();
  const pr = await previewResp;
  assert(pr.status() === 200, `Previsualización → HTTP ${pr.status()}`);
  assert((pr.headers()["content-type"] || "").startsWith("audio/mpeg"), `Previsualización devuelve audio/mpeg (${pr.headers()["content-type"]})`);
  // El cuerpo ya lo consumió la página como blob; Playwright no siempre lo
  // expone, así que se usa Content-Length (lo fija el servidor).
  const previewBytes = Number(pr.headers()["content-length"] || 0);
  assert(previewBytes > 5_000, `Muestra con audio real (${previewBytes} bytes)`);
  // El servidor responde antes de que Audio.play() termine y el botón vuelva
  // a habilitarse; espera a que acabe la previsualización antes de editar.
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="convai-voice-tuning-preview"]');
    return button && !button.disabled;
  }, null, { timeout: 15_000 });

  // 3. Cambiar velocidad y guardar
  const newSpeed = original.speed >= 1.0 ? Math.round((original.speed - 0.1) * 100) / 100 : Math.round((original.speed + 0.1) * 100) / 100;
  const speedSlider = page.getByTestId("convai-voice-tuning-speed");
  await speedSlider.evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(el, String(v));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, newSpeed);
  assert((await page.getByTestId("convai-voice-tuning-speed-value").textContent()).startsWith(newSpeed.toFixed(2)), `El valor mostrado cambia a ${newSpeed.toFixed(2)}`);
  assert(!(await page.getByTestId("convai-voice-tuning-save-apply").isDisabled()), "Guardar y aplicar se habilita al cambiar un slider");
  const saveResp = page.waitForResponse(r => r.url().includes("/api/voice/convai/voice-settings") && r.request().method() === "PUT", { timeout: 30_000 });
  const applyResp = page.waitForResponse(r => r.url().includes("/api/voice/convai/voice-settings/apply") && r.request().method() === "POST", { timeout: 60_000 });
  await page.getByTestId("convai-voice-tuning-save-apply").click();
  const sr = await saveResp;
  assert(sr.status() === 200, `Guardar → HTTP ${sr.status()}`);
  const savedResponse = await sr.json();
  const history = savedResponse.history || [];
  assert(history.length > 0, "Guardar registra un cambio en el historial");
  assert(history[0].settings.speed === newSpeed, "El historial guarda los tres valores nuevos");
  assert(history[0].userId && history[0].userName && history[0].userEmail === EMAIL, "El historial identifica al admin que guardó");
  assert(Number.isFinite(Date.parse(history[0].changedAt)), "El historial guarda la fecha del cambio");
  const ar = await applyResp;
  assert(ar.status() === 200, `Aplicar agentes en sitio → HTTP ${ar.status()}`);
  const applyResult = await ar.json();
  assert(applyResult.success === true, "Guardar y aplicar devuelve éxito");
  assert(Object.keys(applyResult.agents || {}).length === 3, "La aplicación informa del estado de admin, cliente y landing");
  assert(Object.values(applyResult.agents).every(a => a.status === "applied" || a.status === "not_created"), "Los agentes existentes se sincronizan en sitio y los no creados no se crean");
  const adminOnlyApply = await ctx.request.post(`${BASE}/api/voice/convai/voice-settings/apply`, { data: { agentTypes: ["admin"] } });
  const adminOnlyResult = await adminOnlyApply.json();
  assert(adminOnlyApply.ok(), `Reintentar un tipo concreto → HTTP ${adminOnlyApply.status()}`);
  assert(Object.keys(adminOnlyResult.agents || {}).join(",") === "admin", "El servidor solo procesa los agentes indicados para el reintento");
  const after = (await (await ctx.request.get(`${BASE}/api/voice/convai/voice-settings`)).json()).settings;
  assert(after.speed === newSpeed && after.stability === original.stability, `El servidor persistió speed=${after.speed}`);
  await page.getByTestId("convai-voice-tuning-source").filter({ hasText: "Guardado en el panel" }).waitFor({ timeout: 15_000 });
  ok("El badge de origen indica 'Guardado en el panel'");
  assert(!(await page.getByTestId("convai-voice-tuning-save-apply").isEnabled()), "Guardar y aplicar queda deshabilitado sin cambios en los controles");
  assert(await page.getByTestId("convai-voice-tuning-apply-saved").isEnabled(), "Se puede volver a aplicar la configuración guardada sin cambios en los controles");
  const putsBeforeSavedApply = voiceTuningPutCount;
  const savedApplyResp = page.waitForResponse(r => r.url().includes("/api/voice/convai/voice-settings/apply") && r.request().method() === "POST", { timeout: 60_000 });
  await page.getByTestId("convai-voice-tuning-apply-saved").click();
  const savedApplyResponse = await savedApplyResp;
  assert(savedApplyResponse.status() === 200, `Reaplicar valores guardados → HTTP ${savedApplyResponse.status()}`);
  const savedApplyResult = await savedApplyResponse.json();
  assert(Object.keys(savedApplyResult.agents || {}).length === 3, "La reaplicación muestra el resultado de cada tipo de agente");
  assert(await page.getByTestId("convai-voice-tuning-apply-results").isVisible(), "El panel muestra el detalle de la aplicación por agente");
  assert((await page.getByTestId("convai-voice-tuning-apply-results").textContent()).includes("Actualizado") || (await page.getByTestId("convai-voice-tuning-apply-results").textContent()).includes("Sin crear"), "El panel distingue agentes actualizados y no creados");
  const putsAfterSavedApply = voiceTuningPutCount;
  assert(putsAfterSavedApply === putsBeforeSavedApply, "Reaplicar no vuelve a guardar los controles");
  await page.getByText("Llamadas de voz operativas", { exact: true }).waitFor({ timeout: 30_000 });
  const appliedHealth = await (await ctx.request.get(`${BASE}/api/voice/convai/health`)).json();
  assert(appliedHealth.healthy === true, "La salud queda operativa sin esperar a otra llamada");
  assert((appliedHealth.agents || []).every(a => a.status === "ok" || a.status === "not_created"), "La salud confirma que no queda deriva");
  await page.getByTestId("convai-voice-tuning-save-apply").filter({ hasText: "Guardar y aplicar ahora" }).waitFor({ state: "visible" });
  await page.getByText("Guardado y aplicado", { exact: true }).waitFor({ timeout: 15_000 });
  const restoreButton = page.getByTestId(`convai-voice-history-restore-${history[0].id}`);
  await restoreButton.waitFor({ state: "visible", timeout: 15_000 });
  assert((await page.getByTestId("convai-voice-tuning-history").textContent()).includes("Volver a este ajuste"), "La tarjeta muestra el historial y su acción de restauración");
  const restoreResp = page.waitForResponse(r => r.url().includes("/api/voice/convai/voice-settings") && r.request().method() === "PUT", { timeout: 30_000 });
  await restoreButton.click();
  const rr = await restoreResp;
  assert(rr.status() === 200, `Restaurar usa el guardado validado → HTTP ${rr.status()}`);
  assert(JSON.stringify((await rr.json()).settings) === JSON.stringify(history[0].settings), "La restauración guarda los valores seleccionados");
  // Restaurar un registro vuelve a guardar esos mismos valores ya aplicados.
  const health = await (await ctx.request.get(`${BASE}/api/voice/convai/health`)).json();
  assert(health.healthy === true, "La salud sigue operativa tras restaurar un registro con los mismos valores");

  // 5. Guardar sin "aplicar" y comprobar que la siguiente llamada sincroniza
  // el agente admin real antes de emitir la URL firmada.
  await speedSlider.evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(el, String(v));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, original.speed);
  assert(!(await page.getByTestId("convai-voice-tuning-save").isDisabled()), "Guardar se habilita al preparar un cambio sin aplicar");
  const saveOnlyResp = page.waitForResponse(r => r.url().includes("/api/voice/convai/voice-settings") && r.request().method() === "PUT", { timeout: 30_000 });
  await page.getByTestId("convai-voice-tuning-save").click();
  const savedOnly = await saveOnlyResp;
  assert(savedOnly.status() === 200, `Guardar sin aplicar → HTTP ${savedOnly.status()}`);
  const callSettings = (await savedOnly.json()).settings;
  assert(callSettings.speed === original.speed && callSettings.stability === original.stability && callSettings.similarityBoost === original.similarityBoost, "La nueva configuración se guarda antes de llamar");
  assert(callSettings.speed !== newSpeed, "El valor guardado para la llamada difiere del que ya estaba aplicado");

  // Start a real admin call first (this causes a cold sync after the PUT
  // invalidates the ID cache), then start "apply" while ElevenLabs is still
  // handling that request. Both paths must consume the same single-flight.
  const callStartedAt = Date.now();
  const callUrlPromise = ctx.request.get(`${BASE}/api/voice/convai/call-url`);
  await new Promise(resolve => setTimeout(resolve, 2));
  const concurrentApplyPromise = ctx.request.post(`${BASE}/api/voice/convai/voice-settings/apply`, {
    data: { agentTypes: ["admin"] },
  });
  const [callUrlResp, concurrentApplyResp] = await Promise.all([callUrlPromise, concurrentApplyPromise]);
  assert(callUrlResp.status() === 200, `La llamada concurrente obtiene URL → HTTP ${callUrlResp.status()}`);
  assert(concurrentApplyResp.status() === 200, `Aplicar durante el inicio de llamada → HTTP ${concurrentApplyResp.status()}`);
  const callUrl = await callUrlResp.json();
  const concurrentApply = await concurrentApplyResp.json();
  assert(typeof callUrl.signed_url === "string" && callUrl.signed_url.length > 0, "La llamada recibe una URL firmada");
  assert(typeof callUrl.agentId === "string" && callUrl.agentId.length > 0, "La llamada devuelve el ID del agente admin");
  const pinnedAgentId = process.env.ELEVEN_CONVAI_DEFAULT_AGENT_ID?.trim();
  if (pinnedAgentId) {
    assert(callUrl.agentId === pinnedAgentId, "La llamada conserva el agente admin fijado por ELEVEN_CONVAI_DEFAULT_AGENT_ID");
  } else {
    ok("ELEVEN_CONVAI_DEFAULT_AGENT_ID no está configurado en este entorno; se comprueba el mismo ID entre llamada y aplicación");
  }
  const concurrentAdmin = concurrentApply.agents?.admin;
  assert(concurrentApply.success === true, "La aplicación concurrente termina correctamente");
  assert(concurrentAdmin?.status === "applied", "La aplicación concurrente informa el agente admin como aplicado");
  assert(concurrentAdmin.sharedFlight === true, "La aplicación reutiliza el mismo trabajo de sincronización de la llamada");
  assert(concurrentAdmin.agentId === callUrl.agentId, "La llamada y la aplicación conservan el mismo ID de agente fijado");
  assert(Date.now() - callStartedAt < 60_000, "La llamada y la aplicación concurrentes terminan dentro del límite");
  const agentResp = await ctx.request.get(`${BASE}/api/voice/convai/agents/${encodeURIComponent(callUrl.agentId)}`);
  assert(agentResp.status() === 200, `La API admin lee el agente devuelto por call-url → HTTP ${agentResp.status()}`);
  const agent = (await agentResp.json()).agent;
  const persistedTts = agent?.conversation_config?.tts;
  const closeEnough = (actual, expected) => Number.isFinite(Number(actual)) && Math.abs(Number(actual) - expected) < 0.005;
  assert(closeEnough(persistedTts?.stability, callSettings.stability), `ElevenLabs conserva stability=${persistedTts?.stability} y no una configuración obsoleta`);
  assert(closeEnough(persistedTts?.similarity_boost, callSettings.similarityBoost), `ElevenLabs conserva similarity_boost=${persistedTts?.similarity_boost} y no una configuración obsoleta`);
  assert(closeEnough(persistedTts?.speed, callSettings.speed), `ElevenLabs conserva speed=${persistedTts?.speed} y no una configuración obsoleta`);

  // 6. (#148) La voz guardada llega al agente que atiende llamadas de clientes.
  const clientSettings = {
    stability: otherValue(original.stability, 0, 1),
    similarityBoost: otherValue(original.similarityBoost, 0, 1),
    speed: otherValue(original.speed, 0.7, 1.2),
  };
  const clientSave = await ctx.request.put(`${BASE}/api/voice/convai/voice-settings`, { data: clientSettings });
  assert(clientSave.ok(), `Guardar un ajuste distinto para el agente de clientes → HTTP ${clientSave.status()}`);
  const tag = nanoid(10);
  testClient = { email: `e2e-voz-${tag.toLowerCase()}@e2e.invalid`, password: `E2e-${nanoid(18)}`, name: `E2E Voz ${tag}` };
  const created = await ctx.request.post(`${BASE}/api/admin/users`, { data: { email: testClient.email, name: testClient.name, role: "client", password: testClient.password } });
  const createdBody = await created.json().catch(() => ({}));
  assert(created.ok() && createdBody.id, `Usuario cliente de prueba creado → HTTP ${created.status()}`);
  testClient.id = createdBody.id;
  const clientCtx = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    const clientLogin = await clientCtx.request.post(`${BASE}/api/auth/login`, { data: { email: testClient.email, password: testClient.password } });
    assert(clientLogin.ok(), `Login del cliente de prueba → HTTP ${clientLogin.status()}`);
    const clientCall = await clientCtx.request.get(`${BASE}/api/voice/client-call-url`);
    assert(clientCall.status() === 200, `/api/voice/client-call-url → HTTP ${clientCall.status()}`);
    const clientCallBody = await clientCall.json();
    assert(clientCallBody.mode === "client" && typeof clientCallBody.agentId === "string", `La URL es del agente de clientes (${clientCallBody.agentId})`);
    assertTts(await readAgentTts(clientCallBody.agentId), clientSettings, "Agente de clientes");
  } finally {
    await clientCtx.close();
  }

  // 7. (#149) Tras reiniciar el proceso API se aplican los valores persistidos.
  if (process.env.E2E_RESTART_CMD) {
    const restartSettings = { ...clientSettings, speed: otherValue(clientSettings.speed, 0.7, 1.2) };
    const restartSave = await ctx.request.put(`${BASE}/api/voice/convai/voice-settings`, { data: restartSettings });
    assert(restartSave.ok(), `Guardar el ajuste previo al reinicio → HTTP ${restartSave.status()}`);
    console.log(`  reiniciando la API: ${process.env.E2E_RESTART_CMD}`);
    execSync(process.env.E2E_RESTART_CMD, { stdio: "inherit" });
    const deadline = Date.now() + Number(process.env.E2E_RESTART_TIMEOUT_MS || 180_000);
    await new Promise(resolve => setTimeout(resolve, 3_000));
    for (;;) {
      const h = await ctx.request.get(`${BASE}/api/healthz`).catch(() => null);
      if (h?.ok()) break;
      if (Date.now() > deadline) throw new Error("La API no volvió tras el reinicio");
      await new Promise(resolve => setTimeout(resolve, 2_000));
    }
    ok("La API respondió de nuevo tras el reinicio");
    // La sesión está en Postgres: si se perdió, se vuelve a entrar.
    if ((await ctx.request.get(`${BASE}/api/voice/convai/voice-settings`)).status() === 401) {
      await ctx.request.post(`${BASE}/api/auth/login`, { data: { email: EMAIL, password: PASSWORD } });
    }
    const afterRestart = await ctx.request.get(`${BASE}/api/voice/convai/call-url`);
    assert(afterRestart.status() === 200, `Primera call-url tras el reinicio → HTTP ${afterRestart.status()}`);
    const afterRestartBody = await afterRestart.json();
    const pinned = process.env.ELEVEN_CONVAI_DEFAULT_AGENT_ID?.trim();
    if (pinned) assert(afterRestartBody.agentId === pinned, "Tras el reinicio se conserva ELEVEN_CONVAI_DEFAULT_AGENT_ID");
    assertTts(await readAgentTts(afterRestartBody.agentId), restartSettings, "Agente admin tras reinicio");
  } else {
    console.log("(E2E_RESTART_CMD no definido: paso 7 de reinicio omitido; cubierto por voice-settings-lifecycle.test.ts con BD simulada)");
  }

  await page.waitForTimeout(500);
  await card.screenshot({ path: path.join(OUT, "02-saved.png") });

  assert(errors.length === 0, `Sin errores de página (${errors.length})`);
  console.log(`\nCapturas en ${OUT}`);
} catch (err) {
  exitCode = 1;
  console.error(`✗ ${err?.message || err}`);
} finally {
  if (testClient?.id) {
    const del = await ctx.request.delete(`${BASE}/api/admin/users/${testClient.id}`).catch(() => null);
    if (del?.ok()) console.log(`✓ Usuario de prueba ${testClient.email} borrado`);
    else {
      const r = await ctx.request.post(`${BASE}/api/admin/users/${testClient.id}/deactivate`).catch(() => null);
      console.log(`✗ No se pudo borrar el usuario de prueba (desactivado → ${r?.status()})`);
      exitCode = 1;
    }
  }
  // 4. Restaurar siempre los valores anteriores y aplicarlos en sitio.
  if (original) {
    const restore = await ctx.request.put(`${BASE}/api/voice/convai/voice-settings`, { data: original });
    console.log(restore.ok() ? `✓ Valores restaurados: ${JSON.stringify(original)}` : `✗ No se pudieron restaurar los valores (${restore.status()})`);
    if (!restore.ok()) exitCode = 1;
    else {
      const apply = await ctx.request.post(`${BASE}/api/voice/convai/voice-settings/apply`);
      console.log(apply.ok() ? "✓ Valores originales aplicados a los agentes existentes" : `✗ No se pudieron aplicar los valores originales (${apply.status()})`);
      if (!apply.ok()) exitCode = 1;
    }
  }
  await browser.close();
  process.exit(exitCode);
}
