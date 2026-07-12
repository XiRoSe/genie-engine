import * as THREE from "three";
import { box, cyl, mat, noOutline } from "../../engine/primitives.js";

// THE COLLECTIVE — a GIANT, perfectly-square, fully-enclosed glowing PURPLE CUBE (Rick & Morty S9E1). Six
// self-lit ornate surfaces (floor + 4 walls + ceiling — no sky is ever visible), crisp NEON edge-trim on all
// twelve cube edges (so it reads unmistakably as a giant box), corner pylons, dense sacred-geometry everywhere,
// floating glyph-orbs / crystals / cosmic hands, and — at the far wall — a colossal layered mandala HALO over a
// grand stepped dais where the cube-headed boss meditates. Everything glows via EMISSIVE maps + additive geo
// (no per-prop lights), so the cel-shader never recompiles.

const HALF = 120;        // half-extent → 240×240 footprint
const WALL_H = 180;      // wall height / ceiling — height ≈ width ⇒ a GIANT CUBE, not a flat room
const T = 4;             // wall / ceiling thickness
const THRONE_TOP = 5.6;  // walkable Y on top of the dais
const EDGE = 0xff58e0;   // neon edge / trim colour (hot magenta)

// ── shared mandala painter: draws a glowing sacred-geometry figure of a chosen style at (cx,cy) radius R ──
function drawMandala(x, cx, cy, R, style, a = 1) {
  x.save(); x.translate(cx, cy);
  const P = (o) => `rgba(255,${140 + o * 60 | 0},240,${a})`;
  x.lineWidth = R * 0.02;
  if (style === 0) {                                   // LOTUS — rings + spokes + petals
    x.strokeStyle = `rgba(255,120,225,${0.8 * a})`;
    for (let r = R * 0.2; r < R; r += R * 0.17) { x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); }
    x.strokeStyle = `rgba(255,160,240,${0.55 * a})`;
    for (let i = 0; i < 24; i++) { x.save(); x.rotate(i / 24 * 6.283); x.beginPath(); x.moveTo(R * 0.14, 0); x.lineTo(R, 0); x.stroke(); x.restore(); }
    x.strokeStyle = `rgba(255,95,195,${0.9 * a})`; x.lineWidth = R * 0.03;
    for (let i = 0; i < 16; i++) { x.save(); x.rotate(i / 16 * 6.283); x.beginPath(); x.arc(R * 0.5, 0, R * 0.26, Math.PI * 0.6, Math.PI * 1.4); x.stroke(); x.restore(); }
  } else if (style === 1) {                            // FLOWER OF LIFE — hex-packed circles
    const rr = R * 0.28, S = Math.sqrt(3), C = [[0, 0]];
    for (let i = 0; i < 6; i++) { const g = i * Math.PI / 3; C.push([Math.cos(g) * rr, Math.sin(g) * rr]); C.push([Math.cos(g) * rr * 2, Math.sin(g) * rr * 2]); C.push([Math.cos(g + Math.PI / 6) * rr * S, Math.sin(g + Math.PI / 6) * rr * S]); }
    x.strokeStyle = `rgba(255,130,230,${0.8 * a})`;
    for (const [ox, oy] of C) { x.beginPath(); x.arc(ox, oy, rr, 0, 7); x.stroke(); }
    x.strokeStyle = P(1); x.lineWidth = R * 0.03; x.beginPath(); x.arc(0, 0, R, 0, 7); x.stroke();
  } else if (style === 2) {                            // HEXAGRAM — interlocking triangles + rings
    const tri = (rot) => { x.beginPath(); for (let i = 0; i < 3; i++) { const g = rot + i * 2.094 - 1.57, px = Math.cos(g) * R, py = Math.sin(g) * R; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); x.stroke(); };
    x.strokeStyle = `rgba(255,110,210,${0.85 * a})`; x.lineWidth = R * 0.03; tri(0); tri(Math.PI / 3);
    x.strokeStyle = `rgba(255,165,240,${0.6 * a})`; x.lineWidth = R * 0.02;
    for (const r of [R * 0.34, R * 0.58]) { x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); }
  } else {                                             // OM SPIRAL — dashed rings + spiral
    x.setLineDash([R * 0.03, R * 0.05]); x.strokeStyle = `rgba(255,150,235,${0.6 * a})`;
    for (let r = R * 0.2; r < R; r += R * 0.13) { x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); }
    x.setLineDash([]); x.strokeStyle = `rgba(255,120,225,${0.9 * a})`; x.lineWidth = R * 0.028; x.beginPath();
    for (let g = 0; g < 12.5; g += 0.14) { const r = g / 12.5 * R; x.lineTo(Math.cos(g) * r, Math.sin(g) * r); } x.stroke();
  }
  // bright core
  const cg = x.createRadialGradient(0, 0, 0, 0, 0, R * 0.16); cg.addColorStop(0, `rgba(255,225,255,${0.9 * a})`); cg.addColorStop(1, "rgba(255,120,220,0)");
  x.fillStyle = cg; x.beginPath(); x.arc(0, 0, R * 0.16, 0, 7); x.fill();
  x.restore();
}

