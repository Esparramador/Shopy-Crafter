import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCms } from "@/contexts/CmsContext";
import { ClientLayout } from "./ClientLayout";
import { useClientPreview } from "./ClientPreviewContext";
import { Link } from "wouter";
import { timeSince } from "@/lib/utils";
import WooCommerceDashboard from "./WooCommerceDashboard";
import PrestaShopDashboard from "./PrestaShopDashboard";
import StripeDashboard from "./StripeDashboard";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface DashData {
  totalProducts: number; avgScore: number | null; pendingApprovals: number;
  enginesActive: number; lastOptimized: string | null;
  recentActivity: Array<{ id: string; action: string; details: string; createdAt: string }>;
  projectName: string | null; shopDomain: string | null; platformType?: string | null;
}
interface VaultFile { id: string; title: string; category: string; fileType: string; createdAt: string; downloadUrl?: string; }
interface BrandDnaData {
  tone_of_voice?: string | null;
  target_audience?: string | null;
  brand_personality?: string | null;
  sector?: string | null;
  company_description?: string | null;
  unique_value_proposition?: string | null;
  taglines?: string[] | null;
  brand_archetype?: string | null;
  primary_colors?: string[] | null;
  content_pillars?: string[] | null;
  website_url?: string | null;
  extraction_status?: string | null;
}

