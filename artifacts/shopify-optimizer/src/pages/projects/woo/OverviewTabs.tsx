import { fmt, fmtDateShort, KpiCard, Table } from "@/components/commerce/hub-kit";
import { hubBase, money, useFetch } from "./api";
import { AMBER, Badge, Empty, ErrorBox, GREEN, MUTED, mono, panelStyle, Provenance, RED, Skeleton, WL, WP } from "./ui";

export type Overview = {
  revenue30d: number; gross30d: number; refunds30d: number; taxes30d: number; shipping30d: number; orders30d: number; aov: number;
  totalProducts: number; totalCustomers: number; currency: string; source: string; fetchedAt: string;
  period: { from: string; to: string; timezone: string }; definition: string; complete: boolean; stockAlerts: any[]; recentOrders: any[];
};

export function useOverview(projectId: string) {
  return useFetch<Overview>(`${hubBase(projectId)}/overview`);
}

export function OverviewTab({ ov }: { ov: ReturnType<typeof useOverview> }) {
  if (ov.loading && !ov.data) return <Skeleton rows={6} />;
  if (ov.error) return <ErrorBox error={ov.error} onRetry={ov.reload} />;
  const d = ov.data;
  if (!d) return null;
  const c = d.currency;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ ...panelStyle, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 12.5 }}>
          <b style={{ color: WL }}>Periodo</b> {fmtDateShort(d.period?.from)} a {fmtDateShort(d.period?.to)} ({d.period?.timezone}) · <b style={{ color: WL }}>Divisa</b> {c}
          {d.complete !== true && <span style={{ color: AMBER }}> · Lectura incompleta</span>}
        </div>
        <div data-testid="text-definition" style={{ fontSize: 12, color: MUTED }}>{d.definition}</div>
        <Provenance source={d.source} fetchedAt={d.fetchedAt} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <KpiCard label="Ingresos netos" value={money(fmt, d.revenue30d, c)} sub={`${d.orders30d} pedidos en el periodo`} icon="" color={WP} />
        <KpiCard label="Bruto" value={money(fmt, d.gross30d, c)} sub={`Impuestos ${money(fmt, d.taxes30d, c)}`} icon="" color={WL} />
        <KpiCard label="Reembolsos" value={money(fmt, d.refunds30d, c)} sub={`Envíos ${money(fmt, d.shipping30d, c)}`} icon="" color={AMBER} />
        <KpiCard label="Ticket medio" value={money(fmt, d.aov, c)} sub="Según la definición indicada" icon="" color={WL} />
        <KpiCard label="Productos" value={String(d.totalProducts)} sub={`${d.totalCustomers} clientes registrados`} icon="" color={GREEN} />
      </div>
      <div style={{ ...panelStyle, padding: "16px 18px" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700 }}>Últimos pedidos</h3>
        <Table cols={["Pedido", "Cliente", "Total", "Estado", "Fecha"]} emptyMsg="Sin pedidos recientes en la lectura actual"
          rows={(d.recentOrders ?? []).map((o: any) => [
            <span style={{ ...mono, color: WL }}>#{o.number ?? o.id}</span>,
            <div><div style={{ fontWeight: 600 }}>{o.customerName || "Invitado"}</div></div>,
            <span style={{ fontWeight: 700 }}>{money(fmt, o.total, o.currency ?? c)}</span>,
            <Badge status={o.status} />,
            <span style={{ fontSize: 12, color: MUTED }}>{fmtDateShort(o.date)}</span>,
          ])} />
      </div>
      {(d.stockAlerts ?? []).length > 0 && <StockTable title="Alertas de stock" items={d.stockAlerts} currency={c} color={RED} />}
    </div>
  );
}

function StockTable({ title, items, currency, color }: { title: string; items: any[]; currency?: string; color: string }) {
  return (
    <div style={{ ...panelStyle, padding: "16px 18px", borderColor: `${color}33` }}>
      <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color }}>{title}</h3>
      <Table cols={["Producto", "ID", "SKU", "Stock", "Estado", "Precio"]} emptyMsg="Sin elementos"
        rows={items.map((p: any) => [
          p.name, <span style={{ ...mono, fontSize: 11, color: MUTED }}>#{p.id}{p.parentId ? ` (de #${p.parentId})` : ""}</span>,
          <span style={{ ...mono, fontSize: 11, color: MUTED }}>{p.sku || "—"}</span>,
          <span style={{ fontWeight: 700, color }}>{p.stockQuantity ?? "—"}</span>, <Badge status={p.stockStatus} />, money(fmt, p.price, currency),
        ])} />
    </div>
  );
}

type Inventory = { outOfStock: any[]; lowStock: any[]; backorder: any[]; totalTracked: number; outOfStockCount: number; lowStockCount: number; backorderCount: number; currency: string; source: string; fetchedAt: string };

export function InventoryTab({ projectId }: { projectId: string }) {
  const inv = useFetch<Inventory>(`${hubBase(projectId)}/inventory`);
  if (inv.loading && !inv.data) return <Skeleton rows={6} />;
  if (inv.error) return <ErrorBox error={inv.error} onRetry={inv.reload} />;
  const d = inv.data;
  if (!d) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Provenance source={d.source} fetchedAt={d.fetchedAt} extra={<span>divisa: {d.currency}</span>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        <KpiCard label="Sin stock" value={String(d.outOfStockCount)} sub="Requieren reposición" icon="" color={RED} />
        <KpiCard label="Stock bajo" value={String(d.lowStockCount)} sub="Por debajo del umbral" icon="" color={AMBER} />
        <KpiCard label="Bajo pedido" value={String(d.backorderCount)} sub="Aceptando reservas" icon="" color={WL} />
        <KpiCard label="Con seguimiento" value={String(d.totalTracked)} sub="Gestionan stock" icon="" color={GREEN} />
      </div>
      {d.outOfStock?.length > 0 && <StockTable title={`Sin stock (${d.outOfStockCount})`} items={d.outOfStock} currency={d.currency} color={RED} />}
      {d.lowStock?.length > 0 && <StockTable title={`Stock bajo (${d.lowStockCount})`} items={d.lowStock} currency={d.currency} color={AMBER} />}
      {d.backorder?.length > 0 && <StockTable title={`Bajo pedido (${d.backorderCount})`} items={d.backorder} currency={d.currency} color={WL} />}
      {!d.outOfStock?.length && !d.lowStock?.length && !d.backorder?.length && <div style={panelStyle}><Empty>Ningún producto con seguimiento está en alerta en esta lectura.</Empty></div>}
    </div>
  );
}
