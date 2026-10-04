import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Loader2, AlertTriangle } from "lucide-react";
import ABTestingModule from "./ab-testing/ABTesting";

const API_ROOT_URL = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

export default function ABTestingPage() {
  const [, params] = useRoute("/projects/:id/ab-testing");
  const routeProjectId = params?.id ? parseInt(params.id, 10) : null;
  const [projects, setProjects] = useState<Array<{ id: number }> | null>(null);
  const [isLoading, setIsLoading] = useState(routeProjectId == null);

  useEffect(() => {
    if (routeProjectId != null && !Number.isNaN(routeProjectId)) return;
    let cancelled = false;
    setIsLoading(true);
    fetch(`${API_ROOT_URL}/projects`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (!cancelled) setProjects(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setProjects([]); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [routeProjectId]);

  if (routeProjectId != null && !Number.isNaN(routeProjectId)) {
    return <ABTestingModule projectId={routeProjectId} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Cargando proyectos...</span>
        </div>
      </div>
    );
  }

  const firstProjectId = Array.isArray(projects) && projects.length > 0
    ? (projects[0] as { id: number }).id
    : null;

  if (firstProjectId != null) {
    return <ABTestingModule projectId={firstProjectId} />;
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-slate-950 p-8">
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-6 max-w-md text-center">
        <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
        <p className="text-amber-300 font-medium mb-1">No hay proyectos disponibles</p>
        <p className="text-amber-400 text-sm">
          Crea un proyecto Shopify primero para acceder al módulo de A/B Testing.
        </p>
      </div>
    </div>
  );
}
