#!/usr/bin/env node
// Revisión visual del chatbot del panel de cliente (ClientChatbot) en móvil,
// tablet y escritorio, con el chat compacto y expandido, más el modal de voz
// (VoiceCallModal modo cliente) a 375px.
//
// Comprueba con medidas reales de layout (getBoundingClientRect) lo que el E2E
// de voz no cubre (solo prueba 1280px):
//   - el panel cabe entero en el viewport (nada se sale por la derecha/abajo)
//   - la cabecera muestra los 5 controles (Proyecto, 📞, 🔊, expandir, ✕) sin
//     desbordar el panel ni solaparse entre sí
//   - el título es legible: sin recorte horizontal y en una sola línea
//   - el modal de voz queda centrado y dentro del viewport a 375px
//
// Uso:
//   ADMIN_PASSWORD=… node e2e/client-chatbot-layout.e2e.mjs
// Variables opcionales:
//   E2E_BASE_URL        (por defecto https://$REPLIT_DEV_DOMAIN)
//   E2E_ADMIN_EMAIL     (por defecto craftershopy@gmail.com)
//   E2E_CHROMIUM        ruta al binario de Chromium (por defecto `which chromium`)
//   E2E_SCREENSHOT_DIR  carpeta para capturas (por defecto /tmp/client-chatbot-layout)
//
// Igual que el E2E de voz, crea un usuario cliente efímero (email aleatorio,
// nunca datos reales) vía POST /api/admin/users y lo borra al terminar
// (DELETE /api/admin/users/:id; si falla, lo desactiva).
import { chromium } from "playwright";
import { nanoid } from "nanoid";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = (process.env.E2E_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`).replace(/\/$/, "");
const EMAIL = process.env.E2E_ADMIN_EMAIL || "craftershopy@gmail.com";
const PASSWORD = process.env.ADMIN_PASSWORD;
const SHOTS = process.env.E2E_SCREENSHOT_DIR || "/tmp/client-chatbot-layout";

const VIEWPORTS = [
  { name: "375", width: 375, height: 812 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 800 },
];
// Controles de la cabecera, identificados por su nombre accesible (ClientChatbot):
//   - escritorio expandido (540px): Proyecto, 📞, 🔊, expandir, ✕ inline
//   - escritorio compacto (400px):  📞, menú ⋯ (Proyecto + respuesta por voz), expandir, ✕
//   - móvil ≤480px (NARROW_MAX_PX): 📞, menú ⋯ (Proyecto + voz + expandir), ✕
const NARROW_MAX_PX = 480;
const CALL = { key: "voz-llamada", name: "Abrir consulta por voz" };
const MENU = { key: "menu", name: "Más opciones del chat" };
const EXPAND = { key: "expandir", name: /^(Expandir|Compactar) chat$/ };
const CLOSE = { key: "cerrar", name: "Cerrar chat" };
const CONTROLS = {
  expandedDesktop: [{ key: "proyecto", name: /Modo Proyecto$/ }, CALL, { key: "voz-respuesta", name: /respuesta por voz$/ }, EXPAND, CLOSE],
  compactDesktop: [CALL, MENU, EXPAND, CLOSE],
  narrow: [CALL, MENU, CLOSE],
};
const MENU_ITEMS = [
  { role: "menuitemcheckbox", name: "Modo Proyecto" },
  { role: "menuitemcheckbox", name: "Respuesta por voz" },
  { role: "menuitem", name: /^(Expandir|Compactar) chat$/, narrowOnly: true },
];

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

const rectOf = (loc) => loc.evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
});
const inside = (inner, outer, tol = 0.5) =>
  inner.x >= outer.x - tol && inner.y >= outer.y - tol && inner.right <= outer.right + tol && inner.bottom <= outer.bottom + tol;
const overlap = (a, b) => a.x < b.right - 0.5 && b.x < a.right - 0.5 && a.y < b.bottom - 0.5 && b.y < a.bottom - 0.5;
const fmt = (r) => `x=${r.x.toFixed(0)} y=${r.y.toFixed(0)} w=${r.w.toFixed(0)} h=${r.h.toFixed(0)}`;

const browser = await chromium.launch({ executablePath: chromiumPath(), headless: true, args: ["--no-sandbox"] });
let testClient = null;
const adminCtx = await browser.newContext({ ignoreHTTPSErrors: true });

try {
  const adminLogin = await adminCtx.request.post(`${BASE}/api/auth/login`, { data: { email: EMAIL, password: PASSWORD } });
  if (!adminLogin.ok()) fail(`Login admin ${EMAIL} → ${adminLogin.status()}`);
  const tag = nanoid(10);
  testClient = { email: `e2e-layout-${tag.toLowerCase()}@e2e.invalid`, password: `E2e-${nanoid(18)}`, name: `E2E Layout ${tag}` };
  const created = await adminCtx.request.post(`${BASE}/api/admin/users`, {
    data: { email: testClient.email, name: testClient.name, role: "client", password: testClient.password },
  });
  const createdBody = await created.json().catch(() => ({}));
  if (!(created.ok() && createdBody.id)) fail(`No se pudo crear el cliente de prueba → ${created.status()}`);
  testClient.id = createdBody.id;
  ok(`Cliente de prueba ${testClient.email} creado`);

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.width < 500,
      hasTouch: vp.width < 500,
      deviceScaleFactor: vp.width < 500 ? 2 : 1,
    });
    const login = await context.request.post(`${BASE}/api/auth/login`, { data: { email: testClient.email, password: testClient.password } });
    if (!login.ok()) fail(`Login cliente → ${login.status()}`);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${BASE}/client`, { waitUntil: "domcontentloaded" });
    // El banner del dominio .replit.dev (solo desarrollo, no existe en producción)
    // se superpone a la cabecera cuando el panel ocupa toda la altura en móvil.
    await page.addStyleTag({ content: "#replit-dev-banner{display:none!important}" });

    const fab = page.locator("button.cb-fab");
    await fab.waitFor({ state: "visible", timeout: 20_000 });
    await fab.click({ force: true, timeout: 5_000 });
    const panel = page.locator(".cb-panel");
    await panel.waitFor({ state: "visible", timeout: 10_000 });
    await page.waitForTimeout(500); // animación de entrada

    const isNarrow = vp.width <= NARROW_MAX_PX;
    const openMenu = async () => {
      await page.getByRole("button", { name: "Más opciones del chat" }).click();
      await page.getByRole("menu").waitFor({ timeout: 5_000 });
    };

    for (const state of ["compacto", "expandido"]) {
      if (state === "expandido") {
        if (isNarrow) await openMenu();
        await page.getByRole(isNarrow ? "menuitem" : "button", { name: "Expandir chat", exact: true }).click();
        await page.waitForTimeout(450); // transición width/height 0.3s
        if (isNarrow) check(!(await page.getByRole("menu").isVisible().catch(() => false)), `[${vp.name}px] el menú ⋯ se cierra al elegir una opción`);
      }
      const label = `${vp.name}px ${state}`;
      const HEADER_CONTROLS = isNarrow ? CONTROLS.narrow : state === "expandido" ? CONTROLS.expandedDesktop : CONTROLS.compactDesktop;
      const viewport = { x: 0, y: 0, w: vp.width, h: vp.height, right: vp.width, bottom: vp.height };
      const panelRect = await rectOf(panel);
      check(inside(panelRect, viewport), `[${label}] panel dentro del viewport (${fmt(panelRect)})`);

      const rects = [];
      for (const c of HEADER_CONTROLS) {
        const btn = page.getByRole("button", { name: c.name });
        const visible = await btn.isVisible().catch(() => false);
        check(visible, `[${label}] control "${c.key}" visible`);
        if (!visible) continue;
        const r = await rectOf(btn);
        rects.push({ key: c.key, r });
        check(inside(r, panelRect), `[${label}] control "${c.key}" dentro del panel (${fmt(r)})`);
        check(r.w >= 24 && r.h >= 24, `[${label}] control "${c.key}" con tamaño táctil ≥24px (${r.w.toFixed(0)}×${r.h.toFixed(0)})`);
      }
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
        check(!overlap(rects[i].r, rects[j].r), `[${label}] "${rects[i].key}" no se solapa con "${rects[j].key}"`);
      }

      const title = page.locator(".cb-title");
      const t = await title.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { text: el.textContent, clipped: el.scrollWidth > el.clientWidth + 1, lines: Math.round(el.getBoundingClientRect().height / (parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2)) };
      });
      check(!t.clipped && t.lines === 1, `[${label}] título "${t.text}" legible en una línea (recortado=${t.clipped}, líneas=${t.lines})`);
      const titleRect = await rectOf(title);
      for (const { key, r } of rects) check(!overlap(titleRect, r), `[${label}] título no se solapa con "${key}"`);

      const file = path.join(SHOTS, `chat-${vp.name}-${state}.png`);
      await page.screenshot({ path: file });
      console.log(`  captura → ${file}`);

      if (state === "compacto") {
        // El menú ⋯ muestra los controles secundarios, dentro del viewport y con altura táctil.
        await openMenu();
        const menuRect = await rectOf(page.getByRole("menu"));
        check(inside(menuRect, viewport), `[${label}] menú ⋯ dentro del viewport (${fmt(menuRect)})`);
        for (const { role, name, narrowOnly } of MENU_ITEMS) {
          const item = page.getByRole(role, { name });
          const visible = await item.isVisible().catch(() => false);
          if (narrowOnly && !isNarrow) { check(!visible, `[${label}] "Expandir chat" NO está en el menú en escritorio (va inline)`); continue; }
          check(visible, `[${label}] opción de menú "${name}" visible`);
          if (visible) { const r = await rectOf(item); check(r.h >= 40, `[${label}] opción "${name}" con altura táctil ≥40px (${r.h.toFixed(0)})`); }
        }
        const menuFile = path.join(SHOTS, `chat-${vp.name}-menu.png`);
        await page.screenshot({ path: menuFile });
        console.log(`  captura → ${menuFile}`);
        await page.keyboard.press("Escape");
        check(!(await page.getByRole("menu").isVisible().catch(() => false)), `[${label}] el menú ⋯ se cierra con Escape`);
      }
    }

    if (vp.width === 375) {
      // Modal de voz en modo cliente: centrado y usable a 375px.
      await page.getByRole("button", { name: "Abrir consulta por voz", exact: true }).click();
      const modalTitle = page.getByText("Consultar Informes — Voz");
      await modalTitle.waitFor({ timeout: 10_000 });
      await page.waitForTimeout(300);
      const card = modalTitle.locator("xpath=ancestor::div[contains(@style,'border-radius')][1]");
      const cardRect = await rectOf(card);
      const viewport = { x: 0, y: 0, w: vp.width, h: vp.height, right: vp.width, bottom: vp.height };
      check(inside(cardRect, viewport), `[375px modal] tarjeta dentro del viewport (${fmt(cardRect)})`);
      const centerDx = Math.abs((cardRect.x + cardRect.w / 2) - vp.width / 2);
      check(centerDx <= 2, `[375px modal] tarjeta centrada horizontalmente (desvío ${centerDx.toFixed(1)}px)`);
      const start = page.getByRole("button", { name: "Consultar por voz", exact: true });
      check(await start.isVisible(), `[375px modal] botón "Consultar por voz" visible`);
      const startRect = await rectOf(start);
      check(inside(startRect, viewport), `[375px modal] botón "Consultar por voz" dentro del viewport (${fmt(startRect)})`);
      check(startRect.h <= 50, `[375px modal] texto del botón "Consultar por voz" en una sola línea (alto ${startRect.h.toFixed(0)}px)`);
      const file = path.join(SHOTS, `voice-modal-375.png`);
      await page.screenshot({ path: file });
      console.log(`  captura → ${file}`);
      await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    }

    check(errors.length === 0, `[${vp.name}px] sin errores de página (${errors.slice(0, 2).join(" | ")})`);
    await context.close();
  }
} finally {
  if (testClient?.id) {
    const del = await adminCtx.request.delete(`${BASE}/api/admin/users/${testClient.id}`).catch(() => null);
    if (del?.ok()) {
      console.log(`  cliente de prueba ${testClient.email} borrado → ${del.status()}`);
    } else {
      const r = await adminCtx.request.post(`${BASE}/api/admin/users/${testClient.id}/deactivate`).catch(() => null);
      console.warn(`  DELETE del cliente de prueba falló (${del ? del.status() : "error"}); desactivado → ${r ? r.status() : "error"}`);
      failures.push("limpieza del cliente de prueba (DELETE falló)");
    }
  }
  await browser.close();
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} comprobación(es) fallida(s)`);
  process.exit(1);
}
console.log(`\n✓ Layout del chatbot de cliente correcto en ${VIEWPORTS.map(v => v.name + "px").join(", ")} (compacto + expandido) y modal de voz a 375px`);
