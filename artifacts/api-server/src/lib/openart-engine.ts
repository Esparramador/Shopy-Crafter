/**
 * OpenArt Engine — Motor de prompts, estilos, plantillas y modelos
 * Inspirado en OpenArt.ai: 40+ presets, fórmula maestra, libro de prompts, catálogo de modelos
 */

export interface StylePreset {
  id: string;
  name: string;
  category: string;
  emoji: string;
  description: string;
  promptSuffix: string;
  negativePrompt: string;
  recommendedModel: string;
  examplePrompt: string;
  tags: string[];
}

export interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  prompt: string;
  variables: string[];
  style?: string;
  model?: string;
  tags: string[];
}

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  type: "image" | "video" | "both";
  strengths: string[];
  bestFor: string[];
  quality: "standard" | "premium" | "ultra";
  speed: "fast" | "medium" | "slow";
}

export interface PromptBlockResult {
  subject: string;
  style: string;
  composition: string;
  lighting: string;
  mood: string;
  qualityModifiers: string;
  negative: string;
  full: string;
  stylePreset?: StylePreset;
}

// ─── STYLE PRESETS (40+) ────────────────────────────────────────────────────

export const STYLE_PRESETS: StylePreset[] = [
  // REALISMO & FOTOGRAFÍA
  {
    id: "hyperrealism",
    name: "Hiper-realismo Fotográfico",
    category: "Realismo",
    emoji: "📸",
    description: "Fotografía ultra-realista con detalle de piel, texturas y reflejos perfectos",
    promptSuffix: "hyperrealistic photography, 85mm lens, f/1.8, RAW photo, ultra-detailed skin texture, photorealistic, 8K resolution, professional studio lighting, Hasselblad medium format",
    negativePrompt: "illustration, painting, cartoon, anime, drawing, render, CGI, artificial, low quality, blurry, watermark",
    recommendedModel: "flux-pro",
    examplePrompt: "Professional portrait of a woman, age 30, hyperrealistic photography, 85mm lens, f/1.8, RAW photo",
    tags: ["portrait", "product", "fashion", "editorial"],
  },
  {
    id: "product-photography",
    name: "Fotografía de Producto",
    category: "Realismo",
    emoji: "📦",
    description: "Shot de producto premium con iluminación de estudio profesional",
    promptSuffix: "professional product photography, studio lighting, white seamless background, soft shadows, commercial quality, 8K, DSLR, macro lens, pristine condition",
    negativePrompt: "person, model, watermark, text, logo, messy, blurry, low quality, amateur",
    recommendedModel: "flux-pro",
    examplePrompt: "Luxury perfume bottle on white marble, product photography, studio lighting",
    tags: ["ecommerce", "product", "commercial", "shopify"],
  },
  {
    id: "editorial-luxury",
    name: "Editorial de Lujo",
    category: "Realismo",
    emoji: "✨",
    description: "Estética editorial de revista de moda o lujo con iluminación dramática dorada",
    promptSuffix: "luxury editorial photography, warm golden hour light, Vogue magazine style, bokeh background, cinematic depth of field, rich colors, film grain, high fashion aesthetic",
    negativePrompt: "amateur, low quality, harsh lighting, flat, boring, ugly, distorted",
    recommendedModel: "flux-ultra",
    examplePrompt: "Luxury watch on black velvet, editorial photography, golden light, bokeh",
    tags: ["luxury", "fashion", "editorial", "high-end"],
  },
  {
    id: "lifestyle",
    name: "Lifestyle & Ambiente",
    category: "Realismo",
    emoji: "🌅",
    description: "Fotografía de estilo de vida auténtica, personas disfrutando productos en contexto real",
    promptSuffix: "lifestyle photography, natural light, authentic moment, shallow depth of field, warm tones, candid feel, modern home or outdoor setting",
    negativePrompt: "stock photo pose, fake smile, studio, white background, artificial, low quality",
    recommendedModel: "flux-dev",
    examplePrompt: "Young professional using laptop in cozy cafe, lifestyle photography, natural light",
    tags: ["lifestyle", "social-media", "brand", "authentic"],
  },
  // ARTE DIGITAL
  {
    id: "cinematic",
    name: "Cinematográfico",
    category: "Arte Digital",
    emoji: "🎬",
    description: "Frame de película con color grading cinematográfico y composición de director",
    promptSuffix: "cinematic movie still, anamorphic lens, teal and orange color grade, dramatic shadows, film grain, 2.39:1 aspect ratio, directorial composition, IMAX quality",
    negativePrompt: "anime, cartoon, illustration, low quality, amateur, flat lighting, no depth",
    recommendedModel: "flux-pro",
    examplePrompt: "Lone detective in rainy neon-lit alley, cinematic movie still, anamorphic lens",
    tags: ["cinematic", "film", "drama", "advertising"],
  },
  {
    id: "dark-fantasy",
    name: "Fantasía Oscura",
    category: "Arte Digital",
    emoji: "🌑",
    description: "Arte oscuro y épico inspirado en Dark Souls, Warhammer y mundos fantásticos sombríos",
    promptSuffix: "dark fantasy art, dramatic volumetric lighting, intricate details, grim atmosphere, matte painting quality, concept art, moody color palette, epic scale",
    negativePrompt: "bright colors, cheerful, cartoon, low quality, simple, minimalist",
    recommendedModel: "sdxl-juggernaut",
    examplePrompt: "Ancient dragon overlooking a ruined medieval city, dark fantasy art, volumetric light",
    tags: ["fantasy", "dark", "epic", "gaming"],
  },
  {
    id: "sci-fi",
    name: "Ciencia Ficción",
    category: "Arte Digital",
    emoji: "🚀",
    description: "Estética futurista con neones, hologramas y tecnología avanzada",
    promptSuffix: "sci-fi concept art, holographic elements, neon lights, futuristic technology, blue and purple palette, cyberpunk influences, highly detailed, unreal engine 5 render",
    negativePrompt: "medieval, vintage, cartoon, low quality, simple, outdated technology",
    recommendedModel: "flux-dev",
    examplePrompt: "Futuristic megacity at night, hovercars, holographic billboards, sci-fi concept art",
    tags: ["sci-fi", "futuristic", "tech", "gaming"],
  },
  {
    id: "concept-art",
    name: "Concept Art",
    category: "Arte Digital",
    emoji: "🎨",
    description: "Arte conceptual de nivel AAA para videojuegos, películas y entretenimiento",
    promptSuffix: "professional concept art, matte painting, artstation trending, highly detailed, cinematic lighting, environment design, character design, industry standard quality",
    negativePrompt: "amateur, low quality, photo, photograph, simple, sketch, unfinished",
    recommendedModel: "sdxl-juggernaut",
    examplePrompt: "Ancient temple in a jungle, professional concept art, atmospheric lighting",
    tags: ["concept-art", "game", "film", "design"],
  },
  // ANIME & ILUSTRACIÓN
  {
    id: "anime",
    name: "Anime Premium",
    category: "Anime & Ilustración",
    emoji: "⛩️",
    description: "Arte anime de alta calidad estilo estudio Ghibli o producciones premium japonesas",
    promptSuffix: "anime illustration, studio quality, soft cel shading, vibrant colors, expressive eyes, clean linework, japanese animation style, highly detailed",
    negativePrompt: "photo, realistic, western cartoon, low quality, chibi unless requested, ugly",
    recommendedModel: "sdxl-animagine",
    examplePrompt: "Young woman with flowing red hair in a sunlit meadow, anime illustration, studio quality",
    tags: ["anime", "manga", "japanese", "illustration"],
  },
  {
    id: "ghibli",
    name: "Studio Ghibli",
    category: "Anime & Ilustración",
    emoji: "🌿",
    description: "Estilo mágico y evocador del Studio Ghibli con naturaleza exuberante y personajes tiernos",
    promptSuffix: "Studio Ghibli style, Hayao Miyazaki art style, hand-drawn animation, whimsical atmosphere, lush nature, warm colors, magical realism, painterly quality",
    negativePrompt: "photorealistic, dark, violent, low quality, 3D render, modern CGI",
    recommendedModel: "sdxl-animagine",
    examplePrompt: "Young girl exploring a magical forest village, Studio Ghibli style, warm light",
    tags: ["ghibli", "anime", "whimsical", "magical"],
  },
  {
    id: "digital-illustration",
    name: "Ilustración Digital",
    category: "Anime & Ilustración",
    emoji: "🖌️",
    description: "Ilustración digital profesional estilo Procreate o Adobe Illustrator",
    promptSuffix: "digital illustration, professional artwork, clean lines, vibrant colors, commercial quality, concept illustration, modern graphic design aesthetic",
    negativePrompt: "photo, 3D render, messy, rough sketch, low quality, amateur",
    recommendedModel: "flux-dev",
    examplePrompt: "Cheerful coffee shop scene, digital illustration, vibrant colors, commercial quality",
    tags: ["illustration", "commercial", "print", "digital"],
  },
  {
    id: "vector-art",
    name: "Arte Vectorial / Flat Design",
    category: "Anime & Ilustración",
    emoji: "⬡",
    description: "Diseño plano y vectorial minimalista, perfecto para branding y UI",
    promptSuffix: "flat design vector art, clean geometric shapes, minimal color palette, modern illustration, scalable design, icon-like quality, professional graphic design",
    negativePrompt: "photorealistic, complex textures, 3D, gradient overload, low quality, rough",
    recommendedModel: "flux-dev",
    examplePrompt: "Modern coffee shop icon set, flat design vector art, minimal colors",
    tags: ["vector", "flat-design", "icon", "branding"],
  },
  // 3D & RENDER
  {
    id: "3d-render",
    name: "3D Render Ultra",
    category: "3D & Render",
    emoji: "🧊",
    description: "Render 3D fotorrealista estilo Blender, Cinema 4D o Unreal Engine 5",
    promptSuffix: "photorealistic 3D render, ray tracing, global illumination, subsurface scattering, PBR materials, ultra-detailed, Blender 3.6, Octane render, 8K resolution",
    negativePrompt: "flat, 2D, illustration, painting, low poly, low quality, watermark",
    recommendedModel: "flux-pro",
    examplePrompt: "Luxury sports car on dark showroom floor, photorealistic 3D render, ray tracing",
    tags: ["3d", "render", "product", "automotive"],
  },
  {
    id: "clay-render",
    name: "Clay / Claymorphism",
    category: "3D & Render",
    emoji: "🧸",
    description: "Estética de arcilla 3D adorable y moderna, trend de diseño para branding y apps",
    promptSuffix: "clay render, claymorphism style, soft pastel colors, rounded forms, matte material, playful 3D design, isometric view, cute aesthetic, Blender clay shader",
    negativePrompt: "sharp edges, dark, realistic textures, low quality, flat 2D",
    recommendedModel: "flux-dev",
    examplePrompt: "Miniature city on desk, clay render, pastel colors, isometric view",
    tags: ["clay", "3d", "cute", "branding"],
  },
  {
    id: "pop-mart",
    name: "Pop Mart / Designer Toy",
    category: "3D & Render",
    emoji: "🎎",
    description: "Figuras coleccionables al estilo Pop Mart con acabado brillante y paleta pastel",
    promptSuffix: "Pop Mart designer toy style, chibi proportions, glossy finish, pastel color palette, white studio background, 3D collectible figure, smooth surfaces, IP character design",
    negativePrompt: "realistic, dark, scary, rough, low quality, amateur design",
    recommendedModel: "flux-dev",
    examplePrompt: "Cute astronaut character, Pop Mart designer toy style, glossy finish, pastel blue",
    tags: ["pop-mart", "toy", "collectible", "cute"],
  },
  {
    id: "pixar",
    name: "Pixar / Disney 3D",
    category: "3D & Render",
    emoji: "🏆",
    description: "Renderizado 3D de calidad Pixar con personajes expresivos y ambientes mágicos",
    promptSuffix: "Pixar animation style, Disney 3D render, expressive character, high quality CGI, warm lighting, professional animation studio, cinematic composition, rich colors",
    negativePrompt: "anime, flat, 2D, low quality, ugly, scary, dark",
    recommendedModel: "flux-pro",
    examplePrompt: "Friendly robot chef cooking in a kitchen, Pixar animation style, cinematic",
    tags: ["pixar", "disney", "3d", "animation"],
  },
  // ARTÍSTICO
  {
    id: "oil-painting",
    name: "Pintura al Óleo",
    category: "Artístico",
    emoji: "🖼️",
    description: "Pintura al óleo clásica estilo maestros holandeses o impresionismo",
    promptSuffix: "oil painting, classical technique, visible brushstrokes, rich pigments, chiaroscuro lighting, master painter quality, traditional canvas texture, museum quality",
    negativePrompt: "digital, photo, watercolor, sketch, low quality, modern",
    recommendedModel: "flux-dev",
    examplePrompt: "Portrait of a nobleman in candlelight, oil painting, classical technique, Dutch master",
    tags: ["oil", "classical", "fine-art", "traditional"],
  },
  {
    id: "watercolor",
    name: "Acuarela",
    category: "Artístico",
    emoji: "💧",
    description: "Acuarela delicada con transparencias suaves y bordes difuminados",
    promptSuffix: "watercolor painting, soft washes, transparent layers, wet-on-wet technique, gentle color bleeding, traditional paper texture, delicate brushwork, artistic quality",
    negativePrompt: "digital art, sharp edges, oil paint, 3D, photo, harsh lighting, low quality",
    recommendedModel: "flux-dev",
    examplePrompt: "Paris street cafe in spring, watercolor painting, soft washes, impressionist",
    tags: ["watercolor", "painting", "artistic", "gentle"],
  },
  {
    id: "comic-book",
    name: "Cómic / Viñeta",
    category: "Artístico",
    emoji: "💥",
    description: "Arte de cómic con entintado bold, colores planos y tramas Ben-Day",
    promptSuffix: "comic book art, bold inking, halftone dots, flat colors, dynamic action pose, Marvel or DC style, strong shadows, speech bubble compatible, panel art",
    negativePrompt: "photorealistic, soft shadows, watercolor, 3D render, low quality, amateur",
    recommendedModel: "flux-dev",
    examplePrompt: "Superhero flying over city, comic book art, bold inking, dynamic pose",
    tags: ["comic", "manga", "superhero", "cartoon"],
  },
  {
    id: "impressionism",
    name: "Impresionismo",
    category: "Artístico",
    emoji: "🌸",
    description: "Estilo impresionista de Monet, Renoir y Van Gogh con pinceladas visibles",
    promptSuffix: "impressionist painting, visible brushstrokes, painterly quality, Monet style, dappled light, soft color palette, en plein air aesthetic, post-impressionist influences",
    negativePrompt: "photo, digital art, hard lines, 3D, sharp edges, low quality",
    recommendedModel: "flux-dev",
    examplePrompt: "Garden party by a lake on a summer day, impressionist painting, Monet style",
    tags: ["impressionism", "monet", "fine-art", "painting"],
  },
  {
    id: "surrealism",
    name: "Surrealismo",
    category: "Artístico",
    emoji: "🌀",
    description: "Arte surrealista onírico estilo Dalí o Magritte con elementos imposibles",
    promptSuffix: "surrealist art, dreamlike atmosphere, impossible juxtaposition, Salvador Dali style, René Magritte influence, meticulous detail in absurd scenes, metaphysical quality",
    negativePrompt: "realistic, mundane, low quality, simple, photo",
    recommendedModel: "flux-dev",
    examplePrompt: "Melting clocks in a desert landscape with floating islands, surrealist art, Dali style",
    tags: ["surrealism", "dali", "dream", "art"],
  },
  {
    id: "art-nouveau",
    name: "Art Nouveau",
    category: "Artístico",
    emoji: "🌺",
    description: "Estilo art nouveau con ornamentos orgánicos, líneas fluidas y tipografía decorativa",
    promptSuffix: "Art Nouveau style, Alphonse Mucha influence, decorative botanical borders, flowing organic lines, muted jewel tones, gold leaf accents, ornamental composition",
    negativePrompt: "modern, minimalist, 3D, photorealistic, harsh, geometric, low quality",
    recommendedModel: "flux-dev",
    examplePrompt: "Elegant woman surrounded by lily flowers, Art Nouveau poster, Mucha style, gold",
    tags: ["art-nouveau", "mucha", "ornamental", "vintage"],
  },
  // FOTOGRAFÍA ESPECIALIZADA
  {
    id: "fashion",
    name: "Moda / Fashion",
    category: "Fotografía",
    emoji: "👗",
    description: "Fotografía de moda de alta costura con modelos, poses editoriales y estilismo",
    promptSuffix: "high fashion photography, editorial style, Vogue or Elle magazine quality, striking pose, avant-garde styling, high contrast, professional makeup, designer clothes",
    negativePrompt: "casual, amateur, low quality, bad pose, unflattering light, watermark",
    recommendedModel: "flux-ultra",
    examplePrompt: "Model in black couture dress, fashion photography, dramatic side lighting, editorial",
    tags: ["fashion", "editorial", "vogue", "high-end"],
  },
  {
    id: "food",
    name: "Fotografía de Comida",
    category: "Fotografía",
    emoji: "🍽️",
    description: "Food styling y fotografía gastronómica de nivel restaurante estrella Michelin",
    promptSuffix: "food photography, professional food styling, overhead or 45-degree angle, natural window light, shallow depth of field, fresh ingredients, restaurant quality plating",
    negativePrompt: "unappetizing, messy plating, harsh lighting, bad color, low quality",
    recommendedModel: "flux-pro",
    examplePrompt: "Gourmet pasta with truffle, food photography, natural light, overhead shot",
    tags: ["food", "restaurant", "culinary", "ecommerce"],
  },
  {
    id: "architecture",
    name: "Arquitectura & Interior",
    category: "Fotografía",
    emoji: "🏛️",
    description: "Fotografía arquitectónica y de interiores con perspectiva perfecta y luz natural",
    promptSuffix: "architectural photography, rectilinear perspective, natural golden hour light, interior design quality, clean lines, high dynamic range, 24mm tilt-shift lens",
    negativePrompt: "distorted perspective, fisheye, low quality, cluttered, amateur",
    recommendedModel: "flux-pro",
    examplePrompt: "Minimalist modern living room with floor-to-ceiling windows, architectural photography",
    tags: ["architecture", "interior", "real-estate", "design"],
  },
  {
    id: "nature",
    name: "Naturaleza & Paisaje",
    category: "Fotografía",
    emoji: "🌄",
    description: "Fotografía de naturaleza y paisajes épicos con luz mágica",
    promptSuffix: "landscape photography, golden hour or blue hour, dramatic sky, National Geographic quality, wide angle 16mm, long exposure, epic scale, natural beauty",
    negativePrompt: "urban, indoor, bad weather, low quality, dull colors, overcast",
    recommendedModel: "flux-pro",
    examplePrompt: "Mountain lake at sunrise with reflections, landscape photography, golden hour, epic",
    tags: ["nature", "landscape", "travel", "scenic"],
  },
  // TENDENCIAS / ESTILOS MODERNOS
  {
    id: "cyberpunk",
    name: "Cyberpunk / Neo-Noir",
    category: "Tendencias",
    emoji: "🌃",
    description: "Estética cyberpunk con neones, lluvia, megaciudades y tecnología oscura",
    promptSuffix: "cyberpunk aesthetic, neon lights, rain-slicked streets, night city, holographic ads, high-tech low-life, blade runner atmosphere, purple and cyan neons, 4K detailed",
    negativePrompt: "daytime, bright, rural, low quality, simple, happy",
    recommendedModel: "sdxl-juggernaut",
    examplePrompt: "Neon-lit marketplace in megacity under rain, cyberpunk, Blade Runner atmosphere",
    tags: ["cyberpunk", "neon", "futuristic", "noir"],
  },
  {
    id: "cottagecore",
    name: "Cottagecore / Fairytale",
    category: "Tendencias",
    emoji: "🌼",
    description: "Estética rural romántica con flores silvestres, cottages y vida campestre idealizad",
    promptSuffix: "cottagecore aesthetic, wildflowers, cozy cottage, warm afternoon light, linen and natural textures, handmade items, pastoral romanticism, soft golden tones",
    negativePrompt: "urban, modern, harsh, industrial, dark, low quality",
    recommendedModel: "flux-dev",
    examplePrompt: "Girl in floral dress picking herbs in cottage garden, cottagecore aesthetic, warm light",
    tags: ["cottagecore", "romantic", "nature", "cozy"],
  },
  {
    id: "brutalism",
    name: "Brutalismo / Raw",
    category: "Tendencias",
    emoji: "🏗️",
    description: "Diseño brutalista raw con texturas de hormigón, tipografía pesada y contraste extremo",
    promptSuffix: "brutalist design aesthetic, raw concrete textures, bold heavy typography, high contrast, utilitarian beauty, stark composition, architectural brutalism influence, monochromatic",
    negativePrompt: "soft, pastel, ornamental, low quality, cheerful, curved",
    recommendedModel: "flux-dev",
    examplePrompt: "Brutalist apartment block at dusk, raw concrete, heavy shadow, stark beauty",
    tags: ["brutalism", "architecture", "design", "urban"],
  },
  {
    id: "vaporwave",
    name: "Vaporwave / Synthwave",
    category: "Tendencias",
    emoji: "🌴",
    description: "Estética retro-futurista de los 80s con paleta rosa/púrpura, grids y nostalgias VHS",
    promptSuffix: "vaporwave aesthetic, synthwave palette, pink and purple neons, retro computer graphics, palm trees at sunset, VHS scan lines, glitch effects, A E S T H E T I C",
    negativePrompt: "modern realism, brown, dull colors, low quality, contemporary style",
    recommendedModel: "flux-dev",
    examplePrompt: "Retro convertible car on coastal highway at sunset, vaporwave, pink and purple neons",
    tags: ["vaporwave", "synthwave", "80s", "retro"],
  },
  {
    id: "minimalism",
    name: "Minimalismo Premium",
    category: "Tendencias",
    emoji: "⬜",
    description: "Composición minimalista ultra limpia estilo Apple o Braun con mucho espacio blanco",
    promptSuffix: "minimalist design, pure white or off-white background, perfect composition, generous negative space, single subject, clean lines, Apple product photography aesthetic, premium quality",
    negativePrompt: "cluttered, busy, complex, dark, low quality, many elements, colorful",
    recommendedModel: "flux-pro",
    examplePrompt: "Single ceramic mug on white surface, minimalist photography, perfect light",
    tags: ["minimalism", "apple", "clean", "product"],
  },
  {
    id: "glassmorphism",
    name: "Glassmorphism / Translúcido",
    category: "Tendencias",
    emoji: "🪟",
    description: "Efecto de vidrio translúcido con blur de fondo, bordes brillantes y profundidad",
    promptSuffix: "glassmorphism design, frosted glass effect, translucent surfaces, colorful background blur, white border glow, depth layers, modern UI aesthetic, vibrant background",
    negativePrompt: "opaque, flat, low quality, matte, dull, no depth",
    recommendedModel: "flux-dev",
    examplePrompt: "Glass card UI elements floating above purple gradient, glassmorphism, frosted glass",
    tags: ["glassmorphism", "ui", "design", "modern"],
  },
  // PUBLICIDAD & MARKETING
  {
    id: "ad-creative",
    name: "Anuncio Publicitario",
    category: "Publicidad",
    emoji: "📣",
    description: "Creativo publicitario listo para social media con composición que vende",
    promptSuffix: "advertising photography, commercial quality, compelling composition, product hero shot, brand-appropriate lighting, social media ready, high conversion design aesthetic",
    negativePrompt: "amateur, bad lighting, messy, unfocused, low quality, watermark",
    recommendedModel: "flux-ultra",
    examplePrompt: "Smartphone hero shot on gradient background, advertising photography, commercial quality",
    tags: ["advertising", "social-media", "commercial", "brand"],
  },
  {
    id: "shopify-product",
    name: "Producto Shopify/E-commerce",
    category: "Publicidad",
    emoji: "🛒",
    description: "Imagen de producto optimizada para tiendas online con fondo limpio y atractivo",
    promptSuffix: "e-commerce product shot, pure white or soft gradient background, professional lighting, no shadows or subtle shadow, multiple angles, Amazon or Shopify optimized, commercial quality",
    negativePrompt: "person, model, cluttered background, watermark, low quality, bad lighting",
    recommendedModel: "flux-pro",
    examplePrompt: "Running shoes floating on white background, e-commerce product shot, perfect lighting",
    tags: ["ecommerce", "shopify", "product", "amazon"],
  },
  {
    id: "social-media",
    name: "Social Media / UGC",
    category: "Publicidad",
    emoji: "📱",
    description: "Contenido auténtico estilo UGC para TikTok, Instagram y Reels",
    promptSuffix: "UGC content style, authentic and relatable, natural phone camera quality, warm home lighting, casual setting, user-generated content aesthetic, Instagram-worthy composition",
    negativePrompt: "professional studio, stock photo, fake, low quality, oversaturated",
    recommendedModel: "flux-dev",
    examplePrompt: "Person unboxing luxury skincare product at home, UGC style, authentic, warm light",
    tags: ["ugc", "tiktok", "instagram", "authentic"],
  },
  // PERSONAJES
  {
    id: "character-design",
    name: "Diseño de Personaje",
    category: "Personajes",
    emoji: "🦸",
    description: "Diseño de personaje para videojuegos, webtoon o branding con turnaround completo",
    promptSuffix: "character design sheet, front and 3/4 view, clean linework, appealing design, professional concept art, clear costume details, strong silhouette, industry standard quality",
    negativePrompt: "blurry, low quality, amateur, unclear details, ugly proportions",
    recommendedModel: "sdxl-juggernaut",
    examplePrompt: "Female warrior character design, fantasy armor, front view, character sheet, concept art",
    tags: ["character", "game", "design", "concept"],
  },
  {
    id: "avatar",
    name: "Avatar / Profile Picture",
    category: "Personajes",
    emoji: "👤",
    description: "Avatar personal ultra-realista o estilizado para LinkedIn, Discord o marca personal",
    promptSuffix: "professional profile photo, clean background, well-lit face, sharp eyes, confident expression, upper body composition, high resolution, LinkedIn or social media ready",
    negativePrompt: "full body, busy background, dark, blurry, distorted face, low quality",
    recommendedModel: "flux-ultra",
    examplePrompt: "Professional headshot of confident business person, clean light gray background",
    tags: ["avatar", "profile", "linkedin", "personal"],
  },
  {
    id: "mascot",
    name: "Mascota de Marca",
    category: "Personajes",
    emoji: "🐾",
    description: "Mascota animada para brand identity con personalidad clara y versatilidad",
    promptSuffix: "brand mascot character, cute and friendly design, clear personality, simple and memorable design, commercial quality, multiple expressions, white background, vector-ready aesthetic",
    negativePrompt: "scary, complex, ugly, low quality, photo, realistic",
    recommendedModel: "flux-dev",
    examplePrompt: "Friendly lion mascot for tech startup, brand character, cute, approachable, white bg",
    tags: ["mascot", "brand", "character", "logo"],
  },
  // ARQUITECTURA & ESPACIOS
  {
    id: "luxury-interior",
    name: "Interior de Lujo",
    category: "Espacios",
    emoji: "🏠",
    description: "Diseño de interiores de lujo estilo AD o Architectural Digest",
    promptSuffix: "luxury interior design, Architectural Digest quality, warm ambient lighting, high-end materials, marble, gold accents, Italian furniture, curated art, perfect staging",
    negativePrompt: "cheap, cluttered, bad taste, low quality, amateur, sterile",
    recommendedModel: "flux-pro",
    examplePrompt: "Penthouse living room with panoramic city view, luxury interior, marble and gold",
    tags: ["interior", "luxury", "real-estate", "design"],
  },
  // STICKERS & NFT
  {
    id: "sticker",
    name: "Sticker / Emoji",
    category: "Stickers",
    emoji: "😊",
    description: "Sticker digital con contorno bold, colores vibrantes y expresión exagerada",
    promptSuffix: "sticker design, bold black outline, vibrant saturated colors, white background, cute or funny expression, telegram sticker style, die-cut sticker aesthetic, commercial quality",
    negativePrompt: "no outline, complex background, realistic, low quality, dark colors",
    recommendedModel: "flux-dev",
    examplePrompt: "Happy golden retriever doing thumbs up, sticker design, bold outline, vibrant",
    tags: ["sticker", "emoji", "telegram", "cute"],
  },
  {
    id: "logo",
    name: "Logotipo / Ícono",
    category: "Branding",
    emoji: "⚡",
    description: "Logotipo limpio y memorable apto para vectorizar, sobre fondo blanco",
    promptSuffix: "professional logo design, minimal and memorable, single color or 2-color max, white background, vector-ready, scalable design, modern professional aesthetic, brand identity",
    negativePrompt: "complex, many colors, gradients, photo elements, low quality, unscalable",
    recommendedModel: "flux-dev",
    examplePrompt: "Minimalist mountain logo for outdoor brand, clean lines, single color, white background",
    tags: ["logo", "branding", "identity", "icon"],
  },
];

