---
name: vfx-and-cinematics
description: Use when adding visual effects (explosions, tracers, beams, sparks, dust, shockwaves, lightning) or building cinematic sequences (the drop-pod/parachute intro, the story crawl, the victory shrink-world + end card). Covers the pooled vfx API, the blast system, and how the runner drives camera cinematics each frame.
---

# VFX & cinematics

Effects live in `engine/vfx.js` (pooled — **no per-shot/per-frame allocations**). Cinematics are driven by
`main.js` per frame while the engine renders the moving camera. Read `engine-overview` first.

## VFX API (pooled — reuse, never `new` in a hot path)

`g.vfx` methods: `tracer`, `muzzle`, `impact(point, normal, color?, scale?)`, `hitPuff`, `explosion(pos, scale)`,
`_fireball`, `_shockwave`, `_spawnDebris`, `dustBurst`, `rocketTrail`, `plasmaTrail`, `laserBeam(a, b, color?, sizeScale?)`,
`groundHit(point, color)`, `energyBoom`, `bossBeam`, `enemyLaser`, `lightning`, `_flash`, `_embers`, `_decal`. Call
`g.vfx.update(dt)` each frame (the runner does this).

## Surface-aware impacts (the hit "blob" follows the surface)

`impact(point, normal, color = 0xffe2a0, scale = 1)` is the ONE call for a hit effect on ANY surface — wall,
ground, prop, vehicle, or enemy. It lays a soft glowing **splat oriented to `normal`** (normal-blended from the
`splats` pool, so the `color` reads true even over the warm/orange world), plus a flash + coloured sparks + dust.
Always pass the **real world-space surface normal**, never one faked from the ray direction, so the blob sits flat:
- **Hitscan:** `main._rayShot(dir)` returns `{ point, normal, enemy?, dist }` — `normal` is the intersection face
  normal pushed to world space via `Matrix3.getNormalMatrix(object.matrixWorld)`. `combat.tryShoot` inlines the same.
- **Terrain:** `main._terrainHit(start, dir)` returns `{ point, normal }` — `normal` from the heightfield gradient,
  so blobs lie flat on slopes.
- **Colour per weapon:** energy guns pass their `ecolor`; kinetic rounds use the default warm hue (which also drops
  a dark bullet-hole `_decal`). Feed the same `color` to `laserBeam`/`groundHit` so beam + core + flash + blob match.
- `groundHit(point, color)` = the extra energy **force-field bubble** (a growing/fading 3D sphere from the
  `forceballs` pool, *not* a flat 2D ring) + small AoE, fired alongside `impact` when a laser hits the ground.

Add a new weapon or a new hittable surface and you get correctly-oriented impacts for free — just call `impact`
with the real normal. Don't hand-roll a per-weapon hit effect.

## The blast system (`engine/projectiles.js`)

- `Projectile(scene, mesh, pos, vel, opts)` — ballistic with `gravity`, `bounce`, `fuse`, `detonateOnHit`.
  It collides against `level.colliders` **and the real `terrainHeight`** (not a flat plane) + structures.
- `blastAt(center, pos, {radius, damage, power})` → distance-falloff damage + knockback impulse; `applyBlast`
  applies it to enemies + flings dynamics. Rocket/grenade radius+damage come from `config.balance`.

## Lightning / weather

`engine/skyStorm(dt)` (called every frame) fires periodic strikes: a forked bolt + a flash that pulses the
renderer **exposure** and the hemi/sun **intensity** (never adds/removes a light), then resets to the dark
baseline. Thunder is cued via the `engine.onThunder` callback → `audio.thunder()`. Scale the flash multipliers
to make storms brighter/dimmer; keep the reset so the mood returns to dark between strikes.

## Cinematics (camera sequences driven per frame)

- **Intros** (`game/drop-pod-intro.js`, `parachute-intro.js`): phases (`crawl → fall → reveal`) advanced in
  `update(dt)`; callbacks `onCrawl` / `onCrawlEnd` / `onImpact` let the runner cue music, the HUD story crawl,
  the whoosh, and the screen shake.
- **Victory** (`main._victoryStep`, state `winseq`): phase machine — **shrink the world** (`hud.collapseToDot`)
  → the Star-Wars **crawl** (`hud.showEndCrawl`) → the centered **end card** (`hud.showEndButton`, revealed only
  after the crawl animation finishes). The runner restarts the battle music from the start for the finale.
- Pattern: hold camera control in the runner; advance a `this._winT`/phase each frame; call HUD/audio at phase
  edges. For a precise "after the animation" trigger, use the Web Animations `.finished` promise, not a guessed
  timeout.

## Gotchas

- Pooled VFX only — adding lights for an effect causes the shader-recompile freeze. Use additive meshes/sprites.
- Verify timed cinematics by stepping `_victoryStep(1/60)` in a loop and asserting the phase timeline
  (see `verify-in-browser`).
