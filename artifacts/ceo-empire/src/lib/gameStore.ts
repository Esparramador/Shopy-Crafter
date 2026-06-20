import { create } from "zustand";
import { BUSINESSES, MISSIONS } from "./gameData";

export interface InventoryItem {
  id: string;
  name: string;
  type: "weapon" | "health" | "money" | "quest";
  quantity: number;
  icon: string;
  description?: string;
}

interface GameStore {
  phase: "menu" | "playing" | "dead";
  health: number;
  money: number;
  karma: number;
  wantedLevel: number;
  dayTime: number;
  playerPos: [number, number, number];
  playerFacing: number;
  inVehicle: boolean;
  selectedCharacter: string;
  inventory: InventoryItem[];
  activeMissionId: string | null;
  completedMissions: string[];
  currentObjective: string | null;
  missionTimer: number;
  ownedBusinesses: string[];
  passiveIncomePerSec: number;
  lastIncomeTime: number;
  dialogOpen: boolean;
  dialogNpcName: string;
  dialogText: string;
  dialogLoading: boolean;
  showInventory: boolean;
  killCount: number;
  nearbyNpcId: string | null;
  nearbyVehicleId: string | null;
  nearbyBusinessId: string | null;
  nearbyMissionId: string | null;
  activeWeapon: string;

  // Actions
  setPhase(p: GameStore["phase"]): void;
  reset(): void;
  takeDamage(d: number): void;
  heal(h: number): void;
  addMoney(m: number): void;
  addKarma(k: number): void;
  setWantedLevel(level: number): void;
  tickDayTime(delta: number): void;
  setPlayerPos(pos: [number, number, number]): void;
  setPlayerFacing(f: number): void;
  setInVehicle(v: boolean): void;
  setSelectedCharacter(c: string): void;
  addItem(item: InventoryItem): void;
  removeItem(id: string): void;
  startMission(id: string): void;
  completeMission(success: boolean): void;
  setCurrentObjective(obj: string | null): void;
  setMissionTimer(t: number): void;
  buyBusiness(id: string): void;
  openDialog(npcId: string, npcName: string, text: string): void;
  closeDialog(): void;
  setDialogLoading(l: boolean): void;
  toggleInventory(): void;
  addKill(): void;
  setNearbyNpcId(id: string | null): void;
  setNearbyVehicleId(id: string | null): void;
  setNearbyBusinessId(id: string | null): void;
  setNearbyMissionId(id: string | null): void;
  setActiveWeapon(w: string): void;
  tickPassiveIncome(): void;
}