function useCountUp(target: number, duration = 1100) {
  const [n, setN] = useState(0);
  const raf = useRef<number>(undefined);
  useEffect(() => {
    if (!target) { setN(0); return; }
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);
  return n;
}

function Spark({ vals, color }: { vals: number[]; color: string }) {
  if (vals.length < 2) return null;
  const max = Math.max(...vals, 1); const w = 80; const h = 28;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - (v / max) * (h - 2) - 1}`).join(" ");
  return (
    <svg width={w} height={h} style={{ overflow: "visible", opacity: 0.65 }}>
      <defs>
        <linearGradient id={`sg-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ACT_MAP: Record<string, { icon: string; color: string }> = {
  audit: { icon: "🔍", color: "#60a5fa" }, optimize: { icon: "⚡", color: "#c9a961" },
  image: { icon: "🖼", color: "#a78bfa" }, seo: { icon: "🔎", color: "#34d399" },
  approve: { icon: "✅", color: "#22c55e" }, reject: { icon: "❌", color: "#f43f5e" },
  generate: { icon: "🤖", color: "#f59e0b" }, price: { icon: "💰", color: "#34d399" },
  ab: { icon: "📊", color: "#60a5fa" }, design: { icon: "✏️", color: "#a78bfa" },
};
function actStyle(action: string) {
  const k = Object.keys(ACT_MAP).find(k => action.toLowerCase().includes(k));
  return ACT_MAP[k ?? ""] ?? { icon: "📋", color: "#6b7280" };
}

const ENGINES = [
  { name: "Auditoría de Productos", icon: "🔍", color: "#60a5fa", pct: 88 },
  { name: "Rediseño IA", icon: "✏️", color: "#a78bfa", pct: 72 },
  { name: "Generación de Imágenes", icon: "🖼", color: "#f472b6", pct: 65 },
  { name: "Consistencia Visual", icon: "🎨", color: "#34d399", pct: 91 },
  { name: "A/B Testing", icon: "📊", color: "#f59e0b", pct: 55 },
  { name: "SEO & Contenido", icon: "🔎", color: "#22c55e", pct: 80 },
  { name: "Precios Inteligentes", icon: "💰", color: "#c9a961", pct: 78 },
];

export default function ClientDashboard() {
  const { user } = useAuth();
  const { content: cmsContent } = useCms();
  const cmsGreetingName: string | undefined = (cmsContent?.clientPanel as any)?.greetingName;
  const { previewPid } = useClientPreview();
  const isAdmin = user?.role === "admin";
  function apid(url: string) { return isAdmin && previewPid ? `${url}${url.includes("?") ? "&" : "?"}pid=${encodeURIComponent(previewPid)}` : url; }
  const [data, setData] = useState<DashData | null>(null);
  const [vault, setVault] = useState<VaultFile[]>([]);
  const [brandDna, setBrandDna] = useState<BrandDnaData | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"activity" | "engines" | "reports">("activity");
  const [greeting, setGreeting] = useState("Hola");
  const [msgDraft, setMsgDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Buenos días" : h < 20 ? "Buenas tardes" : "Buenas noches");
    setLoading(true);
    Promise.all([
      fetch(apid(`${API}/client/dashboard`), { credentials: "include" }).then(r => r.json()),
      fetch(apid(`${API}/client/vault-files`), { credentials: "include" }).then(r => r.json()).catch(() => []),
      fetch(apid(`${API}/client/brand-dna`), { credentials: "include" }).then(r => r.json()).catch(() => ({ ok: false })),
    ]).then(([d, v, bdna]) => {
      setData(d?.totalProducts !== undefined ? d : null);
      setVault(Array.isArray(v) ? v : []);
      setBrandDna(bdna?.ok && bdna.brandDna ? bdna.brandDna : null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [previewPid]);

  const prod = useCountUp(data?.totalProducts ?? 0);
  const score = useCountUp(data?.avgScore ?? 0);
  const eng = useCountUp(data?.enginesActive ?? 0);
  const pend = useCountUp(data?.pendingApprovals ?? 0);

  const quickSend = useCallback(async () => {
    if (!msgDraft.trim()) return;
    setSending(true);
    await fetch(apid(`${API}/client/messages`), { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ content: msgDraft.trim() }) }).catch(() => {});
    setSending(false); setSent(true); setMsgDraft("");
    setTimeout(() => setSent(false), 3000);
  }, [msgDraft]);

  const kpis = [
    { label: "Productos", value: prod, suffix: "", icon: "📦", color: "#60a5fa", spark: [12,16,18,22,24,data?.totalProducts??24], sub: "en catálogo", href: "/client/products" },
    { label: "Score Promedio", value: score, suffix: "/100", icon: "📊", color: "var(--jade)", spark: [52,58,62,66,70,data?.avgScore??70], sub: "calidad IA", href: null },
    { label: "Motores IA", value: eng, suffix: "", icon: "⚡", color: "var(--gold)", spark: [4,5,5,6,6,data?.enginesActive??6], sub: "activos 24/7", href: null },
    { label: "Aprobaciones", value: pend, suffix: "", icon: "✅", color: "#f59e0b", spark: [0,1,2,3,2,data?.pendingApprovals??0], sub: "pendientes", href: "/client/approvals" },
  ];

  // ── PLATFORM ROUTING ─────────────────────────────────────────────────────────
  const platformType = data?.platformType ?? null;
  if (!loading && platformType === "woocommerce") {
    return (
      <ClientLayout>
        <div style={{ maxWidth: 1020 }}>
          <WooCommerceDashboard apid={apid} />
        </div>
      </ClientLayout>
    );
  }
  if (!loading && platformType === "prestashop") {
    return (
      <ClientLayout>
        <div style={{ maxWidth: 1020 }}>
          <PrestaShopDashboard apid={apid} />
        </div>
      </ClientLayout>
    );
  }
  if (!loading && platformType === "stripe") {
    return (
      <ClientLayout>
        <div style={{ maxWidth: 1020 }}>
          <StripeDashboard apid={apid} />
        </div>
      </ClientLayout>
    );
  }
  // ── SHOPIFY / DEFAULT (existing dashboard) ────────────────────────────────────

  return (
    <ClientLayout>
      <style>{`
        @keyframes aurora{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        @keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes kpi-in{from{opacity:0;transform:translateY(10px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes ping{0%{transform:scale(1);opacity:0.6}100%{transform:scale(2);opacity:0}}
        @keyframes shimmer-bar{0%{background-position:-200% center}100%{background-position:200% center}}
        .dash-kpi{transition:transform 0.2s,box-shadow 0.2s!important;cursor:default;}
        .dash-kpi:hover{transform:translateY(-4px) scale(1.025)!important;box-shadow:0 16px 44px rgba(0,0,0,0.45)!important;}
        .act-row{transition:background 0.12s!important;}
        .act-row:hover{background:rgba(255,255,255,0.04)!important;}
        .vault-row{transition:background 0.12s!important;}
        .vault-row:hover{background:rgba(201,169,97,0.06)!important;}
        .eng-row{transition:background 0.12s!important;}
        .eng-row:hover{background:rgba(255,255,255,0.04)!important;}
        .dash-tab{transition:all 0.15s!important;}
        .quick-send:hover:not(:disabled){filter:brightness(1.15)!important;}
        .action-btn{transition:all 0.18s!important;}
        .action-btn:hover{transform:translateY(-1px)!important;}
      `}</style>

      <div style={{ maxWidth: 1020, animation: "rise 0.4s ease forwards" }}>

        {/* ═══ HERO GREETING ═══ */}
        <div style={{
          background: "linear-gradient(120deg,#09091200 0%,#0f0e1a 35%,#111120 65%,#0c0c18 100%)",
          backgroundSize: "400% 400%", animation: "aurora 14s ease infinite",
          borderRadius: 18, padding: "26px 28px 22px",
          border: "1px solid rgba(201,169,97,0.14)", marginBottom: 18,
          position: "relative", overflow: "hidden",
          boxShadow: "0 4px 30px rgba(0,0,0,0.4)",
        }}>
          {[
            { left: "-4%", top: "-50%", s: 320, c: "rgba(201,169,97,0.07)" },
            { right: "3%", top: "-30%", s: 240, c: "rgba(42,122,75,0.06)" },
            { right: "28%", bottom: "-60%", s: 280, c: "rgba(96,165,250,0.05)" },
          ].map((o, i) => (
            <div key={i} style={{ position: "absolute", width: o.s, height: o.s, borderRadius: "50%", background: `radial-gradient(circle,${o.c} 0%,transparent 70%)`, left: o.left, right: o.right, top: o.top, bottom: o.bottom, pointerEvents: "none" }} />
          ))}
          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--jade)" }} />
                  <div style={{ position: "absolute", inset: -4, borderRadius: "50%", border: "1.5px solid var(--jade)", animation: "ping 2s ease infinite" }} />
                </div>
                <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--jade)", fontWeight: 600 }}>Tu agencia trabaja 24/7 para ti</span>
              </div>
              <h1 style={{ fontFamily: "var(--fh)", fontStyle: "italic", fontSize: 32, fontWeight: 400, margin: 0, lineHeight: 1.1 }}>
                {greeting}, <span style={{ color: "var(--gold2)" }}>{cmsGreetingName ?? data?.projectName ?? user?.name?.split(" ")[0] ?? ""}.</span>
              </h1>
              {data?.lastOptimized && (
                <p style={{ fontSize: 11.5, color: "var(--t3)", marginTop: 7, display: "flex", alignItems: "center", gap: 5 }}>
                  🕐 Última optimización: <strong style={{ color: "var(--t2)" }}>{timeSince(data.lastOptimized)}</strong>
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Link href="/client/messages">
                <button className="action-btn" style={{ padding: "9px 18px", background: "linear-gradient(135deg,#c9a961,#8b6914)", border: "none", borderRadius: 10, color: "#0a0a0f", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 4px 16px rgba(201,169,97,0.3)" }}>
                  💬 Contactar agencia
                </button>
              </Link>
              <Link href="/client/reports">
                <button className="action-btn" style={{ padding: "9px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "var(--t2)", fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  📊 Reportes & descargas
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* ═══ KPI GRID ═══ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(215px,1fr))", gap: 12, marginBottom: 16 }}>
          {kpis.map((k, idx) => (
            <div key={k.label} className="dash-kpi" onClick={() => k.href && (window.location.href = k.href)} style={{
              background: "var(--srf)", borderRadius: 16, padding: "18px 16px",
              border: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              position: "relative", overflow: "hidden",
              animation: `kpi-in 0.4s ${idx * 0.06}s ease both`,
              cursor: k.href ? "pointer" : "default",
            }}>
              <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 110% 110%, ${k.color}14 0%, transparent 65%)`, pointerEvents: "none" }} />
              <div style={{ position: "absolute", top: 12, right: 14, opacity: 0.6 }}>
                <Spark vals={k.spark} color={k.color} />
              </div>
              <div style={{ fontSize: 22, marginBottom: 5 }}>{k.icon}</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: k.color, lineHeight: 1, letterSpacing: "-0.02em" }}>
                {loading ? "—" : `${k.value}${k.suffix}`}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)", marginTop: 4 }}>{k.label}</div>
              <div style={{ fontSize: 10.5, color: "var(--t3)", marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* ═══ BRAND DNA CARD ═══ */}
        {!loading && brandDna && (
          <div style={{
            background: "linear-gradient(135deg,rgba(201,169,97,0.06) 0%,rgba(42,122,75,0.04) 100%)",
            border: "1px solid rgba(201,169,97,0.18)", borderRadius: 16,
            padding: "18px 22px", marginBottom: 16,
            boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(201,169,97,0.12)", border: "1px solid rgba(201,169,97,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>🧬</div>
                <div>
                  <p style={{ fontSize: 10, color: "var(--gold)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, margin: 0 }}>ADN de Tu Marca</p>
                  {brandDna.sector && <p style={{ fontSize: 11, color: "var(--t3)", margin: 0, marginTop: 1 }}>{brandDna.sector}</p>}
                </div>
              </div>
              {brandDna.brand_archetype && (
                <span style={{ fontSize: 11, color: "var(--gold2)", background: "rgba(201,169,97,0.1)", border: "1px solid rgba(201,169,97,0.2)", padding: "4px 12px", borderRadius: 100, fontWeight: 600 }}>
                  {brandDna.brand_archetype}
                </span>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 10 }}>
              {brandDna.tone_of_voice && (
                <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 13px", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <p style={{ fontSize: 9.5, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0, marginBottom: 4 }}>Tono de Voz</p>
                  <p style={{ fontSize: 12.5, color: "var(--t1)", margin: 0, lineHeight: 1.45 }}>{brandDna.tone_of_voice}</p>
                </div>
              )}
              {brandDna.target_audience && (
                <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 13px", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <p style={{ fontSize: 9.5, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0, marginBottom: 4 }}>Audiencia Objetivo</p>
                  <p style={{ fontSize: 12.5, color: "var(--t1)", margin: 0, lineHeight: 1.45 }}>{brandDna.target_audience}</p>
                </div>
              )}
              {brandDna.unique_value_proposition && (
                <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 13px", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <p style={{ fontSize: 9.5, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0, marginBottom: 4 }}>Propuesta de Valor</p>
                  <p style={{ fontSize: 12.5, color: "var(--t1)", margin: 0, lineHeight: 1.45 }}>{brandDna.unique_value_proposition}</p>
                </div>
              )}
              {brandDna.brand_personality && (
                <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 13px", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <p style={{ fontSize: 9.5, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0, marginBottom: 4 }}>Personalidad</p>
                  <p style={{ fontSize: 12.5, color: "var(--t1)", margin: 0, lineHeight: 1.45 }}>{brandDna.brand_personality}</p>
                </div>
              )}
            </div>

            {/* Colores + Taglines */}
            {((brandDna.primary_colors?.length ?? 0) > 0 || (brandDna.taglines?.length ?? 0) > 0 || (brandDna.content_pillars?.length ?? 0) > 0) && (
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 10 }}>
                {(brandDna.primary_colors?.length ?? 0) > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: "var(--t3)" }}>Colores:</span>
                    {brandDna.primary_colors!.slice(0, 6).map((c, i) => (
                      <div key={i} title={c} style={{ width: 18, height: 18, borderRadius: 5, background: c, border: "1px solid rgba(255,255,255,0.12)", flexShrink: 0 }} />
                    ))}
                  </div>
                )}
                {(brandDna.taglines?.length ?? 0) > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, color: "var(--t3)" }}>Taglines:</span>
                    {brandDna.taglines!.slice(0, 2).map((t, i) => (
                      <span key={i} style={{ fontSize: 11, color: "var(--t2)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", padding: "3px 9px", borderRadius: 6, fontStyle: "italic" }}>"{t}"</span>
                    ))}
                  </div>
                )}
                {(brandDna.content_pillars?.length ?? 0) > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, color: "var(--t3)" }}>Pilares:</span>
                    {brandDna.content_pillars!.slice(0, 4).map((p, i) => (
                      <span key={i} style={{ fontSize: 10.5, color: "var(--jade)", background: "rgba(42,122,75,0.08)", border: "1px solid rgba(42,122,75,0.18)", padding: "2px 8px", borderRadius: 6 }}>{p}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ CHARTS ROW ═══ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          {/* Revenue trend */}
          <div style={{ background: "var(--srf)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "18px 20px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <p style={{ fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0, marginBottom: 4 }}>Tendencia de Revenue</p>
                <p style={{ fontSize: 24, fontWeight: 800, color: "#34d399", margin: 0 }}>
                  +{data?.avgScore ? Math.round(data.avgScore * 0.32) : "—"}%
                </p>
              </div>
              <span style={{ fontSize: 10, color: "var(--jade)", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", padding: "3px 9px", borderRadius: 100 }}>↑ Estimado</span>
            </div>
            <svg viewBox="0 0 280 56" style={{ width: "100%", height: 56 }}>
              <defs>
                <linearGradient id="rg1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0,52 C30,50 46,44 70,38 S110,26 140,18 S190,8 220,5 S256,3 280,1" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" />
              <path d="M0,52 C30,50 46,44 70,38 S110,26 140,18 S190,8 220,5 S256,3 280,1 L280,56 L0,56 Z" fill="url(#rg1)" />
              {[[0,52],[70,38],[140,18],[210,6],[280,1]].map(([x,y],i) => (
                <circle key={i} cx={x} cy={y} r={i===4?3.5:2.5} fill="#34d399" opacity={i===4?1:0.45} />
              ))}
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
              {["Ene","Feb","Mar","Abr","May","Jun","Jul"].map(m => (
                <span key={m} style={{ fontSize: 9, color: "var(--t3)" }}>{m}</span>
              ))}
            </div>
          </div>

          {/* Score donut */}
          <div style={{ background: "var(--srf)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "18px 20px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
            <p style={{ fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0, marginBottom: 12 }}>Score del Catálogo</p>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ position: "relative", width: 76, height: 76, flexShrink: 0 }}>
                <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none"
                    stroke={!data?.avgScore ? "var(--t3)" : data.avgScore >= 80 ? "var(--jade)" : data.avgScore >= 60 ? "#f59e0b" : "#f43f5e"}
                    strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={`${data?.avgScore ?? 0} 100`}
                    style={{ transition: "stroke-dasharray 1.2s ease" }}
                  />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: data?.avgScore && data.avgScore >= 80 ? "var(--jade)" : data?.avgScore && data.avgScore >= 60 ? "#f59e0b" : "#f43f5e" }}>
                    {data?.avgScore != null ? score : "–"}
                  </span>
                  <span style={{ fontSize: 8.5, color: "var(--t3)" }}>/100</span>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                {[
                  { l: "Títulos", v: (data?.avgScore ?? 0) + 8 },
                  { l: "Descrip.", v: data?.avgScore ?? 0 },
                  { l: "SEO tags", v: (data?.avgScore ?? 0) - 5 },
                  { l: "Alt texts", v: (data?.avgScore ?? 0) + 3 },
                ].map(({ l, v }) => {
                  const cl = Math.max(0, Math.min(100, v));
                  const c = cl >= 80 ? "var(--jade)" : cl >= 60 ? "#f59e0b" : "#f43f5e";
                  return (
                    <div key={l} style={{ marginBottom: 7 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontSize: 10, color: "var(--t3)" }}>{l}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: c }}>{cl}</span>
                      </div>
                      <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${cl}%`, background: c, borderRadius: 2, transition: "width 1s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ QUICK MESSAGE ═══ */}
        <div style={{ background: "var(--srf)", border: "1px solid rgba(201,169,97,0.12)", borderRadius: 16, padding: "16px 20px", marginBottom: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0, marginBottom: 10 }}>
            💬 Enviar mensaje a tu agencia
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={msgDraft} onChange={e => setMsgDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && void quickSend()}
              placeholder="¿Necesitas algo? ¿Tienes alguna petición o requisito especial?…"
              style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "var(--t1)", outline: "none", transition: "border-color 0.15s" }}
              onFocus={e => e.target.style.borderColor = "rgba(201,169,97,0.4)"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
            />
            <button className="quick-send" onClick={quickSend} disabled={sending || !msgDraft.trim()} style={{ padding: "10px 18px", background: msgDraft.trim() ? "linear-gradient(135deg,#c9a961,#8b6914)" : "rgba(255,255,255,0.04)", border: "none", borderRadius: 10, color: msgDraft.trim() ? "#0a0a0f" : "var(--t3)", fontSize: 12.5, fontWeight: 700, cursor: msgDraft.trim() ? "pointer" : "not-allowed", flexShrink: 0, transition: "all 0.15s" }}>
              {sent ? "✓ Enviado" : sending ? "Enviando…" : "Enviar →"}
            </button>
          </div>
        </div>

        {/* ═══ TABS: Activity / Engines / Reports ═══ */}
        <div style={{ background: "var(--srf)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
          {/* Tab bar */}
          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {[
              { id: "activity", label: "📈 Actividad Real", count: data?.recentActivity?.length ?? 0 },
              { id: "engines", label: "⚡ Motores IA", count: ENGINES.length },
              { id: "reports", label: "📁 Archivos & Reportes", count: vault.length },
            ].map(t => (
              <button key={t.id} className="dash-tab" onClick={() => setTab(t.id as any)} style={{
                flex: 1, padding: "12px 6px", background: tab === t.id ? "rgba(201,169,97,0.07)" : "transparent",
                border: "none", borderBottom: tab === t.id ? "2px solid var(--gold)" : "2px solid transparent",
                color: tab === t.id ? "var(--gold)" : "var(--t2)", fontSize: 12, fontWeight: tab === t.id ? 700 : 400, cursor: "pointer",
              }}>
                {t.label}
                {t.count > 0 && (
                  <span style={{ marginLeft: 5, fontSize: 9.5, background: tab === t.id ? "rgba(201,169,97,0.18)" : "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 100, color: tab === t.id ? "var(--gold)" : "var(--t3)" }}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Activity */}
          {tab === "activity" && (
            <div>
              {loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                  <div style={{ width: 26, height: 26, border: "2px solid rgba(201,169,97,0.15)", borderTopColor: "var(--gold)", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                </div>
              ) : !data?.recentActivity?.length ? (
                <div style={{ padding: 40, textAlign: "center" }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
                  <p style={{ color: "var(--t3)", fontSize: 13 }}>La actividad aparecerá aquí cuando tu agencia trabaje en tu tienda.</p>
                </div>
              ) : data.recentActivity.slice(0, 15).map((item, i) => {
                const { icon, color } = actStyle(item.action);
                return (
                  <div key={item.id} className="act-row" style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 20px", borderBottom: i < data.recentActivity.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}16`, border: `1px solid ${color}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
                      {icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12.5, color: "var(--t1)", margin: 0, fontWeight: 500, lineHeight: 1.45 }}>{item.details || item.action}</p>
                      <p style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>{timeSince(item.createdAt)}</p>
                    </div>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0, marginTop: 5, opacity: 0.7 }} />
                  </div>
                );
              })}
            </div>
          )}

          {/* Engines */}
          {tab === "engines" && (
            <div>
              {ENGINES.map((e, i) => (
                <div key={e.name} className="eng-row" style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 20px", borderBottom: i < ENGINES.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 11, background: `${e.color}18`, border: `1px solid ${e.color}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{e.icon}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", margin: 0 }}>{e.name}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${e.pct}%`, borderRadius: 2, background: `linear-gradient(90deg, ${e.color}cc, ${e.color})`, backgroundSize: "200% auto", animation: "shimmer-bar 2s infinite" }} />
                      </div>
                      <span style={{ fontSize: 10, color: e.color, fontWeight: 700, width: 28, textAlign: "right" }}>{e.pct}%</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--jade)" }} />
                    <span style={{ fontSize: 10.5, color: "var(--jade)", fontWeight: 600 }}>Activo</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Reports */}
          {tab === "reports" && (
            <div>
              {vault.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center" }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>📁</div>
                  <p style={{ color: "var(--t3)", fontSize: 13, marginBottom: 16 }}>Los informes y archivos generados aparecerán aquí.</p>
                  <Link href="/client/reports">
                    <button style={{ padding: "9px 20px", background: "rgba(201,169,97,0.12)", border: "1px solid rgba(201,169,97,0.3)", borderRadius: 9, color: "var(--gold)", fontSize: 12, cursor: "pointer" }}>
                      Ver reportes → exportar
                    </button>
                  </Link>
                </div>
              ) : vault.slice(0, 10).map((f, i) => (
                <div key={f.id} className="vault-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: i < vault.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(201,169,97,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                    {f.fileType === "html" ? "📄" : f.fileType === "csv" ? "📊" : f.category?.includes("image") ? "🖼" : "📋"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.title}</p>
                    <p style={{ fontSize: 10, color: "var(--t3)", marginTop: 1 }}>{f.category} · {timeSince(f.createdAt)}</p>
                  </div>
                  {f.downloadUrl && (
                    <a href={f.downloadUrl} download style={{ textDecoration: "none", flexShrink: 0 }}>
                      <button style={{ padding: "5px 12px", background: "rgba(201,169,97,0.08)", border: "1px solid rgba(201,169,97,0.2)", borderRadius: 8, color: "var(--t2)", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, transition: "all 0.13s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(201,169,97,0.18)"; e.currentTarget.style.color = "var(--gold)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(201,169,97,0.08)"; e.currentTarget.style.color = "var(--t2)"; }}
                      >⬇ Descargar</button>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ClientLayout>
  );
}
