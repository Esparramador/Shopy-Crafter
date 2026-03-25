import { Save, CheckCircle, Loader2, AlertCircle, FolderOpen } from "lucide-react";
import { useSaveReport } from "../hooks/useSaveReport";

interface SaveReportButtonProps {
  projectId: number;
  title: string;
  buildContent: () => string;
  fileType: string;
  category?: string;
  productId?: string;
  productTitle?: string;
  metadata?: Record<string, unknown>;
  label?: string;
  compact?: boolean;
}

export default function SaveReportButton({
  projectId, title, buildContent, fileType, category,
  productId, productTitle, metadata, label, compact,
}: SaveReportButtonProps) {
  const { saveReport, saving, saved, error } = useSaveReport();

  const handleSave = async () => {
    const content = buildContent();
    await saveReport({ projectId, title, content, fileType, category, productId, productTitle, metadata });
  };

  const btnLabel = label || "Guardar en Repositorio";

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <button
        onClick={handleSave}
        disabled={saving}
        className={compact ? "btn-secondary" : ""}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: compact ? "6px 12px" : "8px 16px",
          borderRadius: 8,
          fontSize: compact ? 11 : 12,
          fontWeight: 600,
          cursor: saving ? "wait" : "pointer",
          border: saved
            ? "1px solid rgba(46,204,113,0.4)"
            : "1px solid rgba(200,168,75,0.3)",
          background: saved
            ? "rgba(46,204,113,0.1)"
            : saving
            ? "rgba(200,168,75,0.05)"
            : "linear-gradient(135deg, rgba(200,168,75,0.12), rgba(45,212,159,0.06))",
          color: saved ? "#2ecc71" : "#c8a84b",
          transition: "all 0.2s",
          fontFamily: "var(--fb)",
        }}
      >
        {saving ? (
          <><Loader2 size={compact ? 12 : 14} style={{ animation: "spin 1s linear infinite" }} /> Guardando...</>
        ) : saved ? (
          <><CheckCircle size={compact ? 12 : 14} /> Guardado en Repositorio</>
        ) : (
          <><FolderOpen size={compact ? 12 : 14} /> {btnLabel}</>
        )}
      </button>
      {error && (
        <span style={{ fontSize: 10, color: "#e84558", display: "flex", alignItems: "center", gap: 4 }}>
          <AlertCircle size={10} /> {error}
        </span>
      )}
    </div>
  );
}
