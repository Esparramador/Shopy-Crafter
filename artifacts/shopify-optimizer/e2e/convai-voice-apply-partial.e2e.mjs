#!/usr/bin/env node
// E2E determinista de "Voz de Arturo" SIN tocar ElevenLabs ni guardar nada:
// las respuestas de /api/voice/convai/voice-settings* se simulan con page.route.
//
// Cubre:
//   #151 Fallo parcial: "Aplicar ajustes guardados" devuelve 502 con el agente
//        client en error y admin/landing aplicados → el panel muestra el detalle
//        por agente y "Reintentar fallidos (1)". El reintento envía SOLO
//        {agentTypes:["client"]}, no hace PUT (no vuelve a guardar) y no llama a
//        reset-agents (no recrea agentes).
//   #150 Tras recargar la página, el último informe (lastApply del GET) vuelve a
//        mostrarse con el fallido reintentable.
//   #145 Un PUT que responde 409 voice_settings_conflict muestra el aviso con
//        "Recargar lo guardado" / "Guardar mi ajuste de todos modos", y confirmar
//        reenvía el PUT con la versión nueva.
//
// Necesita una sesión de admin real (solo para entrar en el panel).
// Uso: ADMIN_PASSWORD=… node e2e/convai-voice-apply-partial.e2e.mjs
// Env: ADMIN_PASSWORD (obligatoria), E2E_ADMIN_EMAIL, E2E_BASE_URL, E2E_CHROMIUM.
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const BASE = (process.env.E2E_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`).replace(/\/$/, "");
const EMAIL = process.env.E2E_ADMIN_EMAIL || "craftershopy@gmail.com";
const PASSWORD = process.env.ADMIN_PASSWORD;

function fail(msg) { console.error(`✗ ${msg}`); process.exit(1); }
function ok(msg) { console.log(`✓ ${msg}`); }
function assert(cond, msg) { if (!cond) throw new Error(msg); ok(msg); }
if (!PASSWORD) fail("ADMIN_PASSWORD no está definido en el entorno");

function chromiumPath() {
  if (process.env.E2E_CHROMIUM) return process.env.E2E_CHROMIUM;
  try { return execSync("which chromium", { encoding: "utf8" }).trim(); } catch { return undefined; }
}

const settings = { stability: 0.5, similarityBoost: 0.8, speed: 1.2 };
const baseInfo = {
  settings, source: "db", invalid: [], history: [],
  defaults: settings,
  limits: { stability: { min: 0, max: 1, step: 0.05 }, similarityBoost: { min: 0, max: 1, step: 0.05 }, speed: { min: 0.7, max: 1.2, step: 0.05 } },
  voiceId: "test-voice", modelId: "eleven_turbo_v2_5", previewText: "Hola", version: "v1", lastApply: null,
};
const partial = {
  admin: { agentId: "agent-admin", status: "applied" },
  client: { agentId: "agent-client", status: "error", error: "ElevenLabs ConvAI update 500: simulado" },
  landing: { agentId: "agent-landing", status: "applied" },
};
const report = (agents) => ({ settingsVersion: "v1", updatedAt: new Date().toISOString(), updatedBy: EMAIL, agents });

const browser = await chromium.launch({ executablePath: chromiumPath(), headless: true, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });
let exitCode = 0;
try {
  const login = await ctx.request.post(`${BASE}/api/auth/login`, { data: { email: EMAIL, password: PASSWORD } });
  if (!login.ok()) fail(`Login admin ${EMAIL} → ${login.status()}`);
  const projects = await (await ctx.request.get(`${BASE}/api/projects`)).json();
  if (!Array.isArray(projects) || !projects.length) fail("no hay proyectos para abrir Fusion Studio Pro");

  // Estado simulado del servidor.
  let savedReport = null;
  const applyBodies = [];
  const puts = [];
  let resets = 0;
  let conflictOnce = false;

  const page = await ctx.newPage();
  await page.route("**/api/voice/convai/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    if (p.endsWith("/voice-settings/apply")) {
      const body = req.postDataJSON?.() ?? null;
      applyBodies.push(body);
      if (!body?.agentTypes) {
        savedReport = report(partial);
        return route.fulfill({ status: 502, json: { success: false, error: "No se pudieron aplicar los ajustes a todos los agentes.", agents: partial, report: savedReport } });
      }
      const agents = Object.fromEntries(body.agentTypes.map(t => [t, { agentId: `agent-${t}`, status: "applied" }]));
      savedReport = report({ ...savedReport.agents, ...agents });
      return route.fulfill({ status: 200, json: { success: true, agents, report: savedReport } });
    }
    if (p.endsWith("/voice-settings") && req.method() === "PUT") {
      const body = req.postDataJSON();
      puts.push(body);
      if (conflictOnce) {
        conflictOnce = false;
        return route.fulfill({ status: 409, json: {
          error: "Otro administrador ha cambiado la voz desde que abriste el formulario.", code: "voice_settings_conflict",
          current: { settings: { ...settings, stability: 0.3 }, version: "v2", lastChange: { id: "9", changedAt: new Date().toISOString(), userId: "b", userName: "Otro Admin", userEmail: "", settings: { ...settings, stability: 0.3 } } },
        } });
      }
      return route.fulfill({ status: 200, json: { ...baseInfo, settings: { stability: body.stability, similarityBoost: body.similarityBoost, speed: body.speed }, version: "v3", saved: true } });
    }
    if (p.endsWith("/voice-settings")) return route.fulfill({ status: 200, json: { ...baseInfo, lastApply: savedReport } });
    if (p.endsWith("/reset-agents")) { resets++; return route.fulfill({ status: 500, json: { error: "no debería llamarse" } }); }
    if (p.endsWith("/health")) return route.fulfill({ status: 200, json: { healthy: false, degraded: false, checkedAt: new Date().toISOString(), voice: { voiceId: "test-voice", ok: true }, agents: [] } });
    if (p.endsWith("/agents")) return route.fulfill({ status: 200, json: { agents: [] } });
    return route.continue();
  });
  await page.addInitScript(() => localStorage.setItem("shopycrafter_coach_dismissed", "1"));

  async function openCard() {
    await page.goto(`${BASE}/projects/${projects[0].id}/fusion-studio-pro`, { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: "#replit-dev-banner{display:none!important}" });
    await page.locator("button", { hasText: "Audio AI Tools" }).first().click();
    await page.locator("button", { hasText: "ConvAI Agents" }).first().click();
    await page.getByTestId("convai-voice-tuning-speed").waitFor({ state: "visible", timeout: 20_000 });
  }

  // #151 — fallo parcial
  await openCard();
  await page.getByTestId("convai-voice-tuning-apply-saved").click();
  await page.getByTestId("convai-voice-tuning-retry-failed").waitFor({ state: "visible", timeout: 15_000 });
  assert((await page.getByTestId("convai-voice-tuning-apply-client").textContent()).includes("Falló"), "El panel marca el agente de clientes como fallido");
  assert((await page.getByTestId("convai-voice-tuning-apply-admin").textContent()).includes("Actualizado"), "El panel marca admin como actualizado");
  assert((await page.getByTestId("convai-voice-tuning-apply-landing").textContent()).includes("Actualizado"), "El panel marca landing como actualizado");
  assert((await page.getByTestId("convai-voice-tuning-retry-failed").textContent()).includes("(1)"), "Ofrece reintentar solo 1 agente");

  // #150 — recargar conserva el informe
  await openCard();
  await page.getByTestId("convai-voice-tuning-retry-failed").waitFor({ state: "visible", timeout: 15_000 });
  assert((await page.getByTestId("convai-voice-tuning-apply-client").textContent()).includes("Falló"), "Tras recargar, el informe sigue mostrando el fallido");

  const putsBefore = puts.length;
  await page.getByTestId("convai-voice-tuning-retry-failed").click();
  await page.getByTestId("convai-voice-tuning-retry-failed").waitFor({ state: "detached", timeout: 15_000 });
  const retryBody = applyBodies[applyBodies.length - 1];
  assert(JSON.stringify(retryBody) === JSON.stringify({ agentTypes: ["client"] }), `El reintento solo pide el agente fallido (${JSON.stringify(retryBody)})`);
  assert(puts.length === putsBefore, "El reintento no vuelve a guardar los ajustes (sin PUT)");
  assert(resets === 0, "El reintento no recrea agentes (sin reset-agents)");
  assert((await page.getByTestId("convai-voice-tuning-apply-client").textContent()).includes("Actualizado"), "Tras el reintento, el de clientes aparece actualizado");

  // #145 — conflicto al guardar
  conflictOnce = true;
  await page.getByTestId("convai-voice-tuning-speed").evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(el, String(v));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, 1.0);
  await page.getByTestId("convai-voice-tuning-save").click();
  await page.getByTestId("convai-voice-tuning-conflict").waitFor({ state: "visible", timeout: 15_000 });
  assert(puts[puts.length - 1].expectedVersion === "v1", "El guardado envía la versión cargada");
  assert((await page.getByTestId("convai-voice-tuning-conflict").textContent()).includes("Otro Admin"), "El aviso dice quién cambió la voz");
  await page.getByTestId("convai-voice-tuning-conflict-confirm").click();
  await page.getByTestId("convai-voice-tuning-conflict").waitFor({ state: "detached", timeout: 15_000 });
  assert(puts[puts.length - 1].expectedVersion === "v2" && puts[puts.length - 1].speed === 1, "Confirmar reenvía el ajuste con la versión nueva");
} catch (err) {
  exitCode = 1;
  console.error(`✗ ${err?.message || err}`);
} finally {
  await browser.close();
  process.exit(exitCode);
}
