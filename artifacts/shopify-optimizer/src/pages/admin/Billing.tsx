import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Check, Copy, AlertTriangle, RefreshCcw, Plus, Trash2, Pencil, X, Settings, Users } from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const PLAN_ICONS: Record<string, string> = { trial: "🆓", starter: "🚀", pro: "⚡", agency: "🏆", emprendedor: "🌱", agency_pro: "⚡", enterprise: "🏢" };

interface Plan {
  id: string;
  name: string;
  price: number | null;
  priceAnnual?: number | null;
  currency?: string;
  period?: string;
  featured?: boolean;
  badge?: string | null;
  storesLimit: number;
  imagesIncluded: number;
  features: PlanFeature[];
  ctaLabel?: string;
  ctaStyle?: string;
  ctaHref?: string;
}

// El catálogo guarda {text, included}; planes antiguos pueden traer strings.
type PlanFeature = string | { text: string; included?: boolean };
const featText = (f: PlanFeature) => (typeof f === "string" ? f : f.text);
const featIncluded = (f: PlanFeature) => typeof f === "string" || f.included !== false;
/** Editor: una feature por línea; "- " delante = no incluida. */
const featuresToText = (fs: PlanFeature[] = []) =>
  fs.map(f => (featIncluded(f) ? featText(f) : `- ${featText(f)}`)).join("\n");
