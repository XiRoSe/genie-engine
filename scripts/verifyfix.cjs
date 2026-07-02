const { chromium } = require("playwright");
const ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
(async () => {
  const browser = await chromium.launch({ headless: true, args: ARGS });
  const page = await browser.newPage({ viewport: { width: 500, height: 500 } });
  await page.addInitScript(() => { const P = (window.AudioContext || window.webkitAudioContext).prototype; P.decodeAudioData = function () { return Promise.resolve(this.createBuffer(1, 1, 22050)); }; });
  await page.goto("http://localhost:5180/?level=meeseeks_mayhem", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => window.__game && window.__game.combat && window.__game.playerModel, null, { timeout: 60000 });
  const res = await page.evaluate(() => {
    const g = window.__game; const c = g.controller; const V = g.camera.position.constructor;
    g._introDone = true; g._disposeLobby && g._disposeLobby(); g._startPlay(); c.onUnlock = () => {};
    const out = {};
    const mk = (held, mouse) => ({ isDown: (...ks) => ks.some((k) => held.includes(k)), mouseDown: mouse, touch: null });

    // 1) plain JUMP (no jetpack) → NO glide flames. Simulate: jump up, fall back, sample thrust during descent.
    c.onGround = true; c.pos.set(0, 0, 0); c.feetY = g.level.terrainHeight(0, 0); c.vy = 0; c._flew = false;
    c.update(1 / 60, mk([" "], false)); // press jump
    let jumpFlamed = false; for (let i = 0; i < 120; i++) { c.update(1 / 60, mk([], false)); if (c.vy < 0 && c.thrust > 0) jumpFlamed = true; if (c.onGround && i > 5) break; }
    out.jumpFlamed = jumpFlamed; // should be FALSE

    // 2) after FLYING (jetpack) → glide flames on descent
    c.onGround = false; c.feetY = g.level.terrainHeight(0, 0) + 40; c.vy = 0; c._flew = false; c._jetFuel = 5;
    for (let i = 0; i < 30; i++) c.update(1 / 60, mk(["e"], false)); // fly up
    let flewGlide = false; for (let i = 0; i < 60; i++) { c.update(1 / 60, mk([], false)); if (c.vy < 0 && c.thrust > 0) flewGlide = true; if (c.onGround) break; }
    out.flewThenGlide = flewGlide; // should be TRUE

    // 3) Rick's ROCKET detonates on a GIANT (was passing through)
    const test = (extra, label) => {
      g.combat.enemies.length = 0; const gy = g.level.terrainHeight(0, 40);
      const mz = g.combat.spawnEnemy({ kind: "meeseeks", weapon: "gun", x: 0, z: 40, ...extra }); mz.group.position.set(0, gy, 40); mz.pos.set(0, 0, 40); g.scene.updateMatrixWorld(true);
      const hp0 = mz.hp;
      // place a rocket projectile INSIDE the meeseeks body volume → tests the detonate-on-enemy collision + blast
      const fake = { pos: new V(0, gy + mz.sc * 1.0, 40), detonateOnHit: true, isRocket: true, done: false, radius: 6, damage: 200, power: 15, scale: 1, update() {}, dispose() {} };
      g._projectiles = [fake]; g._updateProjectiles(1 / 60);
      return { label, sc: +mz.sc.toFixed(1), detonated: fake.done, damaged: +(hp0 - mz.hp).toFixed(0) };
    };
    out.rocketNormal = test({}, "normal"); out.rocketHuge = test({ huge: true }, "huge"); out.rocketGiant = test({ giant: true }, "giant");

    // 4) weapon spawns count + handlaser dmg
    out.weaponSpawns = (g.level.gifts || []).filter((gf) => ["rifle", "minigun", "burst", "plasma", "launcher"].includes(gf.kind)).length;
    out.handlaserDmg = g.weapon.guns.handlaser.dmg;
    return out;
  });
  console.log(JSON.stringify(res, null, 1));
  await browser.close();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
