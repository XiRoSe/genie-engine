import * as THREE from "three";
import { RICK_MODEL, RICK_WALK, RICK_RUN, RICK_GUN, RICK_DANCE, RICK_JUMP, RM_HAND_BONE, clipsOf } from "./rickmorty-assets.js";
import { makeHeldGun, gunKindForMode } from "./heldguns.js";
import { makeGunModel } from "./gunmodels.js";

// 3rd-person RICK avatar — a clean UE4-skeleton mesh driven by REAL Mixamo clips (Idle / Walk / Run / Gunplay)
// authored for this exact mesh, so they fit natively: no retargeting, no procedural swing/lean hacks. The held
// weapon rides the right-hand bone. Falls back to a procedural homage if the rig isn't present.
export function makeRick() {
  const group = new THREE.Group();
  let mixer = null, hand = null, handL = null, footR = null, footL = null;
  // Upper/lower-body split actions: legs run the locomotion clip, torso+arms crossfade to the Gunplay pose.
  let idleLo, idleUp, walkLo, walkUp, runLo, runUp, gunUp, dance, jump;
  let legL, legR, armL, armR; // procedural fallback handles

  if (RICK_MODEL.ready) {
    const inst = RICK_MODEL.make({ rightHand: RM_HAND_BONE, leftHand: "hand_l", rightFoot: "foot_r", leftFoot: "foot_l" });
    group.add(inst.model);
    mixer = new THREE.AnimationMixer(inst.model);
    // Each Mixamo clip is split into an upper half (torso/arms/head/hands) and a lower half (pelvis/legs/feet). The
    // legs always play locomotion; the arms swap to the aim pose while firing — so Rick runs-and-guns: legs keep
    // striding, hands hold the shooting stance. Upper+lower halves of the same clip stay in phase (never reset).
    const mk = (raw, up) => { const c = maskClip(raw, up); return c && c.tracks.length ? mixer.clipAction(c) : null; };
    const rIdle = clipsOf(RICK_MODEL)[0], rWalk = clipsOf(RICK_WALK)[0], rRun = clipsOf(RICK_RUN)[0], rGun = clipsOf(RICK_GUN)[0];
    idleLo = mk(rIdle, false); idleUp = mk(rIdle, true);
    walkLo = mk(rWalk, false); walkUp = mk(rWalk, true);
    runLo = mk(rRun, false); runUp = mk(rRun, true);
    gunUp = mk(rGun, true); // upper half of the gun stance (torso+arms); legs come from locomotion
    const rDance = clipsOf(RICK_DANCE)[0]; if (rDance) { dance = mixer.clipAction(rDance); dance.setEffectiveTimeScale(0.7); } // full-body Salsa for the deploy screen (a touch slower)
    const rJump = clipsOf(RICK_JUMP)[0]; if (rJump) jump = mixer.clipAction(rJump); // full-body jump pose (played while airborne)
    hand = inst.bones.rightHand; handL = inst.bones.leftHand; footR = inst.bones.rightFoot; footL = inst.bones.leftFoot;
    for (const a of [idleLo, idleUp, walkLo, walkUp, runLo, runUp, gunUp, dance, jump]) if (a) { a.play(); a.setEffectiveWeight(0); }
    if (idleLo) idleLo.setEffectiveWeight(1); if (idleUp) idleUp.setEffectiveWeight(1);
  } else {
    buildProcedural(group, (l, r, al, ar) => { legL = l; legR = r; armL = al; armR = ar; });
  }

  // held weapon — parented to the GROUP (native scale) and each frame snapped to the hand bone's position
  // while pointing forward (+Z = the way Rick faces/aims). Falls back to a fixed side position if unrigged.
  const _tmp = new THREE.Vector3();
  let gun = null, gunKind = null, laserHands = false;
  const setWeapon = (mode) => {
    laserHands = (mode === "handlaser");                       // palm-laser: hold both hands FORWARD (laser-ready), no held gun
    const k = gunKindForMode(mode); if (k === gunKind) return; gunKind = k;
    if (gun) { group.remove(gun); gun = null; }
    if (mode === "handlaser") return;                          // Rick's innate palm-laser — no held weapon, fires from the hand
    gun = makeGunModel(k) || makeHeldGun(k); group.add(gun); // real CC0 model when loaded, else procedural
    if (!hand) gun.position.set(0.34, 1.16, 0.34);
  };
  setWeapon("sword");
  const trackGun = () => {
    if (!hand || !gun) return;
    hand.updateWorldMatrix(true, false); hand.getWorldPosition(_tmp); group.worldToLocal(_tmp);
    gun.position.copy(_tmp); gun.position.z += 0.15; gun.rotation.set(gunPitch + restDown * 1.1, 0, 0); // aim pitch + lowered (barrel down) while standing idle
  };

  // IRON-MAN hand jets: no jetpack — while flying, fire streams down out of both palms (thrusters tracked to the hands)
  const thruster = makeThruster(); thruster.points.frustumCulled = false; group.add(thruster.points);

  let phase = 0, mW = 0, sW = 0, fW = 0, fT = 0, gunPitch = 0, restDown = 0, dW = 0, jpW = 0;
  let dancing = false;
  const _muzzleV = new THREE.Vector3(), _hp = new THREE.Vector3();
  return {
    group, setWeapon,
    setDancing(on) { dancing = !!on; }, // deploy screen: Rick does the Salsa (weaponless)
    getMuzzle() { // barrel tip (held gun) OR the right palm (hand-laser)
      if (!gun) { if (!hand) return null; hand.updateWorldMatrix(true, false); return hand.getWorldPosition(_muzzleV.set(0, 0, 0)).clone(); }
      gun.updateWorldMatrix(true, false); return gun.localToWorld(_muzzleV.set(0, 0, 0.7));
    },
    fireKick() { fT = 0.3; }, // firing → blend in the Gunplay clip for a moment
    _weights: () => ({ idleLo: idleLo ? +idleLo.getEffectiveWeight().toFixed(2) : 0, walkLo: walkLo ? +walkLo.getEffectiveWeight().toFixed(2) : 0, runLo: runLo ? +runLo.getEffectiveWeight().toFixed(2) : 0, walkUp: walkUp ? +walkUp.getEffectiveWeight().toFixed(2) : 0, gunUp: gunUp ? +gunUp.getEffectiveWeight().toFixed(2) : 0, jump: jump ? +jump.getEffectiveWeight().toFixed(2) : 0, hasGun: !!gun, gunRotX: gun ? +gun.rotation.x.toFixed(2) : 0 }), // debug: legs vs arms + jump + gun-present
    update(dt, moving, speed = 1, thrust = 0, aimPitch = 0, airborne = false) {
      const jetting = thrust > 0;                                // any palm/boot-thrust (full lift OR slow-fall glide)
      gunPitch = aimPitch;                                       // barrel follows the vertical aim
      const pts = [];                                            // jet emit points (group-local): feet always, hands only when NOT shooting
      if (jetting) {
        const firingNow = fW > 0.5;                              // hands busy on the gun → thrust from the boots only
        const emitters = firingNow ? [footR, footL] : [hand, handL, footR, footL];
        for (const b of emitters) if (b) { b.updateWorldMatrix(true, false); b.getWorldPosition(_hp); group.worldToLocal(_hp); pts.push(_hp.x, _hp.y, _hp.z); }
      }
      thruster.update(dt, thrust, pts);
      if (mixer) {
        mixer.update(dt);
        fT = Math.max(0, fT - dt);
        mW += ((moving ? 1 : 0) - mW) * Math.min(1, dt * 10);                     // idle↔move blend
        sW += (((moving && speed > 1.5) ? 1 : 0) - sW) * Math.min(1, dt * 8);     // walk↔run blend
        fW += (((fT > 0) ? 1 : 0) - fW) * Math.min(1, dt * 14);                   // gunplay (arm) blend
        dW += (((dancing && dance) ? 1 : 0) - dW) * Math.min(1, dt * 8);           // deploy-screen Salsa (full body)
        jpW += (((airborne && jump && thrust <= 0 && !dancing) ? 1 : 0) - jpW) * Math.min(1, dt * 12); // airborne jump pose (full body)
        const airPose = jetting ? 1 : 0;                                           // hovering/gliding → dangling idle body (unless aiming)
        const aim = laserHands ? 1 : fW;                                           // hand-laser → both hands held FORWARD always; else firing → gun-aim
        const g2 = 1 - dW, gj = 1 - jpW;                                            // g2 fades everything under the dance; gj under the jump
        const m = mW * (1 - airPose);                                              // locomotion only on the ground
        if (dance) dance.setEffectiveWeight(dW);
        if (jump) jump.setEffectiveWeight(jpW * g2);                                // full-body jump/tuck while off the ground
        // LEGS (lower body): hover-idle when airborne, otherwise locomotion (idle / walk / run)
        if (idleLo) idleLo.setEffectiveWeight(Math.max(1 - m, airPose) * g2 * gj);
        if (walkLo) walkLo.setEffectiveWeight(m * (1 - sW) * g2 * gj);
        if (runLo) runLo.setEffectiveWeight(m * sW * g2 * gj);
        // TORSO + ARMS (upper body): Gunplay aim while firing takes PRIORITY over hover + locomotion → keeps the
        // shooting animation even mid-air/while landing; otherwise hover-idle when airborne, else locomotion swing.
        if (gunUp) gunUp.setEffectiveWeight(aim * g2 * gj);
        if (idleUp) idleUp.setEffectiveWeight((1 - aim) * Math.max(1 - m, airPose) * g2 * gj);
        if (walkUp) walkUp.setEffectiveWeight((1 - aim) * m * (1 - sW) * g2 * gj);
        if (runUp) runUp.setEffectiveWeight((1 - aim) * m * sW * g2 * gj);
      } else if (legL) { // procedural fallback walk
        phase += dt * (moving ? 8.5 * speed : 2); const sw = Math.sin(phase);
        if (moving) { legL.rotation.x = sw * 0.7; legR.rotation.x = -sw * 0.7; armL.rotation.x = -sw * 0.6; armR.rotation.x = sw * 0.6; }
        else { legL.rotation.x *= 0.85; legR.rotation.x *= 0.85; }
      }
      restDown += (((!moving && fT <= 0 && !jetting) ? 1 : 0) - restDown) * Math.min(1, dt * 8); // lower the barrel when standing idle
      const stow = dancing || (jetting && fW < 0.35);            // gun stowed while flying/gliding — UNLESS actively firing (then it's in hand, aiming)
      if (gun) gun.visible = !stow;
      if (!stow) trackGun();                                     // keep the weapon in-hand + pointing forward/down
    },
  };
}

