import * as THREE from "three";
import { box, cyl, mat, noOutline } from "../../engine/primitives.js";

// THE COLLECTIVE — a WEIRD, SYMMETRIC alien CUBE (Rick & Morty S9E1). A perfect enclosed box where ALL SIX faces
// are equal — floor, ceiling and the four walls share one smooth self-lit violet skin with an identical colossal
// mandala on each, so it reads as a disorienting cosmic prism (up = down = sideways). Crystalline THORNS grow
// inward from every face, weird polyhedra drift through the volume, and the cube-headed core meditates on a dais
// in front of the far face's mandala (which doubles as its halo). Everything glows via emissive/additive geometry
// (no per-prop lights) so the cel-shader never recompiles; bloom (engine post-fx) makes it all radiate.

const HALF = 112;        // half-extent → 224 footprint
const WALL_H = 224;      // height == width  ⇒  a true GIANT CUBE (all sides equal)
const T = 4;             // face thickness
const THRONE_TOP = 5.6;
const EDGE = 0xff5ae0;   // neon edge / trim
const DZ = 92;           // throne distance from centre (in front of the far face)

// ── shared mandala painter (soft, smooth strokes) ──
function drawMandala(x, cx, cy, R, style, a = 1) {
  x.save(); x.translate(cx, cy); x.lineCap = "round"; x.lineWidth = R * 0.016;
  if (style === 0) {
    x.strokeStyle = `rgba(255,130,230,${0.8 * a})`;
    for (let r = R * 0.18; r < R; r += R * 0.15) { x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); }
    x.strokeStyle = `rgba(255,170,242,${0.5 * a})`;
    for (let i = 0; i < 28; i++) { x.save(); x.rotate(i / 28 * 6.283); x.beginPath(); x.moveTo(R * 0.12, 0); x.lineTo(R, 0); x.stroke(); x.restore(); }
    x.strokeStyle = `rgba(255,110,205,${0.85 * a})`; x.lineWidth = R * 0.024;
    for (let i = 0; i < 18; i++) { x.save(); x.rotate(i / 18 * 6.283); x.beginPath(); x.arc(R * 0.52, 0, R * 0.24, Math.PI * 0.6, Math.PI * 1.4); x.stroke(); x.restore(); }
  } else if (style === 1) {
    const rr = R * 0.27, S = Math.sqrt(3), C = [[0, 0]];
    for (let i = 0; i < 6; i++) { const g = i * Math.PI / 3; C.push([Math.cos(g) * rr, Math.sin(g) * rr], [Math.cos(g) * rr * 2, Math.sin(g) * rr * 2], [Math.cos(g + Math.PI / 6) * rr * S, Math.sin(g + Math.PI / 6) * rr * S]); }
    x.strokeStyle = `rgba(255,140,235,${0.72 * a})`;
    for (const [ox, oy] of C) { x.beginPath(); x.arc(ox, oy, rr, 0, 7); x.stroke(); }
    x.strokeStyle = `rgba(255,180,245,${0.6 * a})`; for (const r of [R * 0.9, R]) { x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); }
  } else {
    x.setLineDash([R * 0.03, R * 0.05]); x.strokeStyle = `rgba(255,160,240,${0.55 * a})`;
    for (let r = R * 0.18; r < R; r += R * 0.11) { x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); }
    x.setLineDash([]); x.strokeStyle = `rgba(255,120,225,${0.85 * a})`; x.lineWidth = R * 0.022; x.beginPath();
    for (let g = 0; g < 13; g += 0.13) { const r = g / 13 * R; x.lineTo(Math.cos(g) * r, Math.sin(g) * r); } x.stroke();
  }
  const cg = x.createRadialGradient(0, 0, 0, 0, 0, R * 0.16); cg.addColorStop(0, `rgba(255,225,255,${0.9 * a})`); cg.addColorStop(1, "rgba(255,120,220,0)");
  x.fillStyle = cg; x.beginPath(); x.arc(0, 0, R * 0.16, 0, 7); x.fill();
  x.restore();
}

let _faceTex = null, _mandTex = null, _orbTex = null;