// ─── PROMPT FORMULA BLOCKS ──────────────────────────────────────────────────

export const PROMPT_BLOCKS = {
  subjects: [
    "portrait of a person", "luxury product on surface", "urban cityscape",
    "animal in natural habitat", "food dish", "sports action shot",
    "fashion model", "architectural interior", "abstract concept",
    "technology device", "vehicle", "fantasy creature",
  ],
  compositions: [
    "centered composition", "rule of thirds", "Dutch angle",
    "bird's-eye view overhead", "low angle looking up", "close-up macro",
    "wide establishing shot", "over-the-shoulder", "symmetrical composition",
    "leading lines", "frame within frame", "negative space emphasis",
  ],
  lighting: [
    "golden hour warm sunlight", "dramatic side lighting",
    "soft studio box light", "rim backlighting silhouette",
    "neon colored lights", "candlelight warm glow",
    "harsh high-noon sun", "blue hour twilight",
    "cinematic volumetric rays", "underwater diffused light",
    "single spotlight", "overcast soft diffused",
  ],
  moods: [
    "mysterious and atmospheric", "cheerful and energetic",
    "romantic and tender", "epic and powerful",
    "melancholic and nostalgic", "luxurious and refined",
    "playful and whimsical", "dark and threatening",
    "serene and peaceful", "urgent and dynamic",
    "dreamy and ethereal", "raw and authentic",
  ],
  qualityModifiers: [
    "8K resolution, ultra-detailed, masterpiece",
    "trending on Artstation, professional quality",
    "award-winning photography, National Geographic",
    "Unreal Engine 5, photorealistic render",
    "shot on Hasselblad, medium format",
    "highly detailed, sharp focus, high dynamic range",
  ],
  negativeStandard: "low quality, blurry, watermark, text, logo, distorted, ugly, amateur, nsfw, bad anatomy, poorly drawn",
};

