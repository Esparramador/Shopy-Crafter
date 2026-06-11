export interface VismeEffect {
  id: string;
  label: string;
  icon: string;
  family: string;
  description: string;
}

export const VISME_EFFECTS: VismeEffect[] = [
  { id: "none",        label: "Sin efecto",    icon: "⭕", family: "básico",   description: "Sin animación de entrada" },
  { id: "fadeUp",      label: "Surgir",        icon: "⬆", family: "fade",     description: "Sube desde abajo y aparece" },
  { id: "fadeDown",    label: "Caer",          icon: "⬇", family: "fade",     description: "Cae desde arriba y aparece" },
  { id: "fadeLeft",    label: "← Entrar",      icon: "◀", family: "fade",     description: "Desliza desde la derecha" },
  { id: "fadeRight",   label: "→ Entrar",      icon: "▶", family: "fade",     description: "Desliza desde la izquierda" },
  { id: "fadePop",     label: "Pop suave",     icon: "💥", family: "fade",     description: "Escala + aparece suavemente" },
  { id: "flip3dX",     label: "Voltear H",     icon: "🃏", family: "3D",       description: "Volteo horizontal con perspectiva 3D" },
  { id: "flip3dY",     label: "Voltear V",     icon: "🎴", family: "3D",       description: "Volteo vertical con perspectiva 3D" },
  { id: "tiltPop",     label: "Tilt 3D",       icon: "🎭", family: "3D",       description: "Inclinación 3D + rebote" },
  { id: "zDepth",      label: "Profundidad Z", icon: "🔭", family: "3D",       description: "Emerge desde el fondo en perspectiva" },
  { id: "rollForward", label: "Rodadura",       icon: "🎡", family: "3D",       description: "Rueda hacia el frente como panel" },
  { id: "curtainUp",   label: "Cortina",       icon: "🎬", family: "reveal",   description: "Cortina que se levanta de abajo" },
  { id: "slideBlur",   label: "Desliz+Blur",   icon: "💨", family: "reveal",   description: "Entra con desenfoque desde el lado" },
  { id: "wipeRight",   label: "Revelar →",     icon: "▶▶", family: "reveal",   description: "Revela de izquierda a derecha" },
  { id: "scaleSpring", label: "Resorte",       icon: "🌱", family: "escala",   description: "Resorte elástico con overshoot" },
  { id: "popBounce",   label: "Pop+Rebote",    icon: "🎈", family: "escala",   description: "Pop con rebote elástico" },
  { id: "zoomBlur",    label: "Zoom+Blur",     icon: "🔍", family: "escala",   description: "Zoom desde lejos con desenfoque" },
  { id: "glitch",      label: "Glitch",        icon: "⚡", family: "especial", description: "Efecto glitch digital con color shift" },
  { id: "floatRise",   label: "Flotar",        icon: "🌊", family: "especial", description: "Flota suavemente hacia arriba" },
  { id: "blurReveal",  label: "Desenfoque",    icon: "🌫", family: "especial", description: "De desenfocado a nítido" },
  { id: "swingIn",     label: "Péndulo",       icon: "🕰", family: "especial", description: "Péndulo desde arriba" },
  { id: "liquid",      label: "Líquido",       icon: "💧", family: "especial", description: "Entrada con deformación líquida" },
  { id: "morph",       label: "Morfosis",      icon: "🔮", family: "especial", description: "Morfea desde distorsión a forma" },
  { id: "twist3d",     label: "Giro 3D",       icon: "🌀", family: "especial", description: "Giro diagonal en 3D" },
];

export const EFFECT_FAMILIES = ["básico", "fade", "3D", "reveal", "escala", "especial"] as const;

export const effectById = (id: string): VismeEffect =>
  VISME_EFFECTS.find(e => e.id === id) ?? VISME_EFFECTS[1];

export const LANDING_SECTIONS_EFFECTS = [
  { id: "hero",        label: "Hero",        icon: "🦸" },
  { id: "engines",     label: "Motores IA",  icon: "⚙" },
  { id: "demo",        label: "Demo",        icon: "🎬" },
  { id: "results",     label: "Resultados",  icon: "📈" },
  { id: "pricing",     label: "Precios",     icon: "💰" },
  { id: "calculator",  label: "Calculadora", icon: "🧮" },
  { id: "contact",     label: "Contacto",    icon: "📞" },
] as const;

export const DEFAULT_EFFECTS: Record<string, string> = {
  hero:        "fadeUp",
  engines:     "flip3dX",
  demo:        "fadeRight",
  results:     "scaleSpring",
  pricing:     "zDepth",
  calculator:  "fadeLeft",
  contact:     "floatRise",
};
