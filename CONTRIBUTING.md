# Contributing

Thanks for building on **GENIE** (a Generative Engine for Native Interactive Experiences)! It's a small, flat, framework-free codebase — keep it
that way and changes stay easy to review.

## Setup

```bash
npm install
npm run dev      # http://localhost:5180
```

## Before you open a PR

```bash
npm run lint     # enforces the engine/kit/game import boundary (must pass)
npm run build    # must end "✓ built"
```

Then load the page and confirm **0 console errors**.

### Recommended CI

Add this as `.github/workflows/ci.yml` (via the GitHub web UI → "Add file", which has the `workflow`
permission) so every PR runs `lint` + `build`:

```yaml
name: CI
on:
  push: { branches: [master, main] }
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run lint   # enforces the engine/kit/game import boundary
      - run: npm run build  # catches syntax/import breakage before merge
```

## The one rule that keeps this clean

**Dependency tiers** (see [ARCHITECTURE.md](ARCHITECTURE.md)):

- `src/engine/` — generic, content-agnostic. Imports **nothing** from `kit/` or `game/`.
- `src/kit/` — the military-FPS toolkit. May use `engine/`, **not** `game/`.
- `src/game/` — this game's content/rules. May use both.

`npm run lint` enforces this mechanically. If you find yourself wanting an `engine/` file to know about
walls/vehicles/objectives, it belongs in `kit/` or `game/` — or inject the data (see how `config.balance`
is passed into `LevelBuilder`).

## Where things go (full how-to in the [skills/](skills/) task skills)

| Want to add… | Do this |
|---|---|
| A **level** | a module in `src/game/levels/` + a line in `levels/index.js` |
| **Tuning** (HP, damage, timings) | `src/game/config.js` → `balance` (or a level's `config` override) |
| An **objective** | a module in `src/game/objectives/` + a line in its `index.js` |
| A **weapon** | a viewmodel in `kit/weapon.js` + a key in `main.js` |
| A **destructible** | tag `userData.explosive`/`vehicle` in the `LevelBuilder`; routed via `kit/destructibles.js` |

## House style

- **Flat over abstract** — prefer data in `config.js` + small modules over new layers/patterns.
- **One source of truth for solidity** — register `collide(...)`; everything (movement, AI, bullets,
  line-of-sight) reads `level.colliders`.
- **No per-frame/per-shot allocations** in hot paths — reuse the `vfx.js` pools and scratch vectors.
- **Never toggle a light's visibility / add/remove lights at runtime** — it recompiles every shader
  (multi-second freeze). Keep a persistent light and change its `intensity`.
- **Read keys by `event.code`** (physical key), so non-Latin keyboard layouts work.

## Verifying gameplay

The game exposes `window.__game` for scripted/headless checks — see the in-browser verification
workflow in [AGENTS.md](AGENTS.md). A small smoke-test harness (`npm test`) is a welcome contribution.

## Assets

Use **CC0/MIT** assets only and credit them in the README. Keep models low-poly to match the
cel-shaded look.
