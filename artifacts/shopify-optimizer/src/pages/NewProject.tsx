import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Loader2, ChevronDown, ChevronUp, ArrowLeft, Brain, ExternalLink, CheckCircle, Zap } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListProjectsQueryKey } from "@workspace/api-client-react";
import BrainExtractor from "../components/BrainExtractor";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function NewProject() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [oauthConfigured, setOauthConfigured] = useState<boolean | null>(null);
  const [launching, setLaunching] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [extractField, setExtractField] = useState<"name" | "domain" | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    shopDomain: "",
    storeNiche: "",
    brandTone: "",
    targetAudience: "",
    storeMarkets: "",
    replicateApiToken: "",
    anthropicApiKey: "",
  });

  useEffect(() => {
    fetch(`${API_BASE}/api/shopify/oauth/check`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setOauthConfigured(d.configured ?? false))
      .catch(() => setOauthConfigured(false));
  }, []);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData({ ...formData, [field]: e.target.value });

  const handleAutofill = (data: Record<string, string>) => {
    setFormData(prev => ({
      ...prev,
      ...data,
      name: data.name && !prev.name ? data.name : prev.name,
    }));
  };

  const launchOAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.shopDomain) return;
    setLaunching(true);
    try {
      const params = new URLSearchParams({
        shop: formData.shopDomain,
        name: formData.name || formData.shopDomain.split(".")[0],
        storeNiche: formData.storeNiche,
        brandTone: formData.brandTone,
        targetAudience: formData.targetAudience,
        storeMarkets: formData.storeMarkets,
      });
      const r = await fetch(`${API_BASE}/api/shopify/oauth/start?${params}`, { credentials: "include" });
      const data = await r.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        alert(data.error ?? "Error iniciando OAuth");
        setLaunching(false);
      }
    } catch {
      alert("Error de conexión");
      setLaunching(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", paddingBottom: 32 }}>
      <div style={{ marginBottom: 28 }}>
        <button
          onClick={() => setLocation("/")}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", display: "flex", alignItems: "center", gap: 4, fontSize: 13, marginBottom: 16, padding: 0 }}
        >
          <ArrowLeft size={14} /> Volver al dashboard
        </button>
        <div className="section-header">
          <h1 className="section-title">Nueva Tienda</h1>
          <p className="section-subtitle">Conecta tu Shopify con un clic. ShopyBrain extraerá automáticamente toda la inteligencia disponible.</p>
        </div>
      </div>

      <div className="card" style={{ padding: "24px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 18, marginBottom: 20, borderBottom: "1px solid var(--bdr)" }}>
          <div className="logo-gem" style={{ width: 36, height: 36, fontSize: 16 }}>＋</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: "var(--fh)", fontStyle: "italic", fontSize: 18 }}>Conectar Nueva Tienda</p>
            <p style={{ fontSize: 12, color: "var(--t2)" }}>
              {oauthConfigured
                ? "El admin autoriza tu tienda con un clic — sin copiar tokens manualmente."
                : "Introduce el dominio y el Client ID de tu app de Shopify."}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20,
            background: oauthConfigured ? "rgba(45,212,159,0.1)" : "rgba(212,160,23,0.1)",
            border: `1px solid ${oauthConfigured ? "rgba(45,212,159,0.3)" : "rgba(212,160,23,0.3)"}`,
          }}>
            {oauthConfigured
              ? <><Zap size={13} style={{ color: "var(--jade)" }} /><span style={{ fontSize: 11, color: "var(--jade)", fontFamily: "var(--fm)" }}>OAuth automático</span></>
              : <><Brain size={13} style={{ color: "var(--gold)" }} /><span style={{ fontSize: 11, color: "var(--gold)", fontFamily: "var(--fb)" }}>Extracción IA activa</span></>
            }
          </div>
        </div>

        {/* OAuth flow — when SHOPIFY_CLIENT_ID is configured */}
        {oauthConfigured !== false && (
          <form onSubmit={launchOAuth}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(45,212,159,0.05)", border: "1px solid rgba(45,212,159,0.2)", marginBottom: 20, display: "flex", gap: 10 }}>
                <CheckCircle size={16} style={{ color: "var(--jade)", flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--jade)", marginBottom: 3 }}>Conexión OAuth segura activada</p>
                  <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5 }}>
                    Introduce el dominio de la tienda Shopify de tu cliente. Al hacer clic en "Conectar", se abrirá la pantalla de autorización de Shopify. El cliente aprueba con un clic y el token queda guardado automáticamente.
                  </p>
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: 0 }}>
                <div className="form-group">
                  <label className="form-label">Nombre del Proyecto *</label>
                  <input
                    className="form-input"
                    value={formData.name}
                    onChange={handleChange("name")}
                    onBlur={() => formData.name.length >= 2 && setExtractField("name")}
                    placeholder="Ej: Comic Crafter"
                  />
                  {extractField === "name" && formData.name && (
                    <BrainExtractor value={formData.name} fieldContext="store_name" onAutofill={handleAutofill} />
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Dominio Shopify *</label>
                  <input
                    required
                    className="form-input"
                    value={formData.shopDomain}
                    onChange={handleChange("shopDomain")}
                    onBlur={() => formData.shopDomain.length >= 3 && setExtractField("domain")}
                    placeholder="tu-tienda.myshopify.com"
                  />
                  {extractField === "domain" && formData.shopDomain && (
                    <BrainExtractor value={formData.shopDomain} fieldContext="shopify_domain" onAutofill={handleAutofill} />
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Nicho del negocio</label>
                  <input className="form-input" value={formData.storeNiche} onChange={handleChange("storeNiche")} placeholder="Moda urbana, Gadgets tech..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Tono de marca</label>
                  <input className="form-input" value={formData.brandTone} onChange={handleChange("brandTone")} placeholder="Premium y sofisticado..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Audiencia objetivo</label>
                  <input className="form-input" value={formData.targetAudience} onChange={handleChange("targetAudience")} placeholder="Hombres 25-40 streetwear" />
                </div>
                <div className="form-group">
                  <label className="form-label">Mercados principales</label>
                  <input className="form-input" value={formData.storeMarkets} onChange={handleChange("storeMarkets")} placeholder="España, México, Colombia" />
                </div>
              </div>
            </div>

            <div style={{ paddingTop: 12, borderTop: "1px solid var(--bdr)", marginBottom: 20 }}>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--t2)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--fb)" }}
              >
                {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                API Keys personales (opcional)
              </button>
              {showAdvanced && (
                <div className="grid-2" style={{ marginTop: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Replicate API Token</label>
                    <input type="password" className="form-input" style={{ fontFamily: "var(--fm)" }} value={formData.replicateApiToken} onChange={handleChange("replicateApiToken")} placeholder="r8_..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Anthropic API Key</label>
                    <input type="password" className="form-input" style={{ fontFamily: "var(--fm)" }} value={formData.anthropicApiKey} onChange={handleChange("anthropicApiKey")} placeholder="sk-ant-..." />
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="submit"
                disabled={launching || !formData.shopDomain}
                className="btn btn-gold btn-lg"
              >
                {launching
                  ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Redirigiendo a Shopify...</>
                  : <><ExternalLink size={16} /> Conectar con Shopify</>
                }
              </button>
            </div>
          </form>
        )}

        {/* Manual fallback — when OAuth not configured */}
        {oauthConfigured === false && (
          <div style={{ padding: "16px", borderRadius: 10, background: "rgba(200,168,75,0.06)", border: "1px solid rgba(200,168,75,0.25)" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--gold)", marginBottom: 8 }}>⚠️ OAuth no configurado</p>
            <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6 }}>
              El administrador necesita configurar <code style={{ fontFamily: "var(--fm)", background: "var(--ink3)", padding: "1px 5px", borderRadius: 3 }}>SHOPIFY_CLIENT_ID</code> y{" "}
              <code style={{ fontFamily: "var(--fm)", background: "var(--ink3)", padding: "1px 5px", borderRadius: 3 }}>SHOPIFY_CLIENT_SECRET</code> como secrets en Replit.
              Una vez configurados, la conexión de tiendas será completamente automática.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
