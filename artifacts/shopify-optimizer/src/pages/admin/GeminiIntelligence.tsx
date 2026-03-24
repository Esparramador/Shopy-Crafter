import { useState } from "react";
import { Brain, Search, TrendingUp, Users, Building2, Package, Zap, ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

type Tab = "business" | "market" | "competitor" | "trends" | "full-audit";

interface ResearchState {
  loading: boolean;
  data: unknown | null;
  error: string | null;
}

const NICHES_ES = ["Moda y ropa", "Electrónica", "Hogar y decoración", "Belleza y cosmética", "Deportes", "Alimentación gourmet", "Mascotas", "Joyería y accesorios", "Bebés y niños", "Libros y papelería", "Arte y manualidades", "Automóvil", "Jardinería", "Viajes y aventura", "Fitness y salud"];

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: "1px solid var(--ink3)", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "var(--ink2)", border: "none", cursor: "pointer", color: "var(--t)", fontSize: 13, fontWeight: 600 }}>
        {title}
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && <div style={{ padding: 16 }}>{children}</div>}
    </div>
  );
}

function TagList({ items, color = "var(--gold)" }: { items: string[]; color?: string }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items?.map((item, i) => (
        <span key={i} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 20, background: `${color}18`, color, fontWeight: 500 }}>{item}</span>
      ))}
    </div>
  );
}

function Bullet({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--ink3)" }}>
      <span style={{ fontSize: 11, color: "var(--t3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", minWidth: 130, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--t)", lineHeight: 1.5 }}>{value}</span>
    </div>
  );
}

function BadgePill({ text, level }: { text: string; level?: "good" | "warn" | "bad" | "neutral" }) {
  const colors = { good: "var(--jade)", warn: "#f59e0b", bad: "var(--crim)", neutral: "var(--gold)" };
  const c = colors[level ?? "neutral"];
  return <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: `${c}20`, color: c, fontWeight: 600 }}>{text}</span>;
}

function BusinessResult({ data }: { data: { profile: ReturnType<typeof Object>; strategicPlan: string } }) {
  const p = data.profile as Record<string, unknown>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: "var(--t)", margin: 0 }}>{p.name as string}</h3>
            <p style={{ fontSize: 12, color: "var(--t3)", margin: "4px 0 0" }}>{p.domain as string}</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <BadgePill text={p.marketPosition as string} level="neutral" />
            <BadgePill text={`SEO: ${p.seoStrength}`} level={(p.seoStrength as string)?.includes("strong") ? "good" : "warn"} />
            <BadgePill text={p.size as string} level="neutral" />
          </div>
        </div>
        <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6, margin: "0 0 16px" }}>{p.description as string}</p>
        <Bullet label="Industria" value={p.industry as string} />
        <Bullet label="Revenue estimado" value={p.estimatedRevenue as string} />
        <Bullet label="Rango de precios" value={p.priceRange as string} />
        <Bullet label="Audiencia" value={p.targetAudience as string} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Section title="✅ Fortalezas">
          <TagList items={p.strengths as string[]} color="var(--jade)" />
        </Section>
        <Section title="⚠️ Debilidades">
          <TagList items={p.weaknesses as string[]} color="#f59e0b" />
        </Section>
        <Section title="🚀 Oportunidades">
          <TagList items={p.opportunities as string[]} color="var(--gold)" />
        </Section>
        <Section title="⚡ Amenazas">
          <TagList items={p.threats as string[]} color="var(--crim)" />
        </Section>
      </div>

      <Section title="🧠 Plan estratégico (Claude + OmniCore)">
        <pre style={{ fontSize: 12, color: "var(--t2)", whiteSpace: "pre-wrap", lineHeight: 1.7, margin: 0, fontFamily: "inherit" }}>{data.strategicPlan}</pre>
      </Section>
    </div>
  );
}

