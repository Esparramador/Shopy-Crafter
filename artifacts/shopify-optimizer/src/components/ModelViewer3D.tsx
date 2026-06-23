import { Suspense, useRef, useEffect, useState, useMemo, Component, type ErrorInfo, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, OrbitControls, Environment, ContactShadows, Html } from "@react-three/drei";
import * as THREE from "three";
import { Play, Pause, RotateCcw, Sun } from "lucide-react";

// ── Last-resort React ErrorBoundary (for non-GLB Canvas errors) ───────────────
class ModelErrorBoundary extends Component<
  { children: ReactNode; height: string | number },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; height: string | number }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(_err: Error, _info: ErrorInfo) {}
  render() {
    if (this.state.hasError) {
      const h = typeof this.props.height === "number" ? `${this.props.height}px` : this.props.height;
      return (
        <div style={{
          height: h, display: "flex", alignItems: "center", justifyContent: "center",
          background: "#0a0a0a", borderRadius: 8,
          color: "#444", fontSize: 11, fontFamily: "monospace",
          border: "1px solid rgba(212,168,67,0.1)",
        }}>
          Modelo 3D no disponible
        </div>
      );
    }
    return this.props.children;
  }
}

export interface ModelAnimation {
  name: string;
  label: string;
  glbPath: string;
  looping?: boolean;
}

export interface ModelViewerProps {
  glbPath: string;
  animations?: ModelAnimation[];
  characterName?: string;
  className?: string;
  autoRotate?: boolean;
  height?: number | string;
  overrideAnimPath?: string | null;
  hideAnimPills?: boolean;
  onRigStatus?: (isRigged: boolean, boneCount: number) => void;
}

// ── Rig detector (runs inside Canvas) ────────────────────────────────────────

function RigDetector({ glbPath, onRigStatus }: { glbPath: string; onRigStatus: (r: boolean, b: number) => void }) {
  const { scene } = useGLTF(glbPath);
  useEffect(() => {
    if (!scene) return;
    let hasBones = false;
    let boneCount = 0;
    scene.traverse((obj: any) => {
      if (obj.isBone) { hasBones = true; boneCount++; }
      if (obj.isSkinnedMesh) hasBones = true;
    });
    onRigStatus(hasBones, boneCount);
  }, [glbPath]);
  return null;
}

// ── Helper: normalize model scale and floor position ─────────────────────────

function normalizeScene(scene: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim === 0) return;
  const scale = 2 / maxDim;
  const center = box.getCenter(new THREE.Vector3());
  scene.scale.setScalar(scale);
  scene.position.sub(center.multiplyScalar(scale));
  const box2 = new THREE.Box3().setFromObject(scene);
  scene.position.y -= box2.min.y;
}

// ── Base model (no animation GLB) ────────────────────────────────────────────

function BaseModel({ glbPath, onReady }: { glbPath: string; onReady?: () => void }) {
  const group = useRef<THREE.Group>(null!);
  const { scene: rawScene, animations } = useGLTF(glbPath);
  // Clone scene so cached useGLTF data isn't mutated across remounts
  const scene = useMemo(() => rawScene.clone(true), [rawScene]);
  const { actions, mixer } = useAnimations(animations, group);
  const animStarted = useRef(false);

  useEffect(() => {
    if (!scene) return;
    normalizeScene(scene);
    onReady?.();
    animStarted.current = false;
  }, [glbPath]);

  // Use useFrame to start animation — actions are populated AFTER useEffect runs
  // (drei uses Object.defineProperty mutations), so useFrame is the reliable trigger
  useFrame((_, dt) => {
    mixer.update(dt);
    if (!animStarted.current) {
      const key = Object.keys(actions)[0];
      const action = key ? actions[key] : null;
      if (action) {
        action.reset();
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.play();
        animStarted.current = true;
      }
    }
  });

  return <group ref={group}><primitive object={scene} /></group>;
}