// SMOOTH self-lit FACE skin (same on all six faces): a soft violet radial gradient + a faint flowing mandala.
// No hard grid — smoother than before. Used as map + emissiveMap so every face glows uniformly.
function faceTexture() {
  if (_faceTex) return _faceTex;
  const S = 1024, c = document.createElement("canvas"); c.width = c.height = S; const x = c.getContext("2d");
  const bg = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.72);
  bg.addColorStop(0, "#5a34a0"); bg.addColorStop(0.55, "#3d2178"); bg.addColorStop(1, "#2a1556"); // smooth glow toward centre
  x.fillStyle = bg; x.fillRect(0, 0, S, S);
  drawMandala(x, S / 2, S / 2, S * 0.44, 0, 0.6);          // faint big mandala baked into the skin
  drawMandala(x, S / 2, S / 2, S * 0.2, 2, 0.5);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  _faceTex = t; return t;
}
// crisp glowing mandala decal (transparent, additive) — the identical colossal figure centred on every face
function mandalaTexture() {
  if (_mandTex) return _mandTex;
  const S = 512, c = document.createElement("canvas"); c.width = c.height = S; const x = c.getContext("2d");
  const aura = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); aura.addColorStop(0, "rgba(160,60,220,0.4)"); aura.addColorStop(0.7, "rgba(90,25,150,0.1)"); aura.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = aura; x.fillRect(0, 0, S, S);
  drawMandala(x, S / 2, S / 2, S * 0.46, 0, 1); drawMandala(x, S / 2, S / 2, S * 0.24, 1, 0.9);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; _mandTex = t; return t;
}
function orbTexture() {
  if (_orbTex) return _orbTex;
  const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,230,255,1)"); g.addColorStop(0.35, "rgba(255,120,230,0.7)"); g.addColorStop(1, "rgba(130,30,200,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; _orbTex = t; return t;
}

