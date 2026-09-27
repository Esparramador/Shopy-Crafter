/**
 * Las rutas largas del API envían un latido cada 25 s para que el proxy no
 * corte la conexión; tras el primero la cabecera ya salió con HTTP 200, así que
 * un error posterior llega con el código real en el cuerpo (`__httpStatus`).
 * Este envoltorio de `fetch` restaura ese código para que `res.ok` sea fiable
 * en toda la app sin tocar cada llamada.
 */
export async function restoreLateStatus(res: Response): Promise<Response> {
  if (res.headers.get("X-Long-Running") !== "1" || res.status !== 200) return res;
  const ct = res.headers.get("Content-Type") ?? "";
  if (!ct.includes("application/json")) return res;
  const text = await res.text();
  let status = 200;
  try {
    const body = JSON.parse(text);
    const s = body && typeof body === "object" ? Number(body.__httpStatus) : NaN;
    if (Number.isInteger(s) && s >= 400 && s <= 599) status = s;
  } catch { /* cuerpo no JSON: se devuelve tal cual */ }
  return new Response(text, { status, statusText: status === 200 ? res.statusText : "", headers: res.headers });
}

export function installLongRunningFetchFix(): void {
  if (typeof window === "undefined" || (window.fetch as { __lrFix?: boolean }).__lrFix) return;
  const original = window.fetch.bind(window);
  const patched = (async (...args: Parameters<typeof fetch>) => restoreLateStatus(await original(...args))) as typeof fetch & { __lrFix?: boolean };
  patched.__lrFix = true;
  window.fetch = patched;
}
