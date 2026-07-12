import * as THREE from "three";
import { box, cyl, mat, noOutline } from "../../engine/primitives.js";

// COLLECTIVE ARENA — a VAST, FULLY-ENCLOSED, BRIGHT purple/magenta cube lair (Rick & Morty S9E1
// "The Collective"): a psychedelic cosmic meditation-temple. Floor + 4 tall walls + a CEILING (no sky
// is ever visible) all in luminous violet, covered in glowing sacred-geometry mandalas of MANY kinds
// and sizes, floating pink glyph-orbs, floating purple crystals/asteroids, and weird glowing cosmic
// HANDS reaching out of the walls. At the far end a stepped climbable DAIS backed by a giant glowing
// mandala HALO is where the cube-headed Galactus boss meditates. Everything "glows" with EMISSIVE /
// additive geometry (no per-prop lights) — only THREE scene-wide lights so the cel-shader never recompiles.

const HALF = 140;       // half-extent of the square chamber → 280×280 interior
const WALL_H = 56;      // wall height / ceiling elevation — the room is genuinely vast
const T = 3;            // wall / ceiling thickness
const THRONE_TOP = 4.2; // walkable Y on top of the dais (returned so the level can float the boss)

// base surface colours — MID/LIGHT violet (NOT near-black); brightness is the #1 fix
const C_WALL = 0x4a2d78, C_FLOOR = 0x38215c, C_CEIL = 0x452a72, C_STEP = 0x51357e;

// ---- procedural textures (each built once, module-cached) ------------------
let _floorTex = null, _orbTex = null;
const _mandalaTexs = [];   // FOUR different sacred-geometry decals (built once)

// wrap a bright-on-transparent draw routine into a cached RepeatWrapping CanvasTexture (additive decal)
function makeMandala(idx, draw) {
  if (_mandalaTexs[idx]) return _mandalaTexs[idx];
  const c = document.createElement("canvas"); c.width = c.height = 512; const x = c.getContext("2d");
  x.translate(256, 256);
  // faint violet aura so the wall around every rune softly glows (keeps the room luminous)
  const aura = x.createRadialGradient(0, 0, 0, 0, 0, 250);
  aura.addColorStop(0, "rgba(120,40,190,0.5)"); aura.addColorStop(0.6, "rgba(80,20,140,0.2)"); aura.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = aura; x.beginPath(); x.arc(0, 0, 250, 0, 7); x.fill();
  draw(x);
  // bright core common to all
  const core = x.createRadialGradient(0, 0, 0, 0, 0, 38); core.addColorStop(0, "rgba(255,225,255,0.95)"); core.addColorStop(1, "rgba(255,120,220,0)");
  x.fillStyle = core; x.beginPath(); x.arc(0, 0, 38, 0, 7); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  _mandalaTexs[idx] = t; return t;
}

// 0 — LOTUS: concentric rings + radial spokes + overlapping lotus petals + rim glyph-dots
function mandalaLotus() {
  return makeMandala(0, (x) => {
    x.strokeStyle = "rgba(255,110,210,0.85)"; x.lineWidth = 3;
    for (let r = 46; r < 240; r += 40) { x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); }
    x.strokeStyle = "rgba(255,150,235,0.6)"; x.lineWidth = 2;
    for (let a = 0; a < 32; a++) { x.save(); x.rotate((a / 32) * Math.PI * 2); x.beginPath(); x.moveTo(24, 0); x.lineTo(238, 0); x.stroke(); x.restore(); }
    x.strokeStyle = "rgba(255,90,190,0.9)"; x.lineWidth = 3;
    for (let a = 0; a < 16; a++) { x.save(); x.rotate((a / 16) * Math.PI * 2); x.beginPath(); x.arc(120, 0, 60, Math.PI * 0.62, Math.PI * 1.38); x.stroke(); x.restore(); }
    x.fillStyle = "rgba(255,180,240,0.95)";
    for (let a = 0; a < 12; a++) { const r = 214, g = (a / 12) * Math.PI * 2; x.beginPath(); x.arc(Math.cos(g) * r, Math.sin(g) * r, 6, 0, 7); x.fill(); }
  });
}