// Split a Mixamo/UE4 clip into upper-body (torso/arms/head/hands) vs lower-body (pelvis/legs/feet) track sets, so
// legs and arms can be driven from different clips. A bone is "upper" by name; everything else (incl. pelvis) is lower.
// pelvis + root live in the UPPER set so the gun-aim clip drives the whole torso orientation (without it, the gun's
// spine gets grafted onto the idle pelvis and the arms splay out to the side). Only the actual leg bones are "lower".
const UPPER_RE = /pelvis|root|spine|neck|head|clavicle|shoulder|upperarm|lowerarm|forearm|hand|thumb|index|middle|ring|pinky|finger/i;
function boneOf(trackName) { const dot = trackName.lastIndexOf("."); const path = dot >= 0 ? trackName.slice(0, dot) : trackName; return path.slice(path.lastIndexOf("/") + 1).split(":").pop(); }
function maskClip(clip, wantUpper) {
  if (!clip) return null;
  const tracks = clip.tracks.filter((t) => UPPER_RE.test(boneOf(t.name)) === wantUpper);
  return new THREE.AnimationClip(clip.name + (wantUpper ? "_up" : "_lo"), clip.duration, tracks);
}

function buildProcedural(group, refs) {
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, flatShading: true, ...o });
  const COAT = 0xcfe3ea, SKIN = 0xe8c9a8, HAIR = 0x9fd6e6, PANTS = 0x8a8f98, SHOE = 0x4a3b2e, BROW = 0x7a8a90;
  const legG = new THREE.Group(); group.add(legG);
  const mkLeg = (x) => { const leg = new THREE.Group(); const t = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.95, 8), mat(PANTS)); t.position.y = -0.48; leg.add(t); const s = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.42), mat(SHOE)); s.position.set(0, -0.98, 0.07); leg.add(s); leg.position.set(x, 0.95, 0); legG.add(leg); return leg; };
  const legL = mkLeg(-0.17), legR = mkLeg(0.17);
  const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 1.1, 10), mat(COAT)); coat.position.y = 1.55; group.add(coat);
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.16), mat(0x6fae9b)); shirt.position.set(0, 1.62, 0.3); group.add(shirt);
  const mkArm = (x) => { const arm = new THREE.Group(); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.11, 0.92, 8), mat(COAT)); s.position.y = -0.42; arm.add(s); const h = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), mat(SKIN)); h.position.y = -0.9; arm.add(h); arm.position.set(x, 2.0, 0); group.add(arm); return arm; };
  const armL = mkArm(-0.44), armR = mkArm(0.44);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.44), mat(SKIN)); head.position.y = 2.42; group.add(head);
  for (const sx of [-0.11, 0.11]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), mat(0xffffff, { roughness: 0.3 })); e.position.set(sx, 2.46, 0.22); group.add(e); const p = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat(0x101010)); p.position.set(sx, 2.46, 0.29); group.add(p); }
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.05), mat(BROW)); brow.position.set(0, 2.58, 0.23); group.add(brow);
  const hair = new THREE.Group(); hair.position.y = 2.7; group.add(hair);
  for (const [x, y, z, tilt] of [[0, 0, 0, 0], [-0.16, -0.02, 0.05, 0.4], [0.16, -0.02, 0.05, -0.4], [-0.1, 0, -0.16, 0.2], [0.1, 0, -0.16, -0.2], [0, 0.04, 0.16, 0]]) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 7), mat(HAIR)); s.position.set(x, y + 0.18, z); s.rotation.z = tilt; hair.add(s); }
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  refs(legL, legR, armL, armR);
}

