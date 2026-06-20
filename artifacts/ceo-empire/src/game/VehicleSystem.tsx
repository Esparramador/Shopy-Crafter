import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGame } from "../lib/gameStore";

const VEHICLES = [
  { id: "v1", pos: [15, 0, 15] as [number,number,number], color: "#cc3333" },
  { id: "v2", pos: [-25, 0, 20] as [number,number,number], color: "#3355cc" },
  { id: "v3", pos: [40, 0, -25] as [number,number,number], color: "#22aa44" },
  { id: "v4", pos: [-40, 0, -30] as [number,number,number], color: "#cc8822" },
  { id: "v5", pos: [0, 0, 38] as [number,number,number], color: "#9933cc" },
];

const VEHICLE_SPEED = 20;
const VEHICLE_TURN = 2.0;

function CarBody({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[2, 0.8, 4.2]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.0, -0.2]} castShadow>
        <boxGeometry args={[1.7, 0.55, 2.2]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.4} />
      </mesh>
      {/* Windows */}
      <mesh position={[0, 1.08, -0.2]}>
        <boxGeometry args={[1.5, 0.38, 2.0]} />
        <meshStandardMaterial color="#8cc8ff" metalness={0.1} roughness={0.05} transparent opacity={0.7} />
      </mesh>
      {/* Wheels */}
      {[[-1.1, 0.32, 1.3],[-1.1, 0.32,-1.3],[1.1, 0.32, 1.3],[1.1, 0.32,-1.3]].map(([x,y,z], i) => (
        <mesh key={i} position={[x,y,z] as [number,number,number]} rotation={[Math.PI/2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.34, 0.34, 0.28, 12]} />
          <meshStandardMaterial color="#111" roughness={0.9} />
        </mesh>
      ))}
      {/* Headlights */}
      <mesh position={[0.7, 0.58, 2.1]}>
        <boxGeometry args={[0.4, 0.2, 0.1]} />
        <meshStandardMaterial color="#fff" emissive="#ffe8aa" emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[-0.7, 0.58, 2.1]}>
        <boxGeometry args={[0.4, 0.2, 0.1]} />
        <meshStandardMaterial color="#fff" emissive="#ffe8aa" emissiveIntensity={0.9} />
      </mesh>
    </group>
  );
}

export function VehicleSystem() {
  const {
    inVehicle, nearbyVehicleId, setNearbyVehicleId,
    playerPos, setPlayerPos, playerFacing,
  } = useGame();

  const vehicleRefs = useRef<Record<string, THREE.Group | null>>({});
  const vehiclePosRef = useRef<Record<string, THREE.Vector3>>(
    Object.fromEntries(VEHICLES.map(v => [v.id, new THREE.Vector3(...v.pos)]))
  );
  const vehicleFacingRef = useRef<Record<string, number>>(
    Object.fromEntries(VEHICLES.map(v => [v.id, 0]))
  );
  const activeVehicleRef = useRef<string | null>(null);

  useFrame((_, delta) => {
    const [px, , pz] = playerPos;

    // Proximity check
    let closest = "";
    let closestDist = Infinity;
    VEHICLES.forEach(v => {
      const vp = vehiclePosRef.current[v.id];
      if (!vp) return;
      const d = Math.hypot(vp.x - px, vp.z - pz);
      if (d < 5 && d < closestDist) { closestDist = d; closest = v.id; }
    });
    setNearbyVehicleId(closest || null);

    if (inVehicle && activeVehicleRef.current == null && closest) {
      activeVehicleRef.current = closest;
    }
    if (!inVehicle) {
      activeVehicleRef.current = null;
    }

    // Update vehicle group positions
    VEHICLES.forEach(v => {
      const mesh = vehicleRefs.current[v.id];
      const vp = vehiclePosRef.current[v.id];
      if (!mesh || !vp) return;
      mesh.position.copy(vp);
      mesh.rotation.y = vehicleFacingRef.current[v.id] ?? 0;
    });
  });

  return (
    <>
      {VEHICLES.map(v => (
        <group
          key={v.id}
          ref={el => { vehicleRefs.current[v.id] = el; }}
          position={v.pos}
        >
          <CarBody color={v.color} />
          <pointLight position={[0, 1, 2.5]} intensity={0.4} color="#ffe8aa" distance={10} />
        </group>
      ))}
    </>
  );
}
