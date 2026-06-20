import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGame } from "../lib/gameStore";

export function DayNightSystem() {
  const { dayTime, tickDayTime } = useGame();
  const sunRef = useRef<THREE.DirectionalLight>(null!);
  const ambRef = useRef<THREE.AmbientLight>(null!);
  const skyRef = useRef<THREE.Mesh>(null!);

  useFrame((_, delta) => {
    tickDayTime(delta * 0.02); // 1 real second ≈ 0.02 game hours

    const t = dayTime;
    const angle = ((t - 6) / 24) * Math.PI * 2;
    const sx = Math.cos(angle) * 120;
    const sy = Math.sin(angle) * 120;

    if (sunRef.current) {
      sunRef.current.position.set(sx, sy, 80);
      sunRef.current.lookAt(0, 0, 0);
      const intensity = Math.max(0, Math.sin((t / 24) * Math.PI) * 2.2);
      sunRef.current.intensity = intensity;
      const c = new THREE.Color();
      if (t >= 6 && t < 8)       c.setHSL(0.08, 0.8, 0.55 + (t-6)/2 * 0.2); // sunrise
      else if (t >= 8 && t < 18) c.setHSL(0.12, 0.3, 0.92);                   // day
      else if (t >= 18 && t < 20) c.setHSL(0.06, 0.9, 0.55 + (20-t)/2 * 0.2); // sunset
      else                        c.setHSL(0.62, 0.3, 0.10);                   // night
      sunRef.current.color = c;
    }

    if (ambRef.current) {
      const isDay = t >= 6 && t < 20;
      ambRef.current.intensity = isDay ? 0.55 : 0.12;
      ambRef.current.color = new THREE.Color(isDay ? 0xffeedd : 0x1a2050);
    }

    if (skyRef.current) {
      const mat = skyRef.current.material as THREE.MeshBasicMaterial;
      if (t >= 6 && t < 18) mat.color.setRGB(0.39, 0.66, 0.95);
      else if (t >= 18 && t < 20) mat.color.setRGB(0.7, 0.35, 0.15);
      else mat.color.setRGB(0.04, 0.06, 0.16);
    }
  });

  return (
    <>
      <ambientLight ref={ambRef} intensity={0.55} color={0xffeedd} />
      <directionalLight
        ref={sunRef}
        position={[80, 120, 80]}
        intensity={2.0}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={10}
        shadow-camera-far={400}
        shadow-camera-left={-150}
        shadow-camera-right={150}
        shadow-camera-top={150}
        shadow-camera-bottom={-150}
        shadow-bias={-0.001}
      />
      <pointLight position={[0, 60, 0]} intensity={0.3} color={0x8888ff} />
      <mesh ref={skyRef} scale={400}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color={0x6fb4f5} side={THREE.BackSide} />
      </mesh>
      <fog attach="fog" args={[0x9bb8d4, 80, 280]} />
    </>
  );
}