const textToFeatures = (t: string): PlanFeature[] =>
  t.split("\n").map(s => s.trim()).filter(Boolean).map(s => {
    const excluded = s.startsWith("-");
    return { text: excluded ? s.slice(1).trim() : s, included: !excluded };
  });

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
  subscription?: Subscription;
  message?: string;
  confirmationUrl?: string;
  checkoutUrl?: string;
  requiresPayment?: boolean;
  requiresManualPayment?: boolean;
  contactEmail?: string;
  price?: number;
  planName?: string;
  plan?: Plan;
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
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [activeTab, setActiveTab] = useState<"subscription" | "affiliate" | "invoices" | "planes" | "config">("subscription");
  const [copied, setCopied] = useState(false);
  const [upgradeResult, setUpgradeResult] = useState<{ type: "success" | "manual" | "redirect"; message: string; contactEmail?: string; checkoutUrl?: string } | null>(null);
  const [stripeVerifying, setStripeVerifying] = useState(false);

  // ── Handle Stripe Checkout redirect back ──────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stripeParam = params.get("stripe");
    const sessionId = params.get("session_id");

    if (stripeParam === "success" && sessionId) {
      // Clean URL immediately so a refresh doesn't re-trigger
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, "", cleanUrl);

      setStripeVerifying(true);
      fetch(`${(import.meta.env.BASE_URL ?? "").replace(/\/$/, "")}/api/billing/stripe/verify?session_id=${encodeURIComponent(sessionId)}`, {
        credentials: "include",
      })
        .then(r => r.json())
        .then(d => {
          if (d.success) {
            setUpgradeResult({ type: "success", message: d.message ?? "¡Plan activado correctamente!" });
            qc.invalidateQueries({ queryKey: billingKeys.subscription });
            qc.invalidateQueries({ queryKey: billingKeys.invoices });
          } else {
            setUpgradeResult({ type: "manual", message: `⚠️ ${d.error ?? "No se pudo verificar el pago. Contacta con soporte."}` });
          }
        })
        .catch(() => {
          setUpgradeResult({ type: "manual", message: "⚠️ Error al verificar el pago. Contacta con soporte si ya has cobrado." });
        })
        .finally(() => setStripeVerifying(false));
    } else if (stripeParam === "cancelled") {
      window.history.replaceState({}, "", window.location.pathname);
      setUpgradeResult({ type: "manual", message: "El pago fue cancelado. Puedes intentarlo de nuevo cuando quieras." });
    }
  }, []);

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
      setUpgradeResult(null);
      if (data.requiresPayment && data.confirmationUrl) {
        setUpgradeResult({ type: "redirect", message: data.message ?? "Redirigiendo a pasarela de pago...", checkoutUrl: data.confirmationUrl });
        setTimeout(() => {
          if (window.top) window.top.location.href = data.confirmationUrl!;
          else window.location.href = data.confirmationUrl!;
        }, 1500);
        return;
      }
      if (data.requiresManualPayment) {
        setUpgradeResult({
          type: "manual",
          message: data.message ?? `Para activar el plan ${data.planName}, contacta con soporte.`,
          contactEmail: data.contactEmail,
          checkoutUrl: data.checkoutUrl,
        });
        return;
      }
      setUpgradeResult({ type: "success", message: data.message ?? "Plan actualizado correctamente." });
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
          ...(isAdmin ? [{ id: "planes" as const, label: "✦ Planes" }] : []),
          ...(isAdmin ? [{ id: "config" as const, label: "⚙️ Cobro" }] : []),
        ]).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
            background: activeTab === tab.id ? "var(--ink3)" : "transparent",
            color: activeTab === tab.id ? (tab.id === "planes" ? "var(--gold)" : "var(--t)") : "var(--t3)",
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

      {stripeVerifying && (
        <div className="glass-card" style={{
          padding: "14px 16px", marginBottom: 16,
          borderColor: "var(--gold)", background: "rgba(200,168,75,0.08)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{ fontSize: 20 }}>💳</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--t)" }}>Verificando pago con Stripe…</p>
            <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>Activando tu suscripción, espera un momento.</p>
          </div>
        </div>
      )}

      {upgradeResult && (
        <div className="glass-card" style={{
          padding: "14px 16px", marginBottom: 16,
          borderColor: upgradeResult.type === "success" ? "var(--jade)" : upgradeResult.type === "redirect" ? "var(--gold)" : "var(--gold)",
          background: upgradeResult.type === "success" ? "rgba(45,212,159,0.08)" : "rgba(200,168,75,0.08)",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>
              {upgradeResult.type === "success" ? "✅" : upgradeResult.type === "redirect" ? "🔄" : "📩"}
            </span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, color: "var(--t)", fontWeight: 600, marginBottom: 4 }}>{upgradeResult.message}</p>
              {upgradeResult.type === "manual" && upgradeResult.contactEmail && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <a href={upgradeResult.checkoutUrl ?? `mailto:${upgradeResult.contactEmail}`}
                    style={{ fontSize: 12, color: "var(--gold)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    ✉️ Contactar con soporte: {upgradeResult.contactEmail}
                  </a>
                </div>
              )}
            </div>
            <button onClick={() => setUpgradeResult(null)} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--t3)", fontSize: 16, padding: 0, flexShrink: 0,
            }}>✕</button>
          </div>
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
                    {plan.price == null
                      ? <span style={{ fontSize: 18, fontStyle: "italic", color: "var(--t3)" }}>A medida</span>
                      : plan.price === 0 ? "Gratis" : `€${plan.price}`
                    }
                    {plan.price != null && plan.price > 0 && <span style={{ fontSize: 12, color: "var(--t3)", fontWeight: 400 }}>/mes</span>}
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px" }}>
                    {plan.features.map(f => featIncluded(f) ? (
                      <li key={featText(f)} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: "var(--t2)", marginBottom: 6 }}>
                        <Check size={12} style={{ color: "var(--jade)", flexShrink: 0, marginTop: 2 }} />
                        <span>{featText(f)}</span>
                      </li>
                    ) : (
                      <li key={featText(f)} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: "var(--t4)", marginBottom: 6, textDecoration: "line-through" }}>
                        <X size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>{featText(f)}</span>
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
              Los admins pueden cambiar su plan directamente. Para usuarios, se genera un enlace de pago o contacto con soporte.
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

      {activeTab === "planes" && isAdmin && (
        <PlanManagerTab
          plans={plans.data ?? []}
          loading={plans.isLoading}
          onRefresh={() => qc.invalidateQueries({ queryKey: billingKeys.plans })}
        />
      )}

      {activeTab === "config" && isAdmin && (
        <PaymentSettingsTab />
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

// ── Payment Settings Tab (Admin only) ─────────────────────────────────────
function PaymentSettingsTab() {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [assignPlanId, setAssignPlanId] = useState("");
  const [assignUserId, setAssignUserId] = useState("");
  const [assignMsg, setAssignMsg] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  const paySettings = useQuery({
    queryKey: ["billing", "payment-settings"],
    queryFn: () => apiGet<{ method: string }>("/api/billing/admin/payment-settings"),
  });

  const allPlans = useQuery({
    queryKey: ["billing", "admin-plans-all"],
    queryFn: () => apiGet<Array<{ id: string; name: string; userId: string | null; userEmail: string | null; paymentMethod: string }>>("/api/billing/admin/plans-all"),
  });

  const savePayMethod = async (method: string) => {
    setSaving(true);
    try {
      await apiPut("/api/billing/admin/payment-settings", { method });
      qc.invalidateQueries({ queryKey: ["billing", "payment-settings"] });
    } catch (e: any) { alert(e.message ?? "Error"); }
    finally { setSaving(false); }
  };

  const handleAssign = async () => {
    if (!assignPlanId || !assignUserId) { setAssignError("Plan ID y User ID son requeridos"); return; }
    setAssignError(null); setAssignMsg(null);
    try {
      const r = await apiPost<{ message: string }>("/api/billing/admin/assign-user-plan", {
        planId: assignPlanId, userId: assignUserId,
      });
      setAssignMsg(r.message ?? "Asignado");
      qc.invalidateQueries({ queryKey: ["billing", "admin-plans-all"] });
      setAssignPlanId(""); setAssignUserId("");
    } catch (e: any) { setAssignError(e.message ?? "Error"); }
  };

  const currentMethod = paySettings.data?.method ?? "stripe";
  const METHODS = [
    { id: "stripe", label: "💳 Stripe", desc: "Pagos recurrentes con tarjeta — requiere STRIPE_SECRET_KEY" },
    { id: "shopify", label: "🛍 Shopify Billing", desc: "Cargos de app a través de Shopify — requiere SHOPIFY_CLIENT_ID" },
    { id: "manual", label: "✉️ Manual", desc: "El cliente contacta por email — sin integración automática" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Payment method selector */}
      <div className="glass-card" style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Settings size={16} style={{ color: "var(--gold)" }} />
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--t)" }}>Método de cobro global</h3>
        </div>
        <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 16 }}>
          Define cómo se procesan los pagos cuando un usuario solicita un upgrade de plan.
        </p>
        {paySettings.isLoading ? (
          <div className="skeleton" style={{ height: 120, borderRadius: 8 }} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {METHODS.map(m => (
              <label key={m.id} style={{
                display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px",
                background: currentMethod === m.id ? "rgba(200,168,75,0.08)" : "var(--ink2)",
                border: `1px solid ${currentMethod === m.id ? "rgba(200,168,75,0.4)" : "var(--ink3)"}`,
                borderRadius: 8, cursor: "pointer", transition: "all 0.15s",
              }}>
                <input
                  type="radio" name="payMethod" value={m.id}
                  checked={currentMethod === m.id}
                  onChange={() => savePayMethod(m.id)}
                  disabled={saving}
                  style={{ marginTop: 2, accentColor: "var(--gold)" }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t)", marginBottom: 2 }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: "var(--t3)" }}>{m.desc}</div>
                </div>
              </label>
            ))}
          </div>
        )}
        {saving && <p style={{ fontSize: 11, color: "var(--gold)", marginTop: 8 }}>Guardando...</p>}
      </div>

      {/* Assign plan to specific user */}
      <div className="glass-card" style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Users size={16} style={{ color: "var(--gold)" }} />
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--t)" }}>Asignar plan privado a usuario</h3>
        </div>
        <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 16 }}>
          Restringe un plan de la landing para que solo sea visible a un usuario específico (útil para precios personalizados).
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>ID del plan</label>
            <input
              value={assignPlanId} onChange={e => setAssignPlanId(e.target.value)}
              placeholder="ej: personalizado"
              style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--ink3)", borderRadius: 6, padding: "7px 10px", color: "var(--t)", fontSize: 12, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>User ID del cliente</label>
            <input
              value={assignUserId} onChange={e => setAssignUserId(e.target.value)}
              placeholder="ID del usuario"
              style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--ink3)", borderRadius: 6, padding: "7px 10px", color: "var(--t)", fontSize: 12, boxSizing: "border-box" }}
            />
          </div>
          <button onClick={handleAssign} className="btn-primary" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
            Asignar
          </button>
        </div>
        {assignError && <p style={{ fontSize: 11, color: "var(--crim)", marginTop: 8 }}>⚠️ {assignError}</p>}
        {assignMsg && <p style={{ fontSize: 11, color: "var(--jade)", marginTop: 8 }}>✅ {assignMsg}</p>}

        {/* Plans with user assignments */}
        {!allPlans.isLoading && (allPlans.data ?? []).filter(p => p.userId).length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600, marginBottom: 8 }}>PLANES CON USUARIO ASIGNADO</p>
            {allPlans.data!.filter(p => p.userId).map(p => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--ink3)", fontSize: 12 }}>
                <div>
                  <span style={{ color: "var(--t)", fontWeight: 600 }}>{p.name}</span>
                  <span style={{ color: "var(--t4)", marginLeft: 8 }}>({p.id})</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--gold)" }}>
                  {p.userEmail ?? p.userId}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const EMPTY_PLAN: Omit<Plan, "storesLimit" | "imagesIncluded"> & { storesLimit: string; imagesIncluded: string } = {
  id: "", name: "", price: null, priceAnnual: null, currency: "€", period: "/mes",
  featured: false, badge: "", features: [], ctaLabel: "Contactar →",
  ctaStyle: "ghost", ctaHref: "/contacto", storesLimit: "1", imagesIncluded: "10",
};

