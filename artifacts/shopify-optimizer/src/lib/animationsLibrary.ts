export interface AnimationClip {
  id: string;
  name: string;
  label: string;
  category: AnimationCategory;
  description: string;
  looping: boolean;
  durationMs: number;
  meshyClipName: string;
  tags: string[];
  formContext?: string;
}

export type AnimationCategory =
  | "entrance"
  | "waiting"
  | "action"
  | "celebration"
  | "locomotion"
  | "emote"
  | "combat";

export interface AnimationCategoryMeta {
  id: AnimationCategory;
  label: string;
  icon: string;
  description: string;
  useCase: string;
}

export const ANIMATION_CATEGORIES: AnimationCategoryMeta[] = [
  {
    id: "entrance",
    label: "Entradas",
    icon: "🎬",
    description: "Animaciones de entrada al formulario",
    useCase: "Se reproducen una sola vez al cargar el formulario",
  },
  {
    id: "waiting",
    label: "Idle / Espera",
    icon: "🧍",
    description: "Animaciones en bucle mientras el usuario llena el formulario",
    useCase: "Bucle continuo mientras el usuario interactúa",
  },
  {
    id: "action",
    label: "Acción / Formulario",
    icon: "👆",
    description: "Gestos para guiar al usuario por los campos",
    useCase: "Se activan al enfocar campos específicos del formulario",
  },
  {
    id: "celebration",
    label: "Celebración",
    icon: "🎉",
    description: "Animaciones de celebración al enviar el formulario",
    useCase: "Se reproducen al enviar el formulario correctamente",
  },
  {
    id: "locomotion",
    label: "Locomoción",
    icon: "🚶",
    description: "Movimientos de desplazamiento",
    useCase: "Transiciones y movimientos dinámicos",
  },
  {
    id: "emote",
    label: "Emociones",
    icon: "😄",
    description: "Expresiones emocionales del personaje",
    useCase: "Reacciones a las acciones del usuario",
  },
  {
    id: "combat",
    label: "Combate / Acción",
    icon: "⚔️",
    description: "Movimientos de acción intensa",
    useCase: "Escenas de acción y juegos",
  },
];

