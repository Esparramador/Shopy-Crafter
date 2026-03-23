import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Store, ArrowRight, Loader2 } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useCreateProject } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListProjectsQueryKey } from "@workspace/api-client-react";
import { motion } from "framer-motion";

export default function Home() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const createProject = useCreateProject();
  
  const [formData, setFormData] = useState({
    name: "",
    shopDomain: "",
    clientId: "",
    clientSecret: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createProject.mutate({
      data: formData
    }, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        setLocation(`/projects/${data.id}/audit`);
      }
    });
  };

  return (
    <div className="max-w-4xl w-full mx-auto">
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
          Selecciona un proyecto del panel lateral o añade una nueva tienda.
        </motion.p>
      </div>

      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
        <GlassCard className="p-8 md:p-10 border-white/10">
          <div className="flex items-center gap-4 mb-8 pb-6 border-b border-white/10">
            <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center">
              <Plus className="w-6 h-6 text-foreground" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Conectar Nueva Tienda</h2>
              <p className="text-muted-foreground">Configura las credenciales de Shopify OAuth (Custom App).</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Nombre del Proyecto</label>
                <input 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  placeholder="Ej: Comic Crafter"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Dominio Shopify</label>
                <input 
                  required
                  value={formData.shopDomain}
                  onChange={e => setFormData({...formData, shopDomain: e.target.value})}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  placeholder="ejemplo.myshopify.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Client ID (OAuth)</label>
                <input 
                  required
                  value={formData.clientId}
                  onChange={e => setFormData({...formData, clientId: e.target.value})}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono text-sm"
                  placeholder="Admin API Client ID"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Client Secret (OAuth)</label>
                <input 
                  required
                  type="password"
                  value={formData.clientSecret}
                  onChange={e => setFormData({...formData, clientSecret: e.target.value})}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono text-sm"
                  placeholder="shpat_..."
                />
              </div>
            </div>
            
            <div className="pt-4 flex justify-end">
              <button 
                type="submit"
                disabled={createProject.isPending}
                className="bg-primary text-primary-foreground px-8 py-3.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-primary/90 transition-all hover:shadow-[0_0_20px_rgba(91,78,255,0.4)] disabled:opacity-50"
              >
                {createProject.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                {createProject.isPending ? "Conectando..." : "Crear Proyecto"}
              </button>
            </div>
          </form>
        </GlassCard>
      </motion.div>
    </div>
  );
}
