import { useState, useEffect } from "react";
import { Copy, Check, ExternalLink, Terminal, Package, Zap, Server, Globe, Brain, Shield, Eye, ChevronDown, ChevronRight, RefreshCw, Download, CheckCircle2, XCircle, Loader2 } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const MCP_SERVERS = [
  {
    id: "stitch",
    name: "Google Stitch MCP",
    icon: "🎨",
    status: "active",
    description: "AI UI/UX design y generación de código. Genera pantallas, lista proyectos, descarga HTML/Tailwind UI assets.",
    capabilities: ["Generar pantallas UI", "Listar proyectos Stitch", "Descargar HTML/Tailwind", "Diseño con IA"],
    source: "Google Stitch API",
    license: "Google",
    command: "node scripts/stitch-mcp-proxy.mjs",
    envRequired: ["STITCH_API_KEY"],
    category: "design",
    color: "#8b5cf6",
    npmPackage: null,
    docs: "https://stitch.googleapis.com",
  },
  {
    id: "filesystem",
    name: "Filesystem MCP",
    icon: "📁",
    status: "active",
    description: "Lectura/escritura/listado de archivos y directorios en el workspace. Operaciones de archivos, assets de proyectos y gestión de uploads.",
    capabilities: ["Leer archivos", "Escribir archivos", "Listar directorios", "Buscar contenido"],
    source: "@modelcontextprotocol/server-filesystem",
    license: "MIT",
    command: "node node_modules/@modelcontextprotocol/server-filesystem/dist/index.js /home/runner/workspace",
    envRequired: [],
    category: "utility",
    color: "#f59e0b",
    npmPackage: "@modelcontextprotocol/server-filesystem@2026.1.14",
    docs: "https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem",
  },
  {
    id: "memory",
    name: "Memory MCP (Knowledge Graph)",
    icon: "🧠",
    status: "active",
    description: "Grafo de conocimiento persistente entre sesiones. Almacena y recupera entidades, relaciones y observaciones sobre clientes, marcas y proyectos.",
    capabilities: ["Crear entidades", "Añadir relaciones", "Observaciones", "Búsqueda semántica", "Memoria multi-sesión"],
    source: "@modelcontextprotocol/server-memory",
    license: "MIT",
    command: "node node_modules/@modelcontextprotocol/server-memory/dist/index.js",
    envRequired: [],
    category: "memory",
    color: "#ec4899",
    npmPackage: "@modelcontextprotocol/server-memory@2026.1.26",
    docs: "https://github.com/modelcontextprotocol/servers/tree/main/src/memory",
  },
  {
    id: "context7",
    name: "Context7 MCP (Docs IA)",
    icon: "📚",
    status: "active",
    description: "Documentación actualizada de cualquier paquete npm, framework o herramienta. Resuelve /use [nombre-librería] para inyectar docs precisas en generación de código.",
    capabilities: ["Docs de npm packages", "Frameworks actualizados", "React, Vue, Next.js", "Tailwind, shadcn", "APIs REST"],
    source: "@upstash/context7-mcp",
    license: "MIT",
    command: "node node_modules/@upstash/context7-mcp/dist/index.js",
    envRequired: [],
    category: "docs",
    color: "#06b6d4",
    npmPackage: "@upstash/context7-mcp@3.2.1",
    docs: "https://context7.com",
  },
  {
    id: "puppeteer",
    name: "Puppeteer MCP (Browser)",
    icon: "🤖",
    status: "active",
    description: "Automatización de navegador: navegar URLs, screenshots, extracción de contenido, formularios, clicks. Para web scraping, auditorías visuales y análisis de páginas.",
    capabilities: ["Screenshots de páginas", "Extracción de contenido", "Navegación web", "Relleno de formularios", "Análisis visual"],
    source: "puppeteer-mcp-server",
    license: "MIT",
    command: "node node_modules/puppeteer-mcp-server/dist/index.js",
    envRequired: [],
    category: "browser",
    color: "#10b981",
    npmPackage: "puppeteer-mcp-server@0.7.2",
    docs: "https://pptr.dev",
  },
  {
    id: "everything",
    name: "Everything MCP (Test)",
    icon: "⚡",
    status: "active",
    description: "Servidor de testing completo con prompts, recursos, sampling y demos de herramientas. Para probar integraciones MCP y características del protocolo.",
    capabilities: ["Test de prompts", "Test de recursos", "Sampling MCP", "Debug de herramientas"],
    source: "@modelcontextprotocol/server-everything",
    license: "MIT",
    command: "node node_modules/@modelcontextprotocol/server-everything/dist/index.js",
    envRequired: [],
    category: "testing",
    color: "#f97316",
    npmPackage: "@modelcontextprotocol/server-everything@2026.1.26",
    docs: "https://github.com/modelcontextprotocol/servers/tree/main/src/everything",
  },
];

