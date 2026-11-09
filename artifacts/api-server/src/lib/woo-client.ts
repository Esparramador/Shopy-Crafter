import type { Project } from "@workspace/db";
import { safeDecrypt } from "./crypto.js";

export class WooError extends Error {
  /** `status` es lo que responde NUESTRA API; `upstreamStatus`, lo que respondió la tienda (si respondió). */
  constructor(message: string, public status = 502, public upstreamStatus?: number, public upstreamCode?: string) { super(message); }
}

/**
 * Mensaje legible para un rechazo de la API REST de WooCommerce. Solo se usa el
 * `code` del error de WordPress (p. ej. `woocommerce_rest_cannot_view`) y los nombres de
 * parámetros inválidos: nunca el cuerpo, que puede llevar datos personales.
 */
export function describeWooRejection(method: string, status: number, code?: string, params?: string[]): string {
  const tail = code ? ` [${code}${params?.length ? `: ${params.join(", ")}` : ""}]` : "";
  if (status === 401) return `WooCommerce rechazó las credenciales (401)${tail}. Consumer Key/Secret incorrectos o revocados; si son correctos, el servidor puede estar eliminando la cabecera Authorization (Apache/CGI).`;
  if (status === 403) return `La clave de WooCommerce no tiene permiso para ${method} (403)${tail}. Genera una clave con permisos de Lectura/Escritura de un usuario administrador o gestor de tienda.`;
  if (status === 404) return `WooCommerce no encontró el recurso (404)${tail}. El ID no existe o la URL no expone /wp-json/wc/v3 (enlaces permanentes desactivados o no es WooCommerce).`;
  if (status === 400) return `WooCommerce rechazó los datos (400)${tail}.`;
  if (status === 429) return `WooCommerce limitó las peticiones (429)${tail}. Reintenta en unos segundos.`;
  return `WooCommerce rechazó ${method} (${status})${tail}. Revisa el recurso y sus datos.`;
}

const MUSCLE_FACTORY_KEY_REF = "envref:MUSCLE_FACTORY_WC_CONSUMER_KEY";
const MUSCLE_FACTORY_SECRET_REF = "envref:MUSCLE_FACTORY_WC_CONSUMER_SECRET";

/**
 * Development-only credentials stay in Replit Secrets; project rows store
 * references, never the secret values. References are deliberately restricted
 * to this store and are unusable outside the development server.
 */
