export interface Mission {
  id: string;
  title: string;
  description: string;
  objective: string;
  markerPos: [number, number, number];
  color: string;
  rewardMoney: number;
  rewardKarma: number;
  nextMissionId: string | null;
}

export interface Business {
  id: string;
  name: string;
  price: number;
  incomePerSec: number;
  pos: [number, number, number];
  icon: string;
  color: string;
  description: string;
}

export interface NpcConfig {
  id: string;
  name: string;
  model: string;
  type: "friendly" | "neutral" | "hostile" | "boss";
  pos: [number, number, number];
  defaultDialogue: string;
  health: number;
  scale?: number;
}

export interface VehicleConfig {
  id: string;
  color: string;
  pos: [number, number, number];
  name: string;
  speed: number;
}

export const MISSIONS: Mission[] = [
  {
    id: "mission_1",
    title: "El Inicio del Imperio",
    description: "¡Tu aventura comienza! Dirígete al HQ para recoger los datos.",
    objective: "Recoge el maletín en el Shopy HQ",
    markerPos: [0, 0, 2],
    color: "#00f5ff",
    rewardMoney: 3000,
    rewardKarma: 10,
    nextMissionId: "mission_2",
  },
  {
    id: "mission_2",
    title: "Expansión de Mercado",
    description: "Compra tu primer negocio y establece presencia.",
    objective: "Compra la Cafetería Digital",
    markerPos: [-60, 0, -30],
    color: "#ffd700",
    rewardMoney: 8000,
    rewardKarma: 15,
    nextMissionId: "mission_3",
  },
  {
    id: "mission_3",
    title: "El Rival Amenaza",
    description: "Lord Tuétano amenaza tu negocio. Enfréntalo.",
    objective: "Derrota al Rival CEO en su guarida",
    markerPos: [95, 0, -80],
    color: "#ff4444",
    rewardMoney: 20000,
    rewardKarma: -5,
    nextMissionId: "mission_4",
  },
  {
    id: "mission_4",
    title: "Imperio Imparable",
    description: "Controla 4 negocios para dominar la ciudad.",
    objective: "Posee 4 negocios en la ciudad",
    markerPos: [0, 0, -120],
    color: "#00ff88",
    rewardMoney: 50000,
    rewardKarma: 20,
    nextMissionId: "mission_5",
  },
  {
    id: "mission_5",
    title: "CEO del Año",
    description: "¡El momento final! Lleva los datos al inversor.",
    objective: "Sube al helipuerto y cierra el trato",
    markerPos: [0, 0, -120],
    color: "#ffd700",
    rewardMoney: 1000000,
    rewardKarma: 50,
    nextMissionId: null,
  },
];

export const BUSINESSES: Business[] = [
  { id: "cafe", name: "Cafetería Digital", price: 5000, incomePerSec: 5, pos: [-60, 0, -30], icon: "☕", color: "#c0795c", description: "El primer paso hacia el imperio" },
  { id: "marketing", name: "Agencia Marketing", price: 15000, incomePerSec: 15, pos: [70, 0, -20], icon: "📊", color: "#5c7cc0", description: "Amplifica tu marca en la ciudad" },
  { id: "design", name: "Estudio de Diseño", price: 25000, incomePerSec: 25, pos: [-80, 0, 60], icon: "🎨", color: "#c05c8a", description: "Arte y funcionalidad unidos" },
  { id: "school", name: "Escuela de Código", price: 50000, incomePerSec: 50, pos: [90, 0, 80], icon: "💻", color: "#5cc090", description: "Forma a los tech de mañana" },
  { id: "ecom", name: "E-commerce Hub", price: 100000, incomePerSec: 100, pos: [-40, 0, -90], icon: "🛒", color: "#c0a05c", description: "La columna del negocio online" },
  { id: "apps", name: "Fábrica de Apps", price: 200000, incomePerSec: 200, pos: [60, 0, 100], icon: "📱", color: "#905cc0", description: "Lanza apps al mercado global" },
  { id: "ai", name: "Torre de IA", price: 500000, incomePerSec: 500, pos: [-110, 0, -110], icon: "🤖", color: "#5ca0c0", description: "El futuro en tu mano" },
  { id: "empire", name: "Shopy Empire", price: 1000000, incomePerSec: 1500, pos: [110, 0, 110], icon: "👑", color: "#ffd700", description: "La cima del poder CEO" },
];