const PLANNED_SERVERS = [
  { name: "GitHub MCP", icon: "🐙", desc: "Gestión de repos, PRs, issues, branches y code review.", npm: "@octokit/mcp-server", color: "#6e40c9" },
  { name: "Notion MCP", icon: "📝", desc: "Leer/escribir páginas, bases de datos y bloques de Notion.", npm: "@notionhq/notion-mcp-server", color: "#000" },
  { name: "HubSpot MCP", icon: "🔶", desc: "CRM — contactos, empresas, deals y emails.", npm: "@hubspot/mcp-server", color: "#ff7a59" },
  { name: "Sentry MCP", icon: "🐛", desc: "Error tracking — queries de issues, traces y performance.", npm: "@sentry/mcp-server", color: "#362d59" },
  { name: "Figma MCP", icon: "🎨", desc: "Extraer tokens de diseño, specs de componentes y assets.", npm: "figma-mcp", color: "#0d99ff" },
  { name: "Playwright MCP", icon: "🎭", desc: "Testing E2E completo — tests cross-browser automatizados.", npm: "@playwright/mcp", color: "#45ba4b" },
  { name: "PostgreSQL MCP", icon: "🐘", desc: "Queries SQL, exploración de schema, análisis de datos.", npm: "mcp-server-postgres", color: "#336791" },
  { name: "Slack MCP", icon: "💬", desc: "Mensajes, canales y gestión del workspace de Slack.", npm: "@slack/mcp-server", color: "#4a154b" },
];

const CATEGORY_COLORS: Record<string, string> = {
  design: "#8b5cf6",
  utility: "#f59e0b",
  memory: "#ec4899",
  docs: "#06b6d4",
  browser: "#10b981",
  testing: "#f97316",
};

