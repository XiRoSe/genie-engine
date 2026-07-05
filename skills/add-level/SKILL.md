---
name: add-level
description: Use when adding or editing a playable level/map in this FPS kit. Covers the level module shape, registering it in the levels index, the LevelBuilder toolkit (terrain, structures, destructibles, lights, enemies, objectives, arcs), per-level config overrides, and the startLoadout gate.
---

# Add a level

A level is a plain module `{ id, name, config?, build(b) }`. `build(b)` receives a `LevelBuilder` and
lays out the world by calling toolkit methods. Read the `engine-overview` skill first.

## 1. Create `src/game/levels/my-level.js`

```js
export const myLevel = {
  id: "my-level",
  name: "RAID THE OUTPOST",
  config: {                                  // per-level overrides, merged ONE level deep onto game/config.js
    view: "third",                                      // OMIT → first-person. "third" = visible player actor + gun (see MEESEEKS MAYHEM)
    scene: { sky: "day", fog: { color: 0x9a7fb0, near: 240, far: 1300 }, fov: 75 },
    objective: { type: "collect", count: 12, noun: "Ring", startLabel: "COLLECT THE 12 WHITE RINGS", startSub: "to save the time" }, // "collect"/"defuse"/"exfil"; noun/icon/startLabel/startSub are optional label overrides
    intro: { enabled: true, style: "droppod" },         // "droppod" | "parachute" | classic
    player: { grenades: 4, startLoadout: ["sword"] },   // OMIT startLoadout → standard rifle+launcher arsenal
  },
  build(b) {
    b.spawnAt(0, 156);                                   // player start (x, z)
    b.setBounds({ minX: -320, maxX: 320, minZ: -320, maxZ: 320 });
    // ...lay out the world with the toolkit (below)...
  },
};
```

## 2. Register it in `src/game/levels/index.js`

```js
import { myLevel } from "./my-level.js";
export const levels = { compound, "desert-base": desertBase, arcfall, "my-level": myLevel };
// export const DEFAULT_LEVEL = "my-level";   // optional
```

Play it: `http://localhost:5180/?level=my-level`

## LevelBuilder cheat-sheet (world XZ meters; anything solid auto-registers a collider)

| Call | Makes |
|------|-------|
| `spawnAt(x,z)` · `setBounds({minX,maxX,minZ,maxZ})` | player start · walkable box |
| `desertFloor(size,patchN,patchSpread,surround)` · `islandTerrain({size})` | flat military ground · sculpted island (hills/beach/sea) |
| `scatterDesert(rMin,rMax,bushes,rocks)` · `scatterTrees(n,rMin,rMax)` · `scatterRocks(n,rMin,rMax)` | cheap instanced foliage/rocks |
| `road(w,len,x,z)` · `wall(x,z,w,d,h)` · `building(x,z,w,d,h)` · `bunker(x,z)` · `tower(x,z)` | strips · solid structures |
| `palace(x,z)` · `ruin(x,z)` · `hut(x,z)` · `obelisk(x,z)` · `pyramid(x,z,s)` · `clockTower(x,z)` · `skyscraper(x,z,kind,rot)` | ARCFALL landmarks |
| `crateStack(x,z,conf)` · `sandbags` · `bollard` · `fence` | low cover / dressing |
| `barrels(x,z,n)` · `vehicle(x,z,rot,type)` · `fuelTanks(x,z,n)` | **shootable destructibles** (see add-destructible) |
| `floodlight(x,z,h,aimX,aimZ,sweep,range)` | spotlight (persistent — never toggled at runtime) |
| `ammo(x,z,rounds)` · `giftCrate(x,z,kind)` | pickups · loot crate (`"ammo"/"health"/"armor"/"grenade"/<weapon>`) |
| `bomb(x,z)` · `objective(x,z,r)` · `arc(x,z)` | defuse target · exfil flag · collectible Arc (beams to sky) |
| `enemy(spec)` | queue an enemy spawn (see add-enemy) |
| `sectionForest/sectionWalls/sectionPylons(x,z,r,th)` | ringed territory barriers with gateways |
| `collide(x,z,w,d,top)` | register a bare collider; set `.baseY` on the returned rec to seat it |

## Gotchas specific to levels

- **Sculpted terrain (islandTerrain):** seat every structure/standable thing on `terrainHeight(x,z)`.
  To make a roof standable, add a collider whose `top` is the roof height; to make it a "stand on top"
  monument the full footprint collider blocks ground entry — that's the trade-off.
- **`startLoadout`** in `config.player` decides the opening weapons. ARCFALL = `["sword"]` (scavenge guns);
  omit it for the standard `["rifle","sword","launcher"]` arsenal. Wired in `main._startPlay`.
- Verify placement with the in-browser raycast/bbox checks (see `verify-in-browser`) — floating props and
  fall-through roofs are the usual bugs.