function MarketResult({ data }: { data: { market: Record<string, unknown> } }) {
  const m = data.market;
  const priceRange = m.avgPriceRange as { min: number; max: number; sweet: number };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{m.niche as string} · {m.market as string}</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <BadgePill text={m.growthRate as string} level={m.growthRate === "booming" || m.growthRate === "growing" ? "good" : "warn"} />
            <BadgePill text={`Saturación: ${m.saturationLevel}`} level={m.saturationLevel === "low" ? "good" : m.saturationLevel === "saturated" ? "bad" : "warn"} />
          </div>
        </div>
        <Bullet label="Tamaño mercado" value={m.marketSize as string} />
        {priceRange && <Bullet label="Precio promedio" value={`€${priceRange.min} – €${priceRange.max} · sweet spot: €${priceRange.sweet}`} />}
        <Bullet label="Buyer persona" value={m.buyerPersona as string} />
        <Bullet label="Posicionamiento rec." value={m.recommendedPositioning as string} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Section title="🏆 Top Players">
          <TagList items={m.topPlayers as string[]} color="var(--t2)" />
        </Section>
        <Section title="🔍 Keywords principales">
          <TagList items={m.topKeywords as string[]} color="var(--jade)" />
        </Section>
        <Section title="📅 Picos estacionales">
          <TagList items={m.seasonalPeaks as string[]} color="#60a5fa" />
        </Section>
        <Section title="🚀 Tendencias emergentes">
          <TagList items={m.emergingTrends as string[]} color="var(--gold)" />
        </Section>
        <Section title="✅ Por qué compran">
          <TagList items={m.purchaseDrivers as string[]} color="var(--jade)" />
        </Section>
        <Section title="🚧 Por qué NO compran">
          <TagList items={m.mainBarriers as string[]} color="var(--crim)" />
        </Section>
      </div>
      <Section title="💡 Oportunidades de mercado">
        <TagList items={m.opportunities as string[]} color="var(--gold)" />
      </Section>
    </div>
  );
}

function CompetitorResult({ data }: { data: { competitor: Record<string, unknown>; gaps: Record<string, unknown> } }) {
  const c = data.competitor;
  const g = data.gaps;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="glass-card" style={{ padding: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>{c.domain as string}</h3>
        <Bullet label="Posicionamiento" value={c.positioningStrategy as string} />
        <Bullet label="Estrategia precios" value={c.pricingStrategy as string} />
        <Bullet label="Contenido/SEO" value={c.contentStrategy as string} />
        <Bullet label="Tráfico estimado" value={c.estimatedTraffic as string} />
        <Bullet label="Nº productos" value={c.productCount as string} />
        <Bullet label="Precio medio" value={c.avgProductPrice as string} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Section title="🔑 Keywords objetivo">
          <TagList items={c.topKeywords as string[]} color="var(--jade)" />
        </Section>
        <Section title="💪 Sus USPs">
          <TagList items={c.uniqueSellingPoints as string[]} color="var(--t2)" />
        </Section>
        <Section title="⚠️ Sus debilidades">
          <TagList items={c.weaknesses as string[]} color="var(--crim)" />
        </Section>
        <Section title="🎯 Tácticas de conversión">
          <TagList items={c.conversionTactics as string[]} color="#8b5cf6" />
        </Section>
      </div>

      {g && (
        <div className="glass-card" style={{ padding: 20, border: "1px solid rgba(200,168,75,0.2)" }}>
          <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "var(--gold)" }}>🧠 Análisis de brechas (Claude)</h4>
          <Bullet label="Oportunidad pricing" value={g.pricingOpportunity as string} />
          <Bullet label="Brecha SEO" value={g.seoGap as string} />
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 11, color: "var(--t3)", fontWeight: 700, marginBottom: 8 }}>QUICK WINS</p>
            <TagList items={g.quickWins as string[]} color="var(--jade)" />
          </div>
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 11, color: "var(--t3)", fontWeight: 700, marginBottom: 8 }}>CONTENT GAPS</p>
            <TagList items={g.contentGaps as string[]} color="#60a5fa" />
          </div>
        </div>
      )}
    </div>
  );
}

