import { db } from "@workspace/db";
import { projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { safeDecrypt } from "./crypto.js";

const SHOPIFY_FETCH_TIMEOUT = 30_000;
const TOKEN_OP_TIMEOUT = 15_000;

export function normalizeShopDomain(domain: string): string {
  return domain.replace("https://", "").replace("http://", "").replace(/\/$/, "");
}

/**
 * Returns the stored Shopify access token headers for a project.
 * Custom app tokens (shpat_...) are PERMANENT — no expiry check needed.
 * Token rotation only happens reactively on 401 in shopifyRequest.
 */
export async function getShopifyHeaders(projectId: number): Promise<Record<string, string>> {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) throw new Error(`Proyecto ${projectId} no encontrado`);
  if (!project.accessToken) {
    throw new Error(
      `Proyecto ${projectId} no tiene token de acceso. Añádelo en Configuración del proyecto → Admin API Access Token.`
    );
  }
  return {
    "X-Shopify-Access-Token": project.accessToken,
    "Content-Type": "application/json",
  };
}

/**
 * Token rotation via Shopify's official rotate endpoint.
 * Requires: current valid token + clientId + clientSecret.
 * Note: Token rotation must be enabled for the app in Shopify Partners.
 * For custom apps created in the store admin, the shpat_ token is permanent
 * and doesn't need rotation unless manually rotated.
 */
export async function rotateToken(
  projectId: number,
  shopDomain: string,
  clientId: string,
  clientSecret: string,
  currentToken: string
): Promise<string> {
  const domain = normalizeShopDomain(shopDomain);
  const url = `https://${domain}/admin/oauth/access_token/rotate`;

  logger.info({ projectId, domain }, "Attempting Shopify token rotation");

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": currentToken,
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      access_token: currentToken,
    }),
    signal: AbortSignal.timeout(TOKEN_OP_TIMEOUT),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Token rotation failed (${resp.status}): ${text}`);
  }

  const data = (await resp.json()) as { access_token: string };
  const newToken = data.access_token;

  await db
    .update(projectsTable)
    .set({ accessToken: newToken, updatedAt: new Date() })
    .where(eq(projectsTable.id, projectId));

  logger.info({ projectId }, "Token rotated successfully");
  return newToken;
}

/**
 * Validates a token by making a lightweight call to /shop.json.
 * Returns true if the token is valid, false if Shopify returns 401/403.
 */
export async function validateToken(shopDomain: string, accessToken: string): Promise<boolean> {
  const domain = normalizeShopDomain(shopDomain);
  try {
    const resp = await fetch(`https://${domain}/admin/api/2024-01/shop.json`, {
      headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(TOKEN_OP_TIMEOUT),
    });
    return resp.status !== 401 && resp.status !== 403;
  } catch {
    return false;
  }
}

/**
 * @deprecated Use rotateToken instead.
 * Kept for backward compatibility with existing route calls.
 */
export async function refreshToken(
  projectId: number,
  shopDomain: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project?.accessToken) {
    throw new Error(
      `No se puede renovar el token: proyecto ${projectId} no tiene token actual. ` +
      `Añade el Admin API Access Token manualmente en la configuración del proyecto.`
    );
  }
  const plainSecret = clientSecret.startsWith("$argon") || clientSecret.length > 60
    ? (safeDecrypt(clientSecret) || clientSecret)
    : clientSecret;
  return rotateToken(projectId, shopDomain, clientId, plainSecret, project.accessToken);
}

/**
 * Makes a Shopify Admin API request.
 * On 401: attempts token rotation once, then retries.
 */
export async function shopifyRequest<T>(
  projectId: number,
  shopDomain: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const domain = normalizeShopDomain(shopDomain);
  const headers = await getShopifyHeaders(projectId);
  const url = `https://${domain}/admin/api/2024-01${path}`;

  const resp = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string> || {}) },
    signal: AbortSignal.timeout(SHOPIFY_FETCH_TIMEOUT),
  });

  if (resp.status === 401) {
    logger.warn({ projectId, url }, "Shopify 401 — attempting token rotation");
    const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!proj?.accessToken) throw new Error(`Project ${projectId}: no access token for rotation`);

    const plainSecret = safeDecrypt(proj.clientSecret) || proj.clientSecret;

    try {
      const newToken = await rotateToken(projectId, proj.shopDomain, proj.clientId, plainSecret, proj.accessToken);
      const retryResp = await fetch(url, {
        ...options,
        headers: { "X-Shopify-Access-Token": newToken, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(SHOPIFY_FETCH_TIMEOUT),
      });
      if (!retryResp.ok) throw new Error(`Shopify ${retryResp.status} after token rotation at ${path}`);
      return retryResp.json() as Promise<T>;
    } catch (rotateErr) {
      // Rotation failed — token is invalid. Admin must update it manually.
      logger.error({ projectId, err: rotateErr }, "Token rotation failed. Admin must update the access token.");
      throw new Error(
        `Token de Shopify inválido para el proyecto ${projectId}. ` +
        `Ve a la configuración del proyecto y actualiza el Admin API Access Token.`
      );
    }
  }

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Shopify API error ${resp.status} at ${path}: ${text}`);
  }

  return resp.json() as Promise<T>;
}
