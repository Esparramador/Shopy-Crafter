import { useState, useCallback, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
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

interface PsiDiagnostic {
  id: string;
  title: string;
  description: string;
  displayValue: string | null;
  score: number | null;
  savingsMs: number | null;
  savingsBytes: number | null;
  impact: "high" | "medium" | "low" | "info";
  items: Array<{ label: string; detail: string }>;
}
interface PsiCwvMetric { value: number | null; unit: string; status: string }
interface PageSpeedData {
  mobile: Record<string, number> | null;
  desktop: Record<string, number> | null;
  coreWebVitals: Record<string, PsiCwvMetric> | null;
  diagnostics: PsiDiagnostic[];
  diagnosticsDesktop: PsiDiagnostic[] | null;
}

interface AnalysisResult {
  analysis: WebLabAnalysis;
  reportHtml?: string;
  vaultIds: { report: number | null; css: number | null; html: number | null };
  pageSpeed: PageSpeedData | null;
  scraperData: any;
  analyticsDetection?: {
    hasGoogleAnalytics: boolean;
    hasGTM: boolean;
    hasFbPixel: boolean;
    hasTikTokPixel: boolean;
    hasPinterest: boolean;
    hasHotjar: boolean;
    hasCookieBanner: boolean;
    hasChatWidget: boolean;
  };
  googleReviews?: Record<string, any> | null;
  serpPositioning?: { text: string; sources: string[] } | null;
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

interface ExposedSecret {
  type: string; service: string; severity: string; masked: string; raw: string;
  context: string; recommendation: string; lineNumber: number;
}
interface SecretsReport {
  summary: { total: number; critical: number; high: number; medium: number; services: string[]; riskScore: number; scannedAt: string; contentLength: number };
  secrets: ExposedSecret[];
}

interface AuditFinding {
  id: string;
  category: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  evidence: string;
  lineNumber?: number;
  attackScenario: string;
  dbImpact?: string;
  fix: string;
  fixCode?: string;
  cvss?: number;
  mitreAttack?: string[];
  nistCsf?: string[];
  relatedSkills?: Array<{ id: string; name: string }>;
}
interface SecurityAuditResult {
  findings: AuditFinding[];
  stats: { critical: number; high: number; medium: number; low: number; total: number };
  categories: string[];
  secScore: number;
  dbRisk: "critical" | "high" | "medium" | "low";
  scannedAt: string;
  contentLength: number;
  vaultId?: number | null;
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
    exposedSecrets?: ExposedSecret[];
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

      {/* Exposed Secrets Section */}
      {s.exposedSecrets && s.exposedSecrets.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: "#ef4444", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            🔑 Credenciales / API Keys expuestas ({s.exposedSecrets.length})
            <span style={{ fontSize: 11, fontWeight: 400, color: "#fca5a5", background: "#4a0a0a", padding: "2px 8px", borderRadius: 4 }}>
              ACCIÓN URGENTE REQUERIDA
            </span>
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {s.exposedSecrets.map((sec, i) => (
              <div key={i} style={{ padding: "14px 16px", background: "#0a0005", borderRadius: 10, border: `1px solid ${sec.severity === "critical" ? "#ef4444" : sec.severity === "high" ? "#f97316" : "#eab308"}44` }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <SevBadge s={sec.severity} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{sec.service}</span>
                      <span style={{ fontSize: 11, color: "#aaa" }}>— {sec.type}</span>
                      <span style={{ fontSize: 10, color: "#666" }}>línea {sec.lineNumber}</span>
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 12, color: "#ef4444", background: "#0a0000", padding: "6px 10px", borderRadius: 6, marginBottom: 6, wordBreak: "break-all" }}>
                      {sec.masked}
                    </div>
                    <p style={{ color: "#888", fontSize: 11, margin: "0 0 4px", fontStyle: "italic", wordBreak: "break-all" }}>
                      Contexto: …{sec.context.slice(0, 120)}…
                    </p>
                    <p style={{ color: "#22c55e", fontSize: 11, margin: 0 }}>💡 {sec.recommendation}</p>
                  </div>
                </div>
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

function SecretsScanPanel({ report, onDownload }: { report: SecretsReport; onDownload: () => void }) {
  const { summary, secrets } = report;
  const sevC: Record<string, string> = { critical: "#ef4444", high: "#f97316", medium: "#eab308" };
  return (
    <div>
      {/* Summary banner */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Risk Score", val: summary.riskScore, color: summary.riskScore >= 70 ? "#22c55e" : summary.riskScore >= 40 ? "#eab308" : "#ef4444", big: true },
          { label: "Total Hallados", val: summary.total, color: summary.total === 0 ? "#22c55e" : "#ef4444", big: false },
          { label: "🔴 Críticos", val: summary.critical, color: "#ef4444", big: false },
          { label: "🟠 Altos", val: summary.high, color: "#f97316", big: false },
          { label: "🟡 Medios", val: summary.medium, color: "#eab308", big: false },
          { label: "Servicios afectados", val: summary.services.length, color: "#a78bfa", big: false },
        ].map((s, i) => (
          <div key={i} style={{ padding: 14, background: "#0a0a14", borderRadius: 10, textAlign: "center" }}>
            <div style={{ fontSize: s.big ? 32 : 24, fontWeight: 800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {summary.services.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 12, color: "#888" }}>Servicios comprometidos: </span>
          {summary.services.map((sv, i) => (
            <span key={i} style={{ fontSize: 11, background: "#2a0a0a", color: "#fca5a5", padding: "2px 8px", borderRadius: 12, marginRight: 6, border: "1px solid #ef444433" }}>{sv}</span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          onClick={onDownload}
          style={{ padding: "8px 16px", background: "linear-gradient(135deg, #d4a843, #b8860b)", border: "none", borderRadius: 8, color: "#000", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
        >
          📥 Descargar Informe de Seguridad
        </button>
      </div>

      {secrets.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: "#22c55e", background: "#0a1a0a", borderRadius: 12, border: "1px solid #22c55e33" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🛡️</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>¡Sin credenciales expuestas detectadas!</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>El código analizado parece limpio. Recuerda escanear todos tus archivos JS/HTML públicos regularmente.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {secrets.map((sec, i) => (
            <div key={i} style={{ padding: "14px 16px", background: "#0a0005", borderRadius: 10, border: `1px solid ${sevC[sec.severity] || "#888"}44` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 700, background: sevC[sec.severity] || "#888", color: "#000", padding: "2px 7px", borderRadius: 4 }}>{sec.severity.toUpperCase()}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{sec.service}</span>
                <span style={{ fontSize: 11, color: "#aaa" }}>— {sec.type}</span>
                <span style={{ fontSize: 10, color: "#666", marginLeft: "auto" }}>línea {sec.lineNumber}</span>
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 12, color: sevC[sec.severity] || "#ef4444", background: "#0a0000", padding: "6px 10px", borderRadius: 6, marginBottom: 6, wordBreak: "break-all" }}>
                {sec.masked}
              </div>
              <p style={{ color: "#777", fontSize: 11, margin: "0 0 6px", wordBreak: "break-all", fontStyle: "italic" }}>
                Contexto: …{sec.context.slice(0, 150)}…
              </p>
              <p style={{ color: "#22c55e", fontSize: 11, margin: 0 }}>💡 {sec.recommendation}</p>
            </div>
          ))}
        </div>
      )}
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

function PsiDiagnosticsList({ list, device }: { list: PsiDiagnostic[] | null | undefined; device: string }) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const fmtSavings = (bytes: number | null, ms: number | null) =>
    [
      bytes ? (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MiB` : `${Math.round(bytes / 1024)} KiB`) : null,
      ms ? (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`) : null,
    ].filter(Boolean).join(" · ");
  return (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{ fontSize: 13, fontWeight: 700, color: "#f97316", margin: "0 0 8px" }}>
        🔬 Diagnósticos y oportunidades ({list.length}) — {device}
      </h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {list.map(d => {
          const impactColor = d.impact === "high" ? "#ef4444" : d.impact === "medium" ? "#eab308" : "#3b82f6";
          const impactLabel = d.impact === "high" ? "Alto" : d.impact === "medium" ? "Medio" : "Info";
          const savings = fmtSavings(d.savingsBytes, d.savingsMs);
          return (
            <div key={d.id} style={{ background: "#0a0a14", borderRadius: 8, padding: "12px 14px", border: `1px solid ${impactColor}22` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: impactColor, background: `${impactColor}22`, padding: "2px 7px", borderRadius: 5 }}>{impactLabel}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#eee" }}>{d.title}</span>
                {savings && <span style={{ fontSize: 11, fontWeight: 700, color: "#22c55e", marginLeft: "auto" }}>Ahorro: {savings}</span>}
                {!savings && d.displayValue && <span style={{ fontSize: 11, color: "#aaa", marginLeft: "auto" }}>{d.displayValue}</span>}
              </div>
              {d.description && <p style={{ fontSize: 11, color: "#888", margin: "6px 0 0", lineHeight: 1.45 }}>{d.description}</p>}
              {Array.isArray(d.items) && d.items.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                  {d.items.map((it, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, fontSize: 10, color: "#999", fontFamily: "monospace" }}>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
                      {it.detail && <span style={{ color: "#d4a843", flexShrink: 0 }}>{it.detail}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
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
  const [, navigate] = useLocation();
  const [labMode, setLabMode] = useState<"analysis" | "demos">("analysis");
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

  // Secrets Inspector state
  const [showSecrets, setShowSecrets] = useState(false);
  const [secretsInput, setSecretsInput] = useState("");
  const [secretsReport, setSecretsReport] = useState<SecretsReport | null>(null);
  const [secretsLoading, setSecretsLoading] = useState(false);
  const [secretsError, setSecretsError] = useState("");

  // Security Audit state
  const [auditReport, setAuditReport] = useState<SecurityAuditResult | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [auditInput, setAuditInput] = useState("");
  const [auditCatFilter, setAuditCatFilter] = useState<string>("all");
  const [auditExpandedId, setAuditExpandedId] = useState<string | null>(null);
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

  // Stitch AI — generación de páginas profesionales
  const [showStitch, setShowStitch] = useState(false);
  const [stitchLoading, setStitchLoading] = useState(false);
  const [stitchMsg, setStitchMsg] = useState("");
  const [stitchPrompt, setStitchPrompt] = useState("");
  const [stitchPageType, setStitchPageType] = useState<"landing" | "product" | "about" | "pricing" | "contact">("landing");
  const [stitchProjectId, setStitchProjectId] = useState<string>("");
  const [stitchStatus, setStitchStatus] = useState<"unknown" | "available" | "unavailable">("unknown");

  // DNA Extractor state
  const [showDna, setShowDna] = useState(false);
  const [dnaUrl, setDnaUrl] = useState("");
  const [dnaDeep, setDnaDeep] = useState(true);
  const [dnaAnalyzing, setDnaAnalyzing] = useState(false);
  const [dnaProgress, setDnaProgress] = useState<Array<{ text: string; status: string }>>([]);
  const [dnaDna, setDnaDna] = useState<Record<string, any> | null>(null);
  const [dnaResearch, setDnaResearch] = useState<Record<string, any> | null>(null);
  const [dnaInstructions, setDnaInstructions] = useState("");
  const [dnaGenerating, setDnaGenerating] = useState(false);
  const [dnaGenerated, setDnaGenerated] = useState("");
  const [dnaGenStatus, setDnaGenStatus] = useState("");

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

  const checkStitchStatus = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/stitch/status`, { credentials: "include" });
      const data = await r.json();
      setStitchStatus(data.available ? "available" : "unavailable");
      if (!data.available) setStitchMsg(data.message || "Stitch no configurado.");
    } catch {
      setStitchStatus("unavailable");
      setStitchMsg("No se pudo conectar con Stitch AI.");
    }
  }, []);

  const generateWithStitch = useCallback(async () => {
    if (!stitchPrompt.trim()) { setStitchMsg("⚠ Escribe un prompt para generar la página"); return; }
    setStitchLoading(true); setStitchMsg("Conectando con Stitch AI…");
    try {
      let pid = stitchProjectId;
      if (!pid) {
        setStitchMsg("Creando proyecto en Stitch…");
        const pr = await fetch(`${API_BASE}/api/stitch/projects`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: `ShopyCrafter-Lab-${Date.now()}`, description: "Generado desde Lab Web" }),
        });
        const pd = await pr.json();
        if (!pr.ok || pd.error) throw new Error(pd.error || "Error creando proyecto Stitch");
        pid = pd.project?.id || pd.project?.project_id || String(pd.project);
        if (pid) setStitchProjectId(pid);
      }

      setStitchMsg("Generando diseño con Stitch AI (puede tardar 30-60 s)…");

      const isProduct = stitchPageType === "product";
      const endpoint = isProduct
        ? `${API_BASE}/api/stitch/generate/shopify-product`
        : `${API_BASE}/api/stitch/generate`;

      const body = isProduct
        ? JSON.stringify({ product: { title: brandName || stitchPrompt.slice(0, 60), description: stitchPrompt, category: "ecommerce" }, projectId: pid, style: "modern ecommerce dark gold premium" })
        : JSON.stringify({ prompt: stitchPrompt, projectId: pid, model: "gemini-2.5-pro" });

      const gr = await fetch(endpoint, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body });
      const gd = await gr.json();
      if (!gr.ok || gd.error) throw new Error(gd.error || `Error ${gr.status}`);

      const screen = gd.result ?? gd;
      const html =
        screen?.html ??
        screen?.content ??
        screen?.code ??
        screen?.body ??
        screen?.rendered_html ??
        (typeof screen === "string" ? screen : null);

      if (html && typeof html === "string" && html.trim().length > 50) {
        setEditHtml(html);
        setEditCss("");
        setEditLabel(`stitch · ${stitchPageType}`);
        setTab("edit");
        setStitchMsg("✓ Página generada con Stitch AI — cargada en el editor. Edita y guarda en la bóveda.");
        loadHistory();
      } else {
        setStitchMsg(`✓ Stitch respondió. Resultado: ${JSON.stringify(screen).slice(0, 200)}`);
      }
    } catch (e: any) {
      setStitchMsg(`⚠ ${e.message}`);
    } finally {
      setStitchLoading(false);
    }
  }, [stitchPrompt, stitchPageType, stitchProjectId, brandName, loadHistory]);

  const analyzeDna = useCallback(async (urlOverride?: string) => {
    const targetUrl = (urlOverride ?? dnaUrl).trim();
    if (!targetUrl) return;
    if (urlOverride) setDnaUrl(urlOverride);
    setDnaAnalyzing(true);
    setDnaProgress([{ text: "Iniciando análisis…", status: "info" }]);
    setDnaDna(null);
    setDnaResearch(null);
    setDnaGenerated("");
    setDnaGenStatus("");
    try {
      const res = await fetch(`${API_BASE}/api/weblab/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: targetUrl, deep: dnaDeep }),
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({})) as any;
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6)) as any;
            if (evt.progress) setDnaProgress(p => [...p, { text: evt.progress, status: evt.status || "working" }]);
            if (evt.dna) setDnaDna(evt.dna);
            if (evt.research) setDnaResearch(evt.research);
            if (evt.done) setDnaProgress(p => [...p, { text: "✓ Extracción completada. Puedes generar el rediseño.", status: "complete" }]);
            if (evt.error) throw new Error(evt.error);
          } catch {}
        }
      }
    } catch (e: any) {
      setDnaProgress(p => [...p, { text: `⚠ ${e.message}`, status: "error" }]);
    } finally {
      setDnaAnalyzing(false);
    }
  }, [dnaUrl, dnaDeep]);

  const autoScanUrlSecrets = useCallback(async (targetUrl: string) => {
    if (!targetUrl.trim()) return;
    setSecretsLoading(true);
    setSecretsError("");
    setSecretsInput("Obteniendo código fuente de " + targetUrl + "…");
    try {
      const res = await fetch(`${API_BASE}/api/web-lab/fetch-source?url=${encodeURIComponent(targetUrl)}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { html } = await res.json();
      setSecretsInput(html || "");
      if (html) {
        // auto-run scanner with fetched HTML
        setSecretsLoading(false);
        const content = html.trim();
        if (content) {
          const r2 = await fetch(`${API_BASE}/api/web-lab/scan-secrets`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ html: content }),
          });
          if (r2.ok) {
            const d = await r2.json();
            setSecretsReport(d);
          }
        }
      }
    } catch (e: any) {
      setSecretsInput("");
      setSecretsError(`No se pudo obtener el código fuente: ${e.message}. Pega el HTML manualmente.`);
    } finally {
      setSecretsLoading(false);
    }
  }, []);

  const generateDnaRedesign = useCallback(async () => {
    if (!dnaDna) return;
    setDnaGenerating(true);
    setDnaGenerated("");
    setDnaGenStatus("Conectando con Claude…");
    let html = "";
    try {
      const res = await fetch(`${API_BASE}/api/weblab/improve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ dna: dnaDna, research: dnaResearch || {}, instructions: dnaInstructions.trim() || undefined }),
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({})) as any;
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6)) as any;
            if (evt.status) setDnaGenStatus(evt.status === "streaming" ? "Generando HTML con Claude…" : evt.status);
            if (evt.token) { html += evt.token; setDnaGenerated(html); }
            if (evt.done) setDnaGenStatus("✓ Rediseño generado — listo para descargar o abrir en pestaña");
            if (evt.error) throw new Error(evt.error);
          } catch {}
        }
      }
    } catch (e: any) {
      setDnaGenStatus(`⚠ ${e.message}`);
    } finally {
      setDnaGenerating(false);
    }
  }, [dnaDna, dnaResearch, dnaInstructions]);

  const analyze = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setPhase(0);

    const phaseInterval = setInterval(() => {
      setPhase((p) => (p < 3 ? p + 1 : p));
    }, 5000);

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
      setTab("preview");
      setPhase(4);
      loadHistory();
      // Auto-run deep scan in background after analyze completes
      setTimeout(() => { runDeepScan(); }, 800);
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
      loadHistory();
    } catch (e: any) {
      setDeepScanError(e.message || "Error en el escaneo profundo");
    } finally {
      setDeepScanLoading(false);
    }
  };

  const runSecretsScanner = async (htmlOverride?: string) => {
    const content = htmlOverride ?? secretsInput.trim();
    if (!content) return;
    setSecretsLoading(true);
    setSecretsError("");
    setSecretsReport(null);
    try {
      const res = await fetch(`${API_BASE}/api/web-lab/scan-secrets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ html: content, projectId, sourceUrl: url.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`);
      setSecretsReport(data);
      loadHistory();
    } catch (e: any) {
      setSecretsError(e.message || "Error en el análisis de secretos");
    } finally {
      setSecretsLoading(false);
    }
  };

  const runSecurityAudit = async (overrideHtml?: string, overrideUrl?: string) => {
    const html = overrideHtml ?? auditInput.trim();
    const targetUrl = overrideUrl ?? url.trim();
    if (!html && !targetUrl) return;
    setAuditLoading(true);
    setAuditError("");
    setAuditReport(null);
    setAuditCatFilter("all");
    setAuditExpandedId(null);
    try {
      const res = await fetch(`${API_BASE}/api/web-lab/security-audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ html: html || undefined, url: targetUrl || undefined, projectId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`);
      setAuditReport(data);
      loadHistory();
    } catch (e: any) {
      setAuditError(e.message || "Error en la auditoría de seguridad");
    } finally {
      setAuditLoading(false);
    }
  };

  const downloadSecretsReport = () => {
    if (!secretsReport) return;
    const { summary, secrets } = secretsReport;
    const sevColor: Record<string, string> = { critical: "#ef4444", high: "#f97316", medium: "#eab308" };
    const rows = secrets.map(s => `
      <tr style="border-bottom:1px solid #1a1a2e">
        <td style="padding:10px 12px"><span style="background:${sevColor[s.severity]||"#888"};color:#000;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700">${s.severity.toUpperCase()}</span></td>
        <td style="padding:10px 12px;font-weight:600">${s.service}</td>
        <td style="padding:10px 12px;font-size:12px">${s.type}</td>
        <td style="padding:10px 12px;font-family:monospace;font-size:11px;color:${sevColor[s.severity]||"#ef4444"}">${s.masked}</td>
        <td style="padding:10px 12px;font-size:11px">${s.lineNumber}</td>
        <td style="padding:10px 12px;font-size:11px;color:#22c55e">${s.recommendation}</td>
      </tr>`).join("");
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Informe de Seguridad — Shopy Crafter</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',sans-serif;background:#09090b;color:#e5e7eb;padding:40px 32px}
h1{font-size:28px;font-weight:800;color:#d4a843;margin-bottom:4px}p.sub{color:#888;font-size:13px;margin-bottom:32px}
.badge{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;font-weight:700;font-size:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px;margin-bottom:32px}
.card{background:#111;border-radius:10px;padding:16px;text-align:center}
.card .num{font-size:28px;font-weight:800}.card .lbl{font-size:11px;color:#888;margin-top:4px}
table{width:100%;border-collapse:collapse;background:#111;border-radius:12px;overflow:hidden}
th{background:#1a1a2e;padding:10px 12px;text-align:left;font-size:12px;color:#888;font-weight:600}
td{color:#e5e7eb;vertical-align:top}
.footer{margin-top:40px;text-align:center;font-size:11px;color:#555}</style></head>
<body>
<h1>🔐 Informe de Seguridad — Credenciales Expuestas</h1>
<p class="sub">Generado por Shopy Crafter · ${new Date(summary.scannedAt).toLocaleString("es-ES")} · ${(summary.contentLength/1024).toFixed(1)} KB analizados</p>
<div class="grid">
  <div class="card"><div class="num" style="color:${summary.riskScore>=70?"#22c55e":summary.riskScore>=40?"#eab308":"#ef4444"}">${summary.riskScore}</div><div class="lbl">Risk Score</div></div>
  <div class="card"><div class="num" style="color:${summary.total===0?"#22c55e":"#ef4444"}">${summary.total}</div><div class="lbl">Total Hallados</div></div>
  <div class="card"><div class="num" style="color:#ef4444">${summary.critical}</div><div class="lbl">🔴 Críticos</div></div>
  <div class="card"><div class="num" style="color:#f97316">${summary.high}</div><div class="lbl">🟠 Altos</div></div>
  <div class="card"><div class="num" style="color:#eab308">${summary.medium}</div><div class="lbl">🟡 Medios</div></div>
  <div class="card"><div class="num" style="color:#a78bfa">${summary.services.length}</div><div class="lbl">Servicios</div></div>
</div>
${secrets.length === 0
  ? '<div style="padding:32px;text-align:center;color:#22c55e;background:#0a1a0a;border-radius:12px;border:1px solid #22c55e33"><div style="font-size:40px;margin-bottom:8px">🛡️</div><div style="font-size:16px;font-weight:700">Sin credenciales expuestas detectadas</div></div>'
  : `<table><thead><tr><th>Severidad</th><th>Servicio</th><th>Tipo</th><th>Clave (enmascarada)</th><th>Línea</th><th>Acción recomendada</th></tr></thead><tbody>${rows}</tbody></table>`}
<div class="footer">Shopy Crafter — Escáner de Seguridad Avanzado · No compartas este informe públicamente</div>
</body></html>`;
    downloadFile(html, `informe-seguridad-${new Date().toISOString().slice(0,10)}.html`, "text/html");
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

    // ── Fallback when no HTML fragments are available ──────────────────────────
    if (!body.trim()) {
      const siteUrl = result?.url ?? "";
      if (mode === "original") {
        return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Página Original</title>
<style>*{box-sizing:border-box}body{margin:0;background:#0a0a0a;color:#eee;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:32px}</style>
</head><body><div style="max-width:500px;text-align:center">
<div style="font-size:48px;margin-bottom:16px">🌐</div>
<h2 style="color:#d4a843;margin:0 0 8px">Página Original</h2>
<p style="color:#888;margin:0 0 24px;line-height:1.6">El análisis no incluyó fragmentos HTML. Abre la URL directamente para ver la versión original.</p>
${siteUrl ? `<a href="${siteUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#d4a843,#b8860b);color:#000;font-weight:700;border-radius:10px;text-decoration:none;font-size:14px">↗ Abrir ${siteUrl}</a>` : ""}
</div></body></html>`;
      }
      // improved mode — show CSS with Shopify application guide
      const cssSnippet = css ? css.substring(0, 4000) + (css.length > 4000 ? "\n\n/* ... ver pestaña CSS para el código completo ... */" : "") : "";
      const escapedCss = cssSnippet.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>CSS Mejorado</title>
<style>*{box-sizing:border-box}body{margin:0;background:#0a0a0a;color:#eee;font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:24px}code{font-family:"JetBrains Mono","Fira Code",monospace}</style>
</head><body>
<div style="max-width:900px;margin:0 auto">
  <div style="background:#111;border:1px solid #d4a84333;border-radius:14px;padding:24px;margin-bottom:20px">
    <h2 style="color:#d4a843;margin:0 0 6px;font-size:18px">✅ CSS Optimizado Generado</h2>
    <p style="color:#888;margin:0;font-size:13px;line-height:1.6">El análisis generó CSS mejorado. Los fragmentos HTML individuales no están disponibles en esta sesión — activa el modo <strong style="color:#eee">Iteración</strong> para generar una versión completa de la página. Para aplicar solo el CSS:</p>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
    <div style="background:#111;border:1px solid #333;border-radius:10px;padding:16px">
      <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#888;margin-bottom:8px">Shopify Admin</div>
      <div style="font-size:12px;color:#ccc;line-height:1.6">Online Store → Themes → Edit code → <code style="color:#a78bfa">assets/custom.css</code> → Pega el CSS → Guardar</div>
    </div>
    <div style="background:#111;border:1px solid #333;border-radius:10px;padding:16px">
      <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#888;margin-bottom:8px">Sección Custom CSS</div>
      <div style="font-size:12px;color:#ccc;line-height:1.6">Customize → Theme Settings → Custom CSS → Pega el CSS → Save</div>
    </div>
    <div style="background:#111;border:1px solid #333;border-radius:10px;padding:16px">
      <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#888;margin-bottom:8px">Web Designer</div>
      <div style="font-size:12px;color:#ccc;line-height:1.6">Usa el botón <strong style="color:#d4a843">Editar y Guardar</strong> para abrir el CSS en el AI Web Designer y refinar el diseño</div>
    </div>
  </div>
  ${cssSnippet ? `<div style="background:#111;border:1px solid #333;border-radius:12px;overflow:hidden">
    <div style="padding:10px 16px;background:#0a0a0a;border-bottom:1px solid #333;font-size:11px;color:#888;font-weight:600">CSS MEJORADO — ${css.split("\n").length} líneas</div>
    <pre style="margin:0;padding:20px;font-size:11px;color:#93c5fd;overflow:auto;max-height:400px;line-height:1.6;white-space:pre-wrap"><code>${escapedCss}</code></pre>
  </div>` : `<div style="color:#888;text-align:center;padding:40px">No hay CSS generado para esta sesión.</div>`}
</div>
</body></html>`;
    }

    return `<!DOCTYPE html><html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<base target="_blank">
<title>Preview</title>
<style>${normalize}</style>
${css ? `<style>${css}</style>` : ""}
</head><body>
${body}
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
      {/* Header + mode tabs */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--gold, #d4a843)", marginBottom: 4, display: "flex", alignItems: "center", gap: 10 }}>
              🔬 Lab Web IA
            </h1>
            <p style={{ color: "var(--t2, #aaa)", fontSize: 14, margin: 0 }}>
              {labMode === "analysis"
                ? "Analiza cualquier página web y genera CSS/HTML mejorado con IA. Extrae el código real listo para tu equipo de desarrollo."
                : "26 demos premium de efectos visuales, Three.js, GSAP y UI Components — código vanilla listo para producción."}
            </p>
          </div>
          <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 4, border: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
            {([
              { id: "analysis", label: "🔬 Análisis Web", desc: "AI Lab" },
              { id: "demos", label: "🎨 Demo Library", desc: "26 efectos" },
            ] as const).map(m => (
              <button
                key={m.id}
                onClick={() => setLabMode(m.id)}
                style={{
                  padding: "8px 18px", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
                  background: labMode === m.id ? "linear-gradient(135deg, #d4a843, #b8860b)" : "transparent",
                  color: labMode === m.id ? "#000" : "var(--t2, #aaa)",
                  transition: "all 0.15s",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Demo Library mode */}
      {labMode === "demos" && <DemoLibrary />}

      {/* Analysis mode */}
      {labMode === "analysis" && <>

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
            onClick={() => navigate("/admin/web-designer")}
            title="Diseñador Web con IA — genera páginas completas con efectos 3D, GSAP, Three.js y más"
            style={{
              padding: "12px 16px",
              background: "transparent",
              border: "1px solid var(--border, #333)",
              borderRadius: 10,
              color: "var(--t2, #aaa)",
              cursor: "pointer",
              fontSize: 13,
              whiteSpace: "nowrap",
            }}
          >
            ✨ Crear desde cero
          </button>
          <button
            onClick={() => navigate("/admin/web-designer")}
            title="Diseñador Web con IA — Google Stitch, Claude, Gemini para páginas completas"
            style={{
              padding: "12px 16px",
              background: "transparent",
              border: "1px solid var(--border, #333)",
              borderRadius: 10,
              color: "var(--t2, #aaa)",
              cursor: "pointer",
              fontSize: 13,
              whiteSpace: "nowrap",
            }}
          >
            🪡 Stitch AI
          </button>
          <button
            onClick={() => {
              const next = !showDna;
              setShowDna(next);
              if (next && url.trim()) {
                analyzeDna(url.trim());
              }
            }}
            title="Extrae paleta, fuentes, tagline, CTA e investiga la marca en paralelo — genera un rediseño premium con Claude streaming"
            style={{
              padding: "12px 16px",
              background: showDna ? "linear-gradient(135deg, #22c55e, #16a34a)" : "transparent",
              border: showDna ? "none" : "1px solid var(--border, #333)",
              borderRadius: 10,
              color: showDna ? "#000" : "var(--t2, #aaa)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: showDna ? 700 : 400,
              whiteSpace: "nowrap",
            }}
          >
            🧬 Extractor DNA
          </button>
          <button
            onClick={() => {
              const next = !showSecrets;
              setShowSecrets(next);
              if (next && url.trim() && !auditReport && !auditLoading) {
                runSecurityAudit(undefined, url.trim());
              }
            }}
            title="Auditoría de seguridad completa: secretos, XSS, SQLi, CSRF, bugs, exposición de BD, escenarios de ataque"
            style={{
              padding: "12px 16px",
              background: showSecrets ? "linear-gradient(135deg, #ef4444, #7f1d1d)" : "transparent",
              border: showSecrets ? "none" : `1px solid ${auditReport && auditReport.stats.critical > 0 ? "#ef444466" : "var(--border, #333)"}`,
              borderRadius: 10,
              color: showSecrets ? "#fff" : auditReport && auditReport.stats.critical > 0 ? "#ef4444" : "var(--t2, #aaa)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: showSecrets ? 700 : 400,
              whiteSpace: "nowrap",
            }}
          >
            🔒 Auditoría Seguridad{auditReport ? ` (${auditReport.stats.total})` : ""}
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

      {showStitch && (
        <div style={{ background: "var(--card, #111)", borderRadius: 16, padding: 22, marginBottom: 24, border: "1px solid #1d4ed844" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 26, lineHeight: 1 }}>🪡</div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "#60a5fa" }}>Stitch AI — Generador de Páginas Profesionales</h3>
              <p style={{ fontSize: 12, color: "#888", marginTop: 4, marginBottom: 0 }}>
                Google Stitch genera HTML + Tailwind CSS completo desde tu descripción. Landing pages, product pages, about, pricing... listos para editar en el editor y guardar en la bóveda.
              </p>
            </div>
            {stitchStatus === "available" && (
              <span style={{ fontSize: 10, padding: "3px 8px", background: "#22c55e18", border: "1px solid #22c55e44", borderRadius: 6, color: "#22c55e", whiteSpace: "nowrap" }}>● Stitch conectado</span>
            )}
          </div>

          {stitchStatus === "unavailable" && (
            <div style={{ background: "#1a0a00", border: "1px solid #f59e0b44", borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 13, color: "#fbbf24" }}>
              ⚠ {stitchMsg || "Stitch no está configurado. Añade STITCH_API_KEY en los Secrets del proyecto."}<br />
              <span style={{ fontSize: 11, color: "#888", marginTop: 4, display: "block" }}>
                Obtén tu clave en <strong style={{ color: "#60a5fa" }}>stitch.withgoogle.com → Settings → API Keys</strong>
              </span>
            </div>
          )}

          {stitchStatus !== "unavailable" && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                {(["landing", "product", "about", "pricing", "contact"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setStitchPageType(t)}
                    style={{
                      padding: "5px 14px", fontSize: 12, borderRadius: 20, cursor: "pointer",
                      background: stitchPageType === t ? "#1d4ed8" : "#0a0a14",
                      border: stitchPageType === t ? "none" : "1px solid #1d4ed855",
                      color: stitchPageType === t ? "#fff" : "#60a5fa",
                      fontWeight: stitchPageType === t ? 600 : 400,
                    }}
                  >
                    {t === "landing" ? "🚀 Landing" : t === "product" ? "🛍️ Producto" : t === "about" ? "👤 About" : t === "pricing" ? "💰 Pricing" : "📬 Contacto"}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "#555", alignSelf: "center" }}>Plantillas rápidas:</span>
                {[
                  "Landing de moda lujo: hero vídeo full-screen, testimonios, galería producto, CTA dorado",
                  "Product page Shopify: galería zoom, descripción con bullets, reviews, upsell, sticky CTA",
                  "Pricing SaaS con 3 planes, tabla comparativa, FAQ, garantía y CTA urgencia",
                  "About storytelling: fundadores, misión, valores, línea de tiempo de marca",
                  "Landing ecommerce multimarca: filtros, grid productos, banner oferta, newsletter",
                ].map((t, i) => (
                  <button key={i} onClick={() => setStitchPrompt(t)} style={{ fontSize: 11, padding: "4px 10px", background: "#0a0a1a", border: "1px solid #1d4ed833", borderRadius: 6, color: "#60a5fa88", cursor: "pointer", textAlign: "left" }}>
                    {t.slice(0, 40)}…
                  </button>
                ))}
              </div>

              <textarea
                value={stitchPrompt}
                onChange={(e) => setStitchPrompt(e.target.value)}
                placeholder={`Describe la ${stitchPageType === "product" ? "página de producto" : stitchPageType === "landing" ? "landing page" : "página"}: producto, público objetivo, secciones, estilo visual, paleta de colores, tono, referencias de diseño…`}
                style={{
                  width: "100%", minHeight: 110, padding: 12,
                  background: "#0a0a14", border: "1px solid #1d4ed855", borderRadius: 10,
                  color: "#eee", fontSize: 13, resize: "vertical",
                  boxSizing: "border-box", outline: "none", marginBottom: 12,
                  fontFamily: "inherit",
                }}
              />

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  onClick={generateWithStitch}
                  disabled={stitchLoading || !stitchPrompt.trim()}
                  style={{
                    padding: "11px 26px",
                    background: stitchLoading || !stitchPrompt.trim() ? "#1a1a24" : "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                    border: "none", borderRadius: 10,
                    color: stitchLoading || !stitchPrompt.trim() ? "#444" : "#fff",
                    fontWeight: 700, cursor: stitchLoading || !stitchPrompt.trim() ? "not-allowed" : "pointer",
                    fontSize: 14,
                  }}
                >
                  {stitchLoading ? "⏳ Generando con Stitch…" : "🪡 Generar página con Stitch AI"}
                </button>
                {stitchProjectId && (
                  <span style={{ fontSize: 11, color: "#3b82f666" }}>Proyecto: {stitchProjectId.toString().slice(0, 12)}…</span>
                )}
                {stitchMsg && !stitchLoading && (
                  <span style={{
                    fontSize: 12,
                    color: stitchMsg.startsWith("✓") ? "#22c55e" : stitchMsg.startsWith("⚠") ? "#ef4444" : "#60a5fa",
                    maxWidth: 500,
                  }}>
                    {stitchMsg}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {showDna && (
        <div style={{ background: "var(--card, #111)", borderRadius: 16, padding: 22, marginBottom: 24, border: "1px solid #22c55e33" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 26, lineHeight: 1 }}>🧬</div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "#22c55e" }}>Extractor DNA — Análisis de Marca + Rediseño Claude</h3>
              <p style={{ fontSize: 12, color: "#888", marginTop: 4, marginBottom: 0 }}>
                Introduce la URL del cliente. Extraemos paleta, fuentes, tagline, CTA, redes sociales y sector — luego investigamos la marca en 9 fuentes paralelas y generamos un rediseño premium con Claude streaming.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <input
              type="url"
              value={dnaUrl}
              onChange={e => setDnaUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !dnaAnalyzing && analyzeDna()}
              placeholder="https://ejemplo.com"
              disabled={dnaAnalyzing}
              style={{
                flex: 1, minWidth: 260, padding: "10px 14px",
                background: "#0a0a0a", border: "1px solid #2a2a30", borderRadius: 10,
                color: "#eee", fontSize: 14, outline: "none",
              }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#888", cursor: "pointer", whiteSpace: "nowrap" }}>
              <input
                type="checkbox"
                checked={dnaDeep}
                onChange={e => setDnaDeep(e.target.checked)}
                disabled={dnaAnalyzing}
                style={{ accentColor: "#22c55e" }}
              />
              Investigación profunda
            </label>
            <button
              onClick={() => analyzeDna()}
              disabled={dnaAnalyzing || !dnaUrl.trim()}
              style={{
                padding: "10px 22px",
                background: dnaAnalyzing || !dnaUrl.trim() ? "#2a2a30" : "linear-gradient(135deg, #22c55e, #16a34a)",
                border: "none", borderRadius: 10, color: dnaAnalyzing || !dnaUrl.trim() ? "#666" : "#000",
                fontWeight: 700, cursor: dnaAnalyzing || !dnaUrl.trim() ? "not-allowed" : "pointer", fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >{dnaAnalyzing ? "⏳ Analizando…" : "⚡ Analizar y Extraer"}</button>
          </div>

          {dnaProgress.length > 0 && (
            <div style={{
              background: "#050508", border: "1px solid #1a1a2e", borderRadius: 10,
              padding: "12px 14px", marginBottom: 12, maxHeight: 180, overflowY: "auto",
              display: "flex", flexDirection: "column", gap: 4,
            }}>
              {dnaProgress.map((item, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12,
                  color: item.status === "error" ? "#ef4444" : item.status === "complete" ? "#22c55e" : item.status === "done" ? "#86efac" : item.status === "warn" ? "#eab308" : "#9ca3af",
                }}>
                  <span style={{ flexShrink: 0, marginTop: 1 }}>
                    {item.status === "error" ? "✕" : item.status === "complete" ? "✓" : item.status === "done" ? "✓" : item.status === "working" ? "◌" : "·"}
                  </span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          )}

          {(dnaDna || dnaResearch) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              {dnaDna && (
                <div style={{ background: "#050508", border: "1px solid #1a2a1a", borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#22c55e", marginBottom: 10 }}>🧬 DNA Extraído</div>
                  {dnaDna.name && <div style={{ marginBottom: 6 }}><span style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>Marca</span><div style={{ fontSize: 14, fontWeight: 700, color: "#eee", marginTop: 2 }}>{dnaDna.name}</div></div>}
                  {dnaDna.domain && <div style={{ marginBottom: 6 }}><span style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>Dominio</span><div style={{ fontSize: 12, fontFamily: "monospace", color: "#aaa", marginTop: 2 }}>{dnaDna.domain}</div></div>}
                  {dnaDna.sector && <div style={{ marginBottom: 6 }}><span style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>Sector</span><div style={{ marginTop: 4 }}><span style={{ fontSize: 11, padding: "2px 8px", background: "#22c55e22", border: "1px solid #22c55e55", borderRadius: 20, color: "#22c55e" }}>{dnaDna.sector}</span></div></div>}
                  {dnaDna.tagline && <div style={{ marginBottom: 6 }}><span style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>Tagline</span><div style={{ fontSize: 11, color: "#888", marginTop: 2, lineHeight: 1.4 }}>{dnaDna.tagline.slice(0, 120)}{dnaDna.tagline.length > 120 ? "…" : ""}</div></div>}
                  {dnaDna.palette?.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>Paleta</span>
                      <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                        {dnaDna.palette.map((c: string, i: number) => (
                          <div key={i} title={c} style={{ width: 28, height: 28, borderRadius: 6, background: c, border: "1px solid #333", flexShrink: 0 }} />
                        ))}
                      </div>
                    </div>
                  )}
                  {dnaDna.primary_font && <div style={{ marginBottom: 6 }}><span style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>Tipografía</span><div style={{ fontSize: 13, fontWeight: 600, color: "#d4a843", marginTop: 2 }}>{dnaDna.all_fonts?.join(", ") || dnaDna.primary_font}</div></div>}
                  {dnaDna.social_handles && Object.keys(dnaDna.social_handles).length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>Redes detectadas</span>
                      <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {Object.entries(dnaDna.social_handles).map(([plat, handle]) => (
                          <span key={plat} style={{ fontSize: 10, padding: "2px 8px", background: "#0a0a1a", border: "1px solid #333", borderRadius: 20, color: "#888" }}>{plat}: @{handle as string}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {dnaResearch && (
                <div style={{ background: "#050508", border: "1px solid #1a1a2a", borderRadius: 12, padding: 14, overflowY: "auto", maxHeight: 320 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#60a5fa", marginBottom: 10 }}>🔍 Investigación de Marca</div>
                  {Object.entries(dnaResearch).map(([k, v]: [string, any]) => {
                    if (!v || v.error) return null;
                    const label = k === "ddg_general" ? "DDG General" : k === "ddg_about" ? "DDG About" : k === "ddg_social" ? "DDG Social" : k === "ddg_reviews" ? "DDG Reviews" : k === "ddg_competitors" ? "DDG Competencia" : k.charAt(0).toUpperCase() + k.slice(1);
                    const color = ["instagram","tiktok","twitter","facebook","linkedin"].includes(k) ? "#a78bfa" : "#60a5fa";
                    const summary = v.abstract ? v.abstract.slice(0, 150) : (v.items || []).slice(0, 2).map((it: any) => it.snippet || it.text || "").filter(Boolean).join(" · ").slice(0, 200);
                    const extra = v.followers ? ` · ${v.followers} seguidores` : "";
                    if (!summary && !extra && !v.bio) return null;
                    return (
                      <div key={k} style={{ marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid #111" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>{label}{extra}</div>
                        {v.bio && <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.4, marginBottom: 2 }}>{v.bio.slice(0, 150)}</div>}
                        {summary && <div style={{ fontSize: 11, color: "#666", lineHeight: 1.4 }}>{summary}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {dnaDna && (
            <div style={{ marginBottom: dnaGenerated ? 12 : 0 }}>
              <textarea
                value={dnaInstructions}
                onChange={e => setDnaInstructions(e.target.value)}
                placeholder="Instrucciones opcionales para Claude: diseño dark premium, añadir sección de precios, usa Three.js hero, sector lujo…"
                rows={2}
                style={{
                  width: "100%", padding: "10px 14px",
                  background: "#0a0a0a", border: "1px solid #2a2a30", borderRadius: 10,
                  color: "#eee", fontSize: 12, resize: "vertical",
                  boxSizing: "border-box", outline: "none", fontFamily: "inherit", marginBottom: 10,
                }}
              />
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  onClick={generateDnaRedesign}
                  disabled={dnaGenerating}
                  style={{
                    padding: "10px 24px",
                    background: dnaGenerating ? "#2a2a30" : "linear-gradient(135deg, #d4a843, #b8860b)",
                    border: "none", borderRadius: 10, color: dnaGenerating ? "#666" : "#000",
                    fontWeight: 700, cursor: dnaGenerating ? "not-allowed" : "pointer", fontSize: 13, whiteSpace: "nowrap",
                  }}
                >{dnaGenerating ? "🔄 Generando…" : "🚀 Generar Rediseño"}</button>
                {dnaGenerated && (
                  <>
                    <button
                      onClick={() => { const b = new Blob([dnaGenerated], { type: "text/html" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `redesign-${dnaDna?.domain || "marca"}-${Date.now()}.html`; a.click(); }}
                      style={{ padding: "10px 16px", background: "#1a1a2e", border: "1px solid #333", borderRadius: 10, color: "#ccc", cursor: "pointer", fontSize: 12 }}
                    >⬇ Descargar HTML</button>
                    <button
                      onClick={() => { const url2 = "data:text/html;charset=utf-8;base64," + btoa(unescape(encodeURIComponent(dnaGenerated))); window.open(url2, "_blank", "noopener,noreferrer"); }}
                      style={{ padding: "10px 16px", background: "#1a1a2e", border: "1px solid #d4a84344", borderRadius: 10, color: "#d4a843", cursor: "pointer", fontSize: 12 }}
                    >↗ Abrir en pestaña</button>
                    <button
                      onClick={() => { setEditHtml(dnaGenerated); setEditCss(""); setEditLabel(`dna-redesign · ${dnaDna?.domain || "marca"}`); setTab("edit"); }}
                      style={{ padding: "10px 16px", background: "#0a2a0a", border: "1px solid #22c55e44", borderRadius: 10, color: "#22c55e", cursor: "pointer", fontSize: 12 }}
                    >✏ Abrir en Editor</button>
                  </>
                )}
                {dnaGenStatus && (
                  <span style={{ fontSize: 12, color: dnaGenStatus.startsWith("✓") ? "#22c55e" : dnaGenStatus.startsWith("⚠") ? "#ef4444" : "#888" }}>{dnaGenStatus}</span>
                )}
              </div>
            </div>
          )}

          {dnaGenerated && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: dnaGenerating ? "#eab308" : "#22c55e", animation: dnaGenerating ? "pulse 1.2s infinite" : "none" }} />
                {dnaGenerating ? `Generando… ${Math.round(dnaGenerated.length / 1024)}KB recibidos` : `✓ ${Math.round(dnaGenerated.length / 1024)}KB generados`}
              </div>
              <iframe
                sandbox="allow-scripts"
                title="Preview del rediseño generado"
                style={{ width: "100%", height: 540, border: "1px solid #22c55e22", borderRadius: 12, background: "#fff" }}
                srcDoc={dnaGenerated}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Auditoría de Seguridad Completa ─────────────────── */}
      {showSecrets && (
        <div style={{ background: "var(--card, #111)", borderRadius: 16, padding: 24, marginBottom: 24, border: "1px solid #ef444433" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", border: `4px solid ${auditReport ? (auditReport.secScore >= 70 ? "#22c55e" : auditReport.secScore >= 40 ? "#eab308" : "#ef4444") : "#ef4444"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {auditLoading
                ? <span style={{ fontSize: 28, animation: "pulse 1s infinite" }}>🔍</span>
                : <span style={{ fontSize: 22, fontWeight: 800, color: auditReport ? (auditReport.secScore >= 70 ? "#22c55e" : auditReport.secScore >= 40 ? "#eab308" : "#ef4444") : "#ef4444" }}>{auditReport ? auditReport.secScore : "?"}</span>
              }
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: "#fca5a5" }}>🔒 Auditoría de Seguridad Completa</h3>
              <p style={{ color: "#888", fontSize: 12, margin: "4px 0 8px" }}>
                8 categorías de análisis: secretos, XSS, SQL/NoSQL injection, CSRF, bugs de código, exposición de BD, datos sensibles e infraestructura. Incluye escenarios de ataque reales y pasos de corrección.
              </p>
              {auditReport && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { label: `${auditReport.stats.critical} Críticos`, color: "#ef4444", show: auditReport.stats.critical > 0 },
                    { label: `${auditReport.stats.high} Altos`, color: "#f97316", show: auditReport.stats.high > 0 },
                    { label: `${auditReport.stats.medium} Medios`, color: "#eab308", show: auditReport.stats.medium > 0 },
                    { label: `DB Risk: ${auditReport.dbRisk.toUpperCase()}`, color: auditReport.dbRisk === "critical" ? "#ef4444" : auditReport.dbRisk === "high" ? "#f97316" : auditReport.dbRisk === "medium" ? "#eab308" : "#22c55e", show: true },
                    { label: `${(auditReport.contentLength / 1024).toFixed(0)} KB analizados`, color: "#60a5fa", show: true },
                  ].filter(b => b.show).map((b, i) => (
                    <span key={i} style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: b.color + "22", color: b.color, border: `1px solid ${b.color}44` }}>{b.label}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Input manual + botones */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <textarea
              value={auditInput}
              onChange={e => setAuditInput(e.target.value)}
              placeholder={url.trim() ? `URL detectada: ${url} — pulsa Analizar para auditar automáticamente.\n\nO pega aquí HTML/JS adicional para analizar junto a la URL…` : "Pega aquí el HTML, JS minificado, bundle.js, theme.liquid o cualquier código fuente a auditar.\n\nEl auditor detecta: secretos hardcodeados · XSS (innerHTML, eval) · SQL injection · CSRF · bugs de código · exposición de BD · datos sensibles · infraestructura interna…"}
              rows={5}
              style={{ width: "100%", padding: "12px 14px", background: "#0a0a0a", border: "1px solid #2a2a30", borderRadius: 10, color: "#eee", fontSize: 12, resize: "vertical", lineHeight: 1.5, boxSizing: "border-box", outline: "none", fontFamily: "monospace" }}
            />
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button
                onClick={() => runSecurityAudit()}
                disabled={auditLoading || (!auditInput.trim() && !url.trim())}
                style={{ padding: "10px 22px", background: auditLoading ? "#2a2a30" : "linear-gradient(135deg, #ef4444, #7f1d1d)", border: "none", borderRadius: 10, color: auditLoading ? "#666" : "#fff", fontWeight: 700, cursor: auditLoading ? "not-allowed" : "pointer", fontSize: 13, whiteSpace: "nowrap" }}
              >
                {auditLoading ? "🔍 Auditando…" : "🔒 Analizar Seguridad"}
              </button>
              {url.trim() && (
                <span style={{ fontSize: 11, color: "#888" }}>🌐 Se analizará: <strong style={{ color: "#d4a843" }}>{url.slice(0, 60)}</strong>{url.length > 60 ? "…" : ""} + JS bundles</span>
              )}
              {auditInput.trim() && (
                <span style={{ fontSize: 11, color: "#666" }}>{(auditInput.length / 1024).toFixed(1)} KB pegados</span>
              )}
            </div>
            {auditError && (
              <div style={{ padding: "10px 14px", background: "#2a0000", border: "1px solid #4a1111", borderRadius: 8, color: "#fca5a5", fontSize: 12 }}>❌ {auditError}</div>
            )}
          </div>

          {/* Resultados */}
          {auditLoading && (
            <div style={{ marginTop: 24, padding: 24, background: "#0a0a14", borderRadius: 12, textAlign: "center", border: "1px solid #ef444422" }}>
              <div style={{ fontSize: 32, marginBottom: 8, animation: "pulse 1.5s infinite" }}>🔍</div>
              <p style={{ color: "#fca5a5", fontWeight: 700, margin: "0 0 4px" }}>Auditando seguridad…</p>
              <p style={{ color: "#888", fontSize: 12 }}>Descargando código fuente, analizando 8 categorías de vulnerabilidades y generando escenarios de ataque</p>
            </div>
          )}

          {auditReport && !auditLoading && (
            <div style={{ marginTop: 24 }}>
              {/* Resumen por categoría */}
              {auditReport.stats.total === 0 ? (
                <div style={{ padding: 24, background: "#0a1a0a", borderRadius: 12, border: "1px solid #22c55e33", textAlign: "center" }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
                  <p style={{ color: "#22c55e", fontWeight: 700, fontSize: 16, margin: "0 0 4px" }}>Sin vulnerabilidades detectadas</p>
                  <p style={{ color: "#888", fontSize: 12 }}>No se encontraron patrones de riesgo conocidos en el código analizado.</p>
                </div>
              ) : (
                <>
                  {/* Filtro por categoría */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                    <button onClick={() => setAuditCatFilter("all")} style={{ padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, border: "1px solid #444", background: auditCatFilter === "all" ? "#ef4444" : "transparent", color: auditCatFilter === "all" ? "#fff" : "#888", cursor: "pointer" }}>
                      Todos ({auditReport.stats.total})
                    </button>
                    {auditReport.categories.map(cat => {
                      const count = auditReport.findings.filter(f => f.category === cat).length;
                      const hasCrit = auditReport.findings.some(f => f.category === cat && f.severity === "critical");
                      return (
                        <button key={cat} onClick={() => setAuditCatFilter(cat)} style={{ padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, border: `1px solid ${hasCrit ? "#ef444466" : "#333"}`, background: auditCatFilter === cat ? (hasCrit ? "#ef4444" : "#333") : "transparent", color: auditCatFilter === cat ? "#fff" : hasCrit ? "#fca5a5" : "#888", cursor: "pointer" }}>
                          {cat} ({count})
                        </button>
                      );
                    })}
                  </div>

                  {/* Cards de hallazgos */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {auditReport.findings.filter(f => auditCatFilter === "all" || f.category === auditCatFilter).map(f => {
                      const sevColor = { critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#22c55e", info: "#60a5fa" }[f.severity] || "#888";
                      const isExpanded = auditExpandedId === f.id;
                      return (
                        <div key={f.id} style={{ background: "#0a0a14", borderRadius: 12, border: `1px solid ${sevColor}33`, borderLeft: `4px solid ${sevColor}`, overflow: "hidden" }}>
                          {/* Cabecera clickable */}
                          <div
                            onClick={() => setAuditExpandedId(isExpanded ? null : f.id)}
                            style={{ padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 12 }}
                          >
                            <div style={{ flexShrink: 0, marginTop: 2 }}>
                              <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 800, background: sevColor + "22", color: sevColor, textTransform: "uppercase", letterSpacing: "0.5px" }}>{f.severity}</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 10, color: "#666" }}>{f.category}</span>
                                {f.cvss && <span style={{ fontSize: 10, color: sevColor, fontWeight: 700 }}>CVSS {f.cvss}</span>}
                                {f.lineNumber && <span style={{ fontSize: 10, color: "#555" }}>línea {f.lineNumber}</span>}
                              </div>
                              <p style={{ fontSize: 13, fontWeight: 700, color: "#eee", margin: "2px 0 0" }}>{f.title}</p>
                              <p style={{ fontSize: 11, color: "#888", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.description}</p>
                            </div>
                            <span style={{ color: "#555", fontSize: 14, flexShrink: 0 }}>{isExpanded ? "▲" : "▼"}</span>
                          </div>

                          {/* Detalle expandible */}
                          {isExpanded && (
                            <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${sevColor}22` }}>
                              {/* Evidencia */}
                              <div style={{ marginTop: 12 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>Evidencia en código</span>
                                <pre style={{ background: "#050505", borderRadius: 6, padding: "8px 12px", fontSize: 11, color: "#f87171", fontFamily: "monospace", margin: "4px 0 0", overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{f.evidence}</pre>
                              </div>

                              {/* Escenario de ataque */}
                              <div style={{ marginTop: 12, background: "#1a0d2e", borderRadius: 8, padding: "10px 14px" }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: "#c084fc", textTransform: "uppercase", letterSpacing: "0.5px" }}>⚔️ Escenario de ataque real</span>
                                <p style={{ fontSize: 12, color: "#e9d5ff", margin: "6px 0 0", lineHeight: 1.6 }}>{f.attackScenario}</p>
                              </div>

                              {/* Impacto en BD */}
                              {f.dbImpact && (
                                <div style={{ marginTop: 10, background: "#1a0000", borderRadius: 8, padding: "10px 14px", border: "1px solid #ef444433" }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: "#f87171", textTransform: "uppercase", letterSpacing: "0.5px" }}>🗄️ Impacto en base de datos</span>
                                  <p style={{ fontSize: 12, color: "#fca5a5", margin: "6px 0 0", lineHeight: 1.6 }}>{f.dbImpact}</p>
                                </div>
                              )}

                              {/* Fix */}
                              <div style={{ marginTop: 10, background: "#0a1a0a", borderRadius: 8, padding: "10px 14px" }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: "#4ade80", textTransform: "uppercase", letterSpacing: "0.5px" }}>💡 Cómo corregirlo</span>
                                <p style={{ fontSize: 12, color: "#86efac", margin: "6px 0 0", lineHeight: 1.6 }}>{f.fix}</p>
                              </div>

                              {/* Fix Code snippet */}
                              {f.fixCode && (
                                <div style={{ marginTop: 8 }}>
                                  <pre style={{ background: "#0d1117", borderRadius: 8, padding: "10px 14px", fontSize: 11, color: "#86efac", fontFamily: "monospace", margin: 0, overflow: "auto", lineHeight: 1.6 }}>{f.fixCode}</pre>
                                </div>
                              )}

                              {/* Contexto experto: MITRE ATT&CK / NIST CSF / skills relacionadas (catálogo cybersec) */}
                              {(f.mitreAttack?.length || f.nistCsf?.length || f.relatedSkills?.length) ? (
                                <div style={{ marginTop: 10, background: "#0d0d14", border: "1px solid #333", borderRadius: 8, padding: "10px 14px" }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: "#93c5fd", textTransform: "uppercase", letterSpacing: "0.5px" }}>🧠 Contexto experto (catálogo de 817 skills)</span>
                                  {f.mitreAttack && f.mitreAttack.length > 0 && (
                                    <p style={{ fontSize: 11, color: "#bfdbfe", margin: "6px 0 0", lineHeight: 1.6 }}>
                                      🎯 <b>MITRE ATT&CK:</b> {f.mitreAttack.join(", ")}
                                    </p>
                                  )}
                                  {f.nistCsf && f.nistCsf.length > 0 && (
                                    <p style={{ fontSize: 11, color: "#bfdbfe", margin: "4px 0 0", lineHeight: 1.6 }}>
                                      📋 <b>NIST CSF:</b> {f.nistCsf.join(", ")}
                                    </p>
                                  )}
                                  {f.relatedSkills && f.relatedSkills.length > 0 && (
                                    <p style={{ fontSize: 11, color: "#bfdbfe", margin: "4px 0 0", lineHeight: 1.6 }}>
                                      🔗 <b>Skills relacionadas:</b> {f.relatedSkills.map(s => s.name).join(", ")}
                                    </p>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Resumen de riesgo BD */}
                  {auditReport.findings.some(f => f.dbImpact) && (
                    <div style={{ marginTop: 20, padding: "16px 20px", background: auditReport.dbRisk === "critical" ? "#1a000033" : "#0a1a0a", border: `1px solid ${auditReport.dbRisk === "critical" ? "#ef4444" : auditReport.dbRisk === "high" ? "#f97316" : "#eab308"}66`, borderRadius: 12 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 700, color: auditReport.dbRisk === "critical" ? "#ef4444" : auditReport.dbRisk === "high" ? "#f97316" : "#eab308", margin: "0 0 8px" }}>
                        🗄️ Evaluación de Compromiso de Base de Datos — Riesgo {auditReport.dbRisk.toUpperCase()}
                      </h4>
                      <p style={{ fontSize: 12, color: "#aaa", margin: 0, lineHeight: 1.7 }}>
                        {auditReport.dbRisk === "critical"
                          ? "⚠️ RIESGO CRÍTICO: Se detectaron credenciales de BD o vectores de SQL injection que en caso de explotación darían al atacante acceso completo a la base de datos. Posibles consecuencias: robo de todos los datos de usuarios, modificación de pedidos/precios, creación de usuarios administradores, borrado masivo (ransomware), exfiltración de datos privados y PII. PRIORIDAD MÁXIMA: corregir de inmediato."
                          : auditReport.dbRisk === "high"
                          ? "⚠️ RIESGO ALTO: Vectores detectados que podrían comprometer la BD indirectamente. Un atacante con acceso al servidor podría pivotar hacia la BD. Corregir los hallazgos 'high' relacionados con BD urgentemente."
                          : "⚠️ RIESGO MEDIO: Información de infraestructura expuesta que facilita el reconocimiento previo a un ataque. No hay acceso directo a BD, pero reduce significativamente el esfuerzo del atacante."}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
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

                {result.pageSpeed && (() => {
                  const ps = result.pageSpeed!;
                  return (
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>⚡ PageSpeed Insights (Google)</h3>

                    {/* Scores móvil vs escritorio */}
                    {(["mobile", "desktop"] as const).map(dev => (
                      ps[dev] && (
                        <div key={dev} style={{ marginBottom: 14 }}>
                          <p style={{ fontSize: 12, color: "#888", margin: "0 0 6px" }}>{dev === "mobile" ? "📱 Móvil" : "🖥️ Escritorio"}</p>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
                            {Object.entries(ps[dev] || {}).map(([k, v]) => (
                              <div key={k} style={{ background: "#0a0a14", padding: 10, borderRadius: 8, textAlign: "center" }}>
                                <div style={{ fontSize: 22, fontWeight: 700, color: scoreColor(v as number) }}>{v as number}</div>
                                <div style={{ fontSize: 11, color: "#888" }}>{k}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    ))}

                    {/* Core Web Vitals con estado real */}
                    {ps.coreWebVitals && (
                      <div style={{ marginBottom: 18 }}>
                        <h4 style={{ fontSize: 13, fontWeight: 700, color: "#d4a843", margin: "0 0 8px" }}>Core Web Vitals</h4>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
                          {[
                            { key: "lcp", label: "LCP", unit: "s" },
                            { key: "cls", label: "CLS", unit: "" },
                            { key: "inp", label: "INP", unit: "ms" },
                            { key: "fcp", label: "FCP", unit: "s" },
                            { key: "tbt", label: "TBT", unit: "ms" },
                            { key: "si", label: "Speed Index", unit: "s" },
                          ].map(({ key, label, unit }) => {
                            const cwv = ps.coreWebVitals?.[key];
                            if (!cwv || cwv.value == null) return null;
                            const color = cwv.status === "good" ? "#22c55e" : cwv.status === "needs-improvement" ? "#eab308" : "#ef4444";
                            return (
                              <div key={key} style={{ background: "#0a0a14", padding: "10px 12px", borderRadius: 8, border: `1px solid ${color}33` }}>
                                <div style={{ fontSize: 11, color: "#888" }}>{label}</div>
                                <div style={{ fontSize: 18, fontWeight: 800, color }}>{cwv.value}{unit}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Diagnósticos / oportunidades reales con ahorros estimados */}
                    <PsiDiagnosticsList list={ps.diagnostics} device="móvil" />
                    <PsiDiagnosticsList list={ps.diagnosticsDesktop} device="escritorio" />
                  </div>
                  );
                })()}

                {/* ── Analytics & Tracking Detection ─────────────────────────── */}
                {result.analyticsDetection && (
                  <div style={{ marginTop: 28 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>📊 Herramientas de Analytics Detectadas</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
                      {[
                        { label: "Google Analytics 4", key: "hasGoogleAnalytics", icon: "📈" },
                        { label: "Google Tag Manager", key: "hasGTM", icon: "🏷️" },
                        { label: "Meta Pixel", key: "hasFbPixel", icon: "📘" },
                        { label: "TikTok Pixel", key: "hasTikTokPixel", icon: "🎵" },
                        { label: "Pinterest Tag", key: "hasPinterest", icon: "📌" },
                        { label: "Hotjar", key: "hasHotjar", icon: "🔥" },
                        { label: "Banner de Cookies", key: "hasCookieBanner", icon: "🍪" },
                        { label: "Chat Widget", key: "hasChatWidget", icon: "💬" },
                      ].map(({ label, key, icon }) => {
                        const active = result.analyticsDetection![key as keyof typeof result.analyticsDetection];
                        return (
                          <div key={key} style={{
                            background: active ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.03)",
                            border: `1px solid ${active ? "#22c55e33" : "#33333355"}`,
                            borderRadius: 10, padding: "10px 14px",
                            display: "flex", alignItems: "center", gap: 8,
                          }}>
                            <span style={{ fontSize: 18 }}>{icon}</span>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: active ? "#22c55e" : "#666" }}>{label}</div>
                              <div style={{ fontSize: 11, color: active ? "#22c55e99" : "#555" }}>{active ? "Detectado ✓" : "No encontrado"}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Google Reviews / Reputación Online ─────────────────────── */}
                {result.googleReviews && (
                  <div style={{ marginTop: 28 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>⭐ Reputación Online & Reseñas</h3>
                    <div style={{ background: "#0a0a14", borderRadius: 12, padding: 18, border: "1px solid #2a2a3e" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10, marginBottom: 16 }}>
                        {[
                          { label: "Google Rating", value: result.googleReviews.googleRating != null ? `${result.googleReviews.googleRating} ⭐` : "N/D", color: "#fbbf24" },
                          { label: "Google Reviews", value: result.googleReviews.googleReviewCount != null ? result.googleReviews.googleReviewCount : "N/D", color: "#fbbf24" },
                          { label: "Trustpilot", value: result.googleReviews.trustpilotRating != null ? `${result.googleReviews.trustpilotRating} ⭐` : "N/D", color: "#00b67a" },
                          { label: "Sentimiento", value: result.googleReviews.overallSentiment ?? "—", color: result.googleReviews.overallSentiment === "positive" ? "#22c55e" : result.googleReviews.overallSentiment === "negative" ? "#ef4444" : "#eab308" },
                        ].map((m, i) => (
                          <div key={i} style={{ background: "#111", borderRadius: 8, padding: 12, textAlign: "center", border: "1px solid #222" }}>
                            <div style={{ fontSize: 18, fontWeight: 700, color: m.color }}>{String(m.value)}</div>
                            <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{m.label}</div>
                          </div>
                        ))}
                      </div>
                      {Array.isArray(result.googleReviews.keyPraises) && (result.googleReviews.keyPraises as string[]).length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 12, color: "#22c55e", fontWeight: 600, marginBottom: 4 }}>✅ Puntos fuertes</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {(result.googleReviews.keyPraises as string[]).map((p, i) => (
                              <span key={i} style={{ background: "#22c55e10", color: "#22c55e", border: "1px solid #22c55e25", borderRadius: 6, padding: "2px 8px", fontSize: 11 }}>{p}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {Array.isArray(result.googleReviews.keyComplaints) && (result.googleReviews.keyComplaints as string[]).length > 0 && (
                        <div>
                          <div style={{ fontSize: 12, color: "#ef4444", fontWeight: 600, marginBottom: 4 }}>⚠️ Quejas frecuentes</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {(result.googleReviews.keyComplaints as string[]).map((c, i) => (
                              <span key={i} style={{ background: "#ef444410", color: "#ef4444", border: "1px solid #ef444425", borderRadius: 6, padding: "2px 8px", fontSize: 11 }}>{c}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Posicionamiento SERP Real ───────────────────────────────── */}
                {result.serpPositioning?.text && (
                  <div style={{ marginTop: 28 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>🔍 Posicionamiento Real en Google (SERP)</h3>
                    <div style={{ background: "#0a0a14", borderRadius: 12, padding: 18, border: "1px solid #2a2a3e" }}>
                      <p style={{ fontSize: 13, color: "#ccc", lineHeight: 1.7, marginBottom: 12 }}>{result.serpPositioning.text}</p>
                      {result.serpPositioning.sources && result.serpPositioning.sources.length > 0 && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {result.serpPositioning.sources.slice(0, 6).map((s, i) => (
                            <a key={i} href={s} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#d4a843", textDecoration: "none" }}>
                              {s.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                            </a>
                          ))}
                        </div>
                      )}
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
                        const siteUrl = result?.url || url || "";
                        let origin = "";
                        try { origin = new URL(siteUrl).origin + "/"; } catch {}
                        const fragments = (a.improvedHtmlFragments || []).map((f: any) => f.improved).join("\n");
                        const hasFragments = fragments.trim().length > 0;
                        const dateStr = new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });
                        const bannerCss = `
.sc-banner{position:fixed;top:0;left:0;right:0;z-index:99999;background:linear-gradient(135deg,#080812 0%,#10102a 100%);border-bottom:2px solid #d4a843;padding:9px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;box-shadow:0 2px 24px rgba(0,0,0,0.7);transition:transform 0.3s ease}
.sc-banner.hidden{transform:translateY(-100%)}
.sc-banner-logo{font-size:13px;font-weight:800;background:linear-gradient(135deg,#d4a843,#f0c060);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:-0.3px;white-space:nowrap}
.sc-banner-meta{font-size:10px;color:#666;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px}
.sc-banner-cta{padding:5px 14px;background:linear-gradient(135deg,#d4a843,#b8860b);color:#000;font-weight:700;font-size:11px;border:none;border-radius:6px;cursor:pointer;font-family:inherit;text-decoration:none;white-space:nowrap;flex-shrink:0}
.sc-banner-close{background:none;border:1px solid #333;color:#666;font-size:12px;padding:3px 8px;border-radius:4px;cursor:pointer;flex-shrink:0;line-height:1}
body{margin:0;padding-top:${hasFragments ? "48px" : "0"}!important;min-height:100vh}`;
                        const bannerHtml = `<div class="sc-banner" id="sc-banner">
  <div style="display:flex;align-items:center;gap:10px;min-width:0">
    <span class="sc-banner-logo">⚡ Shopy Crafter</span>
    <span style="color:#444;font-size:12px;flex-shrink:0">|</span>
    <span class="sc-banner-meta">Preview Rediseño · ${siteUrl || "Tu tienda"} · ${dateStr}</span>
  </div>
  <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
    <a href="https://shopycrafter.com" target="_blank" rel="noopener" class="sc-banner-cta">Ver plataforma →</a>
    <button class="sc-banner-close" onclick="document.getElementById('sc-banner').classList.toggle('hidden')" title="Ocultar banner">✕</button>
  </div>
</div>`;
                        const noFragmentsBody = `<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f8f8;text-align:center">
  <div style="max-width:560px">
    <div style="font-size:48px;margin-bottom:16px">🎨</div>
    <h1 style="font-size:22px;font-weight:800;margin:0 0 8px;color:#111">CSS Mejorado Listo</h1>
    <p style="font-size:14px;color:#666;line-height:1.7;margin:0 0 28px">Este archivo contiene el CSS optimizado para tu tienda Shopify.<br>Ábrelo en un navegador para ver el código, o aplícalo en tu tienda.</p>
    ${siteUrl ? `<a href="${siteUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#d4a843,#b8860b);color:#000;font-weight:700;font-size:14px;border-radius:10px;text-decoration:none;margin-bottom:16px">↗ Abrir tienda original</a><br>` : ""}
    <p style="font-size:12px;color:#999;margin-top:20px">Para aplicar el CSS: Shopify Admin → Tienda Online → Temas → Editar código → assets/custom.css</p>
  </div>
  <details style="margin-top:40px;width:100%;max-width:800px;text-align:left">
    <summary style="cursor:pointer;font-size:13px;font-weight:600;color:#d4a843;padding:12px 16px;background:#111;border-radius:8px;list-style:none">▸ Ver CSS mejorado completo</summary>
    <pre style="background:#0d1117;color:#c9d1d9;padding:24px;border-radius:0 0 8px 8px;overflow:auto;font-size:12px;line-height:1.6;margin:0;white-space:pre-wrap;word-break:break-word"><code>/* CSS MEJORADO POR SHOPY CRAFTER — ${dateStr} */\n/* Fuente: ${siteUrl} */\n\n</code></pre>
  </details>
</div>`;
                        const fullHtml = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Preview Rediseño${siteUrl ? " — " + siteUrl : ""}</title>
<meta name="description" content="Preview de rediseño visual generado por Shopy Crafter">
${origin ? `<base href="${origin}">` : ""}
<style>
/* ── Reset ──────────────────────────────────────────── */
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
img,video{max-width:100%;height:auto}
a{color:inherit}
h1,h2,h3,h4,h5,h6{margin:.5em 0;line-height:1.2}
p{margin:.5em 0}
button,input,select,textarea{font:inherit}

/* ── Banner Shopy Crafter ───────────────────────────── */
${bannerCss}

/* ── CSS Mejorado ───────────────────────────────────── */
${a.improvedCss}
</style>
</head>
<body>
${bannerHtml}
${hasFragments ? fragments : noFragmentsBody}
</body>
</html>`;
                        const filename = `preview-rediseno-${(siteUrl || "pagina").replace(/https?:\/\//,"").replace(/[^a-z0-9]/gi,"-").slice(0,30)}-${new Date().toISOString().slice(0,10)}.html`;
                        downloadFile(fullHtml, filename, "text/html");
                      }}
                      style={{
                        padding: "8px 16px",
                        background: "linear-gradient(135deg, rgba(212,168,67,0.15), rgba(212,168,67,0.08))",
                        border: "1px solid rgba(212,168,67,0.5)",
                        borderRadius: 8, color: "#d4a843",
                        cursor: "pointer", fontSize: 13, fontWeight: 600,
                        display: "flex", alignItems: "center", gap: 6,
                      }}
                    >
                      🚀 HTML Completo (enviar cliente)
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
                        const siteUrl2 = result?.url || url || "";
                        let origin2 = "";
                        try { origin2 = new URL(siteUrl2).origin + "/"; } catch {}
                        const frags = (a.improvedHtmlFragments || []).map((f: any) => `<!-- ${f.section} -->\n${f.improved}`).join("\n\n");
                        const fullDoc = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>HTML Mejorado${siteUrl2 ? " — " + siteUrl2 : ""}</title>
${origin2 ? `<base href="${origin2}">` : ""}
<style>
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.5;color:#1a1a1a;background:#fff}
img,video{max-width:100%;height:auto}
a{color:inherit}
h1,h2,h3,h4,h5,h6{margin:.5em 0;line-height:1.2}
p{margin:.5em 0}
button,input,select,textarea{font:inherit}
/* CSS Mejorado */
${a.improvedCss || ""}
</style>
</head>
<body>
${frags || "<!-- Sin fragmentos HTML generados -->"}
</body>
</html>`;
                        downloadFile(fullDoc, `html-mejorado-${new Date().toISOString().slice(0,10)}.html`, "text/html");
                      }}
                      style={{
                        padding: "8px 16px",
                        background: "linear-gradient(135deg, rgba(212,168,67,0.12), rgba(212,168,67,0.06))",
                        border: "1px solid rgba(212,168,67,0.4)",
                        borderRadius: 8, color: "#d4a843",
                        cursor: "pointer", fontSize: 13, fontWeight: 600,
                      }}
                    >
                      🚀 HTML + CSS completo
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

      </> /* end analysis mode */ }
    </div>
  );
}

// ── Demo Library ─────────────────────────────────────────────────────────────

const WEB_DEMOS = [
  { num:"01", file:"01-particle-saas.html", title:"Particle SaaS Landing", desc:"Hero con sistema de partículas WebGL, animaciones de entrada y secciones de producto.", badge:"3d", badgeLabel:"3D", tags:["Three.js","Particles","Hero","SaaS"], lines:"~900", cats:["3d","landing","effects"], thumb:"https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=700&q=75" },
  { num:"02", file:"02-cinematic-agency.html", title:"Cinematic Agency", desc:"Landing de agencia con efectos cinematográficos, tipografía animada y reveal de secciones.", badge:"fx", badgeLabel:"FX", tags:["GSAP","Cinema","Agency","Reveal"], lines:"~1100", cats:["landing","effects","scroll"], thumb:"https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=700&q=75" },
  { num:"03", file:"03-glass-product-3d.html", title:"Glass Product 3D", desc:"Producto en 3D con material glass/liquid, iluminación dinámica y orbit controls.", badge:"3d", badgeLabel:"3D", tags:["Three.js","Glass","MeshPhysical","Product"], lines:"~850", cats:["3d","effects"], thumb:"https://images.unsplash.com/photo-1633356122102-3fe601e05bd2?w=700&q=75" },
  { num:"04", file:"04-disassembly-scroll.html", title:"GSAP Disassembly Scroll", desc:"Explosión de producto en scroll. 500vh sticky section con ScrollTrigger, ripple shader y export a landing.", badge:"new", badgeLabel:"NEW", tags:["GSAP","ScrollTrigger","Explode","Shader"], lines:"1091", cats:["3d","scroll","effects"], thumb:"https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=700&q=75" },
  { num:"05", file:"05-21stdev-effects.html", title:"21st.dev Effects (8 bloques)", desc:"Aurora, Lamp, Container Scroll, Chatbot, Text Effects, Spotlight Cards, Bento, Sticky Scroll y más.", badge:"hot", badgeLabel:"HOT", tags:["Aurora","Chatbot","Scramble","Bento","Gooey"], lines:"1747", cats:["effects","ui","landing","3d"], thumb:"https://images.unsplash.com/photo-1579547621113-e4bb2a19bdd6?w=700&q=75" },
  { num:"06", file:"06-shaders-particles.html", title:"Shaders & Particles", desc:"Plasma GLSL (FBM 5 octavas), Galaxia espiral 8k puntos, DNA Helix, Holographic Card, Matrix Rain, Blob Morph.", badge:"3d", badgeLabel:"3D", tags:["GLSL","Galaxy","DNA","Matrix","WebGL"], lines:"982", cats:["3d","effects"], thumb:"https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=700&q=75" },
  { num:"07", file:"07-landing-sections.html", title:"Landing Sections Completas", desc:"Pricing toggle animado, Testimonials marquee doble fila, Stats count-up, FAQ accordion, Logo strip, CTA partículas.", badge:"new", badgeLabel:"NEW", tags:["Pricing","Marquee","CountUp","FAQ","CTA"], lines:"~1250", cats:["landing","ui"], thumb:"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=700&q=75" },
  { num:"08", file:"08-micro-interactions.html", title:"Micro-interactions & UI", desc:"Toast system, Skeleton loading, Toggles, Progress wizard, Tooltips, Confetti, Search bar, Drag-to-reorder.", badge:"ui", badgeLabel:"UI", tags:["Toast","Skeleton","Tooltip","Confetti","Drag"], lines:"~1300", cats:["ui","effects"], thumb:"https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=700&q=75" },
  { num:"09", file:"09-video-image-effects.html", title:"Video & Image Effects", desc:"Video hero con controles, Parallax multi-capa, Scroll reveal clip-path, Zoom magnético, Carousel 3D, Before/After slider, Masonry stagger.", badge:"new", badgeLabel:"NEW", tags:["Video","Parallax","Reveal","Carousel","B/A"], lines:"~900", cats:["video","effects","scroll"], thumb:"https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=700&q=75" },
  { num:"10", file:"10-3d-product-viewer.html", title:"3D Product Viewer — GLB Real", desc:"DamagedHelmet (PBR textures), RobotExpressive (rigged + animaciones), Flamingo, LittlestTokyo. GLTFLoader + RoomEnvironment + UnrealBloom.", badge:"3d", badgeLabel:"3D", tags:["GLTFLoader","RoomEnvironment","PBR","Animations","Bloom"], lines:"~1000", cats:["3d","effects"], thumb:"https://images.unsplash.com/photo-1633356122102-3fe601e05bd2?w=700&q=75" },
  { num:"11", file:"11-immersive-scroll-lenis.html", title:"Immersive Scroll + Lenis", desc:"Lenis smooth scroll + GSAP ScrollTrigger. Hero 3D scroll-reactive, scroll horizontal pinned, clip-path reveal, video fullscreen.", badge:"new", badgeLabel:"NEW", tags:["Lenis","Horizontal","3D Hero","Scramble","Pin"], lines:"~1000", cats:["scroll","3d","effects"], thumb:"https://images.unsplash.com/photo-1579547621113-e4bb2a19bdd6?w=700&q=75" },
  { num:"12", file:"12-explode-view-glb.html", title:"Explode View 3D — GLB Real", desc:"RobotExpressive.glb con explode scroll-driven. mesh.traverse() detecta todas las partes. Labels SVG con project3DToScreen.", badge:"3d", badgeLabel:"3D", tags:["GLTFLoader","Explode","SVG Labels","ScrollTrigger","PBR"], lines:"~950", cats:["3d","scroll","effects"], thumb:"https://images.unsplash.com/photo-1555421689-d68471e189f2?w=700&q=75" },
  { num:"13", file:"13-scroll-media-expansion.html", title:"Scroll Media Expansion", desc:"El efecto más icónico: media card 72vw→100vw, altura 55vh→100vh, border-radius 18px→0 en scroll scrub. Video real.", badge:"hot", badgeLabel:"HOT", tags:["ScrollTrigger","Expansion","Video","Strip","Masonry"], lines:"~750", cats:["scroll","video","effects"], thumb:"https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=700&q=75" },
  { num:"14", file:"14-3d-globe-world.html", title:"3D Globe World — NASA Textures", desc:"Globo terráqueo con texturas NASA reales. Atmosphere glow shader, 8 ciudades con halos pulsantes, 10 arcos CatmullRomCurve3.", badge:"3d", badgeLabel:"3D", tags:["Globe","NASA","Three.js","CatmullRom","Atmosphere"], lines:"~950", cats:["3d","effects"], thumb:"https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?w=700&q=75" },
  { num:"15", file:"15-ui-premium-components.html", title:"UI Premium Components", desc:"MacOS Dock con magnification, Command Palette (Ctrl+K), Terminal typer JetBrains Mono, Sound Wave 64 barras, Notification Bell spring.", badge:"ui", badgeLabel:"UI", tags:["Dock","CommandPalette","Terminal","SoundWave","Bell"], lines:"~1050", cats:["ui","effects"], thumb:"https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=700&q=75" },
  { num:"16", file:"16-spline-hero-fluid.html", title:"Spline Hero + Fluid GLSL", desc:"Doble renderer: fluid GLSL FBM warp reactivo al mouse + DamagedHelmet GLB con rotación suave. Custom cursor, badges flotantes.", badge:"hot", badgeLabel:"HOT", tags:["GLSL","FBM","GLTFLoader","Fluid","SplineHero"], lines:"~800", cats:["3d","effects","landing"], thumb:"https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?w=700&q=75" },
  { num:"17", file:"17-morphing-text-particles.html", title:"Morphing Text Particles", desc:"6000 partículas que morphean entre palabras via Canvas2D getImageData sampling. Text Scramble, Kinetic Scroll, Gooey SVG filter.", badge:"hot", badgeLabel:"HOT", tags:["Particles","Morph","Scramble","Gooey","SVG Filter"], lines:"1370", cats:["effects","landing","3d"], thumb:"https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=700&q=75" },
  { num:"18", file:"18-3d-scroll-narrative.html", title:"3D Scroll Narrative — Apple Style", desc:"RobotExpressive GLB con 5 actos scroll-driven (camera orbit, anim clips, fade panels). Horizontal product showcase. Parallax reveal grid.", badge:"3d", badgeLabel:"3D", tags:["GLTFLoader","ScrollNarrative","Lenis","Horizontal","AnimationMixer"], lines:"~950", cats:["3d","scroll","effects","landing"], thumb:"https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=700&q=75" },
  { num:"19", file:"19-gradient-mesh-backgrounds.html", title:"Gradient Mesh Backgrounds", desc:"7 secciones: Conic gradient mesh CSS, WebGL FBM noise reactivo al mouse, Dot Matrix, Aurora Borealis GLSL, SVG Mesh, Bokeh, Scroll color shift.", badge:"new", badgeLabel:"NEW", tags:["GLSL","FBM","DotMatrix","Aurora","Bokeh"], lines:"~850", cats:["effects","3d","landing"], thumb:"https://images.unsplash.com/photo-1579547621113-e4bb2a19bdd6?w=700&q=75" },
  { num:"20", file:"20-magnetic-cursor-effects.html", title:"Magnetic Cursor Effects", desc:"Custom cursor dot+ring con 4 estados. Botones magnéticos con lerp dual-layer. Tilt cards 3D perspectiva. Liquid blob trail 12 esferas.", badge:"ui", badgeLabel:"UI", tags:["Cursor","Magnetic","Tilt3D","Trail","Underline"], lines:"~800", cats:["ui","effects","scroll"], thumb:"https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?w=700&q=75" },
  { num:"21", file:"21-data-visualization.html", title:"Data Visualization", desc:"Dashboard KPI con sparklines, SVG line chart, Bar+Donut Chart, Canvas live streaming chart, Heatmap calendar 52 semanas, Funnel + Cohort.", badge:"new", badgeLabel:"NEW", tags:["SVG Charts","Canvas","KPI","Heatmap","Funnel"], lines:"1908", cats:["ui","effects"], thumb:"https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=700&q=75" },
  { num:"22", file:"22-3d-carousel-gallery.html", title:"3D Carousel & Gallery", desc:"CSS 3D carousel cilíndrico 8 cards. Three.js GLB showcase 3 sub-viewports. Masonry lightbox con GSAP flip. Horizontal scroll gallery parallax.", badge:"3d", badgeLabel:"3D", tags:["CSS3D","GLTFLoader","Lightbox","HorizontalScroll","StackedCards"], lines:"1897", cats:["3d","scroll","effects","ui"], thumb:"https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=700&q=75" },
  { num:"23", file:"23-page-transitions.html", title:"Page Transitions & Loaders", desc:"6 transiciones: Curtain Split, Gradient Wipe, Iris Open, Pixel Dissolve, Glitch. 9 loaders CSS. 4 preloaders. Stagger reveals.", badge:"new", badgeLabel:"NEW", tags:["Transitions","Loaders","Preloaders","Stagger","Progress"], lines:"~900", cats:["effects","ui"], thumb:"https://images.unsplash.com/photo-1579547621113-e4bb2a19bdd6?w=700&q=75" },
  { num:"24", file:"24-infinite-scroll-feed.html", title:"Infinite Scroll & Feeds", desc:"Social feed IntersectionObserver lazy load. Pinterest masonry. E-commerce grid load-more. News editorial layout.", badge:"ui", badgeLabel:"UI", tags:["InfiniteScroll","Masonry","Feed","LazyLoad","E-Commerce"], lines:"~750", cats:["ui","scroll"], thumb:"https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=700&q=75" },
  { num:"25", file:"25-hero-sections.html", title:"Hero Sections — 6 Tipos Premium", desc:"6 hero sections: Split + Three.js DamagedHelmet, Cinematic Video fullscreen, SaaS Gradient + Floating UI, Luxury Editorial, Typewriter, Bold + Marquee.", badge:"hot", badgeLabel:"HOT", tags:["Hero","Three.js","Lenis","SplitType","Typewriter","Marquee"], lines:"~700", cats:["landing","effects","3d","ui"], thumb:"https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=700&q=75" },
  { num:"26", file:"26-bento-grids.html", title:"Bento Grid Layouts — 5 Sistemas", desc:"5 sistemas: SaaS Feature Grid (12 col), Agency Portfolio masonry tilt, Analytics Dashboard, Social iOS-style, Pricing 3 tiers. GSAP ScrollTrigger.", badge:"new", badgeLabel:"NEW", tags:["BentoGrid","Dashboard","Portfolio","Pricing","Analytics"], lines:"~650", cats:["ui","landing","effects"], thumb:"https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=700&q=75" },
];

const DEMO_BADGE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  new:  { bg: "rgba(34,197,94,0.15)",  border: "rgba(34,197,94,0.3)",  text: "#22c55e" },
  hot:  { bg: "rgba(239,68,68,0.15)",  border: "rgba(239,68,68,0.3)",  text: "#ef4444" },
  "3d": { bg: "rgba(99,102,241,0.15)", border: "rgba(99,102,241,0.3)", text: "#818cf8" },
  fx:   { bg: "rgba(168,85,247,0.15)", border: "rgba(168,85,247,0.3)", text: "#c084fc" },
  ui:   { bg: "rgba(6,182,212,0.15)",  border: "rgba(6,182,212,0.3)",  text: "#22d3ee" },
};

const DEMO_FILTERS = [
  { id: "all",     label: "Todos" },
  { id: "3d",      label: "3D / WebGL" },
  { id: "scroll",  label: "Scroll" },
  { id: "ui",      label: "UI Components" },
  { id: "landing", label: "Landing" },
  { id: "video",   label: "Video" },
  { id: "effects", label: "Effects" },
];

function DemoLibrary() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [hoveredDemo, setHoveredDemo] = useState<string | null>(null);

  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  const filtered = WEB_DEMOS.filter(d => {
    const matchFilter = filter === "all" || d.cats.includes(filter);
    const q = search.toLowerCase();
    const matchSearch = !q || d.title.toLowerCase().includes(q) || d.desc.toLowerCase().includes(q) || d.tags.some(t => t.toLowerCase().includes(q));
    return matchFilter && matchSearch;
  });

  return (
    <div>
      {/* Stats bar */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 20, padding: "14px 20px", background: "var(--card, #111)", borderRadius: 14, border: "1px solid var(--border, #222)" }}>
        {[
          { num: "26", label: "Demos premium" },
          { num: "50+", label: "Efectos únicos" },
          { num: "Vanilla", label: "Sin React/build" },
          { num: "100%", label: "Real, sin mocks" },
        ].map(s => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--gold, #d4a843)", lineHeight: 1 }}>{s.num}</div>
            <div style={{ fontSize: 10, color: "var(--t3, #666)", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative" }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Buscar demos..."
              style={{
                padding: "7px 12px", paddingLeft: 14, borderRadius: 8, fontSize: 12,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                color: "var(--t1, #eee)", outline: "none", width: 200,
              }}
            />
          </div>
          <a
            href={`${BASE}/web-demos/index.html`}
            target="_blank" rel="noreferrer"
            style={{ fontSize: 11, padding: "7px 14px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--t2, #aaa)", textDecoration: "none", whiteSpace: "nowrap" }}
          >
            ↗ Abrir galería completa
          </a>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        {DEMO_FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid",
              borderColor: filter === f.id ? "var(--gold, #d4a843)" : "rgba(255,255,255,0.1)",
              background: filter === f.id ? "rgba(212,168,67,0.15)" : "transparent",
              color: filter === f.id ? "var(--gold, #d4a843)" : "var(--t3, #888)",
              transition: "all 0.15s",
            }}
          >
            {f.label}
            {f.id !== "all" && <span style={{ marginLeft: 5, opacity: 0.6, fontSize: 10 }}>
              {WEB_DEMOS.filter(d => d.cats.includes(f.id)).length}
            </span>}
          </button>
        ))}
      </div>

      {/* Demo Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 18, marginBottom: 40 }}>
        {filtered.map(d => {
          const badge = DEMO_BADGE_COLORS[d.badge] ?? DEMO_BADGE_COLORS.ui;
          const isHovered = hoveredDemo === d.num;
          return (
            <a
              key={d.num}
              href={`${BASE}/web-demos/${d.file}`}
              target="_blank" rel="noreferrer"
              onMouseEnter={() => setHoveredDemo(d.num)}
              onMouseLeave={() => setHoveredDemo(null)}
              style={{
                display: "flex", flexDirection: "column", textDecoration: "none", color: "inherit",
                background: "var(--card, #111)", borderRadius: 14, overflow: "hidden",
                border: `1px solid ${isHovered ? "rgba(212,168,67,0.35)" : "var(--border, #222)"}`,
                transform: isHovered ? "translateY(-4px)" : "none",
                boxShadow: isHovered ? "0 20px 40px rgba(0,0,0,0.4)" : "none",
                transition: "all 0.25s",
              }}
            >
              {/* Thumbnail */}
              <div style={{ width: "100%", paddingTop: "56.25%", position: "relative", overflow: "hidden", background: "#0a0a0a" }}>
                <img
                  src={d.thumb}
                  alt={d.title}
                  loading="lazy"
                  style={{
                    position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover",
                    transform: isHovered ? "scale(1.05)" : "scale(1)", transition: "transform 0.5s",
                  }}
                />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.5) 100%)" }} />
                <span style={{
                  position: "absolute", top: 10, left: 10, padding: "3px 8px", borderRadius: 5,
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                  background: badge.bg, border: `1px solid ${badge.border}`, color: badge.text,
                }}>
                  {d.badgeLabel}
                </span>
                <span style={{ position: "absolute", bottom: 10, right: 10, fontSize: 10, color: "rgba(255,255,255,0.6)" }}>
                  📄 {d.lines} líneas
                </span>
              </div>

              {/* Body */}
              <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--t4, #555)", letterSpacing: "0.1em" }}>DEMO {d.num}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1, #eee)", lineHeight: 1.3 }}>{d.title}</div>
                <div style={{ fontSize: 12, color: "var(--t3, #777)", lineHeight: 1.6, flex: 1 }}>{d.desc}</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                  {d.tags.slice(0, 4).map(t => (
                    <span key={t} style={{ padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--t3, #777)" }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", gap: 5 }}>
                  {d.cats.slice(0, 3).map(c => (
                    <span key={c} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,0.04)", color: "var(--t4, #555)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{c}</span>
                  ))}
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
                  background: isHovered ? "var(--gold, #d4a843)" : "rgba(212,168,67,0.1)",
                  border: `1px solid ${isHovered ? "transparent" : "rgba(212,168,67,0.3)"}`,
                  color: isHovered ? "#000" : "var(--gold, #d4a843)",
                  transition: "all 0.2s",
                }}>
                  Abrir →
                </span>
              </div>
            </a>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 20px", color: "var(--t4, #555)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 14 }}>No se encontraron demos para "{search}"</div>
          </div>
        )}
      </div>
    </div>
  );
}
