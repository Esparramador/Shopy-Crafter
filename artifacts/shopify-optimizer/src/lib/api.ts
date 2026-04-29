/**
 * Centralized API wrapper for Shopy Crafter frontend.
 *
 * Usage:
 *   import { apiGet, apiPost, apiPut, apiDelete, ApiError } from "@/lib/api";
 *
 *   // GET
 *   const user = await apiGet<AuthUser>("/api/auth/me");
 *
 *   // POST with JSON body
 *   const project = await apiPost<Project>("/api/projects", { name: "..." });
 *
 *   // DELETE
 *   await apiDelete(`/api/projects/${id}`);
 *
 *   // Error handling
 *   try { ... } catch (err) {
 *     if (err instanceof ApiError) {
 *       // err.status, err.data, err.statusText
 *     }
 *   }
 *
 * Why this exists:
 *   Previously 197 direct fetch() calls duplicated auth/error/credentials
 *   handling across the codebase. This wrapper uses `customFetch` from the
 *   generated Orval client (same one used by typed hooks) and adds:
 *     - BASE_URL prefix (`import.meta.env.BASE_URL`)
 *     - credentials: "include" enforced
 *     - 401 → auto-redirect to /login (forces re-login on expired session)
 *     - Typed ApiError (status, statusText, data) — no more `res.ok` dance
 *
 * Migration strategy:
 *   Replace fetch() calls page by page. Priority:
 *   1. Admin pages (more damage on bugs)
 *   2. Mutations (forms that currently swallow errors silently)
 *   3. Read-only queries (low priority, work OK as-is)
 */

import { customFetch, ApiError } from "@workspace/api-client-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function buildUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/api/")) return `${API_BASE}${path}`;
  return path;
}

export type FetchApiOptions = RequestInit & {
  responseType?: "json" | "text" | "blob" | "auto";
};

export async function fetchApi<T = unknown>(
  path: string,
  options: FetchApiOptions = {},
): Promise<T> {
  try {
    return await customFetch<T>(buildUrl(path), options);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      // Session expired or not authenticated — force re-login.
      // Exception: don't redirect if we're already on a public route
      const p = window.location.pathname;
      const publicRoutes = ["/login", "/forgot-password", "/reset-password", "/invite", "/landing", "/tienda"];
      const isPublic = publicRoutes.some((r) => p.startsWith(r));
      if (!isPublic) {
        window.location.href = "/login";
      }
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

export const apiGet = <T>(path: string, init: RequestInit = {}) =>
  fetchApi<T>(path, { ...init, method: "GET" });

export const apiPost = <T>(path: string, body?: unknown, init: RequestInit = {}) =>
  fetchApi<T>(path, {
    ...init,
    method: "POST",
    headers: {
      ...(body !== undefined && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init.headers,
    },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });

export const apiPut = <T>(path: string, body?: unknown, init: RequestInit = {}) =>
  fetchApi<T>(path, {
    ...init,
    method: "PUT",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

export const apiPatch = <T>(path: string, body?: unknown, init: RequestInit = {}) =>
  fetchApi<T>(path, {
    ...init,
    method: "PATCH",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

export const apiDelete = <T>(path: string, init: RequestInit = {}) =>
  fetchApi<T>(path, { ...init, method: "DELETE" });

// ---------------------------------------------------------------------------
// Download helpers (for vault PDF/ZIP flows)
// ---------------------------------------------------------------------------

/**
 * Download a blob response and trigger a browser download.
 * Used for /api/projects/:id/vault/download-all and similar endpoints.
 */
export async function apiDownload(
  path: string,
  filename: string,
  init: RequestInit = {},
): Promise<void> {
  const blob = await fetchApi<Blob>(path, {
    ...init,
    method: init.method ?? "GET",
    responseType: "blob",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Re-export ApiError so consumers don't need to import from @workspace/api-client-react
export { ApiError } from "@workspace/api-client-react";
