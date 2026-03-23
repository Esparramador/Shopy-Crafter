import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { GlassCard } from "@/components/ui/GlassCard";
import { useGetProject, useUpdateProject, useRefreshProjectToken, useTestProjectConnection } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetProjectQueryKey } from "@workspace/api-client-react";
import { Shield, Key, RefreshCw, CheckCircle, AlertTriangle, Save } from "lucide-react";

export default function SettingsPage() {
  const [, params] = useRoute("/projects/:id/settings");
  const projectId = parseInt(params?.id || "0");
  const queryClient = useQueryClient();
  
  const { data: project, isLoading } = useGetProject(projectId);
  const updateProject = useUpdateProject();
  const refreshToken = useRefreshProjectToken();
  const testConnection = useTestProjectConnection();

  const [formData, setFormData] = useState({
    name: "",
    storeNiche: "",
    brandTone: "",
    targetAudience: "",
    replicateApiToken: "",
    anthropicApiKey: ""
  });

  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        storeNiche: project.storeNiche || "",
        brandTone: project.brandTone || "",
        targetAudience: project.targetAudience || "",
        replicateApiToken: project.replicateApiToken || "",
        anthropicApiKey: project.anthropicApiKey || ""
      });
    }
  }, [project]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProject.mutate({
      projectId,
      data: formData
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      }
    });
  };

  const handleRefresh = () => {
    refreshToken.mutate({ projectId }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) })
    });
  };

  const handleTest = () => {
    testConnection.mutate({ projectId }, {
      onSuccess: (data) => setTestResult(data)
    });
  };

  if (isLoading) return <div className="p-12 text-center">Cargando...</div>;

  return (
    <div className="space-y-8 pb-12 max-w-4xl">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Configuración</h1>
        <p className="text-muted-foreground mt-1">Gestiona las credenciales y el contexto de IA para {project?.name}</p>
      </div>

      <GlassCard className="p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
          <Shield className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-bold text-foreground">Estado de Conexión Shopify</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div>
            <div className="text-sm text-muted-foreground mb-1">Dominio</div>
            <div className="font-mono text-foreground">{project?.shopDomain}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Estado del Token (OAuth)</div>
            <div className="flex items-center gap-2">
              {project?.hasAccessToken ? (
                <span className="flex items-center gap-1.5 text-green-400 font-medium">
                  <CheckCircle className="w-4 h-4" /> Válido
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-red-400 font-medium">
                  <AlertTriangle className="w-4 h-4" /> No Válido
                </span>
              )}
            </div>
            {project?.tokenExpiresAt && (
              <div className="text-xs text-muted-foreground mt-1">
                Expira: {new Date(project.tokenExpiresAt).toLocaleString()}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-white/5 flex flex-wrap gap-3">
          <button 
            onClick={handleTest}
            disabled={testConnection.isPending}
            className="bg-white/5 border border-white/10 text-foreground px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {testConnection.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            Testear Conexión
          </button>
          <button 
            onClick={handleRefresh}
            disabled={refreshToken.isPending}
            className="bg-primary/20 border border-primary/30 text-primary px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/30 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshToken.isPending ? 'animate-spin' : ''}`} />
            Renovar Token Ahora
          </button>
        </div>

        {testResult && (
          <div className={`mt-4 p-4 rounded-xl text-sm border ${testResult.connected ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
            {testResult.connected ? `Conexión exitosa a ${testResult.storeName}. ${testResult.productCount} productos encontrados.` : `Error de conexión: ${testResult.error}`}
          </div>
        )}
      </GlassCard>

      <form onSubmit={handleSave}>
        <GlassCard className="p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
            <Key className="w-6 h-6 text-foreground" />
            <h2 className="text-xl font-bold text-foreground">Configuración General e IA</h2>
          </div>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Nombre del Proyecto</label>
              <input 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">API Token de Replicate (Imágenes)</label>
                <input 
                  type="password"
                  value={formData.replicateApiToken}
                  onChange={e => setFormData({...formData, replicateApiToken: e.target.value})}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">API Key de Anthropic (Claude)</label>
                <input 
                  type="password"
                  value={formData.anthropicApiKey}
                  onChange={e => setFormData({...formData, anthropicApiKey: e.target.value})}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-white/5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Nicho de Tienda</label>
                <input 
                  value={formData.storeNiche}
                  onChange={e => setFormData({...formData, storeNiche: e.target.value})}
                  placeholder="Ej: Streetwear premium"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Tono de Marca</label>
                <input 
                  value={formData.brandTone}
                  onChange={e => setFormData({...formData, brandTone: e.target.value})}
                  placeholder="Ej: Exclusivo, minimalista"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Público Objetivo</label>
                <input 
                  value={formData.targetAudience}
                  onChange={e => setFormData({...formData, targetAudience: e.target.value})}
                  placeholder="Ej: Hombres 18-35 años"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="pt-6 flex justify-end">
              <button 
                type="submit"
                disabled={updateProject.isPending}
                className="bg-primary text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(91,78,255,0.3)] disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {updateProject.isPending ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </div>
        </GlassCard>
      </form>
    </div>
  );
}
