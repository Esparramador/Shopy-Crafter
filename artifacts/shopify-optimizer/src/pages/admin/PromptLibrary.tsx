import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Search, Copy, Check, Zap, Filter, ChevronDown, BookOpen, Sparkles, Star, Clock, Hash, Play, X, ChevronRight, AlertCircle, Loader2, Brain, Code2, Globe } from "lucide-react";

const WEB_DESIGNER_CATS = new Set([
  "3d_web_effects", "stitch_bulk_v2", "cult_ui_effects", "stitch_effects",
  "typegpu_advanced", "typegpu_effects",
  "21st_dev_heroes_nav", "21st_dev_landing_hero", "21st_dev_auth_dash", "21st_dev_design_system",
]);

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface MasterItem {
  id?: string;
  name: string;
  description?: string;
  prompt?: string;
  category?: string;
  engine?: string;
  useCase?: string;
  style?: string;
  tags?: string[];
}

interface LibIndex {
  key: string;
  count: number;
}

interface Project {
  id: number;
  name: string;
  shopDomain?: string;
}

interface PromptVar {
  name: string;
  value: string | null;
  resolved: boolean;
}

const EFFECT_CATEGORIES = [
  { key: "", label: "Todas", icon: "🌐", color: "var(--gold)", desc: "Explorar toda la librería — 6.677 templates" },

  // ── E-Commerce Stitch ──
  { key: "stitch_bulk_v2", label: "E-commerce Premium", icon: "🛍️", color: "#f59e0b", desc: "225 templates Shopify — salud, moda, tech, luxury, pets" },
  { key: "stitch_bulk_v3", label: "Viaje & Lifestyle", icon: "🌿", color: "#4ade80", desc: "125 templates de viaje, lifestyle y e-commerce moderno" },
  { key: "shopy_crafter_seeds", label: "Shopy Crafter Seeds", icon: "🌱", color: "var(--jade)", desc: "10 templates base de Shopy Crafter — copy y estrategia" },
  { key: "crafter_methodology", label: "Metodología Crafter", icon: "🎯", color: "#fbbf24", desc: "5 plantillas de metodología de agencia" },

  // ── Ads & Vídeo ──
  { key: "ad_studio_templates", label: "Ad Studio", icon: "📺", color: "#f87171", desc: "7 creatividades para Facebook, Instagram, TikTok — UGC, testimonios, hooks" },
  { key: "cinematic_ad_templates", label: "Ads Cinematográficos", icon: "🎬", color: "#e879f9", desc: "9 templates tipo Apple/Porsche — anatomía, deconstrucción, masterpiece" },
  { key: "video_prompts", label: "Guiones de Vídeo", icon: "🎥", color: "#06b6d4", desc: "19 guiones para UGC, reels, shorts y anuncios en vídeo" },
  { key: "effects_prompts", label: "Efectos & Prompts", icon: "✨", color: "#a78bfa", desc: "24 prompts de efectos creativos para webs y apps" },

  // ── Diseño & UI ──
  { key: "design_catalog", label: "Catálogo de Diseño", icon: "🎨", color: "#60a5fa", desc: "312 prompts de diseño web — landing pages, dashboards, UI systems" },
  { key: "neuform_design_systems", label: "Sistemas de Diseño", icon: "🏗️", color: "#38bdf8", desc: "215 sistemas de diseño web inspirados en Vercel, Linear, Apple" },
  { key: "external_ui_libs", label: "Librerías UI", icon: "📦", color: "#fb923c", desc: "395 templates de Cult UI, Magic UI y otras librerías premium" },
  { key: "stitch_design_system", label: "Stitch Design System", icon: "🔧", color: "#818cf8", desc: "52 componentes de sistema de diseño Stitch — tokens, variables, specs" },

  // ── Efectos Web ──
  { key: "stitch_effects", label: "Efectos Stitch", icon: "🌊", color: "#22d3ee", desc: "210 efectos de animación y UI para webs premium — parallax, morphing, transitions" },
  { key: "effects_catalog", label: "Catálogo Efectos CSS", icon: "💫", color: "#c084fc", desc: "213 efectos CSS — auroras, glassmorphism, gradientes animados, partículas" },
  { key: "cult_ui_effects", label: "Cult UI Effects", icon: "🔮", color: "#f0abfc", desc: "25 efectos especiales de Cult UI — Text Animate, Magnetic, Spotlight" },
  { key: "visme_form_effects", label: "Visme Form Effects", icon: "📋", color: "#34d399", desc: "35 efectos interactivos para formularios y encuestas Visme" },

  // ── Animaciones CSS ──
  { key: "animate_css_library", label: "Animate.css (97)", icon: "⚡", color: "#fbbf24", desc: "97 animaciones — bounce, fade, flip, rotate, zoom. CDN + JS patterns" },
  { key: "hover_css_library", label: "Hover.css (80)", icon: "🖱️", color: "#10b981", desc: "80 efectos hover — 2D/3D transitions, underlines, backgrounds, bubbles" },

  // ── Componentes UI ──
  { key: "shadcn_components", label: "shadcn/ui", icon: "🧩", color: "#e2e8f0", desc: "40 componentes shadcn/ui con variantes, estados y dark mode" },
  { key: "21st_dev_sections", label: "Secciones Web", icon: "🏠", color: "#7dd3fc", desc: "39 secciones web modernas — pricing, features, testimonios, FAQs" },
  { key: "21st_dev_heroes_nav", label: "Heroes & Navegación", icon: "🗺️", color: "#86efac", desc: "26 heroes y navbars premium — glassmorphism, animated, sticky" },
  { key: "21st_dev_auth_dash", label: "Auth & Dashboard", icon: "📊", color: "#fca5a5", desc: "30 pantallas de autenticación y dashboards — login, signup, analytics" },
  { key: "card_studio_templates", label: "Card Studio", icon: "🃏", color: "#fdba74", desc: "6 templates de cards premium para portfolios y catálogos" },

  // ── GPU & 3D ──
  { key: "3d_web_effects", label: "3D Web Effects (28)", icon: "🌐", color: "#38bdf8", desc: "28 templates 3D web premium — R3F tricks, matter-js physics, GLB lerp, Canvas 2D, Bento Tilt, parallax, snap scroll. Código real extraído de 8 repos GitHub" },
  { key: "typegpu_advanced", label: "TypeGPU Avanzado", icon: "⚛️", color: "#f472b6", desc: "78 shaders GPU, física avanzada y partículas WebGL — Three.js, WGSL" },
  { key: "typegpu_effects", label: "Efectos GPU", icon: "🌈", color: "#fb7185", desc: "61 efectos básicos GPU — gradientes animados, blur, distorsión de imagen" },
  { key: "tripo3d_animations", label: "Animaciones 3D (Tripo)", icon: "🧊", color: "#67e8f9", desc: "63 animaciones 3D para modelos — idle, walk, attack, dance, emotes" },
  { key: "3d_mining", label: "3D Mining (3.414)", icon: "⛏️", color: "#a78bfa", desc: "3.414 prompts 3D — modelos, texturas, escenas, renders y assets" },

  // ── Presentaciones ──
  { key: "visme_templates", label: "Visme Templates", icon: "📊", color: "#60a5fa", desc: "579 plantillas de presentaciones, infografías y diseño visual" },

  // ── Desktop & Agentes ──
  { key: "desktop_commander", label: "Desktop Commander", icon: "🖥️", color: "#94a3b8", desc: "73 comandos y workflows para Desktop Commander MCP" },
  { key: "claude_code_agents", label: "Agentes Claude", icon: "🤖", color: "#8b5cf6", desc: "30 agentes Claude Code — reviewers, architects y planners" },
  { key: "claude_code_agents_ecc", label: "Agentes ECC (64)", icon: "🧠", color: "#a855f7", desc: "64 agentes especializados — resolvers, optimizers para cada lenguaje" },
  { key: "anthropic_skills", label: "Anthropic Skills", icon: "🏛️", color: "#c4b5fd", desc: "20 skills oficiales Anthropic — workflows, pipelines, patterns Claude" },
  { key: "awesome_claude_code", label: "Awesome Claude Code", icon: "⭐", color: "#f97316", desc: "30 recursos curados del registry — agent skills, MCPs y templates" },

  // ── Dev & Seguridad ──
  { key: "dev_workflow_skills", label: "Dev Skills (19)", icon: "⚙️", color: "#0ea5e9", desc: "19 skills — API design, backend patterns, DB migrations, git workflow" },
  { key: "trail_of_bits_security", label: "Seguridad (Trail of Bits)", icon: "🛡️", color: "#ef4444", desc: "27 skills de auditoría — código, supply chain, criptografía avanzada" },
  { key: "web_security_workflows", label: "Web Security", icon: "🔒", color: "#f87171", desc: "15 workflows de seguridad web — OWASP, XSS, SQLi, auth hardening" },

  // ── Agencia ──
  { key: "agency_singles", label: "Agency Singles", icon: "💼", color: "#d4a017", desc: "4 templates de agencia — propuesta de valor, pitch, onboarding" },

  // ── Email & Automation ──
  { key: "email_marketing_master", label: "Email Marketing Master", icon: "📧", color: "#f59e0b", desc: "82 prompts de email marketing — bienvenida, carrito, lanzamiento, newsletter, B2B" },
  { key: "email_sequences_pro", label: "Email Sequences Pro", icon: "📨", color: "#fbbf24", desc: "40 secuencias de nurture completas — onboarding, win-back, trial SaaS, reactivación" },
  { key: "email_templates_html", label: "Templates HTML Email", icon: "📋", color: "#fcd34d", desc: "25 templates HTML listos para Klaviyo/Mailchimp — transaccionales, newsletter, black friday" },

  // ── Video & UGC ──
  { key: "video_scripts_master", label: "Scripts de Vídeo Master", icon: "🎥", color: "#e879f9", desc: "75 guiones — UGC, YouTube, Reels, TikTok, VSL, tutoriales, podcast repurpose" },
  { key: "ugc_creator_briefs", label: "Briefs para Creadores UGC", icon: "🎬", color: "#c084fc", desc: "30 briefs profesionales para contratar y gestionar creadores UGC" },
  { key: "hooks_viral_library", label: "Hooks Virales (300+)", icon: "🎣", color: "#a855f7", desc: "300 hooks de apertura probados para Reels, TikTok y YouTube Shorts" },
  { key: "seedance_advanced_prompts", label: "Seedance 2 Prompts Avanzados", icon: "🤖", color: "#8b5cf6", desc: "60 prompts cinematográficos para generación de vídeo con Seedance 2 y Kling 2.1" },

  // ── Agencia & SaaS ──
  { key: "agencia_master_v1", label: "Agencia Master v1", icon: "🏢", color: "#d4a017", desc: "P-001→P-082 — propuestas, auditorías, cases studies, onboarding, guiones TPV, legal" },
  { key: "saas_growth_playbook", label: "SaaS Growth Playbook", icon: "🚀", color: "#f97316", desc: "50 prompts SaaS — onboarding, pricing, landing, roadmap, churn, activation" },
  { key: "legal_rgpd_pack", label: "Legal & RGPD Pack", icon: "⚖️", color: "#94a3b8", desc: "20 plantillas legales — privacidad, cookies, términos, contratos agencia, NDA" },

  // ── Social Media Pro ──
  { key: "social_media_pro", label: "Social Media Pro 2026", icon: "📱", color: "#06b6d4", desc: "120 prompts de redes — calendarios, captions, LinkedIn, TikTok, WhatsApp, giveaways" },
  { key: "community_management_kit", label: "Community Management Kit", icon: "🌐", color: "#22d3ee", desc: "35 plantillas de CM — manuales, protocolos de crisis, reportes, brand advocates" },

  // ── AI Workflows & Agentes ──
  { key: "ai_agents_intensive", label: "AI Agents Intensive (Google)", icon: "🧠", color: "#4ade80", desc: "45 workflows de agentes IA — Google Gemini, multi-agent, tool-use, RAG patterns" },
  { key: "gemini_omni_advanced", label: "Gemini Omni API Advanced", icon: "✨", color: "#34d399", desc: "38 prompts avanzados para Gemini 2.5 Pro — multimodal, audio, video, live API" },
  { key: "faceless_video_ai", label: "Faceless Video AI", icon: "🎭", color: "#10b981", desc: "40 workflows para canales faceless — guiones, TTS, B-roll IA, shorts automatizados" },
  { key: "micro_drama_generator", label: "Micro Drama Generator", icon: "🎭", color: "#059669", desc: "25 fórmulas de micro-drama para TikTok/Reels — conflicto, giro, resolución en <60s" },
];