export function resolveWooCredentials(project: Pick<Project, "clientId" | "clientSecret" | "shopDomain">) {
  const usesEnvReference =
    project.clientId.startsWith("envref:") || project.clientSecret.startsWith("envref:");

  if (usesEnvReference) {
    let hostname = "";
    try {
      const url = new URL(/^https?:\/\//i.test(project.shopDomain) ? project.shopDomain : `https://${project.shopDomain}`);
      hostname = url.hostname.toLowerCase();
    } catch {
      throw new WooError("La referencia de credenciales no es válida para esta tienda", 403);
    }

    if (
      process.env.NODE_ENV !== "development" ||
      hostname !== "musclefactorybcn.com" ||
      project.clientId !== MUSCLE_FACTORY_KEY_REF ||
      project.clientSecret !== MUSCLE_FACTORY_SECRET_REF
    ) {
      throw new WooError("La referencia de credenciales no está permitida en este entorno", 403);
    }

    const consumerKey = process.env.MUSCLE_FACTORY_WC_CONSUMER_KEY;
    const consumerSecret = process.env.MUSCLE_FACTORY_WC_CONSUMER_SECRET;
    if (!consumerKey || !consumerSecret) {
      throw new WooError("Faltan las credenciales WooCommerce de desarrollo", 422);
    }
    return { consumerKey, consumerSecret };
  }

  return {
    consumerKey: safeDecrypt(project.clientId) || project.clientId,
    consumerSecret: safeDecrypt(project.clientSecret) || project.clientSecret,
  };
}

export function wooId(value: unknown): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) throw new WooError("Identificador inválido", 400);
  return n;
}
/** One origin, no redirects and no credential-bearing URLs or upstream bodies in errors. */
export class WooClient {
  readonly origin: string;
  private auth: string;
  constructor(readonly project: Project, private transport: typeof fetch = fetch) {
    const u = new URL(/^https?:\/\//.test(project.shopDomain) ? project.shopDomain : `https://${project.shopDomain}`);
    if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash) throw new WooError("WooCommerce requiere una URL HTTPS sin credenciales", 400);
    this.origin = u.href.replace(/\/$/, "");
    const { consumerKey: key, consumerSecret: secret } = resolveWooCredentials(project);
    if (!key || !secret) throw new WooError("Conexión WooCommerce sin credenciales", 422);
    this.auth = `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`;
  }
  async raw(method: string, path: string, body?: unknown): Promise<Response> {
    if (!/^\/[a-z_]/i.test(path) || path.includes("..") || path.includes("\\") || path.includes("#")) throw new WooError("Ruta WooCommerce inválida", 400);
    let r: Response;
    try {
      r = await this.transport(`${this.origin}/wp-json/wc/v3${path}`, {
        method, redirect: "error", signal: AbortSignal.timeout(20_000),
        headers: { Authorization: this.auth, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (e) {
      if (method !== "GET" && method !== "OPTIONS") throw new WooError("Resultado de escritura desconocido. No repetir: comprobar primero en WooCommerce.", 502);
      const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      throw new WooError(timeout ? "WooCommerce no respondió a tiempo" : "No se pudo conectar con la tienda WooCommerce (DNS, certificado HTTPS o redirección)", timeout ? 504 : 502);
    }
    if (!r.ok) {
      let code: string | undefined, params: string[] | undefined;
      try {
        const body = await r.json() as { code?: unknown; data?: { params?: Record<string, unknown> } };
        if (typeof body?.code === "string" && /^[a-z0-9_]{1,80}$/i.test(body.code)) code = body.code;
        if (body?.data?.params && typeof body.data.params === "object") params = Object.keys(body.data.params).filter(k => /^[a-z0-9_.[\]]{1,60}$/i.test(k)).slice(0, 10);
      } catch { /* cuerpo no JSON: no se expone */ }
      throw new WooError(describeWooRejection(method, r.status, code, params), r.status === 401 || r.status === 403 ? 403 : r.status === 400 ? 400 : r.status === 404 ? 404 : 502, r.status, code);
    }
    return r;
  }
  async request<T = any>(method: string, path: string, body?: unknown): Promise<T> {
    const r = await this.raw(method, path, body);
    try { return await r.json() as T; } catch { throw new WooError("Respuesta WooCommerce no válida"); }
  }
  async page<T = any>(path: string, query: Record<string, string> = {}) {
    const q = new URLSearchParams(query);
    const r = await this.raw("GET", `${path}?${q}`);
    const data = await r.json();
    const total = Number(r.headers.get("x-wp-total"));
    const pages = Number(r.headers.get("x-wp-totalpages"));
    if (!Array.isArray(data) || !r.headers.has("x-wp-total") || !r.headers.has("x-wp-totalpages") || !Number.isSafeInteger(total) || !Number.isSafeInteger(pages) || total < 0 || pages < 0) throw new WooError("Listado sin paginación verificable");
    const page = Number(query.page || 1);
    return { data: data as T[], total, totalPages: pages, page, hasMore: page < pages, fetchedAt: new Date().toISOString(), source: this.origin };
  }
  async all<T = any>(path: string, query: Record<string, string> = {}, maxPages = 50): Promise<T[]> {
    const deadline = Date.now() + 90_000;
    const first = await this.page<T>(path, { ...query, per_page: "100", page: "1" });
    if (first.totalPages > maxPages) throw new WooError(`Lectura incompleta: límite de ${maxPages * 100} registros`);

    // WooCommerce exposes the page count in the first response. Fetch later pages
    // in small batches: this avoids a full round-trip per page without flooding the store.
    const pages = [first];
    const concurrency = 3;
    for (let start = 2; start <= first.totalPages; start += concurrency) {
      if (Date.now() > deadline) throw new WooError("Lectura incompleta: superado el tiempo máximo");
      const pageNumbers = Array.from(
        { length: Math.min(concurrency, first.totalPages - start + 1) },
        (_, i) => start + i,
      );
      const batch = await Promise.all(pageNumbers.map(page =>
        this.page<T>(path, { ...query, per_page: "100", page: String(page) }),
      ));
      for (let i = 0; i < batch.length; i++) {
        const result = batch[i]!;
        if (result.total !== first.total || result.totalPages !== first.totalPages || result.page !== pageNumbers[i]) {
          throw new WooError("El listado cambió durante la lectura; actualiza para conciliar");
        }
      }
      pages.push(...batch);
    }

    const out = pages.flatMap(result => result.data);
    if (out.length !== first.total) throw new WooError("Lectura incompleta: total y páginas no coinciden");
    return out;
  }
}
