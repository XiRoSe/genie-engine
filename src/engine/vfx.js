import * as THREE from "three";
import { noOutline } from "./primitives.js";

// Pooled combat VFX — soft textured sprites (no flat squares), additive glow for
// sparks/flash, alpha dust puffs, lingering decals. No per-shot allocs, no lights.
function radialTex(stops) {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [o, col] of stops) g.addColorStop(o, col);
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class VFX {
  constructor(scene) {
    this.scene = scene;
    this._cam = null;
    this._dir = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._up = new THREE.Vector3(0, 1, 0);

    this._glow = radialTex([[0, "rgba(255,255,255,1)"], [0.3, "rgba(255,240,200,0.9)"], [1, "rgba(255,200,120,0)"]]);
    this._smoke = radialTex([[0, "rgba(150,150,155,0.6)"], [0.6, "rgba(120,120,125,0.25)"], [1, "rgba(120,120,125,0)"]]);
    this._hole = radialTex([[0, "rgba(8,8,10,0.95)"], [0.55, "rgba(20,20,24,0.7)"], [1, "rgba(20,20,24,0)"]]);

    const quad = new THREE.PlaneGeometry(1, 1);
    // additive embers (sparks)
    this.embers = this._pool(110, quad, () => noOutline(new THREE.MeshBasicMaterial({ map: this._glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    this.embers.forEach((e) => (e.vel = new THREE.Vector3()));
    // additive flashes
    this.flashes = this._pool(30, quad, () => noOutline(new THREE.MeshBasicMaterial({ map: this._glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    // alpha dust puffs
    this.dust = this._pool(36, quad, () => noOutline(new THREE.MeshBasicMaterial({ map: this._smoke, transparent: true, depthWrite: false })));
    // lingering decals
    this.decals = this._pool(40, quad, () => noOutline(new THREE.MeshBasicMaterial({ map: this._hole, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })));
    // thin additive tracers
    const tg = new THREE.CylinderGeometry(0.01, 0.01, 1, 4); tg.translate(0, 0.5, 0);
    this.tracers = this._pool(20, tg, () => noOutline(new THREE.MeshBasicMaterial({ color: 0xfff0bf, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    // red enemy laser beams (thin glowing cylinders)
    const eg = new THREE.CylinderGeometry(0.13, 0.13, 1, 6); eg.translate(0, 0.5, 0);
    this.enemyBeams = this._pool(28, eg, () => noOutline(new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))); // additive glow outer
    // SOLID (normal-blended) beam cores — additive green over the warm orange world reads YELLOW, so the core shows the
    // beam's TRUE colour on any background. Rick's hand-laser + all energy bolts glow in their real colour.
    this.beamCores = this._pool(20, eg, () => noOutline(new THREE.MeshBasicMaterial({ color: 0x44ff44, transparent: true, depthWrite: false })));
    // expanding shockwave rings (billboarded)
    const ring = new THREE.RingGeometry(0.55, 0.72, 28);
    this.rings = this._pool(4, ring, () => noOutline(new THREE.MeshBasicMaterial({ color: 0xffe6b0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })));
    // flying debris chunks
    const chunk = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    this.debris = this._pool(26, chunk, () => new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.9 }));
    this.debris.forEach((d) => { d.vel = new THREE.Vector3(); d.spin = new THREE.Vector3(); });
  }

  setCamera(cam) { this._cam = cam; }

  _pool(n, geo, makeMat) {
    const arr = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, makeMat());
      m.visible = false; m.frustumCulled = false;
      this.scene.add(m);
      arr.push({ mesh: m, life: 0, max: 1 });
    }
    arr.cursor = 0;
    return arr;
  }
  _next(p) { const it = p[p.cursor]; p.cursor = (p.cursor + 1) % p.length; return it; }

  tracer(from, to) {
    this._dir.subVectors(to, from);
    const len = this._dir.length(); if (len < 0.01) return;
    const t = this._next(this.tracers);
    t.mesh.position.copy(from);
    t.mesh.quaternion.setFromUnitVectors(this._up, this._dir.normalize());
    t.mesh.scale.set(1, len, 1);
    t.mesh.visible = true; t.mesh.material.opacity = 1;
    t.life = t.max = 0.03;
  }

  // THE GUARDIAN's giant chest beam: a real persistent glowing RAY (thick red cylinder + bright core) that lingers
  bossBeam(a, b) {
    if (!this._beam) {
      const g = new THREE.CylinderGeometry(1.1, 1.1, 1, 14); g.translate(0, 0.5, 0);
      this._beam = new THREE.Mesh(g, noOutline(new THREE.MeshBasicMaterial({ color: 0xff1810, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
      this._beam.frustumCulled = false; this.scene.add(this._beam);
      const gc = new THREE.CylinderGeometry(0.42, 0.42, 1, 10); gc.translate(0, 0.5, 0);
      this._beamCore = new THREE.Mesh(gc, noOutline(new THREE.MeshBasicMaterial({ color: 0xff6a4a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
      this._beamCore.frustumCulled = false; this._beam.add(this._beamCore);
    }
    this._dir.subVectors(b, a); const len = this._dir.length(); if (len < 0.1) return;
    this._beam.position.copy(a);
    this._beam.quaternion.setFromUnitVectors(this._up, this._dir.normalize());
    this._beam.scale.set(1, len, 1);
    this._beam.visible = true; this._beam.material.opacity = 0.9; this._beamCore.material.opacity = 1;
    this._beamLife = 0.85;
    this._flash(a, 6.0, 0xff1808); this._flash(a, 3.2, 0xff7a50); // big RED muzzle bloom at the chest
  }

  // a glowing red enemy laser BEAM (a real thin cylinder that briefly lingers) + impact glow
  enemyLaser(a, b, color = 0xff2a1a) {
    this._dir.subVectors(b, a); const len = this._dir.length(); if (len < 0.1) return;
    const t = this._next(this.enemyBeams);
    t.mesh.position.copy(a); t.mesh.quaternion.setFromUnitVectors(this._up, this._dir.normalize()); t.mesh.scale.set(1, len, 1);
    t.mesh.material.color.setHex(color); t.mesh.visible = true; t.mesh.material.opacity = 0.95; t.life = t.max = 0.13;
    this._flash(b, 0.7, color); this._flash(a, 0.5, color); // impact + muzzle glow
  }

  _flash(point, size, color) {
    const f = this._next(this.flashes);
    f.mesh.position.copy(point);
    f.mesh.material.color.setHex(color);
    f.mesh.scale.setScalar(size);
    f.mesh.visible = true; f.mesh.material.opacity = 1;
    f.life = f.max = 0.08;
  }
  _embers(point, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const e = this._next(this.embers);
      e.mesh.position.copy(point);
      e.mesh.material.color.setHex(color);
      e.mesh.scale.setScalar(0.12 + Math.random() * 0.1);
      e.mesh.visible = true; e.mesh.material.opacity = 1;
      e.vel.set((Math.random() - 0.5), Math.random() * 0.9 + 0.25, (Math.random() - 0.5)).multiplyScalar(speed * (0.5 + Math.random()));
      e.life = e.max = 0.3 + Math.random() * 0.15;
    }
  }
  _dustPuff(point, color, size) {
    const d = this._next(this.dust);
    d.mesh.position.copy(point);
    d.mesh.material.color.setHex(color);
    d.mesh.scale.setScalar(size);
    d.mesh.visible = true; d.mesh.material.opacity = 0.55;
    d.life = d.max = 0.5;
    d.grow = size;
  }
  _decal(point, normal) {
    const d = this._next(this.decals);
    d.mesh.position.copy(point).addScaledVector(normal, 0.02);
    d.mesh.lookAt(this._dir.copy(point).add(normal));
    d.mesh.scale.setScalar(0.22 + Math.random() * 0.1);
    d.mesh.visible = true; d.mesh.material.opacity = 0.9;
    d.life = d.max = 7; d.grow = 0;
  }

  // wall / prop impact
  impact(point, normal) {
    this._flash(point, 0.6, 0xffe2a0);
    this._embers(point, 0xffc878, 7, 5);
    this._dustPuff(point, 0xb9b3a4, 0.35);
    if (normal) this._decal(point, normal);
  }
  // simple soft glowing muzzle flash, billboarded toward the camera
  muzzle(point) {
    this._flash(point, 0.8, 0xffe0a0);
  }

  // huge "wow" explosion: a big rolling fireball (sustained), shockwave, debris, smoke column.
  // scale < 1 for smaller blasts (grenades / rockets).
  explosion(point, scale = 1) {
    this._fireball(point, scale);
    // sustained fire — staggered secondary bursts spreading out + rising
    setTimeout(() => this._fireball(point.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3 * scale, (1 + Math.random() * 2) * scale, (Math.random() - 0.5) * 3 * scale)), 0.85 * scale), 80);
    setTimeout(() => this._fireball(point.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4 * scale, (2 + Math.random() * 2.5) * scale, (Math.random() - 0.5) * 4 * scale)), 0.7 * scale), 190);
    this._shockwave(point);
    this._spawnDebris(point, Math.round(22 * scale));
  }

  _fireball(point, scale) {
    for (let i = 0; i < 8; i++) {
      const p = point.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3.2, (Math.random() - 0.3) * 3.2, (Math.random() - 0.5) * 3.2));
      this._flash(p, (3.6 + Math.random() * 2.6) * scale, i % 2 ? 0xffce6e : 0xff6a14);
    }
    this._embers(point, 0xffa838, 32, 15);
    for (let i = 0; i < 5; i++) {
      const p = point.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3.5, Math.random() * 2.5, (Math.random() - 0.5) * 3.5));
      this._dustPuff(p, 0x231e1a, (2.8 + Math.random() * 1.8) * scale);
    }
  }

  _shockwave(point) {
    const r = this._next(this.rings);
    r.mesh.position.copy(point);
    r.mesh.scale.setScalar(0.5);
    r.mesh.visible = true; r.mesh.material.opacity = 0.95;
    r.life = r.max = 0.55; r.grow = 34;
  }
  _spawnDebris(point, n) {
    for (let i = 0; i < n; i++) {
      const d = this._next(this.debris);
      d.mesh.position.copy(point);
      d.mesh.scale.setScalar(0.5 + Math.random() * 1.1);
      d.mesh.visible = true;
      d.vel.set((Math.random() - 0.5), Math.random() * 0.9 + 0.5, (Math.random() - 0.5)).multiplyScalar(7 + Math.random() * 8);
      d.spin.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);
      d.life = d.max = 1.6 + Math.random() * 0.8;
    }
  }

  // enemy hit. Rick level (`_badass`) gets a punchy energy impact; the military levels keep the crimson puff.
  hitPuff(point) {
    if (this._badass) {
      this._flash(point, 1.0, 0xffffff);           // hot white core
      this._flash(point, 1.8, 0xff8a3a);           // orange energy bloom
      this._embers(point, 0xffc24a, 18, 10);       // spark burst
      this._shockwave && this._shockwave(point);   // expanding shock ring
      this._dustPuff(point, 0x5a1410, 0.45);
      return;
    }
    this._flash(point, 0.5, 0xff6a52);
    this._embers(point, 0xd03a2a, 9, 5.5);
    this._dustPuff(point, 0x5a1410, 0.32);
  }

  // rocket exhaust: a little fire + a puff of smoke, left behind each frame in flight
  rocketTrail(point) {
    this._flash(point, 0.32, 0xffb24a);
    this._dustPuff(point, 0x6b6660, 0.4);
  }

  // glowing plasma-bolt trail
  plasmaTrail(point) { this._flash(point, 0.34, 0x4fb4ff); }

  // kicked-up dust (vehicle wheels / tracks / impacts) — named dustBurst to avoid the `dust` pool field
  dustBurst(point) { this._dustPuff(point, 0x9a8a62, 0.7); }

  // a proper energy LASER: a thick glowing beam (lingering cylinder) + a hot white core + end flashes. sizeScale
  // fattens the whole bolt AND its muzzle/impact flashes together (so beam + hit stay matched) — used to scale
  // Meeseeks lasers with the Meeseeks' size, and to make Rick's blasters extra chunky for wow.
  laserBeam(a, b, color = 0x34ffd6, sizeScale = 1) {
    this._dir.subVectors(b, a); const len = this._dir.length(); if (len < 0.1) return;
    const bad = this._badass; // Rick level: fatter, brighter bolt with double muzzle+impact flashes
    const th = (bad ? 1.7 : 0.55) * sizeScale; // beam radius
    const beam = this._next(this.enemyBeams);
    beam.mesh.position.copy(a); beam.mesh.quaternion.setFromUnitVectors(this._up, this._dir.normalize()); beam.mesh.scale.set(th, len, th);
    beam.mesh.material.color.setHex(color); beam.mesh.visible = true; beam.mesh.material.opacity = bad ? 0.98 : 0.85; beam.life = beam.max = bad ? 0.12 : 0.1;
    // SOLID inner core (normal blend) in the beam's TRUE colour — additive alone reads yellow over the orange world
    const core = this._next(this.beamCores);
    core.mesh.position.copy(a); core.mesh.quaternion.copy(beam.mesh.quaternion); core.mesh.scale.set(th * 0.6, len, th * 0.6);
    core.mesh.material.color.setHex(color); core.mesh.visible = true; core.mesh.material.opacity = 0.95; core.life = core.max = beam.max;
    const s = sizeScale;
    // muzzle/impact flashes tinted toward the BEAM colour (a hot bright version), not pure white → the bolt reads in its true colour (green stays green)
    const hot = (this._c1 || (this._c1 = new THREE.Color())).setHex(color).lerp((this._cW || (this._cW = new THREE.Color(0xffffff))), 0.6).getHex();
    if (bad) { this._flash(a, 0.9 * s, hot); this._flash(a, 1.5 * s, color); this._flash(b, 1.3 * s, hot); this._flash(b, 2.2 * s, color); }
    else { this._flash(a, 0.4 * s, hot); this._flash(b, 0.75 * s, color); }
  }

  // sci-fi plasma detonation: a blue/cyan energy fireball + shockwave + sparks
  energyBoom(point, scale = 1) {
    for (let i = 0; i < 7; i++) {
      const p = point.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3.2, (Math.random() - 0.3) * 3.2, (Math.random() - 0.5) * 3.2));
      this._flash(p, (3.2 + Math.random() * 2.4) * scale, i % 2 ? 0x7fd6ff : 0x2a8cff);
    }
    this._embers(point, 0x9fe8ff, 28, 14);
    this._shockwave(point);
    this._spawnDebris(point, Math.round(10 * scale));
  }

  // a jagged electric beam from a to b (reuses the tracer pool)
  lightning(a, b) {
    const prev = a.clone(), p = new THREE.Vector3();
    for (let i = 1; i <= 4; i++) {
      p.copy(a).lerp(b, i / 4);
      if (i < 4) p.add(new THREE.Vector3((Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.9));
      this.tracer(prev, p); prev.copy(p);
    }
    this._flash(b, 0.7, 0x9fe8ff);
  }

  update(dt) {
    const camQ = this._cam && this._cam.quaternion;
    if (this._beam && this._beam.visible) { this._beamLife -= dt; const f = Math.max(0, this._beamLife / 0.85); this._beam.material.opacity = 0.9 * f; this._beamCore.material.opacity = f; if (this._beamLife <= 0) this._beam.visible = false; }
    for (const t of this.tracers) if (t.life > 0) { t.life -= dt; t.mesh.material.opacity = Math.max(0, t.life / t.max); if (t.life <= 0) t.mesh.visible = false; }
    for (const t of this.enemyBeams) if (t.life > 0) { t.life -= dt; t.mesh.material.opacity = Math.max(0, 0.95 * t.life / t.max); if (t.life <= 0) t.mesh.visible = false; }
    for (const t of this.beamCores) if (t.life > 0) { t.life -= dt; t.mesh.material.opacity = Math.max(0, 0.95 * t.life / t.max); if (t.life <= 0) t.mesh.visible = false; }
    for (const e of this.embers) if (e.life > 0) {
      e.life -= dt; e.vel.y -= 14 * dt;
      e.mesh.position.addScaledVector(e.vel, dt);
      if (camQ) e.mesh.quaternion.copy(camQ);
      e.mesh.material.opacity = Math.max(0, e.life / e.max);
      if (e.life <= 0) e.mesh.visible = false;
    }
    for (const f of this.flashes) if (f.life > 0) {
      f.life -= dt;
      if (camQ) f.mesh.quaternion.copy(camQ);
      f.mesh.material.opacity = Math.max(0, f.life / f.max);
      if (f.life <= 0) f.mesh.visible = false;
    }
    for (const d of this.dust) if (d.life > 0) {
      d.life -= dt; const k = 1 - d.life / d.max;
      if (camQ) d.mesh.quaternion.copy(camQ);
      d.mesh.scale.setScalar(d.grow * (1 + k * 1.6));
      d.mesh.position.y += dt * 0.5;
      d.mesh.material.opacity = Math.max(0, (1 - k) * 0.55);
      if (d.life <= 0) d.mesh.visible = false;
    }
    for (const d of this.decals) if (d.life > 0) {
      d.life -= dt;
      if (d.life < 1) d.mesh.material.opacity = Math.max(0, d.life * 0.9);
      if (d.life <= 0) d.mesh.visible = false;
    }
    for (const r of this.rings) if (r.life > 0) {
      r.life -= dt; const k = 1 - r.life / r.max;
      if (camQ) r.mesh.quaternion.copy(camQ);
      r.mesh.scale.setScalar(0.5 + k * r.grow);
      r.mesh.material.opacity = Math.max(0, (1 - k) * 0.9);
      if (r.life <= 0) r.mesh.visible = false;
    }
    for (const d of this.debris) if (d.life > 0) {
      d.life -= dt; d.vel.y -= 16 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += d.spin.x * dt; d.mesh.rotation.y += d.spin.y * dt; d.mesh.rotation.z += d.spin.z * dt;
      if (d.mesh.position.y < 0.1) { d.mesh.position.y = 0.1; d.vel.set(0, 0, 0); }
      if (d.life <= 0) d.mesh.visible = false;
    }
  }
}
