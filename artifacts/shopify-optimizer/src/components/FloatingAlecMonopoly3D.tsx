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

// ── Verified animation names (from actual GLB JSON inspection) ─────────────────
// casual_walk.glb     → Armature|Casual_Walk|baselayer     ✅ walking
// think.glb           → Armature|Idle_02|baselayer          ✅ idle/thinking
// catching_breath.glb → Armature|Catching_Breath|baselayer  ✅ standing breathing
// big_wave_hello.glb  → Armature|Big_Wave_Hello|baselayer   ✅ greeting wave
// cardio_dance.glb    → Armature|Cardio_Dance|baselayer     ✅ dancing/celebrate
// arm_circle_shuffle.glb → Armature|Arm_Circle_Shuffle|baselayer ✅ energetic
// agree_gesture.glb   → Armature|Agree_Gesture|baselayer    ✅ pointing gesture
// arise.glb           → Armature|Arise|baselayer            ✅ standup from floor
// all_night_dance.glb → Armature|All_Night_Dance|baselayer  ✅ full dance
//
// WRONG files (DO NOT USE — real content mismatches filename):
// idle_breath.glb  → Armature|BackLeft_run|baselayer    ❌ running!
// wave.glb         → Armature|BackRight_Run|baselayer   ❌ running!
// dance.glb        → Armature|ForwardLeft_Run_Fight|baselayer ❌ fight-run!
// look_around.glb  → Armature|Run_02|baselayer          ❌ running!
// thumbs_up.glb    → Armature|BeHit_FlyUp|baselayer     ❌ hit-fly!

function resolveAnim(phase: AlecPhase, animName?: string): { name: string; looping: boolean } {
  if (animName) return { name: animName, looping: true };
  switch (phase) {
    case "fall":
    case "bounce":
    case "standup":  return { name: "arise",            looping: false };
    case "look":     return { name: "agree_gesture",    looping: false };
    case "waiting":  return { name: "think",            looping: true  };
    case "celebrate":return { name: "cardio_dance",     looping: true  };
    default:         return { name: "casual_walk",      looping: true  };
  }
}

// ── CHARACTER ─────────────────────────────────────────────────────────────────
// Loads ONE single GLB that contains mesh + skeleton + animation baked together.
// Scene is CLONED from the useGLTF cache so:
//   a) mutations (scale/position normalization) don't corrupt the shared cache
//   b) each mount gets its own independent THREE.AnimationMixer binding
//
// Animation start is deferred to useFrame (not useEffect + actionKeys trick)
// because @react-three/drei's useAnimations uses Object.defineProperty on a
// useRef — mutations that never trigger React re-renders. useFrame runs AFTER
// all effects so actions are guaranteed to be populated on first frame.

function AlecCharacter({
  animGlbPath,
  looping,
  animLooping,
}: {
  animGlbPath: string;
  looping: boolean;
  animLooping?: boolean;
}) {
  const group        = useRef<THREE.Group>(null!);
  const { scene: rawScene, animations } = useGLTF(animGlbPath);

  // Deep-clone so each component instance owns its own scene graph
  const scene = useMemo(() => rawScene.clone(true), [rawScene]);

  const { actions, mixer } = useAnimations(animations, group);

  const headBoneRef  = useRef<THREE.Object3D | null>(null);
  const rootBoneRef  = useRef<THREE.Object3D | null>(null);
  const headRot      = useRef({ x: 0, y: 0 });
  const animStarted  = useRef(false);

  // Normalize scene once: 2 units tall, feet at y=0; locate bones
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

    headBoneRef.current = null;
    rootBoneRef.current = null;
    scene.traverse(obj => {
      const n = obj.name.toLowerCase();
      if (
        !headBoneRef.current && (
          n === "head" ||
          n === "mixamorighead" ||
          n === "bip01_head" ||
          (n.includes("head") &&
            !n.includes("end") && !n.includes("top") &&
            !n.includes("hair") && !n.includes("band"))
        )
      ) {
        headBoneRef.current = obj;
      }
      // Root hip bone — lock its X/Z to prevent walk animations drifting off-screen
      if (
        !rootBoneRef.current && (
          n === "hips" ||
          n === "mixamorigHips" ||
          n === "bip01_pelvis" ||
          n === "hip"
        )
      ) {
        rootBoneRef.current = obj;
      }
    });
  }, [scene]);

  // Main loop: update mixer → start anim on first frame → lock root drift → head track
  useFrame((state, dt) => {
    mixer.update(dt);

    // Start animation once per mount — useFrame is guaranteed to run AFTER
    // useAnimations' useEffect has defined the lazy-getter actions.
    if (!animStarted.current) {
      const key = Object.keys(actions)[0];
      const action = key ? actions[key] : null;
      if (action) {
        const shouldLoop = animLooping ?? looping;
        action.reset();
        action.setLoop(shouldLoop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
        action.clampWhenFinished = !shouldLoop;
        action.fadeIn(0.3);
        action.play();
        animStarted.current = true;
      }
    }

    // Lock hip-bone X/Z so walk animations keep character centered (treadmill effect)
    if (rootBoneRef.current) {
      rootBoneRef.current.position.x = 0;
      rootBoneRef.current.position.z = 0;
    }

    // Visme-style eye/head tracking: pointer → atan2-based bone rotation
    if (headBoneRef.current) {
      const targetY =  state.pointer.x * 0.45;
      const targetX = -state.pointer.y * 0.30;
      headRot.current.y = THREE.MathUtils.lerp(headRot.current.y, targetY, 0.04);
      headRot.current.x = THREE.MathUtils.lerp(headRot.current.x, targetX, 0.04);
      headRot.current.y = THREE.MathUtils.clamp(headRot.current.y, -0.45, 0.45);
      headRot.current.x = THREE.MathUtils.clamp(headRot.current.x, -0.30, 0.30);
      headBoneRef.current.rotation.y = headRot.current.y;
      headBoneRef.current.rotation.x = headRot.current.x;
    }
  });

  return <group ref={group}><primitive object={scene} /></group>;
}

// ── Camera rig: lerps to target per step ─────────────────────────────────────
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

      {/* Lighting: low ambient for contrast, strong key + fill reveals texture detail */}
      <ambientLight intensity={0.35} />
      <directionalLight position={[2, 6, 4]}   intensity={2.2} castShadow
        shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[-3, 3, 2]}  intensity={0.7} />
      <directionalLight position={[0, 1, 5]}   intensity={0.9} />

      {/* Neutral studio environment — shows PBR textures without color cast */}
      <Environment preset="studio" />

      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.5}
        scale={5}
        blur={2.2}
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
          toneMappingExposure: 0.8,
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

// ── Preload verified animations ───────────────────────────────────────────────
useGLTF.preload(`${ANIM_ROOT}/casual_walk.glb`);
useGLTF.preload(`${ANIM_ROOT}/think.glb`);
useGLTF.preload(`${ANIM_ROOT}/catching_breath.glb`);
useGLTF.preload(`${ANIM_ROOT}/arise.glb`);
useGLTF.preload(`${ANIM_ROOT}/cardio_dance.glb`);
useGLTF.preload(`${ANIM_ROOT}/big_wave_hello.glb`);
useGLTF.preload(`${ANIM_ROOT}/agree_gesture.glb`);
useGLTF.preload(`${ANIM_ROOT}/arm_circle_shuffle.glb`);