// ─── MODEL CATALOG ────────────────────────────────────────────────────────────

export const MODEL_CATALOG: ModelOption[] = [
  { id: "flux-ultra",     name: "FLUX Ultra",          provider: "Replicate",  type: "image", strengths: ["fotorrealismo extremo", "detalles de piel", "texto en imagen"], bestFor: ["retratos", "productos", "fashion"],     quality: "ultra",    speed: "slow"   },
  { id: "flux-pro",       name: "FLUX Pro",             provider: "Replicate",  type: "image", strengths: ["alta fidelidad", "coherencia de imagen", "colores ricos"],     bestFor: ["editorial", "comercial", "publicidad"], quality: "premium", speed: "medium" },
  { id: "flux-kontext",   name: "FLUX Kontext",         provider: "Replicate",  type: "image", strengths: ["edición contextual", "cambios precisos", "preserva sujeto"],   bestFor: ["edición", "inpainting", "variaciones"], quality: "premium", speed: "medium" },
  { id: "flux-dev",       name: "FLUX Dev",             provider: "Replicate",  type: "image", strengths: ["versatilidad", "estilos artísticos", "personalizable"],        bestFor: ["arte digital", "ilustración", "creative"], quality: "standard", speed: "fast" },
  { id: "ideogram-v3",    name: "Ideogram V3",          provider: "Replicate",  type: "image", strengths: ["texto perfecto en imagen", "logos", "tipografía"],              bestFor: ["logos", "carteles", "diseño"],           quality: "premium", speed: "medium" },
  { id: "recraft-v3",     name: "Recraft V3",           provider: "Replicate",  type: "image", strengths: ["diseño vectorial", "branding", "consistencia"],                bestFor: ["vector", "iconos", "branding"],          quality: "premium", speed: "medium" },
  { id: "gpt-image",      name: "GPT Image 1 (DALL·E)", provider: "OpenAI",    type: "image", strengths: ["creatividad", "conceptos abstractos", "instrucciones complejas"], bestFor: ["conceptual", "arte", "diversidad"],    quality: "premium", speed: "medium" },
  { id: "imagen4",        name: "Imagen 4 (Google)",    provider: "Google",    type: "image", strengths: ["realismo", "diversidad", "composición natural"],                 bestFor: ["lifestyle", "personas", "escenas"],     quality: "ultra",   speed: "slow"   },
  { id: "sdxl-juggernaut",name: "SDXL Juggernaut XL",  provider: "Replicate",  type: "image", strengths: ["realismo humano", "fantasy", "concept art"],                   bestFor: ["personas", "fantasy", "game art"],      quality: "standard", speed: "fast"  },
  { id: "sdxl-animagine", name: "Animagine XL (Anime)", provider: "Replicate", type: "image", strengths: ["anime premium", "personajes", "fondos"],                       bestFor: ["anime", "manga", "ilustración"],        quality: "standard", speed: "fast"  },
  { id: "kling-2",        name: "Kling 2.1",            provider: "Kling",     type: "video", strengths: ["movimiento natural", "larga duración", "coherencia"],           bestFor: ["reels", "publicidad", "lifestyle"],     quality: "premium", speed: "medium" },
  { id: "seedance",       name: "Seedance 1.5 Pro",     provider: "ByteDance", type: "video", strengths: ["calidad cinematográfica", "cámara profesional", "detalle"],     bestFor: ["cinematic", "product", "fashion"],      quality: "ultra",   speed: "slow"   },
  { id: "veo3",           name: "Veo 3 (Google)",       provider: "Google",    type: "video", strengths: ["realismo físico", "movimiento fluido", "iluminación"],          bestFor: ["naturaleza", "acción", "lifestyle"],    quality: "ultra",   speed: "slow"   },
  { id: "hailuo-2",       name: "Hailuo 2.3",           provider: "MiniMax",   type: "video", strengths: ["rapidez", "expresiones faciales", "talking heads"],             bestFor: ["avatares", "personajes", "diálogos"],   quality: "premium", speed: "fast"   },
  { id: "runway-gen4",    name: "Runway Gen-4",          provider: "Runway",    type: "video", strengths: ["control de cámara", "edición", "inpainting video"],             bestFor: ["edición", "vfx", "cámara controlada"],  quality: "premium", speed: "medium" },
];

