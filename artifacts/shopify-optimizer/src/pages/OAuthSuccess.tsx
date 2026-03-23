import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle, Loader2, ArrowRight, Copy, Eye, EyeOff, ShieldCheck } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function OAuthSuccess() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"syncing" | "done" | "error">("syncing");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [shopDomain, setShopDomain] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get("projectId");
    const shop = params.get("shop");
    setProjectId(pid);
    setShopDomain(shop);
    if (!pid) { setStatus("error"); return; }

    const finalize = async () => {
      await fetch(`${API_BASE}/api/projects/${pid}/products/sync`, {
        method: "POST", credentials: "include",
      }).catch(() => {});

      const tokenRes = await fetch(`${API_BASE}/api/projects/${pid}/reveal-token`, {
        credentials: "include",
      }).catch(() => null);

      if (tokenRes?.ok) {
        const data = await tokenRes.json();
        setToken(data.accessToken ?? null);
      }
      setStatus("done");
    };

    finalize();
  }, []);

  const copyToken = () => {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const maskedToken = token
    ? token.slice(0, 10) + "••••••••••••••••••••••••••••••••" + token.slice(-4)
    : "";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ink)", padding: 24 }}>
      <div style={{ maxWidth: 520, width: "100%" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div className="logo-gem" style={{ width: 64, height: 64, fontSize: 26, margin: "0 auto 16px", background: status === "done" ? "rgba(45,212,159,0.15)" : undefined }}>
            {status === "syncing"
              ? <Loader2 size={26} style={{ animation: "spin 1s linear infinite" }} />
              : status === "done" ? "✓" : "✕"}
          </div>

          {status === "syncing" && (
            <>
              <h1 style={{ fontFamily: "var(--fh)", fontStyle: "italic", fontSize: 22, marginBottom: 6 }}>Conectando tienda...</h1>
              <p style={{ fontSize: 13, color: "var(--t2)" }}>
                Importando productos de <span style={{ color: "var(--gold)", fontFamily: "var(--fm)" }}>{shopDomain}</span>
              </p>
              <div style={{ marginTop: 16, height: 2, background: "var(--ink3)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: "60%", background: "linear-gradient(90deg, var(--gold), var(--jade))", borderRadius: 2, animation: "slide 1.5s ease-in-out infinite" }} />
              </div>
            </>
          )}

          {status === "done" && (
            <>
              <h1 style={{ fontFamily: "var(--fh)", fontStyle: "italic", fontSize: 22, marginBottom: 6, color: "var(--jade)" }}>
                ¡Tienda conectada!
              </h1>
              <p style={{ fontSize: 13, color: "var(--t2)" }}>
                <span style={{ color: "var(--gold)", fontFamily: "var(--fm)" }}>{shopDomain}</span> está lista. Los productos han sido importados.
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <h1 style={{ fontFamily: "var(--fh)", fontStyle: "italic", fontSize: 22, marginBottom: 6, color: "var(--crim)" }}>Error en la conexión</h1>
              <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 20 }}>No se pudo completar la autenticación.</p>
            </>
          )}
        </div>

        {/* Token reveal block */}
        {status === "done" && token && (
          <div className="glass-card" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <ShieldCheck size={15} style={{ color: "var(--gold)" }} />
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--t)" }}>Admin API Access Token (SHPAT)</p>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--t3)", marginBottom: 12, lineHeight: 1.5 }}>
              Este es el token de acceso de <strong style={{ color: "var(--t2)" }}>{shopDomain}</strong>. Guárdalo si lo necesitas para configurar otras herramientas del cliente. Solo se muestra aquí — siempre puedes recuperarlo desde Ajustes del proyecto.
            </p>

            <div style={{ position: "relative" }}>
              <div style={{
                fontFamily: "var(--fm)", fontSize: 12, padding: "10px 100px 10px 14px",
                background: "var(--ink3)", border: "1px solid var(--bdr)", borderRadius: 8,
                color: "var(--jade)", wordBreak: "break-all", lineHeight: 1.6,
                minHeight: 44, display: "flex", alignItems: "center",
              }}>
                {tokenVisible ? token : maskedToken}
              </div>
              <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", display: "flex", gap: 4 }}>
                <button
                  onClick={() => setTokenVisible(!tokenVisible)}
                  style={{ padding: "5px", background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 6, cursor: "pointer", color: "var(--t3)", display: "flex", alignItems: "center" }}
                  title={tokenVisible ? "Ocultar" : "Mostrar"}
                >
                  {tokenVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button
                  onClick={copyToken}
                  style={{
                    padding: "5px 10px", background: copied ? "rgba(45,212,159,0.15)" : "var(--ink2)",
                    border: `1px solid ${copied ? "rgba(45,212,159,0.4)" : "var(--bdr)"}`,
                    borderRadius: 6, cursor: "pointer", color: copied ? "var(--jade)" : "var(--t3)",
                    display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600,
                    transition: "all 0.2s",
                  }}
                >
                  <Copy size={11} /> {copied ? "¡Copiado!" : "Copiar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {status === "done" && (
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => setLocation(projectId ? `/projects/${projectId}/audit` : "/")}
              className="btn btn-gold"
            >
              <CheckCircle size={15} /> Ver auditoría de la tienda
            </button>
            <button onClick={() => setLocation("/")} className="btn-secondary">
              <ArrowRight size={15} /> Dashboard
            </button>
          </div>
        )}

        {status === "error" && (
          <div style={{ textAlign: "center" }}>
            <button onClick={() => setLocation("/new-project")} className="btn btn-gold">Volver a intentar</button>
          </div>
        )}
      </div>
    </div>
  );
}
