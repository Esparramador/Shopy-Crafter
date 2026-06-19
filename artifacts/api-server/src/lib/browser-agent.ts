// ═══════════════════════════════════════════════════════════════════════════
// BROWSER AGENT — Control de navegador real con Puppeteer
// Permite al asistente navegar, buscar, hacer clic, escribir y hacer
// capturas de pantalla en cualquier página web.
//
// Chromium: /nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium
// ═══════════════════════════════════════════════════════════════════════════

import { logger } from "./logger.js";

const CHROMIUM_PATH =
  "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium";

const LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-extensions",
  "--disable-background-networking",
  "--no-first-run",
  "--mute-audio",
];

// ─── Tipos de step ──────────────────────────────────────────────────────────
export type BrowserStep =
  | { type: "navigate"; url: string }
  | { type: "type"; selector: string; text: string; clearFirst?: boolean }
  | { type: "click"; selector: string }
  | { type: "click_text"; text: string; tag?: string }
  | { type: "press"; key: string }
  | { type: "wait"; ms: number }
  | { type: "wait_for"; selector: string; timeout?: number }
  | { type: "screenshot"; label?: string }
  | { type: "get_url" }
  | { type: "get_text"; selector?: string }
  | { type: "scroll"; direction?: "down" | "up"; amount?: number }
  | { type: "search"; engine: "google" | "youtube" | "bing"; query: string }
  | { type: "hover"; selector: string }
  | { type: "select"; selector: string; value: string }
  | { type: "evaluate"; script: string };

export interface BrowserStepResult {
  step: BrowserStep;
  success: boolean;
  error?: string;
  screenshotBase64?: string;
  url?: string;
  text?: string;
  value?: unknown;
}

export interface BrowserAgentResult {
  success: boolean;
  goal: string;
  finalUrl?: string;
  screenshots: Array<{ label: string; base64: string }>;
  steps: BrowserStepResult[];
  extractedText?: string;
  summary: string;
  error?: string;
}

// ─── Search engine URL builders ─────────────────────────────────────────────
function buildSearchUrl(engine: "google" | "youtube" | "bing", query: string): string {
  const q = encodeURIComponent(query);
  switch (engine) {
    case "google":  return `https://www.google.com/search?q=${q}`;
    case "youtube": return `https://www.youtube.com/results?search_query=${q}`;
    case "bing":    return `https://www.bing.com/search?q=${q}`;
  }
}