export const ANIMATIONS: AnimationClip[] = [
  // ── ENTRADAS ─────────────────────────────────────────────────────────────
  {
    id: "entrance_drop_in",
    name: "Drop_In",
    label: "Caída dramática",
    category: "entrance",
    description: "El personaje cae desde arriba con impacto. Entrada espectacular para formularios de conversión.",
    looping: false,
    durationMs: 1200,
    meshyClipName: "Drop_In",
    tags: ["entrance", "dramatic", "impact", "hero"],
    formContext: "Al cargar el formulario",
  },
  {
    id: "entrance_walk_in_wave",
    name: "Walk_In_Wave",
    label: "Caminar y saludar",
    category: "entrance",
    description: "El personaje camina hacia el usuario y saluda con la mano. Entrada amigable y cálida.",
    looping: false,
    durationMs: 2400,
    meshyClipName: "Walk_In_Wave",
    tags: ["entrance", "friendly", "wave", "walk"],
    formContext: "Al cargar el formulario",
  },
  {
    id: "entrance_jump_in",
    name: "Jump_In",
    label: "Salto de entrada",
    category: "entrance",
    description: "El personaje entra saltando con energía. Ideal para marcas dinámicas y juveniles.",
    looping: false,
    durationMs: 900,
    meshyClipName: "Jump_In",
    tags: ["entrance", "energetic", "jump", "fun"],
    formContext: "Al cargar el formulario",
  },
  {
    id: "entrance_slide_right",
    name: "Slide_Right",
    label: "Deslizarse desde izquierda",
    category: "entrance",
    description: "El personaje se desliza desde el lateral izquierdo con estilo. Entrada moderna y limpia.",
    looping: false,
    durationMs: 800,
    meshyClipName: "Slide_Right",
    tags: ["entrance", "smooth", "slide", "modern"],
    formContext: "Al cargar el formulario",
  },

  // ── IDLE / ESPERA ─────────────────────────────────────────────────────────
  {
    id: "idle_breathing",
    name: "Idle_Breathing",
    label: "Respiración natural",
    category: "waiting",
    description: "Respiración sutil y natural. La animación de reposo más realista y no intrusiva.",
    looping: true,
    durationMs: 3000,
    meshyClipName: "Idle_Breathing",
    tags: ["idle", "subtle", "breathing", "loop", "default"],
    formContext: "Bucle mientras usuario llena campos",
  },
  {
    id: "idle_look_watch",
    name: "Look_Watch",
    label: "Mirar el reloj",
    category: "waiting",
    description: "El personaje mira su reloj con impaciencia sutil. Añade urgencia sin ser agresivo.",
    looping: true,
    durationMs: 4200,
    meshyClipName: "Look_Watch",
    tags: ["idle", "watch", "urgency", "loop"],
    formContext: "Bucle mientras usuario llena campos",
  },
  {
    id: "idle_thinking",
    name: "Thinking_Hand_On_Chin",
    label: "Pensativo (mano en barbilla)",
    category: "waiting",
    description: "Pose pensativa clásica con la mano en la barbilla. Invita al usuario a reflexionar.",
    looping: true,
    durationMs: 5000,
    meshyClipName: "Thinking_Hand_On_Chin",
    tags: ["idle", "thinking", "intellectual", "loop"],
    formContext: "Ideal para formularios de consultoría o estrategia",
  },
  {
    id: "idle_impatient_tap",
    name: "Impatient_Tap",
    label: "Repiqueteo impaciente",
    category: "waiting",
    description: "El personaje tamborillea los dedos con impaciencia. Crea urgencia para completar el formulario.",
    looping: true,
    durationMs: 2000,
    meshyClipName: "Impatient_Tap",
    tags: ["idle", "impatient", "urgency", "loop"],
    formContext: "Para formularios con tiempo limitado o alta urgencia",
  },

  // ── ACCIÓN / FORMULARIO ───────────────────────────────────────────────────
  {
    id: "action_point_button",
    name: "Point_At_Button",
    label: "Señalar botón",
    category: "action",
    description: "El personaje señala directamente hacia el botón de envío. La CTA más poderosa posible.",
    looping: false,
    durationMs: 1500,
    meshyClipName: "Point_At_Button",
    tags: ["action", "point", "cta", "guide"],
    formContext: "Al enfocar el botón de envío",
  },
  {
    id: "action_presenting_palm",
    name: "Presenting_Palm_Up",
    label: "Presentar con palma",
    category: "action",
    description: "Gesto de presentación con la palma hacia arriba. Perfecto para mostrar el valor del formulario.",
    looping: false,
    durationMs: 2000,
    meshyClipName: "Presenting_Palm_Up",
    tags: ["action", "present", "offer", "sales"],
    formContext: "Al enfocar campos de nombre o email",
  },
  {
    id: "action_thumbs_up",
    name: "Thumbs_Up",
    label: "Pulgar arriba",
    category: "action",
    description: "Aprobación con pulgar arriba. Confirma que el usuario está haciendo lo correcto.",
    looping: false,
    durationMs: 1200,
    meshyClipName: "Thumbs_Up",
    tags: ["action", "approve", "positive", "confirm"],
    formContext: "Al validar correctamente un campo",
  },

  // ── CELEBRACIÓN ───────────────────────────────────────────────────────────
  {
    id: "celebration_dance_joy",
    name: "Dance_Joy",
    label: "Baile de alegría",
    category: "celebration",
    description: "Baile explosivo de alegría. La celebración más memorable para el envío del formulario.",
    looping: false,
    durationMs: 4000,
    meshyClipName: "Dance_Joy",
    tags: ["celebration", "dance", "joy", "memorable"],
    formContext: "Al enviar el formulario con éxito",
  },
  {
    id: "celebration_clapping",
    name: "Clapping",
    label: "Aplauso",
    category: "celebration",
    description: "Aplauso entusiasta para celebrar la conversión. Simple y efectivo.",
    looping: false,
    durationMs: 2500,
    meshyClipName: "Clapping",
    tags: ["celebration", "clap", "approve", "success"],
    formContext: "Al enviar el formulario con éxito",
  },
  {
    id: "celebration_victory_fist",
    name: "Victory_Fist",
    label: "Puño de victoria",
    category: "celebration",
    description: "Puño en alto en señal de victoria. Poderoso y emotivo, conecta con el logro del usuario.",
    looping: false,
    durationMs: 1800,
    meshyClipName: "Victory_Fist",
    tags: ["celebration", "victory", "power", "achievement"],
    formContext: "Al enviar el formulario con éxito",
  },
  {
    id: "celebration_backflip",
    name: "Backflip",
    label: "Salto mortal",
    category: "celebration",
    description: "Salto mortal hacia atrás impresionante. Para marcas audaces que quieren dejar huella.",
    looping: false,
    durationMs: 1500,
    meshyClipName: "Backflip",
    tags: ["celebration", "acrobatic", "bold", "wow"],
    formContext: "Al enviar el formulario con éxito",
  },

  // ── LOCOMOCIÓN ────────────────────────────────────────────────────────────
  {
    id: "loco_walk",
    name: "Walk",
    label: "Caminar",
    category: "locomotion",
    description: "Ciclo de caminata natural hacia adelante.",
    looping: true,
    durationMs: 1200,
    meshyClipName: "walk",
    tags: ["locomotion", "loop", "walk"],
  },
  {
    id: "loco_run",
    name: "Run",
    label: "Correr",
    category: "locomotion",
    description: "Ciclo de carrera enérgica.",
    looping: true,
    durationMs: 700,
    meshyClipName: "run",
    tags: ["locomotion", "loop", "run", "fast"],
  },
  {
    id: "loco_jump",
    name: "Jump",
    label: "Saltar",
    category: "locomotion",
    description: "Salto puntual con aterrizaje.",
    looping: false,
    durationMs: 1000,
    meshyClipName: "jump",
    tags: ["locomotion", "jump"],
  },

  // ── EMOCIONES ─────────────────────────────────────────────────────────────
  {
    id: "emote_wave",
    name: "Wave",
    label: "Saludar",
    category: "emote",
    description: "Saludo amistoso con la mano.",
    looping: false,
    durationMs: 1500,
    meshyClipName: "wave",
    tags: ["emote", "greeting", "friendly"],
  },
  {
    id: "emote_celebrate",
    name: "Celebrate",
    label: "Celebrar",
    category: "emote",
    description: "Brazos en alto, celebración eufórica.",
    looping: false,
    durationMs: 2000,
    meshyClipName: "celebrate",
    tags: ["emote", "celebration", "joy"],
  },
  {
    id: "emote_happy",
    name: "Happy",
    label: "Feliz",
    category: "emote",
    description: "Expresión de felicidad intensa.",
    looping: false,
    durationMs: 1800,
    meshyClipName: "happy",
    tags: ["emote", "positive", "joy"],
  },
  {
    id: "emote_nod",
    name: "Nod",
    label: "Asentir",
    category: "emote",
    description: "Asentimiento afirmativo de cabeza.",
    looping: false,
    durationMs: 800,
    meshyClipName: "nod",
    tags: ["emote", "confirm", "yes"],
  },
];

export const ANIMATIONS_BY_CATEGORY: Record<AnimationCategory, AnimationClip[]> = {
  entrance: ANIMATIONS.filter((a) => a.category === "entrance"),
  waiting: ANIMATIONS.filter((a) => a.category === "waiting"),
  action: ANIMATIONS.filter((a) => a.category === "action"),
  celebration: ANIMATIONS.filter((a) => a.category === "celebration"),
  locomotion: ANIMATIONS.filter((a) => a.category === "locomotion"),
  emote: ANIMATIONS.filter((a) => a.category === "emote"),
  combat: ANIMATIONS.filter((a) => a.category === "combat"),
};

export function getAnimationById(id: string): AnimationClip | undefined {
  return ANIMATIONS.find((a) => a.id === id);
}

export function getFormAnimationDefaults() {
  return {
    entrance: "entrance_walk_in_wave",
    waiting: "idle_breathing",
    action: "action_point_button",
    celebration: "celebration_dance_joy",
  };
}
