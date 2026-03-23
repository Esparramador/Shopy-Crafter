import { db } from "@workspace/db";
import { projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { safeDecrypt } from "./crypto.js";

export async function getShopifyHeaders(projectId: number): Promise<Record<string, string>> {
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId));

  if (!project) throw new Error(`Project ${projectId} not found`);

  let token = project.accessToken;
  const expiresAt = project.tokenExpiresAt;
  const isExpired = !token || !expiresAt || new Date(expiresAt) < new Date(Date.now() + 5 * 60 * 1000);

  if (isExpired) {
    const plainSecret = safeDecrypt(project.clientSecret) || project.clientSecret;
    token = await refreshToken(projectId, project.shopDomain, project.clientId, plainSecret);
  }

  return {
    "X-Shopify-Access-Token": token!,
    "Content-Type": "application/json",
  };
}

export async function refreshToken(
  projectId: number,
  shopDomain: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const domain = shopDomain.replace("https://", "").replace("http://", "").replace(/\/$/, "");
  const url = `https://${domain}/admin/oauth/access_token`;

  logger.info({ projectId, shopDomain: domain }, "Refreshing Shopify token");

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Shopify token refresh failed (${resp.status}): ${text}`);
  }

  const data = (await resp.json()) as { access_token: string; expires_in?: number };
  const token = data.access_token;

  const expiresIn = data.expires_in ?? 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  await db
    .update(projectsTable)
    .set({ accessToken: token, tokenExpiresAt: expiresAt })
    .where(eq(projectsTable.id, projectId));

  logger.info({ projectId, expiresAt }, "Token refreshed successfully");
  return token;
}

export async function shopifyRequest<T>(
  projectId: number,
  shopDomain: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const domain = shopDomain.replace("https://", "").replace("http://", "").replace(/\/$/, "");
  const headers = await getShopifyHeaders(projectId);
  const url = `https://${domain}/admin/api/2024-01${path}`;

  const resp = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string> || {}) },
  });

  if (resp.status === 401) {
    logger.warn({ projectId, url }, "Shopify 401 — attempting token refresh");
    const newToken = await refreshToken(projectId, shopDomain, "", "");
    const retryHeaders = { "X-Shopify-Access-Token": newToken, "Content-Type": "application/json" };
    const retryResp = await fetch(url, { ...options, headers: retryHeaders });
    if (!retryResp.ok) {
      throw new Error(`Shopify API error ${retryResp.status} at ${path}`);
    }
    return retryResp.json() as Promise<T>;
  }

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Shopify API error ${resp.status} at ${path}: ${text}`);
  }

  return resp.json() as Promise<T>;
}

export function normalizeShopDomain(domain: string): string {
  return domain
    .replace("https://", "")
    .replace("http://", "")
    .replace(/\/$/, "");
}
