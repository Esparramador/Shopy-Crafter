import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Check, Copy, AlertTriangle, RefreshCcw } from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/lib/api";

const PLAN_ICONS: Record<string, string> = { trial: "🆓", starter: "🚀", pro: "⚡", agency: "🏆" };

interface Plan {
  id: string;
  name: string;
  price: number;
  storesLimit: number;
  imagesIncluded: number;
  features: string[];
}
interface Subscription {
  id: string | number;
  userId: string;
  plan: string;
  status: string;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
}
interface SubscriptionResponse {
  subscription: Subscription;
  plan: Plan;
  daysRemaining: number | null;
}
interface AffiliateResponse {
  affiliate: { id: string; userId: string; referralCode: string; earnings?: number } | null;
  referrals?: Array<{ id: string; createdAt: string; status: string }>;
}
interface Invoice {
  id: string;
  date: string;
  amount: number;
  plan: string;
  status: string;
}
interface UpgradeResponse {
  subscription: Subscription;
  message?: string;
  confirmationUrl?: string;
  checkoutUrl?: string;
}

const billingKeys = {
  all: ["billing"] as const,
  subscription: ["billing", "subscription"] as const,
  plans: ["billing", "plans"] as const,
  affiliate: ["billing", "affiliate"] as const,
  invoices: ["billing", "invoices"] as const,
};

