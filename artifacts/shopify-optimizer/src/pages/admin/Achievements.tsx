import { useState, useEffect, useRef } from "react";
import { Trophy, Star, Zap } from "lucide-react";
import { fireAchievementConfetti } from "../../lib/confetti";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Achievements() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const prevUnlockedRef = useRef<number | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/achievements`, { credentials: "include" })
      .then(r => r.json())
      .then((d) => {
        const newUnlocked = d?.unlocked ?? 0;
        if (prevUnlockedRef.current !== null && newUnlocked > prevUnlockedRef.current) {
          fireAchievementConfetti();
        }
        const recentlyUnlocked = (d?.achievements ?? []).some((a: any) => {
          if (!a.unlocked || !a.unlockedAt) return false;
          const diff = Date.now() - new Date(a.unlockedAt).getTime();
          return diff < 60_000;
        });
        if (recentlyUnlocked && prevUnlockedRef.current === null) {
          fireAchievementConfetti();
        }
        prevUnlockedRef.current = newUnlocked;
        setData(d);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="grid-r3">
      {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: 140, borderRadius: 12 }} />)}
    </div>
  );

  const { achievements = [], totalXp = 0, unlocked = 0, total = 0 } = data ?? {};
  const pct = total > 0 ? Math.round((unlocked / total) * 100) : 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--t)" }}>Sistema de Logros</h1>
          <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 4 }}>Desbloquea logros completando acciones en la plataforma</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--gold)" }}>{totalXp.toLocaleString()} XP</div>
          <div style={{ fontSize: 12, color: "var(--t3)" }}>{unlocked}/{total} desbloqueados</div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t)" }}>Progreso Total</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)" }}>{pct}%</span>
        </div>
        <div style={{ height: 8, background: "var(--ink3)", borderRadius: 4 }}>
          <div style={{ height: "100%", background: "linear-gradient(90deg, var(--gold), var(--jade))", borderRadius: 4, width: `${pct}%`, transition: "width 0.6s ease" }} />
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Trophy size={14} style={{ color: "var(--gold)" }} />
            <span style={{ fontSize: 12, color: "var(--t2)" }}>{unlocked} completados</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Star size={14} style={{ color: "var(--t3)" }} />
            <span style={{ fontSize: 12, color: "var(--t3)" }}>{total - unlocked} pendientes</span>
          </div>
        </div>
      </div>

      <div className="grid-r3">
        {achievements.map((a: any) => (
          <div key={a.key} className="glass-card" style={{
            padding: 20,
            opacity: a.unlocked ? 1 : 0.5,
            borderColor: a.unlocked ? "var(--gold)" : "transparent",
            position: "relative", overflow: "hidden",
          }}>
            {a.unlocked && (
              <div style={{
                position: "absolute", top: 8, right: 8,
                background: "rgba(200,168,75,0.15)", borderRadius: 20, padding: "2px 8px",
                fontSize: 10, fontWeight: 700, color: "var(--gold)",
              }}>DESBLOQUEADO</div>
            )}
            <div style={{ fontSize: 32, marginBottom: 10 }}>{a.icon}</div>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: a.unlocked ? "var(--t)" : "var(--t3)", marginBottom: 6 }}>{a.title}</h4>
            <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 10, lineHeight: 1.5 }}>{a.description}</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Zap size={12} style={{ color: a.unlocked ? "var(--jade)" : "var(--t4)" }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: a.unlocked ? "var(--jade)" : "var(--t4)" }}>+{a.xp} XP</span>
              </div>
              {a.unlockedAt && (
                <span style={{ fontSize: 10, color: "var(--t4)" }}>
                  {new Date(a.unlockedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
