import { useFrame } from "@react-three/fiber";
import { useGame } from "../lib/gameStore";
import { MISSIONS } from "../lib/gameData";

export function MissionSystem() {
  const {
    activeMissionId, playerPos, completeMission, missionTimer,
    setMissionTimer, addMoney, addKarma, setCurrentObjective,
    ownedBusinesses,
  } = useGame();

  useFrame((_, delta) => {
    if (!activeMissionId) return;
    const mission = MISSIONS.find(m => m.id === activeMissionId);
    if (!mission) return;

    // Tick timed missions
    if (missionTimer > 0) {
      const newTimer = missionTimer - delta;
      setMissionTimer(Math.max(0, newTimer));
      if (newTimer <= 0) {
        completeMission(false);
        return;
      }
    }

    const [px, , pz] = playerPos;

    // mission_1: reach the HQ marker
    if (mission.id === "mission_1") {
      const d = Math.hypot(mission.markerPos[0] - px, mission.markerPos[2] - pz);
      if (d < 5) {
        completeMission(true);
        addMoney(mission.rewardMoney);
        addKarma(mission.rewardKarma);
        setCurrentObjective("✅ Maletín recogido. Busca la siguiente misión (marcador amarillo).");
      }
    }

    // mission_2: buy café business
    if (mission.id === "mission_2") {
      if (ownedBusinesses.includes("cafe")) {
        completeMission(true);
        addMoney(mission.rewardMoney);
        addKarma(mission.rewardKarma);
        setCurrentObjective("✅ Cafetería adquirida. ¡El negocio crece!");
      }
    }

    // mission_3: reach the boss marker
    if (mission.id === "mission_3") {
      const d = Math.hypot(mission.markerPos[0] - px, mission.markerPos[2] - pz);
      if (d < 8) {
        completeMission(true);
        addMoney(mission.rewardMoney);
        addKarma(mission.rewardKarma);
        setCurrentObjective("✅ ¡Rival eliminado! Ahora construye tu verdadero imperio.");
      }
    }

    // mission_4: own 4 businesses
    if (mission.id === "mission_4") {
      if (ownedBusinesses.length >= 4) {
        completeMission(true);
        addMoney(mission.rewardMoney);
        addKarma(mission.rewardKarma);
        setCurrentObjective("✅ ¡4 negocios controlados! Eres imparable.");
      }
    }

    // mission_5: reach final marker
    if (mission.id === "mission_5") {
      const d = Math.hypot(mission.markerPos[0] - px, mission.markerPos[2] - pz);
      if (d < 6) {
        completeMission(true);
        addMoney(mission.rewardMoney);
        addKarma(mission.rewardKarma);
        setCurrentObjective("👑 ¡ERES EL CEO DEL AÑO! El imperio es tuyo.");
      }
    }
  });

  return null;
}
