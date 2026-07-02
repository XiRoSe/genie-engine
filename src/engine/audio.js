// Synthesized FPS audio — no asset files. Created on first user gesture.
export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this._noise = null;
    this.buffers = {};
  }

  ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 0.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this._noise = buf;
    this.clipsReady = this._loadClips(); // a promise the loader can await so music (incl. the big tracks) is decoded before play
  }
  async _loadClips() {
    const clips = {
      helicopter: "/audio/helicopter.ogg", // load first so the intro rotor is ready
      fire_player: "/audio/fire_player.wav",
      fire_enemy: "/audio/fire_enemy.wav",
      clipout: "/audio/clipout.wav",
      clipin: "/audio/clipin.wav",
      boltpull: "/audio/boltpull.wav",
      step1: "/audio/step1.wav",
      step2: "/audio/step2.wav",
      step3: "/audio/step3.wav",
      step4: "/audio/step4.wav",
      explosion: "/audio/explosion.wav",
      heli_fire: "/audio/heli_fire.wav",
      laser: "/audio/laser.ogg",
      sword: "/audio/sword.ogg",
      shotgun: "/audio/shotgun.ogg",
      plasma: "/audio/plasma.ogg",
      zap: "/audio/zap.ogg",
      thunder: "/audio/thunder.ogg",
      creature: "/audio/creature.ogg",
      hurt: "/audio/hurt.ogg",
      whoosh: "/audio/whoosh.ogg",
      pickup: "/audio/pickup.ogg",
      splash: "/audio/splash.ogg",
      car_engine: "/audio/car_engine.ogg",
      wade: "/audio/wade.mp3",                  // real "walking on a wet surface" — sliced per step for water walking/swimming
      dino_roar: "/audio/dino_roar.mp3",       // real dinosaur growl (replaces the formant synth)
      grenade_launch: "/audio/grenade_launch.mp3", // real rocket/grenade launch (plasma cannon)
      railgun: "/audio/railgun.mp3",           // real railgun shot
      battle_theme: "/audio/battle_theme.mp3", // Pacific Rim — opening crawl + victory finale (needed first)
      game_theme: "/audio/game_theme.mp3",     // Oliver Tree "Alien Boy" — the in-game loop (needed ~23s in)
      schwifty: "/audio/schwifty.mp3",          // Rick & Morty level's in-game track
      rick_wabba: "/audio/rick_wabba.mp3",      // Rick catchphrase (land + win)
      meeseeks_voice: "/audio/meeseeks_voice.mp3", // Meeseeks announces itself on landing
    };
    for (const [name, url] of Object.entries(clips)) {
      try {
        const ab = await (await fetch(url)).arrayBuffer();
        this.buffers[name] = await this.ctx.decodeAudioData(ab);
        // if the rotor is already running on the synth fallback, upgrade to the real clip now
        if (name === "helicopter" && this._rotorWanted && !this._rotorSrc) { this._stopSynthRotor(); this._startRealRotor(); }
        // battle theme just decoded: start (or upgrade from a synth fallback to) the real Pacific Rim track
        if (name === "battle_theme" && this._battleWanted && (!this._battle || !this._battle.real)) { if (this._battle) this.stopBattleMusic(); this._battleWanted = true; this.startBattleMusic(); }
        // game theme just decoded: start it if gameplay already asked for it
        if (name === (this._gameTrack || "game_theme") && this._gameWanted && !this._game) this.startGameMusic();
      } catch (e) {
        if (name === "battle_theme") { this._battleThemeFailed = true; if (this._battleWanted && !this._battle) this.startBattleMusic(); } // only NOW use the synth fallback
      }
    }
  }
  // play a decoded clip (overlap-capable, low latency). Returns false if unavailable.
  playBuf(name, vol = 0.5, rate = 1) {
    if (!this.ctx || !this.buffers[name]) return false;
    const s = this.ctx.createBufferSource();
    s.buffer = this.buffers[name];
    s.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    s.connect(g); g.connect(this.master);
    s.start();
    return true;
  }
  // play a short random window of a longer clip (e.g. one wet footstep out of a long walking recording), with a tail fade so it doesn't click
  playSlice(name, vol = 0.5, dur = 0.32, rate = 1) {
    if (!this.ctx || !this.buffers[name]) return false;
    const b = this.buffers[name], t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(vol, t + dur - 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(g); g.connect(this.master);
    const off = Math.random() * Math.max(0, b.duration - dur - 0.05);
    s.start(t, off, dur + 0.02);
    return true;
  }
  resume() { this.ensure(); if (this.ctx.state === "suspended") this.ctx.resume(); }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.6; }

  _noiseBurst(dur, freq, q, vol, type = "lowpass") {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise;
    const filt = this.ctx.createBiquadFilter();
    filt.type = type; filt.frequency.value = freq; filt.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.02);
  }
  _tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  shoot(pitch = 1) {
    if (this.playBuf("fire_player", 0.5, (0.96 + Math.random() * 0.08) * pitch)) return;
    this._noiseBurst(0.12, 2600 * pitch, 1.2, 0.55);
    this._noiseBurst(0.07, 900 * pitch, 0.8, 0.4);
    this._tone(120 * pitch, 0.12, "square", 0.35, 50);
  }
  enemyShot() {
    if (this.playBuf("fire_enemy", 0.22, 0.92 + Math.random() * 0.1)) return;
    this._noiseBurst(0.1, 1500, 1.0, 0.18);
    this._tone(90, 0.1, "square", 0.12, 45);
  }
  reload() {
    // real M4 reload sequence: mag out -> mag in -> bolt
    if (this.buffers.clipout) {
      this.playBuf("clipout", 0.6);
      setTimeout(() => this.playBuf("clipin", 0.6), 520);
      setTimeout(() => this.playBuf("boltpull", 0.6), 1040);
      return;
    }
    this._tone(420, 0.05, "square", 0.18);
    setTimeout(() => this._tone(300, 0.05, "square", 0.16), 180);
    setTimeout(() => this._tone(520, 0.06, "square", 0.2), 900);
    setTimeout(() => this._noiseBurst(0.05, 1800, 1, 0.15), 1100);
  }
  hitmarker(killed) { // crisp confirmation click (not a harsh square blip) + a satisfying low confirm on a kill
    this._noiseBurst(0.03, 3400, 1.6, 0.12, "highpass"); // sharp tick
    this._tone(killed ? 560 : 1500, 0.045, "triangle", 0.16);
    if (killed) setTimeout(() => { this._tone(360, 0.16, "sine", 0.24, 170); this._tone(540, 0.14, "sine", 0.12); }, 28); // warm two-tone kill chime
  }
  hurt() {
    if (this.playBuf("hurt", 0.6, 0.9 + Math.random() * 0.15)) return;
    this._noiseBurst(0.18, 500, 0.7, 0.4);
    this._tone(80, 0.18, "sawtooth", 0.3, 40);
  }
  step() {
    const n = 1 + Math.floor(Math.random() * 4);
    if (this.playBuf("step" + n, 0.4, 0.92 + Math.random() * 0.16)) return;
    this._noiseBurst(0.05, 300, 1, 0.07);
  }
  explosion() {
    if (this.playBuf("explosion", 0.85, 0.9 + Math.random() * 0.1)) return;
    this._noiseBurst(0.6, 400, 0.6, 0.7);
    this._tone(60, 0.6, "sawtooth", 0.4, 30);
  }
  heliShot() {
    if (this.playBuf("heli_fire", 0.4, 0.95 + Math.random() * 0.1)) return;
    this._noiseBurst(0.08, 1800, 1, 0.2);
  }
  // --- ARCFALL: synth sci-fi + creature + pickup sounds ---
  plasma() { if (this.playBuf("plasma", 0.5, 0.9 + Math.random() * 0.12)) return; this._tone(560, 0.2, "sawtooth", 0.3, 150); this._noiseBurst(0.12, 1400, 1, 0.12, "bandpass"); }
  grenadeLaunch() { // real rocket/grenade launcher (synth THOOMP fallback below)
    if (this.playBuf("grenade_launch", 0.6, 0.97 + Math.random() * 0.06)) return;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(340, t); o.frequency.exponentialRampToValueAtTime(68, t + 0.13);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.22);
    this._noiseBurst(0.17, 420, 1.5, 0.32, "bandpass"); // airy "thoomp" body
    this._noiseBurst(0.03, 2700, 1.2, 0.13, "highpass"); // mechanical launch click
  }
  zap() { if (this.playBuf("zap", 0.4)) return; this._noiseBurst(0.18, 3200, 0.6, 0.22, "bandpass"); this._tone(1000, 0.12, "square", 0.16, 2000); }
  laser(vol = 0.5) { if (this.playBuf("laser", vol, 1.4 + Math.random() * 0.15)) return; this._tone(880, 0.09, "square", 0.16 * (vol / 0.5), 300); this._noiseBurst(0.05, 2200, 1, 0.05); }
  beam(vol = 0.5) { if (this.playBuf("plasma", vol, 1.5 + Math.random() * 0.2)) return; this._tone(700, 0.16, "sawtooth", 0.2 * (vol / 0.5), 170); this._noiseBurst(0.1, 1800, 1, 0.06, "bandpass"); } // sci-fi laser BEAM
  swordSwing() { if (this.playBuf("sword", 0.6, 0.95 + Math.random() * 0.1)) return; this._noiseBurst(0.2, 760, 0.6, 0.18, "bandpass"); }
  thunder() { if (this.playBuf("thunder", 0.52, 0.7 + Math.random() * 0.2)) return; this._noiseBurst(0.9, 220, 0.5, 0.33); this._tone(52, 0.8, "sawtooth", 0.24, 26); } // storm rumble (1.5x louder)
  splash() { // water entry — a bright plume + a downward watery "bloop"
    this._noiseBurst(0.36, 2200, 0.5, 0.3, "lowpass");
    this._noiseBurst(0.28, 700, 0.8, 0.2, "lowpass");
    this._tone(380, 0.22, "sine", 0.12, 150);
  }
  shotgun() { if (this.playBuf("shotgun", 0.6, 0.9 + Math.random() * 0.1)) return; this._noiseBurst(0.3, 500, 0.6, 0.5); this._tone(80, 0.2, "sawtooth", 0.3, 40); }
  jetpack(on) { // realistic rocket thruster: looping filtered noise hiss + a low rumble
    if (!this.ctx) return;
    if (on && !this._jet) {
      const t = this.ctx.currentTime, g = this.ctx.createGain(); g.gain.value = 0; g.connect(this.master);
      if (!this._noiseBuf) { const n = this.ctx.sampleRate * 2, b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; this._noiseBuf = b; }
      const src = this.ctx.createBufferSource(); src.buffer = this._noiseBuf; src.loop = true;       // continuous exhaust hiss
      const bp = this.ctx.createBiquadFilter(); bp.type = "lowpass"; bp.frequency.value = 1500; bp.Q.value = 0.9;
      src.connect(bp); bp.connect(g);
      const o = this.ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = 62; const og = this.ctx.createGain(); og.gain.value = 0.32; o.connect(og); og.connect(g); // deep rumble
      src.start(); o.start();
      g.gain.linearRampToValueAtTime(0.5, t + 0.1);
      this._jet = { src, o, g };
    } else if (!on && this._jet) {
      const j = this._jet; this._jet = null; j.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.12);
      setTimeout(() => { try { j.src.stop(); } catch { /* stopped */ } try { j.o.stop(); } catch { /* stopped */ } }, 340);
    }
  }
  railgun() { // real railgun shot (synth fallback below)
    if (this.playBuf("railgun", 0.6, 0.97 + Math.random() * 0.06)) return;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const charge = this.ctx.createOscillator(); charge.type = "sawtooth";
    charge.frequency.setValueAtTime(280, t); charge.frequency.exponentialRampToValueAtTime(1900, t + 0.12);
    const cg = this.ctx.createGain(); cg.gain.setValueAtTime(0.0001, t); cg.gain.exponentialRampToValueAtTime(0.16, t + 0.1); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    charge.connect(cg); cg.connect(this.master); charge.start(t); charge.stop(t + 0.18);
    this._noiseBurst(0.12, 4200, 1.6, 0.5, "highpass");       // sharp electric CRACK on release
    const boom = this.ctx.createOscillator(); boom.type = "sine";
    boom.frequency.setValueAtTime(150, t + 0.1); boom.frequency.exponentialRampToValueAtTime(42, t + 0.65);
    const bg = this.ctx.createGain(); bg.gain.setValueAtTime(0.0001, t + 0.1); bg.gain.exponentialRampToValueAtTime(0.55, t + 0.14); bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.72);
    boom.connect(bg); bg.connect(this.master); boom.start(t + 0.1); boom.stop(t + 0.78);
    this.playBuf?.("zap", 0.5);                               // electric zap layer (CC0) if present
  }
  rewind() { // ARC-SAND time-warp — reverse-SWELL whoosh + descending warble + accelerating tape stutter + snap-back
    if (!this.ctx) return;
    const t = this.ctx.currentTime, dur = 1.8;
    if (!this._noiseBuf) { const n = this.ctx.sampleRate * 2, b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; this._noiseBuf = b; }
    // REVERSE-SWELL: band-passed noise that rises in pitch + volume — the unmistakable "rewind whoosh"
    const ns = this.ctx.createBufferSource(); ns.buffer = this._noiseBuf; ns.loop = true;
    const nf = this.ctx.createBiquadFilter(); nf.type = "bandpass"; nf.Q.value = 1.1;
    nf.frequency.setValueAtTime(350, t); nf.frequency.exponentialRampToValueAtTime(6800, t + dur);
    const ng = this.ctx.createGain(); ng.gain.setValueAtTime(0.02, t); ng.gain.exponentialRampToValueAtTime(0.34, t + dur * 0.86); ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    ns.connect(nf); nf.connect(ng); ng.connect(this.master); ns.start(t); ns.stop(t + dur + 0.05);
    // descending pitched warble
    const o = this.ctx.createOscillator(); o.type = "sawtooth";
    o.frequency.setValueAtTime(1100, t); o.frequency.exponentialRampToValueAtTime(150, t + dur);
    const vib = this.ctx.createOscillator(); vib.type = "sine"; vib.frequency.value = 11;
    const vg = this.ctx.createGain(); vg.gain.value = 85; vib.connect(vg); vg.connect(o.frequency); vib.start(t); vib.stop(t + dur);
    const lp = this.ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2800;
    // accelerating square-wave stutter (tape chatter spinning faster)
    const env = this.ctx.createGain(); env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(0.24, t + 0.12); env.gain.setValueAtTime(0.22, t + dur * 0.72); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const stut = this.ctx.createOscillator(); stut.type = "square"; stut.frequency.setValueAtTime(13, t); stut.frequency.exponentialRampToValueAtTime(44, t + dur);
    const sg = this.ctx.createGain(); sg.gain.value = 0.5; stut.connect(sg); sg.connect(env.gain); stut.start(t); stut.stop(t + dur);
    o.connect(lp); lp.connect(env); env.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
    this._tone(54, dur, "sine", 0.16, 38); // deep rumble
    setTimeout(() => { this._tone(1320, 0.2, "sine", 0.2); this._tone(1760, 0.24, "sine", 0.12); }, dur * 1000 - 60); // bright snap-back chime
  }
  wade() { // a wet footstep — a short slice of the real "wet surface" walking clip (synth fallback below)
    if (this.playSlice("wade", 0.6, 0.34, 0.95 + Math.random() * 0.12)) return;
    this._noiseBurst(0.18, 2600, 0.4, 0.2, "lowpass");
    this._noiseBurst(0.26, 760, 0.7, 0.15, "lowpass");
    this._tone(540, 0.1, "sine", 0.07, 230);
    setTimeout(() => this._tone(660, 0.08, "sine", 0.05, 300), 55);
  }
  swimStroke() { // gentle water swish of a stroke — a longer, slower slice of the wet-walking clip
    if (this.playSlice("wade", 0.4, 0.55, 0.78 + Math.random() * 0.1)) return;
    this._noiseBurst(0.34, 1000, 0.6, 0.15, "lowpass");
    this._noiseBurst(0.2, 440, 0.7, 0.1, "lowpass");
  }
  dropWhoosh() { // a HUGE capsule-plummet: real whoosh sample + a rising wind sweep + deep rumble (stoppable on impact)
    this.stopDropWhoosh(); if (!this.ctx) return;
    const t = this.ctx.currentTime, dur = 2.8, parts = this._whoosh = [];
    const add = (src, g) => parts.push({ src, g });
    if (this.buffers.whoosh) { const s = this.ctx.createBufferSource(); s.buffer = this.buffers.whoosh; s.playbackRate.value = 0.78; const g = this.ctx.createGain(); g.gain.value = 0.7; s.connect(g); g.connect(this.master); s.start(t); add(s, g); }
    const ns = this.ctx.createBufferSource(); ns.buffer = this._noise; ns.loop = true;
    const bp = this.ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(240, t); bp.frequency.exponentialRampToValueAtTime(3600, t + dur);
    const ng = this.ctx.createGain(); ng.gain.setValueAtTime(0.05, t); ng.gain.exponentialRampToValueAtTime(0.42, t + dur * 0.8); ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    ns.connect(bp); bp.connect(ng); ng.connect(this.master); ns.start(t); ns.stop(t + dur + 0.05); add(ns, ng);
    const o = this.ctx.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(48, t + dur); const og = this.ctx.createGain(); og.gain.setValueAtTime(0.2, t); og.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(og); og.connect(this.master); o.start(t); o.stop(t + dur + 0.05); add(o, og);
  }
  stopDropWhoosh() { // cut the plummet whoosh the instant the capsule lands
    if (!this._whoosh) return; const list = this._whoosh; this._whoosh = null;
    for (const w of list) { try { w.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.06); } catch { /* gone */ } setTimeout(() => { try { w.src.stop(); } catch { /* stopped */ } }, 180); }
  }
  poof(scale = 1) { // Meeseeks death "POOF" — a satisfying cartoon puff, deeper/louder the bigger the Meeseeks
    if (!this.ctx) return;
    const sz = Math.max(0.7, Math.min(3.0, Math.sqrt(Math.max(0.4, scale)))); // 1=normal, ~2.8=huge, capped for giant
    this._noiseBurst(0.13 * sz, 4600 / sz, 0.6, 0.5, "bandpass");  // sharp airy "pff" top
    this._noiseBurst(0.4 * sz, 1200 / sz, 0.5, 0.5, "lowpass");    // main body of the puff
    this._noiseBurst(0.62 * sz, 480 / sz, 0.4, 0.34, "lowpass");   // low smoke tail
    this._tone(360 / sz, 0.34 * sz, "sine", 0.34, 85 / sz);        // descending whoomph
  }
  creature() { // real dinosaur growl (formant-synth fallback below)
    if (this.playBuf("dino_roar", 0.65, 0.92 + Math.random() * 0.14)) return;
    if (!this.ctx) return;
    const t = this.ctx.currentTime, dur = 1.15;
    // glottal source: low sawtooth with a roar pitch arc (huff → open bellow → fall)
    const src = this.ctx.createOscillator(); src.type = "sawtooth";
    src.frequency.setValueAtTime(72, t); src.frequency.linearRampToValueAtTime(152, t + 0.2);
    src.frequency.setValueAtTime(138, t + dur * 0.5); src.frequency.exponentialRampToValueAtTime(50, t + dur);
    // master breath envelope, modulated by a ~24Hz growl rattle (rough vocal folds)
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t); amp.gain.exponentialRampToValueAtTime(0.7, t + 0.13);
    amp.gain.setValueAtTime(0.62, t + dur * 0.55); amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const growl = this.ctx.createOscillator(); growl.type = "sawtooth"; growl.frequency.setValueAtTime(21, t); growl.frequency.linearRampToValueAtTime(33, t + dur);
    const gAmt = this.ctx.createGain(); gAmt.gain.value = 0.32; growl.connect(gAmt); gAmt.connect(amp.gain); growl.start(t); growl.stop(t + dur);
    // three formant band-passes → an animal-throat timbre
    for (const [f, q, gn] of [[400, 9, 1.0], [1080, 11, 0.55], [2500, 12, 0.22]]) {
      const bp = this.ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = q;
      const fg = this.ctx.createGain(); fg.gain.value = gn; src.connect(bp); bp.connect(fg); fg.connect(amp);
    }
    amp.connect(this.master); src.start(t); src.stop(t + dur + 0.05);
    // chest sub-bass body
    const sub = this.ctx.createOscillator(); sub.type = "sine"; sub.frequency.setValueAtTime(56, t); sub.frequency.exponentialRampToValueAtTime(31, t + dur);
    const sg = this.ctx.createGain(); sg.gain.setValueAtTime(0.0001, t); sg.gain.exponentialRampToValueAtTime(0.32, t + 0.15); sg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    sub.connect(sg); sg.connect(this.master); sub.start(t); sub.stop(t + dur + 0.05);
    this._noiseBurst(0.55, 720, 1.8, 0.13, "bandpass"); // throaty rasp
  }
  arcGet() { if (this.playBuf("pickup", 0.6)) return; this._tone(660, 0.12, "sine", 0.32); setTimeout(() => this._tone(990, 0.16, "sine", 0.32), 90); setTimeout(() => this._tone(1320, 0.26, "sine", 0.3), 185); }
  arcFanfare() { // BIG triumphant victory fanfare — rising run, a major-chord bloom, sparkle + deep boom
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => setTimeout(() => this._tone(f, 0.45, "triangle", 0.3), i * 70));
    setTimeout(() => { for (const f of [784, 988, 1175, 1568, 2349]) this._tone(f, 0.9, "sine", 0.15); }, 430); // soaring major chord
    this._noiseBurst(0.55, 7000, 0.5, 0.16, "highpass"); // sparkle shimmer
    setTimeout(() => { this._tone(90, 0.8, "sine", 0.32, 50); this._tone(180, 0.7, "sine", 0.2, 90); }, 380); // deep victory boom
  }
  // looping vehicle engine — real engine loop (pitch rises with speed); synth fallback
  startEngine() {
    if (!this.ctx || this._eng) return;
    if (this.buffers.car_engine) {
      const s = this.ctx.createBufferSource(); s.buffer = this.buffers.car_engine; s.loop = true;
      const g = this.ctx.createGain(); g.gain.value = 0; s.connect(g); g.connect(this.master); s.start();
      g.gain.linearRampToValueAtTime(0.45, this.ctx.currentTime + 0.3);
      this._eng = { src: s, g, real: true };
      return;
    }
    const o = this.ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = 52;
    const lp = this.ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 430;
    const g = this.ctx.createGain(); g.gain.value = 0;
    o.connect(lp); lp.connect(g); g.connect(this.master); o.start();
    g.gain.linearRampToValueAtTime(0.13, this.ctx.currentTime + 0.3);
    this._eng = { o, g };
  }
  setEngine(speed) {
    if (!this._eng) return;
    if (this._eng.real) this._eng.src.playbackRate.value = 0.62 + Math.min(1.4, Math.abs(speed) * 0.045);
    else this._eng.o.frequency.value = 48 + Math.abs(speed) * 4.5;
  }
  stopEngine() {
    if (!this._eng) return; const e = this._eng; this._eng = null;
    e.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.12);
    setTimeout(() => { try { (e.src || e.o).stop(); } catch { /* already stopped */ } }, 350);
  }
  startRotor() {
    this._rotorWanted = true;
    if (!this.ctx || this._rotorSrc || this._rotor) return; // already running (or no ctx yet)
    if (this.buffers.helicopter) this._startRealRotor();
    else this._startSynthRotor();
  }
  _startRealRotor() {
    const s = this.ctx.createBufferSource(); s.buffer = this.buffers.helicopter; s.loop = true;
    const g = this.ctx.createGain(); g.gain.value = 0.6;
    s.connect(g); g.connect(this.master); s.start();
    this._rotorSrc = s; this._rotorGain = g;
  }
  _startSynthRotor() {
    // low rumble + blade "whomp"
    this._turbine = this.ctx.createOscillator();
    this._turbineG = this.ctx.createGain();
    const lp = this.ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 130; lp.Q.value = 0.6;
    this._turbine.type = "sawtooth"; this._turbine.frequency.value = 60;
    this._turbineG.gain.value = 0.05;
    this._turbine.connect(lp); lp.connect(this._turbineG); this._turbineG.connect(this.master);
    this._turbine.start(); this._turbineLP = lp;
    const chop = () => this._noiseBurst(0.09, 120, 0.6, 0.32, "lowpass");
    chop();
    this._rotor = setInterval(chop, 92);
  }
  _stopSynthRotor() {
    if (this._rotor) { clearInterval(this._rotor); this._rotor = null; }
    if (this._turbine) { try { this._turbine.stop(); } catch (e) { /* already stopped */ } this._turbine.disconnect(); this._turbine = null; }
    if (this._turbineLP) { this._turbineLP.disconnect(); this._turbineLP = null; }
  }
  stopRotor() {
    this._rotorWanted = false;
    if (this._rotorSrc) { try { this._rotorSrc.stop(); } catch (e) { /* already stopped */ } this._rotorSrc.disconnect(); this._rotorSrc = null; }
    this._stopSynthRotor();
  }
  // ── chill lo-fi R&B groove for the hero-select screen (warm Rhodes chords + bassline + soft beat) ──
  // Latin/SALSA groove for the Rick deploy screen (Rick's doing the salsa) — son clave + piano montuno + tumbao bass
  // + congas. All synth, no asset. Loops until stopSalsaMusic().
  startSalsaMusic() {
    if (!this.ctx || this._salsa) return;
    const ctx = this.ctx, bus = ctx.createGain(); bus.gain.value = 0; bus.connect(this.master);
    bus.gain.linearRampToValueAtTime(0.32, ctx.currentTime + 0.8);
    const f = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
    // i–iv–V–i in A minor, one chord per bar (montuno vamp)
    const chords = [[57, 60, 64, 67], [50, 53, 57, 60], [52, 56, 59, 64], [57, 60, 64, 67]];
    const roots = [33, 38, 40, 33]; // A1, D2, E2, A1
    const bpm = 186, beat = 60 / bpm, bar = beat * 4;
    const m = { bus, stopped: false, interval: null }; this._salsa = m;
    const piano = (fr, t, dur, vol) => { const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = fr; const o2 = ctx.createOscillator(); o2.type = "square"; o2.frequency.value = fr * 1.001; const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600; const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(bus); o.start(t); o2.start(t); o.stop(t + dur + 0.03); o2.stop(t + dur + 0.03); };
    const bassV = (fr, t, dur, vol) => { const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = fr; const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.04); };
    const perc = (t, freq, q, vol, dur = 0.05, type = "bandpass") => { const s = ctx.createBufferSource(); s.buffer = this._noise; const bp = ctx.createBiquadFilter(); bp.type = type; bp.frequency.value = freq; bp.Q.value = q; const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(bp); bp.connect(g); g.connect(bus); s.start(t); s.stop(t + dur + 0.02); };
    const clave = (t) => perc(t, 2000, 6, 0.32, 0.06, "bandpass"); // woodblock click
    let i = 0;
    const playBar = () => {
      if (m.stopped) return;
      const t = ctx.currentTime + 0.06, sixteenth = beat / 4, c = chords[i % 4].map(f), r = roots[i % 4];
      // son clave — alternate 3-side / 2-side each bar
      const three = [0, 3, 6, 10, 12], two = [4, 7, 12, 20 % 16]; const claveHits = (i % 2 === 0) ? three : two;
      for (const s of claveHits) clave(t + s * sixteenth);
      // montuno: bright syncopated piano arpeggio (offbeat-heavy)
      const pat = [0, 2, 3, 6, 8, 10, 11, 14]; // 16th offsets
      pat.forEach((s, k) => piano(c[[0, 2, 1, 3, 2, 0, 1, 2][k]] * (k >= 5 ? 2 : 1), t + s * sixteenth, sixteenth * 2.2, 0.075));
      // tumbao bass — anticipated: root on the "and of 2" and beat 4
      bassV(r, t + beat * 1.5, beat * 0.9, 0.26); bassV(f(roots[i % 4] + 7) / 1, t + beat * 3, beat * 0.9, 0.22);
      // congas + hats (busy latin feel)
      for (let h = 0; h < 8; h++) perc(t + h * beat * 0.5, h % 2 ? 6500 : 4200, 0.8, h % 2 ? 0.05 : 0.09, 0.03, "highpass");
      perc(t + beat * 0.5, 320, 2, 0.16, 0.08, "bandpass"); perc(t + beat * 2.5, 260, 2, 0.16, 0.09, "bandpass"); // low conga tones
      i++;
    };
    playBar(); m.interval = setInterval(playBar, bar * 1000);
  }
  stopSalsaMusic() { const m = this._salsa; if (!m) return; this._salsa = null; m.stopped = true; if (m.interval) clearInterval(m.interval); const t = this.ctx.currentTime; m.bus.gain.cancelScheduledValues(t); m.bus.gain.setValueAtTime(m.bus.gain.value, t); m.bus.gain.linearRampToValueAtTime(0, t + 0.4); }

  startLobbyMusic() {
    if (!this.ctx || this._lobbyMusic) return;
    const ctx = this.ctx, bus = ctx.createGain(); bus.gain.value = 0; bus.connect(this.master);
    bus.gain.linearRampToValueAtTime(0.34, ctx.currentTime + 1.4); // fade in
    const f = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
    // a smooth ii–V–I–vi style progression: Fmaj7, Em7, Dm7, G7
    const chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [55, 59, 62, 65]].map((c) => c.map(f));
    const bass = [29, 28, 26, 31].map(f); // F1, E1, D1, G1 (laid-back roots)
    const bpm = 72, beat = 60 / bpm, bar = beat * 4;
    const m = { bus, stopped: false, interval: null }; this._lobbyMusic = m;
    const pad = (fr, t, dur, vol) => { // soft electric-piano-ish voice
      const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = fr;
      const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = fr * 2.001;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1500;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(bus); o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    };
    const bassV = (fr, t, dur, vol) => { const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = fr; const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05); };
    const kick = (t) => { const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(125, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); const g = ctx.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.22); };
    const noise = (t, dur, freq, q, vol, type) => { const s = ctx.createBufferSource(); s.buffer = this._noise; const bp = ctx.createBiquadFilter(); bp.type = type; bp.frequency.value = freq; bp.Q.value = q; const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(bp); bp.connect(g); g.connect(bus); s.start(t); s.stop(t + dur + 0.02); };
    let i = 0;
    const playBar = () => {
      if (m.stopped) return;
      const t = ctx.currentTime + 0.06, c = chords[i % 4], b = bass[i % 4];
      for (const fr of c) pad(fr, t + 0.02, bar * 0.95, 0.085);              // held chord
      bassV(b, t, beat * 1.4, 0.2); bassV(b, t + beat * 2.5, beat * 1.2, 0.16); // syncopated bass
      kick(t); kick(t + beat * 2 + beat * 0.5);                              // laid-back kick
      noise(t + beat, 0.18, 1400, 1, 0.18, "bandpass"); noise(t + beat * 3, 0.18, 1400, 1, 0.18, "bandpass"); // snaps on 2 & 4
      for (let h = 0; h < 8; h++) noise(t + h * beat * 0.5, 0.04, 8000, 0.7, h % 2 ? 0.05 : 0.09, "highpass"); // hats
      i++;
    };
    playBar(); m.interval = setInterval(playBar, bar * 1000);
  }
  stopLobbyMusic() {
    const m = this._lobbyMusic; if (!m) return; this._lobbyMusic = null; m.stopped = true;
    if (m.interval) clearInterval(m.interval);
    try { m.bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4); } catch { /* ctx gone */ }
    setTimeout(() => { try { m.bus.disconnect(); } catch { /* already gone */ } }, 1400);
  }
  // ── Pacific Rim battle theme for gameplay: the real CC track if loaded, else a synth rock fallback ──
  startBattleMusic() {
    if (!this.ctx || this._battle) return;
    this._battleWanted = true;                               // remember we want it (the loader starts it once decoded)
    if (this.buffers.battle_theme) { // real Boris Harizanov "Pacific Rim" epic theme, looped
      const s = this.ctx.createBufferSource(); s.buffer = this.buffers.battle_theme; s.loop = true;
      const bus = this.ctx.createGain(); bus.gain.value = 0; bus.connect(this.master);
      bus.gain.linearRampToValueAtTime(0.5, this.ctx.currentTime + 1.2);
      s.connect(bus); s.start();
      this._battle = { bus, src: s, real: true };
      return;
    }
    if (!this._battleThemeFailed) return;                    // still decoding the real track → stay SILENT (no synth glitch); the loader will start it
    const ctx = this.ctx, bus = ctx.createGain(); bus.gain.value = 0; bus.connect(this.master);
    bus.gain.linearRampToValueAtTime(0.28, ctx.currentTime + 1.2); // synth fallback — only if the mp3 truly failed to load
    const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) curve[i] = Math.tanh((i / 512 - 1) * 4); // guitar overdrive
    const f = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
    const bpm = 146, beat = 60 / bpm, six = beat / 4;
    const m = { bus, stopped: false, interval: null }; this._battle = m;
    const chord = (rootMidi, t, dur, vol, sus) => { // distorted power chord (root + 5th + octave)
      const sh = ctx.createWaveShaper(); sh.curve = curve; sh.oversample = "2x";
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = sus ? 2700 : 1700;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      if (sus) { g.gain.setValueAtTime(vol * 0.8, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
      else g.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(dur, 0.14)); // palm-mute chug
      sh.connect(lp); lp.connect(g); g.connect(bus);
      for (const s of [0, 7, 12]) { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f(rootMidi + s); o.connect(sh); o.start(t); o.stop(t + dur + 0.05); }
    };
    const bass = (midi, t, dur, vol) => { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f(midi); const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 300; const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(lp); lp.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.03); };
    const kick = (t) => { const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.1); const g = ctx.createGain(); g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.2); };
    const snare = (t) => { const s = ctx.createBufferSource(); s.buffer = this._noise; const bp = ctx.createBiquadFilter(); bp.type = "highpass"; bp.frequency.value = 1800; const g = ctx.createGain(); g.gain.setValueAtTime(0.34, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16); s.connect(bp); bp.connect(g); g.connect(bus); s.start(t); s.stop(t + 0.18); const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = 190; const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.16, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12); o.connect(g2); g2.connect(bus); o.start(t); o.stop(t + 0.14); };
    const hat = (t, open) => { const s = ctx.createBufferSource(); s.buffer = this._noise; const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 7000; const g = ctx.createGain(); g.gain.setValueAtTime(open ? 0.1 : 0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.18 : 0.05)); s.connect(hp); hp.connect(g); g.connect(bus); s.start(t); s.stop(t + 0.2); };
    // E-minor heroic riff: palm-muted E gallop with G/A accents + a sustained C/A lift (Pacific-Rim feel). MIDI roots E2=40,G2=43,A2=45,C3=48
    const RIFF = [{ b: 40, s: 0, d: 0.5 }, { b: 40, s: 2, d: 0.3 }, { b: 40, s: 3, d: 0.3 }, { b: 43, s: 4, d: 0.5 }, { b: 40, s: 6, d: 0.3 }, { b: 45, s: 7, d: 0.5 }, { b: 40, s: 8, d: 0.5 }, { b: 40, s: 10, d: 0.3 }, { b: 40, s: 11, d: 0.3 }, { b: 48, s: 12, d: 1.0, sus: true }, { b: 45, s: 14, d: 1.0, sus: true }];
    const playBar = () => {
      if (m.stopped) return; const t0 = ctx.currentTime + 0.05;
      for (let bt = 0; bt < 4; bt++) { kick(t0 + bt * beat); if (bt % 2 === 1) snare(t0 + bt * beat); }
      for (let h = 0; h < 8; h++) hat(t0 + h * beat * 0.5, h === 7);
      for (const n of RIFF) { const t = t0 + n.s * six; chord(n.b + 12, t, n.d * beat, 0.15, n.sus); bass(n.b, t, n.d * beat, 0.22); }
    };
    playBar(); m.interval = setInterval(playBar, beat * 4 * 1000);
  }
  stopBattleMusic() {
    this._battleWanted = false; // so a stop mid-load doesn't auto-restart it when the mp3 finishes decoding
    const m = this._battle; if (!m) return; this._battle = null; m.stopped = true;
    if (m.interval) clearInterval(m.interval);
    try { m.bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3); } catch { /* ctx gone */ }
    setTimeout(() => { try { m.src && m.src.stop(); } catch { /* stopped */ } try { m.bus.disconnect(); } catch { /* already gone */ } }, 900);
  }
  // in-game loop: Oliver Tree "Alien Boy", looped (no synth fallback — just silent until the mp3 decodes)
  startGameMusic(name) {
    if (name) this._gameTrack = name;          // per-level track (e.g. "schwifty"); defaults to game_theme
    const track = this._gameTrack || "game_theme";
    if (!this.ctx || this._game) return;
    this._gameWanted = true; // remember it; the loader starts it once decoded
    if (!this.buffers[track]) return;
    const s = this.ctx.createBufferSource(); s.buffer = this.buffers[track]; s.loop = true;
    const bus = this.ctx.createGain(); bus.gain.value = 0; bus.connect(this.master);
    bus.gain.linearRampToValueAtTime(0.625, this.ctx.currentTime + 1.0); // in-game track, +25% louder
    s.connect(bus); s.start();
    this._game = { bus, src: s };
  }
  stopGameMusic() {
    this._gameWanted = false;
    const m = this._game; if (!m) return; this._game = null;
    try { m.bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3); } catch { /* ctx gone */ }
    setTimeout(() => { try { m.src && m.src.stop(); } catch { /* stopped */ } try { m.bus.disconnect(); } catch { /* already gone */ } }, 900);
  }
  win() { // full triumphant resolve — rising run into a sustained major chord + sparkle + warm root (no square blips)
    [392, 523, 659, 784].forEach((f, i) => setTimeout(() => this._tone(f, 0.32, "triangle", 0.26), i * 90));
    setTimeout(() => { for (const f of [523, 659, 784, 1047, 1319]) this._tone(f, 1.1, "sine", 0.14); }, 360); // sustained C-major chord
    this._noiseBurst(0.6, 7000, 0.5, 0.14, "highpass"); // sparkle
    setTimeout(() => this._tone(98, 0.95, "sine", 0.26, 55), 340); // warm low root
  }
  lose() { // dramatic death sting: dull impact + a slow descending drone
    this._noiseBurst(0.5, 320, 0.6, 0.42);
    this._tone(200, 1.3, "sawtooth", 0.3, 46);
    setTimeout(() => this._tone(130, 1.5, "sine", 0.26, 38), 220);
    setTimeout(() => this._tone(85, 1.8, "sawtooth", 0.2, 26), 520);
  }
}
