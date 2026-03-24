import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Loader2, Eye, EyeOff, ShoppingBag, Key, CheckCircle, ExternalLink, Copy, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface InviteData {
  name: string;
  email: string;
  projectId: string;
  storeName: string | null;
  shopDomain: string | null;
  expiresAt: string | null;
}

// ─── STEP 1: Password Setup ───────────────────────────────────────────────────
function StepPassword({
  inviteData,
  token,
  onSuccess,
}: {
  inviteData: InviteData;
  token: string;
  onSuccess: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Las contraseñas no coinciden"); return; }
    if (password.length < 8) { setError("Mínimo 8 caracteres"); return; }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/invite/${token}/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al configurar la cuenta");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSetup} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Store banner */}
      {(inviteData.storeName || inviteData.shopDomain) && (
        <div style={{
          padding: "10px 14px",
          background: "rgba(200,168,75,0.06)",
          border: "1px solid rgba(200,168,75,0.2)",
          borderRadius: 10,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <ShoppingBag size={18} style={{ color: "var(--gold)", flexShrink: 0 }} />
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--gold)" }}>
              {inviteData.storeName ?? inviteData.shopDomain}
            </p>
            {inviteData.shopDomain && inviteData.storeName && (
              <p style={{ margin: 0, fontSize: 10, color: "var(--t3)" }}>{inviteData.shopDomain}</p>
            )}
          </div>
          <span style={{
            marginLeft: "auto", fontSize: 9, padding: "2px 8px",
            background: "rgba(200,168,75,0.1)", border: "1px solid rgba(200,168,75,0.25)",
            borderRadius: 20, color: "var(--gold)", fontWeight: 700,
          }}>
            EXCLUSIVO · INTRANSFERIBLE
          </span>
        </div>
      )}

      <p style={{ margin: 0, fontSize: 13, color: "var(--t2)", lineHeight: 1.6 }}>
        Crea una contraseña segura para acceder a tu panel como{" "}
        <span style={{ color: "var(--t1)", fontWeight: 500 }}>{inviteData.email}</span>.
      </p>

      {/* Password */}
      <div>
        <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--t3)", display: "block", marginBottom: 8 }}>
          Nueva contraseña
        </label>
        <div style={{ position: "relative" }}>
          <input
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            style={{
              width: "100%", padding: "11px 44px 11px 14px", boxSizing: "border-box",
              background: "rgba(255,255,255,0.03)", border: "1px solid var(--bdr)",
              borderRadius: 8, color: "var(--t1)", fontSize: 14, outline: "none",
            }}
            onFocus={(e) => { e.target.style.borderColor = "var(--gold)"; }}
            onBlur={(e) => { e.target.style.borderColor = "var(--bdr)"; }}
          />
          <button type="button" onClick={() => setShowPw(!showPw)}
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--t3)", display: "flex", alignItems: "center" }}>
            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      {/* Confirm */}
      <div>
        <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--t3)", display: "block", marginBottom: 8 }}>
          Confirmar contraseña
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          placeholder="Repetir contraseña"
          style={{
            width: "100%", padding: "11px 14px", boxSizing: "border-box",
            background: "rgba(255,255,255,0.03)", border: "1px solid var(--bdr)",
            borderRadius: 8, color: "var(--t1)", fontSize: 14, outline: "none",
          }}
          onFocus={(e) => { e.target.style.borderColor = "var(--gold)"; }}
          onBlur={(e) => { e.target.style.borderColor = "var(--bdr)"; }}
        />
      </div>

      {error && (
        <div style={{ background: "rgba(220,53,69,0.08)", border: "1px solid rgba(220,53,69,0.2)", borderRadius: 8, padding: "10px 14px", color: "var(--crim)", fontSize: 13 }}>
          {error}
        </div>
      )}

      <button type="submit" disabled={submitting} style={{
        width: "100%", padding: "13px 0", borderRadius: 8, border: "none",
        background: "linear-gradient(135deg,var(--gold) 0%,var(--gold2) 100%)",
        color: "#0a0a14", fontWeight: 700, fontSize: 14, cursor: submitting ? "not-allowed" : "pointer",
        opacity: submitting ? 0.7 : 1,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}>
        {submitting && <Loader2 size={15} style={{ animation: "spin 0.6s linear infinite" }} />}
        {submitting ? "Activando cuenta..." : "Activar cuenta →"}
      </button>
    </form>
  );
}

