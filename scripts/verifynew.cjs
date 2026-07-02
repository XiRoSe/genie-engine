const { chromium } = require("playwright");
const ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
(async () => {
  const browser = await chromium.launch({ headless: true, args: ARGS });
  const page = await browser.newPage({ viewport: { width: 500, height: 500 } });
  await page.addInitScript(() => { const P = (window.AudioContext || window.webkitAudioContext).prototype; P.decodeAudioData = function () { return Promise.resolve(this.createBuffer(1, 1, 22050)); }; });
  await page.goto("http://localhost:5180/?level=meeseeks_mayhem", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => window.__game && window.__game.combat && window.__game.playerModel, null, { timeout: 60000 });
  const res = await page.evaluate(() => {
    const g = window.__game; const pm = g.playerModel; const V = g.camera.position.constructor;
    g._introDone = true; g._disposeLobby && g._disposeLobby(); g._startPlay(); g.controller.onUnlock = () => {};
    const out = {};

    // 1) starts with hand-laser only
    out.startMode = g.weapon.mode; out.owned = g.weapon.owned.slice();
    pm.setWeapon(g.weapon.mode);
    for (let i = 0; i < 30; i++) pm.update(1 / 60, false, 1, 0, 0, false);
    out.handlaserHasGun = pm._weights().hasGun;                 // should be false (fires from hand)
    const mz0 = pm.getMuzzle(); out.muzzleFromHand = !!mz0;      // hand position returned

    // 2) weapon pickups scattered
    out.weaponPickups = (g.level.gifts || []).filter((gf) => ["rifle", "minigun", "burst", "plasma", "launcher"].includes(gf.kind)).map((gf) => gf.kind);

    // 3) pick up a rifle → gun appears
    g.weapon.give("rifle"); pm.setWeapon("rifle");
    for (let i = 0; i < 20; i++) pm.update(1 / 60, false, 1, 0, 0, false);
    out.afterPickupHasGun = pm._weights().hasGun; out.afterPickupOwned = g.weapon.owned.slice();

    // 4) jump pose while airborne
    for (let i = 0; i < 40; i++) pm.update(1 / 60, false, 1, 0, 0, true);
    out.jumpWeightAirborne = pm._weights().jump;
    for (let i = 0; i < 40; i++) pm.update(1 / 60, false, 1, 0, 0, false);
    out.jumpWeightGrounded = pm._weights().jump;

    // 5) bbox hitbox hits huge + giant (raycast center)
    const hit = (extra) => { g.combat.enemies.length = 0; const gy = g.level.terrainHeight(0, 0);
      const mz = g.combat.spawnEnemy({ kind: "meeseeks", weapon: "gun", x: 0, z: 30, ...extra }); mz.group.position.set(0, gy, 30); mz.pos.set(0, 0, 30);
      g.camera.position.set(0, gy + 1.6, 0); g.camera.lookAt(0, gy + mz.sc * 1.0, 30); g.camera.updateMatrixWorld(true); g.scene.updateMatrixWorld(true);
      const fwd = new V(); g.camera.getWorldDirection(fwd); const r = g._rayShot(fwd, 220);
      const hb = mz.hitbox.geometry.parameters; mz.dead = true; mz.removable = true;
      return { hit: !!(r && r.enemy === mz), hbW: +hb.width.toFixed(1), hbH: +hb.height.toFixed(1) }; };
    out.normalHit = hit({}); out.hugeHit = hit({ huge: true }); out.giantHit = hit({ giant: true });

    // 6) jump strength raised
    out.jumpStrength = +g.controller.jumpStrength.toFixed(1);
    return out;
  });
  console.log(JSON.stringify(res, null, 1));
  await browser.close();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
