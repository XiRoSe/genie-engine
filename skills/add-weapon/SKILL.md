---
name: add-weapon
description: Use when adding, editing, or debugging a player weapon (gun, melee, projectile, energy). Explains the weapon viewmodel system in kit/weapon.js, the FOUR distinct fire paths and how main.update dispatches them, ammo + cooldowns, and how to wire a new weapon. Critical nuance — the rifle is NOT in the guns dict.
---

# Add / debug a weapon

Player weapons are viewmodels in `src/kit/weapon.js`. The fire logic lives in `main.js` (`_fire*`
methods) and `combat.js` (hitscan). Read `engine-overview` first.

## The dispatch (main.js per-frame `update`) — there are several fire paths

```js
const mode = this.weapon.mode;
if (mode === "launcher") { if (firing && weapon.canFireRocket(t)) this._fireRocket(t); }       // Projectile
else if (mode === "plasma") { if (firing && weapon.canFirePlasma(t)) this._firePlasma(t); }    // Projectile (blast)
else if (mode === "laser") { if (firing && weapon.canFireLaser(t)) this._fireLaser(t); }       // hitscan beam
else if (weapon.guns[mode]) { if (firing && weapon.canFireGun(t)) this._fireGun(mode, t); }    // guns DICT
else if (mode === "shotgun") { if (firing && weapon.canFireShotgun(t)) this._fireShotgun(t); }
else if (mode === "sword") { if (firing && weapon.canFireSword(t)) this._swingSword(t); }      // melee arc
else if (firing && weapon.canFire(t)) { combat.tryShoot(t); ... }                              // the PRIMARY RIFLE
```

**Critical, learned the hard way:** the **rifle is the *primary* weapon** — it is **NOT** in
`weapon.guns` (that dict holds only `smg/minigun/burst/railgun/flak`). The rifle fires via the final
`else` (`weapon.canFire(t)` → `combat.tryShoot(t)`). So to test/fire the rifle, use `canFire`/`tryShoot`,
**not** `canFireGun`/`_fireGun` (those silently no-op for the rifle because `guns.rifle` is undefined).

## Weapon state in weapon.js

- `this.mode` — current weapon. `this.owned` — cycle list (Q toggles via `toggle()`).
- `this.guns` — stats for dict-guns (`{rate,kick,sound,pitch,dmg,...}`). `this.A[mode]` — ammo `{mag,size}`.
- `this.allWeapons` — every weapon id. Viewmodel visibility is set in `_showViewmodel()` (one group per mode).
- `canFireGun(t)` = `!!guns[mode] && !reloading && A[mode].mag>0 && (t - _gunLast[mode]) >= guns[mode].rate`.
- **Energy weapons** (sci-fi levels): a gun entry adds `ecolor` (bolt/impact hue), `beam` (beam core hue),
  `esound`, and `fromHands` (fire from the actor's hands, no viewmodel — e.g. Rick's `handlaser`, infinite ammo).
  The level/loadout sets `weapon._energyBeam = true`; then hits draw a `laserBeam` instead of a `tracer` and the
  impact blob is coloured with `ecolor` (see below). Kinetic weapons leave `_energyBeam` false and use the warm hue.

## To add a weapon

1. **Viewmodel:** build/load the mesh group in `weapon.js` (procedural, or a GLB via `kit/content/fpweapons.js`),
   give it a `mode`, toggle visibility in `_showViewmodel()`, add the id to `allWeapons`/`owned` as needed.
2. **Ammo + rate:** add an entry to `this.guns` (dict gun) or give it a dedicated `canFireX`/cooldown.
3. **Fire:** add a branch to the `main.update` dispatch + a `_fireX(t)` method. Hitscan → `combat.tryShoot`
   or `_rayShot(dir, far, pierce)`; projectile → spawn a `Projectile` (see `_fireRocket`/`_firePlasma`)
   and let `_updateProjectiles` + `applyBlast` handle impact.
4. **Sound:** add a method in `engine/audio.js` (real clip + synth fallback — see `add-audio`) and call it on fire.
5. **HUD:** `this._weaponName(mode)` maps mode → display name; `hud.setWeaponName(...)`.

## Hitscan nuances (`_rayShot` / `combat`)

- Ray targets = `level.solidMeshes` + live enemy hitboxes. A `GRACE` margin (≈9m) lets a shot aimed at an
  enemy register even when the ground/a low rise is technically nearer — bump it if shots over undulating
  terrain or at tall mechs miss. `pierce: true` collects all enemies before cover (railgun).
- Enemy hitboxes are capsules/boxes; big mechs (scale 2) have a tall hitbox centered high — aim center-mass.
- **Impacts are surface-aware and go through ONE call:** `_rayShot(dir)` returns `{ point, normal, ... }` and
  `_terrainHit` returns `{ point, normal }` (heightfield-gradient normal). Pass that real normal to
  `vfx.impact(point, normal, color)` — it lays a hit blob oriented to the surface. Colour = `weapon.ecolor` for
  energy, default warm for kinetic. Don't hand-roll a hit effect and don't fake the normal from the ray — see
  `vfx-and-cinematics` › "Surface-aware impacts". New weapons/surfaces get correct impacts for free.
