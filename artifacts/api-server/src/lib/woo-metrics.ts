import { WooClient, WooError } from "./woo-client.js";

export const WOO_DEFINITION = "Cohorte por fecha de creación UTC de los últimos 30 días. Pedidos processing/completed/refunded que tienen fecha de pago. Bruto incluye impuestos y portes; neto = total menos devoluciones acumuladas de esos pedidos (no devoluciones emitidas durante el periodo). Sin conversión de divisas. Clientes = cuentas registradas, no compradores invitados. Catálogo = productos padre no eliminados; inventario = simples y variaciones publicadas, sin duplicar padres variables.";
export const WOO_OVERVIEW_DEFINITION = "Cohorte por fecha de creación UTC de los últimos 30 días. Pedidos processing/completed/refunded con fecha de pago. Bruto incluye impuestos y portes; neto resta las devoluciones acumuladas de esos pedidos. Sin conversión de divisas. Clientes = cuentas registradas, no compradores invitados. Productos = total comunicado por la API de WooCommerce.";
const money = (v: unknown) => {
  if (typeof v !== "string" && typeof v !== "number") throw new WooError("Importe ausente en WooCommerce");
  if (!/^-?\d+(\.\d+)?$/.test(String(v))) throw new WooError("Importe no válido en WooCommerce");
  return Math.round(Number(v) * 100);
};
export function summarizeWooOrders(orders: any[], currency: string) {
  let gross = 0, refunds = 0, tax = 0, shipping = 0, count = 0;
  const days = new Map<string, { date: string; revenue: number; orders: number }>();
  for (const o of orders) {
    if (!["processing", "completed", "refunded"].includes(o.status) || !o.date_paid_gmt) continue;
    if (o.currency !== currency) throw new WooError("El periodo contiene varias monedas: no se suman importes");
    const total = money(o.total);
    const refunded = (o.refunds ?? []).reduce((s: number, r: any) => s + Math.abs(money(r.total)), 0);
    if (refunded > total) throw new WooError("Devoluciones superiores al total; conciliación necesaria");
    gross += total; refunds += refunded; tax += money(o.total_tax); shipping += money(o.shipping_total); count++;
    const date = String(o.date_created_gmt).slice(0, 10);
    const day = days.get(date) ?? { date, revenue: 0, orders: 0 };
    day.revenue += (total - refunded) / 100; day.orders++; days.set(date, day);
  }
  return { revenue30d: (gross - refunds) / 100, gross30d: gross / 100, refunds30d: refunds / 100, taxes30d: tax / 100, shipping30d: shipping / 100, orders30d: count, aov: count ? (gross - refunds) / count / 100 : 0, dailyChart: [...days.values()].sort((a,b) => a.date.localeCompare(b.date)) };
}
export async function wooInventory(wc: WooClient, products?: any[]) {
  const deadline=Date.now()+90_000;
  const parents = products ?? await wc.all("/products", { status: "publish" });
  const units: any[] = [];
  const published = parents.filter((p: any) => p.status === "publish");
  for (let start = 0; start < published.length; start += 3) {
    if (Date.now()>deadline) throw new WooError("Inventario incompleto: superado el tiempo máximo");
    const batch = await Promise.all(published.slice(start, start + 3).map(async (p: any) => {
      if (p.type !== "variable") return [p];
      const variations = await wc.all(`/products/${p.id}/variations`);
      return variations
        .filter((v: any) => v.status === "publish")
        .map((v: any) => ({ ...v, name: `${p.name} · ${(v.attributes ?? []).map((a: any) => a.option).join(" / ")}`, parentId: p.id }));
    }));
    units.push(...batch.flat());
  }
  const map = (p: any) => ({ id: p.id, parentId: p.parentId, name: p.name, sku: p.sku, stockStatus: p.stock_status, stockQuantity: p.stock_quantity, price: p.price });
  const outOfStock = units.filter(p => p.stock_status === "outofstock").map(map);
  const backorder = units.filter(p => p.stock_status === "onbackorder").map(map);
  const lowStock = units.filter(p => p.manage_stock === true && p.stock_quantity != null && p.stock_status === "instock" && p.stock_quantity <= Number(p.low_stock_amount ?? 5)).map(map);
  return { outOfStock, backorder, lowStock, outOfStockCount: outOfStock.length, backorderCount: backorder.length, lowStockCount: lowStock.length, totalTracked: units.filter(p => p.manage_stock === true).length };
}
/** No shared cache or fabricated fallback: both dashboards consume this exact read model. */
export async function wooOverview(wc: WooClient) {
  const end = new Date(); const start = new Date(end.getTime() - 30 * 864e5);
  const schema = await wc.request("OPTIONS","/orders");
  const args = schema.endpoints?.find((e:any)=>e.methods?.includes("GET"))?.args;
  if (!args?.after || !args?.before || !args?.dates_are_gmt || (args.status?.enum && !args.status.enum.includes("any"))) throw new WooError("La instalación no permite verificar el periodo UTC de pedidos");
  const [settings, orders, products, customers] = await Promise.all([
    wc.request<any[]>("GET", "/settings/general"),
    wc.all("/orders", { after: start.toISOString().slice(0,19), before: end.toISOString().slice(0,19), dates_are_gmt: "true", status: "any" }),
    wc.page("/products", { per_page: "1", page: "1" }),
    wc.page("/customers", { per_page: "1", page: "1" }),
  ]);
  const currency = settings.find(s => s.id === "woocommerce_currency")?.value;
  if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) throw new WooError("No se pudo verificar la moneda de la tienda");
  return {
    ...summarizeWooOrders(orders, currency),
    totalProducts: products.total, totalCustomers: customers.total, currency,
    source: wc.origin, fetchedAt: new Date().toISOString(), period: { from: start.toISOString(), to: end.toISOString(), timezone: "UTC" },
    definition: WOO_OVERVIEW_DEFINITION, complete: true, warnings: [],
    recentOrders: [...orders].sort((a,b) => b.id - a.id).slice(0,5).map(o => ({ id:o.id,number:o.number,status:o.status,total:Number(o.total),currency:o.currency,customerName:`${o.billing?.first_name ?? ""} ${o.billing?.last_name ?? ""}`.trim(),date:o.date_created,itemCount:o.line_items?.length })),
  };
}
