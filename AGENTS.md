# AGENTS.md — guide for Claude / AI agents

You're working in **GENIE** (a Generative Engine for Native Interactive Experiences), a Three.js + Vite web game engine (first- and third-person). This file hands you
the conventions and the verification workflow so you don't rediscover them by trial and error. Read
[ARCHITECTURE.md](ARCHITECTURE.md) for the module map and the task skills in
[skills/](skills/) for the content APIs (add-level, add-weapon, add-enemy, add-audio,
verify-in-browser, ship-changes).

## Mental model

- **Three tiers:** `engine/` (generic) → `kit/` (the military-FPS toolkit) → `game/` (this game).
  Hard rule: **`engine/` imports nothing from `kit/` or `game/`; `kit/` may use `engine/`; `game/` may
  use both.** If code references this map/roster/rules, it belongs in `game/`.
- It's a **game-specific kit**, not a generic engine — adding a level/weapon/enemy/objective is *data +
  a small module*, not new abstraction layers. Keep it flat.
- `main.js` is the runner: state machine (`loading → start → intro → play → win/lose/detonate`) and
  the per-frame `update(dt, t)`. Anything spanning engine+game per frame lives here.

## Build / run / verify

```bash
npm install
npm run dev      # http://localhost:5180  (Vite, HMR)
npm run build    # -> dist/  ALWAYS run this after edits; it must end "✓ built"
npm start        # serve dist/ on $PORT (prod)
```

After any change: **`npm run build` must succeed** and the page must load with **0 console errors**.
A syntax slip (e.g. a dropped brace) shows up as a Vite "invalid JS syntax" build failure — read the
file:line it prints.

## In-browser verification (how to actually test)

The game exposes `window.__game`. Drive it from a headless browser (Playwright) or the devtools
console. Standard setup to jump straight into play without the menu/intro:

```js
const g = window.__game;
g.controller.onUnlock = () => {};   // don't auto-pause when the pointer isn't locked
g._introDone = true; g._startPlay(); // skip the cinematic, enter "play"
g._onPlayerHit = () => {};          // god-mode for stable screenshots/tests
```

Useful handles: `g.combat.enemies`, `g.level` (`.colliders`, `.explosives`, `.vehicles`,
`.dynamics`, `.bomb`), `g.heli`, `g.weapon`, `g.camera`, `g.vfx`, `g.engine.outline`.

**Prefer numerical assertions over screenshots** — screenshot timing is unreliable because the
`requestAnimationFrame` loop keeps running between your calls. To hold state, freeze a thing
(`enemy.update = () => {}`) or read values right after a deterministic `g.update(dt, t)`. Examples
that worked well: bbox/world-projection math for placement, counting `colliders`/light counts before
vs after an action, firing N shots and asserting an object exploded, measuring camera Y/distance after
a blast. When you do screenshot, set the camera explicitly and call `g.engine.outline.render(scene, camera)`.

## Gotchas that will bite you

- **Changing the scene light count recompiles every shader → a multi-second freeze.** Never
  add/remove a light (or toggle a light's `.visible`) at runtime. Instead keep a persistent light and
  switch its `intensity` (see the shared gunship spotlight and the ammo-pickup fix). Hiding a *mesh*
  is fine; hiding a *light* is not.
- **Two separate damage scales — don't mix them.** Enemies/player: rifle ≈34, enemy HP ~100. Destructibles
  & gunship: "units" (rifle 1, grenade 5, rocket 15; barrels 2–3, tanks 4, cars 7–8, gunship 15).
- **One collider list = solidity for everything.** Register `collide(...)`; don't special-case
  collision in the controller, enemy AI, projectiles, or LOS — they all read `level.colliders`.
- **Line-of-sight is `level.segmentBlocked(ax,az,bx,bz,minTop)`** (2D XZ). Use it before any
  "can this thing hurt the player" check so walls actually provide cover.
- **Input is read by physical key (`event.code`), not `event.key`** — so non-Latin layouts work. Add
  new keybinds by code (`"KeyG"`, `"Digit1"`), and extend the normalizer in `engine/input.js` if needed.
- **No per-shot/per-frame allocations** in hot paths — reuse the pools in `vfx.js` and scratch vectors.
- **Heavy assets/level build:** instance repeated props (see `scatterDesert` → `InstancedMesh`),
  preload GLBs at boot, and "warm up" anything whose first use would hitch (the gunship is pre-compiled
  at boot for this reason).

## Adding content (pointers — full how-to in `skills/`)

- **Level** → a module in `src/game/levels/` + register in `levels/index.js`. Skill: `add-level`.
- **Tuning** → `src/game/config.js` `balance` (+ per-level `config` overrides via `mergeConfig`).
- **Objective** → a module in `src/game/objectives/` + a line in its `index.js` registry.
- **Weapon** → viewmodel in `kit/weapon.js` + a fire branch in `main.js` (the rifle is the *primary*,
  not a dict-gun). Skill: `add-weapon`.
- **Enemy** → `game/actors/{enemy,monster,robot}.js` + `combat.spawnEnemy`. Skill: `add-enemy`.
- **Audio** → `engine/audio.js` real-clip-with-synth-fallback. Skill: `add-audio`.
- **Destructible** → tag `userData.explosive`/`vehicle`, push to `level.explosives`/`vehicles`, hook in
  `combat.js` → `kit/destructibles.js`.

## Conventions for commits/deploys

This kit ships nothing CI-specific; follow the host project's wishes on when to commit/push/deploy.
The reference project deploys the static `dist/` behind `server.js` (Railway). Confirm a deploy by the
server log line `serving dist/ on :PORT`. Keep the engine/game boundary intact in every change.
