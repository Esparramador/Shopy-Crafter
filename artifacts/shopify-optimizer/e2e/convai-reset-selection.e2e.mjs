#!/usr/bin/env node
// UI regression test: the ConvAI reset request contains only checked agents,
// and an empty selection cannot submit.
//
// Usage: ADMIN_PASSWORD=… pnpm --filter @workspace/shopify-optimizer run e2e:convai-reset-selection
// Env: ADMIN_PASSWORD, optional E2E_ADMIN_EMAIL, E2E_BASE_URL, E2E_CHROMIUM.

import { chromium } from "playwright";
import { execSync } from "node:child_process";

const BASE = (process.env.E2E_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN || ""}`).replace(/\/$/, "");
const EMAIL = process.env.E2E_ADMIN_EMAIL || "craftershopy@gmail.com";
const PASSWORD = process.env.ADMIN_PASSWORD;

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

function chromiumPath() {
  if (process.env.E2E_CHROMIUM) return process.env.E2E_CHROMIUM;
  try { return execSync("which chromium", { encoding: "utf8" }).trim(); } catch { return undefined; }
}

if (!BASE || BASE === "https:") throw new Error("Define E2E_BASE_URL o REPLIT_DEV_DOMAIN");
if (!PASSWORD) throw new Error("ADMIN_PASSWORD no está definido en el entorno");

const browser = await chromium.launch({
  executablePath: chromiumPath(),
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });
let exitCode = 0;

try {
  const login = await context.request.post(`${BASE}/api/auth/login`, {
    data: { email: EMAIL, password: PASSWORD },
  });
  assert(login.ok(), `Inicio de sesión de administrador → HTTP ${login.status()}`);

  const page = await context.newPage();
  let resetRequests = 0;
  let submittedPayload = null;

  await page.route("**/api/voice/convai/agents", route => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ agents: [] }) });
    }
    return route.continue();
  });
  await page.route("**/api/voice/convai/health", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      healthy: false,
      degraded: true,
      checkedAt: new Date().toISOString(),
      voice: { voiceId: "test-voice", ok: true },
      agents: [
        { type: "admin", agentId: null, status: "not_created" },
        { type: "client", agentId: null, status: "not_created" },
        { type: "landing", agentId: null, status: "not_created" },
      ],
    }),
  }));
  await page.route("**/api/voice/convai/reset-agents", async route => {
    resetRequests += 1;
    submittedPayload = JSON.parse(route.request().postData() || "{}");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, agents: {} }),
    });
  });

  await page.goto(`${BASE}/fusion-studio-pro`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Audio AI Tools" }).first().click();
  await page.getByRole("button", { name: "ConvAI Agents" }).first().click();
  const adminCheckbox = page.getByTestId("convai-reset-agent-admin");
  const clientCheckbox = page.getByTestId("convai-reset-agent-client");
  const landingCheckbox = page.getByTestId("convai-reset-agent-landing");
  const resetButton = page.getByTestId("convai-health-resync");
  await resetButton.waitFor({ state: "visible" });

  // All agent types start selected. Leave only admin checked.
  await clientCheckbox.uncheck();
  await landingCheckbox.uncheck();
  assert(await adminCheckbox.isChecked(), "Panel admin permanece seleccionado");
  assert(!(await clientCheckbox.isChecked()) && !(await landingCheckbox.isChecked()), "Los otros dos agentes quedan desmarcados");

  await resetButton.click();
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="convai-health-resync"]');
    return button && !button.disabled;
  });
  assert(resetRequests === 1, "Se envía exactamente una solicitud de reinicio");
  assert(
    JSON.stringify(submittedPayload) === JSON.stringify({ agentTypes: ["admin"] }),
    `El payload contiene solo el agente marcado (${JSON.stringify(submittedPayload)})`,
  );

  // Remove the final selection and attempt a native button click. A disabled
  // button must not send a second reset request.
  await adminCheckbox.uncheck();
  assert(await resetButton.isDisabled(), "El botón de reinicio se deshabilita sin agentes seleccionados");
  await resetButton.evaluate(button => button.click());
  await page.waitForTimeout(100);
  assert(resetRequests === 1, "La selección vacía no envía otra solicitud");
} catch (error) {
  exitCode = 1;
  console.error(`✗ ${error?.message || error}`);
} finally {
  await browser.close();
  process.exit(exitCode);
}
