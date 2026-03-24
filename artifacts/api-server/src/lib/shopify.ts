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
 * Generates or renews a Shopify access token using client_credentials grant.
 * POST https://{shop}/admin/oauth/access_token
 *   grant_type=client_credentials&client_id=...&client_secret=...
 * Tokens expire in 12-24h. clientSecret must be PLAINTEXT (not encrypted).
 */
export async function refreshToken(
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
    throw new Error(`Token generation failed (${resp.status}): ${text}`);
  }

  const data = (await resp.json()) as { access_token: string; expires_in?: number };
  const token = data.access_token;
  const expiresIn = data.expires_in ?? 86_400; // default 24h if not specified
  const expiresAtDate = new Date(Date.now() + expiresIn * 1000);

  await db
    .update(projectsTable)
    .set({ accessToken: token, tokenExpiresAt: expiresAtDate })
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

  let token = project.accessToken;
  const expiresAt = project.tokenExpiresAt;

  // Refresh if: no token, no expiry date, or expiry within next 30 minutes
  const needsRefresh =
    !token ||
    !expiresAt ||
    new Date(expiresAt) < new Date(Date.now() + 30 * 60 * 1000);

  if (needsRefresh) {
    // Always decrypt the stored secret before using it
    const plainSecret = safeDecrypt(project.clientSecret) || project.clientSecret;
    token = await refreshToken(projectId, project.shopDomain, project.clientId, plainSecret);
  }

  return {
    "X-Shopify-Access-Token": token!,
    "Content-Type": "application/json",
  };
}

/**
 * Makes a Shopify Admin API request.
 * On 401 (expired/invalid token), auto-regenerates token and retries once.
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
    logger.warn({ projectId, url }, "Shopify 401 — force-regenerating token");
    const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!proj) throw new Error(`Project ${projectId} not found on 401 retry`);
    const plainSecret = safeDecrypt(proj.clientSecret) || proj.clientSecret;
    const newToken = await refreshToken(projectId, proj.shopDomain, proj.clientId, plainSecret);
    const retryResp = await fetch(url, {
      ...options,
      headers: { "X-Shopify-Access-Token": newToken, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(SHOPIFY_FETCH_TIMEOUT),
    });
    if (!retryResp.ok) throw new Error(`Shopify ${retryResp.status} after token regeneration at ${path}`);
    return retryResp.json() as Promise<T>;
  }

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Shopify API error ${resp.status} at ${path}: ${text}`);
  }

  return resp.json() as Promise<T>;
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
    throw new Error(`Token rotation failed (${resp.status}): ${text}`);
  }

  const data = (await resp.json()) as { access_token: string; expires_in?: number };
  const token = data.access_token;
  const expiresIn = data.expires_in ?? 86_400;
  const expiresAtDate = new Date(Date.now() + expiresIn * 1000);

  await db
    .update(projectsTable)
    .set({ accessToken: token, tokenExpiresAt: expiresAtDate })
    .where(eq(projectsTable.id, projectId));

  logger.info({ projectId, expiresAt: expiresAtDate }, "Token rotated successfully");
  return token;
}

/**
 * Validates a token with a lightweight API call. Returns true if valid.
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
