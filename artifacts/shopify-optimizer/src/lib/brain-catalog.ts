/**
 * Catálogo de acciones del chat de admin, leído del cerebro
 * (GET /api/shopybrain/catalog?gate=admin) en vez de escrito a mano.
 *
 * Si el catálogo no llega (red, sesión, respuesta rara), se usa el respaldo de
 * siempre: las acciones de vídeo que el prompt listaba a mano.
 */
const API = import.meta.env?.BASE_URL ? import.meta.env.BASE_URL.replace(/\/$/, "") : "";

export const FALLBACK_ACTION_CATALOG = `Acciones de vídeo disponibles desde el chat:
- generate_video → Vídeo corto T2V/I2V. Params: {projectId, prompt (en inglés, cinematográfico), model? (default grok-imagine-video), duration? (5-10), aspect? (9:16|16:9|1:1), imageUrl?}
- create_brand_ad → Anuncio de marca con escenas+voz+música. Params: {projectId, brand, productName, referenceImageVaultId, scenesCount?, videoModel?}
- create_long_ad → Anuncio largo 3-20min. Params: {projectId, productId, totalDurationSec, scenesCount?}
- create_montage_video → Montaje multicapa. Params: {projectId, ...}`;

interface CatalogAction { name: string; description: string; destructive?: boolean }

/** Texto del catálogo para el prompt, o null si la respuesta no trae acciones válidas. */
export function formatActionCatalog(data: unknown): string | null {
  const list = (data && typeof data === "object" ? (data as { actions?: unknown }).actions : null);
  if (!Array.isArray(list)) return null;
  const actions = list.filter((a): a is CatalogAction =>
    !!a && typeof a === "object" && typeof (a as CatalogAction).name === "string" && (a as CatalogAction).name.length > 0);
  if (!actions.length) return null;
  const lines = actions.map(a => {
    const desc = typeof a.description === "string" && a.description.trim() ? a.description.trim() : "sin descripción";
    return `- ${a.name} → ${desc}${a.destructive ? " [DESTRUCTIVA: el sistema pide confirmación a la persona]" : ""}`;
  });
  return `Acciones disponibles desde el chat (catálogo de ShopyBrain, ${actions.length}):\n${lines.join("\n")}`;
}

let cached: Promise<string> | null = null;

/**
 * El catálogo de la puerta admin, una sola petición por carga de la página.
 * Nunca falla: si algo va mal devuelve FALLBACK_ACTION_CATALOG (y no lo guarda,
 * para reintentar la próxima vez).
 */
export function loadAdminActionCatalog(fetchImpl: typeof fetch = fetch): Promise<string> {
  if (cached) return cached;
  const p = fetchImpl(`${API}/api/shopybrain/catalog?gate=admin`, { credentials: "include" })
    .then(r => (r.ok ? r.json() : null))
    .then(d => {
      const text = formatActionCatalog(d);
      if (!text) { cached = null; return FALLBACK_ACTION_CATALOG; }
      return text;
    })
    .catch(() => { cached = null; return FALLBACK_ACTION_CATALOG; });
  cached = p;
  return p;
}

/** Solo para pruebas. */
export function resetActionCatalogCache(): void { cached = null; }
