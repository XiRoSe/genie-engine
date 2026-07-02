import { buildArcfallIsland } from "./arcfall.js";

// MEESEEKS MAYHEM — ARCFALL, re-skinned for Rick & Morty: it's the same island + the 12 arcs + the
// scavenged-weapon economy, but you're RICK (3rd-person, visible, holding a gun) and the guardians are
// Mr. MEESEEKS — regular ones plus HUGE tanky ones. Existing weapons only (Arc Blade + scattered guns).
export const meeseeks = {
  id: "meeseeks_mayhem",
  name: "MEESEEKS MAYHEM",
  config: {
    view: "third",                                              // 3rd-person: you see Rick + his gun
    scene: { sky: "day", fog: { color: 0x9a7fb0, near: 240, far: 1300 }, fov: 75 },
    intro: { enabled: true, style: "droppod", spottedCalloutAt: 4.5 }, // same sky-fall drop-pod cinematic + story as the original ARCFALL
    objective: { type: "collect", count: 12 },                  // recover the 12 arcs, same as ARCFALL
    helicopter: { spawnDelay: 99999 },
    // Rick starts with ONLY his innate GREEN palm-lasers (infinite) — the real blasters are scavenged from the island
    player: { grenades: 4, startLoadout: ["handlaser"], bannedWeapons: ["smg", "laser", "railgun", "flak"] },
    // sci-fi blaster names (they fire energy/laser bolts)
    weaponNames: { rifle: "PHOTON CARBINE", minigun: "TACHYON REPEATER", burst: "ION BURSTER", plasma: "PLASMA CANNON", launcher: "FUSION LAUNCHER" },
    music: "schwifty",                                          // this level's in-game track
    reinforce: "meeseeks",                                      // the sky-drop reinforcements are Meeseeks (mostly regular, some huge)
    messages: { deployHint: "CLICK TO DEPLOY — grab the 12 white magic rings, poof the Meeseeks, un-break time", hostileDown: "MEESEEKS POOFED" },
  },

  build(b) {
    buildArcfallIsland(b, { bossKind: "meeseeks" });            // the full ARCFALL island + arcs + weapons, with a HUGE Meeseeks guardian
    // no welcome party — Meeseeks rain from the sky every 5s during play (main._dropReinforcement)
    // Rick starts with only his palm-lasers — the real blasters are SCAVENGED (walk over a crate to acquire, Q to cycle)
    b.giftCrate(0, 40, "rifle"); b.giftCrate(-46, -10, "minigun"); b.giftCrate(54, 18, "burst");
    b.giftCrate(-24, 92, "plasma"); b.giftCrate(88, -34, "launcher");
    b.giftCrate(28, -70, "rifle"); b.giftCrate(-96, 40, "burst"); b.giftCrate(110, 60, "plasma"); b.giftCrate(-70, -58, "launcher"); b.giftCrate(120, -8, "minigun");
    // extra ammo caches dotted across the island (Rick burns through the scavenged arsenal fast)
    for (const [x, z] of [[0, 60], [-50, 4], [50, 6], [-30, -40], [42, -42], [-80, 34], [82, 30], [4, -72], [-110, -8], [122, 22], [-22, 130], [62, 112], [102, -50], [-92, 82], [18, 14], [-58, -64]]) b.giftCrate(x, z, "ammo");
  },
};