function TrendsResult({ data }: { data: { trends: Record<string, unknown> } }) {
  const t = data.trends;
  const pr = t.priceRange as { min: number; max: number };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{t.productType as string}</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <BadgePill text={t.demandLevel as string} level={["high", "very high"].includes(t.demandLevel as string) ? "good" : "warn"} />
            <BadgePill text={t.trendDirection as string} level={t.trendDirection === "rising" ? "good" : t.trendDirection === "declining" ? "bad" : "neutral"} />
          </div>
        </div>
        <Bullet label="Precio promedio" value={`€${t.avgPrice}`} />
        {pr && <Bullet label="Rango precios" value={`€${pr.min} – €${pr.max}`} />}
        <Bullet label="Tendencia búsquedas" value={t.searchVolumeTrend as string} />
        <Bullet label="Estacionalidad" value={t.seasonality as string} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Section title="🏆 Competidores top">
          <TagList items={t.topCompetitors as string[]} color="var(--t2)" />
        </Section>
        <Section title="⭐ Features que convierten">
          <TagList items={t.keyFeatures as string[]} color="var(--jade)" />
        </Section>
        <Section title="📝 Patrones de descripción">
          <TagList items={t.winningDescriptionPatterns as string[]} color="#8b5cf6" />
        </Section>
        <Section title="🖼 Tipos de imagen">
          <TagList items={t.topImageTypes as string[]} color="#60a5fa" />
        </Section>
        <Section title="🎯 CTAs que convierten">
          <TagList items={t.ctasThatConvert as string[]} color="var(--gold)" />
        </Section>
        <Section title="💡 Recomendaciones">
          <TagList items={t.recommendations as string[]} color="var(--jade)" />
        </Section>
      </div>
    </div>
  );
}

function FullAuditResult({ data }: { data: { businessProfile: Record<string, unknown>; marketIntel: Record<string, unknown>; synthesis: string } }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="glass-card" style={{ padding: 20, border: "1px solid rgba(200,168,75,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 24 }}>🧠</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--gold)" }}>OmniCore Intelligence Brief</h3>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--t3)" }}>Generado por Gemini + Claude + OmniCore · Guardado en brain</p>
          </div>
        </div>
        <pre style={{ fontSize: 12, color: "var(--t2)", whiteSpace: "pre-wrap", lineHeight: 1.8, margin: 0, fontFamily: "inherit" }}>{data.synthesis}</pre>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Section title="📊 Business Profile" defaultOpen={false}>
          <BusinessResult data={{ profile: data.businessProfile, strategicPlan: "" }} />
        </Section>
        <Section title="📈 Market Intelligence" defaultOpen={false}>
          <MarketResult data={{ market: data.marketIntel }} />
        </Section>
      </div>
    </div>
  );
}

