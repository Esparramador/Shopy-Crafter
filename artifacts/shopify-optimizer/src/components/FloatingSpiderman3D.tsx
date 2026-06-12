import { Suspense, useRef, useMemo, Component, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function isWebGLAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext("webgl") || c.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
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
  componentDidCatch() { /* intentionally silent */ }
  render() {
    return this.state.crashed ? this.props.fallback : this.props.children;
  }
}

function SpidermanModel() {
  const { scene } = useGLTF(`${BASE_URL}/assets/3d/models/spiderman.glb`);
  const group = useRef<THREE.Group>(null);

  const cloned = useMemo(() => scene.clone(), [scene]);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.position.y = -0.95 + Math.sin(t * 0.75) * 0.07;
    group.current.rotation.y = -0.25 + Math.sin(t * 0.28) * 0.18;
  });

  return (
    <group ref={group} scale={1.72} position={[0, -0.95, 0]}>
      <primitive object={cloned} />
    </group>
  );
}

function CSSFallback({ height }: { height: number }) {
  return (
    <div style={{
      width: "100%", height,
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 70% 60% at 50% 38%, rgba(200,50,50,0.07) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontSize: 130, lineHeight: 1,
          filter: "drop-shadow(0 24px 48px rgba(200,0,0,0.28))",
          animation: "spiderFloatCSS 3s ease-in-out infinite",
        }}>🕷️</div>
        <div style={{
          marginTop: 14, fontSize: 13, fontWeight: 700, letterSpacing: 3,
          color: "rgba(200,168,75,0.65)", textTransform: "uppercase",
        }}>Spiderman 3D</div>
      </div>
      <style>{`
        @keyframes spiderFloatCSS {
          0%,100%{transform:translateY(0) rotate(-3deg)}
          50%{transform:translateY(-20px) rotate(3deg)}
        }
      `}</style>
    </div>
  );
}

export interface FloatingSpiderman3DProps {
  height?: number;
}

export function FloatingSpiderman3D({ height = 500 }: FloatingSpiderman3DProps) {
  const webglOk = useMemo(() => isWebGLAvailable(), []);

  if (!webglOk) {
    return <CSSFallback height={height} />;
  }

  const cssFallback = <CSSFallback height={height} />;

  return (
    <SceneErrorBoundary fallback={cssFallback}>
      <div style={{ position: "relative", width: "100%", height, pointerEvents: "none" }}>
        <div style={{
          position: "absolute", bottom: "8%", left: "50%",
          transform: "translateX(-50%)",
          width: "55%", height: 28, borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(200,168,75,0.35), transparent 70%)",
          filter: "blur(14px)",
          animation: "spiderShadowPulse 3s ease-in-out infinite",
          zIndex: 2,
        }} />
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 70% 60% at 50% 40%, rgba(200,50,50,0.05) 0%, transparent 70%)",
          pointerEvents: "none", zIndex: 1,
        }} />
        <Canvas
          camera={{ position: [0, 0.4, 3.1], fov: 42 }}
          gl={{ alpha: true, antialias: true, failIfMajorPerformanceCaveat: false }}
          style={{ width: "100%", height: "100%", background: "transparent", position: "relative", zIndex: 3 }}
        >
          <ambientLight intensity={0.65} />
          <directionalLight position={[2, 5, 3]} intensity={1.6} color="#ffffff" />
          <directionalLight position={[-2, 2, -2]} intensity={0.45} color="#4a9eff" />
          <pointLight position={[0.5, 2.5, 1.5]} intensity={0.7} color="#c8a84b" />
          <pointLight position={[-1, 1, 2]} intensity={0.4} color="#cc2233" />
          <Suspense fallback={null}>
            <SpidermanModel />
            <ContactShadows
              position={[0, -1.02, 0]}
              opacity={0.35}
              scale={4}
              blur={2.5}
              color="#000"
            />
          </Suspense>
        </Canvas>
        <style>{`
          @keyframes spiderShadowPulse {
            0%,100%{opacity:.7;transform:translateX(-50%) scaleX(1)}
            50%{opacity:1;transform:translateX(-50%) scaleX(.85)}
          }
        `}</style>
      </div>
    </SceneErrorBoundary>
  );
}
