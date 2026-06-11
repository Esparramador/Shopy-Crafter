import { useState, useCallback, useEffect, useRef } from "react";
import { useRoute } from "wouter";
import { scoreColor } from "@/lib/utils";
import { LiveOperation } from "@/components/LiveOperation";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type ReportTemplate = "classic" | "elegance" | "prestige";

export function WebLabStandalone() {
  return <WebLabInner projectId={0} />;
}


interface WebLabAnalysis {
  overallScore: number;
  categories: {
    design: number;
    ux: number;
    responsive: number;
    accessibility: number;
    performance: number;
    consistency: number;
  };
  colorPalette: { current: string[]; improved: string[] };
  typography: { current: string[]; improved: string[] };
  structure: Array<{ section: string; element: string; issues: number }>;
  issues: Array<{
    selector: string;
    property: string;
    current: string;
    improved: string;
    severity: string;
    reason: string;
  }>;
  improvedCss: string;
  improvedHtmlFragments: Array<{ section: string; original: string; improved: string }>;
  summary: string;
}

interface AnalysisResult {
  analysis: WebLabAnalysis;
  reportHtml?: string;
  vaultIds: { report: number | null; css: number | null; html: number | null };
  pageSpeed: any;
  scraperData: any;
  url: string;
  template: string;
}

interface HistoryItem {
  id: number;
  title: string;
  description: string;
  originalUrl: string;
  createdAt: string;
  metadata: any;
}

interface DeepScanResult {
  url: string;
  scannedAt: string;
  security: {
    score: number;
    headers: Array<{ name: string; present: boolean; value?: string; severity: string; description: string; recommendation: string }>;
    vulnerabilities: Array<{ type: string; severity: string; description: string; recommendation: string }>;
    https: boolean;
    mixedContent: boolean;
    serverInfo?: string;
  };
  dom: {
    totalElements: number;
    maxDepth: number;
    headings: { h1: number; h2: number; h3: number; h4: number; h5: number; h6: number };
    images: { total: number; withAlt: number; withoutAlt: number; lazy: number };
    forms: number;
    inputs: number;
    links: { total: number; external: number; nofollow: number; blankTarget: number };
    scripts: { inline: number; external: number; deferred: number; asyncLoaded: number };
    iframes: number;
    tables: number;
    accessibilityIssues: Array<{ type: string; count: number; severity: string; detail: string }>;
    domSize: string;
  };
  javascript: {
    libraries: Array<{ name: string; version?: string; category: string }>;
    hasGtm: boolean;
    hasAnalytics: boolean;
    hasPixel: boolean;
    hasCookieBanner: boolean;
    hasChat: boolean;
    hasLazyLoad: boolean;
    inlineScriptCount: number;
    externalScriptCount: number;
    renderBlockingScripts: number;
  };
  seo: {
    score: number;
    title: string;
    titleLength: number;
    titleStatus: string;
    metaDescription: string;
    metaDescriptionLength: number;
    metaDescriptionStatus: string;
    h1Count: number;
    h1Status: string;
    hasCanonical: boolean;
    canonicalUrl?: string;
    hasOpenGraph: boolean;
    ogTitle?: string;
    ogImage?: string;
    hasTwitterCard: boolean;
    hasStructuredData: boolean;
    structuredDataTypes: string[];
    hasHreflang: boolean;
    hasViewport: boolean;
    issues: Array<{ type: string; severity: string; detail: string }>;
  };
  performance: {
    resourceCounts: { scripts: number; stylesheets: number; images: number };
    renderBlockingCss: number;
    renderBlockingJs: number;
    lazyImages: number;
    inlineCriticalCss: boolean;
    issues: Array<{ type: string; severity: string; detail: string }>;
  };
}

interface Effects3DResult {
  brand: string;
  sector: string;
  primaryColor: string;
  effects: Array<{
    id: string;
    name: string;
    description: string;
    complexity: string;
    dependencies: string[];
    code: string;
    cssOnly: boolean;
    installInstructions: string;
  }>;
}

const phases = [
  { label: "Extrayendo HTML + CSS", icon: "🔬" },
  { label: "PageSpeed Insights", icon: "⚡" },
  { label: "Estructura y SEO", icon: "🔍" },
  { label: "Análisis IA profundo", icon: "🧠" },
];

const categoryLabels: Record<string, string> = {
  design: "Diseño",
  ux: "UX",
  responsive: "Responsive",
  accessibility: "Accesibilidad",
  performance: "Performance",
  consistency: "Consistencia",
};

const categoryIcons: Record<string, string> = {
  design: "🎨",
  ux: "🖱️",
  responsive: "📱",
  accessibility: "♿",
  performance: "⚡",
  consistency: "🎯",
};

const sevColors: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
};

export default function WebLab() {
  const [, params] = useRoute("/projects/:id/web-lab");
  const projectId = params?.id ? parseInt(params.id) : 0;
  return <WebLabInner projectId={projectId} />;
}

