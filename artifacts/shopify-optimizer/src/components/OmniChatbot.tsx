/**
 * Shopy Crafter — Asistente Inteligente
 * Absorbe TODO: imágenes, vídeos, URLs, Instagram, Facebook, X, YouTube...
 */
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Brain, X, Send, Loader2, Minimize2, Maximize2, Sparkles, ChevronDown,
  Link, Image, Video, Upload, Eye, Palette, Layers, Cpu, Globe,
  Instagram, Twitter, Facebook, Youtube, CheckCircle, ZapIcon, HelpCircle, Mic, MicOff,
  Volume2, VolumeX
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSafeTimeout } from "@/hooks/useSafeTimeout";
import { useDraggable } from "@/hooks/use-draggable";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface MsgUsage {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
  costUsd: number;
  model: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  model?: string;
  attachmentType?: "image" | "video" | "url";
  attachmentName?: string;
  action?: ChatAction;
  usage?: MsgUsage;
}

function fmtTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function fmtCost(usd: number): string {
  if (usd < 0.0001) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

interface ChatAction {
  type: "klaviyo-workflow" | "absorb-result" | "entity-research" | "shopify-action" | "supplier-research" | "browser-action";
  label: string;
  data: unknown;
  actionName?: string;
  formattedContent?: string;
}

interface BrowserActionResult {
  success: boolean;
  goal: string;
  finalUrl?: string;
  openUrl?: string;
  title?: string;
  screenshots: Array<{ label: string; dataUrl: string }>;
  youtubeEmbed?: string;
  extractedText?: string;
  stepsExecuted: number;
  stepsOk: number;
  message: string;
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

const URL_REGEX = /https?:\/\/[^\s\])"'>]+/g;

function GeminiImageCard({ src, alt }: { src: string; alt: string }) {
  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = src;
    a.download = "gemini-imagen.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  const handleFullscreen = () => {
    const win = window.open("", "_blank", "noopener,noreferrer");
    if (win) {
      win.opener = null;
      const doc = win.document;
      doc.title = "Gemini Image";
      const style = doc.createElement("style");
      style.textContent = "body{margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh;}img{max-width:100vw;max-height:100vh;object-fit:contain;}";
      doc.head.appendChild(style);
      const img = doc.createElement("img");
      img.src = src;
      img.alt = alt;
      doc.body.appendChild(img);
    }
  };
  return (
    <div style={{ margin: "10px 0", display: "inline-block", maxWidth: "100%" }}>
      <img
        src={src}
        alt={alt}
        style={{ maxWidth: "100%", maxHeight: 400, borderRadius: 8, display: "block", border: "1px solid var(--ink3)", cursor: "pointer" }}
        onClick={handleFullscreen}
        title="Haz clic para ver en pantalla completa"
      />
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <button
          onClick={handleDownload}
          style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, border: "1px solid var(--ink3)", background: "var(--ink2)", color: "var(--t)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
        >
          ⬇ Descargar
        </button>
        <button
          onClick={handleFullscreen}
          style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, border: "1px solid var(--ink3)", background: "var(--ink2)", color: "var(--t)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
        >
          ⛶ Pantalla completa
        </button>
      </div>
    </div>
  );
}

