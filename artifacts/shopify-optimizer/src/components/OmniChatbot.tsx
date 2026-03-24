import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, X, Send, Loader2, Minimize2, Maximize2, Bot, Sparkles, Brain, Zap, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  model?: string;
  action?: ChatAction;
}

interface ChatAction {
  type: "klaviyo-workflow" | "research" | "analysis";
  label: string;
  data: unknown;
}

interface KlaviyoWorkflowResult {
  plan: {
    storeName: string;
    shopDomain: string;
    flows: Array<{
      id: string;
      name: string;
      trigger: string;
      description: string;
      priority: string;
      estimated_revenue: string;
      emails: Array<{
        position: number;
        delay: string;
        subject: string;
        preview_text: string;
        html_body: string;
        purpose: string;
        key_cta: string;
      }>;
    }>;
    segments: Array<{ name: string; definition: string; use_case: string }>;
    expected_revenue_impact: string;
    implementation_order: string[];
  };
  marketIntel: {
    topFlows: string[];
    avgCartValue: string;
    conversionTips: string[];
  };
}

const QUICK_ACTIONS = [
  { icon: "📧", label: "Flujos Klaviyo para Comic Crafter", prompt: "Genera un workflow completo de Klaviyo para la tienda comic-crafter.myshopify.com (Comic Crafter, nicho: comics y arte). Crea todos los flujos esenciales con las plantillas de email completas." },
  { icon: "🔍", label: "Analizar mercado", prompt: "Analiza el mercado de comics y arte en España para una tienda Shopify. Dame inteligencia de mercado completa." },
  { icon: "🧠", label: "Estado OmniCore", prompt: "¿Qué memorias y conocimiento tiene ahora mismo el OmniCore Brain? Dame un resumen del estado actual." },
  { icon: "💡", label: "Estrategia SEO", prompt: "Dame una estrategia SEO completa para la tienda comic-crafter.myshopify.com en el nicho de comics, arte y cultura pop." },
];

const SYSTEM_PROMPT = `Eres OmniCore AI — el asistente central de la plataforma ShopyBrain para agencias Shopify.
Tienes acceso a tres inteligencias artificiales:
- 🔬 Gemini (Google) — investigación de mercado, análisis de negocios, inteligencia competitiva
- 🧠 Claude (Anthropic) — estrategia, contenido de calidad, análisis profundo
- 💾 OmniCore Brain — memoria acumulada de todos los nichos, clientes y patrones de éxito

Eres experto en:
- Shopify (optimización, SEO, productos, conversión)
- Klaviyo (flows, segmentación, email marketing, templates)
- eCommerce (pricing, COGS, márgenes, A/B testing)
- Marketing digital (SEO técnico, imágenes IA, copy de producto)
- Generación de contenido (descripciones, títulos, emails, anuncios)

Cuando el usuario pide generar workflows de Klaviyo, primero confirma los detalles (tienda, nicho, mercado) y luego lanza el generador.
Cuando el usuario pide investigación, usa tu conocimiento combinado Gemini+Claude.
Siempre responde en español, de forma directa, clara y accionable.
Si hay acciones disponibles (generar workflow, investigar mercado, etc.), indícalas claramente.`;

