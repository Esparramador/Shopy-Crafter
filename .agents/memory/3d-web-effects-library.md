---
name: 3D Web Effects Library
description: 28 templates ejecutables de efectos 3D web premium, basados en análisis de 8 repos GitHub reales (Batch 1: 12 templates; Batch 2: 16 templates nuevos). Guardados en master-prompt-library.json.
---

# 3D Web Effects Library

## Ubicación
- **master-prompt-library.json** clave: `3d_web_effects` (28 templates, total 6867 templates globales)
- **Skill**: `.agents/skills/3d-web-effects/SKILL.md`

## Batch 1 — 4 repos analizados (templates 01-12)
1. **SRCarlo/ThreeJS_Animation_Scroll** → GLB + GSAP: arrPositionModel[], gsap.to(model.position) on scroll
2. **sanidhyy/game-website** → GSAP clip-path polygon + video explosion (mini-video → fullscreen)
3. **Itssanthoshhere/Nimbus-Keyboard-3D** → React Three Fiber + MeshStandardMaterial dinámico + PresentationControls
4. **Ayush08k/starbucks-3d-animated-site** → Canvas sequence (90 PNG frames) sin WebGL

## Batch 2 — 4 repos analizados (templates 13-28)
5. **blesten/3d-landing-page** (Suburbia Skate) → Next.js 15 + R3F + matter-js + GSAP + Prismic CMS
6. **Ankit-Sharma1011/game-website** (Noova) → React 19 + Vite + GSAP 3.14.2 (sin Three.js)
7. **AmirBayat0/3D-Template-Landing-Page** (Medical) → React 19 + framer-motion 12 (sin Three.js ni GSAP)
8. **Meettomb/LaFerrari-3D-Animated-Website** → Vanilla JS + Three.js (sin React, sin GSAP)

## Patrones clave Batch 2

### Suburbia Skate (R3F + GSAP Tricks)
- 3 meshes invisibles con nombre ('front','middle','back') → click → animaciones GSAP
- Kickflip: `gsap.timeline().to(rotation, {z: '+=' + Math.PI*2, duration:.78}, .3)` (posición en timeline)
- Float idle: simultáneo gsap.to position.x yoyo + rotation.y yoyo con sine.inOut
- FooterPhysics: matter-js Bodies.rectangle chamfer:{radius:40} restitution:0.8 + MouseConstraint
- ParallaxImage: lerp 0.1 via rAF, foreground * 2.5, background * 1 (sin GSAP)

### Noova Game (GSAP puro, sin Three.js)
- BentoTilt: `perspective(700px) rotateX(${tiltY*-5}deg) rotateY(${tiltX*5}deg) scale3d(0.98,0.98,0.98)` via React state
- AnimatedTitle: .animated-word CSS inicial `translate3d(0,-100px,-500px) rotateX(90deg)` → GSAP ScrollTrigger stagger:0.02
- Story tilt: `gsap.to(img, {rotateX, rotateY, transformPerspective:500, duration:0.3, ease:'power1.inOut'})`

### Medical (framer-motion + Canvas 2D, sin Three.js)
- Canvas 2D: drawHeartbeat (phase-based ECG) + drawDNA (wave1/-wave1 nodes) + drawMolecule (polar coords) + drawParticles
- useCounter: cubic easing `1 - Math.pow(1-progress, 3)` con rAF, activado por `activate()` one-shot
- useScrollAnimation: IntersectionObserver → setIsVisible(true) one-shot (no reversa)

### Ferrari (Three.js puro lerp, sin GSAP)
- lerp en animate(): `car.position.lerp(targetPosition, 0.10)` + `THREE.MathUtils.lerp` para rotación
- sectionAnimations array: {sectionClass, position: THREE.Vector3, rotation: THREE.Euler, scale?, onEnter?}
- IntersectionObserver threshold:0.3 → copia position/rotation targets → lerp los suaviza automáticamente
- Snap scroll: debounce 1000ms, scrollIntoView({behavior:'smooth'}), wheel+keyboard+touch
- Dual canvas: .wbgl (fixed background) ↔ .wbgl2 (interactive) toggle via display:none/block