// ─── PROMPT TEMPLATES LIBRARY (100+) ─────────────────────────────────────────

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  // PRODUCTOS & E-COMMERCE
  { id: "prod-001", name: "Producto Flotante", category: "Producto", prompt: "{{product}} floating on a minimalist gradient background, professional product photography, studio lighting, no shadows, pure colors, commercial quality, 8K", variables: ["product"], tags: ["ecommerce", "shopify", "clean"] },
  { id: "prod-002", name: "Producto en Manos", category: "Producto", prompt: "Close-up of hands holding {{product}}, lifestyle product photography, natural light, shallow depth of field, warm tones, authentic feel", variables: ["product"], tags: ["lifestyle", "ugc", "authentic"] },
  { id: "prod-003", name: "Flat Lay Artístico", category: "Producto", prompt: "Top-down flat lay of {{product}} with {{props}}, styled arrangement, soft natural light, trendy color palette, Instagram aesthetic, commercial photography", variables: ["product", "props"], tags: ["flatlay", "instagram", "style"] },
  { id: "prod-004", name: "Producto de Lujo", category: "Producto", prompt: "{{product}} on {{surface}}, ultra-luxury brand photography, dramatic Rembrandt lighting, dark moody background, fine jewelry or high-end advertising quality, Hasselblad medium format", variables: ["product", "surface"], tags: ["luxury", "premium", "brand"] },
  { id: "prod-005", name: "Detalle Macro", category: "Producto", prompt: "Extreme macro close-up of {{product}} showing {{detail}}, 100mm macro lens, f/2.8, razor-sharp focus, bokeh background, texture detail visible, commercial quality", variables: ["product", "detail"], tags: ["macro", "detail", "quality"] },
  // MODA & FASHION
  { id: "fash-001", name: "Editorial de Moda", category: "Moda", prompt: "Fashion editorial photo of a model wearing {{clothing}}, {{location}}, high contrast dramatic lighting, Vogue magazine quality, strong pose, high fashion aesthetic", variables: ["clothing", "location"], tags: ["fashion", "editorial", "vogue"] },
  { id: "fash-002", name: "Street Style", category: "Moda", prompt: "Street style photo of stylish person wearing {{outfit}}, urban background, natural candid light, fashion blogger aesthetic, Instagram-worthy composition", variables: ["outfit"], tags: ["street", "casual", "instagram"] },
  { id: "fash-003", name: "Campaña de Moda", category: "Moda", prompt: "Fashion campaign hero image, model in {{garment}} against {{background}}, cinematic quality, aspirational lifestyle, luxury brand feeling, award-winning photography", variables: ["garment", "background"], tags: ["campaign", "luxury", "brand"] },
  // GASTRONOMÍA
  { id: "food-001", name: "Hero Shot Gourmet", category: "Gastronomía", prompt: "Professional food photography of {{dish}}, 45-degree angle, natural side window light, shallow depth of field, restaurant quality plating, fresh and appetizing", variables: ["dish"], tags: ["food", "restaurant", "culinary"] },
  { id: "food-002", name: "Flat Lay Foodie", category: "Gastronomía", prompt: "Overhead flat lay food photography of {{dish}} with {{accompaniments}}, marble or wooden surface, styled with herbs and ingredients, natural daylight, Instagram food aesthetic", variables: ["dish", "accompaniments"], tags: ["flatlay", "instagram", "food"] },
  { id: "food-003", name: "Ambiente Restaurante", category: "Gastronomía", prompt: "{{dish}} being served in elegant restaurant, candlelight ambiance, bokeh background with diners, high-end dining atmosphere, food and travel magazine quality", variables: ["dish"], tags: ["restaurant", "ambient", "upscale"] },
  // RETRATOS
  { id: "port-001", name: "Retrato Profesional", category: "Retratos", prompt: "Professional corporate headshot of {{person}}, clean background, Rembrandt lighting, confident expression, business attire, LinkedIn-ready, sharp eyes, professional quality", variables: ["person"], tags: ["portrait", "professional", "linkedin"] },
  { id: "port-002", name: "Retrato Artístico", category: "Retratos", prompt: "Artistic portrait of {{person}}, dramatic chiaroscuro lighting, emotional expression, fine art photography, textured background, museum quality", variables: ["person"], tags: ["portrait", "art", "drama"] },
  { id: "port-003", name: "Retrato Lifestyle", category: "Retratos", prompt: "Candid lifestyle portrait of {{person}} {{action}}, natural golden hour light, authentic moment captured, warm tones, magazine quality", variables: ["person", "action"], tags: ["lifestyle", "authentic", "candid"] },
  // ARQUITECTURA
  { id: "arch-001", name: "Exterior Arquitectónico", category: "Arquitectura", prompt: "Architectural photography of {{building}}, golden hour light, perfect rectilinear perspective, tilt-shift lens simulation, dramatic sky, high dynamic range", variables: ["building"], tags: ["architecture", "exterior", "real-estate"] },
  { id: "arch-002", name: "Interior Premium", category: "Arquitectura", prompt: "Interior design photography of {{room}}, Architectural Digest quality, warm ambient lighting, high-end materials, perfect staging, wide angle 24mm", variables: ["room"], tags: ["interior", "design", "luxury"] },
  { id: "arch-003", name: "Visualización 3D", category: "Arquitectura", prompt: "Photorealistic 3D architectural rendering of {{space}}, ray-traced lighting, human scale, professional visualization, development or real estate quality", variables: ["space"], tags: ["3d", "render", "real-estate"] },
  // ARTE & CREATIVIDAD
  { id: "art-001", name: "Portada de Álbum", category: "Arte", prompt: "Album cover artwork for {{genre}} music, {{mood}} atmosphere, striking visual concept, typography-ready composition, professional graphic design quality", variables: ["genre", "mood"], tags: ["music", "album", "art"] },
  { id: "art-002", name: "Póster de Película", category: "Arte", prompt: "Movie poster design for a {{genre}} film, {{protagonist}} as main character, dramatic composition, cinematic lighting, Hollywood blockbuster aesthetic, bold typography space", variables: ["genre", "protagonist"], tags: ["movie", "poster", "film"] },
  { id: "art-003", name: "Ilustración de Marca", category: "Arte", prompt: "Brand illustration for {{company}} in {{industry}}, {{style}} art style, professional commercial quality, brand-aligned color palette, scalable design", variables: ["company", "industry", "style"], tags: ["brand", "illustration", "commercial"] },
  // VIDEO & MOTION
  { id: "vid-001", name: "Thumbnail de YouTube", category: "Video", prompt: "YouTube thumbnail for video about {{topic}}, high contrast, bold colors, shocked or excited face expression (if person), clear focal point, click-worthy composition, text space included", variables: ["topic"], tags: ["youtube", "thumbnail", "social"] },
  { id: "vid-002", name: "Storyboard de Anuncio", category: "Video", prompt: "Advertising storyboard frame showing {{scene}}, commercial quality, storytelling composition, brand-appropriate aesthetic, motion-ready framing", variables: ["scene"], tags: ["advertising", "storyboard", "commercial"] },
  // PERSONAJES
  { id: "char-001", name: "Héroe Fantástico", category: "Personajes", prompt: "Epic fantasy hero character: {{character description}}, full armor detail, dynamic combat pose, dramatic backlighting, concept art quality, Artstation trending", variables: ["character description"], tags: ["fantasy", "hero", "game"] },
  { id: "char-002", name: "Mascota Corporativa", category: "Personajes", prompt: "Friendly and approachable brand mascot character for {{brand type}}, {{personality}} personality, clean white background, professional commercial design, multiple angles visible", variables: ["brand type", "personality"], tags: ["mascot", "brand", "corporate"] },
  { id: "char-003", name: "Personaje Anime", category: "Personajes", prompt: "Anime character design of {{description}}, detailed costume, expressive eyes, studio-quality cel shading, clean linework, character sheet with front and 3/4 view", variables: ["description"], tags: ["anime", "character", "manga"] },
  // PATRONES & TEXTURAS
  { id: "text-001", name: "Patrón Seamless", category: "Texturas", prompt: "Seamless repeating pattern featuring {{motif}}, {{style}} artistic style, perfect tiling, commercial textile or surface design quality, high resolution", variables: ["motif", "style"], tags: ["pattern", "textile", "design"] },
  { id: "text-002", name: "Textura Material", category: "Texturas", prompt: "Macro material texture of {{material}}, extreme detail, 8K resolution, flat even lighting, PBR texture photography, game or design asset quality", variables: ["material"], tags: ["texture", "material", "3d"] },
  // ABSTRACT
  { id: "abs-001", name: "Fondo Abstracto", category: "Abstracto", prompt: "Abstract background with {{color palette}} color palette, {{mood}} feeling, fluid dynamics or geometric patterns, premium quality, suitable for presentation or website hero section", variables: ["color palette", "mood"], tags: ["abstract", "background", "design"] },
  { id: "abs-002", name: "Arte Generativo", category: "Abstracto", prompt: "Generative art piece with {{theme}} theme, data visualization aesthetic, mathematical beauty, programming art style, gallery-worthy composition", variables: ["theme"], tags: ["generative", "abstract", "art"] },
];

