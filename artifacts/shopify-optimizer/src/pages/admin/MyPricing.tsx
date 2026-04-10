import { useState, useEffect, useRef } from "react";
import { TrendingUp, TrendingDown, Minus, Calculator, FileText, RefreshCw, Save, ChevronUp, DollarSign, Upload, CheckCircle, AlertTriangle, ExternalLink, ShoppingBag, Download, Printer, Plus, Trash2 } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CostStructure {
  id: string; costClaudeApi: number; costReplicate: number; costHosting: number;
  costStripeFeesFixed: number; costDomainTools: number; costYourTimeHourly: number;
  avgHoursPerClient: number; costPerImageGenerated: number; costPerAuditRun: number;
  costPerBoostMasivo: number; targetMarginSetup: number; targetMarginRetainer: number;
  targetMarginExtras: number; minimumHourlyRate: number;
}
interface Service {
  id: string; serviceName: string; serviceType: string; totalCost: number;
  priceCurrent: number; priceSuggested?: number; priceMin: number; priceMax: number;
  marketAvgPrice: number; ourPositioning: string; timesSold: number;
  omnicoreRecommendation?: string; omnicoreConfidence?: number; priceChangeSuggested?: number;
  shopifyVariantId?: string | null; shopifyProductId?: string | null;
}
interface ShopifyVariant { id: string; title: string; price: { amount: string; currencyCode: string }; availableForSale: boolean; }
interface ShopifyProduct { id: string; title: string; productType: string; priceRange: { minVariantPrice: { amount: string; currencyCode: string } }; variants: { edges: { node: ShopifyVariant }[] }; }

const DIRECTION_CONFIG = {
  up: { icon: TrendingUp, color: "var(--gold)", label: "↑ Sube precio" },
  down: { icon: TrendingDown, color: "var(--crim)", label: "↓ Baja precio" },
  ok: { icon: Minus, color: "var(--jade)", label: "✓ Correcto" },
};

