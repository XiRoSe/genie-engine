import * as THREE from "three";

// First-person controller: manual pointer-lock mouse-look (yaw + pitch) + WASD with AABB collision.
export class Controller {
  constructor(camera, domElement, level) {
    this.camera = camera;
    this.dom = domElement;
    this.level = level;

    this.eye = 1.7;
    this.radius = 0.5;
    this.walkSpeed = 6.2;
    this.sprintSpeed = 9.8;
    this.bob = 0;
    this.moving = false;
    this.onStep = null;
    this.onLand = null;
    this._stepT = 0;
    this.sensitivity = 0.0022;
    this.locked = false;
    this.onLock = null;
    this.onUnlock = null;
    // jump + duck
    this.eyeCur = this.eye;
    this.crouchEye = 1.05;
    this.crouching = false;
    this.vy = 0;
    this.feetY = 0;          // absolute height of the player's feet (0 = ground)
    this.jumpStrength = 7.6; // tuned so you can hop onto ~1.1m crates
    this.jetForce = 13; // jetpack thrust
    this.jetMax = 5; this._jetFuel = 5; // 5s of flight; recharges when you land
    this.gravity = 21;
    this.stepHeight = 0.4;   // anything taller than feet+step blocks; shorter is mountable
    this.onGround = true;
    this._jumpWas = false;

    camera.rotation.order = "YXZ";
    camera.position.set(level.playerSpawn.x, this.eye, level.playerSpawn.z);

    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._euler = new THREE.Euler(0, 0, 0, "YXZ"); // face into the compound (-Z), not the wall behind
    this.camera.quaternion.setFromEuler(this._euler);

    // VIEW MODE (engine-level): "first" = camera sits at the eye; "third" = camera orbits behind a body
    // point so a game can show a visible avatar. Movement/collision always run on the body point `this.pos`.
    this.view = "first";
    this.thirdDist = 5.0; this.thirdLift = 0.6; this.thirdSide = 0.75;   // 3rd-person camera distance + height + over-the-shoulder offset
    this.pos = new THREE.Vector3(level.playerSpawn.x, 0, level.playerSpawn.z); // body XZ (feetY = height)
    this.headPos = new THREE.Vector3(level.playerSpawn.x, this.eye, level.playerSpawn.z); // player head world point (what enemies/pickups target)

    this._onMove = (e) => {
      if (!this.locked) return;
      this._euler.setFromQuaternion(this.camera.quaternion);
      this._euler.y -= e.movementX * this.sensitivity;
      this._euler.x -= e.movementY * this.sensitivity;
      this._euler.x = Math.max(-1.5, Math.min(1.5, this._euler.x)); // clamp pitch
      this.camera.quaternion.setFromEuler(this._euler);
    };
    this._onLockChange = () => {
      this.locked = document.pointerLockElement === this.dom;
      if (this.locked) this.onLock?.();
      else this.onUnlock?.();
    };
    document.addEventListener("mousemove", this._onMove);
    document.addEventListener("pointerlockchange", this._onLockChange);
  }

  get isLocked() { return this.locked; }
  lock() { this.dom.requestPointerLock?.(); }
  unlock() { document.exitPointerLock?.(); }

