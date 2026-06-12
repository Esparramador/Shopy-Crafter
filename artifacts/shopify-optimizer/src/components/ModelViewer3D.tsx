import { Suspense, useRef, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, OrbitControls, Environment, ContactShadows, Html } from "@react-three/drei";
import * as THREE from "three";
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Sun } from "lucide-react";

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
}

// ── Base model (no animation GLB) ─────────────────────────────────────────────

function BaseModel({ glbPath, onReady }: { glbPath: string; onReady?: () => void }) {
  const group = useRef<THREE.Group>(null!);
  const { scene, animations } = useGLTF(glbPath);
  const { actions, mixer } = useAnimations(animations, group);

  useEffect(() => {
    if (!scene) return;
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2 / maxDim;
    const center = box.getCenter(new THREE.Vector3());
    scene.scale.setScalar(scale);
    scene.position.sub(center.multiplyScalar(scale));
    const box2 = new THREE.Box3().setFromObject(scene);
    scene.position.y -= box2.min.y;
    onReady?.();
  }, [scene]);

  // Play first embedded animation if any
  useEffect(() => {
    const keys = Object.keys(actions);
    if (keys.length === 0) return;
    Object.values(actions).forEach(a => a?.stop());
    const first = actions[keys[0]];
    if (first) { first.reset(); first.setLoop(THREE.LoopRepeat, Infinity); first.play(); }
  }, [JSON.stringify(Object.keys(actions))]);

  useFrame((_, dt) => mixer.update(dt));

  return <group ref={group}><primitive object={scene} /></group>;
}

// ── Animated model (loads separate animation GLB) ─────────────────────────────

function AnimatedModel({
  glbPath, animGlbPath, looping, onReady,
}: {
  glbPath: string;
  animGlbPath: string;
  looping?: boolean;
  onReady?: () => void;
}) {
  const group = useRef<THREE.Group>(null!);
  const { scene } = useGLTF(glbPath);
  const { animations: animAnims } = useGLTF(animGlbPath);
  const { actions, mixer } = useAnimations(animAnims, group);

  useEffect(() => {
    if (!scene) return;
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2 / maxDim;
    const center = box.getCenter(new THREE.Vector3());
    scene.scale.setScalar(scale);
    scene.position.sub(center.multiplyScalar(scale));
    const box2 = new THREE.Box3().setFromObject(scene);
    scene.position.y -= box2.min.y;
    onReady?.();
  }, [scene]);

  useEffect(() => {
    const keys = Object.keys(actions);
    Object.values(actions).forEach(a => a?.stop());
    if (keys.length === 0) return;
    const target = actions[keys[0]];
    if (target) {
      target.reset();
      target.setLoop(looping ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      target.clampWhenFinished = !looping;
      target.play();
    }
  }, [animGlbPath, looping, JSON.stringify(Object.keys(actions))]);

  useFrame((_, dt) => mixer.update(dt));

  return <group ref={group}><primitive object={scene} /></group>;
}

// ── Switcher: picks which sub-component to render ────────────────────────────

function ModelSwitcher({
  glbPath, animGlbPath, looping, autoRotate, envPreset, onReady,
}: {
  glbPath: string;
  animGlbPath?: string;
  looping?: boolean;
  autoRotate: boolean;
  envPreset: string;
  onReady?: () => void;
}) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-3, 4, -3]} intensity={0.4} />
      <Environment preset={envPreset as any} />
      <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={6} blur={2} far={3} />
      {animGlbPath
        ? <AnimatedModel glbPath={glbPath} animGlbPath={animGlbPath} looping={looping} onReady={onReady} />
        : <BaseModel glbPath={glbPath} onReady={onReady} />
      }
      <OrbitControls
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

// ── Main component ────────────────────────────────────────────────────────────

const ENV_PRESETS = ["sunset", "city", "dawn", "warehouse", "forest"] as const;

export default function ModelViewer3D({
  glbPath,
  animations = [],
  characterName,
  className = "",
  autoRotate: initAutoRotate = true,
  height = 480,
}: ModelViewerProps) {
  const [animIdx, setAnimIdx]       = useState(-1);
  const [paused, setPaused]         = useState(false);
  const [autoRotate, setAutoRotate] = useState(initAutoRotate);
  const [envIdx, setEnvIdx]         = useState(0);

  const currentAnim = animations[animIdx] ?? null;
  const envPreset   = ENV_PRESETS[envIdx % ENV_PRESETS.length];
  const h           = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      className={className}
      style={{ display: "flex", flexDirection: "column", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(212,168,67,0.2)", background: "#0a0a0a" }}
    >
      {/* 3D Canvas */}
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
              animGlbPath={currentAnim?.glbPath}
              looping={currentAnim?.looping ?? true}
              autoRotate={autoRotate && !paused}
              envPreset={envPreset}
            />
          </Suspense>
        </Canvas>

        {/* Character name badge */}
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

        {/* Env cycle button */}
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

        {animations.length > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
            <button
              onClick={() => setAnimIdx(i => Math.max(-1, i - 1))}
              disabled={animIdx <= -1}
              style={{ padding: "3px 4px", background: "none", border: "none", cursor: animIdx <= -1 ? "not-allowed" : "pointer", color: animIdx <= -1 ? "#444" : "#888", display: "flex" }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ flex: 1, textAlign: "center", fontSize: 12, color: "#d4a843", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {currentAnim ? currentAnim.label : "Pose base"}
              <span style={{ marginLeft: 4, color: "#555", fontSize: 10 }}>({animIdx + 2}/{animations.length + 1})</span>
            </span>
            <button
              onClick={() => setAnimIdx(i => Math.min(animations.length - 1, i + 1))}
              disabled={animIdx >= animations.length - 1}
              style={{ padding: "3px 4px", background: "none", border: "none", cursor: animIdx >= animations.length - 1 ? "not-allowed" : "pointer", color: animIdx >= animations.length - 1 ? "#444" : "#888", display: "flex" }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        ) : (
          <span style={{ flex: 1, textAlign: "center", fontSize: 11, color: "#555" }}>Sin animaciones · arrastra para rotar</span>
        )}
      </div>

      {/* Animation pills */}
      {animations.length > 0 && (
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

      {/* Spin keyframe */}
      <style>{`@keyframes mv3d-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
