import { useState } from "react";
import { useSafeTimeout } from "./useSafeTimeout";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SaveReportParams {
  projectId: number;
  title: string;
  content: string;
  fileType: string;
  category?: string;
  productId?: string;
  productTitle?: string;
  metadata?: Record<string, unknown>;
}

export function useSaveReport() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const safeTimeout = useSafeTimeout();

  const saveReport = async (params: SaveReportParams) => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${params.projectId}/vault/save-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: params.title,
          content: params.content,
          fileType: params.fileType,
          category: params.category,
          productId: params.productId,
          productTitle: params.productTitle,
          metadata: params.metadata,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error guardando informe");
      }
      setSaved(true);
      safeTimeout(() => setSaved(false), 4000);
      return await res.json();
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const reset = () => { setSaved(false); setError(null); };

  return { saveReport, saving, saved, error, reset };
}