  _blocked(x, z) {
    const b = this.level.bounds;
    if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) return true;
    const r = this.radius, clear = this.feetY + this.stepHeight;
    for (const c of this.level.colliders) {
      if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) {
        if ((c.top ?? 3.4) + (c.baseY || 0) > clear) return true; // taller than we can step/stand onto -> wall
      }
    }
    return false;
  }

  // highest surface directly beneath (x,z) we can stand on (terrain height, or a platform on top)
  _groundUnder(x, z) {
    let g = this.level.terrainHeight ? this.level.terrainHeight(x, z) : 0; // sculpted island terrain (flat levels: 0)
    for (const c of this.level.colliders) {
      if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) {
        const top = (c.top ?? 3.4) + (c.baseY || 0);
        if (top > g) g = top;
      }
    }
    return g;
  }

  update(dt, input) {
    // first-person: camera.position IS the body, so keep `pos` synced (lets external code teleport the player
    // by writing camera.position — spawn, respawn, drive-exit). Third-person: `pos` is authoritative (the camera
    // is the orbit cam, not the body), so don't read it back.
    if (this.view !== "third") { this.pos.x = this.camera.position.x; this.pos.z = this.camera.position.z; }
    // movement basis from camera yaw (flattened)
    this.camera.getWorldDirection(this._fwd);
    this._fwd.y = 0; this._fwd.normalize();
    // player's right = forward × up  (points +X when looking -Z)
    this._right.crossVectors(this._fwd, new THREE.Vector3(0, 1, 0)).normalize();

    let ix = 0, iz = 0;
    if (input.isDown("w", "arrowup")) iz += 1;
    if (input.isDown("s", "arrowdown")) iz -= 1;
    if (input.isDown("d", "arrowright")) ix += 1;
    if (input.isDown("a", "arrowleft")) ix -= 1;
    // touch joystick (mobile)
    const tc = input.touch;
    if (tc) { ix += tc.mx; iz += tc.mz; }

    // touch LOOK stick (mobile): rate-based turn while the stick is held
    if (tc && (tc.lookRX || tc.lookRY)) {
      const rate = 2.6; // radians/sec at full deflection
      this._euler.setFromQuaternion(this.camera.quaternion);
      this._euler.y -= tc.lookRX * rate * dt;
      this._euler.x -= tc.lookRY * rate * dt;
      this._euler.x = Math.max(-1.5, Math.min(1.5, this._euler.x));
      this.camera.quaternion.setFromEuler(this._euler);
    }

    const dir = this._tmpDir || (this._tmpDir = new THREE.Vector3());
    dir.set(0, 0, 0).addScaledVector(this._fwd, iz).addScaledVector(this._right, ix);
    this.moving = dir.lengthSq() > 0.0001;

    // duck (hold C / Z, or touch DUCK) — lower stance, slower. (NOT Ctrl: Ctrl+W closes the tab.)
    this.crouching = input.isDown("c", "z") || (tc && tc.duck);
    const targetEye = this.crouching ? this.crouchEye : this.eye;
    this.eyeCur += (targetEye - this.eyeCur) * Math.min(1, dt * 12);

    let speed = input.isDown("shift") && !this.crouching ? this.sprintSpeed : this.walkSpeed;
    if (this.crouching) speed *= 0.5;
    if (this.swimming) speed *= 1.15; // 15% faster through the water
    if (input.isDown("e") && this._jetFuel > 0) speed *= 1.5; // jetpack drives you faster in the move direction while hovering

    if (this.moving) {
      dir.normalize().multiplyScalar(speed * dt);
      let x = this.pos.x, z = this.pos.z;
      if (!this._blocked(x + dir.x, z)) x += dir.x;
      if (!this._blocked(x, z + dir.z)) z += dir.z;
      this.pos.x = x;
      this.pos.z = z;

      if (this.onGround) {
        this.bob += dt * (speed * 1.4);
        this._stepT += dt;
        const interval = input.isDown("shift") ? 0.23 : 0.34; // brisk footstep cadence — faster again when sprinting
        if (this._stepT > interval) { this._stepT = 0; this.onStep?.(); }
      }
    } else {
      this.bob += dt * 2;
    }

    // jump (Space) — only when standing on something (ground or a platform), not crouching
    const jp = input.isDown(" ");
    if (jp && !this._jumpWas && this.onGround && !this.crouching) { this.vy = this.jumpStrength; this.onGround = false; }
    this._jumpWas = jp;

    // JETPACK (hold E) — strong, fast; 5s of fuel that recharges when you land
    const firing = input.mouseDown || (tc && tc.fire);
    const wantJet = input.isDown("e") && !this.swimming && this._jetFuel > 0;
    const handJets = this.view === "third";               // Rick fires his palm-jets — can't full-thrust AND shoot
    this.jetting = wantJet && !(handJets && firing);
    if (this.jetting) { this.vy = this.jetForce; this.onGround = false; this._jetFuel = Math.max(0, this._jetFuel - dt); this._flew = true; } // remember he actually flew this air-time
    // REDUCED-THRUST GLIDE (Rick): descending under thrust → small palm/boot flames cushion the fall (slow-fall).
    // Only AFTER actually flying (jetpack), or falling from a genuine height (cliff/sky) — NOT from a plain jump.
    const heightAG = this.feetY - this._groundUnder(this.pos.x, this.pos.z);
    this.gliding = handJets && !this.onGround && !this.swimming && this.vy < 0 && this._jetFuel > 0 && (this._flew || heightAG > 7);
    if (this.gliding) { this.vy = Math.max(this.vy, -3.4); this.onGround = false; this._jetFuel = Math.max(0, this._jetFuel - dt * 0.4); }
    this.thrust = this.jetting ? 1 : (this.gliding ? 0.42 : 0); // jet intensity: full lift, or the small slow-fall glide (boots + palms)

    // vertical physics against the surface beneath us (lets you land on crates/platforms)
    this.feetY += this.vy * dt;
    this.vy -= this.gravity * dt;
    const groundY = this._groundUnder(this.pos.x, this.pos.z);
    const sea = this.level.seaLevel;
    if (sea !== undefined && groundY < sea - 1.0) {
      // over deep water → swim: ease smoothly to the surface (head above water), no jitter
      this.swimming = true; this.onGround = false; this.vy = 0; this._airT = 0;
      this.feetY += ((sea - 0.9) - this.feetY) * Math.min(1, dt * 6);
    } else {
      this.swimming = false;
      if (this.feetY <= groundY) {
        this.feetY = groundY; this.vy = 0; this.onGround = true;
        if (this._airT > 0.22) { this._stepT = 0; this.onLand?.(); } // landed after a real jump/jetpack (not a 1-frame terrain bump)
        this._airT = 0; this._flew = false; // reset flight memory on touchdown → next plain jump won't flame
      } else this.onGround = false;
    }
    if (!this.onGround && !this.swimming) this._airT = (this._airT || 0) + dt; // accumulate airborne time
    if ((this.onGround || this.swimming) && !this.jetting) this._jetFuel = this.jetMax; // recharge jetpack on the ground/water

    const bobAmt = (this.view === "third") ? 0 // no head-bob on a far orbit camera (the avatar has its own walk bob)
      : this.swimming ? Math.sin(this.bob * 0.8) * 0.08 : (this.moving && this.onGround) ? Math.sin(this.bob) * 0.045 : Math.sin(this.bob) * 0.012;
    const eyeY = this.feetY + this.eyeCur + bobAmt;
    this.headPos.set(this.pos.x, eyeY, this.pos.z); // the player's head — what enemies/pickups target (both views)
    if (this.view === "third") {
      this._fwd.set(0, 0, -1).applyEuler(this._euler); // full look dir (incl. pitch) for the orbit
      this.camera.position.set(
        this.pos.x - this._fwd.x * this.thirdDist + this._right.x * this.thirdSide, // over-the-shoulder so the body doesn't block the crosshair
        eyeY - this._fwd.y * this.thirdDist + this.thirdLift,
        this.pos.z - this._fwd.z * this.thirdDist + this._right.z * this.thirdSide);
    } else {
      this.camera.position.set(this.pos.x, eyeY, this.pos.z);
    }
  }
}
