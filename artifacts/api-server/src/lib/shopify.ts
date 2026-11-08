import { db } from "@workspace/db";
import { projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { encrypt, safeDecrypt } from "./crypto.js";

/**
 * Versión única de la Admin API de Shopify. Shopify da soporte a cada versión 12
 * meses; había llamadas con 2024-01 y 2024-10 (sin soporte: Shopify las sirve
 * con la versión más antigua aún soportada, con cambios de comportamiento).
 */
export const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION?.trim() || "2026-01";

const SHOPIFY_FETCH_TIMEOUT = 45_000;
const TOKEN_OP_TIMEOUT = 20_000;
const TOKEN_FAILURE_COOLDOWN_MS: Record<ShopifyTokenFailureKind, number> = {
  store_unavailable: 6 * 60 * 60 * 1000,
  verification_required: 10 * 60 * 1000,
  access_denied: 10 * 60 * 1000,
  invalid_token: 2 * 60 * 1000,
  invalid_credentials: 30 * 60 * 1000,
  rate_limited: 60 * 1000,
  shopify_unavailable: 60 * 1000,
  network_error: 60 * 1000,
  unknown: 60 * 1000,
};

export class ShopifyAuthError extends Error {
  statusCode = 422;
  shopifyStatus?: number;
  failureKind?: ShopifyTokenFailureKind;

  constructor(message: string, options: { shopifyStatus?: number; failureKind?: ShopifyTokenFailureKind } = {}) {
    super(message);
    this.name = "ShopifyAuthError";
    this.shopifyStatus = options.shopifyStatus;
    this.failureKind = options.failureKind;
  }
}

export type ShopifyTokenFailureKind =
  | "store_unavailable"
  | "verification_required"
  | "access_denied"
  | "invalid_token"
  | "invalid_credentials"
  | "rate_limited"
  | "shopify_unavailable"
  | "network_error"
  | "unknown";

export interface ShopifyTokenValidation {
  valid: boolean;
  status: number | null;
  failureKind?: ShopifyTokenFailureKind;
  summary?: string;
}

const tokenRefreshesInFlight = new Map<number, Promise<string>>();
const recentTokenFailures = new Map<number, { error: ShopifyAuthError; retryAt: number }>();

export function getRecentShopifyTokenFailure(projectId: number): ShopifyAuthError | null {
  const recent = recentTokenFailures.get(projectId);
  if (!recent) return null;
  if (recent.retryAt <= Date.now()) {
    recentTokenFailures.delete(projectId);
    return null;
  }
  return recent.error;
}

export function clearRecentShopifyTokenFailure(projectId: number): void {
  recentTokenFailures.delete(projectId);
}

function classifyShopifyFailure(status: number, responseText: string): ShopifyTokenFailureKind {
  const text = String(responseText ?? "");
  if (status === 404 || /store unavailable|shop-404|there(?:'|’)s no store|this store is unavailable/i.test(text)) {
    return "store_unavailable";
  }
  if (status === 403 && /verifying your connection|verify(?:ing)? (?:that )?you are|security check|captcha/i.test(text)) {
    return "verification_required";
  }
  if (status === 403) return "access_denied";
  if (/invalid_client|invalid client|invalid credentials|unauthorized_client/i.test(text)) return "invalid_credentials";
  if (status === 401) return "invalid_token";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "shopify_unavailable";
  return "unknown";
}

/**
 * Resume una respuesta de error de Shopify: si es una página HTML (tienda cerrada, en pausa o
 * inexistente) devuelve una frase corta en vez de la página entera.
 */
export function resumenRespuestaShopify(texto: string): string {
  const t = String(texto || "");
  if (/<html|<!doctype/i.test(t)) {
    if (/shop-404|store unavailable|there(?:'|’)s no store|this store is unavailable|tienda no disponible/i.test(t)) return "store unavailable";
    const titulo = (t.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1];
    if (titulo && /password|opening soon|coming soon/i.test(titulo)) return "store password protected";
    return titulo ? titulo.trim().slice(0, 120) : "Shopify devolvió una página HTML";
  }
  return t.replace(/\s+/g, " ").trim().slice(0, 300);
}

/** Mensaje claro para la persona a partir de un error de Shopify (nunca HTML ni textos larguísimos). */
export function mensajeShopifyUsuario(err: unknown, shopDomain?: string | null): string {
  const m = err instanceof Error ? err.message : String(err ?? "");
  const tienda = shopDomain ? normalizeShopDomain(String(shopDomain)) : "la tienda";
  if (err instanceof ShopifyAuthError && err.failureKind === "verification_required") {
    return `Shopify está verificando el acceso a ${tienda}. No se han cambiado las credenciales; vuelve a intentarlo más tarde.`;
  }
  if (err instanceof ShopifyAuthError && err.failureKind === "access_denied") {
    return `Shopify ha bloqueado el acceso a ${tienda}. Revisa los permisos de la app o vuelve a intentarlo más tarde; no cambies las credenciales sin confirmarlo.`;
  }
  if (err instanceof ShopifyAuthError && err.failureKind === "invalid_credentials") {
    return `Shopify ha rechazado las credenciales de la app para ${tienda}. Revísalas en Configuración antes de cambiarlas.`;
  }
  if (/app_not_installed/i.test(m)) return "La app de Shopify está desinstalada en " + tienda + ". Reinstálala desde el panel de Shopify y vuelve a conectar la tienda.";
  if (/store unavailable|Token generation failed \(404\)|\(404\)/i.test(m)) return `La tienda ${tienda} no está disponible en Shopify (no existe, está cerrada o en pausa). Revisa el dominio .myshopify.com en Configuración o reactiva la tienda en Shopify.`;
  if (/password protected/i.test(m)) return `La tienda ${tienda} tiene la contraseña de tienda cerrada activada: Shopify no deja conectar hasta que se abra.`;
  if (/invalid_client|\((401|403)\)|unauthorized|forbidden/i.test(m)) return `Shopify ha rechazado las credenciales de la app para ${tienda} (Client ID o Client Secret). Revísalas en Configuración o renueva el token.`;
  if (err instanceof ShopifyAuthError) return `La conexión con ${tienda} ha caducado. Pulsa «Renovar token» o vuelve a conectar la tienda en Configuración.`;
  if (/timeout|aborted|ETIMEDOUT|ECONNRESET|fetch failed/i.test(m)) return `Shopify no ha respondido a tiempo (${tienda}). Vuelve a intentarlo en un momento.`;
  return "Error al conectar con Shopify: " + resumenRespuestaShopify(m);
}

export function normalizeShopDomain(domain: string): string {
  return domain.replace("https://", "").replace("http://", "").replace(/\/$/, "");
}

/**
 * Generates or renews a Shopify access token using client_credentials grant.
 * POST https://{shop}/admin/oauth/access_token
 *   grant_type=client_credentials&client_id=...&client_secret=...
 * Tokens expire in 12-24h. clientSecret must be PLAINTEXT (not encrypted).
 */
export async function refreshToken(
  projectId: number,
  shopDomain: string,
  clientId: string,
  clientSecret: string,
  options: { force?: boolean } = {}
): Promise<string> {
  const activeRefresh = tokenRefreshesInFlight.get(projectId);
  if (activeRefresh) return activeRefresh;
  if (options.force) {
    recentTokenFailures.delete(projectId);
  } else {
    const recentFailure = getRecentShopifyTokenFailure(projectId);
    if (recentFailure) throw recentFailure;
  }

  let refreshPromise: Promise<string>;
  refreshPromise = refreshTokenOnce(projectId, shopDomain, clientId, clientSecret)
    .then((token) => {
      recentTokenFailures.delete(projectId);
      return token;
    })
    .catch((err: unknown) => {
      if (err instanceof ShopifyAuthError && err.failureKind) {
        recentTokenFailures.set(projectId, {
          error: err,
          retryAt: Date.now() + TOKEN_FAILURE_COOLDOWN_MS[err.failureKind],
        });
      }
      throw err;
    })
    .finally(() => {
      if (tokenRefreshesInFlight.get(projectId) === refreshPromise) {
        tokenRefreshesInFlight.delete(projectId);
      }
    });
  tokenRefreshesInFlight.set(projectId, refreshPromise);
  return refreshPromise;
}

async function refreshTokenOnce(
  projectId: number,
  shopDomain: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const domain = normalizeShopDomain(shopDomain);
  const url = `https://${domain}/admin/oauth/access_token`;

  logger.info({ projectId, domain }, "Generating Shopify token via client_credentials");

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
    signal: AbortSignal.timeout(TOKEN_OP_TIMEOUT),
  });

  if (!resp.ok) {
    const text = await resp.text();
    const failureKind = resp.status === 401
      ? "invalid_credentials"
      : classifyShopifyFailure(resp.status, text);
    throw new ShopifyAuthError(
      `Token generation failed (${resp.status}): ${resumenRespuestaShopify(text)}`,
      { shopifyStatus: resp.status, failureKind }
    );
  }

  const data = (await resp.json()) as { access_token: string; expires_in?: number };
  const token = data.access_token;
  const expiresIn = data.expires_in ?? 86_400; // default 24h if not specified
  const expiresAtDate = new Date(Date.now() + expiresIn * 1000);

  await db
    .update(projectsTable)
    .set({ accessToken: encrypt(token), tokenExpiresAt: expiresAtDate })
    .where(eq(projectsTable.id, projectId));

  logger.info({ projectId, expiresAt: expiresAtDate }, "Token generated successfully");
  return token;
}

/**
 * Returns Shopify API headers for a project.
 * Auto-refreshes the token if it is missing, expired, or expires within 30 minutes.
 */
export async function getShopifyHeaders(projectId: number): Promise<Record<string, string>> {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) throw new Error(`Proyecto ${projectId} no encontrado`);

  const encryptedToken = project.accessToken;
  const expiresAt = project.tokenExpiresAt;

  // Refresh if: no token, no expiry date, or expiry within next 30 minutes
  const needsRefresh =
    !encryptedToken ||
    !expiresAt ||
    new Date(expiresAt) < new Date(Date.now() + 30 * 60 * 1000);

  let plainToken: string;
  if (needsRefresh) {
    const plainSecret = safeDecrypt(project.clientSecret) || project.clientSecret;
    plainToken = await refreshToken(projectId, project.shopDomain, project.clientId, plainSecret);
  } else {
    plainToken = safeDecrypt(encryptedToken) || encryptedToken!;
  }

  return {
    "X-Shopify-Access-Token": plainToken,
    "Content-Type": "application/json",
  };
}

const RETRY_DELAYS = [1000, 2000, 4000];

async function shopifyRetry<T>(fn: () => Promise<Response>, path: string, projectId: number): Promise<T> {
  let lastResp: Response | null = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    const resp = await fn();
    if (resp.status === 429 || (resp.status >= 500 && resp.status !== 501)) {
      lastResp = resp;
      if (attempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[attempt];
        logger.warn({ projectId, path, status: resp.status, attempt: attempt + 1, delay }, "Shopify transient error — retrying");
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
    }
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Shopify API error ${resp.status} at ${path}: ${resumenRespuestaShopify(text)}`);
    }
    return resp.json() as Promise<T>;
  }
  const text = lastResp ? await lastResp.text() : "Max retries exceeded";
  throw new Error(`Shopify API error after retries at ${path}: ${resumenRespuestaShopify(text)}`);
}

/**
 * Makes a Shopify Admin API request.
 * On 401 (expired/invalid token), auto-regenerates token and retries once.
 * On 429/5xx, retries up to 3 times with exponential backoff (1s/2s/4s).
 */
export async function shopifyRequest<T>(
  projectId: number,
  shopDomain: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const domain = normalizeShopDomain(shopDomain);
  const headers = await getShopifyHeaders(projectId);
  const url = `https://${domain}/admin/api/${SHOPIFY_API_VERSION}${path}`;

  const doFetch = (hdrs: Record<string, string>) => () =>
    fetch(url, {
      ...options,
      headers: { ...hdrs, ...(options.headers as Record<string, string> || {}) },
      signal: AbortSignal.timeout(SHOPIFY_FETCH_TIMEOUT),
    });

  try {
    return await shopifyRetry<T>(doFetch(headers), path, projectId);
  } catch (err) {
    if (err instanceof Error && err.message.includes("401")) {
      logger.warn({ projectId, url }, "Shopify 401 — force-regenerating token");
      const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
      if (!proj) throw new Error(`Project ${projectId} not found on 401 retry`);
      const plainSecret = safeDecrypt(proj.clientSecret) || proj.clientSecret;
      const newToken = await refreshToken(projectId, proj.shopDomain, proj.clientId, plainSecret);
      return shopifyRetry<T>(
        doFetch({ "X-Shopify-Access-Token": newToken, "Content-Type": "application/json" }),
        path,
        projectId
      );
    }
    throw err;
  }
}

/**
 * Shopify cursor-based pagination (REST Admin API 2022+).
 * Returns the page data AND the next page_info token extracted from the Link header.
 * Usage: pass `page_info` as the only pagination param on subsequent calls.
 * NOTE: when using page_info, do NOT include status/other filters — Shopify rejects them.
 */
export async function shopifyRequestPaged<T>(
  projectId: number,
  shopDomain: string,
  path: string,
): Promise<{ data: T; nextPageInfo: string | null }> {
  const domain = normalizeShopDomain(shopDomain);
  const hdrs = await getShopifyHeaders(projectId);
  const url = `https://${domain}/admin/api/${SHOPIFY_API_VERSION}${path}`;

  const doPagedFetch = async (fetchHeaders: Record<string, string>): Promise<{ data: T; nextPageInfo: string | null }> => {
    let lastResp: Response | null = null;
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      const resp = await fetch(url, {
        headers: fetchHeaders,
        signal: AbortSignal.timeout(SHOPIFY_FETCH_TIMEOUT),
      });

      if (resp.status === 429 || (resp.status >= 500 && resp.status !== 501)) {
        lastResp = resp;
        if (attempt < RETRY_DELAYS.length) {
          const delay = RETRY_DELAYS[attempt];
          logger.warn({ projectId, path, status: resp.status, attempt: attempt + 1, delay }, "Shopify paged transient error — retrying");
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }

      if (resp.status === 401) {
        if (fetchHeaders["X-Shopify-Access-Token"] !== hdrs["X-Shopify-Access-Token"]) {
          throw new Error(`Shopify 401 after token refresh at ${path}`);
        }
        logger.warn({ projectId, url }, "Shopify 401 (paged) — force-regenerating token");
        const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
        if (!proj) throw new Error(`Project ${projectId} not found on 401 retry`);
        const plainSecret = safeDecrypt(proj.clientSecret) || proj.clientSecret;
        const newToken = await refreshToken(projectId, proj.shopDomain, proj.clientId, plainSecret);
        return doPagedFetch({ "X-Shopify-Access-Token": newToken, "Content-Type": "application/json" });
      }

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Shopify API error ${resp.status} at ${path}: ${resumenRespuestaShopify(text)}`);
      }

      const linkHeader = resp.headers.get("Link") ?? "";
      let nextPageInfo: string | null = null;
      const nextMatch = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/);
      if (nextMatch) nextPageInfo = nextMatch[1];

      const data = await resp.json() as T;
      return { data, nextPageInfo };
    }
    const text = lastResp ? await lastResp.text() : "Max retries exceeded";
    throw new Error(`Shopify API error after retries at ${path}: ${resumenRespuestaShopify(text)}`);
  };

  return doPagedFetch(hdrs);
}

/**
 * Rotates a Shopify access token using the official rotation endpoint.
 * POST https://{shop}/admin/oauth/access_token/rotate
 * Requires token rotation to be enabled for the app in Shopify Partners.
 */
export async function rotateToken(
  projectId: number,
  shopDomain: string,
  clientId: string,
  clientSecret: string,
  currentAccessToken: string
): Promise<string> {
  const domain = normalizeShopDomain(shopDomain);
  const url = `https://${domain}/admin/oauth/access_token/rotate`;

  logger.info({ projectId, domain }, "Rotating Shopify token");

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": currentAccessToken,
    },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, access_token: currentAccessToken }),
    signal: AbortSignal.timeout(TOKEN_OP_TIMEOUT),
  });

  if (!resp.ok) {
    const text = await resp.text();
    const failureKind = classifyShopifyFailure(resp.status, text);
    throw new ShopifyAuthError(
      `Token rotation failed (${resp.status}): ${resumenRespuestaShopify(text)}`,
      { shopifyStatus: resp.status, failureKind }
    );
  }

  const data = (await resp.json()) as { access_token: string; expires_in?: number };
  const token = data.access_token;
  const expiresIn = data.expires_in ?? 86_400;
  const expiresAtDate = new Date(Date.now() + expiresIn * 1000);

  await db
    .update(projectsTable)
    .set({ accessToken: encrypt(token), tokenExpiresAt: expiresAtDate })
    .where(eq(projectsTable.id, projectId));

  logger.info({ projectId, expiresAt: expiresAtDate }, "Token rotated successfully");
  return token;
}

