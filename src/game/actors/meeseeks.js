import * as THREE from "three";
import { MEESEEKS_MODEL, RM_HAND_BONE } from "./rickmorty-assets.js";
import { makeHeldGun } from "./heldguns.js";
import { makeGunModel } from "./gunmodels.js";

// MR. MEESEEKS enemy — now SKELETALLY ANIMATED (Mesh2Motion rig). Walk_Loop plays while chasing; the held
// weapon (gun/rocket variants) is parented to the right-hand bone so it's properly held + follows the walk
// (Mesh2Motion couldn't pose a weapon-hold, so we attach it in-engine). spawn.huge = bigger/tankier; spawn.weapon
// = "melee"|"gun"|"rocket". Poofs into a blue cloud on death. Procedural fallback if the rigged GLB is absent.
export class Meeseeks {
  constructor(scene, spawn, level) {
    this.scene = scene; this.level = level; this.kind = "meeseeks";
    this.giant = !!spawn.giant;                                   // rare colossus — 3x the huge size
    this.huge = !!spawn.huge || this.giant;                        // giants inherit all the "huge" behaviour
    this.weapon = spawn.weapon === "melee" ? "gun" : (spawn.weapon || "gun"); // every Meeseeks is armed (no melee)
    this.pos = new THREE.Vector3(spawn.x, 0, spawn.z);
    this.hp = spawn.hp || (this.giant ? 1650 : this.huge ? 510 : 135); // giants are colossally tanky
    this.speed = spawn.speed || (this.giant ? (3.4 + Math.random()) * 1.1 : this.huge ? (4.2 + Math.random()) * 1.1 : 6.5 + Math.random() * 1.5); // big Meeseeks stride 10% faster
    this.reach = this.weapon === "rocket" ? 22 : this.weapon === "gun" ? 14 : (this.huge ? 3.4 : 2.2);
    this.dead = false; this.counted = false; this.removable = false;
    this.aggro = false; this.aggroRange = spawn.aggro || (this.giant ? 60 : this.huge ? 46 : 34);
    this.yaw = 0; this._atkCd = Math.random() * 1.5; this._t = Math.random() * 6; this._walkW = 0;
    this.sc = this.giant ? 11.4 : this.huge ? 7.6 : 1.0;          // mega/giant Meeseeks (halved from 22.8 — still a kaiju)

    this.group = new THREE.Group(); this.group.position.copy(this.pos); scene.add(this.group);
    this._invScale = 1;
    if (MEESEEKS_MODEL.ready) {
      const inst = MEESEEKS_MODEL.make({ rightHand: RM_HAND_BONE });
      inst.model.scale.multiplyScalar(this.sc);                 // huge variants scale on top of the rig scale
      this.group.add(inst.model); this._model = inst.model;
      this.mixer = new THREE.AnimationMixer(inst.model);
      for (const c of inst.animations) if (/walk/i.test(c.name) && !this._walk) this._walk = this.mixer.clipAction(c);
      if (this._walk) { this._walk.play(); this._walk.setEffectiveWeight(0); }
      this._hand = inst.bones.rightHand;
      this._invScale = (MEESEEKS_MODEL._asset ? 1 / MEESEEKS_MODEL._asset.scale : 1);
      this._glb = true;
    } else { this._buildProcedural(); }

    if (this.weapon !== "melee") {                              // held weapon: parented to the group (native scale),
      const wk = this.weapon === "rocket" ? "rocket" : "gun";  // real CC0 model when loaded, else procedural
      this._gun = makeGunModel(wk) || makeHeldGun(wk === "gun" ? "rifle" : wk);
      this._gun.scale.setScalar(this.sc); this.group.add(this._gun); this._tmp = new THREE.Vector3(); // weapon scales with the Meeseeks (huge/giant carry huge/giant guns)
      if (!this._hand) this._gun.position.set(0.42 * this.sc, 1.15 * this.sc, 0.32 * this.sc);
    }

    // Hitbox scaled with the Meeseeks — a generously WIDE box centred on the model mid-height (feet→head span
    // 0..2*sc). Height/width scale with sc so shots register on any size (normal/huge/giant). NB: we deliberately
    // do NOT use Box3.setFromObject here — on a skinned mesh it ignores bone transforms and returns a bogus box.
    const hbMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }); hbMat.userData.outlineParameters = { visible: false };
    const hbW = 1.4 * this.sc, hbH = 2.0 * this.sc;
    this.hitbox = new THREE.Mesh(new THREE.BoxGeometry(hbW, hbH, hbW), hbMat); this.hitbox.position.y = hbH / 2;
    this.hitbox.userData.enemy = this; this.group.add(this.hitbox);
  }

  _buildProcedural() {
    const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, flatShading: true, ...o });
    const BLUE = this.huge ? 0x2f7fb0 : 0x49a9d6, s = this.sc, G = this.group;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42 * s, 1.0 * s, 6, 12), mat(BLUE)); body.position.y = 1.15 * s; G.add(body);
    for (const sx of [-0.17, 0.17]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 12, 10), mat(0xffffff, { roughness: 0.3 })); eye.position.set(sx * s, 1.62 * s, 0.34 * s); G.add(eye);
      const pup = new THREE.Mesh(new THREE.SphereGeometry(0.06 * s, 8, 6), mat(0x0a0a0a)); pup.position.set(sx * s, 1.62 * s, 0.47 * s); G.add(pup);
    }
    G.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }

  takeDamage(dmg) { if (this.dead) return; this.aggro = true; this.hp -= dmg; if (this.hp <= 0) this._die(); }

  _die() {
    this.dead = true; this.hitbox.userData.enemy = null; this.hitbox.visible = false;
    this._deathT = 0.5 + this.sc * 0.12;                           // bigger Meeseeks poofs linger longer
    this._puffAt = this.group.position.clone();                    // keep puffing here after the body vanishes
    if (this._ctx) {
      const p = this.group.position, vfx = this._ctx.vfx, sc = this.sc;
      const n = Math.round((this.huge ? 30 : 16) * (this.giant ? 2.6 : 1)); // blue debris puffs — many more, bigger they are
      for (let i = 0; i < n; i++) vfx?.dustBurst?.(new THREE.Vector3(p.x + (Math.random() - 0.5) * 1.8 * sc, p.y + (0.4 + Math.random() * 1.9) * sc, p.z + (Math.random() - 0.5) * 1.8 * sc));
      const sm = Math.round((this.huge ? 16 : 7) * (this.giant ? 2.6 : 1)); // billowing dark SMOKE, size-scaled
      for (let i = 0; i < sm; i++) vfx?._dustPuff?.(new THREE.Vector3(p.x + (Math.random() - 0.5) * 1.9 * sc, p.y + (0.5 + Math.random() * 2.1) * sc, p.z + (Math.random() - 0.5) * 1.9 * sc), 0x2c3038, (0.6 + Math.random() * 1.1) * sc);
      vfx?._flash?.(new THREE.Vector3(p.x, p.y + sc, p.z), 1.8 * sc, 0x9fe0ff);
      vfx?._shockwave?.(new THREE.Vector3(p.x, p.y + 0.2, p.z)); // ground shock ring
      this._ctx.audio?.poof?.(sc);                                 // cool puff sound, deeper/louder the bigger they are
      // no voice on death. The Meeseeks voice line plays ONLY when they fall from the sky (see main._dropReinforcement)
    }
    this.group.visible = false; // poof = gone
  }

  update(dt, playerPos, ctx) {
    this._ctx = ctx; this._t += dt;
    if (this.mixer) this.mixer.update(dt);
    const gy = this.level.terrainHeight ? this.level.terrainHeight(this.pos.x, this.pos.z) : 0;
    if (this.dead) {
      if (this._puffAt && ctx.vfx?.dustBurst) { const q = this.giant ? 6 : this.huge ? 3 : 1, a = this._puffAt, sc = this.sc; // lingering dust + smoke cloud, size-scaled
        for (let i = 0; i < q; i++) ctx.vfx.dustBurst(new THREE.Vector3(a.x + (Math.random() - 0.5) * 1.5 * sc, a.y + (0.3 + Math.random() * 2.1) * sc, a.z + (Math.random() - 0.5) * 1.5 * sc));
        for (let i = 0; i < q; i++) ctx.vfx._dustPuff?.(new THREE.Vector3(a.x + (Math.random() - 0.5) * 1.7 * sc, a.y + (0.5 + Math.random() * 2.3) * sc, a.z + (Math.random() - 0.5) * 1.7 * sc), 0x2c3038, (0.5 + Math.random()) * sc); }
      if ((this._deathT -= dt) <= 0) this.removable = true; return;
    }
    const dx = playerPos.x - this.pos.x, dz = playerPos.z - this.pos.z, d = Math.hypot(dx, dz) || 1;
    let moving = false;
    if (!this.aggro) { if (d <= this.aggroRange) this.aggro = true; else { this._anim(gy, false); return; } }
    this.yaw = Math.atan2(dx, dz); this.group.rotation.y = this.yaw;
    if (d > this.reach) {
      const step = this.speed * dt;
      const nx = this.pos.x + (dx / d) * step, nz = this.pos.z + (dz / d) * step;
      if (!this._blocked(nx, this.pos.z)) this.pos.x = nx;
      if (!this._blocked(this.pos.x, nz)) this.pos.z = nz;
      moving = true;
    } else if ((this._atkCd -= dt) <= 0) {
      // Meeseeks are ranged only — they never melee, they shoot from `reach` away
      this._atkCd = this.weapon === "rocket" ? (2.4 + Math.random() * 0.9) : (0.8 + Math.random() * 0.5);
      if (!ctx.airborne && !this.level.segmentBlocked(this.pos.x, this.pos.z, playerPos.x, playerPos.z)) {
        const fx = this.pos.x + (dx / d) * 0.7 * this.sc, fz = this.pos.z + (dz / d) * 0.7 * this.sc, my = gy + 1.3 * this.sc; // from the (scaled) gun height
        ctx.enemyFire?.({ from: { x: fx, y: my, z: fz }, to: { x: playerPos.x, y: playerPos.y, z: playerPos.z }, kind: this.weapon, sc: this.sc, dmg: this.weapon === "rocket" ? (this.giant ? 110 : this.huge ? 60 : 28) : (this.giant ? 34 : this.huge ? 18 : 7) });
      }
    }
    this._anim(gy, moving);
  }

  // skeletal walk crossfade when rigged; bouncy hop/waddle on the procedural fallback
  _anim(gy, moving) {
    if (this.mixer) {
      this._walkW += ((moving ? 1 : 0) - this._walkW) * Math.min(1, 0.18);
      if (this._walk) { this._walk.setEffectiveWeight(this._walkW); this._walk.setEffectiveTimeScale(4); } // 4x → reads as a run
      this.group.position.set(this.pos.x, gy, this.pos.z);
    } else {
      const hop = moving ? Math.abs(Math.sin(this._t * (this.huge ? 9 : 13))) * 0.2 * this.sc : Math.abs(Math.sin(this._t * 3)) * 0.06 * this.sc;
      this.group.position.set(this.pos.x, gy + hop, this.pos.z);
    }
    if (this._hand && this._gun) { // snap the held weapon to the hand bone, pointing forward (+Z = facing dir)
      this._hand.updateWorldMatrix(true, false); this._hand.getWorldPosition(this._tmp); this.group.worldToLocal(this._tmp);
      this._gun.position.copy(this._tmp); this._gun.position.z += 0.15 * this.sc; this._gun.rotation.set(0, 0, 0);
    }
  }

  _blocked(x, z) {
    const minTop = this.giant ? 3.0 : 0.6;  // the GIANT passes trees/props/rocks (short colliders) — only BUILDINGS/walls (top ≥ ~3.4) stop it
    for (const c of this.level.colliders) {
      if (c.top < minTop) continue;
      if (x > c.minX - 0.5 && x < c.maxX + 0.5 && z > c.minZ - 0.5 && z < c.maxZ + 0.5) return true;
    }
    return false;
  }
}
