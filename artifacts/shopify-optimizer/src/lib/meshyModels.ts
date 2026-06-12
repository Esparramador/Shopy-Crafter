import type { ModelAnimation } from "@/components/ModelViewer3D";

export interface MeshyCharacter {
  id: string;
  name: string;
  emoji: string;
  category: "cartoon" | "realistic";
  description: string;
  tags: string[];
  glbPath: string;
  rigStatus: "rigged" | "pending";
  animations: ModelAnimation[];
}

// Characters that have been rigged + animated by Meshy
const RIGGED_ANIMATIONS: Record<string, ModelAnimation[]> = {
  batman: [
    { name: "walk",  label: "🚶 Caminar",  glbPath: "/assets/3d/animations/batman/walk.glb",  looping: true  },
    { name: "run",   label: "🏃 Correr",   glbPath: "/assets/3d/animations/batman/run.glb",   looping: true  },
    { name: "jump",  label: "⬆ Saltar",   glbPath: "/assets/3d/animations/batman/jump.glb",  looping: false },
  ],
  alec_monopoly: [
    { name: "walk",  label: "🚶 Caminar",  glbPath: "/assets/3d/animations/alec_monopoly/walk.glb",  looping: true  },
    { name: "run",   label: "🏃 Correr",   glbPath: "/assets/3d/animations/alec_monopoly/run.glb",   looping: true  },
    { name: "jump",  label: "⬆ Saltar",   glbPath: "/assets/3d/animations/alec_monopoly/jump.glb",  looping: false },
  ],
  ted: [
    { name: "walk",  label: "🚶 Caminar",  glbPath: "/assets/3d/animations/ted/walk.glb",  looping: true  },
    { name: "run",   label: "🏃 Correr",   glbPath: "/assets/3d/animations/ted/run.glb",   looping: true  },
    { name: "jump",  label: "⬆ Saltar",   glbPath: "/assets/3d/animations/ted/jump.glb",  looping: false },
  ],
  chico_casual: [
    { name: "walk",  label: "🚶 Caminar",  glbPath: "/assets/3d/animations/chico_casual/walk.glb",  looping: true  },
    { name: "run",   label: "🏃 Correr",   glbPath: "/assets/3d/animations/chico_casual/run.glb",   looping: true  },
    { name: "jump",  label: "⬆ Saltar",   glbPath: "/assets/3d/animations/chico_casual/jump.glb",  looping: false },
  ],
  chico_formal: [
    { name: "walk",  label: "🚶 Caminar",  glbPath: "/assets/3d/animations/chico_formal/walk.glb",  looping: true  },
    { name: "run",   label: "🏃 Correr",   glbPath: "/assets/3d/animations/chico_formal/run.glb",   looping: true  },
    { name: "jump",  label: "⬆ Saltar",   glbPath: "/assets/3d/animations/chico_formal/jump.glb",  looping: false },
  ],
};

