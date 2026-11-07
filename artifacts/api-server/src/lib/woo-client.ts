import type { Project } from "@workspace/db";
import { safeDecrypt } from "./crypto.js";

export class WooError extends Error {
  constructor(message: string, public status = 502) { super(message); }
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
    } catch { throw new WooError(method === "GET" || method === "OPTIONS" ? "WooCommerce no respondió a tiempo" : "Resultado de escritura desconocido. No repetir: comprobar primero en WooCommerce.", 502); }
    if (!r.ok) throw new WooError(`WooCommerce rechazó ${method} (${r.status}). ${r.status === 401 || r.status === 403 ? "Comprueba los permisos de la conexión." : "Revisa el recurso y sus datos."}`, r.status === 401 || r.status === 403 ? 403 : r.status === 400 ? 400 : 502);
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
    const out: T[] = [];
    const deadline = Date.now() + 90_000;
    let expected: number | undefined;
    for (let p = 1; p <= maxPages; p++) {
      if (Date.now() > deadline) throw new WooError("Lectura incompleta: superado el tiempo máximo");
      const r = await this.page<T>(path, { ...query, per_page: "100", page: String(p) });
      if (expected !== undefined && r.total !== expected) throw new WooError("El listado cambió durante la lectura; actualiza para conciliar");
      expected = r.total;
      out.push(...r.data);
      if (!r.hasMore) {
        if (out.length !== r.total) throw new WooError("Lectura incompleta: total y páginas no coinciden");
        return out;
      }
    }
    throw new WooError(`Lectura incompleta: límite de ${maxPages * 100} registros`);
  }
}
