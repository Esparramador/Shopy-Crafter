---
name: CardStudio Konva migration
description: CardStudioEditor migrado de CSS position:absolute a react-konva canvas real. Contexto técnico y patrones usados.
---

## Qué se migró
`CardStudioEditor.tsx` (820 líneas) → react-konva (600 líneas).
Eliminó todo el código de drag manual (mousedown/mousemove refs + 8 resize handles CSS).

## Arquitectura Konva
- `Stage` (CARD_W×CARD_H, scale=zoom) → container del canvas
- `Layer` "bg": `KImage` para background URL, o `Rect` gradiente como fallback
- `Layer` "elements": `KText`, `KImage` (logo), `Rect` (QR placeholder y líneas)
- `Transformer` nativo: handles de resize+rotate, `keepRatio=false`, `anchorSize=8/zoom`

## Patrones críticos
- `useKonvaImage(src)`: hook que carga `new window.Image()` con `crossOrigin="anonymous"` 
- `nodeRefs: Map<string, Konva.Node>`: refs a todos los nodos por id para conectar Transformer
- Font preloading: `document.fonts.load(size + family)` + `layer.batchDraw()` cuando cambian elementos
- `onDragEnd`: lee `node.x()/node.y()` después del drag y llama `setOverride(id, {x,y})`
- `onTransformEnd`: lee `scaleX/scaleY`, los resetea a 1, aplica al width/height

**Why:** CSS divs con drag HTML5 son inherentemente inestables en editores gráficos (coordenadas 
escalan mal, resize handles son frágiles). Konva renderiza en `<canvas>` nativo con eventos propios.

**How to apply:** Cualquier nuevo tipo de elemento (shape, emoji, imagen custom) debe añadirse
como nodo Konva en el Layer "elements" con los mismos `commonProps` (draggable, onClick, ref).