/**
 * Shopify Admin GraphQL API request.
 * Uses the same token management as REST requests (auto-refresh on 401).
 */
export async function shopifyGraphQL<T = Record<string, unknown>>(
  projectId: number,
  shopDomain: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const domain = normalizeShopDomain(shopDomain);
  const headers = await getShopifyHeaders(projectId);
  const url = `https://${domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  let retried401 = false;
  const doFetch = async (hdrs: Record<string, string>): Promise<T> => {
    const resp = await fetch(url, {
      method: "POST",
      headers: hdrs,
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(SHOPIFY_FETCH_TIMEOUT),
    });

    if (resp.status === 401 && !retried401) {
      retried401 = true;
      logger.warn({ projectId }, "Shopify GraphQL 401 — refreshing token (one retry)");
      const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
      if (!proj) throw new Error(`Project ${projectId} not found`);
      const plainSecret = safeDecrypt(proj.clientSecret) || proj.clientSecret;
      const newToken = await refreshToken(projectId, proj.shopDomain, proj.clientId, plainSecret);
      return doFetch({ "X-Shopify-Access-Token": newToken, "Content-Type": "application/json" });
    } else if (resp.status === 401) {
      throw new Error("Shopify GraphQL 401 after token refresh — token may be invalid");
    }

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Shopify GraphQL error ${resp.status}: ${resumenRespuestaShopify(text)}`);
    }

    const result = await resp.json() as { data?: T; errors?: Array<{ message: string }> };
    if (result.errors?.length) {
      throw new Error(`Shopify GraphQL errors: ${result.errors.map(e => e.message).join(", ")}`);
    }
    return result.data as T;
  };

  return doFetch(headers);
}

