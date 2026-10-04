import { useQuery } from "@tanstack/react-query";

const API_ROOT = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

export interface JobStatus {
  status?: "running" | "completed" | "failed" | "pending" | string;
  completed?: number;
  failed?: number;
  total?: number;
  progress?: number;
  log?: string[];
  [key: string]: unknown;
}

/**
 * Estado de un trabajo en segundo plano. Hay dos tipos de id:
 *  - numérico → generación individual (generation_jobs)
 *  - UUID     → trabajo masivo (bulk_jobs: rediseño masivo, boost de imágenes…)
 * Antes los masivos se consultaban en generation_jobs, daban 404 y el progreso
 * no terminaba nunca.
 */
export function useJobStatus(projectId: number, jobId: string) {
  const isGeneration = /^\d+$/.test(jobId);
  const url = isGeneration
    ? `${API_ROOT}/projects/${projectId}/generation-jobs/${jobId}`
    : `${API_ROOT}/projects/${projectId}/jobs/${encodeURIComponent(jobId)}`;
  return useQuery<JobStatus>({
    queryKey: ["job-status", projectId, jobId],
    queryFn: async () => {
      const r = await fetch(url, { credentials: "include" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as { error?: string }).error ?? `HTTP ${r.status}`);
      return d as JobStatus;
    },
    enabled: projectId > 0 && !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "completed" || status === "failed" || query.state.status === "error") return false;
      return 2000;
    },
  });
}
