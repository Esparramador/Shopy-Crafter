---
name: Alec Monopoly GLB Animation Names
description: Verified mapping of GLB filename → actual animation clip name inside the file; many filenames are WRONG
---

## Verified GLB → real animation clip (from JSON inspection)

### GOOD — correct name or good motion
| GLB file | Actual clip name | Motion |
|---|---|---|
| casual_walk.glb | Armature\|Casual_Walk\|baselayer | Walk (has root motion, lock Hips X/Z) |
| think.glb | Armature\|Idle_02\|baselayer | Idle standing ✅ |
| catching_breath.glb | Armature\|Catching_Breath\|baselayer | Standing breathing ✅ |
| big_wave_hello.glb | Armature\|Big_Wave_Hello\|baselayer | Wave greeting ✅ |
| cardio_dance.glb | Armature\|Cardio_Dance\|baselayer | Dance/celebrate ✅ |
| arm_circle_shuffle.glb | Armature\|Arm_Circle_Shuffle\|baselayer | Shuffle dance ✅ |
| agree_gesture.glb | Armature\|Agree_Gesture\|baselayer | Pointing gesture ✅ |
| arise.glb | Armature\|Arise\|baselayer | Stand up from floor ✅ |
| all_night_dance.glb | Armature\|All_Night_Dance\|baselayer | Full dance ✅ |
| celebrate.glb | Armature\|Skill_02\|baselayer | Unknown "skill" |
| victory.glb | Armature\|Idle_03\|baselayer | Another idle (file mislabeled) |

### WRONG — filename does NOT match content (DO NOT USE)
| GLB file | Actual clip | Why wrong |
|---|---|---|
| idle_breath.glb | Armature\|BackLeft_run\|baselayer | RUNNING animation! |
| wave.glb | Armature\|BackRight_Run\|baselayer | RUNNING animation! |
| dance.glb | Armature\|ForwardLeft_Run_Fight\|baselayer | Fight-run animation! |
| look_around.glb | Armature\|Run_02\|baselayer | RUNNING animation! |
| thumbs_up.glb | Armature\|BeHit_FlyUp\|baselayer | Hit/fly-up animation! |

## Why animations weren't playing (root cause fix)

`@react-three/drei` `useAnimations` uses `Object.defineProperty` on a `useRef` to create lazy action getters. This is a MUTATION (not useState), so it NEVER triggers React re-renders.

The old `actionKeys = JSON.stringify(Object.keys(actions))` trick to detect when actions populate DID NOT WORK because `Object.keys(actions)` are populated via the mutation, not through a state update.

**Fix**: Start animation in `useFrame` instead of a `useEffect`:
```tsx
const animStarted = useRef(false);
useFrame((state, dt) => {
  mixer.update(dt);
  if (!animStarted.current) {
    const key = Object.keys(actions)[0];
    const action = key ? actions[key] : null;
    if (action) {
      action.reset(); action.setLoop(...); action.play();
      animStarted.current = true;
    }
  }
});
```
`useFrame` is GUARANTEED to run after all `useEffect`s (including the one in `useAnimations` that defines the getters), so actions are always populated on the first frame.

## Scene cloning requirement

`useGLTF` caches the parsed scene globally. If the same GLB is used multiple times (or component remounts), mutating `scene.scale/position` corrupts the cache.

**Fix**: `const scene = useMemo(() => rawScene.clone(true), [rawScene]);`

`scene.clone(true)` makes each component instance own its scene graph. Animation clips use string-path track names (not UUID refs), so `useAnimations` + cloned scene works correctly — the mixer resolves bone names via `group.getObjectByName(boneName)`.

## Walk animation root motion

`casual_walk.glb` has root motion (Hips bone translates forward). After `mixer.update(dt)`, reset:
```tsx
if (rootBoneRef.current) {
  rootBoneRef.current.position.x = 0;
  rootBoneRef.current.position.z = 0;
}
```
Find Hips bone via `scene.traverse` looking for `name === "hips"` or `"mixamorigHips"`.

## Lighting for white/cream Meshy models

Alec Monopoly's Meshy model has a white/cream PBR texture (6.5MB PNG embedded in each GLB). Blowing it out with high ambient + ACES 1.1 makes it look plain white.

Good settings:
- `ambientLight intensity={0.35}` (was 0.75 — too bright)
- Strong directional key: `position={[2,6,4]} intensity={2.2}`
- Fill: `position={[-3,3,2]} intensity={0.7}`
- `Environment preset="studio"` (neutral, not "sunset" which adds orange cast)
- `toneMappingExposure: 0.8` (was 1.1)
