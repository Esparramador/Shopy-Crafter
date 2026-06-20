import * as THREE from "three";
import { useMemo } from "react";
import { BUSINESSES, MISSIONS, NPC_CONFIGS } from "../lib/gameData";
import { useGame } from "../lib/gameStore";

function Building({ pos, w, d, h, color }: { pos: [number, number, number]; w: number; d: number; h: number; color: string }) {
  return (
    <mesh position={[pos[0], h / 2, pos[2]]} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} roughness={0.6} metalness={0.1} />
    </mesh>
  );
}

function Road({ x, z, len, axis }: { x: number; z: number; len: number; axis: "x" | "z" }) {
  return (
    <mesh
      position={[x, 0.02, z]}
      rotation={axis === "x" ? [0, 0, 0] : [0, Math.PI / 2, 0]}
      receiveShadow
    >
      <planeGeometry args={axis === "x" ? [len, 10] : [10, len]} />
      <meshStandardMaterial color="#2a2a3a" roughness={0.9} />
    </mesh>
  );
}

function BusinessMarker({ business }: { business: typeof BUSINESSES[0] }) {
  const { ownedBusinesses } = useGame();
  const owned = ownedBusinesses.includes(business.id);
  return (
    <group position={business.pos}>
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <cylinderGeometry args={[3, 3, 0.2, 32]} />
        <meshStandardMaterial color={owned ? "#2dd49f" : "#ffd700"} emissive={owned ? "#2dd49f" : "#ffd700"} emissiveIntensity={0.25} />
      </mesh>
      <pointLight position={[0, 3, 0]} intensity={owned ? 0.6 : 0.3} color={owned ? "#2dd49f" : "#ffd700"} distance={8} />
    </group>
  );
}

function MissionMarker({ mission }: { mission: typeof MISSIONS[0] }) {
  const { activeMissionId } = useGame();
  const active = activeMissionId === mission.id;
  return (
    <group position={mission.markerPos}>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[2.5, 2.5, 0.2, 32]} />
        <meshStandardMaterial color={mission.color} emissive={mission.color} emissiveIntensity={active ? 0.6 : 0.15} transparent opacity={0.85} />
      </mesh>
      {active && <pointLight position={[0, 4, 0]} intensity={1.2} color={mission.color} distance={12} />}
    </group>
  );
}

