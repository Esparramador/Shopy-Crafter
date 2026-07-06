# 3D Web Effects — Skill Library

## Qué hace este skill
Genera efectos 3D y animaciones web premium adaptables a cualquier producto, cliente, sector o empresa. Basado en análisis profundo de 4 repos GitHub reales (ThreeJS_Animation_Scroll, game-website, Nimbus-Keyboard-3D, starbucks-3d-animated-site).

Todos los templates están guardados en el master-prompt-library.json bajo la clave `3d_web_effects` (12 templates ejecutables). Se pueden ejecutar vía POST /api/prompt-library/execute o directamente a través del PromptLibrary.tsx en Shopy Crafter.

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

## Templates Disponibles en master-prompt-library.json

Clave de biblioteca: `3d_web_effects` (59 bibliotecas totales)

| ID | Nombre | Efecto |
|----|--------|--------|
| `3d_effect_01_canvas_sequence_hero` | Canvas Sequence Hero | Apple/Starbucks scroll frames |
| `3d_effect_02_glb_scroll_storytelling` | GLB Scroll Storytelling | Three.js modelo por sección |
| `3d_effect_03_video_clip_path_hero` | Video Clip-Path Hero | GSAP polygon + video explosion |
| `3d_effect_04_r3f_product_showcase` | R3F Product Showcase | Configurador de color 3D |
| `3d_effect_05_gsap_scroll_pinned` | GSAP Pinned Section | Reveals secuenciales anclados |
| `3d_effect_06_lenis_smooth_scroll_setup` | Lenis + GSAP Setup | Base smooth scroll premium |
| `3d_effect_07_three_floating_product` | Floating Product Viewer | Auto-rotación cinematográfica |
| `3d_effect_08_morphing_blob` | Morphing Blob | Hero orgánico Perlin noise |
| `3d_effect_09_animated_text_reveal` | Animated Text Reveal | Split text sin plugins de pago |
| `3d_effect_10_full_page_template_product` | Template Completo | Landing page producto 3D full |
| `3d_effect_11_webgl_particle_hero` | WebGL Particle Hero | Partículas interactivas cursor |
| `3d_effect_12_gsap_clip_path_reveal` | Clip-Path Reveal | Sistema reveals para galería |

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
