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
    storeNiche: "",
    brandTone: "",
    targetAudience: "",
    storeMarkets: "",
    plan: "starter",
  });

  const PLANS = [
    { key: "trial", label: "Trial", desc: "3 productos · 2 imgs", color: "#888" },
    { key: "starter", label: "Starter €49/mes", desc: "15 productos · 3 imgs", color: "#c9a84c" },
    { key: "agency_pro", label: "Agency Pro €149/mes", desc: "60 productos · 5 imgs", color: "#5b9bd5" },
    { key: "enterprise", label: "Enterprise €399/mes", desc: "200 productos · 6 imgs", color: "#3db87a" },
    { key: "admin", label: "Admin (sin límites)", desc: "Tienda propia", color: "#a855f7" },
  ];

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
          storeNiche: formData.storeNiche || undefined,
          brandTone: formData.brandTone || undefined,
          targetAudience: formData.targetAudience || undefined,
          storeMarkets: formData.storeMarkets || undefined,
          plan: formData.plan,
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

  const isValid = formData.shopDomain && formData.clientId && formData.clientSecret;

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
            Con el Client ID y la Clave Secreta, el sistema genera el token de acceso automáticamente. Solo necesitas 2 credenciales.
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

          {/* Credenciales */}
          <p style={{ fontSize: 11, fontFamily: "var(--fb)", color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
            Credenciales — Shopify Admin → Apps → Desarrollar apps → tu app → Credenciales de la API
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
            </div>
          </div>

          <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 10 }}>
            🔒 Credenciales cifradas con AES-256. El token de acceso se genera automáticamente al guardar.
          </p>
        </div>

        {/* Plan selector */}
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
              {formData.plan === "admin" ? "⚡ Sin límites de productos ni imágenes — solo para tiendas propias" :
               formData.plan === "trial" ? "⏳ Acceso limitado para pruebas" :
               formData.plan === "enterprise" ? "🏆 200 productos/mes · 6 imágenes/producto · 1.200 imgs/mes" :
               "💼 60 productos/mes · 5 imágenes/producto · 300 imgs/mes"}
            </p>
          )}
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
              {!formData.shopDomain ? "Dominio requerido" : !formData.clientId ? "API Key requerida" : "Clave secreta requerida"}
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
