/**
 * Pedidos de la tienda para cálculos financieros: paginación completa en
 * Shopify/WooCommerce/PrestaShop y filtro de pedidos que no son venta.
 */
import type { IPlatformConnector, PlatformOrder } from "./connectors/types.js";

/** Pedidos que cuentan como venta (fuera cancelados, reembolsados, anulados o fallidos). */
export function isCountableOrder(status: string | undefined): boolean {
  const st = String(status ?? "").toLowerCase();
  if (/cancel|refund|void|fail|trash/.test(st)) return false;
  // PrestaShop: estados numéricos 6 cancelado, 7 reembolsado, 8 error de pago.
  if (st === "6" || st === "7" || st === "8") return false;
  return true;
}

/** Todos los pedidos de la ventana [start, end), paginando en cualquier plataforma. */
export async function fetchOrdersInWindow(
  conn: IPlatformConnector, start: Date, end: Date,
): Promise<PlatformOrder[]> {
  const withAll = conn as { listAllOrders?: (p: { after: string; before: string }) => Promise<PlatformOrder[]> };
  if (typeof withAll.listAllOrders === "function") {
    return withAll.listAllOrders({ after: start.toISOString(), before: end.toISOString() });
  }
  const out: PlatformOrder[] = [];
  const pageSize = 100;
  for (let page = 1; page <= 200; page++) {
    // PrestaShop: su filtro de fechas no admite ISO ni doble rango → se pide
    // ordenado por fecha desc y se corta al salir de la ventana.
    const batch = conn.platformType === "prestashop"
      ? await conn.getOrders({ page, limit: pageSize })
      : await conn.getOrders({ page, limit: pageSize, after: start.toISOString(), before: end.toISOString() });
    out.push(...batch);
    if (batch.length < pageSize) break;
    // Orden descendente (PrestaShop): si ya pasamos el inicio de la ventana, parar.
    if (batch.every(o => new Date(o.createdAt).getTime() < start.getTime())) break;
  }
  return out;
}