function formatMessage(content: string): React.ReactNode {
  const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`|\n)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} style={{ color: "var(--gold)", fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} style={{ background: "var(--ink3)", padding: "1px 5px", borderRadius: 4, fontSize: 11, fontFamily: "monospace", color: "var(--jade)" }}>{part.slice(1, -1)}</code>;
    }
    if (part === "\n") return <br key={i} />;
    return part;
  });
}

function KlaviyoResultCard({ data, onViewFlow }: { data: KlaviyoWorkflowResult; onViewFlow: (flow: KlaviyoWorkflowResult["plan"]["flows"][0]) => void }) {
  const { plan, marketIntel } = data;
  return (
    <div style={{ marginTop: 12, border: "1px solid rgba(200,168,75,0.3)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ background: "rgba(200,168,75,0.08)", padding: "10px 14px", borderBottom: "1px solid rgba(200,168,75,0.2)" }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--gold)" }}>📧 Klaviyo Workflow Plan — {plan.storeName}</p>
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
            <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 8, background: flow.priority === "critical" ? "rgba(232,69,88,0.15)" : flow.priority === "high" ? "rgba(200,168,75,0.15)" : "rgba(45,212,159,0.15)", color: flow.priority === "critical" ? "var(--crim)" : flow.priority === "high" ? "var(--gold)" : "var(--jade)", fontWeight: 700 }}>{flow.priority}</span>
          </div>
        ))}
        {marketIntel?.conversionTips?.length > 0 && (
          <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 6, background: "rgba(45,212,159,0.05)", border: "1px solid rgba(45,212,159,0.15)" }}>
            <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 700, color: "var(--jade)" }}>💡 Tips de conversión para {plan.storeName}</p>
            {marketIntel.conversionTips.slice(0, 2).map((tip, i) => <p key={i} style={{ margin: "2px 0", fontSize: 10, color: "var(--t3)" }}>· {tip}</p>)}
          </div>
        )}
      </div>
    </div>
  );
}

function FlowModal({ flow, onClose }: { flow: KlaviyoWorkflowResult["plan"]["flows"][0]; onClose: () => void }) {
  const [activeEmail, setActiveEmail] = useState(0);
  const [copied, setCopied] = useState(false);

  const copyHtml = async () => {
    const email = flow.emails?.[activeEmail];
    if (!email) return;
    await navigator.clipboard.writeText(email.html_body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--ink)", border: "1px solid var(--ink3)", borderRadius: 14, width: "100%", maxWidth: 900, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--ink3)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--t)" }}>{flow.name}</h3>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--t3)" }}>Trigger: {flow.trigger} · {flow.emails?.length} emails</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={copyHtml} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--ink3)", background: copied ? "var(--jade)" : "var(--ink2)", color: copied ? "var(--ink)" : "var(--t)", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
              {copied ? "✓ Copiado" : "📋 Copiar HTML"}
            </button>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--ink3)", background: "var(--ink2)", color: "var(--t3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 0, flex: 1, overflow: "hidden" }}>
          <div style={{ width: 200, borderRight: "1px solid var(--ink3)", padding: 12, overflowY: "auto", flexShrink: 0 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.6px", margin: "0 0 8px" }}>Emails del flow</p>
            {flow.emails?.map((email, i) => (
              <button key={i} onClick={() => setActiveEmail(i)}
                style={{ width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 6, marginBottom: 4, border: "none", cursor: "pointer", background: activeEmail === i ? "rgba(200,168,75,0.12)" : "transparent", color: activeEmail === i ? "var(--gold)" : "var(--t3)" }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 600 }}>Email {email.position}</p>
                <p style={{ margin: "2px 0 0", fontSize: 9, opacity: 0.7 }}>📅 {email.delay}</p>
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {flow.emails?.[activeEmail] && (() => {
              const email = flow.emails[activeEmail];
              return (
                <div>
                  <div style={{ marginBottom: 14 }}>
                    <p style={{ fontSize: 10, color: "var(--t3)", fontWeight: 700, textTransform: "uppercase", margin: "0 0 4px" }}>Asunto</p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t)", margin: 0, background: "var(--ink2)", padding: "8px 12px", borderRadius: 6 }}>{email.subject}</p>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <p style={{ fontSize: 10, color: "var(--t3)", fontWeight: 700, textTransform: "uppercase", margin: "0 0 4px" }}>Preview text</p>
                    <p style={{ fontSize: 12, color: "var(--t2)", margin: 0, background: "var(--ink2)", padding: "6px 12px", borderRadius: 6 }}>{email.preview_text}</p>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <p style={{ fontSize: 10, color: "var(--t3)", fontWeight: 700, textTransform: "uppercase", margin: 0 }}>HTML Template</p>
                      <span style={{ fontSize: 10, color: "var(--jade)", background: "rgba(45,212,159,0.1)", padding: "2px 8px", borderRadius: 10 }}>Copia y pega en Klaviyo</span>
                    </div>
                    <textarea
                      readOnly
                      value={email.html_body}
                      style={{ width: "100%", minHeight: 200, padding: "10px 12px", background: "var(--ink)", border: "1px solid var(--ink3)", borderRadius: 8, color: "var(--t3)", fontSize: 10, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ background: "var(--ink2)", padding: "8px 12px", borderRadius: 6 }}>
                      <p style={{ fontSize: 9, color: "var(--t3)", fontWeight: 700, textTransform: "uppercase", margin: "0 0 4px" }}>Propósito</p>
                      <p style={{ fontSize: 11, color: "var(--t)", margin: 0 }}>{email.purpose}</p>
                    </div>
                    <div style={{ background: "var(--ink2)", padding: "8px 12px", borderRadius: 6 }}>
                      <p style={{ fontSize: 9, color: "var(--t3)", fontWeight: 700, textTransform: "uppercase", margin: "0 0 4px" }}>CTA Principal</p>
                      <p style={{ fontSize: 11, color: "var(--gold)", margin: 0 }}>{email.key_cta}</p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OmniChatbot() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `¡Hola${user?.name ? ` ${user.name.split(" ")[0]}` : ""}! 👋 Soy **OmniCore AI**, tu asistente central conectado a **Gemini**, **Claude** y el **Brain**.

Puedo ayudarte con:
· 📧 Generar flujos completos de Klaviyo con plantillas HTML listas
· 🔍 Investigar mercados y competidores (Gemini Research)
· 🧠 Estrategia de pricing, SEO, conversión y contenido
· 💡 Cualquier tarea de optimización Shopify

¿Con qué empezamos?`,
      timestamp: new Date(),
      model: "omnicore",
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<KlaviyoWorkflowResult["plan"]["flows"][0] | null>(null);
  const [showActions, setShowActions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const detectKlaviyoRequest = (text: string): { isKlaviyo: boolean; shopDomain?: string; storeName?: string; niche?: string } => {
    const lower = text.toLowerCase();
    const isKlaviyo = lower.includes("klaviyo") || lower.includes("flow") || lower.includes("email marketing") || lower.includes("plantilla") || lower.includes("workflow") || lower.includes("flujo");
    if (!isKlaviyo) return { isKlaviyo: false };

    const domainMatch = text.match(/([a-zA-Z0-9-]+\.myshopify\.com)/);
    const shopDomain = domainMatch?.[1] ?? "comic-crafter.myshopify.com";
    const storeName = shopDomain.split(".")[0].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

    const nicheKeywords: Record<string, string> = {
      comic: "Comics y Arte", arte: "Arte y Cultura", moda: "Moda y Ropa", tech: "Electrónica", joya: "Joyería",
      belleza: "Belleza", cosmet: "Cosmética", mascota: "Mascotas", deport: "Deportes", hogar: "Hogar y Decoración",
    };
    let niche = "Comics y Arte";
    for (const [key, val] of Object.entries(nicheKeywords)) {
      if (lower.includes(key)) { niche = val; break; }
    }

    return { isKlaviyo: true, shopDomain, storeName, niche };
  };

  const generateKlaviyoWorkflow = async (shopDomain: string, storeName: string, niche: string): Promise<KlaviyoWorkflowResult | null> => {
    try {
      const res = await fetch(`${API}/api/klaviyo-ai/generate-workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ shopDomain, storeName, niche, market: "es" }),
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } catch (err) {
      console.error("Klaviyo workflow failed:", err);
      return null;
    }
  };

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const userMsg: Message = { id: uuid(), role: "user", content, timestamp: new Date() };
    setMessages(m => [...m, userMsg]);
    setInput("");
    setLoading(true);

    const klaviyoInfo = detectKlaviyoRequest(content);

    try {
      let assistantContent = "";
      let action: ChatAction | undefined;

      if (klaviyoInfo.isKlaviyo) {
        const { shopDomain, storeName, niche } = klaviyoInfo;
        assistantContent = `🔄 Lanzando generación de workflow Klaviyo para **${storeName}** (${shopDomain}) en el nicho **${niche}**...\n\n**Paso 1:** Gemini analiza el mercado de ${niche} en España\n**Paso 2:** Claude diseña los 6 flujos esenciales con emails completos\n**Paso 3:** OmniCore guarda el conocimiento en el Brain\n\nEsto puede tardar 30-60 segundos...`;

        setMessages(m => [...m, {
          id: uuid(), role: "assistant", content: assistantContent, timestamp: new Date(), model: "gemini+claude"
        }]);

        const result = await generateKlaviyoWorkflow(shopDomain!, storeName!, niche!);

        if (result?.plan) {
          const flowNames = result.plan.flows?.map(f => `· **${f.name}** — ${f.emails?.length} emails`).join("\n") ?? "";
          assistantContent = `✅ **Workflow completo generado para ${storeName}!**\n\n**${result.plan.flows?.length ?? 0} flujos creados:**\n${flowNames}\n\n**Impacto esperado:** ${result.plan.expected_revenue_impact}\n\nHaz clic en cualquier flow para ver y copiar las plantillas HTML completas. Están listas para pegar en el editor de Klaviyo.`;
          action = { type: "klaviyo-workflow", label: "Ver flows generados", data: result };
        } else {
          assistantContent = "❌ Error generando el workflow. Verifica que KLAVIYO_API_KEY y GEMINI_API_KEY estén configuradas.";
        }
      } else {
        const conversationHistory = messages.slice(-10).map(m => `${m.role === "user" ? "Usuario" : "OmniCore"}: ${m.content}`).join("\n\n");
        const res = await fetch(`${API}/api/shopybrain/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            query: content,
            systemPrompt: SYSTEM_PROMPT,
            conversationHistory,
            returnRaw: true,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          assistantContent = data.answer ?? data.result ?? data.content ?? "No pude procesar la respuesta.";
        } else {
          assistantContent = "Lo siento, hubo un error procesando tu mensaje. El servidor está ocupado.";
        }
      }

      setMessages(m => {
        const filtered = m.filter(msg => !(msg.role === "assistant" && msg.content.includes("Paso 1")));
        return [...filtered, {
          id: uuid(),
          role: "assistant",
          content: assistantContent,
          timestamp: new Date(),
          model: klaviyoInfo.isKlaviyo ? "gemini+claude+omnicore" : "claude+omnicore",
          action,
        }];
      });
    } catch (err) {
      setMessages(m => [...m, {
        id: uuid(), role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : "Fallo de conexión"}`,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, loading, messages]);

  function uuid() { return Math.random().toString(36).slice(2); }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (!user) return null;

  return (
    <>
      {selectedFlow && <FlowModal flow={selectedFlow} onClose={() => setSelectedFlow(null)} />}

      {!open && (
        <button onClick={() => setOpen(true)} style={{
          position: "fixed", bottom: 24, right: 24, width: 56, height: 56,
          borderRadius: "50%", background: "linear-gradient(135deg, var(--gold), #e6c668)",
          border: "none", cursor: "pointer", zIndex: 1000, boxShadow: "0 4px 20px rgba(200,168,75,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "pulse-gold 3s ease-in-out infinite",
        }}>
          <Brain size={24} style={{ color: "var(--ink)" }} />
        </button>
      )}

      {open && (
        <div style={{
          position: "fixed", bottom: 24, right: 24,
          width: minimized ? 280 : 420,
          height: minimized ? 52 : 620,
          background: "var(--ink)", border: "1px solid rgba(200,168,75,0.3)",
          borderRadius: 16, zIndex: 1000, display: "flex", flexDirection: "column",
          boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(200,168,75,0.1)",
          transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          overflow: "hidden",
        }}>
          <div style={{
            padding: "12px 14px", borderBottom: minimized ? "none" : "1px solid var(--ink3)",
            background: "linear-gradient(135deg, rgba(200,168,75,0.08), rgba(200,168,75,0.04))",
            display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
          }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, var(--gold), #a07830)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Brain size={16} style={{ color: "#fff" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--t)" }}>OmniCore AI</p>
              {!minimized && <p style={{ margin: 0, fontSize: 10, color: "var(--jade)" }}>Gemini · Claude · Brain — Online</p>}
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
              <div style={{ flex: 1, overflowY: "auto", padding: "14px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
                {messages.map(msg => (
                  <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{
                      maxWidth: "88%", padding: "10px 12px", borderRadius: msg.role === "user" ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
                      background: msg.role === "user" ? "rgba(200,168,75,0.15)" : "var(--ink2)",
                      border: `1px solid ${msg.role === "user" ? "rgba(200,168,75,0.3)" : "var(--ink3)"}`,
                      fontSize: 12, lineHeight: 1.6, color: "var(--t)",
                    }}>
                      {msg.role === "assistant" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                          <Brain size={10} style={{ color: "var(--gold)", flexShrink: 0 }} />
                          <span style={{ fontSize: 9, color: "var(--gold)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            {msg.model === "gemini+claude+omnicore" ? "Gemini + Claude + Brain" : msg.model === "claude+omnicore" ? "Claude + Brain" : "OmniCore"}
                          </span>
                        </div>
                      )}
                      <div>{formatMessage(msg.content)}</div>
                      {msg.action?.type === "klaviyo-workflow" && (
                        <KlaviyoResultCard data={msg.action.data as KlaviyoWorkflowResult} onViewFlow={setSelectedFlow} />
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
                    <span style={{ fontSize: 11, color: "var(--t3)" }}>OmniCore pensando...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div style={{ padding: "8px 12px", borderTop: "1px solid var(--ink3)", flexShrink: 0 }}>
                <button onClick={() => setShowActions(!showActions)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "var(--t3)", fontSize: 10, cursor: "pointer", marginBottom: 6, padding: "2px 0" }}>
                  <Sparkles size={10} />
                  Acciones rápidas
                  <ChevronDown size={9} style={{ transform: showActions ? "rotate(180deg)" : "rotate(0)", transition: "0.2s" }} />
                </button>
                {showActions && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 8 }}>
                    {QUICK_ACTIONS.map((action, i) => (
                      <button key={i} onClick={() => { setShowActions(false); sendMessage(action.prompt); }}
                        style={{ textAlign: "left", padding: "6px 8px", background: "var(--ink2)", border: "1px solid var(--ink3)", borderRadius: 6, cursor: "pointer", fontSize: 10, color: "var(--t2)", display: "flex", alignItems: "center", gap: 5 }}>
                        <span>{action.icon}</span>
                        <span style={{ lineHeight: 1.2 }}>{action.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                    placeholder="Escribe o usa acciones rápidas..."
                    rows={1}
                    style={{
                      flex: 1, padding: "8px 10px", background: "var(--ink2)", border: "1px solid var(--ink3)",
                      borderRadius: 8, color: "var(--t)", fontSize: 12, resize: "none", outline: "none",
                      fontFamily: "inherit", lineHeight: 1.4, maxHeight: 80, overflowY: "auto",
                    }}
                    onInput={e => {
                      const el = e.target as HTMLTextAreaElement;
                      el.style.height = "auto";
                      el.style.height = `${Math.min(el.scrollHeight, 80)}px`;
                    }}
                  />
                  <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
                    style={{
                      width: 32, height: 32, borderRadius: 8, border: "none", flexShrink: 0,
                      background: loading || !input.trim() ? "var(--ink3)" : "var(--gold)",
                      color: loading || !input.trim() ? "var(--t4)" : "var(--ink)",
                      cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
                    }}>
                    {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={14} />}
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, justifyContent: "center" }}>
                  {[["🔬", "Gemini"], ["🧠", "Claude"], ["💾", "Brain"]].map(([icon, label]) => (
                    <span key={label} style={{ fontSize: 9, color: "var(--t4)", display: "flex", alignItems: "center", gap: 3 }}>{icon} {label}</span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse-gold {
          0%, 100% { box-shadow: 0 4px 20px rgba(200,168,75,0.4); }
          50% { box-shadow: 0 4px 30px rgba(200,168,75,0.7), 0 0 0 8px rgba(200,168,75,0.1); }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
