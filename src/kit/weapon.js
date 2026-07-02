import * as THREE from "three";
import { COLORS, box } from "../engine/primitives.js";
import { makeLauncher } from "./content/weapons.js";
import { makeFpWeapon } from "./content/fpweapons.js";

// First-person rifle: viewmodel, ammo, recoil spring, muzzle flash.
export class Weapon {
  constructor(camera, audio) {
    this.camera = camera;
    this.audio = audio;
    // unified magazine + reserve ammo for every ranged weapon: { mag (loaded), size (mag capacity), reserve }
    this.A = {
      handlaser: { mag: 9999, size: 9999, reserve: 9999 }, // Rick's innate palm-laser — effectively infinite
      rifle:   { mag: 30, size: 30, reserve: 120 },
      smg:     { mag: 30, size: 30, reserve: 120 },
      minigun: { mag: 60, size: 60, reserve: 180 },
      burst:   { mag: 24, size: 24, reserve: 96 },
      railgun: { mag: 4,  size: 4,  reserve: 16 },
      flak:    { mag: 8,  size: 8,  reserve: 32 },
      laser:   { mag: 40, size: 40, reserve: 120 },
      plasma:  { mag: 6,  size: 6,  reserve: 18 },
    };
    this.fireRate = 0.092; // ~650 rpm
    this.reloadTime = 1.5;
    this.damage = 34;
    this.spread = 0.012;
    this._lastShot = -1;
    this.reloading = false;
    this._reloadT = 0;

    this.group = new THREE.Group();
    this._build();
    camera.add(this.group);

    // secondary weapon: missile launcher (real model viewmodel), toggled with Q
    this.mode = "rifle";          // "rifle" | "launcher"
    this.rockets = 4;
    this.rocketRate = 3.0;        // reload time between rockets
    this._lastRocket = -10;
    this._rocketLoaded = true;    // a missile sits in the tube; gone for 3s after firing
    this.launcher = new THREE.Group();
    this.launcher.visible = false;
    this.launcher.position.set(0.32, -0.44, -0.34); // pulled in close so it reads as shoulder-held
    this.launcher.rotation.set(0.05, Math.PI, 0);
    this.launcher.scale.setScalar(0.98);
    camera.add(this.launcher);

    // weapons cycled with Q — sword (melee) always owned; plasma/laser unlocked via island pickups
    this.owned = ["rifle", "sword", "launcher"]; // mode order for cycling
    this.plasmaRate = 0.5; this._lastPlasma = -10;
    this.laserRate = 0.11; this._lastLaser = -10; // rapid laser rifle
    this.swordRate = 0.5; this._lastSword = -10;
    this.energy = new THREE.Group(); this.energy.visible = false;
    this.energy.position.set(0.32, -0.34, -0.4); this.energy.rotation.set(0, Math.PI, 0);
    camera.add(this.energy);
    this._buildEnergy();
    this.laserGun = new THREE.Group(); this.laserGun.visible = false;
    this.laserGun.position.set(0.32, -0.34, -0.4); this.laserGun.rotation.set(0, Math.PI, 0);
    camera.add(this.laserGun);
    this._buildLaserGun();
    this.shotgunGun = new THREE.Group(); this.shotgunGun.visible = false;
    this.shotgunGun.position.set(0.32, -0.34, -0.4); this.shotgunGun.rotation.set(0, Math.PI, 0);
    camera.add(this.shotgunGun);
    // generic hitscan guns (one shared viewmodel slot; model swapped per mode)
    this.guns = {
      handlaser: { model: null, rate: 0.13, ammo: 9999, dmg: 11, pellets: 1, spread: 0.018, sound: "zap", pitch: 1.15, beam: 0x66ff44, ecolor: 0x44ff44, esound: "zap", kick: 0.03, fromHands: true }, // Rick's innate GREEN palm-lasers (no held gun); infinite
      smg:     { model: "smg",     rate: 0.075, ammo: 96,  dmg: 16,  pellets: 1, spread: 0.03, sound: "shoot",   pitch: 1.25, beam: 0xfff0bf, kick: 0.05 },
      minigun: { model: "minigun", rate: 0.05,  ammo: 150, dmg: 12,  pellets: 1, spread: 0.06, sound: "shoot",   pitch: 0.78, beam: 0xfff0bf, ecolor: 0x66ff44, esound: "zap",   kick: 0.04 },
      burst:   { model: "smg",     rate: 0.32,  ammo: 72,  dmg: 22,  pellets: 3, spread: 0.02, sound: "shoot",   pitch: 1.0,  beam: 0xfff0bf, ecolor: 0xc06bff, esound: "laser", kick: 0.1 },
      railgun: { model: "railgun", rate: 1.1,   ammo: 14,  dmg: 240, pellets: 1, spread: 0,    sound: "railgun", pitch: 0.7,  beam: 0x46ff5a, kick: 0.16, pierce: true },
      flak:    { model: "minigun", rate: 0.45,  ammo: 36,  dmg: 18,  pellets: 6, spread: 0.16, sound: "shotgun", pitch: 1.0,  beam: 0xffcaa0, kick: 0.16 },
    };
    this._gunLast = {}; for (const k in this.guns) this._gunLast[k] = -10;
    this.extraGun = new THREE.Group(); this.extraGun.visible = false;
    this.extraGun.position.set(0.32, -0.34, -0.4); this.extraGun.rotation.set(0, Math.PI, 0);
    camera.add(this.extraGun); this._gunModels = {};
    // master weapon list (every hero owns all; signature equipped on deploy)
    this.allWeapons = ["handlaser", "rifle", "smg", "minigun", "burst", "railgun", "flak", "laser", "plasma", "launcher", "sword"]; // pulse shotgun removed
    this.sword = new THREE.Group(); this.sword.visible = false;
    this.sword.position.set(0.3, -0.34, -0.5); this.sword.rotation.set(0, Math.PI, 0);
    camera.add(this.sword);
    this._buildSword();

    // recoil / sway state
    this.kick = 0;        // backward kick (springs to 0)
    this.kickRot = 0;     // muzzle rise
    this._basePos = new THREE.Vector3(0.24, -0.22, -0.55);
    this._baseRot = new THREE.Euler(0, Math.PI, 0);
    this.group.position.copy(this._basePos);
    this.group.rotation.copy(this._baseRot);

    this._muzzleWorld = new THREE.Vector3();
  }