const addGlow = (color, opacity, tex) => noOutline(new THREE.MeshBasicMaterial({ color, map: tex || null, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));

export function buildCollectiveArena(b) {
  const scene = b.scene;
  const PLANE = new THREE.PlaneGeometry(1, 1);
  const UP = new THREE.Vector3(0, 1, 0);

  // one smooth emissive face material (cloned per face so repeats/rotation are independent) → ALL SIX FACES EQUAL
  const faceMat = () => { const t = faceTexture().clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; return new THREE.MeshStandardMaterial({ color: 0x6a44a8, map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.85, roughness: 0.7, metalness: 0.1, side: THREE.FrontSide }); };
  // the identical colossal mandala centred on a face (faces into the room)
  const faceMandala = (x, y, z, size, rotX, rotY) => { const m = new THREE.Mesh(PLANE, addGlow(0xffffff, 0.85, mandalaTexture())); m.position.set(x, y, z); m.scale.set(size, size, 1); m.rotation.set(rotX, rotY, 0); m.renderOrder = -1; scene.add(m); return m; };

  // ── 1. THE SIX EQUAL FACES ────────────────────────────────────────────────
  const inN = HALF - T - 0.4, faceSize = HALF * 1.5;
  // floor (walkable) + ceiling — IDENTICAL skin + mandala, so ground == top
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2), faceMat()); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2), faceMat()); ceil.rotation.x = Math.PI / 2; ceil.position.y = WALL_H; scene.add(ceil);
  faceMandala(0, 0.06, 0, faceSize, -Math.PI / 2, 0);            // floor mandala (up)
  faceMandala(0, WALL_H - 0.06, 0, faceSize, Math.PI / 2, 0);    // ceiling mandala (down) — equals the floor
  // four walls (custom emissive so they glow) + collider + occluder
  const buildWall = (cx, cz, w, d, ry) => { const wall = box(w, WALL_H, d, 0, { mat: faceMat() }); wall.position.set(cx, WALL_H / 2, cz); scene.add(wall); b.collide(cx, cz, w, d, WALL_H); b.solidMeshes.push(wall); return ry; };
  buildWall(0, HALF, HALF * 2 + T, T); buildWall(0, -HALF, HALF * 2 + T, T); buildWall(HALF, 0, T, HALF * 2 + T); buildWall(-HALF, 0, T, HALF * 2 + T);
  faceMandala(0, WALL_H * 0.42, inN, faceSize, 0, Math.PI);      // far (behind the boss → its halo)
  faceMandala(0, WALL_H * 0.42, -inN, faceSize, 0, 0);           // near
  faceMandala(inN, WALL_H * 0.42, 0, faceSize, 0, -Math.PI / 2); // east
  faceMandala(-inN, WALL_H * 0.42, 0, faceSize, 0, Math.PI / 2); // west

  // ── 2. NEON EDGE-TRIM on all 12 cube edges (defines the box crisply) ──
  const edgeMat = addGlow(EDGE, 0.95), edgeCore = noOutline(new THREE.MeshBasicMaterial({ color: 0xffd0f6, fog: false }));
  const beam = (a, bb) => { const len = a.distanceTo(bb), g = new THREE.Group(); g.add(cyl(1.2, 1.2, len, 0, 8, { mat: edgeMat }), cyl(0.45, 0.45, len, 0, 6, { mat: edgeCore })); g.position.copy(a.clone().add(bb).multiplyScalar(0.5)); g.quaternion.setFromUnitVectors(UP, bb.clone().sub(a).normalize()); scene.add(g); };
  const H = HALF, V = (x, z) => beam(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, WALL_H, z));
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) V(sx * H, sz * H);
  for (const y of [0.5, WALL_H - 0.5]) { beam(new THREE.Vector3(-H, y, -H), new THREE.Vector3(H, y, -H)); beam(new THREE.Vector3(-H, y, H), new THREE.Vector3(H, y, H)); beam(new THREE.Vector3(-H, y, -H), new THREE.Vector3(-H, y, H)); beam(new THREE.Vector3(H, y, -H), new THREE.Vector3(H, y, H)); }

  // ── 3. CRYSTALLINE THORNS growing INWARD from every face (dark smooth spike + glowing tip) ──
  b._collectiveThorns = [];
  const thornMat = mat(0x2a1248, { roughness: 0.3, emissive: 0x8a30c8, emissiveIntensity: 0.55 }); // smooth-shaded (not flat)
  const tipMat = addGlow(0xff7ae6, 0.7);
  const thornGeo = new THREE.ConeGeometry(1, 6, 10); thornGeo.translate(0, 3, 0); // base at 0, tip at +6
  const thorn = (px, py, pz, dir, s) => {
    const g = new THREE.Group(); g.position.set(px, py, pz); g.quaternion.setFromUnitVectors(UP, dir);
    const spike = new THREE.Mesh(thornGeo, thornMat); spike.scale.set(s * 0.42, s, s * 0.42); g.add(spike);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), tipMat); tip.position.y = s * 6; tip.scale.setScalar(s * 0.5); g.add(tip);
    scene.add(g); b._collectiveThorns.push(g);
  };
  const cluster = (px, py, pz, dir, base) => { for (let i = 0; i < 3 + (Math.random() * 3 | 0); i++) { const d = dir.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5)).normalize(); thorn(px + (Math.random() - 0.5) * 8, py + (Math.random() - 0.5) * 8, pz + (Math.random() - 0.5) * 8, d, base * (0.6 + Math.random() * 0.8)); } };
  const span = HALF * 2 - 30, rnd = () => (Math.random() - 0.5) * span;
  for (let i = 0; i < 7; i++) { cluster(inN, 20 + Math.random() * (WALL_H - 60), rnd(), new THREE.Vector3(-1, 0, 0), 3); cluster(-inN, 20 + Math.random() * (WALL_H - 60), rnd(), new THREE.Vector3(1, 0, 0), 3); } // east/west walls
  for (let i = 0; i < 7; i++) { cluster(rnd(), 20 + Math.random() * (WALL_H - 60), inN, new THREE.Vector3(0, 0, -1), 3); cluster(rnd(), 20 + Math.random() * (WALL_H - 60), -inN, new THREE.Vector3(0, 0, 1), 3); } // far/near walls
  for (let i = 0; i < 8; i++) cluster(rnd(), WALL_H - 0.5, rnd(), new THREE.Vector3(0, -1, 0), 3.4); // ceiling thorns hang down
  for (const [px, pz] of [[-95, -95], [95, -95], [-95, 95], [95, 95], [-100, 0], [100, 0]]) cluster(px, 0.5, pz, UP.clone(), 3); // floor thorns at the far perimeter (out of the play area)

  // ── 4. FLOATING WEIRD OBJECTS — crystals + polyhedra drifting through the tall volume (rotate in level.update) ──
  b._collectiveRocks = [];
  const shapes = [new THREE.IcosahedronGeometry(1, 0), new THREE.OctahedronGeometry(1, 0), new THREE.DodecahedronGeometry(1, 0), new THREE.TetrahedronGeometry(1, 0), new THREE.TorusKnotGeometry(0.7, 0.28, 48, 8)];
  const cMat = mat(0x3a1c5e, { roughness: 0.35, emissive: 0xc050e8, emissiveIntensity: 0.7 });
  const cShell = addGlow(0xc060ff, 0.13);
  for (let i = 0; i < 30; i++) {
    const ggeo = shapes[i % shapes.length], s = 2.2 + Math.random() * 5, px = rnd(), pz = rnd(), py = 16 + Math.random() * (WALL_H - 40);
    const o = new THREE.Mesh(ggeo, cMat); o.position.set(px, py, pz); o.scale.setScalar(s); o.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    const sh = new THREE.Mesh(ggeo, cShell); sh.scale.setScalar(1.4); o.add(sh); o.userData.baseY = py; o.userData.spin = 0.2 + Math.random() * 0.5; scene.add(o); b._collectiveRocks.push(o);
  }
  // glowing glyph-orbs peppering the volume
  b._collectiveOrbs = []; const orbGeo = new THREE.PlaneGeometry(6, 6), orbMat = addGlow(0xffffff, 0.9, orbTexture());
  for (let i = 0; i < 34; i++) { const o = new THREE.Mesh(orbGeo, orbMat); o.position.set(rnd(), 12 + Math.random() * (WALL_H - 30), rnd()); o.userData.baseY = o.position.y; scene.add(o); b._collectiveOrbs.push(o); }

  // ── 5. WEIRD COSMIC HANDS reaching from the walls (glowing magenta) ──
  b._collectiveHands = [];
  const skin = mat(0x8a3ab0, { roughness: 0.4, emissive: 0xe050e8, emissiveIntensity: 1.0 });
  const makeHand = () => { const g = new THREE.Group(); const arm = cyl(0.7, 1.8, 12, 0, 10, { mat: skin }); arm.rotation.x = Math.PI / 2; arm.position.z = -6; g.add(arm); const palm = box(3.2, 1.1, 3.2, 0, { mat: skin }); palm.position.z = 0.8; g.add(palm); for (let i = 0; i < 4; i++) { const f = box(0.55, 0.75, 3, 0, { mat: skin }); f.position.set(-1.1 + i * 0.72, 0, 3.2); g.add(f); } const th = box(0.75, 0.75, 2, 0, { mat: skin }); th.position.set(1.9, 0, 1.6); th.rotation.y = 0.65; g.add(th); g.scale.setScalar(1.7); return g; };
  for (const [hx, hy, hz, ry] of [[-inN + 1, 70, -60, Math.PI / 2], [inN - 1, 110, 30, -Math.PI / 2], [-50, 150, inN - 1, Math.PI], [70, 55, -inN + 1, 0], [inN - 1, 40, -80, -Math.PI / 2], [-90, 130, -inN + 1, 0.3]]) { const h = makeHand(); h.position.set(hx, hy, hz); h.rotation.set((Math.random() - 0.5) * 0.5, ry, (Math.random() - 0.5) * 0.5); h.userData.baseY = hy; scene.add(h); b._collectiveHands.push(h); }

  // ── 6. THE HALO behind the boss (layered on the far face's mandala) ──
  const haloY = 34, haloZ = HALF - T - 1.6;
  const ringMat = addGlow(0xff5ad0, 0.6); b._collectiveRings = [];
  for (const r of [22, 32, 44, 56]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 1.0, 10, 64), ringMat); ring.position.set(0, haloY, haloZ - 0.6); scene.add(ring); b._collectiveRings.push(ring); }
  const core = new THREE.Mesh(new THREE.CircleGeometry(16, 48), addGlow(0xffc0f4, 0.5)); core.position.set(0, haloY, haloZ - 0.2); core.rotation.y = Math.PI; scene.add(core);

  // ── 7. GAMEPLAY STRUCTURES (solid, correct collision) — pods, jetpack platforms, cover, conduits ──
  const podMat = mat(0x3a1f66, { roughness: 0.4, metalness: 0.3, emissive: 0x6a2ab0, emissiveIntensity: 0.5 });
  const podGlass = noOutline(new THREE.MeshBasicMaterial({ color: 0xc060ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  const captiveMat = mat(0x160a28, { emissive: 0x9a45e0, emissiveIntensity: 0.7, roughness: 0.5 }); const podFig = new THREE.CapsuleGeometry(0.5, 2, 4, 8);
  const makePod = (x, z) => { const g = new THREE.Group(); g.position.set(x, 0, z); const base = cyl(1.9, 2.1, 1, 0, 16, { mat: podMat }); base.position.y = 0.5; g.add(base); const tube = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 5.2, 20, 1, true), podGlass); tube.position.y = 3.7; g.add(tube); const cap = cyl(1.75, 1.75, 0.7, 0, 16, { mat: podMat }); cap.position.y = 6.6; g.add(cap); const fig = new THREE.Mesh(podFig, captiveMat); fig.position.y = 3.6; g.add(fig); scene.add(g); b.collide(x, z, 3.6, 3.6, 6.8); b.solidMeshes.push(g); };
  for (const [x, z] of [[-28, 18], [28, 18], [-28, 52], [28, 52], [-46, -22], [46, -22]]) makePod(x, z);
  const platMat = mat(0x4a2d84, { roughness: 0.7, emissive: 0x3a1a70, emissiveIntensity: 0.45 });
  const makePlatform = (x, z, size, top) => { const slab = box(size, 1.4, size, 0, { mat: platMat }); slab.position.set(x, top - 0.7, z); scene.add(slab); const rim = new THREE.Mesh(new THREE.TorusGeometry(size * 0.62, 0.16, 8, 4), addGlow(EDGE, 0.8)); rim.rotation.x = Math.PI / 2; rim.rotation.z = Math.PI / 4; rim.position.set(x, top, z); scene.add(rim); b.collide(x, z, size, size, top); b.solidMeshes.push(slab); };
  makePlatform(-74, -6, 18, 9); makePlatform(74, -6, 18, 9); makePlatform(0, -56, 15, 5.5);
  const coverMat = mat(0x40265f, { roughness: 0.6, emissive: 0x2a1050, emissiveIntensity: 0.4 });
  for (const [x, z] of [[-15, 2], [15, 2], [-22, 34], [22, 34], [0, -28]]) { const blk = box(3.6, 2.3, 3.6, 0, { mat: coverMat }); blk.position.set(x, 1.15, z); scene.add(blk); const trim = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.16, 3.7), addGlow(0xff5ad0, 0.7)); trim.position.set(x, 2.3, z); scene.add(trim); b.collide(x, z, 3.6, 3.6, 2.3); b.solidMeshes.push(blk); }
  const conduitMat = addGlow(0xff6ae0, 0.5);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, len = 66 + (i % 2) * 18; const vein = new THREE.Mesh(new THREE.PlaneGeometry(1.4, len), conduitMat); vein.rotation.x = -Math.PI / 2; vein.rotation.z = a; vein.position.set(Math.sin(a) * len * 0.5, 0.06, DZ - 20 + Math.cos(a) * len * 0.5); scene.add(vein); }

  // ── 8. THE DAIS + boss throne (in front of the far face) ──
  for (const [size, top] of [[46, 0.7], [38, 1.4], [30, 2.1], [23, 2.8], [17, 3.5], [12, 4.2], [9, 4.9]]) { const s = box(size, 0.7, size, 0x5a3a90, { roughness: 0.8, emissive: 0x3a1a70, emissiveIntensity: 0.5 }); s.position.set(0, top - 0.35, DZ); scene.add(s); b.collide(0, DZ, size, size, top); }
  const platform = box(9, 0.7, 9, 0x6a44a8, { roughness: 0.7, emissive: 0x4a1f88, emissiveIntensity: 0.9 }); platform.position.set(0, THRONE_TOP - 0.35, DZ); scene.add(platform); b.collide(0, DZ, 9, 9, THRONE_TOP);
  const seal = new THREE.Mesh(new THREE.RingGeometry(3.5, 5, 40), addGlow(0xffffff, 0.85, mandalaTexture())); seal.rotation.x = -Math.PI / 2; seal.position.set(0, THRONE_TOP + 0.05, DZ); scene.add(seal);

  // ── 9. ATMOSPHERE — bright violet haze + 3 scene-wide lights (emissive faces do the rest) ──
  scene.fog = new THREE.Fog(0x3a1a72, 150, 640);
  scene.add(new THREE.HemisphereLight(0xd878ff, 0x6a3aa0, 1.4));
  scene.add(new THREE.AmbientLight(0x7a48b8, 0.55));
  const key = new THREE.DirectionalLight(0xe8b0ff, 0.4); key.position.set(40, 160, -60); scene.add(key);

  // ── 10. SPAWN + bounds + pickups ──
  b.spawnAt(0, -96);
  b.setBounds({ minX: -105, maxX: 105, minZ: -105, maxZ: 105 });
  const CRATES = [["rifle", -34, -80], ["rifle", 34, -80], ["burst", -62, -40], ["burst", 62, -40], ["plasma", -90, 12], ["plasma", 90, 12], ["minigun", 0, -86], ["launcher", 0, 66], ["ammo", -40, 0], ["ammo", 40, 0], ["ammo", 0, -95], ["health", -60, 70], ["health", 60, 70], ["health", 0, 82]];
  for (const [kind, x, z] of CRATES) b.giftCrate(x, z, kind);

  return {
    throne: { x: 0, z: DZ, top: THRONE_TOP }, bossSpawn: { x: 0, z: DZ },
    droneSpawns: [{ x: -75, z: -55 }, { x: 75, z: -55 }, { x: -90, z: 18 }, { x: 90, z: 18 }, { x: 0, z: -70 }, { x: -55, z: 58 }, { x: 55, z: 58 }, { x: 0, z: 38 }, { x: -95, z: -10 }, { x: 95, z: -10 }],
  };
}