// 1 — FLOWER OF LIFE: hex-packed overlapping circles inside two bounding rings
function mandalaFlower() {
  return makeMandala(1, (x) => {
    const R = 46, S = Math.sqrt(3);
    const centers = [[0, 0]];
    for (let a = 0; a < 6; a++) { const g = a * Math.PI / 3; centers.push([Math.cos(g) * R, Math.sin(g) * R]); }
    for (let a = 0; a < 6; a++) { const g = a * Math.PI / 3; centers.push([Math.cos(g) * R * 2, Math.sin(g) * R * 2]); const h = g + Math.PI / 6; centers.push([Math.cos(h) * R * S, Math.sin(h) * R * S]); }
    x.strokeStyle = "rgba(255,120,225,0.8)"; x.lineWidth = 3;
    for (const [cx, cy] of centers) { x.beginPath(); x.arc(cx, cy, R, 0, 7); x.stroke(); }
    x.strokeStyle = "rgba(255,175,245,0.7)"; x.lineWidth = 4;
    for (const r of [R * 3, R * 3 + 12]) { x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); }
  });
}

// 2 — HEXAGRAM: two interlocking triangles (Star of David) + rings + point-stars
function mandalaStar() {
  return makeMandala(2, (x) => {
    const R = 205;
    const tri = (rot) => { x.beginPath(); for (let i = 0; i < 3; i++) { const a = rot + i * 2 * Math.PI / 3 - Math.PI / 2, px = Math.cos(a) * R, py = Math.sin(a) * R; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); x.stroke(); };
    x.strokeStyle = "rgba(255,105,205,0.85)"; x.lineWidth = 4; tri(0); tri(Math.PI / 3);
    x.strokeStyle = "rgba(255,160,240,0.6)"; x.lineWidth = 2;
    for (const r of [70, 120, 235]) { x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); }
    x.fillStyle = "rgba(255,190,245,0.95)";
    for (let a = 0; a < 6; a++) { const g = a * Math.PI / 3 - Math.PI / 2; x.beginPath(); x.arc(Math.cos(g) * R, Math.sin(g) * R, 7, 0, 7); x.fill(); }
  });
}

// 3 — CONCENTRIC OM: dotted concentric rings + spokes + a central swirl (spiral)
function mandalaOm() {
  return makeMandala(3, (x) => {
    x.setLineDash([7, 11]); x.lineWidth = 2.5;
    for (let r = 44; r < 240; r += 26) { x.strokeStyle = `rgba(255,${120 + r * 0.35},235,0.6)`; x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); }
    x.setLineDash([]);
    x.strokeStyle = "rgba(255,150,235,0.5)"; x.lineWidth = 1.5;
    for (let a = 0; a < 24; a++) { x.save(); x.rotate((a / 24) * Math.PI * 2); x.beginPath(); x.moveTo(50, 0); x.lineTo(238, 0); x.stroke(); x.restore(); }
    x.strokeStyle = "rgba(255,120,225,0.9)"; x.lineWidth = 4; x.beginPath();
    for (let a = 0; a < Math.PI * 4; a += 0.14) { const r = a * 6.4; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.stroke();
  });
}

// build all four up-front and return the array of textures
function allMandalas() { return [mandalaLotus(), mandalaFlower(), mandalaStar(), mandalaOm()]; }

// bright violet tiled floor map (OPAQUE) — concentric magenta rings + spokes on mid-violet
function floorTexture() {
  if (_floorTex) return _floorTex;
  const c = document.createElement("canvas"); c.width = c.height = 512; const x = c.getContext("2d");
  x.fillStyle = "#3a2264"; x.fillRect(0, 0, 512, 512);                 // BRIGHT violet base (not near-black)
  for (let i = 0; i < 140; i++) { const r = 8 + Math.random() * 46; x.fillStyle = `rgba(150,70,210,${0.05 + Math.random() * 0.07})`; x.beginPath(); x.arc(Math.random() * 512, Math.random() * 512, r, 0, 7); x.fill(); }
  x.translate(256, 256);
  x.strokeStyle = "rgba(220,90,205,0.55)"; x.lineWidth = 2;
  for (let r = 40; r < 250; r += 34) { x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); }
  x.strokeStyle = "rgba(255,140,230,0.4)"; x.lineWidth = 1.5;
  for (let a = 0; a < 24; a++) { x.save(); x.rotate((a / 24) * Math.PI * 2); x.beginPath(); x.moveTo(30, 0); x.lineTo(250, 0); x.stroke(); x.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 8); t.anisotropy = 4;
  _floorTex = t; return t;
}

