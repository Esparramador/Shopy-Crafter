import { useEffect, useRef } from "react";
import { useGame } from "../lib/gameStore";

function HealthBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = pct > 60 ? "#2dd49f" : pct > 30 ? "#fbbf24" : "#ef4444";
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>
        <span>❤️ SALUD</span><span>{Math.round(value)}</span>
      </div>
      <div style={{ height: 7, borderRadius: 4, background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4, transition: "width 0.3s, background 0.3s" }} />
      </div>
    </div>
  );
}

function KarmaBar({ value }: { value: number }) {
  const pct = ((value + 100) / 200) * 100;
  const color = value > 30 ? "#2dd49f" : value > -30 ? "#fbbf24" : "#ef4444";
  const label = value > 50 ? "CEO Ejemplar" : value > 0 ? "Ambicioso" : value > -50 ? "Polémico" : "Villano";
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>
        <span>⚖️ KARMA</span><span style={{ color }}>{label} ({value > 0 ? "+" : ""}{value})</span>
      </div>
      <div style={{ height: 5, borderRadius: 4, background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

function WantedStars({ level }: { level: number }) {
  return (
    <div style={{ display: "flex", gap: 3, justifyContent: "flex-end" }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ fontSize: 16, opacity: i <= level ? 1 : 0.2, filter: i <= level ? "drop-shadow(0 0 4px #ffd700)" : "none", transition: "all 0.3s" }}>⭐</span>
      ))}
    </div>
  );
}

function DayNightClock({ dayTime }: { dayTime: number }) {
  const h = Math.floor(dayTime);
  const m = Math.floor((dayTime % 1) * 60);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  const icon = h >= 6 && h < 20 ? "☀️" : "🌙";
  return (
    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", textAlign: "right" }}>
      {icon} {h12}:{m.toString().padStart(2,"0")} {ampm}
    </div>
  );
}

export function HUD() {
  const {
    health, money, karma, wantedLevel, dayTime, phase,
    currentObjective, inVehicle, nearbyNpcId, nearbyVehicleId,
    nearbyBusinessId, nearbyMissionId, activeWeapon, killCount,
    ownedBusinesses, passiveIncomePerSec, tickPassiveIncome,
  } = useGame();

  const tickRef = useRef<ReturnType<typeof setInterval>>();
  useEffect(() => {
    tickRef.current = setInterval(() => tickPassiveIncome(), 1000);
    return () => clearInterval(tickRef.current);
  }, [tickPassiveIncome]);

  if (phase !== "playing") return null;

  const formatMoney = (n: number) => {
    if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n/1_000).toFixed(1)}K`;
    return `$${n}`;
  };

  return (
    <>
      {/* TOP LEFT: Stats */}
      <div style={{
        position: "fixed", top: 16, left: 16, width: 200,
        background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 10, padding: "10px 12px", zIndex: 10,
        backdropFilter: "blur(6px)",
      }}>
        <HealthBar value={health} />
        <KarmaBar value={karma} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#ffd700", fontVariantNumeric: "tabular-nums" }}>
            {formatMoney(money)}
          </div>
          {ownedBusinesses.length > 0 && (
            <div style={{ fontSize: 9, color: "#2dd49f" }}>+{formatMoney(passiveIncomePerSec)}/s</div>
          )}
        </div>
        <div style={{ marginTop: 4, fontSize: 9, color: "rgba(255,255,255,0.35)" }}>
          🏢 {ownedBusinesses.length} negocios &nbsp;|&nbsp; 💀 {killCount} bajas
        </div>
      </div>

      {/* TOP RIGHT: Wanted + Time */}
      <div style={{
        position: "fixed", top: 16, right: 16,
        background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 10, padding: "10px 12px", zIndex: 10,
        backdropFilter: "blur(6px)", textAlign: "right",
      }}>
        <WantedStars level={wantedLevel} />
        <DayNightClock dayTime={dayTime} />
        {inVehicle && <div style={{ fontSize: 11, color: "#fbbf24", marginTop: 4 }}>🚗 En vehículo</div>}
        {activeWeapon !== "fists" && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>🔫 {activeWeapon}</div>}
      </div>

      {/* TOP CENTER: Mission objective */}
      {currentObjective && (
        <div style={{
          position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,215,0,0.3)",
          borderRadius: 20, padding: "6px 18px", zIndex: 10, maxWidth: "50vw",
          backdropFilter: "blur(6px)",
        }}>
          <div style={{ fontSize: 10, color: "rgba(255,215,0,0.7)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>📋 Misión activa</div>
          <div style={{ fontSize: 12, color: "#fff" }}>{currentObjective}</div>
        </div>
      )}

      {/* BOTTOM: Context hints */}
      <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 10, display: "flex", gap: 8 }}>
        {nearbyVehicleId && (
          <div className="prompt-hint">🚗 <kbd style={{ background: "rgba(255,255,255,0.15)", borderRadius: 4, padding: "1px 5px", fontSize: 10 }}>E</kbd> Entrar vehículo</div>
        )}
        {nearbyNpcId && (
          <div className="prompt-hint">💬 <kbd style={{ background: "rgba(255,255,255,0.15)", borderRadius: 4, padding: "1px 5px", fontSize: 10 }}>F</kbd> Hablar</div>
        )}
        {nearbyBusinessId && (
          <div className="prompt-hint">🏢 <kbd style={{ background: "rgba(255,255,255,0.15)", borderRadius: 4, padding: "1px 5px", fontSize: 10 }}>B</kbd> Comprar negocio</div>
        )}
        {nearbyMissionId && (
          <div className="prompt-hint">🎯 <kbd style={{ background: "rgba(255,255,255,0.15)", borderRadius: 4, padding: "1px 5px", fontSize: 10 }}>E</kbd> Iniciar misión</div>
        )}
      </div>

      {/* Crosshair */}
      <div className="crosshair" />
    </>
  );
}