// ── cached textures ──────────────────────────────────────────────────────────
let _wallTex = null, _floorTex = null, _ceilTex = null, _orbTex = null;
const _decalTex = [];

// ORNATE SELF-LIT WALL: deep-violet gradient base + a 3×3 glowing panel grid, each panel holding a mandala, with
// bright glyph-dot borders. Used as BOTH map + emissiveMap so the whole wall GLOWS with pattern (never dark/plain).
function wallTexture() {
  if (_wallTex) return _wallTex;
  const S = 1024, c = document.createElement("canvas"); c.width = c.height = S; const x = c.getContext("2d");
  const bg = x.createLinearGradient(0, 0, 0, S); bg.addColorStop(0, "#4a2d86"); bg.addColorStop(0.5, "#331a63"); bg.addColorStop(1, "#4a2d86");
  x.fillStyle = bg; x.fillRect(0, 0, S, S);
  const N = 3, cell = S / N;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) drawMandala(x, i * cell + cell / 2, j * cell + cell / 2, cell * 0.44, (i * 3 + j) % 4, 0.9);
  // glowing panel grid
  x.strokeStyle = "rgba(220,110,240,0.75)"; x.lineWidth = 6;
  for (let i = 0; i <= N; i++) { const p = i * cell; x.beginPath(); x.moveTo(p, 0); x.lineTo(p, S); x.moveTo(0, p); x.lineTo(S, p); x.stroke(); }
  // rivet glyph-dots at grid intersections
  x.fillStyle = "rgba(255,205,250,0.95)";
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) { x.beginPath(); x.arc(i * cell, j * cell, 7, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  _wallTex = t; return t;
}

// glowing floor: a big radial mandala emanating from the dais end over a violet base
function floorTexture() {
  if (_floorTex) return _floorTex;
  const S = 1024, c = document.createElement("canvas"); c.width = c.height = S; const x = c.getContext("2d");
  x.fillStyle = "#2e1a55"; x.fillRect(0, 0, S, S);
  x.strokeStyle = "rgba(190,90,225,0.5)"; x.lineWidth = 3;
  for (let g = S / 12; g < S; g += S / 12) { x.beginPath(); x.moveTo(g, 0); x.lineTo(g, S); x.moveTo(0, g); x.lineTo(S, g); x.stroke(); } // faint tech grid
  drawMandala(x, S / 2, S / 2, S * 0.46, 0, 0.8);
  drawMandala(x, S / 2, S / 2, S * 0.22, 2, 0.9);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; _floorTex = t; return t;
}

function ceilTexture() {
  if (_ceilTex) return _ceilTex;
  const S = 1024, c = document.createElement("canvas"); c.width = c.height = S; const x = c.getContext("2d");
  x.fillStyle = "#3a2168"; x.fillRect(0, 0, S, S);
  drawMandala(x, S / 2, S / 2, S * 0.46, 3, 0.85);
  drawMandala(x, S / 2, S / 2, S * 0.24, 1, 0.9);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; _ceilTex = t; return t;
}

// standalone glowing mandala decal on a transparent canvas (additive; for the halo + feature accents)
function decalTexture(style) {
  if (_decalTex[style]) return _decalTex[style];
  const S = 512, c = document.createElement("canvas"); c.width = c.height = S; const x = c.getContext("2d");
  const aura = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); aura.addColorStop(0, "rgba(150,50,210,0.45)"); aura.addColorStop(0.7, "rgba(90,25,150,0.12)"); aura.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = aura; x.fillRect(0, 0, S, S);
  drawMandala(x, S / 2, S / 2, S * 0.46, style, 1);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; _decalTex[style] = t; return t;
}

