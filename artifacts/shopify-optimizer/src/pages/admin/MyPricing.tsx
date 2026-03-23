import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Minus, Calculator, FileText, RefreshCw, Save, ChevronDown, ChevronUp, DollarSign, Upload, CheckCircle, AlertTriangle, ExternalLink, Link, ShoppingBag } from "lucide-react";

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
  const [tab, setTab] = useState<"services" | "costs" | "quote" | "proposal">("services");
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
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ success: boolean; message: string; requiresManualImport?: boolean; created?: number; failed?: number; instructions?: string[]; storeUrl?: string } | null>(null);
  const [projects, setProjects] = useState<Array<{ id: number; name: string; shopDomain: string | null }>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [shopifyProducts, setShopifyProducts] = useState<ShopifyProduct[]>([]);
  const [shopifyConfigured, setShopifyConfigured] = useState<boolean | null>(null);
  const [shopifyMsg, setShopifyMsg] = useState("");
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
      setPushResult({ success: false, message: "Error de conexión al intentar hacer push a Shopify" });
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

  const TABS = [
    { id: "services", label: "Tabla de precios" },
    { id: "costs", label: "Estructura de costes" },
    { id: "quote", label: "Generar propuesta" },
    { id: "shopify", label: "🛍 Shopify Sync" },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>💰 Mi Pricing CFO</h1>
          <p style={{ fontSize: 13, color: "var(--t2)", marginTop: 3 }}>
            Shopy Brain como tu Director Financiero y Comercial personal
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
              {pushing ? "Subiendo..." : "Push a Shopify"}
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
            <span style={{ fontWeight: 700, color: "var(--gold)" }}>Análisis OmniCore CFO</span>
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
                      {["Servicio", "Tu coste", "Precio actual", "Margen", "Mercado avg", "OmniCore dice"].map(h => (
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
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
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
                  <h3 style={{ fontSize: 14, fontWeight: 700 }}>Presupuesto OmniCore CFO</h3>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
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
      )}

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
                    Para crear los productos automáticamente, primero conecta <strong>comiccrafter.es</strong> como proyecto.<br />
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
