# 3D Web Effects — Skill Library

## Qué hace este skill
Genera efectos 3D y animaciones web premium adaptables a cualquier producto, cliente, sector o empresa. Basado en análisis profundo de 8 repos GitHub reales:
- **Batch 1**: ThreeJS_Animation_Scroll, game-website (sanidhyy), Nimbus-Keyboard-3D, starbucks-3d-animated-site
- **Batch 2**: blesten/3d-landing-page (Suburbia Skate), Ankit-Sharma1011/game-website (Noova), AmirBayat0/3D-Template-Landing-Page (Medical), Meettomb/LaFerrari-3D-Animated-Website

Todos los templates están guardados en el master-prompt-library.json bajo la clave `3d_web_effects` (28 templates ejecutables). Se pueden ejecutar vía POST /api/prompt-library/execute o directamente a través del PromptLibrary.tsx en Shopy Crafter.

## Los 5 Patrones Fundamentales (extraídos de repos reales)

### PATRÓN 1: Canvas Sequence Scroll (Apple/Starbucks style)
**Repo**: Ayush08k/starbucks-3d-animated-site | **Template ID**: `3d_effect_01_canvas_sequence_hero`
- NO usa WebGL — solo 2D `<canvas>` con `ctx.drawImage()`
- Exportar producto como 90 frames PNG (rotación, reveal, etc.)
- Hook `useCanvasSequence`: precarga keyframes → scroll → `frameIndex = Math.round(progress * (frameCount - 1))`
- Stack: Next.js 15 + framer-motion ^12 + lenis ^1.3.17

```typescript
// Patrón clave:
const progress = -rect.top / (container.offsetHeight - window.innerHeight);
const frameIndex = Math.round(clamp(progress, 0, 1) * (frameCount - 1));
ctx.drawImage(images[frameIndex], drawX, drawY, drawW, drawH);
```

### PATRÓN 2: GLB Scroll Storytelling (Three.js puro)
**Repo**: SRCarlo/ThreeJS_Animation_Scroll | **Template ID**: `3d_effect_02_glb_scroll_storytelling`
- Vanilla JS — sin React, sin framework
- Define array `arrPositionModel`: `{id, position: {x,y,z}, rotation: {x,y,z}}` por sección
- En scroll: detectar sección activa → `gsap.to(model.position, { ...coords, duration: 3, ease: "power1.out" })`
- FOV: 10 (muy bajo = "telephoto look"). Camera.z = 13

```javascript
// Patrón clave:
const arrPositionModel = [
  { id: 'banner', position: { x: 0, y: -1, z: 0 }, rotation: { x: 0, y: 1.5, z: 0 } },
  { id: 'intro',  position: { x: 1, y: -1, z: -5 }, rotation: { x: 0.5, y: -0.5, z: 0 } },
];
// On scroll: gsap.to(model.position, { ...coords.position, duration: 3, ease: "power1.out" })
```

### PATRÓN 3: Video Clip-Path Hero (GSAP)
**Repo**: sanidhyy/game-website | **Template ID**: `3d_effect_03_video_clip_path_hero`
- NO Three.js — GSAP clip-path polygon transforms
- `clipPath: "polygon(14% 0%, 72% 0%, 90% 90%, 0% 100%)"` → normaliza en scroll
- Mini-video (64x64) que escala a pantalla completa al click
- Stack: React + Vite + @gsap/react ^2.1.2 + ScrollTrigger

```typescript
// Patrón clave:
gsap.set("#video-frame", { clipPath: "polygon(14% 0%, 72% 0%, 90% 90%, 0% 100%)", borderRadius: "0 0 40% 10%" });
gsap.from("#video-frame", { clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)", scrollTrigger: { scrub: true } });
// Mini-video explota a fullscreen:
gsap.to("#next-video", { scale: 1, width: "100%", height: "100%", duration: 1, ease: "power1.inOut" });
```

