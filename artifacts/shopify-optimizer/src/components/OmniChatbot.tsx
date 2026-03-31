/**
 * Shopy Crafter — Asistente Inteligente
 * Absorbe TODO: imágenes, vídeos, URLs, Instagram, Facebook, X, YouTube...
 */
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Brain, X, Send, Loader2, Minimize2, Maximize2, Sparkles, ChevronDown,
  Link, Image, Video, Upload, Eye, Palette, Layers, Cpu, Globe,
  Instagram, Twitter, Facebook, Youtube, CheckCircle, ZapIcon, HelpCircle, Mic, MicOff
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  model?: string;
  attachmentType?: "image" | "video" | "url";
  attachmentName?: string;
  action?: ChatAction;
}

interface ChatAction {
  type: "klaviyo-workflow" | "absorb-result" | "entity-research" | "shopify-action" | "supplier-research";
  label: string;
  data: unknown;
  actionName?: string;
  formattedContent?: string;
}

interface EntityResearchResult {
  success: boolean;
  researchId: string;
  entity: string;
  entityUrl?: string;
  handles?: Record<string, string>;
  profile: {
    entityType?: string;
    description?: string;
    socialProfiles?: Record<string, string>;
    socialMetrics?: Record<string, unknown>;
    products?: Array<{ name: string; category: string; priceRange: string; keyFeature: string }>;
    pricing?: { strategy?: string; avgTicket?: string; priceRange?: string; discountBehavior?: string };
    ecommerceStack?: { platform: string; emailTool: string };
    marketingChannels?: string[];
    sentiment?: { overall: string; topCompliments: string[]; topComplaints: string[] };
    competitors?: Array<{ name: string; url: string; advantage: string }>;
    differentiators?: string[];
    visualIdentity?: { primaryColors: string[]; style: string };
    shopifyOpportunities?: string[];
    klaviyoOpportunities?: string[];
    confidenceLevel?: string;
  };
  sourcesFound: number;
  queriesExecuted: number;
  memoriesSaved: number;
  allSources: string[];
  allQueries: string[];
  elapsed: string;
  message: string;
}

interface AbsorbResult {
  success: boolean;
  sourceType: string;
  title: string;
  analysis: Record<string, unknown>;
  highlights?: Record<string, unknown>;
  message: string;
  memoryId?: string;
}

interface KlaviyoWorkflowResult {
  plan: {
    storeName: string;
    shopDomain: string;
    flows: Array<{
      id: string; name: string; trigger: string; description: string;
      priority: string; estimated_revenue: string;
      emails: Array<{ position: number; delay: string; subject: string; preview_text: string; html_body: string; purpose: string; key_cta: string }>;
    }>;
    segments: Array<{ name: string; definition: string; use_case: string }>;
    expected_revenue_impact: string;
    implementation_order: string[];
  };
  marketIntel: { topFlows: string[]; avgCartValue: string; conversionTips: string[] };
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function uuid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function classifyUrl(url: string): { type: string; icon: React.ReactNode; label: string } {
  const u = url.toLowerCase();
  if (u.includes("instagram.com")) return { type: "social_instagram", icon: <Instagram size={12} />, label: "Instagram" };
  if (u.includes("facebook.com") || u.includes("fb.com")) return { type: "social_facebook", icon: <Facebook size={12} />, label: "Facebook" };
  if (u.includes("twitter.com") || u.includes("x.com")) return { type: "social_x", icon: <Twitter size={12} />, label: "X / Twitter" };
  if (u.includes("youtube.com") || u.includes("youtu.be")) return { type: "youtube", icon: <Youtube size={12} />, label: "YouTube" };
  return { type: "url", icon: <Globe size={12} />, label: "Web URL" };
}

function formatMessage(content: string): React.ReactNode {
  return content.split(/(\*\*[^*]+\*\*|`[^`]+`|\n)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} style={{ color: "var(--gold)", fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} style={{ background: "var(--ink3)", padding: "1px 5px", borderRadius: 4, fontSize: 11, fontFamily: "monospace", color: "var(--jade)" }}>{part.slice(1, -1)}</code>;
    if (part === "\n") return <br key={i} />;
    return part;
  });
}

function createSpeechRecognition(): any | null {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) return null;
  const recognition = new SR();
  recognition.lang = "es-ES";
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  return recognition;
}

// ─── ACTION BUTTONS (ENVIAR / GUARDAR / DESCARGAR) ───────────────────────────
const FULL_AUDIT_ACTIONS = new Set([
  "audit_store", "full_audit", "scan_store", "complete_audit",
  "bulk_optimize", "setup_store", "analyze_external_store",
]);

const PRODUCT_LIST_ACTIONS = new Set([
  "list_products", "list_all_products", "search_product", "audit_store",
  "scan_store", "full_audit", "complete_audit", "optimize_product",
  "redesign_product", "bulk_optimize", "analyze_external_store",
]);

interface ProductCardItem {
  title: string;
  status?: string;
  price?: string;
  compareAtPrice?: string | null;
  imageUrl?: string | null;
  imageCount?: number;
  variantCount?: number;
  descriptionLength?: number;
  descLength?: number;
  tagsCount?: number;
  auditScore?: number;
  score?: number;
  auditGrade?: string;
  grade?: string;
  hasComparePrice?: boolean;
  hasCompare?: boolean;
  published?: boolean;
  issues?: string[];
}

function ProductCardsGrid({ products }: { products: ProductCardItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? products : products.slice(0, 4);

  const gradeColor = (g: string) =>
    g === "A" ? "#34d399" : g === "B" ? "#c8a84b" : g === "C" ? "#f59e0b" : "#f43f5e";
  const gradeBg = (g: string) =>
    g === "A" ? "rgba(52,211,153,.1)" : g === "B" ? "rgba(200,168,75,.1)" : g === "C" ? "rgba(245,158,11,.1)" : "rgba(244,63,94,.1)";
  const checkOrWarn = (ok: boolean) =>
    ok ? <span style={{ color: "#34d399", fontSize: 10 }}>&#10003;</span> : <span style={{ color: "#f59e0b", fontSize: 10 }}>&#9888;</span>;

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {visible.map((p, i) => {
          const grade = p.auditGrade || p.grade || "D";
          const score = p.auditScore ?? p.score ?? 0;
          const imgCount = p.imageCount ?? 0;
          const descLen = p.descriptionLength ?? p.descLength ?? 0;
          const tags = p.tagsCount ?? 0;
          const variants = p.variantCount ?? 1;
          const hasCompare = p.hasComparePrice ?? p.hasCompare ?? false;
          const price = parseFloat(p.price || "0");

          return (
            <div key={i} style={{
              background: "var(--ink2)", border: "1px solid var(--ink3)", borderRadius: 10,
              overflow: "hidden", position: "relative",
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${gradeColor(grade)}66, transparent)` }} />
              <div style={{ display: "flex", gap: 8, padding: 8 }}>
                {p.imageUrl ? (
                  <div style={{ width: 48, height: 48, borderRadius: 6, overflow: "hidden", flexShrink: 0, background: "var(--ink3)", border: "1px solid var(--ink3)" }}>
                    <img src={p.imageUrl} alt={p.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 6, flexShrink: 0, background: "var(--ink3)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t4)", fontSize: 18 }}>&#128247;</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--t1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <span style={{
                      display: "inline-block", padding: "1px 5px", borderRadius: 4,
                      fontSize: 9, fontWeight: 800, color: gradeColor(grade),
                      background: gradeBg(grade), border: `1px solid ${gradeColor(grade)}33`,
                    }}>{grade}</span>
                    <span style={{ fontSize: 9, color: "var(--t4)" }}>{score}/100</span>
                    {price > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: "var(--t2)" }}>{price.toFixed(2)}€</span>}
                    {p.compareAtPrice && <span style={{ fontSize: 8, color: "var(--t4)", textDecoration: "line-through" }}>{parseFloat(p.compareAtPrice).toFixed(2)}€</span>}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "0 8px 6px", fontSize: 9, color: "var(--t3)" }}>
                <span>{checkOrWarn(imgCount >= 3)} {imgCount}img</span>
                <span>{checkOrWarn(descLen >= 500)} {descLen}ch</span>
                <span>{checkOrWarn(tags >= 10)} {tags}tags</span>
                <span>{checkOrWarn(hasCompare)} cmp</span>
                <span>{variants}var</span>
                {p.published === false && <span style={{ color: "#f43f5e", fontWeight: 700 }}>NO PUB</span>}
              </div>
              {p.issues && p.issues.length > 0 && (
                <div style={{ padding: "0 8px 6px", fontSize: 8, color: "#f59e0b" }}>
                  ⚠ {p.issues.slice(0, 2).join(" · ")}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {products.length > 4 && (
        <button onClick={() => setExpanded(!expanded)} style={{
          display: "block", width: "100%", marginTop: 6, padding: "4px 0",
          background: "var(--ink3)", border: "1px solid var(--ink3)", borderRadius: 6,
          color: "var(--t3)", fontSize: 9, cursor: "pointer", textAlign: "center",
        }}>
          {expanded ? "Mostrar menos" : `Ver ${products.length - 4} productos más`}
        </button>
      )}
    </div>
  );
}

