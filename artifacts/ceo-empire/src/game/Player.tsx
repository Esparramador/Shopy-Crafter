import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useGame } from "../lib/gameStore";
import { BUSINESSES, MISSIONS, NPC_CONFIGS } from "../lib/gameData";

const CHAR_MODELS: Record<string, string> = {
  alec_monopoly:   "/assets/models/alec_monopoly.glb",
  chico_formal:    "/assets/models/chico_formal.glb",
  chica_ejecutiva: "/assets/models/chica_ejecutiva.glb",
  chica_creativa:  "/assets/models/chica_creativa.glb",
  chico_casual:    "/assets/models/chico_casual.glb",
};

const MOVE_SPEED   = 9;
const SPRINT_SPEED = 20;
const CAM_HEIGHT   = 5;
const CAM_DIST     = 10;
const ATTACK_RANGE = 4.5;
const ATTACK_COOLDOWN = 0.75;

const keys: Record<string, boolean> = {};
let mouseXAccum = 0;
let pointerLocked = false;

function CharacterMesh({ charKey, groupRef }: { charKey: string; groupRef: React.RefObject<THREE.Group> }) {
  const path = CHAR_MODELS[charKey] ?? CHAR_MODELS.chico_formal;
  const { scene } = useGLTF(path);
  const cloned = useRef<THREE.Object3D>(scene.clone(true));
  return <primitive object={cloned.current} />;
}