const ENGINE_COLORS: Record<string, string> = {
  claude: "#fbbf24",
  gpt: "#4ade80",
  gemini: "#60a5fa",
  midjourney: "#a78bfa",
  flux: "#f87171",
  default: "var(--t3)",
};

function highlightVars(text: string): React.ReactNode[] {
  const parts = text.split(/(\{\{[A-Z_]+\}\})/g);
  return parts.map((part, i) =>
    /^\{\{[A-Z_]+\}\}$/.test(part)
      ? <mark key={i} style={{ background: "rgba(200,168,75,0.2)", color: "var(--gold)", borderRadius: 3, padding: "0 3px", fontWeight: 700 }}>{part}</mark>
      : <span key={i}>{part}</span>
  );
}

function VarBadge({ v }: { v: PromptVar }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "4px 8px", borderRadius: 6,
      background: v.resolved ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
      border: `1px solid ${v.resolved ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
      fontSize: 11,
    }}>
      <span style={{ color: v.resolved ? "#4ade80" : "#f87171", fontWeight: 700, fontFamily: "monospace" }}>
        {`{{${v.name}}}`}
      </span>
      {v.resolved
        ? <span style={{ color: "var(--t3)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>→ {v.value}</span>
        : <span style={{ color: "#f87171" }}>sin resolver</span>
      }
    </div>
  );
}

function ExecutionPanel({
  item,
  projects,
  onClose,
}: {
  item: MasterItem;
  projects: Project[];
  onClose: () => void;
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<number | "">(projects[0]?.id ?? "");
  const [vars, setVars] = useState<PromptVar[]>([]);
  const [loadingVars, setLoadingVars] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [customVars, setCustomVars] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const template = item.prompt ?? item.description ?? item.name;

  const loadVars = useCallback(async (projectId: number | "") => {
    if (!template) return;
    setLoadingVars(true);
    setVars([]);
    try {
      const r = await fetch(`${API_BASE}/api/prompt-library/preview-vars`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ template, projectId: projectId || undefined }),
      });
      if (r.ok) {
        const d = await r.json();
        setVars(d.vars ?? []);
      }
    } catch {}
    setLoadingVars(false);
  }, [template]);

  useEffect(() => {
    loadVars(selectedProjectId);
  }, [selectedProjectId, loadVars]);

  const handleExecute = async () => {
    if (!template) return;
    setExecuting(true);
    setResult("");
    setError("");
    abortRef.current = new AbortController();

    try {
      const response = await fetch(`${API_BASE}/api/prompt-library/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: abortRef.current.signal,
        body: JSON.stringify({
          template,
          projectId: selectedProjectId || undefined,
          customVars,
          saveToMemory: false,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Error desconocido" }));
        setError(err.error ?? "Error ejecutando prompt");
        setExecuting(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) { setError("Sin stream"); setExecuting(false); return; }
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.type === "delta") {
              fullText += msg.text;
              setResult(fullText);
              if (resultRef.current) {
                resultRef.current.scrollTop = resultRef.current.scrollHeight;
              }
            } else if (msg.type === "error") {
              setError(msg.message ?? "Error");
            } else if (msg.type === "meta") {
              if (msg.unresolvedVars?.length > 0) {
                setVars(prev => prev.map(v =>
                  msg.unresolvedVars.includes(v.name) ? { ...v, resolved: false } : v
                ));
              }
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") setError(err.message ?? "Error");
    }
    setExecuting(false);
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setExecuting(false);
  };

  const handleCopyResult = () => {
    navigator.clipboard.writeText(result).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const resolvedCount = vars.filter(v => v.resolved).length;
  const totalVars = vars.length;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      display: "flex", alignItems: "stretch",
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div style={{
        marginLeft: "auto",
        width: "min(680px, 96vw)",
        background: "var(--ink)",
        borderLeft: "1px solid var(--bdr)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        animation: "slideInRight 0.2s ease-out",
      }}>

        {/* Header */}
        <div style={{
          padding: "18px 20px", borderBottom: "1px solid var(--bdr)",
          display: "flex", alignItems: "flex-start", gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{
                fontSize: 9, padding: "2px 7px", borderRadius: 4,
                background: "rgba(200,168,75,0.12)", color: "var(--gold)",
                fontWeight: 700, textTransform: "uppercase",
              }}>
                Ejecutar con DNA ✨
              </span>
              {item.engine && (
                <span style={{
                  fontSize: 9, padding: "1px 6px", borderRadius: 3,
                  background: `${ENGINE_COLORS[item.engine?.toLowerCase() ?? ""] ?? ENGINE_COLORS.default}18`,
                  color: ENGINE_COLORS[item.engine?.toLowerCase() ?? ""] ?? ENGINE_COLORS.default,
                  fontWeight: 700, textTransform: "uppercase",
                }}>
                  {item.engine}
                </span>
              )}
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--t)", lineHeight: 1.3 }}>
              {item.name}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", padding: 4, flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Project Selector */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.8px", display: "block", marginBottom: 6 }}>
              Proyecto cliente
            </label>
            {projects.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--t4)" }}>Sin proyectos. El prompt se ejecutará sin DNA de marca.</p>
            ) : (
              <select
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value ? Number(e.target.value) : "")}
                className="form-input"
                style={{ width: "100%", fontSize: 13 }}
              >
                <option value="">— Sin proyecto (prompt genérico) —</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name} {p.shopDomain ? `(${p.shopDomain})` : ""}</option>
                ))}
              </select>
            )}
          </div>

          {/* Variable Resolution Status */}
          {(loadingVars || vars.length > 0) && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                  Variables DNA
                </label>
                {!loadingVars && totalVars > 0 && (
                  <span style={{
                    fontSize: 10, padding: "1px 7px", borderRadius: 10,
                    background: resolvedCount === totalVars ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
                    color: resolvedCount === totalVars ? "#4ade80" : "#f87171",
                    fontWeight: 700,
                  }}>
                    {resolvedCount}/{totalVars} resueltas
                  </span>
                )}
              </div>
              {loadingVars ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--t4)" }}>
                  <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} />
                  Analizando DNA del proyecto…
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {vars.map(v => <VarBadge key={v.name} v={v} />)}
                </div>
              )}
              {vars.some(v => !v.resolved) && (
                <div style={{ marginTop: 10 }}>
                  <p style={{ fontSize: 11, color: "var(--t4)", marginBottom: 6 }}>
                    Variables sin resolver — completa manualmente:
                  </p>
                  <div style={{ display: "grid", gap: 5 }}>
                    {vars.filter(v => !v.resolved).map(v => (
                      <div key={v.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--gold)", width: 140, flexShrink: 0 }}>
                          {`{{${v.name}}}`}
                        </span>
                        <input
                          value={customVars[v.name] ?? ""}
                          onChange={e => setCustomVars(prev => ({ ...prev, [v.name]: e.target.value }))}
                          placeholder={`Valor para ${v.name}…`}
                          className="form-input"
                          style={{ flex: 1, fontSize: 11, padding: "5px 10px" }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Prompt Preview */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.8px", display: "block", marginBottom: 6 }}>
              Template
            </label>
            <div style={{
              padding: "12px 14px", borderRadius: 8,
              background: "var(--ink2)", border: "1px solid var(--bdr)",
              fontSize: 12, color: "var(--t2)", lineHeight: 1.7,
              fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word",
              maxHeight: 200, overflow: "auto",
            }}>
              {highlightVars(template)}
            </div>
          </div>

          {/* Result */}
          {(result || executing) && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                  Resultado IA
                  {executing && <span style={{ marginLeft: 6, fontSize: 9, color: "var(--gold)", animation: "pulse 1s infinite" }}>• GENERANDO</span>}
                </label>
                {result && !executing && (
                  <button
                    onClick={handleCopyResult}
                    className="btn"
                    style={{ fontSize: 10, padding: "3px 10px", display: "flex", alignItems: "center", gap: 4 }}
                  >
                    {copied ? <Check size={11} /> : <Copy size={11} />}
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                )}
              </div>
              <div
                ref={resultRef}
                style={{
                  padding: "14px 16px", borderRadius: 8,
                  background: "var(--ink2)", border: "1px solid rgba(200,168,75,0.2)",
                  fontSize: 13, color: "var(--t)", lineHeight: 1.75,
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                  maxHeight: 340, overflow: "auto",
                  minHeight: 80,
                }}
              >
                {result}
                {executing && <span style={{ display: "inline-block", width: 8, height: 14, background: "var(--gold)", borderRadius: 1, marginLeft: 2, animation: "blink 0.7s infinite" }} />}
              </div>
            </div>
          )}

          {error && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              padding: "10px 12px", borderRadius: 8,
              background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)",
            }}>
              <AlertCircle size={14} style={{ color: "#f87171", flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: "#f87171" }}>{error}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: "14px 20px", borderTop: "1px solid var(--bdr)",
          display: "flex", gap: 8, alignItems: "center",
        }}>
          {executing ? (
            <button
              onClick={handleStop}
              className="btn"
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}
            >
              <X size={13} /> Detener
            </button>
          ) : (
            <button
              onClick={handleExecute}
              className="btn-primary"
              disabled={!template}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontSize: 13, padding: "10px" }}
            >
              <Zap size={14} />
              {selectedProjectId ? "Ejecutar con DNA del cliente" : "Ejecutar prompt"}
            </button>
          )}
          <button onClick={onClose} className="btn" style={{ padding: "10px 16px" }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function EffectPreviewCard({
  item,
  onCopy,
  onExecute,
  dnaMode,
  activeCategory,
}: {
  item: MasterItem;
  onCopy: (text: string) => void;
  onExecute: (item: MasterItem) => void;
  dnaMode: boolean;
  activeCategory: string;
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [, navigate] = useLocation();
  const engineColor = ENGINE_COLORS[item.engine?.toLowerCase() ?? ""] ?? ENGINE_COLORS.default;
  const isWebCat = WEB_DESIGNER_CATS.has(activeCategory);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = item.prompt ?? item.description ?? item.name;
    navigator.clipboard.writeText(text).catch(() => {});
    onCopy(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleExecute = (e: React.MouseEvent) => {
    e.stopPropagation();
    onExecute(item);
  };

  const handleOpenWebDesigner = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate("/web-designer");
  };

  const hasVars = /\{\{[A-Z_]+\}\}/.test(item.prompt ?? item.description ?? "");

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      className="glass-card"
      style={{
        padding: "14px 16px", cursor: "pointer",
        border: expanded ? "1px solid rgba(200,168,75,0.35)" : "1px solid var(--bdr)",
        transition: "border-color 0.15s, box-shadow 0.15s",
        boxShadow: expanded ? "0 0 0 1px rgba(200,168,75,0.12)" : "none",
      }}
      onMouseOver={e => { if (!expanded) e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
      onMouseOut={e => { if (!expanded) e.currentTarget.style.borderColor = "var(--bdr)"; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            {item.engine && (
              <span style={{
                fontSize: 9, padding: "1px 6px", borderRadius: 3,
                background: `${engineColor}18`, color: engineColor,
                fontWeight: 700, letterSpacing: "0.3px", textTransform: "uppercase", flexShrink: 0,
              }}>
                {item.engine}
              </span>
            )}
            {item.category && (
              <span style={{
                fontSize: 9, padding: "1px 6px", borderRadius: 3,
                background: "rgba(99,102,241,0.12)", color: "#a5b4fc",
                fontWeight: 600, flexShrink: 0,
              }}>
                {item.category}
              </span>
            )}
            {hasVars && dnaMode && (
              <span style={{
                fontSize: 9, padding: "1px 6px", borderRadius: 3,
                background: "rgba(200,168,75,0.1)", color: "var(--gold)",
                fontWeight: 700, flexShrink: 0,
              }}>
                DNA ✨
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--t)", lineHeight: 1.3, marginBottom: 4 }}>
            {item.name}
          </p>
          {item.description && (
            <p style={{
              fontSize: 11, color: "var(--t3)", lineHeight: 1.5,
              overflow: expanded ? "visible" : "hidden",
              display: "-webkit-box",
              WebkitLineClamp: expanded ? "unset" : "2",
              WebkitBoxOrient: "vertical" as any,
            }}>
              {item.description}
            </p>
          )}
          {expanded && item.prompt && (
            <div style={{
              marginTop: 10, padding: "10px 12px", borderRadius: 8,
              background: "var(--ink2)", border: "1px solid var(--bdr)",
              fontSize: 11, color: "var(--t2)", lineHeight: 1.6,
              fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {dnaMode ? highlightVars(item.prompt) : item.prompt}
            </div>
          )}
          {item.tags && item.tags.length > 0 && expanded && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
              {item.tags.slice(0, 5).map(tag => (
                <span key={tag} style={{
                  fontSize: 9, padding: "2px 6px", borderRadius: 20,
                  background: "var(--ink3)", color: "var(--t4)",
                }}>#{tag}</span>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
          {isWebCat && (
            <button
              onClick={handleOpenWebDesigner}
              title="Abrir en Web Designer"
              style={{
                background: "rgba(56,189,248,0.1)",
                border: "1px solid rgba(56,189,248,0.3)",
                borderRadius: 7, padding: "6px 8px", cursor: "pointer",
                color: "#38bdf8", transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700,
              }}
              onMouseOver={e => { e.currentTarget.style.background = "rgba(56,189,248,0.2)"; }}
              onMouseOut={e => { e.currentTarget.style.background = "rgba(56,189,248,0.1)"; }}
            >
              <Globe size={12} />
            </button>
          )}
          {dnaMode && (
            <button
              onClick={handleExecute}
              title="Ejecutar con DNA del cliente"
              style={{
                background: "rgba(200,168,75,0.1)",
                border: "1px solid rgba(200,168,75,0.3)",
                borderRadius: 7, padding: "6px 8px", cursor: "pointer",
                color: "var(--gold)", transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700,
              }}
              onMouseOver={e => { e.currentTarget.style.background = "rgba(200,168,75,0.2)"; }}
              onMouseOut={e => { e.currentTarget.style.background = "rgba(200,168,75,0.1)"; }}
            >
              <Zap size={12} />
            </button>
          )}
          <button
            onClick={handleCopy}
            title="Copiar prompt"
            style={{
              flexShrink: 0, background: copied ? "rgba(74,222,128,0.1)" : "var(--ink3)",
              border: `1px solid ${copied ? "rgba(74,222,128,0.3)" : "var(--bdr)"}`,
              borderRadius: 7, padding: "6px 8px", cursor: "pointer",
              color: copied ? "#4ade80" : "var(--t3)", transition: "all 0.15s",
              display: "flex", alignItems: "center", gap: 4, fontSize: 11,
            }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PromptLibrary() {
  const [libIndex, setLibIndex] = useState<LibIndex[]>([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [items, setItems] = useState<MasterItem[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalInLib, setTotalInLib] = useState(0);
  const [copiedMsg, setCopiedMsg] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<"default" | "name" | "engine">("default");
  const [dnaMode, setDnaMode] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [executingItem, setExecutingItem] = useState<MasterItem | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const LIMIT = 24;

  const loadItems = useCallback(async (key: string, q: string, off: number, append = false) => {
    setLoading(true);
    if (!append) setFetchError(null);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(off) });
      if (key) params.set("library", key);
      if (q.trim()) params.set("search", q.trim());
      if (!key && !q.trim()) params.set("all", "1");
      const r = await fetch(`${API_BASE}/api/fs-pro/prompt-library-master?${params}`, { credentials: "include" });
      if (!r.ok) {
        const msg = r.status === 401 ? "Sesión expirada. Recarga la página." : r.status === 403 ? "Sin acceso. Inicia sesión como admin o usuario registrado." : `Error ${r.status} al cargar la librería.`;
        setFetchError(msg);
        if (!append) setItems([]);
        return;
      }
      const data = await r.json();
      const list: MasterItem[] = Array.isArray(data) ? data : (data.items ?? []);
      const total: number = data.total ?? list.length;
      setTotalInLib(total);
      setHasMore(off + list.length < total);
      setItems(prev => append ? [...prev, ...list] : list);
    } catch {
      setFetchError("Error de red. Verifica tu conexión e inténtalo de nuevo.");
      if (!append) setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadIndex = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/fs-pro/prompt-library-master?indexOnly=1`, { credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        let idx: LibIndex[] = [];
        if (Array.isArray(d)) {
          idx = d;
        } else if (Array.isArray(d.libraries)) {
          idx = d.libraries.map((l: any) => ({ key: l.key ?? l.name ?? "", count: l.count ?? l.total ?? 0 }));
        } else if (d.libraries && typeof d.libraries === "object") {
          idx = Object.entries(d.libraries).map(([k, v]: [string, any]) => ({
            key: k,
            count: Array.isArray(v?.templates) ? v.templates.length : (v?.count ?? 0),
          }));
        }
        setLibIndex(idx);
      }
    } catch {}
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/projects`, { credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        setProjects(Array.isArray(d) ? d : (d.projects ?? []));
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadIndex();
    loadProjects();
    loadItems("", "", 0);
  }, [loadIndex, loadProjects, loadItems]);

  const handleCategorySelect = (key: string) => {
    setActiveCategory(key);
    setOffset(0);
    setSearch("");
    setSearchInput("");
    loadItems(key, "", 0);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    setSearch(q);
    setOffset(0);
    loadItems(activeCategory, q, 0);
  };

  const loadMore = () => {
    const next = offset + LIMIT;
    setOffset(next);
    loadItems(activeCategory, search, next, true);
  };

  const handleCopy = (text: string) => {
    const preview = text.length > 40 ? text.slice(0, 40) + "…" : text;
    setCopiedMsg(`Copiado: "${preview}"`);
    setTimeout(() => setCopiedMsg(""), 2500);
  };

  const sortedItems = [...items].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "engine") return (a.engine ?? "").localeCompare(b.engine ?? "");
    return 0;
  });

  const totalTemplates = libIndex.reduce((s, l) => s + l.count, 0) || 6677;

  return (
    <div className="page-inner" style={{ maxWidth: 1100 }}>

      {/* ── HEADER ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--gold)", marginBottom: 6 }}>
              🏛 Biblioteca Maestra
            </p>
            <h1 style={{ fontFamily: "var(--fh)", fontStyle: "italic", fontSize: 26, fontWeight: 900, lineHeight: 1 }}>
              Librería de Prompts
            </h1>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{
              fontSize: 12, padding: "5px 12px", borderRadius: 20,
              background: "rgba(200,168,75,0.1)", color: "var(--gold)",
              border: "1px solid rgba(200,168,75,0.25)", fontWeight: 700,
            }}>
              {totalTemplates.toLocaleString("es-ES")} templates
            </span>
            <span style={{
              fontSize: 12, padding: "5px 12px", borderRadius: 20,
              background: "rgba(99,102,241,0.1)", color: "#a5b4fc",
              border: "1px solid rgba(99,102,241,0.2)", fontWeight: 700,
            }}>
              {libIndex.length || "..."} categorías
            </span>

            {/* DNA MODE TOGGLE */}
            <button
              onClick={() => setDnaMode(m => !m)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 14px", borderRadius: 20, cursor: "pointer",
                background: dnaMode ? "rgba(200,168,75,0.15)" : "var(--ink2)",
                border: dnaMode ? "1px solid rgba(200,168,75,0.4)" : "1px solid var(--bdr)",
                color: dnaMode ? "var(--gold)" : "var(--t3)",
                fontWeight: 700, fontSize: 12,
                transition: "all 0.15s",
                boxShadow: dnaMode ? "0 0 12px rgba(200,168,75,0.15)" : "none",
              }}
            >
              <Brain size={13} />
              {dnaMode ? "Modo DNA ✦ Activo" : "Modo DNA"}
            </button>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "var(--t3)" }}>
          {dnaMode
            ? "🧬 Modo DNA activo — pulsa ⚡ en cualquier template para ejecutarlo con el ADN del cliente."
            : "Explora y copia templates de IA para producto, copy, SEO, email, ads y mucho más."}
        </p>
      </div>

      {/* ── DNA MODE BANNER ── */}
      {dnaMode && (
        <div style={{
          padding: "14px 18px", borderRadius: 12, marginBottom: 20,
          background: "linear-gradient(135deg, rgba(200,168,75,0.08), rgba(200,168,75,0.04))",
          border: "1px solid rgba(200,168,75,0.25)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{ fontSize: 28 }}>🧬</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)", marginBottom: 3 }}>
              Ejecución con DNA de Marca activada
            </p>
            <p style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.5 }}>
              Todas las variables <code style={{ fontSize: 11, background: "rgba(200,168,75,0.15)", padding: "1px 4px", borderRadius: 3 }}>{"{{VARIABLE}}"}</code> se resuelven automáticamente con el ADN del cliente seleccionado (nombre, sector, tono, colores, UVP, audiencia, redes sociales…). El resultado es contenido 100% personalizado, no genérico.
              {projects.length > 0 && <> Tienes <strong style={{ color: "var(--t)" }}>{projects.length} proyectos</strong> disponibles.</>}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, background: "rgba(74,222,128,0.1)", color: "#4ade80", fontWeight: 700 }}>
              ⚡ = Ejecutar
            </span>
            <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, background: "rgba(200,168,75,0.1)", color: "var(--gold)", fontWeight: 700 }}>
              DNA ✨ = Con variables
            </span>
          </div>
        </div>
      )}

      {/* ── SEARCH BAR ── */}
      <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--t4)", pointerEvents: "none" }} />
          <input
            ref={searchRef}
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Buscar prompts… (ej: fotografia producto, email recuperación carrito, SEO descripción…)"
            className="form-input"
            style={{ paddingLeft: 38, width: "100%", boxSizing: "border-box" }}
          />
        </div>
        <button type="submit" className="btn-primary" style={{ padding: "0 18px", flexShrink: 0 }}>
          Buscar
        </button>
        <button
          type="button"
          onClick={() => setShowFilters(f => !f)}
          className="btn"
          style={{ padding: "0 14px", flexShrink: 0, display: "flex", alignItems: "center", gap: 5 }}
        >
          <Filter size={13} />
          Filtros
          <ChevronDown size={11} style={{ transform: showFilters ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        </button>
      </form>

      {/* ── FILTERS PANEL ── */}
      {showFilters && (
        <div className="glass-card" style={{ padding: "14px 16px", marginBottom: 16, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600 }}>Ordenar:</span>
            {(["default", "name", "engine"] as const).map(opt => (
              <button
                key={opt}
                onClick={() => setSortBy(opt)}
                className={sortBy === opt ? "btn-primary" : "btn"}
                style={{ padding: "4px 12px", fontSize: 11 }}
              >
                {opt === "default" ? "Por defecto" : opt === "name" ? "Nombre" : "Motor IA"}
              </button>
            ))}
          </div>
          {libIndex.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600 }}>Librería:</span>
              <select
                value={activeCategory}
                onChange={e => handleCategorySelect(e.target.value)}
                className="form-input"
                style={{ padding: "4px 10px", fontSize: 11, width: "auto" }}
              >
                <option value="">— Todas las librerías —</option>
                {libIndex.map(lib => (
                  <option key={lib.key} value={lib.key}>
                    {lib.key.replace(/_/g, " ")} ({lib.count})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* ── CATEGORY PILL BAR ── */}
      <div style={{ marginBottom: 20 }}>
        <div className="cat-pill-bar" style={{
          display: "flex", alignItems: "center", gap: 6,
          overflowX: "auto", paddingBottom: 6,
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}>
          {EFFECT_CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.key;
            const libInfo = libIndex.find(l => l.key === cat.key);
            return (
              <button
                key={cat.key}
                onClick={() => handleCategorySelect(cat.key)}
                title={cat.desc}
                style={{
                  flexShrink: 0,
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "6px 12px", borderRadius: 20, cursor: "pointer",
                  background: isActive ? `${cat.color}18` : "var(--ink2)",
                  border: isActive ? `1px solid ${cat.color}60` : "1px solid var(--bdr)",
                  color: isActive ? cat.color : "var(--t3)",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 12, whiteSpace: "nowrap",
                  transition: "all 0.15s",
                  boxShadow: isActive ? `0 0 8px ${cat.color}20` : "none",
                }}
                onMouseOver={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.borderColor = `${cat.color}40`; (e.currentTarget as HTMLButtonElement).style.color = "var(--t)"; } }}
                onMouseOut={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--bdr)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--t3)"; } }}
              >
                <span style={{ fontSize: 14 }}>{cat.icon}</span>
                <span>{cat.label}</span>
                {libInfo && (
                  <span style={{
                    fontSize: 9, padding: "1px 5px", borderRadius: 8,
                    background: isActive ? `${cat.color}25` : "rgba(255,255,255,0.06)",
                    color: isActive ? cat.color : "var(--t4)",
                    fontWeight: 700,
                  }}>
                    {libInfo.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {activeCategory && (
          <p style={{ fontSize: 11, color: "var(--t4)", marginTop: 8, lineHeight: 1.4 }}>
            {EFFECT_CATEGORIES.find(c => c.key === activeCategory)?.desc}
          </p>
        )}
      </div>

      {/* ── RESULTS HEADER ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--t3)" }}>
            {search ? `Resultados: "${search}"` : activeCategory ? EFFECT_CATEGORIES.find(c => c.key === activeCategory)?.label ?? "Templates" : "Todos los Templates"}
          </p>
          {!loading && (
            <span style={{
              fontSize: 10, padding: "1px 7px", borderRadius: 10,
              background: "rgba(200,168,75,0.1)", color: "var(--gold)",
            }}>
              {totalInLib.toLocaleString("es-ES")}
            </span>
          )}
        </div>
        {search && (
          <button
            onClick={() => { setSearch(""); setSearchInput(""); setOffset(0); loadItems(activeCategory, "", 0); }}
            className="btn"
            style={{ fontSize: 11, padding: "3px 10px" }}
          >
            × Limpiar búsqueda
          </button>
        )}
      </div>

      {/* ── Error banner ── */}
      {fetchError && (
        <div style={{ marginBottom: 16, padding: "14px 18px", borderRadius: 12, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#f87171", marginBottom: 2 }}>Error al cargar la librería</p>
            <p style={{ fontSize: 12, color: "rgba(248,113,113,.75)" }}>{fetchError}</p>
          </div>
          <button onClick={() => { setFetchError(null); loadItems(activeCategory, search, 0); }}
            style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(239,68,68,.3)", background: "rgba(239,68,68,.1)", color: "#f87171", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            Reintentar
          </button>
        </div>
      )}

      {/* ── ITEMS GRID ── */}
      {loading && items.length === 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 90, borderRadius: 12 }} />
          ))}
        </div>
      ) : sortedItems.length === 0 ? (
        <div className="glass-card" style={{ padding: "40px", textAlign: "center" }}>
          <p style={{ fontSize: 28, marginBottom: 10 }}>🔍</p>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--t)", marginBottom: 6 }}>Sin resultados</p>
          <p style={{ fontSize: 13, color: "var(--t3)" }}>
            {search ? `No hay templates para "${search}". Prueba con otro término.` : "Selecciona una categoría o realiza una búsqueda."}
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10, marginBottom: 20 }}>
            {sortedItems.map((item, i) => (
              <EffectPreviewCard
                key={item.id ?? i}
                item={item}
                onCopy={handleCopy}
                onExecute={setExecutingItem}
                dnaMode={dnaMode}
                activeCategory={activeCategory}
              />
            ))}
          </div>

          {hasMore && (
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <button
                onClick={loadMore}
                disabled={loading}
                className="btn"
                style={{ padding: "10px 28px", fontSize: 13, opacity: loading ? 0.6 : 1 }}
              >
                {loading ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Zap size={13} style={{ animation: "pulseGold 0.8s ease-in-out infinite" }} />
                    Cargando…
                  </span>
                ) : (
                  `Cargar más (mostrando ${items.length} de ${totalInLib.toLocaleString("es-ES")})`
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── COPIED TOAST ── */}
      {copiedMsg && (
        <div style={{
          position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
          background: "var(--ink2)", border: "1px solid rgba(74,222,128,0.3)",
          borderRadius: 10, padding: "10px 18px",
          fontSize: 12, color: "#4ade80", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 7,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)", zIndex: 9999,
          animation: "fadeSlideUp 0.2s ease-out",
        }}>
          <Check size={14} />
          {copiedMsg}
        </div>
      )}

      {/* ── INFO PANEL ── */}
      <div className="glass-card" style={{ padding: "20px 24px", marginTop: 8, display: "flex", gap: 24, flexWrap: "wrap" }}>
        {[
          { icon: <BookOpen size={16} />, label: "Librería Maestra", value: `${totalTemplates.toLocaleString("es-ES")} prompts`, color: "var(--gold)" },
          { icon: <Sparkles size={16} />, label: "Categorías activas", value: `${libIndex.length || EFFECT_CATEGORIES.length - 1}`, color: "#a78bfa" },
          { icon: <Star size={16} />, label: "Motores IA", value: "Claude · GPT · Gemini · Flux", color: "var(--jade)" },
          { icon: <Hash size={16} />, label: "Casos de uso", value: "Copy · SEO · Imagen · Email · Ad", color: "#f59e0b" },
          { icon: <Brain size={16} />, label: "Modo DNA", value: dnaMode ? "✦ Activo" : "Inactivo", color: dnaMode ? "var(--gold)" : "var(--t4)" },
          { icon: <Clock size={16} />, label: "Actualización", value: "Continua · IA aprendiendo", color: "#06b6d4" },
        ].map(item => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 160 }}>
            <div style={{ color: item.color, flexShrink: 0 }}>{item.icon}</div>
            <div>
              <p style={{ fontSize: 11, color: "var(--t3)", marginBottom: 1 }}>{item.label}</p>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--t)" }}>{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── EXECUTION PANEL ── */}
      {executingItem && (
        <ExecutionPanel
          item={executingItem}
          projects={projects}
          onClose={() => setExecutingItem(null)}
        />
      )}

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
