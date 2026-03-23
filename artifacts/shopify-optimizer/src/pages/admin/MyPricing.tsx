import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Minus, Calculator, FileText, RefreshCw, Save, ChevronDown, ChevronUp, DollarSign } from "lucide-react";

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
}

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

  const load = async () => {
    setLoading(true);
    const [c, s] = await Promise.all([
      fetch(`${API_BASE}/api/agency/cost-structure`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API_BASE}/api/agency/services`, { credentials: "include" }).then(r => r.json()),
    ]);
    setCosts(c); setServices(s); setEditCosts(c); setLoading(false);
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

  const TABS = [
    { id: "services", label: "Tabla de precios" },
    { id: "costs", label: "Estructura de costes" },
    { id: "quote", label: "Generar propuesta" },
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
          <button onClick={runAnalysis} disabled={analyzing} className="btn-primary">
            {analyzing ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Analizando...</> : <><TrendingUp size={14} /> Analizar precios</>}
          </button>
        )}
      </div>

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
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
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
                  <button
                    onClick={() => { navigator.clipboard.writeText(proposal); }}
                    className="btn-secondary" style={{ fontSize: 11 }}
                  >Copiar</button>
                </div>
                <div style={{ background: "var(--ink3)", borderRadius: 8, padding: 16, maxHeight: 400, overflowY: "auto" }}>
                  <pre style={{ fontSize: 12, color: "var(--t)", lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: "var(--fb)" }}>
                    {proposal}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
