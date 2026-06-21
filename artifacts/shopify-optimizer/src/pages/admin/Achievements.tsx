import { useState, useEffect, useRef } from "react";
import { Trophy, Star, Zap, RefreshCw, Lock } from "lucide-react";
import { fireAchievementConfetti } from "../../lib/confetti";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const CATEGORY_LABELS: Record<string, string> = {
  audit: "Auditorías",
  image: "Imágenes IA",
  abtest: "Tests A/B",
  price: "Precios",
  seo: "SEO",
  client: "Clientes",
  onboard: "Setup",
  revenue: "Revenue",
  products: "Productos",
  boost: "Boost",
  compete: "Competidores",
  brand: "Marca",
};

const CATEGORY_COLORS: Record<string, string> = {
  audit: "#60a5fa",
  image: "#f472b6",
  abtest: "#a78bfa",
  price: "#fbbf24",
  seo: "#4ade80",
  client: "#34d399",
  onboard: "#f59e0b",
  revenue: "#fb923c",
  products: "#22d3ee",
  boost: "#f87171",
  compete: "#e879f9",
  brand: "#8b5cf6",
};

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 6, background: "var(--ink3)", borderRadius: 3, overflow: "hidden", marginTop: 8 }}>
      <div style={{
        height: "100%",
        background: color,
        borderRadius: 3,
        width: `${Math.min(pct, 100)}%`,
        transition: "width 0.6s ease",
        boxShadow: pct >= 100 ? `0 0 6px ${color}` : undefined,
      }} />
    </div>
  );
}