function Park({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <planeGeometry args={[28, 28]} />
        <meshStandardMaterial color="#2d5a27" roughness={0.9} />
      </mesh>
      {[[-6, -6], [6, -6], [-6, 6], [6, 6], [0, 0]].map(([tx, tz], i) => (
        <group key={i} position={[tx, 0, tz]}>
          <mesh position={[0, 2, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.4, 4, 8]} />
            <meshStandardMaterial color="#5c3d2e" />
          </mesh>
          <mesh position={[0, 5, 0]} castShadow>
            <sphereGeometry args={[2.2, 8, 6]} />
            <meshStandardMaterial color="#2d7a2d" roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function StreetLight({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 4, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.15, 8, 6]} />
        <meshStandardMaterial color="#888" roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh position={[0.5, 7.8, 0]}>
        <boxGeometry args={[1.2, 0.2, 0.3]} />
        <meshStandardMaterial color="#aaa" emissive="#ffe066" emissiveIntensity={0.8} />
      </mesh>
      <pointLight position={[0.5, 7.5, 0]} intensity={0.4} distance={14} color="#ffe066" />
    </group>
  );
}

const BUILDING_SEED: Array<{ x: number; z: number; w: number; d: number; h: number; color: string }> = [
  // North district
  { x: 30, z: -50, w: 14, d: 14, h: 42, color: "#8ca0b0" },
  { x: 50, z: -50, w: 12, d: 12, h: 36, color: "#6d8b9e" },
  { x: 70, z: -45, w: 16, d: 10, h: 56, color: "#7a8fa0" },
  { x: 30, z: -75, w: 20, d: 14, h: 62, color: "#9aacb8" },
  { x: 60, z: -72, w: 12, d: 16, h: 48, color: "#6b8090" },
  { x: 80, z: -70, w: 14, d: 14, h: 28, color: "#8ba090" },
  // South district
  { x: 30, z: 50, w: 18, d: 12, h: 32, color: "#b0956a" },
  { x: 55, z: 50, w: 14, d: 14, h: 22, color: "#a0855a" },
  { x: 75, z: 52, w: 10, d: 16, h: 40, color: "#c0a876" },
  { x: 35, z: 75, w: 22, d: 12, h: 18, color: "#b8a070" },
  { x: 65, z: 78, w: 16, d: 10, h: 30, color: "#a08060" },
  // West district
  { x: -45, z: -45, w: 14, d: 14, h: 44, color: "#9090b0" },
  { x: -70, z: -50, w: 12, d: 18, h: 36, color: "#8080a0" },
  { x: -55, z: -75, w: 16, d: 12, h: 52, color: "#a0a0c0" },
  { x: -75, z: -75, w: 14, d: 14, h: 30, color: "#9898b8" },
  { x: -45, z: 45, w: 16, d: 12, h: 26, color: "#b090b0" },
  { x: -70, z: 55, w: 12, d: 14, h: 38, color: "#a080a0" },
  { x: -55, z: 75, w: 18, d: 12, h: 48, color: "#9078a0" },
  // East district
  { x: 95, z: -30, w: 14, d: 14, h: 34, color: "#b8a080" },
  { x: 110, z: -55, w: 12, d: 16, h: 50, color: "#c0b090" },
  { x: 100, z: 25, w: 18, d: 12, h: 22, color: "#a89070" },
  // Downtown center
  { x: -10, z: -30, w: 22, d: 18, h: 80, color: "#7890a8" },
  { x: 10, z: -50, w: 16, d: 16, h: 70, color: "#8898a8" },
  { x: -15, z: -55, w: 12, d: 12, h: 58, color: "#6080a0" },
  { x: -30, z: -35, w: 14, d: 20, h: 48, color: "#708898" },
  { x: 5, z: -75, w: 20, d: 14, h: 66, color: "#8090a0" },
  // Small shops
  { x: 18, z: 18, w: 10, d: 8, h: 8, color: "#c89060" },
  { x: -18, z: 18, w: 8, d: 10, h: 6, color: "#c0a070" },
  { x: 18, z: -18, w: 10, d: 8, h: 7, color: "#b89060" },
  { x: -20, z: -20, w: 8, d: 10, h: 5, color: "#c09060" },
];

export function World() {
  const streetLightPositions = useMemo(() => {
    const pos: Array<[number, number]> = [];
    for (let i = -100; i <= 100; i += 20) {
      pos.push([i, -8]);
      pos.push([i,  8]);
      pos.push([-8, i]);
      pos.push([ 8, i]);
    }
    return pos;
  }, []);

  return (
    <group>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.95} />
      </mesh>

      {/* Main grid roads */}
      {[-60, -20, 20, 60].map(offset => (
        <Road key={`rx${offset}`} x={0} z={offset} len={260} axis="x" />
      ))}
      {[-60, -20, 20, 60].map(offset => (
        <Road key={`rz${offset}`} x={offset} z={0} len={260} axis="z" />
      ))}

      {/* Center plaza */}
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <cylinderGeometry args={[12, 12, 0.06, 32]} />
        <meshStandardMaterial color="#4a4a5a" roughness={0.7} />
      </mesh>

      {/* Buildings */}
      {BUILDING_SEED.map((b, i) => (
        <Building key={i} pos={[b.x, 0, b.z]} w={b.w} d={b.d} h={b.h} color={b.color} />
      ))}

      {/* Parks */}
      <Park x={-80} z={-80} />
      <Park x={90} z={75} />

      {/* Street lights */}
      {streetLightPositions.map(([x, z], i) => (
        <StreetLight key={i} x={x} z={z} />
      ))}

      {/* Business markers */}
      {BUSINESSES.map(b => <BusinessMarker key={b.id} business={b} />)}

      {/* Mission markers */}
      {MISSIONS.map(m => <MissionMarker key={m.id} mission={m} />)}
    </group>
  );
}