// soft radial-gradient blob for the floating glyph-orbs (additive)
function orbTexture() {
  if (_orbTex) return _orbTex;
  const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,225,255,1)"); g.addColorStop(0.35, "rgba(255,120,225,0.7)"); g.addColorStop(1, "rgba(130,30,190,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  _orbTex = t; return t;
}

// shorthand for an additive, outline-skipped glow material bound to a texture
const glowMat = (tex, opacity = 1) => noOutline(new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));

export function buildCollectiveArena(b) {
  const scene = b.scene;
  const M = allMandalas();                          // [lotus, flower, star, om] textures
  const decalMats = M.map((t) => glowMat(t, 0.9));  // ONE additive material per mandala (reused everywhere)
  const PLANE = new THREE.PlaneGeometry(1, 1);       // ONE unit plane, scaled per decal (perf)
  const rTex = () => decalMats[(Math.random() * 4) | 0];

  // place a glowing mandala decal (unit plane, scaled) facing a given direction — reused on every surface
  const decal = (x, y, z, size, rotX, rotY, m) => {
    const d = new THREE.Mesh(PLANE, m || rTex());
    d.position.set(x, y, z); d.scale.set(size, size, 1); d.rotation.set(rotX, rotY, 0); scene.add(d);
    return d;
  };

  // ── 1. FLOOR — big BRIGHT-violet mandala plane + a large glowing inlay toward the dais ──
  const floorMat = mat(C_FLOOR, { roughness: 1, emissive: 0x2a1550, emissiveIntensity: 0.35 });
  floorMat.map = floorTexture(); floorMat.needsUpdate = true;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  decal(0, 0.06, 55, 46, -Math.PI / 2, 0, decalMats[0]); // big lotus inlaid between centre and dais

  // ── 2. CEILING — solid purple slab so the SKY IS NEVER VISIBLE (fully-enclosed cube) ──
  const ceil = box(HALF * 2, T, HALF * 2, C_CEIL, { roughness: 1, emissive: 0x2c1355, emissiveIntensity: 0.4 });
  ceil.position.set(0, WALL_H + T / 2, 0); scene.add(ceil);

  // ── 3. FOUR PERIMETER WALLS (tall, thick) — wall+collider+occluder via the builder ──
  b.wall(0, HALF, HALF * 2 + T, T, WALL_H, C_WALL);   // far  (+Z, behind the dais)
  b.wall(0, -HALF, HALF * 2 + T, T, WALL_H, C_WALL);  // near (−Z, the entrance)
  b.wall(HALF, 0, T, HALF * 2 + T, WALL_H, C_WALL);   // east (+X)
  b.wall(-HALF, 0, T, HALF * 2 + T, WALL_H, C_WALL);  // west (−X)

  // ── 4. DENSE MANDALAS "OF ALL KINDS" scattered over walls + ceiling + floor at VARIED sizes ──
  const inW = HALF - T - 0.6;
  // four inner wall faces: [fixedAxisValue, isX(true→x fixed), rotY, faces-into-room]
  const walls = [
    { z: inW, rotY: Math.PI, axis: "z" },   // far
    { z: -inW, rotY: 0, axis: "z" },        // near
    { x: inW, rotY: -Math.PI / 2, axis: "x" }, // east
    { x: -inW, rotY: Math.PI / 2, axis: "x" }, // west
  ];
  for (const w of walls) {
    // a scatter of SMALL-to-medium glowing runes covering the whole face
    for (let i = 0; i < 22; i++) {
      const u = (Math.random() - 0.5) * (HALF * 2 - 20);   // horizontal along the wall
      const y = 4 + Math.random() * (WALL_H - 8);
      const size = i < 16 ? 4 + Math.random() * 6 : 11 + Math.random() * 8; // mostly small, a few medium
      if (w.axis === "z") decal(u, y, w.z, size, 0, w.rotY);
      else decal(w.x, y, u, size, 0, w.rotY);
    }
  }
  // ceiling runes (face DOWN)
  for (let i = 0; i < 26; i++) {
    const size = i < 20 ? 4 + Math.random() * 6 : 12 + Math.random() * 8;
    decal((Math.random() - 0.5) * (HALF * 2 - 30), WALL_H - 0.6, (Math.random() - 0.5) * (HALF * 2 - 30), size, Math.PI / 2, 0);
  }
  // floor runes (face UP), avoiding the dais footprint at the far end
  for (let i = 0; i < 16; i++) {
    const px = (Math.random() - 0.5) * (HALF * 2 - 40), pz = (Math.random() - 0.5) * (HALF * 2 - 40);
    if (pz > 88) continue; // keep the dais clear
    decal(px, 0.05, pz, 4 + Math.random() * 6, -Math.PI / 2, 0);
  }

  // ── 5. FLOATING GLYPH-ORBS scattered high on all four walls (additive; reuse one geo + mat) ──
  b._collectiveOrbs = [];
  const orbGeo = new THREE.PlaneGeometry(4.5, 4.5);
  const orbMat = glowMat(orbTexture(), 0.9);
  const orbAt = (px, py, pz) => {
    const o = new THREE.Mesh(orbGeo, orbMat); o.position.set(px, py, pz);
    o.lookAt(0, py, 0); o.userData.baseY = py; scene.add(o); b._collectiveOrbs.push(o);
  };
  const oIn = HALF - T - 1;
  for (let i = 0; i < 6; i++) { const u = (i - 2.5) * 42; orbAt(u, 14 + Math.random() * 30, oIn); orbAt(u, 14 + Math.random() * 30, -oIn); }
  for (let i = 0; i < 6; i++) { const u = (i - 2.5) * 42; orbAt(oIn, 14 + Math.random() * 30, u); orbAt(-oIn, 14 + Math.random() * 30, u); }

  // ── 6. FLOATING PURPLE CRYSTALS / ASTEROIDS — dark-violet body, emissive magenta, additive glow shell ──
  b._collectiveRocks = [];
  const crystGeo = [new THREE.IcosahedronGeometry(1, 0), new THREE.OctahedronGeometry(1, 0)];
  const crystMat = mat(0x3a1c5e, { roughness: 0.5, flat: true, emissive: 0xb840d8, emissiveIntensity: 0.55 });
  const shellMat = noOutline(new THREE.MeshBasicMaterial({ color: 0xc060ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  for (let i = 0; i < 18; i++) {
    const g = crystGeo[i % 2], s = 1.6 + Math.random() * 3.2;
    const px = (Math.random() - 0.5) * (HALF * 2 - 30), pz = (Math.random() - 0.5) * (HALF * 2 - 30), py = 8 + Math.random() * (WALL_H - 18);
    const rock = new THREE.Mesh(g, crystMat);
    rock.position.set(px, py, pz); rock.scale.setScalar(s); rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    const shell = new THREE.Mesh(g, shellMat); shell.scale.setScalar(1.35); rock.add(shell); // shared additive halo
    rock.userData.baseY = py; scene.add(rock); b._collectiveRocks.push(rock);
  }

  // ── 7. WEIRD COSMIC HANDS reaching out of the room — glowing magenta palm + fingers + tapering forearm ──
  b._collectiveHands = [];
  const handSkin = mat(0x7a2f9e, { roughness: 0.45, emissive: 0xd040d8, emissiveIntensity: 0.85 });
  const makeHand = () => {
    const g = new THREE.Group();
    const arm = cyl(0.5, 1.2, 8, 0, 10, { mat: handSkin }); arm.rotation.x = Math.PI / 2; arm.position.z = -4; g.add(arm); // forearm tube (tapers to elbow)
    const palm = box(2.4, 0.8, 2.4, 0, { mat: handSkin }); palm.position.z = 0.6; g.add(palm);
    for (let i = 0; i < 4; i++) { const f = box(0.42, 0.55, 2.1, 0, { mat: handSkin }); f.position.set(-0.8 + i * 0.53, 0, 2.4); g.add(f); } // 4 fingers
    const th = box(0.55, 0.55, 1.5, 0, { mat: handSkin }); th.position.set(1.35, 0, 1.2); th.rotation.y = 0.65; g.add(th);   // thumb
    return g;
  };
  const handSpots = [
    [-inW + 1, 30, -60, Math.PI / 2], [inW - 1, 40, 30, -Math.PI / 2], [-40, WALL_H - 3, inW - 1, Math.PI],
    [60, 22, -inW + 1, 0], [inW - 1, 18, -70, -Math.PI / 2], [-70, 46, -inW + 1, 0.3],
  ];
  for (const [hx, hy, hz, ry] of handSpots) {
    const h = makeHand(); h.position.set(hx, hy, hz); h.rotation.set((Math.random() - 0.5) * 0.6, ry, (Math.random() - 0.5) * 0.6);
    h.userData.baseY = hy; scene.add(h); b._collectiveHands.push(h);
  }

  // ── 8. THE DAIS / THRONE — stepped climbable pyramid at the far end (z≈+115), scaled to the big room ──
  const DZ = 115, stepH = 0.7;
  const steps = [[46, 0.7], [38, 1.4], [30, 2.1], [22, 2.8], [15, 3.5]]; // [square size, walkable top]
  for (const [size, top] of steps) {
    const s = box(size, stepH, size, C_STEP, { roughness: 0.85 });
    s.position.set(0, top - stepH / 2, DZ); scene.add(s);
    b.collide(0, DZ, size, size, top); // nested AABBs → the player climbs step-by-step
  }
  const platform = box(11, stepH, 11, 0x5c3a86, { roughness: 0.8, emissive: 0x3a1568, emissiveIntensity: 0.7 });
  platform.position.set(0, THRONE_TOP - stepH / 2, DZ); scene.add(platform);
  b.collide(0, DZ, 11, 11, THRONE_TOP);
  const seal = new THREE.Mesh(new THREE.RingGeometry(3, 4.5, 40), glowMat(M[3], 0.85));
  seal.rotation.x = -Math.PI / 2; seal.position.set(0, THRONE_TOP + 0.04, DZ); scene.add(seal); // glowing meditation seal

  // ── 8b. GIANT MANDALA HALO rising up the far wall behind the throne (the boss's meditation halo) ──
  const haloY = 26, haloZ = HALF - T - 1.5;
  const backdrop = decal(0, haloY, haloZ, 52, 0, Math.PI, glowMat(M[0], 0.9)); // huge lotus disc, faces −Z
  backdrop.renderOrder = -1;
  const ringMat = noOutline(new THREE.MeshBasicMaterial({ color: 0xff5ad0, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  for (const r of [12, 18, 24]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.6, 10, 56), ringMat); ring.position.set(0, haloY, haloZ - 0.3); scene.add(ring); }
  const coreDisc = new THREE.Mesh(new THREE.CircleGeometry(8, 44), noOutline(new THREE.MeshBasicMaterial({ color: 0xffb4f0, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
  coreDisc.position.set(0, haloY, haloZ - 0.1); coreDisc.rotation.y = Math.PI; scene.add(coreDisc);

  // ── 9. BRIGHT PURPLE ATMOSPHERE — FAR light-purple fog + exactly THREE scene-wide lights (added once) ──
  scene.fog = new THREE.Fog(0x3a1a6e, 120, 520);                       // light haze, far → never darkens the room
  scene.add(new THREE.HemisphereLight(0xd070ff, 0x3a1a5c, 1.4));       // luminous violet fill
  scene.add(new THREE.AmbientLight(0x6a3aa0, 0.5));                    // lifts every shadow
  const key = new THREE.DirectionalLight(0xe0a0ff, 0.4); key.position.set(40, 80, -60); scene.add(key);

  // ── 10. PLAYER SPAWN (near wall, facing the dais across the vast room) + walkable bounds ──
  b.spawnAt(0, -115);
  b.setBounds({ minX: -135, maxX: 135, minZ: -135, maxZ: 135 });

  // ── 11. WEAPON / AMMO / HEALTH PICKUPS scattered across the much bigger floor ──
  const CRATES = [
    ["rifle", -30, -80], ["rifle", 30, -80], ["burst", -60, -40], ["burst", 60, -40],
    ["plasma", -85, 10], ["plasma", 85, 10], ["minigun", 0, -60], ["launcher", 0, 55],
    ["ammo", -20, 0], ["ammo", 20, 0], ["ammo", 0, -105], ["health", -55, 70], ["health", 55, 70], ["health", 0, 82],
  ];
  for (const [kind, x, z] of CRATES) b.giftCrate(x, z, kind);

  // ── 12. hand the level the throne top, boss spawn, and suggested drone spawns across the big arena ──
  return {
    throne: { x: 0, z: DZ, top: THRONE_TOP },
    bossSpawn: { x: 0, z: DZ },
    droneSpawns: [
      { x: -80, z: -60 }, { x: 80, z: -60 }, { x: -95, z: 20 }, { x: 95, z: 20 },
      { x: 0, z: -75 }, { x: -60, z: 60 }, { x: 60, z: 60 }, { x: 0, z: 40 },
      { x: -105, z: -10 }, { x: 105, z: -10 },
    ],
  };
}