function orbTexture() {
  if (_orbTex) return _orbTex;
  const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,230,255,1)"); g.addColorStop(0.35, "rgba(255,120,230,0.7)"); g.addColorStop(1, "rgba(130,30,200,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; _orbTex = t; return t;
}

const addGlow = (color, opacity, tex) => noOutline(new THREE.MeshBasicMaterial({ color, map: tex || null, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));

export function buildCollectiveArena(b) {
  const scene = b.scene;

  // ── 1. SIX SELF-LIT SURFACES of the cube (ornate emissive maps → they GLOW, never plain/dark) ──
  const wallT = wallTexture();
  const wallMat = () => { const t = wallT.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; return new THREE.MeshStandardMaterial({ color: 0x6a44a8, map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.9, roughness: 0.85, metalness: 0.1 }); };
  // custom emissive walls (own mesh so we control the glow) + collider + bullet occluder
  const buildWall = (cx, cz, w, d, repX) => {
    const m = wallMat(); m.map.repeat.set(repX, 3); m.emissiveMap.repeat.set(repX, 3);
    const wall = box(w, WALL_H, d, 0, { mat: m }); wall.position.set(cx, WALL_H / 2, cz); scene.add(wall);
    b.collide(cx, cz, w, d, WALL_H); b.solidMeshes.push(wall);
  };
  buildWall(0, HALF, HALF * 2 + T, T, 8);   // far  (+Z, behind the dais)
  buildWall(0, -HALF, HALF * 2 + T, T, 8);  // near (−Z, entrance)
  buildWall(HALF, 0, T, HALF * 2 + T, 8);   // east (+X)
  buildWall(-HALF, 0, T, HALF * 2 + T, 8);  // west (−X)

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x5a3aa0, map: floorTexture(), emissive: 0xffffff, emissiveMap: floorTexture(), emissiveIntensity: 0.6, roughness: 0.9 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2), floorMat); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x4a2d84, map: ceilTexture(), emissive: 0xffffff, emissiveMap: ceilTexture(), emissiveIntensity: 0.7, roughness: 0.9, side: THREE.DoubleSide });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2), ceilMat); ceil.rotation.x = Math.PI / 2; ceil.position.y = WALL_H; scene.add(ceil);

  // ── 2. NEON EDGE-TRIM on all 12 cube edges + 4 corner pylons → reads unmistakably as a GIANT CUBE ──
  const edgeMat = addGlow(EDGE, 0.95);
  const edgeCoreMat = noOutline(new THREE.MeshBasicMaterial({ color: 0xffd0f6, fog: false }));
  const beam = (x1, y1, z1, x2, y2, z2) => {
    const a = new THREE.Vector3(x1, y1, z1), bb = new THREE.Vector3(x2, y2, z2), len = a.distanceTo(bb);
    const g = new THREE.Group(); const outer = cyl(1.1, 1.1, len, 0, 8, { mat: edgeMat }); const core = cyl(0.4, 0.4, len, 0, 6, { mat: edgeCoreMat });
    g.add(outer, core); g.position.copy(a.clone().add(bb).multiplyScalar(0.5)); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bb.clone().sub(a).normalize()); scene.add(g);
  };
  const H = HALF;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { beam(sx * H, 0, sz * H, sx * H, WALL_H, sz * H); }         // 4 vertical edges
  for (const y of [0.4, WALL_H - 0.4]) { beam(-H, y, -H, H, y, -H); beam(-H, y, H, H, y, H); beam(-H, y, -H, -H, y, H); beam(H, y, -H, H, y, H); } // 8 horizontal edges
  // corner pylons (glowing octahedral capitals)
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const cap = new THREE.Mesh(new THREE.OctahedronGeometry(5, 0), addGlow(0xff7ae6, 0.5)); cap.position.set(sx * (H - 3), WALL_H - 8, sz * (H - 3)); scene.add(cap);
    const capS = new THREE.Mesh(new THREE.OctahedronGeometry(2.4, 0), edgeCoreMat); capS.position.copy(cap.position); scene.add(capS);
  }

  // ── 3. FEATURE MANDALAS — one BIG glowing figure centered on each wall + a scatter of smaller accents ──
  const PLANE = new THREE.PlaneGeometry(1, 1);
  const decal = (x, y, z, size, rotX, rotY, style) => { const d = new THREE.Mesh(PLANE, addGlow(0xffffff, 0.9, decalTexture(style))); d.position.set(x, y, z); d.scale.set(size, size, 1); d.rotation.set(rotX, rotY, 0); scene.add(d); return d; };
  const inW = HALF - T - 0.5;
  // big centred feature per wall (skip the far wall — the giant halo lives there)
  decal(0, WALL_H * 0.5, -inW, 70, 0, 0, 2);          // near
  decal(inW, WALL_H * 0.5, 0, 70, 0, -Math.PI / 2, 1); // east
  decal(-inW, WALL_H * 0.5, 0, 70, 0, Math.PI / 2, 3); // west
  // smaller accents peppering the upper walls
  const walls = [{ z: inW, ry: Math.PI, ax: "z" }, { z: -inW, ry: 0, ax: "z" }, { x: inW, ry: -Math.PI / 2, ax: "x" }, { x: -inW, ry: Math.PI / 2, ax: "x" }];
  for (const w of walls) for (let i = 0; i < 12; i++) {
    const u = (Math.random() - 0.5) * (HALF * 2 - 24), y = 8 + Math.random() * (WALL_H - 20), s = 8 + Math.random() * 14, st = (Math.random() * 4) | 0;
    if (w.ax === "z") decal(u, y, w.z, s, 0, w.ry, st); else decal(w.x, y, u, s, 0, w.ry, st);
  }

  // ── 4. FLOATING GLYPH-ORBS high on the walls (additive, reused geo+mat) ──
  b._collectiveOrbs = [];
  const orbGeo = new THREE.PlaneGeometry(5, 5), orbMat = addGlow(0xffffff, 0.9, orbTexture());
  const orbAt = (px, py, pz) => { const o = new THREE.Mesh(orbGeo, orbMat); o.position.set(px, py, pz); o.lookAt(0, py, 0); o.userData.baseY = py; scene.add(o); b._collectiveOrbs.push(o); };
  const oIn = HALF - T - 1;
  for (let i = 0; i < 7; i++) { const u = (i - 3) * 34; orbAt(u, 12 + Math.random() * 60, oIn); orbAt(u, 12 + Math.random() * 60, -oIn); orbAt(oIn, 12 + Math.random() * 60, u); orbAt(-oIn, 12 + Math.random() * 60, u); }

  // ── 5. FLOATING CRYSTALS — dark-violet body + emissive edges + additive halo (fewer, bigger, deliberate) ──
  b._collectiveRocks = [];
  const cg = [new THREE.IcosahedronGeometry(1, 0), new THREE.OctahedronGeometry(1, 0), new THREE.DodecahedronGeometry(1, 0)];
  const cMat = mat(0x3a1c5e, { roughness: 0.4, flat: true, emissive: 0xc050e8, emissiveIntensity: 0.7 });
  const cShell = addGlow(0xc060ff, 0.14);
  for (let i = 0; i < 14; i++) {
    const g = cg[i % 3], s = 2.5 + Math.random() * 4.5, px = (Math.random() - 0.5) * (HALF * 2 - 40), pz = (Math.random() - 0.5) * (HALF * 2 - 50), py = 14 + Math.random() * (WALL_H - 40);
    const rock = new THREE.Mesh(g, cMat); rock.position.set(px, py, pz); rock.scale.setScalar(s); rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    const sh = new THREE.Mesh(g, cShell); sh.scale.setScalar(1.4); rock.add(sh); rock.userData.baseY = py; scene.add(rock); b._collectiveRocks.push(rock);
  }

  // ── 6. WEIRD COSMIC HANDS reaching out of the walls (glowing magenta) ──
  b._collectiveHands = [];
  const skin = mat(0x8a3ab0, { roughness: 0.4, emissive: 0xe050e8, emissiveIntensity: 1.0 });
  const makeHand = () => {
    const g = new THREE.Group();
    const arm = cyl(0.7, 1.8, 12, 0, 10, { mat: skin }); arm.rotation.x = Math.PI / 2; arm.position.z = -6; g.add(arm);
    const palm = box(3.2, 1.1, 3.2, 0, { mat: skin }); palm.position.z = 0.8; g.add(palm);
    for (let i = 0; i < 4; i++) { const f = box(0.55, 0.75, 3, 0, { mat: skin }); f.position.set(-1.1 + i * 0.72, 0, 3.2); g.add(f); }
    const th = box(0.75, 0.75, 2, 0, { mat: skin }); th.position.set(1.9, 0, 1.6); th.rotation.y = 0.65; g.add(th);
    g.scale.setScalar(1.6); return g;
  };
  for (const [hx, hy, hz, ry] of [[-inW + 1, 55, -60, Math.PI / 2], [inW - 1, 80, 30, -Math.PI / 2], [-50, WALL_H - 6, inW - 1, Math.PI], [70, 40, -inW + 1, 0], [inW - 1, 30, -80, -Math.PI / 2], [-90, 90, -inW + 1, 0.3]]) {
    const h = makeHand(); h.position.set(hx, hy, hz); h.rotation.set((Math.random() - 0.5) * 0.5, ry, (Math.random() - 0.5) * 0.5); h.userData.baseY = hy; scene.add(h); b._collectiveHands.push(h);
  }

  // ── 7. GRAND DAIS + COLOSSAL LAYERED HALO on the far wall (the boss's meditation throne) ──
  const DZ = 112, stepH = 0.7;
  for (const [size, top] of [[54, 0.7], [46, 1.4], [38, 2.1], [30, 2.8], [23, 3.5], [17, 4.2], [12, 4.9]]) {
    const s = box(size, stepH, size, 0x5a3a90, { roughness: 0.8, emissive: 0x3a1a70, emissiveIntensity: 0.5 }); s.position.set(0, top - stepH / 2, DZ); scene.add(s); b.collide(0, DZ, size, size, top);
  }
  const platform = box(9, stepH, 9, 0x6a44a8, { roughness: 0.7, emissive: 0x4a1f88, emissiveIntensity: 0.9 }); platform.position.set(0, THRONE_TOP - stepH / 2, DZ); scene.add(platform); b.collide(0, DZ, 9, 9, THRONE_TOP);
  const seal = new THREE.Mesh(new THREE.RingGeometry(3.5, 5, 40), addGlow(0xffffff, 0.85, decalTexture(3))); seal.rotation.x = -Math.PI / 2; seal.position.set(0, THRONE_TOP + 0.05, DZ); scene.add(seal);
  // colossal halo behind the boss: a huge mandala disc + concentric rings + a bright core (the meditation aura),
  // centred at the floating core's chest height so it frames the boss like the show
  const haloY = 34, haloZ = HALF - T - 1.5;
  decal(0, haloY, haloZ, 108, 0, Math.PI, 0).renderOrder = -2;
  decal(0, haloY, haloZ - 0.4, 70, 0, Math.PI, 2).renderOrder = -1;
  const ringMat = addGlow(0xff5ad0, 0.6);
  b._collectiveRings = [];
  for (const r of [22, 32, 44, 56]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 1.0, 10, 64), ringMat); ring.position.set(0, haloY, haloZ - 0.6); scene.add(ring); b._collectiveRings.push(ring); }
  const coreDisc = new THREE.Mesh(new THREE.CircleGeometry(16, 48), addGlow(0xffc0f4, 0.5)); coreDisc.position.set(0, haloY, haloZ - 0.2); coreDisc.rotation.y = Math.PI; scene.add(coreDisc);

  // ── 7b. GAMEPLAY STRUCTURES — the Collective's hive, all with CORRECT collision so the player can use them.
  //    ONLY these + the walls + dais are solid; every floaty decoration above is collision-free. This is the fix
  //    for "not all is hittable when you stand on them": clean, consistent, purposeful cover + platforms. ──

  // ASSIMILATION PODS: glowing containment capsules (a captive being suspended inside) — solid full-height cover
  const podMat = mat(0x3a1f66, { roughness: 0.4, metalness: 0.3, emissive: 0x6a2ab0, emissiveIntensity: 0.5 });
  const podGlass = noOutline(new THREE.MeshBasicMaterial({ color: 0xc060ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  const captiveMat = mat(0x160a28, { emissive: 0x9a45e0, emissiveIntensity: 0.7, roughness: 0.5 });
  const podFig = new THREE.CapsuleGeometry(0.5, 2.0, 4, 8);
  const makePod = (x, z) => {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const base = cyl(1.9, 2.1, 1.0, 0, 12, { mat: podMat }); base.position.y = 0.5; g.add(base);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 5.2, 16, 1, true), podGlass); tube.position.y = 3.7; g.add(tube);
    const cap = cyl(1.75, 1.75, 0.7, 0, 12, { mat: podMat }); cap.position.y = 6.6; g.add(cap);
    const fig = new THREE.Mesh(podFig, captiveMat); fig.position.y = 3.6; fig.rotation.x = 0.1; g.add(fig); // suspended captive
    scene.add(g);
    b.collide(x, z, 3.6, 3.6, 6.8); b.solidMeshes.push(g); // solid cover — can't walk or shoot through
  };
  for (const [x, z] of [[-28, 18], [28, 18], [-28, 52], [28, 52], [-46, -22], [46, -22]]) makePod(x, z);

  // RAISED PLATFORMS: solid slabs (glowing rim) you JETPACK onto for vantage — correct standable top
  const platMat = mat(0x4a2d84, { roughness: 0.7, emissive: 0x3a1a70, emissiveIntensity: 0.45 });
  const makePlatform = (x, z, size, top) => {
    const slab = box(size, 1.4, size, 0, { mat: platMat }); slab.position.set(x, top - 0.7, z); scene.add(slab);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(size * 0.62, 0.16, 8, 4), addGlow(EDGE, 0.8)); rim.rotation.x = Math.PI / 2; rim.rotation.z = Math.PI / 4; rim.position.set(x, top, z); scene.add(rim);
    b.collide(x, z, size, size, top); b.solidMeshes.push(slab); // stand on top
  };
  makePlatform(-74, -6, 18, 9); makePlatform(74, -6, 18, 9); makePlatform(0, -56, 15, 5.5);

  // LOW COVER BLOCKS: chest-high solid cover down the central approach (duck behind / mount)
  const coverMat = mat(0x40265f, { roughness: 0.6, emissive: 0x2a1050, emissiveIntensity: 0.4 });
  for (const [x, z] of [[-15, 2], [15, 2], [-22, 34], [22, 34], [0, -28]]) {
    const blk = box(3.6, 2.3, 3.6, 0, { mat: coverMat }); blk.position.set(x, 1.15, z); scene.add(blk);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.16, 3.7), addGlow(0xff5ad0, 0.7)); trim.position.set(x, 2.3, z); scene.add(trim);
    b.collide(x, z, 3.6, 3.6, 2.3); b.solidMeshes.push(blk);
  }

  // ENERGY CONDUITS: glowing veins in the FLOOR radiating from the throne (decorative, flush → NO collision)
  const conduitMat = addGlow(0xff6ae0, 0.55);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, len = 70 + (i % 2) * 20;
    const vein = new THREE.Mesh(new THREE.PlaneGeometry(1.4, len), conduitMat);
    vein.rotation.x = -Math.PI / 2; vein.rotation.z = a; vein.position.set(Math.sin(a) * len * 0.5, 0.06, DZ - 20 + Math.cos(a) * len * 0.5); scene.add(vein);
  }

  // ── 8. ATMOSPHERE — bright violet haze + 3 scene-wide lights (emissive surfaces do the rest) ──
  scene.fog = new THREE.Fog(0x3a1a72, 150, 620);
  scene.add(new THREE.HemisphereLight(0xd878ff, 0x3a1a5c, 1.5));
  scene.add(new THREE.AmbientLight(0x7a48b8, 0.6));
  const key = new THREE.DirectionalLight(0xe8b0ff, 0.45); key.position.set(40, 120, -60); scene.add(key);

  // ── 9. SPAWN + bounds + pickups ──
  b.spawnAt(0, -112);
  b.setBounds({ minX: -113, maxX: 113, minZ: -113, maxZ: 113 });
  const CRATES = [["rifle", -34, -85], ["rifle", 34, -85], ["burst", -62, -40], ["burst", 62, -40], ["plasma", -90, 12], ["plasma", 90, 12], ["minigun", 0, -92], ["launcher", 0, 70], ["ammo", -40, 0], ["ammo", 40, 0], ["ammo", 0, -100], ["health", -60, 74], ["health", 60, 74], ["health", 0, 88]];
  for (const [kind, x, z] of CRATES) b.giftCrate(x, z, kind);

  return {
    throne: { x: 0, z: DZ, top: THRONE_TOP }, bossSpawn: { x: 0, z: DZ },
    droneSpawns: [{ x: -80, z: -60 }, { x: 80, z: -60 }, { x: -95, z: 20 }, { x: 95, z: 20 }, { x: 0, z: -75 }, { x: -60, z: 60 }, { x: 60, z: 60 }, { x: 0, z: 40 }, { x: -100, z: -10 }, { x: 100, z: -10 }],
  };
}
