import { useEffect, useRef } from "react";
import { useGame } from "../lib/gameStore";
import { BUSINESSES, MISSIONS, NPC_CONFIGS } from "../lib/gameData";

const MAP_RADIUS = 80;
const WORLD_SCALE = 240;

function worldToMap(wx: number, wz: number, px: number, pz: number, size: number): [number, number] {
  const cx = size / 2;
  const cy = size / 2;
  const dx = (wx - px) / WORLD_SCALE * size;
  const dy = (wz - pz) / WORLD_SCALE * size;
  return [cx + dx, cy + dy];
}

export function MiniMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { playerPos, playerFacing, activeMissionId, ownedBusinesses, phase } = useGame();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || phase !== "playing") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = canvas.width;
    const [px, , pz] = playerPos;

    ctx.clearRect(0, 0, size, size);

    // Background
    ctx.fillStyle = "rgba(10,15,25,0.92)";
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2, 0, Math.PI*2);
    ctx.fill();

    // Grid lines (roads)
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 0.5;
    for (let i = -200; i <= 200; i += 20) {
      const [x1] = worldToMap(i, -200, px, pz, size);
      const [x2] = worldToMap(i,  200, px, pz, size);
      const [, y1] = worldToMap(-200, i, px, pz, size);
      const [, y2] = worldToMap( 200, i, px, pz, size);
      ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x2, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, y1); ctx.lineTo(size, y2); ctx.stroke();
    }

    // Businesses
    BUSINESSES.forEach(b => {
      const owned = ownedBusinesses.includes(b.id);
      const [mx, my] = worldToMap(b.pos[0], b.pos[2], px, pz, size);
      if (mx < 0 || mx > size || my < 0 || my > size) return;
      ctx.beginPath();
      ctx.arc(mx, my, 3, 0, Math.PI*2);
      ctx.fillStyle = owned ? "#2dd49f" : "#ffd700";
      ctx.fill();
    });

    // Mission markers
    MISSIONS.forEach(m => {
      if (m.id !== activeMissionId) return;
      const [mx, my] = worldToMap(m.markerPos[0], m.markerPos[2], px, pz, size);
      if (mx < 2 || mx > size-2 || my < 2 || my > size-2) return;
      ctx.beginPath();
      ctx.arc(mx, my, 4, 0, Math.PI*2);
      ctx.fillStyle = m.color;
      ctx.fill();
    });

    // NPCs
    NPC_CONFIGS.filter(n => n.type === "hostile" || n.type === "boss").forEach(n => {
      const [mx, my] = worldToMap(n.pos[0], n.pos[2], px, pz, size);
      if (mx < 0 || mx > size || my < 0 || my > size) return;
      ctx.beginPath();
      ctx.arc(mx, my, 2, 0, Math.PI*2);
      ctx.fillStyle = "#ef4444";
      ctx.fill();
    });

    // Player
    ctx.save();
    ctx.translate(size/2, size/2);
    ctx.rotate(playerFacing);
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(-4, 4);
    ctx.lineTo(4, 4);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();

    // Circle border
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2 - 1, 0, Math.PI*2);
    ctx.stroke();
  });

  if (phase !== "playing") return null;

  return (
    <div style={{
      position: "fixed", bottom: 20, right: 20,
      width: 150, height: 150, borderRadius: "50%",
      overflow: "hidden", zIndex: 10,
      border: "2px solid rgba(255,255,255,0.2)",
      boxShadow: "0 0 20px rgba(0,0,0,0.5)",
    }}>
      <canvas ref={canvasRef} width={150} height={150} style={{ display: "block" }} />
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        pointerEvents: "none",
      }}>
      </div>
    </div>
  );
}
