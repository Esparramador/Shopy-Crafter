#!/usr/bin/env node
// E2E: formulario "Voz de Arturo" (Fusion Studio Pro → Audio AI Tools → ConvAI Agents).
//
// Comprueba, con sesión real de admin y contra ElevenLabs:
//   1. La tarjeta carga los valores actuales del servidor (sliders + badge de origen).
//   2. "Escuchar muestra" obtiene audio/mpeg del endpoint de previsualización.
//   3. Mover un slider habilita "Guardar y aplicar ahora"; el servidor persiste
//      el valor y aplica/verifica los tres agentes existentes sin recrearlos.
//   4. Se restauran los valores anteriores al terminar (siempre, también si falla).
//
// Uso: ADMIN_PASSWORD=… node e2e/convai-voice-tuning.e2e.mjs
// Env: ADMIN_PASSWORD (obligatoria), E2E_ADMIN_EMAIL, E2E_BASE_URL, E2E_CHROMIUM.

import { chromium } from "playwright";
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
  page.on("pageerror", (e) => errors.push(String(e)));
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
  const after = (await (await ctx.request.get(`${BASE}/api/voice/convai/voice-settings`)).json()).settings;
  assert(after.speed === newSpeed && after.stability === original.stability, `El servidor persistió speed=${after.speed}`);
  await page.getByTestId("convai-voice-tuning-source").filter({ hasText: "Guardado en el panel" }).waitFor({ timeout: 15_000 });
  ok("El badge de origen indica 'Guardado en el panel'");
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
  await page.waitForTimeout(500);
  await card.screenshot({ path: path.join(OUT, "02-saved.png") });

  assert(errors.length === 0, `Sin errores de página (${errors.length})`);
  console.log(`\nCapturas en ${OUT}`);
} catch (err) {
  exitCode = 1;
  console.error(`✗ ${err?.message || err}`);
} finally {
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