function formatInlineText(content: string, segIdx: number): React.ReactNode[] {
  const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_\n]+_|\n|https?:\/\/[^\s\])"'>]+)/g);
  return parts.map((part, i) => {
    const key = `s${segIdx}-${i}`;
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={key} style={{ color: "var(--gold)", fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={key} style={{ background: "var(--ink3)", padding: "1px 5px", borderRadius: 4, fontSize: 11, fontFamily: "monospace", color: "var(--jade)" }}>{part.slice(1, -1)}</code>;
    if (part.startsWith("_") && part.endsWith("_"))
      return <em key={key} style={{ opacity: 0.75, fontStyle: "italic" }}>{part.slice(1, -1)}</em>;
    if (part === "\n") return <br key={key} />;
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0;
      return (
        <a
          key={key}
          href={part}
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--gold)", textDecoration: "underline", wordBreak: "break-all" }}
          onClick={(e) => { e.stopPropagation(); window.open(part, "_blank", "noreferrer"); e.preventDefault(); }}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

// IMAGE_MD_RE matches ![alt](data:... or https://...)
const IMAGE_MD_RE = /!\[([^\]]*)\]\(((?:data:|https?:\/\/)[^)]{4,})\)/g;

function formatMessage(content: string): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let segIdx = 0;
  let match: RegExpExecArray | null;

  IMAGE_MD_RE.lastIndex = 0;
  while ((match = IMAGE_MD_RE.exec(content)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(...formatInlineText(content.slice(lastIndex, match.index), segIdx++));
    }
    nodes.push(<GeminiImageCard key={`img-${segIdx}`} src={match[2]} alt={match[1] || "Imagen generada"} />);
    segIdx++;
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    nodes.push(...formatInlineText(content.slice(lastIndex), segIdx));
  }

  return nodes.length > 0 ? nodes : formatInlineText(content, 0);
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
  hasMetaTitle?: boolean;
  hasMetaDesc?: boolean;
  hasSchema?: boolean;
  hasAltTexts?: boolean;
  cleanHandle?: boolean;
  published?: boolean;
  issues?: string[];
}

function getCardRecommendations(p: ProductCardItem) {
  const recs: Array<{ dim: string; icon: string; status: "ok" | "warn" | "bad"; what: string; why: string; impact: string }> = [];
  const imgCount = p.imageCount ?? 0;
  const descLen = p.descriptionLength ?? p.descLength ?? 0;
  const tags = p.tagsCount ?? 0;
  const hasCompare = p.hasComparePrice ?? p.hasCompare ?? false;

  if (imgCount === 0) recs.push({ dim: "Imagenes", icon: "📷", status: "bad", what: `0 imagenes`, why: "Sin imagenes el producto no genera confianza", impact: "+80% conversion con galeria" });
  else if (imgCount < 4) recs.push({ dim: "Imagenes", icon: "📷", status: "warn", what: `${imgCount} imagen${imgCount > 1 ? "es" : ""}`, why: `Añadir ${4 - imgCount} mas (Hero, Lifestyle, Detalle)`, impact: "+30-50% conversion" });
  else if (imgCount < 8) recs.push({ dim: "Imagenes", icon: "📷", status: "warn", what: `${imgCount} imagenes`, why: "Ampliar a 8+ con variantes y close-ups", impact: "+15-25% conversion" });
  else recs.push({ dim: "Imagenes", icon: "📷", status: "ok", what: `${imgCount} imagenes`, why: "Galeria completa y profesional", impact: "Confianza maximizada" });

  if (descLen < 200) recs.push({ dim: "Descripcion", icon: "📝", status: "bad", what: `${descLen}ch — muy corta`, why: "Añadir beneficios, FAQ, trust signals", impact: "+40% SEO + conversion" });
  else if (descLen < 500) recs.push({ dim: "Descripcion", icon: "📝", status: "warn", what: `${descLen}ch`, why: "Ampliar con secciones de uso y FAQ", impact: "+20-30% conversion" });
  else if (descLen < 1000) recs.push({ dim: "Descripcion", icon: "📝", status: "warn", what: `${descLen}ch`, why: "Añadir storytelling y garantias", impact: "+10-15% conversion" });
  else recs.push({ dim: "Descripcion", icon: "📝", status: "ok", what: `${descLen}ch`, why: "Descripcion completa y detallada", impact: "SEO optimizado" });

  if (tags < 5) recs.push({ dim: "Tags", icon: "🏷", status: "bad", what: `${tags} tags`, why: "Añadir 10+ tags para busqueda interna", impact: "+25% descubrimiento" });
  else if (tags < 10) recs.push({ dim: "Tags", icon: "🏷", status: "warn", what: `${tags} tags`, why: "Añadir tags de material, uso, estilo", impact: "+15% descubrimiento" });
  else recs.push({ dim: "Tags", icon: "🏷", status: "ok", what: `${tags} tags`, why: "Taxonomia completa", impact: "Busqueda optimizada" });

  if (!hasCompare) recs.push({ dim: "Precio", icon: "💰", status: "warn", what: "Sin compare_at_price", why: "Precio tachado aumenta urgencia de compra", impact: "+15-25% conversion" });
  else recs.push({ dim: "Precio", icon: "💰", status: "ok", what: "Precio tachado activo", why: "Estrategia de anclaje de precio", impact: "Urgencia activada" });

  if (p.hasMetaTitle === false) recs.push({ dim: "SEO Title", icon: "🔍", status: "warn", what: "Meta title debil", why: "Keyword-first con <60ch para CTR", impact: "+20% clicks organicos" });
  if (p.hasMetaDesc === false) recs.push({ dim: "SEO Desc", icon: "🔍", status: "warn", what: "Meta descripcion corta", why: "Añadir 155ch con CTA y beneficio", impact: "+15% CTR" });
  if (p.hasAltTexts === false) recs.push({ dim: "Alt Texts", icon: "🖼", status: "warn", what: "Imagenes sin alt text", why: "Esencial para SEO de imagenes", impact: "+10% trafico organico" });
  if (p.cleanHandle === false) recs.push({ dim: "Handle", icon: "🔗", status: "warn", what: "URL no optimizada", why: "Usar guiones, keywords, sin underscores", impact: "+5% SEO" });

  return recs;
}

function ProductCardsGrid({ products }: { products: ProductCardItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const [detailIdx, setDetailIdx] = useState<number | null>(null);
  const visible = expanded ? products : products.slice(0, 4);

  const gradeColor = (g: string) =>
    g === "A" ? "#34d399" : g === "B" ? "#c8a84b" : g === "C" ? "#f59e0b" : "#f43f5e";
  const gradeBg = (g: string) =>
    g === "A" ? "rgba(52,211,153,.1)" : g === "B" ? "rgba(200,168,75,.1)" : g === "C" ? "rgba(245,158,11,.1)" : "rgba(244,63,94,.1)";
  const checkOrWarn = (ok: boolean) =>
    ok ? <span style={{ color: "#34d399", fontSize: 10 }}>&#10003;</span> : <span style={{ color: "#f59e0b", fontSize: 10 }}>&#9888;</span>;
  const imgQuality = (count: number) =>
    count >= 8 ? <span style={{ color: "#fbbf24", fontSize: 10 }}>&#9733;</span> :
    count >= 4 ? <span style={{ color: "#34d399", fontSize: 10 }}>&#10003;</span> :
    <span style={{ color: "#f43f5e", fontSize: 10 }}>&#9888;</span>;
  const recStatusColor = (s: "ok" | "warn" | "bad") =>
    s === "ok" ? "#34d399" : s === "warn" ? "#f59e0b" : "#f43f5e";

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, 100%), 1fr))", gap: 8 }}>
        {visible.map((p, i) => {
          const grade = p.auditGrade || p.grade || "D";
          const score = p.auditScore ?? p.score ?? 0;
          const imgCount = p.imageCount ?? 0;
          const descLen = p.descriptionLength ?? p.descLength ?? 0;
          const tags = p.tagsCount ?? 0;
          const variants = p.variantCount ?? 1;
          const hasCompare = p.hasComparePrice ?? p.hasCompare ?? false;
          const price = parseFloat(p.price || "0");
          const recs = getCardRecommendations(p);
          const showDetail = detailIdx === i;

          return (
            <div key={i} style={{
              background: "var(--ink2)", border: "1px solid var(--ink3)", borderRadius: 10,
              overflow: "hidden", position: "relative", cursor: "pointer",
              gridColumn: showDetail ? "1 / -1" : undefined,
            }} onClick={() => setDetailIdx(showDetail ? null : i)}>
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
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "0 8px 4px", fontSize: 9, color: "var(--t3)" }}>
                <span>{imgQuality(imgCount)} {imgCount}img</span>
                <span>{checkOrWarn(descLen >= 500)} {descLen}ch</span>
                <span>{checkOrWarn(tags >= 10)} {tags}tags</span>
                <span>{checkOrWarn(hasCompare)} cmp</span>
                <span>{variants}var</span>
                {p.published === false && <span style={{ color: "#f43f5e", fontWeight: 700 }}>NO PUB</span>}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, padding: "0 8px 4px", fontSize: 8, color: "var(--t4)" }}>
                <span style={{ opacity: 0.7 }}>SEO:</span>
                <span>{checkOrWarn(p.hasMetaTitle !== false)} title</span>
                <span>{checkOrWarn(p.hasMetaDesc !== false)} desc</span>
                <span>{checkOrWarn(p.hasSchema !== false)} schema</span>
                <span>{checkOrWarn(p.hasAltTexts !== false)} alts</span>
                <span>{checkOrWarn(p.cleanHandle !== false)} handle</span>
                <span>{imgQuality(imgCount)} imgs</span>
              </div>
              {p.issues && p.issues.length > 0 && (
                <div style={{ padding: "0 8px 4px", fontSize: 8, color: "#f59e0b" }}>
                  ⚠ {p.issues.slice(0, 2).join(" · ")}
                </div>
              )}
              {showDetail && (
                <div style={{ padding: "4px 8px 8px", borderTop: "1px solid var(--ink3)" }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: "var(--t2)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Recomendaciones por dimension</div>
                  {recs.map((r, ri) => (
                    <div key={ri} style={{ display: "flex", gap: 4, padding: "3px 0", borderBottom: ri < recs.length - 1 ? "1px solid var(--ink3)" : "none" }}>
                      <span style={{ fontSize: 10, flexShrink: 0 }}>{r.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 8, fontWeight: 700, color: recStatusColor(r.status) }}>{r.dim}: {r.what}</div>
                        <div style={{ fontSize: 7, color: "var(--t3)" }}>{r.why}</div>
                      </div>
                      <span style={{ fontSize: 7, color: recStatusColor(r.status), fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" }}>{r.impact}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ padding: "2px 8px 4px", textAlign: "center", fontSize: 7, color: "var(--t4)", opacity: 0.6 }}>
                {showDetail ? "▲ Cerrar" : "▼ Ver recomendaciones"}
              </div>
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
  const safeTimeout = useSafeTimeout();
  const [loc] = useLocation();
  const projectId = parseInt(loc.match(/\/projects\/(\d+)/)?.[1] ?? "1", 10);

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
    safeTimeout(() => setSendState("idle"), 3000);
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
    safeTimeout(() => setSaveState("idle"), 3000);
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
    safeTimeout(() => setDlState("idle"), 3000);
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
    { key: "actionable_insights_for_shopify", label: "Insights eCommerce", icon: <Brain size={10} /> },
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
                <p style={{ margin: "0 0 5px", fontWeight: 700, color: "var(--gold)", fontSize: 9, textTransform: "uppercase" }}>🛒 eCommerce</p>
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
  const fmIsMobile = useIsMobile();
  const copyHtml = async () => {
    await navigator.clipboard.writeText(flow.emails?.[activeEmail]?.html_body ?? "");
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: fmIsMobile ? 8 : 20 }}>
      <div style={{ background: "var(--ink)", border: "1px solid var(--ink3)", borderRadius: fmIsMobile ? 10 : 14, width: "100%", maxWidth: fmIsMobile ? "100%" : 900, maxHeight: fmIsMobile ? "calc(100dvh - 16px)" : "90vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: fmIsMobile ? "10px 12px" : "14px 20px", borderBottom: "1px solid var(--ink3)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: fmIsMobile ? 13 : 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{flow.name}</h3>
            <p style={{ margin: "2px 0 0", fontSize: fmIsMobile ? 10 : 11, color: "var(--t3)" }}>Trigger: {flow.trigger} · {flow.emails?.length} emails</p>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button onClick={copyHtml} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--ink3)", background: copied ? "var(--jade)" : "var(--ink2)", color: copied ? "var(--ink)" : "var(--t)", fontSize: 11, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
              {copied ? "✓ Copiado" : "📋 Copiar HTML"}
            </button>
            <button onClick={onClose} aria-label="Cerrar detalle del flujo" style={{ width: 44, height: 44, minWidth: 44, borderRadius: 6, border: "1px solid var(--ink3)", background: "var(--ink2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t3)" }}><X size={16} /></button>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: fmIsMobile ? "column" : "row", flex: 1, overflow: "hidden", minHeight: 0 }}>
          <div style={{
            ...(fmIsMobile
              ? { display: "flex", gap: 4, padding: 8, overflowX: "auto", borderBottom: "1px solid var(--ink3)", flexShrink: 0 }
              : { width: 180, borderRight: "1px solid var(--ink3)", padding: 12, overflowY: "auto", flexShrink: 0 }),
          }}>
            {flow.emails?.map((email, i) => (
              <button key={i} onClick={() => setActiveEmail(i)}
                style={{ ...(fmIsMobile ? { flexShrink: 0, whiteSpace: "nowrap" } : { width: "100%" }), textAlign: "left", padding: "8px 10px", borderRadius: 6, marginBottom: fmIsMobile ? 0 : 4, border: "none", cursor: "pointer", background: activeEmail === i ? "rgba(200,168,75,0.12)" : "transparent", color: activeEmail === i ? "var(--gold)" : "var(--t3)" }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 600 }}>Email {email.position}</p>
                <p style={{ margin: "2px 0 0", fontSize: 9, opacity: 0.7 }}>⏱ {email.delay}</p>
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: fmIsMobile ? 12 : 16, minHeight: 0 }}>
            {flow.emails?.[activeEmail] && (() => {
              const email = flow.emails[activeEmail];
              return (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 9, color: "var(--t3)", fontWeight: 700, textTransform: "uppercase", margin: "0 0 4px" }}>Asunto</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t)", margin: 0, background: "var(--ink2)", padding: "8px 12px", borderRadius: 6, wordBreak: "break-word" }}>{email.subject}</p>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 9, color: "var(--t3)", fontWeight: 700, textTransform: "uppercase", margin: "0 0 4px" }}>Preview Text</p>
                    <p style={{ fontSize: 11, color: "var(--t2)", margin: 0, background: "var(--ink2)", padding: "6px 12px", borderRadius: 6, wordBreak: "break-word" }}>{email.preview_text}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 9, color: "var(--t3)", fontWeight: 700, textTransform: "uppercase", margin: "0 0 6px" }}>HTML Template</p>
                    <textarea readOnly value={email.html_body}
                      style={{ width: "100%", minHeight: fmIsMobile ? 150 : 200, padding: "10px 12px", background: "var(--ink)", border: "1px solid var(--ink3)", borderRadius: 8, color: "var(--t3)", fontSize: 10, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box" }} />
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

// ─── QUICK ACTIONS (FALLBACK ESTÁTICO) ────────────────────────────────────────
// Fallback usado si /shopybrain/quick-actions falla. Las acciones reales se
// piden dinámicamente al backend según la ruta actual.
type QuickAction = { icon: string; label: string; prompt: string; isResearch?: boolean };
const FALLBACK_QUICK_ACTIONS: QuickAction[] = [
  { icon: "❓", label: "¿Qué puedo hacer aquí?",   prompt: "¿Qué puedo hacer en esta página? Guíame paso a paso con los botones y opciones disponibles." },
  { icon: "🏪", label: "Estado de la tienda",       prompt: "Muéstrame el estado completo de la tienda: productos con score, pedidos recientes y estado del token Shopify." },
  { icon: "🔍", label: "Auditoría rápida",          prompt: "Haz una auditoría rápida de mi tienda: top-3 problemas críticos de SEO, conversión e imágenes con su impacto estimado en ventas." },
  { icon: "📊", label: "Analizar métricas",         prompt: "Analiza las métricas clave de mi tienda: conversión, AOV, tasa de abandono y top productos. Detecta los cuellos de botella del funnel." },
  { icon: "💰", label: "Analizar precios",          prompt: "Analiza los precios de mis productos: compáralos con el mercado y sugiere ajustes para maximizar margen y conversión." },
  { icon: "🔬", label: "Investigar marca/URL",      prompt: "__RESEARCH__", isResearch: true },
  { icon: "🚀", label: "Plan de lanzamiento",       prompt: "Crea un plan de lanzamiento de 30 días para mi tienda/producto: pre-lanzamiento, lanzamiento y post-lanzamiento con presupuesto estimado." },
  { icon: "🧠", label: "Estado del sistema",        prompt: "¿Qué conocimiento ha absorbido Shopy Crafter? Dame un resumen de las memorias, dominios y contenido absorbido hasta ahora." },
];

interface SlashSkill {
  cmd: string;
  icon: string;
  label: string;
  desc: string;
  engine: string;
  prompt: string;
  isResearch?: boolean;
}
const SLASH_SKILLS: SlashSkill[] = [
  // ── ANÁLISIS & AUDITORÍA ──────────────────────────────────────────────────
  { cmd: "/audit",       icon: "🔍", label: "Auditoría completa",     desc: "Analiza tienda, SEO, conversión y top oportunidades",     engine: "claude",  prompt: "Haz una auditoría completa de mi tienda Shopify: evalúa SEO on-page, tasa de conversión estimada, calidad de imágenes, precios vs. mercado y UX del checkout. Dame los top-5 problemas críticos con su impacto estimado en ingresos y el plan de acción paso a paso." },
  { cmd: "/seo",         icon: "📈", label: "Optimizar SEO",           desc: "Títulos, metadatos, alt texts y estructura interna",      engine: "claude",  prompt: "Optimiza el SEO completo de todos mis productos: títulos con keyword primaria, meta descripciones persuasivas con CTA, alt texts descriptivos, tags y estructura de URL. Prioriza los productos con mayor potencial de conversión." },
  { cmd: "/cro",         icon: "🎯", label: "Optimizar conversión",    desc: "UX, checkout, CTAs y trust signals para +ventas",         engine: "claude",  prompt: "Analiza mi tienda con foco en Conversion Rate Optimization (CRO): evalúa la claridad de CTAs, el checkout, los trust signals (reseñas, sellos, garantías), la velocidad percibida y las páginas de producto. Da 10 mejoras concretas ordenadas por impacto." },
  { cmd: "/products",    icon: "📦", label: "Auditar catálogo",        desc: "Lista y puntúa todos los productos por calidad",          engine: "claude",  prompt: "Lista todos mis productos con puntuación SEO (0-100), precio, estado de imágenes y calidad del copy. Identifica los 5 que necesitan mejora urgente e indica exactamente qué cambiar en cada uno y por qué." },
  { cmd: "/competitors", icon: "⚔️", label: "Analizar competidores",  desc: "Benchmarks de precios, SEO y estrategia vs. rivales",     engine: "gemini",  prompt: "", isResearch: true },
  { cmd: "/analytics",   icon: "📊", label: "Analizar métricas",       desc: "KPIs de conversión, AOV, LTV y funnel de ventas",         engine: "claude",  prompt: "Analiza las métricas clave de mi tienda: tasa de conversión, valor medio del pedido (AOV), lifetime value (LTV) estimado, tasa de abandono del carrito y top productos por ingresos. Detecta cuellos de botella en el funnel y sugiere experimentos A/B prioritarios." },
  { cmd: "/legal",       icon: "⚖️", label: "Auditoría legal",         desc: "Copyright, RGPD, cookies, avisos legales y T&C",          engine: "claude",  prompt: "Realiza una auditoría legal de mi tienda Shopify: revisa si hay problemas de copyright en imágenes y nombres de productos, verifica que el aviso legal, política de privacidad, cookies y condiciones de venta cumplen con RGPD y la ley española de e-commerce. Dame las acciones correctivas urgentes." },

  // ── MARKETING & CONTENIDO ─────────────────────────────────────────────────
  { cmd: "/email",       icon: "📧", label: "Email Marketing",          desc: "Estrategia y flujos Klaviyo con HTML",                   engine: "claude",  prompt: "Diseña una estrategia de email marketing completa para mi tienda: secuencia de bienvenida (5 emails), recuperación de carrito abandonado (3 emails), post-compra (2 emails) y campaña winback (3 emails). Incluye asuntos con A/B test, previsualización móvil y estructura HTML profesional." },
  { cmd: "/klaviyo",     icon: "🎯", label: "Flujos Klaviyo",           desc: "Workflows con emails HTML listos para importar",         engine: "claude",  prompt: "Genera los flujos Klaviyo más rentables para mi tienda con HTML completo y responsive: bienvenida (3 emails con intervalos), carrito abandonado (2 emails: 1h y 24h), post-compra (upsell a los 7 días) y winback (60 días inactivo). Incluye segmentación de audiencia recomendada." },
  { cmd: "/content",     icon: "✍️", label: "Generar contenido",        desc: "Copy para Instagram, TikTok, LinkedIn y landing",        engine: "claude",  prompt: "Crea un pack de contenido de alto impacto para mi marca: 5 posts Instagram con caption y hashtags, 3 hooks para TikTok con guión completo, 2 posts LinkedIn para B2B, copy para la hero section de la landing y 5 ideas de reels/shorts adaptadas a mi nicho." },
  { cmd: "/social",      icon: "📱", label: "Estrategia redes sociales", desc: "Plan editorial 30 días con formatos y calendari",        engine: "claude",  prompt: "Crea una estrategia completa de redes sociales para mi tienda: análisis del perfil ideal de cliente, selección de 2-3 plataformas prioritarias, calendario editorial para los próximos 30 días (5 posts/semana), formatos de contenido más efectivos para mi nicho y KPIs para medir el éxito." },
  { cmd: "/brand",       icon: "🏷️", label: "Análisis de branding",     desc: "Identidad visual, tono y diferenciación competitiva",    engine: "gemini",  prompt: "Analiza en profundidad el branding de mi tienda: identidad visual (colores, tipografía, logo), tono de comunicación, posicionamiento de marca, coherencia entre canales y 5 oportunidades de diferenciación frente a competidores directos. Incluye recomendaciones de mejora accionables." },
  { cmd: "/reviews",     icon: "⭐", label: "Analizar reseñas",          desc: "Sentimiento de clientes, NPS y oportunidades de mejora", engine: "claude",  prompt: "Analiza las reseñas y feedback de mis clientes para extraer insights de negocio: principales temas positivos y negativos, palabras más repetidas, Net Promoter Score estimado, productos con mejor y peor valoración, y un plan de mejora basado en los patrones detectados. También sugiere cómo responder a las reseñas negativas." },
  { cmd: "/returns",     icon: "🔄", label: "Política devoluciones",     desc: "Política y FAQ optimizada para reducir fricciones",      engine: "claude",  prompt: "Diseña una política de devoluciones y cambios optimizada para mi tienda: texto legal completo en español, FAQ con las 10 preguntas más frecuentes respondidas, página de devoluciones con UX fluida para el cliente y estrategias para reducir la tasa de devolución en un 30%. Adapta todo al nicho de mi tienda." },

  // ── INVESTIGACIÓN & PROVEEDORES ───────────────────────────────────────────
  { cmd: "/research",    icon: "🔬", label: "Investigar marca/URL",     desc: "Análisis exhaustivo con 8 búsquedas Google paralelas",   engine: "gemini",  prompt: "", isResearch: true },
  { cmd: "/supply",      icon: "🏭", label: "Buscar proveedores",       desc: "Fabricantes y mayoristas con precios, MOQ y plazos",    engine: "gemini",  prompt: "Busca los mejores proveedores y fabricantes para mis productos con datos reales del mercado: precios unitarios por rango de volumen, MOQ mínimo, calidad de materiales, certificaciones (CE, ISO), tiempos de entrega a España/Europa, y condiciones de pago habituales. Incluye 3-5 proveedores con pros y contras de cada uno." },
  { cmd: "/forecast",    icon: "📈", label: "Previsión financiera",      desc: "Forecast de ventas a 6 meses con escenarios",            engine: "claude",  prompt: "Genera una previsión financiera detallada para mi tienda a 6 meses: modelo de revenue con 3 escenarios (conservador, base, optimista), análisis de break-even, inversión necesaria por canal (SEO, ads, email), cashflow mensual estimado y las métricas críticas que debo monitorizar semanalmente para ir en línea con el objetivo." },

  // ── CREACIÓN ─────────────────────────────────────────────────────────────
  { cmd: "/ads",         icon: "🎬", label: "Crear anuncio IA",         desc: "Vídeo/imagen con guión, música y efectos cinemáticos",  engine: "auto",    prompt: "Crea un anuncio de vídeo persuasivo y cinematic para mi producto más vendido: guión completo con estructura hook-problema-solución-CTA, descripción visual fotograma a fotograma, voz en off en español con énfasis emocional, música de fondo que refuerza la marca y los 3 formatos de entrega (9:16 para stories, 16:9 para YouTube, 1:1 para feed)." },
  { cmd: "/images",      icon: "🖼️", label: "Generar imágenes IA",      desc: "Fotos de producto profesionales 4K con Flux Pro",       engine: "auto",    prompt: "Genera un pack completo de imágenes profesionales para mis productos: foto de producto sobre fondo blanco infinito (para marketplace y Shopify), foto lifestyle en contexto de uso real, banner horizontal para web (1920x600px) y cuadrado para redes (1080x1080px). Usa Flux 1.1 Pro Ultra con máxima calidad." },
  { cmd: "/video",       icon: "🎥", label: "Vídeo de producto",        desc: "Vídeo cinematic de 10-30s con IA (Runway/Kling/Veo)",   engine: "auto",    prompt: "Crea un vídeo de producto cinematic de alta calidad: comenzando con un plano detalle del producto (macro), seguido de un plano de uso en contexto lifestyle, cierre con logo y CTA animado. Música elegante de fondo y voz en off persuasiva en español. Formato 9:16 para Instagram Reels y TikTok." },
  { cmd: "/describe",    icon: "🤖", label: "Describir con IA",         desc: "Copy SEO premium con storytelling y keywords long-tail", engine: "claude",  prompt: "Escribe descripciones de producto de nivel premium para mis productos top: storytelling emocional que conecte con el cliente ideal (300-500 palabras), 5 bullet points de beneficios clave (no características), FAQ integrada con 3 preguntas, especificaciones técnicas en tabla y 10 keywords long-tail integradas de forma natural. Formato HTML listo para pegar en Shopify." },
  { cmd: "/newsletter",  icon: "📰", label: "Campaña newsletter",       desc: "Email completo con asunto, preview y HTML responsive", engine: "claude",  prompt: "Diseña una campaña de newsletter de alto impacto para mi tienda: 3 variaciones de asunto (con y sin emoji, con urgencia/curiosidad/beneficio), texto de preview (90 chars), estructura HTML completa y responsive con hero image, cuerpo persuasivo, CTA principal y pie de página con redes. Optimizado para Gmail, Outlook y móvil." },
  { cmd: "/cards",       icon: "💳", label: "Tarjetas de visita",       desc: "Diseño profesional con identidad visual de marca",      engine: "claude",  prompt: "Diseña un pack completo de identidad de negocio: tarjetas de visita con tipografía premium y datos de contacto, firma de email HTML profesional, plantilla de presupuesto/factura con la marca y una plantilla de propuesta comercial en PDF. Todo coherente con los colores y tono de mi marca." },
  { cmd: "/launch",      icon: "🚀", label: "Plan de lanzamiento",      desc: "Roadmap completo para lanzar un producto en 30 días",   engine: "claude",  prompt: "Crea un plan de lanzamiento completo para mi nuevo producto en 30 días: semana 1 (pre-lanzamiento: lista de espera, teaser content, influencer outreach), semana 2-3 (lanzamiento: email secuencia, ads creatividades, PR), semana 4 (post-lanzamiento: upsell, reviews, remarketing). Incluye presupuesto estimado por canal y KPIs de éxito." },

  // ── BRENDA PATTERNS — IA Avanzada ─────────────────────────────────────────
  { cmd: "/persona",     icon: "👤", label: "Buyer Persona",             desc: "Crea perfiles de cliente ideal con arquetipos y mapa de empatía",  engine: "claude", prompt: "Crea 3 buyer personas detallados para mi tienda con: nombre ficticio, edad, ocupación, ingresos, miedos, motivaciones, canales favoritos, cómo descubre productos, objeciones de compra y el mensaje exacto que le convencería. Para cada persona incluye un mapa de empatía completo (qué piensa, siente, dice, hace, ve, escucha). Basa los perfiles en los datos reales de mis productos y el nicho de mi tienda. Termina con los 3 mensajes de marketing más efectivos para cada perfil." },
  { cmd: "/antihall",    icon: "🧐", label: "Anti-Alucinación",          desc: "Verificación de datos con fuentes reales antes de publicar",      engine: "gemini", prompt: "Actúa como verificador de hechos experto. Analiza esta información de mi tienda y detecta: datos estadísticos que necesitan fuente verificable, claims de producto que podrían ser exagerados o no verificables legalmente, afirmaciones sobre beneficios de salud o resultados que requieren disclaimer, y textos que podrían infringir RGPD o normativa española de publicidad. Para cada problema detectado: señala el texto exacto, explica el riesgo y proporciona la alternativa segura y verificable.", isResearch: true },
  { cmd: "/faq-builder", icon: "❓", label: "FAQ Builder",               desc: "FAQ SEO-optimizada que reduce soporte y aumenta conversión",      engine: "claude", prompt: "Construye una FAQ completa y estratégica para mi tienda optimizada para SEO y conversión: primero detecta las 20 preguntas más frecuentes de mi nicho (usa los títulos y descripciones de mis productos para inferirlas), luego redacta respuestas persuasivas de 80-150 palabras cada una que: respondan la duda real, incluyan keywords long-tail de forma natural, añadan un CTA sutil hacia la compra, y eliminen la objeción principal. Organiza las preguntas en 4-5 categorías y añade el schema markup JSON-LD listo para pegar en Shopify." },
  { cmd: "/whatsapp-agent", icon: "💬", label: "Agente WhatsApp",        desc: "Flujos automáticos de WhatsApp Business para ventas y soporte", engine: "claude", prompt: "Diseña un sistema completo de agente conversacional para WhatsApp Business de mi tienda: 1) Flujo de bienvenida (primer mensaje y menú principal), 2) Flujo de catálogo (mostrar productos con fotos y precios), 3) Flujo de pedido (tomar datos del cliente, confirmar pedido), 4) Flujo de soporte (FAQ automática + escalado a humano), 5) Flujo de recuperación de carrito (mensaje a las 2h + 24h). Para cada flujo incluye el mensaje exacto que envía el bot, las opciones de menú numeradas y el árbol de decisiones completo. Usa lenguaje natural, cálido y en español. Incluye plantillas listas para WhatsApp Business API." },
  { cmd: "/vtuber",      icon: "🎭", label: "Avatar VTuber",             desc: "Crea un VTuber IA con personalidad, guión y estrategia de contenido",  engine: "claude", prompt: "Crea un avatar VTuber completo para representar mi marca en redes sociales y streaming: 1) PERSONAJE: nombre, historia de origen, personalidad (3 rasgos principales), edad virtual, apariencia física (descripción detallada para generar con IA), 2) VOZ: tono, velocidad, muletillas y frases características, 3) CONTENIDO: 10 ideas de vídeos para TikTok/YouTube con guión del primer minuto (el hook), 4) ESTRATEGIA: horario de publicación óptimo, hashtags por plataforma y colaboraciones con otros VTubers del nicho, 5) MONETIZACIÓN: cómo integrar el VTuber con mi tienda Shopify para vender productos de forma entretenida. Adapta todo al tono y nicho de mi marca." },

  // ── GEMINI NATIVO ─────────────────────────────────────────────────────────
  { cmd: "/imagen-gemini", icon: "🎨", label: "Imagen con Gemini", desc: "Genera imágenes con el modelo nativo de imagen de Gemini", engine: "gemini", prompt: "[GEMINI-IMAGE] ", isResearch: false },
  { cmd: "/codigo-gemini", icon: "💻", label: "Análisis con código",  desc: "Ejecuta código Python real con Gemini para calcular y analizar datos", engine: "gemini", prompt: "[GEMINI-CODE] Analiza los datos de mi tienda ejecutando código Python: calcula métricas de conversión, AOV, tendencias de ventas y genera los insights más útiles. Muestra el código y los resultados.", isResearch: false },
];

const SYSTEM_PROMPT = `Eres el asistente inteligente de Shopy Crafter — la plataforma profesional de automatización eCommerce para tiendas Shopify.

═══ PERSONALIDAD ═══
• Hablas como un experto amigo: directo, cálido, sin rodeos ni jerga innecesaria
• VARÍA el inicio de cada respuesta — nunca repitas la misma apertura dos veces seguidas
• Detecta el estado emocional del usuario: si hay frustración, valídala primero ("Entiendo que es frustrante...") antes de dar la solución
• Haz preguntas de seguimiento cuando necesites contexto, pero sólo UNA por mensaje
• Termina SIEMPRE con un siguiente paso concreto o acción que el usuario pueda hacer ahora mismo
• Puedes hacer humor negro, ironía y sarcasmo cuando el usuario lo pide o está claro por contexto que es el registro buscado — mantenlo ingenioso, no cruel

═══ CAPACIDADES ═══
• 4 motores de análisis: Gemini+Search (tiempo real en streaming), Claude (razonamiento estratégico), Grok (perspectiva alternativa), Memoria permanente (contexto acumulado)
• Gemini nativo: streaming SSE con feedback token a token, generación de imágenes nativa (/imagen-gemini), ejecución de código Python real (/codigo-gemini), modo Deep Think con presupuesto de razonamiento 20.000 tokens
• Expertise: eCommerce, Klaviyo, email marketing, SEO, pricing, conversión (CRO), branding, copywriting, visión de producto, composición visual, topología 3D, rendering
• Análisis de: imágenes de producto, vídeos, URLs/webs, perfiles de redes sociales, documentos PDF/Word, datos de tienda Shopify
• Navegación: conoces TODAS las páginas, botones y funciones de Shopy Crafter — guías paso a paso con nombres exactos de elementos

═══ CLASIFICACIÓN DE INTENCIÓN (aplica en cada mensaje) ═══
Detecta mentalmente qué quiere el usuario antes de responder:
• PREGUNTA INFO — responde de forma concisa y pregunta si necesita profundizar
• ACCIÓN CONCRETA — ejecuta y confirma qué hiciste + resultado
• PROBLEMA/ERROR — diagnóstico primero, luego solución paso a paso
• CONFUSIÓN — pregunta de aclaración + ofrece opciones concretas
• FRUSTRACIÓN — empatía primero, solución clara, escalado si persiste
• FUERA DE ALCANCE — di qué NO puedes hacer (1 frase), di qué SÍ puedes ofrecer en su lugar
• HUMAN HANDOFF — si el usuario dice "quiero hablar con una persona" o similar, responde: "Puedes escribir a hola@shopycrafter.com — el equipo te contactará en menos de 24h."

═══ CONVERSACIÓN ═══
• Si el contexto anterior es relevante, refiérete a él de forma natural ("Como hablamos antes...")
• Para acciones que tarden >15s: avisa antes de empezar con el tiempo estimado
• Respuestas técnicas largas: usa **negrita** para puntos clave, listas para pasos
• Ante errores: propón 2-3 alternativas ordenadas de más a menos recomendada
• Después de ayudar en >5 mensajes, pregunta si la sesión fue útil (feedback)
• Si el usuario lleva mucho tiempo en la misma duda, ofrece escalar: "¿Quieres que lo revisemos juntos con el equipo?"

═══ CONOCIMIENTO DE SKILLS (/comandos) ═══
Los usuarios pueden usar /comandos para tareas específicas. Cuando detectes que un usuario quiere hacer algo que tiene /comando correspondiente, sugiérelo naturalmente. Skills disponibles: /audit, /seo, /cro, /products, /competitors, /analytics, /legal, /email, /klaviyo, /content, /social, /brand, /reviews, /returns, /research, /supply, /forecast, /ads, /images, /video, /describe, /newsletter, /cards, /launch, /persona, /antihall, /faq-builder, /whatsapp-agent, /vtuber, /imagen-gemini, /codigo-gemini

Skills de Gemini nativo:
• /imagen-gemini — genera una imagen con el modelo de imagen de Gemini (escribe la descripción tras el comando)
• /codigo-gemini — ejecuta código Python real para analizar datos de tu tienda

═══ ANTI-ALUCINACIÓN (reglas Brenda) ═══
• NUNCA inventes estadísticas o datos concretos sin haberlos verificado. Si no tienes la cifra exacta, usa rangos o di "varía según la fuente".
• Si el usuario pregunta algo fuera de tu conocimiento verificable, di claramente: "No tengo datos confiables sobre esto. Te recomiendo verificarlo en [fuente específica]."
• Para datos de producto (ingredientes, materiales, certificaciones), pide confirmación al usuario antes de publicarlos: "¿Puedes confirmar que X es correcto antes de que lo incluya en el copy?"
• Cuando uses /antihall, revisa ACTIVAMENTE textos ya escritos buscando afirmaciones que un regulador podría cuestionar.

═══ PERSONALIZACIÓN POR BUYER PERSONA ═══
• Cuando conozcas el buyer persona del usuario (tras /persona), adapta TODOS los mensajes al lenguaje, tono y referencias culturales de ese perfil.
• Si el usuario tiene múltiples personas, pregunta: "¿Para qué perfil de cliente es este contenido?" antes de generar copy.
• Detecta señales del perfil en el propio mensaje del usuario (vocabulario técnico vs. cotidiano, edad estimada, nivel de sofisticación) y ajusta tu registro.

IMPORTANTE: Siempre refiérete a la plataforma como "Shopy Crafter". Responde siempre en español.`;

// ─── MAIN CHATBOT ─────────────────────────────────────────────────────────────
export default function OmniChatbot() {
  const { user } = useAuth();
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const { position: dragPos, dragHandlers: chatDragHandlers, wasDragged: chatWasDragged } = useDraggable({ storageKey: "chatbot", defaultBottom: isMobile ? 12 : 24, defaultRight: isMobile ? 12 : 24, dragFromAnywhere: true });
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{
    id: "welcome", role: "assistant", timestamp: new Date(), model: "omnicore",
    content: `¡Hola${user?.name ? ` ${user.name.split(" ")[0]}` : ""}! 👋 Soy el asistente inteligente de **Shopy Crafter**.

🚀 **Ahora puedo EJECUTAR acciones en tu tienda directamente:**
· ➕ "Crea un producto llamado X" — lo creo en tu tienda
· 📦 "Lista mis productos" — te los muestro todos
· 💰 "Cambia el precio de X a Y" — actualizo en tu tienda
· 🔑 "Regenera el token" — renuevo acceso automáticamente
· 🛒 "Ver pedidos" — últimos pedidos de la tienda
· 🗑️ "Elimina el producto X" — lo borro de tu tienda
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
  const [quickActions, setQuickActions] = useState<QuickAction[]>(FALLBACK_QUICK_ACTIONS);
  const [engineMode, setEngineMode] = useState<"auto" | "claude" | "gemini" | "brain_only" | "grok">("auto");
  const [deepThinkMode, setDeepThinkMode] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachFiles, setAttachFiles] = useState<File[]>([]);
  const [attachUrl, setAttachUrl] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [slashSelectedIdx, setSlashSelectedIdx] = useState(0);
  const [sessionUsage, setSessionUsage] = useState({ totalTokens: 0, totalCostUsd: 0, msgCount: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<ReturnType<typeof createSpeechRecognition> | null>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { transcript, response } = (e as CustomEvent<{ transcript: string; response: string }>).detail;
      setOpen(true);
      setMinimized(false);
      const now = new Date();
      setMessages(prev => [
        ...prev,
        { id: `voice-u-${Date.now()}`, role: "user" as const, timestamp: now, content: transcript },
        { id: `voice-a-${Date.now() + 1}`, role: "assistant" as const, timestamp: now, model: "omnicore", content: response },
      ]);
    };
    window.addEventListener("shopy:voice-chat", handler);
    return () => window.removeEventListener("shopy:voice-chat", handler);
  }, []);

  // Fetch contextual quick actions when panel opens or route changes
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const projectMatch = location.match(/\/projects\/(\d+)/);
    const projectId = projectMatch?.[1];
    const url = `${API}/api/shopybrain/quick-actions?route=${encodeURIComponent(location)}${projectId ? `&projectId=${projectId}` : ""}`;
    fetch(url, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (cancelled || !j?.actions || !Array.isArray(j.actions)) return;
        setQuickActions(j.actions);
      })
      .catch(() => { /* fallback ya está */ });
    return () => { cancelled = true; };
  }, [open, location]);

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
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setAttachFile(files[0]);
      setAttachFiles(Array.from(files));
      setAttachUrl(""); setShowAttach(true);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setAttachFile(files[0]);
      setAttachFiles(Array.from(files));
      setAttachUrl(""); setShowAttach(true);
    }
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

  const speakText = useCallback((text: string) => {
    if (!voiceEnabled || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const cleaned = text
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/#{1,6}\s+/g, "")
      .replace(/!\[.*?\]\(.*?\)/g, "")
      .replace(/\[([^\]]+)\]\(.*?\)/g, "$1")
      .replace(/`{1,3}[^`]*`{1,3}/g, "")
      .replace(/>\s*/g, "")
      .replace(/[-•·]\s+/g, ". ")
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, " ")
      .slice(0, 700);
    if (!cleaned.trim()) return;
    const utter = new SpeechSynthesisUtterance(cleaned);
    utter.lang = "es-ES";
    utter.rate = 0.88;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    const trySpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const best =
          voices.find(v => v.lang === "es-ES" && v.name.includes("Google español de España")) ||
          voices.find(v => v.lang === "es-ES" && v.name.includes("Conchita")) ||
          voices.find(v => v.lang === "es-ES" && v.name.includes("Monica")) ||
          voices.find(v => v.lang === "es-ES" && v.name.includes("Sabina")) ||
          voices.find(v => v.lang === "es-ES" && (v.name.includes("Google") || v.name.includes("Microsoft"))) ||
          voices.find(v => v.lang === "es-ES") ||
          voices.find(v => v.lang.startsWith("es") && !v.lang.includes("MX") && !v.lang.includes("US")) ||
          voices.find(v => v.lang.startsWith("es"));
        if (best) utter.voice = best;
      }
      utter.onend = () => {
        if (voiceEnabled) {
          setTimeout(() => {
            const rec = recognitionRef.current || createSpeechRecognition();
            if (rec) {
              recognitionRef.current = rec;
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
            }
          }, 400);
        }
      };
      window.speechSynthesis.speak(utter);
    };
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = trySpeak;
    } else {
      trySpeak();
    }
  }, [voiceEnabled]);

  // ─── Execute Shopify action via backend ────────────────────────────────────
  // Acciones de generación de vídeo (montage/long_ad/brand_ad/cinematic-multishot) pueden
  // tardar 5–20 min (8 escenas × 60-120s cada Replicate + voz + música + concat ffmpeg).
  // Subimos el timeout a 25 min para esas acciones; resto sigue en 3 min.
  const HEAVY_VIDEO_ACTIONS = new Set(["create_brand_ad", "create_long_ad", "create_montage_video", "create_cinematic_multishot"]);
  const executeShopifyAction = async (action: string, params: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
    try {
      const actionController = new AbortController();
      const isHeavy = HEAVY_VIDEO_ACTIONS.has(action);
      const actionTimeout = setTimeout(() => actionController.abort(), isHeavy ? 1500000 : 180000);
      const res = await fetch(`${API}/api/shopybrain/execute-action`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, params }),
        signal: actionController.signal,
      });
      clearTimeout(actionTimeout);
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

  const formatActionResult = (action: string, result: any): string => {
    // CRIT-6 frontend: handle global confirmation responses uniformly.
    // Backend sends { requiresConfirmation: true, action, preview, message }
    // for any DESTRUCTIVE_ACTIONS without "confirmed: true". Show the message
    // and stop — don't render success-formatted output below.
    if (result && result.requiresConfirmation === true) {
      return (
        result.message ||
        `⚠️ Confirmación requerida para \`${action}\`. Re-envía la acción añadiendo "confirma" al mensaje.`
      );
    }
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
        msg += prods.map((p, _i) => {
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
        return `✅ **Producto creado en tu tienda:**\n🆔 ID: ${result.productId}\n📝 "${result.title}"\n📊 Estado: ${result.status}`;
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
        return `🗑️ Producto ${result.productId} eliminado de tu tienda.`;
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
        { const cmsVal = typeof result.value === "string" ? result.value : JSON.stringify(result.value, null, 2);
        return `📋 **CMS — ${result.section}:**\n${cmsVal.length > 2000 ? cmsVal.slice(0, 2000) + "\n\n... *(contenido completo disponible en la respuesta)*" : cmsVal}`; }
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
        if (result.shopifyProductsCreated) msg += `\n🛍️ ${result.shopifyProductsCreated} productos creados en tu tienda`;
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
        return `✅ **Rediseño aplicado en tu tienda:**\n📝 "${result.title}"\n📊 Título + Descripción + Tags + SEO actualizados\n${result.message || ""}`;
      case "bulk_redesign":
        return `🎨 **Rediseño masivo completado:**\n📦 ${result.total || "?"} productos procesados\n✅ ${result.redesigned || "?"} rediseñados\n${result.failed ? `❌ ${result.failed} errores` : ""}\n${result.message || ""}`;
      case "seo_full_audit":
        return `📊 **Auditoría SEO completada (16 criterios):**\n🏆 Score: **${result.averageScore || result.score || "?"}**/100\n📦 ${result.productsAudited || result.total || "?"} productos analizados\n${result.topIssues ? `\n⚠️ **Problemas principales:**\n${(result.topIssues as string[]).map((i: string) => `· ${i}`).join("\n")}` : ""}\n${result.message || ""}`;
      case "keyword_intelligence":
        { const kwData = result.message || JSON.stringify(result.keywords || result.data || result, null, 2);
        return `🔍 **Keyword Intelligence:**\n${kwData.length > 3000 ? kwData.slice(0, 3000) + "\n\n... *(datos completos disponibles)*" : kwData}`; }
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
        { const filesData = result.message || JSON.stringify(result.files || result, null, 2);
        return `📂 **Archivos del theme:**\n${filesData.length > 3000 ? filesData.slice(0, 3000) + "\n\n... *(lista completa disponible)*" : filesData}`; }
      case "read_theme_file":
        { const fileContent = (result.content || result.value || "").toString();
        return `📄 **${result.assetKey || "Archivo"}:**\n\`\`\`\n${fileContent.length > 5000 ? fileContent.slice(0, 5000) + "\n\n... *(archivo completo: " + fileContent.length + " chars)*" : fileContent}\n\`\`\``; }
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
        return `📦 **Inventario sincronizado:**\n${result.message || "Stock actualizado desde tu tienda."}`;
      case "inventory_alerts":
        return `⚠️ **Alertas de inventario:**\n${result.message || "Verificación de stock completada."}`;
      case "inventory_deep_report":
        return `📦 **Informe profundo de inventario:**\n${result.message || "Análisis completo de stock generado."}`;
      case "inventory_sync_orders":
        return `📋 **Pedidos sincronizados:**\n${result.message || "Datos de ventas importados de tu tienda."}`;
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
      case "browser_action": {
        const br = result as BrowserActionResult;
        if (!br.success) return `❌ **Error de navegación**: ${br.message}`;
        let msg = `🌐 **Navegación completada** — "${br.goal}"\n`;
        msg += `✅ ${br.stepsOk}/${br.stepsExecuted} pasos ejecutados\n`;
        if (br.finalUrl) msg += `🔗 URL: ${br.finalUrl}\n`;
        if (br.screenshots?.length) msg += `📸 ${br.screenshots.length} captura(s) tomadas\n`;
        if (br.youtubeEmbed) msg += `\n▶️ **Vídeo encontrado** — reproduciendo abajo.`;
        if (br.extractedText) msg += `\n\n📄 **Texto extraído:**\n${br.extractedText.slice(0, 400)}...`;
        return msg;
      }

      case "browser_research": {
        const r = result as any;
        if (r.error) return `❌ ${r.message}`;
        let msg = `🔬 **Investigación completada**: "${r.topic}"\n`;
        msg += `📚 ${r.sourcesCount || 0} fuentes web consultadas\n`;
        if (r.vaultId) {
          msg += `\n💾 **Informe guardado en el Vault** (ID: ${r.vaultId})\n`;
          msg += `🌐 Ver informe: ${r.vaultUrl}\n`;
          msg += `📥 Descargar PDF: ${r.vaultUrl}?format=pdf`;
        }
        return msg;
      }

      case "generate_brand_book": {
        const r = result as any;
        if (r.error) return `❌ ${r.message}`;
        let msg = `📖 **Brand Book generado**: "${r.brandName}"\n`;
        if (r.tagline) msg += `💬 Tagline: "${r.tagline}"\n`;
        if (r.archetype) msg += `🎭 Arquetipo: ${r.archetype}\n`;
        if (r.colorsCount) msg += `🎨 ${r.colorsCount} colores | 💡 ${r.valuesCount || 0} valores\n`;
        if (r.vaultId) {
          msg += `\n💾 **Brand Book guardado en el Vault** (ID: ${r.vaultId})\n`;
          msg += `🌐 Ver: ${r.vaultUrl}\n`;
          msg += `📥 Descargar PDF: ${r.vaultUrl}?format=pdf`;
        }
        return msg;
      }

      default:
        return result.message ? `✅ ${result.message}` : "✅ Acción completada.";
    }
  };

  const isDocumentFile = (file: File): boolean => {
    const textExts = [".txt", ".md", ".csv", ".json"];
    return textExts.some(ext => file.name.toLowerCase().endsWith(ext))
      || ["text/plain", "text/markdown", "text/csv", "application/json"].includes(file.type);
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const absorbFile = async (file: File, niche?: string, signal?: AbortSignal): Promise<AbsorbResult> => {
    try {
      // Las imágenes van a visión (Claude). Cualquier otro formato (PDF, Word,
      // PowerPoint, Excel, ZIP, HTML, CSS, código, audio, vídeo, .txt...) se sube
      // al extractor universal del servidor, que saca todo el texto/transcripción.
      const isImage = file.type.startsWith("image/");
      const endpoint = isImage ? "absorb-image" : "absorb-document";
      const formData = new FormData();
      formData.append("file", file);
      formData.append("label", file.name);
      if (niche) formData.append("niche", niche);
      const res = await fetch(`${API}/api/shopybrain/${endpoint}`, {
        method: "POST", credentials: "include", body: formData, signal,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Error absorbing file");
    }
  };

  // ─── Absorb URL ────────────────────────────────────────────────────────────
  const absorbUrl = async (url: string, niche?: string, signal?: AbortSignal): Promise<AbsorbResult> => {
    try {
      const res = await fetch(`${API}/api/shopybrain/absorb-url`, {
        method: "POST", credentials: "include", signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, niche }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Error absorbing URL");
    }
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
  const _checkExistingKnowledge = async (name: string): Promise<{
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
  const researchEntity = async (input: string, niche?: string, signal?: AbortSignal): Promise<EntityResearchResult> => {
    try {
      const res = await fetch(`${API}/api/shopybrain/research-entity-sync`, {
        method: "POST", credentials: "include", signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, niche, market: "es" }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Error researching entity");
    }
  };

  // ─── Detect Klaviyo request ────────────────────────────────────────────────
  const detectKlaviyo = (text: string) => {
    const lower = text.toLowerCase();
    const hasKlaviyoExplicit = lower.includes("klaviyo");
    const hasEmailWorkflow = (lower.includes("workflow") || lower.includes("flujo")) && (lower.includes("email") || lower.includes("correo") || lower.includes("newsletter") || lower.includes("klaviyo"));
    const hasEmailMarketing = lower.includes("email marketing") && (lower.includes("genera") || lower.includes("crea") || lower.includes("diseña") || lower.includes("workflow") || lower.includes("flujo"));
    if (!hasKlaviyoExplicit && !hasEmailWorkflow && !hasEmailMarketing) return null;
    const domainMatch = text.match(/([a-zA-Z0-9-]+\.myshopify\.com)/);
    const shopDomain = domainMatch?.[1] ?? "mitienda.myshopify.com";
    const storeName = shopDomain.split(".")[0].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    return { shopDomain, storeName, niche: "eCommerce" };
  };

  // ─── Send message ──────────────────────────────────────────────────────────
  const abortRef = useRef<AbortController | null>(null);
  // Pestaña pre-abierta dentro del gesto del usuario (evita bloqueo de pop-ups).
  // Se navega a la URL resuelta cuando el backend responde, o se cierra si no hay.
  const pendingTabRef = useRef<Window | null>(null);

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (loading) return;
    if (!content && !attachFile && !attachUrl) return;

    if (abortRef.current) { abortRef.current.abort(); }
    const controller = new AbortController();
    abortRef.current = controller;

    const hasAttach = !!(attachFile || attachUrl);
    const attachType = attachFile
      ? (attachFile.type.startsWith("image/") ? "image" : (attachFile.type.startsWith("video/") ? "video" : "document"))
      : "url";
    const attachName = attachFile?.name ?? attachUrl;

    const userMsg: Message = {
      id: uuid(), role: "user", content: content || `📎 ${attachName}`, timestamp: new Date(),
      attachmentType: hasAttach ? attachType as never : undefined,
      attachmentName: hasAttach ? attachName : undefined,
    };
    const thinkingId = uuid();
    const engineLabels: Record<string, string> = { auto: "gemini+claude+brain", claude: "claude", gemini: "gemini+search", brain_only: "brain", grok: "grok-3" };
    setMessages(m => [...m, userMsg, { id: thinkingId, role: "assistant" as const, content: "🧠 Analizando tu solicitud...", timestamp: new Date(), model: engineLabels[engineMode] || "gemini+claude+brain" }]);
    setInput(""); setAttachFile(null); setAttachFiles([]); setAttachUrl(""); setShowAttach(false);
    setLoading(true);

    pendingTabRef.current = null;
    let resolvedOpenUrl: string | undefined;

    const fetchWithTimeout = (url: string, opts: RequestInit, timeoutMs = 120000): Promise<Response> => {
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
    };

    try {
      let assistantContent = "";
      let action: ChatAction | undefined;
      let streamUsage: MsgUsage | undefined;

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
          setMessages(m => [...m, { id: uuid(), role: "assistant", content: `🚀 **Creando producto desde imagen** — ${attachName}\n\n**Paso 1** — Claude Vision analiza el producto en profundidad\n**Paso 2** — Gemini investiga precios REALES del mercado (búsquedas Google)\n**Paso 3** — Claude genera copywriting profesional optimizado\n**Paso 4** — Se crea el producto en tu tienda con la imagen\n\n_⏱️ Esto puede tardar 30-60 segundos. Investigando precios reales..._`, timestamp: new Date(), model: "gemini+claude+brain" }]);

          const formData = new FormData();
          formData.append("file", attachFile);
          formData.append("projectId", projectIdFromUrl!);
          if (content) formData.append("userInstruction", content);

          const prodRes = await fetchWithTimeout(`${API}/api/shopybrain/create-product-from-image`, {
            method: "POST", credentials: "include", body: formData,
          }, 180000);

          if (prodRes.ok) {
            const prodData = await prodRes.json();
            const p = prodData.product;
            const pr = prodData.pricing;
            const an = prodData.analysis;

            assistantContent = `✅ **Producto creado en tu tienda**\n\n`;
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
          const absorbingMsg = attachType === "document"
            ? `📄 Absorbiendo documento **${attachName}**...\n\nAnalizando contenido: estructura, datos, productos, precios, instrucciones...\nExtrayendo toda la información relevante para tu eCommerce.\n\n_Procesando con IA..._`
            : attachType === "image"
            ? `🔬 Absorbiendo imagen **${attachName}**...\n\nAnalizando: composición visual, paleta de colores, texturas y superficies, topología y geometría, técnica de rendering, composición química/técnica, inteligencia de marca, señales eCommerce, impacto psicológico...\n\n_Esto puede tardar 20-40 segundos._`
            : attachType === "video"
            ? `🎬 Absorbiendo vídeo **${attachName}**...\n\nExtrayendo: técnica de producción, estilo visual, señales de conversión, estrategia de marketing...\n\n_Procesando..._`
            : (() => {
                const urlInfo = classifyUrl(attachUrl);
                return `${urlInfo.icon} Absorbiendo **${urlInfo.label}**: ${attachUrl}\n\nExtrayendo: contenido, marca, productos, audiencia, estrategia, señales eCommerce...\n\n_Analizando con Gemini + Claude..._`;
              })();

          setMessages(m => [...m, { id: uuid(), role: "assistant", content: absorbingMsg, timestamp: new Date(), model: "gemini+claude+brain" }]);

          let result: AbsorbResult;
          const filesToProcess = attachFiles.length > 0 ? attachFiles : (attachFile ? [attachFile] : []);
          if (filesToProcess.length > 1) {
            const fileResults: Array<{ file: File; result?: AbsorbResult; error?: string }> = [];
            for (const f of filesToProcess) {
              try {
                const r = await absorbFile(f, undefined, controller.signal);
                fileResults.push({ file: f, result: r });
              } catch (e) {
                fileResults.push({ file: f, error: e instanceof Error ? e.message : String(e) });
              }
            }
            const successFiles = fileResults.filter(fr => fr.result && fr.result.success !== false);
            const failedFiles = fileResults.filter(fr => fr.error || (fr.result && fr.result.success === false));
            result = successFiles[0]?.result || { success: false, sourceType: "", title: "", analysis: {} } as AbsorbResult;
            if (successFiles.length === 0) {
              assistantContent = `❌ **0/${filesToProcess.length} archivos procesados** — todos fallaron.\n\n`;
            } else if (failedFiles.length > 0) {
              assistantContent = `⚠️ **${successFiles.length}/${filesToProcess.length} archivos absorbidos** (${failedFiles.length} con error)\n\n`;
            } else {
              assistantContent = `✅ **${successFiles.length}/${filesToProcess.length} archivos absorbidos a Shopy Crafter**\n\n`;
            }
            for (const fr of fileResults) {
              if (fr.result && fr.result.success !== false) {
                assistantContent += `✅ **${fr.file.name}** ${fr.result.memoryId ? `(memoria #${fr.result.memoryId.slice(0, 8)})` : ""}\n`;
              } else if (fr.result && fr.result.success === false) {
                assistantContent += `⚠️ **${fr.file.name}** — ${fr.result.message ?? "sin contenido textual extraíble"}\n`;
              } else {
                assistantContent += `❌ **${fr.file.name}** — ${fr.error}\n`;
              }
            }
            assistantContent += "\n";
          } else if (attachFile) {
            result = await absorbFile(attachFile, undefined, controller.signal);
            assistantContent = result.success === false
              ? `${result.message ?? `⚠️ No se pudo extraer contenido de "${attachName}".`}\n\n`
              : `✅ **Absorbido a Shopy Crafter**${result.memoryId ? ` (memoria #${result.memoryId.slice(0, 8)})` : ""}\n\n`;
          } else {
            result = await absorbUrl(attachUrl, undefined, controller.signal);
            assistantContent = `✅ **Absorbido a Shopy Crafter**${result.memoryId ? ` (memoria #${result.memoryId.slice(0, 8)})` : ""}\n\n`;
          }

          const isDocument = attachType === "document" || attachType === "video";
          const isImage = attachType === "image";
          const absorbOk = result.success !== false;

          if (absorbOk && isDocument) {
            const docAnalysis = typeof result.analysis === "string" ? result.analysis : JSON.stringify(result.analysis, null, 2);
            assistantContent += `📄 **Documento analizado:** ${attachName}\n`;
            assistantContent += `📊 **Tamaño:** ${(result as any).contentLength ?? "?"} caracteres\n\n`;
            assistantContent += `**Análisis:**\n${docAnalysis}\n\n`;
          } else if (absorbOk) {
            const a = result.analysis as Record<string, Record<string, string[]>>;
            const sourceNote = (result.analysis as Record<string, unknown> | undefined)?._source_note as string | undefined;
            const conf = (result.analysis as Record<string, unknown> | undefined)?._confidence as number | undefined;
            if (sourceNote) {
              assistantContent += `🔎 **Fuente:** ${sourceNote}${typeof conf === "number" ? ` _(fiabilidad ${Math.round(conf * 100)}%)_` : ""}\n\n`;
            }
            const angles = a?.ecommerce_conversion_signals?.recommended_marketing_angles ?? a?.actionable_insights_for_shopify?.recommended_marketing_angles as string[] ?? [];

            if (isImage && a?.visual_composition) {
              assistantContent += `**Composición:** ${typeof a.visual_composition === "string" ? a.visual_composition : JSON.stringify(a.visual_composition).slice(0, 200)}\n\n`;
            }
            if (a?.technical_chemical_composition) {
              assistantContent += `**Material/Técnica:** ${typeof a.technical_chemical_composition === "object" ? (a.technical_chemical_composition.manufacturing_process_indicators ?? JSON.stringify(a.technical_chemical_composition).slice(0, 150)) : a.technical_chemical_composition}\n\n`;
            }
            if (angles?.length > 0) {
              assistantContent += `**Top Marketing Angles:**\n${(Array.isArray(angles) ? angles : []).slice(0, 3).map(a => `· ${a}`).join("\n")}\n\n`;
            }
          }

          if (content) {
            assistantContent += `\n**Tu pregunta:** ${content}\n\n`;
            const followUp = await fetchWithTimeout(`${API}/api/shopybrain/search`, {
              method: "POST", credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query: content, returnRaw: true, systemPrompt: SYSTEM_PROMPT, currentRoute: location, engineMode }),
            });
            if (followUp.ok) {
              const d = await followUp.json();
              assistantContent += d.answer ?? "";
            }
          }

          if (absorbOk && !isDocument) {
            assistantContent += `\n_Haz clic en "Ver análisis completo" para explorar las ${Object.keys(result.analysis || {}).length} dimensiones analizadas._`;
          }
          if (absorbOk) {
            action = { type: "absorb-result", label: isDocument ? "Ver documento completo" : "Ver análisis completo", data: result };
          }
        }

      // ── CASE 2: Klaviyo workflow request ──
      } else if (detectKlaviyo(content)) {
        const kInfo = detectKlaviyo(content)!;
        setMessages(m => [...m, {
          id: uuid(), role: "assistant", timestamp: new Date(), model: "gemini+claude+brain",
          content: `🔄 Generando workflow Klaviyo para **${kInfo.storeName}**...\n\n**Paso 1** — Investigación del nicho ${kInfo.niche} en España\n**Paso 2** — Diseño de 6 flujos con emails HTML completos\n**Paso 3** — Guardado permanente del conocimiento\n\n_30-60 segundos..._`
        }]);

        const wfRes = await fetchWithTimeout(`${API}/api/klaviyo-ai/generate-workflow`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shopDomain: kInfo.shopDomain, storeName: kInfo.storeName, niche: kInfo.niche, market: "es" }),
        }, 180000);

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

        const researchResult = await researchEntity(entityInput, undefined, controller.signal);

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
          const followUp = await fetchWithTimeout(`${API}/api/shopybrain/search`, {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: content, returnRaw: true, systemPrompt: SYSTEM_PROMPT, currentRoute: location, engineMode }),
          });
          if (followUp.ok) { const d = await followUp.json(); assistantContent += d.answer ?? ""; }
        }

        assistantContent += `\n_Explora las pestañas del panel para ver social, productos, competidores y más._`;
        action = { type: "entity-research", label: "Ver perfil completo", data: researchResult };

      // ── CASE 4: Regular chat (with Shopify action detection) ──
      } else {

        // ── Gemini nativo: imagen, código o streaming SSE ──
        if (engineMode === "gemini") {

          // Normalizar prefijos de slash skills escritos directamente
          let geminiContent = content;
          if (/^\/imagen-gemini\s+/i.test(geminiContent)) {
            geminiContent = "[GEMINI-IMAGE] " + geminiContent.replace(/^\/imagen-gemini\s+/i, "");
          } else if (/^\/codigo-gemini\s+/i.test(geminiContent)) {
            geminiContent = "[GEMINI-CODE] " + geminiContent.replace(/^\/codigo-gemini\s+/i, "");
          }

          // Auto-detectar solicitudes de análisis de datos que se benefician del código Python
          const isCodeAnalyticsRequest = !geminiContent.startsWith("[GEMINI-IMAGE] ") && !geminiContent.startsWith("[GEMINI-CODE] ") && (() => {
            const lower = geminiContent.toLowerCase();
            const codeWords = ["calcula", "calcular", "cálculo", "python", "ejecuta código", "analiza datos", "analizar datos", "procesa datos", "compute", "calculate", "grafica los datos", "graficamente", "estadísticas de mi tienda"];
            const dataWords = ["datos de mi tienda", "data de ventas", "métricas de conversión", "kpis de", "revenue de mi", "ventas de mi tienda", "aov de mi"];
            return codeWords.some(w => lower.includes(w)) && dataWords.some(w => lower.includes(w));
          })();

          // A) Generación de imagen nativa
          if (geminiContent.startsWith("[GEMINI-IMAGE] ")) {
            const imagePrompt = geminiContent.replace("[GEMINI-IMAGE] ", "").trim();
            if (!imagePrompt) {
              assistantContent = "✍️ Escribe una descripción de la imagen que quieres generar. Ejemplo: `/imagen-gemini un producto de lujo sobre fondo negro con iluminación dramática`";
            } else {
              setMessages(m => m.map(msg => msg.id === thinkingId ? { ...msg, content: `🎨 Generando imagen con Gemini...\n\n_"${imagePrompt}"_\n\n_Puede tardar 15-30s..._`, model: "gemini-image" } : msg));
              try {
                const imgT0 = Date.now();
                const imgRes = await fetchWithTimeout(`${API}/api/shopybrain/gemini-image`, {
                  method: "POST", credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ prompt: imagePrompt }),
                }, 90000);
                if (imgRes.ok) {
                  const imgData = await imgRes.json() as { dataUrl?: string; b64_json?: string; mimeType?: string; model?: string; generationTimeMs?: number };
                  if (imgData.dataUrl) {
                    const elapsedSec = ((imgData.generationTimeMs ?? (Date.now() - imgT0)) / 1000).toFixed(1);
                    const modelLabel = imgData.model ?? "gemini-image";
                    assistantContent = `🎨 **Imagen generada con Gemini**\n\n_Prompt: "${imagePrompt}"_\n_Modelo: ${modelLabel} · ${elapsedSec}s_\n\n![Imagen generada por Gemini](${imgData.dataUrl})`;
                  } else {
                    assistantContent = `❌ Gemini no devolvió imagen. Prueba con una descripción más detallada.`;
                  }
                } else {
                  const errText = await imgRes.text().catch(() => "");
                  assistantContent = `❌ Error generando imagen (${imgRes.status}): ${errText.slice(0, 200)}`;
                }
              } catch (imgErr) {
                assistantContent = `❌ Error imagen: ${imgErr instanceof Error ? imgErr.message : String(imgErr)}`;
              }
            }

          // B) Ejecución de código Python (explícita o auto-detectada)
          } else if (geminiContent.startsWith("[GEMINI-CODE] ") || isCodeAnalyticsRequest) {
            const codePrompt = geminiContent.startsWith("[GEMINI-CODE] ")
              ? geminiContent.replace("[GEMINI-CODE] ", "").trim()
              : geminiContent;
            setMessages(m => m.map(msg => msg.id === thinkingId ? { ...msg, content: `💻 Ejecutando análisis con código Python...\n\n_Gemini ejecutará código real y mostrará los resultados._\n\n_⏱️ 15-30 segundos..._`, model: "gemini-code" } : msg));
            try {
              const codeRes = await fetchWithTimeout(`${API}/api/shopybrain/gemini-code`, {
                method: "POST", credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: codePrompt }),
              }, 120000);
              if (codeRes.ok) {
                const codeData = await codeRes.json() as { text?: string; code?: string; output?: string };
                let codeContent = `💻 **Análisis con código Python (Gemini)**\n\n`;
                if (codeData.text) codeContent += `${codeData.text}\n\n`;
                if (codeData.code) codeContent += `\`\`\`python\n${codeData.code}\n\`\`\`\n\n`;
                if (codeData.output) codeContent += `**Output:**\n\`\`\`\n${codeData.output}\n\`\`\``;
                assistantContent = codeContent || "Gemini no generó código en esta respuesta.";
              } else {
                const errText = await codeRes.text().catch(() => "");
                assistantContent = `❌ Error ejecutando código (${codeRes.status}): ${errText.slice(0, 200)}`;
              }
            } catch (codeErr) {
              assistantContent = `❌ Error código: ${codeErr instanceof Error ? codeErr.message : String(codeErr)}`;
            }

          // C) Chat normal con Gemini en streaming SSE + fallback automático
          } else {
            const convHistoryArr = messages.slice(-8).map(m => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            }));
            convHistoryArr.push({ role: "user", content });

            let streamFailed = false;
            try {
              const streamRes = await fetchWithTimeout(`${API}/api/shopybrain/gemini-stream`, {
                method: "POST", credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  messages: convHistoryArr,
                  systemPrompt: SYSTEM_PROMPT,
                  thinkingBudget: deepThinkMode ? 20000 : 0,
                  useSearch: true,
                }),
              }, 180000);

              if (!streamRes.ok || !streamRes.body) {
                streamFailed = true;
              } else {
                const reader = streamRes.body.getReader();
                const decoder = new TextDecoder();
                let streamBuffer = "";
                let isFirstChunk = true;
                let sseLineBuf = "";

                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  sseLineBuf += decoder.decode(value, { stream: true });
                  const lines = sseLineBuf.split("\n");
                  sseLineBuf = lines.pop() ?? "";
                  for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    try {
                      const ev = JSON.parse(line.slice(6)) as { text?: string; done?: boolean; error?: string; usage?: MsgUsage };
                      if (ev.error) {
                        streamFailed = true;
                      } else if (ev.done) {
                        if (ev.usage) streamUsage = ev.usage;
                      } else if (ev.text) {
                        streamBuffer += ev.text;
                        const snap = streamBuffer;
                        if (isFirstChunk) {
                          isFirstChunk = false;
                          setMessages(m => m.map(msg => msg.id === thinkingId ? { ...msg, content: snap + " ▋", model: deepThinkMode ? "gemini+think" : "gemini+search" } : msg));
                        } else {
                          setMessages(m => m.map(msg => msg.id === thinkingId ? { ...msg, content: snap + " ▋" } : msg));
                        }
                      }
                    } catch { /* ignore SSE parse errors */ }
                  }
                }
                if (streamBuffer && !streamFailed) {
                  assistantContent = streamBuffer;
                  // Detectar y ejecutar acciones Shopify incrustadas (:::ACTION:::...:::END_ACTION:::)
                  const streamActionRegex = /:::ACTION:::([\s\S]*?):::END_ACTION:::/g;
                  let aMatch;
                  const streamActions: { action: string; params: Record<string, unknown> }[] = [];
                  while ((aMatch = streamActionRegex.exec(assistantContent)) !== null) {
                    try { streamActions.push(JSON.parse(aMatch[1])); } catch { /* skip invalid */ }
                  }
                  if (streamActions.length > 0) {
                    assistantContent = assistantContent.replace(/:::ACTION:::[\s\S]*?:::END_ACTION:::/g, "").trim();
                    for (const act of streamActions) {
                      const actionResult = await executeShopifyAction(act.action, act.params);
                      if (actionResult) {
                        assistantContent += "\n\n" + formatActionResult(act.action, actionResult);
                        action = { type: "shopify-action", label: "Ver resultado", data: actionResult };
                      }
                    }
                  }
                } else {
                  streamFailed = true;
                }
              }
            } catch {
              streamFailed = true;
            }

            // Fallback automático: SSE falló → endpoint de búsqueda estándar
            if (streamFailed) {
              const convHistory = messages.slice(-8).map(m => `${m.role === "user" ? "Usuario" : "Shopy Crafter"}: ${m.content}`).join("\n\n");
              const projectIdFromUrl = location.match(/\/projects\/(\d+)/)?.[1];
              const fallbackRes = await fetchWithTimeout(`${API}/api/shopybrain/search`, {
                method: "POST", credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: content, returnRaw: true, systemPrompt: SYSTEM_PROMPT, conversationHistory: convHistory, currentRoute: location, activeProjectId: projectIdFromUrl, engineMode }),
              });
              if (fallbackRes.ok) {
                const fd = await fallbackRes.json();
                assistantContent = fd.answer ?? fd.result ?? "No pude procesar la respuesta.";
                if (fd.usage) {
                  const u = fd.usage;
                  streamUsage = {
                    inputTokens: u.inputTokens ?? 0,
                    outputTokens: u.outputTokens ?? 0,
                    thinkingTokens: 0,
                    totalTokens: (u.inputTokens ?? 0) + (u.outputTokens ?? 0),
                    costUsd: u.costUsd ?? 0,
                    model: u.model ?? "claude",
                  };
                }
              } else {
                assistantContent = "❌ Gemini no disponible temporalmente. Prueba con **Auto** o **Claude**.";
              }
            }
          }

        } else {
        // ── Otros motores (auto/claude/grok/brain_only): search endpoint ──
        const convHistory = messages.slice(-8).map(m => `${m.role === "user" ? "Usuario" : "Shopy Crafter"}: ${m.content}`).join("\n\n");
        const projectIdFromUrl = location.match(/\/projects\/(\d+)/)?.[1];
        const res = await fetchWithTimeout(`${API}/api/shopybrain/search`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: content, returnRaw: true, systemPrompt: SYSTEM_PROMPT, conversationHistory: convHistory, currentRoute: location, activeProjectId: projectIdFromUrl, engineMode }),
        });
        if (res.ok) {
          const d = await res.json();
          assistantContent = d.answer ?? d.result ?? "No pude procesar la respuesta.";
          if (d.usage) {
            const u = d.usage;
            streamUsage = {
              inputTokens: u.inputTokens ?? 0,
              outputTokens: u.outputTokens ?? 0,
              thinkingTokens: 0,
              totalTokens: (u.inputTokens ?? 0) + (u.outputTokens ?? 0),
              costUsd: u.costUsd ?? 0,
              model: u.model ?? (engineLabels[engineMode as keyof typeof engineLabels] ?? "claude"),
            };
          }

          const longActions: Record<string, string> = {
            generate_competitive_pricing: "🔍 **Investigación de mercado en curso...**\n\n**Paso 1** — Buscando precios reales de competidores con Google Search\n**Paso 2** — Analizando posicionamiento del mercado\n**Paso 3** — Generando catálogo de precios competitivo\n**Paso 4** — Actualizando CMS y creando productos en tu tienda\n\n_⏱️ Esto toma 30-90 segundos. Investigando datos reales del mercado..._",
            copyright_audit: "⚖️ **Auditoría de Copyright en curso...**\n\n**Paso 1** — Cargando catálogo completo de la tienda\n**Paso 2** — Analizando cada producto buscando marcas registradas y derechos de autor\n**Paso 3** — Generando sugerencias de nombres alternativos\n\n_⏱️ 15-30 segundos..._",
            audit_app_offerings: "🔍 **Auditando la oferta de Shopy Crafter...**\n\n**Paso 1** — Leyendo planes y features actuales del CMS\n**Paso 2** — Comparando con capacidades reales de la plataforma\n**Paso 3** — Analizando pricing vs. valor entregado\n**Paso 4** — Generando recomendaciones estratégicas\n\n_⏱️ Analizando... 15-30 segundos._",
            scan_store: "📊 **Escaneando tienda...**\n\n**Paso 1** — Conectando con la API de tu tienda\n**Paso 2** — Descargando catálogo completo\n**Paso 3** — Analizando calidad de cada producto\n\n_⏱️ Dependiendo del catálogo, 10-60 segundos..._",
            optimize_all_products: "🧠 **Optimización masiva con IA...**\n\n**Paso 1** — Cargando productos de tu tienda\n**Paso 2** — Claude genera SEO + copywriting para cada producto\n**Paso 3** — Actualizando títulos, descripciones, tags y meta\n\n_⏱️ ~5 segundos por producto..._",
            design_all_pages: "📄 **Diseñando páginas de la tienda...**\n\n**Paso 1** — Analizando nicho y marca\n**Paso 2** — Claude genera contenido profesional para cada página\n**Paso 3** — Creando páginas en tu tienda\n\n_⏱️ ~10 segundos por página..._",
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
                const actionType = act.action === "search_suppliers" ? "supplier-research"
                  : act.action === "browser_action" ? "browser-action"
                  : act.action === "browser_research" ? "browser-action"
                  : act.action === "generate_brand_book" ? "browser-action"
                  : "shopify-action";
                const actionLabel = act.action === "search_suppliers" ? "Descargar informe"
                  : act.action === "browser_action" ? "Ver navegación"
                  : act.action === "browser_research" ? "Ver informe"
                  : act.action === "generate_brand_book" ? "Ver Brand Book"
                  : "Ver resultado";
                action = { type: actionType as ChatAction["type"], label: actionLabel, data: actionResult, actionName: act.action, formattedContent: formatted };
                // Captura la primera URL "abrible" devuelta por el backend,
                // restringida a http(s) por seguridad (nunca javascript:/data:).
                if (!resolvedOpenUrl && typeof actionResult.openUrl === "string" && actionResult.openUrl) {
                  try {
                    const proto = new URL(actionResult.openUrl).protocol;
                    if (proto === "http:" || proto === "https:") resolvedOpenUrl = actionResult.openUrl;
                  } catch { /* URL inválida → ignorar */ }
                }
              }
            }
            if (results.length > 0) {
              assistantContent += "\n\n" + results.join("\n\n---\n\n");
            }
          }
        } else {
          let errDetail = "";
          try { const errBody = await res.json(); errDetail = errBody.error || errBody.message || ""; } catch { /* ignore */ }
          assistantContent = `❌ **Error ${res.status}** en el servidor.${errDetail ? `\n\n_${errDetail}_` : ""}\n\nPuedes intentarlo de nuevo o usar un mensaje más corto. Si persiste, recarga la página.`;
        }
        } // fin motores no-Gemini
      }

      const finalUsage = streamUsage;
      setMessages(m => {
        const progressIndicators = ["Absorbiendo", "Generando workflow", "detectada. Absorbiendo", "Investigación exhaustiva paralela iniciada", "Investigación de mercado en curso", "Auditando la oferta", "Escaneando tienda", "Optimización masiva con IA", "Diseñando páginas de la tienda", "Investigando proveedores...", "Diagnóstico de la app en curso", "Ejecutando", "acciones en secuencia", "Creando producto profesional", "Rediseñando producto", "Rediseño masivo", "Auditoría SEO Semrush", "Investigando keywords", "Generando estrategia de blog", "Escribiendo artículo SEO", "Configuración completa de tienda", "Creando flujo de email", "Generando forecast financiero", "Generando propuesta comercial", "Generando imágenes IA", "Analizando tu solicitud"];
        const filtered = m.filter(msg => msg.id !== thinkingId && !(msg.role === "assistant" && progressIndicators.some(p => msg.content.includes(p))));
        return [...filtered, { id: uuid(), role: "assistant" as const, content: assistantContent, timestamp: new Date(), model: engineLabels[engineMode] || "gemini+claude+brain", action, usage: finalUsage }];
      });
      if (finalUsage) {
        setSessionUsage(prev => ({
          totalTokens: prev.totalTokens + finalUsage.totalTokens,
          totalCostUsd: prev.totalCostUsd + finalUsage.costUsd,
          msgCount: prev.msgCount + 1,
        }));
      }
      if (voiceEnabled && assistantContent) {
        setTimeout(() => speakText(assistantContent), 200);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Fallo de conexión";
      const isTimeout = errMsg === "timeout" || errMsg.includes("aborted");
      const displayMsg = isTimeout
        ? "⏳ La solicitud tardó demasiado. Por favor, intenta con un mensaje más corto o inténtalo de nuevo."
        : `❌ Error: ${errMsg}`;
      setMessages(m => {
        const filtered = m.filter(msg => msg.id !== thinkingId);
        return [...filtered, { id: uuid(), role: "assistant" as const, content: displayMsg, timestamp: new Date() }];
      });
    } finally {
      // Si se resolvió una URL durante la respuesta, abrirla directamente ahora
      // (estamos en el finally del evento de usuario original, el bloqueador no aplica).
      if (resolvedOpenUrl) {
        try { window.open(resolvedOpenUrl, "_blank", "noreferrer"); } catch {}
      }
      pendingTabRef.current = null;
      setLoading(false);
      abortRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, loading, messages, attachFile, attachFiles, attachUrl, engineMode, location]);

  useEffect(() => {
    if (!isListening && pendingTranscriptRef.current) {
      const t = pendingTranscriptRef.current;
      pendingTranscriptRef.current = null;
      sendMessage(t);
    }
  }, [isListening, sendMessage]);

  const getFilteredSkills = () => SLASH_SKILLS.filter(s =>
    !slashFilter ||
    s.cmd.slice(1).startsWith(slashFilter) ||
    s.label.toLowerCase().includes(slashFilter) ||
    s.desc.toLowerCase().includes(slashFilter)
  );

  const handleSlashSelect = (skill: SlashSkill) => {
    setSlashMenuOpen(false);
    setSlashFilter("");
    setInput("");
    if (skill.isResearch) {
      const entity = prompt("¿Qué marca, empresa o persona quieres investigar?\n\nPuedes escribir: URL, nombre, @instagram, dominio...");
      if (entity?.trim()) sendMessage(entity.trim());
    } else {
      sendMessage(skill.prompt);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (slashMenuOpen) {
      const filtered = getFilteredSkills();
      if (e.key === "ArrowDown") { e.preventDefault(); setSlashSelectedIdx(i => Math.min(i + 1, filtered.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSlashSelectedIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === "Escape") { e.preventDefault(); setSlashMenuOpen(false); setSlashFilter(""); setInput(""); return; }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const skill = filtered[slashSelectedIdx];
        if (skill) handleSlashSelect(skill);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const skill = filtered[slashSelectedIdx];
        if (skill) { setInput(skill.cmd + " "); setSlashMenuOpen(false); setSlashFilter(""); }
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (!user) return null;

  return (
    <>
      {selectedFlow && <FlowModal flow={selectedFlow} onClose={() => setSelectedFlow(null)} />}

      {/* Floating button */}
      {!open && (
        <div
          {...chatDragHandlers}
          style={{
            position: "fixed",
            bottom: dragPos.bottom,
            right: dragPos.right,
            zIndex: 9990,
            touchAction: "none",
            userSelect: "none",
          }}
        >
          <button onClick={() => { if (!chatWasDragged) setOpen(true); }} aria-label="Abrir asistente Shopy Crafter" style={{
            width: isMobile ? 52 : 58, height: isMobile ? 52 : 58,
            borderRadius: "50%", background: "linear-gradient(135deg, #c8a84b, #e6c668)",
            border: "none", cursor: "pointer", zIndex: 9990,
            boxShadow: "0 4px 24px rgba(200,168,75,0.45), 0 0 0 0 rgba(200,168,75,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "pulseGold 3s ease-in-out infinite",
          }}>
            <Brain size={isMobile ? 22 : 26} style={{ color: "#0a0a0f" }} />
          </button>
        </div>
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
            bottom: isMobile ? 0 : 24,
            right: isMobile ? 0 : 24,
            width: isMobile ? "min(96vw, 440px)" : (minimized ? 290 : "min(440px, calc(100vw - 48px))"),
            height: isMobile
              ? (minimized ? 52 : "min(82dvh, 600px)")
              : (minimized ? 52 : "min(640px, calc(100dvh - 48px))"),
            background: "var(--ink)",
            border: `1px solid ${isDragging ? "var(--jade)" : "rgba(200,168,75,0.28)"}`,
            borderRadius: 16, zIndex: 9990, display: "flex", flexDirection: "column",
            boxShadow: isDragging ? "0 0 0 2px var(--jade), 0 8px 40px rgba(0,0,0,0.6)" : "0 8px 40px rgba(0,0,0,0.6)",
            transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)", overflow: "hidden",
          }}>

          {/* Header */}
          <div style={{ padding: isMobile ? "10px max(12px, env(safe-area-inset-right, 0px)) 10px max(12px, env(safe-area-inset-left, 0px))" : "12px 14px", borderBottom: minimized ? "none" : "1px solid var(--ink3)", background: "linear-gradient(135deg, rgba(200,168,75,0.07), rgba(200,168,75,0.03))", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, var(--gold), #a07830)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Brain size={16} style={{ color: "#fff" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--t)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Shopy Crafter · Asistente</p>
              {!minimized && (
                <p style={{ margin: 0, fontSize: 9, color: "var(--jade)" }}>
                  🔬 Gemini · 🧠 Claude · 💾 Brain — Listo
                  {sessionUsage.msgCount > 0 && (
                    <span style={{ color: "var(--t4)", marginLeft: 5 }}>
                      · {fmtTokens(sessionUsage.totalTokens)} tok · {fmtCost(sessionUsage.totalCostUsd)}
                    </span>
                  )}
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button onClick={() => setMinimized(!minimized)} aria-label={minimized ? "Expandir chat" : "Minimizar chat"} style={{ width: isMobile ? 44 : 36, height: isMobile ? 44 : 36, minWidth: isMobile ? 44 : 36, borderRadius: 8, border: "none", background: "var(--ink2)", color: "var(--t3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {minimized ? <Maximize2 size={isMobile ? 18 : 14} /> : <Minimize2 size={isMobile ? 18 : 14} />}
              </button>
              <button
                onClick={() => { setVoiceEnabled(v => !v); if (voiceEnabled) window.speechSynthesis?.cancel(); }}
                title={voiceEnabled ? "Desactivar voz — conversación fluída activa" : "Activar conversación por voz"}
                aria-label={voiceEnabled ? "Desactivar voz" : "Activar voz"}
                style={{ width: isMobile ? 44 : 36, height: isMobile ? 44 : 36, minWidth: isMobile ? 44 : 36, borderRadius: 8, border: "none", background: voiceEnabled ? "rgba(45,212,159,0.18)" : "var(--ink2)", color: voiceEnabled ? "var(--jade)" : "var(--t3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s, color 0.2s" }}
              >
                {voiceEnabled ? <Volume2 size={isMobile ? 18 : 14} /> : <VolumeX size={isMobile ? 18 : 14} />}
              </button>
              <button onClick={() => setOpen(false)} aria-label="Cerrar chat" style={{ width: isMobile ? 44 : 36, height: isMobile ? 44 : 36, minWidth: isMobile ? 44 : 36, borderRadius: 8, border: "none", background: "var(--ink2)", color: "var(--t3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={isMobile ? 18 : 14} />
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
              <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "14px max(12px, env(safe-area-inset-left, 0px)) 14px max(12px, env(safe-area-inset-right, 0px))" : "14px 12px", display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
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
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5, flexWrap: "wrap" }}>
                          <Brain size={10} style={{ color: "var(--gold)", flexShrink: 0 }} />
                          <span style={{ fontSize: 9, color: "var(--gold)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Shopy Crafter</span>
                          {msg.model && (() => {
                            const m = msg.model.toLowerCase();
                            const isGemini = m.includes("gemini");
                            const isClaude = m.includes("claude") || m.includes("anthropic");
                            const color = isGemini ? "var(--jade)" : isClaude ? "var(--gold)" : "var(--t4)";
                            const bg = isGemini ? "rgba(45,212,159,0.10)" : isClaude ? "rgba(200,168,75,0.10)" : "rgba(255,255,255,0.05)";
                            const icon = isGemini ? "🔬" : isClaude ? "🧠" : "💡";
                            const MODEL_ALIAS: Record<string, string> = {
                              // Gemini
                              "gemini-2.5-flash": "Gemini Flash 2.5",
                              "gemini-2.5-flash-latest": "Gemini Flash 2.5",
                              "gemini-2.5-pro": "Gemini Pro 2.5",
                              "gemini-2.5-pro-latest": "Gemini Pro 2.5",
                              "gemini-2.0-flash": "Gemini Flash 2.0",
                              "gemini-2.0-flash-exp": "Gemini Flash 2.0",
                              "gemini-1.5-flash": "Gemini Flash 1.5",
                              "gemini-1.5-flash-latest": "Gemini Flash 1.5",
                              "gemini-1.5-pro": "Gemini Pro 1.5",
                              "gemini-1.5-pro-latest": "Gemini Pro 1.5",
                              "gemini-3.5-flash": "Gemini Flash 3.5",
                              "gemini-3.5-flash-latest": "Gemini Flash 3.5",
                              // Claude
                              "claude-opus-4-8": "Claude Opus 4",
                              "claude-opus-4-5": "Claude Opus 4",
                              "claude-sonnet-4-6": "Claude Sonnet 4",
                              "claude-sonnet-4-5": "Claude Sonnet 4",
                              "claude-3-7-sonnet-latest": "Claude Sonnet 3.7",
                              "claude-3-7-sonnet-20250219": "Claude Sonnet 3.7",
                              "claude-3-5-sonnet-latest": "Claude Sonnet 3.5",
                              "claude-3-5-sonnet-20241022": "Claude Sonnet 3.5",
                              "claude-3-5-haiku-latest": "Claude Haiku 3.5",
                              "claude-3-5-haiku-20241022": "Claude Haiku 3.5",
                              "claude-3-opus-latest": "Claude Opus 3",
                              "claude-3-haiku-20240307": "Claude Haiku 3",
                              // Grok / xAI
                              "grok-3": "Grok 3",
                              "grok-3-mini": "Grok 3 Mini",
                              "grok-2": "Grok 2",
                              "grok-2-mini": "Grok 2 Mini",
                              "grok-beta": "Grok Beta",
                            };
                            const shortName = MODEL_ALIAS[m] ?? MODEL_ALIAS[msg.model] ?? msg.model;
                            return (
                              <span style={{ fontSize: 8, color, background: bg, border: `1px solid ${color}`, borderRadius: 4, padding: "1px 5px", fontWeight: 600, letterSpacing: "0.3px", whiteSpace: "nowrap" }}>
                                {icon} {shortName}
                              </span>
                            );
                          })()}
                        </div>
                      )}
                      {msg.attachmentType && (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 8px", background: "rgba(200,168,75,0.08)", borderRadius: 5, marginBottom: 6, width: "fit-content" }}>
                          {msg.attachmentType === "image" ? <Image size={10} style={{ color: "var(--gold)" }} /> : msg.attachmentType === "video" ? <Video size={10} style={{ color: "var(--gold)" }} /> : <Link size={10} style={{ color: "var(--gold)" }} />}
                          <span style={{ fontSize: 9, color: "var(--gold)" }}>{msg.attachmentName?.slice(0, 40)}</span>
                        </div>
                      )}
                      <div>{formatMessage(msg.content)}</div>
                      {msg.usage && (
                        <div style={{ marginTop: 5, paddingTop: 5, borderTop: "1px solid var(--ink3)", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ fontSize: 9, color: "var(--t4)", display: "flex", alignItems: "center", gap: 3 }}>
                            🔢 <strong style={{ color: "var(--t3)" }}>{fmtTokens(msg.usage.totalTokens)}</strong> tokens
                          </span>
                          <span style={{ fontSize: 9, color: "var(--t4)" }}>·</span>
                          <span style={{ fontSize: 9, color: "var(--t4)" }}>
                            in <strong style={{ color: "var(--t3)" }}>{fmtTokens(msg.usage.inputTokens)}</strong> · out <strong style={{ color: "var(--t3)" }}>{fmtTokens(msg.usage.outputTokens)}</strong>
                          </span>
                          {msg.usage.thinkingTokens > 0 && (
                            <>
                              <span style={{ fontSize: 9, color: "var(--t4)" }}>·</span>
                              <span style={{ fontSize: 9, color: "var(--jade)", display: "flex", alignItems: "center", gap: 2 }}>
                                🧩 <strong>{fmtTokens(msg.usage.thinkingTokens)}</strong> think
                              </span>
                            </>
                          )}
                          <span style={{ fontSize: 9, color: "var(--t4)" }}>·</span>
                          <span style={{ fontSize: 9, color: "var(--gold)", fontWeight: 600 }}>{fmtCost(msg.usage.costUsd)}</span>
                        </div>
                      )}
                      {msg.action?.type === "absorb-result" && (
                        <AbsorbResultCard data={msg.action.data as AbsorbResult} />
                      )}
                      {msg.action?.type === "klaviyo-workflow" && (
                        <KlaviyoResultCard data={msg.action.data as KlaviyoWorkflowResult} onViewFlow={setSelectedFlow} />
                      )}
                      {msg.action?.type === "entity-research" && (
                        <EntityResearchCard data={msg.action.data as EntityResearchResult} />
                      )}
                      {msg.action?.type === "browser-action" && (() => {
                        const actionName = msg.action!.actionName;
                        const data = msg.action!.data as any;
                        if (!data) return null;

                        // ── browser_research / generate_brand_book → Vault links ──
                        if (actionName === "browser_research" || actionName === "generate_brand_book") {
                          const icon = actionName === "generate_brand_book" ? "📖" : "📊";
                          const label = actionName === "generate_brand_book" ? "Brand Book" : "Informe de investigación";
                          const vaultUrl = data.vaultUrl;
                          const topic = data.topic || data.brandName || "";
                          return (
                            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                              {vaultUrl ? (
                                <div style={{ background: "rgba(196,165,90,0.07)", border: "1px solid rgba(196,165,90,0.25)", borderRadius: 10, padding: "14px 16px" }}>
                                  <div style={{ fontSize: 11, color: "var(--gold)", fontWeight: 700, marginBottom: 10 }}>{icon} {label}{topic ? ` — "${topic}"` : ""}</div>
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    <a href={vaultUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", background: "rgba(196,165,90,0.15)", border: "1px solid rgba(196,165,90,0.4)", borderRadius: 7, fontSize: 11, color: "var(--gold)", textDecoration: "none", fontWeight: 600 }}>
                                      🌐 Ver informe
                                    </a>
                                    <a href={`${vaultUrl}?format=pdf`} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", background: "rgba(100,100,100,0.15)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 7, fontSize: 11, color: "#d0c8bc", textDecoration: "none" }}>
                                      📥 Descargar PDF
                                    </a>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ fontSize: 11, color: "var(--t3)", fontStyle: "italic" }}>⚠️ Sin projectId — el informe no se guardó en el Vault.</div>
                              )}
                              {data.screenshots?.length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  {data.screenshots.map((sc: { label: string; dataUrl: string }, i: number) => (
                                    <div key={i} style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--ink3)" }}>
                                      <div style={{ padding: "4px 10px", background: "var(--ink2)", fontSize: 10, color: "var(--t3)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <span>📸 {sc.label}</span>
                                        <a href={sc.dataUrl} download={`${sc.label}.jpg`} style={{ color: "var(--gold)", textDecoration: "none", fontSize: 10 }}>⬇</a>
                                      </div>
                                      <img src={sc.dataUrl} alt={sc.label} style={{ width: "100%", display: "block", maxHeight: 260, objectFit: "cover" }} />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        }

                        // ── browser_action → YouTube / URL / screenshots ──
                        const br = data as BrowserActionResult;
                        const safeHttp = (u?: string) => {
                          if (!u) return undefined;
                          try { const p = new URL(u).protocol; return (p === "http:" || p === "https:") ? u : undefined; }
                          catch { return undefined; }
                        };
                        const openHref = safeHttp(br.openUrl) || safeHttp(br.finalUrl);
                        return (
                          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                            {openHref && (
                              <a href={openHref} target="_blank" rel="noreferrer"
                                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "linear-gradient(135deg, rgba(196,165,90,0.9), rgba(160,130,60,0.9))", border: "1px solid var(--gold)", borderRadius: 10, fontSize: 13, color: "#1a1408", textDecoration: "none", width: "fit-content", fontWeight: 800, boxShadow: "0 2px 10px rgba(196,165,90,0.25)" }}>
                                ▶️ Abrir ahora{br.title ? ` — ${br.title.length > 50 ? br.title.slice(0, 50) + "…" : br.title}` : ""}
                              </a>
                            )}
                            {br.youtubeEmbed && (
                              <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--ink3)" }}>
                                <div style={{ padding: "6px 10px", background: "rgba(255,0,0,0.12)", display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ fontSize: 14 }}>▶️</span>
                                  <span style={{ fontSize: 11, color: "#ff4040", fontWeight: 600 }}>YouTube</span>
                                  {br.finalUrl && (
                                    <a href={br.finalUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "var(--gold)", marginLeft: "auto", textDecoration: "none", padding: "3px 8px", background: "rgba(196,165,90,0.12)", borderRadius: 5, border: "1px solid rgba(196,165,90,0.3)" }}>
                                      Abrir en nueva pestaña ↗
                                    </a>
                                  )}
                                </div>
                                <iframe src={br.youtubeEmbed} width="100%" height="220"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen style={{ border: "none", display: "block" }} />
                              </div>
                            )}
                            {!br.youtubeEmbed && br.finalUrl && (
                              <a href={br.finalUrl} target="_blank" rel="noreferrer"
                                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "rgba(200,168,75,0.1)", border: "1px solid rgba(200,168,75,0.35)", borderRadius: 8, fontSize: 11, color: "var(--gold)", textDecoration: "none", width: "fit-content", fontWeight: 600 }}>
                                🔗 Abrir en nueva pestaña ↗ {br.finalUrl.length > 45 ? br.finalUrl.slice(0, 45) + "..." : br.finalUrl}
                              </a>
                            )}
                            {br.screenshots && br.screenshots.length > 0 && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {br.screenshots.map((sc, i) => (
                                  <div key={i} style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--ink3)" }}>
                                    <div style={{ padding: "4px 10px", background: "var(--ink2)", fontSize: 10, color: "var(--t3)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                      <span>📸 {sc.label}</span>
                                      <a href={sc.dataUrl} download={`${sc.label}.jpg`} style={{ color: "var(--gold)", textDecoration: "none", fontSize: 10 }}>⬇ Descargar</a>
                                    </div>
                                    <img src={sc.dataUrl} alt={sc.label} style={{ width: "100%", display: "block", maxHeight: 300, objectFit: "cover" }} />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
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
              <div style={{ padding: isMobile ? "8px max(12px, env(safe-area-inset-left, 0px)) max(10px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-right, 0px))" : "8px 12px 10px", borderTop: "1px solid var(--ink3)", flexShrink: 0 }}>
                {/* Quick actions */}
                <button onClick={() => setShowActions(!showActions)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "var(--t3)", fontSize: 10, cursor: "pointer", marginBottom: 5, padding: "2px 0" }}>
                  <Sparkles size={10} />
                  Acciones rápidas
                  <ChevronDown size={9} style={{ transform: showActions ? "rotate(180deg)" : "rotate(0)", transition: "0.2s" }} />
                </button>
                {showActions && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(120px, 100%), 1fr))", gap: 4, marginBottom: 6 }}>
                    {quickActions.map((action, i) => (
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
                  <AttachmentPreview file={attachFile} url={attachUrl} onRemove={() => { setAttachFile(null); setAttachFiles([]); setAttachUrl(""); }} />
                )}
                {attachFiles.length > 1 && (
                  <div style={{ fontSize: 9, color: "var(--t3)", marginBottom: 4, textAlign: "center" }}>
                    +{attachFiles.length - 1} archivo{attachFiles.length > 2 ? "s" : ""} más seleccionado{attachFiles.length > 2 ? "s" : ""}
                  </div>
                )}

                {/* Slash command skill picker */}
                {slashMenuOpen && (() => {
                  const filtered = getFilteredSkills();
                  if (filtered.length === 0) return null;
                  return (
                    <div ref={slashMenuRef} style={{
                      marginBottom: 6, background: "var(--ink)",
                      border: "1px solid rgba(200,168,75,0.5)", borderRadius: 10,
                      overflow: "hidden", maxHeight: 280, overflowY: "auto",
                      boxShadow: "0 -8px 32px rgba(0,0,0,0.5)",
                    }}>
                      <div style={{
                        padding: "6px 12px", borderBottom: "1px solid var(--ink3)",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        background: "rgba(200,168,75,0.06)",
                      }}>
                        <span style={{ fontSize: 10, color: "var(--gold)", fontWeight: 700, letterSpacing: 1.2 }}>⚡ SKILLS — {filtered.length} disponibles</span>
                        <span style={{ fontSize: 9, color: "var(--t4)" }}>↑↓ navegar · Enter ejecutar · Tab completar · Esc cerrar</span>
                      </div>
                      {filtered.map((skill, i) => (
                        <button key={skill.cmd} onClick={() => handleSlashSelect(skill)}
                          onMouseEnter={() => setSlashSelectedIdx(i)}
                          style={{
                            width: "100%", display: "flex", alignItems: "center", gap: 10,
                            padding: "9px 12px", border: "none", cursor: "pointer", textAlign: "left",
                            background: i === slashSelectedIdx ? "rgba(200,168,75,0.1)" : "transparent",
                            borderLeft: `2px solid ${i === slashSelectedIdx ? "var(--gold)" : "transparent"}`,
                            transition: "all 0.1s",
                          }}>
                          <span style={{ fontSize: 20, flexShrink: 0, width: 28, textAlign: "center", lineHeight: 1 }}>{skill.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <span style={{
                                fontSize: 12, fontWeight: 700, fontFamily: "monospace",
                                color: i === slashSelectedIdx ? "var(--gold)" : "var(--t2)",
                              }}>{skill.cmd}</span>
                              <span style={{ fontSize: 11, color: "var(--t)" }}>{skill.label}</span>
                              <span style={{
                                fontSize: 9, padding: "1px 5px", borderRadius: 4,
                                background: skill.engine === "claude" ? "rgba(200,168,75,0.12)" : skill.engine === "gemini" ? "rgba(45,212,159,0.12)" : "rgba(120,120,180,0.12)",
                                color: skill.engine === "claude" ? "var(--gold)" : skill.engine === "gemini" ? "var(--jade)" : "var(--t3)",
                                marginLeft: "auto", flexShrink: 0,
                              }}>{skill.engine}</span>
                            </div>
                            <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 1 }}>{skill.desc}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })()}

                {/* Text input row */}
                <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                  <button onClick={() => setShowAttach(!showAttach)} aria-label="Adjuntar archivo"
                    style={{ width: isMobile ? 44 : 36, height: isMobile ? 44 : 36, minWidth: isMobile ? 44 : 36, borderRadius: 8, border: `1px solid ${showAttach ? "var(--gold)" : "var(--ink3)"}`, background: showAttach ? "rgba(200,168,75,0.1)" : "var(--ink2)", color: showAttach ? "var(--gold)" : "var(--t3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: isMobile ? 18 : 15 }}>
                    📎
                  </button>
                  <textarea ref={inputRef} value={input} onChange={e => {
                    const val = e.target.value;
                    setInput(val);
                    if (val.startsWith("/") && !val.includes(" ") && !val.startsWith("//")) {
                      setSlashMenuOpen(true);
                      setSlashFilter(val.slice(1).toLowerCase());
                      setSlashSelectedIdx(0);
                    } else {
                      setSlashMenuOpen(false);
                      setSlashFilter("");
                    }
                  }} onKeyDown={handleKeyDown} disabled={loading}
                    placeholder={isListening ? "🎙 Escuchando..." : attachFile || attachUrl ? "Opcional: añade contexto..." : "Escribe un mensaje, pega una URL… o pulsa / para ver skills disponibles"}
                    rows={1}
                    style={{ flex: 1, padding: isMobile ? "10px 12px" : "8px 10px", background: isListening ? "rgba(232,69,88,0.08)" : "var(--ink2)", border: `1px solid ${isListening ? "var(--crim)" : "var(--ink3)"}`, borderRadius: 8, color: "var(--t)", fontSize: isMobile ? 16 : 13, resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.4, maxHeight: isMobile ? 100 : 80, overflowY: "auto", transition: "border-color 0.2s, background 0.2s", minHeight: isMobile ? 44 : 36 }}
                    onInput={e => { const el = e.target as HTMLTextAreaElement; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, isMobile ? 100 : 80)}px`; }}
                  />
                  <button onClick={toggleMic} disabled={loading} aria-label={isListening ? "Detener micrófono" : "Activar micrófono"}
                    style={{
                      width: isMobile ? 44 : 36, height: isMobile ? 44 : 36, minWidth: isMobile ? 44 : 36, borderRadius: 8, border: "none", flexShrink: 0,
                      background: isListening ? "var(--crim)" : "var(--ink2)",
                      color: isListening ? "#fff" : "var(--t3)",
                      cursor: loading ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
                      animation: isListening ? "pulseGold 1.5s ease-in-out infinite" : "none",
                    }}>
                    {isListening ? <MicOff size={isMobile ? 18 : 15} /> : <Mic size={isMobile ? 18 : 15} />}
                  </button>
                  <button onClick={() => sendMessage()} disabled={loading || (!input.trim() && !attachFile && !attachUrl)} aria-label="Enviar mensaje"
                    style={{
                      width: isMobile ? 44 : 36, height: isMobile ? 44 : 36, minWidth: isMobile ? 44 : 36, borderRadius: 8, border: "none", flexShrink: 0,
                      background: loading || (!input.trim() && !attachFile && !attachUrl) ? "var(--ink3)" : "var(--gold)",
                      color: loading || (!input.trim() && !attachFile && !attachUrl) ? "var(--t4)" : "var(--ink)",
                      cursor: loading || (!input.trim() && !attachFile && !attachUrl) ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
                    }}>
                    {loading ? <Loader2 size={isMobile ? 18 : 15} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={isMobile ? 18 : 15} />}
                  </button>
                </div>

                {/* Engine selector */}
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5, justifyContent: "center", flexWrap: "wrap" }}>
                  {([
                    { key: "auto",       icon: "⚡", label: "Auto",   title: "Selección automática — elige el mejor motor según tu pregunta" },
                    { key: "claude",     icon: "🧠", label: "Claude", title: "Claude (Anthropic) — escritura profunda, código, análisis estratégico, informes largos" },
                    { key: "gemini",     icon: "🔬", label: "Gemini", title: "Gemini (Google) — streaming en tiempo real + búsqueda web, /imagen-gemini y /codigo-gemini" },
                    { key: "grok",       icon: "🤖", label: "Grok",   title: "Grok (xAI) — razonamiento rápido, perspectiva alternativa, análisis directo" },
                    { key: "brain_only", icon: "💾", label: "Brain",  title: "Solo memoria ShopyBrain — responde desde el conocimiento acumulado de tu tienda" },
                  ] as const).map(({ key, icon, label, title }) => (
                    <button key={key} onClick={() => setEngineMode(key)} title={title}
                      style={{
                        fontSize: 9, padding: "4px 8px", borderRadius: 4, cursor: "pointer",
                        border: engineMode === key ? "1px solid var(--gold)" : "1px solid transparent",
                        background: engineMode === key ? "rgba(200,168,75,0.15)" : "transparent",
                        color: engineMode === key ? "var(--gold)" : "var(--t4)",
                        display: "flex", alignItems: "center", gap: 3, transition: "all 0.2s",
                        minHeight: 28,
                      }}>
                      {icon} {label}
                    </button>
                  ))}
                  {/* Deep Think toggle — solo visible con motor Gemini */}
                  {engineMode === "gemini" && (
                    <button
                      onClick={() => setDeepThinkMode(v => !v)}
                      title={deepThinkMode ? "Deep Think activado — Gemini usa 20.000 tokens de razonamiento. Haz clic para desactivar." : "Activar Deep Think — Gemini razona en profundidad antes de responder (más lento, más preciso)"}
                      style={{
                        fontSize: 9, padding: "4px 8px", borderRadius: 4, cursor: "pointer",
                        border: deepThinkMode ? "1px solid var(--jade)" : "1px solid rgba(45,212,159,0.3)",
                        background: deepThinkMode ? "rgba(45,212,159,0.15)" : "transparent",
                        color: deepThinkMode ? "var(--jade)" : "var(--t4)",
                        display: "flex", alignItems: "center", gap: 3, transition: "all 0.2s",
                        minHeight: 28,
                      }}>
                      🧩 {deepThinkMode ? "Think ON" : "Deep Think"}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,audio/*,.txt,.md,.markdown,.csv,.tsv,.json,.jsonl,.ndjson,.xml,.html,.htm,.css,.scss,.sass,.less,.js,.mjs,.cjs,.ts,.tsx,.jsx,.vue,.svelte,.py,.rb,.php,.java,.kt,.c,.cpp,.h,.cs,.go,.rs,.swift,.dart,.yaml,.yml,.toml,.ini,.sql,.graphql,.sh,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.log" style={{ display: "none" }} onChange={handleFileSelect} />

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
