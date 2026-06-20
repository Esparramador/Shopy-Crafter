import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import * as THREE from "three";
import { DayNightSystem } from "./DayNight";
import { World } from "./World";
import { Player } from "./Player";
import { NPCSystem } from "./NPCSystem";
import { VehicleSystem } from "./VehicleSystem";
import { MissionSystem } from "./MissionSystem";

export function Game() {
  return (
    <div style={{ position: "fixed", inset: 0, width: "100%", height: "100%" }}>
      <Canvas
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
        camera={{ fov: 65, near: 0.15, far: 400, position: [0, 5, 40] }}
        style={{ background: "#000" }}
      >
        <Suspense fallback={null}>
          <DayNightSystem />
          <World />
          <Player />
          <NPCSystem />
          <VehicleSystem />
          <MissionSystem />
        </Suspense>
      </Canvas>
    </div>
  );
}