// ─── Motor principal ─────────────────────────────────────────────────────────
export async function executeBrowserAgent(params: {
  goal: string;
  steps: BrowserStep[];
  viewport?: { width: number; height: number };
  timeout?: number;
}): Promise<BrowserAgentResult> {
  const { goal, steps, viewport = { width: 1280, height: 800 }, timeout = 30000 } = params;
  const screenshots: Array<{ label: string; base64: string }> = [];
  const stepResults: BrowserStepResult[] = [];
  let finalUrl: string | undefined;
  let extractedText: string | undefined;
  let browser: any = null;
  let page: any = null;

  try {
    const puppeteer = await import("puppeteer-core");
    browser = await puppeteer.default.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: LAUNCH_ARGS,
      timeout: timeout,
    });

    page = await browser.newPage();
    await page.setViewport(viewport);
    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"
    );

    // Inyectar helper para clic por texto
    const clickByText = async (searchText: string, tag = "*") => {
      try {
        await page.evaluate(
          (text: string, tagName: string) => {
            const elements = Array.from(document.querySelectorAll(tagName));
            const el = elements.find((e: any) =>
              (e.textContent || "").toLowerCase().includes(text.toLowerCase())
            ) as HTMLElement | undefined;
            if (el) el.click();
            else throw new Error(`Element with text "${text}" not found`);
          },
          searchText,
          tag
        );
      } catch {
        // Fallback: click via XPath
        const [handle] = await (page as any).$x(
          `//${tag}[contains(translate(text(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'${searchText.toLowerCase()}')]`
        );
        if (handle) await handle.click();
        else throw new Error(`Text not found: "${searchText}"`);
      }
    };

    for (const step of steps) {
      const stepResult: BrowserStepResult = { step, success: false };
      try {
        switch (step.type) {
          case "navigate": {
            await page.goto(step.url, { waitUntil: "domcontentloaded", timeout });
            await page.waitForTimeout?.(800).catch?.(() => {});
            finalUrl = page.url();
            stepResult.success = true;
            stepResult.url = finalUrl;
            break;
          }

          case "search": {
            const searchUrl = buildSearchUrl(step.engine, step.query);
            await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout });
            await new Promise(r => setTimeout(r, 1500));
            finalUrl = page.url();
            stepResult.success = true;
            stepResult.url = finalUrl;
            break;
          }

          case "type": {
            const el = await page.$(step.selector);
            if (!el) throw new Error(`Selector not found: ${step.selector}`);
            if (step.clearFirst) {
              await el.click({ clickCount: 3 });
              await el.press("Backspace");
            }
            await el.type(step.text, { delay: 40 });
            stepResult.success = true;
            break;
          }

          case "click": {
            await page.click(step.selector);
            await new Promise(r => setTimeout(r, 800));
            finalUrl = page.url();
            stepResult.success = true;
            stepResult.url = finalUrl;
            break;
          }

          case "click_text": {
            await clickByText(step.text, step.tag || "*");
            await new Promise(r => setTimeout(r, 1000));
            finalUrl = page.url();
            stepResult.success = true;
            stepResult.url = finalUrl;
            break;
          }

          case "hover": {
            await page.hover(step.selector);
            stepResult.success = true;
            break;
          }

          case "press": {
            await page.keyboard.press(step.key as any);
            await new Promise(r => setTimeout(r, 1200));
            finalUrl = page.url();
            stepResult.success = true;
            stepResult.url = finalUrl;
            break;
          }

          case "wait": {
            await new Promise(r => setTimeout(r, Math.min(step.ms, 10000)));
            stepResult.success = true;
            break;
          }

          case "wait_for": {
            await page.waitForSelector(step.selector, { timeout: step.timeout || 10000 });
            stepResult.success = true;
            break;
          }

          case "screenshot": {
            const buf = await page.screenshot({ type: "jpeg", quality: 75, fullPage: false });
            const b64 = Buffer.from(buf).toString("base64");
            const label = step.label || `Captura_${screenshots.length + 1}`;
            screenshots.push({ label, base64: b64 });
            stepResult.screenshotBase64 = b64;
            stepResult.success = true;
            break;
          }

          case "get_url": {
            finalUrl = page.url();
            stepResult.url = finalUrl;
            stepResult.success = true;
            break;
          }

          case "get_text": {
            const selector = step.selector || "body";
            const text = await page.evaluate((sel: string) => {
              const el = document.querySelector(sel);
              return el ? (el as HTMLElement).innerText?.slice(0, 3000) : document.body.innerText?.slice(0, 3000);
            }, selector);
            stepResult.text = text;
            stepResult.success = true;
            if (!extractedText) extractedText = text;
            break;
          }

          case "scroll": {
            const amount = step.amount || 500;
            const dir = step.direction || "down";
            await page.evaluate((a: number, d: string) => {
              window.scrollBy(0, d === "down" ? a : -a);
            }, amount, dir);
            await new Promise(r => setTimeout(r, 500));
            stepResult.success = true;
            break;
          }

          case "select": {
            await page.select(step.selector, step.value);
            stepResult.success = true;
            break;
          }

          case "evaluate": {
            const val = await page.evaluate(new Function(`return (${step.script})()`) as any);
            stepResult.value = val;
            stepResult.success = true;
            break;
          }
        }
      } catch (err) {
        stepResult.success = false;
        stepResult.error = err instanceof Error ? err.message : String(err);
        logger.warn({ step: step.type, error: stepResult.error }, "Browser step failed");
      }

      stepResults.push(stepResult);
    }

    // Screenshot final automático si no hay screenshots
    if (screenshots.length === 0) {
      try {
        const buf = await page.screenshot({ type: "jpeg", quality: 75 });
        screenshots.push({ label: "Estado_final", base64: Buffer.from(buf).toString("base64") });
      } catch { /* no crítico */ }
    }

    finalUrl = finalUrl || page.url();

    return {
      success: true,
      goal,
      finalUrl,
      screenshots,
      steps: stepResults,
      extractedText,
      summary: buildSummary(goal, stepResults, finalUrl),
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error({ error, goal }, "Browser agent failed");
    return {
      success: false,
      goal,
      screenshots,
      steps: stepResults,
      finalUrl,
      summary: `Error en el agente de navegador: ${error}`,
      error,
    };
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
  }
}