// ─── PROMPT BOOK (técnicas de ingeniería de prompts) ─────────────────────────

export const PROMPT_BOOK_CHAPTERS = [
  {
    id: "formula",
    title: "La Fórmula Maestra OpenArt",
    icon: "🧪",
    content: `La fórmula estándar para prompts profesionales tiene 6 bloques en este orden:

**[SUJETO] + [ESTILO] + [COMPOSICIÓN] + [ILUMINACIÓN] + [ESTADO DE ÁNIMO] + [CALIDAD]**

Después, añade siempre: **| Negative prompt: [NEGATIVOS]**

### Ejemplo práctico:
> "Luxury Swiss watch with diamond bezel [SUJETO] professional product photography, studio lighting [ESTILO] centered symmetrical composition [COMPOSICIÓN] single dramatic spotlight with rim light [ILUMINACIÓN] refined and luxurious [ÁNIMO] 8K, ultra-detailed, masterpiece, Hasselblad [CALIDAD] | Negative: blurry, watermark, low quality, ugly"

**Regla de oro:** 30-75 palabras es el rango ideal. Más largo no siempre es mejor.`,
  },
  {
    id: "modifiers",
    title: "Modificadores de Calidad Esenciales",
    icon: "⭐",
    content: `Estos modificadores al final del prompt aumentan dramáticamente la calidad:

### Para Fotografía:
- **8K resolution, RAW photo** — resolución máxima
- **shot on Hasselblad / Leica** — cámara premium de referencia
- **f/1.4, bokeh, shallow DOF** — desenfoque profesional
- **award-winning photography** — referencia de calidad editorial

### Para Arte Digital:
- **trending on Artstation** — calidad de concept artist profesional
- **masterpiece, highly detailed** — standard de calidad
- **Unreal Engine 5 render** — render de videojuego de última generación
- **matte painting quality** — VFX cinematográfico

### Para IA en General:
- **intricate details, sharp focus** — nitidez máxima
- **professional quality, commercial use** — nivel publicitario
- **cinematic, film grain** — estética de película`,
  },
  {
    id: "lighting",
    title: "Domina la Iluminación",
    icon: "💡",
    content: `La iluminación es el factor más importante en fotografía e imagen. Aquí los tipos clave:

### Tipos de Luz:
- **Golden hour** — luz solar cálida 1h después del amanecer/antes del atardecer. Piel perfecta.
- **Rembrandt lighting** — triángulo de luz bajo un ojo. Dramático y clásico.
- **Split lighting** — mitad cara iluminada, mitad oscura. Muy dramático.
- **Butterfly lighting** — luz frontal-alta. Glamour y moda.
- **Rim/backlight** — luz por detrás. Silueta y separación del fondo.
- **Volumetric/God rays** — rayos de luz visibles en niebla o humo.

### Para Productos:
- **3-point studio lighting** — estándar profesional
- **single dramatic spotlight** — tensión y drama
- **soft box light** — difuso, sin sombras duras
- **ring light** — catchlights en ojos, skin suave`,
  },
  {
    id: "composition",
    title: "Reglas de Composición",
    icon: "📐",
    content: `La composición determina dónde mira el ojo. Usa estos términos:

### Reglas Clásicas:
- **rule of thirds** — sujeto en los tercios de la imagen
- **golden ratio/spiral** — composición espiral natural
- **centered/symmetrical** — impacto frontal y equilibrio
- **leading lines** — líneas que guían al sujeto principal

### Perspectivas:
- **bird's eye view** — desde arriba completamente
- **overhead/flat lay** — cenital a 90°
- **worm's eye view / low angle** — desde el suelo hacia arriba (poderoso)
- **eye-level** — perspectiva humana natural
- **Dutch angle** — cámara inclinada 15-45°

### Encuadres:
- **close-up/macro** — detalle extremo
- **medium shot** — torso arriba
- **establishing wide shot** — contexto y entorno
- **over-the-shoulder** — punto de vista narrativo`,
  },
  {
    id: "styles",
    title: "Estilos Artísticos y Referencias",
    icon: "🎨",
    content: `Cita artistas y referencias específicas para guiar el estilo:

### Fotógrafos de Referencia:
- **Annie Leibovitz** — retratos dramáticos y celebrity
- **Richard Avedon** — moda en blanco y negro, expresivo
- **Peter Lindbergh** — moda en B&W, crudo y real
- **David LaChapelle** — hiperrealismo saturado y pop

### Artistas Digitales:
- **Greg Rutkowski** — fantasy épico en Artstation
- **Artgerm** — personajes femeninos detallados
- **Wlop** — fantasía con luz etérea

### Directores de Cine:
- **Roger Deakins** — cinematografía Blade Runner 2049
- **Emmanuel Lubezki** — luz natural, Revenant
- **Gordon Willis** — chiaroscuro, El Padrino

### Estilos por Época:
- **Renaissance** — maestros italianos, composición perfecta
- **Baroque** — tenebrismo, drama, Caravaggio
- **Art Deco** — geometría y glamour de los años 20
- **Brutalism** — hormigón y funcionalismo crudo`,
  },
  {
    id: "negative",
    title: "Negative Prompts Efectivos",
    icon: "🚫",
    content: `Los negative prompts le dicen a la IA qué EVITAR. Son esenciales para calidad:

### Negative Universal (siempre añadir):
\`\`\`
low quality, blurry, watermark, text, logo, distorted, deformed, ugly, amateur, bad anatomy, poorly drawn hands, nsfw
\`\`\`

### Para Fotografía Realista (añadir además):
\`\`\`
illustration, cartoon, painting, anime, render, CGI, artificial, oversaturated, grain noise
\`\`\`

### Para Arte / Ilustración (añadir además):
\`\`\`
photorealistic, photograph, photo, stock photo
\`\`\`

### Para Personas (añadir además):
\`\`\`
extra limbs, missing fingers, fused fingers, too many fingers, mutated hands, deformed face, asymmetrical eyes
\`\`\`

### Para Productos (añadir además):
\`\`\`
person, model, cluttered background, props, reflections on surface, scratches, dust
\`\`\``,
  },
  {
    id: "advanced",
    title: "Técnicas Avanzadas",
    icon: "🔬",
    content: `Técnicas profesionales para resultados de nivel superior:

### Image-to-Image (I2I):
- Usa una imagen de referencia con **strength 0.3-0.5** para mantener composición
- Con **strength 0.7-0.9** para transformaciones dramáticas
- Combina con **inpainting** para cambios específicos

### Consistencia de Personaje:
- Describe el personaje en detalle la primera vez
- Usa exactamente las mismas palabras descriptivas en cada prompt
- Añade: *"same character as before, consistent design"*
- Usa ControlNet con la pose/depth map de referencia

### Control de Aspect Ratio por Plataforma:
- **1:1** (1024×1024) — Instagram posts, producto
- **4:5** (1080×1350) — Instagram portrait, más alcance
- **9:16** (1080×1920) — Stories, Reels, TikTok
- **16:9** (1920×1080) — YouTube, LinkedIn, desktop
- **2:3** (800×1200) — Pinterest, libros, posters

### Seed Consistency:
- Usa el mismo seed number para variaciones del mismo personaje
- Cambia solo el prompt manteniendo el seed para explorar variantes`,
  },
  {
    id: "ecommerce",
    title: "Prompts para E-Commerce Shopify",
    icon: "🛒",
    content: `Prompts específicos optimizados para convertir en tiendas online:

### Hero Image de Producto:
\`\`\`
[PRODUCTO] floating on pure white seamless background, centered composition, professional studio lighting with soft shadows, commercial photography quality, 8K resolution, e-commerce ready, Amazon/Shopify optimized
Negative: person, model, background elements, watermark, harsh shadows, low quality
\`\`\`

### Lifestyle de Producto:
\`\`\`
[PERSONA IDEAL] using/wearing/holding [PRODUCTO] in [AMBIENTE IDEAL], natural lifestyle photography, warm authentic lighting, shallow depth of field, relatable and aspirational, UGC authentic quality
\`\`\`

### Colección / Grupo:
\`\`\`
Flat lay arrangement of [PRODUCTOS], [SUPERFICIE], styled with complementary accessories, overhead shot, natural diffused light, editorial styling, clean and balanced composition
\`\`\`

### Detail/Feature Shot:
\`\`\`
Extreme close-up macro of [CARACTERÍSTICA] of [PRODUCTO], showcasing [TEXTURA/DETALLE], 100mm macro lens, perfect focus, bokeh background, technical photography quality
\`\`\``,
  },
];