## Patrón Canvas Sequence (Batch 1 — el más importante)
No usa WebGL. Hook `useCanvasSequence`: keyframes precargados → scroll progress → frameIndex → `ctx.drawImage()`.
```typescript
const progress = -rect.top / (container.offsetHeight - window.innerHeight);
const frameIndex = Math.round(clamp(progress, 0, 1) * (frameCount - 1));
```

## Los 28 Templates

| ID | Efecto | Repo |
|----|--------|------|
| `3d_effect_01` | Canvas Sequence (Apple/Starbucks) | starbucks-3d |
| `3d_effect_02` | GLB Three.js scroll por sección + GSAP | ThreeJS_Animation_Scroll |
| `3d_effect_03` | Video clip-path polygon + mini explosion | sanidhyy/game-website |
| `3d_effect_04` | R3F configurador de color 3D | Nimbus-Keyboard-3D |
| `3d_effect_05` | GSAP pinned section reveals | ThreeJS_Animation_Scroll |
| `3d_effect_06` | Lenis + GSAP smooth scroll setup | multiple |
| `3d_effect_07` | R3F floating product auto-rotate | Nimbus-Keyboard-3D |
| `3d_effect_08` | Morphing blob Perlin noise | ThreeJS_Animation_Scroll |
| `3d_effect_09` | Animated text reveal split | sanidhyy/game-website |
| `3d_effect_10` | Full landing page product template | multiple |
| `3d_effect_11` | WebGL particles cursor interaction | ThreeJS_Animation_Scroll |
| `3d_effect_12` | Clip-path reveal gallery system | sanidhyy/game-website |
| `3d_effect_13` | R3F tricks: ollie/kickflip/360 click zones | blesten/3d-landing-page |
| `3d_effect_14` | matter-js physics footer arrastrables | blesten/3d-landing-page |
| `3d_effect_15` | Parallax 2 capas lerp rAF sin GSAP | blesten/3d-landing-page |
| `3d_effect_16` | SlideIn IntersectionObserver CSS keyframe | blesten/3d-landing-page |
| `3d_effect_17` | Bento tilt CSS perspective React state | Ankit/game-website |
| `3d_effect_18` | Animated words 3D GSAP ScrollTrigger stagger | Ankit/game-website |
| `3d_effect_19` | Mini-video explota a fullscreen clip-path | Ankit/game-website |
| `3d_effect_20` | Imagen mouse tilt GSAP transformPerspective | Ankit/game-website |
| `3d_effect_21` | Canvas 2D ECG+ADN+molécula+partículas | AmirBayat0/medical |
| `3d_effect_22` | useCounter cubic easing + useScrollAnimation | AmirBayat0/medical |
| `3d_effect_23` | Hero glassmorphism framer-motion dark mode | AmirBayat0/medical |
| `3d_effect_24` | SVG floating elements CSS keyframes inline | AmirBayat0/medical |
| `3d_effect_25` | Three.js GLB lerp 0.10 IntersectionObserver | Meettomb/LaFerrari |
| `3d_effect_26` | Snap scroll + progress dots + wheel+touch | Meettomb/LaFerrari |
| `3d_effect_27` | Letter-by-letter loader CSS stagger | Meettomb/LaFerrari |
| `3d_effect_28` | Dual canvas WebGL toggle por sección | Meettomb/LaFerrari |

**Why:** Durable — estos patrones son reutilizables cross-sector y no están documentados en ningún otro lugar del codebase.
**How to apply:** Al generar landings 3D para clientes, seleccionar templates de esta lista según stack disponible (React/Vanilla) y efecto deseado. Los prompts incluyen `{{CLIENT_*}}` variables compatibles con Brand DNA.
