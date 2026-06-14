import { Suspense, useRef, useEffect, useMemo, Component, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";

const BASE_URL   = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const MODEL_PATH = `${BASE_URL}/assets/3d/models/batman.glb`;
const ANIM_ROOT  = `${BASE_URL}/assets/3d/animations/batman`;

function isWebGLAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext &&
      (c.getContext("webgl") || c.getContext("experimental-webgl")));
  } catch { return false; }
}

class SceneErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { crashed: boolean }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { crashed: false };
  }
  static getDerivedStateFromError() { return { crashed: true }; }
  componentDidCatch() {}
  render() {
    return this.state.crashed ? this.props.fallback : this.props.children;
  }
}

export type BatPhase =
  | "hidden" | "fall" | "bounce" | "standup" | "look"
  | "ready" | "waiting" | "celebrate";

function resolveAnim(phase: BatPhase): { name: string; looping: boolean } {
  switch (phase) {
    case "fall":
    case "bounce":
    case "standup":  return { name: "walk",        looping: true  };
    case "look":     return { name: "look_around", looping: false };
    case "waiting":  return { name: "think",        looping: true  };
    case "celebrate":return { name: "victory",      looping: true  };
    default:         return { name: "idle_breath",  looping: true  };
  }
}

function BatmanCharacter({
  animGlbPath,
  looping,
}: {
  animGlbPath: string;
  looping: boolean;
}) {
  const group = useRef<THREE.Group>(null!);
  const { scene }      = useGLTF(MODEL_PATH);
  const { animations } = useGLTF(animGlbPath);
  const { actions, mixer } = useAnimations(animations, group);

  useEffect(() => {
    if (!scene) return;
    const box  = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const sc   = 2 / Math.max(size.x, size.y, size.z);
    const ctr  = box.getCenter(new THREE.Vector3());
    scene.scale.setScalar(sc);
    scene.position.sub(ctr.multiplyScalar(sc));
    const box2 = new THREE.Box3().setFromObject(scene);
    scene.position.y -= box2.min.y;
  }, [scene]);

  const actionKeys = JSON.stringify(Object.keys(actions));
  useEffect(() => {
    const keys = Object.keys(actions);
    if (!keys.length) return;
    Object.values(actions).forEach(a => a?.stop());
    const action = actions[keys[0]];
    if (!action) return;
    action.reset();
    action.setLoop(looping ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !looping;
    action.fadeIn(0.35);
    action.play();
  }, [animGlbPath, looping, actionKeys]);

  useFrame((_, dt) => mixer.update(dt));

  return <group ref={group}><primitive object={scene} /></group>;
}

function BatmanScene({ phase }: { phase: BatPhase }) {
  const { name, looping } = resolveAnim(phase);
  const animGlbPath = `${ANIM_ROOT}/${name}.glb`;

  const t = useRef(0);
  useFrame((state, dt) => {
    if (phase === "ready" || phase === "waiting") {
      t.current += dt;
      state.camera.position.y = 1.15 + Math.sin(t.current * 0.5) * 0.025;
      state.camera.position.x = Math.sin(t.current * 0.22) * 0.04;
    }
  });

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[3, 8, 5]}   intensity={1.7} castShadow color="#ffffff" />
      <directionalLight position={[-4, 3, -2]}  intensity={0.35} color="#4a9edd" />
      <pointLight       position={[0, 4, 1]}    intensity={1.4} color="#c8a84b" />
      <pointLight       position={[1.5, 0.5, 3]} intensity={0.5} color="#e6c668" />
      <Environment preset="night" />
      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.5}
        scale={5}
        blur={2}
        far={3}
        color="#c8a84b"
      />
      <Suspense fallback={null}>
        <BatmanCharacter animGlbPath={animGlbPath} looping={looping} />
      </Suspense>
    </>
  );
}

function CSSFallback({ height, phase }: { height: number; phase: BatPhase }) {
  const label =
    phase === "celebrate" ? "🎉 ¡MISIÓN CUMPLIDA!" :
    phase === "waiting"   ? "🦇 ANALIZANDO…" :
    (phase === "fall" || phase === "bounce" || phase === "standup" || phase === "look")
                          ? "🦇 LLEGANDO…" : "🦇";

  return (
    <div style={{ width: "100%", height, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 60% at 50% 38%, rgba(200,168,75,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 96, lineHeight: 1, filter: "drop-shadow(0 20px 40px rgba(200,168,75,0.45))", display: "inline-block" }}>🦇</div>
        <div style={{ marginTop: 12, fontSize: 11, fontWeight: 700, letterSpacing: 3, color: "rgba(200,168,75,0.6)", textTransform: "uppercase" }}>{label}</div>
      </div>
    </div>
  );
}

export interface FloatingBatmanProps {
  height?: number;
  phase?: BatPhase;
}

export function FloatingBatman({ height = 300, phase = "ready" }: FloatingBatmanProps) {
  const webglOk = useMemo(() => isWebGLAvailable(), []);
  const fallback = <CSSFallback height={height} phase={phase} />;

  if (!webglOk || phase === "hidden") return fallback;

  return (
    <SceneErrorBoundary fallback={fallback}>
      <Canvas
        style={{ width: "100%", height, background: "transparent" }}
        camera={{ position: [0, 1.15, 3.2], fov: 48 }}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
      >
        <Suspense fallback={null}>
          <BatmanScene phase={phase} />
        </Suspense>
      </Canvas>
    </SceneErrorBoundary>
  );
}

useGLTF.preload(MODEL_PATH);
useGLTF.preload(`${ANIM_ROOT}/walk.glb`);
useGLTF.preload(`${ANIM_ROOT}/look_around.glb`);
useGLTF.preload(`${ANIM_ROOT}/idle_breath.glb`);
useGLTF.preload(`${ANIM_ROOT}/victory.glb`);
useGLTF.preload(`${ANIM_ROOT}/think.glb`);
