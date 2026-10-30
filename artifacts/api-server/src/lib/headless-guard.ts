/**
 * Puppeteer renderiza HTML que viene de la IA, de clientes o de webs ajenas (PDFs,
 * tarjetas, capturas). Sin control, una <img src="http://169.254.169.254/…"> o
 * "http://localhost:8080/api/…" haría que el servidor pidiera recursos internos.
 * Aquí se dejan pasar solo data:/blob: y http(s) públicos (con comprobación de DNS).
 */
import { validateUrlWithDnsCheck } from "./web-scraper.js";

interface InterceptedRequest {
  url(): string;
  isInterceptResolutionHandled?(): boolean;
  continue(): Promise<void>;
  abort(reason?: string): Promise<void>;
}
interface GuardablePage {
  setRequestInterception(on: boolean): Promise<void>;
  on(event: "request", handler: (req: InterceptedRequest) => void): unknown;
}

export async function isAllowedHeadlessUrl(url: string): Promise<boolean> {
  if (/^(data|blob|about):/i.test(url)) return true;
  if (!/^https?:\/\//i.test(url)) return false;
  try { await validateUrlWithDnsCheck(url); return true; } catch { return false; }
}

export async function guardHeadlessPage(page: GuardablePage): Promise<void> {
  await page.setRequestInterception(true);
  page.on("request", req => {
    if (req.isInterceptResolutionHandled?.()) return;
    void isAllowedHeadlessUrl(req.url()).then(ok => (ok ? req.continue() : req.abort("blockedbyclient"))).catch(() => {});
  });
}