const CATEGORY_LABELS: Record<string, string> = {
  design: "Diseño IA",
  utility: "Utilidad",
  memory: "Memoria",
  docs: "Documentación",
  browser: "Navegador",
  testing: "Testing",
};

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "#4ade80" : "var(--t3)", padding: 2, display: "flex", alignItems: "center" }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function ServerCard({ server }: { server: typeof MCP_SERVERS[0] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{
      background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12,
      overflow: "hidden", transition: "border-color 0.2s",
    }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
          borderLeft: `3px solid ${server.color}`,
        }}
      >
        <span style={{ fontSize: 24 }}>{server.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, color: "var(--t1)", fontSize: 15 }}>{server.name}</span>
            <span style={{
              padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
              background: server.status === "active" ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)",
              color: server.status === "active" ? "#4ade80" : "#f87171",
              border: `1px solid ${server.status === "active" ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)"}`,
            }}>
              {server.status === "active" ? "✓ ACTIVO" : "INACTIVO"}
            </span>
            <span style={{
              padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600,
              background: `${CATEGORY_COLORS[server.category] || "#888"}22`,
              color: CATEGORY_COLORS[server.category] || "#888",
              border: `1px solid ${CATEGORY_COLORS[server.category] || "#888"}44`,
            }}>
              {CATEGORY_LABELS[server.category] || server.category}
            </span>
          </div>
          <p style={{ fontSize: 12, color: "var(--t3)", margin: "4px 0 0", lineHeight: 1.4 }}>{server.description}</p>
        </div>
        {expanded ? <ChevronDown size={16} style={{ color: "var(--t3)", flexShrink: 0 }} /> : <ChevronRight size={16} style={{ color: "var(--t3)", flexShrink: 0 }} />}
      </div>

      {expanded && (
        <div style={{ padding: "0 20px 20px", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Capacidades</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {server.capabilities.map(c => (
                  <span key={c} style={{
                    padding: "3px 8px", borderRadius: 20, fontSize: 11,
                    background: `${server.color}18`, color: server.color,
                    border: `1px solid ${server.color}30`,
                  }}>{c}</span>
                ))}
              </div>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Info</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--t2)" }}>📦 {server.source}</span>
                <span style={{ fontSize: 12, color: "var(--t2)" }}>⚖️ {server.license}</span>
                {server.npmPackage && (
                  <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--jade)", background: "rgba(0,201,183,0.08)", padding: "2px 6px", borderRadius: 4 }}>
                    {server.npmPackage}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Comando</p>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg1)", borderRadius: 6, padding: "8px 12px", border: "1px solid var(--border)" }}>
              <Terminal size={12} style={{ color: "var(--jade)", flexShrink: 0 }} />
              <code style={{ fontSize: 11, color: "#4ade80", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{server.command}</code>
              <CopyBtn text={server.command} />
            </div>
          </div>

          {server.envRequired.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Variables de entorno requeridas</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {server.envRequired.map(e => (
                  <span key={e} style={{ fontFamily: "monospace", fontSize: 11, background: "rgba(245,158,11,0.1)", color: "#f59e0b", padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(245,158,11,0.3)" }}>{e}</span>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <a href={server.docs} target="_blank" rel="noopener noreferrer" style={{
              display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--gold)",
              textDecoration: "none", padding: "5px 10px", borderRadius: 6,
              background: "rgba(200,168,75,0.1)", border: "1px solid rgba(200,168,75,0.25)",
            }}>
              <ExternalLink size={12} /> Documentación
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MCPManager() {
  const [copied, setCopied] = useState(false);
  const [installStatus, setInstallStatus] = useState<Record<string, boolean>>({});
  const [installing, setInstalling] = useState<string | null>(null);
  const [installResults, setInstallResults] = useState<Record<string, { ok: boolean; error?: string }>>({});
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{ ok: boolean; checked: number; msg: string } | null>(null);
  const [lastPing, setLastPing] = useState<string | null>(null);

  function loadStatus() {
    fetch(`${API_BASE}/api/admin/mcp/status`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d?.status) setInstallStatus(d.status); })
      .catch(() => {});
  }

  useEffect(() => { loadStatus(); }, []);

  async function reconnectAll() {
    setPinging(true);
    setPingResult(null);
    try {
      const r = await fetch(`${API_BASE}/api/admin/mcp/status`, { credentials: "include" });
      const d = await r.json();
      if (d?.status) setInstallStatus(d.status);
      const total = MCP_SERVERS.length;
      const ok = MCP_SERVERS.filter(s => d?.status?.[s.npmPackage ?? s.id] !== false).length;
      setPingResult({ ok: ok === total, checked: total, msg: `${ok}/${total} servidores verificados` });
      setLastPing(new Date().toLocaleTimeString("es-ES"));
    } catch (e: any) {
      setPingResult({ ok: false, checked: 0, msg: `Error de conexión: ${e?.message || "red"}` });
    }
    setPinging(false);
  }

  async function installServer(npmPackage: string) {
    setInstalling(npmPackage);
    setInstallResults(prev => { const n = { ...prev }; delete n[npmPackage]; return n; });
    try {
      const r = await fetch(`${API_BASE}/api/admin/mcp/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ npmPackage }),
      });
      const d = await r.json();
      if (d.ok) {
        setInstallStatus(prev => ({ ...prev, [npmPackage]: true }));
        setInstallResults(prev => ({ ...prev, [npmPackage]: { ok: true } }));
      } else {
        setInstallResults(prev => ({ ...prev, [npmPackage]: { ok: false, error: d.error || "Error desconocido" } }));
      }
    } catch (e: any) {
      setInstallResults(prev => ({ ...prev, [npmPackage]: { ok: false, error: e?.message || "Error de red" } }));
    } finally {
      setInstalling(null);
    }
  }

  const mcpConfig = JSON.stringify({
    mcpServers: {
      stitch: { command: "node", args: ["scripts/stitch-mcp-proxy.mjs"], description: "Google Stitch MCP" },
      filesystem: { command: "node", args: ["node_modules/@modelcontextprotocol/server-filesystem/dist/index.js", "/home/runner/workspace"] },
      memory: { command: "node", args: ["node_modules/@modelcontextprotocol/server-memory/dist/index.js"] },
      context7: { command: "node", args: ["node_modules/@upstash/context7-mcp/dist/index.js"] },
      puppeteer: { command: "node", args: ["node_modules/puppeteer-mcp-server/dist/index.js"] },
    }
  }, null, 2);

  return (
    <div style={{ padding: "24px 24px 40px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
          <Server size={22} style={{ color: "var(--gold)" }} />
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--t1)", margin: 0 }}>MCP Manager</h1>
          <span style={{
            padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)"
          }}>6 servidores activos</span>
          <button
            onClick={reconnectAll}
            disabled={pinging}
            style={{
              marginLeft: "auto", display: "flex", alignItems: "center", gap: 6,
              padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: pinging ? "wait" : "pointer",
              background: pingResult?.ok ? "rgba(74,222,128,0.12)" : pinging ? "rgba(200,168,75,0.08)" : "rgba(200,168,75,0.12)",
              border: pingResult?.ok ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(200,168,75,0.3)",
              color: pingResult?.ok ? "#4ade80" : "var(--gold)",
            }}
          >
            {pinging
              ? <><Loader2 size={13} style={{ animation: "spin 0.6s linear infinite" }} /> Verificando...</>
              : pingResult?.ok
              ? <><CheckCircle2 size={13} /> Todos conectados</>
              : <><RefreshCw size={13} /> Reconectar / Verificar</>
            }
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <p style={{ color: "var(--t3)", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
            Model Context Protocol — herramientas de IA conectadas al agente. Gestiona, configura e instala nuevos MCP servers.
          </p>
          {pingResult && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, fontSize: 11,
              background: pingResult.ok ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
              border: `1px solid ${pingResult.ok ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)"}`,
              color: pingResult.ok ? "#4ade80" : "#f87171",
            }}>
              {pingResult.ok ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
              {pingResult.msg}
              {lastPing && <span style={{ color: "var(--t4)" }}>· {lastPing}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginBottom: 28 }}>
        {[
          { icon: <Server size={16} />, label: "Servidores activos", value: "6", color: "#4ade80" },
          { icon: <Package size={16} />, label: "npm instalados", value: "5", color: "var(--gold)" },
          { icon: <Zap size={16} />, label: "Capacidades totales", value: "28+", color: "#8b5cf6" },
          { icon: <Brain size={16} />, label: "Memoria persistente", value: "Activa", color: "#ec4899" },
          { icon: <Globe size={16} />, label: "Browser automation", value: "Puppeteer", color: "#10b981" },
          { icon: <Shield size={16} />, label: "Seguridad", value: "MCP Sandboxed", color: "#f59e0b" },
        ].map((s, i) => (
          <div key={i} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, color: s.color }}>{s.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "var(--t3)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Active Servers */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <Zap size={16} style={{ color: "#4ade80" }} /> Servidores Instalados y Activos
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {MCP_SERVERS.map(s => <ServerCard key={s.id} server={s} />)}
        </div>
      </div>

      {/* mcp.json config viewer */}
      <div style={{ marginBottom: 28, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Terminal size={16} style={{ color: "var(--jade)" }} />
            <span style={{ fontWeight: 700, color: "var(--t1)", fontSize: 14 }}>mcp.json — Configuración activa</span>
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(mcpConfig); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(200,168,75,0.1)", border: "1px solid rgba(200,168,75,0.25)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: "var(--gold)", fontSize: 12 }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />} Copiar
          </button>
        </div>
        <pre style={{ margin: 0, padding: "16px 20px", fontSize: 11, lineHeight: 1.6, color: "#4ade80", fontFamily: "monospace", overflowX: "auto", maxHeight: 300 }}>
          {mcpConfig}
        </pre>
      </div>

      {/* Planned Servers */}
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
          <Download size={16} style={{ color: "var(--gold)" }} /> Servidores MCP Disponibles para Instalar
        </h2>
        <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 14 }}>
          Instala nuevos servidores MCP con un click. Se instalan automáticamente en el workspace.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
          {PLANNED_SERVERS.map(s => {
            const isInstalled = installStatus[s.npm] === true;
            const isInstalling = installing === s.npm;
            const installResult = installResults[s.npm];
            return (
              <div key={s.name} style={{
                background: "var(--bg2)",
                border: `1px solid ${isInstalled ? "rgba(74,222,128,0.4)" : "var(--border)"}`,
                borderRadius: 10, padding: "14px 16px",
                opacity: isInstalled ? 1 : 0.85,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 20 }}>{s.icon}</span>
                  <span style={{ fontWeight: 700, color: "var(--t1)", fontSize: 13 }}>{s.name}</span>
                  <span style={{ marginLeft: "auto", fontSize: 9, padding: "2px 6px", borderRadius: 20,
                    background: isInstalled ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.05)",
                    color: isInstalled ? "#4ade80" : "var(--t3)",
                    border: `1px solid ${isInstalled ? "rgba(74,222,128,0.3)" : "var(--border)"}`,
                  }}>
                    {isInstalled ? "✓ INSTALADO" : "DISPONIBLE"}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: "var(--t3)", margin: "0 0 10px", lineHeight: 1.4 }}>{s.desc}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <code style={{ fontSize: 10, color: "var(--jade)", fontFamily: "monospace", background: "rgba(0,201,183,0.08)", padding: "2px 6px", borderRadius: 4, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.npm}</code>
                  <CopyBtn text={`pnpm add -w ${s.npm}`} />
                </div>
                {installResult && (
                  <div style={{
                    fontSize: 11, padding: "6px 8px", borderRadius: 6, marginBottom: 8,
                    background: installResult.ok ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
                    color: installResult.ok ? "#4ade80" : "#f87171",
                    border: `1px solid ${installResult.ok ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
                    fontFamily: "monospace", maxHeight: 80, overflow: "auto",
                  }}>
                    {installResult.ok ? "✓ Instalado correctamente" : `✗ ${installResult.error?.slice(0, 200)}`}
                  </div>
                )}
                <button
                  onClick={() => installServer(s.npm)}
                  disabled={isInstalling || isInstalled}
                  style={{
                    width: "100%", padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    cursor: isInstalling || isInstalled ? "not-allowed" : "pointer",
                    background: isInstalled ? "rgba(74,222,128,0.1)" : isInstalling ? "rgba(200,168,75,0.1)" : "rgba(200,168,75,0.15)",
                    color: isInstalled ? "#4ade80" : "var(--gold)",
                    border: `1px solid ${isInstalled ? "rgba(74,222,128,0.3)" : "rgba(200,168,75,0.35)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
                  {isInstalling ? (
                    <><Loader2 size={13} style={{ animation: "spin 0.6s linear infinite" }} /> Instalando...</>
                  ) : isInstalled ? (
                    <><CheckCircle2 size={13} /> Ya instalado</>
                  ) : (
                    <><Download size={13} /> Instalar ahora</>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Install guide */}
      <div style={{ marginTop: 28, background: "rgba(200,168,75,0.06)", border: "1px solid rgba(200,168,75,0.2)", borderRadius: 12, padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <Eye size={14} style={{ color: "var(--gold)" }} />
          <span style={{ fontWeight: 700, color: "var(--gold)", fontSize: 13 }}>Cómo instalar un nuevo MCP Server</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { n: 1, cmd: "pnpm add -w [npm-package-name]", label: "Instalar el paquete npm" },
            { n: 2, cmd: 'cat node_modules/[pkg]/package.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get(\'bin\',{}))"', label: "Verificar el bin entry point" },
            { n: 3, cmd: '// Añadir entrada en mcp.json:\n"nombre": { "command": "node", "args": ["node_modules/[pkg]/dist/index.js"] }', label: "Registrar en mcp.json" },
          ].map(step => (
            <div key={step.n} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(200,168,75,0.2)", color: "var(--gold)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>{step.n}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, color: "var(--t3)", margin: "0 0 3px" }}>{step.label}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg1)", borderRadius: 6, padding: "6px 10px", border: "1px solid var(--border)" }}>
                  <code style={{ fontSize: 10, color: "#4ade80", flex: 1, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>{step.cmd}</code>
                  <CopyBtn text={step.cmd} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
