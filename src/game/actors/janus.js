import * as THREE from "three";
import { JANUS_MODEL } from "./collective-assets.js";

// THE COLLECTIVE — a cube-headed armoured "Janus Knight". ONE static Meshy model reused at two scales:
//  • BOSS (spawn.boss) — a kaiju-scale meditating CORE that levitates over its dais, never walks, and rains
//    psychic orb volleys + beam sweeps while summoning drones.
//  • DRONE (default)   — a person-plus-sized hive body that hovers toward Rick and fires energy bolts.
// No skeleton/animations → the actor bobs/levitates it procedurally. Purple-smoke poof on death. Mirrors the
// Meeseeks actor contract exactly (pos/hp/hitbox/takeDamage/update/_die) so the combat runner treats it the same.
export class Janus {
  constructor(scene, spawn, level) {
    this.scene = scene; this.level = level; this.kind = "janus";
    this.boss = !!spawn.boss;
    this.weapon = spawn.weapon || "gun";
    this.pos = new THREE.Vector3(spawn.x, 0, spawn.z);
    this.sc = this.boss ? 15 : 1.3;                              // shared model — the CORE is a colossus (2x bigger)
    this.hp = spawn.hp || (this.boss ? 5200 : 120);             // the core is brutally tanky
    this.speed = spawn.speed || (this.boss ? 0 : 3.2 + Math.random() * 0.8); // the boss never walks
    this.reach = this.boss ? 999 : 13;                           // drones shoot from ~13 out; the boss fires at any range in aggro
    this.dead = false; this.counted = false; this.removable = false;
    // the boss engages across the WHOLE vast arena (else it just sits there while you're far away = "doesn't shoot")
    this.aggro = false; this.aggroRange = spawn.aggro || (this.boss ? 340 : 40);
    this.yaw = 0; this._t = Math.random() * 6;
    // levitate: drones hover ~0.3 above the floor; the core floats high over its dais (2.5*sc*0.3)
    this.floatH = this.boss ? (2.5 * this.sc * 0.3) : 0.3;
    this._atkCd = 1 + Math.random() * 2;                          // drone: OCCASIONAL ranged bolt
    this._grabCd = Math.random() * 0.6; this._lunge = 0;        // drone: melee GRAB cooldown + lunge timer
    this._sumCd = 2 + Math.random() * 2;                         // boss: drone-summon cooldown (its only offense)
    this._tmp = new THREE.Vector3(); this._from = new THREE.Vector3(); this._to = new THREE.Vector3();

    this.group = new THREE.Group(); this.group.position.copy(this.pos); scene.add(this.group);
    if (JANUS_MODEL.ready) {
      const m = JANUS_MODEL.make(); m.scale.multiplyScalar(this.sc); this.group.add(m); this._model = m;
      if (this.boss) m.traverse((o) => {                          // crank the boss's purple/pink emission so the core glows menacingly
        if (o.isMesh && o.material) { o.material = o.material.clone(); if ("emissiveIntensity" in o.material) o.material.emissiveIntensity = (o.material.emissiveIntensity || 1) * 2.4; }
      });
    } else { this._buildProcedural(); }

    if (this.boss) {                                              // a slowly-spinning glowing halo at the core's chest (no real light — emissive-basic only)
      this._halo = new THREE.Mesh(new THREE.TorusGeometry(0.95 * this.sc, 0.09 * this.sc, 8, 28), new THREE.MeshBasicMaterial({ color: 0xd06bff }));
      this._halo.position.y = 1.25 * this.sc; this._halo.rotation.x = Math.PI / 2; this.group.add(this._halo);
    }

    // Invisible hitbox (colorWrite off, ignored by the outline pass). Centred on the model's mid-height so
    // centre-mass shots on the FLOATING body register — the whole group is lifted by floatH each frame, so the
    // hitbox rides up with it. Box3.setFromObject is avoided (bogus on these posed groups); we size from sc.
    const hbMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }); hbMat.userData.outlineParameters = { visible: false };
    const hbW = (this.boss ? 3.0 : 1.4) * this.sc, hbH = (this.boss ? 3.0 : 2.0) * this.sc;
    this.hitbox = new THREE.Mesh(new THREE.BoxGeometry(hbW, hbH, hbW), hbMat);
    this.hitbox.position.y = 1.0 * this.sc;                       // ≈ model vertical centre (model spans 0..2*sc); group's floatH lifts it into place
    this.hitbox.userData.enemy = this; this.group.add(this.hitbox);
  }

  // procedural fallback: a squat armoured torso with a floating CUBE head + glowing eye-visor. Cel-friendly flat shading.
  _buildProcedural() {
    const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, flatShading: true, ...o });
    const s = this.sc, G = this.group, ARM = 0x3a2b52, GLOW = this.boss ? 0xd06bff : 0xb14bff;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9 * s, 1.1 * s, 0.55 * s), mat(ARM)); torso.position.y = 1.05 * s; G.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.62 * s, 0.62 * s, 0.62 * s), mat(0x241834, { emissive: GLOW, emissiveIntensity: this.boss ? 0.9 : 0.4 })); head.position.y = 1.85 * s; G.add(head);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.14 * s, 0.05 * s), new THREE.MeshBasicMaterial({ color: GLOW })); visor.position.set(0, 1.9 * s, 0.32 * s); G.add(visor);
    for (const sx of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22 * s, 0.9 * s, 0.22 * s), mat(ARM)); arm.position.set(sx * 0.62 * s, 1.05 * s, 0); G.add(arm); }
    G.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }

  takeDamage(dmg) { if (this.dead) return; this.aggro = true; this.hp -= dmg; if (this.hp <= 0) this._die(); }

  _die() {
    this.dead = true; this.hitbox.userData.enemy = null; this.hitbox.visible = false;
    this._deathT = 0.6 + this.sc * 0.15;                          // bigger bodies linger longer
    this._puffAt = this.group.position.clone();                   // keep puffing here after the body vanishes
    if (this._ctx) {
      const p = this.group.position, vfx = this._ctx.vfx, sc = this.sc, big = this.boss;
      const n = Math.round((big ? 64 : 18) );                     // PURPLE debris burst — the core detonates far bigger
      for (let i = 0; i < n; i++) vfx?.dustBurst?.(new THREE.Vector3(p.x + (Math.random() - 0.5) * 1.8 * sc, p.y + (0.4 + Math.random() * 1.9) * sc, p.z + (Math.random() - 0.5) * 1.8 * sc));
      const sm = Math.round(big ? 34 : 8);                        // billowing purple smoke
      for (let i = 0; i < sm; i++) vfx?._dustPuff?.(new THREE.Vector3(p.x + (Math.random() - 0.5) * 1.9 * sc, p.y + (0.5 + Math.random() * 2.1) * sc, p.z + (Math.random() - 0.5) * 1.9 * sc), 0x6a2a9a, (0.6 + Math.random() * 1.1) * sc);
      vfx?._flash?.(new THREE.Vector3(p.x, p.y + sc, p.z), 2 * sc, 0xd06bff);
      vfx?._shockwave?.(new THREE.Vector3(p.x, p.y + 0.2, p.z));  // ground shock ring
      this._ctx.audio?.poof?.(sc);
    }
    this.group.visible = false;                                   // poof = gone
  }

  update(dt, playerPos, ctx) {
    this._ctx = ctx; this._t += dt;
    const gy = this.level.terrainHeight ? this.level.terrainHeight(this.pos.x, this.pos.z) : 0;

    if (this.dead) {
      if (this._puffAt && ctx.vfx?.dustBurst) { const q = this.boss ? 5 : 1, a = this._puffAt, sc = this.sc; // lingering purple cloud
        for (let i = 0; i < q; i++) ctx.vfx.dustBurst(new THREE.Vector3(a.x + (Math.random() - 0.5) * 1.5 * sc, a.y + (0.3 + Math.random() * 2.1) * sc, a.z + (Math.random() - 0.5) * 1.5 * sc));
        for (let i = 0; i < q; i++) ctx.vfx._dustPuff?.(new THREE.Vector3(a.x + (Math.random() - 0.5) * 1.7 * sc, a.y + (0.5 + Math.random() * 2.3) * sc, a.z + (Math.random() - 0.5) * 1.7 * sc), 0x6a2a9a, (0.5 + Math.random()) * sc); }
      if ((this._deathT -= dt) <= 0) this.removable = true; return;
    }

    const dx = playerPos.x - this.pos.x, dz = playerPos.z - this.pos.z, d = Math.hypot(dx, dz) || 1;
    if (!this.aggro) { if (d <= this.aggroRange) this.aggro = true; else { this._hover(gy); return; } }

    if (this.boss) this._boss(dt, playerPos, dx, dz, d, gy, ctx);
    else this._drone(dt, playerPos, dx, dz, d, gy, ctx);
  }

  // ── DRONE: hover toward Rick, face him, fire energy bolts from ~reach ──────────────────────────────
  _drone(dt, playerPos, dx, dz, d, gy, ctx) {
    this.yaw = Math.atan2(dx, dz); this.group.rotation.y = this.yaw;
    const GRAB = 2.8;                                             // melee "grab" range
    if (d > GRAB) {                                              // CHASE Rick across the flat arena (blocked only by tall colliders)
      const step = this.speed * dt, nx = this.pos.x + (dx / d) * step, nz = this.pos.z + (dz / d) * step;
      if (!this._blocked(nx, this.pos.z)) this.pos.x = nx;
      if (!this._blocked(this.pos.x, nz)) this.pos.z = nz;
      // SOMETIMES shoot while closing in — an occasional purple bolt at mid range (long cd + a coin-flip = "sometimes")
      if (d < this.reach && (this._atkCd -= dt) <= 0) {
        this._atkCd = 2.2 + Math.random() * 2.0;
        if (Math.random() < 0.55 && !ctx.airborne && !this.level.segmentBlocked?.(this.pos.x, this.pos.z, playerPos.x, playerPos.z)) {
          const my = gy + this.floatH + 1.1 * this.sc, fx = this.pos.x + (dx / d) * 0.6 * this.sc, fz = this.pos.z + (dz / d) * 0.6 * this.sc;
          ctx.enemyFire?.({ from: { x: fx, y: my, z: fz }, to: { x: playerPos.x, y: playerPos.y, z: playerPos.z }, kind: "gun", sc: this.sc, dmg: 7 });
        }
      }
    } else if ((this._grabCd -= dt) <= 0) {                       // GRAB: latch onto Rick — a hard melee lunge + claw flash + shake
      this._grabCd = 1.0 + Math.random() * 0.5;
      ctx.onPlayerHit?.(14);
      const gp = this._tmp.set(playerPos.x, playerPos.y + 0.3, playerPos.z);
      ctx.vfx?._flash?.(gp, 1.4, 0xd06bff); ctx.vfx?._embers?.(gp, 0xd06bff, 8, 5);
      ctx.audio?.hurt?.();
      this._lunge = 0.12;                                        // brief forward lunge so the grab reads visually
    }
    if (this._lunge > 0) { this._lunge -= dt; this.pos.x += (dx / d) * dt * 6; this.pos.z += (dz / d) * dt * 6; } // snap toward Rick on the grab
    this._hover(gy);
  }

  // ── BOSS: a pure SUMMONER — it never shoots; it looms, meditates, and endlessly births drone-bodies of itself
  // that swarm and chase Rick. The whole threat is the hive it spawns. ─────────────────────────────────────────
  _boss(dt, playerPos, dx, dz, d, gy, ctx) {
    // slow, menacing yaw lerp (yaw only) toward the player
    let dyaw = Math.atan2(dx, dz) - this.yaw; while (dyaw > Math.PI) dyaw -= Math.PI * 2; while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    this.yaw += dyaw * Math.min(1, dt * 0.9); this.group.rotation.y = this.yaw;

    const cy = gy + this.floatH + 1.35 * this.sc;                 // chest / eye height on the floating core
    // SUMMON: birth 1-2 drones near the core on a short cooldown (the runner caps the live swarm size)
    if ((this._sumCd -= dt) <= 0) {
      this._sumCd = 2.4 + Math.random() * 1.6;
      if (ctx.spawnDrone) {
        const n = 1 + (Math.random() * 2 | 0);                    // 1..2 at a time → a persistent, growing swarm
        for (let i = 0; i < n; i++) ctx.spawnDrone(this.pos);
        ctx.vfx?._flash?.(new THREE.Vector3(this.pos.x, cy, this.pos.z), 3 * this.sc * 0.25, 0xd06bff); // birth flash
        ctx.audio?.zap?.();
      }
    }
    if (this._halo) this._halo.rotation.z += dt * 0.8;            // gently spin the glowing halo
    this._hover(gy);
  }

  // levitate + slow bob applied to the whole group (model + hitbox ride along)
  _hover(gy) {
    const bob = Math.sin(this._t * (this.boss ? 0.9 : 1.8)) * (this.boss ? 0.5 * this.sc : 0.12);
    this.group.position.set(this.pos.x, gy + this.floatH + bob, this.pos.z);
  }

  // only tall colliders (buildings/walls, top ≥ ~3) stop the drone — it drifts over props/rocks
  _blocked(x, z) {
    if (!this.level.colliders) return false;
    for (const c of this.level.colliders) {
      if (c.top < 3.0) continue;
      if (x > c.minX - 0.5 && x < c.maxX + 0.5 && z > c.minZ - 0.5 && z < c.maxZ + 0.5) return true;
    }
    return false;
  }
}
