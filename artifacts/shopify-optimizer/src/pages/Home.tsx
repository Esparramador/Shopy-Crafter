import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Store, ArrowRight, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useCreateProject, useListProjects, getListProjectsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";

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

  const inputClass =
    "w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-muted-foreground/50";

  const labelClass = "text-sm font-medium text-foreground";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start pt-16 pb-20 px-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-20 h-20 bg-primary/20 border-2 border-primary/30 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(91,78,255,0.3)]"
          >
            <Store className="w-10 h-10 text-primary" />
          </motion.div>
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4"
          >
            Shopify <span className="text-gradient-primary">AI Optimizer</span>
          </motion.h1>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-muted-foreground"
          >
            Plataforma de inteligencia artificial para optimizar tu catálogo Shopify.
          </motion.p>
        </div>

        {projects && projects.length > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="mb-8"
          >
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Tus tiendas activas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {projects.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}/audit`}>
                  <GlassCard className="p-4 flex items-center justify-between cursor-pointer hover:border-primary/30 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Store className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.shopDomain}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </GlassCard>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
          <GlassCard className="p-8 md:p-10 border-white/10">
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-white/10">
              <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center">
                <Plus className="w-6 h-6 text-foreground" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">Conectar Nueva Tienda</h2>
                <p className="text-muted-foreground">Configura las credenciales OAuth de tu Shopify Custom App.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Row 1 - Basic */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className={labelClass}>Nombre del Proyecto *</label>
                  <input
                    required
                    value={formData.name}
                    onChange={handleChange("name")}
                    className={inputClass}
                    placeholder="Ej: Comic Crafter"
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Dominio Shopify *</label>
                  <input
                    required
                    value={formData.shopDomain}
                    onChange={handleChange("shopDomain")}
                    className={inputClass}
                    placeholder="tu-tienda.myshopify.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Client ID (OAuth) *</label>
                  <input
                    required
                    value={formData.clientId}
                    onChange={handleChange("clientId")}
                    className={`${inputClass} font-mono text-sm`}
                    placeholder="Admin API Client ID"
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Client Secret (OAuth) *</label>
                  <input
                    required
                    type="password"
                    value={formData.clientSecret}
                    onChange={handleChange("clientSecret")}
                    className={`${inputClass} font-mono text-sm`}
                    placeholder="shpsa_..."
                  />
                </div>
              </div>

              {/* Row 2 - Store Context */}
              <div className="pt-2 pb-2 border-t border-white/5">
                <p className="text-sm text-muted-foreground font-medium mb-4">
                  Contexto de la Tienda{" "}
                  <span className="text-xs text-primary">(mejora la calidad de todos los análisis IA)</span>
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className={labelClass}>Nicho del negocio</label>
                    <input
                      value={formData.storeNiche}
                      onChange={handleChange("storeNiche")}
                      className={inputClass}
                      placeholder="Ej: Moda urbana, Suplementos fitness, Gadgets tech"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Tono de marca</label>
                    <input
                      value={formData.brandTone}
                      onChange={handleChange("brandTone")}
                      className={inputClass}
                      placeholder="Ej: Premium y sofisticado, Juvenil y divertido, Profesional"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Audiencia objetivo</label>
                    <input
                      value={formData.targetAudience}
                      onChange={handleChange("targetAudience")}
                      className={inputClass}
                      placeholder="Ej: Hombres 25-40 interesados en streetwear"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Mercados principales</label>
                    <input
                      value={formData.storeMarkets}
                      onChange={handleChange("storeMarkets")}
                      className={inputClass}
                      placeholder="Ej: España, México, Colombia"
                    />
                  </div>
                </div>
              </div>

              {/* Advanced: API Keys */}
              <div className="border-t border-white/5 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  API Keys personales (opcional — sobreescribe las del sistema)
                </button>

                {showAdvanced && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className={labelClass}>Replicate API Token</label>
                      <input
                        type="password"
                        value={formData.replicateApiToken}
                        onChange={handleChange("replicateApiToken")}
                        className={`${inputClass} font-mono text-sm`}
                        placeholder="r8_... (para generación de imágenes)"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className={labelClass}>Anthropic API Key</label>
                      <input
                        type="password"
                        value={formData.anthropicApiKey}
                        onChange={handleChange("anthropicApiKey")}
                        className={`${inputClass} font-mono text-sm`}
                        placeholder="sk-ant-... (para análisis Claude)"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={createProject.isPending}
                  className="bg-primary text-primary-foreground px-8 py-3.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-primary/90 transition-all hover:shadow-[0_0_20px_rgba(91,78,255,0.4)] disabled:opacity-50"
                >
                  {createProject.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <ArrowRight className="w-5 h-5" />
                  )}
                  {createProject.isPending ? "Conectando..." : "Crear Proyecto"}
                </button>
              </div>
            </form>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}
