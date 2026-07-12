import * as THREE from "three";

// A minimal STORY-CRAWL intro for enclosed stages (no drop-pod fall, no heli insertion). It just frames the
// camera on a target (the boss on its dais) with a slow cinematic push-in while the HUD story crawl plays, then
// ends → play begins. Matches the intro interface: start() / update(dt) / done / skip() / dispose().
export class CrawlIntro {
  constructor(scene, camera, target, dur, onStart) {
    this.camera = camera;
    this.target = new THREE.Vector3(target.x, target.y, target.z);
    this.dur = dur || 22; this.t = 0; this.done = false; this._onStart = onStart;
  }
  start() { if (this._onStart) this._onStart(); this.update(0.0001); }
  update(dt) {
    this.t += dt; const k = Math.min(this.t / this.dur, 1);
    const R = 96 - k * 36;                                   // slow dolly-in toward the meditating core
    this.camera.position.set(Math.sin(this.t * 0.05) * 14, 22 + k * 12, this.target.z - R);
    this.camera.lookAt(this.target.x, this.target.y, this.target.z);
    if (k >= 1) this.done = true;
  }
  skip() { this.t = this.dur; this.done = true; }
  dispose() {}
}