export default function MyPricing() {
  const [costs, setCosts] = useState<CostStructure | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [savingCosts, setSavingCosts] = useState(false);
  const [tab, setTab] = useState<"services" | "costs" | "budget" | "quote" | "proposal" | "shopify">("services");
  const [editCosts, setEditCosts] = useState<Partial<CostStructure>>({});
  const [showCostsForm, setShowCostsForm] = useState(false);
  const [quoteForm, setQuoteForm] = useState({
    clientType: "pyme", numStores: 2, services: ["setup", "retainer"], timeline: "normal",
    contractLength: "monthly", niche: "moda", estimatedRevenue: 5000,
  });
  const [quote, setQuote] = useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [proposal, setProposal] = useState("");
  const [proposalLoading, setProposalLoading] = useState(false);
  const [clientName, setClientName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [budgetForm, setBudgetForm] = useState({
    clientName: "", clientNIF: "", clientEmail: "", clientPhone: "", clientAddress: "",
    storeName: "", storeNiche: "", numProducts: 40, numCollections: 5,
    includeIVA: true, ivaRate: 21, notes: "", paymentTerms: "50% al inicio, 50% a la entrega",
    validDays: 30,
  });
  const [budgetItems, setBudgetItems] = useState<Array<{ name: string; description: string; qty: number }>>([
    { name: "Diseño web Shopify completo", description: "Diseño y desarrollo de tema personalizado", qty: 1 },
    { name: "Creación de productos con IA", description: "Ficha completa: título, descripción, SEO, tags", qty: 40 },
    { name: "Fotografía IA por producto", description: "3 imágenes profesionales por producto (Hero, Lifestyle, Detalle)", qty: 120 },
    { name: "Auditoría completa del catálogo", description: "Análisis de calidad A-F de todos los productos", qty: 1 },
    { name: "SEO técnico completo", description: "Meta tags, schemas, alt texts, sitemap, PageSpeed", qty: 1 },
    { name: "Organización en colecciones", description: "Creación y diseño de colecciones por tipo", qty: 5 },
    { name: "Consultoría estratégica", description: "Horas de asesoría personalizada", qty: 4 },
    { name: "Búsqueda de proveedores", description: "Investigación de proveedores reales con precios y MOQ", qty: 1 },
  ]);
  const [budget, setBudget] = useState<any>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const budgetRef = useRef<HTMLDivElement>(null);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ success: boolean; message: string; requiresManualImport?: boolean; created?: number; failed?: number; instructions?: string[]; storeUrl?: string } | null>(null);
  const [projects, setProjects] = useState<Array<{ id: number; name: string; shopDomain: string | null }>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [shopifyProducts, setShopifyProducts] = useState<ShopifyProduct[]>([]);
  const [_shopifyConfigured, setShopifyConfigured] = useState<boolean | null>(null);
  const [_shopifyMsg, setShopifyMsg] = useState("");
  const [loadingShopify, setLoadingShopify] = useState(false);
  const [savingVariant, setSavingVariant] = useState<string | null>(null);
  const [variantSelections, setVariantSelections] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const [c, s, p] = await Promise.all([
      fetch(`${API_BASE}/api/agency/cost-structure`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API_BASE}/api/agency/services`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API_BASE}/api/projects`, { credentials: "include" }).then(r => r.json()).catch(() => []),
    ]);
    setCosts(c); setServices(s); setEditCosts(c);
    const projectList = Array.isArray(p) ? p : [];
    setProjects(projectList);
    if (projectList.length > 0 && !selectedProjectId) setSelectedProjectId(projectList[0].id);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveCosts = async () => {
    setSavingCosts(true);
    const r = await fetch(`${API_BASE}/api/agency/cost-structure`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editCosts),
    });
    const data = await r.json();
    setCosts(data); setSavingCosts(false); setShowCostsForm(false);
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    const r = await fetch(`${API_BASE}/api/agency/analyze-pricing`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    const data = await r.json();
    setAnalysis(data);
    await load();
    setAnalyzing(false);
  };

  const generateQuote = async () => {
    setQuoteLoading(true);
    const r = await fetch(`${API_BASE}/api/agency/quote`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(quoteForm),
    });
    setQuote(await r.json()); setQuoteLoading(false);
  };

  const generateProposal = async () => {
    setProposalLoading(true);
    const r = await fetch(`${API_BASE}/api/agency/proposal`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientName, storeName, services: quoteForm.services, quote }),
    });
    const data = await r.json();
    setProposal(data.proposal ?? ""); setProposalLoading(false);
  };

  const pushToShopify = async () => {
    setPushing(true);
    setPushResult(null);
    try {
      const r = await fetch(`${API_BASE}/api/agency/push-services-to-shopify`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedProjectId ? { projectId: selectedProjectId } : {}),
      });
      const data = await r.json();
      setPushResult(data);
    } catch {
      setPushResult({ success: false, message: "Error de conexión al sincronizar con la tienda" });
    } finally {
      setPushing(false);
    }
  };

  const getServiceMargin = (svc: Service) => {
    if (!svc.priceCurrent || !svc.totalCost) return null;
    return Math.round(((svc.priceCurrent - svc.totalCost) / svc.priceCurrent) * 100);
  };

  const servicesByType = services.reduce((acc, s) => {
    const t = s.serviceType ?? "other";
    if (!acc[t]) acc[t] = [];
    acc[t].push(s);
    return acc;
  }, {} as Record<string, Service[]>);

  const loadShopifyProducts = async () => {
    setLoadingShopify(true);
    const r = await fetch(`${API_BASE}/api/agency/shopify-products`, { credentials: "include" });
    const data = await r.json();
    setShopifyProducts(data.products ?? []);
    setShopifyConfigured(data.configured ?? false);
    setShopifyMsg(data.message ?? "");
    const initial: Record<string, string> = {};
    services.forEach((svc) => { if (svc.shopifyVariantId) initial[svc.id] = svc.shopifyVariantId; });
    setVariantSelections(initial);
    setLoadingShopify(false);
  };

  const saveVariant = async (serviceId: string) => {
    setSavingVariant(serviceId);
    const variantId = variantSelections[serviceId] ?? "";
    const product = shopifyProducts.find((p) => p.variants.edges.some((e) => e.node.id === variantId));
    await fetch(`${API_BASE}/api/agency/services/${serviceId}/shopify-variant`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId: variantId || null, productId: product?.id ?? null }),
    });
    await load();
    setSavingVariant(null);
  };

  const generateBudget = async () => {
    setBudgetLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/agency/budget`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...budgetForm, selectedServices: budgetItems }),
      });
      setBudget(await r.json());
    } catch { setBudget({ error: "Error de conexión" }); }
    setBudgetLoading(false);
  };

  const buildBudgetHTML = () => {
    if (!budget?.sections) return "";
    const s = budget.summary ?? {};
    const c = budget.conditions ?? {};
    const cl = budget.client ?? {};
    const ag = budget.agency ?? {};
    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Presupuesto ${budget.budgetNumber ?? ""}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',sans-serif;color:#1a1a1a;background:#fff;padding:40px}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;padding-bottom:20px;border-bottom:3px solid #c8a84b}
.logo{font-size:28px;font-weight:900;color:#c8a84b;letter-spacing:-0.5px}
.logo span{color:#1a1a1a}
.budget-num{font-size:22px;font-weight:800;color:#c8a84b;text-align:right}
.budget-date{font-size:12px;color:#666;text-align:right;margin-top:4px}
.parties{display:grid;grid-template-columns:repeat(auto-fit, minmax(min(280px, 100%), 1fr));gap:30px;margin-bottom:30px}
.party{padding:16px;border-radius:8px}
.party.from{background:#f8f6f0;border-left:4px solid #c8a84b}
.party.to{background:#f0f4f8;border-left:4px solid #2d8cf0}
.party h4{font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#999;margin-bottom:8px;font-weight:700}
.party p{font-size:13px;line-height:1.7;color:#333}
.party .name{font-size:15px;font-weight:700;color:#1a1a1a}
.section{margin-bottom:24px}
.section-title{font-size:14px;font-weight:800;color:#c8a84b;text-transform:uppercase;letter-spacing:1px;padding:8px 0;border-bottom:2px solid #e8e0cc;margin-bottom:8px}
table{width:100%;border-collapse:collapse;margin-bottom:8px}
th{background:#f8f6f0;padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#666;font-weight:700;border-bottom:1px solid #ddd}
td{padding:8px 12px;font-size:12px;border-bottom:1px solid #eee;color:#333}
td:nth-child(2),td:nth-child(3),td:nth-child(4),th:nth-child(2),th:nth-child(3),th:nth-child(4){text-align:right;white-space:nowrap}
.section-sub{text-align:right;font-weight:700;font-size:13px;padding:6px 12px;color:#c8a84b}
.totals{margin-top:20px;margin-left:auto;width:320px;border:2px solid #c8a84b;border-radius:8px;overflow:hidden}
.totals tr td{padding:10px 16px;font-size:13px}
.totals .total-row{background:#c8a84b;color:#fff;font-size:16px;font-weight:900}
.totals .total-row td{color:#fff;font-weight:900}
.words{font-size:11px;color:#666;text-align:right;margin-top:8px;font-style:italic}
.conditions{margin-top:30px;padding:20px;background:#f8f6f0;border-radius:8px}
.conditions h3{font-size:13px;font-weight:800;color:#c8a84b;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px}
.conditions p{font-size:12px;line-height:1.8;color:#444}
.conditions strong{color:#1a1a1a}
.footer{margin-top:40px;text-align:center;padding-top:20px;border-top:1px solid #ddd}
.footer p{font-size:11px;color:#999}
.stamp{display:inline-block;padding:8px 24px;border:2px solid #c8a84b;border-radius:4px;color:#c8a84b;font-weight:800;font-size:11px;letter-spacing:2px;transform:rotate(-3deg);margin-top:10px}
@media print{body{padding:20px}@page{margin:15mm}}
</style></head><body>
<div class="header">
  <div><div class="logo">Shopy<span>Crafter</span></div><p style="font-size:12px;color:#666;margin-top:4px">${ag.email ?? "info@shopycrafter.com"} · ${ag.web ?? "shopycrafter.com"}</p></div>
  <div><div class="budget-num">${budget.budgetNumber ?? "PRESUPUESTO"}</div><div class="budget-date">Fecha: ${budget.date ?? new Date().toLocaleDateString("es-ES")}<br/>Válido hasta: ${budget.validUntil ?? ""}</div></div>
</div>
<div class="parties">
  <div class="party from"><h4>De</h4><p class="name">${ag.name ?? "Shopy Crafter"}</p><p>${ag.nif ? `NIF: ${ag.nif}<br/>` : ""}${ag.email ?? ""}<br/>${ag.web ?? ""}</p></div>
  <div class="party to"><h4>Para</h4><p class="name">${cl.name ?? budgetForm.clientName}</p><p>${cl.nif ? `NIF/CIF: ${cl.nif}<br/>` : ""}${cl.email ? `${cl.email}<br/>` : ""}${cl.phone ? `Tel: ${cl.phone}<br/>` : ""}${cl.address ?? ""}</p></div>
</div>
${(budget.sections ?? []).map((sec: any) => `<div class="section"><div class="section-title">${sec.sectionName}</div><table><thead><tr><th style="width:55%">Concepto</th><th>Uds.</th><th>P/U</th><th>Subtotal</th></tr></thead><tbody>${(sec.items ?? []).map((it: any) => `<tr><td>${it.concept}</td><td>${it.units}</td><td>${Number(it.unitPrice).toFixed(2)} €</td><td><strong>${Number(it.subtotal).toFixed(2)} €</strong></td></tr>`).join("")}</tbody></table><div class="section-sub">Subtotal sección: ${Number(sec.sectionSubtotal).toFixed(2)} €</div></div>`).join("")}
<table class="totals"><tbody>
  <tr><td>Base imponible</td><td style="text-align:right;font-weight:700">${Number(s.baseImponible ?? 0).toFixed(2)} €</td></tr>
  ${Number(s.ivaAmount ?? 0) > 0 ? `<tr><td>IVA (${s.ivaRate ?? 21}%)</td><td style="text-align:right">${Number(s.ivaAmount ?? 0).toFixed(2)} €</td></tr>` : ""}
  <tr class="total-row"><td>TOTAL</td><td style="text-align:right">${Number(s.total ?? 0).toFixed(2)} €</td></tr>
</tbody></table>
${s.totalInWords ? `<p class="words">${s.totalInWords}</p>` : ""}
<div class="conditions"><h3>Condiciones</h3>
${c.paymentTerms ? `<p><strong>Forma de pago:</strong> ${c.paymentTerms}</p>` : ""}
${c.deliveryTime ? `<p><strong>Plazo de entrega:</strong> ${c.deliveryTime}</p>` : ""}
${c.validity ? `<p><strong>Validez:</strong> ${c.validity}</p>` : ""}
${c.includesRevisions ? `<p><strong>Revisiones:</strong> ${c.includesRevisions}</p>` : ""}
${c.additionalNotes ? `<p><strong>Notas:</strong> ${c.additionalNotes}</p>` : ""}
</div>
<div class="footer"><div class="stamp">PRESUPUESTO</div><p style="margin-top:12px">Shopy Crafter · Agencia de Optimización eCommerce con IA</p></div>
</body></html>`;
  };

  const downloadBudgetHTML = () => {
    const html = buildBudgetHTML();
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `presupuesto-${budget?.budgetNumber ?? "draft"}.html`;
    a.click(); URL.revokeObjectURL(url);
  };

  const printBudget = () => {
    const html = buildBudgetHTML();
    if (!html) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  const TABS = [
    { id: "services", label: "Tabla de precios" },
    { id: "costs", label: "Estructura de costes" },
    { id: "budget", label: "Presupuesto / Factura" },
    { id: "quote", label: "Propuesta rápida" },
    { id: "shopify", label: "Sync Tienda" },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>💰 Mi Pricing CFO</h1>
          <p style={{ fontSize: 13, color: "var(--t2)", marginTop: 3 }}>
            Shopy Crafter como tu Director Financiero y Comercial personal
          </p>
        </div>
        {tab === "services" && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={pushToShopify} disabled={pushing} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8,
              background: "rgba(45,212,159,0.1)", border: "1px solid rgba(45,212,159,0.3)",
              color: "var(--jade)", cursor: "pointer", fontSize: 13, fontWeight: 600,
            }}>
              {pushing ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={14} />}
              {pushing ? "Subiendo..." : "Sincronizar tienda"}
            </button>
            <button onClick={runAnalysis} disabled={analyzing} className="btn-primary">
              {analyzing ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Analizando...</> : <><TrendingUp size={14} /> Analizar precios</>}
            </button>
          </div>
        )}
      </div>

      {pushResult && (
        <div style={{
          marginBottom: 16,
          padding: "12px 16px",
          borderRadius: 12,
          background: pushResult.success ? "rgba(45,212,159,0.06)" : pushResult.requiresManualImport ? "rgba(255,211,42,0.06)" : "rgba(232,69,88,0.06)",
          border: `1px solid ${pushResult.success ? "rgba(45,212,159,0.25)" : pushResult.requiresManualImport ? "rgba(255,211,42,0.25)" : "rgba(232,69,88,0.25)"}`,
          display: "flex", gap: 12, alignItems: "flex-start",
        }}>
          {pushResult.success
            ? <CheckCircle size={16} style={{ color: "var(--jade)", flexShrink: 0, marginTop: 1 }} />
            : pushResult.requiresManualImport
            ? <AlertTriangle size={16} style={{ color: "var(--gold)", flexShrink: 0, marginTop: 1 }} />
            : <AlertTriangle size={16} style={{ color: "var(--crim)", flexShrink: 0, marginTop: 1 }} />}
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{pushResult.message}</p>
            {pushResult.instructions?.map((inst, i) => (
              <p key={i} style={{ fontSize: 11.5, color: "var(--t2)", margin: "2px 0" }}>{inst}</p>
            ))}
            {pushResult.requiresManualImport && (
              <a href="https://admin.shopify.com/products" target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--gold)", marginTop: 6 }}>
                <ExternalLink size={11} /> Ir a Shopify Admin → Crear productos manualmente
              </a>
            )}
          </div>
        </div>
      )}

      {analysis?.overallAssessment && (
        <div className="glass-card" style={{ marginBottom: 20, borderColor: "var(--gold)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <DollarSign size={16} color="var(--gold)" />
            <span style={{ fontWeight: 700, color: "var(--gold)" }}>Análisis Shopy Crafter CFO</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--t)", marginBottom: 10 }}>{analysis.overallAssessment}</p>
          {analysis.totalRevenueOpportunity > 0 && (
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--jade)" }}>
              Oportunidad de ingresos adicionales: +€{analysis.totalRevenueOpportunity}/mes
            </p>
          )}
          {analysis.priorityActions?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Acciones prioritarias:</p>
              <ul style={{ paddingLeft: 16, margin: 0 }}>
                {analysis.priorityActions.map((a: string, i: number) => (
                  <li key={i} style={{ fontSize: 12, color: "var(--t2)", marginBottom: 3 }}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{
            padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
            background: tab === t.id ? "var(--gold)" : "var(--ink3)",
            color: tab === t.id ? "#060400" : "var(--t2)",
          }}>{t.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--t3)" }}>Cargando datos...</div>
      ) : tab === "services" ? (
        <div>
          {Object.entries(servicesByType).map(([type, svcs]) => (
            <div key={type} style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                {type === "setup" ? "Servicios de Setup" : type === "retainer" ? "Retainers Mensuales" : type === "extra" ? "Servicios Extra" : "Consultoría"}
              </h3>
              <div style={{ background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <table style={{ width: "100%", minWidth: 600, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--ink3)", borderBottom: "1px solid var(--bdr)" }}>
                      {["Servicio", "Tu coste", "Precio actual", "Margen", "Mercado avg", "Shopy Crafter dice"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--t3)", fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {svcs.map((svc, i) => {
                      const margin = getServiceMargin(svc);
                      const direction = svc.priceChangeSuggested && svc.priceChangeSuggested > 5 ? "up"
                        : svc.priceChangeSuggested && svc.priceChangeSuggested < -5 ? "down" : "ok";
                      const cfg = DIRECTION_CONFIG[direction as keyof typeof DIRECTION_CONFIG];
                      const Icon = cfg.icon;
                      return (
                        <tr key={svc.id} style={{ borderBottom: i < svcs.length - 1 ? "1px solid var(--bdr)" : "none" }}>
                          <td style={{ padding: "12px 14px" }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{svc.serviceName}</div>
                            <div style={{ fontSize: 11, color: "var(--t3)" }}>{svc.ourPositioning}</div>
                          </td>
                          <td style={{ padding: "12px 14px", fontSize: 13, color: "var(--t2)" }}>€{svc.totalCost?.toFixed(0)}</td>
                          <td style={{ padding: "12px 14px" }}>
                            <span style={{ fontSize: 14, fontWeight: 700 }}>€{svc.priceCurrent?.toFixed(0)}</span>
                            {svc.priceSuggested && svc.priceChangeSuggested && Math.abs(svc.priceChangeSuggested) > 5 && (
                              <span style={{ fontSize: 11, color: cfg.color, display: "block" }}>→ €{svc.priceSuggested?.toFixed(0)}</span>
                            )}
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: (margin ?? 0) >= 65 ? "var(--jade)" : (margin ?? 0) >= 45 ? "var(--gold)" : "var(--crim)" }}>
                              {margin ?? 0}%
                            </span>
                          </td>
                          <td style={{ padding: "12px 14px", fontSize: 13, color: "var(--t2)" }}>€{svc.marketAvgPrice?.toFixed(0)}</td>
                          <td style={{ padding: "12px 14px" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                              <Icon size={14} color={cfg.color} style={{ marginTop: 2, flexShrink: 0 }} />
                              <div>
                                <span style={{ fontSize: 12, color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
                                {svc.omnicoreRecommendation && (
                                  <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 2, lineHeight: 1.4 }}>{svc.omnicoreRecommendation.slice(0, 80)}...</p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : tab === "costs" ? (
        <div className="glass-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Tu estructura de costes reales</h3>
            <button onClick={() => setShowCostsForm(!showCostsForm)} className="btn-secondary" style={{ fontSize: 12 }}>
              {showCostsForm ? <><ChevronUp size={13} /> Cancelar</> : <><Calculator size={13} /> Editar</>}
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Claude API / mes", value: costs?.costClaudeApi ?? 0, key: "costClaudeApi", unit: "€" },
              { label: "Replicate / mes", value: costs?.costReplicate ?? 0, key: "costReplicate", unit: "€" },
              { label: "Hosting / mes", value: costs?.costHosting ?? 0, key: "costHosting", unit: "€" },
              { label: "Tu hora vale", value: costs?.costYourTimeHourly ?? 80, key: "costYourTimeHourly", unit: "€/h" },
              { label: "Horas/mes por cliente", value: costs?.avgHoursPerClient ?? 4, key: "avgHoursPerClient", unit: "h" },
              { label: "Margen objetivo setup", value: Math.round((costs?.targetMarginSetup ?? 0.7) * 100), key: "targetMarginSetup", unit: "%" },
            ].map(item => (
              <div key={item.key} style={{ padding: "12px 14px", background: "var(--ink3)", borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 4 }}>{item.label}</div>
                {showCostsForm ? (
                  <input
                    type="number"
                    className="input-field"
                    style={{ fontSize: 14 }}
                    value={(editCosts as any)[item.key] ?? item.value}
                    onChange={e => setEditCosts(prev => ({ ...prev, [item.key]: parseFloat(e.target.value) || 0 }))}
                  />
                ) : (
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--gold)" }}>{item.unit === "%" ? "" : item.unit}{item.value}{item.unit === "%" ? "%" : ""}</div>
                )}
              </div>
            ))}
          </div>
          {showCostsForm && (
            <button onClick={saveCosts} disabled={savingCosts} className="btn-primary">
              {savingCosts ? "Guardando..." : <><Save size={14} /> Guardar cambios</>}
            </button>
          )}
        </div>
      ) : tab === "budget" ? (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(250px, 100%), 1fr))", gap: 20, marginBottom: 20 }}>
            <div className="glass-card">
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <FileText size={16} color="var(--gold)" /> Datos del cliente
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 10 }}>
                {[
                  { label: "Nombre / Razón social", key: "clientName", placeholder: "Ej: María García López" },
                  { label: "NIF / CIF", key: "clientNIF", placeholder: "Ej: 12345678A" },
                  { label: "Email", key: "clientEmail", placeholder: "cliente@email.com" },
                  { label: "Teléfono", key: "clientPhone", placeholder: "+34 600 123 456" },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 10, color: "var(--t3)", display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>{f.label}</label>
                    <input className="input-field" placeholder={f.placeholder} value={(budgetForm as any)[f.key]} onChange={e => setBudgetForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
                  </div>
                ))}
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: 10, color: "var(--t3)", display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>Dirección</label>
                  <input className="input-field" placeholder="Calle, Ciudad, CP" value={budgetForm.clientAddress} onChange={e => setBudgetForm(prev => ({ ...prev, clientAddress: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="glass-card">
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <ShoppingBag size={16} color="var(--gold)" /> Datos del proyecto
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 10 }}>
                {[
                  { label: "Nombre de la tienda", key: "storeName", placeholder: "Ej: Modas El Sol", type: "text" },
                  { label: "Nicho / Sector", key: "storeNiche", placeholder: "Ej: moda, tecnología", type: "text" },
                  { label: "Nº de productos", key: "numProducts", placeholder: "40", type: "number" },
                  { label: "Nº de colecciones", key: "numCollections", placeholder: "5", type: "number" },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 10, color: "var(--t3)", display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>{f.label}</label>
                    <input className="input-field" type={f.type} placeholder={f.placeholder} value={(budgetForm as any)[f.key]} onChange={e => setBudgetForm(prev => ({ ...prev, [f.key]: f.type === "number" ? parseInt(e.target.value) || 0 : e.target.value }))} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 10, color: "var(--t3)", display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>IVA</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--t2)", cursor: "pointer" }}>
                      <input type="checkbox" checked={budgetForm.includeIVA} onChange={e => setBudgetForm(prev => ({ ...prev, includeIVA: e.target.checked }))} />
                      Incluir IVA
                    </label>
                    {budgetForm.includeIVA && (
                      <input className="input-field" type="number" style={{ width: 60 }} value={budgetForm.ivaRate} onChange={e => setBudgetForm(prev => ({ ...prev, ivaRate: parseInt(e.target.value) || 21 }))} />
                    )}
                    {budgetForm.includeIVA && <span style={{ fontSize: 11, color: "var(--t3)" }}>%</span>}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: "var(--t3)", display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>Validez (días)</label>
                  <input className="input-field" type="number" value={budgetForm.validDays} onChange={e => setBudgetForm(prev => ({ ...prev, validDays: parseInt(e.target.value) || 30 }))} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: 10, color: "var(--t3)", display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>Condiciones de pago</label>
                  <input className="input-field" value={budgetForm.paymentTerms} onChange={e => setBudgetForm(prev => ({ ...prev, paymentTerms: e.target.value }))} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: 10, color: "var(--t3)", display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>Notas adicionales</label>
                  <textarea className="input-field" rows={2} value={budgetForm.notes} onChange={e => setBudgetForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="Requisitos especiales, observaciones..." />
                </div>
              </div>
            </div>
          </div>
          <div className="glass-card" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                <Calculator size={16} color="var(--gold)" /> Servicios a presupuestar
              </h3>
              <button onClick={() => setBudgetItems(prev => [...prev, { name: "", description: "", qty: 1 }])} className="btn-secondary" style={{ fontSize: 11 }}>
                <Plus size={12} /> Añadir línea
              </button>
            </div>
            <div style={{ background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 10, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--ink3)", borderBottom: "1px solid var(--bdr)" }}>
                    {["Servicio", "Descripción", "Uds.", ""].map(h => (
                      <th key={h} style={{ padding: "8px 12px", fontSize: 10, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {budgetItems.map((item, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--bdr)" }}>
                      <td style={{ padding: "6px 10px" }}>
                        <input className="input-field" style={{ fontSize: 12 }} value={item.name} onChange={e => { const n = [...budgetItems]; n[i] = { ...n[i], name: e.target.value }; setBudgetItems(n); }} placeholder="Nombre del servicio" />
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <input className="input-field" style={{ fontSize: 12 }} value={item.description} onChange={e => { const n = [...budgetItems]; n[i] = { ...n[i], description: e.target.value }; setBudgetItems(n); }} placeholder="Descripción" />
                      </td>
                      <td style={{ padding: "6px 10px", width: 70 }}>
                        <input className="input-field" type="number" style={{ fontSize: 12, width: 60, textAlign: "center" }} value={item.qty} min={1} onChange={e => { const n = [...budgetItems]; n[i] = { ...n[i], qty: parseInt(e.target.value) || 1 }; setBudgetItems(n); }} />
                      </td>
                      <td style={{ padding: "6px 10px", width: 40, textAlign: "center" }}>
                        <button onClick={() => setBudgetItems(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", padding: 4 }}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <button onClick={generateBudget} disabled={budgetLoading} className="btn-primary" style={{ padding: "12px 40px", fontSize: 14 }}>
              {budgetLoading ? <><Calculator size={16} style={{ animation: "spin 1s linear infinite" }} /> Generando presupuesto detallado...</> : <><FileText size={16} /> Generar presupuesto profesional</>}
            </button>
          </div>
          {budget && !budget.error && budget.sections && (
            <div ref={budgetRef}>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginBottom: 12 }}>
                <button onClick={printBudget} className="btn-secondary" style={{ fontSize: 12 }}>
                  <Printer size={14} /> Imprimir / PDF
                </button>
                <button onClick={downloadBudgetHTML} className="btn-secondary" style={{ fontSize: 12 }}>
                  <Download size={14} /> Descargar HTML
                </button>
              </div>
              <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "20px 24px", borderBottom: "3px solid var(--gold)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "var(--gold)" }}>Shopy<span style={{ color: "var(--t)" }}>Crafter</span></div>
                    <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>{budget.agency?.email} · {budget.agency?.web}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "var(--gold)" }}>{budget.budgetNumber}</div>
                    <div style={{ fontSize: 11, color: "var(--t3)" }}>Fecha: {budget.date} · Válido: {budget.validUntil}</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", borderBottom: "1px solid var(--bdr)" }}>
                  <div style={{ padding: "14px 20px", borderLeft: "3px solid var(--gold)", background: "rgba(200,168,75,0.04)" }}>
                    <div style={{ fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>DE</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t)" }}>{budget.agency?.name}</div>
                    {budget.agency?.nif && <div style={{ fontSize: 11, color: "var(--t2)" }}>NIF: {budget.agency.nif}</div>}
                  </div>
                  <div style={{ padding: "14px 20px", borderLeft: "3px solid #2d8cf0", background: "rgba(45,140,240,0.04)" }}>
                    <div style={{ fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>PARA</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t)" }}>{budget.client?.name}</div>
                    {budget.client?.nif && <div style={{ fontSize: 11, color: "var(--t2)" }}>NIF: {budget.client.nif}</div>}
                    {budget.client?.email && <div style={{ fontSize: 11, color: "var(--t2)" }}>{budget.client.email}</div>}
                  </div>
                </div>
                <div style={{ padding: "16px 20px" }}>
                  {(budget.sections ?? []).map((sec: any, si: number) => (
                    <div key={si} style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1, padding: "6px 0", borderBottom: "2px solid rgba(200,168,75,0.3)", marginBottom: 8 }}>{sec.sectionName}</div>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <th style={{ padding: "6px 10px", fontSize: 10, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid var(--bdr)" }}>Concepto</th>
                            <th style={{ padding: "6px 10px", fontSize: 10, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", textAlign: "right", borderBottom: "1px solid var(--bdr)" }}>Uds.</th>
                            <th style={{ padding: "6px 10px", fontSize: 10, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", textAlign: "right", borderBottom: "1px solid var(--bdr)" }}>P/U</th>
                            <th style={{ padding: "6px 10px", fontSize: 10, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", textAlign: "right", borderBottom: "1px solid var(--bdr)" }}>Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(sec.items ?? []).map((item: any, ii: number) => (
                            <tr key={ii}>
                              <td style={{ padding: "7px 10px", fontSize: 12, color: "var(--t)", borderBottom: "1px solid var(--bdr)" }}>{item.concept}</td>
                              <td style={{ padding: "7px 10px", fontSize: 12, color: "var(--t2)", textAlign: "right", borderBottom: "1px solid var(--bdr)" }}>{item.units}</td>
                              <td style={{ padding: "7px 10px", fontSize: 12, color: "var(--t2)", textAlign: "right", borderBottom: "1px solid var(--bdr)" }}>{Number(item.unitPrice).toFixed(2)} €</td>
                              <td style={{ padding: "7px 10px", fontSize: 12, fontWeight: 700, color: "var(--t)", textAlign: "right", borderBottom: "1px solid var(--bdr)" }}>{Number(item.subtotal).toFixed(2)} €</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{ textAlign: "right", fontSize: 12, fontWeight: 700, color: "var(--gold)", padding: "4px 10px" }}>Subtotal: {Number(sec.sectionSubtotal).toFixed(2)} €</div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: "0 20px 20px", display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ width: 280, border: "2px solid var(--gold)", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", borderBottom: "1px solid var(--bdr)" }}>
                      <span style={{ fontSize: 12, color: "var(--t2)" }}>Base imponible</span>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{Number(budget.summary?.baseImponible ?? 0).toFixed(2)} €</span>
                    </div>
                    {Number(budget.summary?.ivaAmount ?? 0) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", borderBottom: "1px solid var(--bdr)" }}>
                      <span style={{ fontSize: 12, color: "var(--t2)" }}>IVA ({budget.summary?.ivaRate ?? 21}%)</span>
                      <span style={{ fontSize: 12 }}>{Number(budget.summary?.ivaAmount ?? 0).toFixed(2)} €</span>
                    </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "var(--gold)", color: "#fff" }}>
                      <span style={{ fontSize: 14, fontWeight: 900 }}>TOTAL</span>
                      <span style={{ fontSize: 14, fontWeight: 900 }}>{Number(budget.summary?.total ?? 0).toFixed(2)} €</span>
                    </div>
                  </div>
                </div>
                {budget.summary?.totalInWords && (
                  <div style={{ padding: "0 20px 12px", textAlign: "right" }}>
                    <span style={{ fontSize: 11, color: "var(--t3)", fontStyle: "italic" }}>{budget.summary.totalInWords}</span>
                  </div>
                )}
                {budget.conditions && (
                  <div style={{ margin: "0 20px 20px", padding: 16, background: "rgba(200,168,75,0.05)", borderRadius: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Condiciones</div>
                    {budget.conditions.paymentTerms && <p style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.7 }}><strong>Forma de pago:</strong> {budget.conditions.paymentTerms}</p>}
                    {budget.conditions.deliveryTime && <p style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.7 }}><strong>Plazo de entrega:</strong> {budget.conditions.deliveryTime}</p>}
                    {budget.conditions.validity && <p style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.7 }}><strong>Validez:</strong> {budget.conditions.validity}</p>}
                    {budget.conditions.includesRevisions && <p style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.7 }}><strong>Revisiones:</strong> {budget.conditions.includesRevisions}</p>}
                    {budget.conditions.additionalNotes && <p style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.7 }}><strong>Notas:</strong> {budget.conditions.additionalNotes}</p>}
                  </div>
                )}
              </div>
              {budget.internalAnalysis && (
                <div className="glass-card" style={{ marginTop: 16, background: "rgba(200,168,75,0.06)", border: "1px solid rgba(200,168,75,0.2)" }}>
                  <h4 style={{ fontSize: 12, fontWeight: 800, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <TrendingUp size={14} /> Análisis interno (solo tú lo ves)
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                    {[
                      { label: "Coste para nosotros", value: `${Number(budget.internalAnalysis.totalCostForUs ?? 0).toFixed(0)} €` },
                      { label: "Margen bruto", value: `${Number(budget.internalAnalysis.totalMargin ?? 0).toFixed(0)} €` },
                      { label: "% Margen", value: `${budget.internalAnalysis.marginPercentage ?? 0}%` },
                      { label: "Horas estimadas", value: `${budget.internalAnalysis.hoursEstimated ?? 0}h` },
                      { label: "Rentabilidad", value: budget.internalAnalysis.profitabilityRating ?? "-" },
                    ].map((m, i) => (
                      <div key={i} style={{ padding: "10px 12px", background: "var(--ink2)", borderRadius: 8, textAlign: "center" }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--gold)" }}>{m.value}</div>
                        <div style={{ fontSize: 10, color: "var(--t3)" }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                  {budget.internalAnalysis.recommendation && (
                    <div style={{ marginTop: 10, padding: "8px 12px", background: "var(--ink3)", borderRadius: 6 }}>
                      <p style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.6 }}><strong style={{ color: "var(--gold)" }}>Recomendación:</strong> {budget.internalAnalysis.recommendation}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {budget?.error && (
            <div className="glass-card" style={{ textAlign: "center", color: "#ff6b6b", padding: 20 }}>
              <AlertTriangle size={24} style={{ marginBottom: 8 }} />
              <p style={{ fontSize: 13 }}>{budget.error}</p>
            </div>
          )}
        </div>
      ) : tab === "quote" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: 20 }}>
          <div className="glass-card">
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Datos del cliente</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "Nombre del cliente", key: "clientName", type: "text", placeholder: "Ej: María García", state: clientName, setState: setClientName },
                { label: "Nombre de la tienda", key: "storeName", type: "text", placeholder: "Ej: Modas El Sol", state: storeName, setState: setStoreName },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 11, color: "var(--t2)", display: "block", marginBottom: 4 }}>{f.label}</label>
                  <input className="input-field" type={f.type} placeholder={f.placeholder} value={f.state} onChange={e => f.setState(e.target.value)} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 11, color: "var(--t2)", display: "block", marginBottom: 4 }}>TIPO DE CLIENTE</label>
                <select className="input-field" value={quoteForm.clientType} onChange={e => setQuoteForm(f => ({ ...f, clientType: e.target.value }))}>
                  {["autonomo", "pyme", "empresa", "corporacion"].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--t2)", display: "block", marginBottom: 4 }}>NÚMERO DE TIENDAS</label>
                <input className="input-field" type="number" min={1} max={100} value={quoteForm.numStores} onChange={e => setQuoteForm(f => ({ ...f, numStores: parseInt(e.target.value) || 1 }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--t2)", display: "block", marginBottom: 4 }}>NICHO</label>
                <input className="input-field" placeholder="moda, tecnología, deporte..." value={quoteForm.niche} onChange={e => setQuoteForm(f => ({ ...f, niche: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--t2)", display: "block", marginBottom: 4 }}>REVENUE MENSUAL ESTIMADO (€)</label>
                <input className="input-field" type="number" value={quoteForm.estimatedRevenue} onChange={e => setQuoteForm(f => ({ ...f, estimatedRevenue: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: "var(--t2)", display: "block", marginBottom: 4 }}>TIMELINE</label>
                  <select className="input-field" value={quoteForm.timeline} onChange={e => setQuoteForm(f => ({ ...f, timeline: e.target.value }))}>
                    <option value="normal">Normal</option>
                    <option value="express">Express</option>
                    <option value="flexible">Flexible</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: "var(--t2)", display: "block", marginBottom: 4 }}>CONTRATO</label>
                  <select className="input-field" value={quoteForm.contractLength} onChange={e => setQuoteForm(f => ({ ...f, contractLength: e.target.value }))}>
                    <option value="monthly">Mensual</option>
                    <option value="6months">6 meses</option>
                    <option value="annual">Anual</option>
                  </select>
                </div>
              </div>
              <button onClick={generateQuote} disabled={quoteLoading} className="btn-primary">
                {quoteLoading ? <><Calculator size={14} style={{ animation: "spin 1s linear infinite" }} /> Calculando...</> : <><Calculator size={14} /> Generar presupuesto</>}
              </button>
            </div>
          </div>

          <div>
            {quote ? (
              <div className="glass-card" style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <DollarSign size={16} color="var(--gold)" />
                  <h3 style={{ fontSize: 14, fontWeight: 700 }}>Presupuesto Shopy Crafter CFO</h3>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 10, marginBottom: 16 }}>
                  {[
                    { label: "Setup", value: `€${quote.setupPrice?.toFixed(0)}`, color: "var(--gold)" },
                    { label: "Retainer/mes", value: `€${quote.monthlyRetainer?.toFixed(0)}`, color: "var(--jade)" },
                    { label: "Valor anual", value: `€${quote.annualValue?.toFixed(0)}`, color: "#5b4eff" },
                    { label: "Tu margen", value: `${quote.marginPct?.toFixed(0)}%`, color: quote.marginPct >= 65 ? "var(--jade)" : "var(--gold)" },
                  ].map((item, i) => (
                    <div key={i} style={{ padding: "10px 12px", background: "var(--ink3)", borderRadius: 8, textAlign: "center" }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: item.color }}>{item.value}</div>
                      <div style={{ fontSize: 11, color: "var(--t3)" }}>{item.label}</div>
                    </div>
                  ))}
                </div>
                {quote.justification && (
                  <div style={{ padding: 12, background: "rgba(200,168,75,0.08)", borderRadius: 8, marginBottom: 12 }}>
                    <p style={{ fontSize: 12, color: "var(--t)", lineHeight: 1.6 }}>{quote.justification}</p>
                  </div>
                )}
                {quote.negotiationNotes && (
                  <p style={{ fontSize: 11, color: "var(--t3)", fontStyle: "italic", marginBottom: 12 }}>
                    💬 {quote.negotiationNotes}
                  </p>
                )}
                {quote.upsellOpportunities?.length > 0 && (
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>💡 Oportunidades de upsell:</p>
                    {quote.upsellOpportunities.map((u: string, i: number) => (
                      <p key={i} style={{ fontSize: 12, color: "var(--t2)", marginBottom: 4 }}>• {u}</p>
                    ))}
                  </div>
                )}
                <button onClick={generateProposal} disabled={proposalLoading || !clientName} className="btn-secondary" style={{ marginTop: 12, width: "100%", justifyContent: "center" }}>
                  {proposalLoading ? <><FileText size={14} style={{ animation: "spin 1s linear infinite" }} /> Generando propuesta...</> : <><FileText size={14} /> Generar propuesta completa</>}
                </button>
              </div>
            ) : (
              <div className="glass-card" style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "var(--t3)" }}>
                <Calculator size={32} style={{ opacity: 0.3, marginBottom: 10 }} />
                <p style={{ fontSize: 13 }}>Completa el formulario y genera el presupuesto</p>
              </div>
            )}

            {proposal && (
              <div className="glass-card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700 }}>📄 Propuesta generada</h3>
                  <button onClick={() => { navigator.clipboard.writeText(proposal); }} className="btn-secondary" style={{ fontSize: 11 }}>Copiar</button>
                </div>
                <div style={{ background: "var(--ink3)", borderRadius: 8, padding: 16, maxHeight: 400, overflowY: "auto" }}>
                  <pre style={{ fontSize: 12, color: "var(--t)", lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: "var(--fb)" }}>{proposal}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* ── Shopify Sync tab ──────────────────────────────────────────────────── */}
      {tab === "shopify" && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--t)", marginBottom: 4 }}>Crear productos en tu tienda Shopify</h2>
            <p style={{ fontSize: 12, color: "var(--t3)" }}>
              Selecciona la tienda conectada y pulsa "Crear productos". Se crearán automáticamente en tu Shopify y se añadirán a la colección <strong style={{ color: "var(--gold2)" }}>shopify-automatization</strong>.
            </p>
          </div>

          {/* Project selector + push button */}
          <div className="glass-card" style={{ padding: "20px 24px", marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", color: "var(--t3)", textTransform: "uppercase", marginBottom: 12 }}>
              Tienda origen (token OAuth)
            </p>
            {projects.length === 0 ? (
              <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(200,168,75,0.06)", border: "1px solid rgba(200,168,75,0.25)", display: "flex", alignItems: "flex-start", gap: 10 }}>
                <AlertTriangle size={15} style={{ color: "var(--gold)", flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--gold)", marginBottom: 4 }}>Sin tiendas conectadas</p>
                  <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5 }}>
                    Para crear los productos automaticamente, primero conecta <strong>comic-crafter.myshopify.com</strong> como proyecto.<br />
                    Ve al botón <strong>"+ Nueva tienda"</strong> en el sidebar → escribe el dominio de tu tienda → conecta via Shopify.
                    Una vez conectada, el token OAuth se captura automáticamente y puedes hacer el push aquí.
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <select
                  value={selectedProjectId ?? ""}
                  onChange={e => setSelectedProjectId(Number(e.target.value) || null)}
                  style={{ flex: 1, minWidth: 220, padding: "10px 12px", background: "var(--ink)", border: "1px solid var(--ink3)", borderRadius: 8, color: "var(--t)", fontSize: 13, outline: "none" }}
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.shopDomain ? ` — ${p.shopDomain}` : ""}
                    </option>
                  ))}
                </select>
                <button
                  onClick={pushToShopify}
                  disabled={pushing || !selectedProjectId}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 8,
                    background: pushing ? "rgba(45,212,159,0.06)" : "rgba(45,212,159,0.12)",
                    border: "1px solid rgba(45,212,159,0.35)",
                    color: "var(--jade)", cursor: pushing ? "wait" : "pointer", fontSize: 13, fontWeight: 700,
                    opacity: (!selectedProjectId && !pushing) ? 0.5 : 1,
                  }}
                >
                  {pushing
                    ? <><RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Creando productos…</>
                    : <><Upload size={13} /> Crear productos en Shopify</>
                  }
                </button>
                <button onClick={loadShopifyProducts} disabled={loadingShopify} className="btn-secondary" style={{ fontSize: 12 }}>
                  {loadingShopify ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={13} />}
                  {loadingShopify ? "Cargando..." : "Cargar productos"}
                </button>
              </div>
            )}
          </div>

          {/* Push result */}
          {pushResult && (
            <div style={{ padding: "14px 18px", borderRadius: 10, marginBottom: 16,
              background: pushResult.success ? "rgba(45,212,159,0.06)" : "rgba(200,168,75,0.06)",
              border: `1px solid ${pushResult.success ? "rgba(45,212,159,0.3)" : "rgba(200,168,75,0.3)"}`,
            }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: pushResult.success ? "var(--jade)" : "var(--gold)", marginBottom: 6 }}>
                {pushResult.message}
              </p>
              {pushResult.storeUrl && (
                <a href={pushResult.storeUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--gold2)", display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
                  <ExternalLink size={11} /> Ver colección en tu tienda →
                </a>
              )}
              {pushResult.instructions?.map((inst, i) => (
                <p key={i} style={{ fontSize: 11.5, color: "var(--t3)", marginTop: 3 }}>• {inst}</p>
              ))}
            </div>
          )}

          {/* Services mapping table */}
          <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--bdr)" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t)" }}>
                {shopifyProducts.length > 0 ? `${shopifyProducts.length} productos en tu tienda Shopify` : "Carga los productos de tu tienda para vincularlos"}
              </p>
            </div>
            {services.map((svc, i) => {
              const allVariants: { variantId: string; label: string }[] = [];
              shopifyProducts.forEach((p) => {
                p.variants.edges.forEach((e) => {
                  const currency = e.node.price.currencyCode === "EUR" ? "€" : e.node.price.currencyCode;
                  allVariants.push({ variantId: e.node.id, label: `${p.title} — ${e.node.title !== "Default Title" ? e.node.title + " — " : ""}${currency}${parseFloat(e.node.price.amount).toFixed(0)}` });
                });
              });
              const isLinked = !!(svc.shopifyVariantId);
              const selection = variantSelections[svc.id] ?? svc.shopifyVariantId ?? "";
              const isDirty = selection !== (svc.shopifyVariantId ?? "");
              return (
                <div key={svc.id} style={{ padding: "12px 16px", borderBottom: i < services.length - 1 ? "1px solid var(--bdr)" : "none", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: isLinked ? "var(--jade)" : "var(--bdr)", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t)", marginBottom: 2 }}>{svc.serviceName}</p>
                    <p style={{ fontSize: 11, color: "var(--t3)" }}>€{(svc.priceSuggested ?? svc.priceCurrent ?? 0).toFixed(0)} · {svc.serviceType}</p>
                  </div>
                  <div style={{ flex: 2, minWidth: 0 }}>
                    <select
                      className="form-input"
                      style={{ fontSize: 12, padding: "6px 10px" }}
                      value={selection}
                      onChange={(e) => setVariantSelections((prev) => ({ ...prev, [svc.id]: e.target.value }))}
                      disabled={allVariants.length === 0}
                    >
                      <option value="">{allVariants.length === 0 ? "Carga productos primero →" : "— Sin vincular —"}</option>
                      {allVariants.map((v) => (
                        <option key={v.variantId} value={v.variantId}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {isLinked && !isDirty && (
                      <span style={{ fontSize: 11, color: "var(--jade)", display: "flex", alignItems: "center", gap: 3 }}>
                        <CheckCircle size={12} /> Vinculado
                      </span>
                    )}
                    {(isDirty || !isLinked) && selection !== (svc.shopifyVariantId ?? "") && (
                      <button
                        onClick={() => saveVariant(svc.id)}
                        disabled={savingVariant === svc.id}
                        style={{
                          display: "flex", alignItems: "center", gap: 5, padding: "5px 10px",
                          borderRadius: 7, border: "1px solid rgba(200,168,75,0.4)",
                          background: "rgba(200,168,75,0.1)", color: "var(--gold)", cursor: "pointer", fontSize: 12, fontWeight: 600,
                        }}
                      >
                        {savingVariant === svc.id ? <RefreshCw size={11} style={{ animation: "spin 0.8s linear infinite" }} /> : <Save size={11} />}
                        Guardar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid var(--bdr)" }}>
            <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--t)", marginBottom: 8 }}>
              <ShoppingBag size={13} style={{ display: "inline", marginRight: 6 }} />
              Cómo funciona el cobro con Shopify
            </p>
            {[
              "1. Crea los productos en tu tienda con 'Crear productos en Shopify' (botón arriba)",
              "2. Carga los productos de tu tienda con 'Cargar productos Shopify'",
              "3. Vincula cada servicio a su producto/variante de Shopify usando los selectores",
              "4. En Gestión de Clientes → botón 'Cobrar' → selecciona el servicio → genera el link de pago",
              "5. Copia el link o envíalo directamente por chat al cliente. El cliente paga en tu tienda Shopify.",
            ].map((step, i) => (
              <p key={i} style={{ fontSize: 12, color: "var(--t2)", marginBottom: 4, lineHeight: 1.5 }}>{step}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
