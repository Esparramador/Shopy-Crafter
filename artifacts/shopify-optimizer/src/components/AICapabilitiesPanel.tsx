import { useEffect, useState, type ReactElement } from "react";
import {
  Brain, Sparkles, Image as ImageIcon, Mic, Video, Store, Mail, Gauge,
  Github, Database, Shield, HardDrive, FileText, Bell, CheckCircle, AlertTriangle,
  ChevronDown, RefreshCw,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CapabilityItem {
  key: string;
  name: string;
  badge: string;
  description: string;
  envVars: string[];
  configured: boolean;
  uses: string[];
}

interface Category {
  id: string;
  name: string;
  icon: string;
  items: CapabilityItem[];
}

interface CapabilitiesResponse {
  summary: { total: number; configured: number; coverage: number };
  categories: Category[];
}

const ITEM_ICON: Record<string, ReactElement> = {
  claude: <Brain size={14} />,
  gemini: <Sparkles size={14} />,
  replicate: <ImageIcon size={14} />,
  elevenlabs: <Mic size={14} />,
  runway: <Video size={14} />,
  shopify: <Store size={14} />,
  klaviyo: <Mail size={14} />,
  "google-mail": <Mail size={14} />,
  pagespeed: <Gauge size={14} />,
  github: <Github size={14} />,
  postgres: <Database size={14} />,
  session: <Shield size={14} />,
  encryption: <Shield size={14} />,
  vapid: <Bell size={14} />,
  "object-storage": <HardDrive size={14} />,
  puppeteer: <FileText size={14} />,
};

export default function AICapabilitiesPanel() {
  const [data, setData] = useState<CapabilitiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/system-capabilities`, { credentials: "include" })
      .then(r => (r.ok ? r.json() : null))
      .then(json => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-muted-foreground">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        Detectando capacidades activas...
      </div>
    );
  }

  if (!data) return null;

  // Sólo mostrar las dos categorías más útiles para un usuario de proyecto
  const aiCat = data.categories.find(c => c.id === "ai");
  const ecomCat = data.categories.find(c => c.id === "ecommerce");
  const perfCat = data.categories.find(c => c.id === "performance");

  const renderCategory = (cat: Category | undefined) => {
    if (!cat) return null;
    return (
      <div key={cat.id} className="mb-3">
        <p className="text-[11px] uppercase tracking-wider font-semibold mb-2" style={{ color: "var(--t4)" }}>
          {cat.name}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(220px, 100%), 1fr))", gap: 8 }}>
          {cat.items.map(item => (
            <div
              key={item.key}
              style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "10px 12px", borderRadius: 10,
                background: item.configured ? "rgba(45,212,159,0.04)" : "rgba(200,168,75,0.04)",
                border: `1px solid ${item.configured ? "rgba(45,212,159,0.18)" : "rgba(200,168,75,0.18)"}`,
              }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                background: item.configured ? "rgba(45,212,159,0.12)" : "rgba(200,168,75,0.12)",
                color: item.configured ? "var(--jade)" : "var(--gold)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {ITEM_ICON[item.key] ?? <Sparkles size={14} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--t)" }}>{item.name}</span>
                  {item.configured ? (
                    <CheckCircle size={11} style={{ color: "var(--jade)" }} />
                  ) : (
                    <AlertTriangle size={11} style={{ color: "var(--gold)" }} />
                  )}
                </div>
                <div style={{ fontSize: 10, color: "var(--t4)", fontFamily: "var(--fm)", marginTop: 1 }}>{item.badge}</div>
                {expanded && (
                  <p style={{ fontSize: 10.5, color: "var(--t3)", lineHeight: 1.45, marginTop: 5 }}>
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="pt-4 border-t border-white/5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: "var(--gold)" }} />
          <p className="text-sm font-medium text-foreground">Motores e integraciones disponibles en tu plan</p>
        </div>
        <div className="flex items-center gap-2">
          <span style={{
            fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 700,
            background: data.summary.coverage >= 90 ? "rgba(45,212,159,0.12)" : "rgba(200,168,75,0.12)",
            color: data.summary.coverage >= 90 ? "var(--jade)" : "var(--gold)",
          }}>
            {data.summary.configured}/{data.summary.total} activas
          </span>
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="text-xs flex items-center gap-1"
            style={{ color: "var(--t3)" }}
          >
            <ChevronDown size={12} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
            {expanded ? "Compacto" : "Detalle"}
          </button>
        </div>
      </div>

      <p className="text-xs mb-3" style={{ color: "var(--t3)" }}>
        Todo este stack está activo automáticamente para este proyecto. No necesitas configurar ninguna clave para usarlas.
      </p>

      {renderCategory(aiCat)}
      {renderCategory(ecomCat)}
      {renderCategory(perfCat)}
    </div>
  );
}