export default function GeminiIntelligence() {
  const [activeTab, setActiveTab] = useState<Tab>("full-audit");
  const [state, setState] = useState<ResearchState>({ loading: false, data: null, error: null });

  const [bizForm, setBizForm] = useState({ businessName: "", domain: "", niche: "", market: "es" });
  const [marketForm, setMarketForm] = useState({ niche: "", market: "es" });
  const [compForm, setCompForm] = useState({ domain: "", niche: "", market: "es" });
  const [trendsForm, setTrendsForm] = useState({ productType: "", market: "es" });
  const [auditForm, setAuditForm] = useState({ businessName: "", domain: "", niche: "", market: "es" });

  const doResearch = async (endpoint: string, body: object) => {
    setState({ loading: true, data: null, error: null });
    try {
      const res = await fetch(`${API}/api/gemini/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Research failed");
      setState({ loading: false, data: json, error: null });
    } catch (err: unknown) {
      setState({ loading: false, data: null, error: err instanceof Error ? err.message : "Error desconocido" });
    }
  };

  const TABS: { id: Tab; icon: React.ReactNode; label: string }[] = [
    { id: "full-audit", icon: <Zap size={14} />, label: "Full Audit" },
    { id: "business", icon: <Building2 size={14} />, label: "Empresa" },
    { id: "market", icon: <TrendingUp size={14} />, label: "Mercado" },
    { id: "competitor", icon: <Search size={14} />, label: "Competidor" },
    { id: "trends", icon: <Package size={14} />, label: "Producto" },
  ];

  const inputStyle = { width: "100%", padding: "10px 12px", background: "var(--ink)", border: "1px solid var(--ink3)", borderRadius: 8, color: "var(--t)", fontSize: 13, outline: "none", boxSizing: "border-box" as const };
  const labelStyle = { fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase" as const, letterSpacing: "0.6px", display: "block", marginBottom: 6 };

  return (
    <div style={{ padding: "24px 28px", maxWidth: 960, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #4285f4, #34a853, #fbbc05, #ea4335)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Brain size={20} style={{ color: "#fff" }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--t)" }}>Gemini Intelligence</h1>
            <p style={{ margin: 0, fontSize: 12, color: "var(--t3)" }}>Gemini Research → Claude Analysis → OmniCore Learning</p>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 10, padding: "4px 10px", borderRadius: 20, background: "rgba(66,133,244,0.15)", color: "#4285f4", fontWeight: 700 }}>ONLINE</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 16 }}>
          {[{ icon: "🔍", label: "Gemini Pro", desc: "Investigación profunda" }, { icon: "🧠", label: "Claude + OmniCore", desc: "Análisis estratégico" }, { icon: "💾", label: "Auto-aprendizaje", desc: "Guarda en brain" }].map((item, i) => (
            <div key={i} className="glass-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <div><p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--t)" }}>{item.label}</p><p style={{ margin: 0, fontSize: 10, color: "var(--t3)" }}>{item.desc}</p></div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 20, background: "var(--ink2)", padding: 4, borderRadius: 10, width: "fit-content" }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setState({ loading: false, data: null, error: null }); }}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: activeTab === tab.id ? "var(--gold)" : "transparent", color: activeTab === tab.id ? "var(--ink)" : "var(--t3)", transition: "all 0.2s" }}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 20, alignItems: "start" }}>
        <div className="glass-card" style={{ padding: 20 }}>
          {activeTab === "full-audit" && (
            <form onSubmit={e => { e.preventDefault(); doResearch("research/full-audit", auditForm); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "var(--gold)" }}>🔎 Auditoría Completa</h3>
              <p style={{ margin: 0, fontSize: 11, color: "var(--t3)", lineHeight: 1.5 }}>Gemini investiga el negocio + mercado. Claude sintetiza el brief estratégico. Se guarda en OmniCore Brain.</p>
              <div><label style={labelStyle}>Nombre empresa / tienda</label><input style={inputStyle} value={auditForm.businessName} onChange={e => setAuditForm(f => ({ ...f, businessName: e.target.value }))} placeholder="Ej: Zara Home" required /></div>
              <div><label style={labelStyle}>Dominio</label><input style={inputStyle} value={auditForm.domain} onChange={e => setAuditForm(f => ({ ...f, domain: e.target.value }))} placeholder="zarahome.com" required /></div>
              <div><label style={labelStyle}>Nicho</label>
                <select style={{ ...inputStyle, cursor: "pointer" }} value={auditForm.niche} onChange={e => setAuditForm(f => ({ ...f, niche: e.target.value }))} required>
                  <option value="">Selecciona nicho...</option>
                  {NICHES_ES.map(n => <option key={n} value={n}>{n}</option>)}
                  <option value="custom">Otro...</option>
                </select>
                {auditForm.niche === "custom" && <input style={{ ...inputStyle, marginTop: 6 }} placeholder="Especifica el nicho" onChange={e => setAuditForm(f => ({ ...f, niche: e.target.value }))} />}
              </div>
              <div><label style={labelStyle}>Mercado</label>
                <select style={{ ...inputStyle, cursor: "pointer" }} value={auditForm.market} onChange={e => setAuditForm(f => ({ ...f, market: e.target.value }))}>
                  <option value="es">🇪🇸 España</option>
                  <option value="en">🇬🇧 English</option>
                  <option value="us">🇺🇸 USA</option>
                  <option value="latam">🌎 LATAM</option>
                  <option value="mx">🇲🇽 México</option>
                  <option value="de">🇩🇪 Alemania</option>
                  <option value="fr">🇫🇷 Francia</option>
                </select>
              </div>
              <button type="submit" disabled={state.loading} style={{ width: "100%", padding: "11px", borderRadius: 8, border: "none", cursor: state.loading ? "not-allowed" : "pointer", background: "linear-gradient(135deg, #4285f4, #34a853)", color: "#fff", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: state.loading ? 0.7 : 1 }}>
                {state.loading ? <><Loader2 size={14} className="animate-spin" />Investigando (30–60s)...</> : <><Zap size={14} />Lanzar Auditoría Completa</>}
              </button>
            </form>
          )}

          {activeTab === "business" && (
            <form onSubmit={e => { e.preventDefault(); doResearch("research/business", bizForm); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "var(--gold)" }}>🏢 Investigar Empresa</h3>
              <div><label style={labelStyle}>Nombre empresa</label><input style={inputStyle} value={bizForm.businessName} onChange={e => setBizForm(f => ({ ...f, businessName: e.target.value }))} placeholder="Ej: Mango" required /></div>
              <div><label style={labelStyle}>Dominio</label><input style={inputStyle} value={bizForm.domain} onChange={e => setBizForm(f => ({ ...f, domain: e.target.value }))} placeholder="mango.com" required /></div>
              <div><label style={labelStyle}>Nicho</label><input style={inputStyle} value={bizForm.niche} onChange={e => setBizForm(f => ({ ...f, niche: e.target.value }))} placeholder="Moda y ropa" required /></div>
              <div><label style={labelStyle}>Mercado</label>
                <select style={{ ...inputStyle, cursor: "pointer" }} value={bizForm.market} onChange={e => setBizForm(f => ({ ...f, market: e.target.value }))}>
                  <option value="es">🇪🇸 España</option><option value="en">🇬🇧 English</option><option value="us">🇺🇸 USA</option><option value="latam">🌎 LATAM</option>
                </select>
              </div>
              <button type="submit" disabled={state.loading} style={{ width: "100%", padding: "11px", borderRadius: 8, border: "none", cursor: state.loading ? "not-allowed" : "pointer", background: "linear-gradient(135deg, #4285f4, #34a853)", color: "#fff", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {state.loading ? <><Loader2 size={14} className="animate-spin" />Analizando...</> : <><Search size={14} />Investigar empresa</>}
              </button>
            </form>
          )}

          {activeTab === "market" && (
            <form onSubmit={e => { e.preventDefault(); doResearch("research/market", marketForm); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "var(--gold)" }}>📈 Inteligencia de Mercado</h3>
              <p style={{ margin: 0, fontSize: 11, color: "var(--t3)" }}>Los resultados se guardan automáticamente en OmniCore Brain como niche profile.</p>
              <div><label style={labelStyle}>Nicho</label>
                <select style={{ ...inputStyle, cursor: "pointer" }} value={marketForm.niche} onChange={e => setMarketForm(f => ({ ...f, niche: e.target.value }))} required>
                  <option value="">Selecciona nicho...</option>
                  {NICHES_ES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>Mercado</label>
                <select style={{ ...inputStyle, cursor: "pointer" }} value={marketForm.market} onChange={e => setMarketForm(f => ({ ...f, market: e.target.value }))}>
                  <option value="es">🇪🇸 España</option><option value="en">🇬🇧 English</option><option value="us">🇺🇸 USA</option><option value="latam">🌎 LATAM</option>
                </select>
              </div>
              <button type="submit" disabled={state.loading} style={{ width: "100%", padding: "11px", borderRadius: 8, border: "none", cursor: state.loading ? "not-allowed" : "pointer", background: "linear-gradient(135deg, #4285f4, #34a853)", color: "#fff", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {state.loading ? <><Loader2 size={14} className="animate-spin" />Analizando mercado...</> : <><TrendingUp size={14} />Analizar mercado</>}
              </button>
            </form>
          )}

          {activeTab === "competitor" && (
            <form onSubmit={e => { e.preventDefault(); doResearch("research/competitor", compForm); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "var(--gold)" }}>🔍 Análisis Competidor</h3>
              <div><label style={labelStyle}>Dominio competidor</label><input style={inputStyle} value={compForm.domain} onChange={e => setCompForm(f => ({ ...f, domain: e.target.value }))} placeholder="competitor.com" required /></div>
              <div><label style={labelStyle}>Nicho</label><input style={inputStyle} value={compForm.niche} onChange={e => setCompForm(f => ({ ...f, niche: e.target.value }))} placeholder="Moda y ropa" required /></div>
              <div><label style={labelStyle}>Mercado</label>
                <select style={{ ...inputStyle, cursor: "pointer" }} value={compForm.market} onChange={e => setCompForm(f => ({ ...f, market: e.target.value }))}>
                  <option value="es">🇪🇸 España</option><option value="en">🇬🇧 English</option><option value="us">🇺🇸 USA</option>
                </select>
              </div>
              <button type="submit" disabled={state.loading} style={{ width: "100%", padding: "11px", borderRadius: 8, border: "none", cursor: state.loading ? "not-allowed" : "pointer", background: "linear-gradient(135deg, #4285f4, #34a853)", color: "#fff", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {state.loading ? <><Loader2 size={14} className="animate-spin" />Analizando...</> : <><Search size={14} />Analizar competidor</>}
              </button>
            </form>
          )}

          {activeTab === "trends" && (
            <form onSubmit={e => { e.preventDefault(); doResearch("research/product-trends", trendsForm); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "var(--gold)" }}>📦 Tendencias de Producto</h3>
              <div><label style={labelStyle}>Tipo de producto</label><input style={inputStyle} value={trendsForm.productType} onChange={e => setTrendsForm(f => ({ ...f, productType: e.target.value }))} placeholder="Ej: vestidos de lino" required /></div>
              <div><label style={labelStyle}>Mercado</label>
                <select style={{ ...inputStyle, cursor: "pointer" }} value={trendsForm.market} onChange={e => setTrendsForm(f => ({ ...f, market: e.target.value }))}>
                  <option value="es">🇪🇸 España</option><option value="en">🇬🇧 English</option><option value="us">🇺🇸 USA</option><option value="latam">🌎 LATAM</option>
                </select>
              </div>
              <button type="submit" disabled={state.loading} style={{ width: "100%", padding: "11px", borderRadius: 8, border: "none", cursor: state.loading ? "not-allowed" : "pointer", background: "linear-gradient(135deg, #4285f4, #34a853)", color: "#fff", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {state.loading ? <><Loader2 size={14} className="animate-spin" />Analizando tendencias...</> : <><Package size={14} />Analizar tendencias</>}
              </button>
            </form>
          )}
        </div>

        <div>
          {state.loading && (
            <div className="glass-card" style={{ padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 12, animation: "pulse 2s infinite" }}>🧠</div>
              <p style={{ fontSize: 14, color: "var(--t2)", fontWeight: 600, marginBottom: 6 }}>Gemini investigando...</p>
              <p style={{ fontSize: 12, color: "var(--t3)" }}>Recopilando inteligencia de mercado · Los modelos Pro pueden tardar 30-60 segundos</p>
            </div>
          )}

          {state.error && (
            <div className="glass-card" style={{ padding: 20, border: "1px solid rgba(232,69,88,0.3)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--crim)" }}>
                <AlertTriangle size={18} />
                <span style={{ fontWeight: 600 }}>{state.error}</span>
              </div>
            </div>
          )}

          {!state.loading && !state.error && !state.data && (
            <div className="glass-card" style={{ padding: 40, textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, rgba(66,133,244,0.15), rgba(52,168,83,0.15))", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Brain size={24} style={{ color: "#4285f4" }} />
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "var(--t)" }}>Gemini + Claude + OmniCore listos</h3>
              <p style={{ fontSize: 12, color: "var(--t3)", maxWidth: 280, margin: "0 auto" }}>
                Usa los formularios para investigar empresas, mercados, competidores o tendencias de producto. Los resultados se aprenden automáticamente en el Brain.
              </p>
              <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 20 }}>
                {[["🔎", "Gemini Pro investiga"], ["🧠", "Claude analiza"], ["💾", "OmniCore aprende"]].map(([icon, label], i) => (
                  <div key={i} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
                    <div style={{ fontSize: 10, color: "var(--t3)" }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {state.data && !state.loading && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <CheckCircle2 size={14} style={{ color: "var(--jade)" }} />
                <span style={{ fontSize: 12, color: "var(--jade)", fontWeight: 600 }}>Análisis completado · Guardado en OmniCore Brain</span>
              </div>
              {activeTab === "business" && <BusinessResult data={state.data as { profile: Record<string, unknown>; strategicPlan: string }} />}
              {activeTab === "market" && <MarketResult data={state.data as { market: Record<string, unknown> }} />}
              {activeTab === "competitor" && <CompetitorResult data={state.data as { competitor: Record<string, unknown>; gaps: Record<string, unknown> }} />}
              {activeTab === "trends" && <TrendsResult data={state.data as { trends: Record<string, unknown> }} />}
              {activeTab === "full-audit" && <FullAuditResult data={state.data as { businessProfile: Record<string, unknown>; marketIntel: Record<string, unknown>; synthesis: string }} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
