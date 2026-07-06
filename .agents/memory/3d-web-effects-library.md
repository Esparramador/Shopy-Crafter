---
name: 3D Web Effects Library
description: 12 templates ejecutables de efectos 3D web premium, basados en análisis de 4 repos GitHub reales. Guardados en master-prompt-library.json.
---

# 3D Web Effects Library

## Ubicación
- **master-prompt-library.json** clave: `3d_web_effects` (59a biblioteca, total 6793 templates)
- **Skill**: `.agents/skills/3d-web-effects/SKILL.md`

## Los 4 repos analizados y sus patrones
1. **SRCarlo/ThreeJS_Animation_Scroll** → GLB + GSAP: arrPositionModel[], gsap.to(model.position) on scroll
2. **sanidhyy/game-website** → GSAP clip-path polygon + video explosion (mini-video → fullscreen)
3. **Itssanthoshhere/Nimbus-Keyboard-3D** → React Three Fiber + MeshStandardMaterial dinámico + PresentationControls
4. **Ayush08k/starbucks-3d-animated-site** → Canvas sequence (90 PNG frames) sin WebGL — live: starbucks-3d-animated-site.vercel.app

## Patrón Canvas Sequence (el más importante)
No usa WebGL. Hook `useCanvasSequence`: keyframes precargados → scroll progress → frameIndex → `ctx.drawImage()`.
```typescript
const progress = -rect.top / (container.offsetHeight - window.innerHeight);
const frameIndex = Math.round(clamp(progress, 0, 1) * (frameCount - 1));
```
Generar frames: `ffmpeg -i video.mp4 -vframes 90 -q:v 2 public/frames/product/frame-%04d.jpg`

## 12 Templates disponibles
| ID | Efecto |
|----|--------|
| `3d_effect_01_canvas_sequence_hero` | Canvas Sequence (Apple/Starbucks) |
| `3d_effect_02_glb_scroll_storytelling` | GLB Three.js scroll por sección |
| `3d_effect_03_video_clip_path_hero` | Video + GSAP clip-path polygon |
| `3d_effect_04_r3f_product_showcase` | R3F + configurador de color |
| `3d_effect_05_gsap_scroll_pinned` | GSAP pinned reveals secuenciales |
| `3d_effect_06_lenis_smooth_scroll_setup` | Lenis + GSAP setup base |
| `3d_effect_07_three_floating_product` | Three.js visor auto-rotación |
| `3d_effect_08_morphing_blob` | Blob orgánico Perlin noise |
| `3d_effect_09_animated_text_reveal` | Split text sin plugins de pago |
| `3d_effect_10_full_page_template_product` | Landing page 3D completa |
| `3d_effect_11_webgl_particle_hero` | Partículas WebGL interactivas |
| `3d_effect_12_gsap_clip_path_reveal` | Clip-path reveals para galería |

## Dependencias clave por stack
- Canvas Sequence: `lenis`, `framer-motion`, `gsap`
- GLB Scroll: Three.js CDN + GSAP CDN (vanilla JS, sin npm)
- R3F Showcase: `@react-three/fiber ^9.3.0`, `@react-three/drei ^10`, `three ^0.180.0`
- FOV Three.js: 10° (telephoto cinematic look) — camera.z = 13

**Why:** decisiones de diseño no-obvias como FOV=10 o canvas-sequence-sin-WebGL que generan el mismo efecto visual que Three.js pero con mejor compatibilidad cross-device.
