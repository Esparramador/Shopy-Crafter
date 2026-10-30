#!/usr/bin/env node
// E2E: formulario "Voz de Arturo" (Fusion Studio Pro → Audio AI Tools → ConvAI Agents).
//
// Comprueba, con sesión real de admin y contra ElevenLabs:
//   1. La tarjeta carga los valores actuales del servidor (sliders + badge de origen).
//   2. "Escuchar muestra" obtiene audio/mpeg del endpoint de previsualización.
//   3. Mover un slider habilita "Guardar"; al guardar, el servidor persiste el valor
//      y la tarjeta de salud pasa a "drift" (la próxima llamada lo aplica).
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
  assert(!(await page.getByTestId("convai-voice-tuning-save").isDisabled()), "Guardar se habilita al cambiar un slider");
  const saveResp = page.waitForResponse(r => r.url().includes("/api/voice/convai/voice-settings") && r.request().method() === "PUT", { timeout: 30_000 });
  await page.getByTestId("convai-voice-tuning-save").click();
  const sr = await saveResp;
  assert(sr.status() === 200, `Guardar → HTTP ${sr.status()}`);
  const after = (await (await ctx.request.get(`${BASE}/api/voice/convai/voice-settings`)).json()).settings;
  assert(after.speed === newSpeed && after.stability === original.stability, `El servidor persistió speed=${after.speed}`);
  await page.getByTestId("convai-voice-tuning-source").filter({ hasText: "Guardado en el panel" }).waitFor({ timeout: 15_000 });
  ok("El badge de origen indica 'Guardado en el panel'");
  // La salud debe reflejar deriva (los agentes aún llevan el valor antiguo)
  const health = await (await ctx.request.get(`${BASE}/api/voice/convai/health`)).json();
  const drifted = (health.agents || []).filter(a => a.status === "drift").length;
  assert(drifted > 0 || (health.agents || []).every(a => a.status === "not_created"), `La salud detecta la deriva tras guardar (${drifted} agentes en drift)`);
  await page.waitForTimeout(500);
  await card.screenshot({ path: path.join(OUT, "02-saved.png") });

  assert(errors.length === 0, `Sin errores de página (${errors.length})`);
  console.log(`\nCapturas en ${OUT}`);
} catch (err) {
  exitCode = 1;
  console.error(`✗ ${err?.message || err}`);
} finally {
  // 4. Restaurar siempre los valores anteriores y re-sincronizar el agente admin.
  if (original) {
    const restore = await ctx.request.put(`${BASE}/api/voice/convai/voice-settings`, { data: original });
    console.log(restore.ok() ? `✓ Valores restaurados: ${JSON.stringify(original)}` : `✗ No se pudieron restaurar los valores (${restore.status()})`);
    if (!restore.ok()) exitCode = 1;
  }
  await browser.close();
  process.exit(exitCode);
}
