import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Loader2, ChevronDown, ChevronUp, ArrowLeft, Brain } from "lucide-react";
import { useCreateProject, getListProjectsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import BrainExtractor from "../components/BrainExtractor";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function NewProject() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const createProject = useCreateProject();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "done">("idle");
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
    replicateApiToken: "",
    anthropicApiKey: "",
  });

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData({ ...formData, [field]: e.target.value });

  const handleAutofill = (data: Record<string, string>) => {
    setFormData(prev => ({
      ...prev,
      ...data,
      // Only autofill name if it's empty
      name: data.name && !prev.name ? data.name : prev.name,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createProject.mutate(
      { data: formData },
      {
        onSuccess: async (data) => {
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          setSyncStatus("syncing");
          try {
            await fetch(`${API_BASE}/api/projects/${data.id}/products/sync`, {
              method: "POST",
              credentials: "include",
            });
          } catch {
            // Non-fatal
          }
          setSyncStatus("done");
          setLocation(`/projects/${data.id}/audit`);
        },
      }
    );
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
          <p className="section-subtitle">Conecta tu Shopify. ShopyBrain analizará automáticamente tu marca y extraerá toda la inteligencia disponible.</p>
        </div>
      </div>

      <div className="card" style={{ padding: "24px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 18, marginBottom: 20, borderBottom: "1px solid var(--bdr)" }}>
          <div className="logo-gem" style={{ width: 36, height: 36, fontSize: 16 }}>＋</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: "var(--fh)", fontStyle: "italic", fontSize: 18 }}>Conectar Nueva Tienda</p>
            <p style={{ fontSize: 12, color: "var(--t2)" }}>ShopyBrain extraerá inteligencia de marca automáticamente desde tu dominio.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)" }}>
            <Brain size={13} style={{ color: "var(--gold)" }} />
            <span style={{ fontSize: 11, color: "var(--gold)", fontFamily: "var(--fb)" }}>Extracción IA activa</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Connection fields */}
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Nombre del Proyecto *</label>
              <input
                required
                className="form-input"
                value={formData.name}
                onChange={handleChange("name")}
                onBlur={() => formData.name.length >= 2 && setExtractField("name")}
                placeholder="Ej: Comic Crafter"
              />
              {extractField === "name" && formData.name && (
                <BrainExtractor
                  value={formData.name}
                  fieldContext="store_name"
                  onAutofill={handleAutofill}
                />
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
                <BrainExtractor
                  value={formData.shopDomain}
                  fieldContext="shopify_domain"
                  onAutofill={handleAutofill}
                />
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Client ID (OAuth) *</label>
              <input required className="form-input" style={{ fontFamily: "var(--fm)" }} value={formData.clientId} onChange={handleChange("clientId")} placeholder="Admin API Client ID" />
            </div>
            <div className="form-group">
              <label className="form-label">Client Secret (OAuth) *</label>
              <input required type="password" className="form-input" style={{ fontFamily: "var(--fm)" }} value={formData.clientSecret} onChange={handleChange("clientSecret")} placeholder="shpsa_..." />
            </div>
          </div>

          {/* Store context — ShopyBrain can auto-fill these */}
          <div style={{ paddingTop: 16, borderTop: "1px solid var(--bdr)", marginBottom: 16, marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: "var(--t2)", margin: 0 }}>
                Contexto de la Tienda{" "}
                <span style={{ color: "var(--gold)", fontSize: 11 }}>(ShopyBrain puede auto-rellenar estos campos)</span>
              </p>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Nicho del negocio</label>
                <input
                  className="form-input"
                  value={formData.storeNiche}
                  onChange={handleChange("storeNiche")}
                  onBlur={() => formData.storeNiche.length >= 3 && setExtractField(null)}
                  placeholder="Ej: Moda urbana, Gadgets tech..."
                />
                {formData.storeNiche.length >= 3 && (
                  <BrainExtractor value={formData.storeNiche} fieldContext="niche" onAutofill={handleAutofill} />
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Tono de marca</label>
                <input className="form-input" value={formData.brandTone} onChange={handleChange("brandTone")} placeholder="Ej: Premium y sofisticado..." />
              </div>
              <div className="form-group">
                <label className="form-label">Audiencia objetivo</label>
                <input className="form-input" value={formData.targetAudience} onChange={handleChange("targetAudience")} placeholder="Ej: Hombres 25-40 streetwear" />
              </div>
              <div className="form-group">
                <label className="form-label">Mercados principales</label>
                <input className="form-input" value={formData.storeMarkets} onChange={handleChange("storeMarkets")} placeholder="Ej: España, México, Colombia" />
              </div>
            </div>
          </div>

          {/* Advanced API keys */}
          <div style={{ paddingTop: 12, borderTop: "1px solid var(--bdr)", marginBottom: 20 }}>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 12, color: "var(--t2)", background: "none",
                border: "none", cursor: "pointer", fontFamily: "var(--fb)",
                transition: "color 0.15s",
              }}
              onMouseOver={(e) => { e.currentTarget.style.color = "var(--t)"; }}
              onMouseOut={(e) => { e.currentTarget.style.color = "var(--t2)"; }}
            >
              {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              API Keys personales (opcional — sobreescribe las del sistema)
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
              disabled={createProject.isPending || syncStatus === "syncing"}
              className={`btn btn-gold btn-lg${(createProject.isPending || syncStatus === "syncing") ? " loading" : ""}`}
            >
              <Loader2 size={16} className={`animate-spin${createProject.isPending || syncStatus === "syncing" ? "" : " hidden"}`} style={{ display: createProject.isPending || syncStatus === "syncing" ? "block" : "none" }} />
              {!createProject.isPending && syncStatus !== "syncing" && <ArrowRight size={16} />}
              {createProject.isPending ? "Conectando..." : syncStatus === "syncing" ? "Importando productos..." : "Crear Proyecto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