function extractProductsFromAction(actionName: string, data: unknown): ProductCardItem[] | null {
  if (!PRODUCT_LIST_ACTIONS.has(actionName) || !data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const products = d.products as ProductCardItem[] | undefined;
  if (products && Array.isArray(products) && products.length > 0) return products;
  if (d.title && typeof d.title === "string" && (d.auditScore !== undefined || d.score !== undefined || d.auditGrade !== undefined || d.grade !== undefined)) {
    return [d as unknown as ProductCardItem];
  }
  return null;
}

function ActionButtons({ actionName, content, rawData, isMobile }: {
  actionName: string; content: string; rawData: unknown; isMobile: boolean;
}) {
  const [sendState, setSendState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [saveState, setSaveState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [dlState, setDlState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const projectId = 2;

  const actionTitle = actionName.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const isFullAudit = FULL_AUDIT_ACTIONS.has(actionName);

  const handleSend = async () => {
    setSendState("loading");
    try {
      const res = await fetch(`${API}/api/projects/${projectId}/actions/send`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionName, title: actionTitle, content, rawData }),
      });
      if (res.ok) setSendState("done");
      else setSendState("error");
    } catch { setSendState("error"); }
    setTimeout(() => setSendState("idle"), 3000);
  };

  const handleSave = async () => {
    setSaveState("loading");
    try {
      const res = await fetch(`${API}/api/projects/${projectId}/actions/save`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionName, title: actionTitle, content, rawData }),
      });
      if (res.ok) setSaveState("done");
      else setSaveState("error");
    } catch { setSaveState("error"); }
    setTimeout(() => setSaveState("idle"), 3000);
  };

  const handleDownload = async () => {
    setDlState("loading");
    try {
      const downloadType = isFullAudit ? "zip" : undefined;
      const res = await fetch(`${API}/api/projects/${projectId}/actions/download`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionName, title: actionTitle, content, rawData, downloadType }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const ext = isFullAudit ? "zip" : "html";
        a.download = `${actionName}_${new Date().toISOString().split("T")[0]}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        setDlState("done");
      } else { setDlState("error"); }
    } catch { setDlState("error"); }
    setTimeout(() => setDlState("idle"), 3000);
  };

  const btnBase: React.CSSProperties = {
    flex: 1, padding: isMobile ? "7px 8px" : "6px 10px",
    borderRadius: 7, fontSize: isMobile ? 11 : 10, fontWeight: 600,
    cursor: "pointer", display: "flex", alignItems: "center",
    justifyContent: "center", gap: 4, transition: "all .15s",
    border: "1px solid", minWidth: 0,
  };

  const stateIcon = (s: string) =>
    s === "loading" ? "⏳" : s === "done" ? "✅" : s === "error" ? "❌" : null;

  return (
    <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
      <button
        onClick={handleSend} disabled={sendState === "loading"}
        style={{ ...btnBase, background: "rgba(59,130,246,0.08)", borderColor: "rgba(59,130,246,0.25)", color: "#60a5fa" }}
      >
        {stateIcon(sendState) || "📧"} {sendState === "loading" ? "Enviando..." : sendState === "done" ? "Enviado" : "Enviar"}
      </button>
      <button
        onClick={handleSave} disabled={saveState === "loading"}
        style={{ ...btnBase, background: "rgba(52,211,153,0.08)", borderColor: "rgba(52,211,153,0.25)", color: "#34d399" }}
      >
        {stateIcon(saveState) || "💾"} {saveState === "loading" ? "Guardando..." : saveState === "done" ? "Guardado" : "Guardar"}
      </button>
      <button
        onClick={handleDownload} disabled={dlState === "loading"}
        style={{ ...btnBase, background: "rgba(200,168,75,0.08)", borderColor: "rgba(200,168,75,0.25)", color: "#c8a84b" }}
      >
        {stateIcon(dlState) || "📥"} {dlState === "loading" ? "Preparando..." : dlState === "done" ? "Descargado" : isFullAudit ? "Descargar ZIP" : "Descargar"}
      </button>
    </div>
  );
}

// ─── ABSORB RESULT CARD ───────────────────────────────────────────────────────
function AbsorbResultCard({ data }: { data: AbsorbResult }) {
  const [expanded, setExpanded] = useState(false);
  const a = data.analysis as Record<string, unknown>;

  const sections = [
    { key: "visual_composition", label: "Composición Visual", icon: <Eye size={10} /> },
    { key: "colors_palette", label: "Paleta de Colores", icon: <Palette size={10} /> },
    { key: "textures_surfaces", label: "Texturas & Superficies", icon: <Layers size={10} /> },
    { key: "topology_geometry", label: "Topología & Geometría", icon: <Layers size={10} /> },
    { key: "rendering_production", label: "Rendering & Producción", icon: <Cpu size={10} /> },
    { key: "technical_chemical_composition", label: "Composición Técnica/Química", icon: <Cpu size={10} /> },
    { key: "brand_marketing_intelligence", label: "Inteligencia de Marca", icon: <ZapIcon size={10} /> },
    { key: "ecommerce_conversion_signals", label: "Señales eCommerce", icon: <ZapIcon size={10} /> },
    { key: "actionable_insights_for_shopify", label: "Insights Shopify", icon: <Brain size={10} /> },
  ].filter(s => a[s.key]);

  return (
    <div style={{ marginTop: 10, border: "1px solid rgba(45,212,159,0.25)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ background: "rgba(45,212,159,0.06)", padding: "10px 13px", borderBottom: "1px solid rgba(45,212,159,0.15)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--jade)" }}>
            🧠 Absorbido a Shopy Crafter
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 9, color: "var(--t3)" }}>{data.title} · {data.sourceType}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <CheckCircle size={14} style={{ color: "var(--jade)" }} />
          <button onClick={() => setExpanded(!expanded)}
            style={{ background: "var(--ink3)", border: "none", color: "var(--t3)", cursor: "pointer", fontSize: 9, padding: "2px 6px", borderRadius: 4 }}>
            {expanded ? "Ocultar" : `Ver análisis (${sections.length} dimensiones)`}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: 10 }}>
          {sections.map(section => {
            const value = a[section.key];
            const display = typeof value === "string" ? value : JSON.stringify(value, null, 2);
            return (
              <div key={section.key} style={{ marginBottom: 8, padding: "7px 10px", background: "var(--ink2)", borderRadius: 6, border: "1px solid var(--ink3)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4, color: "var(--gold)" }}>
                  {section.icon}
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>{section.label}</span>
                </div>
                <pre style={{ margin: 0, fontSize: 9, color: "var(--t3)", whiteSpace: "pre-wrap", lineHeight: 1.5, fontFamily: "monospace", maxHeight: 120, overflowY: "auto" }}>
                  {display.slice(0, 600)}
                </pre>
              </div>
            );
          })}
          {!!(data.highlights?.marketingAngles) && (
            <div style={{ padding: "7px 10px", background: "rgba(200,168,75,0.06)", borderRadius: 6, border: "1px solid rgba(200,168,75,0.2)" }}>
              <p style={{ margin: "0 0 4px", fontSize: 9, fontWeight: 700, color: "var(--gold)", textTransform: "uppercase" }}>💡 Marketing Angles</p>
              {(Array.isArray(data.highlights.marketingAngles) ? data.highlights.marketingAngles : [data.highlights.marketingAngles]).map((angle, i) => (
                <p key={i} style={{ margin: "2px 0", fontSize: 10, color: "var(--t2)" }}>· {String(angle)}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ENTITY RESEARCH CARD ─────────────────────────────────────────────────────
function EntityResearchCard({ data }: { data: EntityResearchResult }) {
  const [tab, setTab] = useState<"overview" | "social" | "products" | "competitors" | "pricing" | "opportunities" | "sources">("overview");
  const p = data.profile;

  const tabs = [
    { id: "overview",      label: "📊 Overview" },
    { id: "social",        label: "📱 Social" },
    { id: "products",      label: "🛍️ Productos" },
    { id: "competitors",   label: "⚔️ Competencia" },
    { id: "pricing",       label: "💰 Pricing & Ads" },
    { id: "opportunities", label: "🚀 Oportunidades" },
    { id: "sources",       label: `🔗 Fuentes (${data.sourcesFound})` },
  ] as const;

  const sentimentColor = p.sentiment?.overall === "positive" ? "var(--jade)" : p.sentiment?.overall === "negative" ? "#ff6b6b" : "var(--gold)";

  return (
    <div style={{ marginTop: 10, border: "1px solid rgba(200,168,75,0.35)", borderRadius: 12, overflow: "hidden", fontSize: 10 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, rgba(200,168,75,0.12), rgba(200,168,75,0.04))", padding: "10px 12px", borderBottom: "1px solid rgba(200,168,75,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "var(--gold)" }}>🔬 {data.entity}</p>
            <p style={{ margin: "2px 0 0", fontSize: 9, color: "var(--t3)" }}>
              {p.entityType} · {p.ecommerceStack?.platform ?? "Plataforma desconocida"} · {p.ecommerceStack?.emailTool ?? ""}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 9, color: "var(--jade)", fontWeight: 700 }}>{data.queriesExecuted ?? 12} búsquedas · {(data as any).dimensionsResearched ?? 12} dimensiones</p>
            <p style={{ margin: "1px 0 0", fontSize: 9, color: "var(--t4)" }}>{data.sourcesFound} fuentes · {data.elapsed}</p>
          </div>
        </div>
        {p.description && (
          <p style={{ margin: "6px 0 0", fontSize: 10, color: "var(--t2)", lineHeight: 1.4 }}>{p.description}</p>
        )}
        {/* Stats row */}
        <div style={{ display: "flex", gap: 8, marginTop: 7, flexWrap: "wrap" }}>
          {p.pricing?.strategy && (
            <span style={{ padding: "2px 7px", background: "rgba(200,168,75,0.1)", border: "1px solid rgba(200,168,75,0.25)", borderRadius: 20, color: "var(--gold)", fontSize: 9, fontWeight: 700 }}>
              {p.pricing.strategy} · {p.pricing.avgTicket}
            </span>
          )}
          {p.sentiment?.overall && (
            <span style={{ padding: "2px 7px", background: `rgba(0,0,0,0.2)`, border: `1px solid ${sentimentColor}`, borderRadius: 20, color: sentimentColor, fontSize: 9, fontWeight: 700 }}>
              {p.sentiment.overall === "positive" ? "😊" : p.sentiment.overall === "negative" ? "😠" : "😐"} sentimiento {p.sentiment.overall}
            </span>
          )}
          {p.confidenceLevel && (
            <span style={{ padding: "2px 7px", background: "rgba(45,212,159,0.06)", border: "1px solid rgba(45,212,159,0.2)", borderRadius: 20, color: "var(--jade)", fontSize: 9 }}>
              confianza: {p.confidenceLevel}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", overflowX: "auto", borderBottom: "1px solid var(--ink3)", background: "var(--ink2)" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
            style={{ flexShrink: 0, padding: "6px 10px", background: "none", border: "none", cursor: "pointer", fontSize: 9, fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? "var(--gold)" : "var(--t3)", borderBottom: tab === t.id ? "2px solid var(--gold)" : "2px solid transparent", transition: "0.15s" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ padding: 10, maxHeight: 260, overflowY: "auto" }}>
        {tab === "overview" && (
          <div>
            {p.differentiators && p.differentiators.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <p style={{ margin: "0 0 4px", fontWeight: 700, color: "var(--gold)", fontSize: 9, textTransform: "uppercase" }}>Diferenciadores clave</p>
                {p.differentiators.slice(0, 5).map((d, i) => <p key={i} style={{ margin: "2px 0", color: "var(--t2)" }}>· {d}</p>)}
              </div>
            )}
            {p.marketingChannels && p.marketingChannels.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <p style={{ margin: "0 0 4px", fontWeight: 700, color: "var(--gold)", fontSize: 9, textTransform: "uppercase" }}>Canales de marketing</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {p.marketingChannels.map((c, i) => <span key={i} style={{ padding: "1px 6px", background: "var(--ink3)", borderRadius: 3, color: "var(--t3)" }}>{c}</span>)}
                </div>
              </div>
            )}
            {p.visualIdentity && (
              <div>
                <p style={{ margin: "0 0 4px", fontWeight: 700, color: "var(--gold)", fontSize: 9, textTransform: "uppercase" }}>Identidad visual</p>
                <p style={{ margin: 0, color: "var(--t2)" }}>{p.visualIdentity.style}</p>
                {p.visualIdentity.primaryColors?.length > 0 && (
                  <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                    {p.visualIdentity.primaryColors.slice(0, 6).map((c, i) => <span key={i} style={{ padding: "2px 6px", background: "var(--ink3)", borderRadius: 3, fontSize: 9, color: "var(--t2)" }}>{c}</span>)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "social" && (
          <div>
            {p.socialProfiles && Object.entries(p.socialProfiles).filter(([, v]) => v && v !== "N/A" && v !== "Unknown").map(([platform, url]) => (
              <div key={platform} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid var(--ink3)" }}>
                <span style={{ color: "var(--gold)", fontWeight: 700, textTransform: "capitalize" }}>📲 {platform}</span>
                <a href={url.startsWith("http") ? url : `https://${url}`} target="_blank" rel="noreferrer" style={{ color: "var(--jade)", fontSize: 9, textDecoration: "none", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</a>
              </div>
            ))}
            {p.socialMetrics && (
              <div style={{ marginTop: 8 }}>
                {Object.entries(p.socialMetrics).filter(([, v]) => v && v !== "Unknown").map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid var(--ink3)" }}>
                    <span style={{ color: "var(--t3)", textTransform: "capitalize" }}>{k.replace(/([A-Z])/g, " $1").toLowerCase()}</span>
                    <span style={{ color: "var(--t2)", fontWeight: 600 }}>{typeof v === "object" ? JSON.stringify(v).slice(0, 60) : String(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "products" && (
          <div>
            {p.products && p.products.length > 0 ? p.products.map((prod, i) => (
              <div key={i} style={{ padding: "6px 8px", background: "var(--ink2)", borderRadius: 6, marginBottom: 5, border: "1px solid var(--ink3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 700, color: "var(--t)" }}>{prod.name}</span>
                  <span style={{ color: "var(--gold)", fontSize: 9 }}>{prod.priceRange}</span>
                </div>
                <p style={{ margin: "2px 0 0", color: "var(--t3)", fontSize: 9 }}>{prod.category} · {prod.keyFeature}</p>
              </div>
            )) : <p style={{ color: "var(--t4)" }}>No se encontraron productos específicos.</p>}
          </div>
        )}

        {tab === "competitors" && (
          <div>
            {p.competitors && p.competitors.length > 0 ? p.competitors.map((comp, i) => (
              <div key={i} style={{ padding: "6px 8px", background: "var(--ink2)", borderRadius: 6, marginBottom: 5, border: "1px solid var(--ink3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 700, color: "var(--t)" }}>⚔️ {comp.name}</span>
                  {comp.url && <a href={comp.url} target="_blank" rel="noreferrer" style={{ fontSize: 9, color: "var(--jade)", textDecoration: "none" }}>ver →</a>}
                </div>
                {comp.advantage && <p style={{ margin: "2px 0 0", color: "var(--t3)", fontSize: 9 }}>ventaja: {comp.advantage}</p>}
              </div>
            )) : <p style={{ color: "var(--t4)" }}>No se identificaron competidores.</p>}
            {p.sentiment && (
              <div style={{ marginTop: 8, padding: "7px 10px", background: "rgba(45,212,159,0.05)", borderRadius: 6, border: "1px solid rgba(45,212,159,0.15)" }}>
                <p style={{ margin: "0 0 5px", fontWeight: 700, color: "var(--jade)", textTransform: "uppercase", fontSize: 9 }}>💬 Sentimiento clientes</p>
                {p.sentiment.topCompliments?.slice(0, 3).map((c, i) => <p key={i} style={{ margin: "2px 0", color: "var(--t2)", fontSize: 9 }}>✅ {c}</p>)}
                {p.sentiment.topComplaints?.slice(0, 3).map((c, i) => <p key={i} style={{ margin: "2px 0", color: "#ff6b6b", fontSize: 9 }}>⚠️ {c}</p>)}
              </div>
            )}
          </div>
        )}

        {tab === "pricing" && (
          <div>
            {/* Pricing strategy from profile */}
            {p.pricing && (
              <div style={{ marginBottom: 8, padding: "7px 10px", background: "rgba(200,168,75,0.06)", borderRadius: 6, border: "1px solid rgba(200,168,75,0.2)" }}>
                <p style={{ margin: "0 0 4px", fontWeight: 700, color: "var(--gold)", fontSize: 9, textTransform: "uppercase" }}>💰 Estrategia de precios</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {p.pricing.strategy && <span style={{ fontSize: 9, color: "var(--t2)" }}>Estrategia: <b>{p.pricing.strategy}</b></span>}
                  {p.pricing.avgTicket && <span style={{ fontSize: 9, color: "var(--t2)" }}>Ticket medio: <b style={{ color: "var(--gold)" }}>{p.pricing.avgTicket}</b></span>}
                  {p.pricing.priceRange && <span style={{ fontSize: 9, color: "var(--t2)" }}>Rango: <b>{p.pricing.priceRange}</b></span>}
                </div>
                {p.pricing.discountBehavior && <p style={{ margin: "4px 0 0", fontSize: 9, color: "var(--t3)" }}>Descuentos: {p.pricing.discountBehavior}</p>}
              </div>
            )}
            {/* Paid ads from raw research */}
            {(data as any).research?.paidAds && (
              <div style={{ marginBottom: 8 }}>
                <p style={{ margin: "0 0 4px", fontWeight: 700, color: "#ff7eb3", fontSize: 9, textTransform: "uppercase" }}>📢 Paid Ads / Facebook Ads Library</p>
                <p style={{ margin: 0, fontSize: 9, color: "var(--t2)", lineHeight: 1.5 }}>{(data as any).research.paidAds}</p>
              </div>
            )}
            {/* Founders */}
            {(data as any).research?.founders && (
              <div style={{ marginBottom: 8 }}>
                <p style={{ margin: "0 0 4px", fontWeight: 700, color: "var(--jade)", fontSize: 9, textTransform: "uppercase" }}>👥 Fundadores & Equipo</p>
                <p style={{ margin: 0, fontSize: 9, color: "var(--t2)", lineHeight: 1.5 }}>{(data as any).research.founders}</p>
              </div>
            )}
            {/* International */}
            {(data as any).research?.international && (
              <div style={{ marginBottom: 8 }}>
                <p style={{ margin: "0 0 4px", fontWeight: 700, color: "var(--jade)", fontSize: 9, textTransform: "uppercase" }}>🌍 Presencia Internacional</p>
                <p style={{ margin: 0, fontSize: 9, color: "var(--t2)", lineHeight: 1.5 }}>{(data as any).research.international}</p>
              </div>
            )}
            {/* URL deep-dive */}
            {(data as any).research?.urlDeepDive && (
              <div style={{ padding: "7px 10px", background: "rgba(45,212,159,0.05)", borderRadius: 6, border: "1px solid rgba(45,212,159,0.15)" }}>
                <p style={{ margin: "0 0 4px", fontWeight: 700, color: "var(--jade)", fontSize: 9, textTransform: "uppercase" }}>🔍 URL Deep-Dive (Gemini urlContext)</p>
                <p style={{ margin: 0, fontSize: 9, color: "var(--t2)", lineHeight: 1.5 }}>{(data as any).research.urlDeepDive}</p>
              </div>
            )}
            {!p.pricing && !(data as any).research?.paidAds && !(data as any).research?.founders && (
              <p style={{ color: "var(--t4)", fontSize: 9 }}>No se encontró información de pricing o anuncios.</p>
            )}
          </div>
        )}

        {tab === "opportunities" && (
          <div>
            {p.shopifyOpportunities && p.shopifyOpportunities.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <p style={{ margin: "0 0 5px", fontWeight: 700, color: "var(--gold)", fontSize: 9, textTransform: "uppercase" }}>🛒 Shopify</p>
                {p.shopifyOpportunities.map((o, i) => <p key={i} style={{ margin: "3px 0", color: "var(--t2)", lineHeight: 1.4 }}>· {o}</p>)}
              </div>
            )}
            {p.klaviyoOpportunities && p.klaviyoOpportunities.length > 0 && (
              <div>
                <p style={{ margin: "0 0 5px", fontWeight: 700, color: "var(--jade)", fontSize: 9, textTransform: "uppercase" }}>📧 Klaviyo / Email</p>
                {p.klaviyoOpportunities.map((o, i) => <p key={i} style={{ margin: "3px 0", color: "var(--t2)", lineHeight: 1.4 }}>· {o}</p>)}
              </div>
            )}
          </div>
        )}

        {tab === "sources" && (
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 9, color: "var(--t3)" }}>Google realizó {data.queriesExecuted} búsquedas y encontró {data.sourcesFound} fuentes relevantes:</p>
            {data.allQueries.slice(0, 8).map((q, i) => (
              <p key={i} style={{ margin: "2px 0", fontSize: 9, color: "var(--jade)" }}>🔍 "{q}"</p>
            ))}
            <div style={{ marginTop: 6 }}>
              {data.allSources.slice(0, 15).map((src, i) => (
                <a key={i} href={src} target="_blank" rel="noreferrer"
                  style={{ display: "block", fontSize: 9, color: "var(--t3)", textDecoration: "none", padding: "2px 0", borderBottom: "1px solid var(--ink3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  🔗 {src}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "6px 12px", background: "rgba(200,168,75,0.04)", borderTop: "1px solid var(--ink3)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 9, color: "var(--t4)" }}>💾 {data.memoriesSaved} memorias guardadas en Shopy Crafter</span>
        <span style={{ fontSize: 9, color: "var(--gold)", fontWeight: 700 }}>#{data.researchId.slice(0, 8)}</span>
      </div>
    </div>
  );
}

// ─── KLAVIYO RESULT CARD ──────────────────────────────────────────────────────
function KlaviyoResultCard({ data, onViewFlow }: {
  data: KlaviyoWorkflowResult;
  onViewFlow: (flow: KlaviyoWorkflowResult["plan"]["flows"][0]) => void;
}) {
  const { plan, marketIntel } = data;
  return (
    <div style={{ marginTop: 12, border: "1px solid rgba(200,168,75,0.3)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ background: "rgba(200,168,75,0.08)", padding: "10px 14px", borderBottom: "1px solid rgba(200,168,75,0.2)" }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--gold)" }}>📧 Klaviyo Workflow — {plan.storeName}</p>
        <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--t3)" }}>{plan.expected_revenue_impact}</p>
      </div>
      <div style={{ padding: 10 }}>
        {plan.flows?.map(flow => (
          <div key={flow.id} onClick={() => onViewFlow(flow)}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 6, marginBottom: 4, background: "var(--ink2)", cursor: "pointer", border: "1px solid var(--ink3)" }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--t)" }}>{flow.name}</span>
              <span style={{ fontSize: 10, color: "var(--t3)", marginLeft: 6 }}>· {flow.emails?.length ?? 0} emails · {flow.estimated_revenue}</span>
            </div>
            <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 8, fontWeight: 700,
              background: flow.priority === "critical" ? "rgba(232,69,88,0.15)" : flow.priority === "high" ? "rgba(200,168,75,0.15)" : "rgba(45,212,159,0.15)",
              color: flow.priority === "critical" ? "var(--crim)" : flow.priority === "high" ? "var(--gold)" : "var(--jade)" }}>
              {flow.priority}
            </span>
          </div>
        ))}
        {marketIntel?.conversionTips?.length > 0 && (
          <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 6, background: "rgba(45,212,159,0.05)", border: "1px solid rgba(45,212,159,0.15)" }}>
            <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 700, color: "var(--jade)" }}>💡 Tips de conversión</p>
            {marketIntel.conversionTips.slice(0, 2).map((tip, i) => <p key={i} style={{ margin: "2px 0", fontSize: 10, color: "var(--t3)" }}>· {tip}</p>)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FLOW MODAL ───────────────────────────────────────────────────────────────
function FlowModal({ flow, onClose }: { flow: KlaviyoWorkflowResult["plan"]["flows"][0]; onClose: () => void }) {
  const [activeEmail, setActiveEmail] = useState(0);
  const [copied, setCopied] = useState(false);
  const copyHtml = async () => {
    await navigator.clipboard.writeText(flow.emails?.[activeEmail]?.html_body ?? "");
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--ink)", border: "1px solid var(--ink3)", borderRadius: 14, width: "100%", maxWidth: 900, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--ink3)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{flow.name}</h3>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--t3)" }}>Trigger: {flow.trigger} · {flow.emails?.length} emails</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={copyHtml} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--ink3)", background: copied ? "var(--jade)" : "var(--ink2)", color: copied ? "var(--ink)" : "var(--t)", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
              {copied ? "✓ Copiado" : "📋 Copiar HTML"}
            </button>
            <button onClick={onClose} aria-label="Cerrar detalle del flujo" style={{ width: 36, height: 36, borderRadius: 6, border: "1px solid var(--ink3)", background: "var(--ink2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t3)" }}><X size={14} /></button>
          </div>
        </div>
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <div style={{ width: 180, borderRight: "1px solid var(--ink3)", padding: 12, overflowY: "auto", flexShrink: 0 }}>
            {flow.emails?.map((email, i) => (
              <button key={i} onClick={() => setActiveEmail(i)}
                style={{ width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 6, marginBottom: 4, border: "none", cursor: "pointer", background: activeEmail === i ? "rgba(200,168,75,0.12)" : "transparent", color: activeEmail === i ? "var(--gold)" : "var(--t3)" }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 600 }}>Email {email.position}</p>
                <p style={{ margin: "2px 0 0", fontSize: 9, opacity: 0.7 }}>⏱ {email.delay}</p>
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {flow.emails?.[activeEmail] && (() => {
              const email = flow.emails[activeEmail];
              return (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 9, color: "var(--t3)", fontWeight: 700, textTransform: "uppercase", margin: "0 0 4px" }}>Asunto</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t)", margin: 0, background: "var(--ink2)", padding: "8px 12px", borderRadius: 6 }}>{email.subject}</p>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 9, color: "var(--t3)", fontWeight: 700, textTransform: "uppercase", margin: "0 0 4px" }}>Preview Text</p>
                    <p style={{ fontSize: 11, color: "var(--t2)", margin: 0, background: "var(--ink2)", padding: "6px 12px", borderRadius: 6 }}>{email.preview_text}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 9, color: "var(--t3)", fontWeight: 700, textTransform: "uppercase", margin: "0 0 6px" }}>HTML Template</p>
                    <textarea readOnly value={email.html_body}
                      style={{ width: "100%", minHeight: 200, padding: "10px 12px", background: "var(--ink)", border: "1px solid var(--ink3)", borderRadius: 8, color: "var(--t3)", fontSize: 10, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box" }} />
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ATTACHMENT PREVIEW ────────────────────────────────────────────────────────
function AttachmentPreview({ file, url, onRemove }: {
  file?: File | null; url?: string; onRemove: () => void;
}) {
  if (!file && !url) return null;
  const isImage = file?.type.startsWith("image/") || (url && /\.(jpg|jpeg|png|gif|webp)/i.test(url));
  const isVideo = file?.type.startsWith("video/") || (url && /\.(mp4|webm|mov)/i.test(url));
  const urlInfo = url ? classifyUrl(url) : null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "var(--ink2)", borderRadius: 8, border: "1px solid rgba(200,168,75,0.25)", marginBottom: 6 }}>
      <div style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(200,168,75,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)" }}>
        {isImage ? <Image size={14} /> : isVideo ? <Video size={14} /> : urlInfo ? urlInfo.icon : <Globe size={14} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "var(--t)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {file?.name ?? url}
        </p>
        <p style={{ margin: 0, fontSize: 9, color: "var(--t3)" }}>
          {file ? `${(file.size / 1024).toFixed(0)} KB · ${file.type}` : urlInfo?.label}
        </p>
      </div>
      <button onClick={onRemove} aria-label="Eliminar adjunto" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t4)", padding: 6, minWidth: 28, minHeight: 28, display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
    </div>
  );
}

// ─── QUICK ACTIONS ─────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { icon: "❓", label: "¿Qué puedo hacer aquí?", prompt: "¿Qué puedo hacer en esta página? Guíame paso a paso con los botones y opciones disponibles." },
  { icon: "🏪", label: "Estado de la tienda", prompt: "Muéstrame el estado de la tienda: productos, pedidos y estado del token." },
  { icon: "📦", label: "Listar productos", prompt: "Lista todos los productos de la tienda Shopify." },
  { icon: "➕", label: "Crear producto", prompt: "Crea un producto nuevo en Shopify con IA. Título: " },
  { icon: "🔑", label: "Regenerar token", prompt: "Regenera el token de acceso de Shopify ahora." },
  { icon: "🛒", label: "Ver pedidos", prompt: "Muéstrame los últimos pedidos de la tienda." },
  { icon: "🔬", label: "Investigar marca", prompt: "__RESEARCH__", isResearch: true },
  { icon: "📧", label: "Flujos Klaviyo", prompt: "Genera un workflow completo de Klaviyo para comic-crafter.myshopify.com (nicho: comics y arte). Crea los 6 flujos esenciales con emails HTML completos." },
  { icon: "🧠", label: "Estado del sistema", prompt: "¿Qué conocimiento ha absorbido Shopy Crafter? Dame un resumen de las memorias, dominios y contenido absorbido hasta ahora." },
  { icon: "⚖️", label: "Auditoría Copyright", prompt: "Realiza una auditoría de copyright y marcas registradas de todos los productos de la tienda. Identifica posibles infracciones y sugiere nombres alternativos seguros." },
];

const SYSTEM_PROMPT = `Eres el asistente inteligente de Shopy Crafter — la plataforma profesional de automatización Shopify.
Tienes acceso a tres motores de análisis: investigación de mercado, análisis estratégico y memoria permanente.
Eres experto en: Shopify, Klaviyo, email marketing, SEO, pricing, eCommerce, visión de producto, texturas, composición visual, química de materiales, topología 3D, rendering.
Cuando el usuario comparte una imagen o URL, puedes absorberla y extraer TODA la inteligencia posible.
También eres el ASISTENTE DE NAVEGACIÓN de la app: conoces TODAS las páginas, botones y funciones. Cuando te pregunten cómo hacer algo, guía paso a paso con nombres EXACTOS de botones y secciones.
IMPORTANTE: Siempre refiérete a la plataforma como "Shopy Crafter". Nunca uses nombres internos.
Responde siempre en español. Sé directo, técnico y accionable.`;

// ─── MAIN CHATBOT ─────────────────────────────────────────────────────────────
export default function OmniChatbot() {
  const { user } = useAuth();
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{
    id: "welcome", role: "assistant", timestamp: new Date(), model: "omnicore",
    content: `¡Hola${user?.name ? ` ${user.name.split(" ")[0]}` : ""}! 👋 Soy el asistente inteligente de **Shopy Crafter**.

🚀 **Ahora puedo EJECUTAR acciones en Shopify directamente:**
· ➕ "Crea un producto llamado X" — lo creo en tu tienda
· 📦 "Lista mis productos" — te los muestro todos
· 💰 "Cambia el precio de X a Y" — actualizo en Shopify
· 🔑 "Regenera el token" — renuevo acceso automáticamente
· 🛒 "Ver pedidos" — últimos pedidos de la tienda
· 🗑️ "Elimina el producto X" — lo borro de Shopify
· 🔐 "Ver scopes" — permisos activos de la app

**También absorbo y analizo:**
· 📸 Imágenes · 🎬 Vídeos · 🌐 URLs · 📱 Redes sociales

**Soy tu guía** — pregúntame cualquier cosa sobre la app.
Usa los botones de acciones rápidas ⬇️ o el 🎙 micrófono.`,
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<KlaviyoWorkflowResult["plan"]["flows"][0] | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachUrl, setAttachUrl] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<ReturnType<typeof createSpeechRecognition> | null>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.message) {
        setOpen(true);
        setMinimized(false);
        setTimeout(() => setInput(detail.message), 300);
      }
    };
    window.addEventListener("shopycrafter:chatbot", handler);
    return () => window.removeEventListener("shopycrafter:chatbot", handler);
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* already stopped */ }
        recognitionRef.current = null;
      }
    };
  }, []);

  // ─── Drag & drop ──────────────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith("image/") || file.type.startsWith("video/"))) {
      setAttachFile(file); setAttachUrl(""); setShowAttach(true);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setAttachFile(file); setAttachUrl(""); setShowAttach(true); }
  };

  const handleUrlAdd = () => {
    if (urlInput.trim()) { setAttachUrl(urlInput.trim()); setAttachFile(null); setUrlInput(""); }
  };

  const pendingTranscriptRef = useRef<string | null>(null);

  const toggleMic = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    let rec = recognitionRef.current;
    if (!rec) {
      rec = createSpeechRecognition();
      if (!rec) return;
      recognitionRef.current = rec;
    }
    rec.onresult = (e: any) => {
      const t = Array.from(e.results as any[]).map((r: any) => r[0].transcript).join("");
      setInput(t);
      if (e.results[e.results.length - 1].isFinal) {
        setIsListening(false);
        pendingTranscriptRef.current = t;
      }
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    try { rec.start(); setIsListening(true); } catch { setIsListening(false); }
  }, [isListening]);

  // ─── Execute Shopify action via backend ────────────────────────────────────
  const executeShopifyAction = async (action: string, params: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
    try {
      const res = await fetch(`${API}/api/shopybrain/execute-action`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, params }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        let friendlyMsg = `Error ejecutando ${action}`;
        if (errText.includes("credit balance is too low") || errText.includes("insufficient_quota")) {
          friendlyMsg = `⚠️ **Créditos de IA agotados** — La API de Claude (Anthropic) no tiene saldo suficiente. Recarga tus créditos en anthropic.com para continuar usando esta función.`;
        } else if (errText.includes("rate_limit") || errText.includes("429")) {
          friendlyMsg = `⏳ **Límite de velocidad** — Demasiadas peticiones a la IA. Espera unos segundos e inténtalo de nuevo.`;
        } else if (errText.includes("authentication") || errText.includes("401") || errText.includes("api_key")) {
          friendlyMsg = `🔑 **Error de autenticación** — La clave API de Claude necesita ser verificada. Contacta al administrador.`;
        } else if (res.status === 400) {
          try { const d = JSON.parse(errText); friendlyMsg = d.error || errText.slice(0, 200); } catch { friendlyMsg = errText.slice(0, 200); }
        } else {
          friendlyMsg = errText.slice(0, 200) || res.statusText;
        }
        return { error: true, message: friendlyMsg };
      }
      return res.json();
    } catch (e) {
      return { error: true, message: `Error de conexión: ${e instanceof Error ? e.message : "desconocido"}` };
    }
  };

  const formatActionResult = (action: string, result: Record<string, unknown>): string => {
    if (result.error) return `❌ ${result.message}`;

    switch (action) {
      case "store_status":
        return `✅ **Estado de la tienda:**\n🏪 ${result.storeName} (${result.domain})\n📦 ${result.productsCount} productos total (✅ ${result.activeProducts ?? "?"} activos | 📝 ${result.draftProducts ?? "?"} borradores | 📁 ${result.archivedProducts ?? "?"} archivados)\n📢 Publicados: ${result.publishedProducts ?? "?"} | 🔇 No publicados: ${result.unpublishedProducts ?? "0"}${(result.unpublishedProducts as number) > 0 ? " ⚠️" : ""}\n🛒 ${result.ordersCount} pedidos\n🔑 Token: ${result.tokenStatus === "valid" ? `✅ válido (${result.tokenHoursLeft}h)` : "❌ EXPIRADO"}`;
      case "list_products": {
        const prods = (result.products as Array<{ title: string; status: string; price: string; compareAtPrice?: string; published?: boolean; auditScore?: number; auditGrade?: string; imageCount?: number; imageUrl?: string; descriptionLength?: number; tagsCount?: number; variantCount?: number; hasComparePrice?: boolean; issues?: string[] }>) ?? [];
        if (!prods.length) return "📦 No se encontraron productos.";
        const gradeIcon = (g: string) => g === "A" ? "🟢" : g === "B" ? "🟡" : g === "C" ? "🟠" : "🔴";
        const auditW = result.auditWarnings as { unpublished?: number; noCompare?: number; lowImages?: number; shortDesc?: number } | undefined;
        let msg = `📦 **${result.total} productos:**\n\n`;
        msg += prods.map((p, i) => {
          const grade = p.auditGrade || "D";
          let line = `${gradeIcon(grade)} **${p.title}** — ${p.price}€`;
          if (p.compareAtPrice) line += ` ~~${p.compareAtPrice}€~~`;
          line += ` | Grade: **${grade}** (${p.auditScore ?? 0}/100)`;
          if (p.published === false) line += ` | 🔇 NO PUBLICADO`;
          const details: string[] = [];
          if (p.imageCount !== undefined) details.push(`${p.imageCount >= 3 ? "✅" : "⚠️"} ${p.imageCount} imgs`);
          if (p.variantCount !== undefined) details.push(`${p.variantCount} variants`);
          if (p.descriptionLength !== undefined) details.push(`${p.descriptionLength >= 500 ? "✅" : "⚠️"} ${p.descriptionLength}ch desc`);
          if (p.tagsCount !== undefined) details.push(`${p.tagsCount >= 10 ? "✅" : "⚠️"} ${p.tagsCount} tags`);
          if (p.hasComparePrice !== undefined) details.push(p.hasComparePrice ? "✅ compare_at" : "⚠️ sin compare_at");
          if (details.length) line += `\n   ${details.join(" | ")}`;
          if (p.issues?.length) line += `\n   ⚠️ ${p.issues.join(" | ")}`;
          return line;
        }).join("\n\n");
        if (auditW && (auditW.unpublished || auditW.noCompare || auditW.lowImages || auditW.shortDesc)) {
          msg += "\n\n🔍 **Resumen de auditoría:**";
          if (auditW.unpublished) msg += `\n⚠️ ${auditW.unpublished} no publicados`;
          if (auditW.noCompare) msg += `\n⚠️ ${auditW.noCompare} sin precio tachado`;
          if (auditW.lowImages) msg += `\n⚠️ ${auditW.lowImages} con pocas imágenes`;
          if (auditW.shortDesc) msg += `\n⚠️ ${auditW.shortDesc} con descripción corta`;
        }
        return msg;
      }
      case "create_product":
        return `✅ **Producto creado en Shopify:**\n🆔 ID: ${result.productId}\n📝 "${result.title}"\n📊 Estado: ${result.status}`;
      case "edit_product": {
        const preIss = (result.preAuditIssues as string[]) || [];
        const postIss = (result.postAuditIssues as string[]) || [];
        let editMsg = `✅ **Producto actualizado:** "${result.title}"`;
        if (result.published !== undefined) editMsg += `\n📢 Publicado: ${result.published ? "SÍ" : "NO"}`;
        if (preIss.length > 0) editMsg += `\n\n🔍 Pre-auditoría: ${preIss.join(" | ")}`;
        if (postIss.length > 0) editMsg += `\n🔍 Post-auditoría: ${postIss.join(" | ")}`;
        else editMsg += `\n✅ Auditoría post-edición OK`;
        return editMsg;
      }
      case "change_price":
        return `✅ **Precio actualizado:** ${result.oldPrice}€ → ${result.newPrice}€`;
      case "regenerate_token":
        return `✅ **Token regenerado exitosamente.** Válido por ${result.hoursRemaining}h.`;
      case "get_scopes": {
        const scopes = (result.scopes as string[]) ?? [];
        return `🔐 **${result.total} scopes activos:**\n${scopes.map(s => `· ${s}`).join("\n")}`;
      }
      case "delete_product":
        if (result.requiresConfirmation || result.success === false) {
          return `⚠️ ${result.message || "No se pudo eliminar el producto. Confirma la acción e inténtalo de nuevo."}`;
        }
        return `🗑️ Producto ${result.productId} eliminado de Shopify.`;
      case "search_product": {
        const searchProds = (result.products as Array<{ title: string; id: number; price: string; status: string; compareAtPrice?: string; published?: boolean; auditScore?: number; auditGrade?: string; imageCount?: number; imageUrl?: string; descriptionLength?: number; tagsCount?: number; variantCount?: number; hasComparePrice?: boolean; issues?: string[] }>) ?? [];
        if (!searchProds.length) return "🔍 No se encontraron productos.";
        const sGradeIcon = (g: string) => g === "A" ? "🟢" : g === "B" ? "🟡" : g === "C" ? "🟠" : "🔴";
        return `🔍 **${result.total} resultados:**\n\n${searchProds.map((p) => {
          const grade = p.auditGrade || "D";
          let line = `${sGradeIcon(grade)} **${p.title}** — ${p.price}€`;
          if (p.compareAtPrice) line += ` ~~${p.compareAtPrice}€~~`;
          line += ` | **${grade}** (${p.auditScore ?? 0}/100)`;
          if (p.published === false) line += ` | 🔇 NO PUBLICADO`;
          const details: string[] = [];
          if (p.imageCount !== undefined) details.push(`${p.imageCount >= 3 ? "✅" : "⚠️"} ${p.imageCount} imgs`);
          if (p.variantCount !== undefined) details.push(`${p.variantCount} variants`);
          if (p.hasComparePrice !== undefined) details.push(p.hasComparePrice ? "✅ compare" : "⚠️ sin compare");
          if (details.length) line += `\n   ${details.join(" | ")}`;
          if (p.issues?.length) line += `\n   ⚠️ ${p.issues.join(" | ")}`;
          return line;
        }).join("\n\n")}`;
      }
      case "publish_product": {
        const pubIssues = (result.auditIssues as string[]) || [];
        let pubMsg = `✅ Producto "${result.title}" publicado correctamente\n📢 Estado: active | Publicado: SÍ | Alcance: global`;
        if (result.previousStatus) pubMsg += `\n📋 Antes: ${result.previousStatus}, publicado=${result.wasPublished ? "sí" : "no"}`;
        if (pubIssues.length > 0) pubMsg += `\n\n🔍 Auditoría post-publicación:\n${pubIssues.join("\n")}`;
        else pubMsg += `\n\n✅ Auditoría OK — producto completo`;
        return pubMsg;
      }
      case "audit_store": {
        let auditMsg = `🔍 **AUDITORÍA PROFUNDA**\n\n`;
        auditMsg += `📊 Puntuación media: ${result.averageScore}/100 (${result.overallGrade})\n`;
        auditMsg += `📦 Total: ${result.totalProducts} productos\n`;
        auditMsg += `📢 Publicados: ${result.publishedCount} | 🔇 No publicados: ${result.unpublishedCount}\n`;
        const critIssues = (result.criticalIssues as string[]) || [];
        const warnIssues = (result.warnings as string[]) || [];
        if (critIssues.length > 0) auditMsg += `\n🚨 **PROBLEMAS CRÍTICOS:**\n${critIssues.join("\n")}`;
        if (warnIssues.length > 0) auditMsg += `\n\n⚠️ **ADVERTENCIAS:**\n${warnIssues.join("\n")}`;
        if (critIssues.length === 0 && warnIssues.length === 0) auditMsg += `\n✅ ¡Todos los productos están en perfecto estado!`;
        const auditProds = (result.products as Array<{ title: string; grade: string; score: number; imageCount?: number; imageUrl?: string; descLength?: number; tagsCount?: number; variantCount?: number; price?: string; compareAtPrice?: string; hasComparePrice?: boolean; issues?: string[] }>) || [];
        const gradeIcon3 = (g: string) => g === "A" ? "🟢" : g === "B" ? "🟡" : g === "C" ? "🟠" : "🔴";
        if (auditProds.length > 0) {
          auditMsg += `\n\n📋 **Detalle por producto:**\n\n`;
          auditMsg += auditProds.map(p => {
            let line = `${gradeIcon3(p.grade)} **${p.title}** — Grade: **${p.grade}** (${p.score}/100)`;
            if (p.price) line += ` | ${p.price}€`;
            if (p.compareAtPrice) line += ` ~~${p.compareAtPrice}€~~`;
            const details: string[] = [];
            if (p.imageCount !== undefined) details.push(`${p.imageCount >= 3 ? "✅" : "⚠️"} ${p.imageCount} imgs`);
            if (p.variantCount !== undefined) details.push(`${p.variantCount} variants`);
            if (p.descLength !== undefined) details.push(`${p.descLength >= 500 ? "✅" : "⚠️"} ${p.descLength}ch desc`);
            if (p.tagsCount !== undefined) details.push(`${p.tagsCount >= 10 ? "✅" : "⚠️"} ${p.tagsCount} tags`);
            if (p.hasComparePrice !== undefined) details.push(p.hasComparePrice ? "✅ compare" : "⚠️ sin compare");
            if (details.length) line += `\n   ${details.join(" | ")}`;
            if (p.issues?.length) line += `\n   ⚠️ ${p.issues.join(" | ")}`;
            return line;
          }).join("\n\n");
        }
        return auditMsg;
      }
      case "fix_unpublished":
        return (result.fixed as number) > 0
          ? `✅ **${result.fixed} producto(s) publicados correctamente** (status=active, published=true, scope=global)${(result.errors as number) > 0 ? `\n⚠️ ${result.errors} error(es)` : ""}`
          : `✅ No hay productos sin publicar — todos están visibles`;
      case "fix_missing_compare_prices":
        return (result.fixed as number) > 0
          ? `✅ **${result.fixed} variante(s) actualizadas con compare_at_price** (precio tachado visible)${(result.errors as number) > 0 ? `\n⚠️ ${result.errors} error(es)` : ""}`
          : `✅ Todos los productos ya tienen compare_at_price configurado`;
      case "set_product_status":
        return `✅ Producto "${result.title}" → estado: **${result.status}**`;
      case "scan_store":
        return `📊 **Escaneo completado** (filtro: ${result.statusFilter ?? "any"})\n📦 ${result.total ?? 0} productos analizados\n📈 Nota media: ${typeof result.avgScore === "number" ? (result.avgScore as number).toFixed(0) : "N/A"}/100`;
      case "modify_audit_filter":
        return `🔧 **Filtro de auditoría modificado**\n📋 Filtro: ${result.filterDescription ?? result.filterApplied ?? "any"}\n${result.autoScanExecuted ? `📊 Re-escaneo: ${result.synced ?? 0} productos analizados\n📈 Score medio: ${typeof result.avgScore === "number" ? Math.round(result.avgScore as number) : "N/A"}/100` : "⏸️ Sin re-escaneo automático"}`;
      case "diagnose_app": {
        const issues = (result.issues as Array<{ component: string; status: string; detail: string; autoFixed?: boolean }>) ?? [];
        const summary = result.summary as { errors?: number; warnings?: number; ok?: number; fixesApplied?: number } ?? {};
        const emoji = (summary.errors ?? 0) > 0 ? "🔴" : (summary.warnings ?? 0) > 0 ? "🟡" : "🟢";
        let msg = `${emoji} **Diagnóstico: ${result.overallStatus}**\n`;
        msg += `📊 ${summary.errors ?? 0} errores | ${summary.warnings ?? 0} advertencias | ${summary.ok ?? 0} ok`;
        if ((summary.fixesApplied ?? 0) > 0) msg += ` | 🔧 ${summary.fixesApplied} reparaciones automáticas`;
        msg += "\n\n";
        msg += issues.map(i => `${i.status === "ok" ? "✅" : i.status === "warning" ? "⚠️" : "❌"} **${i.component}**: ${i.detail}${i.autoFixed ? " 🔧" : ""}`).join("\n");
        return msg;
      }
      case "list_source_files":
        return result.message ?? `📂 ${result.totalFrontend ?? 0} archivos frontend, ${result.totalBackend ?? 0} archivos backend`;
      case "inspect_code":
        return result.message ?? `📄 Archivo: ${result.filePath}\n${result.analysis ?? "Código leído."}`;
      case "analyze_component": {
        const counts = result.issueCount as { critical?: number; high?: number; medium?: number; low?: number; total?: number } ?? {};
        return `🔍 **Análisis: ${result.filePath}** (${result.focusOn})\n📊 ${counts.total ?? 0} problemas: ${counts.critical ?? 0} críticos, ${counts.high ?? 0} altos, ${counts.medium ?? 0} medios, ${counts.low ?? 0} bajos\n\n${result.analysis ?? ""}`;
      }
      case "fix_code":
        return result.success
          ? `✅ **Fix aplicado en ${result.filePath}**\n📝 ${result.description}\n📊 ${result.linesChanged ?? 0} líneas modificadas\n💾 Backup creado\n⚠️ Reinicia el servidor para aplicar los cambios.`
          : `❌ ${result.message ?? "No se pudo aplicar el fix."}`;
      case "list_all_products": {
        const allProds = (result.products as Array<{ title: string; status: string; price: string; compareAtPrice?: string; imageCount?: number; imageUrl?: string; auditScore?: number; auditGrade?: string; descriptionLength?: number; tagsCount?: number; variantCount?: number; hasComparePrice?: boolean }>) ?? [];
        const stats = result.byStatus as Record<string, number> ?? {};
        if (!allProds.length) return "📦 No se encontraron productos.";
        const gradeIcon2 = (g: string) => g === "A" ? "🟢" : g === "B" ? "🟡" : g === "C" ? "🟠" : "🔴";
        let msg = `📦 **${result.total} productos** (filtro: ${result.statusFilter ?? "any"})`;
        if (Object.keys(stats).length) msg += `\n📊 ${Object.entries(stats).map(([s, c]) => `${s}: ${c}`).join(" | ")}`;
        msg += `\n📢 Publicados: ${result.published ?? "?"} | 🔇 No publicados: ${result.unpublished ?? "?"}\n\n`;
        msg += allProds.map((p) => {
          const grade = p.auditGrade || "D";
          let line = `${gradeIcon2(grade)} **${p.title}** — ${p.price}€`;
          if (p.compareAtPrice) line += ` ~~${p.compareAtPrice}€~~`;
          line += ` | **${grade}** (${p.auditScore ?? 0}/100)`;
          const details: string[] = [];
          if (p.imageCount !== undefined) details.push(`${p.imageCount >= 3 ? "✅" : "⚠️"} ${p.imageCount} imgs`);
          if (p.variantCount !== undefined) details.push(`${p.variantCount} variants`);
          if (p.descriptionLength !== undefined) details.push(`${p.descriptionLength >= 500 ? "✅" : "⚠️"} ${p.descriptionLength}ch`);
          if (p.hasComparePrice !== undefined) details.push(p.hasComparePrice ? "✅ compare" : "⚠️ sin compare");
          if (details.length) line += `\n   ${details.join(" | ")}`;
          return line;
        }).join("\n\n");
        return msg;
      }
      case "get_orders": {
        const orders = (result.orders as Array<{ name: string; total: string; customer: string; financial: string }>) ?? [];
        if (!orders.length) return "🛒 No hay pedidos.";
        return `🛒 **${result.total} pedidos:**\n${orders.map((o, i) => `${i + 1}. ${o.name} — ${o.total}€ (${o.financial}) — ${o.customer}`).join("\n")}`;
      }
      case "search_suppliers": {
        const topSups = (result.topSuppliers as string[]) ?? [];
        let msg = `🔍 **Investigación de proveedores: ${result.productName}**\n\n`;
        msg += `📊 **${result.suppliersFound} proveedores encontrados** (${result.sourcesAnalyzed} fuentes analizadas)\n\n`;
        if (result.topRecommendation) msg += `🏆 **Recomendación:** ${result.topRecommendation}\n\n`;
        if (topSups.length > 0) {
          msg += `**Top proveedores:**\n${topSups.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n`;
        }
        const cb = result.costBreakdown as Record<string, unknown>;
        if (cb?.total) {
          msg += `💰 **Costes:** Producción €${cb.production || "?"} + Embalaje €${cb.packaging || "?"} + Envío €${cb.shipping || "?"} = **Total €${cb.total}**\n`;
          if (cb.recommendedRetailPrice) msg += `🏷️ PVP recomendado: **€${cb.recommendedRetailPrice}** (margen ${cb.estimatedMargin || "N/A"})\n`;
        }
        if (result.strategy) msg += `\n🧠 **Estrategia:** ${result.strategy}\n`;
        const risks = result.risks as string[];
        if (risks?.length) msg += `\n⚠️ **Riesgos:** ${risks.join(" · ")}\n`;
        const steps = result.nextSteps as string[];
        if (steps?.length) msg += `\n📋 **Próximos pasos:**\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n`;
        msg += `\n💾 Guardado en Shopy Crafter (ID: ${(result.memoryId as string)?.slice(0, 8) || "N/A"})`;
        msg += `\n\n📥 _Puedes descargar el informe completo con el botón de abajo._`;
        return msg;
      }
      case "optimize_product":
        return `🧠 **Producto optimizado con IA:**\n📝 "${result.title}"${result.previousTitle !== result.title ? ` (antes: "${result.previousTitle}")` : ""}\n🏷 ${result.tagsCount} tags SEO\n📄 Descripción: ${result.descriptionLength} caracteres\n🔍 SEO: ${result.seoTitle}\n🖼 ${result.altTextsGenerated} alt texts generados`;
      case "optimize_all_products": {
        const prods = (result.products as Array<{ title: string }>) ?? [];
        let msg = `🧠 **Optimización masiva IA:** ${result.optimized}/${result.total} productos\n`;
        if (prods.length > 0) msg += prods.map((p, i) => `${i + 1}. ✅ ${p.title}`).join("\n");
        if (result.failed) msg += `\n⚠️ ${result.failed} errores`;
        return msg;
      }
      case "create_collection":
        return `📂 **Colección "${result.title}" creada**\n🆔 ID: ${result.collectionId}\n📋 Tipo: ${result.type}${result.productsAdded ? `\n📦 ${result.productsAdded} productos añadidos` : ""}`;
      case "list_collections": {
        const cols = (result.collections as Array<{ title: string; type: string; productsCount: number }>) ?? [];
        if (!cols.length) return "📂 No hay colecciones.";
        return `📂 **${result.total} colecciones:**\n${cols.map((c, i) => `${i + 1}. **${c.title}** (${c.type}) — ${c.productsCount} productos`).join("\n")}`;
      }
      case "auto_collections": {
        const cols = (result.collections as Array<{ title: string; type: string }>) ?? [];
        return `📂 **${result.collectionsCreated} colecciones creadas automáticamente:**\n${cols.map((c, i) => `${i + 1}. **${c.title}** (${c.type})`).join("\n")}`;
      }
      case "create_page":
        return `📄 **Página "${result.title}" creada**\n🆔 ID: ${result.pageId}\n📝 ${result.contentLength} caracteres de contenido IA\n🔗 /pages/${result.handle}`;
      case "list_pages": {
        const pages = (result.pages as Array<{ title: string; handle: string; published: boolean }>) ?? [];
        if (!pages.length) return "📄 No hay páginas.";
        return `📄 **${result.total} páginas:**\n${pages.map((p, i) => `${i + 1}. **${p.title}** — /pages/${p.handle} ${p.published ? "✅" : "⏸️"}`).join("\n")}`;
      }
      case "design_all_pages": {
        const pages = (result.pages as Array<{ title: string; handle: string }>) ?? [];
        return `📄 **${result.pagesCreated} páginas diseñadas por IA:**\n${pages.map((p, i) => `${i + 1}. **${p.title}** → /pages/${p.handle}`).join("\n")}`;
      }
      case "optimize_images":
        return `🖼 **Optimización de imágenes completada:**\n📊 ${result.productsProcessed} productos procesados\n🖼 ${result.optimizedImages}/${result.totalImages} imágenes con alt text SEO`;
      case "read_cms":
        if (result.sections) return `📋 **CMS tiene ${result.totalSections} secciones:**\n${(result.sections as string[]).map(s => `· ${s}`).join("\n")}`;
        return `📋 **CMS — ${result.section}:**\n${typeof result.value === "string" ? result.value : JSON.stringify(result.value, null, 2).slice(0, 800)}`;
      case "update_cms":
        return `✅ **CMS actualizado:**\n📝 Campo: \`${result.path}\`\n💾 Nuevo valor: ${typeof result.value === "string" ? `"${result.value}"` : JSON.stringify(result.value)}`;
      case "update_cms_batch":
        return `✅ **CMS batch actualizado:**\n📝 ${result.changesApplied} campos modificados:\n${(result.paths as string[]).map(p => `· \`${p}\``).join("\n")}`;
      case "reset_cms":
        return `🔄 **CMS reseteado a valores por defecto.** Todos los textos de la landing, panel admin y panel cliente han vuelto a su estado original.`;
      case "generate_competitive_pricing": {
        const plans = (result.plans as Array<{ name: string; price: string; featured: boolean; badge: string | null }>) ?? [];
        let msg = `🎯 **${result.plansGenerated} planes de precio generados**\n\n`;
        msg += plans.map((p, i) => `${i + 1}. **${p.name}** — ${p.price}${p.featured ? " ⭐" : ""}${p.badge ? ` [${p.badge}]` : ""}`).join("\n");
        if (result.cmsUpdated) msg += `\n\n✅ CMS actualizado con los nuevos planes`;
        if (result.shopifyProductsCreated) msg += `\n🛍️ ${result.shopifyProductsCreated} productos creados en Shopify`;
        if (result.strategy) msg += `\n\n🧠 ${result.strategy}`;
        if (result.competitorsAnalyzed) msg += `\n📊 ${result.competitorsAnalyzed} competidores analizados`;
        return msg;
      }
      case "audit_app_offerings":
        return result.audit ? `🔍 **Auditoría de la oferta:**\n\n${result.audit}` : (result.message as string ?? "Auditoría completada.");
      case "modify_ui":
        return result.success
          ? `✅ **Cambio UI aplicado:**\n${result.summary}\n📁 Archivos: ${(result.files as string[])?.join(", ")}\n🔧 ${result.changesApplied} cambios\n⚠️ Recarga la página para ver los cambios.`
          : `⚠️ ${result.message ?? "No se pudieron aplicar los cambios automáticamente."}`;
      case "redesign_product":
        return `🎨 **Rediseño IA completado:**\n📝 "${result.newTitle || result.title}"\n📄 Descripción: ${result.descriptionLength || "?"} chars con ${result.sectionsGenerated || 8} secciones\n🏷 ${result.tagsCount || "?"} tags SEO\n📸 ${result.photoBriefs || 0} briefs de fotografía\n\n${result.message || "Listo para aplicar con apply_redesign."}`;
      case "apply_redesign":
        return `✅ **Rediseño aplicado en Shopify:**\n📝 "${result.title}"\n📊 Título + Descripción + Tags + SEO actualizados\n${result.message || ""}`;
      case "bulk_redesign":
        return `🎨 **Rediseño masivo completado:**\n📦 ${result.total || "?"} productos procesados\n✅ ${result.redesigned || "?"} rediseñados\n${result.failed ? `❌ ${result.failed} errores` : ""}\n${result.message || ""}`;
      case "seo_full_audit":
        return `📊 **Auditoría SEO completada (16 criterios):**\n🏆 Score: **${result.averageScore || result.score || "?"}**/100\n📦 ${result.productsAudited || result.total || "?"} productos analizados\n${result.topIssues ? `\n⚠️ **Problemas principales:**\n${(result.topIssues as string[]).map((i: string) => `· ${i}`).join("\n")}` : ""}\n${result.message || ""}`;
      case "keyword_intelligence":
        return `🔍 **Keyword Intelligence:**\n${result.message || JSON.stringify(result.keywords || result.data || result, null, 2).slice(0, 800)}`;
      case "generate_schemas":
        return `📋 **Schemas JSON-LD generados e inyectados:**\n${result.message || `${result.totalItems || "?"} productos con schema Product + FAQ + Breadcrumb. Organization + WebSite inyectados en theme.liquid.`}`;
      case "generate_all_metas":
        return `🏷️ **Meta tags generados:**\n${result.message || `Meta titles (40-60 chars) + descriptions (130-155 chars) para ${result.totalItems || "?"} productos.`}`;
      case "fix_all_alt_texts":
        return `🖼️ **Alt texts corregidos:**\n${result.message || `Todas las imágenes ahora tienen alt text SEO optimizado.`}`;
      case "generate_sitemap":
        return `🗺️ **Sitemap generado:**\n${result.message || "XML sitemap actualizado y ping a Google enviado."}`;
      case "audit_page_speed":
        return `⚡ **PageSpeed auditado:**\n${result.message || `Mobile: ${result.mobileScore || "?"}/100 | Desktop: ${result.desktopScore || "?"}/100`}`;
      case "blog_strategy":
        return `📝 **Estrategia blog SEO generada:**\n${result.message || `${result.topics || "?"} temas pillar + cluster`}`;
      case "generate_blog_post":
        return `📄 **Artículo blog SEO generado:**\n${result.message || `${result.wordCount || 1500} palabras optimizadas para posicionamiento.`}`;
      case "generate_email_flow":
        return `📧 **Flujo email marketing generado:**\n${result.message || `${result.flowsGenerated || 6} flujos: Welcome, Abandoned Cart, Post-Purchase, Browse, Win-back, VIP.\nCada uno con ${result.emailsPerFlow || "2-4"} emails HTML listos.`}`;
      case "generate_email":
        return `📧 **Email generado:**\n${result.message || "Template HTML responsive con CSS inline listo para enviar."}`;
      case "list_themes": {
        const themes = (result.themes as Array<{ name: string; role: string; id: number }>) ?? [];
        return `🎨 **${result.total || themes.length} themes:**\n${themes.map((t, i) => `${i + 1}. **${t.name}** (${t.role}) ID: ${t.id}`).join("\n")}`;
      }
      case "list_theme_files":
        return `📂 **Archivos del theme:**\n${result.message || JSON.stringify(result.files || result, null, 2).slice(0, 800)}`;
      case "read_theme_file":
        return `📄 **${result.assetKey || "Archivo"}:**\n\`\`\`\n${(result.content || result.value || "").toString().slice(0, 1000)}\n\`\`\``;
      case "edit_theme_file":
        return `✅ **Theme file editado:**\n📁 ${result.assetKey}\n${result.message || "Cambios aplicados al theme."}`;
      case "edit_theme_css":
        return `🎨 **CSS del theme actualizado:**\n📁 ${result.assetKey || "assets/custom.css"}\n${result.message || "Estilos añadidos sin perder código existente."}`;
      case "edit_theme_settings":
        return `⚙️ **Settings del theme actualizados:**\n${result.message || "settings_data.json actualizado con deep merge."}`;
      case "create_theme_section":
        return `📐 **Sección Liquid creada:**\n📁 ${result.assetKey}\n${result.message || "Sección con schema completo lista para el Theme Editor."}`;
      case "audit_theme":
        return `🎨 **Auditoría de theme completada:**\n${result.message || result.audit || `Score: ${result.score || "?"}/100`}`;
      case "calculate_optimal_price":
        return `💰 **Precio óptimo calculado:**\n${result.message || `Precio recomendado: €${result.optimalPrice || "?"}`}`;
      case "estimate_cogs":
        return `📊 **COGS estimado:**\n${result.message || `Coste estimado: €${result.estimatedCogs || result.cogs || "?"}`}`;
      case "price_simulator":
        return `📈 **Simulación de precio:**\n${result.message || `Escenarios analizados para precio €${result.newPrice || "?"}`}`;
      case "financial_forecast":
        return `📊 **Proyección financiera:**\n${result.message || `Forecast a ${result.months || 6} meses generado.`}`;
      case "financial_dashboard":
        return `💰 **Dashboard financiero:**\n${result.message || `Revenue: €${result.totalRevenue || "?"} | Margen: ${result.avgMargin || "?"}%`}`;
      case "scan_competitor":
        return `🔍 **Competidor escaneado:**\n${result.message || "Precios, productos y estrategia analizados."}`;
      case "analyze_competitor_product":
        return `📊 **Análisis competitivo:**\n${result.message || "Producto comparado contra competidores del mercado."}`;
      case "create_ab_test":
        return `🔬 **A/B Test creado:**\n${result.message || `Test ${result.testId || ""} iniciado: ${result.testType || "price"}.`}`;
      case "list_ab_tests": {
        const tests = (result.tests as Array<{ id: string; status: string; type: string }>) ?? [];
        if (!tests.length) return "🔬 No hay tests A/B activos.";
        return `🔬 **${result.total || tests.length} tests:**\n${tests.map((t, i) => `${i + 1}. ID: ${t.id} — ${t.type} (${t.status})`).join("\n")}`;
      }
      case "declare_winner":
        return `🏆 **Winner declarado:**\n${result.message || `Variante ganadora aplicada al producto.`}`;
      case "bulk_generate_images":
        return `🖼️ **Generación masiva de imágenes:**\n${result.message || `Job ${result.jobId || ""} iniciado para ${result.totalImages || "?"} imágenes.`}`;
      case "generate_product_images":
        return `🖼️ **Imágenes generadas:**\n${result.message || `${result.imagesGenerated || "?"} imágenes IA para el producto.`}`;
      case "generate_images_from_reference":
        return `📸 **Imágenes desde referencia:**\n${result.message || `${result.imagesGenerated || "?"} fotos profesionales generadas desde imagen de referencia.`}`;
      case "setup_full_store":
        return `🏪 **Setup completo de tienda:**\n${result.message || "Configuración completa aplicada."}`;
      case "copyright_audit":
        return result.message || `⚖️ **Auditoría de copyright:**\n${result.totalProducts || "?"} productos analizados · ${result.riskProducts?.length || 0} con riesgos`;
      case "brain_stats":
        return `🧠 **Shopy Crafter stats:**\n${result.message || `${result.totalMemories || "?"} memorias · ${result.totalInsights || "?"} insights`}`;
      case "brain_sync":
        return `🧠 **Brain sincronizado:**\n${result.message || "Conocimiento actualizado."}`;
      case "inventory_sync":
        return `📦 **Inventario sincronizado:**\n${result.message || "Stock actualizado desde Shopify."}`;
      case "inventory_alerts":
        return `⚠️ **Alertas de inventario:**\n${result.message || "Verificación de stock completada."}`;
      case "inventory_deep_report":
        return `📦 **Informe profundo de inventario:**\n${result.message || "Análisis completo de stock generado."}`;
      case "inventory_sync_orders":
        return `📋 **Pedidos sincronizados:**\n${result.message || "Datos de ventas importados de Shopify."}`;
      case "inventory_sales_analytics":
        return `📈 **Analytics de ventas:**\n${result.message || "Análisis de ventas por producto, variante y cliente."}`;
      case "inventory_customer_history":
        return `👤 **Historial de cliente:**\n${result.message || "Historial de compras del cliente."}`;
      case "agency_quote":
        return `💼 **Presupuesto generado:**\n${result.message || "Propuesta de precio personalizada lista."}`;
      case "agency_proposal":
        return `📋 **Propuesta de agencia:**\n${result.message || "Documento de propuesta generado."}`;
      case "learn_from_url":
        return `🧠 **URL absorbida:**\n${result.message || "Contenido aprendido con éxito."}`;
      case "learn_from_content":
        return `🧠 **Contenido absorbido:**\n${result.message || "Conocimiento memorizado."}`;
      case "recall_knowledge":
        return `🔍 **Búsqueda en memoria:**\n${result.message || `${result.memories || 0} memorias encontradas.`}`;
      case "brain_status":
        return `🧠 **Estado del cerebro:**\n${result.message || `${result.totalMemories || "?"} memorias totales.`}`;
      case "analyze_external_store":
      case "external_pre_report":
        return `🔍 **Análisis de tienda externa:**\n${result.message || "Análisis completado."}${result.savedToVault ? "\n\n💾 Informe guardado en el vault." : ""}`;
      default:
        return result.message ? `✅ ${result.message}` : "✅ Acción completada.";
    }
  };

  // ─── Absorb image/video file ───────────────────────────────────────────────
  const absorbFile = async (file: File, niche?: string): Promise<AbsorbResult> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("label", file.name);
    if (niche) formData.append("niche", niche);
    const res = await fetch(`${API}/api/shopybrain/absorb-image`, {
      method: "POST", credentials: "include", body: formData,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  // ─── Absorb URL ────────────────────────────────────────────────────────────
  const absorbUrl = async (url: string, niche?: string): Promise<AbsorbResult> => {
    const res = await fetch(`${API}/api/shopybrain/absorb-url`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, niche }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  // ─── Detect entity research request ───────────────────────────────────────
  const detectEntityResearch = (text: string): string | null => {
    const lower = text.toLowerCase();
    // Explicit research commands
    if (lower.match(/\b(investiga|researcha|busca todo|búscalo todo|investigaci[oó]n exhaustiva|investigar (en profundidad|completamente|todo sobre|a fondo)|deep research|d[ée]jame saber todo|qu[eé]ro saber todo|todo sobre|analiza (la )?marca|perfil (de )?marca)\b/)) {
      // Extract the entity name from the text (after the command)
      const entityMatch = text.match(/(?:investiga|researcha|busca todo sobre|investigaci[oó]n de|todo sobre|analiza(?:\s+la\s+marca)?)\s+(.+?)(?:\s+(?:en profundidad|completamente|a fondo|exhaustiv))?$/i);
      return entityMatch?.[1]?.trim() ?? text;
    }
    // @handle pattern
    if (text.match(/^@[a-zA-Z0-9_.]{2,}$/)) {
      return text.trim();
    }
    // Pure domain or myshopify
    if (text.match(/^(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/.*)?$/) && !lower.includes("absorb")) {
      return text.trim();
    }
    return null;
  };

  // ─── Quick knowledge check before full research ────────────────────────────
  const checkExistingKnowledge = async (name: string): Promise<{
    found: boolean; memoriesFound?: number; knowledgeAge?: string;
  }> => {
    try {
      const res = await fetch(`${API}/api/shopybrain/research-entity/${encodeURIComponent(name)}`, {
        credentials: "include",
      });
      if (!res.ok) return { found: false };
      return res.json();
    } catch { return { found: false }; }
  };

  // ─── Exhaustive entity research API call ───────────────────────────────────
  const researchEntity = async (input: string, niche?: string): Promise<EntityResearchResult> => {
    const res = await fetch(`${API}/api/shopybrain/research-entity-sync`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, niche, market: "es" }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  // ─── Detect Klaviyo request ────────────────────────────────────────────────
  const detectKlaviyo = (text: string) => {
    const lower = text.toLowerCase();
    const hasKlaviyoExplicit = lower.includes("klaviyo");
    const hasEmailWorkflow = (lower.includes("workflow") || lower.includes("flujo")) && (lower.includes("email") || lower.includes("correo") || lower.includes("newsletter") || lower.includes("klaviyo"));
    const hasEmailMarketing = lower.includes("email marketing") && (lower.includes("genera") || lower.includes("crea") || lower.includes("diseña") || lower.includes("workflow") || lower.includes("flujo"));
    if (!hasKlaviyoExplicit && !hasEmailWorkflow && !hasEmailMarketing) return null;
    const domainMatch = text.match(/([a-zA-Z0-9-]+\.myshopify\.com)/);
    const shopDomain = domainMatch?.[1] ?? "comic-crafter.myshopify.com";
    const storeName = shopDomain.split(".")[0].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    return { shopDomain, storeName, niche: "Comics y Arte" };
  };

  // ─── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (loading) return;
    if (!content && !attachFile && !attachUrl) return;

    const hasAttach = !!(attachFile || attachUrl);
    const attachType = attachFile ? (attachFile.type.startsWith("video/") ? "video" : "image") : "url";
    const attachName = attachFile?.name ?? attachUrl;

    const userMsg: Message = {
      id: uuid(), role: "user", content: content || `📎 ${attachName}`, timestamp: new Date(),
      attachmentType: hasAttach ? attachType as never : undefined,
      attachmentName: hasAttach ? attachName : undefined,
    };
    setMessages(m => [...m, userMsg]);
    setInput(""); setAttachFile(null); setAttachUrl(""); setShowAttach(false);
    setLoading(true);

    try {
      let assistantContent = "";
      let action: ChatAction | undefined;

      // ── Detect product creation intent from text ──
      const isProductCreationIntent = (text: string) => {
        const lower = text.toLowerCase();
        const createWords = ["crea", "crear", "créame", "creame", "publica", "sube", "subir", "añade", "añadir", "pon", "poner", "haz", "hacer", "genera", "generar", "create", "make", "add", "upload"];
        const productWords = ["producto", "product", "artículo", "articulo", "item", "listing"];
        const shopifyWords = ["shopify", "tienda", "store", "shop"];
        const hasCreate = createWords.some(w => lower.includes(w));
        const hasProduct = productWords.some(w => lower.includes(w)) || shopifyWords.some(w => lower.includes(w));
        return hasCreate && hasProduct;
      };

      // ── CASE 1: Has file or URL attachment ──
      if (hasAttach) {
        const projectIdFromUrl = location.match(/\/projects\/(\d+)/)?.[1];
        const wantsProduct = content && attachType === "image" && isProductCreationIntent(content) && projectIdFromUrl;

        if (wantsProduct && attachFile) {
          setMessages(m => [...m, { id: uuid(), role: "assistant", content: `🚀 **Creando producto desde imagen** — ${attachName}\n\n**Paso 1** — Claude Vision analiza el producto en profundidad\n**Paso 2** — Gemini investiga precios REALES del mercado (búsquedas Google)\n**Paso 3** — Claude genera copywriting profesional optimizado\n**Paso 4** — Se crea el producto en Shopify con la imagen\n\n_⏱️ Esto puede tardar 30-60 segundos. Investigando precios reales..._`, timestamp: new Date(), model: "gemini+claude+brain" }]);

          const formData = new FormData();
          formData.append("file", attachFile);
          formData.append("projectId", projectIdFromUrl!);
          if (content) formData.append("userInstruction", content);

          const prodRes = await fetch(`${API}/api/shopybrain/create-product-from-image`, {
            method: "POST", credentials: "include", body: formData,
          });

          if (prodRes.ok) {
            const prodData = await prodRes.json();
            const p = prodData.product;
            const pr = prodData.pricing;
            const an = prodData.analysis;

            assistantContent = `✅ **Producto creado en Shopify**\n\n`;
            assistantContent += `📦 **${p.title}**\n`;
            assistantContent += `🏷️ ID: \`${p.id}\` | Estado: \`${p.status}\`\n\n`;

            assistantContent += `💰 **Precio: €${pr.recommendedPrice}**`;
            if (pr.compareAtPrice) assistantContent += ` ~~€${pr.compareAtPrice}~~`;
            assistantContent += `\n`;

            if (pr.sourcesResearched > 0) {
              assistantContent += `📊 **Investigación de precios** (${pr.sourcesResearched} fuentes analizadas):\n`;
              (pr.sources || []).slice(0, 4).forEach((s: { source: string; product: string; price: number }) => {
                assistantContent += `  · ${s.source}: €${s.price} — ${s.product}\n`;
              });
              if (pr.marketAverage) assistantContent += `  📈 Media del mercado: €${pr.marketAverage}\n`;
              assistantContent += `\n`;
            }

            if (pr.justification) {
              assistantContent += `💡 **Por qué este precio:** ${pr.justification}\n\n`;
            }

            if (an?.materials?.length) {
              assistantContent += `🔬 **Materiales:** ${an.materials.join(", ")}\n`;
            }
            if (an?.qualityTier) {
              assistantContent += `⭐ **Calidad:** ${an.qualityTier}\n`;
            }
            if (an?.keyFeatures?.length) {
              assistantContent += `✨ **Features:** ${an.keyFeatures.slice(0, 4).join(" · ")}\n`;
            }

            assistantContent += `\n_El producto está en borrador. Revísalo y publícalo cuando estés listo._`;
            action = { type: "shopify-action", label: "Ver producto creado", data: prodData };
          } else {
            const errText = await prodRes.text();
            assistantContent = `❌ Error creando el producto: ${errText}`;
          }

        } else {
          const absorbingMsg = attachType === "image"
            ? `🔬 Absorbiendo imagen **${attachName}**...\n\nAnalizando: composición visual, paleta de colores, texturas y superficies, topología y geometría, técnica de rendering, composición química/técnica, inteligencia de marca, señales eCommerce, impacto psicológico...\n\n_Esto puede tardar 20-40 segundos._`
            : attachType === "video"
            ? `🎬 Absorbiendo vídeo **${attachName}**...\n\nExtrayendo: técnica de producción, estilo visual, señales de conversión, estrategia de marketing...\n\n_Procesando..._`
            : (() => {
                const urlInfo = classifyUrl(attachUrl);
                return `${urlInfo.icon} Absorbiendo **${urlInfo.label}**: ${attachUrl}\n\nExtrayendo: contenido, marca, productos, audiencia, estrategia, señales eCommerce...\n\n_Analizando con Gemini + Claude..._`;
              })();

          setMessages(m => [...m, { id: uuid(), role: "assistant", content: absorbingMsg, timestamp: new Date(), model: "gemini+claude+brain" }]);

          let result: AbsorbResult;
          if (attachFile) {
            result = await absorbFile(attachFile);
          } else {
            result = await absorbUrl(attachUrl);
          }

          const isImage = attachType === "image";
          const a = result.analysis as Record<string, Record<string, string[]>>;
          const angles = a.ecommerce_conversion_signals?.recommended_marketing_angles ?? a.actionable_insights_for_shopify?.recommended_marketing_angles as string[] ?? [];

          assistantContent = `✅ **Absorbido a Shopy Crafter**${result.memoryId ? ` (memoria #${result.memoryId.slice(0, 8)})` : ""}\n\n`;
          if (isImage && a.visual_composition) {
            assistantContent += `**Composición:** ${typeof a.visual_composition === "string" ? a.visual_composition : JSON.stringify(a.visual_composition).slice(0, 200)}\n\n`;
          }
          if (a.technical_chemical_composition) {
            assistantContent += `**Material/Técnica:** ${typeof a.technical_chemical_composition === "object" ? (a.technical_chemical_composition.manufacturing_process_indicators ?? JSON.stringify(a.technical_chemical_composition).slice(0, 150)) : a.technical_chemical_composition}\n\n`;
          }
          if (angles?.length > 0) {
            assistantContent += `**Top Marketing Angles:**\n${(Array.isArray(angles) ? angles : []).slice(0, 3).map(a => `· ${a}`).join("\n")}\n\n`;
          }
          if (content) {
            assistantContent += `\n**Tu pregunta:** ${content}\n\n`;
            const followUp = await fetch(`${API}/api/shopybrain/search`, {
              method: "POST", credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query: content, returnRaw: true, systemPrompt: SYSTEM_PROMPT, currentRoute: location }),
            });
            if (followUp.ok) {
              const d = await followUp.json();
              assistantContent += d.answer ?? "";
            }
          }
          assistantContent += `\n_Haz clic en "Ver análisis completo" para explorar las ${Object.keys(result.analysis || {}).length} dimensiones analizadas._`;
          action = { type: "absorb-result", label: "Ver análisis completo", data: result };
        }

      // ── CASE 2: Klaviyo workflow request ──
      } else if (detectKlaviyo(content)) {
        const kInfo = detectKlaviyo(content)!;
        setMessages(m => [...m, {
          id: uuid(), role: "assistant", timestamp: new Date(), model: "gemini+claude+brain",
          content: `🔄 Generando workflow Klaviyo para **${kInfo.storeName}**...\n\n**Paso 1** — Investigación del nicho ${kInfo.niche} en España\n**Paso 2** — Diseño de 6 flujos con emails HTML completos\n**Paso 3** — Guardado permanente del conocimiento\n\n_30-60 segundos..._`
        }]);

        const wfRes = await fetch(`${API}/api/klaviyo-ai/generate-workflow`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shopDomain: kInfo.shopDomain, storeName: kInfo.storeName, niche: kInfo.niche, market: "es" }),
        });

        if (wfRes.ok) {
          const wfData = await wfRes.json();
          if (wfData.plan) {
            const flowNames = wfData.plan.flows?.map((f: { name: string; emails?: unknown[] }) => `· **${f.name}** — ${f.emails?.length ?? 0} emails`).join("\n") ?? "";
            assistantContent = `✅ **Workflow completo para ${kInfo.storeName}**\n\n${wfData.plan.flows?.length ?? 0} flujos creados:\n${flowNames}\n\n**Impacto esperado:** ${wfData.plan.expected_revenue_impact}\n\nHaz clic en cada flow para ver y copiar los templates HTML.`;
            action = { type: "klaviyo-workflow", label: "Ver flows", data: wfData };
          } else {
            assistantContent = "❌ Error generando workflow. Verifica KLAVIYO_API_KEY y GEMINI_API_KEY.";
          }
        } else {
          const errBody = await wfRes.text().catch(() => "");
          assistantContent = `❌ Error generando flujo de email${errBody ? `: ${errBody.slice(0, 200)}` : ". Verifica la configuración de Klaviyo."}`;
        }

      // ── CASE 3: Entity research — URL, @handle, brand name, "investiga X" ──
      } else if (content.match(/https?:\/\/[^\s]+/) || detectEntityResearch(content)) {
        const entityInput = content.match(/https?:\/\/[^\s]+/)?.[0] ?? detectEntityResearch(content) ?? content;
        const entityDisplay = entityInput.length > 50 ? entityInput.slice(0, 50) + "..." : entityInput;

        setMessages(m => [...m, {
          id: uuid(), role: "assistant", timestamp: new Date(), model: "gemini+claude+brain",
          content: `🔬 **Investigación exhaustiva paralela iniciada**\n\n**Objetivo:** ${entityDisplay}\n\n**Ejecutando en paralelo:**\n· 🌐 8 búsquedas Google (brand overview, productos, redes sociales, noticias, reviews, competidores, eCommerce, identidad visual)\n· 🔗 Descubrimiento y análisis de fuentes relacionadas\n· 🧠 Síntesis inteligente de todo el conocimiento\n· 💾 Guardado permanente en Shopy Crafter\n\n_⏱️ Esto toma 30-90 segundos. Ejecutando todas las búsquedas simultáneamente..._`
        }]);

        const researchResult = await researchEntity(entityInput);

        assistantContent = `✅ **Investigación completada: ${researchResult.entity}**\n\n`;
        assistantContent += `📊 **${researchResult.queriesExecuted} búsquedas Google** ejecutadas en paralelo\n`;
        assistantContent += `🔗 **${researchResult.sourcesFound} fuentes** descubiertas y analizadas\n`;
        assistantContent += `💾 **${researchResult.memoriesSaved} memorias** guardadas en Shopy Crafter\n`;
        assistantContent += `⏱️ Completado en **${researchResult.elapsed}**\n\n`;

        const p = researchResult.profile;
        if (p.description) assistantContent += `**Descripción:** ${p.description}\n\n`;
        if (p.ecommerceStack?.platform) assistantContent += `**Plataforma:** ${p.ecommerceStack.platform} · Email: ${p.ecommerceStack.emailTool}\n`;
        if (p.shopifyOpportunities?.[0]) assistantContent += `\n**Top oportunidad Shopify:** ${p.shopifyOpportunities[0]}\n`;

        if (content !== entityInput && !content.startsWith("http")) {
          assistantContent += `\n**Tu pregunta:** `;
          const followUp = await fetch(`${API}/api/shopybrain/search`, {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: content, returnRaw: true, systemPrompt: SYSTEM_PROMPT, currentRoute: location }),
          });
          if (followUp.ok) { const d = await followUp.json(); assistantContent += d.answer ?? ""; }
        }

        assistantContent += `\n_Explora las pestañas del panel para ver social, productos, competidores y más._`;
        action = { type: "entity-research", label: "Ver perfil completo", data: researchResult };

      // ── CASE 4: Regular chat (with Shopify action detection) ──
      } else {
        const convHistory = messages.slice(-8).map(m => `${m.role === "user" ? "Usuario" : "Shopy Crafter"}: ${m.content}`).join("\n\n");
        const projectIdFromUrl = location.match(/\/projects\/(\d+)/)?.[1];
        const res = await fetch(`${API}/api/shopybrain/search`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: content, returnRaw: true, systemPrompt: SYSTEM_PROMPT, conversationHistory: convHistory, currentRoute: location, activeProjectId: projectIdFromUrl }),
        });
        if (res.ok) {
          const d = await res.json();
          assistantContent = d.answer ?? d.result ?? "No pude procesar la respuesta.";

          const longActions: Record<string, string> = {
            generate_competitive_pricing: "🔍 **Investigación de mercado en curso...**\n\n**Paso 1** — Buscando precios reales de competidores con Google Search\n**Paso 2** — Analizando posicionamiento del mercado\n**Paso 3** — Generando catálogo de precios competitivo\n**Paso 4** — Actualizando CMS y creando productos en Shopify\n\n_⏱️ Esto toma 30-90 segundos. Investigando datos reales del mercado..._",
            copyright_audit: "⚖️ **Auditoría de Copyright en curso...**\n\n**Paso 1** — Cargando catálogo completo de Shopify\n**Paso 2** — Analizando cada producto buscando marcas registradas y derechos de autor\n**Paso 3** — Generando sugerencias de nombres alternativos\n\n_⏱️ 15-30 segundos..._",
            audit_app_offerings: "🔍 **Auditando la oferta de Shopy Crafter...**\n\n**Paso 1** — Leyendo planes y features actuales del CMS\n**Paso 2** — Comparando con capacidades reales de la plataforma\n**Paso 3** — Analizando pricing vs. valor entregado\n**Paso 4** — Generando recomendaciones estratégicas\n\n_⏱️ Analizando... 15-30 segundos._",
            scan_store: "📊 **Escaneando tienda Shopify...**\n\n**Paso 1** — Conectando con Shopify API\n**Paso 2** — Descargando catálogo completo\n**Paso 3** — Analizando calidad de cada producto\n\n_⏱️ Dependiendo del catálogo, 10-60 segundos..._",
            optimize_all_products: "🧠 **Optimización masiva con IA...**\n\n**Paso 1** — Cargando productos de Shopify\n**Paso 2** — Claude genera SEO + copywriting para cada producto\n**Paso 3** — Actualizando títulos, descripciones, tags y meta\n\n_⏱️ ~5 segundos por producto..._",
            design_all_pages: "📄 **Diseñando páginas de la tienda...**\n\n**Paso 1** — Analizando nicho y marca\n**Paso 2** — Claude genera contenido profesional para cada página\n**Paso 3** — Creando páginas en Shopify\n\n_⏱️ ~10 segundos por página..._",
            search_suppliers: "🔍 **Investigando proveedores...**\n\n**Paso 1** — 6 búsquedas Google paralelas (proveedores, fábricas, mayoristas...)\n**Paso 2** — Analizando costes, MOQs y tiempos de entrega\n**Paso 3** — Claude genera informe estratégico\n\n_⏱️ 30-60 segundos..._",
            diagnose_app: "🔬 **Diagnóstico de la app en curso...**\n\n**Paso 1** — Verificando tokens y conectividad\n**Paso 2** — Comprobando sincronización de datos\n**Paso 3** — Reparando automáticamente lo que sea posible\n\n_⏱️ 10-20 segundos..._",
            create_product: "🛍️ **Creando producto profesional 100/100...**\n\n**Paso 1** — Investigando precios del mercado real\n**Paso 2** — Claude genera título SEO + descripción 800-1200 palabras\n**Paso 3** — Generando tags, meta tags y schema\n**Paso 4** — Generando imágenes IA profesionales\n\n_⏱️ ~15-30 segundos por producto..._",
            redesign_product: "✨ **Rediseñando producto con calidad 100/100...**\n\n**Paso 1** — Analizando producto actual\n**Paso 2** — Generando nuevo contenido Semrush-level\n**Paso 3** — Optimizando SEO + pricing\n\n_⏱️ ~15 segundos..._",
            bulk_redesign: "🚀 **Rediseño masivo en curso...**\n\n**Paso 1** — Cargando catálogo completo\n**Paso 2** — Claude rediseña cada producto con calidad 100/100\n\n_⏱️ ~10 segundos por producto..._",
            seo_full_audit: "🔍 **Auditoría SEO Semrush-level en curso...**\n\n**Paso 1** — Evaluando 16 criterios ponderados por producto\n**Paso 2** — Keyword consistency + readability analysis\n**Paso 3** — Generando plan de mejoras priorizado\n\n_⏱️ 15-30 segundos..._",
            keyword_intelligence: "🔑 **Investigando keywords...**\n\n**Paso 1** — Buscando volumen y dificultad con Google Search\n**Paso 2** — Analizando autocomplete y People Also Ask\n**Paso 3** — Generando estrategia de keywords\n\n_⏱️ 15-30 segundos..._",
            blog_strategy: "📝 **Generando estrategia de blog...**\n\n**Paso 1** — Analizando productos y nicho\n**Paso 2** — Creando pillar content + cluster topics\n**Paso 3** — Generando calendario editorial\n\n_⏱️ 20-40 segundos..._",
            generate_blog_post: "📄 **Escribiendo artículo SEO...**\n\n**Paso 1** — Investigando keyword objetivo\n**Paso 2** — Claude escribe artículo optimizado\n\n_⏱️ 15-30 segundos..._",
            setup_full_store: "🏗️ **Configuración completa de tienda...**\n\n**Paso 1** — Sincronizando productos\n**Paso 2** — Generando meta tags SEO\n**Paso 3** — Optimizando alt texts\n**Paso 4** — Generando schemas JSON-LD\n\n_⏱️ 30-60 segundos..._",
            learn_from_url: "🧠 **Absorbiendo URL...**\n\n**Paso 1** — Descargando contenido\n**Paso 2** — Extrayendo conocimiento con IA\n**Paso 3** — Almacenando en memoria permanente\n\n_⏱️ 10-20 segundos..._",
            learn_from_content: "🧠 **Procesando contenido...**\n\n**Paso 1** — Analizando texto\n**Paso 2** — Extrayendo insights\n**Paso 3** — Memorizando conocimiento\n\n_⏱️ 5-15 segundos..._",
            recall_knowledge: "🔍 **Buscando en la memoria...**\n\n_⏱️ 2-5 segundos..._",
            brain_status: "🧠 **Consultando estado del cerebro...**\n\n_⏱️ 2-5 segundos..._",
            generate_email_flow: "📧 **Creando flujo de email marketing...**\n\n**Paso 1** — Analizando tienda y nicho\n**Paso 2** — Generando secuencia de emails con IA\n**Paso 3** — Optimizando asuntos y contenido\n\n_⏱️ 20-40 segundos..._",
            financial_forecast: "📊 **Generando forecast financiero...**\n\n**Paso 1** — Analizando datos históricos\n**Paso 2** — Calculando escenarios\n**Paso 3** — Proyectando revenue a 6 meses\n\n_⏱️ 15-30 segundos..._",
            agency_proposal: "📋 **Generando propuesta comercial...**\n\n**Paso 1** — Analizando tienda del cliente\n**Paso 2** — Calculando servicios necesarios\n**Paso 3** — Creando propuesta profesional\n\n_⏱️ 20-40 segundos..._",
            bulk_generate_images: "🎨 **Generando imágenes IA en lote...**\n\n**Paso 1** — Preparando prompts por producto\n**Paso 2** — Flux genera imágenes profesionales\n\n_⏱️ ~3 segundos por imagen..._",
          };

          const allActions = d.detectedActions ?? (d.detectedAction ? [d.detectedAction] : []);

          if (allActions.length > 0) {
            const firstAction = allActions[0].action;
            if (longActions[firstAction]) {
              setMessages(m => [...m, {
                id: uuid(), role: "assistant", timestamp: new Date(), model: "gemini+claude+brain",
                content: allActions.length > 1
                  ? `⚡ **Ejecutando ${allActions.length} acciones en secuencia...**\n\n${longActions[firstAction]}`
                  : longActions[firstAction],
              }]);
            } else if (allActions.length > 1) {
              setMessages(m => [...m, {
                id: uuid(), role: "assistant", timestamp: new Date(), model: "gemini+claude+brain",
                content: `⚡ **Ejecutando ${allActions.length} acciones en secuencia...**`,
              }]);
            }

            const results: string[] = [];
            for (const act of allActions) {
              const actionResult = await executeShopifyAction(act.action, act.params);
              if (actionResult) {
                const formatted = formatActionResult(act.action, actionResult);
                results.push(formatted);
                const actionType = act.action === "search_suppliers" ? "supplier-research" : "shopify-action";
                action = { type: actionType as ChatAction["type"], label: actionType === "supplier-research" ? "Descargar informe" : "Ver resultado", data: actionResult, actionName: act.action, formattedContent: formatted };
              }
            }
            if (results.length > 0) {
              assistantContent += "\n\n" + results.join("\n\n---\n\n");
            }
          }
        } else {
          assistantContent = "Error de conexión con el servidor. Intenta de nuevo.";
        }
      }

      setMessages(m => {
        const progressIndicators = ["Absorbiendo", "Generando workflow", "detectada. Absorbiendo", "Investigación exhaustiva paralela iniciada", "Investigación de mercado en curso", "Auditando la oferta", "Escaneando tienda Shopify", "Optimización masiva con IA", "Diseñando páginas de la tienda", "Investigando proveedores...", "Diagnóstico de la app en curso", "Ejecutando", "acciones en secuencia", "Creando producto profesional", "Rediseñando producto", "Rediseño masivo", "Auditoría SEO Semrush", "Investigando keywords", "Generando estrategia de blog", "Escribiendo artículo SEO", "Configuración completa de tienda", "Creando flujo de email", "Generando forecast financiero", "Generando propuesta comercial", "Generando imágenes IA"];
        const filtered = m.filter(msg => !(msg.role === "assistant" && progressIndicators.some(p => msg.content.includes(p))));
        return [...filtered, { id: uuid(), role: "assistant" as const, content: assistantContent, timestamp: new Date(), model: "gemini+claude+brain", action }];
      });
    } catch (err) {
      setMessages(m => [...m, { id: uuid(), role: "assistant" as const, content: `❌ Error: ${err instanceof Error ? err.message : "Fallo de conexión"}`, timestamp: new Date() }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, loading, messages, attachFile, attachUrl]);

  useEffect(() => {
    if (!isListening && pendingTranscriptRef.current) {
      const t = pendingTranscriptRef.current;
      pendingTranscriptRef.current = null;
      sendMessage(t);
    }
  }, [isListening, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (!user) return null;

  return (
    <>
      {selectedFlow && <FlowModal flow={selectedFlow} onClose={() => setSelectedFlow(null)} />}

      {/* Floating button */}
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="Abrir asistente Shopy Crafter" style={{
          position: "fixed", bottom: isMobile ? 12 : 24, right: isMobile ? 12 : 24, width: isMobile ? 52 : 58, height: isMobile ? 52 : 58,
          borderRadius: "50%", background: "linear-gradient(135deg, #c8a84b, #e6c668)",
          border: "none", cursor: "pointer", zIndex: 1000,
          boxShadow: "0 4px 24px rgba(200,168,75,0.45), 0 0 0 0 rgba(200,168,75,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "pulseGold 3s ease-in-out infinite",
        }}>
          <Brain size={isMobile ? 22 : 26} style={{ color: "#0a0a0f" }} />
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div
          ref={dropZoneRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            position: "fixed",
            bottom: isMobile ? 0 : 24, right: isMobile ? 0 : 24,
            width: isMobile ? "100%" : (minimized ? 290 : 440),
            height: isMobile ? (minimized ? 52 : "100dvh") : (minimized ? 52 : 640),
            ...(isMobile ? { left: 0 } : {}),
            background: "var(--ink)",
            border: isMobile ? "none" : `1px solid ${isDragging ? "var(--jade)" : "rgba(200,168,75,0.28)"}`,
            borderRadius: isMobile ? 0 : 16, zIndex: 1000, display: "flex", flexDirection: "column",
            boxShadow: isDragging ? "0 0 0 2px var(--jade), 0 8px 40px rgba(0,0,0,0.6)" : "0 8px 40px rgba(0,0,0,0.6)",
            transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)", overflow: "hidden",
          }}>

          {/* Header */}
          <div style={{ padding: "12px 14px", borderBottom: minimized ? "none" : "1px solid var(--ink3)", background: "linear-gradient(135deg, rgba(200,168,75,0.07), rgba(200,168,75,0.03))", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, var(--gold), #a07830)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Brain size={16} style={{ color: "#fff" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--t)" }}>Shopy Crafter · Asistente</p>
              {!minimized && <p style={{ margin: 0, fontSize: 9, color: "var(--jade)" }}>🔬 Gemini · 🧠 Claude · 💾 Brain — Listo</p>}
            </div>
            <div style={{ display: "flex", gap: isMobile ? 8 : 4 }}>
              <button onClick={() => setMinimized(!minimized)} aria-label={minimized ? "Expandir chat" : "Minimizar chat"} style={{ width: isMobile ? 36 : 24, height: isMobile ? 36 : 24, borderRadius: isMobile ? 8 : 5, border: "none", background: "var(--ink2)", color: "var(--t3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {minimized ? <Maximize2 size={isMobile ? 16 : 11} /> : <Minimize2 size={isMobile ? 16 : 11} />}
              </button>
              <button onClick={() => setOpen(false)} aria-label="Cerrar chat" style={{ width: isMobile ? 36 : 24, height: isMobile ? 36 : 24, borderRadius: isMobile ? 8 : 5, border: "none", background: "var(--ink2)", color: "var(--t3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={isMobile ? 16 : 11} />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Drag overlay indicator */}
              {isDragging && (
                <div style={{ position: "absolute", inset: 52, background: "rgba(45,212,159,0.08)", border: "2px dashed var(--jade)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, pointerEvents: "none" }}>
                  <div style={{ textAlign: "center" }}>
                    <Upload size={28} style={{ color: "var(--jade)", marginBottom: 8 }} />
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--jade)" }}>Suelta para absorber a Shopy Crafter</p>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "14px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
                {messages.map(msg => (
                  <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{
                      maxWidth: "90%", padding: "10px 12px",
                      borderRadius: msg.role === "user" ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
                      background: msg.role === "user" ? "rgba(200,168,75,0.12)" : "var(--ink2)",
                      border: `1px solid ${msg.role === "user" ? "rgba(200,168,75,0.25)" : "var(--ink3)"}`,
                      fontSize: isMobile ? 14 : 12, lineHeight: 1.6, color: "var(--t)",
                    }}>
                      {msg.role === "assistant" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                          <Brain size={10} style={{ color: "var(--gold)", flexShrink: 0 }} />
                          <span style={{ fontSize: 9, color: "var(--gold)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Shopy Crafter</span>
                        </div>
                      )}
                      {msg.attachmentType && (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 8px", background: "rgba(200,168,75,0.08)", borderRadius: 5, marginBottom: 6, width: "fit-content" }}>
                          {msg.attachmentType === "image" ? <Image size={10} style={{ color: "var(--gold)" }} /> : msg.attachmentType === "video" ? <Video size={10} style={{ color: "var(--gold)" }} /> : <Link size={10} style={{ color: "var(--gold)" }} />}
                          <span style={{ fontSize: 9, color: "var(--gold)" }}>{msg.attachmentName?.slice(0, 40)}</span>
                        </div>
                      )}
                      <div>{formatMessage(msg.content)}</div>
                      {msg.action?.type === "absorb-result" && (
                        <AbsorbResultCard data={msg.action.data as AbsorbResult} />
                      )}
                      {msg.action?.type === "klaviyo-workflow" && (
                        <KlaviyoResultCard data={msg.action.data as KlaviyoWorkflowResult} onViewFlow={setSelectedFlow} />
                      )}
                      {msg.action?.type === "entity-research" && (
                        <EntityResearchCard data={msg.action.data as EntityResearchResult} />
                      )}
                      {msg.action?.actionName && (() => {
                        const prods = extractProductsFromAction(msg.action!.actionName!, msg.action!.data);
                        return prods ? <ProductCardsGrid products={prods} /> : null;
                      })()}
                      {msg.action?.actionName && (
                        <ActionButtons
                          actionName={msg.action.actionName}
                          content={msg.action.formattedContent || msg.content}
                          rawData={msg.action.data}
                          isMobile={isMobile}
                        />
                      )}
                    </div>
                    <span style={{ fontSize: 9, color: "var(--t4)", marginTop: 3, paddingLeft: 4, paddingRight: 4 }}>
                      {msg.timestamp.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
                {loading && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--ink2)", borderRadius: "12px 12px 12px 3px", border: "1px solid var(--ink3)", maxWidth: "60%", alignSelf: "flex-start" }}>
                    <Loader2 size={12} style={{ color: "var(--gold)", animation: "spin 1s linear infinite" }} />
                    <span style={{ fontSize: 11, color: "var(--t3)" }}>Shopy Crafter procesando...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div style={{ padding: "8px 12px 10px", borderTop: "1px solid var(--ink3)", flexShrink: 0 }}>
                {/* Quick actions */}
                <button onClick={() => setShowActions(!showActions)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "var(--t3)", fontSize: 10, cursor: "pointer", marginBottom: 5, padding: "2px 0" }}>
                  <Sparkles size={10} />
                  Acciones rápidas
                  <ChevronDown size={9} style={{ transform: showActions ? "rotate(180deg)" : "rotate(0)", transition: "0.2s" }} />
                </button>
                {showActions && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(120px, 100%), 1fr))", gap: 4, marginBottom: 6 }}>
                    {QUICK_ACTIONS.map((action, i) => (
                      <button key={i} onClick={() => {
                        setShowActions(false);
                        if ("isResearch" in action && action.isResearch) {
                          const entity = prompt("¿Qué marca, empresa o persona quieres investigar?\n\nPuedes escribir: URL, nombre, @instagram, dominio...");
                          if (entity?.trim()) sendMessage(entity.trim());
                        } else {
                          sendMessage(action.prompt);
                        }
                      }}
                        style={{
                          textAlign: "left", padding: "6px 8px",
                          background: "isResearch" in action && action.isResearch ? "rgba(200,168,75,0.1)" : "var(--ink2)",
                          border: `1px solid ${"isResearch" in action && action.isResearch ? "rgba(200,168,75,0.4)" : "var(--ink3)"}`,
                          borderRadius: 6, cursor: "pointer", fontSize: 10,
                          color: "isResearch" in action && action.isResearch ? "var(--gold)" : "var(--t2)",
                          display: "flex", alignItems: "center", gap: 5,
                        }}>
                        <span>{action.icon}</span>
                        <span style={{ lineHeight: 1.2 }}>{action.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Attach panel */}
                {showAttach && (
                  <div style={{ marginBottom: 8, padding: 10, background: "var(--ink2)", borderRadius: 8, border: "1px solid var(--ink3)" }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                      <button onClick={() => fileInputRef.current?.click()}
                        style={{ flex: 1, padding: "7px 10px", background: "rgba(200,168,75,0.07)", border: "1px dashed rgba(200,168,75,0.3)", borderRadius: 6, cursor: "pointer", fontSize: 10, color: "var(--gold)", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                        <Upload size={12} /> Subir imagen/vídeo
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input value={urlInput} onChange={e => setUrlInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleUrlAdd(); } }}
                        placeholder="Pega URL: Instagram, Facebook, X, YouTube, web..."
                        style={{ flex: 1, padding: "6px 10px", background: "var(--ink)", border: "1px solid var(--ink3)", borderRadius: 6, color: "var(--t)", fontSize: 11, outline: "none" }} />
                      <button onClick={handleUrlAdd} disabled={!urlInput.trim()}
                        style={{ padding: "6px 10px", background: urlInput.trim() ? "var(--jade)" : "var(--ink3)", border: "none", borderRadius: 6, cursor: urlInput.trim() ? "pointer" : "not-allowed", color: urlInput.trim() ? "var(--ink)" : "var(--t4)", fontSize: 11, fontWeight: 600 }}>
                        Añadir
                      </button>
                    </div>
                    <p style={{ margin: "6px 0 0", fontSize: 9, color: "var(--t4)" }}>
                      También puedes <strong style={{ color: "var(--t3)" }}>arrastrar y soltar</strong> archivos directamente en el chat
                    </p>
                  </div>
                )}

                {/* Attachment preview */}
                {(attachFile || attachUrl) && (
                  <AttachmentPreview file={attachFile} url={attachUrl} onRemove={() => { setAttachFile(null); setAttachUrl(""); }} />
                )}

                {/* Text input row */}
                <div style={{ display: "flex", gap: isMobile ? 8 : 6, alignItems: "flex-end" }}>
                  <button onClick={() => setShowAttach(!showAttach)} aria-label="Adjuntar archivo"
                    style={{ width: isMobile ? 44 : 32, height: isMobile ? 44 : 32, borderRadius: isMobile ? 10 : 8, border: `1px solid ${showAttach ? "var(--gold)" : "var(--ink3)"}`, background: showAttach ? "rgba(200,168,75,0.1)" : "var(--ink2)", color: showAttach ? "var(--gold)" : "var(--t3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: isMobile ? 18 : 14 }}>
                    📎
                  </button>
                  <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} disabled={loading}
                    placeholder={isListening ? "🎙 Escuchando..." : attachFile || attachUrl ? "Opcional: añade contexto..." : "Escribe, pega una URL, o arrastra un archivo..."}
                    rows={1}
                    style={{ flex: 1, padding: isMobile ? "10px 12px" : "8px 10px", background: isListening ? "rgba(232,69,88,0.08)" : "var(--ink2)", border: `1px solid ${isListening ? "var(--crim)" : "var(--ink3)"}`, borderRadius: isMobile ? 10 : 8, color: "var(--t)", fontSize: isMobile ? 16 : 12, resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.4, maxHeight: isMobile ? 100 : 80, overflowY: "auto", transition: "border-color 0.2s, background 0.2s" }}
                    onInput={e => { const el = e.target as HTMLTextAreaElement; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, isMobile ? 100 : 80)}px`; }}
                  />
                  <button onClick={toggleMic} disabled={loading} aria-label={isListening ? "Detener micrófono" : "Activar micrófono"}
                    style={{
                      width: isMobile ? 44 : 32, height: isMobile ? 44 : 32, borderRadius: isMobile ? 10 : 8, border: "none", flexShrink: 0,
                      background: isListening ? "var(--crim)" : "var(--ink2)",
                      color: isListening ? "#fff" : "var(--t3)",
                      cursor: loading ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
                      animation: isListening ? "pulseGold 1.5s ease-in-out infinite" : "none",
                    }}>
                    {isListening ? <MicOff size={isMobile ? 18 : 14} /> : <Mic size={isMobile ? 18 : 14} />}
                  </button>
                  <button onClick={() => sendMessage()} disabled={loading || (!input.trim() && !attachFile && !attachUrl)} aria-label="Enviar mensaje"
                    style={{
                      width: isMobile ? 44 : 32, height: isMobile ? 44 : 32, borderRadius: isMobile ? 10 : 8, border: "none", flexShrink: 0,
                      background: loading || (!input.trim() && !attachFile && !attachUrl) ? "var(--ink3)" : "var(--gold)",
                      color: loading || (!input.trim() && !attachFile && !attachUrl) ? "var(--t4)" : "var(--ink)",
                      cursor: loading || (!input.trim() && !attachFile && !attachUrl) ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
                    }}>
                    {loading ? <Loader2 size={isMobile ? 18 : 14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={isMobile ? 18 : 14} />}
                  </button>
                </div>

                {/* Footer badges */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5, justifyContent: "center" }}>
                  {[["🔬", "Gemini"], ["🧠", "Claude"], ["💾", "Brain"], ["👁", "Visión"]].map(([icon, label]) => (
                    <span key={label} style={{ fontSize: 9, color: "var(--t4)", display: "flex", alignItems: "center", gap: 3 }}>{icon} {label}</span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={handleFileSelect} />

      <style>{`
        @keyframes pulseGold {
          0%, 100% { box-shadow: 0 4px 24px rgba(200,168,75,0.4), 0 0 0 0 rgba(200,168,75,0.3); }
          50% { box-shadow: 0 4px 32px rgba(200,168,75,0.7), 0 0 0 10px rgba(200,168,75,0.05); }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