// ── Severity colors ──
const sevC: Record<string, string> = { critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#22c55e", info: "#60a5fa" };

function SevBadge({ s }: { s: string }) {
  return (
    <span style={{ padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: (sevC[s] || "#888") + "22", color: sevC[s] || "#888", textTransform: "uppercase", letterSpacing: "0.5px" }}>
      {s}
    </span>
  );
}

function SecurityPanel({ scan }: { scan: DeepScanResult }) {
  const s = scan.security;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", border: `4px solid ${s.score >= 70 ? "#22c55e" : s.score >= 40 ? "#eab308" : "#ef4444"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 28, fontWeight: 800, color: s.score >= 70 ? "#22c55e" : s.score >= 40 ? "#eab308" : "#ef4444" }}>{s.score}</span>
        </div>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>🔒 Análisis de Seguridad</h3>
          <p style={{ color: "#888", fontSize: 13, margin: "4px 0 0" }}>
            {s.https ? "✅ HTTPS activo" : "❌ Sin HTTPS"} &nbsp;·&nbsp;
            {s.mixedContent ? "⚠️ Contenido mixto detectado" : "✅ Sin contenido mixto"} &nbsp;·&nbsp;
            {s.serverInfo ? `⚠️ Server expuesto: ${s.serverInfo}` : "✅ Servidor no expuesto"}
          </p>
        </div>
      </div>

      {s.vulnerabilities.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: "#ef4444", marginBottom: 12 }}>🚨 Vulnerabilidades detectadas ({s.vulnerabilities.length})</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {s.vulnerabilities.map((v, i) => (
              <div key={i} style={{ padding: "12px 14px", background: "#0a0a14", borderRadius: 10, borderLeft: `3px solid ${sevC[v.severity] || "#888"}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <SevBadge s={v.severity} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#eee" }}>{v.type}</span>
                </div>
                <p style={{ color: "#aaa", fontSize: 12, margin: "0 0 4px" }}>{v.description}</p>
                <p style={{ color: "#22c55e", fontSize: 11, margin: 0 }}>💡 {v.recommendation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: "#aaa", marginBottom: 12 }}>🛡️ Headers de Seguridad HTTP</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 8 }}>
          {s.headers.map((h, i) => (
            <div key={i} style={{ padding: "10px 12px", background: "#0a0a14", borderRadius: 8, border: `1px solid ${h.present ? "#22c55e22" : (sevC[h.severity] || "#888") + "33"}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 14 }}>{h.present ? "✅" : "❌"}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: h.present ? "#22c55e" : sevC[h.severity] || "#888", fontFamily: "monospace" }}>{h.name}</span>
                {!h.present && <SevBadge s={h.severity} />}
              </div>
              {h.present && h.value && <p style={{ color: "#888", fontSize: 10, margin: "2px 0", fontFamily: "monospace", wordBreak: "break-all" }}>{h.value.slice(0, 80)}{h.value.length > 80 ? "…" : ""}</p>}
              {!h.present && <p style={{ color: "#666", fontSize: 11, margin: "2px 0" }}>{h.recommendation}</p>}
              <p style={{ color: "#555", fontSize: 10, margin: "2px 0" }}>{h.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DomPanel({ scan }: { scan: DeepScanResult }) {
  const d = scan.dom;
  const js = scan.javascript;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 24 }}>
        {[
          { label: "Total Elementos", value: d.totalElements, sub: d.domSize, warn: d.totalElements > 1500 },
          { label: "Profundidad DOM", value: d.maxDepth, sub: "niveles estimados", warn: d.maxDepth > 15 },
          { label: "Imágenes", value: d.images.total, sub: `${d.images.withoutAlt} sin alt`, warn: d.images.withoutAlt > 0 },
          { label: "Scripts externos", value: d.scripts.external, sub: `${d.scripts.deferred} diferidos`, warn: d.scripts.external > 10 },
          { label: "Formularios", value: d.forms, sub: `${d.inputs} inputs`, warn: false },
          { label: "iFrames", value: d.iframes, sub: "", warn: d.iframes > 2 },
          { label: "Links externos", value: d.links.external, sub: `${d.links.blankTarget} _blank`, warn: false },
          { label: "Tablas HTML", value: d.tables, sub: d.tables > 0 ? "layout por tabla" : "sin tablas", warn: d.tables > 2 },
        ].map((stat, i) => (
          <div key={i} style={{ padding: 14, background: "#0a0a14", borderRadius: 10, textAlign: "center", border: `1px solid ${stat.warn ? "#eab30833" : "#1a1a2e"}` }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: stat.warn ? "#eab308" : "#d4a843" }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{stat.label}</div>
            {stat.sub && <div style={{ fontSize: 10, color: stat.warn ? "#eab308" : "#666", marginTop: 1 }}>{stat.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#0a0a14", borderRadius: 10, padding: 14 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "#d4a843" }}>📑 Estructura de Encabezados</h4>
          {Object.entries(d.headings).map(([h, n]) => (
            <div key={h} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: "monospace", fontSize: 11, color: "#888", width: 24 }}>{'<' + h.toUpperCase() + '>'}</span>
              <div style={{ flex: 1, height: 8, background: "#111", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, n * 10)}%`, height: "100%", background: h === "h1" && n !== 1 ? "#ef4444" : "#d4a843", borderRadius: 4 }} />
              </div>
              <span style={{ fontSize: 12, color: n > 0 ? "#eee" : "#555", width: 20, textAlign: "right" }}>{n}</span>
            </div>
          ))}
        </div>
        <div style={{ background: "#0a0a14", borderRadius: 10, padding: 14 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "#d4a843" }}>📸 Imágenes</h4>
          <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
            <div style={{ flex: d.images.withAlt || 1, background: "#22c55e33", height: 16, borderRadius: 4 }} title={`Con alt: ${d.images.withAlt}`} />
            <div style={{ flex: d.images.withoutAlt || 0.001, background: "#ef444433", height: 16, borderRadius: 4 }} title={`Sin alt: ${d.images.withoutAlt}`} />
          </div>
          <p style={{ fontSize: 11, color: "#888", margin: 0 }}>✅ Con alt: {d.images.withAlt} &nbsp; ❌ Sin alt: {d.images.withoutAlt} &nbsp; 🔄 Lazy: {d.images.lazy}</p>
        </div>
      </div>

      {d.accessibilityIssues.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: "#f97316", marginBottom: 10 }}>♿ Problemas de Accesibilidad WCAG ({d.accessibilityIssues.length})</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {d.accessibilityIssues.map((issue, i) => (
              <div key={i} style={{ padding: "10px 14px", background: "#0a0a14", borderRadius: 8, display: "flex", alignItems: "flex-start", gap: 10 }}>
                <SevBadge s={issue.severity} />
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#eee" }}>{issue.type}</span>
                  {issue.count > 1 && <span style={{ fontSize: 11, color: "#888", marginLeft: 6 }}>({issue.count} ocurrencias)</span>}
                  <p style={{ color: "#aaa", fontSize: 11, margin: "2px 0 0" }}>{issue.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: "#d4a843", marginBottom: 10 }}>🔧 Librerías JavaScript Detectadas ({js.libraries.length})</h4>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {[
            { label: "GTM", active: js.hasGtm, color: "#4ade80" },
            { label: "Analytics", active: js.hasAnalytics, color: "#4ade80" },
            { label: "Facebook Pixel", active: js.hasPixel, color: "#60a5fa" },
            { label: "Cookie Banner", active: js.hasCookieBanner, color: "#a78bfa" },
            { label: "Chat/Soporte", active: js.hasChat, color: "#60a5fa" },
            { label: "Lazy Load nativo", active: js.hasLazyLoad, color: "#4ade80" },
          ].map((tag, i) => (
            <span key={i} style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, background: tag.active ? tag.color + "22" : "#1a1a1a", color: tag.active ? tag.color : "#444", border: `1px solid ${tag.active ? tag.color + "44" : "#222"}` }}>
              {tag.active ? "✅" : "○"} {tag.label}
            </span>
          ))}
        </div>
        {js.libraries.length > 0 ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {js.libraries.map((lib, i) => (
              <span key={i} style={{ padding: "4px 10px", borderRadius: 20, background: "#1a1a2e", border: "1px solid #333", fontSize: 11, color: "#ccc" }}>
                <span style={{ color: "#888", marginRight: 4 }}>{lib.category}</span>
                <strong>{lib.name}</strong>
                {lib.version && <span style={{ color: "#d4a843", marginLeft: 4 }}>v{lib.version}</span>}
              </span>
            ))}
          </div>
        ) : (
          <p style={{ color: "#555", fontSize: 12 }}>No se detectaron librerías conocidas (puede que estén minificadas o bajo CDN desconocido)</p>
        )}
      </div>
    </div>
  );
}

function PerformancePanel({ scan }: { scan: DeepScanResult }) {
  const p = scan.performance;
  const s = scan.seo;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 24 }}>
        {[
          { label: "Scripts externos", value: p.resourceCounts.scripts, warn: p.resourceCounts.scripts > 10 },
          { label: "Hojas CSS", value: p.resourceCounts.stylesheets, warn: p.resourceCounts.stylesheets > 6 },
          { label: "Imágenes totales", value: p.resourceCounts.images, warn: false },
          { label: "Scripts bloqueantes", value: p.renderBlockingJs, warn: p.renderBlockingJs > 2 },
          { label: "CSS bloqueante", value: p.renderBlockingCss, warn: p.renderBlockingCss > 0 },
          { label: "Imgs lazy", value: p.lazyImages, warn: false },
        ].map((stat, i) => (
          <div key={i} style={{ padding: 14, background: "#0a0a14", borderRadius: 10, textAlign: "center", border: `1px solid ${stat.warn ? "#ef444433" : "#1a1a2e"}` }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: stat.warn ? "#ef4444" : "#d4a843" }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {p.issues.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: "#f97316", marginBottom: 10 }}>⚠️ Problemas de Performance ({p.issues.length})</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {p.issues.map((issue, i) => (
              <div key={i} style={{ padding: "10px 14px", background: "#0a0a14", borderRadius: 8, display: "flex", gap: 10 }}>
                <SevBadge s={issue.severity} />
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#eee" }}>{issue.type}</span>
                  <p style={{ color: "#aaa", fontSize: 11, margin: "2px 0 0" }}>{issue.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: "#d4a843", marginBottom: 10 }}>🔍 Auditoría SEO Técnico — Score: {s.score}/100</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8, marginBottom: 12 }}>
          {[
            { label: "Título", status: s.titleStatus, detail: s.title ? `"${s.title.slice(0, 40)}${s.title.length > 40 ? "…" : ""}" (${s.titleLength} chars)` : "Sin título" },
            { label: "Meta Description", status: s.metaDescriptionStatus, detail: s.metaDescription ? `${s.metaDescriptionLength} chars` : "Sin description" },
            { label: "H1", status: s.h1Status, detail: `${s.h1Count} etiqueta(s) H1` },
            { label: "Canonical", status: s.hasCanonical ? "good" : "missing", detail: s.canonicalUrl || "No definido" },
            { label: "Open Graph", status: s.hasOpenGraph ? "good" : "missing", detail: s.ogTitle || (s.hasOpenGraph ? "Presente" : "Ausente") },
            { label: "Twitter Card", status: s.hasTwitterCard ? "good" : "missing", detail: s.hasTwitterCard ? "Presente" : "Ausente" },
            { label: "Datos Estructurados", status: s.hasStructuredData ? "good" : "missing", detail: s.structuredDataTypes.length ? s.structuredDataTypes.join(", ") : "Ausente" },
            { label: "Hreflang", status: s.hasHreflang ? "good" : "info", detail: s.hasHreflang ? "Presente" : "No definido" },
            { label: "Viewport", status: s.hasViewport ? "good" : "critical", detail: s.hasViewport ? "Presente" : "¡Ausente! Sitio no responsive" },
          ].map((item, i) => (
            <div key={i} style={{ padding: "10px 12px", background: "#0a0a14", borderRadius: 8, border: `1px solid ${item.status === "good" ? "#22c55e22" : item.status === "missing" || item.status === "critical" ? "#ef444422" : "#1a1a2e"}` }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 2 }}>
                <span style={{ fontSize: 12 }}>{item.status === "good" ? "✅" : item.status === "info" ? "ℹ️" : "❌"}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#eee" }}>{item.label}</span>
              </div>
              <p style={{ color: "#888", fontSize: 10, margin: 0, wordBreak: "break-word" }}>{item.detail}</p>
            </div>
          ))}
        </div>
        {s.issues.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {s.issues.map((issue, i) => (
              <div key={i} style={{ padding: "8px 12px", background: "#0a0a14", borderRadius: 8, display: "flex", gap: 8, alignItems: "flex-start" }}>
                <SevBadge s={issue.severity} />
                <span style={{ fontSize: 12, color: "#aaa" }}><strong style={{ color: "#eee" }}>{issue.type}</strong> — {issue.detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const EFFECT_ICONS: Record<string, string> = {
  gsap_scroll_trigger: "🎬",
  css_3d_perspective: "🎭",
  three_js_background: "🌌",
  exploded_view: "💥",
  parallax_immersive: "🌊",
};
const COMPLEXITY_COLORS: Record<string, string> = { beginner: "#22c55e", intermediate: "#eab308", advanced: "#f97316" };

function Effects3DPanel({ data, activeTab, setActiveTab, copied, setCopied }: {
  data: Effects3DResult;
  activeTab: number;
  setActiveTab: (n: number) => void;
  copied: string;
  setCopied: (s: string) => void;
}) {
  const effect = data.effects[activeTab];

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(""), 2500);
    } catch {}
  };

  const download = (code: string, name: string) => {
    const blob = new Blob([code], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name.toLowerCase().replace(/\s+/g, "-")}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>✨ Efectos 3D e Inmersivos — <span style={{ color: "#a78bfa" }}>{data.brand}</span></h3>
          <p style={{ color: "#888", fontSize: 12, margin: "4px 0 0" }}>Sector: {data.sector} · {data.effects.length} efectos listos para producción</p>
        </div>
        {data.primaryColor && <div style={{ width: 36, height: 36, borderRadius: 8, background: data.primaryColor, border: "2px solid #333", flexShrink: 0 }} title={data.primaryColor} />}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {data.effects.map((e, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            style={{
              padding: "8px 14px",
              background: activeTab === i ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : "#0a0a14",
              border: activeTab === i ? "none" : "1px solid #333",
              borderRadius: 8, color: activeTab === i ? "#fff" : "#a78bfa",
              fontWeight: activeTab === i ? 700 : 400, cursor: "pointer", fontSize: 12,
            }}
          >
            {EFFECT_ICONS[e.id] || "✨"} {e.name}
          </button>
        ))}
      </div>

      {effect && (
        <div>
          <div style={{ padding: "12px 16px", background: "#0a0a14", borderRadius: 10, marginBottom: 12, border: "1px solid #7c3aed33" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
              <span style={{ fontSize: 22 }}>{EFFECT_ICONS[effect.id] || "✨"}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#e2d9f3" }}>{effect.name}</span>
              <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: (COMPLEXITY_COLORS[effect.complexity] || "#888") + "22", color: COMPLEXITY_COLORS[effect.complexity] || "#888" }}>
                {effect.complexity.toUpperCase()}
              </span>
              <span style={{ fontSize: 11, color: "#666" }}>Deps: {effect.dependencies.join(", ")}</span>
            </div>
            <p style={{ color: "#aaa", fontSize: 13, margin: 0 }}>{effect.description}</p>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#e2d9f3" }}>📋 Código listo para copiar</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => copy(effect.code, effect.id)}
                  style={{ padding: "6px 12px", background: copied === effect.id ? "#22c55e22" : "#1a1a2e", border: `1px solid ${copied === effect.id ? "#22c55e" : "#444"}`, borderRadius: 6, color: copied === effect.id ? "#22c55e" : "#ccc", cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                >
                  {copied === effect.id ? "✅ Copiado" : "📋 Copiar código"}
                </button>
                <button
                  onClick={() => download(effect.code, effect.name)}
                  style={{ padding: "6px 12px", background: "#1a1a2e", border: "1px solid #444", borderRadius: 6, color: "#ccc", cursor: "pointer", fontSize: 11 }}
                >
                  💾 .html
                </button>
              </div>
            </div>
            <pre style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 10, padding: 16, overflow: "auto", maxHeight: 500, fontSize: 12, lineHeight: 1.5, color: "#c9d1d9", fontFamily: "'Fira Code', monospace" }}>
              <code>{effect.code}</code>
            </pre>
          </div>

          <div style={{ padding: "10px 14px", background: "#0a1a0a", borderRadius: 8, border: "1px solid #22c55e22" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#22c55e" }}>📌 Cómo integrarlo: </span>
            <span style={{ fontSize: 12, color: "#aaa" }}>{effect.installInstructions}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function WebLabInner({ projectId }: { projectId: number }) {
  const [url, setUrl] = useState("");
  const [instagram, setInstagram] = useState("");
  const [brandName, setBrandName] = useState("");
  const [template, setTemplate] = useState<ReportTemplate>("prestige");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  // FIX UX: arrancamos en "css" en vez de "summary" para que el usuario vea
  // INMEDIATAMENTE el .css real generado (era la queja principal: "solo veo
  // las instrucciones, no el CSS"). Cuando llega un análisis nuevo `analyze()`
  // pasa explícitamente a "preview" para mostrar el iframe con el rediseño,
  // pero el primer renderizado al cargar la página o un histórico ya muestra
  // el código CSS real (con botones de copiar / descargar visibles).
  const [tab, setTab] = useState<"summary" | "css" | "html" | "preview" | "edit" | "security" | "dom" | "performance" | "effects3d">("css");
  const [copied, setCopied] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [previewMode, setPreviewMode] = useState<"original" | "improved">("improved");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [changeRequest, setChangeRequest] = useState("");
  const [iterating, setIterating] = useState(false);
  const [iterError, setIterError] = useState("");
  // Editor manual: HTML/CSS editables sincronizados con el resultado vigente.
  const [editHtml, setEditHtml] = useState("");
  const [editCss, setEditCss] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [savedEditMsg, setSavedEditMsg] = useState("");

  // Deep Scan state
  const [deepScan, setDeepScan] = useState<DeepScanResult | null>(null);
  const [deepScanLoading, setDeepScanLoading] = useState(false);
  const [deepScanError, setDeepScanError] = useState("");
  // 3D Effects state
  const [effects3d, setEffects3d] = useState<Effects3DResult | null>(null);
  const [effects3dLoading, setEffects3dLoading] = useState(false);
  const [effects3dError, setEffects3dError] = useState("");
  const [effects3dTab, setEffects3dTab] = useState(0);
  const [effects3dCopied, setEffects3dCopied] = useState("");

  // "Generar desde cero": inventamos una página entera con ADN de marca, sin URL
  // de partida. El backend usa fetchBrandProfile + Claude para componer HTML+CSS.
  const [showScratch, setShowScratch] = useState(false);
  const [scratchPageType, setScratchPageType] = useState<"landing" | "about" | "product" | "contact" | "blog" | "pricing">("landing");
  const [scratchBrief, setScratchBrief] = useState("");
  const [scratchSections, setScratchSections] = useState("hero, features, social-proof, pricing, cta, footer");
  const [scratchLoading, setScratchLoading] = useState(false);
  const [scratchMsg, setScratchMsg] = useState("");

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/web-lab/history/${projectId}`, { credentials: "include" });
      const data = await res.json();
      setHistory(data.items || []);
    } catch {}
  }, [projectId]);

  // Cuando llega un análisis nuevo o se itera, precargamos el editor con la
  // versión vigente. Distinguimos dos escenarios:
  //   1) Cambia la URL analizada → análisis NUEVO → pisamos el editor (lo que
  //      el usuario hubiese tecleado para la URL anterior queda obsoleto).
  //   2) Misma URL pero el análisis se actualizó (iteración) → respetamos lo
  //      que el usuario está editando y sólo precargamos si el editor está vacío.
  const lastSeededUrlRef = useRef<string>("");
  useEffect(() => {
    const a = result?.analysis;
    if (!a) return;
    const currentUrl = result?.url || "";
    const fragments = (a.improvedHtmlFragments || []).map(f => `<!-- ${f.section} -->\n${f.improved}`).join("\n\n");
    const css = a.improvedCss || "";
    const isNewUrl = currentUrl !== lastSeededUrlRef.current;
    if (isNewUrl) {
      // Análisis de otra URL → pisamos siempre.
      setEditHtml(fragments);
      setEditCss(css);
      lastSeededUrlRef.current = currentUrl;
    } else {
      // Misma URL → solo rellenamos huecos.
      setEditHtml(prev => prev?.trim() ? prev : fragments);
      setEditCss(prev => prev?.trim() ? prev : css);
    }
  }, [result?.url, result?.analysis?.improvedCss, result?.analysis?.improvedHtmlFragments]);

  const saveEdit = useCallback(async () => {
    if (projectId === undefined || projectId === null) { setSavedEditMsg("⚠ No hay proyecto seleccionado"); return; }
    if (!editHtml.trim() && !editCss.trim()) { setSavedEditMsg("⚠ Nada que guardar"); return; }
    setSavingEdit(true); setSavedEditMsg("");
    try {
      const r = await fetch(`${API_BASE}/api/web-lab/save-edit`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          url: url || result?.url,
          html: editHtml,
          css: editCss,
          label: editLabel || undefined,
          parentVaultId: result?.vaultIds?.html || result?.vaultIds?.css || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok || data.error) throw new Error(data.error || `HTTP ${r.status}`);
      setSavedEditMsg(`✓ Guardado en bóveda${data.htmlId ? ` (HTML #${data.htmlId})` : ""}${data.cssId ? ` (CSS #${data.cssId})` : ""}`);
      loadHistory();
    } catch (e: any) {
      setSavedEditMsg(`⚠ Error: ${e.message}`);
    } finally {
      setSavingEdit(false);
    }
  }, [projectId, url, result, editHtml, editCss, editLabel, loadHistory]);

  const generateFromScratch = useCallback(async () => {
    if (projectId === undefined || projectId === null) { setScratchMsg("⚠ Selecciona un proyecto"); return; }
    setScratchLoading(true); setScratchMsg("");
    try {
      const r = await fetch(`${API_BASE}/api/web-lab/generate-from-scratch`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          pageType: scratchPageType,
          brief: scratchBrief || undefined,
          sections: scratchSections.split(",").map(s => s.trim()).filter(Boolean),
          language: "es",
        }),
      });
      const data = await r.json();
      if (!r.ok || data.error) throw new Error(data.error || `HTTP ${r.status}`);
      setEditHtml(data.html || "");
      setEditCss(data.css || "");
      setEditLabel(`from-scratch · ${scratchPageType}`);
      setTab("edit");
      setScratchMsg(`✓ Generado y guardado en bóveda (HTML #${data.vaultIds?.htmlId} · CSS #${data.vaultIds?.cssId}). Cargado en el editor para refinar.`);
      loadHistory();
    } catch (e: any) {
      setScratchMsg(`⚠ Error: ${e.message}`);
    } finally {
      setScratchLoading(false);
    }
  }, [projectId, scratchPageType, scratchBrief, scratchSections, loadHistory]);

  const analyze = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setPhase(0);

    const phaseInterval = setInterval(() => {
      setPhase((p) => (p < 3 ? p + 1 : p));
    }, 8000);

    try {
      const res = await fetch(`${API_BASE}/api/web-lab/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: url.trim(), projectId, template, instagram: instagram.replace("@", "").trim() || undefined, brandName: brandName.trim() || undefined }),
      });

      clearInterval(phaseInterval);

      const rawText = await res.text();
      let data;
      try { data = JSON.parse(rawText.trim()); } catch { throw new Error(`Error ${res.status}: respuesta inválida`); }

      if (!res.ok || data.error) {
        throw new Error(data.error || `Error ${res.status}`);
      }

      if (!data.success) {
        throw new Error(data.error || "El análisis no devolvió resultados válidos");
      }

      setResult(data);
      // BUG FIX: tras generar, abrir directamente el tab "preview" para que
      // el usuario vea el iframe + textarea de iteración SIN tener que pulsar
      // ningún tab manualmente. Antes saltaba a "summary" y muchos usuarios
      // no encontraban el preview ni el flujo de cambios.
      setTab("preview");
      setPhase(4);
      loadHistory();
    } catch (err: any) {
      clearInterval(phaseInterval);
      setError(err.message || "Error en el análisis");
    } finally {
      setLoading(false);
    }
  };

  const runDeepScan = async () => {
    if (!url.trim()) return;
    setDeepScanLoading(true);
    setDeepScanError("");
    try {
      const res = await fetch(`${API_BASE}/api/web-lab/deep-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: url.trim(), projectId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`);
      setDeepScan(data.result);
      setTab("security" as any);
    } catch (e: any) {
      setDeepScanError(e.message || "Error en el escaneo profundo");
    } finally {
      setDeepScanLoading(false);
    }
  };

  const generate3dEffects = async () => {
    if (!url.trim() && !a?.improvedCss) return;
    setEffects3dLoading(true);
    setEffects3dError("");
    try {
      const res = await fetch(`${API_BASE}/api/web-lab/generate-3d-effects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          url: url.trim() || undefined,
          projectId,
          css: a?.improvedCss || undefined,
          brandInfo: brandName.trim() || undefined,
        }),
      });
      const rawText = await res.text();
      let data: any;
      try { data = JSON.parse(rawText.trim()); } catch { throw new Error(`Error ${res.status}: respuesta inválida`); }
      if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`);
      setEffects3d(data);
      setEffects3dTab(0);
      setTab("effects3d" as any);
    } catch (e: any) {
      setEffects3dError(e.message || "Error generando efectos 3D");
    } finally {
      setEffects3dLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(""), 2000);
    } catch {}
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadFromVault = (path: string) => {
    window.open(`${API_BASE}/api/${path}`, "_blank");
  };

  /**
   * Build a self-contained HTML document for the iframe preview.
   * - Adds <meta charset> + viewport so it renders correctly at any size.
   * - Adds <base target="_blank"> so external links open in a new tab
   *   (so the user doesn't navigate away from the preview).
   * - Injects a normalize/reset so the preview LOOKS like a real site,
   *   not unstyled HTML.
   * - Injects a tiny script that intercepts in-page anchor clicks
   *   ("#section") and smooth-scrolls inside the iframe — making the
   *   preview behave like a real navigable web page.
   *
   * SECURITY: el iframe se monta SIN `allow-same-origin` (ver más abajo),
   * por lo que cualquier script presente en el HTML/CSS generado por
   * Claude o extraído del sitio externo se ejecuta en un origen opaco
   * y NO puede leer cookies/localStorage/fetch /api/* de Shopy Crafter.
   * Aun así, añadimos un meta CSP conservador para limitar destinos de
   * red dentro del propio iframe.
   */
  const buildPreviewSrcDoc = (mode: "original" | "improved"): string => {
    if (!a) return "";
    const fragments = a.improvedHtmlFragments || [];
    const body = mode === "improved"
      ? fragments.map(f => f.improved).join("\n")
      : fragments.map(f => f.original).join("\n");
    const css = mode === "improved" ? (a.improvedCss || "") : "";

    const normalize = `
      *, *::before, *::after { box-sizing: border-box; }
      html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.5; color: #1a1a1a; background: #fff; }
      img, video { max-width: 100%; height: auto; display: block; }
      a { color: inherit; }
      h1, h2, h3, h4, h5, h6 { margin: 0.5em 0; line-height: 1.2; }
      p { margin: 0.5em 0; }
      button, input, select, textarea { font: inherit; }
    `;

    const navScript = `
      (function() {
        document.addEventListener('click', function(e) {
          var a = e.target.closest && e.target.closest('a');
          if (!a) return;
          var href = a.getAttribute('href') || '';
          // Internal anchor: smooth-scroll inside the preview iframe.
          if (href.startsWith('#') && href.length > 1) {
            e.preventDefault();
            var target = document.getElementById(href.slice(1)) ||
                         document.querySelector('[name="' + href.slice(1) + '"]');
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
          }
          // Empty href or just '#': prevent navigation.
          if (href === '' || href === '#') { e.preventDefault(); return; }
          // Anything else (full URLs) opens in a new tab via <base target="_blank">.
        }, true);
      })();
    `;

    // CSP defensivo dentro del iframe — bloquea cualquier intento del HTML
    // generado por Claude/sitio externo de hacer fetch a /api/* o exfiltrar
    // datos. Sólo permitimos imágenes y fuentes (data:, https:) y CSS inline.
    // 'unsafe-inline' es necesario porque inyectamos <style> y nuestro
    // navScript de scroll interno.
    const csp = "default-src 'none'; img-src data: https: http:; font-src data: https:; style-src 'unsafe-inline' https:; script-src 'unsafe-inline'; connect-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none';";

    return `<!DOCTYPE html><html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<base target="_blank">
<title>Preview</title>
<style>${normalize}</style>
${css ? `<style>${css}</style>` : ""}
</head><body>
${body || '<div style="padding:40px;text-align:center;color:#888;font-family:sans-serif">No hay contenido para mostrar.</div>'}
<script>${navScript}<\/script>
</body></html>`;
  };

  const openPreviewFullscreen = () => {
    if (!a) return;
    const html = buildPreviewSrcDoc(previewMode);
    // SECURITY: usamos data: URL en vez de blob: porque blob: es same-origin
    // con la app Shopy Crafter, y eso permitiría a scripts del HTML generado
    // por Claude leer cookies/localStorage/hacer fetch a /api/*. data: URL
    // crea un origen opaco aislado.
    const dataUrl = "data:text/html;charset=utf-8;base64," + btoa(unescape(encodeURIComponent(html)));
    window.open(dataUrl, "_blank", "noopener,noreferrer");
  };

  const iterate = async () => {
    if (!a || !result || !changeRequest.trim()) return;
    setIterating(true);
    setIterError("");
    try {
      const res = await fetch(`${API_BASE}/api/web-lab/iterate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          url: result.url,
          previousCss: a.improvedCss,
          previousFragments: a.improvedHtmlFragments,
          changeRequest: changeRequest.trim(),
          // Nombre canónico del session plan (backend acepta también `brandName` legacy)
          brandContext: brandName.trim() || undefined,
        }),
      });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text.trim()); } catch { throw new Error(`Error ${res.status}: respuesta inválida`); }
      // 402 = sin créditos: mensaje específico con el plan actual y CTA a /admin/billing
      if (res.status === 402) {
        const plan = data.planLabel ? ` (plan: ${data.planLabel})` : "";
        const remaining = data.remaining
          ? ` Te quedan ${data.remaining.products ?? 0} productos / ${data.remaining.images ?? 0} imágenes este mes.`
          : "";
        throw new Error(
          `${data.error || "Sin créditos suficientes para iterar el diseño."}${plan}.${remaining} Recarga créditos desde Facturación para seguir iterando.`
        );
      }
      if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`);
      setResult(prev => prev ? {
        ...prev,
        analysis: {
          ...prev.analysis,
          improvedCss: data.improvedCss || prev.analysis.improvedCss,
          improvedHtmlFragments: data.improvedHtmlFragments || prev.analysis.improvedHtmlFragments,
          summary: data.summary || prev.analysis.summary,
        },
      } : prev);
      setChangeRequest("");
    } catch (e: any) {
      setIterError(e?.message || "Error aplicando los cambios");
    } finally {
      setIterating(false);
    }
  };

  const a = result?.analysis;

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--gold, #d4a843)", marginBottom: 4, display: "flex", alignItems: "center", gap: 10 }}>
          🔬 Lab Web
        </h1>
        <p style={{ color: "var(--t2, #aaa)", fontSize: 14 }}>
          Analiza cualquier página web — Shopify, WooCommerce, WordPress, custom o cualquier CMS.
          Extrae el código real y genera CSS/HTML mejorado listo para tu equipo de desarrollo.
        </p>
      </div>

      <div style={{ background: "var(--card, #111)", borderRadius: 16, padding: 24, marginBottom: 24, border: "1px solid var(--border, #222)" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "min(300px, 100%)" }}>
            <label style={{ fontSize: 12, color: "var(--t2, #888)", display: "block", marginBottom: 6 }}>URL a analizar</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://ejemplo.com"
              disabled={loading}
              onKeyDown={(e) => e.key === "Enter" && !loading && analyze()}
              style={{
                width: "100%",
                padding: "12px 16px",
                background: "var(--ink, #0a0a0a)",
                border: "1px solid var(--border, #333)",
                borderRadius: 10,
                color: "var(--t1, #eee)",
                fontSize: 15,
                outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <input
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="Instagram de la marca (ej: @zara) — opcional"
                disabled={loading}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  background: "var(--ink, #0a0a0a)",
                  border: "1px solid var(--border, #333)",
                  borderRadius: 8,
                  color: "var(--t1, #eee)",
                  fontSize: 13,
                  outline: "none",
                }}
              />
              <input
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Nombre de la marca (ej: Zara) — opcional"
                disabled={loading}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  background: "var(--ink, #0a0a0a)",
                  border: "1px solid var(--border, #333)",
                  borderRadius: 8,
                  color: "var(--t1, #eee)",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>
            <p style={{ fontSize: 12, color: "var(--t3, #666)", marginTop: 4 }}>
              Si proporcionas el Instagram o nombre, ShopyBrain investigará la identidad visual de la marca para generar un CSS 100% alineado con su estética.
            </p>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--t2, #888)", display: "block", marginBottom: 6 }}>Plantilla informe</label>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value as ReportTemplate)}
              disabled={loading}
              style={{
                padding: "12px 16px",
                background: "var(--ink, #0a0a0a)",
                border: "1px solid var(--border, #333)",
                borderRadius: 10,
                color: "var(--t1, #eee)",
                fontSize: 14,
              }}
            >
              <option value="prestige">🥇 Prestige</option>
              <option value="elegance">🥈 Elegance</option>
              <option value="classic">🥉 Classic</option>
            </select>
          </div>
          <button
            onClick={analyze}
            disabled={loading || !url.trim()}
            style={{
              padding: "12px 28px",
              background: loading ? "#333" : "linear-gradient(135deg, #d4a843, #b8860b)",
              border: "none",
              borderRadius: 10,
              color: "#000",
              fontWeight: 700,
              fontSize: 15,
              cursor: loading ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {loading ? "Analizando..." : "🔬 Analizar"}
          </button>
          <button
            onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadHistory(); }}
            style={{
              padding: "12px 16px",
              background: "transparent",
              border: "1px solid var(--border, #333)",
              borderRadius: 10,
              color: "var(--t2, #aaa)",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            📜 Historial
          </button>
          <button
            onClick={runDeepScan}
            disabled={deepScanLoading || !url.trim()}
            title="Escaneo profundo: seguridad, DOM, librerías JS, SEO técnico — sin IA, muy rápido"
            style={{
              padding: "12px 18px",
              background: deepScanLoading ? "#333" : deepScan ? "linear-gradient(135deg, #22c55e22, #16a34a22)" : "transparent",
              border: deepScan ? "1px solid #22c55e55" : "1px solid var(--border, #333)",
              borderRadius: 10,
              color: deepScanLoading ? "#555" : deepScan ? "#22c55e" : "var(--t2, #aaa)",
              cursor: deepScanLoading || !url.trim() ? "not-allowed" : "pointer",
              fontSize: 13,
              whiteSpace: "nowrap",
            }}
          >
            {deepScanLoading ? "Escaneando…" : deepScan ? "✅ Re-escanear" : "🔍 Escaneo Profundo"}
          </button>
          <button
            onClick={generate3dEffects}
            disabled={effects3dLoading || (!url.trim() && !a?.improvedCss)}
            title="Genera código listo: GSAP ScrollTrigger, CSS 3D, Three.js, Vista Explosionada, Parallax Inmersivo"
            style={{
              padding: "12px 18px",
              background: effects3dLoading ? "#333" : effects3d ? "linear-gradient(135deg, #7c3aed22, #6d28d922)" : "transparent",
              border: effects3d ? "1px solid #7c3aed55" : "1px solid var(--border, #333)",
              borderRadius: 10,
              color: effects3dLoading ? "#555" : effects3d ? "#a78bfa" : "var(--t2, #aaa)",
              cursor: effects3dLoading || (!url.trim() && !a?.improvedCss) ? "not-allowed" : "pointer",
              fontSize: 13,
              whiteSpace: "nowrap",
            }}
          >
            {effects3dLoading ? "Generando…" : effects3d ? "✨ Re-generar 3D" : "✨ Efectos 3D"}
          </button>
          <button
            onClick={() => setShowScratch(s => !s)}
            style={{
              padding: "12px 16px",
              background: showScratch ? "linear-gradient(135deg, #d4a843, #b8860b)" : "transparent",
              border: "1px solid var(--border, #333)",
              borderRadius: 10,
              color: showScratch ? "#000" : "var(--t2, #aaa)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: showScratch ? 700 : 400,
            }}
          >
            ✨ Crear desde cero
          </button>
        </div>
      </div>

      {showScratch && (
        <div style={{ background: "var(--card, #111)", borderRadius: 16, padding: 20, marginBottom: 24, border: "1px solid var(--border, #222)" }}>
          <div style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>✨ Generar página profesional desde cero</h3>
            <p style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
              Sin URL de partida. Usamos el ADN de marca registrado del proyecto (paleta, tipografías, voz) y un brief opcional para componer una página completa con HTML+CSS guardada automáticamente en la bóveda.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 12, marginBottom: 12 }}>
            <select
              value={scratchPageType}
              onChange={(e) => setScratchPageType(e.target.value as typeof scratchPageType)}
              style={{ padding: "10px 12px", background: "#0a0a0a", border: "1px solid #2a2a30", borderRadius: 10, color: "#eee", fontSize: 13 }}
            >
              <option value="landing">Landing</option>
              <option value="about">About / Sobre nosotros</option>
              <option value="product">Product page</option>
              <option value="contact">Contact</option>
              <option value="blog">Blog index</option>
              <option value="pricing">Pricing</option>
            </select>
            <input
              type="text"
              placeholder="Secciones separadas por coma (hero, features, testimonios, pricing, faq, cta, footer…)"
              value={scratchSections}
              onChange={(e) => setScratchSections(e.target.value)}
              style={{ padding: "10px 12px", background: "#0a0a0a", border: "1px solid #2a2a30", borderRadius: 10, color: "#eee", fontSize: 13 }}
            />
          </div>
          <textarea
            value={scratchBrief}
            onChange={(e) => setScratchBrief(e.target.value)}
            placeholder="Brief opcional: tono, audiencia, mensaje principal, llamada a la acción, referencias…"
            style={{
              width: "100%", minHeight: 100, padding: 12,
              background: "#0a0a0a", border: "1px solid #2a2a30", borderRadius: 10,
              color: "#eee", fontSize: 13, resize: "vertical",
              boxSizing: "border-box", outline: "none", marginBottom: 12,
              fontFamily: "inherit",
            }}
          />
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={generateFromScratch}
              disabled={scratchLoading}
              style={{
                padding: "10px 22px",
                background: scratchLoading ? "#2a2a30" : "linear-gradient(135deg, #d4a843, #b8860b)",
                border: "none", borderRadius: 10, color: scratchLoading ? "#666" : "#000",
                fontWeight: 700, cursor: scratchLoading ? "not-allowed" : "pointer", fontSize: 13,
              }}
            >{scratchLoading ? "Componiendo…" : "🎨 Generar y guardar"}</button>
            {scratchMsg && (
              <span style={{ fontSize: 12, color: scratchMsg.startsWith("✓") ? "#22c55e" : "#ef4444" }}>{scratchMsg}</span>
            )}
          </div>
        </div>
      )}

      {loading && (
        <div style={{ background: "var(--card, #111)", borderRadius: 16, padding: 32, marginBottom: 24, border: "1px solid var(--border, #222)" }}>
          <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
            {phases.map((p, i) => (
              <div key={i} style={{ textAlign: "center", opacity: i <= phase ? 1 : 0.3, transition: "opacity 0.5s" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: i < phase ? "#22c55e22" : i === phase ? "#d4a84333" : "#222",
                  border: `2px solid ${i < phase ? "#22c55e" : i === phase ? "#d4a843" : "#333"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24, margin: "0 auto 8px",
                  animation: i === phase ? "pulse 1.5s infinite" : "none",
                }}>
                  {i < phase ? "✅" : p.icon}
                </div>
                <div style={{ fontSize: 11, color: i <= phase ? "var(--t1, #eee)" : "#555", maxWidth: 90 }}>{p.label}</div>
              </div>
            ))}
          </div>
          <style>{`@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }`}</style>
        </div>
      )}

      {error && (
        <div style={{ background: "#2a0000", border: "1px solid #4a1111", borderRadius: 12, padding: 16, marginBottom: 24, color: "#fca5a5" }}>
          ❌ {error}
        </div>
      )}

      {deepScanError && (
        <div style={{ background: "#2a0000", border: "1px solid #4a1111", borderRadius: 12, padding: 16, marginBottom: 24, color: "#fca5a5" }}>
          ❌ Escaneo Profundo: {deepScanError}
        </div>
      )}
      {effects3dError && (
        <div style={{ background: "#1a002a", border: "1px solid #4a1155", borderRadius: 12, padding: 16, marginBottom: 24, color: "#d8b4fe" }}>
          ❌ Efectos 3D: {effects3dError}
        </div>
      )}

      {showHistory && history.length > 0 && (
        <div style={{ background: "var(--card, #111)", borderRadius: 16, padding: 20, marginBottom: 24, border: "1px solid var(--border, #222)" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "var(--t1, #eee)" }}>📜 Análisis anteriores</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {history.map((h) => {
              let meta: Record<string, unknown> = {};
              try { meta = typeof h.metadata === "string" ? JSON.parse(h.metadata) : (h.metadata ?? {}); } catch { meta = {}; }
              return (
                <div
                  key={h.id}
                  onClick={() => downloadFromVault(`web-lab/download-report/${h.id}?template=${template}`)}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 14px", background: "#0a0a14", borderRadius: 8, cursor: "pointer",
                    border: "1px solid #222", transition: "border-color 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#d4a843")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#222")}
                >
                  <div>
                    <div style={{ fontSize: 13, color: "var(--t1, #eee)" }}>{h.originalUrl || h.title}</div>
                    <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                      {new Date(h.createdAt).toLocaleDateString("es-ES")} — Score: {String(meta?.score ?? "?")}
                    </div>
                  </div>
                  <span style={{ fontSize: 20, fontWeight: 700, color: scoreColor(Number(meta?.score) || 0) }}>{String(meta?.score ?? "?")}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ DEEP SCAN RESULTS (security, dom, effects3d) — independent of design analysis ═══ */}
      {(deepScan || effects3d) && !a && (
        <div style={{ background: "var(--card, #111)", borderRadius: 16, padding: 24, marginBottom: 24, border: "1px solid var(--border, #222)" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            {deepScan && (["security", "dom", "performance"] as const).map(t => {
              const labels = { security: "🔒 Seguridad", dom: "🏗️ DOM & Código", performance: "⚡ Performance" };
              return (
                <button key={t} onClick={() => setTab(t as any)} style={{ padding: "10px 18px", background: tab === t ? "linear-gradient(135deg, #22c55e, #16a34a)" : "var(--ink, #0a0a0a)", border: tab === t ? "none" : "1px solid #333", borderRadius: 10, color: tab === t ? "#000" : "#aaa", fontWeight: tab === t ? 700 : 400, cursor: "pointer", fontSize: 13 }}>
                  {labels[t]}
                </button>
              );
            })}
            {effects3d && (
              <button onClick={() => setTab("effects3d" as any)} style={{ padding: "10px 18px", background: tab === "effects3d" ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : "var(--ink, #0a0a0a)", border: tab === "effects3d" ? "none" : "1px solid #333", borderRadius: 10, color: tab === "effects3d" ? "#fff" : "#a78bfa", fontWeight: tab === "effects3d" ? 700 : 400, cursor: "pointer", fontSize: 13 }}>
                ✨ Efectos 3D
              </button>
            )}
          </div>
          {tab === "security" && deepScan && <SecurityPanel scan={deepScan} />}
          {tab === "dom" && deepScan && <DomPanel scan={deepScan} />}
          {tab === "performance" && deepScan && <PerformancePanel scan={deepScan} />}
          {tab === "effects3d" && effects3d && (
            <Effects3DPanel
              data={effects3d}
              activeTab={effects3dTab}
              setActiveTab={setEffects3dTab}
              copied={effects3dCopied}
              setCopied={setEffects3dCopied}
            />
          )}
        </div>
      )}

      {a && result && (
        <>
          {/* CTA visible: el usuario reportaba "solo veo las instrucciones, no veo
              el .css real". Antes el tab "Resumen" salía por defecto y ocultaba
              el CSS. Ahora arrancamos en "css" y mostramos este banner para que
              quede crystal-clear que el CSS REAL generado está debajo y se puede
              copiar/descargar. */}
          {a.improvedCss && a.improvedCss.length > 50 && (
            <div style={{
              marginBottom: 14,
              padding: "12px 16px",
              borderRadius: 10,
              background: "linear-gradient(135deg, rgba(212,168,67,.10), rgba(184,134,11,.06))",
              border: "1px solid rgba(212,168,67,.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}>
              <div style={{ fontSize: 13, color: "var(--t1, #eee)" }}>
                <strong style={{ color: "#d4a843" }}>✓ CSS real generado y listo</strong>
                <span style={{ color: "var(--t2, #aaa)", marginLeft: 8 }}>
                  ({a.improvedCss.length.toLocaleString("es-ES")} caracteres) — pestañas: <em>Código CSS</em> ver/copiar, <em>Preview</em> ver renderizado, <em>Editar</em> ajustar y guardar.
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  onClick={() => setTab("css")}
                  style={{ padding: "6px 12px", background: tab === "css" ? "#d4a843" : "#1a1a2e", color: tab === "css" ? "#000" : "#d4a843", border: "1px solid #d4a843", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                >💻 Ver CSS</button>
                <button
                  onClick={() => copyToClipboard(a.improvedCss, "CSS")}
                  style={{ padding: "6px 12px", background: "#1a1a2e", color: "#22c55e", border: "1px solid #22c55e44", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                >📋 Copiar</button>
                <button
                  onClick={() => downloadFile(a.improvedCss, "improved-styles.css", "text/css")}
                  style={{ padding: "6px 12px", background: "#1a1a2e", color: "#aaa", border: "1px solid #333", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                >💾 Descargar</button>
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {(["css", "preview", "edit", "summary", "html"] as const).map((t) => {
              const labels = { summary: "📊 Recomendaciones", css: "💻 CSS Real Generado", html: "🏗️ HTML", preview: "👁️ Preview Visual", edit: "✏️ Editar y Guardar" };
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    padding: "10px 20px",
                    background: tab === t ? "linear-gradient(135deg, #d4a843, #b8860b)" : "var(--card, #111)",
                    border: tab === t ? "none" : "1px solid var(--border, #333)",
                    borderRadius: 10,
                    color: tab === t ? "#000" : "var(--t2, #aaa)",
                    fontWeight: tab === t ? 700 : 400,
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  {labels[t]}
                </button>
              );
            })}
            {deepScan && (["security", "dom", "performance"] as const).map(t => {
              const labels = { security: "🔒 Seguridad", dom: "🏗️ DOM & JS", performance: "⚡ Performance" };
              return (
                <button key={t} onClick={() => setTab(t as any)} style={{ padding: "10px 18px", background: tab === t ? "linear-gradient(135deg, #22c55e, #16a34a)" : "var(--card, #111)", border: tab === t ? "none" : "1px solid #333", borderRadius: 10, color: tab === t ? "#000" : "#22c55e", fontWeight: tab === t ? 700 : 400, cursor: "pointer", fontSize: 13 }}>
                  {labels[t]}
                </button>
              );
            })}
            {effects3d && (
              <button onClick={() => setTab("effects3d" as any)} style={{ padding: "10px 18px", background: tab === "effects3d" ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : "var(--card, #111)", border: tab === "effects3d" ? "none" : "1px solid #7c3aed55", borderRadius: 10, color: tab === "effects3d" ? "#fff" : "#a78bfa", fontWeight: tab === "effects3d" ? 700 : 400, cursor: "pointer", fontSize: 13 }}>
                ✨ Efectos 3D
              </button>
            )}
          </div>

          <div style={{ background: "var(--card, #111)", borderRadius: 16, padding: 24, marginBottom: 24, border: "1px solid var(--border, #222)" }}>
            {tab === "summary" && (
              <div>
                <div style={{ textAlign: "center", marginBottom: 32 }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 120, height: 120, borderRadius: "50%",
                    border: `5px solid ${scoreColor(a.overallScore)}`,
                  }}>
                    <span style={{ fontSize: 40, fontWeight: 800, color: scoreColor(a.overallScore) }}>{a.overallScore}</span>
                  </div>
                  <p style={{ marginTop: 8, fontSize: 13, color: "var(--t2, #888)" }}>Score General /100</p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 28 }}>
                  {a.categories && Object.entries(a.categories).map(([key, val]) => (
                    <div key={key} style={{
                      background: "#0a0a14", padding: 16, borderRadius: 12, textAlign: "center",
                      border: `1px solid ${scoreColor(val as number)}33`,
                    }}>
                      <div style={{ fontSize: 14, marginBottom: 4 }}>{categoryIcons[key]}</div>
                      <div style={{ fontSize: 26, fontWeight: 700, color: scoreColor(val as number) }}>{val as number}</div>
                      <div style={{ fontSize: 11, color: "var(--t2, #888)", marginTop: 2 }}>{categoryLabels[key] || key}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>📋 Resumen Ejecutivo</h3>
                  <p style={{ color: "var(--t2, #ccc)", lineHeight: 1.7, fontSize: 14 }}>{a.summary}</p>
                </div>

                {a.colorPalette && (
                  <div style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>🎨 Paleta de Colores</h3>
                    <div style={{ display: "flex", gap: 32 }}>
                      <div>
                        <p style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>Actual</p>
                        <div style={{ display: "flex", gap: 6 }}>
                          {(a.colorPalette.current || []).map((c, i) => (
                            <div
                              key={i}
                              title={c}
                              onClick={() => copyToClipboard(c, c)}
                              style={{ width: 40, height: 40, borderRadius: 8, background: c, border: "1px solid #333", cursor: "pointer" }}
                            />
                          ))}
                        </div>
                      </div>
                      <div>
                        <p style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>Mejorada</p>
                        <div style={{ display: "flex", gap: 6 }}>
                          {(a.colorPalette.improved || []).map((c, i) => (
                            <div
                              key={i}
                              title={c}
                              onClick={() => copyToClipboard(c, c)}
                              style={{ width: 40, height: 40, borderRadius: 8, background: c, border: "1px solid #333", cursor: "pointer" }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    {copied && <p style={{ fontSize: 11, color: "#22c55e", marginTop: 6 }}>✅ {copied} copiado</p>}
                  </div>
                )}

                {a.typography && (
                  <div style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>🔤 Tipografía</h3>
                    <div style={{ display: "flex", gap: 32 }}>
                      <div>
                        <p style={{ fontSize: 12, color: "#888" }}>Actual</p>
                        <p style={{ color: "#ccc", fontSize: 14 }}>{(a.typography.current || []).join(", ") || "—"}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 12, color: "#888" }}>Recomendada</p>
                        <p style={{ color: "#ccc", fontSize: 14 }}>{(a.typography.improved || []).join(", ") || "—"}</p>
                      </div>
                    </div>
                  </div>
                )}

                {result.pageSpeed && (
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>⚡ PageSpeed</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
                      {Object.entries(result.pageSpeed.mobile || {}).map(([k, v]) => (
                        <div key={k} style={{ background: "#0a0a14", padding: 10, borderRadius: 8, textAlign: "center" }}>
                          <div style={{ fontSize: 22, fontWeight: 700, color: scoreColor(v as number) }}>{v as number}</div>
                          <div style={{ fontSize: 11, color: "#888" }}>{k}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "css" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700 }}>💻 CSS Mejorado</h3>
                    <p style={{ fontSize: 12, color: "var(--t2, #888)", marginTop: 4 }}>
                      Listo para copiar/pegar — compatible con Shopify, WooCommerce y cualquier CMS
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => copyToClipboard(a.improvedCss, "CSS")}
                      style={{
                        padding: "8px 16px",
                        background: copied === "CSS" ? "#22c55e22" : "#1a1a2e",
                        border: `1px solid ${copied === "CSS" ? "#22c55e" : "#333"}`,
                        borderRadius: 8, color: copied === "CSS" ? "#22c55e" : "#ccc",
                        cursor: "pointer", fontSize: 13,
                      }}
                    >
                      {copied === "CSS" ? "✅ Copiado" : "📋 Copiar CSS"}
                    </button>
                    <button
                      onClick={() => downloadFile(a.improvedCss, "improved-styles.css", "text/css")}
                      style={{
                        padding: "8px 16px",
                        background: "#1a1a2e",
                        border: "1px solid #333",
                        borderRadius: 8, color: "#ccc",
                        cursor: "pointer", fontSize: 13,
                      }}
                    >
                      💾 Descargar .css
                    </button>
                    <button
                      onClick={() => {
                        const fragments = (a.improvedHtmlFragments || []).map((f: any) => f.improved).join("\n");
                        const toolbarCss = `.shopy-preview-toolbar{position:fixed;bottom:0;left:0;right:0;z-index:99999;background:linear-gradient(135deg,#0a0a1a,#1a1a2e);border-top:2px solid #d4a843;padding:10px 24px;display:flex;align-items:center;justify-content:space-between;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#ccc;font-size:12px;box-shadow:0 -4px 20px rgba(0,0,0,0.5)}.shopy-preview-toolbar a{color:#d4a843;text-decoration:none;font-weight:600}`;
                        const toolbar = `<div class="shopy-preview-toolbar"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:14px;font-weight:700;background:linear-gradient(135deg,#d4a843,#b8860b);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Shopy Crafter</span><span style="font-size:11px;color:#888">Preview Visual — CSS Mejorado</span></div><div><span style="color:#888">Fuente: ${url}</span> · <a href="https://shopycrafter.com" target="_blank">shopycrafter.com</a></div></div>`;
                        const fullHtml = `<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>Preview Visual — CSS Mejorado</title>\n<style>\n${a.improvedCss}\nbody{margin:0;padding:0;min-height:100vh}\n${toolbarCss}\n</style>\n</head>\n<body>\n${fragments}\n${toolbar}\n</body>\n</html>`;
                        downloadFile(fullHtml, "preview-visual.html", "text/html");
                      }}
                      style={{
                        padding: "8px 16px",
                        background: "linear-gradient(135deg, #22c55e22, #16a34a22)",
                        border: "1px solid #22c55e44",
                        borderRadius: 8, color: "#22c55e",
                        cursor: "pointer", fontSize: 13,
                      }}
                    >
                      👁️ Descargar Preview HTML
                    </button>
                    <button
                      onClick={() => {
                        const fragments = (a.improvedHtmlFragments || []).map((f: any) => f.improved).join("\n");
                        const fullHtml = `<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>Diseño Web</title>\n<style>\n${a.improvedCss}\nbody{margin:0;padding:0;min-height:100vh}\n</style>\n</head>\n<body>\n${fragments}\n</body>\n</html>`;
                        navigator.clipboard.writeText(fullHtml).catch(() => {});
                        window.open("https://claude.ai/design", "_blank", "noopener,noreferrer");
                      }}
                      style={{
                        padding: "8px 16px",
                        background: "linear-gradient(135deg, rgba(147,51,234,0.18), rgba(79,70,229,0.12))",
                        border: "1px solid rgba(147,51,234,0.4)",
                        borderRadius: 8, color: "#c084fc",
                        cursor: "pointer", fontSize: 13, fontWeight: 600,
                        display: "flex", alignItems: "center", gap: 6,
                      }}
                      title="Copia el HTML al portapapeles y abre claude.ai/design para diseño profesional en vivo"
                    >
                      ✏️ Diseñar con Claude
                    </button>
                  </div>
                </div>
                <pre style={{
                  background: "#0d1117",
                  border: "1px solid #30363d",
                  borderRadius: 10,
                  padding: 20,
                  overflow: "auto",
                  maxHeight: 600,
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "#c9d1d9",
                  fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                }}>
                  <code>{a.improvedCss}</code>
                </pre>
              </div>
            )}

            {tab === "html" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700 }}>🏗️ HTML Mejorado</h3>
                    <p style={{ fontSize: 12, color: "var(--t2, #888)", marginTop: 4 }}>
                      Fragmentos HTML semánticos y accesibles — antes/después por sección
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => {
                        const all = (a.improvedHtmlFragments || []).map(f => `<!-- ${f.section} -->\n${f.improved}`).join("\n\n");
                        copyToClipboard(all, "HTML");
                      }}
                      style={{
                        padding: "8px 16px",
                        background: copied === "HTML" ? "#22c55e22" : "#1a1a2e",
                        border: `1px solid ${copied === "HTML" ? "#22c55e" : "#333"}`,
                        borderRadius: 8, color: copied === "HTML" ? "#22c55e" : "#ccc",
                        cursor: "pointer", fontSize: 13,
                      }}
                    >
                      {copied === "HTML" ? "✅ Copiado" : "📋 Copiar HTML"}
                    </button>
                    <button
                      onClick={() => {
                        const all = (a.improvedHtmlFragments || []).map(f => `<!-- ${f.section} -->\n${f.improved}`).join("\n\n");
                        downloadFile(all, "improved-fragments.html", "text/html");
                      }}
                      style={{
                        padding: "8px 16px",
                        background: "#1a1a2e",
                        border: "1px solid #333",
                        borderRadius: 8, color: "#ccc",
                        cursor: "pointer", fontSize: 13,
                      }}
                    >
                      💾 Descargar .html
                    </button>
                  </div>
                </div>

                {a.issues && a.issues.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: "var(--t2, #aaa)" }}>
                      ⚠️ Problemas detectados ({a.issues.length})
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {a.issues.map((issue, i) => (
                        <div key={i} style={{
                          display: "grid", gridTemplateColumns: "80px 1fr 1fr 100px 100px",
                          gap: 8, padding: "8px 12px", background: "#0a0a14", borderRadius: 8,
                          fontSize: 12, alignItems: "center", border: "1px solid #1a1a2e",
                        }}>
                          <span style={{
                            background: (sevColors[issue.severity] || "#888") + "22",
                            color: sevColors[issue.severity] || "#888",
                            padding: "2px 8px", borderRadius: 4, fontSize: 11, textAlign: "center",
                          }}>
                            {issue.severity}
                          </span>
                          <span style={{ fontFamily: "monospace", color: "#e0e0e0", fontSize: 11 }}>{issue.selector}</span>
                          <span style={{ color: "#aaa" }}>{issue.property}: <span style={{ color: "#f87171" }}>{issue.current}</span></span>
                          <span style={{ color: "#4ade80", fontFamily: "monospace", fontSize: 11 }}>{issue.improved}</span>
                          <span title={issue.reason} style={{ color: "#666", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {issue.reason}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(a.improvedHtmlFragments || []).map((frag, i) => (
                  <div key={i} style={{ marginBottom: 20 }}>
                    <h4 style={{ color: "#d4a843", marginBottom: 8, fontSize: 14 }}>📌 {frag.section}</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <p style={{ fontSize: 11, color: "#ef4444", marginBottom: 4 }}>❌ Original</p>
                        <pre style={{
                          background: "#1a0000", border: "1px solid #4a1111", borderRadius: 8,
                          padding: 12, fontSize: 11, overflow: "auto", maxHeight: 250, color: "#fca5a5",
                          fontFamily: "'Fira Code', monospace",
                        }}>
                          <code>{frag.original}</code>
                        </pre>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: "#22c55e", marginBottom: 4 }}>✅ Mejorado</p>
                        <pre style={{
                          background: "#001a00", border: "1px solid #114a11", borderRadius: 8,
                          padding: 12, fontSize: 11, overflow: "auto", maxHeight: 250, color: "#86efac",
                          fontFamily: "'Fira Code', monospace",
                        }}>
                          <code>{frag.improved}</code>
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "preview" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700 }}>👁️ Preview Visual</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    {/* Device selector */}
                    <div style={{ display: "flex", gap: 4, padding: 3, background: "#1a1a1a", borderRadius: 8 }}>
                      {(["desktop", "tablet", "mobile"] as const).map(d => (
                        <button
                          key={d}
                          onClick={() => setPreviewDevice(d)}
                          title={d}
                          style={{
                            padding: "5px 10px", borderRadius: 6, border: "none",
                            background: previewDevice === d ? "#d4a843" : "transparent",
                            color: previewDevice === d ? "#000" : "#888",
                            fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "capitalize",
                          }}
                        >{d === "desktop" ? "🖥️" : d === "tablet" ? "📱" : "📱"} {d}</button>
                      ))}
                    </div>
                    <span style={{ fontSize: 13, color: previewMode === "original" ? "#ef4444" : "#888" }}>Original</span>
                    <button
                      onClick={() => setPreviewMode(previewMode === "original" ? "improved" : "original")}
                      style={{
                        width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer",
                        background: previewMode === "improved" ? "#22c55e" : "#333",
                        position: "relative", transition: "background 0.3s",
                      }}
                    >
                      <div style={{
                        width: 20, height: 20, borderRadius: "50%", background: "#fff",
                        position: "absolute", top: 3,
                        left: previewMode === "improved" ? 25 : 3,
                        transition: "left 0.3s",
                      }} />
                    </button>
                    <span style={{ fontSize: 13, color: previewMode === "improved" ? "#22c55e" : "#888" }}>Mejorado</span>
                    <button
                      onClick={openPreviewFullscreen}
                      style={{ padding: "6px 12px", background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, color: "#ccc", cursor: "pointer", fontSize: 12 }}
                    >🔗 Abrir en pestaña</button>
                  </div>
                </div>
                {/* Device-sized preview frame */}
                <div style={{ display: "flex", justifyContent: "center", padding: 16, background: "#0a0a0a", borderRadius: 12 }}>
                  <iframe
                    sandbox="allow-popups"
                    title="Preview de la página mejorada"
                    style={{
                      width: previewDevice === "desktop" ? "100%" : previewDevice === "tablet" ? 768 : 390,
                      maxWidth: "100%",
                      height: 720,
                      border: `2px solid ${previewMode === "improved" ? "#22c55e33" : "#ef444433"}`,
                      borderRadius: 12,
                      background: "#fff",
                      transition: "width 0.25s ease",
                    }}
                    srcDoc={buildPreviewSrcDoc(previewMode)}
                  />
                </div>

                {/* ── Iteración: sugerir cambios sobre lo ya generado ── */}
                <div style={{ marginTop: 24, padding: 18, background: "#0c0c0e", border: "1px solid #1f1f24", borderRadius: 12 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: "#e6c668", marginBottom: 8 }}>💬 Sugerir cambios sobre el diseño actual</h4>
                  <p style={{ fontSize: 12, color: "#888", marginBottom: 12, lineHeight: 1.5 }}>
                    Describe en lenguaje natural lo que quieres cambiar. La IA tomará el HTML/CSS actual como punto de partida y generará una nueva versión. Ejemplos: "haz el hero más oscuro y añade un degradado dorado", "cambia la tipografía a algo más editorial estilo Vogue", "el botón principal debe ser verde menta y más grande".
                  </p>
                  <textarea
                    rows={3}
                    value={changeRequest}
                    onChange={(e) => setChangeRequest(e.target.value)}
                    placeholder="Describe el cambio que quieres aplicar…"
                    disabled={iterating}
                    style={{
                      width: "100%", padding: "10px 14px",
                      background: "#0a0a0a", border: "1px solid #2a2a30", borderRadius: 10,
                      color: "#eee", fontSize: 13, outline: "none", resize: "vertical",
                      fontFamily: "inherit", boxSizing: "border-box",
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 12, flexWrap: "wrap" }}>
                    <small style={{ color: "#666", fontSize: 11 }}>
                      {iterError ? <span style={{ color: "#ef4444" }}>⚠ {iterError}</span> : "El cambio reemplaza la versión mejorada actual y conserva el original como referencia."}
                    </small>
                    <button
                      onClick={iterate}
                      disabled={iterating || !changeRequest.trim()}
                      style={{
                        padding: "9px 18px",
                        background: iterating || !changeRequest.trim() ? "#2a2a30" : "linear-gradient(135deg, #d4a843, #b8860b)",
                        border: "none", borderRadius: 10,
                        color: iterating || !changeRequest.trim() ? "#666" : "#000",
                        fontWeight: 700, fontSize: 13,
                        cursor: iterating || !changeRequest.trim() ? "not-allowed" : "pointer",
                      }}
                    >{iterating ? "Aplicando…" : "✨ Aplicar cambio"}</button>
                  </div>
                  <LiveOperation
                    active={iterating}
                    title="Aplicando tu cambio sobre la web generada"
                    estimatedSec={35}
                    messages={[
                      "Enviando contexto previo + tu petición a Claude…",
                      "Reescribiendo CSS sin perder coherencia con la marca…",
                      "Actualizando fragmentos HTML afectados…",
                      "Validando uniqueness y rechazando placeholders…",
                      "Refrescando la vista previa con el resultado…",
                    ]}
                    className="w-full mt-3"
                  />
                </div>
              </div>
            )}

            {tab === "security" && deepScan && <SecurityPanel scan={deepScan} />}
            {tab === "dom" && deepScan && <DomPanel scan={deepScan} />}
            {tab === "performance" && deepScan && <PerformancePanel scan={deepScan} />}
            {tab === "effects3d" && effects3d && (
              <Effects3DPanel
                data={effects3d}
                activeTab={effects3dTab}
                setActiveTab={setEffects3dTab}
                copied={effects3dCopied}
                setCopied={setEffects3dCopied}
              />
            )}

            {tab === "edit" && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700 }}>✏️ Editor manual de HTML/CSS</h3>
                  <p style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                    Edita libremente el HTML y el CSS. Al guardar, se crea una nueva versión en la bóveda del proyecto sin tocar el original. Puedes descargarla luego desde el historial.
                  </p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#aaa", marginBottom: 6, fontWeight: 600 }}>HTML editable</label>
                    <textarea
                      value={editHtml}
                      onChange={(e) => setEditHtml(e.target.value)}
                      spellCheck={false}
                      style={{
                        width: "100%", height: 400,
                        background: "#0a0a0a", color: "#dcdcaa",
                        border: "1px solid #2a2a30", borderRadius: 10,
                        padding: 12, fontFamily: "ui-monospace, monospace",
                        fontSize: 12, lineHeight: 1.5, resize: "vertical",
                        boxSizing: "border-box", outline: "none",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#aaa", marginBottom: 6, fontWeight: 600 }}>CSS editable</label>
                    <textarea
                      value={editCss}
                      onChange={(e) => setEditCss(e.target.value)}
                      spellCheck={false}
                      style={{
                        width: "100%", height: 400,
                        background: "#0a0a0a", color: "#9cdcfe",
                        border: "1px solid #2a2a30", borderRadius: 10,
                        padding: 12, fontFamily: "ui-monospace, monospace",
                        fontSize: 12, lineHeight: 1.5, resize: "vertical",
                        boxSizing: "border-box", outline: "none",
                      }}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
                  <input
                    type="text"
                    placeholder="Etiqueta opcional (p.ej. 'v2 — header oscuro')"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    style={{
                      flex: 1, minWidth: 220, padding: "9px 14px",
                      background: "#0a0a0a", border: "1px solid #2a2a30",
                      borderRadius: 10, color: "#eee", fontSize: 13, outline: "none",
                    }}
                  />
                  <button
                    onClick={saveEdit}
                    disabled={savingEdit}
                    style={{
                      padding: "10px 22px",
                      background: savingEdit ? "#2a2a30" : "linear-gradient(135deg, #22c55e, #16a34a)",
                      border: "none", borderRadius: 10, color: savingEdit ? "#666" : "#000",
                      fontWeight: 700, cursor: savingEdit ? "not-allowed" : "pointer", fontSize: 13,
                    }}
                  >{savingEdit ? "Guardando…" : "💾 Guardar versión en bóveda"}</button>
                  <button
                    onClick={() => {
                      const blob = new Blob([editHtml], { type: "text/html" });
                      const a2 = document.createElement("a");
                      a2.href = URL.createObjectURL(blob);
                      a2.download = `editado-${Date.now()}.html`;
                      a2.click();
                    }}
                    style={{ padding: "10px 16px", background: "#1a1a2e", border: "1px solid #333", borderRadius: 10, color: "#ccc", cursor: "pointer", fontSize: 12 }}
                  >⬇ HTML</button>
                  <button
                    onClick={() => {
                      const blob = new Blob([editCss], { type: "text/css" });
                      const a2 = document.createElement("a");
                      a2.href = URL.createObjectURL(blob);
                      a2.download = `editado-${Date.now()}.css`;
                      a2.click();
                    }}
                    style={{ padding: "10px 16px", background: "#1a1a2e", border: "1px solid #333", borderRadius: 10, color: "#ccc", cursor: "pointer", fontSize: 12 }}
                  >⬇ CSS</button>
                </div>
                {savedEditMsg && (
                  <div style={{ fontSize: 12, color: savedEditMsg.startsWith("✓") ? "#22c55e" : "#ef4444", marginBottom: 12 }}>
                    {savedEditMsg}
                  </div>
                )}
                <div style={{ marginTop: 8 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: "#e6c668", marginBottom: 8 }}>🔍 Preview en vivo de tu edición</h4>
                  <iframe
                    sandbox="allow-popups"
                    title="Preview de la edición manual"
                    style={{ width: "100%", height: 520, border: "1px solid #2a2a30", borderRadius: 12, background: "#fff" }}
                    srcDoc={`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><base target="_blank"><style>${editCss}\nbody{margin:0;padding:0;min-height:100vh}</style></head><body>${editHtml}</body></html>`}
                  />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {result.vaultIds?.report ? (
              <button
                onClick={() => downloadFromVault(`web-lab/download-report/${result.vaultIds.report}?template=${template}`)}
                style={{
                  padding: "10px 20px",
                  background: "linear-gradient(135deg, #d4a843, #b8860b)",
                  border: "none", borderRadius: 10, color: "#000",
                  fontWeight: 700, cursor: "pointer", fontSize: 13,
                }}
              >
                📄 Descargar Informe ({template})
              </button>
            ) : result.reportHtml ? (
              <button
                onClick={() => downloadFile(result.reportHtml!, "web-lab-report.html", "text/html")}
                style={{
                  padding: "10px 20px",
                  background: "linear-gradient(135deg, #d4a843, #b8860b)",
                  border: "none", borderRadius: 10, color: "#000",
                  fontWeight: 700, cursor: "pointer", fontSize: 13,
                }}
              >
                📄 Descargar Informe ({template})
              </button>
            ) : null}
            {result.vaultIds?.css ? (
              <button
                onClick={() => downloadFromVault(`web-lab/download-css/${result.vaultIds.css}`)}
                style={{
                  padding: "10px 20px",
                  background: "#1a1a2e", border: "1px solid #333",
                  borderRadius: 10, color: "#ccc", cursor: "pointer", fontSize: 13,
                }}
              >
                📋 Descargar CSS
              </button>
            ) : a?.improvedCss ? (
              <button
                onClick={() => downloadFile(a.improvedCss, "improved-styles.css", "text/css")}
                style={{
                  padding: "10px 20px",
                  background: "linear-gradient(135deg, #d4a843, #b8860b)",
                  border: "none", borderRadius: 10, color: "#000",
                  fontWeight: 700, cursor: "pointer", fontSize: 13,
                }}
              >
                📋 Descargar CSS Mejorado
              </button>
            ) : null}
            {result.vaultIds?.html ? (
              <button
                onClick={() => downloadFromVault(`web-lab/download-html/${result.vaultIds.html}`)}
                style={{
                  padding: "10px 20px",
                  background: "#1a1a2e", border: "1px solid #333",
                  borderRadius: 10, color: "#ccc", cursor: "pointer", fontSize: 13,
                }}
              >
                🏗️ Descargar HTML
              </button>
            ) : a?.improvedHtmlFragments?.length ? (
              <button
                onClick={() => downloadFile(
                  a.improvedHtmlFragments.map(f => `<!-- ${f.section} -->\n${f.improved}`).join("\n\n"),
                  "improved-fragments.html", "text/html"
                )}
                style={{
                  padding: "10px 20px",
                  background: "#1a1a2e", border: "1px solid #333",
                  borderRadius: 10, color: "#ccc", cursor: "pointer", fontSize: 13,
                }}
              >
                🏗️ Descargar HTML Mejorado
              </button>
            ) : null}
            {result.vaultIds?.report && (
              <button
                onClick={() => downloadFromVault(`web-lab/download-pack/${result.vaultIds.report}`)}
                style={{
                  padding: "10px 20px",
                  background: "#0a2a0a", border: "1px solid #22c55e33",
                  borderRadius: 10, color: "#22c55e", cursor: "pointer", fontSize: 13,
                }}
              >
                📦 Descargar Pack Completo (ZIP)
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
