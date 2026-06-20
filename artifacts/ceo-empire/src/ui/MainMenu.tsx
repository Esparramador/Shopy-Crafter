import { useState } from "react";
import { useGame } from "../lib/gameStore";
import { CHARACTER_MODELS } from "../lib/gameData";

export function MainMenu() {
  const [selected, setSelected] = useState("alec_monopoly");
  const { setPhase, setSelectedCharacter } = useGame();

  const chars = [
    { key: "alec_monopoly",   label: "Alec CEO",       icon: "🎩", desc: "El millonario del mercado" },
    { key: "chico_formal",    label: "CEO Formal",     icon: "👔", desc: "Elegante y estratégico" },
    { key: "chica_ejecutiva", label: "CEO Ejecutiva",  icon: "💼", desc: "Liderazgo con estilo" },
    { key: "chica_creativa",  label: "CEO Creativa",   icon: "🎨", desc: "Innovación sin límites" },
  ];

  const start = () => {
    setSelectedCharacter(selected);
    setPhase("playing");
  };

  return (
    <div className="main-menu">
      <h1 className="game-title">CEO EMPIRE</h1>
      <p className="game-subtitle">Shopy Crafter — Open World</p>

      <div style={{ marginBottom: 32, maxWidth: 480, textAlign: "center", color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 1.6 }}>
        Conviértete en el CEO más poderoso de la ciudad. Construye tu imperio,
        elimina rivales y lleva tu negocio a la cima.
      </div>

      <div style={{ marginBottom: 12, fontSize: 12, color: "rgba(255,255,255,0.4)", letterSpacing: 2, textTransform: "uppercase" }}>
        Elige tu CEO
      </div>

      <div className="char-grid">
        {chars.map(c => (
          <div
            key={c.key}
            className={`char-card ${selected === c.key ? "selected" : ""}`}
            onClick={() => setSelected(c.key)}
          >
            <span style={{ fontSize: 32, display: "block", marginBottom: 8 }}>{c.icon}</span>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{c.desc}</div>
          </div>
        ))}
      </div>

      <button className="start-btn" onClick={start}>
        🚀 Iniciar Imperio
      </button>

      <div style={{ marginTop: 32, color: "rgba(255,255,255,0.3)", fontSize: 11, textAlign: "center", lineHeight: 1.8 }}>
        <div>WASD · Moverse &nbsp;|&nbsp; Ratón · Girar cámara (clic para activar)</div>
        <div>E · Entrar/Salir vehículo · Interactuar &nbsp;|&nbsp; F · Hablar NPC &nbsp;|&nbsp; I · Inventario</div>
        <div>Clic izquierdo · Atacar &nbsp;|&nbsp; Space · Saltar &nbsp;|&nbsp; B · Comprar negocio cercano</div>
      </div>
    </div>
  );
}