// ─── Resumen legible ─────────────────────────────────────────────────────────
function buildSummary(goal: string, steps: BrowserStepResult[], finalUrl?: string): string {
  const done = steps.filter(s => s.success).length;
  const total = steps.length;
  const navSteps = steps.filter(s => s.step.type === "navigate" || s.step.type === "search");
  const lastNav = navSteps[navSteps.length - 1];
  const domain = finalUrl ? (() => { try { return new URL(finalUrl).hostname; } catch { return finalUrl; } })() : "";
  return `✅ Tarea completada: "${goal}"\n🌐 ${done}/${total} pasos ejecutados\n🔗 URL final: ${finalUrl || "N/A"}\n📸 ${steps.filter(s => s.screenshotBase64).length} capturas tomadas`;
}

// ─── Detector de URL de YouTube ──────────────────────────────────────────────
export function extractYoutubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      return u.searchParams.get("v");
    }
    if (u.hostname === "youtu.be") {
      return u.pathname.slice(1);
    }
  } catch { /* ignore */ }
  return null;
}

// ─── Builder de steps comunes ────────────────────────────────────────────────
export const BrowserRecipes = {
  youtubeSearch: (query: string): BrowserStep[] => [
    { type: "navigate", url: "https://www.youtube.com" },
    { type: "wait", ms: 1000 },
    { type: "click", selector: "input#search" },
    { type: "type", selector: "input#search", text: query },
    { type: "press", key: "Enter" },
    { type: "wait", ms: 2000 },
    { type: "screenshot", label: "Resultados_YouTube" },
    { type: "click", selector: "ytd-video-renderer a#video-title" },
    { type: "wait", ms: 2000 },
    { type: "screenshot", label: "Video_YouTube" },
    { type: "get_url" },
  ],

  googleSearch: (query: string): BrowserStep[] => [
    { type: "navigate", url: `https://www.google.com/search?q=${encodeURIComponent(query)}` },
    { type: "wait", ms: 1500 },
    { type: "screenshot", label: "Resultados_Google" },
    { type: "get_text", selector: "#search" },
  ],

  openUrl: (url: string): BrowserStep[] => [
    { type: "navigate", url },
    { type: "wait", ms: 1500 },
    { type: "screenshot", label: "Página_abierta" },
    { type: "get_url" },
  ],

  webScrape: (url: string, selector?: string): BrowserStep[] => [
    { type: "navigate", url },
    { type: "wait", ms: 2000 },
    { type: "get_text", selector: selector || "main, article, body" },
    { type: "screenshot", label: "Página_scrapeada" },
  ],

  formFill: (url: string, fields: Array<{ selector: string; value: string }>): BrowserStep[] => [
    { type: "navigate", url },
    { type: "wait", ms: 1000 },
    ...fields.map(f => ({ type: "type" as const, selector: f.selector, text: f.value })),
    { type: "screenshot", label: "Formulario_rellenado" },
  ],
};