export function Player() {
  const {
    selectedCharacter, playerPos, setPlayerPos, setPlayerFacing,
    takeDamage, phase, dialogOpen, showInventory,
    nearbyNpcId, nearbyVehicleId, nearbyBusinessId, nearbyMissionId,
    setNearbyNpcId, setNearbyVehicleId, setNearbyBusinessId, setNearbyMissionId,
    openDialog, startMission, buyBusiness,
    inVehicle, setInVehicle, addKill, setWantedLevel, wantedLevel,
    toggleInventory, money,
  } = useGame();

  const groupRef = useRef<THREE.Group>(null!);
  const attackCooldown = useRef(0);
  const { camera, gl } = useThree();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys[k] = true;

      if (dialogOpen) {
        if (k === "escape") useGame.getState().closeDialog();
        return;
      }
      if (showInventory) {
        if (k === "escape" || k === "i") toggleInventory();
        return;
      }

      if (k === "f" && nearbyNpcId) {
        const npc = NPC_CONFIGS.find(n => n.id === nearbyNpcId);
        if (npc) openDialog(npc.id, npc.name, npc.defaultDialogue);
      }
      if (k === "e") {
        if (nearbyVehicleId) setInVehicle(!inVehicle);
        if (nearbyMissionId) startMission(nearbyMissionId);
      }
      if (k === "b" && nearbyBusinessId) {
        const biz = BUSINESSES.find(b => b.id === nearbyBusinessId);
        if (biz && money >= biz.price) {
          buyBusiness(nearbyBusinessId);
        }
      }
      if (k === "i") toggleInventory();
    };

    const onKeyUp = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };

    const onMouseMove = (e: MouseEvent) => {
      if (pointerLocked) mouseXAccum += e.movementX * 0.0022;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (!pointerLocked) { gl.domElement.requestPointerLock(); return; }
      if (e.button === 0) keys["attack"] = true;
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) keys["attack"] = false;
    };

    const onLockChange = () => {
      pointerLocked = document.pointerLockElement === gl.domElement;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);
    gl.domElement.addEventListener("mousedown", onMouseDown);
    gl.domElement.addEventListener("mouseup", onMouseUp);
    document.addEventListener("pointerlockchange", onLockChange);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      gl.domElement.removeEventListener("mousedown", onMouseDown);
      gl.domElement.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("pointerlockchange", onLockChange);
    };
  }, [
    dialogOpen, showInventory, nearbyNpcId, nearbyVehicleId, nearbyBusinessId,
    nearbyMissionId, inVehicle, openDialog, setInVehicle, startMission,
    buyBusiness, toggleInventory, gl.domElement, money,
  ]);

  const posRef = useRef(new THREE.Vector3(...playerPos));

  useFrame((_, delta) => {
    if (phase !== "playing" || dialogOpen || showInventory) return;

    attackCooldown.current = Math.max(0, attackCooldown.current - delta);

    const sprint = keys["shift"];
    const speed = sprint ? SPRINT_SPEED : MOVE_SPEED;
    const dir = new THREE.Vector3();

    if (keys["w"] || keys["arrowup"])    dir.z -= 1;
    if (keys["s"] || keys["arrowdown"])  dir.z += 1;
    if (keys["a"] || keys["arrowleft"])  dir.x -= 1;
    if (keys["d"] || keys["arrowright"]) dir.x += 1;

    const moving = dir.lengthSq() > 0;

    if (moving) {
      dir.normalize();
      const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), mouseXAccum);
      dir.applyQuaternion(yawQ);

      posRef.current.x = Math.max(-195, Math.min(195, posRef.current.x + dir.x * speed * delta));
      posRef.current.z = Math.max(-195, Math.min(195, posRef.current.z + dir.z * speed * delta));

      const facing = Math.atan2(dir.x, dir.z);
      setPlayerFacing(facing);

      if (groupRef.current) {
        groupRef.current.rotation.y = facing;
      }

      setPlayerPos([posRef.current.x, 0, posRef.current.z]);
    }

    // Smooth group position
    if (groupRef.current) {
      groupRef.current.position.lerp(posRef.current, 0.25);
    }

    // Camera follow
    const camX = posRef.current.x - Math.sin(mouseXAccum) * CAM_DIST;
    const camZ = posRef.current.z - Math.cos(mouseXAccum) * CAM_DIST;
    camera.position.lerp(new THREE.Vector3(camX, CAM_HEIGHT, camZ), 0.1);
    camera.lookAt(posRef.current.x, 1.7, posRef.current.z);

    const [px, , pz] = [posRef.current.x, 0, posRef.current.z];

    // Proximity: NPCs
    let closestNpc = ""; let minNpcD = 6;
    NPC_CONFIGS.forEach(n => {
      const d = Math.hypot(n.pos[0]-px, n.pos[2]-pz);
      if (d < minNpcD) { minNpcD = d; closestNpc = n.id; }
    });
    setNearbyNpcId(closestNpc || null);

    // Proximity: businesses
    let closestBiz = ""; let minBizD = 6;
    BUSINESSES.forEach(b => {
      const d = Math.hypot(b.pos[0]-px, b.pos[2]-pz);
      if (d < minBizD) { minBizD = d; closestBiz = b.id; }
    });
    setNearbyBusinessId(closestBiz || null);

    // Proximity: missions
    let closestMission = ""; let minMD = 5;
    MISSIONS.forEach(m => {
      const d = Math.hypot(m.markerPos[0]-px, m.markerPos[2]-pz);
      if (d < minMD) { minMD = d; closestMission = m.id; }
    });
    setNearbyMissionId(closestMission || null);

    // Attack
    if (keys["attack"] && attackCooldown.current <= 0) {
      attackCooldown.current = ATTACK_COOLDOWN;
      NPC_CONFIGS.filter(n => n.type === "hostile" || n.type === "boss").forEach(n => {
        const d = Math.hypot(n.pos[0]-px, n.pos[2]-pz);
        if (d < ATTACK_RANGE) {
          addKill();
          setWantedLevel(wantedLevel + 1);
        }
      });
    }
  });

  return (
    <group ref={groupRef} position={[playerPos[0], 0, playerPos[2]]}>
      <CharacterMesh charKey={selectedCharacter} groupRef={groupRef} />
      <pointLight position={[0, 2, 0]} intensity={0.2} distance={4} color="#ffe8aa" />
    </group>
  );
}

// Preload all player models
Object.values(CHAR_MODELS).forEach(path => useGLTF.preload(path));
