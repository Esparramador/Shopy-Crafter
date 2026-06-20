import { Suspense } from "react";
import { useGame } from "./lib/gameStore";
import { MainMenu } from "./ui/MainMenu";
import { HUD } from "./ui/HUD";
import { MiniMap } from "./ui/MiniMap";
import { DialogBox } from "./ui/DialogBox";
import { Inventory } from "./ui/Inventory";
import { Game } from "./game/Game";

function DeadScreen() {
  const { reset } = useGame();
  return (
    <div className="dead-screen">
      <div style={{ fontSize: 64, marginBottom: 8 }}>💀</div>
      <h1 style={{ fontSize: 42, fontWeight: 900, marginBottom: 8 }}>ELIMINADO</h1>
      <p style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", marginBottom: 32 }}>
        Tu imperio ha caído... por ahora.
      </p>
      <button className="start-btn" onClick={reset}>
        🔄 Intentar de nuevo
      </button>
    </div>
  );
}

export default function App() {
  const { phase } = useGame();

  return (
    <>
      {phase === "menu" && <MainMenu />}

      {(phase === "playing" || phase === "paused") && (
        <>
          <Suspense fallback={
            <div style={{ position: "fixed", inset: 0, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 48, fontWeight: 900, background: "linear-gradient(135deg,#ffd700,#ff9500)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>CEO EMPIRE</div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Cargando la ciudad…</div>
            </div>
          }>
            <Game />
          </Suspense>
          <HUD />
          <MiniMap />
          <DialogBox />
          <Inventory />
        </>
      )}

      {phase === "dead" && <DeadScreen />}
    </>
  );
}
