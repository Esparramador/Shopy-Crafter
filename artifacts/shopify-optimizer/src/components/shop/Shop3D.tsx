/**
 * 3D de la tienda (React Three Fiber). Se carga aparte (lazy) para no pesar en el resto de la web.
 *  - ShopHero3D: tarjeta de aluminio y placa de madera flotando; el scroll de la portada las gira (GSAP).
 *  - ProductPreview3D: la pieza con la imagen del cliente, tratada como quedaría grabada.
 * Sin entornos HDR remotos: la luz es local (Lightformer), así no depende de ningún CDN.
 */
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Float, Lightformer, OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { assetUrl } from "@/pages/shop/shop-api";

const prefersReduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Si WebGL falla, se ve la alternativa (una foto) en vez de un hueco. */
class GLBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

function useLoadedTexture(url: string | null, process?: (img: HTMLImageElement) => HTMLCanvasElement): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!url) { setTex(null); return; }
    let alive = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!alive) return;
      const t = process ? new THREE.CanvasTexture(process(img)) : new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      t.needsUpdate = true;
      setTex(old => { old?.dispose(); return t; });
    };
    img.src = url;
    return () => { alive = false; };
  }, [url, process]);
  return tex;
}

function Studio() {
  return (
    <Environment resolution={256} frames={1}>
      <Lightformer intensity={3} position={[0, 4, 3]} scale={[8, 2, 1]} color="#fff4dc" />
      <Lightformer intensity={1.6} position={[-4, 1, 2]} scale={[2, 6, 1]} color="#c9a961" />
      <Lightformer intensity={1.2} position={[4, -1, 2]} scale={[2, 6, 1]} color="#2a7a4b" />
      <Lightformer intensity={0.8} position={[0, 0, -5]} scale={[10, 10, 1]} color="#20203a" />
    </Environment>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────

function HeroPieces({ progress }: { progress: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const front = useLoadedTexture(assetUrl("/tienda-media/tarjeta-shopycrafter-delante.webp"));
  const back = useLoadedTexture(assetUrl("/tienda-media/tarjeta-shopycrafter-detras.webp"));
  const plaque = useLoadedTexture(assetUrl("/tienda-media/placa-resenas-madera.webp"));
  useFrame((_, dt) => {
    const g = group.current; if (!g) return;
    const p = progress.current;
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, -0.35 + p * Math.PI * 0.9, 4, dt);
    g.position.y = THREE.MathUtils.damp(g.position.y, p * 0.6, 4, dt);
  });
  // Tarjeta 85 × 55 mm y placa 90 × 110 mm (1 unidad = 10 mm)
  return (
    <group ref={group}>
      <Float speed={1.4} rotationIntensity={0.35} floatIntensity={0.6}>
        <group position={[-1.6, 0.25, 0.4]} rotation={[0.1, 0.35, -0.08]}>
          <RoundedBox args={[8.5, 5.5, 0.12]} radius={0.05} smoothness={4} castShadow>
            <meshStandardMaterial color="#121214" metalness={0.85} roughness={0.32} />
          </RoundedBox>
          {front && <mesh position={[0, 0, 0.062]}><planeGeometry args={[8.3, 5.3]} /><meshStandardMaterial map={front} metalness={0.6} roughness={0.35} /></mesh>}
          {back && <mesh position={[0, 0, -0.062]} rotation={[0, Math.PI, 0]}><planeGeometry args={[8.3, 5.3]} /><meshStandardMaterial map={back} metalness={0.6} roughness={0.35} /></mesh>}
        </group>
      </Float>
      <Float speed={1.1} rotationIntensity={0.25} floatIntensity={0.5}>
        <group position={[2.7, -0.5, -1.2]} rotation={[0.05, -0.45, 0.04]}>
          <RoundedBox args={[9, 11, 0.3]} radius={0.12} smoothness={4} castShadow>
            <meshStandardMaterial color="#c99a62" roughness={0.75} metalness={0} />
          </RoundedBox>
          {plaque && <mesh position={[0, 0, 0.152]}><planeGeometry args={[8.7, 10.7]} /><meshStandardMaterial map={plaque} roughness={0.8} /></mesh>}
        </group>
      </Float>
    </group>
  );
}

export function ShopHero3D({ progress }: { progress: React.MutableRefObject<number> }) {
  const [ok] = useState(() => typeof window !== "undefined" && webglAvailable());
  const fallback = <img className="shop-hero-fallback" src={assetUrl("/tienda-media/tarjeta-shopycrafter-delante.webp")} alt="Tarjeta de aluminio de Shopy Crafter" />;
  if (!ok) return fallback;
  return (
    <GLBoundary fallback={fallback}>
      <Canvas
        className="shop-hero-canvas" dpr={[1, 1.75]} shadows
        camera={{ position: [0, 0, 24], fov: 35 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        frameloop={prefersReduced() ? "demand" : "always"}
        aria-label="Tarjeta de aluminio y placa de madera en 3D"
      >
        <ambientLight intensity={0.35} />
        <directionalLight position={[5, 8, 6]} intensity={1.2} castShadow />
        <Suspense fallback={null}>
          <HeroPieces progress={progress} />
          <Studio />
        </Suspense>
        <ContactShadows position={[0, -7, 0]} opacity={0.45} scale={30} blur={2.6} far={10} />
      </Canvas>
    </GLBoundary>
  );
}

// ── Vista previa de producto ─────────────────────────────────────────────────

export type PreviewShape = "card-metal" | "wood-photo" | "wood-frame" | "wood-pano" | "wood-plaque";

const SHAPES: Record<PreviewShape, { w: number; h: number; d: number; wood: boolean; frame?: boolean }> = {
  "card-metal": { w: 8.5, h: 5.5, d: 0.12, wood: false },
  "wood-photo": { w: 10.9, h: 14.1, d: 0.4, wood: true },
  "wood-frame": { w: 11.5, h: 11.5, d: 0.4, wood: true, frame: true },
  "wood-pano": { w: 20, h: 5.75, d: 0.4, wood: true },
  "wood-plaque": { w: 9, h: 11, d: 0.3, wood: true },
};

/**
 * Cómo queda la imagen grabada: en aluminio anodizado el láser deja plata sobre negro
 * (tonos claros = más grabado); en madera quema, así que oscurece la veta.
 */
function engrave(img: HTMLImageElement, shape: PreviewShape): HTMLCanvasElement {
  const s = SHAPES[shape];
  const W = 1024, H = Math.round(W * (s.h / s.w));
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  // encuadre «cover»
  const k = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const dw = img.naturalWidth * k, dh = img.naturalHeight * k;
  g.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  const d = g.getImageData(0, 0, W, H);
  for (let i = 0; i < d.data.length; i += 4) {
    const l = (0.2126 * d.data[i] + 0.7152 * d.data[i + 1] + 0.0722 * d.data[i + 2]) / 255;
    if (!s.wood) {
      const v = Math.pow(l, 1.15);
      d.data[i] = 18 + v * 200; d.data[i + 1] = 18 + v * 202; d.data[i + 2] = 20 + v * 206;
    } else {
      const burn = 1 - Math.pow(l, 0.9) * 0.82;
      d.data[i] = 214 - burn * 150; d.data[i + 1] = 168 - burn * 128; d.data[i + 2] = 112 - burn * 95;
    }
  }
  g.putImageData(d, 0, 0);
  return c;
}

function Piece({ shape, image }: { shape: PreviewShape; image: string | null }) {
  const s = SHAPES[shape];
  const process = useMemo(() => (img: HTMLImageElement) => engrave(img, shape), [shape]);
  const tex = useLoadedTexture(image, process);
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (ref.current && !prefersReduced()) ref.current.rotation.y += dt * 0.12; });
  const scale = 9 / Math.max(s.w, s.h * 0.9);
  return (
    <group ref={ref} scale={scale} rotation={[0, -0.4, 0]}>
      <RoundedBox args={[s.w, s.h, s.d]} radius={Math.min(0.12, s.d / 2.2)} smoothness={4}>
        <meshStandardMaterial color={s.wood ? "#c99a62" : "#121214"} metalness={s.wood ? 0 : 0.85} roughness={s.wood ? 0.78 : 0.32} />
      </RoundedBox>
      {tex && (
        <mesh position={[0, 0, s.d / 2 + 0.003]}>
          <planeGeometry args={[s.frame ? s.w - 2 : s.w - 0.2, s.frame ? s.h - 2 : s.h - 0.2]} />
          <meshStandardMaterial map={tex} metalness={s.wood ? 0 : 0.55} roughness={s.wood ? 0.85 : 0.35} />
        </mesh>
      )}
      {s.frame && (
        <group position={[0, 0, s.d / 2 + 0.2]}>
          {[[0, s.h / 2 - 0.5, s.w, 1], [0, -s.h / 2 + 0.5, s.w, 1], [s.w / 2 - 0.5, 0, 1, s.h - 2], [-s.w / 2 + 0.5, 0, 1, s.h - 2]].map(([x, y, w, h], i) => (
            <mesh key={i} position={[x, y, 0]}><boxGeometry args={[w, h, 0.4]} /><meshStandardMaterial color="#b0814d" roughness={0.7} /></mesh>
          ))}
        </group>
      )}
    </group>
  );
}

export function ProductPreview3D({ shape, image, alt }: { shape: PreviewShape; image: string | null; alt: string }) {
  const [ok] = useState(() => typeof window !== "undefined" && webglAvailable());
  if (!ok) return <div className="shop-preview-empty">Tu navegador no muestra 3D. Te enviaremos la prueba antes de grabar.</div>;
  return (
    <GLBoundary fallback={<div className="shop-preview-empty">No se pudo mostrar la vista 3D. Te enviaremos la prueba antes de grabar.</div>}>
      <Canvas className="shop-preview-canvas" dpr={[1, 1.75]} camera={{ position: [0, 0, 18], fov: 35 }} gl={{ antialias: true, alpha: true }} aria-label={alt}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[4, 6, 8]} intensity={1.1} />
        <Suspense fallback={null}>
          <Piece shape={shape} image={image} />
          <Studio />
        </Suspense>
        <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 3} maxPolarAngle={(2 * Math.PI) / 3} />
      </Canvas>
    </GLBoundary>
  );
}

export default ShopHero3D;