export const NPC_CONFIGS: NpcConfig[] = [
  { id: "npc_garcia", name: "Director García", model: "chico_formal", type: "friendly", pos: [8, 0, 4], defaultDialogue: "CEO, el mercado nos espera. Tu visión cambiará esta ciudad para siempre.", health: 100 },
  { id: "npc_maria", name: "María Ejecutiva", model: "chica_ejecutiva", type: "friendly", pos: [-6, 0, 8], defaultDialogue: "Señor CEO, los inversores están listos. ¡Hoy es el día del éxito!", health: 100 },
  { id: "npc_elena", name: "Elena Creativa", model: "chica_creativa", type: "friendly", pos: [15, 0, -8], defaultDialogue: "El diseño es el alma del negocio. Juntos crearemos algo extraordinario.", health: 100 },
  { id: "npc_cit1", name: "Carlos", model: "chico_casual", type: "neutral", pos: [30, 0, 20], defaultDialogue: "Oye CEO, ¿me contratas? ¡Tengo mucho talento!", health: 80 },
  { id: "npc_cit2", name: "Peatón", model: "chico_casual", type: "neutral", pos: [-25, 0, 15], defaultDialogue: "Esta ciudad está cambiando mucho. ¡Menuda empresa la tuya!", health: 80 },
  { id: "npc_cit3", name: "Vendedor", model: "chico_casual", type: "neutral", pos: [50, 0, -30], defaultDialogue: "Vendo datos de clientes premium. ¿Te interesa, CEO?", health: 80 },
  { id: "npc_lord", name: "Lord Tuétano", model: "lord_tuetano", type: "hostile", pos: [95, 0, -80], defaultDialogue: "¡Tu empresa no vale nada! ¡Yo domino este mercado y lo aplasto todo!", health: 200, scale: 1.2 },
  { id: "npc_majin", name: "Majin CEO", model: "majin_bu", type: "hostile", pos: [80, 0, -95], defaultDialogue: "¡MAJIN CEO DESTRUYE TODOS LOS NEGOCIOS! ¡CHOCOLATE!", health: 150, scale: 1.1 },
  { id: "npc_illidan", name: "Illidan Marcados", model: "illidan", type: "hostile", pos: [110, 0, -70], defaultDialogue: "No estás preparado... para competir conmigo en el mercado.", health: 180, scale: 1.15 },
  { id: "npc_arthas", name: "Arthas CEO Muerto", model: "arthas", type: "boss", pos: [0, 0, -125], defaultDialogue: "Este mundo no necesita héroes empresariales... sólo al Rey Exánime de los negocios.", health: 500, scale: 1.3 },
];

export const VEHICLE_CONFIGS: VehicleConfig[] = [
  { id: "car1", color: "#cc2222", pos: [20, 0, 10], name: "Ferrari CEO", speed: 18 },
  { id: "car2", color: "#2244cc", pos: [-30, 0, 5], name: "Lamborghini Azul", speed: 22 },
  { id: "car3", color: "#22aa44", pos: [40, 0, -15], name: "Tesla Verde", speed: 16 },
  { id: "car4", color: "#ccaa00", pos: [-50, 0, 40], name: "Rolls Dorado", speed: 14 },
  { id: "car5", color: "#eeeeee", pos: [60, 0, -50], name: "Porsche Blanco", speed: 20 },
];

export const CHARACTER_MODELS: Record<string, { file: string; label: string; description: string; scale: number }> = {
  alec_monopoly: { file: "/assets/models/alec_monopoly.glb", label: "Alec CEO", description: "El CEO millonario del mercado", scale: 1.0 },
  chico_formal: { file: "/assets/models/chico_formal.glb", label: "CEO Formal", description: "Elegante y estratégico", scale: 1.0 },
  chica_ejecutiva: { file: "/assets/models/chica_ejecutiva.glb", label: "CEO Ejecutiva", description: "Liderazgo con estilo", scale: 1.0 },
  chica_creativa: { file: "/assets/models/chica_creativa.glb", label: "CEO Creativa", description: "Innovación sin límites", scale: 1.0 },
};

export const ENEMY_MODELS: Record<string, string> = {
  lord_tuetano: "/assets/models/lord_tuetano.glb",
  majin_bu: "/assets/models/majin_bu.glb",
  majin_bu_barca: "/assets/models/majin_bu_barca.glb",
  illidan: "/assets/models/illidan.glb",
  arthas: "/assets/models/arthas.glb",
  bowser: "/assets/models/bowser.glb",
  mini_goku: "/assets/models/mini_goku.glb",
};

export const WORLD = {
  gridSize: 24,
  blockSize: 15,
  roadWidth: 5,
  hqPos: [0, 0, 0] as [number, number, number],
};
