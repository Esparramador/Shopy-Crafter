import { useState } from "react";
import { Check, Loader2, Archive } from "lucide-react";
import { useSafeTimeout } from "@/hooks/useSafeTimeout";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SaveToVaultButtonProps {
  title: string;
  content: string;
  fileType: string;
  category?: string;
  entityName?: string;
  entityUrl?: string;
  projectId?: number | string;
  productId?: string;
  productTitle?: string;
  generatedBy?: string;
  metadata?: Record<string, unknown>;
  variant?: "button" | "icon" | "small";
  label?: string;
}

export default function SaveToVaultButton({
  title, content, fileType, category, entityName, entityUrl,
  projectId, productId, productTitle, generatedBy, metadata,
  variant = "button", label = "Guardar en Bóveda",
}: SaveToVaultButtonProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const safeTimeout = useSafeTimeout();

  const handleSave = async () => {
    if (saving || saved) return;
    setSaving(true);
    setError(null);

    try {
      const url = projectId
        ? `${API_BASE}/api/projects/${projectId}/vault/save-report`
        : `${API_BASE}/api/vault/global/save`;

      const body: Record<string, unknown> = {
        title, content, fileType,
        category: category || null,
        generatedBy: generatedBy || "tool_save",
        metadata: metadata || null,
      };

      if (projectId) {
        body.projectId = projectId;
      } else {
        body.entityName = entityName || "General";
        body.entityUrl = entityUrl || null;
      }

      if (productId) body.productId = productId;
      if (productTitle) body.productTitle = productTitle;

      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setSaved(true);
        safeTimeout(() => setSaved(false), 4000);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Error al guardar");
        safeTimeout(() => setError(null), 3000);
      }
    } catch {
      setError("Error de conexión");
      safeTimeout(() => setError(null), 3000);
    }
    setSaving(false);
  };

  if (variant === "icon") {
    return (
      <button
        onClick={handleSave}
        disabled={saving}
        title={saved ? "Guardado" : error ? error : label}
        style={{
          background: saved ? "rgba(46,204,113,0.15)" : error ? "rgba(232,69,88,0.1)" : "rgba(200,168,75,0.1)",
          border: `1px solid ${saved ? "rgba(46,204,113,0.3)" : error ? "rgba(232,69,88,0.2)" : "rgba(200,168,75,0.2)"}`,
          borderRadius: 8, padding: 7, cursor: saving ? "wait" : "pointer",
          color: saved ? "#2ecc71" : error ? "#e84558" : "#c8a84b",
          transition: "all 0.2s",
        }}
      >
        {saving ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
          : saved ? <Check size={15} />
          : <Archive size={15} />}
      </button>
    );
  }

  if (variant === "small") {
    return (
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          background: saved ? "rgba(46,204,113,0.12)" : "rgba(200,168,75,0.08)",
          border: `1px solid ${saved ? "rgba(46,204,113,0.2)" : "rgba(200,168,75,0.15)"}`,
          borderRadius: 8, padding: "5px 12px", cursor: saving ? "wait" : "pointer",
          color: saved ? "#2ecc71" : "#c8a84b", fontSize: 12, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 5, transition: "all 0.2s",
        }}
      >
        {saving ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
          : saved ? <Check size={13} />
          : <Archive size={13} />}
        {saved ? "Guardado" : error ? error : label}
      </button>
    );
  }

  return (
    <button
      onClick={handleSave}
      disabled={saving}
      style={{
        background: saved ? "rgba(46,204,113,0.12)" : error ? "rgba(232,69,88,0.08)" : "rgba(200,168,75,0.08)",
        border: `1px solid ${saved ? "rgba(46,204,113,0.25)" : error ? "rgba(232,69,88,0.2)" : "rgba(200,168,75,0.2)"}`,
        borderRadius: 10, padding: "10px 18px", cursor: saving ? "wait" : "pointer",
        color: saved ? "#2ecc71" : error ? "#e84558" : "#c8a84b",
        fontSize: 14, fontWeight: 600,
        display: "flex", alignItems: "center", gap: 8,
        transition: "all 0.2s",
      }}
    >
      {saving ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
        : saved ? <Check size={16} />
        : <Archive size={16} />}
      {saved ? "Guardado en Bóveda" : error ? error : label}
    </button>
  );
}