// ─── HELPER: Build full prompt from blocks ────────────────────────────────────

export function buildStructuredPrompt(
  subject: string,
  styleId: string | null,
  composition: string,
  lighting: string,
  mood: string,
  qualityTier: "standard" | "premium" | "ultra" = "premium",
  customSuffix?: string,
): PromptBlockResult {
  const preset = styleId ? STYLE_PRESETS.find(s => s.id === styleId) : null;

  const qualityMap: Record<string, string> = {
    standard: "highly detailed, sharp focus, professional quality",
    premium: "8K resolution, masterpiece, professional photography, award-winning",
    ultra: "8K resolution, ultra-detailed, masterpiece, trending on Artstation, cinematic quality, hyper-realistic",
  };

  const stylePart = preset ? preset.promptSuffix : (customSuffix || "professional photography, commercial quality");
  const negativePart = preset ? preset.negativePrompt : PROMPT_BLOCKS.negativeStandard;
  const quality = qualityMap[qualityTier];

  const parts = [subject, stylePart, composition, lighting, mood, quality].filter(Boolean);
  const full = parts.join(", ");

  return {
    subject,
    style: stylePart,
    composition,
    lighting,
    mood,
    qualityModifiers: quality,
    negative: negativePart,
    full,
    stylePreset: preset || undefined,
  };
}

export function getStylesByCategory(): Record<string, StylePreset[]> {
  const map: Record<string, StylePreset[]> = {};
  for (const s of STYLE_PRESETS) {
    if (!map[s.category]) map[s.category] = [];
    map[s.category].push(s);
  }
  return map;
}

export function getTemplatesByCategory(): Record<string, PromptTemplate[]> {
  const map: Record<string, PromptTemplate[]> = {};
  for (const t of PROMPT_TEMPLATES) {
    if (!map[t.category]) map[t.category] = [];
    map[t.category].push(t);
  }
  return map;
}

export function recommendModels(task: "image" | "video", styleId?: string, useCase?: string): ModelOption[] {
  const preset = styleId ? STYLE_PRESETS.find(s => s.id === styleId) : null;
  const models = MODEL_CATALOG.filter(m => m.type === task || m.type === "both");
  if (!preset && !useCase) return models;
  const preferred = preset?.recommendedModel;
  return models.sort((a, b) => {
    if (a.id === preferred) return -1;
    if (b.id === preferred) return 1;
    if (a.quality === "ultra") return -1;
    if (b.quality === "ultra") return 1;
    return 0;
  });
}