// ─── STEP 2: Store Credentials Guide ─────────────────────────────────────────
function StepCredentials({ inviteData, onDone }: { inviteData: InviteData; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"guide" | "what">("guide");

  const shopify_admin_url = inviteData.shopDomain
    ? `https://${inviteData.shopDomain.replace("https://", "").replace(/\/$/, "")}/admin`
    : null;

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Success banner */}
      <div style={{
        padding: "12px 16px",
        background: "rgba(45,212,159,0.08)",
        border: "1px solid rgba(45,212,159,0.25)",
        borderRadius: 10,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <CheckCircle size={22} style={{ color: "var(--jade)", flexShrink: 0 }} />
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--jade)" }}>¡Cuenta activada!</p>
          <p style={{ margin: 0, fontSize: 11, color: "var(--t3)" }}>
            Tu acceso a <b>{inviteData.storeName ?? inviteData.shopDomain ?? "la plataforma"}</b> está listo.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--ink3)" }}>
        {[
          { id: "guide", label: "📋 Cómo acceder" },
          { id: "what", label: "🔑 Qué necesitas" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)} style={{
            padding: "8px 14px", background: "none", border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: tab === t.id ? 700 : 400,
            color: tab === t.id ? "var(--gold)" : "var(--t3)",
            borderBottom: tab === t.id ? "2px solid var(--gold)" : "2px solid transparent",
          }}>{t.label}</button>
        ))}
      </div>

      {tab === "guide" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 12, color: "var(--t2)", lineHeight: 1.7 }}>
            Tu cuenta ha sido activada. Para empezar a usar la plataforma con tu tienda:
          </p>

          {/* Steps */}
          {[
            {
              n: "1",
              title: "Inicia sesión",
              desc: `Ve a la página de inicio de sesión e introduce tu email (${inviteData.email}) y la contraseña que acabas de crear.`,
            },
            {
              n: "2",
              title: "Accede a tu panel de tienda",
              desc: "Serás redirigido directamente a tu panel de cliente, donde verás tus productos, análisis y optimizaciones.",
            },
            {
              n: "3",
              title: "Conecta tu tienda Shopify",
              desc: "En 'Configuración → Credenciales' podrás introducir o verificar que tu tienda Shopify está correctamente enlazada.",
            },
            {
              n: "4",
              title: "Empieza a optimizar",
              desc: "Ya puedes usar la IA para analizar productos, mejorar SEO, generar imágenes y mucho más.",
            },
          ].map((step) => (
            <div key={step.n} style={{
              display: "flex", gap: 12, padding: "10px 12px",
              background: "rgba(255,255,255,0.02)", border: "1px solid var(--ink3)",
              borderRadius: 8,
            }}>
              <span style={{
                width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                background: "rgba(200,168,75,0.15)", border: "1px solid rgba(200,168,75,0.3)",
                color: "var(--gold)", fontWeight: 800, fontSize: 11,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{step.n}</span>
              <div>
                <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 700, color: "var(--t)" }}>{step.title}</p>
                <p style={{ margin: 0, fontSize: 11, color: "var(--t3)", lineHeight: 1.6 }}>{step.desc}</p>
              </div>
            </div>
          ))}

          {/* Admin link */}
          {shopify_admin_url && (
            <div style={{
              padding: "10px 12px", background: "rgba(200,168,75,0.04)",
              border: "1px solid rgba(200,168,75,0.15)", borderRadius: 8,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <ShoppingBag size={14} style={{ color: "var(--gold)", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 10, color: "var(--t3)" }}>Panel Shopify de tu tienda</p>
                <p style={{ margin: 0, fontSize: 11, color: "var(--gold)", fontWeight: 600, wordBreak: "break-all" }}>{shopify_admin_url}</p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => copyText(shopify_admin_url)} style={{ background: "none", border: "1px solid var(--bdr)", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "var(--t3)", display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
                  {copied ? <CheckCircle size={11} style={{ color: "var(--jade)" }} /> : <Copy size={11} />}
                  {copied ? "Copiado" : "Copiar"}
                </button>
                <a href={shopify_admin_url} target="_blank" rel="noreferrer" style={{ background: "none", border: "1px solid var(--bdr)", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "var(--t3)", display: "flex", alignItems: "center", gap: 4, fontSize: 10, textDecoration: "none" }}>
                  <ExternalLink size={11} />
                  Abrir
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "what" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ padding: "10px 12px", background: "rgba(45,212,159,0.04)", border: "1px solid rgba(45,212,159,0.15)", borderRadius: 8 }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "var(--jade)" }}>
              <Info size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />
              Tu agencia gestiona la conexión técnica
            </p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--t3)", lineHeight: 1.6 }}>
              Tu agencia ya ha configurado los accesos técnicos de tu tienda. Tú solo necesitas tu email y contraseña para entrar al panel.
            </p>
          </div>

          {/* Credential explanations */}
          {[
            {
              icon: "🌐",
              title: "Dominio de tu tienda",
              value: inviteData.shopDomain ?? "tu-tienda.myshopify.com",
              desc: "Es la dirección web de tu tienda en Shopify. La puedes ver en la barra de tu navegador cuando accedes a Shopify.",
              how: "Shopify Admin → Configuración → Dominios",
            },
            {
              icon: "🔑",
              title: "Storefront Access Token",
              value: "shpat_xxxxxxxxxxxxxxxxxxxxxx",
              desc: "Permite a nuestra IA leer el catálogo de tu tienda. Es de solo lectura — no puede hacer cambios sin tu aprobación.",
              how: "Shopify Admin → Configuración → Aplicaciones y canales de ventas → Desarrollar apps → Nueva app privada → API Storefront",
            },
            {
              icon: "⚙️",
              title: "Admin API Access Token (opcional)",
              value: "shpat_xxxxxxxxxxxxxxxxxxxxxx",
              desc: "Solo necesario si quieres que la IA aplique cambios automáticamente (precios, SEO, imágenes). Requiere aprobación previa de cada cambio.",
              how: "Shopify Admin → Configuración → Aplicaciones y canales de ventas → Desarrollar apps → Permisos de API de administración",
            },
          ].map((cred) => (
            <div key={cred.title} style={{
              padding: "12px 14px", background: "rgba(255,255,255,0.02)",
              border: "1px solid var(--ink3)", borderRadius: 8,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>{cred.icon}</span>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--t)" }}>{cred.title}</p>
              </div>
              <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--t3)", lineHeight: 1.6 }}>{cred.desc}</p>
              <div style={{ padding: "6px 10px", background: "var(--ink2)", borderRadius: 6, fontFamily: "monospace", fontSize: 10, color: "var(--t3)" }}>
                <Key size={9} style={{ marginRight: 4, verticalAlign: "middle" }} />
                {cred.value}
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 10, color: "var(--jade)" }}>
                📍 Dónde encontrarlo: <span style={{ color: "var(--t3)" }}>{cred.how}</span>
              </p>
            </div>
          ))}

          <div style={{ padding: "10px 12px", background: "rgba(255,200,0,0.05)", border: "1px solid rgba(255,200,0,0.15)", borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: 11, color: "var(--gold)", lineHeight: 1.6 }}>
              💬 <b>¿Necesitas ayuda?</b> Contacta a tu agencia y te guiarán paso a paso en la obtención de credenciales. Nunca compartas estas claves con terceros no autorizados.
            </p>
          </div>
        </div>
      )}

      {/* CTA */}
      <button
        onClick={onDone}
        style={{
          width: "100%", padding: "13px 0", borderRadius: 8, border: "none",
          background: "linear-gradient(135deg,var(--gold) 0%,var(--gold2) 100%)",
          color: "#0a0a14", fontWeight: 700, fontSize: 14, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        Acceder a mi panel →
      </button>
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function InviteSetupPage() {
  const [, params] = useRoute("/invite/:token");
  const token = params?.token ?? "";
  const [, navigate] = useLocation();
  const { refresh } = useAuth();

  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/auth/invite/${token}`, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { setInviteData(d); setLoading(false); })
      .catch(() => { setInvalid(true); setLoading(false); });
  }, [token]);

  const handlePasswordSuccess = async () => {
    await refresh();
    setStep(2);
  };

  const handleDone = () => {
    navigate("/client");
  };

  const shell: React.CSSProperties = {
    minHeight: "100vh",
    background: "var(--ink)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  };

  if (loading) {
    return (
      <div style={shell}>
        <div style={{ textAlign: "center" }}>
          <Loader2 size={28} style={{ color: "var(--gold)", animation: "spin 0.6s linear infinite", display: "block", margin: "0 auto 12px" }} />
          <p style={{ color: "var(--t3)", fontSize: 13 }}>Verificando enlace de invitación...</p>
        </div>
      </div>
    );
  }

  if (invalid || !inviteData) {
    return (
      <div style={shell}>
        <div style={{ textAlign: "center", maxWidth: 380 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "rgba(220,53,69,0.12)", border: "1px solid rgba(220,53,69,0.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 28 }}>
            🔒
          </div>
          <h1 style={{ fontFamily: "var(--fh)", fontSize: 24, fontStyle: "italic", marginBottom: 8 }}>
            Enlace inválido o expirado
          </h1>
          <p style={{ color: "var(--t3)", fontSize: 13, lineHeight: 1.6 }}>
            Este enlace de invitación ha expirado (validez 48h) o ya fue utilizado.<br />
            Contacta a tu agencia para recibir un nuevo enlace.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={shell}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 56, height: 56, borderRadius: 14,
            background: "linear-gradient(135deg,var(--gold) 0%,var(--gold2) 100%)",
            fontSize: 24, marginBottom: 14, boxShadow: "0 4px 20px rgba(200,168,75,0.35)",
          }}>
            ⚡
          </div>
          <h1 style={{ fontFamily: "var(--fh)", fontSize: 26, fontStyle: "italic", fontWeight: 400, marginBottom: 4 }}>
            {step === 1 ? "Configura tu acceso" : "¡Bienvenido a ShopyBrain!"}
          </h1>
          <p style={{ fontSize: 13, color: "var(--t3)" }}>
            {step === 1
              ? <>Hola, <span style={{ color: "var(--gold2)", fontWeight: 600 }}>{inviteData.name}</span> — acceso exclusivo e intransferible</>
              : <>Tu panel de tienda está listo, <span style={{ color: "var(--gold2)", fontWeight: 600 }}>{inviteData.name}</span></>
            }
          </p>

          {/* Step indicators */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14 }}>
            {[1, 2].map((s) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: s <= step ? "linear-gradient(135deg,var(--gold),var(--gold2))" : "rgba(255,255,255,0.06)",
                  border: s <= step ? "none" : "1px solid var(--bdr)",
                  color: s <= step ? "#0a0a14" : "var(--t4)",
                  fontSize: 11, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {s < step ? <CheckCircle size={14} /> : s}
                </div>
                <span style={{ fontSize: 10, color: s <= step ? "var(--t2)" : "var(--t4)" }}>
                  {s === 1 ? "Contraseña" : "Tu acceso"}
                </span>
                {s < 2 && <div style={{ width: 24, height: 1, background: step > s ? "var(--gold)" : "var(--ink3)" }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Card */}
        <div style={{
          width: "100%",
          background: "var(--srf)",
          border: "1px solid var(--bdr)",
          borderRadius: 16,
          padding: "32px 28px",
        }}>
          {step === 1 ? (
            <StepPassword inviteData={inviteData} token={token} onSuccess={handlePasswordSuccess} />
          ) : (
            <StepCredentials inviteData={inviteData} onDone={handleDone} />
          )}
        </div>

        <p style={{ fontSize: 11, color: "var(--t4)", textAlign: "center", marginTop: 16 }}>
          Plataforma exclusiva · Acceso unipersonal por tienda · ShopyBrain © 2026
        </p>
      </div>
    </div>
  );
}