// ── Animated model ────────────────────────────────────────────────────────────

function AnimatedModel({
  animGlbPath, looping, onReady,
}: {
  animGlbPath: string;
  looping?: boolean;
  onReady?: () => void;
}) {
  const group = useRef<THREE.Group>(null!);
  const { scene: rawScene, animations } = useGLTF(animGlbPath);
  // Clone scene so cached useGLTF data isn't mutated across remounts
  const scene = useMemo(() => rawScene.clone(true), [rawScene]);
  const { actions, mixer } = useAnimations(animations, group);
  const animStarted = useRef(false);

  useEffect(() => {
    if (!scene) return;
    normalizeScene(scene);
    onReady?.();
    animStarted.current = false;
  }, [animGlbPath]);

  // Use useFrame to start animation — actions are populated AFTER useEffect runs
  useFrame((_, dt) => {
    mixer.update(dt);
    if (!animStarted.current) {
      const key = Object.keys(actions)[0];
      const action = key ? actions[key] : null;
      if (action) {
        action.reset();
        action.setLoop(looping ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
        action.clampWhenFinished = !looping;
        action.play();
        animStarted.current = true;
      }
    }
  });

  return <group ref={group}><primitive object={scene} /></group>;
}

// ── Switcher: picks which sub-component to render ────────────────────────────

function ModelSwitcher({
  glbPath, animGlbPath, looping, autoRotate, envPreset, onReady, onRigStatus,
}: {
  glbPath: string;
  animGlbPath?: string;
  looping?: boolean;
  autoRotate: boolean;
  envPreset: string;
  onReady?: () => void;
  onRigStatus?: (isRigged: boolean, boneCount: number) => void;
}) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-3, 4, -3]} intensity={0.4} />
      <Environment preset={envPreset as any} />
      <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={6} blur={2} far={3} />
      {onRigStatus && (
        <Suspense fallback={null}>
          <RigDetector glbPath={glbPath} onRigStatus={onRigStatus} />
        </Suspense>
      )}
      {animGlbPath
        ? <AnimatedModel key={animGlbPath} animGlbPath={animGlbPath} looping={looping} onReady={onReady} />
        : <BaseModel key={glbPath} glbPath={glbPath} onReady={onReady} />
      }
      <OrbitControls
        target={[0, 1.0, 0]}
        autoRotate={autoRotate}
        autoRotateSpeed={1.5}
        enablePan={false}
        minDistance={1.5}
        maxDistance={8}
        maxPolarAngle={Math.PI / 2 + 0.1}
      />
    </>
  );
}

// ── Loading spinner ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <Html center>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "#d4a843" }}>
        <div style={{
          width: 32, height: 32,
          border: "3px solid #d4a84344",
          borderTopColor: "#d4a843",
          borderRadius: "50%",
          animation: "mv3d-spin 1s linear infinite",
        }} />
        <span style={{ fontSize: 11, fontFamily: "monospace" }}>Cargando modelo 3D…</span>
      </div>
    </Html>
  );
}

// ── HEAD pre-check hook ───────────────────────────────────────────────────────
// Checks if a GLB file actually exists BEFORE passing it to useGLTF.
// This prevents the Vite runtime-error overlay from appearing when a file
// returns HTML 404 instead of a valid GLB binary.

function useGlbExists(path: string | null | undefined): "checking" | "ok" | "missing" {
  const [status, setStatus] = useState<"checking" | "ok" | "missing">("checking");
  useEffect(() => {
    if (!path) { setStatus("ok"); return; }
    let active = true;
    setStatus("checking");
    fetch(path, { method: "HEAD" })
      .then(r => { if (active) setStatus(r.ok ? "ok" : "missing"); })
      .catch(() => { if (active) setStatus("missing"); });
    return () => { active = false; };
  }, [path]);
  return status;
}

// ── Main component ────────────────────────────────────────────────────────────

const ENV_PRESETS = ["sunset", "city", "dawn", "warehouse", "forest"] as const;

