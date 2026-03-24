import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Loader2, ChevronDown, ChevronUp, ArrowLeft, ExternalLink, Copy, CheckCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListProjectsQueryKey } from "@workspace/api-client-react";
import BrainExtractor from "../components/BrainExtractor";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const CALLBACK_URL = "https://shopycrafter.replit.app/api/shopify/oauth/callback";

export default function NewProject() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [launching, setLaunching] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [extractField, setExtractField] = useState<"name" | "domain" | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    shopDomain: "",
    clientId: "",
    clientSecret: "",
    storeNiche: "",
    brandTone: "",
    targetAudience: "",
    storeMarkets: "",
  });

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData({ ...formData, [field]: e.target.value });

  const handleAutofill = (data: Record<string, string>) => {
    setFormData(prev => ({
      ...prev,
      ...data,
      name: data.name && !prev.name ? data.name : prev.name,
    }));
  };

  const copyCallback = () => {
    navigator.clipboard.writeText(CALLBACK_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const launchOAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.shopDomain) return;
    setLaunching(true);
    try {
      const r = await fetch(`${API_BASE}/api/shopify/oauth/start`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: formData.shopDomain,
          name: formData.name || formData.shopDomain.split(".")[0],
          clientId: formData.clientId,
          clientSecret: formData.clientSecret,
          storeNiche: formData.storeNiche,
          brandTone: formData.brandTone,
          targetAudience: formData.targetAudience,
          storeMarkets: formData.storeMarkets,
        }),
      });
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

  const isValid = formData.shopDomain && formData.clientId && formData.clientSecret;

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
          <p className="section-subtitle">Conecta una tienda Shopify mediante OAuth. En 30 segundos el token queda guardado automáticamente.</p>
        </div>
      </div>

      <form onSubmit={launchOAuth}>
        {/* Paso 1 — Callback URL */}
        <div className="card" style={{ padding: "20px 24px", marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontFamily: "var(--fb)", color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
            Paso 1 — Registra la URL de callback en Shopify Partners
          </p>
          <p style={{ fontSize: 12, color: "var(--t2)", marginBottom: 12, lineHeight: 1.6 }}>
            En <strong>Shopify Partners → tu app → App setup → Allowed redirection URL(s)</strong>, añade exactamente esta URL:
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, background: "var(--ink2)", border: "1px solid var(--bdr)", fontFamily: "var(--fm)", fontSize: 12 }}>
            <code style={{ flex: 1, color: "var(--jade)", wordBreak: "break-all" }}>{CALLBACK_URL}</code>
            <button
              type="button"
              onClick={copyCallback}
              style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "var(--jade)" : "var(--t3)", padding: 4, display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}
            >
              {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
              <span style={{ fontSize: 11 }}>{copied ? "Copiada" : "Copiar"}</span>
            </button>
          </div>
        </div>

        {/* Paso 2 — Credenciales Shopify */}
        <div className="card" style={{ padding: "20px 24px", marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontFamily: "var(--fb)", color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
            Paso 2 — Credenciales de tu app en Shopify Partners
          </p>
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">
                API Key (Client ID) *
                <a
                  href="https://partners.shopify.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginLeft: 6, color: "var(--t3)", fontSize: 11 }}
                >
                  <ExternalLink size={11} style={{ verticalAlign: "middle" }} /> Partners
                </a>
              </label>
              <input
                required
                className="form-input"
                style={{ fontFamily: "var(--fm)" }}
                value={formData.clientId}
                onChange={handleChange("clientId")}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label className="form-label">API Secret Key (Client Secret) *</label>
              <input
                required
                type="password"
                className="form-input"
                style={{ fontFamily: "var(--fm)" }}
                value={formData.clientSecret}
                onChange={handleChange("clientSecret")}
                placeholder="shpss_••••••••••••••••••••••••••••••••"
                autoComplete="new-password"
              />
            </div>
          </div>
          <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>
            Encriptadas con AES-256. Nunca se exponen al cliente ni se almacenan en texto plano.
          </p>
        </div>

        {/* Paso 3 — Datos de la tienda */}
        <div className="card" style={{ padding: "20px 24px", marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontFamily: "var(--fb)", color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
            Paso 3 — Datos de la tienda del cliente
          </p>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Nombre del Proyecto</label>
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
          </div>

          {/* Campos adicionales colapsables */}
          <div style={{ borderTop: "1px solid var(--bdr)", paddingTop: 12, marginTop: 4 }}>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--t2)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--fb)" }}
            >
              {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Contexto de marca adicional (opcional — mejora la IA)
            </button>
            {showAdvanced && (
              <div className="grid-2" style={{ marginTop: 14 }}>
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
            )}
          </div>
        </div>

        {/* Botón de envío */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, alignItems: "center" }}>
          {!isValid && (
            <span style={{ fontSize: 12, color: "var(--t3)" }}>
              {!formData.shopDomain ? "Introduce el dominio" : !formData.clientId ? "Introduce el Client ID" : "Introduce el Client Secret"}
            </span>
          )}
          <button
            type="submit"
            disabled={launching || !isValid}
            className="btn btn-gold btn-lg"
          >
            {launching
              ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Redirigiendo a Shopify...</>
              : <><ExternalLink size={16} /> Conectar con Shopify</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}
