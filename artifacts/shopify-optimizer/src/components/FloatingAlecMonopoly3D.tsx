import { Suspense, useRef, useEffect, useMemo, Component, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const MODEL_PATH = `${BASE_URL}/assets/3d/models/alec_monopoly.glb`;
const ANIM_ROOT  = `${BASE_URL}/assets/3d/animations/alec_monopoly`;

function isWebGLAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext("webgl") || c.getContext("experimental-webgl"))
    );
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

// ── Full phase type — matches Landing.tsx spiderPhase ────────────────────────
export type AlecPhase =
  | "hidden" | "fall" | "bounce" | "standup" | "look"
  | "ready" | "waiting" | "celebrate";

// Phase → { animName, loop }
// casual_walk = natural person walking in place (full body movement)
// arise       = character dramatically rising/appearing
// look_around = scans left–right
// think       = stationary pondering
// dance       = victory celebration
function resolveAnim(phase: AlecPhase): { name: string; looping: boolean } {
  switch (phase) {
    case "fall":
    case "bounce":
    case "standup":  return { name: "arise",        looping: false };
    case "look":     return { name: "look_around",  looping: false };
    case "waiting":  return { name: "think",         looping: true  };
    case "celebrate":return { name: "dance",         looping: true  };
    default:         return { name: "casual_walk",  looping: true  };
  }
}

// ── Inner character — base model + retargeted animation clip ─────────────────
// IMPORTANT: useEffect must include JSON.stringify(Object.keys(actions))
// so it re-fires AFTER useAnimations populates actions (async GLB load).
function AlecCharacter({
  animGlbPath,
  looping,
}: {
  animGlbPath: string;
  looping: boolean;
}) {
  const group = useRef<THREE.Group>(null!);

  // Base model provides mesh + skeleton
  const { scene } = useGLTF(MODEL_PATH);
  // Animation GLB provides the clip whose tracks target those bones
  const { animations } = useGLTF(animGlbPath);
  const { actions, mixer } = useAnimations(animations, group);

  // Normalise: fit to 2 units tall, feet at y = 0
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

  // ── KEY FIX: include actions key signature so effect re-runs when
  //    the GLB finishes loading and actions become available ──────────────────
  const actionKeys = JSON.stringify(Object.keys(actions));
  useEffect(() => {
    const keys = Object.keys(actions);
    if (!keys.length) return;               // GLB not yet loaded → wait
    Object.values(actions).forEach(a => a?.stop());
    const action = actions[keys[0]];
    if (!action) return;
    action.reset();
    action.setLoop(looping ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !looping;
    action.fadeIn(0.35);
    action.play();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animGlbPath, looping, actionKeys]);

  useFrame((_, dt) => mixer.update(dt));

  return <group ref={group}><primitive object={scene} /></group>;
}

// ── Scene ─────────────────────────────────────────────────────────────────────
function AlecScene({ phase }: { phase: AlecPhase }) {
  const { name, looping } = resolveAnim(phase);
  const animGlbPath = `${ANIM_ROOT}/${name}.glb`;

  // Subtle camera sway while walking/thinking
  const t = useRef(0);
  useFrame((state, dt) => {
    if (phase === "ready" || phase === "waiting") {
      t.current += dt;
      state.camera.position.y = 1.1 + Math.sin(t.current * 0.6) * 0.03;
      state.camera.position.x = Math.sin(t.current * 0.25) * 0.05;
    }
  });

  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 7, 5]}   intensity={1.5} castShadow />
      <directionalLight position={[-3, 4, -2]}  intensity={0.4} />
      <pointLight       position={[0, 3, 2]}    intensity={0.6} color="#c8a84b" />
      <Environment preset="sunset" />
      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.45}
        scale={5}
        blur={2.5}
        far={3}
      />
      <Suspense fallback={null}>
        <AlecCharacter animGlbPath={animGlbPath} looping={looping} />
      </Suspense>
    </>
  );
}

// ── CSS fallback (no WebGL) ───────────────────────────────────────────────────
function CSSFallback({ height, phase }: { height: number; phase: AlecPhase }) {
  const label =
    phase === "celebrate" ? "🎉 ¡MISIÓN CUMPLIDA!" :
    phase === "waiting"   ? "🤔 ANALIZANDO…"        :
    (phase === "fall" || phase === "bounce" || phase === "standup" || phase === "look")
                          ? "🎩 LLEGANDO…"           :
    "ALEC MONOPOLY";

  return (
    <div style={{ width: "100%", height, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 60% at 50% 38%, rgba(200,168,75,0.10) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ textAlign: "center" }}>
        <div className="sc-emoji-head" style={{ fontSize: 120, lineHeight: 1, display: "inline-block", filter: "drop-shadow(0 20px 40px rgba(200,168,75,0.40))", transformOrigin: "center bottom" }}>🎩</div>
        <div style={{ marginTop: 14, fontSize: 12, fontWeight: 700, letterSpacing: 3, color: "rgba(200,168,75,0.65)", textTransform: "uppercase" }}>{label}</div>
      </div>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────
export interface FloatingAlecMonopolyProps {
  height?: number;
  phase?: AlecPhase;
}

export function FloatingAlecMonopoly({ height = 320, phase = "ready" }: FloatingAlecMonopolyProps) {
  const webglOk = useMemo(() => isWebGLAvailable(), []);
  const fallback = <CSSFallback height={height} phase={phase} />;

  if (!webglOk || phase === "hidden") return fallback;

  return (
    <SceneErrorBoundary fallback={fallback}>
      <Canvas
        style={{ width: "100%", height, background: "transparent" }}
        camera={{ position: [0, 1.1, 3.4], fov: 50 }}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
      >
        <Suspense fallback={null}>
          <AlecScene phase={phase} />
        </Suspense>
      </Canvas>
    </SceneErrorBoundary>
  );
}

// Preload the four most-used GLBs so first frames are instant
useGLTF.preload(MODEL_PATH);
useGLTF.preload(`${ANIM_ROOT}/casual_walk.glb`);
useGLTF.preload(`${ANIM_ROOT}/look_around.glb`);
useGLTF.preload(`${ANIM_ROOT}/think.glb`);
useGLTF.preload(`${ANIM_ROOT}/arise.glb`);
useGLTF.preload(`${ANIM_ROOT}/dance.glb`);
