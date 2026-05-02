/**
 * Card Studio — catálogo de plantillas premium de tarjetas de presentación.
 *
 * Cada plantilla es un sistema de diseño completo:
 *  - Paleta (5 colores)
 *  - Tipografías (heading + body, Google Fonts reales)
 *  - Layout (centered | left | grid)
 *  - Background style (sólido, degradado o prompt para IA)
 *  - HTML/CSS skeletons para FRONT y BACK
 *
 * El renderer (card-renderer.ts) inyecta los datos del titular en estas plantillas
 * usando placeholders {{fullName}}, {{jobTitle}}, etc. La capa de texto se
 * renderiza con Puppeteer a 300 DPI sobre fondo transparente para superponerla
 * después con Sharp sobre el fondo (IA o sólido).
 */

export type CardPalette = {
  bg: string;        // background base
  primary: string;   // texto principal / heading
  secondary: string; // texto secundario / body
  accent: string;    // acento (líneas, iconos)
  text: string;      // color de texto plano
};

export type CardFonts = {
  heading: string; // Google Fonts family name
  body: string;
  weights?: { heading?: number; body?: number };
};

export type CardTemplate = {
  id: string;
  name: string;
  description: string;
  category: "luxury" | "minimalist" | "creative" | "corporate" | "tech";
  palette: CardPalette;
  fonts: CardFonts;
  layout: "centered" | "left" | "grid";
  /**
   * Background config:
   *  - solid: usa palette.bg
   *  - gradient: degradado lineal con palette.bg → palette.accent
   *  - ai-texture: prompt textless para Recraft v3 / Imagen 4
   */
  background: {
    kind: "solid" | "gradient" | "ai-texture";
    prompt?: string; // si kind === "ai-texture"
    gradientAngle?: number; // grados, default 135
  };
  /** Estilo del QR (back) */
  qrStyle: {
    fgColor: string;
    bgColor: string;
    margin: number;
    cornerRadius?: number;
  };
};

export const CARD_TEMPLATES: Record<string, CardTemplate> = {
  "elite-executive": {
    id: "elite-executive",
    name: "Elite Executive",
    description: "Negro carbono con tipografía oro foil. Estilo lujo CEO/founder.",
    category: "luxury",
    palette: {
      bg: "#0a0a0a",
      primary: "#d4af37",   // oro
      secondary: "#f4e4a3", // oro claro
      accent: "#c8a84b",
      text: "#ffffff",
    },
    fonts: {
      heading: "Cinzel",
      body: "Montserrat",
      weights: { heading: 700, body: 400 },
    },
    layout: "centered",
    background: {
      kind: "ai-texture",
      prompt:
        "Premium black carbon fiber texture, deep matte finish with subtle gold flecks, dramatic spotlight from top-right, professional studio lighting, ultra detailed micro-pattern, luxury business card background, no text, no logos, photorealistic, 8k",
    },
    qrStyle: {
      fgColor: "#d4af37",
      bgColor: "#0a0a0a",
      margin: 1,
      cornerRadius: 4,
    },
  },

  "minimalist-mono": {
    id: "minimalist-mono",
    name: "Minimalist Mono",
    description: "Blanco puro, tipografía sans precisa. Estilo Apple/Notion.",
    category: "minimalist",
    palette: {
      bg: "#ffffff",
      primary: "#0f0f0f",
      secondary: "#525252",
      accent: "#0a0a0a",
      text: "#1a1a1a",
    },
    fonts: {
      heading: "Inter",
      body: "Inter",
      weights: { heading: 600, body: 400 },
    },
    layout: "left",
    background: {
      kind: "solid",
    },
    qrStyle: {
      fgColor: "#0f0f0f",
      bgColor: "#ffffff",
      margin: 2,
    },
  },

  "luxury-foil": {
    id: "luxury-foil",
    name: "Luxury Foil",
    description: "Cuero negro mate con foil dorado y plata. Estilo joyería/relojería.",
    category: "luxury",
    palette: {
      bg: "#0d0a08",
      primary: "#e6c878",
      secondary: "#b8b8b8",
      accent: "#d4af37",
      text: "#ffffff",
    },
    fonts: {
      heading: "Playfair Display",
      body: "Lato",
      weights: { heading: 700, body: 300 },
    },
    layout: "centered",
    background: {
      kind: "ai-texture",
      prompt:
        "Luxurious dark leather texture, fine grain detail, embossed pattern, dramatic chiaroscuro lighting from left, deep shadows, gold foil accents glinting in corners, premium business card material, ultra realistic photography, 8k, no text, no logos",
    },
    qrStyle: {
      fgColor: "#e6c878",
      bgColor: "#0d0a08",
      margin: 1,
      cornerRadius: 6,
    },
  },

  "creative-bold": {
    id: "creative-bold",
    name: "Creative Bold",
    description: "Degradado púrpura→naranja, tipografía display. Estilo agency/designer.",
    category: "creative",
    palette: {
      bg: "#1a0033",
      primary: "#ff6b35",
      secondary: "#ffd166",
      accent: "#9b5de5",
      text: "#ffffff",
    },
    fonts: {
      heading: "Space Grotesk",
      body: "Space Grotesk",
      weights: { heading: 700, body: 400 },
    },
    layout: "left",
    background: {
      kind: "gradient",
      gradientAngle: 135,
    },
    qrStyle: {
      fgColor: "#ffffff",
      bgColor: "#1a0033",
      margin: 1,
    },
  },

  "corporate-clean": {
    id: "corporate-clean",
    name: "Corporate Clean",
    description: "Blanco con acento navy, grid estructurado. Estilo law/finance/consulting.",
    category: "corporate",
    palette: {
      bg: "#ffffff",
      primary: "#0a2540",
      secondary: "#425466",
      accent: "#635bff",
      text: "#0a2540",
    },
    fonts: {
      heading: "Source Serif Pro",
      body: "Source Sans Pro",
      weights: { heading: 700, body: 400 },
    },
    layout: "grid",
    background: {
      kind: "solid",
    },
    qrStyle: {
      fgColor: "#0a2540",
      bgColor: "#ffffff",
      margin: 2,
    },
  },

  "tech-dark": {
    id: "tech-dark",
    name: "Tech Dark",
    description: "Azul medianoche con cyan neón. Estilo SaaS/startup tech.",
    category: "tech",
    palette: {
      bg: "#0b1220",
      primary: "#3ddbd9",
      secondary: "#82a0ff",
      accent: "#3ddbd9",
      text: "#e6edf3",
    },
    fonts: {
      heading: "JetBrains Mono",
      body: "Inter",
      weights: { heading: 700, body: 400 },
    },
    layout: "left",
    background: {
      kind: "ai-texture",
      prompt:
        "Dark navy blue gradient mesh texture with subtle cyan circuit-like patterns, deep space aesthetic, soft glow accents, modern tech background, ultra clean, professional, 8k, no text, no logos",
    },
    qrStyle: {
      fgColor: "#3ddbd9",
      bgColor: "#0b1220",
      margin: 1,
    },
  },
};

export function listTemplates(): CardTemplate[] {
  return Object.values(CARD_TEMPLATES);
}

export function getTemplate(id: string): CardTemplate | null {
  return CARD_TEMPLATES[id] || null;
}
