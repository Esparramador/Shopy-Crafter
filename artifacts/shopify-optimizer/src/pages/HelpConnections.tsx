import { useLocation } from "wouter";
import { ArrowLeft, HelpCircle } from "lucide-react";
import { ConnectionGuideTabs } from "../components/ConnectionGuide";
import { useCmsSection } from "@/contexts/CmsContext";

export default function HelpConnections() {
  const [, setLocation] = useLocation();
  const { t } = useCmsSection("labels.connectionGuides");

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", paddingBottom: 40 }}>
      <div style={{ marginBottom: 28 }}>
        <button
          onClick={() => setLocation("/")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--t3)",
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 13,
            marginBottom: 16,
            padding: 0,
          }}
        >
          <ArrowLeft size={14} /> {t("backToDashboard", "Volver al dashboard")}
        </button>
        <div className="section-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <HelpCircle size={24} style={{ color: "#c9a84c" }} />
            <h1 className="section-title" style={{ margin: 0 }}>
              {t("helpTitle", "Guías de Conexión")}
            </h1>
          </div>
          <p className="section-subtitle">
            {t("helpSubtitle", "Instrucciones paso a paso para conectar tu tienda con Shopy Crafter. Selecciona tu plataforma para ver la guía completa.")}
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: "24px 28px" }}>
        <ConnectionGuideTabs />
      </div>
    </div>
  );
}
