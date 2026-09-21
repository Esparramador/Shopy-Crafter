#!/usr/bin/env node
// E2E real en navegador de la llamada de voz "Arturo" (ElevenLabs ConvAI) del
// chatbot admin. Usa micrófono FALSO de Chromium (--use-fake-device-for-media-stream)
// y verifica lo que ninguna prueba unitaria puede: que el handshake anuncia
// pcm_16000 en ambos sentidos, que llegan frames "audio" y que el modal pasa
// por connecting → connected → speaking sin el aviso de "sin audio".
//
// Uso:
//   ADMIN_PASSWORD=… node e2e/convai-voice-call.e2e.mjs
// Variables opcionales:
//   E2E_BASE_URL      (por defecto https://$REPLIT_DEV_DOMAIN)
//   E2E_ADMIN_EMAIL   (por defecto craftershopy@gmail.com)
//   E2E_CHROMIUM      ruta al binario de Chromium (por defecto `which chromium`)
//   E2E_ERROR_API_URL URL base de un api-server arrancado con
//                     ELEVEN_CONVAI_VOICE_ID apuntando a una voz clonada; si se
//                     define, también se comprueba el camino de error
//                     (503 voice_not_allowed_on_plan) en el modal.
//   E2E_SCREENSHOT_DIR carpeta para capturas (por defecto /tmp/convai-e2e)
//
// Es una llamada REAL (consume créditos ElevenLabs): se cuelga en cuanto Arturo
// ha contestado a la frase inyectada.
//
// "Entiende al usuario": el micrófono falso reproduce e2e/fixtures/user-phrase-16k.wav
// (7 s de silencio para dejar pasar el saludo del agente + la frase
// "Hola Arturo. ¿Me escuchas bien? Por favor, di la palabra melocotón." + silencio).
// Se exige que ElevenLabs devuelva un user_transcript con esa frase y, DESPUÉS,
// un agent_response con audio: eso solo ocurre si los user_audio_chunk PCM16
// enviados por el navegador se transcriben correctamente.
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BASE = (process.env.E2E_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`).replace(/\/$/, "");
const EMAIL = process.env.E2E_ADMIN_EMAIL || "craftershopy@gmail.com";
const PASSWORD = process.env.ADMIN_PASSWORD;
const ERROR_API = (process.env.E2E_ERROR_API_URL || "").replace(/\/$/, "");
const SHOTS = process.env.E2E_SCREENSHOT_DIR || "/tmp/convai-e2e";
const CALL_TIMEOUT_MS = 60_000;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIC_WAV = path.join(HERE, "fixtures", "user-phrase-16k.wav");
// Palabras de la frase inyectada que el ASR debe devolver (tolerante a variaciones).
const PHRASE_PATTERN = /melocot[oó]n|me escuchas/i;

if (!PASSWORD) fail("ADMIN_PASSWORD no está definido en el entorno");
if (!existsSync(MIC_WAV)) fail(`No existe el fixture de micrófono ${MIC_WAV}`);
mkdirSync(SHOTS, { recursive: true });

function fail(msg) { console.error(`✗ ${msg}`); process.exit(1); }
function ok(msg) { console.log(`✓ ${msg}`); }
function assert(cond, msg) { if (!cond) fail(msg); ok(msg); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function chromiumPath() {
  if (process.env.E2E_CHROMIUM) return process.env.E2E_CHROMIUM;
  try { return execSync("which chromium", { encoding: "utf8" }).trim(); } catch { return undefined; }
}

const browser = await chromium.launch({
  executablePath: chromiumPath(),
  headless: true,
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    // %noloop: la frase se dice una sola vez (en bucle interrumpiría al agente sin parar).
    `--use-file-for-fake-audio-capture=${MIC_WAV}%noloop`,
    "--autoplay-policy=no-user-gesture-required",
    "--no-sandbox",
  ],
});

// Evidencia recogida durante la llamada
const consoleLines = [];
const consoleErrors = [];
const wsInfo = {
  opened: [], audioFrames: 0, audioAt: [], metadata: null, firstAudioAt: null, errors: [],
  micChunks: 0, micBytes: 0, userTranscripts: [], agentResponses: [], interruptions: 0,
};
const callUrlResponses = [];

try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  await context.grantPermissions(["microphone"], { origin: BASE });
  const page = await context.newPage();

  page.on("console", (m) => {
    const text = m.text();
    consoleLines.push(`[${m.type()}] ${text}`);
    if (m.type() === "error") consoleErrors.push(text);
  });
  page.on("websocket", (ws) => {
    wsInfo.opened.push(ws.url());
    ws.on("framereceived", (f) => {
      try {
        const msg = JSON.parse(String(f.payload));
        if (msg.type === "conversation_initiation_metadata") wsInfo.metadata = msg.conversation_initiation_metadata_event ?? {};
        if (msg.type === "audio" && msg.audio_event?.audio_base_64) {
          wsInfo.audioFrames += 1;
          wsInfo.audioAt.push(Date.now());
          if (!wsInfo.firstAudioAt) wsInfo.firstAudioAt = Date.now();
        }
        if (msg.type === "user_transcript") {
          const text = msg.user_transcription_event?.user_transcript ?? msg.user_transcript?.user_transcript ?? msg.user_transcript ?? "";
          if (typeof text === "string" && text) wsInfo.userTranscripts.push({ at: Date.now(), text });
        }
        if (msg.type === "agent_response") {
          const text = msg.agent_response_event?.agent_response ?? msg.agent_response?.agent_response ?? msg.agent_response ?? "";
          if (typeof text === "string" && text) wsInfo.agentResponses.push({ at: Date.now(), text });
        }
        if (msg.type === "interruption") wsInfo.interruptions += 1;
        if (msg.type === "error" || msg.type === "internal_error") wsInfo.errors.push(msg);
      } catch { /* frame binario / no JSON */ }
    });
    ws.on("framesent", (f) => {
      try {
        const msg = JSON.parse(String(f.payload));
        if (typeof msg.user_audio_chunk === "string" && msg.user_audio_chunk.length > 0) {
          wsInfo.micChunks += 1;
          wsInfo.micBytes += Math.floor(msg.user_audio_chunk.length * 3 / 4);
        }
      } catch { /* no JSON */ }
    });
  });
  page.on("response", async (r) => {
    if (r.url().includes("/api/voice/convai/call-url")) {
      let body = null; try { body = await r.json(); } catch {}
      callUrlResponses.push({ status: r.status(), body });
    }
  });

  // ── Login (API; la UI de login no es lo que se prueba) ─────────────────────
  const login = await page.request.post(`${BASE}/api/auth/login`, { data: { email: EMAIL, password: PASSWORD } });
  assert(login.ok(), `Login admin ${EMAIL} → ${login.status()}`);

  await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Abrir asistente Shopy Crafter" }).click({ timeout: 20_000 });
  const expand = page.getByRole("button", { name: "Expandir chat" });
  if (await expand.isVisible().catch(() => false)) await expand.click();
  await page.getByRole("button", { name: "Llamada de voz con IA" }).click({ timeout: 15_000 });
  await page.getByText("Asistente IA — Voz").waitFor({ timeout: 10_000 });
  ok("Modal de llamada abierto");

  // ── Llamada real ────────────────────────────────────────────────────────────
  const statesSeen = new Set();
  const stateOrder = []; // orden de primera aparición
  const stateLabels = ["Preparando asistente IA...", "Conectando...", "En llamada", "IA respondiendo"];
  const errorTexts = [
    "Llamada conectada pero sin audio del agente",
    "ElevenLabs cerró la llamada sin haber enviado audio",
    "No se pudo reproducir el audio",
    "No se pudo iniciar la reproducción",
    "ElevenLabs informó de un error",
    "Error de conexión WebSocket",
    "El agente no te oirá",
  ];
  const errorSeen = [];
  async function pollModal() {
    for (const l of stateLabels) {
      if (await page.getByText(l, { exact: true }).isVisible().catch(() => false)) {
        if (!statesSeen.has(l)) stateOrder.push(l);
        statesSeen.add(l);
      }
    }
    for (const t of errorTexts) if (await page.getByText(t, { exact: false }).isVisible().catch(() => false)) errorSeen.push(t);
  }

  await page.getByRole("button", { name: "Iniciar llamada" }).click();
  const started = Date.now();
  // Condición de éxito: transcripción del usuario con la frase inyectada, seguida
  // de una respuesta del agente (texto + audio) posterior a esa transcripción.
  const heardUser = () => wsInfo.userTranscripts.find(t => PHRASE_PATTERN.test(t.text)) ?? null;
  const answeredAfter = (t) => t && wsInfo.agentResponses.some(a => a.at >= t.at) && wsInfo.audioAt.some(x => x >= t.at);
  let midCallShot = false;
  while (Date.now() - started < CALL_TIMEOUT_MS) {
    await pollModal();
    if (!midCallShot && statesSeen.has("IA respondiendo")) { midCallShot = true; await page.screenshot({ path: `${SHOTS}/01-en-llamada.png` }); }
    if (answeredAfter(heardUser())) break;
    if (errorSeen.length) break;
    await sleep(200);
  }
  // Margen para que el modal pinte el transcript y el estado tras el último evento.
  for (let i = 0; i < 8; i++) { await sleep(250); await pollModal(); }
  await page.screenshot({ path: `${SHOTS}/03-transcript.png` });
  const heard = heardUser();
  const userBubble = heard ? await page.getByText(heard.text, { exact: false }).first().isVisible().catch(() => false) : false;

  // Colgar cuanto antes: llamada real.
  const hang = page.getByRole("button", { name: "Colgar" });
  // El botón "Colgar" pulsa con una animación CSS infinita: Playwright nunca lo
  // considera "estable", así que se fuerza el click.
  if (await hang.isVisible().catch(() => false)) await hang.click({ force: true, timeout: 5_000 });

  console.log("\n— Evidencia llamada —");
  console.log("  estados vistos:", [...statesSeen].join(" → ") || "(ninguno)");
  console.log("  call-url:", JSON.stringify(callUrlResponses.map(r => ({ status: r.status, agentId: r.body?.agentId, hasSignedUrl: !!r.body?.signed_url }))));
  console.log("  websockets:", wsInfo.opened.map(u => u.split("?")[0]));
  console.log("  metadata:", JSON.stringify(wsInfo.metadata));
  console.log("  audio frames:", wsInfo.audioFrames, wsInfo.firstAudioAt ? `(primero a los ${wsInfo.firstAudioAt - started} ms)` : "");
  console.log("  mic → ElevenLabs:", `${wsInfo.micChunks} user_audio_chunk (${(wsInfo.micBytes / 1024).toFixed(0)} KiB PCM16)`);
  console.log("  user_transcript:", JSON.stringify(wsInfo.userTranscripts.map(t => `+${t.at - started}ms ${t.text}`)));
  console.log("  agent_response:", JSON.stringify(wsInfo.agentResponses.map(a => `+${a.at - started}ms ${a.text.slice(0, 120)}`)));
  console.log("  interrupciones:", wsInfo.interruptions);
  const fmtLine = consoleLines.find(l => l.includes("ConvAI formats announced"));
  console.log("  consola formats:", fmtLine ?? "(no encontrado)");
  console.log("");

  assert(callUrlResponses.some(r => r.status === 200 && r.body?.signed_url), "GET /api/voice/convai/call-url → 200 con signed_url");
  assert(wsInfo.opened.some(u => u.includes("elevenlabs.io")), "Se abrió el WebSocket con ElevenLabs");
  assert(!!fmtLine, 'Consola: "ConvAI formats announced" registrado');
  assert(wsInfo.metadata?.agent_output_audio_format === "pcm_16000", `Metadata anuncia agent_output_audio_format=pcm_16000 (recibido: ${wsInfo.metadata?.agent_output_audio_format})`);
  assert(wsInfo.metadata?.user_input_audio_format === "pcm_16000", `Metadata anuncia user_input_audio_format=pcm_16000 (recibido: ${wsInfo.metadata?.user_input_audio_format})`);
  assert(wsInfo.audioFrames > 0, `Llegó audio del agente (${wsInfo.audioFrames} frames)`);
  // Secuencia de estados: provisioning → (connecting) → connected → speaking, en ese orden.
  // "Conectando..." puede durar menos que el muestreo (200 ms), por eso es opcional.
  const idx = (l) => stateOrder.indexOf(l);
  assert(idx("Preparando asistente IA...") === 0, `El primer estado fue provisioning (orden visto: ${stateOrder.join(" → ")})`);
  assert(idx("En llamada") > idx("Preparando asistente IA...") && (idx("Conectando...") === -1 || idx("Conectando...") < idx("En llamada")), "connected llegó después de provisioning/connecting");
  assert(idx("IA respondiendo") > idx("En llamada"), "speaking llegó después de connected");
  // El agente ENTIENDE al usuario: la frase inyectada por el micrófono vuelve transcrita
  // y el agente responde después de oírla.
  assert(wsInfo.micChunks > 0, `El navegador envió audio del micrófono (${wsInfo.micChunks} user_audio_chunk)`);
  assert(!!heard, `ElevenLabs transcribió la frase inyectada (${PHRASE_PATTERN}) — recibido: ${JSON.stringify(wsInfo.userTranscripts.map(t => t.text))}`);
  const reply = heard ? wsInfo.agentResponses.find(a => a.at >= heard.at) : null;
  assert(!!reply, `El agente respondió tras entender al usuario${reply ? `: "${reply.text.slice(0, 100)}"` : ""}`);
  assert(heard ? wsInfo.audioAt.some(x => x >= heard.at) : false, "Llegó audio del agente después de la transcripción del usuario");
  assert(userBubble, 'El transcript del modal muestra la burbuja "Tú" con la frase');
  assert(errorSeen.length === 0, `Sin mensajes de error en el modal ${errorSeen.length ? JSON.stringify(errorSeen) : ""}`);
  const convaiErrors = consoleErrors.filter(t => t.startsWith("ConvAI"));
  assert(convaiErrors.length === 0, `Sin console.error "ConvAI*" ${convaiErrors.length ? JSON.stringify(convaiErrors) : ""}`);
  assert(wsInfo.errors.length === 0, "ElevenLabs no envió eventos de error");

  // Tras colgar: el botón de inicio vuelve.
  await page.getByRole("button", { name: "Iniciar llamada" }).waitFor({ timeout: 5_000 });
  ok('Tras "Colgar" el modal vuelve a idle');

  // ── Camino de error: voz clonada no permitida por el plan ──────────────────
  if (ERROR_API) {
    // El backend de error es un api-server real arrancado con
    // ELEVEN_CONVAI_VOICE_ID=<voz clonada>. Comprobamos su respuesta con la
    // misma sesión y la inyectamos en la petición del modal, que así renderiza
    // exactamente lo que devolvería el backend en producción.
    const errLogin = await page.request.post(`${ERROR_API}/api/auth/login`, { data: { email: EMAIL, password: PASSWORD } });
    assert(errLogin.ok(), `Login en api-server de error → ${errLogin.status()}`);
    const errResp = await page.request.get(`${ERROR_API}/api/voice/convai/call-url`);
    const errBody = await errResp.json().catch(() => ({}));
    console.log("  error-api call-url:", errResp.status(), JSON.stringify(errBody).slice(0, 300));
    assert(errResp.status() === 503, `Backend con voz clonada responde 503 (recibido ${errResp.status()})`);
    assert(errBody.code === "voice_not_allowed_on_plan", `code=voice_not_allowed_on_plan (recibido ${errBody.code})`);
    assert(/clon instantáneo/.test(errBody.error || ""), "Mensaje explica que la voz es un clon instantáneo no permitido por el plan");

    const wsBefore = wsInfo.opened.length;
    await page.route("**/api/voice/convai/call-url*", (route) => route.fulfill({
      status: 503, contentType: "application/json", body: JSON.stringify(errBody),
    }));
    await page.getByRole("button", { name: "Iniciar llamada" }).click();
    const errLocator = page.getByText(errBody.error, { exact: true });
    await errLocator.waitFor({ timeout: 10_000 });
    await page.screenshot({ path: `${SHOTS}/02-error-voz-plan.png` });
    ok("El modal muestra el mensaje 503 del backend (voice_not_allowed_on_plan)");
    await page.getByRole("button", { name: "Reintentar" }).waitFor({ timeout: 3_000 });
    ok('Aparece el botón "Reintentar"');
    assert(wsInfo.opened.length === wsBefore, "No se abrió ningún WebSocket en el intento fallido");
    await page.unroute("**/api/voice/convai/call-url*");
  } else {
    console.log("(E2E_ERROR_API_URL no definido: camino de error omitido)");
  }

  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  console.log(`\nCapturas en ${SHOTS}`);
  console.log("TODO OK");
} finally {
  await browser.close();
}
