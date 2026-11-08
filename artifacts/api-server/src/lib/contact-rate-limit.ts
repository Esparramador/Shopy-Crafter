import { ipKeyGenerator, type Store } from "express-rate-limit";

/** Solicitudes NUEVAS del formulario público por IP y hora. */
export const CONTACT_HOURLY_LIMIT = 5;
export const CONTACT_WINDOW_MS = 60 * 60 * 1000;

type QuotaStore = Pick<Store, "increment"> & { init?: Store["init"] };

/**
 * Cupo del formulario de contacto. Se consulta solo cuando la solicitud es
 * nueva (claimContactSubmission no lo llama para reintentos con la misma
 * Idempotency-Key), así que un reintento confirmado no gasta cupo.
 *
 * El contador vive en el store (PgRateLimitStore("contact") en producción):
 * sobrevive a reinicios y es el mismo para todas las instancias. Si el store
 * falla, PgRateLimitStore devuelve un total infinito: no deja pasar.
 */
export function createContactRateLimiter(store: QuotaStore) {
  store.init?.({ windowMs: CONTACT_WINDOW_MS } as Parameters<Store["init"] & {}>[0]);
  return async (ip: string): Promise<boolean> => {
    try {
      // Misma clave que express-rate-limit: IPv6 agrupada por subred /56.
      const { totalHits } = await store.increment(ipKeyGenerator(ip));
      return totalHits <= CONTACT_HOURLY_LIMIT;
    } catch {
      return false;
    }
  };
}
