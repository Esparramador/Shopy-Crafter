/**
 * Demos de diseño web publicadas en /web-demos (archivos reales en public/web-demos).
 * Nombres y descripciones propios: sin marcas de terceros.
 */
export interface WebDemo {
  file: string;
  title: string;
  description: string;
  tags: string[];
}

export const WEB_DEMOS: WebDemo[] = [
  { file: "01-particle-saas.html", title: "Hero de partículas para SaaS", description: "Portada con sistema de partículas interactivo para un producto de software.", tags: ["Canvas", "Partículas"] },
  { file: "02-cinematic-agency.html", title: "Web cinematográfica de agencia", description: "Narrativa a pantalla completa con transiciones de estilo cine.", tags: ["GSAP", "Scroll"] },
  { file: "03-glass-product-3d.html", title: "Producto 3D en cristal", description: "Presentación de producto con material de vidrio y luz en tiempo real.", tags: ["Three.js", "3D"] },
  { file: "04-disassembly-scroll.html", title: "Desmontaje con scroll", description: "El producto se despieza a medida que el usuario hace scroll.", tags: ["3D", "ScrollTrigger"] },
  { file: "05-21stdev-effects.html", title: "Colección de efectos UI", description: "Botones, tarjetas y fondos animados listos para producción.", tags: ["UI", "CSS"] },
  { file: "06-shaders-particles.html", title: "Shaders y partículas", description: "Fondos generativos con shaders GLSL.", tags: ["WebGL", "Shaders"] },
  { file: "07-landing-sections.html", title: "Secciones de landing", description: "Biblioteca de secciones para páginas de venta.", tags: ["Landing", "Componentes"] },
  { file: "08-micro-interactions.html", title: "Micro-interacciones", description: "Detalles de interacción que mejoran la experiencia en cada clic.", tags: ["UX", "Animación"] },
  { file: "09-video-image-effects.html", title: "Efectos de vídeo e imagen", description: "Máscaras, revelados y distorsiones sobre medios.", tags: ["Vídeo", "Efectos"] },
  { file: "10-3d-product-viewer.html", title: "Visor 3D de producto", description: "Rotación, zoom y cambio de variantes de un modelo 3D.", tags: ["Three.js", "eCommerce"] },
  { file: "11-immersive-scroll-lenis.html", title: "Scroll inmersivo", description: "Scroll suave con escenas 3D sincronizadas.", tags: ["Lenis", "GSAP", "Three.js"] },
  { file: "12-explode-view-glb.html", title: "Vista explosionada", description: "Arquitectura interna de un objeto separada por piezas.", tags: ["GLB", "3D"] },
  { file: "13-scroll-media-expansion.html", title: "Expansión de medios con scroll", description: "Imágenes y vídeos que crecen hasta ocupar la pantalla.", tags: ["Scroll", "Vídeo"] },
  { file: "14-3d-globe-world.html", title: "Globo terráqueo 3D", description: "Mapa mundial interactivo en 3D.", tags: ["Three.js", "Datos"] },
  { file: "15-ui-premium-components.html", title: "Componentes UI premium", description: "Tarjetas, pestañas y navegación de alto nivel visual.", tags: ["UI", "Componentes"] },
  { file: "16-spline-hero-fluid.html", title: "Hero 3D con fluidos", description: "Escena 3D con simulación de fluido en la portada.", tags: ["3D", "Fluidos"] },
  { file: "17-morphing-text-particles.html", title: "Texto que se transforma", description: "Tipografía hecha de partículas que cambia de forma.", tags: ["Tipografía", "Partículas"] },
  { file: "18-3d-scroll-narrative.html", title: "Narrativa 3D con scroll", description: "Historia contada con cámara 3D que avanza con el scroll.", tags: ["Three.js", "Storytelling"] },
  { file: "19-gradient-mesh-backgrounds.html", title: "Fondos de degradado animado", description: "Mallas de color animadas como fondo de marca.", tags: ["CSS", "WebGL"] },
  { file: "20-magnetic-cursor-effects.html", title: "Cursor magnético", description: "Elementos que atraen el cursor y reaccionan al movimiento.", tags: ["Interacción", "Animación"] },
  { file: "21-data-visualization.html", title: "Visualización de datos", description: "Gráficos animados para cuadros de mando y memorias.", tags: ["Datos", "SVG"] },
  { file: "22-3d-carousel-gallery.html", title: "Galería en carrusel 3D", description: "Galería de imágenes con profundidad y perspectiva.", tags: ["3D", "Galería"] },
  { file: "23-page-transitions.html", title: "Transiciones de página", description: "Cambios de página y pantallas de carga animadas.", tags: ["Transiciones", "UX"] },
  { file: "24-infinite-scroll-feed.html", title: "Feed con scroll infinito", description: "Patrones de listado para catálogos y contenidos.", tags: ["Feed", "UX"] },
  { file: "25-hero-sections.html", title: "Colección de heroes", description: "Portadas de alto impacto para distintos sectores.", tags: ["Hero", "Landing"] },
  { file: "26-bento-grids.html", title: "Bento grids", description: "Rejillas modulares para presentar producto y servicios.", tags: ["Layout", "UI"] },
  { file: "27-suburbia-r3f-tricks.html", title: "Física y parallax con React Three Fiber", description: "Escena 3D con física, parallax y objetos interactivos.", tags: ["R3F", "Física"] },
  { file: "28-noova-bento-tilt.html", title: "Bento con inclinación y vídeo", description: "Tarjetas con efecto tilt, palabras animadas y hero de vídeo.", tags: ["Bento", "Vídeo"] },
  { file: "29-medical-canvas2d-counters.html", title: "Web sanitaria con contadores", description: "Canvas 2D, contadores animados y glassmorphism para el sector salud.", tags: ["Canvas", "Salud"] },
  { file: "30-ferrari-glb-lerp-snap.html", title: "Automóvil 3D con scroll por fases", description: "Modelo 3D de coche con cámara interpolada y doble canvas.", tags: ["GLB", "3D", "Motor"] },
];