export default function Achievements() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unlocked" | "locked">("all");
  const [refreshing, setRefreshing] = useState(false);
  const prevUnlockedRef = useRef<number | null>(null);

  const load = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/achievements`, { credentials: "include" });
      const d = await r.json();
      const newUnlocked = d?.unlocked ?? 0;
      if (prevUnlockedRef.current !== null && newUnlocked > prevUnlockedRef.current) {
        fireAchievementConfetti();
      }
      const recentlyUnlocked = (d?.achievements ?? []).some((a: any) => {
        if (!a.unlocked || !a.unlockedAt) return false;
        return Date.now() - new Date(a.unlockedAt).getTime() < 60_000;
      });
      if (recentlyUnlocked && prevUnlockedRef.current === null) fireAchievementConfetti();
      prevUnlockedRef.current = newUnlocked;
      setData(d);
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const refresh = () => { setRefreshing(true); load(); };

  if (loading) return (
    <div className="grid-r3">
      {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 12 }} />)}
    </div>
  );

  const { achievements = [], totalXp = 0, unlocked = 0, total = 0 } = data ?? {};
  const pct = total > 0 ? Math.round((unlocked / total) * 100) : 0;

  const visible = achievements.filter((a: any) => {
    if (filter === "unlocked") return a.unlocked;
    if (filter === "locked") return !a.unlocked;
    return true;
  });

  const categories = [...new Set(achievements.map((a: any) => a.category as string))] as string[];

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--t)" }}>Sistema de Logros</h1>
          <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 4 }}>Desbloquea logros completando acciones en la plataforma</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--gold)" }}>{totalXp.toLocaleString()} XP</div>
            <div style={{ fontSize: 12, color: "var(--t3)" }}>{unlocked}/{total} desbloqueados</div>
          </div>
          <button onClick={refresh} disabled={refreshing} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8,
            background: "var(--s1)", border: "1px solid var(--border)", color: "var(--t2)",
            fontSize: 13, cursor: refreshing ? "not-allowed" : "pointer",
          }}>
            <RefreshCw size={14} style={{ animation: refreshing ? "spin 0.6s linear infinite" : undefined }} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Global progress bar */}
      <div className="glass-card" style={{ padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t)" }}>Progreso Total</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)" }}>{pct}%</span>
        </div>
        <div style={{ height: 10, background: "var(--ink3)", borderRadius: 5, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            background: "linear-gradient(90deg, var(--gold), var(--jade))",
            borderRadius: 5,
            width: `${pct}%`,
            transition: "width 0.6s ease",
          }} />
        </div>
        <div style={{ display: "flex", gap: 20, marginTop: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Trophy size={14} style={{ color: "var(--gold)" }} />
            <span style={{ fontSize: 12, color: "var(--t2)" }}>{unlocked} completados</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Star size={14} style={{ color: "var(--t3)" }} />
            <span style={{ fontSize: 12, color: "var(--t3)" }}>{total - unlocked} pendientes</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Zap size={14} style={{ color: "var(--jade)" }} />
            <span style={{ fontSize: 12, color: "var(--jade)" }}>{totalXp.toLocaleString()} XP total</span>
          </div>
        </div>
      </div>

      {/* Category progress mini-bars */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8, marginBottom: 20 }}>
        {categories.map(cat => {
          const catAchs = achievements.filter((a: any) => a.category === cat);
          const catUnlocked = catAchs.filter((a: any) => a.unlocked).length;
          const catPct = catAchs.length > 0 ? Math.round((catUnlocked / catAchs.length) * 100) : 0;
          const color = CATEGORY_COLORS[cat] || "var(--gold)";
          return (
            <div key={cat} style={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--t2)" }}>{CATEGORY_LABELS[cat] || cat}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color }}>{catUnlocked}/{catAchs.length}</span>
              </div>
              <ProgressBar pct={catPct} color={color} />
            </div>
          );
        })}
      </div>

      {/* Filter buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[
          { key: "all", label: `Todos (${achievements.length})` },
          { key: "unlocked", label: `✓ Desbloqueados (${unlocked})` },
          { key: "locked", label: `🔒 Pendientes (${total - unlocked})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key as any)} style={{
            padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
            background: filter === f.key ? "var(--gold)" : "var(--s1)",
            color: filter === f.key ? "#000" : "var(--t2)",
            border: filter === f.key ? "none" : "1px solid var(--border)",
          }}>{f.label}</button>
        ))}
      </div>

      {/* Achievement grid */}
      <div className="grid-r3">
        {visible.map((a: any) => {
          const color = CATEGORY_COLORS[a.category] || "var(--gold)";
          const isComplete = a.unlocked;
          const pctBar = a.progressPct ?? (isComplete ? 100 : 0);
          return (
            <div key={a.key} className="glass-card" style={{
              padding: 18,
              opacity: isComplete ? 1 : 0.75,
              borderColor: isComplete ? color : "transparent",
              borderWidth: isComplete ? 1.5 : 1,
              position: "relative", overflow: "hidden",
              transition: "all 0.2s",
            }}>
              {isComplete && (
                <div style={{
                  position: "absolute", top: 0, right: 0,
                  background: `${color}22`,
                  padding: "3px 10px",
                  fontSize: 9, fontWeight: 700, color,
                  borderBottomLeftRadius: 8,
                }}>✓ DESBLOQUEADO</div>
              )}
              {!isComplete && (
                <Lock size={12} style={{ position: "absolute", top: 10, right: 10, color: "var(--t4)" }} />
              )}

              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                <div style={{
                  fontSize: 28, lineHeight: 1,
                  filter: isComplete ? undefined : "grayscale(1) opacity(0.5)",
                }}>{a.icon}</div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: isComplete ? "var(--t)" : "var(--t3)", marginBottom: 2 }}>{a.title}</h4>
                  <span style={{
                    fontSize: 9, fontWeight: 700,
                    padding: "2px 6px", borderRadius: 20,
                    background: `${color}18`, color,
                    border: `1px solid ${color}30`,
                  }}>{CATEGORY_LABELS[a.category] || a.category}</span>
                </div>
              </div>

              <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 10, lineHeight: 1.5 }}>{a.description}</p>

              {/* Per-achievement progress bar */}
              {!isComplete && a.target > 1 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: "var(--t4)" }}>Progreso</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color }}>{a.progress ?? 0}/{a.target}</span>
                  </div>
                  <ProgressBar pct={pctBar} color={color} />
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Zap size={12} style={{ color: isComplete ? color : "var(--t4)" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: isComplete ? color : "var(--t4)" }}>+{a.xp} XP</span>
                </div>
                {a.unlockedAt && (
                  <span style={{ fontSize: 10, color: "var(--t4)" }}>
                    {new Date(a.unlockedAt).toLocaleDateString("es-ES")}
                  </span>
                )}
                {!isComplete && pctBar > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 600, color }}>{pctBar}%</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