export const MESHY_CHARACTERS: MeshyCharacter[] = [
  {
    id: "batman",
    name: "Batman",
    emoji: "🦇",
    category: "cartoon",
    description: "El Caballero de la Noche. Modelo rigged con animaciones walk, run y jump.",
    tags: ["superhéroe", "dc", "acción", "rigged"],
    glbPath: "/assets/3d/models/batman.glb",
    rigStatus: "rigged",
    animations: RIGGED_ANIMATIONS.batman,
  },
  {
    id: "alec_monopoly",
    name: "Alec Monopoly",
    emoji: "🎩",
    category: "cartoon",
    description: "El artista urbano con su sombrero de copa. Rigged y animado.",
    tags: ["arte", "urbano", "cartoon", "rigged"],
    glbPath: "/assets/3d/models/alec_monopoly.glb",
    rigStatus: "rigged",
    animations: RIGGED_ANIMATIONS.alec_monopoly,
  },
  {
    id: "ted",
    name: "TED (Oso)",
    emoji: "🐻",
    category: "cartoon",
    description: "El osito de peluche más famoso. Rigged con animaciones completas.",
    tags: ["oso", "humor", "cartoon", "rigged"],
    glbPath: "/assets/3d/models/ted.glb",
    rigStatus: "rigged",
    animations: RIGGED_ANIMATIONS.ted,
  },
  {
    id: "chico_casual",
    name: "Hombre Casual Tech",
    emoji: "👨‍💻",
    category: "realistic",
    description: "Desarrollador casual con ropa urbana. Animaciones realistas de movimiento.",
    tags: ["humano", "casual", "tech", "rigged"],
    glbPath: "/assets/3d/models/chico_casual.glb",
    rigStatus: "rigged",
    animations: RIGGED_ANIMATIONS.chico_casual,
  },
  {
    id: "chico_formal",
    name: "Hombre Traje Formal",
    emoji: "🤵",
    category: "realistic",
    description: "Ejecutivo con traje formal. Perfecto para presentaciones corporativas.",
    tags: ["humano", "formal", "corporativo", "rigged"],
    glbPath: "/assets/3d/models/chico_formal.glb",
    rigStatus: "rigged",
    animations: RIGGED_ANIMATIONS.chico_formal,
  },
  // Pending rig
  {
    id: "spiderman",
    name: "Spider-Man",
    emoji: "🕷️",
    category: "cartoon",
    description: "El Hombre Araña. Modelo 3D de alta calidad (rig pendiente).",
    tags: ["marvel", "superhéroe", "acción"],
    glbPath: "/assets/3d/models/spiderman.glb",
    rigStatus: "pending",
    animations: [],
  },
  {
    id: "bob_esponja",
    name: "Bob Esponja",
    emoji: "🧽",
    category: "cartoon",
    description: "La esponja más famosa de Fondo de Bikini.",
    tags: ["nickelodeon", "cartoon", "humor"],
    glbPath: "/assets/3d/models/bob_esponja.glb",
    rigStatus: "pending",
    animations: [],
  },
  {
    id: "mickey_mouse",
    name: "Mickey Mouse",
    emoji: "🐭",
    category: "cartoon",
    description: "El personaje más icónico de Disney.",
    tags: ["disney", "cartoon", "clásico"],
    glbPath: "/assets/3d/models/mickey_mouse.glb",
    rigStatus: "pending",
    animations: [],
  },
  {
    id: "payaso_plim_plim",
    name: "Plim Plim",
    emoji: "🤡",
    category: "cartoon",
    description: "El payaso mágico de valores para niños.",
    tags: ["infantil", "cartoon", "latam"],
    glbPath: "/assets/3d/models/payaso_plim_plim.glb",
    rigStatus: "pending",
    animations: [],
  },
  {
    id: "minnie_mouse",
    name: "Minnie Mouse",
    emoji: "🎀",
    category: "cartoon",
    description: "La ratoncita más elegante de Disney.",
    tags: ["disney", "cartoon", "clásico"],
    glbPath: "/assets/3d/models/minnie_mouse.glb",
    rigStatus: "pending",
    animations: [],
  },
  {
    id: "bugs_bunny",
    name: "Bugs Bunny",
    emoji: "🐰",
    category: "cartoon",
    description: "¿Qué hay de nuevo, viejo? El conejo de Looney Tunes.",
    tags: ["warner", "cartoon", "clásico"],
    glbPath: "/assets/3d/models/bugs_bunny.glb",
    rigStatus: "pending",
    animations: [],
  },
  {
    id: "pikachu",
    name: "Pikachu",
    emoji: "⚡",
    category: "cartoon",
    description: "El Pokémon eléctrico más amado del mundo.",
    tags: ["pokemon", "nintendo", "cartoon"],
    glbPath: "/assets/3d/models/pikachu.glb",
    rigStatus: "pending",
    animations: [],
  },
  {
    id: "chica_ejecutiva",
    name: "Mujer Ejecutiva",
    emoji: "👩‍💼",
    category: "realistic",
    description: "Profesional corporativa con look de autoridad.",
    tags: ["humano", "ejecutiva", "corporativo"],
    glbPath: "/assets/3d/models/chica_ejecutiva.glb",
    rigStatus: "pending",
    animations: [],
  },
  {
    id: "chica_creativa",
    name: "Mujer Creativa",
    emoji: "👩‍🎨",
    category: "realistic",
    description: "Diseñadora de agencia con estilo moderno.",
    tags: ["humano", "creativa", "agencia"],
    glbPath: "/assets/3d/models/chica_creativa.glb",
    rigStatus: "pending",
    animations: [],
  },
];

export const RIGGED_CHARACTERS = MESHY_CHARACTERS.filter(c => c.rigStatus === "rigged");
export const PENDING_CHARACTERS = MESHY_CHARACTERS.filter(c => c.rigStatus === "pending");