export default function ModelViewer3D({
  glbPath,
  animations = [],
  characterName,
  className = "",
  autoRotate: initAutoRotate = true,
  height = 480,
  overrideAnimPath,
  hideAnimPills = false,
  onRigStatus,
}: ModelViewerProps) {
  const [animIdx, setAnimIdx]       = useState(-1);
  const [paused, setPaused]         = useState(false);
  const [autoRotate, setAutoRotate] = useState(initAutoRotate);
  const [envIdx, setEnvIdx]         = useState(0);

  const currentAnim = animations[animIdx] ?? null;

  const effectiveAnimPath: string | undefined =
    overrideAnimPath !== undefined
      ? (overrideAnimPath ?? undefined)
      : (currentAnim?.glbPath ?? undefined);

  const effectiveLooping: boolean =
    overrideAnimPath !== undefined
      ? true
      : (currentAnim?.looping ?? true);

  const envPreset = ENV_PRESETS[envIdx % ENV_PRESETS.length];
  const h = typeof height === "number" ? `${height}px` : height;

  // ── HEAD pre-checks: verify files exist before touching useGLTF ──────────
  const baseStatus = useGlbExists(glbPath);
  const animStatus = useGlbExists(effectiveAnimPath ?? null);

  // If animation GLB is missing, fall back to base pose silently
  const safeAnimPath = effectiveAnimPath && animStatus === "ok" ? effectiveAnimPath : undefined;

  // ── Fallback tile ─────────────────────────────────────────────────────────
  const missingTile = (
    <div style={{
      height: h, display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 8, background: "#0a0a0a",
      border: "1px solid rgba(212,168,67,0.12)", borderRadius: 8,
    }}>
      <span style={{ fontSize: 28 }}>🧊</span>
      <span style={{ color: "#444", fontSize: 11, fontFamily: "monospace" }}>
        Modelo 3D no disponible
      </span>
      <span style={{ color: "#333", fontSize: 10, fontFamily: "monospace" }}>
        Genera el personaje en Meshy Studio
      </span>
    </div>
  );

  const checkingTile = (
    <div style={{
      height: h, display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0a0a0a", border: "1px solid rgba(212,168,67,0.12)", borderRadius: 8,
    }}>
      <div style={{
        width: 24, height: 24,
        border: "2px solid #d4a84344",
        borderTopColor: "#d4a843",
        borderRadius: "50%",
        animation: "mv3d-spin 1s linear infinite",
      }} />
    </div>
  );

  return (
    <div
      className={className}
      style={{ display: "flex", flexDirection: "column", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(212,168,67,0.2)", background: "#0a0a0a" }}
    >
      {/* 3D Canvas — only rendered when base GLB confirmed to exist */}
      {baseStatus === "checking" ? checkingTile
        : baseStatus === "missing" ? missingTile
        : (
        <ModelErrorBoundary height={height}>
        <div style={{ height: h, position: "relative" }}>
          <Canvas
            shadows
            camera={{ position: [0, 1.5, 4], fov: 45 }}
            gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
            style={{ background: "radial-gradient(ellipse at 50% 65%, #1a1206 0%, #080808 100%)" }}
          >
            <Suspense fallback={<Spinner />}>
              <ModelSwitcher
                glbPath={glbPath}
                animGlbPath={safeAnimPath}
                looping={effectiveLooping}
                autoRotate={autoRotate && !paused}
                envPreset={envPreset}
                onRigStatus={onRigStatus}
              />
            </Suspense>
          </Canvas>

          {characterName && (
            <div style={{
              position: "absolute", top: 10, left: 10,
              background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
              borderRadius: 8, padding: "5px 12px",
              border: "1px solid rgba(212,168,67,0.35)",
              color: "#d4a843", fontWeight: 600, fontSize: 13, pointerEvents: "none",
            }}>
              {characterName}
            </div>
          )}

          {safeAnimPath && (
            <div style={{
              position: "absolute", bottom: 10, left: 10,
              background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
              borderRadius: 6, padding: "3px 10px",
              border: "1px solid rgba(212,168,67,0.2)",
              color: "#d4a843", fontSize: 11, pointerEvents: "none",
            }}>
              ▶ {safeAnimPath.split("/").pop()?.replace(".glb", "") ?? ""}
            </div>
          )}

          <button
            onClick={() => setEnvIdx(i => i + 1)}
            style={{
              position: "absolute", top: 10, right: 10,
              background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
              borderRadius: 8, padding: "6px 8px",
              border: "1px solid rgba(212,168,67,0.35)",
              cursor: "pointer", color: "#d4a843",
              display: "flex", alignItems: "center",
            }}
            title={`Ambiente: ${envPreset}`}
          >
            <Sun size={14} />
          </button>
        </div>
        </ModelErrorBoundary>
      )}

      {/* Controls bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", background: "rgba(20,15,5,0.95)", borderTop: "1px solid rgba(212,168,67,0.12)" }}>
        <button
          onClick={() => setPaused(p => !p)}
          style={{ padding: "5px 7px", borderRadius: 7, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", color: "#d4a843", display: "flex" }}
          title={paused ? "Reanudar" : "Pausar"}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>

        <button
          onClick={() => setAutoRotate(r => !r)}
          style={{
            padding: "5px 7px", borderRadius: 7, border: "1px solid",
            background: autoRotate ? "rgba(212,168,67,0.18)" : "rgba(255,255,255,0.04)",
            borderColor: autoRotate ? "rgba(212,168,67,0.5)" : "rgba(255,255,255,0.1)",
            cursor: "pointer", color: autoRotate ? "#d4a843" : "#666", display: "flex",
          }}
          title="Rotación automática"
        >
          <RotateCcw size={14} />
        </button>

        <span style={{ flex: 1, textAlign: "center", fontSize: 11, color: safeAnimPath ? "#d4a843" : "#555", fontWeight: safeAnimPath ? 600 : 400 }}>
          {safeAnimPath
            ? `▶ ${safeAnimPath.split("/").pop()?.replace(".glb", "")}`
            : (currentAnim ? currentAnim.label : "Pose base · arrastra para rotar")}
        </span>

        <span style={{ fontSize: 10, color: "#444", padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
          {envPreset}
        </span>
      </div>

      {/* Animation pills (internal control, shown only when not overriding and not hidden) */}
      {!hideAnimPills && overrideAnimPath === undefined && animations.length > 0 && (
        <div style={{ display: "flex", gap: 6, padding: "6px 10px", background: "rgba(12,8,2,0.95)", borderTop: "1px solid rgba(212,168,67,0.07)", overflowX: "auto" }}>
          <button
            onClick={() => setAnimIdx(-1)}
            style={{
              flexShrink: 0, padding: "3px 12px", borderRadius: 20, fontSize: 11, fontWeight: 500, cursor: "pointer", border: "1px solid",
              background: animIdx === -1 ? "#d4a843" : "rgba(255,255,255,0.04)",
              borderColor: animIdx === -1 ? "#d4a843" : "rgba(255,255,255,0.1)",
              color: animIdx === -1 ? "#000" : "#888",
            }}
          >
            Pose
          </button>
          {animations.map((a, i) => (
            <button
              key={a.name}
              onClick={() => setAnimIdx(i)}
              style={{
                flexShrink: 0, padding: "3px 12px", borderRadius: 20, fontSize: 11, fontWeight: 500, cursor: "pointer", border: "1px solid",
                background: animIdx === i ? "#d4a843" : "rgba(255,255,255,0.04)",
                borderColor: animIdx === i ? "#d4a843" : "rgba(255,255,255,0.1)",
                color: animIdx === i ? "#000" : "#888",
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      <style>{`@keyframes mv3d-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
