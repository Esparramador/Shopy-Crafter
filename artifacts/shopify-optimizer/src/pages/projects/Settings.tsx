import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { GlassCard } from "@/components/ui/GlassCard";
import { useGetProject, useUpdateProject, useRefreshProjectToken, useTestProjectConnection } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetProjectQueryKey } from "@workspace/api-client-react";
import { Shield, Key, RefreshCw, CheckCircle, AlertTriangle, Save, Brain, Eye, EyeOff, Copy, Unplug, PlugZap, Trash2 } from "lucide-react";
import BrainExtractor from "../../components/BrainExtractor";
import AICapabilitiesPanel from "../../components/AICapabilitiesPanel";
import BrandDnaExtractor from "../../components/BrandDnaExtractor";

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
  const [buildingProfile, setBuildingProfile] = useState(false);
  const [profileResult, setProfileResult] = useState<any>(null);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [loadingToken, setLoadingToken] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [reconnectMode, setReconnectMode] = useState(false);
  const [reconnectData, setReconnectData] = useState({ clientId: "", clientSecret: "", shopDomain: "" });
  const [reconnecting, setReconnecting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  const buildBrainProfile = async () => {
    setBuildingProfile(true);
    setProfileResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/intelligence/build-profile`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      setProfileResult(data);
    } catch { /* ignore */ }
    finally { setBuildingProfile(false); }
  };

  const handleAutofill = (data: Record<string, string>) => {
    setFormData(prev => ({ ...prev, ...data }));
  };

  const revealToken = async () => {
    if (revealedToken) { setTokenVisible(!tokenVisible); return; }
    setLoadingToken(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/reveal-token`, { credentials: "include" });
      const data = await res.json();
      if (data.accessToken) { setRevealedToken(data.accessToken); setTokenVisible(true); }
    } catch { /* ignore */ }
    finally { setLoadingToken(false); }
  };

  const copyToken = () => {
    if (!revealedToken) return;
    navigator.clipboard.writeText(revealedToken);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2500);
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/disconnect`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } });
      const data = await res.json();
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        setShowDisconnectConfirm(false);
        setRevealedToken(null);
        setTokenVisible(false);
      } else {
        alert(data.error || "Error al desconectar");
      }
    } catch { alert("Error de red"); }
    finally { setDisconnecting(false); }
  };

  const handleReconnect = async () => {
    if (!reconnectData.clientId || !reconnectData.clientSecret) { alert("Client ID y Client Secret son obligatorios"); return; }
    setReconnecting(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/reconnect`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reconnectData),
      });
      const data = await res.json();
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        setReconnectMode(false);
        setReconnectData({ clientId: "", clientSecret: "", shopDomain: "" });
      } else {
        alert(data.error || "Error al reconectar");
      }
    } catch { alert("Error de red"); }
    finally { setReconnecting(false); }
  };

  const handleDeleteProject = async (mode: "full" | "dissociate") => {
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}?mode=${mode}`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (data.success) {
        if (mode === "dissociate") {
          alert(data.message);
          window.location.reload();
        } else {
          window.location.href = `${API_BASE}/home`;
        }
      } else {
        alert(data.error || "Error al eliminar");
      }
    } catch { alert("Error de red"); }
    finally { setDeleting(false); }
  };

  const isDisconnected = project && !project.clientId;

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
          <h2 className="text-xl font-bold text-foreground">Estado de Conexión</h2>
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
            Renovar Token
          </button>
          {project?.hasAccessToken && (
            <button
              onClick={revealToken}
              disabled={loadingToken}
              className="bg-amber-500/10 border border-amber-500/30 text-amber-400 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-amber-500/20 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {loadingToken ? <RefreshCw className="w-4 h-4 animate-spin" /> : tokenVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {revealedToken ? (tokenVisible ? "Ocultar Token" : "Ver Token") : "Ver Token (SHPAT)"}
            </button>
          )}
        </div>

        {revealedToken && tokenVisible && (
          <div className="mt-4 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-amber-400">Admin API Access Token</p>
              <button
                onClick={copyToken}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${tokenCopied ? "bg-green-500/15 border-green-500/30 text-green-400" : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground"}`}
              >
                <Copy className="w-3 h-3" />
                {tokenCopied ? "¡Copiado!" : "Copiar"}
              </button>
            </div>
            <div className="font-mono text-xs text-green-400 break-all bg-black/20 rounded-lg p-3 leading-relaxed">
              {revealedToken}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Guarda este token de forma segura si tu cliente lo necesita para otras integraciones.</p>
          </div>
        )}

        {testResult && (
          <div className={`mt-4 p-4 rounded-xl text-sm border ${testResult.connected ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
            {testResult.connected ? `Conexión exitosa a ${testResult.storeName}. ${testResult.productCount} productos encontrados.` : `Error de conexión: ${testResult.error}`}
          </div>
        )}
      </GlassCard>

      {/* ── ADN DE MARCA ─────────────────────────────────────────────── */}
      <GlassCard className="p-0 overflow-hidden" style={{ border: "1px solid rgba(212,160,23,0.25)" }}>
        <BrandDnaExtractor
          projectId={projectId}
          initialUrl={project?.shopDomain ? (project.shopDomain.includes("://") ? project.shopDomain : `https://${project.shopDomain}`) : ""}
          projectName={project?.name}
          onDnaReady={(dna) => {
            if (dna.companyInfo?.sector) setFormData(prev => ({ ...prev, storeNiche: dna.companyInfo?.sector ?? prev.storeNiche }));
            if (dna.brandIdentity?.tone) setFormData(prev => ({ ...prev, brandTone: dna.brandIdentity?.tone ?? prev.brandTone }));
            if (dna.targetAudience?.primary) setFormData(prev => ({ ...prev, targetAudience: dna.targetAudience?.primary ?? prev.targetAudience }));
          }}
        />
      </GlassCard>

      <form onSubmit={handleSave}>
        <GlassCard className="p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
            <Key className="w-6 h-6 text-foreground" />
            <h2 className="text-xl font-bold text-foreground">Configuración General e IA</h2>
            <button
              type="button"
              onClick={buildBrainProfile}
              disabled={buildingProfile}
              className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ background: "rgba(212,160,23,0.15)", border: "1px solid rgba(212,160,23,0.35)", color: "var(--gold)" }}
            >
              {buildingProfile ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              {buildingProfile ? "Analizando tienda..." : "Shopy Crafter: Analizar tienda completa"}
            </button>
          </div>

          {profileResult?.profile && (
            <div style={{ marginBottom: 20, padding: "14px 16px", borderRadius: 10, background: "rgba(212,160,23,0.06)", border: "1px solid rgba(212,160,23,0.25)" }}>
              <p style={{ fontSize: 12, color: "var(--gold)", fontFamily: "var(--fb)", marginBottom: 8 }}>Perfil de inteligencia generado para {project?.name}</p>
              {profileResult.profile.executiveSummary && (
                <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5, marginBottom: 8 }}>{profileResult.profile.executiveSummary}</p>
              )}
              {profileResult.profile.revenueOpportunities?.slice(0, 2).map((op: any, i: number) => (
                <div key={i} style={{ fontSize: 11, color: "var(--t3)", padding: "4px 8px", background: "rgba(33,197,94,0.07)", borderRadius: 6, marginBottom: 4 }}>
                  <span style={{ color: "#22c55e" }}>#{i+1}</span> {op.opportunity} — Impacto: {op.estimatedImpact}
                </div>
              ))}
            </div>
          )}
          
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Nombre del Proyecto</label>
              <input 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>

            <AICapabilitiesPanel />

            <div className="space-y-2 pt-4 border-t border-white/5">
              <p className="text-sm font-medium text-foreground">Claves API personalizadas (opcional)</p>
              <p className="text-xs text-muted-foreground">
                Por defecto este proyecto usa las claves globales de Shopy Crafter (ya activas arriba). Solo introduce claves propias si quieres facturar el consumo a tu cuenta personal en Replicate o Anthropic.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">API Token de Replicate (override)</label>
                <input 
                  type="password"
                  value={formData.replicateApiToken}
                  onChange={e => setFormData({...formData, replicateApiToken: e.target.value})}
                  placeholder="Dejar vacío para usar el token del plan"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">API Key de Anthropic Claude (override)</label>
                <input 
                  type="password"
                  value={formData.anthropicApiKey}
                  onChange={e => setFormData({...formData, anthropicApiKey: e.target.value})}
                  placeholder="Dejar vacío para usar la clave del plan"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-white/5">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <p className="text-sm font-medium text-foreground">Contexto IA de la Tienda</p>
                <span style={{ fontSize: 11, color: "var(--gold)" }}>— Shopy Crafter extrae y aprende de cada campo</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Nicho de Tienda</label>
                  <input
                    value={formData.storeNiche}
                    onChange={e => setFormData({...formData, storeNiche: e.target.value})}
                    placeholder="Ej: Streetwear premium"
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary"
                  />
                  {formData.storeNiche.length >= 3 && (
                    <BrainExtractor value={formData.storeNiche} fieldContext="niche" projectId={projectId} onAutofill={handleAutofill} />
                  )}
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
                  {formData.targetAudience.length >= 3 && (
                    <BrainExtractor value={formData.targetAudience} fieldContext="target_audience" projectId={projectId} onAutofill={handleAutofill} />
                  )}
                </div>
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

      {isDisconnected && (
        <GlassCard className="p-6 mt-6" style={{ border: "1px solid rgba(200,168,75,.3)", background: "rgba(200,168,75,.05)" }}>
          <div className="flex items-center gap-3 mb-4">
            <Unplug className="w-5 h-5" style={{ color: "#c8a84b" }} />
            <h3 className="text-lg font-bold" style={{ color: "#c8a84b" }}>Tienda desconectada</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Las credenciales fueron eliminadas. Todo el trabajo generado (imágenes, rediseños, SEO, etc.) se conserva intacto. Para volver a operar con esta tienda, reconecta con nuevas credenciales.
          </p>
          {!reconnectMode ? (
            <button onClick={() => setReconnectMode(true)} className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all">
              <PlugZap className="w-4 h-4" /> Reconectar tienda
            </button>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Dominio de tienda (opcional, mantiene el actual)</label>
                  <input value={reconnectData.shopDomain} onChange={e => setReconnectData({ ...reconnectData, shopDomain: e.target.value })} placeholder={project?.shopDomain || "mi-tienda.myshopify.com"} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Client ID *</label>
                  <input value={reconnectData.clientId} onChange={e => setReconnectData({ ...reconnectData, clientId: e.target.value })} placeholder="Nuevo Client ID" className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground text-sm font-mono" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Client Secret *</label>
                  <input type="password" value={reconnectData.clientSecret} onChange={e => setReconnectData({ ...reconnectData, clientSecret: e.target.value })} placeholder="Nuevo Client Secret" className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground text-sm font-mono" />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={handleReconnect} disabled={reconnecting} className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50">
                  <PlugZap className="w-4 h-4" /> {reconnecting ? "Reconectando..." : "Reconectar"}
                </button>
                <button onClick={() => { setReconnectMode(false); setReconnectData({ clientId: "", clientSecret: "", shopDomain: "" }); }} className="px-6 py-2.5 rounded-xl font-medium text-muted-foreground hover:text-foreground transition-all border border-border">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </GlassCard>
      )}

      <GlassCard className="p-6 mt-6" style={{ border: "1px solid rgba(255,255,255,.06)" }}>
        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-muted-foreground" /> Zona de gestión
        </h3>
        <div className="space-y-4">
          {!isDisconnected && (
            <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: "rgba(200,168,75,.06)", border: "1px solid rgba(200,168,75,.15)" }}>
              <div>
                <p className="font-medium text-foreground text-sm">Desconectar tienda</p>
                <p className="text-xs text-muted-foreground mt-1">Elimina las credenciales pero conserva todo el trabajo generado (imágenes, rediseños, auditorías, SEO, etc.)</p>
              </div>
              {!showDisconnectConfirm ? (
                <button onClick={() => setShowDisconnectConfirm(true)} className="px-5 py-2 rounded-xl font-medium text-sm flex items-center gap-2 transition-all" style={{ border: "1px solid rgba(200,168,75,.4)", color: "#c8a84b" }}>
                  <Unplug className="w-4 h-4" /> Desconectar
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={handleDisconnect} disabled={disconnecting} className="px-4 py-2 rounded-xl font-bold text-sm text-white transition-all" style={{ background: "#c8a84b" }}>
                    {disconnecting ? "..." : "Sí, desconectar"}
                  </button>
                  <button onClick={() => setShowDisconnectConfirm(false)} className="px-4 py-2 rounded-xl font-medium text-sm text-muted-foreground border border-border">
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="p-4 rounded-xl space-y-3" style={{ background: "rgba(232,69,88,.04)", border: "1px solid rgba(232,69,88,.15)" }}>
            <div>
              <p className="font-medium text-foreground text-sm">Gestión del proyecto</p>
              <p className="text-xs text-muted-foreground mt-1">Elige si desasociar la tienda (conservando datos) o eliminar todo permanentemente.</p>
            </div>
            {!showDeleteConfirm ? (
              <button onClick={() => setShowDeleteConfirm(true)} className="px-5 py-2 rounded-xl font-medium text-sm flex items-center gap-2 transition-all" style={{ border: "1px solid rgba(232,69,88,.3)", color: "#e84558" }}>
                <Trash2 className="w-4 h-4" /> Eliminar / Desasociar
              </button>
            ) : (
              <div className="space-y-3 pt-1">
                <div className="p-3 rounded-lg flex items-center justify-between" style={{ background: "rgba(200,168,75,.06)", border: "1px solid rgba(200,168,75,.25)" }}>
                  <div className="flex-1 mr-3">
                    <p className="font-semibold text-sm" style={{ color: "#c8a84b" }}>Desasociar tienda</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Desconecta la tienda pero <strong>conserva</strong> todos tus productos, COGS, SEO, imágenes y datos.</p>
                  </div>
                  <button onClick={() => handleDeleteProject("dissociate")} disabled={deleting} className="px-4 py-2 rounded-xl font-bold text-sm text-white shrink-0 transition-all" style={{ background: "#c8a84b" }}>
                    {deleting ? "..." : "Desasociar"}
                  </button>
                </div>
                <div className="p-3 rounded-lg flex items-center justify-between" style={{ background: "rgba(232,69,88,.06)", border: "1px solid rgba(232,69,88,.25)" }}>
                  <div className="flex-1 mr-3">
                    <p className="font-semibold text-sm" style={{ color: "#e84558" }}>Eliminar todo</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Borra el proyecto <strong>y TODO</strong> su contenido: productos, imágenes, COGS, SEO, vault. Irreversible.</p>
                  </div>
                  <button onClick={() => handleDeleteProject("full")} disabled={deleting} className="px-4 py-2 rounded-xl font-bold text-sm text-white shrink-0 transition-all" style={{ background: "#e84558" }}>
                    {deleting ? "..." : "Eliminar todo"}
                  </button>
                </div>
                <button onClick={() => setShowDeleteConfirm(false)} className="w-full px-4 py-2 rounded-xl font-medium text-sm text-muted-foreground border border-border text-center">
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      <ClientAccessCard projectId={projectId} />
    </div>
  );
}

interface ClientRow { id: string; email: string; name: string | null; isActive: number; lastLogin: string | null; inviteExpires: string | null }

/** Acceso del cliente al portal: invitar, copiar el enlace y renovarlo. */
function ClientAccessCard({ projectId }: { projectId: number }) {
  const API = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    try {
      const r = await fetch(`${API}/api/admin/projects/${projectId}/clients`, { credentials: "include" });
      if (r.ok) { const d = await r.json(); setClients(Array.isArray(d.clients) ? d.clients : []); }
    } catch { /* sin clientes */ }
  };
  useEffect(() => { if (projectId) void load(); }, [projectId]);

  const invite = async () => {
    setBusy(true); setMsg(null); setLink(null);
    try {
      const r = await fetch(`${API}/api/admin/projects/${projectId}/invite`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "No se pudo invitar");
      setLink(d.inviteLink ?? null);
      setMsg({ ok: true, text: d.emailSent ? `Invitación enviada por email a ${email}` : "Enlace generado: cópialo y envíaselo al cliente" });
      setEmail(""); setName("");
      void load();
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Error" }); }
    finally { setBusy(false); }
  };

  const reinvite = async (c: ClientRow) => {
    setName(c.name ?? ""); setEmail(c.email);
    setBusy(true); setMsg(null); setLink(null);
    try {
      const r = await fetch(`${API}/api/admin/projects/${projectId}/invite`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: c.email, name: c.name ?? c.email }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "No se pudo renovar");
      setLink(d.inviteLink ?? null);
      setMsg({ ok: true, text: "Enlace nuevo generado: cópialo y envíaselo al cliente" });
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Error" }); }
    finally { setBusy(false); }
  };

  const copy = async () => { if (link) { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* sin portapapeles */ } } };

  return (
    <GlassCard className="p-6 mt-6">
      <div className="flex items-center gap-2 mb-1">
        <Shield className="w-4 h-4" style={{ color: "#c8a84b" }} />
        <h3 className="text-base font-bold">Acceso del cliente</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Envía al cliente un enlace para que entre a su portal y vea solo este proyecto: informes, imágenes, aprobaciones y mensajes.</p>

      {clients.length > 0 && (
        <div className="mb-4 space-y-2">
          {clients.map(c => (
            <div key={c.id} className="flex items-center justify-between gap-3 p-2 rounded-lg" style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)" }}>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{c.name || c.email}</div>
                <div className="text-xs text-muted-foreground truncate">{c.email} · {c.isActive ? (c.lastLogin ? `último acceso ${new Date(c.lastLogin).toLocaleDateString("es-ES")}` : "activo") : "pendiente de entrar"}</div>
              </div>
              <button onClick={() => void reinvite(c)} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs font-medium shrink-0" style={{ border: "1px solid rgba(255,255,255,.15)" }}>Renovar enlace</button>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-2 md:grid-cols-2 mb-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del cliente" className="px-3 py-2 rounded-lg text-sm" style={{ background: "#0d0d1a", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} />
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@cliente.com" type="email" className="px-3 py-2 rounded-lg text-sm" style={{ background: "#0d0d1a", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} />
      </div>
      <button onClick={() => void invite()} disabled={busy || !email.trim() || !name.trim()} className="px-4 py-2 rounded-xl font-bold text-sm text-black" style={{ background: "#c8a84b" }}>
        {busy ? "..." : "Invitar y generar enlace"}
      </button>

      {msg && <div className="mt-3 text-xs" style={{ color: msg.ok ? "#2dd49f" : "#ef4444" }}>{msg.text}</div>}
      {link && (
        <div className="mt-2 flex items-center gap-2 p-2 rounded-lg" style={{ background: "rgba(200,168,75,.08)", border: "1px solid rgba(200,168,75,.25)" }}>
          <code className="text-xs flex-1 truncate" style={{ color: "#c8a84b" }}>{link}</code>
          <button onClick={() => void copy()} className="px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 flex items-center gap-1" style={{ border: "1px solid rgba(255,255,255,.15)" }}>
            <Copy className="w-3 h-3" />{copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">El enlace caduca en 48 h. El cliente crea su contraseña al abrirlo.</p>
    </GlassCard>
  );
}
