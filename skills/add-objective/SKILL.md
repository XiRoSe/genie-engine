---
name: add-objective
description: Use when adding or editing a win/lose goal — collect, defuse, exfil, slay (boss), or a brand-new objective type. Covers the objective module interface, the registry, the runner's win/lose split, and the shipped objectives.
---

# Add / edit an objective

An objective decides the win/lose **conditions**; the runner (`main.js`) owns the **state transitions**
(`_win`, `_lose`, the detonation/victory cinematics). Read `engine-overview` first.

## The interface

Each objective is a small class in `src/game/objectives/` with:

```js
class MyObjective {
  constructor(game) { this.game = game; this.total = game.cfg.objective.count; }
  brief() { return "<HTML mission briefing for the start screen>"; }
  onPlayStart() { /* set HUD objective text + counters when play begins */ }
  update(dt, t, presses) {
    // check progress every frame; when the goal is met, call the runner:
    // this.game._win({ cinematic: true, ... });   // or _lose(...)
  }
}
```

Register it in `src/game/objectives/index.js`:

```js
export function makeObjective(type, game) {
  if (type === "defuse") return new DefuseObjective(game);
  if (type === "collect") return new CollectObjective(game);
  if (type === "slay") return new SlayObjective(game);
  return new ExfilObjective(game);            // default
}
```

A level selects it via `config.objective.type` (+ type-specific fields like `count`, `timeLimit`,
`codeLength`, `maxTries`). No runner edits needed for a new type — just the module + the registry line.

## The shipped objectives

- **`collect`** (ARCFALL / Meeseeks) — recover all `count` Arcs/Rings (`level.arcs`, each beams to the sky). Region-entry
  banners + per-Arc fanfare; on the last Arc calls `_win({ cinematic: true })` (the shrink-world + victory crawl).
- **`defuse`** (NightOps) — reach the `bomb(x,z)`, enter the code before `timeLimit`; a wrong-attempt limit calls
  `_detonate()`. Uses a self-working "mentalist" code puzzle.
- **`exfil`** — clear every enemy, then walk into the `objective(x,z,r)` flag radius.
- **`slay`** (Rick vs The Collective) — win when the single **boss** enemy dies. Latches the first `combat.enemies`
  actor with `.boss === true`, shows a live boss-HP % via `hud.setCounter`, and calls `_win({ cinematic:true })`
  when `boss.dead`. The level marks its boss with a spawn `{ kind, boss:true }` pushed straight to `enemySpawns`
  (bypass `b.enemy()`, which would shove it off its dais). Config: `objective:{ type:"slay", noun, startLabel, startSub }`.

## Notes

- The runner exposes `_win(extra)` / `_lose(sub, title)`; pass `{ cinematic: true }` for the full end sequence
  (see `vfx-and-cinematics`). The objective should NOT manage state/music itself — let the runner do it.
- Analytics: `_win`/`_lose` already call `trackEnd(finished)` — a win passes `true`, everything else `false`.
- Verify by forcing completion in-browser (`g.objective.collected = g.objective.total; g._win({cinematic:true})`).
