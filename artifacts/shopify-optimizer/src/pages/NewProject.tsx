import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2, ChevronDown, ChevronUp, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListProjectsQueryKey } from "@workspace/api-client-react";
import BrainExtractor from "../components/BrainExtractor";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function NewProject() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBrand, setShowBrand] = useState(false);
  const [extractField, setExtractField] = useState<"name" | "domain" | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    shopDomain: "",
    clientId: "",
    clientSecret: "",
    accessToken: "",
    storeNiche: "",
    brandTone: "",
    targetAudience: "",
    storeMarkets: "",
  });

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
          clientId: formData.clientId,
          clientSecret: formData.clientSecret,
          accessToken: formData.accessToken,
          storeNiche: formData.storeNiche || undefined,
          brandTone: formData.brandTone || undefined,
          targetAudience: formData.targetAudience || undefined,
          storeMarkets: formData.storeMarkets || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? "Error al guardar la tienda");
        setSaving(false);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      setLocation(`/project/${data.id}`);
    } catch {
      setError("Error de conexión. Comprueba la red e inténtalo de nuevo.");
      setSaving(false);
    }
  };

  const isValid = formData.shopDomain && formData.clientId && formData.clientSecret && formData.accessToken;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <button
          onClick={() => setLocation("/")}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", display: "flex", alignItems: "center", gap: 4, fontSize: 13, marginBottom: 16, padding: 0 }}
        >
          <ArrowLeft size={14} /> Volver al dashboard
        </button>
        <div className="section-header">
          <h1 className="section-title">Añadir Tienda</h1>
          <p className="section-subtitle">
            Con el API Key y la Clave Secreta, el sistema genera y renueva el token de acceso automáticamente. No necesitas copiarlo manualmente.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Bloque principal */}
        <div className="card" style={{ padding: "24px 28px", marginBottom: 16 }}>

          {/* Fila 1 — Nombre + Dominio */}
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Nombre del proyecto</label>
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
                placeholder="mi-tienda.myshopify.com"
              />
              {extractField === "domain" && formData.shopDomain && (
                <BrainExtractor value={formData.shopDomain} fieldContext="shopify_domain" onAutofill={handleAutofill} />
              )}
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--bdr)", margin: "20px 0" }} />

          {/* Credenciales de la app personalizada */}
          <p style={{ fontSize: 11, fontFamily: "var(--fb)", color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
            Credenciales — Shopify Admin → Configuración → Apps → Desarrollar apps → tu app
          </p>
          <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 14, lineHeight: 1.5 }}>
            Los 3 campos los encuentras en la pestaña <strong style={{ color: "var(--t2)" }}>Credenciales de la API</strong> de tu app.
          </p>

          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">API Key (Client ID) *</label>
              <input
                required
                className="form-input"
                style={{ fontFamily: "var(--fm)" }}
                value={formData.clientId}
                onChange={handleChange("clientId")}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                autoComplete="off"
              />
              <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 3 }}>Pestaña "Credenciales de la API"</p>
            </div>
            <div className="form-group">
              <label className="form-label">Clave secreta de la API *</label>
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
              <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 3 }}>Misma pestaña, junto al API Key</p>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 4 }}>
            <label className="form-label">
              Admin API Access Token *
              <span style={{ marginLeft: 8, fontFamily: "var(--fr)", color: "var(--gold)", fontSize: 11, fontWeight: 400 }}>
                ← Este es el más importante
              </span>
            </label>
            <input
              required
              type="password"
              className="form-input"
              style={{ fontFamily: "var(--fm)" }}
              value={formData.accessToken}
              onChange={handleChange("accessToken")}
              placeholder="shpat_••••••••••••••••••••••••••••••••"
              autoComplete="new-password"
            />
            <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 3, lineHeight: 1.5 }}>
              En la misma pestaña "Credenciales de la API", sección <strong>"Tokens de acceso de la API de Admin"</strong>.
              Empieza por <code style={{ background: "var(--ink2)", padding: "1px 4px", borderRadius: 3 }}>shpat_</code>.
              Solo se muestra una vez — guárdalo bien.
            </p>
          </div>

          <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 10 }}>
            🔒 Client ID y Secret se cifran con AES-256. El token se valida contra Shopify antes de guardar.
          </p>
        </div>

        {/* Contexto de marca (colapsable) */}
        <div className="card" style={{ padding: "14px 24px", marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => setShowBrand(!showBrand)}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--t2)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--fb)", width: "100%", padding: 0 }}
          >
            {showBrand ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Contexto de marca (opcional — mejora los resultados de la IA)
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
                <input className="form-input" value={formData.storeMarkets} onChange={handleChange("storeMarkets")} placeholder="España, México, Colombia" />
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, background: "rgba(220,60,60,0.08)", border: "1px solid rgba(220,60,60,0.3)", marginBottom: 16 }}>
            <AlertCircle size={14} style={{ color: "#dc3c3c", flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#dc3c3c" }}>{error}</span>
          </div>
        )}

        {/* Acciones */}
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12 }}>
          {!isValid && (
            <span style={{ fontSize: 12, color: "var(--t3)" }}>
              {!formData.shopDomain ? "Dominio requerido" : !formData.clientId ? "API Key requerida" : !formData.clientSecret ? "Clave secreta requerida" : "Access Token (shpat_...) requerido"}
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
