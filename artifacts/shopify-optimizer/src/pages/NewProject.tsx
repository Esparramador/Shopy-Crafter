import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2, ChevronDown, ChevronUp, ArrowLeft, CheckCircle, AlertCircle, ShoppingBag, Globe, Store } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListProjectsQueryKey } from "@workspace/api-client-react";
import BrainExtractor from "../components/BrainExtractor";
import { useCmsSection } from "@/contexts/CmsContext";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type PlatformType = "shopify" | "woocommerce" | "prestashop" | "universal";

const PLATFORM_OPTIONS: Array<{
  key: PlatformType;
  label: string;
  icon: any;
  color: string;
  description: string;
}> = [
  { key: "shopify", label: "Shopify", icon: ShoppingBag, color: "#95bf47", description: "Tienda Shopify con API Admin" },
  { key: "woocommerce", label: "WooCommerce", icon: Globe, color: "#7f54b3", description: "WordPress + WooCommerce" },
  { key: "prestashop", label: "PrestaShop", icon: Store, color: "#df0067", description: "Panel PrestaShop con Webservice" },
  { key: "universal", label: "Auditoría Universal", icon: Globe, color: "#888", description: "Sin tienda conectada" },
];

export default function NewProject() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBrand, setShowBrand] = useState(false);
  const [extractField, setExtractField] = useState<"name" | "domain" | null>(null);
  const [platform, setPlatform] = useState<PlatformType>("shopify");
  const [formData, setFormData] = useState({
    name: "",
    shopDomain: "",
    clientId: "",
    clientSecret: "",
    storeNiche: "",
    brandTone: "",
    targetAudience: "",
    storeMarkets: "",
    plan: "starter",
  });
  const { t } = useCmsSection("labels.newProject");

  const PLANS = [
    { key: "trial", label: "Trial", desc: "3 productos \u00b7 2 imgs", color: "#888" },
    { key: "starter", label: "Starter \u20ac49/mes", desc: "15 productos \u00b7 3 imgs", color: "#c9a84c" },
    { key: "agency_pro", label: "Agency Pro \u20ac149/mes", desc: "60 productos \u00b7 5 imgs", color: "#5b9bd5" },
    { key: "enterprise", label: "Enterprise \u20ac399/mes", desc: "200 productos \u00b7 6 imgs", color: "#3db87a" },
    { key: "admin", label: "Admin (sin l\u00edmites)", desc: "Tienda propia", color: "#a855f7" },
  ];

  const isPrestaShop = platform === "prestashop";

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value }));

  const handleAutofill = (data: Record<string, string>) => {
    setFormData(prev => ({
      ...prev,
      ...data,
      name: data.name && !prev.name ? data.name : prev.name,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/projects`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name || formData.shopDomain.split(".")[0],
          shopDomain: formData.shopDomain,
          clientId: isPrestaShop ? "" : formData.clientId,
          clientSecret: formData.clientSecret,
          storeNiche: formData.storeNiche || undefined,
          brandTone: formData.brandTone || undefined,
          targetAudience: formData.targetAudience || undefined,
          storeMarkets: formData.storeMarkets || undefined,
          plan: formData.plan,
          platformType: platform,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? t("errorSave", "Error al guardar la tienda"));
        setSaving(false);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      setLocation(`/projects/${data.id}/audit`);
    } catch {
      setError(t("errorConnection", "Error de conexi\u00f3n. Comprueba la red e int\u00e9ntalo de nuevo."));
      setSaving(false);
    }
  };

  const isPrestaShop = platform === "prestashop";
  const isUniversal = platform === "universal";
  const isWoo = platform === "woocommerce";
  const isShopify = platform === "shopify";

  const isValid = isPrestaShop
    ? formData.shopDomain && formData.clientSecret && formData.clientSecret.length === 32
    : isUniversal
    ? !!formData.shopDomain
    : formData.shopDomain && formData.clientId && formData.clientSecret;

  const domainLabel = isWoo
    ? "URL de tu tienda WordPress *"
    : isPrestaShop
    ? "URL de tu tienda PrestaShop *"
    : isShopify
    ? t("shopDomain", "Dominio Shopify *")
    : "URL de la tienda *";

  const domainPlaceholder = isWoo
    ? "https://mitienda.com"
    : isShopify
    ? "mi-tienda.myshopify.com"
    : "mitienda.com";

  const credLabel1 = isWoo ? "Consumer Key *" : t("apiKey", "API Key (Client ID) *");
  const credLabel2 = isWoo ? "Consumer Secret *" : t("apiSecret", "Clave secreta de la API *");
  const credPlaceholder1 = isWoo ? "ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" : "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
  const credPlaceholder2 = isWoo ? "cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" : "shpss_\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";

  const credHint = isWoo
    ? "Credenciales \u2014 WordPress Admin \u2192 WooCommerce \u2192 Ajustes \u2192 Avanzado \u2192 REST API \u2192 A\u00f1adir clave"
    : isPrestaShop
    ? "Credenciales \u2014 Par\u00e1metros Avanzados \u2192 Webservice \u2192 A\u00f1adir clave"
    : isShopify
    ? t("credentialsHint", "Credenciales \u2014 Shopify Admin \u2192 Apps \u2192 Desarrollar apps \u2192 tu app \u2192 Credenciales de la API")
    : "Credenciales de acceso a la API de la plataforma";

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", paddingBottom: 40 }}>
      <div style={{ marginBottom: 28 }}>
        <button
          onClick={() => setLocation("/")}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", display: "flex", alignItems: "center", gap: 4, fontSize: 13, marginBottom: 16, padding: 0 }}
        >
          <ArrowLeft size={14} /> {t("backToDashboard", "Volver al dashboard")}
        </button>
        <div className="section-header">
          <h1 className="section-title">{t("title", "A\u00f1adir Tienda")}</h1>
          <p className="section-subtitle">
            {t("subtitle", "Conecta tu tienda para optimizar productos, SEO e im\u00e1genes con IA.")}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ padding: "20px 24px", marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontFamily: "var(--fb)", color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
            Plataforma
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PLATFORM_OPTIONS.map(p => {
              const Icon = p.icon;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    setPlatform(p.key);
                    setFormData(prev => ({ ...prev, clientId: "", clientSecret: "" }));
                  }}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 8,
                    border: `1.5px solid ${platform === p.key ? p.color : "var(--bdr)"}`,
                    background: platform === p.key ? `${p.color}18` : "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    minWidth: 140,
                    transition: "all 0.15s",
                  }}
                >
                  <Icon size={16} style={{ color: platform === p.key ? p.color : "var(--t3)" }} />
                  <div style={{ textAlign: "left" }}>
                    <span style={{ fontSize: 12, fontFamily: "var(--fb)", color: platform === p.key ? p.color : "var(--t2)", display: "block" }}>
                      {p.label}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--t3)" }}>{p.description}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ padding: "24px 28px", marginBottom: 16 }}>
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">{t("projectName", "Nombre del proyecto")}</label>
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
              <label className="form-label">{domainLabel}</label>
              <input
                required
                className="form-input"
                value={formData.shopDomain}
                onChange={handleChange("shopDomain")}
                onBlur={() => formData.shopDomain.length >= 3 && setExtractField("domain")}
                placeholder={domainPlaceholder}
              />
              {extractField === "domain" && formData.shopDomain && (
                <BrainExtractor 
                  value={formData.shopDomain} 
                  fieldContext={isShopify ? "shopify_domain" : isPrestaShop ? "prestashop_domain" : "store_domain"} 
                  onAutofill={handleAutofill} 
                />
              )}
            </div>
          </div>

          {!isUniversal && (
            <>
              <div style={{ borderTop: "1px solid var(--bdr)", margin: "20px 0" }} />

          {/* Credenciales */}
          {isPrestaShop ? (
            <>
              <p style={{ fontSize: 11, fontFamily: "var(--fb)", color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                Credenciales — Parámetros Avanzados → Webservice → Añadir clave
              </p>
              <div style={{ marginBottom: 0 }}>
                <div className="form-group">
                  <label className="form-label">Clave API (32 caracteres) *</label>
                  <input
                    required
                    className="form-input"
                    style={{ fontFamily: "var(--fm)" }}
                    value={formData.clientSecret}
                    onChange={handleChange("clientSecret")}
                    placeholder="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                    autoComplete="off"
                    maxLength={32}
                  />
                  {formData.clientSecret && formData.clientSecret.length !== 32 && (
                    <span style={{ fontSize: 11, color: "#dc3c3c", marginTop: 4, display: "block" }}>
                      {formData.clientSecret.length}/32 caracteres
                    </span>
                  )}
                  {formData.clientSecret && formData.clientSecret.length === 32 && (
                    <span style={{ fontSize: 11, color: "#3db87a", marginTop: 4, display: "block" }}>
                      32/32 caracteres
                    </span>
                  )}
                </div>
              </div>
              <div style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: 8, padding: "12px 14px", marginTop: 12 }}>
                <p style={{ fontSize: 12, fontFamily: "var(--fb)", color: "var(--t2)", marginBottom: 8 }}>
                  Cómo generar la clave API de PrestaShop:
                </p>
                <ol style={{ fontSize: 11, color: "var(--t3)", margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
                  <li>Ve a <strong>Parámetros Avanzados → Webservice</strong> en tu panel PrestaShop</li>
                  <li>Activa el webservice si no lo está</li>
                  <li>Haz clic en <strong>Añadir nueva clave</strong></li>
                  <li>Se genera una clave de 32 caracteres automáticamente</li>
                  <li>Activa los permisos: <strong>products, categories, images, stock_availables, orders, combinations, configurations, languages</strong></li>
                  <li>Guarda y copia la clave aquí</li>
                </ol>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: 11, fontFamily: "var(--fb)", color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                {credHint}
              </p>

              <div className="grid-2" style={{ marginBottom: 0 }}>
                <div className="form-group">
                  <label className="form-label">{credLabel1}</label>
                  <input
                    required
                    className="form-input"
                    style={{ fontFamily: "var(--fm)" }}
                    value={formData.clientId}
                    onChange={handleChange("clientId")}
                    placeholder={credPlaceholder1}
                    autoComplete="off"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{credLabel2}</label>
                  <input
                    required
                    type="password"
                    className="form-input"
                    style={{ fontFamily: "var(--fm)" }}
                    value={formData.clientSecret}
                    onChange={handleChange("clientSecret")}
                    placeholder={credPlaceholder2}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {isWoo && (
                <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "rgba(127,84,179,0.06)", border: "1px solid rgba(127,84,179,0.15)" }}>
                  <p style={{ fontSize: 11, fontFamily: "var(--fb)", color: "#7f54b3", marginBottom: 6 }}>
                    Cómo obtener las claves de WooCommerce:
                  </p>
                  <ol style={{ fontSize: 11, color: "var(--t2)", margin: 0, paddingLeft: 16, lineHeight: 1.6 }}>
                    <li>Ve a <strong>WordPress Admin → WooCommerce → Ajustes → Avanzado → REST API</strong></li>
                    <li>Haz clic en <strong>Añadir clave</strong></li>
                    <li>Selecciona permisos: <strong>Lectura/Escritura</strong></li>
                    <li>Copia el <strong>Consumer Key</strong> (ck_...) y <strong>Consumer Secret</strong> (cs_...)</li>
                  </ol>
                </div>
              )}

              <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 10 }}>
                🔒 Credenciales cifradas con AES-256.{" "}
                {isWoo
                  ? "WooCommerce usa autenticación directa con cada petición."
                  : "El token de acceso se genera automáticamente al guardar."}
              </p>
            </>
          )}
        </div>

        <div className="card" style={{ padding: "20px 24px", marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontFamily: "var(--fb)", color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
            Plan del cliente
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PLANS.map(p => (
              <button
                key={p.key}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, plan: p.key }))}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: `1.5px solid ${formData.plan === p.key ? p.color : "var(--bdr)"}`,
                  background: formData.plan === p.key ? `${p.color}18` : "transparent",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 2,
                  minWidth: 120,
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: 12, fontFamily: "var(--fb)", color: formData.plan === p.key ? p.color : "var(--t2)" }}>
                  {p.label}
                </span>
                <span style={{ fontSize: 10, color: "var(--t3)" }}>{p.desc}</span>
              </button>
            ))}
          </div>
          {formData.plan !== "starter" && (
            <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 10 }}>
              {formData.plan === "admin" ? "\u26a1 Sin l\u00edmites de productos ni im\u00e1genes \u2014 solo para tiendas propias" :
               formData.plan === "trial" ? "\u23f3 Acceso limitado para pruebas" :
               formData.plan === "enterprise" ? "\ud83c\udfc6 200 productos/mes \u00b7 6 im\u00e1genes/producto \u00b7 1.200 imgs/mes" :
               "\ud83d\udcbc 60 productos/mes \u00b7 5 im\u00e1genes/producto \u00b7 300 imgs/mes"}
            </p>
          )}
        </div>

        <div className="card" style={{ padding: "14px 24px", marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => setShowBrand(!showBrand)}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--t2)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--fb)", width: "100%", padding: 0 }}
          >
            {showBrand ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Contexto de marca (opcional \u2014 mejora los resultados de la IA)
          </button>
          {showBrand && (
            <div className="grid-2" style={{ marginTop: 16 }}>
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
                <input className="form-input" value={formData.storeMarkets} onChange={handleChange("storeMarkets")} placeholder="Espa\u00f1a, M\u00e9xico, Colombia" />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, background: "rgba(220,60,60,0.08)", border: "1px solid rgba(220,60,60,0.3)", marginBottom: 16 }}>
            <AlertCircle size={14} style={{ color: "#dc3c3c", flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#dc3c3c" }}>{error}</span>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12 }}>
          {!isValid && !isUniversal && (
            <span style={{ fontSize: 12, color: "var(--t3)" }}>
              {!formData.shopDomain
                ? "Dominio requerido"
                : isPrestaShop
                  ? formData.clientSecret.length !== 32 ? "Clave API: 32 caracteres requeridos" : ""
                  : isWoo
                    ? !formData.clientId ? "Consumer Key requerido" : "Consumer Secret requerido"
                    : !formData.clientId ? "API Key requerida" : "Clave secreta requerida"}
            </span>
          )}
          <button
            type="submit"
            disabled={saving || !isValid}
            className="btn btn-gold btn-lg"
          >
            {saving
              ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Guardando...</>
              : <><CheckCircle size={16} /> Guardar tienda</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}
