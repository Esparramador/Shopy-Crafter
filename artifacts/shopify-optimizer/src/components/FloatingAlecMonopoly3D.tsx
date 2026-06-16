import { Suspense, useRef, useEffect, useMemo, Component, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useAnimations, ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const ANIM_ROOT = `${BASE_URL}/assets/3d/animations/alec_monopoly`;

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

export type AlecPhase =
  | "hidden" | "fall" | "bounce" | "standup" | "look"
  | "ready" | "waiting" | "celebrate";

function resolveAnim(phase: AlecPhase, animName?: string): { name: string; looping: boolean } {
  if (animName) return { name: animName, looping: true };
  switch (phase) {
    case "fall":
    case "bounce":
    case "standup":  return { name: "arise",       looping: false };
    case "look":     return { name: "look_around", looping: false };
    case "waiting":  return { name: "think",        looping: true  };
    case "celebrate":return { name: "dance",        looping: true  };
    default:         return { name: "casual_walk", looping: true  };
  }
}

// ── CHARACTER: loads mesh + skeleton + animation from ONE single GLB ──────────
// CRITICAL FIX: Meshy animation GLBs contain the complete animated character
// (mesh + skeleton + animation baked together). When you load the base model
// and animation clips separately, bone UUIDs in the clips don't match the bones
// in the base model → animation plays but the mesh stays static.
// Loading everything from the SAME animGlbPath guarantees UUID/path alignment.

function AlecCharacter({
  animGlbPath,
  looping,
  animLooping,
}: {
  animGlbPath: string;
  looping: boolean;
  animLooping?: boolean;
}) {
  const group      = useRef<THREE.Group>(null!);
  const { scene, animations } = useGLTF(animGlbPath);
  const { actions, mixer }    = useAnimations(animations, group);

  const headBoneRef = useRef<THREE.Object3D | null>(null);
  const headRot     = useRef({ x: 0, y: 0 });

  // Normalize scene: 2 units tall, feet at y=0, then locate head bone
  useEffect(() => {
    if (!scene) return;
    const box  = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const sc   = 2 / Math.max(size.x, size.y, size.z, 0.001);
    const ctr  = box.getCenter(new THREE.Vector3());
    scene.scale.setScalar(sc);
    scene.position.sub(ctr.multiplyScalar(sc));
    const box2 = new THREE.Box3().setFromObject(scene);
    scene.position.y -= box2.min.y;

    // Find head bone for Visme-style eye/head tracking (Math.atan2 style)
    headBoneRef.current = null;
    scene.traverse(obj => {
      if (headBoneRef.current) return;
      const n = obj.name.toLowerCase();
      if (
        n === "head" ||
        n === "mixamorighead" ||
        n === "bip01_head" ||
        (n.includes("head") &&
          !n.includes("end") && !n.includes("top") &&
          !n.includes("hair") && !n.includes("band"))
      ) {
        headBoneRef.current = obj;
      }
    });
  }, [scene]);

  // Play animation — wait for useAnimations to populate actions (GLB async load)
  const actionKeys = JSON.stringify(Object.keys(actions));
  useEffect(() => {
    const keys = Object.keys(actions);
    if (!keys.length) return;
    Object.values(actions).forEach(a => a?.stop());
    const action = actions[keys[0]];
    if (!action) return;
    const shouldLoop = animLooping ?? looping;
    action.reset();
    action.setLoop(shouldLoop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !shouldLoop;
    action.fadeIn(0.35);
    action.play();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animGlbPath, looping, animLooping, actionKeys]);

  // Mixer tick + Visme-style head tracking via React Three Fiber pointer
  // state.pointer = normalized [-1, +1] mouse within the canvas (built-in R3F)
  // Applying Math.atan2 equivalent: yaw = atan2(deltaX, depth) ≈ pointer.x * scale
  useFrame((state, dt) => {
    mixer.update(dt);
    if (headBoneRef.current) {
      const targetY =  state.pointer.x * 0.45;  // yaw: left / right
      const targetX = -state.pointer.y * 0.30;  // pitch: up / down
      // Lerp for biological feel (Visme approach)
      headRot.current.y = THREE.MathUtils.lerp(headRot.current.y, targetY, 0.04);
      headRot.current.x = THREE.MathUtils.lerp(headRot.current.x, targetX, 0.04);
      // Anatomical clamp — prevents unnatural rotation
      headRot.current.y = THREE.MathUtils.clamp(headRot.current.y, -0.45, 0.45);
      headRot.current.x = THREE.MathUtils.clamp(headRot.current.x, -0.30, 0.30);
      headBoneRef.current.rotation.y = headRot.current.y;
      headBoneRef.current.rotation.x = headRot.current.x;
    }
  });

  return <group ref={group}><primitive object={scene} /></group>;
}

// ── Camera rig: lerps to target position per step / phase ────────────────────
function CameraRig({
  pos,
  lookAt,
}: {
  pos: [number, number, number];
  lookAt: [number, number, number];
}) {
  const { camera } = useThree();
  const tPos  = useRef(new THREE.Vector3(...pos));
  const tLook = useRef(new THREE.Vector3(...lookAt));

  useEffect(() => { tPos.current.set(...pos); },    [pos[0], pos[1], pos[2]]);    // eslint-disable-line
  useEffect(() => { tLook.current.set(...lookAt); }, [lookAt[0], lookAt[1], lookAt[2]]); // eslint-disable-line

  useFrame(() => {
    camera.position.lerp(tPos.current, 0.05);
    camera.lookAt(tLook.current);
  });
  return null;
}

// ── Scene ─────────────────────────────────────────────────────────────────────
function AlecScene({
  phase,
  animName,
  animLooping,
  cameraPos,
  cameraLookAt,
}: {
  phase: AlecPhase;
  animName?: string;
  animLooping?: boolean;
  cameraPos: [number, number, number];
  cameraLookAt: [number, number, number];
}) {
  const { name, looping } = resolveAnim(phase, animName);
  const animGlbPath = `${ANIM_ROOT}/${name}.glb`;

  return (
    <>
      <CameraRig pos={cameraPos} lookAt={cameraLookAt} />
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
        <AlecCharacter
          key={animGlbPath}
          animGlbPath={animGlbPath}
          looping={looping}
          animLooping={animLooping}
        />
      </Suspense>
    </>
  );
}

// ── CSS fallback (no WebGL / phase=hidden) ────────────────────────────────────
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
        <div style={{ fontSize: 120, lineHeight: 1, display: "inline-block", filter: "drop-shadow(0 20px 40px rgba(200,168,75,0.40))", transformOrigin: "center bottom" }}>🎩</div>
        <div style={{ marginTop: 14, fontSize: 12, fontWeight: 700, letterSpacing: 3, color: "rgba(200,168,75,0.65)", textTransform: "uppercase" }}>{label}</div>
      </div>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────
export interface FloatingAlecMonopolyProps {
  height?: number;
  phase?: AlecPhase;
  animName?: string;
  animLooping?: boolean;
  cameraPos?: [number, number, number];
  cameraLookAt?: [number, number, number];
}

export function FloatingAlecMonopoly({
  height = 320,
  phase = "ready",
  animName,
  animLooping,
  cameraPos,
  cameraLookAt,
}: FloatingAlecMonopolyProps) {
  const webglOk  = useMemo(() => isWebGLAvailable(), []);
  const fallback = <CSSFallback height={height} phase={phase} />;
  const camPos  = cameraPos  ?? [0, 1.1, 3.4] as [number, number, number];
  const camLook = cameraLookAt ?? [0, 1.0, 0] as [number, number, number];

  if (!webglOk || phase === "hidden") return fallback;

  return (
    <SceneErrorBoundary fallback={fallback}>
      <Canvas
        style={{ width: "100%", height, background: "transparent" }}
        camera={{ position: camPos, fov: 50 }}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
      >
        <Suspense fallback={null}>
          <AlecScene
            phase={phase}
            animName={animName}
            animLooping={animLooping}
            cameraPos={camPos}
            cameraLookAt={camLook}
          />
        </Suspense>
      </Canvas>
    </SceneErrorBoundary>
  );
}

// Preload key animation GLBs (single-GLB approach — no separate base model)
useGLTF.preload(`${ANIM_ROOT}/casual_walk.glb`);
useGLTF.preload(`${ANIM_ROOT}/look_around.glb`);
useGLTF.preload(`${ANIM_ROOT}/think.glb`);
useGLTF.preload(`${ANIM_ROOT}/arise.glb`);
useGLTF.preload(`${ANIM_ROOT}/dance.glb`);
useGLTF.preload(`${ANIM_ROOT}/celebrate.glb`);
useGLTF.preload(`${ANIM_ROOT}/idle_breath.glb`);
useGLTF.preload(`${ANIM_ROOT}/big_wave_hello.glb`);
