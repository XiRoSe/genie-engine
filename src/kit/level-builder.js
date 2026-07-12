import * as THREE from "three";
import { COLORS, mat, box, cyl, texMat, groundTexture, makeCrate, makeBarrel, makeSandbags, makeBollard, makeExfilPad, makeFlag, noOutline } from "../engine/primitives.js";
import { makeVehicle } from "./content/vehicles.js";
import { makeAmmo } from "./content/pickups.js";
import { makeFpWeapon } from "./content/fpweapons.js";
import { makeTree, makeRock } from "./content/nature.js";
import { makeBuilding } from "./content/buildings.js";
import { Car } from "./car.js";

// The level toolkit for THIS game (a night military-compound FPS). A level module calls these
// methods on a builder instance to lay out its map; the builder accumulates colliders, occluders,
// enemy spawns, floodlights and the objective, and animates the flag + searchlights each frame.
// pick an HP value: a number is used as-is, a [min,max] range rolls inclusively (in "units")
const rollHp = (r) => (Array.isArray(r) ? r[0] + Math.floor(Math.random() * (r[1] - r[0] + 1)) : r);

export class LevelBuilder {
  constructor(scene, balance = {}) {
    this.scene = scene;
    // destructible HP (in "units") — injected from the game's config.balance so tuning stays data.
    this.hp = balance.destructibles || { barrelHp: [2, 3], fuelTankHp: 4, vehicleHp: [7, 8] };
    this.colliders = [];   // AABB {minX,maxX,minZ,maxZ,top} in the XZ plane
    this.solidMeshes = []; // occluders for bullet raycasts (walls, crates, buildings…)
    this.explosives = [];  // shootable fuel barrels { mesh, x, z, exploded } that blow up when hit
    this.vehicles = [];    // shootable vehicles { mesh, x, z, hp, exploded } — tougher, launch + wreck
    this.arcs = [];        // collectible "lost arc" relics { x, z, r, group, taken } (the collect objective)
    this.gifts = [];       // loot crates { x, z, r, group, kind, taken } — grant ammo/grenades/health
    this.enemySpawns = []; // { x, z, [y], patrol:[{x,z}], [hp], [speed] }
    this.spots = [];       // floodlights (for the sweep + beam update)
    this.playerSpawn = new THREE.Vector3(0, 0, 16);
    this.exfil = { x: 0, z: -16, r: 3.0 };
    this.bounds = { minX: -16.4, maxX: 16.4, minZ: -19.4, maxZ: 18.4 };
  }

  // ---- level-definition helpers ----
  spawnAt(x, z) { this.playerSpawn.set(x, 0, z); return this; }
  setBounds(b) { this.bounds = b; return this; }
  enemy(spec) {
    // keep spawns OUT of structures: if (x,z) sits inside a collider, shove it to the nearest edge + margin
    let x = spec.x, z = spec.z;
    for (const c of this.colliders) {
      if (x > c.minX - 1 && x < c.maxX + 1 && z > c.minZ - 1 && z < c.maxZ + 1) {
        const dl = x - (c.minX - 1.5), dr = (c.maxX + 1.5) - x, db = z - (c.minZ - 1.5), dt = (c.maxZ + 1.5) - z;
        const m = Math.min(dl, dr, db, dt);
        if (m === dl) x = c.minX - 1.5; else if (m === dr) x = c.maxX + 1.5; else if (m === db) z = c.minZ - 1.5; else z = c.maxZ + 1.5;
      }
    }
    spec.x = x; spec.z = z;
    this.enemySpawns.push(spec); return this;
  }

