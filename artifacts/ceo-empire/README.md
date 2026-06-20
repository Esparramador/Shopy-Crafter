# CEO Empire 🎩👑

> GTA V-style open world browser game — built with React Three Fiber + Zustand

Part of the **Shopy Crafter** platform. Play as a CEO building a business empire in a 3D city.

## 🎮 Gameplay

- **Open world city** with 30+ buildings, parks, roads and street lights
- **5 playable missions** — from picking up the briefcase to becoming CEO of the year
- **8 buyable businesses** — from a digital café to the AI Tower (passive income)
- **11 NPCs** — friendly advisors, hostile rivals and bosses (Lord Tuétano, Arthas, Illidan…)
- **5 driveable cars** — Ferrari, Lamborghini, Tesla, Rolls, Porsche
- **Dynamic day/night cycle** — sunrise, golden hour, night with street lights
- **Full HUD** — health/karma bars, money, wanted stars, minimap, inventory

## 🕹️ Controls

| Key | Action |
|-----|--------|
| `WASD` / `↑↓←→` | Move |
| Mouse (click to lock) | Rotate camera |
| `F` | Talk to nearby NPC |
| `E` | Enter vehicle / Start mission |
| `B` | Buy nearby business |
| `I` | Open inventory |
| Left click | Attack |
| `Shift` | Sprint |

## 🏗️ Tech Stack

- **React Three Fiber** — 3D scene, shadows, ACES tonemapping
- **@react-three/drei** — GLB model loading, HTML overlays
- **Zustand** — game state (health, money, karma, missions, inventory…)
- **Vite** — dev server + bundler
- **TypeScript**

## 📁 Structure

```
src/
├── App.tsx              # Root — menu / game / dead screen
├── game/
│   ├── Game.tsx         # R3F Canvas
│   ├── World.tsx        # City geometry, buildings, markers
│   ├── Player.tsx       # WASD + mouse camera + GLB character
│   ├── NPCSystem.tsx    # NPC AI (wander / chase / attack)
│   ├── VehicleSystem.tsx# Car meshes + proximity detection
│   ├── MissionSystem.tsx# Mission objectives + completion
│   └── DayNight.tsx     # 24h sun/sky/lighting cycle
├── ui/
│   ├── MainMenu.tsx     # Character selection
│   ├── HUD.tsx          # Health, money, wanted, clock, hints
│   ├── MiniMap.tsx      # Canvas 2D radar
│   ├── DialogBox.tsx    # NPC dialogue overlay
│   └── Inventory.tsx    # Item management
└── lib/
    ├── gameStore.ts     # Zustand store
    └── gameData.ts      # Missions, businesses, NPCs, vehicles
```

## 🚀 Getting Started

```bash
npm install
npm run dev
```

Or with pnpm (monorepo context):

```bash
pnpm --filter @workspace/ceo-empire run dev
```

## 🧩 3D Models

All GLB models are in `public/assets/models/`. Characters include:
- `alec_monopoly.glb` — Alec CEO (playable)
- `chico_formal.glb`, `chica_ejecutiva.glb`, `chica_creativa.glb` — playable CEOs
- `lord_tuetano.glb`, `arthas.glb`, `illidan.glb`, `bowser.glb` — bosses/enemies
- `majin_bu.glb`, `mini_goku.glb`, `trono.glb` — NPCs

## 📄 License

MIT
