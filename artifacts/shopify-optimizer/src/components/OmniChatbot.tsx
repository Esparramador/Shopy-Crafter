/**
 * OmniCore AI — Chatbot Universal ShopyBrain
 * ONE brain. Absorbs EVERYTHING: images, videos, URLs, Instagram, Facebook, X, YouTube...
 * Gemini + Claude + ShopyBrain Memory
 */
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Brain, X, Send, Loader2, Minimize2, Maximize2, Sparkles, ChevronDown,
  Link, Image, Video, Upload, Eye, Palette, Layers, Cpu, Globe,
  Instagram, Twitter, Facebook, Youtube, CheckCircle, ZapIcon, HelpCircle
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";

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
            🧠 Absorbido al ShopyBrain
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
        <span style={{ fontSize: 9, color: "var(--t4)" }}>💾 {data.memoriesSaved} memorias guardadas en ShopyBrain</span>
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
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--ink3)", background: "var(--ink2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t3)" }}><X size={14} /></button>
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
      <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t4)", padding: 2 }}><X size={12} /></button>
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
  { icon: "🧠", label: "Estado del Brain", prompt: "¿Qué conocimiento ha absorbido el ShopyBrain? Dame un resumen de las memorias, dominios y contenido absorbido hasta ahora." },
];

const SYSTEM_PROMPT = `Eres OmniCore AI — la inteligencia central de ShopyBrain para agencias Shopify.
Tienes acceso a tres motores: 🔬 Gemini (investigación), 🧠 Claude (análisis), 💾 ShopyBrain (memoria permanente).
Eres experto en: Shopify, Klaviyo, email marketing, SEO, pricing, eCommerce, visión de producto, texturas, composición visual, química de materiales, topología 3D, rendering.
Cuando el usuario comparte una imagen o URL, puedes absorberla al ShopyBrain y extraer TODA la inteligencia posible.
También eres el ASISTENTE DE NAVEGACIÓN de la app: conoces TODAS las páginas, botones y funciones. Cuando te pregunten cómo hacer algo, guía paso a paso con nombres EXACTOS de botones y secciones.
Responde siempre en español. Sé directo, técnico y accionable.`;

