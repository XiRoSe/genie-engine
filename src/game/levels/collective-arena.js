import * as THREE from "three";
import { box, mat, noOutline } from "../../engine/primitives.js";

// COLLECTIVE ARENA — a vast SQUARE purple/violet meditation-temple boss chamber (Rick vs "The
// Collective"). A dark-purple mandala floor, four 30-tall glowing-rune walls, floating glyph-orbs,
// and a raised stepped DAIS at the far end backed by a giant glowing mandala halo where the colossal
// boss floats. All the "glow" is EMISSIVE / additive geometry (no per-object lights) so the cel-shade
// shader never recompiles — just ONE hemisphere + ONE dim directional light the level over.

const HALF = 75;        // half-extent of the square chamber (≈150×150 interior)
const WALL_H = 30;      // perimeter wall height
const THRONE_TOP = 3.0; // walkable Y on top of the dais (returned so the level can float the boss)

// ---- procedural textures (each built once, module-cached) ------------------
let _floorTex = null, _mandalaTex = null, _orbTex = null;

// deep-purple tiled floor: concentric magenta rings + radial spokes on violet (an OPAQUE map)
function floorTexture() {
  if (_floorTex) return _floorTex;
  const c = document.createElement("canvas"); c.width = c.height = 512; const x = c.getContext("2d");
  x.fillStyle = "#150a24"; x.fillRect(0, 0, 512, 512);                 // deep violet base
  // soft mottle so the flat plane isn't dead-flat
  for (let i = 0; i < 140; i++) { const r = 8 + Math.random() * 46; x.fillStyle = `rgba(120,50,180,${0.03 + Math.random() * 0.05})`; x.beginPath(); x.arc(Math.random() * 512, Math.random() * 512, r, 0, 7); x.fill(); }
  // a mandala per tile: concentric rings + radial spokes glowing magenta
  x.translate(256, 256);
  x.strokeStyle = "rgba(210,70,190,0.5)"; x.lineWidth = 2;
  for (let r = 40; r < 250; r += 34) { x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); }
  x.strokeStyle = "rgba(255,120,220,0.35)"; x.lineWidth = 1.5;
  for (let a = 0; a < 24; a++) { x.save(); x.rotate((a / 24) * Math.PI * 2); x.beginPath(); x.moveTo(30, 0); x.lineTo(250, 0); x.stroke(); x.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); t.anisotropy = 4;
  _floorTex = t; return t;
}

// glowing sacred-geometry decal on TRANSPARENT canvas (drawn bright on black → reads as runes when
// blended ADDITIVELY over a dark-purple wall). Lotus petals + rings + radial lines + glyph dots.
function mandalaTexture() {
  if (_mandalaTex) return _mandalaTex;
  const c = document.createElement("canvas"); c.width = c.height = 512; const x = c.getContext("2d");
  x.translate(256, 256);
  // faint violet aura so the wall around the runes softly glows
  const aura = x.createRadialGradient(0, 0, 0, 0, 0, 250);
  aura.addColorStop(0, "rgba(90,20,140,0.55)"); aura.addColorStop(0.6, "rgba(60,12,100,0.22)"); aura.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = aura; x.beginPath(); x.arc(0, 0, 250, 0, 7); x.fill();
  // concentric rings
  x.strokeStyle = "rgba(255,110,210,0.85)"; x.lineWidth = 3;
  for (let r = 46; r < 240; r += 40) { x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); }
  // radial spokes
  x.strokeStyle = "rgba(255,150,235,0.6)"; x.lineWidth = 2;
  for (let a = 0; a < 32; a++) { x.save(); x.rotate((a / 32) * Math.PI * 2); x.beginPath(); x.moveTo(24, 0); x.lineTo(238, 0); x.stroke(); x.restore(); }
  // lotus petals (overlapping arcs forming a flower)
  x.strokeStyle = "rgba(255,90,190,0.9)"; x.lineWidth = 3;
  for (let a = 0; a < 16; a++) {
    x.save(); x.rotate((a / 16) * Math.PI * 2);
    x.beginPath(); x.arc(120, 0, 60, Math.PI * 0.62, Math.PI * 1.38); x.stroke();
    x.restore();
  }
  // glyph dots around the rim (om-like orbs)
  x.fillStyle = "rgba(255,180,240,0.95)";
  for (let a = 0; a < 12; a++) { const r = 214, ang = (a / 12) * Math.PI * 2; x.beginPath(); x.arc(Math.cos(ang) * r, Math.sin(ang) * r, 6, 0, 7); x.fill(); }
  // bright core
  const core = x.createRadialGradient(0, 0, 0, 0, 0, 40); core.addColorStop(0, "rgba(255,220,255,0.95)"); core.addColorStop(1, "rgba(255,120,220,0)");
  x.fillStyle = core; x.beginPath(); x.arc(0, 0, 40, 0, 7); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  _mandalaTex = t; return t;
}

