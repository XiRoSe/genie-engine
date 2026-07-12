import * as THREE from "three";
import { OutlineEffect } from "three/addons/effects/OutlineEffect.js";
import { PostFX } from "./postfx.js";
import { COLORS } from "./primitives.js";

// Lightweight renderer: direct render (no post), PBR via image-based lighting.
export class Engine {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1)); // cap at 1 — big FPS win on hi-dpi (smooth driving)
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.85; // kept a bit dark for mood
    container.appendChild(this.renderer.domElement);

    // comic/anime "XIII" look: BOLD black ink outlines around everything (cel-shaded edges)
    this.outline = new OutlineEffect(this.renderer, { defaultThickness: 0.0058, defaultColor: [0, 0, 0], defaultAlpha: 0.95 });

    // AAA post-processing (bloom + colour-grade + vignette on top of the ink outlines). ?fx=off falls back to
    // the plain outline render for low-end devices / debugging.
    this.postfx = null;
    try {
      const off = typeof location !== "undefined" && /[?&]fx=off/.test(location.search);
      if (!off) this.postfx = new PostFX(this.renderer, this.outline, () => this.active);
    } catch (e) { this.postfx = null; /* post-fx unsupported → plain render */ }

    this.clock = new THREE.Clock();
    window.addEventListener("resize", () => this.resize());
    this.active = null;
  }

  // per-level look (bloom strength/threshold, saturation, contrast, tint, vignette) — see PostFX.configure
  setGrade(params) { this.postfx?.configure(params); }
  setOutline(thickness, alpha) { if (thickness != null) this.outline.defaultThickness = thickness; if (alpha != null) this.outline.defaultAlpha = alpha; }

  // Baked equirectangular night sky (gradient + stars + big glowing moon),
  // used as the skybox AND the reflection/IBL source.
  setupNight(scene) {
    const W = 2048, H = 1024;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    // clean, smooth night gradient
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0b1630");
    g.addColorStop(0.6, "#16273f");
    g.addColorStop(1, "#27394f");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // faint baked haze of distant stars (the crisp foreground stars are real 3D points, added below)
    for (let i = 0; i < 140; i++) {
      ctx.globalAlpha = 0.12 + Math.random() * 0.22;
      ctx.fillStyle = "#dfe7ff";
      ctx.fillRect(Math.random() * W, Math.random() * H * 0.5, 1, 1);
    }
    ctx.globalAlpha = 1;

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = tex;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    scene.environment = pmrem.fromEquirectangular(tex).texture;
    scene.environmentIntensity = 0.7;

    this.moonDir = new THREE.Vector3(-0.4, 0.62, -0.68).normalize();

    // crisp 3D moon billboard (a sprite — no equirect distortion)
    const mc = document.createElement("canvas"); mc.width = mc.height = 256;
    const m = mc.getContext("2d");
    const halo = m.createRadialGradient(128, 128, 50, 128, 128, 128);
    halo.addColorStop(0, "rgba(205,222,255,0.45)");
    halo.addColorStop(0.5, "rgba(185,205,250,0.10)");
    halo.addColorStop(1, "rgba(185,205,250,0)");
    m.fillStyle = halo; m.fillRect(0, 0, 256, 256);
    const disc = m.createRadialGradient(110, 110, 8, 128, 128, 66);
    disc.addColorStop(0, "#ffffff");
    disc.addColorStop(0.85, "#eef2ff");
    disc.addColorStop(1, "#ccd6ee");
    m.fillStyle = disc; m.beginPath(); m.arc(128, 128, 66, 0, 7); m.fill();
    // a couple of very subtle craters
    m.fillStyle = "rgba(165,180,215,0.25)";
    for (const [dx, dy, r] of [[-18, -8, 11], [14, 14, 14], [8, -22, 7]]) { m.beginPath(); m.arc(128 + dx, 128 + dy, r, 0, 7); m.fill(); }
    const mtex = new THREE.CanvasTexture(mc); mtex.colorSpace = THREE.SRGBColorSpace;
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: mtex, transparent: true, depthWrite: false, fog: false }));
    moon.position.copy(this.moonDir).multiplyScalar(400);
    moon.scale.setScalar(46); // small, distant moon
    scene.add(moon);

    // crisp 3D starfield — sharp round points on the upper sky dome (much cleaner than baked dots)
    const dot = document.createElement("canvas"); dot.width = dot.height = 32;
    const dctx = dot.getContext("2d");
    const dg = dctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    dg.addColorStop(0, "rgba(255,255,255,1)"); dg.addColorStop(0.4, "rgba(235,242,255,0.9)"); dg.addColorStop(1, "rgba(235,242,255,0)");
    dctx.fillStyle = dg; dctx.fillRect(0, 0, 32, 32);
    const dotTex = new THREE.CanvasTexture(dot); dotTex.colorSpace = THREE.SRGBColorSpace;
    // two layers: most stars small + crisp, a few brighter/bigger — both at fixed pixel size
    const mkStars = (n, px, op) => {
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        let x, y, z, d2;
        do { x = Math.random() * 2 - 1; y = Math.random(); z = Math.random() * 2 - 1; d2 = x * x + y * y + z * z; } while (d2 > 1 || y < 0.05);
        const r = 760 / Math.sqrt(d2);
        pos[i * 3] = x * r; pos[i * 3 + 1] = y * r; pos[i * 3 + 2] = z * r;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const m = new THREE.PointsMaterial({ map: dotTex, size: px, sizeAttenuation: false, transparent: true, opacity: op, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
      const p = new THREE.Points(geo, m); p.frustumCulled = false; p.renderOrder = -1; scene.add(p);
    };
    mkStars(720, 2.4, 0.85);  // the field
    mkStars(90, 4.5, 0.95);   // a few bright ones
  }

  // Bright daytime sky (blue gradient + soft clouds + sun) — also the IBL/reflection source.
  setupDay(scene) {
    const W = 2048, H = 1024;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#3a1c66"); g.addColorStop(0.42, "#5f2f86"); g.addColorStop(0.78, "#a8568f"); g.addColorStop(1, "#d39a86"); // purple anomaly storm sky (deep violet up top, not black)
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // scattered stars (no moon) — kept clear of the canvas TOP so they don't pinch at the zenith pole
    for (let i = 0; i < 220; i++) {
      const sx = Math.random() * W, sy = H * 0.14 + Math.random() * H * 0.32, r = Math.random() * 1.6 + 0.4;
      x.globalAlpha = 0.35 + Math.random() * 0.6; x.fillStyle = "#fdfbff";
      x.beginPath(); x.arc(sx, sy, r, 0, 7); x.fill();
    }
    x.globalAlpha = 1;
    // painterly cumulus clouds: each is a cluster of soft white puffs sitting on a flat shaded base
    const puff = (px, py, r, col, alpha) => {
      for (const ox of [0, -W, W]) { // draw wrapped copies so clouds are seamless across the equirect seam (no diagonal cut)
        const cg = x.createRadialGradient(px + ox, py - r * 0.2, r * 0.1, px + ox, py, r);
        cg.addColorStop(0, `rgba(${col},${alpha})`); cg.addColorStop(0.7, `rgba(${col},${alpha * 0.5})`); cg.addColorStop(1, `rgba(${col},0)`);
        x.fillStyle = cg; x.beginPath(); x.arc(px + ox, py, r, 0, 7); x.fill();
      }
    };
    for (let i = 0; i < 8; i++) {
      const cx = Math.random() * W, cy = H * 0.18 + Math.random() * H * 0.22, s = 0.8 + Math.random() * 0.9, n = 5 + Math.floor(Math.random() * 4), base = cy + 26 * s;
      for (let j = 0; j < n; j++) { // warm shaded underbellies first
        const px = cx + (j - n / 2) * 52 * s, r = (40 + Math.random() * 34) * s;
        puff(px, base, r, "176,98,50", 0.55);
      }
      for (let j = 0; j < n; j++) { // glowing darker-orange tops stacked above
        const px = cx + (j - n / 2) * 50 * s + (Math.random() - 0.5) * 20, py = cy + (Math.random() - 0.6) * 26 * s, r = (44 + Math.random() * 40) * s;
        puff(px, py, r, "232,150,80", 0.92);
      }
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = tex;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    scene.environment = pmrem.fromEquirectangular(tex).texture;
    scene.environmentIntensity = 1.0;
    this.sunDir = new THREE.Vector3(0.5, 0.82, 0.32).normalize(); // light direction only — no sun/moon disc in the storm sky

    // XIII-style cloud billboards: bold flat cumulus (shaded grey underbelly + crisp white body), each
    // drawn fully INSIDE its canvas (margin → no hard edges). Several distinct shapes so they never repeat.
    const makeCloud = () => {
      const cc = document.createElement("canvas"); cc.width = cc.height = 256; const x = cc.getContext("2d");
      const n = 4 + Math.floor(Math.random() * 3), lobes = [];
      for (let i = 0; i < n; i++) lobes.push({ x: 128 + (i - (n - 1) / 2) * 30 + (Math.random() - 0.5) * 14, y: 148 - Math.pow(Math.abs(i - (n - 1) / 2), 1.3) * 10 + (Math.random() - 0.5) * 12, r: 34 + Math.random() * 22 });
      for (const L of lobes) { const g = x.createRadialGradient(L.x, L.y + L.r * 0.45, 2, L.x, L.y + L.r * 0.45, L.r * 1.05); g.addColorStop(0, "rgba(170,94,48,0.92)"); g.addColorStop(0.8, "rgba(170,94,48,0.45)"); g.addColorStop(1, "rgba(170,94,48,0)"); x.fillStyle = g; x.beginPath(); x.arc(L.x, L.y + L.r * 0.35, L.r, 0, 7); x.fill(); } // darker warm underbelly
      for (const L of lobes) { const g = x.createRadialGradient(L.x, L.y - L.r * 0.25, 2, L.x, L.y, L.r); g.addColorStop(0, "rgba(236,156,86,1)"); g.addColorStop(0.82, "rgba(232,150,80,0.97)"); g.addColorStop(1, "rgba(232,150,80,0)"); x.fillStyle = g; x.beginPath(); x.arc(L.x, L.y, L.r, 0, 7); x.fill(); } // darker-orange body
      const t = new THREE.CanvasTexture(cc); t.colorSpace = THREE.SRGBColorSpace; return t;
    };
    const cloudTexes = [makeCloud(), makeCloud(), makeCloud(), makeCloud(), makeCloud()];
    this.cloudGroup = new THREE.Group(); scene.add(this.cloudGroup); this._clouds = [];
    for (let i = 0; i < 26; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexes[i % cloudTexes.length], transparent: true, opacity: 0.72 + Math.random() * 0.24, depthWrite: false, fog: false }));
      const a = Math.random() * Math.PI * 2, rad = 240 + Math.random() * 420, h = 140 + Math.random() * 180;
      sp.position.set(Math.cos(a) * rad, h, Math.sin(a) * rad);
      const w = 150 + Math.random() * 180; sp.scale.set(w, w * 0.52, 1);
      this.cloudGroup.add(sp); this._clouds.push({ sp, baseY: h, ph: Math.random() * 6.28, sc: w });
    }
  }

  // drift the whole cloud field + a gentle per-cloud billow (bob + breathe) so the sky feels alive
  driftClouds(dt, t) {
    if (this.cloudGroup) this.cloudGroup.rotation.y += dt * 0.012;
    if (!this._clouds) return;
    for (const c of this._clouds) {
      c.sp.position.y = c.baseY + Math.sin(t * 0.25 + c.ph) * 5;
      const b = 1 + Math.sin(t * 0.4 + c.ph) * 0.04;
      c.sp.scale.set(c.sc * b, c.sc * 0.52 * b, 1);
    }
  }

  // purple-storm lighting for the anomaly island + a lightning bolt rig
  addDayLights(scene) {
    this._hemi = new THREE.HemisphereLight(0xb98ce0, 0x3a2a52, 0.95); scene.add(this._hemi);
    scene.add(new THREE.AmbientLight(0x6a4a8a, 0.26));
    const sun = new THREE.DirectionalLight(0xe6ccff, 2.1); this._sun = sun;
    sun.position.copy(this.sunDir || new THREE.Vector3(0.5, 0.82, 0.32)).multiplyScalar(90);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    const s = sun.shadow.camera; s.near = 1; s.far = 220; s.left = -70; s.right = 70; s.top = 70; s.bottom = -70;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06;
    scene.add(sun, sun.target);
    // lightning bolt (a jagged additive line, hidden until a strike); a persistent light we only intensity-pulse
    const pts = []; for (let i = 0; i <= 10; i++) pts.push(new THREE.Vector3((Math.random() - 0.5) * 30, 380 - i * 34, (Math.random() - 0.5) * 30));
    this._bolt = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x9fd0ff, transparent: true })); // light-blue lightning
    this._bolt.visible = false; this._bolt.frustumCulled = false; scene.add(this._bolt);
    this._boltT = 0; this._strikeIn = 5 + Math.random() * 20; // first strike in 5–25s
    // shooting stars: a pool of bright streaks that arc across the sky
    this._meteors = [];
    for (let i = 0; i < 5; i++) {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const m = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xdff0ff, transparent: true, opacity: 0 }));
      m.frustumCulled = false; m.visible = false; scene.add(m);
      this._meteors.push({ line: m, t: 0, dur: 0, from: new THREE.Vector3(), to: new THREE.Vector3() });
    }
    this._meteorIn = 1 + Math.random() * 2;
    return sun;
  }

  // drive meteors each frame: occasionally launch a streak that arcs down across the sky with a fading tail
  shootingStars(dt) {
    if (!this._meteors) return;
    if ((this._meteorIn -= dt) <= 0) {
      this._meteorIn = 0.7 + Math.random() * 1.8; // far more frequent
      const m = this._meteors.find((x) => !x.line.visible);
      if (m) {
        const sx = (Math.random() - 0.5) * 900, sz = (Math.random() - 0.5) * 900, drop = 150 + Math.random() * 120;
        m.from.set(sx, 300 + Math.random() * 90, sz);
        m.to.set(sx + (Math.random() - 0.5) * 380, 300 + Math.random() * 90 - drop, sz + (Math.random() - 0.5) * 380); // longer, steeper streaks
        m.t = 0; m.dur = 0.6 + Math.random() * 0.6; m.line.visible = true;
      }
    }
    const head = this._v0 || (this._v0 = new THREE.Vector3()), tail = this._v1 || (this._v1 = new THREE.Vector3());
    for (const m of this._meteors) {
      if (!m.line.visible) continue;
      const f = (m.t += dt) / m.dur;
      if (f >= 1) { m.line.visible = false; continue; }
      head.copy(m.from).lerp(m.to, f); tail.copy(m.from).lerp(m.to, Math.max(0, f - 0.14));
      const pos = m.line.geometry.attributes.position;
      pos.setXYZ(0, tail.x, tail.y, tail.z); pos.setXYZ(1, head.x, head.y, head.z); pos.needsUpdate = true;
      m.line.material.opacity = Math.sin(f * Math.PI);
    }
  }

  // drive the lightning storm each frame: periodic strikes flash the scene + show a bolt + cue thunder
  skyStorm(dt) {
    if (!this._bolt) return;
    if (this._boltT > 0) {
      this._boltT -= dt;
      const f = Math.max(0, this._boltT / 0.26), flick = f * (0.7 + 0.3 * Math.sin(this._boltT * 90)); // flicker
      this.renderer.toneMappingExposure = 0.85 + flick * 4.8;        // big flash lights the whole stage (1.5x)
      if (this._hemi) this._hemi.intensity = 0.95 + flick * 9.0;     // strong ambient light pop (1.5x)
      if (this._sun) this._sun.intensity = 2.1 + flick * 6.0;
      this._bolt.material.opacity = Math.min(1, f * 1.6);
      if (this._boltT <= 0) { this._bolt.visible = false; this.renderer.toneMappingExposure = 0.85; if (this._hemi) this._hemi.intensity = 0.95; if (this._sun) this._sun.intensity = 2.1; }
    } else if ((this._strikeIn -= dt) <= 0) {
      this._strikeIn = 5 + Math.random() * 20; this._boltT = 0.26; // next strike in 5–25s
      const bx = (Math.random() - 0.5) * 540, bz = (Math.random() - 0.5) * 540, pos = this._bolt.geometry.attributes.position;
      let px = bx; for (let i = 0; i <= 10; i++) { px += (Math.random() - 0.5) * 30; pos.setXYZ(i, px, 410 - i * 38, bz + (Math.random() - 0.5) * 40); } // jagged forked bolt
      pos.needsUpdate = true; this._bolt.visible = true;
      this.onThunder && this.onThunder();
    }
  }

  addLights(scene) {
    const hemi = new THREE.HemisphereLight(0x3b4a68, 0x0a0c12, 0.62);
    scene.add(hemi);
    const amb = new THREE.AmbientLight(0x243352, 0.46);
    scene.add(amb);
    // cool moonlight key with soft shadows
    const moon = new THREE.DirectionalLight(0xaec6ff, 1.7);
    moon.position.copy(this.moonDir || new THREE.Vector3(-0.45, 0.7, -0.55)).multiplyScalar(60);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    const s = moon.shadow.camera;
    s.near = 1; s.far = 140;
    s.left = -40; s.right = 40; s.top = 40; s.bottom = -40;
    moon.shadow.bias = -0.0005;
    moon.shadow.normalBias = 0.06;
    scene.add(moon);
    scene.add(moon.target);
    return moon;
  }

  setActive(scene, camera) { this.active = { scene, camera }; }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.postfx?.setSize(w, h);
    if (this.active?.camera) { this.active.camera.aspect = w / h; this.active.camera.updateProjectionMatrix(); }
  }

  start(onFrame) {
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      const t = this.clock.elapsedTime;
      if (onFrame) onFrame(dt, t);
      if (this.active) { if (this.postfx) this.postfx.render(dt); else this.outline.render(this.active.scene, this.active.camera); }
    };
    loop();
  }
}
