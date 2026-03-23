import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useCreateProject, useListProjects, getListProjectsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Home() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const createProject = useCreateProject();
  const { data: projects } = useListProjects();

  const [showAdvanced, setShowAdvanced] = useState(false);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createProject.mutate(
      { data: formData },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          setLocation(`/projects/${data.id}/audit`);
        },
      }
    );
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div className="section-header">
          <h1 className="section-title">Nueva Tienda</h1>
          <p className="section-subtitle">Conecta las credenciales OAuth de tu Shopify Custom App para comenzar la optimización.</p>
        </div>
      </div>

      {/* Existing stores quick access */}
      {projects && projects.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--t3)", marginBottom: 10 }}>
            Tiendas activas
          </p>
          <div className="grid-2" style={{ gap: 8 }}>
            {projects.map((p: { id: number; name: string; shopDomain?: string }) => (
              <Link key={p.id} href={`/projects/${p.id}/audit`}>
                <div className="card card-hover" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="logo-gem" style={{ width: 28, height: 28, fontSize: 12, background: "rgba(200,168,75,0.1)", color: "var(--gold2)" }}>🛍</div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t)" }}>{p.name}</p>
                      <p style={{ fontSize: 11, color: "var(--t3)" }}>{p.shopDomain ?? "—"}</p>
                    </div>
                  </div>
                  <ArrowRight size={14} style={{ color: "var(--t3)" }} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Create new project form */}
      <div className="card" style={{ padding: "24px 28px" }}>
        {/* Form header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 18, marginBottom: 20, borderBottom: "1px solid var(--bdr)" }}>
          <div className="logo-gem" style={{ width: 36, height: 36, fontSize: 16 }}>＋</div>
          <div>
            <p style={{ fontFamily: "var(--fh)", fontStyle: "italic", fontSize: 18 }}>Conectar Nueva Tienda</p>
            <p style={{ fontSize: 12, color: "var(--t2)" }}>Configura las credenciales OAuth de tu Shopify Custom App.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Basic fields */}
          <div className="grid-2" style={{ marginBottom: 18 }}>
            <div className="form-group">
              <label className="form-label">Nombre del Proyecto *</label>
              <input required className="form-input" value={formData.name} onChange={handleChange("name")} placeholder="Ej: Comic Crafter" />
            </div>
            <div className="form-group">
              <label className="form-label">Dominio Shopify *</label>
              <input required className="form-input" value={formData.shopDomain} onChange={handleChange("shopDomain")} placeholder="tu-tienda.myshopify.com" />
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

          {/* Context section */}
          <div style={{ paddingTop: 16, borderTop: "1px solid var(--bdr)", marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: "var(--t2)", marginBottom: 14 }}>
              Contexto de la Tienda{" "}
              <span style={{ color: "var(--gold)", fontSize: 11 }}>(mejora la calidad de todos los análisis IA)</span>
            </p>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Nicho del negocio</label>
                <input className="form-input" value={formData.storeNiche} onChange={handleChange("storeNiche")} placeholder="Ej: Moda urbana, Gadgets tech..." />
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

          {/* Submit */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={createProject.isPending}
              className={`btn btn-gold btn-lg${createProject.isPending ? " loading" : ""}`}
            >
              {createProject.isPending ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {createProject.isPending ? "Conectando..." : "Crear Proyecto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
