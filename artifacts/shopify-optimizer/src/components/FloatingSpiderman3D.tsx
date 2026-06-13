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

/* ── Spider-Man shader material ─────────────────────────────────────────── */
function createSpidermanMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.72,
    metalness: 0.06,
    side: THREE.FrontSide,
  });

  mat.onBeforeCompile = (shader) => {
    /* ── vertex: pass world position to fragment ── */
    shader.vertexShader =
      "varying vec3 vWpos;\n" + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      `#include <project_vertex>
       vWpos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
    );

    /* ── fragment: Spider-Man color logic ── */
    shader.fragmentShader =
      "varying vec3 vWpos;\n" + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      "vec4 diffuseColor = vec4( diffuse, opacity );",
      `
// ─── Spider-Man palette ────────────────────────────────────
// Model world-Y range: top=-0.162, waist=-0.950, feet=-1.739
vec3 spiderRed   = vec3(0.82, 0.04, 0.04);
vec3 spiderBlue  = vec3(0.03, 0.06, 0.42);
vec3 webDark     = vec3(0.15, 0.00, 0.00);
vec3 webBlueDark = vec3(0.01, 0.02, 0.22);

// ── Y-based red/blue body split at waist (Y≈-0.95) ────────
float bodyT = clamp((vWpos.y + 1.05) / 0.25, 0.0, 1.0);
// -1.05 → 0.0 (full blue legs)   -0.80 → 1.0 (full red torso)
vec3 baseCol = mix(spiderBlue, spiderRed, bodyT);

// ── Procedural web lines (world-space sine grid) ───────────
float webScale = 13.0;
float lx = abs(sin(vWpos.x * webScale));
float lz = abs(sin(vWpos.z * webScale));
float ly = abs(sin(vWpos.y * webScale * 0.88));
float lineX = 1.0 - smoothstep(0.0, 0.10, lx);
float lineZ = 1.0 - smoothstep(0.0, 0.10, lz);
float lineY = 1.0 - smoothstep(0.0, 0.10, ly);
float webLines = clamp(lineX + lineZ + lineY, 0.0, 1.0);
// Stronger web on red/upper zone; subtle on blue zone
vec3 webColor = mix(webBlueDark, webDark, bodyT);
vec3 col = mix(baseCol, webColor, webLines * mix(0.28, 0.78, bodyT));

// ── White eye patches: Y≈-0.35, X≈±0.20, front-facing ────
// Front face: Z>0 in world space (camera is at positive Z)
float frontFace = clamp(vWpos.z * 1.5, 0.0, 1.0);

// Left eye (x≈-0.20) and right eye (x≈+0.20) at head level
float eyeL = smoothstep(0.095, 0.0,
  length(vec2((vWpos.x + 0.20) * 1.3, vWpos.y + 0.35)));
float eyeR = smoothstep(0.095, 0.0,
  length(vec2((vWpos.x - 0.20) * 1.3, vWpos.y + 0.35)));
float eyeMask = clamp(eyeL + eyeR, 0.0, 1.0) * frontFace;

vec3 eyeWhite = vec3(0.90, 0.95, 1.00);
col = mix(col, eyeWhite, eyeMask);

// Black eye outline (slightly larger radius than fill)
float eyeOutL = smoothstep(0.115, 0.098,
  length(vec2((vWpos.x + 0.20) * 1.3, vWpos.y + 0.35)));
float eyeOutR = smoothstep(0.115, 0.098,
  length(vec2((vWpos.x - 0.20) * 1.3, vWpos.y + 0.35)));
float eyeOut  = clamp(eyeOutL + eyeOutR, 0.0, 1.0) * frontFace;
col = mix(col, vec3(0.03, 0.03, 0.03), eyeOut * (1.0 - eyeMask * 0.7));

// ── Black spider emblem on chest (Y≈-0.87, front) ─────────
float emblemY = smoothstep(0.08, 0.0, abs(vWpos.y + 0.87));
float emblemX = smoothstep(0.12, 0.0, abs(vWpos.x));
float emblem  = emblemY * emblemX * frontFace * bodyT;
col = mix(col, vec3(0.02, 0.02, 0.02), emblem * 0.60);

// ── Subtle sheen ────────────────────────────────────────────
col = col * 0.96 + 0.015;

vec4 diffuseColor = vec4(col, opacity);
      `
    );
  };

  mat.needsUpdate = true;
  return mat;
}

/* ── 3D model component ──────────────────────────────────────────────────── */
function SpidermanModel() {
  const { scene } = useGLTF(`${BASE_URL}/assets/3d/models/spiderman.glb`);
  const group = useRef<THREE.Group>(null);

  const cloned = useMemo(() => {
    const c = scene.clone();
    const spiderMat = createSpidermanMaterial();
    c.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = spiderMat;
        child.castShadow = true;
      }
    });
    return c;
  }, [scene]);

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

/* ── CSS fallback ───────────────────────────────────────────────────────── */
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

/* ── Public component ───────────────────────────────────────────────────── */
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
          background: "radial-gradient(ellipse 70% 60% at 50% 40%, rgba(200,50,50,0.08) 0%, transparent 70%)",
          pointerEvents: "none", zIndex: 1,
        }} />
        <Canvas
          camera={{ position: [0, 0.4, 3.1], fov: 42 }}
          gl={{ alpha: true, antialias: true, failIfMajorPerformanceCaveat: false }}
          style={{ width: "100%", height: "100%", background: "transparent", position: "relative", zIndex: 3 }}
        >
          <ambientLight intensity={0.55} />
          <directionalLight position={[2, 5, 3]} intensity={1.8} color="#ffffff" />
          <directionalLight position={[-2, 2, -2]} intensity={0.35} color="#4a9eff" />
          <pointLight position={[0, 3, 2]} intensity={0.9} color="#ff2222" />
          <pointLight position={[0.5, 2.5, 1.5]} intensity={0.5} color="#c8a84b" />
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