// soft round particle sprite (radial gradient → glowing dot) for additive flames
function makeSoftTex() {
  const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.45, "rgba(255,255,255,0.55)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}

// GPU thruster plume: a pool of additive soft sprites emitted from the two nozzles, falling + spreading and
// fading through a hot→cool color ramp (blue-white core → yellow → orange → smoulder). update(dt, jetting).
function makeThruster() {
  const N = 130, NOZ = [[-0.13, -0.36], [0.13, -0.36]];
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), siz = new Float32Array(N), alp = new Float32Array(N);
  const vel = new Float32Array(N * 3), age = new Float32Array(N).fill(99), life = new Float32Array(N), pscl = new Float32Array(N).fill(1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(siz, 1));
  geo.setAttribute("aAlpha", new THREE.BufferAttribute(alp, 1));
  // alpha-blended (not additive) so the flame reads as solid even over the bright daytime scene
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: makeSoftTex() } },
    transparent: true, depthWrite: false,
    vertexShader: "attribute float aSize; attribute vec3 aColor; attribute float aAlpha; varying vec3 vC; varying float vA; void main(){ vC=aColor; vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*(340.0/max(0.1,-mv.z)); gl_Position=projectionMatrix*mv; }",
    fragmentShader: "uniform sampler2D uTex; varying vec3 vC; varying float vA; void main(){ float a=texture2D(uTex,gl_PointCoord).a; gl_FragColor=vec4(vC,a*vA); }",
  });
  const points = new THREE.Points(geo, mat); points.frustumCulled = false;
  // hot blue-white core → white → yellow → orange → red smoulder (core contrasts the orange scene)
  const ramp = (t) => t < 0.15 ? [0.75, 0.92, 1.0] : t < 0.35 ? [1.0, 0.98, 0.85] : t < 0.6 ? [1.0, 0.82, 0.3] : t < 0.85 ? [1.0, 0.42, 0.12] : [0.7, 0.16, 0.05];
  let acc = 0;
  return {
    points,
    update(dt, thrust, pts) {
      thrust = thrust || 0;                                       // 1 = full lift, ~0.42 = slow-fall glide (small flames), 0 = off
      if (thrust > 0 && pts && pts.length) { acc += dt; const rate = 0.0028 / Math.max(0.25, thrust); while (acc > rate) { acc -= rate; // sparser emission at low thrust
        for (let i = 0; i < N; i++) if (age[i] >= life[i]) {
          const h = ((Math.random() * pts.length / 3) | 0) * 3; // pick one of the emit points (hands)
          pos[i * 3] = pts[h] + (Math.random() - 0.5) * 0.05; pos[i * 3 + 1] = pts[h + 1]; pos[i * 3 + 2] = pts[h + 2] + (Math.random() - 0.5) * 0.05;
          const sp = 0.45 + 0.55 * thrust;                        // shorter, slower plume when gliding
          vel[i * 3] = (Math.random() - 0.5) * 0.5 * sp; vel[i * 3 + 1] = -(2.6 + Math.random() * 2.0) * sp; vel[i * 3 + 2] = (Math.random() - 0.5) * 0.5 * sp;
          age[i] = 0; life[i] = (0.22 + Math.random() * 0.2) * (0.6 + 0.4 * thrust); pscl[i] = thrust; break;
        }
      } }
      for (let i = 0; i < N; i++) {
        if (age[i] >= life[i]) { siz[i] = 0; alp[i] = 0; continue; }
        age[i] += dt; const tn = age[i] / life[i];
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        const c = ramp(tn); col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
        alp[i] = Math.min(1, tn * 6) * (1 - tn) * 1.3;          // fade in fast, fade out toward the tail
        siz[i] = (0.3 + 0.4 * tn) * (0.45 + 0.55 * pscl[i]);     // grows along the plume; smaller flames at low thrust (glide)
      }
      geo.attributes.position.needsUpdate = geo.attributes.aColor.needsUpdate = geo.attributes.aSize.needsUpdate = geo.attributes.aAlpha.needsUpdate = true;
    },
  };
}