export const useGame = create<GameStore>((set, get) => ({
  phase: "menu",
  health: 100,
  money: 5000,
  karma: 0,
  wantedLevel: 0,
  dayTime: 10,
  playerPos: [0, 0, 30],
  playerFacing: 0,
  inVehicle: false,
  selectedCharacter: "alec_monopoly",
  inventory: [
    { id: "phone", name: "Teléfono Ejecutivo", type: "quest", quantity: 1, icon: "📱", description: "Tu arma de negocios más poderosa" },
    { id: "briefcase", name: "Maletín de Negocios", type: "quest", quantity: 1, icon: "💼", description: "Contiene los datos del inversor" },
    { id: "medkit", name: "Kit Médico CEO", type: "health", quantity: 3, icon: "💊", description: "Recupera 50 puntos de salud" },
  ],
  activeMissionId: "mission_1",
  completedMissions: [],
  currentObjective: "Ve al marcador azul y recoge el maletín de datos",
  missionTimer: 0,
  ownedBusinesses: [],
  passiveIncomePerSec: 0,
  lastIncomeTime: Date.now(),
  dialogOpen: false,
  dialogNpcName: "",
  dialogText: "",
  dialogLoading: false,
  showInventory: false,
  killCount: 0,
  nearbyNpcId: null,
  nearbyVehicleId: null,
  nearbyBusinessId: null,
  nearbyMissionId: null,
  activeWeapon: "fists",

  setPhase: (p) => set({ phase: p }),

  reset: () => set({
    phase: "menu",
    health: 100, money: 5000, karma: 0, wantedLevel: 0,
    dayTime: 10, playerPos: [0, 0, 30], playerFacing: 0,
    inVehicle: false, activeMissionId: "mission_1",
    completedMissions: [], currentObjective: "Ve al marcador azul y recoge el maletín de datos",
    missionTimer: 0, ownedBusinesses: [], passiveIncomePerSec: 0,
    killCount: 0, dialogOpen: false, showInventory: false,
    inventory: [
      { id: "phone", name: "Teléfono Ejecutivo", type: "quest", quantity: 1, icon: "📱" },
      { id: "briefcase", name: "Maletín de Negocios", type: "quest", quantity: 1, icon: "💼" },
      { id: "medkit", name: "Kit Médico CEO", type: "health", quantity: 3, icon: "💊" },
    ],
  }),

  takeDamage: (d) =>
    set((s) => {
      const health = Math.max(0, s.health - d);
      return { health, phase: health <= 0 ? "dead" : s.phase };
    }),

  heal: (h) => set((s) => ({ health: Math.min(100, s.health + h) })),

  addMoney: (m) => set((s) => ({ money: s.money + m })),

  addKarma: (k) =>
    set((s) => ({ karma: Math.max(-100, Math.min(100, s.karma + k)) })),

  setWantedLevel: (level) => set({ wantedLevel: Math.max(0, Math.min(5, level)) }),

  tickDayTime: (delta) =>
    set((s) => ({ dayTime: (s.dayTime + delta) % 24 })),

  setPlayerPos: (pos) => set({ playerPos: pos }),
  setPlayerFacing: (f) => set({ playerFacing: f }),
  setInVehicle: (v) => set({ inVehicle: v }),
  setSelectedCharacter: (c) => set({ selectedCharacter: c }),

  addItem: (item) =>
    set((s) => ({
      inventory: s.inventory.find((i) => i.id === item.id)
        ? s.inventory.map((i) =>
            i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i
          )
        : [...s.inventory, item],
    })),

  removeItem: (id) =>
    set((s) => ({
      inventory: s.inventory.map(i => i.id === id
        ? { ...i, quantity: i.quantity - 1 }
        : i
      ).filter(i => i.quantity > 0),
    })),

  startMission: (id) => {
    const m = MISSIONS.find(m => m.id === id);
    set({
      activeMissionId: id,
      currentObjective: m?.objective ?? null,
      missionTimer: 0,
    });
  },

  completeMission: (success) =>
    set((s) => {
      const completed = s.activeMissionId
        ? [...s.completedMissions, s.activeMissionId]
        : s.completedMissions;
      return {
        completedMissions: completed,
        activeMissionId: null,
        currentObjective: success ? "✅ Misión completada. Busca la siguiente." : "❌ Misión fallida.",
        missionTimer: 0,
      };
    }),

  setCurrentObjective: (obj) => set({ currentObjective: obj }),
  setMissionTimer: (t) => set({ missionTimer: t }),

  buyBusiness: (id) => {
    const biz = BUSINESSES.find(b => b.id === id);
    if (!biz) return;
    const { money } = get();
    if (money < biz.price) return;
    set((s) => ({
      money: s.money - biz.price,
      ownedBusinesses: s.ownedBusinesses.includes(id)
        ? s.ownedBusinesses
        : [...s.ownedBusinesses, id],
      passiveIncomePerSec: s.ownedBusinesses.includes(id)
        ? s.passiveIncomePerSec
        : s.passiveIncomePerSec + biz.incomePerSec,
    }));
  },

  openDialog: (_npcId, npcName, text) =>
    set({ dialogOpen: true, dialogNpcName: npcName, dialogText: text }),

  closeDialog: () =>
    set({ dialogOpen: false, dialogNpcName: "", dialogText: "" }),

  setDialogLoading: (l) => set({ dialogLoading: l }),

  toggleInventory: () => set((s) => ({ showInventory: !s.showInventory })),

  addKill: () => set((s) => ({ killCount: s.killCount + 1 })),

  setNearbyNpcId: (id) => set({ nearbyNpcId: id }),
  setNearbyVehicleId: (id) => set({ nearbyVehicleId: id }),
  setNearbyBusinessId: (id) => set({ nearbyBusinessId: id }),
  setNearbyMissionId: (id) => set({ nearbyMissionId: id }),

  setActiveWeapon: (w) => set({ activeWeapon: w }),

  tickPassiveIncome: () => {
    const { ownedBusinesses, passiveIncomePerSec, lastIncomeTime } = get();
    if (ownedBusinesses.length === 0) return;
    const now = Date.now();
    const elapsed = (now - lastIncomeTime) / 1000;
    if (elapsed >= 1) {
      set((s) => ({
        money: s.money + Math.floor(passiveIncomePerSec * elapsed),
        lastIncomeTime: now,
      }));
    }
  },
}));
