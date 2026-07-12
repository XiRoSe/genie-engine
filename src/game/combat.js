import * as THREE from "three";
import { Enemy } from "./actors/enemy.js";
import { Monster } from "./actors/monster.js";
import { Robot } from "./actors/robot.js";
import { Meeseeks } from "./actors/meeseeks.js";
import { Janus } from "./actors/janus.js";

// spawn the right actor for a spawn spec's `kind` (default: a rifle soldier)
function makeActor(scene, spawn, level) {
  if (spawn.kind === "meeseeks") return new Meeseeks(scene, spawn, level);
  if (spawn.kind === "janus") return new Janus(scene, spawn, level); // The Collective — boss core + drones
  if (spawn.kind === "monster" || spawn.kind === "spider" || spawn.kind === "trex") return new Monster(scene, spawn, level);
  if (spawn.kind === "robot" || spawn.kind === "sentry" || spawn.kind === "drone" || spawn.kind === "heavy") return new Robot(scene, spawn, level);
  return new Enemy(scene, spawn, level);
}

export class Combat {
  constructor(scene, camera, level, weapon, vfx, audio, hooks) {
    this.scene = scene;
    this.camera = camera;
    this.level = level;
    this.weapon = weapon;
    this.vfx = vfx;
    this.audio = audio;
    this.hooks = hooks; // { onPlayerHit, onKill, onHitmarker }
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 200;

    this.enemies = level.enemySpawns.map((s) => makeActor(scene, s, level));
    this.killCount = 0;
    this.totalEnemies = this.enemies.length;
    this._scene = scene; this._level = level;

    this._dir = new THREE.Vector3();
    this._origin = new THREE.Vector3();
    this._far = new THREE.Vector3();
    this._targets = [];
    this.extraHittables = []; // hitboxes outside the enemy list (e.g. helicopter)
  }

  get enemiesLeft() {
    return this.enemies.filter((e) => !e.dead).length;
  }

  tryShoot(t) {
    if (!this.weapon.canFire(t)) return;
    this.weapon.fire(t);

    // ray from screen center with a little spread
    this.camera.getWorldDirection(this._dir);
    const s = this.weapon.spread;
    this._dir.x += (Math.random() - 0.5) * s;
    this._dir.y += (Math.random() - 0.5) * s;
    this._dir.z += (Math.random() - 0.5) * s;
    this._dir.normalize();
    this._origin.copy(this.camera.position);
    this.raycaster.set(this._origin, this._dir);

    // rebuild target list in place (no per-shot array growth churn)
    this._targets.length = 0;
    for (const m of this.level.solidMeshes) this._targets.push(m);
    for (const e of this.enemies) if (!e.dead) this._targets.push(e.hitbox);
    for (const ht of this.extraHittables) this._targets.push(ht); // e.g. helicopter
    const hits = this.raycaster.intersectObjects(this._targets, true);

    const muzzle = this.weapon.muzzleWorld; // reused vector, copied immediately by tracer
    if (hits.length) {
      const h = hits[0];
      let obj = h.object, enemy = null, heli = null, explosive = null, vehicle = null;
      while (obj) {
        if (obj.userData && obj.userData.enemy) { enemy = obj.userData.enemy; break; }
        if (obj.userData && obj.userData.heli) { heli = obj.userData.heli; break; }
        if (obj.userData && obj.userData.explosive) { explosive = obj.userData.explosive; break; }
        if (obj.userData && obj.userData.vehicle) { vehicle = obj.userData.vehicle; break; }
        obj = obj.parent;
      }
      const icol = this.weapon._energyBeam ? (this.weapon.ecolor || 0x66ff44) : 0xffe2a0; // energy colour vs kinetic
      if (this.weapon._energyBeam) this.vfx.laserBeam(muzzle, h.point, icol); else this.vfx.tracer(muzzle, h.point); // energy bolt in the weapon's own colour
      // REAL surface normal (world space) so the impact blob orients to whatever it hit; fall back to facing the shooter
      const nrm = h.face ? h.face.normal.clone().applyNormalMatrix((this._nm || (this._nm = new THREE.Matrix3())).getNormalMatrix(h.object.matrixWorld)).normalize() : this._far.copy(this._dir).multiplyScalar(-1);
      if (this.weapon._energyBeam) this.vfx.groundHit?.(h.point, icol); // force-field bubble on ANY surface (parity with the ground blob)
      if (enemy && !enemy.dead) {
        const fall = Math.max(0.4, 1 - Math.max(0, h.distance - 28) / 150); // less hit power at range
        enemy.takeDamage(this.weapon.damage * fall);
        this.vfx.impact(h.point, nrm, icol);
        this.hooks.onHitmarker?.(enemy.dead);
      } else if (heli && !heli.dead) {
        heli.takeDamage(1); // 1 unit per rifle shot -> 15-unit gunship = 15 shots
        this.vfx.impact(h.point, nrm, icol);
        this.hooks.onHitmarker?.(heli.dead);
      } else if (explosive && !explosive.exploded) {
        this.vfx.impact(h.point, nrm, icol); // sparks on the hull
        this.hooks.onExplosive?.(explosive, 1); // 1 unit per shot — main blows it up at 0 HP
      } else if (vehicle && !vehicle.exploded) {
        this.vfx.impact(h.point, nrm, icol); // sparks on the hull
        this.hooks.onVehicleHit?.(vehicle, 1); // 1 unit per shot; main blows it up at 0
      } else {
        this.vfx.impact(h.point, nrm, icol); // wall / structure — surface-aligned blob
      }
    } else {
      this._far.copy(this._origin).addScaledVector(this._dir, 120);
      if (this.weapon._energyBeam) this.vfx.laserBeam(muzzle, this._far); else this.vfx.tracer(muzzle, this._far);
    }
  }

  // add a reinforcement enemy at runtime (already alert); returns the actor
  spawnEnemy(spec) {
    const e = makeActor(this._scene, spec, this._level);
    e.aggro = true; if (e.state !== undefined) { e.state = "alert"; e.alertT = 99; }
    this.enemies.push(e); this.totalEnemies++;
    this.hooks.onHostiles?.(this.enemies.filter((x) => !x.dead).length);
    return e;
  }

  update(dt, t, playerPos) {
    const groundUnderPlayer = this.level.terrainHeight ? this.level.terrainHeight(playerPos.x, playerPos.z) : 0;
    const ctx = {
      vfx: this.vfx,
      audio: this.audio,
      onPlayerHit: (dmg) => this.hooks.onPlayerHit?.(dmg),
      enemyFire: (o) => this.hooks.onEnemyFire?.(o), // enemies call ctx.enemyFire(...) → routes to the runner
      onBossBeam: () => this.hooks.onBossBeam?.(),
      // the Collective boss summons drones near itself (capped so it never runaway-swarms)
      spawnDrone: (pos) => { if (this.enemies.filter((e) => e.kind === "janus" && !e.boss && !e.dead).length >= 16) return; const a = Math.random() * 6.28, r = 8 + Math.random() * 10; this.spawnEnemy({ kind: "janus", x: pos.x + Math.cos(a) * r, z: pos.z + Math.sin(a) * r }); },
      airborne: (playerPos.y - groundUnderPlayer) > 20, // flying high (jetpack) — enemies can't hit you
    };
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(dt, playerPos, ctx);
      if (e.dead && !e.counted) {
        e.counted = true;
        this.killCount++;
        this.hooks.onKill?.(this.killCount, this.enemiesLeft);
      }
      if (e.removable) {
        this.scene.remove(e.group);
        this.enemies.splice(i, 1);
      }
    }
  }
}