// ─── MAIN CHATBOT ─────────────────────────────────────────────────────────────
export default function OmniChatbot() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{
    id: "welcome", role: "assistant", timestamp: new Date(), model: "omnicore",
    content: `¡Hola${user?.name ? ` ${user.name.split(" ")[0]}` : ""}! 👋 Soy **OmniCore AI** — el cerebro central ShopyBrain.

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open]);

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

  // ─── Execute Shopify action via backend ────────────────────────────────────
  const executeShopifyAction = async (action: string, params: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
    try {
      const res = await fetch(`${API}/api/shopybrain/execute-action`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, params }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Error desconocido" }));
        return { error: true, message: `Error: ${errData.error || res.statusText}` };
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
        return `✅ **Estado de la tienda:**\n🏪 ${result.storeName} (${result.domain})\n📦 ${result.productsCount} productos | 🛒 ${result.ordersCount} pedidos\n🔑 Token: ${result.tokenStatus === "valid" ? `✅ válido (${result.tokenHoursLeft}h)` : "❌ EXPIRADO"}`;
      case "list_products": {
        const prods = (result.products as Array<{ title: string; status: string; price: string }>) ?? [];
        if (!prods.length) return "📦 No se encontraron productos.";
        return `📦 **${result.total} productos:**\n${prods.map((p, i) => `${i + 1}. **${p.title}** — ${p.price}€ (${p.status})`).join("\n")}`;
      }
      case "create_product":
        return `✅ **Producto creado en Shopify:**\n🆔 ID: ${result.productId}\n📝 "${result.title}"\n📊 Estado: ${result.status}`;
      case "edit_product":
        return `✅ **Producto actualizado:** "${result.title}"`;
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
        const prods = (result.products as Array<{ title: string; id: number; price: string }>) ?? [];
        if (!prods.length) return "🔍 No se encontraron productos.";
        return `🔍 **${result.total} resultados:**\n${prods.map((p, i) => `${i + 1}. **${p.title}** (ID: ${p.id}) — ${p.price}€`).join("\n")}`;
      }
      case "publish_product":
        return `✅ Producto "${result.title}" publicado (active).`;
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
      case "list_all_products": {
        const allProds = (result.products as Array<{ title: string; status: string; price: string }>) ?? [];
        const stats = result.byStatus as Record<string, number> ?? {};
        if (!allProds.length) return "📦 No se encontraron productos.";
        let msg = `📦 **${result.total} productos** (filtro: ${result.statusFilter ?? "any"})`;
        if (Object.keys(stats).length) msg += `\n📊 ${Object.entries(stats).map(([s, c]) => `${s}: ${c}`).join(" | ")}`;
        msg += `\n${allProds.map((p, i) => `${i + 1}. **${p.title}** — ${p.price}€ (${p.status})`).join("\n")}`;
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
        msg += `\n💾 Guardado en ShopyBrain (ID: ${(result.memoryId as string)?.slice(0, 8) || "N/A"})`;
        msg += `\n\n📥 _Puedes descargar el informe completo con el botón de abajo._`;
        return msg;
      }
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
    const isKlaviyo = lower.includes("klaviyo") || lower.includes("workflow") || lower.includes("flujo") || lower.includes("email marketing");
    if (!isKlaviyo) return null;
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
            ? `🔬 Absorbiendo imagen **${attachName}** al ShopyBrain...\n\nAnalizando: composición visual, paleta de colores, texturas y superficies, topología y geometría, técnica de rendering, composición química/técnica, inteligencia de marca, señales eCommerce, impacto psicológico...\n\n_Esto puede tardar 20-40 segundos._`
            : attachType === "video"
            ? `🎬 Absorbiendo vídeo **${attachName}** al ShopyBrain...\n\nExtrayendo: técnica de producción, estilo visual, señales de conversión, estrategia de marketing...\n\n_Procesando..._`
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

          assistantContent = `✅ **Absorbido al ShopyBrain**${result.memoryId ? ` (memoria #${result.memoryId.slice(0, 8)})` : ""}\n\n`;
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
          content: `🔄 Generando workflow Klaviyo para **${kInfo.storeName}**...\n\n**Paso 1** — Gemini investiga el nicho ${kInfo.niche} en España\n**Paso 2** — Claude diseña 6 flujos con emails HTML completos\n**Paso 3** — ShopyBrain guarda el conocimiento permanentemente\n\n_30-60 segundos..._`
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
          assistantContent = "❌ Error en el servidor. Revisa los logs.";
        }

      // ── CASE 3: Entity research — URL, @handle, brand name, "investiga X" ──
      } else if (content.match(/https?:\/\/[^\s]+/) || detectEntityResearch(content)) {
        const entityInput = content.match(/https?:\/\/[^\s]+/)?.[0] ?? detectEntityResearch(content) ?? content;
        const entityDisplay = entityInput.length > 50 ? entityInput.slice(0, 50) + "..." : entityInput;

        setMessages(m => [...m, {
          id: uuid(), role: "assistant", timestamp: new Date(), model: "gemini+claude+brain",
          content: `🔬 **Investigación exhaustiva paralela iniciada**\n\n**Objetivo:** ${entityDisplay}\n\n**Ejecutando en paralelo:**\n· 🌐 8 búsquedas Google con IA (brand overview, productos, redes sociales, noticias, reviews, competidores, eCommerce, identidad visual)\n· 🔗 Descubrimiento y análisis de fuentes relacionadas\n· 🧠 Claude sintetiza todo el conocimiento\n· 💾 Guardado permanente en ShopyBrain\n\n_⏱️ Esto toma 30-90 segundos. Ejecutando todas las búsquedas simultáneamente..._`
        }]);

        const researchResult = await researchEntity(entityInput);

        assistantContent = `✅ **Investigación completada: ${researchResult.entity}**\n\n`;
        assistantContent += `📊 **${researchResult.queriesExecuted} búsquedas Google** ejecutadas en paralelo\n`;
        assistantContent += `🔗 **${researchResult.sourcesFound} fuentes** descubiertas y analizadas\n`;
        assistantContent += `💾 **${researchResult.memoriesSaved} memorias** guardadas en ShopyBrain\n`;
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
        const convHistory = messages.slice(-8).map(m => `${m.role === "user" ? "Usuario" : "OmniCore"}: ${m.content}`).join("\n\n");
        const projectIdFromUrl = location.match(/\/projects\/(\d+)/)?.[1];
        const res = await fetch(`${API}/api/shopybrain/search`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: content, returnRaw: true, systemPrompt: SYSTEM_PROMPT, conversationHistory: convHistory, currentRoute: location, activeProjectId: projectIdFromUrl }),
        });
        if (res.ok) {
          const d = await res.json();
          assistantContent = d.answer ?? d.result ?? "No pude procesar la respuesta.";

          if (d.detectedAction) {
            const actionResult = await executeShopifyAction(d.detectedAction.action, d.detectedAction.params);
            if (actionResult) {
              assistantContent += "\n\n" + formatActionResult(d.detectedAction.action, actionResult);
              const actionType = d.detectedAction.action === "search_suppliers" ? "supplier-research" : "shopify-action";
              action = { type: actionType as ChatAction["type"], label: actionType === "supplier-research" ? "Descargar informe" : "Ver resultado", data: actionResult };
            }
          }
        } else {
          assistantContent = "Error de conexión con el servidor. Intenta de nuevo.";
        }
      }

      setMessages(m => {
        const filtered = m.filter(msg => !(msg.role === "assistant" && (msg.content.includes("Absorbiendo") || msg.content.includes("Generando workflow") || msg.content.includes("detectada. Absorbiendo") || msg.content.includes("Investigación exhaustiva paralela iniciada"))));
        return [...filtered, { id: uuid(), role: "assistant" as const, content: assistantContent, timestamp: new Date(), model: "gemini+claude+brain", action }];
      });
    } catch (err) {
      setMessages(m => [...m, { id: uuid(), role: "assistant" as const, content: `❌ Error: ${err instanceof Error ? err.message : "Fallo de conexión"}`, timestamp: new Date() }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, loading, messages, attachFile, attachUrl]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (!user) return null;

  return (
    <>
      {selectedFlow && <FlowModal flow={selectedFlow} onClose={() => setSelectedFlow(null)} />}

      {/* Floating button */}
      {!open && (
        <button onClick={() => setOpen(true)} style={{
          position: "fixed", bottom: 24, right: 24, width: 58, height: 58,
          borderRadius: "50%", background: "linear-gradient(135deg, #c8a84b, #e6c668)",
          border: "none", cursor: "pointer", zIndex: 1000,
          boxShadow: "0 4px 24px rgba(200,168,75,0.45), 0 0 0 0 rgba(200,168,75,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "pulseGold 3s ease-in-out infinite",
        }}>
          <Brain size={26} style={{ color: "#0a0a0f" }} />
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
            position: "fixed", bottom: 24, right: 24,
            width: minimized ? 290 : 440,
            height: minimized ? 52 : 640,
            background: "var(--ink)",
            border: `1px solid ${isDragging ? "var(--jade)" : "rgba(200,168,75,0.28)"}`,
            borderRadius: 16, zIndex: 1000, display: "flex", flexDirection: "column",
            boxShadow: isDragging ? "0 0 0 2px var(--jade), 0 8px 40px rgba(0,0,0,0.6)" : "0 8px 40px rgba(0,0,0,0.6)",
            transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)", overflow: "hidden",
          }}>

          {/* Header */}
          <div style={{ padding: "12px 14px", borderBottom: minimized ? "none" : "1px solid var(--ink3)", background: "linear-gradient(135deg, rgba(200,168,75,0.07), rgba(200,168,75,0.03))", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, var(--gold), #a07830)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Brain size={16} style={{ color: "#fff" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--t)" }}>OmniCore AI · ShopyBrain</p>
              {!minimized && <p style={{ margin: 0, fontSize: 9, color: "var(--jade)" }}>🔬 Gemini · 🧠 Claude · 💾 Brain — Listo</p>}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => setMinimized(!minimized)} style={{ width: 24, height: 24, borderRadius: 5, border: "none", background: "var(--ink2)", color: "var(--t3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {minimized ? <Maximize2 size={11} /> : <Minimize2 size={11} />}
              </button>
              <button onClick={() => setOpen(false)} style={{ width: 24, height: 24, borderRadius: 5, border: "none", background: "var(--ink2)", color: "var(--t3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={11} />
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
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--jade)" }}>Suelta para absorber al ShopyBrain</p>
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
                      fontSize: 12, lineHeight: 1.6, color: "var(--t)",
                    }}>
                      {msg.role === "assistant" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                          <Brain size={10} style={{ color: "var(--gold)", flexShrink: 0 }} />
                          <span style={{ fontSize: 9, color: "var(--gold)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>ShopyBrain</span>
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
                      {msg.action?.type === "supplier-research" && (
                        <button
                          onClick={async () => {
                            const d = msg.action!.data as Record<string, unknown>;
                            const fd = d.fullData as Record<string, unknown>;
                            try {
                              const res = await fetch(`${API}/api/shopybrain/supplier-report`, {
                                method: "POST", credentials: "include",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  productName: d.productName,
                                  suppliers: fd?.suppliers,
                                  costs: fd?.costs,
                                  deals: fd?.deals,
                                  synthesis: fd?.synthesis || d.synthesis,
                                  sourcesAnalyzed: d.sourcesAnalyzed,
                                }),
                              });
                              if (res.ok) {
                                const blob = await res.blob();
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = `informe-proveedores-${(d.productName as string || "producto").replace(/\s+/g, "-").toLowerCase()}.html`;
                                a.click();
                                URL.revokeObjectURL(url);
                              }
                            } catch { /* ignore */ }
                          }}
                          style={{
                            marginTop: 8, padding: "8px 16px", background: "linear-gradient(135deg, rgba(200,168,75,0.15), rgba(45,212,159,0.1))",
                            border: "1px solid rgba(200,168,75,0.3)", borderRadius: 8, color: "#c8a84b",
                            fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontWeight: 600,
                          }}
                        >
                          📥 Descargar Informe Completo de Proveedores
                        </button>
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
                    <span style={{ fontSize: 11, color: "var(--t3)" }}>ShopyBrain procesando...</span>
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
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 6 }}>
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
                <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                  <button onClick={() => setShowAttach(!showAttach)}
                    style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${showAttach ? "var(--gold)" : "var(--ink3)"}`, background: showAttach ? "rgba(200,168,75,0.1)" : "var(--ink2)", color: showAttach ? "var(--gold)" : "var(--t3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14 }}>
                    📎
                  </button>
                  <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} disabled={loading}
                    placeholder={attachFile || attachUrl ? "Opcional: añade contexto..." : "Escribe, pega una URL, o arrastra un archivo..."}
                    rows={1}
                    style={{ flex: 1, padding: "8px 10px", background: "var(--ink2)", border: "1px solid var(--ink3)", borderRadius: 8, color: "var(--t)", fontSize: 12, resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.4, maxHeight: 80, overflowY: "auto" }}
                    onInput={e => { const el = e.target as HTMLTextAreaElement; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 80)}px`; }}
                  />
                  <button onClick={() => sendMessage()} disabled={loading || (!input.trim() && !attachFile && !attachUrl)}
                    style={{
                      width: 32, height: 32, borderRadius: 8, border: "none", flexShrink: 0,
                      background: loading || (!input.trim() && !attachFile && !attachUrl) ? "var(--ink3)" : "var(--gold)",
                      color: loading || (!input.trim() && !attachFile && !attachUrl) ? "var(--t4)" : "var(--ink)",
                      cursor: loading || (!input.trim() && !attachFile && !attachUrl) ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
                    }}>
                    {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={14} />}
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