// soft radial-gradient blob for the floating glyph-orbs (additive)
function orbTexture() {
  if (_orbTex) return _orbTex;
  const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,220,255,1)"); g.addColorStop(0.35, "rgba(255,110,220,0.7)"); g.addColorStop(1, "rgba(120,20,180,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  _orbTex = t; return t;
}

// shorthand for an additive, outline-skipped glow material bound to a texture
const glowMat = (tex, opacity = 1) => noOutline(new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));

export function buildCollectiveArena(b) {
  const scene = b.scene;

  // ── 1. FLOOR — big dark-violet mandala plane, plus a glowing inlaid circle toward the dais ──
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2), mat(0x150a24, { roughness: 1 }));
  floor.material.map = floorTexture(); floor.material.needsUpdate = true;
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  // a faint glowing mandala inlaid into the floor between centre and the dais
  const inlay = new THREE.Mesh(new THREE.CircleGeometry(20, 48), glowMat(mandalaTexture(), 0.55));
  inlay.rotation.x = -Math.PI / 2; inlay.position.set(0, 0.05, 24); scene.add(inlay);

  // ── 2. FOUR PERIMETER WALLS (tall, thick, deep-purple) + glowing mandala rune decals ──
  const WALL = 0x2a1a3e, T = 2;
  b.wall(0, HALF, HALF * 2 + T, T, WALL_H, WALL);   // far  (+Z, behind the dais)
  b.wall(0, -HALF, HALF * 2 + T, T, WALL_H, WALL);  // near (−Z, the entrance)
  b.wall(HALF, 0, T, HALF * 2 + T, WALL_H, WALL);   // east (+X)
  b.wall(-HALF, 0, T, HALF * 2 + T, WALL_H, WALL);  // west (−X)
  // a wide repeating rune decal just in front of each inner face, facing into the room
  const inner = HALF - T / 2 - 0.3, decalW = HALF * 2 - 6, decalH = 24, decalY = 13;
  const decal = (px, pz, ry) => {
    const geo = new THREE.PlaneGeometry(decalW, decalH);
    const m = glowMat(mandalaTexture().clone(), 0.85); m.map.repeat.set(6, 1); m.map.needsUpdate = true;
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(px, decalY, pz); mesh.rotation.y = ry; scene.add(mesh);
  };
  decal(0, inner, Math.PI);          // far wall, faces −Z
  decal(0, -inner, 0);               // near wall, faces +Z
  decal(inner, 0, -Math.PI / 2);     // east wall, faces −X
  decal(-inner, 0, Math.PI / 2);     // west wall, faces +X

  // ── 3. FLOATING GLYPH-ORBS scattered high on the walls (additive; reuse one geo + mat) ──
  b._collectiveOrbs = [];
  const orbGeo = new THREE.PlaneGeometry(3, 3);
  const orbMat = glowMat(orbTexture(), 0.9);
  const orbAt = (px, py, pz) => {
    const o = new THREE.Mesh(orbGeo, orbMat); o.position.set(px, py, pz);
    o.lookAt(0, py, 0); o.userData.baseY = py; scene.add(o); b._collectiveOrbs.push(o); // baseY lets a level bob them later (optional)
  };
  const wIn = HALF - T - 0.5;
  for (let i = 0; i < 5; i++) { const u = (i - 2) * 26; orbAt(u, 8 + Math.random() * 14, wIn); orbAt(u, 8 + Math.random() * 14, -wIn); } // far + near walls
  for (let i = 0; i < 4; i++) { const u = (i - 1.5) * 30; orbAt(wIn, 8 + Math.random() * 14, u); orbAt(-wIn, 8 + Math.random() * 14, u); } // east + west walls

  // ── 4. THE DAIS / THRONE — 4 concentric climbable steps + throne platform at z≈+55 ──
  const DZ = 55, stepColor = 0x3a2456, stepH = 0.6;
  const steps = [[22, 0.6], [17, 1.2], [12.5, 1.8], [8.5, 2.4]]; // [square size, walkable top]
  for (const [size, top] of steps) {
    const s = box(size, stepH, size, stepColor, { roughness: 0.85 });
    s.position.set(0, top - stepH / 2, DZ); scene.add(s);
    b.collide(0, DZ, size, size, top); // nested AABBs → player climbs step-by-step
  }
  const platform = box(7, stepH, 7, 0x472c68, { roughness: 0.8, emissive: 0x2a0f4a, emissiveIntensity: 0.6 });
  platform.position.set(0, THRONE_TOP - stepH / 2, DZ); scene.add(platform);
  b.collide(0, DZ, 7, 7, THRONE_TOP);
  // glowing inlaid ring on the throne top (where the boss meditates)
  const seal = new THREE.Mesh(new THREE.RingGeometry(2, 3, 32), glowMat(mandalaTexture(), 0.8));
  seal.rotation.x = -Math.PI / 2; seal.position.set(0, THRONE_TOP + 0.03, DZ); scene.add(seal);

  // ── 4b. GIANT MANDALA HALO rising up the far wall behind the throne ──
  const haloY = 15, haloZ = HALF - T - 1.2;
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), glowMat(mandalaTexture(), 0.9));
  backdrop.position.set(0, haloY, haloZ); backdrop.rotation.y = Math.PI; scene.add(backdrop); // faces −Z
  // concentric additive torus rings for depth
  const ringMat = noOutline(new THREE.MeshBasicMaterial({ color: 0xff5ad0, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  for (const r of [6, 9, 12]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.35, 10, 48), ringMat);
    ring.position.set(0, haloY, haloZ - 0.3); scene.add(ring);
  }
  // bright core disc
  const coreDisc = new THREE.Mesh(new THREE.CircleGeometry(4.5, 40), noOutline(new THREE.MeshBasicMaterial({ color: 0xffb0f0, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
  coreDisc.position.set(0, haloY, haloZ - 0.1); coreDisc.rotation.y = Math.PI; scene.add(coreDisc);

  // ── 5. PURPLE ATMOSPHERE — fog + ONE hemisphere + ONE dim directional (no per-prop lights) ──
  scene.fog = new THREE.Fog(0x2a1440, 40, 260);
  scene.add(new THREE.HemisphereLight(0xc060ff, 0x1a0a2e, 0.8));
  const key = new THREE.DirectionalLight(0xd9a0ff, 0.35); key.position.set(20, 40, -30); scene.add(key);

  // ── 6. PLAYER SPAWN + walkable bounds (just inside the walls) ──
  b.spawnAt(0, -60);
  b.setBounds({ minX: -72, maxX: 72, minZ: -72, maxZ: 72 });

  // ── 7. WEAPON PICKUPS — scatter blasters + ammo/health so Rick can arm up ──
  const CRATES = [
    ["rifle", -18, -45], ["rifle", 18, -45], ["burst", -34, -18], ["burst", 34, -18],
    ["plasma", -40, 20], ["plasma", 40, 20], ["minigun", 0, -30], ["launcher", 0, 30],
    ["ammo", -12, 0], ["ammo", 12, 0], ["health", -28, 40], ["health", 28, 40],
  ];
  for (const [kind, x, z] of CRATES) b.giftCrate(x, z, kind);

  // ── 8. hand the level the throne top, boss spawn, and suggested drone spawns ──
  return {
    throne: { x: 0, z: DZ, top: THRONE_TOP },
    bossSpawn: { x: 0, z: DZ },
    droneSpawns: [
      { x: -45, z: -25 }, { x: 45, z: -25 }, { x: -45, z: 25 },
      { x: 45, z: 25 }, { x: 0, z: 0 }, { x: 0, z: 38 },
    ],
  };
}