  collide(x, z, w, d, top = 3.4) {
    // `top` = height you can stand on (low props are mountable, tall walls aren't)
    const c = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top };
    this.colliders.push(c);
    return c;
  }

  // ground + vast surrounding desert + scattered bushes/rocks + dirt patches.
  // `surround` is the size of the far desert plane (so the player can roam well past the base).
  desertFloor(size = 80, patchN = 10, patchSpread = 30, surround = 600) {
    const groundMat = mat(COLORS.sand, { roughness: 1 });
    groundMat.map = groundTexture();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), groundMat);
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.scene.add(ground);

    const desert = new THREE.Mesh(new THREE.PlaneGeometry(surround, surround), mat(COLORS.sand, { roughness: 1 }));
    desert.rotation.x = -Math.PI / 2; desert.position.y = -0.05; desert.receiveShadow = true; this.scene.add(desert);

    this.scatterDesert(size * 0.45, size * 2.2);

    for (let i = 0; i < patchN; i++) {
      const r = 2 + Math.random() * 4;
      const p = new THREE.Mesh(new THREE.CircleGeometry(r, 10), mat(Math.random() > 0.5 ? COLORS.sandDark : COLORS.dirt, { roughness: 1 }));
      p.rotation.x = -Math.PI / 2;
      p.position.set((Math.random() - 0.5) * patchSpread, 0.02, (Math.random() - 0.5) * patchSpread - 2);
      p.receiveShadow = true; this.scene.add(p);
    }
  }

  road(w, len, x = 0, z = 0) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(w, len), mat(COLORS.dirt, { roughness: 1 }));
    r.rotation.x = -Math.PI / 2; r.position.set(x, 0.03, z); r.receiveShadow = true; this.scene.add(r);
  }

  // low-poly desert dressing scattered in a ring around the play area.
  // Uses InstancedMesh: ALL bushes are one draw call and ALL rocks are another (instead of
  // ~1000+ individual meshes), so the level builds instantly and runtime stays smooth.
  scatterDesert(rMin = 36, rMax = 170, bushes = 70, rocks = 55) {
    const bushCols = [0x4a5436, 0x3d4a2c, 0x55603f].map((c) => new THREE.Color(c));
    const rockCols = [0x6b6457, 0x595347, 0x746b5c].map((c) => new THREE.Color(c));
    const ring = () => { const a = Math.random() * Math.PI * 2, r = rMin + Math.random() * (rMax - rMin); return [Math.cos(a) * r, Math.sin(a) * r]; };
    const dummy = new THREE.Object3D();
    const instMat = () => noOutline(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true })); // white base; per-instance color tints it

    // ---- rocks: one instanced dodecahedron (unit geo, scaled per instance) ----
    const rockMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), instMat(), rocks);
    rockMesh.castShadow = true; rockMesh.receiveShadow = true; rockMesh.frustumCulled = false;
    for (let i = 0; i < rocks; i++) {
      const [x, z] = ring(), s = (0.45 + Math.random() * 0.9) * (0.7 + Math.random() * 1.6);
      dummy.position.set(x, 0.12 * s, z);
      dummy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      dummy.scale.set(s, s * (0.6 + Math.random() * 0.4), s); dummy.updateMatrix();
      rockMesh.setMatrixAt(i, dummy.matrix); rockMesh.setColorAt(i, rockCols[Math.floor(Math.random() * 3)]);
    }
    this.scene.add(rockMesh);

    // ---- bushes: clusters of blobs -> all blobs in one instanced icosahedron ----
    const blobs = [];
    for (let i = 0; i < bushes; i++) {
      const [x, z] = ring(), s = 0.8 + Math.random() * 1.4, col = bushCols[Math.floor(Math.random() * 3)];
      const n = 2 + Math.floor(Math.random() * 3);
      for (let j = 0; j < n; j++) {
        const r = (0.35 + Math.random() * 0.5) * s;
        blobs.push({ x: x + (Math.random() - 0.5) * 0.7 * s, y: r * 0.55, z: z + (Math.random() - 0.5) * 0.7 * s, r, col });
      }
    }
    const bushMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), instMat(), blobs.length);
    bushMesh.castShadow = true; bushMesh.frustumCulled = false;
    blobs.forEach((b, i) => {
      dummy.position.set(b.x, b.y, b.z); dummy.rotation.set(0, Math.random() * 6.28, 0);
      dummy.scale.set(b.r, b.r * 0.65, b.r); dummy.updateMatrix();
      bushMesh.setMatrixAt(i, dummy.matrix); bushMesh.setColorAt(i, b.col);
    });
    this.scene.add(bushMesh);
  }

  wall(x, z, w, d, h = 3.4, color = COLORS.concrete) {
    const span = Math.max(w, d);
    const m = box(w, h, d, color, { mat: texMat(color, "concrete", { repeat: [Math.max(1, Math.round(span / 3.4)), Math.max(1, Math.round(h / 3.4)) + 1], roughness: 0.95 }) });
    // faint cool emissive so the shadowed/back side of a wall reads as concrete at night, not a flat black silhouette
    m.material.emissive = new THREE.Color(0x121821); m.material.emissiveIntensity = 1;
    m.position.set(x, h / 2, z); this.scene.add(m);
    this.collide(x, z, w, d, h); this.solidMeshes.push(m);
    const cap = box(w + 0.1, 0.25, d + 0.1, COLORS.metalDark, { roughness: 0.8 });
    cap.position.set(x, h + 0.02, z); this.scene.add(cap);
    return m;
  }

  crateStack(x, z, conf = "single") {
    const place = (cx, cz, s, cy = 0) => {
      const c = makeCrate(s); c.position.set(cx, cy + s / 2, cz);
      c.rotation.y = (Math.random() - 0.5) * 0.2; this.scene.add(c);
      this.collide(cx, cz, s, s, cy + s); this.solidMeshes.push(c);
    };
    if (conf === "single") place(x, z, 1.1);
    else if (conf === "pair") { place(x, z, 1.1); place(x + 1.15, z + 0.2, 1.0); }
    else if (conf === "stack") { place(x, z, 1.2); place(x, z, 0.9, 1.2); place(x + 1.2, z - 0.3, 1.0); }
  }

  barrels(x, z, n = 3) {
    for (let i = 0; i < n; i++) {
      const b = makeBarrel(Math.random() > 0.5 ? COLORS.rust : COLORS.olive);
      const bx = x + (i % 2) * 0.85 - 0.4, bz = z + Math.floor(i / 2) * 0.85 - 0.2;
      b.position.set(bx, 0.55, bz); this.scene.add(b);
      const col = this.collide(bx, bz, 0.8, 0.8, 1.1);
      // light enough to be flung by explosions (the impact system pushes it by mass)
      const dyn = this._addDynamic(b, 0.55, 1.3);
      // shootable explosive (HP in "units": 1 rifle shot = 1, grenade = 5, rocket = 15).
      // barrels pop in 2-3 shots.
      const rec = { mesh: b, x: bx, z: bz, hp: rollHp(this.hp.barrelHp), exploded: false, collider: col, dyn };
      b.traverse((o) => { o.userData.explosive = rec; });
      b.userData.explosive = rec;
      this.explosives.push(rec);
      this.solidMeshes.push(b); // also a bullet occluder so the ray actually hits it
    }
  }

  // register a prop that explosions can move; `mass` decides how far it's flung (heavy = barely)
  _addDynamic(mesh, restY, mass) {
    if (!this.dynamics) this.dynamics = [];
    const d = { mesh, pos: mesh.position.clone(), vel: new THREE.Vector3(), spin: new THREE.Vector3(), restY, mass, rest: true };
    this.dynamics.push(d);
    return d;
  }

  // integrate any props that an explosion set in motion (gravity, ground, friction, settle)
  updateDynamics(dt) {
    if (!this.dynamics) return;
    for (const d of this.dynamics) {
      if (d.rest) {
        // a launched wreck that has come to rest: ease it flat onto the ground (so its tumble
        // rotation doesn't leave it half-buried), then fade it out after the delay
        if (d._vanishT != null) {
          const k = Math.min(1, dt * 6);
          d.mesh.rotation.x += (0 - d.mesh.rotation.x) * k;
          d.mesh.rotation.z += (0 - d.mesh.rotation.z) * k;
          d.pos.y += (d.restY - d.pos.y) * k; d.mesh.position.y = d.pos.y;
          d._vanishT -= dt; if (d._vanishT <= 0) { d.mesh.visible = false; d._vanishT = null; }
        }
        continue;
      }
      d.vel.y -= 20 * dt;
      d.pos.addScaledVector(d.vel, dt);
      if (d.pos.y <= d.restY) { d.pos.y = d.restY; d.vel.y *= -0.3; d.vel.x *= 0.7; d.vel.z *= 0.7; }
      d.mesh.position.copy(d.pos);
      d.mesh.rotation.x += d.spin.x * dt; d.mesh.rotation.z += d.spin.z * dt;
      if (d.pos.y <= d.restY + 0.01 && d.vel.lengthSq() < 0.4) {
        d.vel.set(0, 0, 0); d.rest = true;
        if (d.vanish && d._vanishT == null) d._vanishT = d.vanishDelay || 2; // start the on-ground fuse
      }
    }
  }

  sandbags(x, z, len, rot = 0) {
    const s = makeSandbags(len); s.position.set(x, 0, z); s.rotation.y = rot; this.scene.add(s);
    if (Math.abs(rot) < 0.4) this.collide(x, z, len, 0.6, 0.9);
    else this.collide(x, z, 0.6, len, 0.9);
  }

  bollard(x, z) { const b = makeBollard(); b.position.set(x, 0, z); this.scene.add(b); }

  // an ammo magazine pickup with a simple soft radial glow so it's findable at night;
  // hovers + spins; collected on proximity for +rounds reserve
  ammo(x, z, rounds = 30) {
    const C = 0xffce73; // warm amber
    const pg = new THREE.Group(); pg.position.set(x, 0, z);
    const box = makeAmmo(); box.position.y = 0.55; pg.add(box);
    // the box model's center offset above its own origin (so the glow can sit dead-centre on it)
    box.updateWorldMatrix(true, true);
    const bb = new THREE.Box3().setFromObject(box);
    const cy = (bb.min.y + bb.max.y) / 2 - box.position.y;
    // soft radial glow (a single additive sphere — reads the same from any angle)
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 12),
      noOutline(new THREE.MeshBasicMaterial({ color: C, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending })));
    glow.position.y = 0.55 + cy; pg.add(glow);
    // gentle point light so it stands out from the dark ground
    const light = new THREE.PointLight(C, 3, 9, 2); light.position.set(0, 0.55 + cy, 0); pg.add(light);
    this.scene.add(pg);
    if (!this.pickups) this.pickups = [];
    this.pickups.push({ x, z, r: 1.8, rounds, group: pg, box, glow, light, cy, taken: false });
  }

  // objective: extraction pad + waving flag at (x,z); also records the win circle
  objective(x, z, r = 3.0) {
    this.exfil = { x, z, r };
    const pad = makeExfilPad(); pad.position.set(x, 0, z); this.scene.add(pad); this._exfilBeacon = pad;
    this.flag = makeFlag(); this.flag.position.set(x, 0, z); this.scene.add(this.flag);
  }

  // bomb objective: a planted charge the player must reach + disarm; records the trigger circle
  bomb(x, z, r = 3.2) {
    const g = new THREE.Group();
    const crate = box(1.2, 0.8, 0.9, 0x20242a, { metalness: 0.4, roughness: 0.6 }); crate.position.y = 0.4; g.add(crate);
    for (const sx of [-0.32, 0, 0.32]) { const c = cyl(0.12, 0.12, 0.7, 0xb24b3a, 8, { roughness: 0.6 }); c.rotation.x = Math.PI / 2; c.position.set(sx, 0.5, 0.18); g.add(c); }
    const panel = box(0.42, 0.24, 0.06, 0x0c0e10, { flat: true }); panel.position.set(0, 0.58, 0.46); g.add(panel);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.12), noOutline(new THREE.MeshBasicMaterial({ color: 0xff3322 })));
    screen.position.set(0, 0.58, 0.5); g.add(screen);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), noOutline(new THREE.MeshBasicMaterial({ color: 0xff2a1a })));
    led.position.set(0, 0.88, 0.2); g.add(led); this._bombLed = led;
    g.position.set(x, 0, z); this.scene.add(g); this.solidMeshes.push(g);
    this.collide(x, z, 1.3, 1.0, 1.0);
    this.bomb = { x, z, r };
  }

  bunker(x, z) {
    const g = new THREE.Group();
    const w = 5, d = 4, h = 3, t = 0.4;
    const con = (W, H, D) => box(W, H, D, COLORS.concreteDark, { flat: true });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x2a3a44, metalness: 0.4, roughness: 0.25, transparent: true, opacity: 0.4 });
    const Ww = 1.5, wy0 = 1.0, wy1 = 2.0, wMidY = (wy0 + wy1) / 2, wH = wy1 - wy0;
    const back = con(w, h, t); back.position.set(0, h / 2, -d / 2);
    const roof = box(w + 0.4, t, d + 0.4, COLORS.metalDark, { flat: true }); roof.position.set(0, h, 0);
    const frontL = con(w / 2 - 0.6, h, t); frontL.position.set(-(w / 4 + 0.3), h / 2, d / 2);
    const frontR = frontL.clone(); frontR.position.x = w / 4 + 0.3;
    g.add(back, roof, frontL, frontR);
    for (const sx of [-w / 2, w / 2]) {
      const jw = (d - Ww) / 2;
      const sill = con(t, wy0, d); sill.position.set(sx, wy0 / 2, 0);
      const head = con(t, h - wy1, d); head.position.set(sx, (h + wy1) / 2, 0);
      const jf = con(t, wH, jw); jf.position.set(sx, wMidY, Ww / 2 + jw / 2);
      const jb = con(t, wH, jw); jb.position.set(sx, wMidY, -(Ww / 2 + jw / 2));
      const pane = new THREE.Mesh(new THREE.BoxGeometry(0.08, wH, Ww), glassMat); pane.position.set(sx, wMidY, 0);
      pane.raycast = () => {}; // shoot-through glass (wall still blocks walking)
      g.add(sill, head, jf, jb, pane);
    }
    g.position.set(x, 0, z); this.scene.add(g); this.solidMeshes.push(g);
    this.collide(x, z - d / 2, w, t);
    this.collide(x - w / 2, z, t, d);
    this.collide(x + w / 2, z, t, d);
    this.collide(x - (w / 4 + 0.3), z + d / 2, w / 2 - 0.6, t);
    this.collide(x + (w / 4 + 0.3), z + d / 2, w / 2 - 0.6, t);
  }

  tower(x, z) {
    const g = new THREE.Group();
    const legC = COLORS.metalDark;
    for (const sx of [-0.8, 0.8]) for (const sz of [-0.8, 0.8]) {
      const leg = cyl(0.12, 0.12, 4, legC, 8, { metalness: 0.3 }); leg.position.set(sx, 2, sz); g.add(leg);
    }
    const platform = box(2.4, 0.3, 2.4, COLORS.woodDark, { flat: true }); platform.position.y = 4; g.add(platform);
    const rail = box(2.4, 0.8, 0.1, COLORS.metalDark, { flat: true }); rail.position.set(0, 4.5, -1.15);
    const roof = box(2.8, 0.25, 2.8, COLORS.olive, { flat: true }); roof.position.y = 6.5;
    for (const sx of [-1.0, 1.0]) for (const sz of [-1.0, 1.0]) {
      const post = cyl(0.07, 0.07, 2.3, legC, 6); post.position.set(sx, 5.25, sz); g.add(post);
    }
    g.add(rail, roof);
    g.position.set(x, 0, z); this.scene.add(g);
    this.collide(x, z, 2.0, 2.0); this.solidMeshes.push(g);
  }

  // a solid building (walls + roof) with a central doorway on the +Z (front) face — enterable cover
  building(x, z, w, d, h = 3.6, color = COLORS.wall) {
    const t = 0.5;
    this.wall(x, z - d / 2, w, t, h, color);        // back
    this.wall(x - w / 2, z, t, d, h, color);        // left
    this.wall(x + w / 2, z, t, d, h, color);        // right
    const gap = 2.2, seg = (w - gap) / 2;           // front split by a doorway
    this.wall(x - (gap / 2 + seg / 2), z + d / 2, seg, t, h, color);
    this.wall(x + (gap / 2 + seg / 2), z + d / 2, seg, t, h, color);
    const roof = box(w + 0.4, 0.3, d + 0.4, COLORS.metalDark, { flat: true });
    roof.position.set(x, h + 0.05, z); this.scene.add(roof);
  }

  // a real low-poly military vehicle model (truck/flatbed/suv/van) — tall cover that blocks
  // ground line-of-sight. The model faces -Z by default; `rot` turns it.
  vehicle(x, z, rot = 0, type = "truck") {
    const g = makeVehicle(type);
    g.position.set(x, 0, z); g.rotation.y = rot;
    this.scene.add(g); this.solidMeshes.push(g);
    // collider aligned to the long axis (≈4.5m long, ≈2.2m wide)
    const col = (Math.abs(Math.cos(rot)) > 0.5) ? this.collide(x, z, 2.4, 4.6, 2.0) : this.collide(x, z, 4.6, 2.4, 2.0);
    // shootable but tough: takes sustained fire (or one rocket/grenade) before it cooks off,
    // then gets launched into the air as a heavy dynamic and vanishes shortly after landing.
    const dyn = this._addDynamic(g, 0, 60); // heavy: ordinary blasts barely nudge it
    // HP in "units" (1 rifle shot = 1): cars take 7-8 shots
    const rec = { mesh: g, x, z, hp: rollHp(this.hp.vehicleHp), exploded: false, collider: col, dyn };
    g.traverse((o) => { o.userData.vehicle = rec; });
    g.userData.vehicle = rec;
    this.vehicles.push(rec);
  }

  // a run of large horizontal fuel tanks on stands (industrial cover), lined up along +X
  fuelTanks(x, z, n = 2) {
    const g = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const tank = cyl(0.9, 0.9, 3.0, COLORS.metal, 16, { metalness: 0.5, roughness: 0.4 });
      tank.rotation.x = Math.PI / 2; tank.position.set(i * 2.4, 1.0, 0); g.add(tank);
      for (const sz of [-1.5, 1.5]) { const cap = cyl(0.92, 0.92, 0.12, COLORS.metalDark, 16); cap.rotation.x = Math.PI / 2; cap.position.set(i * 2.4, 1.0, sz); g.add(cap); }
    }
    g.position.set(x, 0, z); this.scene.add(g); this.solidMeshes.push(g);
    const cx = x + (n - 1) * 1.2;
    const col = this.collide(cx, z, (n - 1) * 2.4 + 1.8, 3.2, 2.0);
    // shootable industrial fuel tanks: tough, and a BIG explosion when they finally go up
    const rec = { mesh: g, x: cx, z, cy: 1.1, hp: rollHp(this.hp.fuelTankHp), scale: 1.9, radius: 13, damage: 340, exploded: false, collider: col };
    g.traverse((o) => { o.userData.explosive = rec; });
    g.userData.explosive = rec;
    this.explosives.push(rec);
  }

  // a decorative chain-link fence run between two points (visual perimeter; not a bullet/▲ blocker)
  fence(x1, z1, x2, z2, h = 2.0) {
    const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz), ang = Math.atan2(dx, dz);
    const g = new THREE.Group();
    const posts = Math.max(2, Math.round(len / 3));
    for (let i = 0; i <= posts; i++) {
      const p = cyl(0.06, 0.06, h, COLORS.metalDark, 6);
      p.position.set(x1 + dx * i / posts, h / 2, z1 + dz * i / posts); g.add(p);
    }
    for (const ry of [h - 0.1, h * 0.5]) {
      const rail = box(0.05, 0.05, len, COLORS.metalDark); rail.position.set((x1 + x2) / 2, ry, (z1 + z2) / 2); rail.rotation.y = ang; g.add(rail);
    }
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(len, h), new THREE.MeshBasicMaterial({ color: 0x3a3f3a, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
    panel.material.userData.outlineParameters = { visible: false };
    panel.position.set((x1 + x2) / 2, h / 2, (z1 + z2) / 2); panel.rotation.y = ang; g.add(panel);
    this.scene.add(g);
  }

  floodlight(x, z, h, aimX, aimZ, sweep = false, range = 70) {
    const pole = cyl(0.1, 0.14, h, COLORS.metalDark, 8, { metalness: 0.4 });
    pole.position.set(x, h / 2, z); this.scene.add(pole); this.collide(x, z, 0.4, 0.4);
    const fix = new THREE.Vector3(x, h, z);
    const tgt = new THREE.Vector3(aimX, 0.2, aimZ);
    const dir = tgt.clone().sub(fix); const len = dir.length();
    const head = box(0.5, 0.32, 0.42, COLORS.metalDark, { metalness: 0.5, roughness: 0.5 });
    head.position.copy(fix); head.lookAt(tgt); this.scene.add(head);
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.24), new THREE.MeshBasicMaterial({ color: 0xfff3d0 }));
    lens.position.copy(fix).addScaledVector(dir.clone().normalize(), 0.24); lens.lookAt(tgt); this.scene.add(lens);
    const angle = 0.36;
    const light = new THREE.SpotLight(0xfff2cc, 40, range, angle, 0.45, 1.0);
    light.position.copy(fix); light.target.position.copy(tgt); light.castShadow = false;
    this.scene.add(light, light.target);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 18, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2cc, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    cone.material.userData.outlineParameters = { visible: false }; cone.frustumCulled = false; this.scene.add(cone);
    this.spots.push({ light, cone, fix, baseDir: dir.clone().normalize(), maxLen: len, angle, sweep, phase: this.spots.length * 1.3 });
  }

  utilityPole(x, z) {
    const h = 5.4;
    const pole = cyl(0.12, 0.16, h, COLORS.woodDark, 8, { roughness: 0.9 }); pole.position.set(x, h / 2, z); this.scene.add(pole);
    const arm = box(1.8, 0.14, 0.14, COLORS.woodDark, { flat: true }); arm.position.set(x, h - 0.5, z); this.scene.add(arm);
    for (const dx of [-0.7, 0, 0.7]) { const ins = cyl(0.05, 0.05, 0.18, COLORS.metal, 6); ins.position.set(x + dx, h - 0.35, z); this.scene.add(ins); }
    this.collide(x, z, 0.4, 0.4);
    return new THREE.Vector3(x, h - 0.32, z);
  }

  _wire(a, b) {
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.y -= Math.min(0.9, a.distanceTo(b) * 0.12);
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, mid, b]), 12, 0.025, 4, false);
    this.scene.add(new THREE.Mesh(geo, mat(0x0c0d0f, { roughness: 0.8 })));
  }

  // a run of utility poles connected by sagging wires
  powerLine(positions) {
    const tops = positions.map(([x, z]) => this.utilityPole(x, z));
    for (let i = 0; i < tops.length - 1; i++) this._wire(tops[i], tops[i + 1]);
  }

  // ---- per-frame: sweep searchlights + wave the objective flag ----
  _updateSpots(t) {
    const up = this._upY || (this._upY = new THREE.Vector3(0, 1, 0));
    const tmp = this._spotDir || (this._spotDir = new THREE.Vector3());
    for (const s of this.spots) {
      tmp.copy(s.baseDir);
      if (s.sweep) tmp.applyAxisAngle(up, Math.sin(t * 0.5 + s.phase) * 0.7);
      s.light.target.position.copy(s.fix).addScaledVector(tmp, s.maxLen);
      s.light.target.updateMatrixWorld();
      const len = s.maxLen * 3.2;
      const r = Math.tan(s.angle) * len * 0.9;
      s.cone.position.copy(s.fix).addScaledVector(tmp, len / 2);
      s.cone.quaternion.setFromUnitVectors(up, tmp.clone().negate());
      s.cone.scale.set(r, len, r);
    }
  }

  // ---- island content (the "lost arcs" game) ----

  _glowTex() {
    if (this._gtex) return this._gtex;
    const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.4, "rgba(255,255,255,0.5)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    this._gtex = new THREE.CanvasTexture(c); this._gtex.colorSpace = THREE.SRGBColorSpace;
    return this._gtex;
  }

  // a glowing "lost arc" relic: floating spinning ring + core + a soft glow halo around it.
  // No light (emissive + additive sprite) so 12 of them don't recompile shaders. Tracked for the collect objective.
  arc(x, z) {
    const C = 0x6fe0ff;
    const g = new THREE.Group(); g.position.set(x, 1.5 + this._groundY(x, z), z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.13, 12, 24),
      new THREE.MeshStandardMaterial({ color: C, emissive: C, emissiveIntensity: 1.5, roughness: 0.3, metalness: 0.5 }));
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: C, emissiveIntensity: 2.2, roughness: 0.2 }));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._glowTex(), color: C, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    halo.scale.setScalar(3.6);
    // a tall light BEAM shooting to the sky — visible from afar so arcs are easy to find. Additive + an RGB
    // gradient (bright at the base → fading to nothing at the top) gives a clean alpha falloff.
    const beamH = 85;
    const beamGeo = new THREE.CylinderGeometry(0.5, 0.95, beamH, 14, 1, true);
    const bpos = beamGeo.attributes.position, bcol = [];
    for (let i = 0; i < bpos.count; i++) { const a = Math.max(0, 1 - (bpos.getY(i) + beamH / 2) / beamH); bcol.push(a, a, a); }
    beamGeo.setAttribute("color", new THREE.Float32BufferAttribute(bcol, 3));
    const beam = new THREE.Mesh(beamGeo, noOutline(new THREE.MeshBasicMaterial({ color: C, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, vertexColors: true, fog: false })));
    beam.position.y = beamH / 2 - 2.2; // base reaches the GROUND (slightly below, so the arc's bob never lifts it off)
    // a soft glow puddle on the ground where the beam lands
    const foot = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._glowTex(), color: C, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    foot.scale.setScalar(5); foot.position.y = -1.5; // on the ground under the floating relic
    g.add(ring, core, halo, beam, foot);
    this.scene.add(g);
    this.arcs.push({ x, z, r: 2.6, baseY: g.position.y, group: g, ring, core, halo, beam, taken: false });
  }

  // a loot gift crate (kind = "ammo" | "grenade" | "health"); collected on proximity by the runner.
  giftCrate(x, z, kind = "ammo") {
    const C = { ammo: 0xffce73, grenade: 0xd0552e, health: 0x4fd06a, armor: 0x3a9cff, plasma: 0x4fb4ff, laser: 0xff5a3c, shotgun: 0xff8a3a, smg: 0xffd166, minigun: 0xc7903a, railgun: 0x46ff5a, rifle: 0xffe08a, burst: 0xff9e5a, flak: 0xd07a3a, launcher: 0xe06030 }[kind] || 0xffce73;
    const g = new THREE.Group(); g.position.set(x, this._groundY(x, z), z);
    // a low dark plinth + glow halo, with a distinct floating ICON per pickup kind
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.22, 10), mat(0x2c2f36, { roughness: 0.7 })); base.position.y = 0.11; base.castShadow = true;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._glowTex(), color: C, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); halo.scale.setScalar(2.2); halo.position.y = 0.6;
    const icon = this._pickupIcon(kind, C); icon.position.y = 0.75;
    g.add(base, halo, icon);
    this.scene.add(g);
    this.gifts.push({ x, z, r: 1.8, group: g, box: icon, halo, kind, taken: false });
  }

  // a relevant low-poly icon for each pickup kind (ammo box, med kit, grenades, or the real weapon model)
  _pickupIcon(kind, C) {
    const grp = new THREE.Group();
    const ICON = { rifle: "smg", burst: "smg", flak: "minigun", launcher: "minigun" }[kind] || kind; // guns without their own GLB borrow a similar one
    if (["plasma", "laser", "shotgun", "smg", "minigun", "railgun"].includes(ICON)) {
      const m = makeFpWeapon(ICON); if (m) { m.scale.multiplyScalar(1.15); m.rotation.set(0, 0, Math.PI * 0.12); grp.add(m); return grp; }
    }
    if (kind === "health") {
      const m = makeFpWeapon("medkit"); if (m) { m.scale.multiplyScalar(1.1); grp.add(m); return grp; } // real first-aid kit
      grp.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.42, 0.42), mat(0xf2f2f2, { roughness: 0.5 })));
      const red = mat(0xe23b3b, { roughness: 0.5 });
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.3, 0.03), red); v.position.z = 0.22; grp.add(v);
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.13, 0.03), red); h.position.z = 0.22; grp.add(h);
    } else if (kind === "armor") { // blue armor plate / vest
      const blue = mat(0x3a78d8, { metalness: 0.5, roughness: 0.45 });
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.18), blue); grp.add(plate);
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.2), blue); sh.position.y = 0.24; grp.add(sh); // shoulders
      const em = noOutline(new THREE.MeshStandardMaterial({ color: 0x9fd0ff, emissive: 0x3a9cff, emissiveIntensity: 1.6 }));
      const chev = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.03), em); chev.position.set(0, 0.05, 0.1); grp.add(chev);
    } else if (kind === "grenade") {
      const gm = mat(0x3c4a2e, { roughness: 0.6 }), cap = mat(0x9a9a9a, { metalness: 0.6, roughness: 0.4 });
      for (let i = 0; i < 3; i++) { const o = (i - 1) * 0.24, yy = i === 1 ? 0.1 : 0; const b = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8), gm); b.position.set(o, yy, 0); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 6), cap); c.position.set(o, yy + 0.2, 0); grp.add(b, c); }
    } else { // ammo: a cluster of upright brass BULLETS (casing + pointed tip)
      const brass = mat(0xe0b24a, { metalness: 0.8, roughness: 0.22 }), tip = mat(0xb07a2c, { metalness: 0.85, roughness: 0.3 });
      for (let i = 0; i < 6; i++) {
        const o = (i % 3 - 1) * 0.16, row = i < 3 ? -0.08 : 0.08, b = new THREE.Group();
        const cse = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 10), brass); cse.position.y = 0.17;
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 10), tip); nose.position.y = 0.41;
        b.add(cse, nose); b.position.set(o, 0, row); b.rotation.set((Math.random() - 0.5) * 0.08, 0, (Math.random() - 0.5) * 0.08); grp.add(b);
      }
    }
    grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return grp;
  }

  // a low-poly GLB tree (Quaternius birch/palm); the trunk blocks movement, seated on the terrain
  tree(x, z, s = 1, kind = "tree") {
    const g = makeTree(kind); if (!g) return;
    const gy = this._groundY(x, z);
    g.position.set(x, gy, z); g.scale.multiplyScalar(s); g.rotation.y = Math.random() * 6.28;
    // autumn palette — mostly yellow, with orange + red trees mixed in for a more interesting island
    const r = Math.random();
    const leaf = new THREE.Color(r < 0.55 ? 0xf4d62a : r < 0.82 ? 0xe8801c : 0xd6321f); // yellow / orange / red
    g.traverse((o) => { // recolor greenish foliage → the chosen leaf color, leave the trunk
      if (!o.isMesh || !o.material || !o.material.color) return;
      const cc = o.material.color;
      if (cc.g > cc.r * 0.85 && cc.g > cc.b * 1.1) { o.material = o.material.clone(); o.material.color.copy(leaf); }
    });
    this.scene.add(g);
    const c = this.collide(x, z, 0.95 * s, 0.95 * s, 1.4); c.baseY = gy;
  }

  // a low-poly GLB rock (cover / dressing), seated on the terrain
  rock(x, z, s = 1) {
    const g = makeRock(Math.floor(Math.random() * 2)); if (!g) return;
    const gy = this._lowGround(x, z, 1.4 * s); // lowest point under it (no float on slopes)
    g.position.set(x, gy - 0.4 * s, z); g.scale.multiplyScalar(s); g.rotation.y = Math.random() * 6.28; // embed the base so it sits ON the ground
    this.scene.add(g);
    const c = this.collide(x, z, 1.7 * s, 1.7 * s, 2.8 * s); c.baseY = gy; // matches the rock mesh + tall enough to block enemy line-of-sight
  }

  // a climbable wooden lookout: a raised platform reached by a walkable staircase (terrain-seated).
  // Great as high ground to spot arcs + snipe from. Returns { x, z, top } for placing loot on top.
  lookout(x, z) {
    const gy = this._groundY(x, z), H = 3.4;
    const plat = box(5, 0.4, 5, COLORS.woodDark, { roughness: 0.85 }); plat.position.set(x, gy + H, z); plat.castShadow = true; this.scene.add(plat);
    const pc = this.collide(x, z, 5, 5, H); pc.baseY = gy;
    for (const [dx, dz, w, d] of [[0, -2.4, 5, 0.2], [0, 2.4, 5, 0.2], [-2.4, 0, 0.2, 5], [2.4, 0, 0.2, 5]]) {
      const rl = box(w, 0.6, d, COLORS.woodDark, { roughness: 0.85 }); rl.position.set(x + dx, gy + H + 0.5, z + dz); this.scene.add(rl);
    }
    for (const [dx, dz] of [[-2.3, -2.3], [2.3, -2.3], [-2.3, 2.3], [2.3, 2.3]]) {
      const p = cyl(0.16, 0.16, H, COLORS.woodDark, 6, { roughness: 0.9 }); p.position.set(x + dx, gy + H / 2, z + dz); this.scene.add(p);
    }
    const n = Math.ceil(H / 0.34);
    for (let i = 1; i <= n; i++) {
      const h = i * 0.34, sz = z + 2.5 + i * 0.6;
      const step = box(1.6, 0.18, 0.66, COLORS.woodDark, { roughness: 0.85 }); step.position.set(x, gy + h - 0.09, sz); this.scene.add(step);
      const c = this.collide(x, sz, 1.6, 0.66, h); c.baseY = gy;
    }
    return { x, z, top: gy + H };
  }

  // clustered forests with clearings between (rather than a uniform sprinkle)
  // ancient ruins: a stone slab with broken columns of varying height + a fallen lintel (terrain-seated)
  ruin(x, z) {
    const gy = this._lowGround(x, z, 4), stone = 0xcabfa6; // seat the 8x8 slab at the lowest corner (no float)
    const slab = box(8, 0.4, 8, 0xb6ab93, { roughness: 0.95 }); slab.position.set(x, gy + 0.2, z); slab.receiveShadow = true; this.scene.add(slab);
    (this.collide(x, z, 8, 8, 0.4)).baseY = gy;
    for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3], [0, -3.2], [-3.2, 0.5]]) {
      const h = 1.4 + Math.random() * 3.2, c = cyl(0.4, 0.46, h, stone, 8, { roughness: 0.9 });
      c.position.set(x + dx, gy + 0.4 + h / 2, z + dz); c.castShadow = true; this.scene.add(c);
      (this.collide(x + dx, z + dz, 1, 1, 0.4 + h)).baseY = gy;
    }
    const lintel = box(3.6, 0.5, 0.7, stone, { roughness: 0.9 }); lintel.position.set(x + 1, gy + 0.65, z - 3); lintel.rotation.y = 0.3; lintel.castShadow = true; this.scene.add(lintel);
  }

  // a primitive round hut (stone walls + thatch cone roof), terrain-seated
  hut(x, z) {
    const gy = this._groundY(x, z), r = 2.6, h = 2.6;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), mat(0x8a6f4e, { roughness: 0.95 })); body.position.set(x, gy + h / 2, z); body.castShadow = true; this.scene.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(r + 0.55, 2.1, 10), mat(0x6b4a2e, { roughness: 0.95, flat: true })); roof.position.set(x, gy + h + 1.05, z); roof.castShadow = true; this.scene.add(roof);
    (this.collide(x, z, r * 2, r * 2, h + 2)).baseY = gy;
  }

  // a tall tapered obelisk monument with a gilded tip, terrain-seated
  obelisk(x, z) {
    const gy = this._groundY(x, z), stone = 0xc2b79c;
    const base = box(2.2, 0.6, 2.2, 0xa89c80, { roughness: 0.95 }); base.position.set(x, gy + 0.3, z); this.scene.add(base);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.72, 7, 4), mat(stone, { roughness: 0.9, flat: true })); shaft.position.set(x, gy + 4.1, z); shaft.rotation.y = Math.PI / 4; shaft.castShadow = true; this.scene.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.46, 1, 4), mat(0xd9b24a, { roughness: 0.5, flat: true })); tip.position.set(x, gy + 8.1, z); tip.rotation.y = Math.PI / 4; this.scene.add(tip);
    (this.collide(x, z, 2.2, 2.2, 8)).baseY = gy;
  }

  // ── TIME-BROKEN LANDMARKS (the anomaly tore eras together) — real CC0 building GLBs ──
  // median roof-surface height over a building's footprint — raycast a grid straight down, take the median
  // (so thin spires/chimneys/dormers don't make the player float, and the eaves don't make them sink)
  _roofTop(group, cx, cz, half) {
    const rc = this._roofRay || (this._roofRay = new THREE.Raycaster()); rc.far = 600;
    const down = new THREE.Vector3(0, -1, 0), ys = [];
    group.updateMatrixWorld(true);
    for (let ix = -2; ix <= 2; ix++) for (let iz = -2; iz <= 2; iz++) { // 5x5 grid over the footprint
      rc.set(new THREE.Vector3(cx + ix * half * 0.36, 500, cz + iz * half * 0.36), down);
      const h = rc.intersectObject(group, true);
      if (h.length) ys.push(h[0].point.y);
    }
    if (!ys.length) return null;
    ys.sort((a, b) => a - b);
    // stand on the HIGHEST broad surface (never sink inside the roof) but ignore a thin spike (chimney/antenna)
    let top = ys[ys.length - 1];
    const p75 = ys[Math.floor((ys.length - 1) * 0.75)];
    if (top - p75 > 2.5) top = p75;
    return top;
  }

  // a real skyscraper (Quaternius), optionally leaning to read as time-fractured. Bullets hit it, blocks
  // movement, and the player can stand on its footprint top.
  skyscraper(x, z, kind = "b1", tilt = 0) {
    const g = makeBuilding(kind); if (!g || !g.children.length) return;
    const gy = this._lowGround(x, z, 6);
    // rotate in 90° steps so the axis-aligned collider matches the building footprint snugly (clean roof to stand on)
    g.position.set(x, gy, z); g.rotation.y = Math.floor(Math.random() * 4) * (Math.PI / 2); g.rotation.z = tilt; g.rotation.x = tilt * 0.4;
    this.scene.add(g);
    const bb = new THREE.Box3().setFromObject(g), sz = new THREE.Vector3(); bb.getSize(sz);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.solidMeshes.push(g);                                          // bullets hit it
    const half = sz.x * 0.53;
    const roofY = this._roofTop(g, x, z, half) ?? (gy + sz.y * 0.9);   // stand on the ACTUAL roof surface (not the bbox peak)
    (this.collide(x, z, sz.x * 1.06, sz.z * 1.06, roofY - gy)).baseY = gy;
  }

  // a weathered stone pyramid (ancient era) — climbable faces, bullets hit it
  pyramid(x, z, size = 24) {
    const gy = this._lowGround(x, z, size / 2);
    const p = new THREE.Mesh(new THREE.ConeGeometry(size * 0.72, size * 0.82, 4), mat(0xcdb98a, { roughness: 0.96, flat: true }));
    p.position.set(x, gy + size * 0.41 - 0.5, z); p.rotation.y = Math.PI / 4; p.castShadow = true; p.receiveShadow = true; this.scene.add(p);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(size * 0.12, size * 0.14, 4), mat(0xd9b24a, { roughness: 0.5, flat: true })); cap.position.set(x, gy + size * 0.82 - 0.5, z); cap.rotation.y = Math.PI / 4; this.scene.add(cap);
    this.solidMeshes.push(p);
    // stepped collider approximating the cone (concentric tiers) — you can climb it + never clip inside
    for (const [wf, tf] of [[1.42, 0.28], [1.04, 0.5], [0.66, 0.7], [0.3, 0.82]]) (this.collide(x, z, size * wf, size * wf, size * tf)).baseY = gy;
  }

  // a Big Ben-style clock tower (real bell-tower GLB) with four glowing frozen clock faces
  clockTower(x, z) {
    const g = makeBuilding("bell"); if (!g || !g.children.length) return;
    const gy = this._lowGround(x, z, 4);
    g.position.set(x, gy, z); g.rotation.y = Math.floor(Math.random() * 4) * (Math.PI / 2);
    g.scale.multiplyScalar(4); // Big Ben — towering centrepiece (2x the previous height)
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const faceMat = noOutline(new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xffe39a, emissiveIntensity: 1.3 }));
    for (const [dx, dz, ry] of [[2.0, 0, Math.PI / 2], [-2.0, 0, Math.PI / 2], [0, 2.0, 0], [0, -2.0, 0]]) { // local coords (scaled x2 by the group → faces ride up the taller tower)
      const face = new THREE.Mesh(new THREE.CircleGeometry(1.3, 20), faceMat); face.position.set(dx, 22, dz); face.rotation.y = ry; g.add(face);
      const hand = box(0.14, 1.0, 0.06, 0x201810); hand.position.set(dx, 22, dz); hand.rotation.set(0, ry, 1.4); g.add(hand); // hands frozen — time broke
    }
    this.scene.add(g); this.solidMeshes.push(g);
    const bb = new THREE.Box3().setFromObject(g), sz = new THREE.Vector3(); bb.getSize(sz);
    (this.collide(x, z, sz.x * 1.06, sz.z * 1.06, sz.y * 0.98)).baseY = gy; // a tower: stand on the spire pinnacle (on top of everything)
  }

  // A grand open temple/palace the player can climb into: a stepped stone base reached by a front
  // staircase, a ring of columns under a roof, and a glowing centerpiece inside. Terrain-seated.
  palace(x, z) {
    const W = 16, baseH = 3.2, colH = 7, stone = 0xd9d0ba, stoneDark = 0xb6ab93;
    const gy = this._lowGround(x, z, (W + 6) / 2); // seat the wide base at the lowest corner (no float)
    for (let s = 0; s < 3; s++) { // stepped base
      const sw = W + 6 - s * 2, b = box(sw, baseH / 3 + 0.08, sw, s < 2 ? stoneDark : stone, { roughness: 0.92 });
      b.position.set(x, gy + (s + 0.5) * (baseH / 3), z); b.receiveShadow = true; this.scene.add(b);
    }
    const fc = this.collide(x, z, W + 1, W + 1, baseH); fc.baseY = gy; // floor is standable
    const h = W / 2, colXY = [];
    for (let t = 0; t <= 1.001; t += 0.25) { const p = -h + t * W; colXY.push([p, -h], [p, h], [-h, p], [h, p]); }
    for (const [dx, dz] of colXY) { // perimeter columns (gaps wide enough to walk between)
      const c = cyl(0.45, 0.5, colH, stone, 9, { roughness: 0.9 }); c.position.set(x + dx, gy + baseH + colH / 2, z + dz); c.castShadow = true; this.scene.add(c);
      const cc = this.collide(x + dx, z + dz, 1.1, 1.1, baseH + colH); cc.baseY = gy;
    }
    const roof = box(W + 4, 1.1, W + 4, stoneDark, { roughness: 0.9 }); roof.position.set(x, gy + baseH + colH + 0.55, z); roof.castShadow = true; this.scene.add(roof); this.solidMeshes.push(roof);
    const cap = box(W + 1, 0.7, W + 1, stone, { roughness: 0.9 }); cap.position.set(x, gy + baseH + colH + 1.4, z); this.scene.add(cap);
    (this.collide(x, z, W + 4, W + 4, baseH + colH + 1.1)).baseY = gy; // the flat roof is standable (jetpack up onto it)
    // grand front staircase (+z): each step is a SOLID block from below-ground up to its tread height,
    // so the stair sits on the terrain (no floating) and rises to meet the floor edge.
    const steps = Math.ceil(baseH / 0.3), floorEdge = z + (W + 2) / 2;
    for (let i = 1; i <= steps; i++) {
      const sy = i * 0.3, sz = floorEdge + (steps - i) * 0.72 + 0.4, H = sy + 3; // buried base, tread at gy+sy
      const st = box(W * 0.55, H, 0.95, stone, { roughness: 0.92 });
      st.position.set(x, gy + sy - H / 2, sz); this.scene.add(st);
      const sc = this.collide(x, sz, W * 0.55, 0.95, sy); sc.baseY = gy;
    }
    // glowing centerpiece on the floor inside (emissive obelisk + halo, no per-object light)
    const cg = new THREE.Group(); cg.position.set(x, gy + baseH, z);
    const obl = new THREE.Mesh(new THREE.ConeGeometry(0.6, 3.2, 4), noOutline(new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x3aa0ff, emissiveIntensity: 2.2 })));
    obl.position.y = 1.8; cg.add(obl);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._glowTex(), color: 0x6fd0ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(5); halo.position.y = 2; cg.add(halo);
    this.scene.add(cg);
    return { x, z, top: gy + baseH };
  }

  // Place items evenly around a ring (radius r, centre cx,cz), leaving `gates` large evenly-spaced GAPS
  // (the section's entryways). `place(x,z,angle,isGatePost)` builds each piece; gate posts flank the gaps.
  ringOf(cx, cz, r, count, gates, gateWidth, place) {
    const isGate = (f) => { for (let gi = 0; gi < gates; gi++) { let d = Math.abs(f - gi / gates); d = Math.min(d, 1 - d); if (d < gateWidth) return true; } return false; };
    for (let i = 0; i < count; i++) {
      const f = i / count, a = f * Math.PI * 2, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (isGate(f)) continue;
      // a gate post if the NEXT or PREV slot is a gate (i.e. we're at an edge of an opening)
      const edge = isGate((i + 1) / count) || isGate((i - 1 + count) / count);
      place(x, z, a, edge);
    }
  }

  // ── ANCIENT WALLS (Iron Legion): a ring of weathered crenellated stone, with tall gate pillars ──
  sectionWalls(cx, cz, r, gates = 3) {
    const N = 40, segW = (2 * Math.PI * r) / N * 1.15, stone = 0xb7ac8f, dark = 0x9a8f72;
    this.ringOf(cx, cz, r, N, gates, 0.05, (x, z, a, edge) => {
      const gy = this._groundY(x, z); if (gy < 0.3) return; // skip over water
      const seg = box(segW, 3.2, 1.0, edge ? dark : stone, { roughness: 0.96, flat: true });
      seg.position.set(x, gy + 1.6, z); seg.rotation.y = -a; seg.castShadow = true; seg.receiveShadow = true; this.scene.add(seg);
      for (let b = -1; b <= 1; b++) { const m = box(segW * 0.26, 0.7, 1.1, stone, { roughness: 0.95 }); m.position.set(x - Math.sin(-a) * b * segW * 0.33, gy + 3.55, z - Math.cos(-a) * b * segW * 0.33); m.rotation.y = -a; this.scene.add(m); } // battlements
      (this.collide(x, z, segW * 0.85, segW * 0.85, 3.2)).baseY = gy;
      if (edge) { const post = cyl(0.7, 0.85, 5.2, dark, 8, { roughness: 0.92 }); post.position.set(x, gy + 2.6, z); post.castShadow = true; this.scene.add(post); (this.collide(x, z, 1.6, 1.6, 5.2)).baseY = gy; } // gate pillar
    });
  }

  // ── THICK FOREST (Saurian Brood): 3 dense concentric tree rings with path gaps ──
  sectionForest(cx, cz, r, gates = 4) {
    for (let layer = 0; layer < 3; layer++) {
      const rr = r + (layer - 1) * 7, N = Math.round(rr * 0.5);
      this.ringOf(cx, cz, rr, N, gates, 0.06, (x, z) => {
        if (this._groundY(x, z) < 0.5) return; // keep trees out of the water
        this.tree(x + (Math.random() - 0.5) * 4, z + (Math.random() - 0.5) * 4, 1.0 + Math.random() * 0.5);
      });
    }
  }

  // ── SENTINEL PYLONS (Hollow Watch): a ring of tall glowing tech pylons, gaps for entry ──
  sectionPylons(cx, cz, r, gates = 3, color = 0x46ff8a) {
    const N = 22;
    this.ringOf(cx, cz, r, N, gates, 0.06, (x, z, a, edge) => {
      const gy = this._groundY(x, z); if (gy < 0.3) return;
      const h = edge ? 6.5 : 4.5;
      const p = box(0.7, h, 0.7, 0x2b2f36, { metalness: 0.6, roughness: 0.5 }); p.position.set(x, gy + h / 2, z); p.castShadow = true; this.scene.add(p);
      const em = noOutline(new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.2 }));
      const tip = new THREE.Mesh(new THREE.OctahedronGeometry(edge ? 0.6 : 0.42), em); tip.position.set(x, gy + h + 0.3, z); this.scene.add(tip);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._glowTex(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.setScalar(2.4); halo.position.set(x, gy + h + 0.3, z); this.scene.add(halo);
      (this.collide(x, z, 1, 1, h)).baseY = gy;
    });
  }

  scatterTrees(n, rMin, rMax) {
    const clusters = 13;
    for (let cI = 0; cI < clusters; cI++) {
      const a = Math.random() * 6.28, r = rMin + Math.random() * (rMax - rMin);
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r, palmy = Math.hypot(cx, cz) > rMax * 0.82; // palms toward the shore
      const cn = Math.round(n / clusters * (0.6 + Math.random() * 0.8)), spread = 18 + Math.random() * 26;
      for (let i = 0; i < cn; i++) {
        const aa = Math.random() * 6.28, rr = Math.pow(Math.random(), 0.7) * spread;
        const tx = cx + Math.cos(aa) * rr, tz = cz + Math.sin(aa) * rr;
        if (Math.hypot(tx, tz) > rMax + 12) continue;
        this.tree(tx, tz, 1.15 + Math.random() * 1.05, (palmy ? Math.random() < 0.6 : Math.random() < 0.2) ? "palm" : "tree"); // large trees

      }
    }
  }
  scatterRocks(n, rMin, rMax) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, r = rMin + Math.random() * (rMax - rMin); this.rock(Math.cos(a) * r, Math.sin(a) * r, 0.8 + Math.random() * 1.3); }
  }

  // ground elevation at (x,z) for the current level (0 if flat). Set by islandTerrain().
  _groundY(x, z) { return this.terrainHeight ? this.terrainHeight(x, z) : 0; }
  // lowest terrain under a square footprint — seat flat structures here so no edge floats off a slope
  _lowGround(x, z, half) { let m = this._groundY(x, z); for (const [dx, dz] of [[-half, -half], [half, -half], [-half, half], [half, half]]) m = Math.min(m, this._groundY(x + dx, z + dz)); return m; }

  // a driveable car (press E to get in); collected into level.cars for the game loop to drive
  car(x, z, type) { (this.cars ||= []).push(new Car(this.scene, x, z, this, type)); }

  // A sculpted island: a vertex-colored heightfield (grass hills → sandy beach at the shoreline) that
  // rises out of a big sea, ringed by distant mountains. Exposes terrainHeight(x,z) so the player,
  // actors and props all seat on the relief.
  // a shallow lake you can wade into: carves a smooth bowl into the terrain + a wadeable water disc.
  // Call BEFORE islandTerrain() so the heightfield mesh reflects the carve.
  lake(x, z, r = 14, depth = 1.4) { (this._lakes ||= []).push({ x, z, r, depth }); }

  // a tiling ripple normal map for the Water shader (soft random slopes around the neutral 128,128,255)
  _waterNormals() {
    const s = 256, c = document.createElement("canvas"); c.width = c.height = s; const x = c.getContext("2d");
    x.fillStyle = "rgb(128,128,255)"; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 240; i++) {
      const px = Math.random() * s, py = Math.random() * s, r = 8 + Math.random() * 26, dx = Math.random() * 56 - 28, dy = Math.random() * 56 - 28;
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgb(${128 + dx | 0},${128 + dy | 0},255)`); g.addColorStop(1, "rgba(128,128,255,0)");
      x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }

  islandTerrain({ size = 460, segs = 190, sea = 17000 } = {}) {
    const R = size * 0.46; this._seaR = R; // shore radius (wave taper reference)
    const lakes = this._lakes || [];
    // smooth value-noise → fbm, for organic relief + ground variety
    const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
    const vnoise = (x, z) => {
      const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
      const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
      return hash(xi, zi) * (1 - u) * (1 - v) + hash(xi + 1, zi) * u * (1 - v) + hash(xi, zi + 1) * (1 - u) * v + hash(xi + 1, zi + 1) * u * v;
    };
    const fbm = (x, z) => vnoise(x, z) * 0.55 + vnoise(x * 2.1 + 5, z * 2.1 + 9) * 0.3 + vnoise(x * 4.3 + 11, z * 4.3 + 3) * 0.15;
    const hills = [{ x: -64, z: -44, h: 11, r: 58 }, { x: 78, z: 56, h: 8, r: 50 }, { x: 34, z: -96, h: 7, r: 42 }, { x: -100, z: 48, h: 9, r: 46 }];
    const mtns = [{ x: -82, z: -60, h: 38, r: 70 }, { x: 100, z: 78, h: 31, r: 60 }]; // tall CLIMBABLE peaks (snow-capped vantage points)
    const baseAt = (x, z) => { // terrain WITHOUT the lake basins
      const r = Math.hypot(x, z);
      let y = (1 - r / R) * 10;                                          // dome rising out of the sea
      if (r < R) y += (fbm(x * 0.022, z * 0.022) - 0.45) * 17 * (1 - r / R * 0.55); // rolling hills + valleys
      for (const hl of hills) { const d = Math.hypot(x - hl.x, z - hl.z); if (d < hl.r) y += hl.h * Math.pow(Math.cos(d / hl.r * Math.PI / 2), 2); }
      for (const m of mtns) { const d = Math.hypot(x - m.x, z - m.z); if (d < m.r) y += m.h * Math.pow(Math.cos(d / m.r * Math.PI / 2), 2); } // gentler peaks (climbable, fewer facet gaps)
      if (r > R - 12 && r < R + 4) y *= 0.42;                            // flatten the beach near the waterline
      if (r > R) y = Math.min(y, 0.4) - (r - R) * (r - R) * 0.006;        // PLUNGE to deep ocean past the shore → the square plane edge sits far underwater (hidden)
      return y;
    };
    for (const L of lakes) L.level = baseAt(L.x, L.z);                    // each lake's flat rim reference level
    const h = (x, z) => {
      let y = baseAt(x, z);
      for (const L of lakes) { // a fully LEVEL-rimmed bowl (rim = L.level) so the flat disc never floats on a slope; ease to natural terrain just OUTSIDE the rim
        const d = Math.hypot(x - L.x, z - L.z), trans = L.r * 0.4;
        if (d >= L.r + trans) continue;
        const basin = L.level - L.depth * (0.5 + 0.5 * Math.cos(Math.min(1, d / L.r) * Math.PI)); // bowl; at d>=L.r this is exactly L.level (flat rim)
        if (d <= L.r) y = basin;                                          // inside: the leveled bowl, overriding the slope
        else { const k = (d - L.r) / trans; y = basin * (1 - k) + y * k; } // outside: ease the rim back into natural terrain
      }
      return y;
    };
    this.terrainHeight = h; this.seaLevel = 0; // sea surface (for swimming)

    const geo = new THREE.PlaneGeometry(size, size, segs, segs); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, colors = [];
    // alien anomaly palette: orange/amber grass low, DARK-YELLOW grass on the heights (no snow), sand beaches
    const sand = new THREE.Color(0xe6d6a4), gDark = new THREE.Color(0xb05e22), gLight = new THREE.Color(0xe2933a),
      gDry = new THREE.Color(0xc98a3a), dirt = new THREE.Color(0x7a4a26), rock = new THREE.Color(0x847d70), gHigh = new THREE.Color(0x8f7016);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), y = h(x, z); pos.setY(i, y);
      const slope = Math.hypot(h(x + 2, z) - h(x - 2, z), h(x, z + 2) - h(x, z - 2)) / 4; // local steepness
      const highLine = 15 + (fbm(x * 0.05 + 9, z * 0.05 + 4) - 0.5) * 8;
      if (y < -0.6) { c.copy(gDark).lerp(gLight, fbm(x * 0.06, z * 0.06)); } // ocean floor = orange ground (seen through the clear water)
      else if (y < 1.2) c.copy(sand);                                    // sandy beach at the waterline
      else if (slope > 0.95 && y > 2) c.copy(rock);                       // steep cliff faces
      else if (y > highLine) c.copy(gDry).lerp(gHigh, Math.min(1, (y - highLine) / 8)); // dark-yellow grass on the heights
      else if (y > 14) c.copy(gDry).lerp(gHigh, Math.min(1, (y - 14) / 10));
      else {
        const g1 = fbm(x * 0.06, z * 0.06);
        c.copy(gDark).lerp(gLight, g1);
        const dn = fbm(x * 0.035 + 50, z * 0.035 + 50);
        if (dn > 0.62) c.lerp(dirt, Math.min(0.7, (dn - 0.62) / 0.3));   // dirt / worn patches
        else if (g1 < 0.24) c.lerp(gDry, 0.45);                          // dry-grass patches
      }
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
    const land = new THREE.Mesh(geo, mat(0xffffff, { roughness: 1, flat: true }));
    land.material.vertexColors = true; land.receiveShadow = true; this.scene.add(land);
    this.solidMeshes.push(land); // bullets hit the ground/hills/mountains (no shooting through terrain)

    // sea — clear, smooth-shaded water with gentle rolling swell + sky-env reflection (cheap, no reflector).
    const waterGeo = new THREE.PlaneGeometry(sea, sea, 120, 120); waterGeo.rotateX(-Math.PI / 2);
    const wpos = waterGeo.attributes.position, wcol = [], wc = new THREE.Color();
    const shallow = new THREE.Color(0x49b6c6), midSea = new THREE.Color(0x2ba6cc), deep = new THREE.Color(0x10618f); // muted shallow (no harsh light-blue ring)
    for (let i = 0; i < wpos.count; i++) {
      // spread the shallow→deep gradient over a LARGE distance so it stays smooth across the wide sea (no hard ring/seam when viewed from high up)
      const r = Math.hypot(wpos.getX(i), wpos.getZ(i)), tt = Math.min(1, Math.max(0, (r - R) / 1600));
      wc.copy(tt < 0.5 ? shallow.clone().lerp(midSea, tt * 2) : midSea.clone().lerp(deep, (tt - 0.5) * 2));
      wcol.push(wc.r, wc.g, wc.b);
    }
    waterGeo.setAttribute("color", new THREE.Float32BufferAttribute(wcol, 3));
    const water = new THREE.Mesh(waterGeo, noOutline(new THREE.MeshStandardMaterial({
      vertexColors: true, flatShading: false, metalness: 0.35, roughness: 0.06, envMapIntensity: 1.25, transparent: true, opacity: 0.68, // clear + glossy + smooth
    })));
    water.position.y = 0; this.scene.add(water); this._sea = water; this._seaPos = wpos;
    this._seaBase = Float32Array.from(wcol); this._seaColAttr = waterGeo.attributes.color; // base tint, for bold white XIII wave crests
    const foam = new THREE.Mesh(new THREE.RingGeometry(R - 3, R + 3, 110),
      noOutline(new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide })));
    foam.rotation.x = -Math.PI / 2; foam.position.y = 0.18; this.scene.add(foam);

    // distant mountain range: dense OVERLAPPING craggy peaks (leaning apexes) that merge into a continuous
    // silhouette — near rocky band + far big hazy snow band for depth.
    // ONE continuous mountain range encircling the island: a wavy ridge (smooth peaks + saddles via
    // layered sines) with sloped flanks down to the sea + snow on the high parts. Two layers for depth.
    const mountainRing = (radius, width, maxH, col, snowy, seed) => {
      const N = 130, posArr = [], colArr = [];
      const cRock = new THREE.Color(col), cSnow = new THREE.Color(0xf4f7f9), cBase = new THREE.Color(col).multiplyScalar(0.86);
      const Hf = (a) => {
        const h = (0.5 + 0.5 * Math.sin(a * 4 + seed)) * 0.5 + (0.5 + 0.5 * Math.sin(a * 9 + seed * 2.3)) * 0.3 + (0.5 + 0.5 * Math.sin(a * 19 + seed * 3.7)) * 0.2;
        return maxH * (0.32 + 0.68 * h);
      };
      const rAt = (a) => radius + Math.sin(a * 6 + seed * 1.5) * width * 0.45; // wavy (non-circular) ridge line
      const pt = (a, rr, y) => [Math.cos(a) * rr, y, Math.sin(a) * rr];
      const topCol = (H) => cRock.clone().lerp(cSnow, snowy ? Math.max(0, Math.min(1, (H - maxH * 0.5) / (maxH * 0.32))) : 0);
      const push = (p, c) => { posArr.push(p[0], p[1], p[2]); colArr.push(c.r, c.g, c.b); };
      for (let i = 0; i < N; i++) {
        const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2, r0 = rAt(a0), r1 = rAt(a1), H0 = Hf(a0), H1 = Hf(a1);
        const t0 = pt(a0, r0, H0), t1 = pt(a1, r1, H1);
        const inn0 = pt(a0, r0 - width, -4), inn1 = pt(a1, r1 - width, -4), out0 = pt(a0, r0 + width, -4), out1 = pt(a1, r1 + width, -4);
        const c0 = topCol(H0), c1 = topCol(H1);
        push(inn0, cBase); push(t0, c0); push(inn1, cBase); push(t0, c0); push(t1, c1); push(inn1, cBase);     // inner flank
        push(t0, c0); push(out0, cBase); push(t1, c1); push(out0, cBase); push(out1, cBase); push(t1, c1);     // outer flank
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(posArr, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(colArr, 3));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat(0xffffff, { roughness: 1, flat: true }));
      m.material.vertexColors = true; m.material.side = THREE.DoubleSide; this.scene.add(m); // double-sided so flanks are lit regardless of winding
    };
    void mountainRing; // island is ringed by OPEN WATER only — no distant range
    for (const L of lakes) { // wadeable shallow-lake surfaces (sit just below the original ground)
      const wy = h(L.x, L.z) + L.depth - 0.28;
      const disc = new THREE.Mesh(new THREE.CircleGeometry(L.r, 28),
        noOutline(new THREE.MeshStandardMaterial({ color: 0x46b0d2, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.6 })));
      disc.rotation.x = -Math.PI / 2; disc.position.set(L.x, wy, L.z); this.scene.add(disc);
    }
    return this;
  }

  update(t) {
    this._updateSpots(t);
    // THE COLLECTIVE arena: spin the concentric halo rings (mesmerising meditation aura) + drift the crystals
    if (this._collectiveRings) for (let i = 0; i < this._collectiveRings.length; i++) this._collectiveRings[i].rotation.z = t * (0.12 + i * 0.06) * (i % 2 ? 1 : -1);
    if (this._collectiveRocks) for (const r of this._collectiveRocks) { r.rotation.y += 0.0015; r.position.y = r.userData.baseY + Math.sin(t * 0.5 + r.position.x * 0.1) * 1.6; }
    if (this._seaPos) { // smooth rolling swell + analytic normals + bold white XIII foam crests
      const p = this._seaPos, n = this._sea.geometry.attributes.normal, col = this._seaColAttr, base = this._seaBase, R = this._seaR || 200;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        const taper = Math.min(1, Math.max(0, (Math.hypot(x, z) - R) / 50)); // flat at the shoreline → swells out at sea
        const wy = (Math.sin(x * 0.02 + t * 1.0) * 0.8 + Math.cos(z * 0.017 + t * 0.8) * 0.8) * taper;
        const ripple = Math.sin((x + z) * 0.09 + t * 2.2) * 0.18 * taper; // small chop riding the swell → sharper crests
        p.setY(i, wy + ripple);
        const dydx = Math.cos(x * 0.02 + t * 1.0) * 0.02 * 0.8, dydz = -Math.sin(z * 0.017 + t * 0.8) * 0.017 * 0.8;
        const inv = 1 / Math.hypot(dydx, 1, dydz); n.setXYZ(i, -dydx * inv, inv, -dydz * inv);
        // bold white foam on the wave crests (cel/XIII look)
        const crest = Math.max(0, Math.min(1, (wy + ripple - 0.55) * 1.5)), k = i * 3;
        col.array[k] = base[k] + (1 - base[k]) * crest;
        col.array[k + 1] = base[k + 1] + (1 - base[k + 1]) * crest;
        col.array[k + 2] = base[k + 2] + (1 - base[k + 2]) * crest;
      }
      p.needsUpdate = true; n.needsUpdate = true; col.needsUpdate = true;
    }
    for (const a of this.arcs) {
      if (a.taken) continue;
      a.group.position.y = a.baseY + Math.sin(t * 1.6 + a.x) * 0.18;
      a.ring.rotation.y = t * 1.2; a.ring.rotation.z = t * 0.6; a.core.rotation.y = -t * 2;
      a.halo.material.opacity = 0.6 + Math.sin(t * 3) * 0.25;
      if (a.beam) { // subtle living beam: gentle brightness pulse, slow spin, width breathe + a faint hue drift
        a.beam.material.opacity = 0.22 + Math.sin(t * 1.4 + a.x) * 0.1;
        a.beam.rotation.y = t * 0.25;
        const s = 1 + Math.sin(t * 0.8 + a.z) * 0.09; a.beam.scale.set(s, 1, s);
        a.beam.material.color.setHSL(0.53 + Math.sin(t * 0.5 + a.x) * 0.035, 0.95, 0.62);
      }
    }
    for (const gf of this.gifts) {
      if (gf.taken) continue;
      gf.box.rotation.y = t * 0.8; gf.box.position.y = 0.78 + Math.sin(t * 2) * 0.07; gf.halo.material.opacity = 0.5 + Math.sin(t * 3) * 0.2;
    }
    if (this._bombLed) this._bombLed.visible = Math.sin(t * 6) > -0.3; // blinking charge indicator
    if (this.pickups) for (const p of this.pickups) {
      if (p.taken) continue;
      const bob = 0.55 + Math.sin(t * 2.2) * 0.12; // hover height
      p.box.rotation.y = t * 1.6;
      p.box.position.y = bob;
      const center = bob + p.cy - 0.12;  // glow centred on the box, a touch lower
      p.glow.position.y = center;
      p.light.position.y = center;
      const pulse = 0.75 + Math.sin(t * 3) * 0.25;  // gentle glow pulse
      p.glow.material.opacity = 0.22 * pulse;
      p.light.intensity = 3 * pulse;
    }
    if (!this.flag) return;
    const cloth = this.flag.userData.cloth, base = this.flag.userData.base, W = this.flag.userData.flagW;
    const pos = cloth.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3], f = x / W;
      pos.setZ(i, base[i * 3 + 2] + Math.sin(x * 3.2 - t * 6) * 0.14 * f);
      pos.setY(i, base[i * 3 + 1] + Math.sin(x * 2.2 - t * 5) * 0.05 * f);
    }
    pos.needsUpdate = true; cloth.geometry.computeVertexNormals();
    this.flag.rotation.y = Math.sin(t * 0.4) * 0.12;
  }

  // 2D segment-vs-AABB occlusion test for enemy line-of-sight (minTop>0 => only tall blockers)
  segmentBlocked(ax, az, bx, bz, minTop = 0) {
    const dx = bx - ax, dz = bz - az;
    // terrain occlusion: a hill/mountain rising above the sight line blocks it
    if (this.terrainHeight) {
      const sy = this.terrainHeight(ax, az) + 1.6, ey = this.terrainHeight(bx, bz) + 1.6;
      for (let k = 1; k < 7; k++) { const u = k / 7, ly = sy + (ey - sy) * u; if (this.terrainHeight(ax + dx * u, az + dz * u) > ly + 0.8) return true; }
    }
    for (const c of this.colliders) {
      if (c.top < minTop) continue;
      if (ax >= c.minX && ax <= c.maxX && az >= c.minZ && az <= c.maxZ) continue;
      let t0 = 0, t1 = 1;
      const p = [-dx, dx, -dz, dz];
      const q = [ax - c.minX, c.maxX - ax, az - c.minZ, c.maxZ - az];
      let ok = true;
      for (let i = 0; i < 4; i++) {
        if (Math.abs(p[i]) < 1e-8) { if (q[i] < 0) { ok = false; break; } }
        else {
          const r = q[i] / p[i];
          if (p[i] < 0) { if (r > t1) { ok = false; break; } if (r > t0) t0 = r; }
          else { if (r < t0) { ok = false; break; } if (r < t1) t1 = r; }
        }
      }
      if (ok && t0 <= t1) return true;
    }
    return false;
  }
}
