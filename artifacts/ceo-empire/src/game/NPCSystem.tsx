import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, Html } from "@react-three/drei";
import * as THREE from "three";
import { NPC_CONFIGS, NpcConfig } from "../lib/gameData";
import { useGame } from "../lib/gameStore";

const NPC_MODELS: Record<string, string> = {
  chico_formal:    "/assets/models/chico_formal.glb",
  chica_ejecutiva: "/assets/models/chica_ejecutiva.glb",
  chica_creativa:  "/assets/models/chica_creativa.glb",
  chico_casual:    "/assets/models/chico_casual.glb",
  lord_tuetano:    "/assets/models/lord_tuetano.glb",
  majin_bu:        "/assets/models/majin_bu.glb",
  majin_bu_barca:  "/assets/models/majin_bu_barca.glb",
  arthas:          "/assets/models/arthas.glb",
  bowser:          "/assets/models/bowser.glb",
  illidan:         "/assets/models/illidan.glb",
  mini_goku:       "/assets/models/mini_goku.glb",
};

interface NpcState {
  pos: THREE.Vector3;
  facing: number;
  dir: THREE.Vector3;
  changeTimer: number;
  hp: number;
}

function NpcMesh({ cfg, stateRef }: { cfg: NpcConfig; stateRef: React.MutableRefObject<NpcState> }) {
  const path = NPC_MODELS[cfg.model] ?? NPC_MODELS.chico_casual;
  const { scene } = useGLTF(path);
  const groupRef = useRef<THREE.Group>(null!);
  const cloned = useRef<THREE.Object3D>(scene.clone(true));
  const scale = cfg.scale ?? 1;

  useFrame(() => {
    if (!groupRef.current) return;
    const s = stateRef.current;
    groupRef.current.position.lerp(s.pos, 0.12);
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      s.facing,
      0.08,
    );
  });

  return (
    <group ref={groupRef} position={cfg.pos} scale={[scale, scale, scale]}>
      <primitive object={cloned.current} />
      {cfg.type === "hostile" || cfg.type === "boss" ? (
        <Html position={[0, 3.5, 0]} center style={{ pointerEvents: "none" }}>
          <div style={{
            background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,60,60,0.4)",
            borderRadius: 4, padding: "2px 8px", fontSize: 10, color: "#ff8888",
            whiteSpace: "nowrap",
          }}>
            ⚠ {cfg.name}
          </div>
        </Html>
      ) : null}
    </group>
  );
}

function SingleNpcAI({ cfg, stateRef, playerPos }: {
  cfg: NpcConfig;
  stateRef: React.MutableRefObject<NpcState>;
  playerPos: [number, number, number];
}) {
  useFrame((_, delta) => {
    const s = stateRef.current;
    s.changeTimer -= delta;

    const [px, , pz] = playerPos;
    const toPlayerX = px - s.pos.x;
    const toPlayerZ = pz - s.pos.z;
    const distToPlayer = Math.hypot(toPlayerX, toPlayerZ);

    if ((cfg.type === "hostile" || cfg.type === "boss") && distToPlayer < 35) {
      const nx = toPlayerX / distToPlayer;
      const nz = toPlayerZ / distToPlayer;
      s.dir.set(nx, 0, nz);
      s.facing = Math.atan2(nx, nz);
    } else if (s.changeTimer <= 0) {
      const angle = Math.random() * Math.PI * 2;
      s.dir.set(Math.sin(angle), 0, Math.cos(angle));
      s.facing = angle;
      s.changeTimer = 2 + Math.random() * 4;
    }

    const speed = cfg.type === "boss" ? 4.5 : cfg.type === "hostile" ? 3.5 : 1.2;
    s.pos.x = Math.max(-190, Math.min(190, s.pos.x + s.dir.x * speed * delta));
    s.pos.z = Math.max(-190, Math.min(190, s.pos.z + s.dir.z * speed * delta));
  });
  return null;
}

export function NPCSystem() {
  const { playerPos, takeDamage } = useGame();

  const stateRefs = useRef<Record<string, React.MutableRefObject<NpcState>>>(
    Object.fromEntries(NPC_CONFIGS.map(cfg => [
      cfg.id,
      { current: {
        pos: new THREE.Vector3(...cfg.pos),
        facing: Math.random() * Math.PI * 2,
        dir: new THREE.Vector3(Math.random()-0.5, 0, Math.random()-0.5).normalize(),
        changeTimer: Math.random() * 3,
        hp: cfg.health,
      } },
    ]))
  );

  // NPC damage to player
  useFrame((_, delta) => {
    const [px, , pz] = playerPos;
    NPC_CONFIGS.filter(n => n.type === "hostile" || n.type === "boss").forEach(cfg => {
      const s = stateRefs.current[cfg.id]?.current;
      if (!s) return;
      const d = Math.hypot(s.pos.x - px, s.pos.z - pz);
      if (d < 2.5) {
        const dmg = cfg.type === "boss" ? 12 : 6;
        takeDamage(dmg * delta);
      }
    });
  });

  return (
    <>
      {NPC_CONFIGS.map(cfg => (
        <group key={cfg.id}>
          <SingleNpcAI cfg={cfg} stateRef={stateRefs.current[cfg.id]!} playerPos={playerPos} />
          <NpcMesh cfg={cfg} stateRef={stateRefs.current[cfg.id]!} />
        </group>
      ))}
    </>
  );
}

// Preload NPC models
Object.values(NPC_MODELS).forEach(p => useGLTF.preload(p));