  _build() {
    // PBR materials that catch the HDRI: gunmetal (reflective) + matte polymer
    const gun = { metalness: 0.92, roughness: 0.34, cast: false, receive: false };
    const poly = { metalness: 0.0, roughness: 0.7, cast: false, receive: false };
    const dark = COLORS.metalDark, body = 0x3a3d42, olive = COLORS.oliveDark;
    const P = (m, x, y, z, rx) => { m.position.set(x, y, z); if (rx) m.rotation.x = rx; this.group.add(m); return m; };

    // lower + upper receiver
    P(box(0.1, 0.12, 0.46, body, gun), 0, -0.01, 0.02);
    P(box(0.09, 0.05, 0.5, dark, gun), 0, 0.07, -0.02); // top rail base
    for (let z = -0.18; z <= 0.16; z += 0.06) P(box(0.05, 0.02, 0.02, dark, gun), 0, 0.11, z); // rail ridges
    // handguard (matte polymer) with side vents
    P(box(0.085, 0.085, 0.34, olive, poly), 0, 0.0, -0.34);
    for (const sx of [-0.05, 0.05]) for (let z = -0.46; z <= -0.24; z += 0.07) P(box(0.01, 0.05, 0.03, 0x2c2e26, poly), sx, 0.0, z);
    // barrel + muzzle device
    P(box(0.045, 0.045, 0.5, dark, gun), 0, 0.0, -0.55);
    P(box(0.07, 0.07, 0.1, dark, gun), 0, 0.0, -0.78);
    // curved magazine (grouped so it can drop out during reload)
    this._mag = new THREE.Group();
    const mb1 = box(0.07, 0.16, 0.1, olive, poly); mb1.position.set(0, -0.15, 0.06); mb1.rotation.x = 0.25;
    const mb2 = box(0.07, 0.13, 0.1, olive, poly); mb2.position.set(0, -0.28, 0.12); mb2.rotation.x = 0.5;
    this._mag.add(mb1, mb2);
    this.group.add(this._mag);
    this._magBase = this._mag.position.clone();
    // pistol grip
    P(box(0.07, 0.17, 0.09, body, poly), 0, -0.14, 0.2, -0.32);
    // stock with cheek riser
    P(box(0.06, 0.07, 0.12, dark, gun), 0, -0.01, 0.3);
    P(box(0.08, 0.12, 0.22, body, poly), 0, -0.03, 0.42);
    P(box(0.08, 0.05, 0.18, body, poly), 0, 0.06, 0.4); // cheek
    // red-dot optic
    P(box(0.08, 0.09, 0.12, dark, gun), 0, 0.16, 0.0);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.03, 12), new THREE.MeshBasicMaterial({ color: 0x66ddff, transparent: true, opacity: 0.5 }));
    P(lens, 0, 0.16, 0.06);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.006, 8), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
    P(dot, 0, 0.16, 0.061);
    // charging handle
    P(box(0.03, 0.03, 0.06, dark, gun), 0.07, 0.06, 0.18);

    // muzzle flash (hidden by default)
    this.muzzle = new THREE.Group();
    this.muzzle.position.set(0, 0.02, -0.8);
    this.group.add(this.muzzle);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95, depthWrite: false });
    flashMat.userData.outlineParameters = { visible: false }; // no ink outline on the muzzle flash
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), flashMat);
    this.flash.visible = false;
    this.muzzle.add(this.flash);
    const flash2 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), flashMat.clone());
    flash2.rotation.z = Math.PI / 2;
    this.flash.add(flash2);
    this.flashLight = new THREE.PointLight(0xffb347, 0, 8, 2);
    this.muzzle.add(this.flashLight);
    this._flashT = 0;
  }

  get muzzleWorld() {
    if (this._muzzleOverride) { const m = this._muzzleOverride(); if (m) return m; } // 3rd-person: fire from the visible character's gun
    this.muzzle.getWorldPosition(this._muzzleWorld);
    return this._muzzleWorld;
  }

  // add the launcher viewmodel once its model has loaded (called after preload)
  buildLauncher() {
    const lm = makeLauncher();
    if (lm) this.launcher.add(lm);
    // a loaded missile poking out of the tube — hidden for 3s after firing, then "reloaded"
    const m = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.44, 12), new THREE.MeshStandardMaterial({ color: 0x4b5320, roughness: 0.6, metalness: 0.3 }));
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.24, 12), new THREE.MeshStandardMaterial({ color: 0x8a2b1a, roughness: 0.5 })); nose.position.y = 0.34;
    m.add(body, nose);
    m.rotation.x = Math.PI / 2;        // lay along the tube (Z) axis
    m.position.set(0, 0.37, 0.78);     // filling the bore, on the barrel axis (launcher-local)
    this.launcher.add(m);
    this._loadedMissile = m;
  }

  // a sleek glowing energy blaster (shared viewmodel for the plasma + arc weapons; emitter recolored per mode)
  _buildEnergy() {
    const g = this.energy, body = { metalness: 0.7, roughness: 0.3 };
    g.add(box(0.12, 0.14, 0.5, 0x2b3038, body));
    const grip = box(0.08, 0.16, 0.1, 0x20242a, body); grip.position.set(0, -0.13, 0.16); g.add(grip);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 10), new THREE.MeshStandardMaterial({ color: 0x3a4250, metalness: 0.6, roughness: 0.4 }));
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.02, -0.32); g.add(barrel);
    this._emitterMat = new THREE.MeshStandardMaterial({ color: 0x6fd0ff, emissive: 0x4fb4ff, emissiveIntensity: 2.6 });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), this._emitterMat); core.position.set(0, 0.02, -0.5); g.add(core);
    for (let i = 0; i < 3; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 16), this._emitterMat); ring.position.set(0, 0.02, -0.36 - i * 0.06); g.add(ring); }
  }
  // a stylized energy sword (glowing blade + crossguard) for the melee weapon
  _buildSword() {
    const g = this.sword, steel = { metalness: 0.85, roughness: 0.25 };
    const grip = box(0.045, 0.18, 0.045, 0x2a2118, { roughness: 0.8 }); grip.position.set(0, -0.02, 0.18); g.add(grip);
    const guard = box(0.22, 0.04, 0.06, 0x9a8a4a, steel); guard.position.set(0, 0.08, 0.18); g.add(guard);
    this._bladeMat = new THREE.MeshStandardMaterial({ color: 0xdfe9f5, emissive: 0x4fc6ff, emissiveIntensity: 1.4, metalness: 0.6, roughness: 0.2 });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.95, 0.02), this._bladeMat); blade.position.set(0, 0.6, 0.18); g.add(blade);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 4), this._bladeMat); tip.position.set(0, 1.1, 0.18); g.add(tip);
  }
  // Replace the procedural placeholders with real CC0 GLB models once loaded (called post-preload).
  buildFpWeapons() {
    const swap = (group, key, rot, pos) => {
      const m = makeFpWeapon(key); if (!m) return; // keep procedural fallback if the GLB failed to load
      while (group.children.length) group.remove(group.children[0]);
      m.rotation.set(rot[0], rot[1], rot[2]); m.position.set(pos[0], pos[1], pos[2]);
      group.add(m);
    };
    swap(this.energy, "plasma", [0, -Math.PI / 2, 0], [0, 0, 0.1]);
    swap(this.laserGun, "laser", [0, -Math.PI / 2, 0], [0, 0, 0.1]);
    swap(this.shotgunGun, "shotgun", [0, -Math.PI / 2, 0], [0, 0, 0.1]);
    swap(this.sword, "sword", [0, 0, 0], [0, 0, 0]); this.sword.scale.setScalar(2.05); // real GLB sword — oriented/animated by the swing code
    for (const key of ["smg", "minigun", "railgun"]) { // generic-gun viewmodels (swapped into one slot)
      const m = makeFpWeapon(key); if (m) { m.rotation.set(0, -Math.PI / 2, 0); m.position.set(0, 0, 0.1); this._gunModels[key] = m; }
    }
  }

  // a long sleek laser rifle (red emitter coils + scope) — distinct from the plasma orb-blaster
  _buildLaserGun() {
    const g = this.laserGun, body = { metalness: 0.6, roughness: 0.35 };
    g.add(box(0.1, 0.1, 0.62, 0x23262c, body));
    const grip = box(0.07, 0.15, 0.09, 0x17191e, body); grip.position.set(0, -0.12, 0.16); g.add(grip);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.72, 10), new THREE.MeshStandardMaterial({ color: 0x4a4f57, metalness: 0.75, roughness: 0.3 }));
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.03, -0.52); g.add(barrel);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.18, 8), new THREE.MeshStandardMaterial({ color: 0x111316, metalness: 0.5, roughness: 0.4 }));
    scope.rotation.x = Math.PI / 2; scope.position.set(0, 0.12, -0.06); g.add(scope);
    const em = new THREE.MeshStandardMaterial({ color: 0xff8a6a, emissive: 0xff2a1a, emissiveIntensity: 2.6 });
    for (let i = 0; i < 3; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 14), em); ring.position.set(0, 0.03, -0.56 - i * 0.06); g.add(ring); }
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), em); tip.position.set(0, 0.03, -0.88); g.add(tip);
  }
  _showViewmodel() {
    if (this._hideViewmodel) { for (const x of [this.group, this.launcher, this.energy, this.laserGun, this.shotgunGun, this.sword, this.extraGun]) if (x) x.visible = false; return; } // 3rd-person: never show the FP viewmodel
    const g = this.guns[this.mode];
    this.group.visible = this.mode === "rifle";
    this.launcher.visible = this.mode === "launcher";
    this.energy.visible = this.mode === "plasma";
    this.laserGun.visible = this.mode === "laser";
    this.shotgunGun.visible = this.mode === "shotgun";
    this.sword.visible = this.mode === "sword";
    this.extraGun.visible = !!g;
    if (g) { // swap the right model into the shared generic-gun slot
      const m = this._gunModels[g.model];
      while (this.extraGun.children.length) this.extraGun.remove(this.extraGun.children[0]);
      if (m) this.extraGun.add(m);
    }
  }
  // top up EVERY weapon's ammo (ammo pickups collected around the island)
  addAmmo(mult = 1) { // ammo pickup tops up every weapon's RESERVE (~1.5 mags each)
    for (const k in this.A) this.A[k].reserve += Math.round(this.A[k].size * 1.5 * mult);
    this.rockets = Math.min(8, this.rockets + Math.round(2 * mult));
  }
  canFireGun(t) { const g = this.guns[this.mode], a = this.A[this.mode]; return !!g && !this.reloading && a.mag > 0 && (t - this._gunLast[this.mode]) >= g.rate; }
  fireGun(t) { const g = this.guns[this.mode], a = this.A[this.mode]; this._gunLast[this.mode] = t; a.mag--; this.kick = g.kick; this.kickRot = g.kick * 1.2; const snd = (this._energyBeam && g.esound) ? g.esound : g.sound; this.audio && this.audio[snd] && this.audio[snd](g.pitch || 1); if (a.mag === 0) this.reload(); }

  // cycle through owned weapons (Q)
  toggle() {
    const i = this.owned.indexOf(this.mode);
    this.mode = this.owned[(i + 1) % this.owned.length];
    this._showViewmodel();
    return this.mode;
  }
  // unlock + equip a weapon (from a pickup)
  give(mode) {
    if (!this.owned.includes(mode)) this.owned.push(mode);
    this.mode = mode; this._showViewmodel();
  }

  canFire(t) {
    return !this.reloading && this.A.rifle.mag > 0 && (t - this._lastShot) >= this.fireRate;
  }

  canFirePlasma(t) { return this.mode === "plasma" && !this.reloading && this.A.plasma.mag > 0 && (t - this._lastPlasma) >= this.plasmaRate; }
  firePlasma(t) { this._lastPlasma = t; this.A.plasma.mag--; this.kick = 0.13; this.kickRot = 0.17; if (this._energyBeam) this.audio?.plasma?.(); else this.audio?.grenadeLaunch?.(); if (this.A.plasma.mag === 0) this.reload(); }
  canFireLaser(t) { return this.mode === "laser" && !this.reloading && this.A.laser.mag > 0 && (t - this._lastLaser) >= this.laserRate; }
  fireLaser(t) { this._lastLaser = t; this.A.laser.mag--; this.kick = 0.04; this.kickRot = 0.05; this.audio?.laser?.(); if (this.A.laser.mag === 0) this.reload(); }
  canFireSword(t) { return this.mode === "sword" && (t - this._lastSword) >= this.swordRate; }
  fireSword(t) { this._lastSword = t; this._swingT = 0.32; this.audio?.swordSwing?.(); }

  canFireRocket(t) { return this.rockets > 0 && this._rocketLoaded; }
  fireRocket(t) {
    this.rockets--;
    this._lastRocket = t;
    this._rocketLoaded = false;            // tube is now empty until reloaded (~3s)
    if (this._loadedMissile) this._loadedMissile.visible = false;
    this.kick = 0.2; this.kickRot = 0.28;  // big launcher recoil
    this.audio?.explosion?.();             // launch whump
  }

  fire(t) {
    this.A.rifle.mag--;
    this._lastShot = t;
    this.kick = Math.min(this.kick + 0.06, 0.12);
    this.kickRot = Math.min(this.kickRot + 0.09, 0.18);
    // muzzle flash
    this.flash.visible = true;
    this.flash.rotation.z = Math.random() * Math.PI;
    this.flash.scale.setScalar(0.7 + Math.random() * 0.6);
    this.flashLight.intensity = 6;
    this._flashT = 0.05;
    if (this._energyBeam) this.audio?.laser?.(0.5); else this.audio?.shoot?.(); // sci-fi energy carbine
    if (this.A.rifle.mag === 0) this.reload();
  }

  // reload the CURRENT weapon's magazine from its reserve (works for every ranged weapon)
  reload() {
    const a = this.A[this.mode];
    if (!a || this.reloading || a.mag >= a.size || a.reserve <= 0) return;
    this.reloading = true; this._reloadMode = this.mode;
    this._reloadT = this.reloadTime;
    this.audio?.reload?.();
  }

  update(dt, moving) {
    // reload the launcher tube ~3s after firing (the missile reappears + you can fire again)
    if (!this._rocketLoaded && this.rockets > 0) {
      this._reloadT2 = (this._reloadT2 || 0) + dt;
      if (this._reloadT2 >= this.rocketRate) { this._rocketLoaded = true; this._reloadT2 = 0; if (this._loadedMissile) this._loadedMissile.visible = true; }
    }

    // recoil spring recovery
    this.kick += (0 - this.kick) * Math.min(1, dt * 12);
    this.kickRot += (0 - this.kickRot) * Math.min(1, dt * 12);

    // sway: gentle idle + walk bob
    const t = performance.now ? 0 : 0; // avoid Date; use accumulated below
    this._sway = (this._sway || 0) + dt * (moving ? 8 : 2);
    const swayX = Math.sin(this._sway) * (moving ? 0.012 : 0.004);
    const swayY = Math.abs(Math.sin(this._sway * 0.5)) * (moving ? 0.012 : 0.004);

    this.group.position.set(
      this._basePos.x + swayX,
      this._basePos.y + swayY,
      this._basePos.z + this.kick
    );
    this.group.rotation.set(this._baseRot.x - this.kickRot, this._baseRot.y, this._baseRot.z);

    // sword (procedural energy blade, +Y from the grip): held up-RIGHT at rest, then a real diagonal CUT
    // sweeping DOWN-and-across to the lower-left and recovering. Grip stays close to the camera (no hands).
    if (this.sword.visible) {
      const a = this._swingT > 0 ? Math.sin((1 - (this._swingT -= dt) / 0.32) * Math.PI) : 0;
      // held up-forward-RIGHT at rest → chop DOWN, FORWARD and across to the lower-LEFT; grip stays near the camera
      // the BLADE (upper part) arcs forward via rotation; the grip stays tucked low-right (off-screen, no hand)
      this.sword.rotation.set(-0.55 - a * 1.4, 0.2 - a * 0.3, 0.5 + a * 1.5);
      this.sword.position.set(0.42 - a * 0.05, -0.66 - a * 0.02, -0.48 - a * 0.1);
      if (this._swingT < 0) this._swingT = 0;
    }

    // multi-phase reload animation: dip + tilt, mag drops out, then slams back in
    if (this.reloading) {
      this._reloadT -= dt;
      const p = 1 - this._reloadT / this.reloadTime; // 0..1
      const dip = Math.sin(Math.min(p, 1) * Math.PI);
      this.group.position.y -= dip * 0.22;
      this.group.position.x += dip * 0.05;
      this.group.rotation.x -= dip * 0.6;
      this.group.rotation.z = this._baseRot.z + dip * 0.35;
      // magazine: drop out (~0.12-0.42), gap, slam in (~0.62-0.85)
      let magY = 0, magRot = 0;
      if (p < 0.45) { const q = THREE.MathUtils.clamp((p - 0.12) / 0.3, 0, 1); magY = -0.5 * q; magRot = 0.6 * q; }
      else if (p < 0.62) { magY = -0.5; magRot = 0.6; }
      else { const q = THREE.MathUtils.clamp((p - 0.62) / 0.25, 0, 1); magY = -0.5 * (1 - q); magRot = 0.6 * (1 - q); }
      this._mag.position.set(this._magBase.x, this._magBase.y + magY, this._magBase.z);
      this._mag.rotation.x = magRot;
      if (this._reloadT <= 0) {
        const a = this.A[this._reloadMode] || this.A.rifle;
        const take = Math.min(a.size - a.mag, a.reserve);
        a.mag += take; a.reserve -= take;
        this.reloading = false;
        this._mag.position.copy(this._magBase);
        this._mag.rotation.x = 0;
      }
    }

    // flash fade
    if (this._flashT > 0) {
      this._flashT -= dt;
      if (this._flashT <= 0) { this.flash.visible = false; this.flashLight.intensity = 0; }
      else { this.flashLight.intensity = (this._flashT / 0.05) * 6; }
    }
  }
}
