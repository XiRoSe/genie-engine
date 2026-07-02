const { chromium } = require("playwright");
const ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
(async () => {
  const browser = await chromium.launch({ headless: true, args: ARGS });
  const page = await browser.newPage({ viewport: { width: 560, height: 640 } });
  await page.addInitScript(() => { const P = (window.AudioContext || window.webkitAudioContext).prototype; P.decodeAudioData = function () { return Promise.resolve(this.createBuffer(1, 1, 22050)); }; });
  await page.goto("http://localhost:5180/?level=meeseeks_mayhem", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => window.__game && window.__game.combat && window.__game.playerModel, null, { timeout: 60000 });
  const info = await page.evaluate(() => {
    const g = window.__game; const pm = g.playerModel;
    g._introDone = true; g._disposeLobby && g._disposeLobby(); g._startPlay(); g.controller.onUnlock = () => {};
    const out = { name: g._weaponName("handlaser"), mode: g.weapon.mode, beamColor: g.weapon.guns.handlaser.ecolor.toString(16) };
    // frame Rick via the menu pose (known-good), then hold hand-laser NOT firing → both hands should be forward (gunUp=1)
    let t = 0; for (let i = 0; i < 15; i++) { t += 1 / 60; g._rickMenuPose(1 / 60, t); }
    pm.setDancing(false); pm.setWeapon("handlaser"); pm.group.rotation.y = Math.PI; // face camera
    for (let i = 0; i < 40; i++) pm.update(1 / 60, false, 1, 0, 0, false); // NOT firing
    const w = pm._weights(); out.gunUp_notFiring = w.gunUp; out.hasGun = w.hasGun;
    // fire a green beam from the hand so it's visible in the shot
    const mz = pm.getMuzzle(); if (mz) g.vfx.laserBeam(mz.clone(), mz.clone().add(new g.camera.position.constructor(0, 0.2, 6)), 0x44ff44, 1);
    g.scene.updateMatrixWorld(true);
    document.querySelectorAll("#ui > *").forEach((e) => e.style && (e.style.display = "none"));
    if (g.engine.renderer) { g.engine.renderer.render(g.scene, g.camera); g.engine.outline && g.engine.outline.render(g.scene, g.camera); }
    return out;
  });
  await page.waitForTimeout(120);
  await page.screenshot({ path: "media/handlaser.jpg", type: "jpeg", quality: 90 });
  console.log(JSON.stringify(info));
  await browser.close();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