### PATRÓN 4: React Three Fiber Product Showcase
**Repo**: Itssanthoshhere/Nimbus-Keyboard-3D | **Template ID**: `3d_effect_04_r3f_product_showcase`
- @react-three/fiber ^9.3.0 + @react-three/drei ^10 + three ^0.180.0
- GLB con nodes tipados (`npx @react-three/gltf@latest transform model.glb`)
- `MeshStandardMaterial` con `color`, `roughness`, `metalness` dinámicos por color seleccionado
- `PresentationControls + Float` de drei para interactividad suave sin OrbitControls

```typescript
// Patrón clave para material dinámico:
const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({
  color: new THREE.Color(selectedColor),
  roughness: materialType === "metal" ? 0.2 : 0.5,
  metalness: materialType === "metal" ? 0.9 : 0.1,
}), [selectedColor, materialType]);
```

## Los 4 Nuevos Patrones — Batch 2 (blesten, Ankit, AmirBayat0, Meettomb)

### PATRÓN 6: R3F Interactive Product with GSAP Tricks (Suburbia Skate)
**Repo**: blesten/3d-landing-page | **Templates**: `3d_effect_13`, `3d_effect_14`, `3d_effect_15`, `3d_effect_16`
- `InteractiveSkateboard.tsx`: R3F Canvas + 3 invisible click meshes (`visible={false}`) + GSAP timeline tricks
- Tricks exactos: ollie (tilt X), kickflip (tilt X + rotate Z `+= π*2`), frontside360 (tilt X + rotate Y `+= π*2`)
- Float idle: `gsap.to(position, { x:.2, repeat:-1, yoyo:true, ease:'sine.inOut' })` simultáneo con rotation
- Camera zoom responsive: `scale = Math.max(Math.min(1000/window.innerWidth, 2.2), 1)`
- `FooterPhysics.tsx`: matter-js con sprite textures, chamfer radius:40, restitution:0.8, MouseConstraint
- `ParallaxImage.tsx`: 2-layer parallax con lerp 0.1 via rAF, foreground 2.5x más rápido que background
- `SlideIn.tsx`: IntersectionObserver rootMargin:'-150px', CSS keyframe `animation: slide-in ${duration}s`

```typescript
// GSAP kickflip trick (copiar exacto):
function kickflip(board: THREE.Group) {
  jumpBoard(board)  // y: 0→.8→0 con power2 easing
  gsap.timeline()
    .to(board.rotation, { x: -.6, duration:.26, ease:'none' })
    .to(board.rotation, { x: .4, duration:.82, ease:'power2.in' })
    .to(board.rotation, { z: `+=${Math.PI*2}`, duration:.78, ease:'none' }, .3)  // simultáneo en t=0.3
    .to(board.rotation, { x: 0, duration:.12, ease:'none' })
}
```

### PATRÓN 7: Bento Grid CSS Tilt + GSAP Animated Words (Noova Game)
**Repo**: Ankit-Sharma1011/game-website | **Templates**: `3d_effect_17`, `3d_effect_18`, `3d_effect_19`, `3d_effect_20`
- `BentoTilt`: tilt 3D puro con React state — `perspective(700px) rotateX/Y scale3d(0.98)` por onMouseMove
- Cálculo: `relativeX = (clientX - left) / width`, `tiltY = (relativeX - 0.5) * -5`
- `AnimatedTitle`: cada palabra es span `.animated-word` con CSS inicial `translate3d(0,-100px,-500px) rotateX(90deg)`
- GSAP ScrollTrigger anima a `translate3d(0,0,0) rotateX(0)` con stagger:0.02
- `Story.tsx`: `gsap.to(img, { rotateX, rotateY, transformPerspective:500, duration:0.3, ease:'power1.inOut' })`
- Stack: gsap@3.14.2, @gsap/react, react@19, tailwind v4, Vite v8 (sin Three.js)

