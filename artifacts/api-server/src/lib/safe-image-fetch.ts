import { logger } from "./logger.js";

/**
 * Descarga segura de una imagen remota con hardening completo de producción
 * (architect-PASS). Usado por endpoints que generan imágenes con servicios
 * externos (Replicate principalmente) cuyos URLs caducan en ~1h y por tanto
 * deben persistirse como bytes ANTES de devolverlos al usuario.
 *
 * Hardening aplicado:
 * - Anti-SSRF: allowlist estricta de hosts (replicate.delivery / *.replicate.delivery
 *   / replicate.com / *.replicate.com / api.replicate.com / cdn.replicate.com).
 * - Solo HTTPS.
 * - `redirect: "manual"` con bucle de hasta 4 saltos, validando cada `Location`
 *   contra la allowlist (cierra el bypass por cadena de 30x).
 * - Defensa en profundidad: revalida `imgRes.url` final tras la respuesta.
 * - Timeout único de 25s que cubre TODO el ciclo (headers + body), creado
 *   antes del primer fetch y limpiado solo en `finally`.
 * - Validación temprana de `Content-Length`.
 * - Stream con cutoff incremental: si el body excede el cap llama a
 *   `reader.cancel()` y aborta.
 * - MIME allowlist: `image/(jpeg|png|webp|gif)` — SVG bloqueado explícitamente
 *   porque puede contener scripts.
 */

const ALLOWED_HOSTS = new Set<string>([
  "replicate.delivery",
  "pbxt.replicate.delivery",
  "tjzk.replicate.delivery",
  "xezq.replicate.delivery",
  "replicate.com",
  "api.replicate.com",
  "cdn.replicate.com",
]);

const ALLOWED_MIME = /^image\/(jpe?g|png|webp|gif)$/i;

export function isReplicateUrlSafe(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (ALLOWED_HOSTS.has(host)) return true;
    if (host.endsWith(".replicate.delivery") || host.endsWith(".replicate.com")) return true;
    return false;
  } catch { return false; }
}

export interface SafeImageDownloadResult {
  buffer: Buffer;
  mime: string;
  sizeKB: number;
}

export interface SafeImageDownloadOptions {
  /** Cap duro en bytes (default 4MB). Para imágenes 1024px usar 4MB; para imágenes 1440px o 4K, subir a 15-20MB. */
  maxBytes?: number;
  /** Timeout total en ms (headers + body) (default 25_000). */
  timeoutMs?: number;
  /** Logger context tag (e.g. "[contact]" o "[images]"). */
  tag?: string;
  /** Permite ampliar la allowlist de MIME aceptados (no se recomienda añadir SVG). */
  allowedMime?: RegExp;
}

/**
 * Descarga una URL devuelta por Replicate y la entrega como Buffer + MIME
 * validado. Lanza si cualquier validación de seguridad falla; los callers
 * deben gestionar el error (típicamente: pasar al siguiente modelo de la
 * cascada, o caer al placeholder).
 */
export async function safeDownloadReplicateImage(
  initialUrl: string,
  opts: SafeImageDownloadOptions = {},
): Promise<SafeImageDownloadResult> {
  const tag = opts.tag ?? "[safe-image]";
  const maxBytes = opts.maxBytes ?? 4 * 1024 * 1024;
  const timeoutMs = opts.timeoutMs ?? 25_000;
  const allowedMime = opts.allowedMime ?? ALLOWED_MIME;

  if (!isReplicateUrlSafe(initialUrl)) {
    throw new Error(`URL fuera de allowlist anti-SSRF: ${(() => { try { return new URL(initialUrl).hostname; } catch { return "<invalid>"; } })()}`);
  }

  const dlCtrl = new AbortController();
  const dlTimer = setTimeout(() => dlCtrl.abort(), timeoutMs);
  try {
    let currentUrl = initialUrl;
    let imgRes: Response | null = null;

    for (let hop = 0; hop < 4; hop++) {
      const res = await fetch(currentUrl, { signal: dlCtrl.signal, redirect: "manual" });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) throw new Error(`30x sin Location (status ${res.status})`);
        const nextUrl = new URL(loc, currentUrl).toString();
        if (!isReplicateUrlSafe(nextUrl)) {
          throw new Error(`Redirect a host fuera de allowlist: ${(() => { try { return new URL(nextUrl).hostname; } catch { return "<invalid>"; } })()}`);
        }
        currentUrl = nextUrl;
        continue;
      }
      imgRes = res;
      break;
    }
    if (!imgRes) throw new Error("Demasiados redirects (>4)");
    if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);

    if (imgRes.url && !isReplicateUrlSafe(imgRes.url)) {
      throw new Error(`URL final fuera de allowlist: ${imgRes.url}`);
    }

    const cl = imgRes.headers.get("content-length");
    if (cl && Number(cl) > maxBytes) throw new Error(`Content-Length ${cl} > ${maxBytes}`);

    const ct = (imgRes.headers.get("content-type") || "image/jpeg").split(";")[0].trim().toLowerCase();
    if (!allowedMime.test(ct)) throw new Error(`MIME no permitido: ${ct}`);

    if (!imgRes.body) throw new Error("Sin body");

    const reader = imgRes.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          try { await reader.cancel(); } catch { /* ignore */ }
          throw new Error(`Stream excede ${maxBytes} bytes`);
        }
        chunks.push(value);
      }
    }
    const buffer = Buffer.concat(chunks.map(c => Buffer.from(c)));
    if (buffer.length < 1024) throw new Error(`Imagen demasiado pequeña: ${buffer.length}b`);
    const sizeKB = Math.round(buffer.length / 1024);
    logger.info({ mime: ct, sizeKB }, `${tag} ✅ image downloaded safely`);
    return { buffer, mime: ct, sizeKB };
  } finally {
    clearTimeout(dlTimer);
  }
}

/**
 * Variante que devuelve la imagen como `data:URI` base64, ideal para embebido
 * inline en HTML autocontenido (e.g. pre-informe del lead).
 */
export async function safeDownloadReplicateImageAsDataUri(
  initialUrl: string,
  opts: SafeImageDownloadOptions = {},
): Promise<{ dataUri: string; mime: string; sizeKB: number }> {
  const r = await safeDownloadReplicateImage(initialUrl, opts);
  return { dataUri: `data:${r.mime};base64,${r.buffer.toString("base64")}`, mime: r.mime, sizeKB: r.sizeKB };
}
