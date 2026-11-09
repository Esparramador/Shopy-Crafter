// Cliente del contrato docs/woocommerce-management-contract.md. Sin hooks inventados: fetch + tipos derivados.
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

export const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";
export const hubBase = (projectId: string) => `${API}/admin/woo/project/${encodeURIComponent(projectId)}`;

export type ResourceName = "products" | "variations" | "categories" | "attributes" | "terms" | "orders" | "customers" | "coupons";

export type ListResponse<T> = { data: T[]; total: number; totalPages: number; page: number; hasMore: boolean; fetchedAt: string; source: string };
export type SchemaField = { type?: string | string[]; description?: string; enum?: string[]; readonly?: boolean; required?: boolean; default?: unknown; items?: unknown; context?: string[] };
export type SchemaResponse = { fields: Record<string, SchemaField>; methods: string[] };
export type WriteResult<T = any> = { state: string; entityId?: number; verifiedAt?: string; result?: T; operationId?: string };

export class HttpError extends Error {
  status: number;
  body: any;
  constructor(msg: string, status: number, body: any) { super(msg); this.status = status; this.body = body; }
}

export async function req<T = any>(url: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, { credentials: "include", ...init, headers: init?.body ? { "Content-Type": "application/json" } : undefined });
  } catch (e) {
    throw new HttpError(`Sin respuesta del servidor: ${(e as Error).message}`, 0, null);
  }
  const d = await r.json().catch(() => null);
  if (!r.ok) {
    const prefix = r.status === 401 || r.status === 403 ? `Permiso denegado por WooCommerce (${r.status}): ` : "";
    throw new HttpError(prefix + (d?.error ?? `HTTP ${r.status}`), r.status, d);
  }
  return d as T;
}

function qs(p: Record<string, string | number | undefined | null>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null && v !== "") s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : "";
}

export const listUrl = (pid: string, resource: ResourceName, p: { parentId?: number | string; page?: number; per_page?: number; search?: string; status?: string }) =>
  `${hubBase(pid)}/resources/${resource}${qs({ parentId: p.parentId, page: p.page ?? 1, per_page: p.per_page ?? 20, search: p.search, status: p.status })}`;
export const detailUrl = (pid: string, resource: ResourceName, id: number | string, parentId?: number | string) =>
  `${hubBase(pid)}/resources/${resource}/${id}${qs({ parentId })}`;

export function useFetch<T>(url: string | null) {
  const query = useQuery<T, HttpError>({
    queryKey: ["woo-resource", url],
    queryFn: ({ signal }) => {
      if (!url) throw new HttpError("Recurso no disponible", 0, null);
      return req<T>(url, { signal });
    },
    enabled: !!url,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const reload = useCallback(() => { void query.refetch(); }, [query.refetch]);

  // On return to the app, refresh in the background instead of clearing a usable
  // response and showing a full-page skeleton again.
  const refetch = query.refetch;
  useEffect(() => {
    if (!url) return;
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [url, refetch]);

  return {
    data: query.data ?? null,
    error: query.error ?? null,
    loading: query.isLoading,
    refreshing: query.isFetching && !query.isLoading,
    reload,
    dataUpdatedAt: query.dataUpdatedAt,
  };
}

export function useList<T = any>(pid: string, resource: ResourceName, p: { parentId?: number | string; page?: number; per_page?: number; search?: string; status?: string }, enabled = true) {
  return useFetch<ListResponse<T>>(enabled ? listUrl(pid, resource, p) : null);
}

export function useDetail<T = any>(pid: string, resource: ResourceName, id: number | string | null, parentId?: number | string) {
  const r = useFetch<{ result: T }>(id != null ? detailUrl(pid, resource, id, parentId) : null);
  return { ...r, data: r.data?.result ?? null };
}

export function useSchema(pid: string, resource: ResourceName, parentId?: number | string, entityId?: number | string) {
  return useFetch<SchemaResponse>(`${hubBase(pid)}/schema/${resource}${qs({ parentId, entityId })}`);
}

export type WriteState = "idle" | "saving" | "verified" | "failed" | "uncertain";

/**
 * Escritura con operationId estable: se mantiene en fallos y reintentos; sólo se libera tras verificación
 * o cuando el operador recarga el estado real desde WooCommerce. Una escritura incierta queda bloqueada.
 */
export function useWrite(pid: string) {
  const opRef = useRef<string | null>(null);
  const [state, setState] = useState<WriteState>("idle");
  const [message, setMessage] = useState("");

  const run = useCallback(async <T = any>(resource: ResourceName, entityId: number | null, data: Record<string, unknown>, parentId?: number): Promise<WriteResult<T> | null> => {
    if (!opRef.current) opRef.current = crypto.randomUUID();
    const operationId = opRef.current;
    setState("saving");
    setMessage("");
    const url = entityId == null ? `${hubBase(pid)}/resources/${resource}` : `${hubBase(pid)}/resources/${resource}/${entityId}`;
    const body: Record<string, unknown> = { data, operationId, confirmed: true };
    if (parentId != null) body.parentId = parentId;
    let r: Response;
    try {
      r = await fetch(url, { method: entityId == null ? "POST" : "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } catch (e) {
      setState("uncertain");
      setMessage(`La conexión se cortó antes de recibir respuesta (${(e as Error).message}). Puede que WooCommerce haya aplicado el cambio.`);
      return null;
    }
    const d = await r.json().catch(() => null);
    if (r.ok && (d?.state === "verified" || (d?.state == null && d?.result))) {
      opRef.current = null;
      setState("verified");
      setMessage(d?.verifiedAt ? `Verificado en WooCommerce ${new Date(d.verifiedAt).toLocaleString("es-ES")}` : "Verificado en WooCommerce");
      return d;
    }
    if (r.ok || r.status >= 500 || d?.state === "uncertain") {
      setState("uncertain");
      setMessage(d?.error ?? (r.ok ? `Respuesta sin verificar (estado: ${d?.state ?? "desconocido"}).` : `Error ${r.status}; el resultado en WooCommerce es incierto.`));
      return null;
    }
    setState("failed");
    setMessage(r.status === 401 || r.status === 403 ? `WooCommerce denegó el permiso (${r.status}): ${d?.error ?? ""}` : d?.error ?? `HTTP ${r.status}`);
    return null;
  }, [pid]);

  /** Tras revisar/recargar desde WooCommerce, se libera el id para una operación nueva. */
  const release = useCallback(() => { opRef.current = null; setState("idle"); setMessage(""); }, []);

  return { run, state, message, operationId: opRef.current, release };
}

export const money = (fmtFn: (n: number, c?: string) => string, v: unknown, currency?: string) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  if (!currency) return n.toFixed(2) + " (sin divisa)";
  try { return fmtFn(n, currency); } catch { return `${n.toFixed(2)} ${currency}`; }
};

export const stripHtml = (h: string) => (h ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