```typescript
// BentoTilt (copiar exacto — sin GSAP):
const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
  const { left, top, width, height } = itemRef.current!.getBoundingClientRect()
  const relativeX = (e.clientX - left) / width
  const relativeY = (e.clientY - top) / height
  const tiltX = (relativeY - 0.5) * 5
  const tiltY = (relativeX - 0.5) * -5
  setTransformStyle(`perspective(700px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(0.98,0.98,0.98)`)
}
```

### PATRÓN 8: Canvas 2D Scientific + Framer Motion + useCounter (Medical)
**Repo**: AmirBayat0/3D-Template-Landing-Page | **Templates**: `3d_effect_21`, `3d_effect_22`, `3d_effect_23`, `3d_effect_24`
- `Medical3DCanvas`: 5 funciones Canvas 2D — drawHeartbeat (ECG waveform), drawDNA (hélice), drawMolecule (red), drawFloatingCross (shape), drawParticles
- `useScrollAnimation(threshold=0.15)`: IntersectionObserver → `isVisible` state one-shot
- `useCounter(end, duration=2000)`: easing cúbico `1 - Math.pow(1-progress, 3)`, activado por `activate()`
- `WhyChooseUs`: framer-motion `initial={{opacity:0,y:40}} animate={isVisible ? {opacity:1,y:0} : {}}` + CounterCard
- Stack: framer-motion@12, lucide-react, tailwind v4 (sin Three.js, sin GSAP)

```typescript
// useCounter con cubic easing (copiar exacto):
const step = (timestamp: number) => {
  if (!startTime) startTime = timestamp
  const progress = Math.min((timestamp - startTime) / duration, 1)
  const eased = 1 - Math.pow(1 - progress, 3)   // ease-out cubic
  setCount(Math.floor(eased * (end - start) + start))
  if (progress < 1) requestAnimationFrame(step)
}
```

### PATRÓN 9: Three.js GLB Lerp + Snap Scroll + Dual Canvas (Ferrari)
**Repo**: Meettomb/LaFerrari-3D-Animated-Website | **Templates**: `3d_effect_25`, `3d_effect_26`, `3d_effect_27`, `3d_effect_28`
- `index.js`: Three.js GLB (scale=56), lerp speed=0.10, IntersectionObserver threshold=0.3 por `.sectionClass`
- NO usa GSAP — lerp manual en `animate()`: `car.position.lerp(targetPosition, 0.10)`
- `scroll.js`: snap scroll con wheel/ArrowKey/touch. `scrollIntoView({behavior:'smooth'})` + debounce 1000ms
- Progress dots generados dinámicamente (JS, no hardcoded), con labels, click-to-navigate
- Dual canvas: `.wbgl` (background scroll) ↔ `.wbgl2` (3D view interactiva con OrbitControls)
- Loader: letras FERRARI individuales con CSS stagger animation-delay

```javascript
// Lerp en animate loop (copiar exacto — sin GSAP):
function animate() {
  requestAnimationFrame(animate)
  if (car) {
    car.position.lerp(targetPosition, 0.10)
    car.rotation.x = THREE.MathUtils.lerp(car.rotation.x, targetRotation.x, 0.10)
    car.rotation.y = THREE.MathUtils.lerp(car.rotation.y, targetRotation.y, 0.10)
    car.rotation.z = THREE.MathUtils.lerp(car.rotation.z, targetRotation.z, 0.10)
  }
  renderer.render(scene, camera)
}
```

## Stack Tecnológico por Efecto

| Efecto | Stack | Dependencias clave |
|--------|-------|--------------------|
| Canvas Sequence | Next.js + Framer Motion | framer-motion, lenis, gsap |
| GLB Scroll | Vanilla JS | Three.js CDN, GSAP CDN |
| Video Clip-Path | React + Vite | @gsap/react, gsap, ScrollTrigger |
| R3F Showcase | Next.js + R3F | @react-three/fiber, @react-three/drei, three |
| GSAP Pinned | React | gsap, @gsap/react, ScrollTrigger |
| Morphing Blob | Vanilla JS | Three.js CDN (Perlin noise inline) |
| Particles | Vanilla JS | Three.js CDN, AdditiveBlending |
| R3F Tricks (Suburbia) | Next.js 15 + R3F | @gsap/react, matter-js, @react-three/drei |
| Bento Tilt (Noova) | React 19 + Vite | gsap@3.14.2, @gsap/react, tailwind v4 |
| Canvas 2D Medical | React 19 + Vite | framer-motion@12, lucide-react |
| GLB Lerp (Ferrari) | Vanilla JS + Vite | three@0.164.0 (sin GSAP) |

## Templates Disponibles en master-prompt-library.json

Clave de biblioteca: `3d_web_effects` (28 templates — Batch 1: 01-12, Batch 2: 13-28)

| ID | Nombre | Efecto | Repo Fuente |
|----|--------|--------|-------------|
| `3d_effect_01` | Canvas Sequence Hero | Apple/Starbucks scroll frames | starbucks-3d |
| `3d_effect_02` | GLB Scroll Storytelling | Three.js modelo por sección | ThreeJS_Animation_Scroll |
| `3d_effect_03` | Video Clip-Path Hero | GSAP polygon + video explosion | sanidhyy/game-website |
| `3d_effect_04` | R3F Product Showcase | Configurador de color 3D | Nimbus-Keyboard-3D |
| `3d_effect_05` | GSAP Pinned Section | Reveals secuenciales anclados | ThreeJS_Animation_Scroll |
| `3d_effect_06` | Lenis + GSAP Setup | Base smooth scroll premium | multiple |
| `3d_effect_07` | Floating Product Viewer | Auto-rotación cinematográfica | Nimbus-Keyboard-3D |
| `3d_effect_08` | Morphing Blob | Hero orgánico Perlin noise | ThreeJS_Animation_Scroll |
| `3d_effect_09` | Animated Text Reveal | Split text sin plugins de pago | sanidhyy/game-website |
| `3d_effect_10` | Template Completo Producto | Landing page producto 3D full | multiple |
| `3d_effect_11` | WebGL Particle Hero | Partículas interactivas cursor | ThreeJS_Animation_Scroll |
| `3d_effect_12` | Clip-Path Reveal | Sistema reveals para galería | sanidhyy/game-website |
| `3d_effect_13` | R3F Interactive Tricks | Skateboard/producto con ollie/kickflip/360 | blesten/3d-landing-page |
| `3d_effect_14` | matter-js Physics Footer | Footer con objetos arrastrables y gravedad | blesten/3d-landing-page |
| `3d_effect_15` | Parallax 2 Capas Mouse | Foreground 2.5x + lerp rAF sin GSAP | blesten/3d-landing-page |
| `3d_effect_16` | SlideIn IntersectionObserver | CSS keyframe slide-in con delay | blesten/3d-landing-page |
| `3d_effect_17` | Bento Tilt Grid CSS | perspective(700px) rotateX/Y solo React state | Ankit/game-website |
| `3d_effect_18` | Animated Words 3D Scroll | translate3d+rotateY/X stagger GSAP ScrollTrigger | Ankit/game-website |
| `3d_effect_19` | Video Clip-Path Mini Explosion | Mini-video explota a fullscreen + ScrollTrigger | Ankit/game-website |
| `3d_effect_20` | Image Mouse Tilt GSAP | rotateX/Y + transformPerspective:500 duration:0.3 | Ankit/game-website |
| `3d_effect_21` | Canvas 2D Temáticas | ECG + ADN + molécula + partículas sin WebGL | AmirBayat0/medical |
| `3d_effect_22` | Counters Easing Cúbico | useCounter hook + useScrollAnimation one-shot | AmirBayat0/medical |
| `3d_effect_23` | Hero Glassmorphism Framer | motion.div + glass-card + btn-3d + dark mode | AmirBayat0/medical |
| `3d_effect_24` | SVG Floating Elements CSS | Iconos SVG inline + CSS @keyframes float sin JS | AmirBayat0/medical |
| `3d_effect_25` | Three.js GLB Lerp Sections | IntersectionObserver + lerp 0.10 sin GSAP | Meettomb/LaFerrari |
| `3d_effect_26` | Snap Scroll Progress Dots | wheel+keyboard+touch+auto-snap+dots dinámicos | Meettomb/LaFerrari |
| `3d_effect_27` | Letter-by-Letter Loader | CSS stagger animation-delay por letra | Meettomb/LaFerrari |
| `3d_effect_28` | Dual Canvas WebGL Toggle | .wbgl background ↔ .wbgl2 interactivo via IntersectionObserver | Meettomb/LaFerrari |

## Variables Estándar ({{VARIABLE}})

Todas las variables CLIENT_* se pueden rellenar automáticamente con Brand DNA del cliente:

```
{{CLIENT_BRAND}}          — Nombre de la marca
{{CLIENT_PRODUCT}}        — Nombre del producto  
{{CLIENT_INDUSTRY}}       — Sector/industria
{{CLIENT_COLORS}}         — Paleta de colores
{{PRIMARY_COLOR}}         — Color principal HEX
{{ACCENT_COLOR}}          — Color acento HEX
{{BG_COLOR}}              — Fondo oscuro HEX
{{TEXT_COLOR}}            — Texto HEX
{{PRODUCT_SLUG}}          — Slug URL del producto
{{GLB_FILENAME}}          — Archivo del modelo 3D (.glb)
{{FRAME_COUNT}}           — Número de frames PNG (60-120)
{{CLIENT_HERO_TITLE_LINE1}} — Primera línea del H1
{{CLIENT_HERO_TITLE_LINE2}} — Segunda línea en itálica
{{CLIENT_PRODUCT_DESCRIPTION}} — Descripción ~30 palabras
{{CLIENT_CTA_PRIMARY}}    — Texto CTA primario
{{CLIENT_CTA_PRIMARY_URL}} — URL del CTA
{{CLIENT_PRODUCT_PRICE}}  — Precio formateado
{{FEAT_N_LABEL/VALUE/DESC}} — Características del producto
{{COLOR_N_NAME/HEX}}      — Opciones de color del configurador
```

## Cómo usar este skill

### Via Shopy Crafter PromptLibrary UI
1. Ir a `/admin/prompt-library` o la sección de templates
2. Filtrar por categoría `3d_web_effects`
3. Seleccionar el template deseado
4. Activar **DNA Mode** para auto-rellenar variables con el Brand DNA del cliente
5. Ejecutar → genera código completo

### Via API directamente
```bash
POST /api/prompt-library/execute
{
  "templateId": "3d_effect_10_full_page_template_product",
  "variables": {
    "CLIENT_BRAND": "Nike",
    "CLIENT_PRODUCT": "Air Max 2025",
    "ACCENT_COLOR": "#FF6B35",
    "BG_COLOR": "#0A0A0A"
  },
  "stream": true
}
```

### Via Chatbot (Modo Proyecto)
```
Usuario: "Genera una landing page 3D para [CLIENTE] usando el template de Canvas Sequence"
→ El chatbot usará el template 3d_effect_01 con el Brand DNA del cliente
```

## Cómo generar los Assets necesarios

### Frames PNG (para Canvas Sequence)
```bash
# Opción 1: Video a frames
ffmpeg -i producto_video.mp4 -vframes 90 -q:v 2 public/frames/producto/frame-%04d.jpg

# Opción 2: Blender script
blender producto.blend --background --python render_frames.py
# render_frames.py: camera rotation 0→360° en 90 frames

# Opción 3: IA (sin 3D software)
# Midjourney: "{{PRODUCT}} rotating 360°, white background, frame N/90, product photography"
```

### Modelos GLB gratuitos
- **Sketchfab.com**: filtrar "downloadable + free"
- **Free3D.com**: modelos listos
- **CGTrader**: sección free
- **Meshy AI** (platform): texto → 3D en segundos
- **Tripo3D** (platform): imagen → 3D en segundos

### Tipos de GLB del modelo (para R3F)
```bash
# Auto-generar tipos TypeScript del GLB:
npx @react-three/gltf@latest transform /public/models/product.glb
# → Genera Product3DGenerated.tsx con todos los nodes tipados
```

## Notas importantes

- **Canvas Sequence** funciona en TODOS los dispositivos (sin WebGL requerido) — mejor opción para máxima compatibilidad
- **Lenis smooth scroll** es PRERREQUISITO para que ScrollTrigger funcione correctamente — siempre configurarlo primero
- **FOV bajo (10-15°)** en Three.js da el "telephoto cinematic look" de productos premium
- **AdditiveBlending** en partículas es esencial para el efecto glow sin fondo negro
- **ACESFilmicToneMapping** en renderer hace que los colores sean más realistas
- Para `PresentationControls` en R3F: usar `global` prop para que funcione en toda la pantalla