function PlanManagerTab({ plans, loading, onRefresh }: { plans: Plan[]; loading: boolean; onRefresh: () => void }) {
  const [form, setForm] = useState<typeof EMPTY_PLAN>({ ...EMPTY_PLAN });
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [featuresText, setFeaturesText] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setForm({ ...EMPTY_PLAN }); setFeaturesText(""); setEditId(null); setShowForm(true); setError(null);
  };
  const openEdit = (p: Plan) => {
    setForm({
      id: p.id, name: p.name, price: p.price ?? null, priceAnnual: p.priceAnnual ?? null,
      currency: p.currency ?? "€", period: p.period ?? "/mes", featured: p.featured ?? false,
      badge: p.badge ?? "", features: p.features, ctaLabel: p.ctaLabel ?? "Contactar →",
      ctaStyle: p.ctaStyle ?? "ghost", ctaHref: p.ctaHref ?? "/contacto",
      storesLimit: String(p.storesLimit), imagesIncluded: String(p.imagesIncluded),
    });
    setFeaturesText(featuresToText(p.features)); setEditId(p.id); setShowForm(true); setError(null);
  };

  const handleSave = async () => {
    if (!form.name || !form.id) { setError("ID y nombre son requeridos"); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        ...form,
        price: (form.price === null || form.price === "" as any) ? null : Number(form.price),
        priceAnnual: (form.priceAnnual === null || form.priceAnnual === "" as any) ? null : Number(form.priceAnnual),
        storesLimit: Number(form.storesLimit), imagesIncluded: Number(form.imagesIncluded),
        badge: form.badge || null,
        features: textToFeatures(featuresText),
      };
      if (editId) {
        await apiPut(`/api/billing/plans/${editId}`, payload);
      } else {
        await apiPost(`/api/billing/plans`, payload);
      }
      setShowForm(false); setEditId(null); onRefresh();
    } catch (e: any) { setError(e.message ?? "Error guardando el plan"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`¿Eliminar el plan "${id}" de la landing? (se ocultará, no se borrará)`)) return;
    setDeleting(id);
    try {
      await apiDelete(`/api/billing/plans/${id}`);
      onRefresh();
    } catch (e: any) { setError(e.message ?? "Error eliminando"); }
    finally { setDeleting(null); }
  };

  const inp = (field: keyof typeof form, numeric?: boolean) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: numeric ? e.target.value : e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  if (loading) return <div className="skeleton" style={{ height: 300, borderRadius: 12 }} />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: "var(--t3)" }}>
          Los planes creados aquí aparecen automáticamente en la sección de precios de la landing.
        </p>
        <button className="btn-primary" onClick={openCreate} style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
          <Plus size={14} /> Nuevo plan
        </button>
      </div>

      {error && (
        <div style={{ background: "rgba(220,53,69,0.1)", border: "1px solid var(--crim)", borderRadius: 8, padding: "10px 14px", marginBottom: 12, color: "var(--crim)", fontSize: 12, display: "flex", justifyContent: "space-between" }}>
          {error} <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--crim)" }}><X size={12} /></button>
        </div>
      )}

      {showForm && (
        <div className="glass-card" style={{ padding: 20, marginBottom: 20, borderColor: "var(--gold)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--t)" }}>{editId ? "Editar plan" : "Crear nuevo plan"}</h3>
            <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)" }}><X size={16} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 12 }}>
            {[
              { label: "ID (slug)", field: "id" as const, disabled: !!editId, placeholder: "ej: fotoshoot_pro" },
              { label: "Nombre", field: "name" as const, placeholder: "ej: Fotoshoot Pro" },
              { label: "Precio mensual (€) — vacío = A medida", field: "price" as const, type: "number" },
              { label: "Precio anual (€) — vacío = A medida", field: "priceAnnual" as const, type: "number" },
              { label: "Tiendas límite", field: "storesLimit" as const, type: "number" },
              { label: "Imágenes/mes", field: "imagesIncluded" as const, type: "number" },
              { label: "Badge (opcional)", field: "badge" as const, placeholder: "ej: Más popular" },
              { label: "CTA texto", field: "ctaLabel" as const, placeholder: "Contactar →" },
              { label: "CTA href", field: "ctaHref" as const, placeholder: "/contacto" },
            ].map(({ label, field, disabled, placeholder, type }) => (
              <div key={field}>
                <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>{label}</label>
                <input
                  value={String(form[field] ?? "")}
                  onChange={inp(field, type === "number")}
                  disabled={disabled}
                  placeholder={placeholder}
                  type={type ?? "text"}
                  style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--ink3)", borderRadius: 6, padding: "7px 10px", color: "var(--t)", fontSize: 12, boxSizing: "border-box" }}
                />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>Estilo CTA</label>
              <select value={form.ctaStyle ?? "ghost"} onChange={inp("ctaStyle")} style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--ink3)", borderRadius: 6, padding: "7px 10px", color: "var(--t)", fontSize: 12 }}>
                <option value="ghost">ghost (borde)</option>
                <option value="gold">gold (dorado)</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 16 }}>
              <input type="checkbox" id="feat-chk" checked={!!form.featured} onChange={inp("featured")} style={{ width: 16, height: 16 }} />
              <label htmlFor="feat-chk" style={{ fontSize: 12, color: "var(--t)", cursor: "pointer" }}>Destacado (MÁS POPULAR)</label>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>Features (una por línea · empieza por "- " si NO está incluida)</label>
            <textarea
              value={featuresText}
              onChange={e => setFeaturesText(e.target.value)}
              rows={5}
              placeholder={"10 tiendas\n60 productos/mes\n300 imágenes IA/mes"}
              style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--ink3)", borderRadius: 6, padding: "8px 10px", color: "var(--t)", fontSize: 12, resize: "vertical", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setShowForm(false)} className="btn-secondary" style={{ fontSize: 12 }}>Cancelar</button>
            <button onClick={handleSave} className="btn-primary" disabled={saving} style={{ fontSize: 12 }}>
              {saving ? "Guardando..." : editId ? "Guardar cambios" : "Crear plan"}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))", gap: 14 }}>
        {plans.map(plan => (
          <div key={plan.id} className="glass-card" style={{ padding: 18, position: "relative", borderColor: plan.featured ? "var(--gold)" : "transparent" }}>
            {plan.featured && (
              <div style={{ position: "absolute", top: 0, right: 0, background: "var(--gold)", color: "#000", fontSize: 9, fontWeight: 800, padding: "3px 8px", borderBottomLeftRadius: 8 }}>DESTACADO</div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <span style={{ fontSize: 22 }}>{PLAN_ICONS[plan.id] || "📦"}</span>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--t)", margin: "4px 0 2px" }}>{plan.name}</h3>
                {plan.badge && <span style={{ fontSize: 10, color: "var(--jade)", fontWeight: 600 }}>{plan.badge}</span>}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => openEdit(plan)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", padding: 4 }} title="Editar"><Pencil size={13} /></button>
                <button onClick={() => handleDelete(plan.id)} disabled={deleting === plan.id} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--crim)", padding: 4 }} title="Eliminar"><Trash2 size={13} /></button>
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--gold)", marginBottom: 4 }}>
              {plan.price == null
                ? <span style={{ fontSize: 16, color: "var(--t3)", fontStyle: "italic" }}>A medida</span>
                : <>{plan.price === 0 ? "Gratis" : `€${plan.price}`}<span style={{ fontSize: 12, color: "var(--t3)", fontWeight: 400 }}>/mes</span></>
              }
            </div>
            {plan.priceAnnual != null && <div style={{ fontSize: 11, color: "var(--jade)" }}>€{plan.priceAnnual}/año</div>}
            <div style={{ marginTop: 10 }}>
              {plan.features.slice(0, 4).map(f => (
                <div key={featText(f)} style={{ display: "flex", gap: 5, fontSize: 11, color: featIncluded(f) ? "var(--t2)" : "var(--t4)", marginBottom: 4 }}>
                  <span style={{ color: featIncluded(f) ? "var(--jade)" : "var(--t4)" }}>{featIncluded(f) ? "✓" : "✗"}</span> {featText(f)}
                </div>
              ))}
              {plan.features.length > 4 && <div style={{ fontSize: 10, color: "var(--t4)", marginTop: 2 }}>+{plan.features.length - 4} más</div>}
            </div>
          </div>
        ))}
        {plans.length === 0 && (
          <div className="glass-card" style={{ padding: 40, textAlign: "center", gridColumn: "1/-1" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <p style={{ fontSize: 13, color: "var(--t3)" }}>No hay planes configurados. Crea el primero con el botón de arriba.</p>
          </div>
        )}
      </div>
    </div>
  );
}