/**
 * Validates a token with a lightweight API call. Returns true if valid.
 */
export async function validateTokenDetailed(shopDomain: string, accessToken: string): Promise<ShopifyTokenValidation> {
  const domain = normalizeShopDomain(shopDomain);
  const plainToken = safeDecrypt(accessToken) || accessToken;
  try {
    const resp = await fetch(`https://${domain}/admin/api/${SHOPIFY_API_VERSION}/shop.json`, {
      headers: { "X-Shopify-Access-Token": plainToken, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(TOKEN_OP_TIMEOUT),
    });
    if (resp.ok) return { valid: true, status: resp.status };

    const text = await resp.text();
    let failureKind = classifyShopifyFailure(resp.status, text);
    // An HTTP 401 from shop.json means the access token is invalid, not that
    // the app's Client ID/Secret are necessarily wrong.
    if (resp.status === 401) failureKind = "invalid_token";
    return {
      valid: false,
      status: resp.status,
      failureKind,
      summary: resumenRespuestaShopify(text),
    };
  } catch (err) {
    return {
      valid: false,
      status: null,
      failureKind: "network_error",
      summary: err instanceof Error ? err.message.slice(0, 180) : "network error",
    };
  }
}

export async function validateToken(shopDomain: string, accessToken: string): Promise<boolean> {
  return (await validateTokenDetailed(shopDomain, accessToken)).valid;
}
