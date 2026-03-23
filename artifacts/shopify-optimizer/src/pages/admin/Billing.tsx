import { useState, useEffect } from "react";
import { CreditCard, Check, Zap, TrendingUp, Users, Copy } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const PLAN_ICONS: Record<string, string> = { trial: "🆓", starter: "🚀", pro: "⚡", agency: "🏆" };

export default function Billing() {
  const [subData, setSubData] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [affiliateData, setAffiliateData] = useState<any>(null);
  const [joiningAffiliate, setJoiningAffiliate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"subscription" | "affiliate" | "invoices">("subscription");

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/billing/subscription`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API_BASE}/api/billing/plans`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API_BASE}/api/billing/affiliate`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API_BASE}/api/billing/invoices`, { credentials: "include" }).then(r => r.json()),
    ]).then(([sub, pl, aff, inv]) => {
      setSubData(sub);
      setPlans(pl);
      setAffiliateData(aff);
      setInvoices(inv);
    }).finally(() => setLoading(false));
  }, []);

  const upgradePlan = async (planId: string) => {
    setUpgrading(planId);
    try {
      const res = await fetch(`${API_BASE}/api/billing/upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      setSubData((prev: Record<string, unknown>) => ({ ...prev, subscription: data.subscription }));
    } finally {
      setUpgrading(null);
    }
  };

  const joinAffiliate = async () => {
    setJoiningAffiliate(true);
    try {
      const res = await fetch(`${API_BASE}/api/billing/affiliate/join`, {
        method: "POST", credentials: "include",
      });
      const data = await res.json();
      setAffiliateData({ affiliate: data.affiliate, referrals: [] });
    } finally {
      setJoiningAffiliate(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(affiliateData?.affiliate?.referralCode || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="skeleton" style={{ height: 400, borderRadius: 12 }} />;

  const currentPlan = subData?.subscription?.plan ?? "trial";

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--t)" }}>Billing & Suscripción</h1>
        <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 4 }}>Gestiona tu plan, facturas y programa de afiliados</p>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "var(--ink2)", borderRadius: 10, padding: 4, width: "fit-content" }}>
        {(["subscription", "affiliate", "invoices"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
            background: activeTab === tab ? "var(--ink3)" : "transparent",
            color: activeTab === tab ? "var(--t)" : "var(--t3)",
            transition: "all 0.15s",
          }}>
            {tab === "subscription" ? "Suscripción" : tab === "affiliate" ? "Afiliados" : "Facturas"}
          </button>
        ))}
      </div>

      {activeTab === "subscription" && (
        <>
          {subData?.daysRemaining !== null && currentPlan === "trial" && (
            <div className="glass-card" style={{
              padding: "16px 20px", marginBottom: 20,
              background: "linear-gradient(135deg, rgba(220,53,69,0.1), rgba(200,168,75,0.1))",
              borderColor: "var(--crim)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 24 }}>⏱️</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--t)" }}>
                    Trial termina en <span style={{ color: "var(--crim)" }}>{subData.daysRemaining} días</span>
                  </p>
                  <p style={{ fontSize: 12, color: "var(--t3)" }}>Actualiza ahora para no perder el acceso</p>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {plans.map((plan: any) => {
              const isCurrent = plan.id === currentPlan;
              return (
                <div key={plan.id} className="glass-card" style={{
                  padding: 20,
                  borderColor: isCurrent ? "var(--gold)" : "transparent",
                  position: "relative",
                  overflow: "hidden",
                }}>
                  {isCurrent && (
                    <div style={{
                      position: "absolute", top: 0, right: 0,
                      background: "var(--gold)", color: "#000", fontSize: 9, fontWeight: 800,
                      padding: "3px 8px", borderBottomLeftRadius: 8,
                    }}>ACTUAL</div>
                  )}
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{PLAN_ICONS[plan.id] || "📦"}</div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--t)", marginBottom: 4 }}>{plan.name}</h3>
                  <div style={{ fontSize: 28, fontWeight: 800, color: plan.id === "trial" ? "var(--jade)" : "var(--gold)", marginBottom: 12 }}>
                    {plan.price === 0 ? "Gratis" : `€${plan.price}`}
                    {plan.price > 0 && <span style={{ fontSize: 12, color: "var(--t3)", fontWeight: 400 }}>/mes</span>}
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px" }}>
                    {plan.features.map((f: string) => (
                      <li key={f} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--t2)", marginBottom: 6 }}>
                        <Check size={12} style={{ color: "var(--jade)", flexShrink: 0 }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {!isCurrent && (
                    <button
                      className="btn-primary"
                      onClick={() => upgradePlan(plan.id)}
                      disabled={upgrading === plan.id}
                      style={{ width: "100%", fontSize: 12 }}
                    >
                      {upgrading === plan.id ? "Actualizando..." : plan.price === 0 ? "Downgrade" : "Actualizar"}
                    </button>
                  )}
                  {isCurrent && (
                    <div style={{ textAlign: "center", padding: "8px 0", fontSize: 12, color: "var(--jade)", fontWeight: 600 }}>
                      ✓ Plan actual
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="glass-card" style={{ padding: 16, marginTop: 20 }}>
            <p style={{ fontSize: 12, color: "var(--t3)", display: "flex", alignItems: "center", gap: 8 }}>
              <CreditCard size={14} style={{ color: "var(--t4)" }} />
              Modo demo: los cambios de plan se simulan. Configura las claves de Stripe para activar pagos reales.
            </p>
          </div>
        </>
      )}

      {activeTab === "affiliate" && (
        <div>
          {!affiliateData?.affiliate ? (
            <div className="glass-card" style={{ padding: 48, textAlign: "center" }}>
              <span style={{ fontSize: 48 }}>🤝</span>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--t)", marginTop: 16, marginBottom: 8 }}>Programa de Afiliados</h3>
              <p style={{ fontSize: 13, color: "var(--t3)", marginBottom: 8 }}>Gana <strong style={{ color: "var(--gold)" }}>20% de comisión</strong> por cada cliente que refieras</p>
              <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 24 }}>Sin límite de ganancias · Pagos mensuales · Dashboard en tiempo real</p>
              <button className="btn-primary" onClick={joinAffiliate} disabled={joiningAffiliate} style={{ padding: "12px 32px" }}>
                {joiningAffiliate ? "Activando..." : "Unirse al Programa"}
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
                {[
                  { icon: "👆", label: "Clicks", value: affiliateData.affiliate.clicks },
                  { icon: "✅", label: "Registros", value: affiliateData.affiliate.signups },
                  { icon: "💰", label: "Conversiones", value: affiliateData.affiliate.conversions },
                  { icon: "💎", label: "Total Ganado", value: `€${(affiliateData.affiliate.totalEarned ?? 0).toFixed(2)}` },
                ].map(stat => (
                  <div key={stat.label} className="glass-card" style={{ padding: "20px 24px" }}>
                    <div style={{ fontSize: 22 }}>{stat.icon}</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: "var(--gold)", marginTop: 8 }}>{stat.value}</div>
                    <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>{stat.label}</div>
                  </div>
                ))}
              </div>
              <div className="glass-card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--t)", marginBottom: 12 }}>Tu enlace de referido</h3>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{
                    flex: 1, background: "var(--ink3)", borderRadius: 8, padding: "10px 14px",
                    fontSize: 13, color: "var(--t2)", fontFamily: "monospace",
                    border: "1px solid var(--ink4)",
                  }}>
                    {`${window.location.origin}?ref=${affiliateData.affiliate.referralCode}`}
                  </div>
                  <button className="btn-primary" onClick={copyCode} style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                    <Copy size={13} />
                    {copied ? "¡Copiado!" : "Copiar"}
                  </button>
                </div>
                <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 8 }}>Código: <strong style={{ color: "var(--gold)" }}>{affiliateData.affiliate.referralCode}</strong></p>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "invoices" && (
        <div className="glass-card">
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--ink3)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--t)" }}>Historial de Facturas</h3>
          </div>
          {invoices.map(inv => (
            <div key={inv.id} style={{
              padding: "14px 20px", borderBottom: "1px solid var(--ink3)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t)", marginBottom: 2 }}>{inv.id} — {inv.plan}</p>
                <p style={{ fontSize: 11, color: "var(--t3)" }}>{new Date(inv.date).toLocaleDateString()}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--t)" }}>€{inv.amount}</span>
                <span style={{
                  padding: "3px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600,
                  background: "rgba(80,200,120,0.15)", color: "var(--jade)",
                }}>{inv.status.toUpperCase()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