export default function Billing() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"subscription" | "affiliate" | "invoices">("subscription");
  const [copied, setCopied] = useState(false);

  const sub = useQuery({
    queryKey: billingKeys.subscription,
    queryFn: () => apiGet<SubscriptionResponse>("/api/billing/subscription"),
  });
  const plans = useQuery({
    queryKey: billingKeys.plans,
    queryFn: () => apiGet<Plan[]>("/api/billing/plans"),
  });
  const affiliate = useQuery({
    queryKey: billingKeys.affiliate,
    queryFn: () => apiGet<AffiliateResponse>("/api/billing/affiliate"),
  });
  const invoices = useQuery({
    queryKey: billingKeys.invoices,
    queryFn: () => apiGet<Invoice[]>("/api/billing/invoices"),
  });

  const upgrade = useMutation({
    mutationFn: (planId: string) => apiPost<UpgradeResponse>("/api/billing/upgrade", { plan: planId }),
    onSuccess: (data) => {
      const redirectUrl = data.confirmationUrl ?? data.checkoutUrl;
      if (redirectUrl) {
        if (window.top) window.top.location.href = redirectUrl;
        else window.location.href = redirectUrl;
        return;
      }
      qc.invalidateQueries({ queryKey: billingKeys.subscription });
      qc.invalidateQueries({ queryKey: billingKeys.invoices });
    },
  });

  const joinAffiliate = useMutation({
    mutationFn: () => apiPost<AffiliateResponse>("/api/billing/affiliate/join"),
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.affiliate }),
  });

  const copyCode = () => {
    const code = affiliate.data?.affiliate?.referralCode ?? "";
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isLoading = sub.isLoading || plans.isLoading;

  if (isLoading) return <BillingSkeleton />;

  if (sub.isError || plans.isError) {
    const err = sub.error ?? plans.error;
    const msg = err instanceof ApiError ? err.message
              : err instanceof Error ? err.message
              : "No se pudo cargar la información de facturación.";
    return (
      <div className="glass-card" style={{ padding: 32, textAlign: "center", maxWidth: 480, margin: "40px auto" }}>
        <AlertTriangle size={36} style={{ color: "var(--crim)", margin: "0 auto 12px" }} />
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--t)", marginBottom: 8 }}>
          Error cargando billing
        </h2>
        <p style={{ fontSize: 13, color: "var(--t3)", marginBottom: 20 }}>{msg}</p>
        <button
          className="btn-primary"
          onClick={() => {
            sub.refetch();
            plans.refetch();
            affiliate.refetch();
            invoices.refetch();
          }}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <RefreshCcw size={14} /> Reintentar
        </button>
      </div>
    );
  }

  const currentPlan = sub.data?.subscription?.plan ?? "trial";

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "clamp(18px, 4vw, 22px)", fontWeight: 700, color: "var(--t)" }}>
          Billing & Suscripción
        </h1>
        <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 4 }}>
          Gestiona tu plan, facturas y programa de afiliados
        </p>
      </div>

      <div style={{
        display: "flex", gap: 4, marginBottom: 24, background: "var(--ink2)",
        borderRadius: 10, padding: 4, width: "fit-content", maxWidth: "100%",
        overflowX: "auto",
      }}>
        {([
          { id: "subscription" as const, label: "Suscripción" },
          { id: "affiliate" as const, label: "Afiliados" },
          { id: "invoices" as const, label: "Facturas" },
        ]).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
            background: activeTab === tab.id ? "var(--ink3)" : "transparent",
            color: activeTab === tab.id ? "var(--t)" : "var(--t3)",
            transition: "all 0.15s",
          }}>{tab.label}</button>
        ))}
      </div>

      {upgrade.isError && (
        <div className="glass-card" style={{
          padding: 12, marginBottom: 16, borderColor: "var(--crim)",
          background: "rgba(220,53,69,0.08)",
        }}>
          <p style={{ fontSize: 13, color: "var(--crim)", display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={14} />
            {upgrade.error instanceof ApiError ? upgrade.error.message
            : upgrade.error instanceof Error ? upgrade.error.message
            : "Error actualizando plan."}
          </p>
        </div>
      )}

      {activeTab === "subscription" && (
        <>
          {sub.data?.daysRemaining !== null && sub.data?.daysRemaining !== undefined && currentPlan === "trial" && (
            <div className="glass-card" style={{
              padding: "16px 20px", marginBottom: 20,
              background: "linear-gradient(135deg, rgba(220,53,69,0.1), rgba(200,168,75,0.1))",
              borderColor: "var(--crim)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 24 }}>⏱️</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--t)" }}>
                    Trial termina en <span style={{ color: "var(--crim)" }}>{sub.data.daysRemaining} días</span>
                  </p>
                  <p style={{ fontSize: 12, color: "var(--t3)" }}>Actualiza ahora para no perder el acceso</p>
                </div>
              </div>
            </div>
          )}

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
            gap: 16,
          }}>
            {(plans.data ?? []).map(plan => {
              const isCurrent = plan.id === currentPlan;
              const isUpgrading = upgrade.isPending && upgrade.variables === plan.id;
              return (
                <div key={plan.id} className="glass-card" style={{
                  padding: 20,
                  borderColor: isCurrent ? "var(--gold)" : "transparent",
                  position: "relative", overflow: "hidden",
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
                  <div style={{
                    fontSize: 28, fontWeight: 800,
                    color: plan.id === "trial" ? "var(--jade)" : "var(--gold)", marginBottom: 12,
                  }}>
                    {plan.price === 0 ? "Gratis" : `€${plan.price}`}
                    {plan.price > 0 && <span style={{ fontSize: 12, color: "var(--t3)", fontWeight: 400 }}>/mes</span>}
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px" }}>
                    {plan.features.map(f => (
                      <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: "var(--t2)", marginBottom: 6 }}>
                        <Check size={12} style={{ color: "var(--jade)", flexShrink: 0, marginTop: 2 }} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {!isCurrent && (
                    <button
                      className="btn-primary"
                      onClick={() => upgrade.mutate(plan.id)}
                      disabled={isUpgrading}
                      style={{ width: "100%", fontSize: 12 }}
                    >
                      {isUpgrading ? "Actualizando..." : plan.price === 0 ? "Downgrade" : "Actualizar"}
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
              Modo demo: los cambios de plan se simulan. Configura Shopify Billing para activar pagos reales.
            </p>
          </div>
        </>
      )}

      {activeTab === "affiliate" && (
        <AffiliateTab
          loading={affiliate.isLoading}
          error={affiliate.isError ? (affiliate.error instanceof Error ? affiliate.error.message : "Error") : null}
          data={affiliate.data ?? null}
          joining={joinAffiliate.isPending}
          onJoin={() => joinAffiliate.mutate()}
          onCopy={copyCode}
          copied={copied}
        />
      )}

      {activeTab === "invoices" && (
        <InvoicesTab
          loading={invoices.isLoading}
          error={invoices.isError ? (invoices.error instanceof Error ? invoices.error.message : "Error") : null}
          invoices={invoices.data ?? []}
        />
      )}
    </div>
  );
}

function BillingSkeleton() {
  return (
    <div style={{ padding: 0 }}>
      <div className="skeleton" style={{ height: 40, borderRadius: 8, width: 260, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 40, borderRadius: 8, width: 320, marginBottom: 24 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: 16 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: 260, borderRadius: 12 }} />
        ))}
      </div>
    </div>
  );
}

function AffiliateTab(props: {
  loading: boolean;
  error: string | null;
  data: AffiliateResponse | null;
  joining: boolean;
  onJoin: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  if (props.loading) return <div className="skeleton" style={{ height: 300, borderRadius: 12 }} />;
  if (props.error) return (
    <div className="glass-card" style={{ padding: 24, textAlign: "center" }}>
      <p style={{ color: "var(--crim)", fontSize: 13 }}>{props.error}</p>
    </div>
  );
  if (!props.data?.affiliate) {
    return (
      <div className="glass-card" style={{ padding: 48, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🤝</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--t)", marginBottom: 8 }}>
          Programa de afiliados
        </h2>
        <p style={{ fontSize: 13, color: "var(--t3)", marginBottom: 20, maxWidth: 420, margin: "0 auto 20px" }}>
          Únete al programa de afiliados y gana un porcentaje por cada cliente que traigas.
        </p>
        <button className="btn-primary" onClick={props.onJoin} disabled={props.joining}>
          {props.joining ? "Uniéndote..." : "Unirme al programa"}
        </button>
      </div>
    );
  }
  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--t)", marginBottom: 16 }}>Tu código de referido</h2>
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        background: "var(--ink2)", padding: 12, borderRadius: 8, flexWrap: "wrap",
      }}>
        <code style={{ flex: 1, minWidth: 200, fontSize: 14, color: "var(--gold)" }}>
          {props.data.affiliate.referralCode}
        </code>
        <button onClick={props.onCopy} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {props.copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar</>}
        </button>
      </div>
      {(props.data.referrals?.length ?? 0) > 0 && (
        <p style={{ fontSize: 12, color: "var(--t3)", marginTop: 16 }}>
          {props.data.referrals!.length} referidos activos
        </p>
      )}
    </div>
  );
}

function InvoicesTab(props: { loading: boolean; error: string | null; invoices: Invoice[] }) {
  if (props.loading) return <div className="skeleton" style={{ height: 300, borderRadius: 12 }} />;
  if (props.error) return (
    <div className="glass-card" style={{ padding: 24, textAlign: "center" }}>
      <p style={{ color: "var(--crim)", fontSize: 13 }}>{props.error}</p>
    </div>
  );
  if (props.invoices.length === 0) {
    return (
      <div className="glass-card" style={{ padding: 48, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
        <p style={{ fontSize: 14, color: "var(--t3)" }}>
          Aún no tienes facturas. Aparecerán aquí tras tu primer pago.
        </p>
      </div>
    );
  }
  return (
    <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--ink2)" }}>
              <th style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase" }}>ID</th>
              <th style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase" }}>Fecha</th>
              <th style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase" }}>Plan</th>
              <th style={{ textAlign: "right", padding: "12px 16px", fontSize: 11, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase" }}>Importe</th>
              <th style={{ textAlign: "center", padding: "12px 16px", fontSize: 11, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase" }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {props.invoices.map(inv => (
              <tr key={inv.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <td style={{ padding: "12px 16px", color: "var(--t2)", fontFamily: "monospace" }}>{inv.id}</td>
                <td style={{ padding: "12px 16px", color: "var(--t2)" }}>
                  {new Date(inv.date).toLocaleDateString("es-ES")}
                </td>
                <td style={{ padding: "12px 16px", color: "var(--t2)" }}>{inv.plan}</td>
                <td style={{ padding: "12px 16px", textAlign: "right", color: "var(--t)", fontWeight: 600 }}>
                  €{inv.amount}
                </td>
                <td style={{ padding: "12px 16px", textAlign: "center" }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 4,
                    background: inv.status === "paid" ? "rgba(40,167,69,0.15)" : "rgba(255,193,7,0.15)",
                    color: inv.status === "paid" ? "var(--jade)" : "#ffc107",
                  }}>
                    {inv.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
