import { useState } from "react";
import { useRoute } from "wouter";
import { BarChart3, Boxes, ClipboardList, FileUp, FolderTree, Package, Tag, Users } from "lucide-react";
import { ProductsTab } from "./woo/ProductsTab";
import { TaxonomyTab } from "./woo/TaxonomyTab";
import { CouponsTab, CustomersTab, OrdersTab } from "./woo/CommerceTabs";
import { InventoryTab, OverviewTab, useOverview } from "./woo/OverviewTabs";
import { ImportsTab } from "./woo/ImportsTab";
import { AMBER, MUTED, WD, WL, WP } from "./woo/ui";

type Tab = "overview" | "products" | "taxonomy" | "orders" | "customers" | "coupons" | "inventory" | "imports";

const TABS: { id: Tab; label: string; Icon: typeof Package }[] = [
  { id: "overview", label: "Resumen", Icon: BarChart3 },
  { id: "products", label: "Productos", Icon: Package },
  { id: "taxonomy", label: "Categorías y atributos", Icon: FolderTree },
  { id: "orders", label: "Pedidos", Icon: ClipboardList },
  { id: "customers", label: "Clientes", Icon: Users },
  { id: "coupons", label: "Cupones", Icon: Tag },
  { id: "inventory", label: "Inventario", Icon: Boxes },
  { id: "imports", label: "Importar", Icon: FileUp },
];

function Hub({ projectId }: { projectId: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  const ov = useOverview(projectId);
  const currency = ov.data?.currency;

  return (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(135deg, #1a0f20 0%, #0f0a14 50%, #120a18 100%)", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "rgba(150,88,138,0.08)", borderBottom: `1px solid ${WP}30`, padding: "20px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${WD}, ${WP})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18 }}>W</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>WooCommerce Hub</div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>Gestión del catálogo real · Proyecto #{projectId}</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span data-testid="text-store-currency" style={{ background: `${WP}22`, border: `1px solid ${WP}50`, borderRadius: 20, padding: "4px 14px", fontSize: 12, color: ov.error ? AMBER : WL, fontWeight: 700 }}>
              {currency ? `Divisa ${currency}` : ov.error ? "Divisa no disponible" : "Leyendo divisa"}
            </span>
            <span style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "4px 14px", fontSize: 12, color: MUTED }}>Sin borrados, cobros ni reembolsos</span>
          </div>
        </div>
      </div>

      <div style={{ background: "rgba(0,0,0,0.2)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 20px", display: "flex", gap: 2, overflowX: "auto" }}>
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)} data-testid={`tab-${id}`}
            style={{ background: tab === id ? `${WP}20` : "transparent", border: "none", borderBottom: tab === id ? `2px solid ${WP}` : "2px solid transparent", color: tab === id ? WL : "rgba(255,255,255,0.45)", fontWeight: tab === id ? 700 : 500, padding: "14px 16px", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <div style={{ padding: "24px 24px 60px", maxWidth: 1400, margin: "0 auto" }}>
        {tab === "overview" && <OverviewTab ov={ov} />}
        {tab === "products" && <ProductsTab projectId={projectId} currency={currency} />}
        {tab === "taxonomy" && <TaxonomyTab projectId={projectId} />}
        {tab === "orders" && <OrdersTab projectId={projectId} />}
        {tab === "customers" && <CustomersTab projectId={projectId} />}
        {tab === "coupons" && <CouponsTab projectId={projectId} currency={currency} />}
        {tab === "inventory" && <InventoryTab projectId={projectId} />}
        {tab === "imports" && <ImportsTab projectId={projectId} />}
      </div>
    </div>
  );
}

export default function WooProjectHub() {
  const [, params] = useRoute("/projects/:id/woo-hub");
  const projectId = params?.id ?? "";
  if (!projectId) return null;
  // key: todo el estado (filtros, borradores, importación) queda aislado por proyecto
  return <Hub key={projectId} projectId={projectId} />;
}
